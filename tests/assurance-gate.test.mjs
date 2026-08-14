import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { getAssuranceGateContractSummary, validateAssuranceGateContract } from "../packages/contracts/src/assurance-gate.mjs";
import { AssuranceGateIdempotencyConflictError, AssuranceGateSafetyError, createAssuranceGate, createAssuranceGateHarness } from "../packages/domain/src/assurance-gate.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const now = () => "2026-08-14T23:45:00.000Z";
const actor = { kind: "orchestrator", id: "hero-control-plane" };

function decision(overrides = {}) {
  return {
    authorized: true, code: "AUTHORIZED", globalStop: false, safeCheckpointRequired: false,
    stepId: "HERO-019", documentVersion: "v1.0", operation: "test", authorizationId: "AUTH-BATCH-20260814-001-HERO-019",
    ...overrides
  };
}

function evidence(overrides = {}) {
  return {
    ci: { status: "passed", external: false, checks: ["pnpm-check"] },
    security: { status: "passed", sensitiveValuesDetected: false, networkEnabled: false },
    observability: { status: "ready", externalExport: false, eventTypes: ["authorization.dispatch-blocked", "quality-gate.approved", "run.completed"] },
    cost: { units: 3, externalSpend: false },
    ...overrides
  };
}

function input(overrides = {}) {
  return {
    gateId: "ASSURE-019", stepId: "HERO-019", documentVersion: "v1.0", actor, testDecision: decision(),
    idempotencyKey: "assess-once", policy: { maxCostUnits: 10 }, evidence: evidence(), ...overrides
  };
}

test("Assurance Gate contract fixes local CI, security, observability, cost and release boundaries", () => {
  assert.deepEqual(validateAssuranceGateContract(), []);
  const contract = getAssuranceGateContractSummary();
  assert.ok(contract.checks.includes("CI evidence"));
  assert.ok(contract.decisionCodes.includes("BUDGET_CAP_REACHED"));
  assert.ok(contract.decisionCodes.includes("RELEASE_REQUIRES_SEPARATE_AUTHORIZATION"));
  assert.match(contract.safetyBoundary, /does not dispatch CI/);
});

test("local evidence becomes an approved, version-bound Assurance Gate and replays safely", () => {
  const gate = createAssuranceGate({ now });
  const first = gate.assess(input());
  const replay = gate.assess(input());

  assert.equal(first.gate.state, "approved");
  assert.equal(first.gate.code, "ASSURANCE_APPROVED");
  assert.equal(first.gate.evidence.cost.units, 3);
  assert.equal(first.gate.release.dispatchStarted, false);
  assert.equal(first.gate.boundary.ciDispatch, false);
  assert.equal(replay.idempotent, true);
  assert.ok(gate.events().some(event => event.type === "assurance-gate.assessment-approved"));
  assert.throws(() => gate.assess(input({ evidence: evidence({ cost: { units: 4, externalSpend: false } }) })), AssuranceGateIdempotencyConflictError);
});

test("CI, security, observability and cost failures stop safely without an external dispatch", () => {
  const ci = createAssuranceGate({ now }).assess(input({ gateId: "ASSURE-019-CI", evidence: evidence({ ci: { status: "missing", external: false, checks: [] } }) }));
  const security = createAssuranceGate({ now }).assess(input({ gateId: "ASSURE-019-SEC", evidence: evidence({ security: { status: "passed", sensitiveValuesDetected: false, networkEnabled: true } }) }));
  const observability = createAssuranceGate({ now }).assess(input({ gateId: "ASSURE-019-OBS", evidence: evidence({ observability: { status: "ready", externalExport: false, eventTypes: ["run.completed"] } }) }));
  const budget = createAssuranceGate({ now }).assess(input({ gateId: "ASSURE-019-BUD", evidence: evidence({ cost: { units: 11, externalSpend: false } }) }));
  const spend = createAssuranceGate({ now }).assess(input({ gateId: "ASSURE-019-SPEND", evidence: evidence({ cost: { units: 1, externalSpend: true } }) }));

  assert.equal(ci.gate.code, "CI_EVIDENCE_REQUIRED");
  assert.equal(security.gate.code, "SECURITY_POLICY_FAILED");
  assert.equal(observability.gate.code, "OBSERVABILITY_CONTRACT_REQUIRED");
  assert.equal(budget.gate.code, "BUDGET_CAP_REACHED");
  assert.equal(spend.gate.code, "EXTERNAL_SPEND_REQUIRES_SEPARATE_AUTHORIZATION");
  assert.ok([ci, security, observability, budget, spend].every(result => result.gate.boundary.externalSpend === false));
});

test("authorization, Global Stop, secret-shaped input and host paths fail closed", () => {
  const gate = createAssuranceGate({ now });
  assert.throws(() => gate.assess(input({ testDecision: decision({ operation: "develop" }) })), /exact test authorization/);
  assert.throws(() => gate.assess(input({ gateId: "ASSURE-019-SECRET", evidence: evidence({ ci: { status: "passed", external: false, checks: ["Bearer token_should_not_be_accepted_123"] } }) })), AssuranceGateSafetyError);
  const hostBound = "c" + String.fromCharCode(58) + String.fromCharCode(92) + "hero";
  assert.throws(() => gate.assess(input({ gateId: "ASSURE-019-HOST", evidence: evidence({ ci: { status: "passed", external: false, checks: [hostBound] } }) })), AssuranceGateSafetyError);
  const stopped = gate.assess(input({ gateId: "ASSURE-019-STOP", testDecision: decision({ authorized: false, code: "GLOBAL_STOP_ACTIVE", globalStop: true }) }));
  assert.equal(stopped.gate.state, "blocked");
  assert.equal(stopped.gate.code, "GLOBAL_STOP_ACTIVE");
});

test("the harness never turns local assurance into a CI dispatch, telemetry export or release", () => {
  const result = createAssuranceGateHarness({ now }).run(input());
  assert.equal(result.gate.state, "approved");
  assert.equal(result.gate.boundary.ciDispatch, false);
  assert.equal(result.gate.boundary.telemetryExport, false);
  assert.equal(result.gate.release.code, "RELEASE_REQUIRES_SEPARATE_AUTHORIZATION");
});

test("approved HERO-019 specification remains aligned with the executable Assurance Gate", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-019-v1.0.md"), "utf8");
  const architecture = fs.readFileSync(path.join(REPO_ROOT, "docs", "architecture", "ASSURANCE_GATE.md"), "utf8");
  assert.match(specification, /ASSURANCE_APPROVED/);
  assert.match(specification, /CI_EVIDENCE_REQUIRED/);
  assert.match(specification, /RELEASE_REQUIRES_SEPARATE_AUTHORIZATION/);
  assert.match(architecture, /local CI evidence/);
  assert.match(architecture, /telemetry export/);
});
