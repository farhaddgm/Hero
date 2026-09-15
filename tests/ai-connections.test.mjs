import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHeroSecretStore } from "../packages/adapters/src/hero-secret-store.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

test("AI Connections registers and safely tests a Cursor credential boundary without a network dispatch", async t => {
  const ownerAuth = createOwnerAuth({ secret: "ai-connections-owner-secret-1234567890" });
  const token = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "ai-connections-session", expiresAt: 2_000_000_000 });
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    ownerAuth,
    enableRealProviders: true,
    providerAdapterOptions: {
      cursor: { env: { HERO_CURSOR_API_KEY: "test-only-cursor-key" } }
    }
  });
  const address = await app.start();
  t.after(() => app.stop());
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const provider = await fetch(`http://127.0.0.1:${address.port}/api/ai/providers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      providerId: "cursor",
      mode: "live",
      displayName: "Cursor Cloud Agent",
      capabilities: ["cursor-cloud-agent", "repository-scoped-dispatch", "connection-readiness-only"],
      idempotencyKey: "cursor-provider-v1"
    })
  });
  assert.equal(provider.status, 201);

  const health = await fetch(`http://127.0.0.1:${address.port}/api/ai/providers/cursor/health`, {
    method: "POST",
    headers,
    body: JSON.stringify({ credentialRef: "env:HERO_CURSOR_API_KEY", timeoutMs: 10_000 })
  });
  assert.equal(health.status, 200);
  const body = await health.json();
  assert.equal(body.result.providerId, "cursor");
  assert.equal(body.result.status, "healthy");
  assert.equal(body.result.code, "PROVIDER_HEALTHY");

  const events = await fetch(`http://127.0.0.1:${address.port}/api/ai/events?after=0`, { headers });
  assert.equal(events.status, 200);
  const serialized = JSON.stringify(await events.json());
  assert.match(serialized, /ai\.provider-health-checked/);
  assert.doesNotMatch(serialized, /test-only-cursor-key/);
});

test("AI Connections lets only the Human Identity Owner store an encrypted Test credential", async t => {
  const now = () => "2026-09-10T12:00:00.000Z";
  const epoch = Math.floor(Date.parse(now()) / 1_000);
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({
    accessRegistry: access,
    sessionSecret: "identity-session-test-secret-12345678901234567890",
    now,
    owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: "owner-mfa-secret-for-identity-tests" }
  });
  const secretRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hero-ai-credential-api-"));
  const secretStore = createHeroSecretStore({ root: secretRoot, masterKey: crypto.randomBytes(32), now });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, secretStore, enableRealProviders: true });
  const address = await app.start();
  t.after(async () => { await app.stop(); fs.rmSync(secretRoot, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${address.port}`;
  const challenge = await fetch(`${base}/api/identity/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "owner@example.test", password: "Owner password 123" }) });
  assert.equal(challenge.status, 200);
  const challengeId = (await challenge.json()).login.challengeId;
  const complete = await fetch(`${base}/api/identity/login/mfa`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId, mfaCode: createTotpCode("owner-mfa-secret-for-identity-tests", epoch) }) });
  assert.equal(complete.status, 200);
  const cookie = complete.headers.get("set-cookie").split(";", 1)[0];
  const headers = { cookie, origin: base, "content-type": "application/json" };
  const initial = await fetch(`${base}/api/ai/credentials`, { headers: { cookie } });
  assert.equal(initial.status, 200);
  const initialPayload = await initial.json();
  assert.equal(initialPayload.mode, "embedded-test-encrypted");
  assert.equal(initialPayload.credentials.find(item => item.providerId === "openai").configured, false);
  const value = "sk-test-owner-key-" + crypto.randomBytes(12).toString("base64url");
  const saved = await fetch(`${base}/api/ai/credentials`, { method: "POST", headers, body: JSON.stringify({ providerId: "openai", value }) });
  assert.equal(saved.status, 201);
  const savedPayload = await saved.json();
  assert.equal(savedPayload.credential.state, "configured");
  assert.equal(savedPayload.credential.secretValueExposed, false);
  assert.equal(JSON.stringify(savedPayload).includes(value), false);
  const status = await fetch(`${base}/api/ai/credentials/openai/status`, { headers: { cookie } });
  assert.equal((await status.json()).credential.configured, true);
  const health = await fetch(`${base}/api/ai/credentials/openai/health`, { method: "POST", headers, body: "{}" });
  const healthPayload = await health.json();
  assert.equal(health.status, 200, JSON.stringify(healthPayload));
  assert.equal(healthPayload.credential.state, "healthy");
  const events = await fetch(`${base}/api/ai/events?after=0`, { headers: { cookie } });
  assert.doesNotMatch(JSON.stringify(await events.json()), new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
});
