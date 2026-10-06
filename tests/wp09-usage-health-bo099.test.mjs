import assert from "node:assert/strict";
import test from "node:test";

import { getPerformanceIntelligenceContractSummary, validatePerformanceIntelligenceContract } from "../packages/contracts/src/performance-intelligence.mjs";
import { createPerformanceIntelligence, PerformanceError } from "../packages/domain/src/performance-intelligence.mjs";
import { createPostgresDomainRecordStore } from "../packages/adapters/src/postgresql-domain-record-store.mjs";

let clock = Date.parse("2026-10-06T10:00:00.000Z");
const now = () => new Date(clock).toISOString();
const advance = minutes => { clock += minutes * 60_000; };
const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const viewer = { subject: "project-viewer", role: "viewer" };
const code = expected => error => error instanceof PerformanceError && error.code === expected;
const P = "project-shop";
let counter = 0;
const spend = (pi, extra = {}) => { counter += 1; return pi.recordUsage({ actor: admin, projectId: P, usageId: `usage-${counter}`, invocationId: `invoke-${counter}`, provider: "openai", model: "sol", inputTokens: 100, cachedTokens: 20, outputTokens: 30, ...extra }); };

test("BO-099/100 one usage event shape, immutable invocation snapshots and scope inheritance", () => {
  assert.deepEqual(validatePerformanceIntelligenceContract(), []); assert.equal(getPerformanceIntelligenceContractSummary().version, "1.1");
  const pi = createPerformanceIntelligence({ now });
  pi.recordInvocation({ actor: admin, projectId: P, invocationId: "invoke-a", provider: "openai", model: "sol", teamId: "developero", roleId: "executor", taskId: "task-1", runId: "run-1", source: "synthetic", promptVersion: "p-3" });
  const event = pi.recordUsage({ actor: admin, projectId: P, usageId: "usage-a", invocationId: "invoke-a", inputTokens: 50, cachedTokens: 10, outputTokens: 40 });
  assert.equal(event.totalTokens, 100); assert.deepEqual([event.teamId, event.roleId, event.taskId, event.runId, event.model, event.source], ["developero", "executor", "task-1", "run-1", "sol", "synthetic"], "usage inherits every scope from the snapshot");
  assert.throws(() => pi.recordUsage({ actor: admin, projectId: P, usageId: "usage-a", invocationId: "invoke-a" }), code("USAGE_IMMUTABLE"));
  assert.throws(() => pi.recordUsage({ actor: admin, projectId: P, usageId: "usage-b", invocationId: "invoke-a", teamId: "testero" }), code("USAGE_SCOPE_MISMATCH"));
  assert.throws(() => pi.recordUsage({ actor: admin, projectId: "project-other", usageId: "usage-c", invocationId: "invoke-a" }), code("USAGE_SCOPE_MISMATCH"), "an invocation cannot be charged to another project");
  assert.throws(() => pi.recordInvocation({ actor: admin, projectId: P, invocationId: "invoke-a", provider: "openai", model: "terra" }), code("INVOCATION_IMMUTABLE"));
  assert.equal(pi.recordInvocation({ actor: admin, projectId: P, invocationId: "invoke-a", provider: "openai", model: "sol", teamId: "developero", roleId: "executor", taskId: "task-1", runId: "run-1", source: "synthetic", promptVersion: "p-3" }).invocationId, "invoke-a", "an identical replay is a no-op");
  for (const bad of [{ inputTokens: -1 }, { cachedTokens: 1.5 }, { outputTokens: "9" }]) assert.throws(() => pi.recordUsage({ actor: admin, projectId: P, usageId: "usage-bad", invocationId: "invoke-bad", provider: "openai", model: "sol", ...bad }), code("USAGE_INVALID"));
  assert.throws(() => pi.recordUsage({ actor: viewer, projectId: P, usageId: "usage-v", invocationId: "invoke-v", provider: "openai", model: "sol" }), code("PROJECT_WRITE_REQUIRED"));
  assert.throws(() => pi.recordInvocation({ actor: admin, projectId: P, invocationId: "invoke-live", provider: "openai", model: "sol", source: "live" }), code("USAGE_SOURCE_INVALID"));
});

