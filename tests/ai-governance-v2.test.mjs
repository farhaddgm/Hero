import assert from "node:assert/strict";
import test from "node:test";

import { createAiProjectionStore } from "../packages/adapters/src/ai-projection-store.mjs";
import { createOperationalEvent } from "../packages/contracts/src/operational-data.mjs";
import { AI_BENCHMARK_CASES, validateAiBenchmarkContract } from "../packages/contracts/src/ai-benchmark.mjs";
import { TEAM_CATALOG } from "../packages/contracts/src/team.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";
import { createAiQualityGate } from "../packages/domain/src/ai-quality-gate.mjs";
import { createAiOrchestration, createDeterministicAiProviderAdapter } from "../packages/domain/src/ai-orchestration.mjs";
import { compareAiBenchmarks, runAiBenchmark } from "../packages/domain/src/ai-benchmark.mjs";
import { createOrganizationPerformanceReview } from "../packages/domain/src/organization-performance.mjs";

const OWNER = { kind: "project-owner", id: "hero-owner" };
const AGENT = { kind: "agent", id: "hero-test-agent" };
const now = () => "2026-08-30T12:00:00.000Z";

function decision(operation) {
  return { authorized: true, code: "AUTHORIZED", globalStop: false, safeCheckpointRequired: false, stepId: "HERO-016", documentVersion: "v1.0", operation, authorizationId: "AUTH-V2-001" };
}

function testEvidence() {
  return { provider: "codex", status: "completed", files: ["packages/domain/src/ai-quality-gate.mjs"], errors: [], tests: { status: "passed", total: 1, passed: 1, failed: 0 }, workspace: { isolated: true, actualRepositoryMutation: false }, artifact: { external: false, reference: "hero://artifacts/quality-v2" } };
}

function registerEvaluator(orchestration, handler) {
  orchestration.registerProvider({ providerId: "anthropic", mode: "deterministic", displayName: "Deterministic evaluator", adapter: createDeterministicAiProviderAdapter("anthropic", handler), actor: OWNER, idempotencyKey: "v2-provider-evaluator" });
  orchestration.registerModel({ providerId: "anthropic", modelId: "default", actor: OWNER, idempotencyKey: "v2-model-evaluator" });
  orchestration.registerProfile({ profileId: "v2-evaluator-profile", role: "evaluator", providerId: "anthropic", modelId: "default", credentialRef: "runtime:v2-evaluator", promptVersion: "evaluator-v2", contextPolicy: "approved", toolPolicy: "read-only", outputSchema: "evaluation-v1", status: "active", actor: OWNER, idempotencyKey: "v2-profile-evaluator" });
  orchestration.bindRole({ bindingId: "v2-evaluator-binding", projectId: "hero", role: "evaluator", profileId: "v2-evaluator-profile", actor: OWNER, idempotencyKey: "v2-binding-evaluator" });
}

test("AI workflow role contracts expose a schema and mutation boundary for every stage", async () => {
  const { validateAiOrchestrationContract, getAiOrchestrationContractSummary } = await import("../packages/contracts/src/ai-orchestration.mjs");
  assert.deepEqual(validateAiOrchestrationContract(), []);
  const summary = getAiOrchestrationContractSummary();
  assert.equal(summary.workflowContracts.development.stages[1].role, "executor");
  assert.equal(summary.roleOutputSchemas["code-reviewer"], "evaluation-v1");
  assert.equal(summary.roleMutationPolicies.executor, "development");
});

