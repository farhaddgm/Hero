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
  assert.deepEqual(proposal.counts, { total: 3, ready: 2, blocked: 0, unchanged: 1, profilesToCreate: 0 });
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

test("assignment planner can propose a safe new profile from an already-ready Provider and Model", () => {
  const proposal = createAiAssignmentProposal({
    projectId: "hero",
    roles: ["evaluator"],
    providers: [provider],
    models,
    profiles: [],
    bindings: []
  });
  const assignment = proposal.assignments[0];
  assert.equal(assignment.status, "ready");
  assert.equal(assignment.operation, "create-with-created-profile");
  assert.equal(assignment.requiresProfileCreation, true);
  assert.equal(assignment.recommendedProfile.providerId, "openai");
  assert.equal(assignment.recommendedProfile.modelId, "chatgpt");
  assert.equal(assignment.recommendedProfile.outputSchema, "evaluation-v1");
  assert.equal(assignment.recommendedProfile.toolPolicy, "read-only");
  assert.equal(proposal.policy.createsProviderModelEntries, false);
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
  for (const [role, schema] of [["analyst", "analysis-v1"]]) {
    const created = await fetch(`${baseUrl}/api/ai/profiles`, { method: "POST", headers, body: JSON.stringify({ profileId: `assignment-${role}-profile`, role, providerId: "openai", modelId: "chatgpt", credentialRef: "runtime:assignment-test", promptVersion: "assignment-prompt-v1", contextPolicy: "project-approved-context", toolPolicy: "read-only", outputSchema: schema, status: "active", idempotencyKey: `assignment-profile-${role}` }) });
    assert.equal(created.status, 201);
  }
  const existing = await fetch(`${baseUrl}/api/ai/bindings?projectId=hero`, { method: "POST", headers, body: JSON.stringify({ bindingId: "assignment-analyst-binding", projectId: "hero", role: "analyst", profileId: "assignment-analyst-profile", idempotencyKey: "assignment-binding-analyst" }) });
  assert.equal(existing.status, 201);
  const proposalResponse = await fetch(`${baseUrl}/api/ai/assignment-proposals?projectId=hero`, { method: "POST", headers, body: JSON.stringify({ projectId: "hero" }) });
  assert.equal(proposalResponse.status, 200);
  const proposal = (await proposalResponse.json()).proposal;
  assert.equal(proposal.counts.unchanged, 1);
  assert.equal(proposal.counts.ready, 7);
  assert.equal(proposal.counts.profilesToCreate, 7);
  assert.equal(proposal.assignments.find(item => item.role === "evaluator").recommendedProfile.providerId, "openai");
  assert.equal(proposal.assignments.find(item => item.role === "evaluator").recommendedProfile.modelId, "chatgpt");
  assert.equal(proposal.policy.createsCatalogEntries, true);
  assert.equal(proposal.policy.createsProviderModelEntries, false);
  assert.equal(JSON.stringify(proposal).includes("credentialRef"), false);
  const localReview = await fetch(`${baseUrl}/api/ai/assignment-proposals/${encodeURIComponent(proposal.proposalId)}/review?projectId=hero`, { method: "POST", headers, body: JSON.stringify({ projectId: "hero" }) });
  assert.equal(localReview.status, 200);
  assert.equal((await localReview.json()).result.providerInvoked, false);
  const applied = await fetch(`${baseUrl}/api/ai/assignment-proposals/${encodeURIComponent(proposal.proposalId)}/apply?projectId=hero`, { method: "POST", headers, body: JSON.stringify({ projectId: "hero" }) });
  assert.equal(applied.status, 200);
  const appliedResult = (await applied.json()).result;
  assert.equal(appliedResult.status, "completed");
  assert.equal(appliedResult.safety.providerCalls, 0);
  assert.equal(appliedResult.safety.providerModelEntriesCreated, 0);
  assert.equal(appliedResult.safety.profileEntriesCreated, 7);
  const state = await fetch(`${baseUrl}/api/ai-orchestration`, { headers });
  const bindings = (await state.json()).aiOrchestration.bindings;
  assert.equal(bindings.filter(item => item.projectId === "hero" && !item.teamId && !item.skillId).length, 8);
  const profiles = (await (await fetch(`${baseUrl}/api/ai-orchestration`, { headers })).json()).aiOrchestration.profiles;
  assert.equal(profiles.filter(item => item.role === "evaluator" && item.providerId === "openai" && item.modelId === "chatgpt" && item.status === "active").length, 1);
});
