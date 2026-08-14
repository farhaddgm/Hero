import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getRunnerContractSummary,
  validateRunnerContract
} from "../packages/contracts/src/runner.mjs";
import {
  InvalidRunnerTransitionError,
  RunnerAuthorizationError,
  RunnerConcurrencyError,
  RunnerIdempotencyConflictError,
  RunnerVersionConflictError,
  createInMemoryWorktreePort,
  createIsolatedRunnerEngine
} from "../packages/domain/src/runner-engine.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const owner = Object.freeze({ kind: "project-owner", id: "hero-owner" });
const orchestrator = Object.freeze({ kind: "orchestrator", id: "hero-control-plane" });

function decision(overrides = {}) {
  return Object.freeze({
    authorized: true,
    code: "AUTHORIZED",
    authorizationId: "AUTH-BATCH-20260814-001-HERO-008",
    stepId: "HERO-008",
    documentVersion: "v1.0",
    operation: "develop",
    globalStop: false,
    safeCheckpointRequired: false,
    ...overrides
  });
}

function engine(options = {}) {
  return createIsolatedRunnerEngine({
    now: () => "2026-08-14T15:00:00.000Z",
    ...options
  });
}

function prepare(runner, runnerId = "RUNNER-008", overrides = {}) {
  return runner.prepare({
    runnerId,
    runId: "RUN-008",
    taskId: "TASK-008",
    stepId: "HERO-008",
    documentVersion: "v1.0",
    decision: decision(),
    workspaceKey: `.hero/worktrees/${runnerId.toLowerCase()}`,
    branchName: `hero/task/${runnerId.toLowerCase()}`,
    baseRef: "main",
    actor: orchestrator,
    idempotencyKey: `idem-prepare-${runnerId}`,
    ...overrides
  });
}

function transition(runner, runnerId, action, suffix, extra = {}) {
  return runner[action]({
    runnerId,
    actor: action === "cancel" ? owner : orchestrator,
    idempotencyKey: `idem-${action}-${runnerId}-${suffix}`,
    ...extra
  });
}

test("runner contract keeps isolation, limits and checkpoints explicit", () => {
  assert.deepEqual(validateRunnerContract(), []);
  const summary = getRunnerContractSummary();
  assert.equal(summary.defaultLimits.network, "disabled");
  assert.equal(summary.defaultLimits.maxConcurrentRunners, 1);
  assert.ok(summary.states.includes("checkpointed"));
  assert.ok(summary.actions.includes("request-checkpoint"));
});

test("runner prepare and start require an exact authorized dispatch decision", () => {
  const runner = engine();
  assert.throws(
    () => prepare(runner, "RUNNER-BLOCKED", { decision: decision({ authorized: false, code: "GLOBAL_STOP_ACTIVE" }) }),
    RunnerAuthorizationError
  );
  const prepared = prepare(runner);
  assert.equal(prepared.runner.state, "prepared");
  assert.equal(prepared.runner.network, "disabled");
  assert.equal(prepared.runner.workspaceKey, ".hero/worktrees/runner-008");

  assert.throws(
    () => transition(runner, "RUNNER-008", "start", "stopped", { decision: decision({ globalStop: true, safeCheckpointRequired: true }) }),
    RunnerAuthorizationError
  );
  const started = transition(runner, "RUNNER-008", "start", "exact", { decision: decision() });
  assert.equal(started.runner.state, "running");
});

test("worktree ownership is isolated per task and path traversal is rejected", () => {
  const runner = engine({ limits: { maxConcurrentRunners: 2 } });
  assert.throws(
    () => prepare(runner, "RUNNER-UNSAFE", { workspaceKey: "../other-project" }),
    /safe relative/
  );
  prepare(runner, "RUNNER-TASK-ONE");
  assert.throws(
    () => prepare(runner, "RUNNER-TASK-TWO", { workspaceKey: ".hero/worktrees/runner-task-two" }),
    RunnerConcurrencyError
  );
});

