import crypto from "node:crypto";

import { MFA_REQUIRED_ROLES } from "../../contracts/src/project-identity.mjs";
import { ProjectAccessError } from "./project-access.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SESSION_PREFIX = "hero-human-session";
const LOGIN_CHALLENGE_TTL_SECONDS = 300;
// Human sessions are intentionally long enough for a focused Back Office work
// session, but remain bounded and independently revocable.
export const HUMAN_IDENTITY_SESSION_TTL_SECONDS = 6 * 60 * 60;
const STEP_UP_TTL_SECONDS = 300;
const RECOVERY_COOLDOWN_SECONDS = 86_400;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function sign(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function same(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new HumanIdentityError("IDENTITY_INVALID", `${label} is invalid.`, 400);
  return value;
}

function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HumanIdentityError("IDENTITY_INVALID", "email is invalid.", 400);
  return email;
}

function assertPassword(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 1024) throw new HumanIdentityError("PASSWORD_INVALID", "Password must be between 12 and 1024 characters.", 400);
  return value;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString("base64url");
}

function decodeBase32(value) {
  const encoded = String(value).trim().replace(/[\s-]/g, "").replace(/=+$/g, "").toUpperCase();
  if (encoded.length < 16 || !/^[A-Z2-7]+$/.test(encoded)) {
    throw new HumanIdentityError("MFA_SECRET_INVALID", "The Base32 MFA secret is invalid.", 400);
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const output = [];
  let accumulator = 0;
  let bits = 0;
  for (const character of encoded) {
    accumulator = (accumulator << 5) | alphabet.indexOf(character);
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      output.push((accumulator >>> bits) & 0xff);
    }
    accumulator &= bits === 0 ? 0 : (1 << bits) - 1;
  }
  return Buffer.from(output);
}

function totpKeyCandidates(secret) {
  const value = String(secret ?? "").trim();
  if (/^base32:/i.test(value)) return [decodeBase32(value.slice(value.indexOf(":") + 1))];
  if (/^(?:legacy|legacy-utf8|utf8):/i.test(value)) {
    const legacy = value.slice(value.indexOf(":") + 1);
    if (legacy.length < 12) throw new HumanIdentityError("MFA_SECRET_INVALID", "The legacy MFA secret is invalid.", 400);
    return [Buffer.from(legacy, "utf8")];
  }
  if (value.length < 12) throw new HumanIdentityError("MFA_SECRET_INVALID", "The MFA secret is invalid.", 400);
  const candidates = [Buffer.from(value, "utf8")];
  const compact = value.replace(/[\s-]/g, "").replace(/=+$/g, "");
  if (compact.length >= 16 && /^[A-Z2-7]+$/i.test(compact)) candidates.push(decodeBase32(compact));
  return candidates;
}

function createTotpCodeForKey(key, epochSeconds) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(currentCounter(epochSeconds)));
  const digest = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(value % 1_000_000).padStart(6, "0");
}

function currentCounter(epochSeconds) {
  return Math.floor(epochSeconds / 30);
}

export function createTotpCode(secret, epochSeconds) {
  return createTotpCodeForKey(totpKeyCandidates(secret)[0], epochSeconds);
}

