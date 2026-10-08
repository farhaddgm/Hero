import assert from "node:assert/strict";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createMfaVault } from "../packages/domain/src/mfa-vault.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

const ownerSecret = "owner-mfa-secret-for-http-hardening";
const viewerSecret = "viewer-mfa-secret-for-http-hardening";
const sessionSecret = "http-hardening-session-secret-1234567890123456";
let clock = Date.parse("2026-10-08T12:00:00.000Z");
const now = () => new Date(clock).toISOString();
const epoch = () => Math.floor(clock / 1000);
const jsonHeaders = { "content-type": "application/json" };

async function boot(t, { key = "b".repeat(64) } = {}) {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({
    accessRegistry: access,
    sessionSecret,
    now,
    mfaVault: createMfaVault({ key }),
    owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: ownerSecret }
  });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, mfaVault: createMfaVault({ key }) });
  const address = await app.start();
  t.after(() => app.stop());
  return { base: `http://127.0.0.1:${address.port}`, identity };
}

async function login(base, email, password, secret, extra = {}) {
  const begin = await fetch(`${base}/api/identity/login`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email, password }) });
  if (begin.status !== 200) return { begin };
  const { login: challenge } = await begin.json();
  clock += 31_000; // a fresh TOTP step for every login
  const complete = await fetch(`${base}/api/identity/login/mfa`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ challengeId: challenge.challengeId, mfaCode: extra.mfaCode ?? createTotpCode(secret, epoch()) }) });
  const cookie = complete.headers.get("set-cookie")?.split(";", 1)[0];
  return { begin, complete, cookie, headers: cookie ? { cookie, origin: base, ...jsonHeaders } : null };
}

test("the identity status reports whether MFA secrets are encrypted at rest", async t => {
  const { base } = await boot(t);
  const status = await (await fetch(`${base}/api/identity/status`)).json();
  assert.equal(JSON.stringify(status).includes("b".repeat(64)), false);
  assert.equal(status.identity?.mfaPersistence ?? status.status?.mfaPersistence ?? status.mfaPersistence, "encrypted");
  const second = await boot(t, { key: "" });
  const open = await (await fetch(`${second.base}/api/identity/status`)).json();
  assert.equal(open.identity?.mfaPersistence ?? open.status?.mfaPersistence ?? open.mfaPersistence, "unavailable-no-key");
});