test("AI Quality Gate links evaluator evidence and keeps correction authorization separate", async () => {
  const orchestration = createAiOrchestration({ now });
  registerEvaluator(orchestration, input => ({ schema: input.outputSchema, verdict: "needs_revision", score: 70, confidence: 0.9, findings: [{ severity: "medium", category: "coverage", message: "یک سناریو نیازمند اصلاح است." }] }));
  const gate = createAiQualityGate({
    now,
    aiOrchestration: orchestration,
    invokeEvaluator: async input => {
      await orchestration.invoke({ invocationId: "v2-evaluator-invocation", projectId: "hero", taskId: "v2-task", runId: "v2-run", role: "evaluator", contextSnapshotId: "v2-context", request: "این evidence را ارزیابی کن.", context: { artifact: "hero://artifacts/quality-v2" }, actor: AGENT, idempotencyKey: "v2-invocation" });
      return { invocationId: "v2-evaluator-invocation", evaluationId: "v2-evaluation", target: { kind: "quality-gate", gateId: input.gateId } };
    }
  });
  gate.open({ gateId: "QG-V2", runId: "RUN-V2", taskId: "TASK-V2", stepId: "HERO-016", documentVersion: "v1.0", actor: OWNER, testDecision: decision("test"), idempotencyKey: "v2-open", policy: { maxCorrectionCycles: 1, maxCostUnits: 10 } });
  gate.recordTest({ gateId: "QG-V2", actor: OWNER, testDecision: decision("test"), testEvidence: testEvidence(), testCostUnits: 1, idempotencyKey: "v2-test" });
  const reviewed = await gate.reviewAsync({ gateId: "QG-V2", actor: OWNER, reviewDecision: decision("review"), reviewCostUnits: 1, idempotencyKey: "v2-review" });
  assert.equal(reviewed.gate.state, "fix-required");
  assert.equal(reviewed.gate.latestReview.evaluationId, "v2-evaluation");
  assert.equal(reviewed.gate.boundary.repositoryMutation, false);
  assert.ok(orchestration.events().some(event => event.type === "ai.evaluation-recorded"));
});

test("AI reliability controls enforce retry, timeout/cost boundaries and health checks", async () => {
  const orchestration = createAiOrchestration({ now });
  let calls = 0;
  orchestration.registerProvider({ providerId: "openai", mode: "deterministic", displayName: "Retry provider", adapter: createDeterministicAiProviderAdapter("openai", input => { calls += 1; if (calls === 1) throw new Error("transient"); return { schema: input.outputSchema, answer: "ok" }; }), actor: OWNER, idempotencyKey: "v2-provider-retry" });
  orchestration.registerModel({ providerId: "openai", modelId: "chatgpt", actor: OWNER, idempotencyKey: "v2-model-retry" });
  orchestration.registerProfile({ profileId: "v2-analyst-profile", role: "analyst", providerId: "openai", modelId: "chatgpt", credentialRef: "runtime:v2-openai", promptVersion: "analyst-v2", contextPolicy: "approved", toolPolicy: "read-only", outputSchema: "analysis-v1", status: "active", maxRetries: 1, actor: OWNER, idempotencyKey: "v2-profile-retry" });
  orchestration.bindRole({ bindingId: "v2-analyst-binding", projectId: "hero", role: "analyst", profileId: "v2-analyst-profile", actor: OWNER, idempotencyKey: "v2-binding-retry" });
  const result = await orchestration.invoke({ invocationId: "v2-retry-invocation", projectId: "hero", role: "analyst", contextSnapshotId: "v2-retry-context", request: "تحلیل کن.", context: { artifact: "hero://artifacts/retry" }, actor: AGENT, idempotencyKey: "v2-retry-invocation-key", requireHealthyProvider: true });
  assert.equal(result.invocation.status, "completed");
  assert.equal(result.invocation.attempts, 2);
  assert.equal(orchestration.events().filter(event => event.type === "ai.invocation-retry-scheduled").length, 1);
  assert.equal((await orchestration.checkProviderHealth({ providerId: "openai", actor: AGENT })).status, "healthy");

  const costly = createAiOrchestration({ now });
  costly.registerProvider({ providerId: "openai", mode: "deterministic", displayName: "Cost provider", adapter: { providerId: "openai", mode: "deterministic", generate: async input => ({ output: { schema: input.outputSchema }, usage: { inputTokens: 2, outputTokens: 2, totalTokens: 4, costUnits: 9 } }), validateConnection: async () => ({ status: "ok" }) }, actor: OWNER, idempotencyKey: "v2-provider-cost" });
  costly.registerModel({ providerId: "openai", modelId: "chatgpt", actor: OWNER, idempotencyKey: "v2-model-cost" });
  costly.registerProfile({ profileId: "v2-cost-profile", role: "analyst", providerId: "openai", modelId: "chatgpt", credentialRef: "runtime:v2-cost", promptVersion: "analyst-v2", contextPolicy: "approved", toolPolicy: "read-only", outputSchema: "analysis-v1", status: "active", maxCostUnits: 5, actor: OWNER, idempotencyKey: "v2-profile-cost" });
  costly.bindRole({ bindingId: "v2-cost-binding", projectId: "hero", role: "analyst", profileId: "v2-cost-profile", actor: OWNER, idempotencyKey: "v2-binding-cost" });
  const overBudget = await costly.invoke({ invocationId: "v2-cost-invocation", projectId: "hero", role: "analyst", contextSnapshotId: "v2-cost-context", request: "تحلیل کن.", context: { artifact: "hero://artifacts/cost" }, actor: AGENT, idempotencyKey: "v2-cost-invocation-key" });
  assert.equal(overBudget.invocation.status, "failed");
  assert.equal(overBudget.invocation.code, "COST_LIMIT_REACHED");
});

