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
  const model = await fetch(`${base}/api/ai/models`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ providerId: "deterministic", modelId: "stable", displayName: "Stable", idempotencyKey: "admin-model" }) });
  assert.equal(model.status, 201);
  for (const [toolPolicy, idempotencyKey] of [["read-only", "admin-policy-first"], ["owner-gated", "admin-policy-second"]]) {
    const policy = await fetch(`${base}/api/ai/role-policies`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ role: "analyst", providerId: "deterministic", modelId: "stable", toolPolicy, idempotencyKey }) });
    assert.equal(policy.status, 201);
  }
  const policyHistory = await fetch(`${base}/api/ai/role-policies/analyst/history`, { headers: adminHeaders });
  assert.equal(policyHistory.status, 200);
  const history = (await policyHistory.json()).history;
  assert.equal(history.length, 2);
  const rollback = await fetch(`${base}/api/ai/role-policies/analyst/rollback`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ targetEventId: history[0].eventId, expectedVersion: 3, idempotencyKey: "admin-policy-rollback" }) });
  assert.equal(rollback.status, 200);
  assert.equal((await rollback.json()).result.policy.toolPolicy, "read-only");
  const teamEdit = await fetch(`${base}/api/teams/mahsulo/principles`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ principles: ["اصل پیشنهادی توسط ادمین", "اصل دوم برای تحویل"], expectedVersion: 0, idempotencyKey: "admin-team-principles" }) });
  assert.equal(teamEdit.status, 200);
  assert.equal((await teamEdit.json()).result.team.approvals.principles, false);
  const teamHistory = await fetch(`${base}/api/teams/mahsulo/contract-history`, { headers: adminHeaders });
  assert.equal(teamHistory.status, 200);
  const teamVersions = (await teamHistory.json()).history;
  const teamRollback = await fetch(`${base}/api/teams/mahsulo/principles/rollback`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ targetEventId: teamVersions[0].eventId, expectedVersion: 1, idempotencyKey: "admin-team-principles-rollback" }) });
  assert.equal(teamRollback.status, 200);
  assert.equal((await teamRollback.json()).result.team.version, 2);
  assert.equal((await fetch(`${base}/admin-auth-contract`)).status, 200);
  assert.equal((await fetch(`${base}/api/requests`, { method: "POST", headers: { authorization: `Bearer ${ownerToken}`, "content-type": "application/json" }, body: JSON.stringify({ title: "درخواست مالک", description: "این مسیر برای مالک مجاز است." }) })).status, 201);
});