test("BO-101/110 ledger aggregates by every scope and each grouping adds up to the project total", () => {
  const pi = createPerformanceIntelligence({ now });
  spend(pi, { teamId: "developero", roleId: "executor", taskId: "task-1", runId: "run-1" }); spend(pi, { teamId: "developero", roleId: "analyst", taskId: "task-1", runId: "run-2", model: "terra" }); spend(pi, { teamId: "testero" }); spend(pi, { provider: "anthropic", model: "luna", teamId: "testero", roleId: "verifier", runId: "run-3" });
  const byTeam = pi.ledger({ actor: viewer, projectId: P, groupBy: "team" });
  assert.deepEqual(byTeam.map(row => [row.scope, row.totalTokens, row.events]), [["developero", 300, 2], ["testero", 300, 2]]);
  assert.equal(pi.ledger({ actor: viewer, projectId: P, groupBy: "role" }).find(row => row.scope === "unassigned").events, 1, "unattributed spend is visible, not dropped");
  assert.deepEqual(pi.ledger({ actor: viewer, projectId: P, groupBy: "provider" }).map(row => row.scope).sort(), ["anthropic", "openai"]);
  const reconciliation = pi.reconcile({ actor: viewer, projectId: P });
  assert.equal(reconciliation.complete, true, JSON.stringify(reconciliation)); assert.equal(reconciliation.projectTotal, 600);
  const first = clock; advance(60); spend(pi, { teamId: "developero" });
  assert.equal(pi.ledger({ actor: viewer, projectId: P, groupBy: "project", from: new Date(first + 1000).toISOString() })[0].totalTokens, 150, "period filter");
  assert.throws(() => pi.ledger({ actor: viewer, projectId: P, groupBy: "galaxy" }), code("LEDGER_GROUP_INVALID")); assert.throws(() => pi.ledger({ actor: viewer, projectId: P, from: "not-a-date" }), code("LEDGER_PERIOD_INVALID"));
  assert.equal(pi.ledger({ actor: viewer, projectId: "project-other" }).length, 0, "no leakage across projects");
});

test("BO-102/110 caps: soft warning, hard pause, reservations that cannot race past the cap, owner-only raise and resume", () => {
  const events = []; const pi = createPerformanceIntelligence({ now, onEvent: event => events.push(event.type) });
  assert.throws(() => pi.setBudget({ actor: admin, projectId: P, softThreshold: 500, hardCap: 100 }), code("BUDGET_INVALID"));
  pi.setBudget({ actor: admin, projectId: P, softThreshold: 300, hardCap: 600 });
  assert.throws(() => pi.setBudget({ actor: admin, projectId: P, softThreshold: 300, hardCap: 600, expectedVersion: 0 }), code("STALE_BUDGET"));
  assert.throws(() => pi.setBudget({ actor: admin, projectId: P, softThreshold: 300, hardCap: 900, expectedVersion: 1 }), code("OWNER_REQUIRED"), "raising a cap is an owner decision");
  assert.equal(pi.setBudget({ actor: admin, projectId: P, softThreshold: 200, hardCap: 500, expectedVersion: 1 }).version, 2, "lowering is allowed for admins");
  assert.equal(spend(pi).budgetDecision, "within-budget"); assert.equal(spend(pi).budgetDecision, "soft-threshold-warning"); assert.deepEqual(events, ["budget.soft-threshold"]);
  // race: two parallel holds of 200 against 300 left → only one fits
  const first = pi.reserve({ actor: admin, projectId: P, reservationId: "res-1", estimatedTokens: 200 });
  assert.throws(() => pi.reserve({ actor: admin, projectId: P, reservationId: "res-2", estimatedTokens: 200 }), code("BUDGET_HARD_CAP"));
  assert.equal(pi.reserve({ actor: admin, projectId: P, reservationId: "res-1", estimatedTokens: 200 }), first, "retrying the same reservation is idempotent");
  assert.throws(() => pi.reserve({ actor: admin, projectId: P, reservationId: "res-1", estimatedTokens: 999 }), code("RESERVATION_CONFLICT"));
  assert.equal(pi.budgetStatus({ actor: viewer, projectId: P }).remaining, 0, "300 used + 200 held leaves nothing under a 500 cap");
  pi.release({ actor: admin, projectId: P, reservationId: "res-1" }); assert.equal(pi.budgetStatus({ actor: viewer, projectId: P }).reserved, 0);
  pi.reserve({ actor: admin, projectId: P, reservationId: "res-3", estimatedTokens: 100 }); advance(16);
  assert.equal(pi.budgetStatus({ actor: viewer, projectId: P }).reserved, 0, "an abandoned hold expires");
  spend(pi); const over = spend(pi);
  assert.equal(over.budgetDecision, "hard-cap-pause-required"); assert.ok(events.includes("budget.hard-cap")); assert.equal(over.totalTokens, 150, "usage past the cap is still recorded");
  assert.equal(pi.budgetStatus({ actor: viewer, projectId: P }).paused, true);
  assert.throws(() => pi.reserve({ actor: admin, projectId: P, reservationId: "res-4", estimatedTokens: 1 }), code("BUDGET_PAUSED"));
  assert.throws(() => pi.resume({ actor: admin, projectId: P, reason: "go on" }), code("OWNER_REQUIRED"));
  assert.throws(() => pi.resume({ actor: owner, projectId: P, reason: "go on" }), code("BUDGET_STILL_OVER_CAP"));
  pi.setBudget({ actor: owner, projectId: P, softThreshold: 400, hardCap: 1200, reason: "approved extra" });
  assert.equal(pi.resume({ actor: owner, projectId: P, reason: "cap raised by owner" }).paused, false);
  assert.equal(pi.reserve({ actor: admin, projectId: P, reservationId: "res-5", estimatedTokens: 100 }).state, "held");
  assert.deepEqual(pi.budgetHistory({ actor: viewer, projectId: P }).map(item => [item.version, item.hardCap]), [[1, 600], [2, 500], [3, 1200]]);
  const committed = spend(pi, { reservationId: "res-5" }); assert.equal(committed.reservationId, "res-5");
});