test("AI reliability opens and recovers through a bounded provider circuit", async () => {
  let currentMs = Date.parse("2026-08-30T12:00:00.000Z");
  let healthy = false;
  const orchestration = createAiOrchestration({ now: () => new Date(currentMs).toISOString(), clock: () => currentMs, circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 1_000 } });
  let calls = 0;
  orchestration.registerProvider({ providerId: "openai", mode: "deterministic", displayName: "Circuit provider", adapter: createDeterministicAiProviderAdapter("openai", input => { calls += 1; if (!healthy) throw new Error("temporary provider failure"); return { schema: input.outputSchema, answer: "recovered" }; }), actor: OWNER, idempotencyKey: "v2-provider-circuit" });
  orchestration.registerModel({ providerId: "openai", modelId: "chatgpt", actor: OWNER, idempotencyKey: "v2-model-circuit" });
  orchestration.registerProfile({ profileId: "v2-circuit-profile", role: "analyst", providerId: "openai", modelId: "chatgpt", credentialRef: "runtime:v2-circuit", promptVersion: "analyst-v2", contextPolicy: "approved", toolPolicy: "read-only", outputSchema: "analysis-v1", status: "active", actor: OWNER, idempotencyKey: "v2-profile-circuit" });
  orchestration.bindRole({ bindingId: "v2-circuit-binding", projectId: "hero", role: "analyst", profileId: "v2-circuit-profile", actor: OWNER, idempotencyKey: "v2-binding-circuit" });
  const invoke = invocationId => orchestration.invoke({ invocationId, projectId: "hero", role: "analyst", contextSnapshotId: `circuit-context-${invocationId}`, request: "تحلیل کن.", context: { artifact: "hero://artifacts/circuit" }, actor: AGENT, idempotencyKey: `circuit-key-${invocationId}` });
  assert.equal((await invoke("circuit-failure-1")).invocation.code, "PROVIDER_EXECUTION_FAILED");
  assert.equal((await invoke("circuit-failure-2")).invocation.code, "PROVIDER_EXECUTION_FAILED");
  assert.equal((await invoke("circuit-blocked-3")).invocation.code, "PROVIDER_CIRCUIT_OPEN");
  assert.equal(calls, 2);
  assert.equal(orchestration.snapshot().circuitBreaker.states[0].state, "open");
  assert.ok(orchestration.events().some(event => event.type === "ai.provider-circuit-opened"));
  currentMs += 1_001;
  healthy = true;
  assert.equal((await invoke("circuit-recovered-4")).invocation.status, "completed");
  assert.equal(orchestration.snapshot().circuitBreaker.states[0].state, "closed");
  assert.ok(orchestration.events().some(event => event.type === "ai.provider-circuit-closed"));
});

test("organization performance review covers all eleven teams and produces advisory evidence", () => {
  const review = createOrganizationPerformanceReview({ now });
  const teamMetrics = TEAM_CATALOG.map((team, index) => ({ teamId: team.teamId, evidenceRef: `hero://evidence/team-${team.teamId}`, scores: { delivery: 80, quality: 80, evidence: 80, rework: index === 0 ? 50 : 80, reliability: 80 } }));
  const result = review.review({ reviewId: "ORG-REVIEW-V2", organizationId: "hero", period: "2026-Q3", teamMetrics, idempotencyKey: "org-review-v2" });
  assert.equal(result.teamCount, 11);
  assert.equal(result.coverage.complete, true);
  assert.equal(result.teams[0].band, "watch");
  assert.equal(result.decisionBoundary, "evidence-and-recommendation-only");
  assert.throws(() => review.review({ reviewId: "ORG-REVIEW-V2-BAD", organizationId: "hero", period: "2026-Q3", teamMetrics: teamMetrics.slice(0, 10), idempotencyKey: "org-review-v2-bad" }), /Exactly 11/);
});

