import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getQualityGateContractSummary,
  validateQualityGateContract
} from "../packages/contracts/src/quality-gate.mjs";
import {
  QualityGateIdempotencyConflictError,
  QualityGateSafetyError,
  createQualityGate
} from "../packages/domain/src/quality-gate.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const now = () => "2026-08-14T22:00:00.000Z";
const actor = { kind: "orchestrator", id: "hero-control-plane" };

function decision(operation, overrides = {}) {
  return { authorized: true, code: "AUTHORIZED", globalStop: false, safeCheckpointRequired: false, stepId: "HERO-016", documentVersion: "v1.0", operation, authorizationId: "AUTH-QUALITY-016", ...overrides };
}

function evidence(overrides = {}) {
  return {
    provider: "codex",
    status: "completed",
    files: ["packages/domain/src/quality-gate.mjs"],
    errors: [],
    tests: { status: "passed", total: 4, passed: 4, failed: 0 },
    workspace: { isolated: true, actualRepositoryMutation: false },
    artifact: { external: false, reference: "hero://artifacts/RUN-016/tests.json" },
    ...overrides
  };
}

function openInput(overrides = {}) {
  return {
    gateId: "QG-016", runId: "RUN-016", taskId: "TASK-016", stepId: "HERO-016", documentVersion: "v1.0",
    actor, testDecision: decision("test"), idempotencyKey: "open-once", policy: { maxCorrectionCycles: 1, maxCostUnits: 9 },
    ...overrides
  };
}

test("Quality Gate contract has a bounded, evidence-first lifecycle", () => {
  assert.deepEqual(validateQualityGateContract(), []);
  const contract = getQualityGateContractSummary();
  assert.ok(contract.states.includes("fix-required"));
  assert.ok(contract.decisionCodes.includes("CYCLE_LIMIT_REACHED"));
  assert.match(contract.limitRule, /before a correction cycle/);
  assert.match(contract.safetyBoundary, /does not invoke a provider/);
});

test("passing isolated test evidence and deterministic Claude review complete the Quality Gate", () => {
  const gate = createQualityGate({ now });
  const opened = gate.open(openInput());
  const replay = gate.open(openInput());
  const tested = gate.recordTest({ gateId: "QG-016", actor, testDecision: decision("test"), testEvidence: evidence(), testCostUnits: 2, idempotencyKey: "test-once" });
  const reviewed = gate.review({ gateId: "QG-016", actor, reviewDecision: decision("review"), reviewCostUnits: 1, idempotencyKey: "review-once" });

  assert.equal(opened.gate.state, "awaiting-test");
  assert.equal(replay.idempotent, true);
  assert.equal(tested.gate.state, "review-ready");
  assert.equal(reviewed.gate.state, "approved");
  assert.equal(reviewed.gate.code, "QUALITY_APPROVED");
  assert.equal(reviewed.gate.costUnits, 3);
  assert.equal(reviewed.gate.boundary.providerInvocation, false);
  assert.ok(gate.events().some(event => event.type === "quality-gate.approved"));
  assert.throws(() => gate.open(openInput({ policy: { maxCostUnits: 8 } })), QualityGateIdempotencyConflictError);
});

test("review findings require an exact, separate develop authorization before retest", () => {
  const changesPipeline = {
    review: () => ({ status: "changes-requested", code: "CHANGES_REQUESTED", review: { findings: [{ id: "R-1", severity: "medium" }] } })
  };
  const gate = createQualityGate({ now, reviewPipeline: changesPipeline });
  gate.open(openInput());
  gate.recordTest({ gateId: "QG-016", actor, testDecision: decision("test"), testEvidence: evidence(), testCostUnits: 1, idempotencyKey: "test-once" });
  const reviewed = gate.review({ gateId: "QG-016", actor, reviewDecision: decision("review"), reviewCostUnits: 1, idempotencyKey: "review-once" });
  assert.equal(reviewed.gate.state, "fix-required");
  assert.equal(reviewed.gate.code, "FIX_REQUIRED");
  assert.throws(
    () => gate.authorizeFix({ gateId: "QG-016", actor, correctionTaskId: "TASK-CORRECT-016", developDecision: decision("review"), idempotencyKey: "fix-wrong-op" }),
    /exact develop authorization/
  );
  const fixed = gate.authorizeFix({ gateId: "QG-016", actor, correctionTaskId: "TASK-CORRECT-016", developDecision: decision("develop"), idempotencyKey: "fix-once" });
  assert.equal(fixed.gate.state, "awaiting-retest");
  assert.equal(fixed.gate.correctionCycles, 1);
  assert.ok(gate.events().some(event => event.type === "quality-gate.correction-authorized"));
});

