import { timingSafeEqual } from "node:crypto";

import { HUMAN_IDENTITY_SESSION_TTL_SECONDS } from "../../../packages/domain/src/human-identity.mjs";
import { ProjectWorkspaceError } from "../../../packages/domain/src/project-workspace.mjs";
import { DashboardCommandError } from "./dashboard-service.mjs";

/**
 * HTTP plumbing for the Control Plane: response writers, cookie handling, Basic Auth,
 * rate limiting, body parsing and the small route-classification tables.
 * Extracted verbatim from server.mjs so the request handler can be read on its own.
 */

export const PRIVATE_ROBOTS_POLICY = "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate";

export const READ_MODEL_AUDIT_RESOURCES = new Set([
  "/backoffice",
  "/backoffice-data",
  "/backoffice-events",
  "/api/dashboard",
  "/api/delivery-truth",
  "/api/ai/benchmarks",
  "/api/ai/benchmarks/compare",
  "/api/ai/credentials",
  "/api/ai/role-policies/history",
  "/api/teams/contract-history",
  "/api/audit",
  "/api/operations/diagnostics",
  "/product-studio",
  "/product-studio-data",
  "/product-studio-document",
  "/project-control",
  "/project-control-data"
  ,"/workspace",
  "/walkthrough"
]);

export const DEFAULT_BACKOFFICE_RATE_LIMIT_WINDOW_MS = 60_000;

export const DEFAULT_BACKOFFICE_RATE_LIMIT_MAX = 60;

export const ADMIN_ALLOWED_MUTATIONS = new Set([
  "/api/ai/providers",
  "/api/ai/models",
  "/api/ai/profiles",
  "/api/ai/bindings",
  "/api/ai/project-scopes",
  "/api/ai/skills",
  "/api/ai/skill-bindings",
  "/api/ai/role-policies",
  "/api/form-suggestions",
  "/api/form-suggestions/refine",
  "/api/advisor",
  "/api/advisor/refine"
]);
// Human Identity is the browser-facing authority. Global AI catalog entries
// affect the whole private Hero installation, so they remain Owner-only.
// A project Admin may bind an already-approved Profile inside its Project Grant.

export const HUMAN_SESSION_COOKIE_NAME = "__Host-hero-human-session";

export const EXPIRED_COOKIE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";

export function parseCookie(header, name) {
  if (typeof header !== "string" || header.length === 0) return null;
  let result = null;
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 1 || entry.slice(0, separator).trim() !== name) continue;
    // A duplicate authentication cookie is ambiguous. Do not choose one.
    if (result !== null) return null;
    try {
      result = decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return result;
}

export function humanSessionCookie(token) {
  return `${HUMAN_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${HUMAN_IDENTITY_SESSION_TTL_SECONDS}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

export function clearHumanSessionCookie() {
  return `${HUMAN_SESSION_COOKIE_NAME}=; Max-Age=0; Expires=${EXPIRED_COOKIE_DATE}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

/** Binary uploads (PDF, Office, image, ZIP) arrive as base64 so no byte is altered by UTF-8; text stays a plain string. */

export function decodeUploadContent(input) {
  if (input?.encoding === undefined || input.encoding === "utf8") return input?.content;
  if (input.encoding !== "base64" || typeof input.content !== "string" || input.content.length === 0 || input.content.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.content)) throw new ProjectWorkspaceError("UPLOAD_ENCODING_INVALID", "Upload content must be valid base64 when encoding is base64.", 400);
  return Buffer.from(input.content, "base64");
}

export function json(response, statusCode, body, { maxBytes, headers = {} } = {}) {
  const payload = JSON.stringify(body);
  const payloadBytes = Buffer.byteLength(payload);
  if (maxBytes !== undefined && payloadBytes > maxBytes) {
    const message = "Hero Back Office response is too large.";
    response.writeHead(413, {
      "content-type": "text/plain; charset=utf-8",
      "content-length": Buffer.byteLength(message),
      "cache-control": "no-store",
      "x-robots-tag": PRIVATE_ROBOTS_POLICY,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer"
    });
    response.end(message);
    return;
  }
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": payloadBytes,
    "cache-control": "no-store",
    "x-robots-tag": PRIVATE_ROBOTS_POLICY,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...headers
  });
  response.end(payload);
}