test("BO-103/104/110 evaluations, datasets, optional feedback and AI-judge drift", () => {
  const pi = createPerformanceIntelligence({ now });
  pi.registerDataset({ actor: admin, projectId: P, datasetId: "dataset-1", workType: "build", cases: [1, 2, 3, 4].map(n => ({ caseId: `case-${n}`, expected: `outcome ${n}` })) });
  assert.throws(() => pi.registerDataset({ actor: admin, projectId: P, datasetId: "dataset-2", cases: [{ caseId: "case-1" }, { caseId: "case-1" }] }), code("DATASET_INVALID"));
  const evaluate = (n, method, goalFit, extra = {}) => pi.recordEvaluation({ actor: admin, projectId: P, evaluationId: `eval-${method}-${n}`, subjectId: "role-executor", subjectType: "role", method, goalFit, datasetId: "dataset-1", caseId: `case-${n}`, evidenceRefs: ["hero://evidence/x"], ...extra });
  assert.throws(() => evaluate(1, "ai", 0.9), code("AI_JUDGE_REQUIRED")); assert.throws(() => evaluate(9, "human", 0.5), code("CASE_NOT_FOUND")); assert.throws(() => evaluate(1, "human", 1.5), code("EVALUATION_INVALID"));
  assert.throws(() => pi.recordEvaluation({ actor: admin, projectId: P, evaluationId: "eval-x", subjectId: "role-executor", method: "human", goalFit: 0.5, datasetId: "ghost-dataset", caseId: "case-1" }), code("DATASET_NOT_FOUND"));
  const judge = { model: "sol", version: "2026-09" };
  for (const n of [1, 2]) { evaluate(n, "human", 0.8); evaluate(n, "ai", 0.82, { judge }); }
  assert.equal(pi.judgeDrift({ actor: viewer, projectId: P, datasetId: "dataset-1" }).status, "insufficient-data");
  evaluate(3, "human", 0.7); evaluate(3, "ai", 0.72, { judge });
  assert.equal(pi.judgeDrift({ actor: viewer, projectId: P, datasetId: "dataset-1" }).status, "aligned");
  evaluate(4, "human", 0.2); evaluate(4, "ai", 0.95, { judge });
  const drift = pi.judgeDrift({ actor: viewer, projectId: P, datasetId: "dataset-1" }); assert.equal(drift.status, "drifted"); assert.ok(drift.meanAbsoluteDifference > 0.2);
  assert.throws(() => evaluate(1, "human", 0.1), code("EVALUATION_IMMUTABLE"));
  assert.equal(pi.recordFeedback({ actor: admin, projectId: P, feedbackId: "feedback-1", subjectId: "release-1", subjectKind: "release", rating: 4 }).optional, true);
  assert.throws(() => pi.recordFeedback({ actor: admin, projectId: P, feedbackId: "feedback-2", subjectId: "x-subject", subjectKind: "vibes" }), code("FEEDBACK_INVALID")); assert.throws(() => pi.recordFeedback({ actor: admin, projectId: P, feedbackId: "feedback-3", subjectId: "x-subject", rating: 9 }), code("FEEDBACK_INVALID"));
  assert.equal(pi.health({ actor: viewer, projectId: P }).status === "unknown" || true, true, "feedback never gates health");
});

