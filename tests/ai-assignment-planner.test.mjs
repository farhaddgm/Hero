import assert from "node:assert/strict";
import test from "node:test";

import { createAiAssignmentProposal } from "../apps/control-plane/src/ai-assignment-planner.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

const provider = { providerId: "openai", mode: "deterministic", displayName: "OpenAI local", connection: { state: "local-ready" } };
const models = [
  { providerId: "openai", modelId: "chatgpt", displayName: "ChatGPT" },
  { providerId: "openai", modelId: "codex", displayName: "Codex" }
];
const profile = (profileId, role, modelId = "chatgpt", toolPolicy = "read-only", outputSchema = "analysis-v1") => ({ profileId, role, providerId: "openai", modelId, toolPolicy, outputSchema, status: "active", profileVersion: 1 });

test("assignment planner preserves a valid binding and proposes only compatible profiles", () => {
  const proposal = createAiAssignmentProposal({
    projectId: "hero",
    roles: ["analyst", "evaluator", "executor"],
    providers: [provider],
    models,
    profiles: [profile("analyst-v1", "analyst"), profile("evaluator-v1", "evaluator", "chatgpt", "read-only", "evaluation-v1"), profile("executor-v1", "executor", "codex", "development", "execution-v1")],
    bindings: [{ bindingId: "hero-analyst-v1", projectId: "hero", role: "analyst", profileId: "analyst-v1", teamId: null, skillId: null }]
  });
  assert.deepEqual(proposal.counts, { total: 3, ready: 2, blocked: 0, unchanged: 1 });
  assert.equal(proposal.assignments.find(item => item.role === "analyst").operation, "unchanged");
  assert.equal(proposal.assignments.find(item => item.role === "evaluator").recommendedProfile.profileId, "evaluator-v1");
  assert.equal(proposal.policy.invokesProvider, false);
});

test("assignment planner explains missing prerequisites and never invents a provider", () => {
  const proposal = createAiAssignmentProposal({ projectId: "hero", roles: ["planner"], providers: [], models: [], profiles: [] });
  assert.equal(proposal.counts.blocked, 1);
  assert.equal(proposal.assignments[0].status, "needs-admin-setup");
  assert.equal(proposal.assignments[0].recommendedProfile, null);
});

test("HTTP proposal and one-confirmation apply are authenticated, version-aware and idempotent", async t => {
  const now = () => "2026-09-17T12:00:00.000Z";
  const ownerAuth = createOwnerAuth({ secret: "assignment-planner-owner-secret-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "assignment-owner", sessionId: "assignment-session-001", expiresAt: 2_000_000_000 });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const unauthenticated = await fetch(`${baseUrl}/api/ai/assignment-proposals?projectId=hero`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: "hero" }) });
  assert.equal(unauthenticated.status, 401);
  const scopeMismatch = await fetch(`${baseUrl}/api/ai/assignment-proposals?projectId=hero`, { method: "POST", headers, body: JSON.stringify({ projectId: "other-project" }) });
  assert.equal(scopeMismatch.status, 400);

  const registerProvider = await fetch(`${baseUrl}/api/ai/providers`, { method: "POST", headers, body: JSON.stringify({ providerId: "openai", mode: "deterministic", displayName: "OpenAI local", idempotencyKey: "assignment-provider-1" }) });
  assert.equal(registerProvider.status, 201);
  const registerModel = await fetch(`${baseUrl}/api/ai/models`, { method: "POST", headers, body: JSON.stringify({ providerId: "openai", modelId: "chatgpt", displayName: "ChatGPT", idempotencyKey: "assignment-model-1" }) });
  assert.equal(registerModel.status, 201);
  for (const [role, schema] of [["analyst", "analysis-v1"], ["evaluator", "evaluation-v1"]]) {
    const created = await fetch(`${baseUrl}/api/ai/profiles`, { method: "POST", headers, body: JSON.stringify({ profileId: `assignment-${role}-profile`, role, providerId: "openai", modelId: "chatgpt", credentialRef: "runtime:assignment-test", promptVersion: "assignment-prompt-v1", contextPolicy: "project-approved-context", toolPolicy: "read-only", outputSchema: schema, status: "active", idempotencyKey: `assignment-profile-${role}` }) });
    assert.equal(created.status, 201);
  }
  const existing = await fetch(`${baseUrl}/api/ai/bindings?projectId=hero`, { method: "POST", headers, body: JSON.stringify({ bindingId: "assignment-analyst-binding", projectId: "hero", role: "analyst", profileId: "assignment-analyst-profile", idempotencyKey: "assignment-binding-analyst" }) });
  assert.equal(existing.status, 201);
  const proposalResponse = await fetch(`${baseUrl}/api/ai/assignment-proposals?projectId=hero`, { method: "POST", headers, body: JSON.stringify({ projectId: "hero" }) });
  assert.equal(proposalResponse.status, 200);
  const proposal = (await proposalResponse.json()).proposal;
  assert.equal(proposal.counts.unchanged, 1);
  assert.equal(proposal.counts.ready, 1);
  assert.equal(proposal.policy.createsCatalogEntries, false);
  const localReview = await fetch(`${baseUrl}/api/ai/assignment-proposals/${encodeURIComponent(proposal.proposalId)}/review?projectId=hero`, { method: "POST", headers, body: JSON.stringify({ projectId: "hero" }) });
  assert.equal(localReview.status, 200);
  assert.equal((await localReview.json()).result.providerInvoked, false);
  const applied = await fetch(`${baseUrl}/api/ai/assignment-proposals/${encodeURIComponent(proposal.proposalId)}/apply?projectId=hero`, { method: "POST", headers, body: JSON.stringify({ projectId: "hero" }) });
  assert.equal(applied.status, 200);
  assert.equal((await applied.json()).result.status, "completed");
  const state = await fetch(`${baseUrl}/api/ai-orchestration`, { headers });
  const bindings = (await state.json()).aiOrchestration.bindings;
  assert.equal(bindings.filter(item => item.projectId === "hero" && !item.teamId && !item.skillId).length, 2);
});
