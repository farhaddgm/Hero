import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getWorkflowContractSummary,
  validateWorkflowContract
} from "../packages/contracts/src/workflow.mjs";
import {
  IdempotencyConflictError,
  InvalidWorkflowTransitionError,
  WorkflowVersionConflictError,
  createWorkflowEngine
} from "../packages/domain/src/workflow-engine.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const actor = Object.freeze({ kind: "orchestrator", id: "hero-control-plane" });

function engine() {
  return createWorkflowEngine({ now: () => "2026-08-14T13:00:00.000Z" });
}

function createRun(workflow, runId = "RUN-006") {
  return workflow.create({
    runId,
    taskId: "TASK-006",
    actor,
    idempotencyKey: `idem-create-${runId}`
  });
}

function transition(workflow, runId, action, suffix, extra = {}) {
  return workflow.apply({
    runId,
    action,
    actor,
    idempotencyKey: `idem-${runId}-${suffix}`,
    ...extra
  });
}

test("workflow contract makes lifecycle, idempotency and terminal states explicit", () => {
  assert.deepEqual(validateWorkflowContract(), []);
  const summary = getWorkflowContractSummary();
  assert.equal(summary.sourceOfTruth, "append-only-event-log");
  assert.ok(summary.states.includes("draft"));
  assert.ok(summary.states.includes("paused"));
  assert.ok(summary.states.includes("cancelled"));
  assert.ok(summary.actions.includes("retry"));
});

test("run flows from draft through review into a terminal completed state", () => {
  const workflow = engine();
  assert.equal(createRun(workflow).workflow.state, "draft");
  assert.equal(transition(workflow, "RUN-006", "plan", "plan").workflow.state, "planned");
  assert.equal(transition(workflow, "RUN-006", "queue", "queue").workflow.state, "queued");
  assert.equal(transition(workflow, "RUN-006", "start", "start").workflow.state, "running");
  assert.equal(
    transition(workflow, "RUN-006", "request-review", "review").workflow.state,
    "awaiting-review"
  );
  assert.equal(
    transition(workflow, "RUN-006", "approve-review", "approve").workflow.state,
    "completed"
  );
  assert.deepEqual(
    workflow.history("RUN-006").map(event => event.type),
    [
      "run.drafted",
      "run.planned",
      "run.queued",
      "run.started",
      "run.review-requested",
      "run.review-approved"
    ]
  );
  assert.throws(
    () => transition(workflow, "RUN-006", "cancel", "late-cancel"),
    InvalidWorkflowTransitionError
  );
});

test("pause and resume preserve the exact safe checkpoint state", () => {
  const workflow = engine();
  createRun(workflow, "RUN-PAUSE");
  transition(workflow, "RUN-PAUSE", "plan", "plan");
  transition(workflow, "RUN-PAUSE", "queue", "queue");
  transition(workflow, "RUN-PAUSE", "start", "start");

  const paused = transition(workflow, "RUN-PAUSE", "pause", "pause");
  assert.equal(paused.workflow.state, "paused");
  assert.equal(paused.workflow.resumeState, "running");

  const resumed = transition(workflow, "RUN-PAUSE", "resume", "resume");
  assert.equal(resumed.workflow.state, "running");
  assert.equal(resumed.workflow.resumeState, null);
});

test("a failed run retries only through queued and counts retries", () => {
  const workflow = engine();
  createRun(workflow, "RUN-RETRY");
  transition(workflow, "RUN-RETRY", "plan", "plan");
  transition(workflow, "RUN-RETRY", "queue", "queue");
  transition(workflow, "RUN-RETRY", "start", "start");
  assert.equal(transition(workflow, "RUN-RETRY", "fail", "fail").workflow.state, "failed");

  const retried = transition(workflow, "RUN-RETRY", "retry", "retry");
  assert.equal(retried.workflow.state, "queued");
  assert.equal(retried.workflow.retryCount, 1);
  assert.equal(retried.event.type, "run.retry-requested");
});

test("same idempotency input replays safely while changed input is rejected", () => {
  const workflow = engine();
  createRun(workflow, "RUN-IDEMPOTENT");
  const command = {
    runId: "RUN-IDEMPOTENT",
    action: "plan",
    actor,
    idempotencyKey: "idem-plan-once",
    reason: "initial planning"
  };
  const first = workflow.apply(command);
  const replay = workflow.apply(command);
  assert.equal(first.idempotent, false);
  assert.equal(replay.idempotent, true);
  assert.equal(replay.event.eventId, first.event.eventId);
  assert.equal(workflow.history("RUN-IDEMPOTENT").length, 2);
  assert.throws(
    () => workflow.apply({ ...command, reason: "different meaning" }),
    IdempotencyConflictError
  );
});

test("stale version and secret-shaped transition data fail closed", () => {
  const workflow = engine();
  createRun(workflow, "RUN-CONFLICT");
  assert.throws(
    () => transition(workflow, "RUN-CONFLICT", "plan", "stale", { expectedVersion: 0 }),
    WorkflowVersionConflictError
  );
  assert.throws(
    () => transition(workflow, "RUN-CONFLICT", "plan", "secret", {
      reason: "Bearer token_should_never_be_logged_123"
    }),
    /sensitive value/
  );
  assert.equal(workflow.get("RUN-CONFLICT").state, "draft");
});

test("approved workflow specification remains aligned with the machine contract", () => {
  const specification = fs.readFileSync(
    path.join(REPO_ROOT, "docs", "specs", "HERO-006-v1.0.md"),
    "utf8"
  );
  assert.match(specification, /State Machine/);
  assert.match(specification, /idempotency/);
  assert.match(specification, /Pause/);
  assert.match(specification, /Retry/);
});