export function createRateLimiter({ windowMs = DEFAULT_BACKOFFICE_RATE_LIMIT_WINDOW_MS, max = DEFAULT_BACKOFFICE_RATE_LIMIT_MAX } = {}) {
  if (!Number.isInteger(windowMs) || windowMs < 1_000 || windowMs > 86_400_000) throw new Error("Back Office rate-limit window must be between 1000 and 86400000 milliseconds.");
  if (!Number.isInteger(max) || max < 1 || max > 10_000) throw new Error("Back Office rate-limit max must be between 1 and 10000 requests.");
  const entries = new Map();
  return Object.freeze({
    consume(key, now = Date.now()) {
      const current = entries.get(key);
      if (!current || now - current.startedAt >= windowMs) {
        entries.set(key, { startedAt: now, count: 1 });
        if (entries.size > 2_000) {
          for (const [entryKey, entry] of entries) {
            if (now - entry.startedAt >= windowMs) entries.delete(entryKey);
          }
        }
        return Object.freeze({ allowed: true, remaining: max - 1, retryAfter: 0 });
      }
      if (current.count >= max) {
        return Object.freeze({
          allowed: false,
          remaining: 0,
          retryAfter: Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000))
        });
      }
      current.count += 1;
      return Object.freeze({ allowed: true, remaining: max - current.count, retryAfter: 0 });
    }
  });
}

export function html(response, body) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "x-robots-tag": PRIVATE_ROBOTS_POLICY,
    "referrer-policy": "no-referrer",
    "cache-control": "no-store"
  });
  response.end(body);
}

export function plain(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-robots-tag": PRIVATE_ROBOTS_POLICY,
    "x-content-type-options": "nosniff"
  });
  response.end(body);
}

export function binary(response, statusCode, body, contentType, { cacheControl = "no-store" } = {}) {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "content-length": body.byteLength,
    "cache-control": cacheControl,
    "x-robots-tag": PRIVATE_ROBOTS_POLICY,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  response.end(body);
}

export function redirect(response, location) {
  response.writeHead(302, {
    location,
    "cache-control": "no-store",
    "x-robots-tag": PRIVATE_ROBOTS_POLICY,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  response.end();
}

export function basicAuthConfig(options = {}) {
  const configured = options.backofficeAuth ?? {
    username: process.env.HERO_BACKOFFICE_USER,
    password: process.env.HERO_BACKOFFICE_PASSWORD
  };
  const username = configured?.username;
  const password = configured?.password;
  if ((username === undefined || username === "") && (password === undefined || password === "")) return null;
  if (typeof username !== "string" || username.trim() === "" || typeof password !== "string" || password.length < 16) {
    throw new Error("Back Office Basic Auth requires a non-empty username and a password of at least 16 characters.");
  }
  return Object.freeze({ username, password });
}

export function basicCredentials(request) {
  const value = request.headers.authorization;
  if (typeof value !== "string" || !value.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

export function matchesBasicAuth(credentials, expected) {
  if (!credentials || !expected) return false;
  const actualUser = Buffer.from(credentials.username);
  const expectedUser = Buffer.from(expected.username);
  const actualPassword = Buffer.from(credentials.password);
  const expectedPassword = Buffer.from(expected.password);
  return actualUser.length === expectedUser.length && actualPassword.length === expectedPassword.length &&
    timingSafeEqual(actualUser, expectedUser) && timingSafeEqual(actualPassword, expectedPassword);
}

export async function readJson(request, maxBytes = 16_384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new DashboardCommandError("PAYLOAD_TOO_LARGE", "درخواست بیش از حد بزرگ است.", 413);
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DashboardCommandError("INVALID_INPUT", "بدنهٔ درخواست معتبر نیست.");
    }
    return value;
  } catch (error) {
    if (error instanceof DashboardCommandError) throw error;
    throw new DashboardCommandError("INVALID_JSON", "بدنهٔ درخواست باید JSON معتبر باشد.");
  }
}

export function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("HERO_HTTP_PORT must be an integer between 0 and 65535.");
  }
  return port;
}

export function isAdminAllowedMutation(pathname) {
  return ADMIN_ALLOWED_MUTATIONS.has(pathname) || /^\/api\/ai\/role-policies\/[a-z][a-z0-9-]{2,63}\/rollback$/.test(pathname) || /^\/api\/teams\/[a-z][a-z0-9-]{2,63}\/principles(?:\/rollback)?$/.test(pathname);
}

export function readModelAuditResource(pathname) {
  if (READ_MODEL_AUDIT_RESOURCES.has(pathname)) return pathname;
  if (/^\/api\/ai\/role-policies\/[a-z][a-z0-9-]{2,63}\/history$/.test(pathname)) return "/api/ai/role-policies/history";
  if (/^\/api\/teams\/[a-z][a-z0-9-]{2,63}\/contract-history$/.test(pathname)) return "/api/teams/contract-history";
  return null;
}
