import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getAuthorizationContractSummary,
  validateAuthorizationContract
} from "../packages/contracts/src/authorization.mjs";
import {
  AuthorizationIdempotencyConflictError,
  AuthorizationVersionConflictError,
  createAuthorizationEngine
} from "../packages/domain/src/authorization-engine.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const owner = Object.freeze({ kind: "project-owner", id: "hero-owner" });
const orchestrator = Object.freeze({ kind: "orchestrator", id: "hero-control-plane" });

function engine() {
  return createAuthorizationEngine({ now: () => "2026-08-14T14:00:00.000Z" });
}

function grant(engineInstance, authorizationId = "AUTH-DIRECT-007", overrides = {}) {
  return engineInstance.grant({
    authorizationId,
    mode: "direct",
    entries: [{ stepId: "HERO-007", documentVersion: "v1.0" }],
    operations: ["develop", "test"],
    actor: owner,
    idempotencyKey: `idem-grant-${authorizationId}`,
    ...overrides
  });
}

function dispatch(engineInstance, authorizationId, suffix, overrides = {}) {
  return engineInstance.evaluateDispatch({
    authorizationId,
    stepId: "HERO-007",
    documentVersion: "v1.0",
    operation: "develop",
    actor: orchestrator,
    idempotencyKey: `idem-dispatch-${authorizationId}-${suffix}`,
    ...overrides
  });
}

test("authorization contract keeps development authority bounded and explicit", () => {
  assert.deepEqual(validateAuthorizationContract(), []);
  const summary = getAuthorizationContractSummary();
  assert.ok(summary.modes.includes("batch-snapshot"));
  assert.ok(summary.separatelyApprovedOperations.includes("secret-change"));
  assert.ok(summary.decisionCodes.includes("SNAPSHOT_ENTRY_NOT_FOUND"));
});

test("direct authorization requires exact step, version and operation matching", () => {
  const authorization = engine();
  const granted = grant(authorization);
  assert.equal(granted.authorization.status, "active");
  assert.equal(dispatch(authorization, "AUTH-DIRECT-007", "exact").decision.authorized, true);
  assert.equal(
    dispatch(authorization, "AUTH-DIRECT-007", "new-version", { documentVersion: "v1.1" }).decision.code,
    "SNAPSHOT_ENTRY_NOT_FOUND"
  );
  assert.equal(
    dispatch(authorization, "AUTH-DIRECT-007", "different-operation", { operation: "review" }).decision.code,
    "OPERATION_NOT_GRANTED"
  );
});

test("batch snapshot never expands to a later step or document version", () => {
  const authorization = engine();
  authorization.grant({
    authorizationId: "AUTH-SNAPSHOT-007",
    mode: "batch-snapshot",
    entries: [
      { stepId: "HERO-007", documentVersion: "v1.0" },
      { stepId: "HERO-008", documentVersion: "v1.0" }
    ],
    operations: ["develop", "test", "review"],
    actor: owner,
    idempotencyKey: "idem-grant-snapshot"
  });
  assert.equal(dispatch(authorization, "AUTH-SNAPSHOT-007", "included").decision.authorized, true);
  assert.equal(
    authorization.evaluateDispatch({
      authorizationId: "AUTH-SNAPSHOT-007",
      stepId: "HERO-009",
      documentVersion: "v1.0",
      operation: "develop",
      actor: orchestrator,
      idempotencyKey: "idem-dispatch-outside-snapshot"
    }).decision.code,
    "SNAPSHOT_ENTRY_NOT_FOUND"
  );
});

test("sensitive operations and non-owner grants fail before authorization can exist", () => {
  const authorization = engine();
  assert.throws(
    () => grant(authorization, "AUTH-SENSITIVE-007", { operations: ["production-deploy"] }),
    /Sensitive operation/
  );
  assert.throws(
    () => grant(authorization, "AUTH-ROGUE-007", { actor: orchestrator }),
    /Only project-owner/
  );
  assert.equal(
    authorization.evaluateDispatch({
      authorizationId: "AUTH-NOT-FOUND-007",
      stepId: "HERO-007",
      documentVersion: "v1.0",
      operation: "production-deploy",
      actor: orchestrator,
      idempotencyKey: "idem-sensitive-dispatch"
    }).decision.code,
    "SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL"
  );
});

test("revocation is append-only and blocks subsequent dispatch", () => {
  const authorization = engine();
  grant(authorization, "AUTH-REVOKE-007");
  const revoked = authorization.revoke({
    authorizationId: "AUTH-REVOKE-007",
    actor: owner,
    idempotencyKey: "idem-revoke-007",
    reason: "owner-request"
  });
  assert.equal(revoked.authorization.status, "revoked");
  assert.equal(dispatch(authorization, "AUTH-REVOKE-007", "after-revoke").decision.code, "AUTHORIZATION_NOT_ACTIVE");
  assert.deepEqual(
    authorization.audit().map(event => event.type),
    ["authorization.granted", "authorization.revoked", "authorization.dispatch-blocked"]
  );
});

test("global stop blocks new dispatch and signals a safe checkpoint requirement", () => {
  const authorization = engine();
  grant(authorization, "AUTH-STOP-007");
  const stopped = authorization.activateGlobalStop({
    actor: owner,
    idempotencyKey: "idem-stop-activate",
    reason: "owner-emergency-stop"
  });
  assert.equal(stopped.globalStop.active, true);
  const blocked = dispatch(authorization, "AUTH-STOP-007", "stopped");
  assert.equal(blocked.decision.code, "GLOBAL_STOP_ACTIVE");
  assert.equal(blocked.decision.safeCheckpointRequired, true);
  authorization.clearGlobalStop({
    actor: owner,
    idempotencyKey: "idem-stop-clear",
    reason: "owner-resume"
  });
  assert.equal(dispatch(authorization, "AUTH-STOP-007", "cleared").decision.authorized, true);
});

test("grant and dispatch commands are idempotent, while stale authorization versions fail closed", () => {
  const authorization = engine();
  const firstGrant = grant(authorization, "AUTH-IDEMPOTENT-007");
  const replayGrant = grant(authorization, "AUTH-IDEMPOTENT-007");
  assert.equal(firstGrant.idempotent, false);
  assert.equal(replayGrant.idempotent, true);
  assert.equal(replayGrant.event.eventId, firstGrant.event.eventId);
  assert.throws(
    () => authorization.grant({
      authorizationId: "AUTH-IDEMPOTENT-007",
      mode: "direct",
      entries: [{ stepId: "HERO-007", documentVersion: "v1.0" }],
      operations: ["test"],
      actor: owner,
      idempotencyKey: "idem-grant-AUTH-IDEMPOTENT-007"
    }),
    AuthorizationIdempotencyConflictError
  );
  assert.equal(
    dispatch(authorization, "AUTH-IDEMPOTENT-007", "stale", { expectedVersion: 0 }).decision.code,
    "AUTHORIZATION_VERSION_CONFLICT"
  );
  assert.throws(
    () => authorization.revoke({
      authorizationId: "AUTH-IDEMPOTENT-007",
      actor: owner,
      idempotencyKey: "idem-stale-revoke",
      expectedVersion: 0
    }),
    AuthorizationVersionConflictError
  );
});

test("approved authorization specification stays aligned with the machine contract", () => {
  const specification = fs.readFileSync(
    path.join(REPO_ROOT, "docs", "specs", "HERO-007-v1.0.md"),
    "utf8"
  );
  assert.match(specification, /Snapshot/);
  assert.match(specification, /Global Stop/);
  assert.match(specification, /fail-closed/);
  assert.match(specification, /Audit Trail/);
});
