import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { getPortabilityGateContractSummary, validatePortabilityGateContract } from "../packages/contracts/src/portability-gate.mjs";
import { PortabilityGateIdempotencyConflictError, PortabilityGateSafetyError, createPortabilityGate, createPortabilityGateHarness } from "../packages/domain/src/portability-gate.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const now = () => "2026-08-14T23:55:00.000Z";
const actor = { kind: "orchestrator", id: "hero-control-plane" };
const digest = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function decision(overrides = {}) {
  return {
    authorized: true, code: "AUTHORIZED", globalStop: false, safeCheckpointRequired: false,
    stepId: "HERO-020", documentVersion: "v1.0", operation: "test", authorizationId: "AUTH-BATCH-20260814-001-HERO-020",
    ...overrides
  };
}

function evidence(overrides = {}) {
  return {
    source: {
      status: "passed", independentRepository: true, externalProjectReferenceDetected: false, hostSpecificPathDetected: false,
      files: [".env.example", "compose.yaml", "Dockerfile", "pnpm-lock.yaml"]
    },
    runtime: { status: "passed", linuxContainerReference: true, environmentPrefix: "HERO_", composeResources: ["hero-data", "hero-private"] },
    backup: { status: "passed", artifactId: "hero-state-manifest", digest, projectScoped: true, containsSecrets: false },
    restore: { status: "passed", digest, checksumMatched: true, migrationState: "verified", cleanLinuxVerified: true },
    ...overrides
  };
}

function input(overrides = {}) {
  return {
    assessmentId: "PORTABLE-020", stepId: "HERO-020", documentVersion: "v1.0", actor,
    testDecision: decision(), idempotencyKey: "assess-once", evidence: evidence(), ...overrides
  };
}

test("Portability Gate contract fixes source, backup, restore and transfer boundaries", () => {
  assert.deepEqual(validatePortabilityGateContract(), []);
  const contract = getPortabilityGateContractSummary();
  assert.ok(contract.checks.includes("clean Linux verification"));
  assert.ok(contract.decisionCodes.includes("TRANSFER_REQUIRES_SEPARATE_AUTHORIZATION"));
  assert.match(contract.safetyBoundary, /never copies a repository/);
});

test("version-bound portability evidence becomes transfer-ready only as a deterministic record", () => {
  const gate = createPortabilityGate({ now });
  const first = gate.assess(input());
  const replay = gate.assess(input());

  assert.equal(first.gate.state, "ready");
  assert.equal(first.gate.code, "PORTABILITY_VERIFIED");
  assert.equal(first.gate.evidence.backup.digest, digest);
  assert.equal(first.gate.transfer.code, "TRANSFER_REQUIRES_SEPARATE_AUTHORIZATION");
  assert.equal(first.gate.transfer.containersStarted, false);
  assert.equal(first.gate.boundary.filesystemBackupOperation, false);
  assert.equal(replay.idempotent, true);
  assert.ok(gate.events().some(event => event.type === "portability-gate.assessment-approved"));
  assert.throws(() => gate.assess(input({ evidence: evidence({ restore: { status: "passed", digest, checksumMatched: false, migrationState: "verified", cleanLinuxVerified: true } }) })), PortabilityGateIdempotencyConflictError);
});

test("source, runtime, backup, restore and Linux failures block before any transfer operation", () => {
  const source = createPortabilityGate({ now }).assess(input({ assessmentId: "PORTABLE-020-SOURCE", evidence: evidence({ source: { status: "passed", independentRepository: false, externalProjectReferenceDetected: false, hostSpecificPathDetected: false, files: [] } }) }));
  const runtime = createPortabilityGate({ now }).assess(input({ assessmentId: "PORTABLE-020-RUNTIME", evidence: evidence({ runtime: { status: "passed", linuxContainerReference: false, environmentPrefix: "HERO_", composeResources: [] } }) }));
  const backup = createPortabilityGate({ now }).assess(input({ assessmentId: "PORTABLE-020-BACKUP", evidence: evidence({ backup: { status: "passed", artifactId: "hero-state-manifest", digest: "sha256:bad", projectScoped: true, containsSecrets: false } }) }));
  const restore = createPortabilityGate({ now }).assess(input({ assessmentId: "PORTABLE-020-RESTORE", evidence: evidence({ restore: { status: "passed", digest, checksumMatched: false, migrationState: "verified", cleanLinuxVerified: true } }) }));
  const linux = createPortabilityGate({ now }).assess(input({ assessmentId: "PORTABLE-020-LINUX", evidence: evidence({ restore: { status: "passed", digest, checksumMatched: true, migrationState: "verified", cleanLinuxVerified: false } }) }));

  assert.equal(source.gate.code, "SOURCE_BOUNDARY_FAILED");
  assert.equal(runtime.gate.code, "RUNTIME_CONTRACT_REQUIRED");
  assert.equal(backup.gate.code, "BACKUP_EVIDENCE_REQUIRED");
  assert.equal(restore.gate.code, "RESTORE_EVIDENCE_REQUIRED");
  assert.equal(linux.gate.code, "LINUX_CLEANROOM_VERIFICATION_REQUIRED");
  assert.ok([source, runtime, backup, restore, linux].every(result => result.gate.boundary.repositoryTransfer === false));
});

test("authorization, Global Stop, secret-shaped input and host paths fail closed", () => {
  const gate = createPortabilityGate({ now });
  assert.throws(() => gate.assess(input({ testDecision: decision({ operation: "develop" }) })), /exact test authorization/);
  assert.throws(() => gate.assess(input({ assessmentId: "PORTABLE-020-SECRET", evidence: evidence({ backup: { status: "passed", artifactId: "hero-state-manifest", digest, projectScoped: true, containsSecrets: false, note: "api_key=should_not_be_accepted" } }) })), PortabilityGateSafetyError);
  const hostBound = "c" + String.fromCharCode(58) + String.fromCharCode(92) + "hero";
  assert.throws(() => gate.assess(input({ assessmentId: "PORTABLE-020-HOST", evidence: evidence({ source: { status: "passed", independentRepository: true, externalProjectReferenceDetected: false, hostSpecificPathDetected: false, files: [hostBound] } }) })), PortabilityGateSafetyError);
  const stopped = gate.assess(input({ assessmentId: "PORTABLE-020-STOP", testDecision: decision({ authorized: false, code: "GLOBAL_STOP_ACTIVE", globalStop: true }) }));
  assert.equal(stopped.gate.state, "blocked");
  assert.equal(stopped.gate.code, "GLOBAL_STOP_ACTIVE");
});

test("the harness never turns evidence into a backup, restore, host or container operation", () => {
  const result = createPortabilityGateHarness({ now }).run(input());
  assert.equal(result.gate.state, "ready");
  assert.equal(result.gate.boundary.filesystemBackupOperation, false);
  assert.equal(result.gate.boundary.hostProvisioning, false);
  assert.equal(result.gate.transfer.secretsTouched, false);
});

test("HERO-020 documentation keeps real transfer and Linux proof outside the local contract", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-020-v1.0.md"), "utf8");
  const architecture = fs.readFileSync(path.join(REPO_ROOT, "docs", "architecture", "PORTABILITY.md"), "utf8");
  assert.match(specification, /PORTABILITY_VERIFIED/);
  assert.match(specification, /LINUX_CLEANROOM_VERIFICATION_REQUIRED/);
  assert.match(specification, /TRANSFER_REQUIRES_SEPARATE_AUTHORIZATION/);
  assert.match(architecture, /clean Linux/);
  assert.match(architecture, /does not execute backup/);
});
