import crypto from "node:crypto";
import { createTotpCode } from "../packages/domain/src/human-identity.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const ALLOWED_BASE_ORIGINS = new Set([
  "http://127.0.0.1:3100",
  "http://hero-test-control-plane:3100",
  "https://test.hero.beeproject.ir"
]);

export function resolveSmokeBaseUrl(value = process.env.HERO_IDENTITY_SMOKE_BASE_URL ?? DEFAULT_BASE_URL) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Identity smoke base URL is invalid."); }
  if (!ALLOWED_BASE_ORIGINS.has(url.origin) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Identity smoke base URL is not an approved Hero Test origin.");
  }
  return url.origin;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(baseUrl, targetPath, { method = "GET", body, token, cookie, origin } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const response = await fetch(`${baseUrl}${targetPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(5_000)
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload, setCookie: response.headers.get("set-cookie") };
}

export async function smokeTestOwnerIdentity({ baseUrl = resolveSmokeBaseUrl(), email = process.env.HERO_OWNER_EMAIL, password = process.env.HERO_OWNER_PASSWORD, mfaSecret = process.env.HERO_OWNER_MFA_SECRET } = {}) {
  assert(typeof email === "string" && email.length > 3, "Owner email is not available to the Test smoke process.");
  assert(typeof password === "string" && password.length >= 12, "Owner password is not available to the Test smoke process.");
  assert(typeof mfaSecret === "string" && mfaSecret.length >= 12, "Owner MFA secret is not available to the Test smoke process.");

  const status = await request(baseUrl, "/api/identity/status");
  assert(status.status === 200, "Identity status endpoint is unavailable.");
  assert(status.payload?.identity?.configured === true, "Human Identity is not configured.");
  assert(status.payload?.identity?.humanLoginAvailable === true, "Human login is not available.");

  const unknownEmail = `identity-smoke-${crypto.randomUUID()}@invalid.test`;
  const invalid = await request(baseUrl, "/api/identity/login", {
    method: "POST",
    body: { email: unknownEmail, password: "invalid-smoke-password" }
  });
  assert(invalid.status === 401 && invalid.payload?.code === "LOGIN_INVALID", "Invalid-password behavior is not fail-closed.");

  const challenge = await request(baseUrl, "/api/identity/login", {
    method: "POST",
    body: { email, password }
  });
  assert(challenge.status === 200, "Valid owner password did not create a challenge.");
  assert(challenge.payload?.login?.mfaRequired === true, "Owner login did not require MFA.");
  assert(typeof challenge.payload?.login?.challengeId === "string", "Login challenge is missing.");

  let token;
  let cookie;
  try {
    const mfa = await request(baseUrl, "/api/identity/login/mfa", {
      method: "POST",
      body: {
        challengeId: challenge.payload.login.challengeId,
        mfaCode: createTotpCode(mfaSecret, Math.floor(Date.now() / 1_000))
      }
    });
    assert(mfa.status === 200, "Valid MFA did not issue an owner session.");
    token = mfa.payload?.session?.token;
    assert(typeof token === "string" && token.startsWith("hero-human-session."), "Human session token is missing.");
    assert(typeof mfa.setCookie === "string" && /__Host-hero-human-session=/.test(mfa.setCookie), "Human session cookie is missing.");
    assert(/Max-Age=21600/.test(mfa.setCookie) && /(?:^|;)\s*Secure(?:;|$)/.test(mfa.setCookie) && /(?:^|;)\s*HttpOnly(?:;|$)/.test(mfa.setCookie) && /SameSite=Strict/.test(mfa.setCookie), "Human session cookie does not have the required six-hour security attributes.");
    cookie = mfa.setCookie.split(";", 1)[0];

    const me = await request(baseUrl, "/api/identity/me", { cookie });
    assert(me.status === 200, "The issued human session is not usable.");
    assert(me.payload?.principal?.role === "project-owner", "The issued session is not an Owner session.");
    assert(me.payload?.user?.mfaEnabled === true, "The Owner account does not report MFA enabled.");
  } finally {
    if (cookie) {
      const revoked = await request(baseUrl, "/api/identity/sessions/revoke", {
        method: "POST",
        cookie,
        origin: baseUrl,
        body: { reason: "test-owner-identity-smoke" }
      });
      assert(revoked.status === 200, "The cookie-backed smoke-test session could not be revoked.");
      assert(/__Host-hero-human-session=; Max-Age=0/.test(revoked.setCookie ?? ""), "Logout did not clear the Human session cookie.");
      const revokedMe = await request(baseUrl, "/api/identity/me", { cookie });
      assert(revokedMe.status === 401, "The cookie-backed smoke-test session remained usable after revocation.");
    } else if (token) {
      const revoked = await request(baseUrl, "/api/identity/sessions/revoke", {
        method: "POST",
        token,
        body: { reason: "test-owner-identity-smoke" }
      });
      assert(revoked.status === 200, "The smoke-test session could not be revoked.");
      const revokedMe = await request(baseUrl, "/api/identity/me", { token });
      assert(revokedMe.status === 401, "The smoke-test session remained usable after revocation.");
    }
  }

  return Object.freeze({
    environment: "test",
    identityConfigured: true,
    invalidPasswordRejected: true,
    mfaRequired: true,
    ownerSessionIssued: true,
    ownerSessionVerified: true,
    browserCookieVerified: true,
    smokeSessionRevoked: true,
    secretMaterialLogged: false
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  smokeTestOwnerIdentity()
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(`Hero Test owner identity smoke: FAILED — ${error.message}`);
      process.exitCode = 1;
    });
}