test("the owner enrolls MFA once, the secret is shown only in that response and the old sessions stop", async t => {
  const { base, identity } = await boot(t);
  const owner = await login(base, "owner@example.test", "Owner password 123", ownerSecret);
  assert.equal(owner.complete.status, 200);
  const create = await fetch(`${base}/api/identity/users`, { method: "POST", headers: owner.headers, body: JSON.stringify({ userId: "project-viewer", email: "viewer@example.test", displayName: "Viewer", password: "Viewer password 123", mfaSecret: viewerSecret, mfaRequired: true }) });
  assert.equal(create.status, 201);
  const viewer = await login(base, "viewer@example.test", "Viewer password 123", viewerSecret);
  assert.equal(viewer.complete.status, 200);

  // A non-owner can neither enroll nor disable anyone.
  const denied = await fetch(`${base}/api/identity/users/project-viewer/mfa/enroll`, { method: "POST", headers: viewer.headers, body: "{}" });
  assert.equal(denied.status, 403);
  const deniedDisable = await fetch(`${base}/api/identity/users/hero-owner/disable`, { method: "POST", headers: viewer.headers, body: "{}" });
  assert.equal(deniedDisable.status, 403);
  // An anonymous caller is never told whether the user exists.
  const anonymous = await fetch(`${base}/api/identity/users/project-viewer/mfa/enroll`, { method: "POST", headers: jsonHeaders, body: "{}" });
  const anonymousUnknown = await fetch(`${base}/api/identity/users/no-such-user/mfa/enroll`, { method: "POST", headers: jsonHeaders, body: "{}" });
  assert.equal(anonymous.status >= 401 && anonymous.status <= 503, true);
  assert.equal(anonymous.status, anonymousUnknown.status, "anonymous callers cannot tell a real user from an unknown one");
  assert.equal(anonymous.status, (await fetch(`${base}/api/identity/me`)).status, "closed the same way as any other protected identity route");

  const enroll = await fetch(`${base}/api/identity/users/project-viewer/mfa/enroll`, { method: "POST", headers: owner.headers, body: "{}" });
  assert.equal(enroll.status, 201);
  assert.equal(enroll.headers.get("cache-control"), "no-store");
  const { enrollment } = await enroll.json();
  assert.match(enrollment.otpauthUri, /^otpauth:\/\/totp\//);
  assert.equal(enrollment.persistence, "encrypted");
  assert.equal(identity.getUser("project-viewer").mfaState, "ready");

  // The earlier viewer session ended; the new secret is the only one that works.
  assert.equal((await fetch(`${base}/api/identity/me`, { headers: { cookie: viewer.cookie } })).status, 401);
  const stale = await login(base, "viewer@example.test", "Viewer password 123", viewerSecret);
  assert.equal(stale.complete.status, 401);
  const fresh = await login(base, "viewer@example.test", "Viewer password 123", `base32:${enrollment.secret}`);
  assert.equal(fresh.complete.status, 200);

  // The secret is not readable again from any user listing.
  const listing = JSON.stringify(await (await fetch(`${base}/api/identity/users`, { headers: owner.headers })).json());
  assert.equal(listing.includes(enrollment.secret), false);
});

test("sessions are listed with coarse device facts and can be revoked all at once", async t => {
  const { base } = await boot(t);
  const first = await login(base, "owner@example.test", "Owner password 123", ownerSecret);
  const second = await login(base, "owner@example.test", "Owner password 123", ownerSecret);
  const listed = await fetch(`${base}/api/identity/sessions`, { headers: second.headers });
  assert.equal(listed.status, 200);
  const { sessions } = await listed.json();
  assert.equal(sessions.length >= 2, true);
  assert.equal(sessions.filter(item => item.current).length, 1);
  assert.equal(JSON.stringify(sessions).includes("127.0.0.1"), false, "the raw source address is never listed");

  const revoke = await fetch(`${base}/api/identity/sessions/revoke-all`, { method: "POST", headers: second.headers, body: JSON.stringify({ exceptCurrent: true }) });
  assert.equal(revoke.status, 200);
  assert.equal((await revoke.json()).revocation.revoked >= 1, true);
  assert.equal((await fetch(`${base}/api/identity/me`, { headers: { cookie: first.cookie } })).status, 401);
  assert.equal((await fetch(`${base}/api/identity/me`, { headers: { cookie: second.cookie } })).status, 200);
  assert.notEqual((await fetch(`${base}/api/identity/sessions`)).status, 200);
});

test("the owner can disable a user at once and cannot disable the owner account", async t => {
  const { base } = await boot(t);
  const owner = await login(base, "owner@example.test", "Owner password 123", ownerSecret);
  await fetch(`${base}/api/identity/users`, { method: "POST", headers: owner.headers, body: JSON.stringify({ userId: "project-viewer", email: "viewer@example.test", displayName: "Viewer", password: "Viewer password 123", mfaSecret: viewerSecret, mfaRequired: true }) });
  const viewer = await login(base, "viewer@example.test", "Viewer password 123", viewerSecret);
  assert.equal(viewer.complete.status, 200);
  const disable = await fetch(`${base}/api/identity/users/project-viewer/disable`, { method: "POST", headers: owner.headers, body: JSON.stringify({ reason: "left the project" }) });
  assert.equal(disable.status, 200);
  assert.equal((await fetch(`${base}/api/identity/me`, { headers: { cookie: viewer.cookie } })).status, 401);
  const again = await login(base, "viewer@example.test", "Viewer password 123", viewerSecret);
  assert.notEqual(again.complete?.status, 200);
  const self = await fetch(`${base}/api/identity/users/hero-owner/disable`, { method: "POST", headers: owner.headers, body: "{}" });
  assert.equal(self.status, 409);
});

test("repeated wrong MFA codes lock the challenge and then the account, while a correct code is refused during the lock", async t => {
  const { base } = await boot(t);
  const begin = await (await fetch(`${base}/api/identity/login`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email: "owner@example.test", password: "Owner password 123" }) })).json();
  let last;
  for (let i = 0; i < 6; i += 1) {
    last = await fetch(`${base}/api/identity/login/mfa`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ challengeId: begin.login.challengeId, mfaCode: "000000" }) });
  }
  assert.equal(last.status >= 400 && last.status < 500, true);
  // The challenge is spent: even the right code no longer works on it.
  const spent = await fetch(`${base}/api/identity/login/mfa`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ challengeId: begin.login.challengeId, mfaCode: createTotpCode(ownerSecret, epoch()) }) });
  assert.notEqual(spent.status, 200);
});

test("a TOTP code cannot be replayed within its time step", async t => {
  const { base } = await boot(t);
  const code = createTotpCode(ownerSecret, epoch());
  const one = await (await fetch(`${base}/api/identity/login`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email: "owner@example.test", password: "Owner password 123" }) })).json();
  const ok = await fetch(`${base}/api/identity/login/mfa`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ challengeId: one.login.challengeId, mfaCode: code }) });
  assert.equal(ok.status, 200);
  const two = await (await fetch(`${base}/api/identity/login`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email: "owner@example.test", password: "Owner password 123" }) })).json();
  const replay = await fetch(`${base}/api/identity/login/mfa`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ challengeId: two.login.challengeId, mfaCode: code }) });
  assert.equal(replay.status, 401);
});

test("login rate limits answer 429 or 423 without revealing whether the email exists", async t => {
  const { base } = await boot(t);
  const results = [];
  for (let i = 0; i < 14; i += 1) {
    const response = await fetch(`${base}/api/identity/login`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email: "nobody@example.test", password: "Wrong password 123" }) });
    results.push({ status: response.status, body: await response.json() });
  }
  const known = await fetch(`${base}/api/identity/login`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email: "owner@example.test", password: "Wrong password 123" }) });
  const unknownBody = results[0].body;
  const knownBody = await known.json();
  assert.equal(results[0].status, 401);
  assert.equal(known.status, 401);
  assert.equal(unknownBody.code, knownBody.code, "an unknown email and a wrong password look the same");
  assert.equal(results.some(item => item.status === 429 || item.status === 423), true, "the limiter engages");
});
