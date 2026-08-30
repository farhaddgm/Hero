import crypto from "node:crypto";

import {
  OWNER_AUTH_CONTRACT_VERSION,
  getOwnerAuthContractSummary
} from "../../contracts/src/owner-auth.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SESSION_PREFIX = "hero-session";

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new OwnerAuthError("OWNER_AUTH_INVALID", `${label} is invalid.`, 401);
  return value;
}

function immutableCopy(value) {
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

function sameSignature(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export class OwnerAuthError extends Error {
  constructor(code, message, statusCode = 401) {
    super(message);
    this.name = "OwnerAuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createOwnerAuth(options = {}) {
  const secret = typeof options.secret === "string" && options.secret.length >= 32 ? options.secret : null;
  const issuer = options.issuer ?? "hero-control-plane";
  const now = options.now ?? (() => new Date().toISOString());

  function currentEpoch() {
    const timestamp = now();
    const epoch = Date.parse(timestamp);
    if (!Number.isFinite(epoch)) throw new Error("Owner auth clock must return an ISO timestamp.");
    return Math.floor(epoch / 1000);
  }

  function issueSession(input = {}) {
    if (!secret) throw new OwnerAuthError("OWNER_AUTH_NOT_CONFIGURED", "Owner authentication is not configured.", 503);
    const subject = assertIdentifier("subject", input.subject ?? "hero-owner");
    const sessionId = assertIdentifier("sessionId", input.sessionId ?? `session-${subject}`);
    const expiresAt = input.expiresAt === undefined ? currentEpoch() + 3600 : Number(input.expiresAt);
    if (!Number.isInteger(expiresAt) || expiresAt <= currentEpoch()) throw new OwnerAuthError("OWNER_AUTH_INVALID", "Session expiry is invalid.", 401);
    const payload = encode({
      iss: issuer,
      sub: subject,
      sid: sessionId,
      role: "project-owner",
      exp: expiresAt,
      schemaVersion: OWNER_AUTH_CONTRACT_VERSION
    });
    return `${SESSION_PREFIX}.${payload}.${sign(secret, payload)}`;
  }

  function authenticate(authorizationHeader) {
    if (!secret) throw new OwnerAuthError("OWNER_AUTH_NOT_CONFIGURED", "Owner authentication is not configured.", 503);
    if (typeof authorizationHeader !== "string" || authorizationHeader.trim() === "") {
      throw new OwnerAuthError("OWNER_AUTH_REQUIRED", "Owner authentication is required.", 401);
    }
    const match = authorizationHeader.trim().match(/^Bearer\s+(hero-session\.[^.]+\.[^.]+)$/i);
    if (!match) throw new OwnerAuthError("OWNER_AUTH_INVALID", "Owner authentication is invalid.", 401);
    const [, token] = match;
    const [, payload, signature] = token.split(".");
    if (!sameSignature(sign(secret, payload), signature)) throw new OwnerAuthError("OWNER_AUTH_INVALID", "Owner authentication is invalid.", 401);
    let claims;
    try {
      claims = decode(payload);
    } catch {
      throw new OwnerAuthError("OWNER_AUTH_INVALID", "Owner authentication is invalid.", 401);
    }
    if (claims.iss !== issuer || claims.role !== "project-owner" || claims.schemaVersion !== OWNER_AUTH_CONTRACT_VERSION) {
      throw new OwnerAuthError("OWNER_AUTH_INVALID", "Owner authentication is invalid.", 401);
    }
    assertIdentifier("claims.sub", claims.sub);
    assertIdentifier("claims.sid", claims.sid);
    if (!Number.isInteger(claims.exp) || claims.exp <= currentEpoch()) throw new OwnerAuthError("OWNER_AUTH_EXPIRED", "Owner session has expired.", 401);
    return immutableCopy({ subject: claims.sub, sessionId: claims.sid, role: claims.role, expiresAt: claims.exp, decision: "OWNER_AUTHENTICATED" });
  }

  function requireOwner(authorizationHeader) {
    return authenticate(authorizationHeader);
  }

  return Object.freeze({
    issueSession,
    authenticate,
    requireOwner,
    configured: Boolean(secret),
    contract: () => getOwnerAuthContractSummary()
  });
}