test("a second changes request after the correction cap stops safely", () => {
  const changesPipeline = { review: () => ({ status: "changes-requested", code: "CHANGES_REQUESTED", review: { findings: [{ id: "R-1" }] } }) };
  const gate = createQualityGate({ now, reviewPipeline: changesPipeline });
  gate.open(openInput());
  gate.recordTest({ gateId: "QG-016", actor, testDecision: decision("test"), testEvidence: evidence(), testCostUnits: 1, idempotencyKey: "test-1" });
  gate.review({ gateId: "QG-016", actor, reviewDecision: decision("review"), reviewCostUnits: 1, idempotencyKey: "review-1" });
  gate.authorizeFix({ gateId: "QG-016", actor, correctionTaskId: "TASK-CORRECT-016", developDecision: decision("develop"), idempotencyKey: "fix-1" });
  gate.recordTest({ gateId: "QG-016", actor, testDecision: decision("test"), testEvidence: evidence(), testCostUnits: 1, idempotencyKey: "test-2" });
  const stopped = gate.review({ gateId: "QG-016", actor, reviewDecision: decision("review"), reviewCostUnits: 1, idempotencyKey: "review-2" });
  assert.equal(stopped.gate.state, "stopped");
  assert.equal(stopped.gate.code, "CYCLE_LIMIT_REACHED");
});

test("budget, global stop and invalid evidence fail closed without a hidden dispatch", () => {
  const budgetGate = createQualityGate({ now });
  budgetGate.open(openInput({ policy: { maxCorrectionCycles: 1, maxCostUnits: 1 } }));
  const budget = budgetGate.recordTest({ gateId: "QG-016", actor, testDecision: decision("test"), testEvidence: evidence(), testCostUnits: 2, idempotencyKey: "test-over-budget" });
  assert.equal(budget.gate.code, "BUDGET_LIMIT_REACHED");

  const stopGate = createQualityGate({ now });
  const stopped = stopGate.open(openInput({ testDecision: decision("test", { authorized: false, code: "GLOBAL_STOP_ACTIVE", globalStop: true }) }));
  assert.equal(stopped.gate.code, "GLOBAL_STOP_ACTIVE");

  const invalidGate = createQualityGate({ now });
  invalidGate.open(openInput());
  const invalid = invalidGate.recordTest({ gateId: "QG-016", actor, testDecision: decision("test"), testEvidence: evidence({ workspace: { isolated: false } }), testCostUnits: 1, idempotencyKey: "invalid-evidence" });
  assert.equal(invalid.gate.code, "TEST_EVIDENCE_REJECTED");
  assert.equal(invalid.gate.boundary.repositoryMutation, false);
  assert.throws(() => invalidGate.recordTest({ gateId: "QG-016", actor, testDecision: decision("test"), testEvidence: evidence({ note: "Bearer token_should_not_be_accepted_123" }), testCostUnits: 1, idempotencyKey: "secret" }), QualityGateSafetyError);
});

test("approved HERO-016 specification remains aligned with its executable Quality Gate", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-016-v1.0.md"), "utf8");
  assert.match(specification, /QUALITY_APPROVED/);
  assert.match(specification, /FIX_REQUIRED/);
  assert.match(specification, /maxCorrectionCycles/);
  assert.match(specification, /Claude/);
});
