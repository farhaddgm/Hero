import crypto from "node:crypto";

import { ADMIN_AUTH_CONTRACT_VERSION } from "../../contracts/src/admin-auth.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SESSION_PREFIX = "hero-admin-session";

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function sign(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function sameSignature(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function immutableCopy(value) {
  return Object.freeze(structuredClone(value));
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new AdminAuthError("ADMIN_AUTH_INVALID", `${label} is invalid.`, 401);
  return value;
}

export class AdminAuthError extends Error {
  constructor(code, message, statusCode = 401) {
    super(message);
    this.name = "AdminAuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createAdminAuth(options = {}) {
  const secret = typeof options.secret === "string" && options.secret.length >= 32 ? options.secret : null;
  const issuer = options.issuer ?? "hero-control-plane-admin";
  const now = options.now ?? (() => new Date().toISOString());
  const revokedSessions = new Map();

  function currentEpoch() {
    const epoch = Date.parse(now());
    if (!Number.isFinite(epoch)) throw new Error("Admin auth clock must return an ISO timestamp.");
    return Math.floor(epoch / 1000);
  }

  function issueSession(input = {}) {
    if (!secret) throw new AdminAuthError("ADMIN_AUTH_NOT_CONFIGURED", "Admin authentication is not configured.", 503);
    const subject = assertIdentifier("subject", input.subject ?? "hero-admin");
    const sessionId = assertIdentifier("sessionId", input.sessionId ?? `session-${subject}`);
    const expiresAt = input.expiresAt === undefined ? currentEpoch() + 1800 : Number(input.expiresAt);
    if (!Number.isInteger(expiresAt) || expiresAt <= currentEpoch()) throw new AdminAuthError("ADMIN_AUTH_INVALID", "Session expiry is invalid.", 401);
    const payload = encode({ iss: issuer, sub: subject, sid: sessionId, role: "admin", exp: expiresAt, schemaVersion: ADMIN_AUTH_CONTRACT_VERSION });
    return `${SESSION_PREFIX}.${payload}.${sign(secret, payload)}`;
  }

  function authenticate(authorizationHeader) {
    if (!secret) throw new AdminAuthError("ADMIN_AUTH_NOT_CONFIGURED", "Admin authentication is not configured.", 503);
    if (typeof authorizationHeader !== "string" || authorizationHeader.trim() === "") throw new AdminAuthError("ADMIN_AUTH_REQUIRED", "Admin authentication is required.", 401);
    const match = authorizationHeader.trim().match(/^Bearer\s+(hero-admin-session\.[^.]+\.[^.]+)$/i);
    if (!match) throw new AdminAuthError("ADMIN_AUTH_INVALID", "Admin authentication is invalid.", 401);
    const [, token] = match;
    const [, payload, signature] = token.split(".");
    if (!sameSignature(sign(secret, payload), signature)) throw new AdminAuthError("ADMIN_AUTH_INVALID", "Admin authentication is invalid.", 401);
    let claims;
    try { claims = decode(payload); } catch { throw new AdminAuthError("ADMIN_AUTH_INVALID", "Admin authentication is invalid.", 401); }
    if (claims.iss !== issuer || claims.role !== "admin" || claims.schemaVersion !== ADMIN_AUTH_CONTRACT_VERSION) throw new AdminAuthError("ADMIN_AUTH_INVALID", "Admin authentication is invalid.", 401);
    assertIdentifier("claims.sub", claims.sub);
    assertIdentifier("claims.sid", claims.sid);
    if (!Number.isInteger(claims.exp) || claims.exp <= currentEpoch()) throw new AdminAuthError("ADMIN_AUTH_EXPIRED", "Admin session has expired.", 401);
    if (revokedSessions.has(claims.sid)) throw new AdminAuthError("ADMIN_AUTH_REVOKED", "Admin session has been revoked.", 401);
    return immutableCopy({ subject: claims.sub, sessionId: claims.sid, role: "admin", expiresAt: claims.exp, decision: "ADMIN_AUTHENTICATED" });
  }

  function revokeSession(input = {}) {
    const sessionId = assertIdentifier("sessionId", input.sessionId);
    const subject = input.subject === undefined ? null : assertIdentifier("subject", input.subject);
    const reason = String(input.reason ?? "admin-request").trim().slice(0, 240);
    if (!reason) throw new AdminAuthError("ADMIN_AUTH_INVALID", "Revocation reason is invalid.", 400);
    const record = immutableCopy({ sessionId, subject, revokedAt: now(), reason });
    revokedSessions.set(sessionId, record);
    return record;
  }

  function restoreRevocations(records = []) {
    if (!Array.isArray(records)) throw new AdminAuthError("ADMIN_AUTH_INVALID", "Admin session revocations must be an array.", 500);
    records.forEach(record => revokeSession(record));
    return Object.freeze({ restored: records.length, active: revokedSessions.size });
  }

  return Object.freeze({ issueSession, authenticate, requireAdmin: authenticate, revokeSession, restoreRevocations, configured: Boolean(secret) });
}
