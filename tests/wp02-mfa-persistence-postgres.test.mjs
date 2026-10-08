import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createMfaVault } from "../packages/domain/src/mfa-vault.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

const url = process.env.HERO_POSTGRES_URL;
const ownerSecret = "owner-mfa-secret-for-persistence-run";
const sessionSecret = "persistence-session-secret-12345678901234567890";
const suffix = crypto.randomBytes(3).toString("hex");
const userId = `mfa-user-${suffix}`;
const email = `mfa-${suffix}@example.test`;
let clock = Date.parse("2026-10-08T12:00:00.000Z");
const now = () => new Date(clock).toISOString();
const epoch = () => Math.floor(clock / 1000);
const jsonHeaders = { "content-type": "application/json" };

async function boot(key) {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const mfaVault = createMfaVault({ key });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret, now, mfaVault, owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: ownerSecret } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, mfaVault });
  const address = await app.start();
  return { app, identity, base: `http://127.0.0.1:${address.port}` };
}

async function attempt(base, who, password, secret) {
  const begin = await fetch(`${base}/api/identity/login`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email: who, password }) });
  const { login } = await begin.json();
  clock += 31_000;
  const complete = await fetch(`${base}/api/identity/login/mfa`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ challengeId: login.challengeId, mfaCode: createTotpCode(secret, epoch()) }) });
  return { complete, cookie: complete.headers.get("set-cookie")?.split(";", 1)[0] };
}

test("a user's MFA secret survives a restart only when it is stored encrypted, and never in clear", { skip: !url && "HERO_POSTGRES_URL is not configured" }, async () => {
  const key = crypto.randomBytes(32).toString("hex");
  const first = await boot(key);
  let enrolled;
  try {
    const owner = await attempt(first.base, "owner@example.test", "Owner password 123", ownerSecret);
    assert.equal(owner.complete.status, 200);
    const headers = { cookie: owner.cookie, origin: first.base, ...jsonHeaders };
    const created = await fetch(`${first.base}/api/identity/users`, { method: "POST", headers, body: JSON.stringify({ userId, email, displayName: "Persisted", password: "Persisted password 123", mfaSecret: "persisted-mfa-secret-123", mfaRequired: true }) });
    assert.equal(created.status, 201);
    const enroll = await fetch(`${first.base}/api/identity/users/${userId}/mfa/enroll`, { method: "POST", headers, body: "{}" });
    assert.equal(enroll.status, 201);
    enrolled = (await enroll.json()).enrollment;
    assert.equal(enrolled.persistence, "encrypted");
  } finally { await first.app.stop(); }

  // The database holds only a sealed value.
  const { createRequire } = await import("node:module");
  const pg = createRequire(new URL("../packages/adapters/package.json", import.meta.url))("pg");
  const client = new pg.Client({ connectionString: url }); await client.connect();
  try {
    const { rows } = await client.query("SELECT mfa_secret_cipher FROM human_users WHERE user_id = $1", [userId]);
    assert.match(rows[0].mfa_secret_cipher, /^mfa1\.[a-f0-9]{8}\./);
    assert.equal(rows[0].mfa_secret_cipher.includes(enrolled.secret), false);
    const everything = JSON.stringify((await client.query("SELECT * FROM human_users WHERE user_id = $1", [userId])).rows);
    assert.equal(everything.includes(enrolled.secret), false);
    assert.equal(everything.includes("persisted-mfa-secret-123"), false);
  } finally { await client.end(); }

  // Same key after a restart: the user logs in with MFA.
  const second = await boot(key);
  try {
    const result = await attempt(second.base, email, "Persisted password 123", `base32:${enrolled.secret}`);
    assert.equal(result.complete.status, 200);
  } finally { await second.app.stop(); }

  // No key after a restart: MFA login is refused with 503, never passed.
  const third = await boot("");
  try {
    const result = await attempt(third.base, email, "Persisted password 123", `base32:${enrolled.secret}`);
    assert.equal(result.complete.status, 503);
    assert.equal((await result.complete.json()).code, "MFA_UNAVAILABLE");
  } finally { await third.app.stop(); }
});