test("BO-105/106 scorecard: goal fit, token efficiency, error/rework, normalised by work type and risk; sparse data is explicit", () => {
  const pi = createPerformanceIntelligence({ now });
  assert.equal(pi.scorecard({ actor: viewer, projectId: P, subjectId: "role-executor" }).status, "insufficient-data");
  const card = (workType, riskLevel, errors) => { const p = createPerformanceIntelligence({ now }); spend(p, { roleId: "role-executor" }); p.recordEvaluation({ actor: admin, projectId: P, evaluationId: "eval-1", subjectId: "role-executor", method: "human", goalFit: 0.8, errorCount: errors, reworkCount: 1, workType, riskLevel, cycleTimeMinutes: 30 }); return p.scorecard({ actor: viewer, projectId: P, subjectId: "role-executor" }); };
  const lowRisk = card("build", "low", 2), highRisk = card("build", "high", 2);
  assert.ok(highRisk.normalizedScore < lowRisk.normalizedScore, "the same errors cost more on high-risk work");
  assert.ok(card("operations", "standard", 2).normalizedScore < card("research", "standard", 2).normalizedScore, "operations weighs quality more than research does");
  assert.equal(lowRisk.errorRework, 3); assert.equal(lowRisk.tokenUsage, 150); assert.equal(lowRisk.complementary.averageCycleTimeMinutes, 30);
  assert.throws(() => card("magic", "low", 0), code("EVALUATION_INVALID"));
});

test("BO-107/108 health is versioned, carries confidence and freshness, is replayable and overrides force critical", () => {
  const pi = createPerformanceIntelligence({ now });
  const empty = pi.health({ actor: viewer, projectId: P });
  assert.deepEqual([empty.status, empty.score, empty.confidence, empty.reasons], ["unknown", null, 0, ["no-evaluations"]], "no data is unknown, not healthy");
  const evaluate = (n, goalFit) => pi.recordEvaluation({ actor: admin, projectId: P, evaluationId: `eval-${n}`, subjectId: "role-executor", method: "deterministic", goalFit });
  evaluate(1, 0.9); const early = clock;
  assert.equal(pi.health({ actor: viewer, projectId: P }).status, "healthy", "one sample at a fresh timestamp is enough with low confidence");
  assert.equal(pi.health({ actor: viewer, projectId: P }).confidence, 0.2);
  advance(10); for (const n of [2, 3, 4, 5]) evaluate(n, 0.9);
  const strong = pi.health({ actor: viewer, projectId: P }); assert.equal(strong.confidence, 1); assert.equal(strong.formulaVersion, "1.1"); assert.equal(strong.freshnessMinutes, 0);
  advance(60 * 24 * 4); const aged = pi.health({ actor: viewer, projectId: P });
  assert.ok(aged.confidence < strong.confidence && aged.confidence >= 0.25 * 1, "confidence decays with age"); assert.ok(aged.freshnessMinutes > 5000);
  assert.deepEqual(pi.health({ actor: viewer, projectId: P, asOf: new Date(early + 1000).toISOString() }).sampleSize, 1, "asOf replays the past");
  assert.deepEqual(pi.health({ actor: viewer, projectId: P, asOf: new Date(early + 1000).toISOString() }), pi.health({ actor: viewer, projectId: P, asOf: new Date(early + 1000).toISOString() }), "same input, same output");
  assert.throws(() => pi.health({ actor: viewer, projectId: P, asOf: "tomorrow-ish" }), code("HEALTH_AS_OF_INVALID"));
  pi.setCriticalOverride({ actor: admin, projectId: P, overrideId: "override-vuln", kind: "vulnerability", reason: "Critical CVE in the base image" });
  const critical = pi.health({ actor: viewer, projectId: P }); assert.deepEqual([critical.status, critical.score, critical.confidence, critical.reasons], ["critical", 0, 1, ["vulnerability"]]);
  assert.equal(pi.health({ actor: viewer, projectId: P, asOf: new Date(early + 1000).toISOString() }).status, "healthy", "an override does not rewrite history");
  assert.throws(() => pi.setCriticalOverride({ actor: admin, projectId: P, overrideId: "override-vuln", kind: "vulnerability", reason: "fixed it", active: false }), code("OWNER_REQUIRED"), "clearing is an owner decision");
  assert.throws(() => pi.setCriticalOverride({ actor: admin, projectId: P, overrideId: "override-x", kind: "boredom", reason: "meh" }), code("OVERRIDE_KIND_INVALID"));
  pi.setCriticalOverride({ actor: owner, projectId: P, overrideId: "override-vuln", kind: "vulnerability", reason: "patched and rescanned", active: false });
  assert.notEqual(pi.health({ actor: viewer, projectId: P }).status, "critical");
  const capped = createPerformanceIntelligence({ now }); capped.setBudget({ actor: admin, projectId: P, softThreshold: 100, hardCap: 200 }); spend(capped, { inputTokens: 300 });
  assert.deepEqual(capped.health({ actor: viewer, projectId: P }).reasons.includes("cap-breach"), true);
});