test("a running runner checkpoints before cancellation and cleanup", () => {
  const worktreePort = createInMemoryWorktreePort();
  const runner = engine({ worktreePort });
  prepare(runner);
  transition(runner, "RUNNER-008", "start", "start", { decision: decision() });
  assert.throws(
    () => transition(runner, "RUNNER-008", "cancel", "too-early"),
    InvalidRunnerTransitionError
  );

  const requested = transition(runner, "RUNNER-008", "requestCheckpoint", "stop", { reason: "global-stop" });
  assert.equal(requested.runner.state, "checkpoint-requested");
  const checkpointed = transition(runner, "RUNNER-008", "checkpoint", "safe", {
    checkpointId: "CHECKPOINT-008",
    summary: "tests complete"
  });
  assert.equal(checkpointed.runner.checkpoint.id, "CHECKPOINT-008");
  assert.equal(transition(runner, "RUNNER-008", "cancel", "owner").runner.state, "cancelled");
  assert.equal(transition(runner, "RUNNER-008", "cleanup", "clean").runner.state, "cleaned");
  assert.equal(worktreePort.get(".hero/worktrees/runner-008"), null);
  assert.deepEqual(
    runner.history("RUNNER-008").map(event => event.type),
    ["runner.prepared", "runner.started", "runner.checkpoint-requested", "runner.checkpointed", "runner.cancelled", "runner.cleaned"]
  );
});

test("timeout fails a running runner and permits safe cleanup", () => {
  const runner = engine({ limits: { timeoutSeconds: 30 } });
  prepare(runner, "RUNNER-TIMEOUT", { occurredAt: "2026-08-14T15:00:00.000Z", timeoutSeconds: 30 });
  transition(runner, "RUNNER-TIMEOUT", "start", "start", { decision: decision(), occurredAt: "2026-08-14T15:00:01.000Z" });
  assert.equal(
    runner.enforceTimeout({
      runnerId: "RUNNER-TIMEOUT",
      actor: { kind: "system", id: "hero-runner-watchdog" },
      idempotencyKey: "idem-timeout",
      at: "2026-08-14T15:00:29.000Z"
    }).timedOut,
    false
  );
  const timedOut = runner.enforceTimeout({
    runnerId: "RUNNER-TIMEOUT",
    actor: { kind: "system", id: "hero-runner-watchdog" },
    idempotencyKey: "idem-timeout-final",
    at: "2026-08-14T15:00:30.000Z"
  });
  assert.equal(timedOut.timedOut, true);
  assert.equal(timedOut.runner.state, "failed");
  assert.equal(timedOut.code, "TIMEOUT_EXCEEDED");
  assert.equal(transition(runner, "RUNNER-TIMEOUT", "cleanup", "clean").runner.state, "cleaned");
});

test("runner commands are idempotent and stale writes fail closed", () => {
  const runner = engine();
  const first = prepare(runner);
  const replay = prepare(runner);
  assert.equal(first.idempotent, false);
  assert.equal(replay.idempotent, true);
  assert.equal(replay.event.eventId, first.event.eventId);
  assert.throws(
    () => prepare(runner, "RUNNER-008", { timeoutSeconds: 60 }),
    RunnerIdempotencyConflictError
  );
  assert.throws(
    () => transition(runner, "RUNNER-008", "start", "stale", { decision: decision(), expectedVersion: 0 }),
    RunnerVersionConflictError
  );
});

test("approved runner specification stays aligned with the machine contract", () => {
  const specification = fs.readFileSync(
    path.join(REPO_ROOT, "docs", "specs", "HERO-008-v1.0.md"),
    "utf8"
  );
  assert.match(specification, /Git Worktree/);
  assert.match(specification, /checkpoint/);
  assert.match(specification, /timeout/);
  assert.match(specification, /fail-closed/);
});