test("AI projections reuse the operational event store and rebuild deterministically", async () => {
  const calls = [];
  const event = createOperationalEvent({ eventId: "evt_ai_v2_001", aggregateType: "ai-evaluation", aggregateId: "eval-v2", type: "ai.evaluation-recorded", occurredAt: now(), actor: { kind: "system", id: "hero-test" }, data: { evaluationId: "eval-v2", projectId: "hero", invocationId: null, target: { kind: "test" }, verdict: "approved", score: 100, confidence: 1, findingCount: 0 } });
  const store = {
    async appendEvent(value, options) { calls.push({ value, options }); return { ...value, sequence: 1, aggregateVersion: 1 }; },
    async readAggregate() { return [{ ...event, sequence: 1, aggregateVersion: 1 }]; },
    async readAfter() { return [{ ...event, sequence: 1, aggregateVersion: 1 }]; }
  };
  const projections = createAiProjectionStore({ store });
  await projections.append(event);
  const applied = [];
  const rebuilt = await projections.rebuild({ apply: value => applied.push(value.eventId) });
  assert.equal(calls[0].options.outbox.topic, "hero.ai.projection");
  assert.deepEqual(applied, ["evt_ai_v2_001"]);
  assert.equal(rebuilt.applied, 1);
  await assert.rejects(() => projections.readAggregate("team", "team-v2"), /Only AI orchestration aggregates/);
});

test("synthetic AI benchmark compares eligible deterministic profiles without granting authority", async () => {
  assert.deepEqual(validateAiBenchmarkContract(), []);
  const run = await runAiBenchmark({ benchmarkId: "BENCH-V2-OPENAI", providerId: "openai", modelId: "chatgpt", profileId: "analyst-v2", runner: async ({ benchmarkCase }) => ({ status: "completed", schema: benchmarkCase.outputSchema, safetyPass: true, costUnits: 2 }) });
  const cheaper = await runAiBenchmark({ benchmarkId: "BENCH-V2-DET", providerId: "deterministic", modelId: "default", profileId: "analyst-det-v2", cases: AI_BENCHMARK_CASES.slice(0, 1), runner: async ({ benchmarkCase }) => ({ status: "completed", schema: benchmarkCase.outputSchema, safetyPass: true, costUnits: 1 }) });
  const comparison = compareAiBenchmarks([run, cheaper]);
  assert.equal(run.recommendationEligible, true);
  assert.equal(comparison.winner.providerId, "deterministic");
  assert.equal(run.authority.canAuthorizeProvider, false);
});

test("Control Plane exposes owner-gated organization evaluation and paginated AI events", async t => {
  const ownerAuth = createOwnerAuth({ secret: "test-only-v2-owner-secret-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "test-owner", sessionId: "session-v2-001", expiresAt: 2_000_000_000 });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const teamMetrics = TEAM_CATALOG.map(team => ({ teamId: team.teamId, evidenceRef: `hero://evidence/api-${team.teamId}`, scores: { delivery: 85, quality: 85, evidence: 85, rework: 85, reliability: 85 } }));
  const response = await fetch(`http://127.0.0.1:${address.port}/api/ai/organization-evaluations`, { method: "POST", headers, body: JSON.stringify({ reviewId: "ORG-API-V2", organizationId: "hero", period: "2026-Q3", teamMetrics, idempotencyKey: "org-api-v2" }) });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.result.review.teamCount, 11);
  assert.equal(body.result.evaluation.verdict, "approved");
  const events = await fetch(`http://127.0.0.1:${address.port}/api/ai/events?after=0`, { headers });
  assert.equal(events.status, 200);
  assert.ok((await events.json()).events.some(event => event.type === "ai.evaluation-recorded"));
  assert.equal((await fetch(`http://127.0.0.1:${address.port}/ai-benchmark-contract`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${address.port}/organization-performance-contract`)).status, 200);
});