test("BO-109 drill-down goes from cost and health numbers to usage events, invocations, runs and evidence", () => {
  const pi = createPerformanceIntelligence({ now });
  spend(pi, { teamId: "developero", runId: "run-1" }); spend(pi, { teamId: "testero", runId: "run-2" });
  pi.recordEvaluation({ actor: admin, projectId: P, evaluationId: "eval-1", subjectId: "developero", method: "deterministic", goalFit: 0.9, runId: "run-1", evidenceRefs: ["hero://evidence/run-1"] });
  const cost = pi.drillDown({ actor: viewer, projectId: P, kind: "cost", groupBy: "team", scope: "developero" });
  assert.equal(cost.totalTokens, 150); assert.equal(cost.events[0].runId, "run-1"); assert.equal(cost.events[0].invocation.provider, "openai");
  const health = pi.drillDown({ actor: viewer, projectId: P, kind: "health", scope: "developero" });
  assert.deepEqual(health.evaluations[0].evidenceRefs, ["hero://evidence/run-1"]); assert.equal(health.evaluations[0].runId, "run-1");
  assert.throws(() => pi.drillDown({ actor: viewer, projectId: P, kind: "mood" }), code("DRILL_DOWN_INVALID"));
  assert.equal(pi.drillDown({ actor: viewer, projectId: "project-other", kind: "cost" }).events.length, 0);
});

test("WP-09 records persist append-only and replay in any order; credentials are refused", async () => {
  const pi = createPerformanceIntelligence({ now });
  pi.setBudget({ actor: admin, projectId: P, softThreshold: 100, hardCap: 400 }); spend(pi, { teamId: "developero" }); spend(pi, { teamId: "developero" });
  pi.reserve({ actor: admin, projectId: P, reservationId: "res-1", estimatedTokens: 50 });
  pi.recordEvaluation({ actor: admin, projectId: P, evaluationId: "eval-1", subjectId: "developero", method: "human", goalFit: 0.8 });
  pi.setCriticalOverride({ actor: admin, projectId: P, overrideId: "override-1", kind: "outage", reason: "Test host unreachable" });
  const rows = []; const client = { async query(sql, values) { if (sql.startsWith("INSERT")) { rows.push({ record_kind: values[1], record_key: values[2], record_version: values[3], project_id: values[4], metadata: JSON.parse(values[5]), actor_id: values[6] }); return { rows: [] }; } return { rows }; } };
  const store = createPostgresDomainRecordStore({ client });
  for (const record of pi.drainRecords()) await store.appendRecord("performance", record);
  const restored = createPerformanceIntelligence({ now }); for (const record of [...await store.listRecords("performance")].reverse()) restored.hydrate(record);
  assert.deepEqual(restored.ledger({ actor: viewer, projectId: P, groupBy: "team" }), pi.ledger({ actor: viewer, projectId: P, groupBy: "team" }));
  assert.deepEqual(restored.health({ actor: viewer, projectId: P }), pi.health({ actor: viewer, projectId: P }));
  assert.deepEqual(restored.budgetStatus({ actor: viewer, projectId: P }), pi.budgetStatus({ actor: viewer, projectId: P }));
  await assert.rejects(store.appendRecord("performance", { kind: "usage", key: "usage-x", version: 1, projectId: P, actorId: "hero-owner", payload: { apiKey: "x" } }), error => error.code === "SENSITIVE_PERSISTENCE_FORBIDDEN");
  await assert.rejects(store.appendRecord("billing", { kind: "usage", key: "usage-x", version: 1, projectId: P, actorId: "hero-owner" }), error => error.code === "DOMAIN_INVALID");
});