export class HumanIdentityError extends Error {
  constructor(code, message, statusCode = 401) {
    super(message);
    this.name = "HumanIdentityError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createHumanIdentity({
  accessRegistry,
  sessionSecret,
  owner,
  now = () => new Date().toISOString(),
  recoveryCodeFactory = () => crypto.randomBytes(18).toString("base64url"),
  consoleRecoveryVerifier = () => false
} = {}) {
  if (!accessRegistry || typeof accessRegistry.createUser !== "function" || typeof accessRegistry.getUser !== "function") throw new Error("Human identity requires a ProjectAccess registry.");
  const secret = typeof sessionSecret === "string" && sessionSecret.length >= 32 ? sessionSecret : null;
  const ownerUserId = accessRegistry.ownerUserId;
  const accounts = new Map();
  const accountByEmail = new Map();
  const challenges = new Map();
  const revokedSessions = new Map();
  const issuedSessions = new Map();
  const attemptWindows = new Map();

  function epoch() {
    const value = Math.floor(Date.parse(now()) / 1000);
    if (!Number.isFinite(value)) throw new Error("Human identity clock must return an ISO timestamp.");
    return value;
  }

  function activeAccountByEmail(email) {
    const userId = accountByEmail.get(normalizeEmail(email));
    const account = userId ? accounts.get(userId) : null;
    return account?.status === "active" ? account : null;
  }

  function publicAccount(account) {
    return copy({ userId: account.userId, email: account.email, displayName: account.displayName, mfaEnabled: Boolean(account.mfaSecret), mfaRequired: account.mfaRequired, status: account.status, createdAt: account.createdAt });
  }

  function recordAttempt(email) {
    const key = normalizeEmail(email);
    const timestamp = epoch();
    const window = attemptWindows.get(key) ?? { startedAt: timestamp, count: 0 };
    if (timestamp - window.startedAt >= 300) {
      window.startedAt = timestamp;
      window.count = 0;
    }
    window.count += 1;
    attemptWindows.set(key, window);
    if (window.count > 10) throw new HumanIdentityError("LOGIN_RATE_LIMITED", "Too many login attempts. Try again later.", 429);
  }

  function addAccount({ actor, userId, email, displayName, password, passwordHash, passwordSalt, mfaSecret, mfaSecretRef = null, mfaRequired, recoveryCodes = [], status = "active", createdAt = now(), recoveredAt = null, recoveryCooldownUntil = 0 }, { bootstrapOwner = false, hydrate = false } = {}) {
    const normalizedUserId = assertIdentifier("userId", userId);
    const normalizedEmail = normalizeEmail(email);
    if (accounts.has(normalizedUserId) || accountByEmail.has(normalizedEmail)) throw new HumanIdentityError("USER_EXISTS", "A user with this identifier or email already exists.", 409);
    const required = mfaRequired ?? normalizedUserId === ownerUserId;
    if (required && !hydrate && (typeof mfaSecret !== "string" || mfaSecret.length < 12)) throw new HumanIdentityError("MFA_REQUIRED", "Owner and admin accounts require an MFA secret reference.", 400);
    if (typeof mfaSecret === "string") totpKeyCandidates(mfaSecret);
    const salt = passwordSalt ?? crypto.randomBytes(16).toString("base64url");
    const account = {
      userId: normalizedUserId,
      email: normalizedEmail,
      displayName: String(displayName ?? normalizedUserId).trim().slice(0, 160),
      passwordSalt: salt,
      passwordHash: passwordHash ?? hashPassword(assertPassword(password), salt),
      mfaSecret: mfaSecret ?? null,
      mfaSecretRef: typeof mfaSecretRef === "string" ? mfaSecretRef.slice(0, 240) : null,
      mfaRequired: Boolean(required),
      recoveryCodeHashes: recoveryCodes.map(code => crypto.createHash("sha256").update(String(code)).digest("hex")),
      status: status === "disabled" ? "disabled" : "active",
      createdAt,
      recoveredAt,
      recoveryCooldownUntil
    };
    if (!bootstrapOwner && !hydrate) accessRegistry.createUser({ actor, user: { userId: normalizedUserId, email: normalizedEmail, displayName: account.displayName, role: "viewer" } });
    accounts.set(normalizedUserId, account);
    accountByEmail.set(normalizedEmail, normalizedUserId);
    return publicAccount(account);
  }

  if (owner) {
    if (owner.userId !== ownerUserId) throw new HumanIdentityError("OWNER_INVALID", "Configured owner must match the ProjectAccess owner.", 500);
    addAccount(owner, { bootstrapOwner: true });
  }

  function assertConfigured() {
    if (!secret) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Human identity session signing is not configured.", 503);
  }

  function issueSession(account, { mfaAt = epoch(), recoveredAt = account.recoveredAt } = {}) {
    assertConfigured();
    const sessionId = `human-${crypto.randomUUID()}`;
    const exp = epoch() + HUMAN_IDENTITY_SESSION_TTL_SECONDS;
    const payload = encode({ iss: "hero-human-identity", sub: account.userId, sid: sessionId, role: account.userId === ownerUserId ? "project-owner" : "member", exp, mfaAt, recoveredAt: recoveredAt ?? null, schemaVersion: "1.0" });
    issuedSessions.set(sessionId, { subject: account.userId, expiresAt: exp });
    return `${SESSION_PREFIX}.${payload}.${sign(secret, payload)}`;
  }

  function verifyMfa(account, code) {
    if (!account.mfaSecret) return !account.mfaRequired;
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
    const current = epoch();
    return totpKeyCandidates(account.mfaSecret).some(key =>
      [-30, 0, 30].some(offset => same(createTotpCodeForKey(key, current + offset), code))
    );
  }

  return Object.freeze({
    configured: Boolean(secret),
    createUser({ actor, user }) {
      if (actor?.role !== "project-owner") throw new ProjectAccessError("OWNER_REQUIRED", "Only the owner may invite a user.", 403);
      return addAccount({ actor, ...user });
    },
    hydrateUser({ user }) {
      if (!user || user.userId === ownerUserId || accounts.has(user.userId)) return this.getUser(user?.userId);
      return addAccount({ ...user, passwordHash: user.passwordHash, passwordSalt: user.passwordSalt, mfaSecret: null, mfaSecretRef: user.mfaSecretRef, mfaRequired: user.mfaRequired, status: user.status }, { hydrate: true });
    },
    persistenceRecord({ userId }) {
      const account = accounts.get(assertIdentifier("userId", userId));
      if (!account) throw new HumanIdentityError("USER_NOT_FOUND", "User does not exist.", 404);
      return copy({ userId: account.userId, email: account.email, displayName: account.displayName, passwordHash: account.passwordHash, passwordSalt: account.passwordSalt, mfaSecretRef: account.mfaSecretRef, mfaRequired: account.mfaRequired, status: account.status, createdAt: account.createdAt });
    },
    listUsers({ actor }) {
      if (actor?.role !== "project-owner") throw new ProjectAccessError("OWNER_REQUIRED", "Only the owner may list users.", 403);
      return Object.freeze([...accounts.values()].map(publicAccount));
    },
    setMfaRequired({ actor, userId, required = true, mfaSecret }) {
      if (actor?.role !== "project-owner") throw new ProjectAccessError("OWNER_REQUIRED", "Only the owner may change MFA policy.", 403);
      const account = accounts.get(assertIdentifier("userId", userId));
      if (!account) throw new HumanIdentityError("USER_NOT_FOUND", "User does not exist.", 404);
      if (required && typeof (mfaSecret ?? account.mfaSecret) !== "string") throw new HumanIdentityError("MFA_REQUIRED", "An MFA secret reference is required.", 400);
      account.mfaRequired = Boolean(required);
      if (mfaSecret !== undefined) account.mfaSecret = mfaSecret;
      return publicAccount(account);
    },
    beginLogin({ email, password }) {
      assertConfigured();
      recordAttempt(email);
      const account = activeAccountByEmail(email);
      if (!account || !same(hashPassword(String(password ?? ""), account.passwordSalt), account.passwordHash)) {
        throw new HumanIdentityError("LOGIN_INVALID", "Email or password is invalid.", 401);
      }
      const challengeId = `login-${crypto.randomUUID()}`;
      challenges.set(challengeId, { type: "login", userId: account.userId, expiresAt: epoch() + LOGIN_CHALLENGE_TTL_SECONDS });
      return copy({ challengeId, mfaRequired: Boolean(account.mfaRequired || account.mfaSecret), expiresInSeconds: LOGIN_CHALLENGE_TTL_SECONDS });
    },
    completeLogin({ challengeId, mfaCode }) {
      assertConfigured();
      const challenge = challenges.get(assertIdentifier("challengeId", challengeId));
      if (!challenge || challenge.type !== "login" || challenge.expiresAt < epoch()) throw new HumanIdentityError("LOGIN_CHALLENGE_INVALID", "Login challenge is invalid or expired.", 401);
      const account = accounts.get(challenge.userId);
      if (!account || !verifyMfa(account, mfaCode)) throw new HumanIdentityError("MFA_INVALID", "MFA verification failed.", 401);
      challenges.delete(challengeId);
      const token = issueSession(account);
      return copy({ token, principal: this.authenticate(`Bearer ${token}`) });
    },
    authenticate(authorizationHeader) {
      assertConfigured();
      const match = typeof authorizationHeader === "string" ? authorizationHeader.trim().match(/^Bearer\s+(hero-human-session\.[^.]+\.[^.]+)$/i) : null;
      if (!match) throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "Human authentication is required.", 401);
      const [, token] = match;
      const [, payload, signature] = token.split(".");
      if (!same(sign(secret, payload), signature)) throw new HumanIdentityError("IDENTITY_AUTH_INVALID", "Human authentication is invalid.", 401);
      let claims;
      try { claims = decode(payload); } catch { throw new HumanIdentityError("IDENTITY_AUTH_INVALID", "Human authentication is invalid.", 401); }
      if (claims.iss !== "hero-human-identity" || claims.schemaVersion !== "1.0" || !["project-owner", "member"].includes(claims.role)) throw new HumanIdentityError("IDENTITY_AUTH_INVALID", "Human authentication is invalid.", 401);
      assertIdentifier("claims.sub", claims.sub);
      assertIdentifier("claims.sid", claims.sid);
      if (!Number.isInteger(claims.exp) || claims.exp <= epoch()) throw new HumanIdentityError("IDENTITY_AUTH_EXPIRED", "Human session has expired.", 401);
      if (revokedSessions.has(claims.sid)) throw new HumanIdentityError("IDENTITY_AUTH_REVOKED", "Human session has been revoked.", 401);
      const issued = issuedSessions.get(claims.sid);
      if (!issued || issued.subject !== claims.sub || issued.expiresAt !== claims.exp) throw new HumanIdentityError("IDENTITY_AUTH_INVALID", "Human authentication is invalid.", 401);
      const account = accounts.get(claims.sub);
      if (!account || account.status !== "active") throw new HumanIdentityError("IDENTITY_AUTH_INVALID", "Human authentication is invalid.", 401);
      return copy({ subject: claims.sub, sessionId: claims.sid, role: claims.role, mfaAt: claims.mfaAt, recoveredAt: claims.recoveredAt, expiresAt: claims.exp, source: "human-identity" });
    },
    revokeSession({ actor, sessionId, reason = "user-request" }) {
      const principal = actor ?? null;
      const normalizedSessionId = assertIdentifier("sessionId", sessionId ?? principal?.sessionId);
      if (!principal || (principal.role !== "project-owner" && principal.sessionId !== normalizedSessionId)) throw new HumanIdentityError("SESSION_REVOKE_FORBIDDEN", "You may revoke only your own session.", 403);
      const record = copy({ sessionId: normalizedSessionId, subject: principal.subject, reason: String(reason).slice(0, 240), revokedAt: now() });
      revokedSessions.set(normalizedSessionId, record);
      return record;
    },
    restoreRevocations(records = []) {
      for (const record of records) {
        if (record?.sessionId && record?.userId) revokedSessions.set(record.sessionId, copy({ sessionId: record.sessionId, subject: record.userId, reason: String(record.reason ?? "restored").slice(0, 240), revokedAt: record.revokedAt ?? now() }));
      }
    },
    requestOwnerRecovery({ email }) {
      const account = activeAccountByEmail(email);
      if (account?.userId === ownerUserId) {
        const challengeId = `recovery-${crypto.randomUUID()}`;
        challenges.set(challengeId, { type: "recovery", userId: account.userId, code: recoveryCodeFactory(), expiresAt: epoch() + LOGIN_CHALLENGE_TTL_SECONDS });
      }
      return copy({ accepted: true, message: "If the account is eligible, recovery instructions were prepared." });
    },
    completeOwnerRecovery({ email, emailCode, recoveryCode, consoleApproved = false, newPassword }) {
      const account = activeAccountByEmail(email);
      if (!account || account.userId !== ownerUserId) throw new HumanIdentityError("RECOVERY_INVALID", "Recovery cannot be completed.", 401);
      const challenge = [...challenges.values()].find(item => item.type === "recovery" && item.userId === account.userId && item.expiresAt >= epoch());
      const emailVerified = Boolean(challenge && same(challenge.code, emailCode));
      const recoveryHash = crypto.createHash("sha256").update(String(recoveryCode ?? "")).digest("hex");
      const fallbackVerified = account.recoveryCodeHashes.some(hash => same(hash, recoveryHash)) || (consoleApproved === true && consoleRecoveryVerifier({ account: publicAccount(account) }) === true);
      if (!emailVerified || !fallbackVerified) throw new HumanIdentityError("RECOVERY_INVALID", "Recovery cannot be completed.", 401);
      const salt = crypto.randomBytes(16).toString("base64url");
      account.passwordSalt = salt;
      account.passwordHash = hashPassword(assertPassword(newPassword), salt);
      account.recoveredAt = epoch();
      account.recoveryCooldownUntil = epoch() + RECOVERY_COOLDOWN_SECONDS;
      for (const [sessionId, session] of issuedSessions) {
        if (session.subject === account.userId) revokedSessions.set(sessionId, copy({ sessionId, subject: account.userId, reason: "owner-recovery", revokedAt: now() }));
      }
      challenges.clear();
      return copy({ recovered: true, cooldownUntil: account.recoveryCooldownUntil });
    },
    stepUp({ principal, mfaCode }) {
      const account = accounts.get(principal?.subject);
      if (!account || !verifyMfa(account, mfaCode)) throw new HumanIdentityError("MFA_INVALID", "MFA verification failed.", 401);
      const token = issueSession(account, { mfaAt: epoch() });
      return copy({ token, principal: this.authenticate(`Bearer ${token}`) });
    },
    assertSensitiveActionAllowed({ principal, action }) {
      if (!["secret.reveal", "secret.write", "project.production.request"].includes(action)) return true;
      const account = accounts.get(principal?.subject);
      if (!account) throw new HumanIdentityError("IDENTITY_AUTH_INVALID", "Human authentication is invalid.", 401);
      if (!Number.isInteger(principal.mfaAt) || epoch() - principal.mfaAt > STEP_UP_TTL_SECONDS) throw new HumanIdentityError("STEP_UP_REQUIRED", "Recent MFA verification is required.", 403);
      if (account.recoveryCooldownUntil > epoch()) throw new HumanIdentityError("RECOVERY_COOLDOWN_ACTIVE", "Sensitive actions are temporarily blocked after recovery.", 403);
      return true;
    },
    requiresMfaForRole(role) {
      return MFA_REQUIRED_ROLES.includes(role);
    },
    getUser(userId) {
      const account = accounts.get(userId);
      return account ? publicAccount(account) : null;
    }
  });
}
