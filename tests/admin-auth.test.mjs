import assert from "node:assert/strict";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createAdminAuth } from "../packages/domain/src/admin-auth.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

const now = () => "2026-09-04T12:00:00.000Z";

test("owner and admin sessions are separate and admin scope fails closed", async t => {
  const ownerAuth = createOwnerAuth({ secret: "owner-auth-test-secret-12345678901234567890", now });
  const adminAuth = createAdminAuth({ secret: "admin-auth-test-secret-12345678901234567890", now });
  const ownerToken = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "owner-admin-boundary", expiresAt: 2_000_000_000 });
  const adminToken = adminAuth.issueSession({ subject: "hero-admin", sessionId: "admin-boundary", expiresAt: 2_000_000_000 });
  assert.throws(() => ownerAuth.authenticate(`Bearer ${adminToken}`), error => error.code === "OWNER_AUTH_INVALID");
  assert.throws(() => adminAuth.authenticate(`Bearer ${ownerToken}`), error => error.code === "ADMIN_AUTH_INVALID");

  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth, adminAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const adminHeaders = { authorization: `Bearer ${adminToken}`, "content-type": "application/json" };
  assert.equal((await fetch(`${base}/api/dashboard`, { headers: adminHeaders })).status, 200);
  assert.equal((await fetch(`${base}/api/requests`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ title: "درخواست ممنوع برای admin", description: "این مسیر باید فقط مالک باشد." }) })).status, 403);
  const provider = await fetch(`${base}/api/ai/providers`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ providerId: "deterministic", mode: "deterministic", displayName: "Deterministic", idempotencyKey: "admin-provider" }) });
  assert.equal(provider.status, 201);
  assert.equal((await fetch(`${base}/admin-auth-contract`)).status, 200);
  assert.equal((await fetch(`${base}/api/requests`, { method: "POST", headers: { authorization: `Bearer ${ownerToken}`, "content-type": "application/json" }, body: JSON.stringify({ title: "درخواست مالک", description: "این مسیر برای مالک مجاز است." }) })).status, 201);
});
