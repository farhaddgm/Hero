import {
  DEFAULT_RUNNER_LIMITS,
  RUNNER_ACTIONS,
  RUNNER_STATES,
  getRunnerContractSummary
} from "../../contracts/src/runner.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const EVENT_TYPE_BY_ACTION = Object.freeze({
  prepare: "runner.prepared",
  start: "runner.started",
  "request-checkpoint": "runner.checkpoint-requested",
  checkpoint: "runner.checkpointed",
  cancel: "runner.cancelled",
  fail: "runner.failed",
  cleanup: "runner.cleaned"
});

const ACTIVE_STATES = new Set(["prepared", "running", "checkpoint-requested", "checkpointed", "cancelled", "failed"]);

function immutableCopy(value) {
  return Object.freeze(structuredClone(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return JSON.stringify(stableValue(value));
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || value.length < 3 || value.length > 128) {
    throw new Error(`${label} must be a 3-128 character string.`);
  }
}

function assertActor(actor) {
  if (!actor || typeof actor !== "object") throw new Error("actor is required.");
  assertIdentifier("actor.kind", actor.kind);
  assertIdentifier("actor.id", actor.id);
}

function assertIdempotencyKey(value) {
  assertIdentifier("idempotencyKey", value);
}

function assertWorkspaceKey(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith(".hero/worktrees/") ||
    value.includes("\\") ||
    value.includes("..") ||
    !/^[a-zA-Z0-9._/-]+$/.test(value)
  ) {
    throw new Error("workspaceKey must be a safe relative .hero/worktrees path.");
  }
}

function assertBranchName(value) {
  if (typeof value !== "string" || !/^hero\/task\/[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error("branchName must use the hero/task/<id> format.");
  }
}

function assertBaseRef(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._/-]{3,128}$/.test(value) || value.includes("..")) {
    throw new Error("baseRef must be a safe Git ref.");
  }
}

function assertTimeout(value) {
  if (!Number.isInteger(value) || value < 30 || value > 7_200) {
    throw new Error("timeoutSeconds must be an integer between 30 and 7200.");
  }
}

function asDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be an ISO timestamp.`);
  return date;
}

function active(runner) {
  return ACTIVE_STATES.has(runner.state);
}

function commandFingerprint(input, action) {
  return fingerprint({
    action,
    actor: { kind: input.actor?.kind, id: input.actor?.id },
    runId: input.runId,
    taskId: input.taskId,
    stepId: input.stepId,
    documentVersion: input.documentVersion,
    grantId: input.decision?.authorizationId,
    decisionCode: input.decision?.code,
    workspaceKey: input.workspaceKey,
    branchName: input.branchName,
    baseRef: input.baseRef,
    timeoutSeconds: input.timeoutSeconds,
    checkpointId: input.checkpointId,
    summary: input.summary,
    reason: input.reason,
    expectedVersion: input.expectedVersion,
    at: input.at
  });
}

function result(runner, event, idempotent) {
  return Object.freeze({ runner: immutableCopy(runner), event: immutableCopy(event), idempotent });
}

export class RunnerAlreadyExistsError extends Error {
  constructor(runnerId) {
    super(`Runner ${runnerId} already exists.`);
    this.name = "RunnerAlreadyExistsError";
  }
}

export class RunnerVersionConflictError extends Error {
  constructor({ runnerId, expectedVersion, actualVersion }) {
    super(`Runner ${runnerId} version conflict; expected ${expectedVersion}, received ${actualVersion}.`);
    this.name = "RunnerVersionConflictError";
  }
}

export class RunnerIdempotencyConflictError extends Error {
  constructor({ runnerId, idempotencyKey }) {
    super(`Idempotency key ${idempotencyKey} was already used with different input for runner ${runnerId}.`);
    this.name = "RunnerIdempotencyConflictError";
  }
}

export class InvalidRunnerTransitionError extends Error {
  constructor({ runnerId, state, action }) {
    super(`Action ${action} is not allowed while runner ${runnerId} is ${state}.`);
    this.name = "InvalidRunnerTransitionError";
  }
}

export class RunnerAuthorizationError extends Error {
  constructor(code) {
    super(`Runner dispatch is blocked: ${code}.`);
    this.name = "RunnerAuthorizationError";
    this.code = code;
  }
}

export class RunnerConcurrencyError extends Error {
  constructor(code) {
    super(`Runner allocation is blocked: ${code}.`);
    this.name = "RunnerConcurrencyError";
    this.code = code;
  }
}

export function createInMemoryWorktreePort() {
  const workspaces = new Map();

  return Object.freeze({
    prepare(input) {
      if (workspaces.has(input.workspaceKey)) throw new Error(`Workspace ${input.workspaceKey} already exists.`);
      const workspace = immutableCopy({
        workspaceKey: input.workspaceKey,
        branchName: input.branchName,
        baseRef: input.baseRef,
        isolated: true,
        baseRefReadOnly: true,
        network: input.network
      });
      workspaces.set(input.workspaceKey, workspace);
      return workspace;
    },
    cleanup({ workspaceKey }) {
      if (!workspaces.has(workspaceKey)) throw new Error(`Workspace ${workspaceKey} does not exist.`);
      workspaces.delete(workspaceKey);
      return immutableCopy({ workspaceKey, cleaned: true });
    },
    get(workspaceKey) {
      const workspace = workspaces.get(workspaceKey);
      return workspace ? immutableCopy(workspace) : null;
    }
  });
}

export function createIsolatedRunnerEngine(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  const limits = Object.freeze({ ...DEFAULT_RUNNER_LIMITS, ...(options.limits ?? {}) });
  assertTimeout(limits.timeoutSeconds);
  if (!Number.isInteger(limits.maxConcurrentRunners) || limits.maxConcurrentRunners < 1) {
    throw new Error("maxConcurrentRunners must be a positive integer.");
  }
  if (!Number.isInteger(limits.maxConcurrentRunsPerTask) || limits.maxConcurrentRunsPerTask < 1) {
    throw new Error("maxConcurrentRunsPerTask must be a positive integer.");
  }
  if (limits.network !== "disabled" || limits.baseRefReadOnly !== true) {
    throw new Error("Runner limits must keep the network disabled and base ref read-only.");
  }
  const worktreePort = options.worktreePort ?? createInMemoryWorktreePort();
  if (typeof worktreePort.prepare !== "function" || typeof worktreePort.cleanup !== "function") {
    throw new Error("worktreePort must provide prepare and cleanup functions.");
  }

  let nextEvent = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => {
    nextEvent += 1;
    return `evt_runner_${String(nextEvent).padStart(6, "0")}`;
  });
  const runners = new Map();
  const idempotency = new Map();

  function idempotencyScope(runnerId, key) {
    return `${runnerId}\u0000${key}`;
  }

  function replay(runnerId, key, valueFingerprint) {
    const existing = idempotency.get(idempotencyScope(runnerId, key));
    if (!existing) return null;
    if (existing.fingerprint !== valueFingerprint) {
      throw new RunnerIdempotencyConflictError({ runnerId, idempotencyKey: key });
    }
    return result(existing.runner, existing.event, true);
  }

  function remember(runnerId, key, valueFingerprint, runner, event) {
    idempotency.set(idempotencyScope(runnerId, key), {
      fingerprint: valueFingerprint,
      runner: immutableCopy(runner),
      event: immutableCopy(event)
    });
  }

  function validateDecision(decision, runner = null) {
    if (!decision || decision.authorized !== true || decision.code !== "AUTHORIZED") {
      throw new RunnerAuthorizationError(decision?.code ?? "AUTHORIZATION_REQUIRED");
    }
    if (decision.globalStop || decision.safeCheckpointRequired) {
      throw new RunnerAuthorizationError("GLOBAL_STOP_REQUIRES_CHECKPOINT");
    }
    if (runner && (
      decision.stepId !== runner.stepId ||
      decision.documentVersion !== runner.documentVersion ||
      decision.operation !== "develop" ||
      decision.authorizationId !== runner.grantId
    )) {
      throw new RunnerAuthorizationError("AUTHORIZATION_REQUIRED");
    }
  }

  function append({ runner, action, input, state, data = {} }) {
    const expectedVersion = input.expectedVersion ?? runner.version;
    if (expectedVersion !== runner.version) {
      throw new RunnerVersionConflictError({
        runnerId: runner.runnerId,
        expectedVersion,
        actualVersion: runner.version
      });
    }
    const event = createOperationalEvent({
      eventId: input.eventId ?? eventIdFactory(),
      aggregateType: "runner",
      aggregateId: runner.runnerId,
      type: EVENT_TYPE_BY_ACTION[action],
      occurredAt: input.occurredAt ?? now(),
      actor: input.actor,
      correlationId: input.correlationId ?? runner.runId,
      ...(runner.lastEventId ? { causationId: runner.lastEventId } : {}),
      data: {
        action,
        runId: runner.runId,
        taskId: runner.taskId,
        stepId: runner.stepId,
        documentVersion: runner.documentVersion,
        grantId: runner.grantId,
        workspaceKey: runner.workspaceKey,
        fromState: runner.state,
        toState: state,
        ...data
      }
    });
    const storedEvent = eventLog.append(event, { expectedVersion: runner.version });
    const nextRunner = immutableCopy({
      ...runner,
      state,
      version: storedEvent.aggregateVersion,
      lastEventId: storedEvent.eventId,
      lastAction: action,
      ...data
    });
    runners.set(runner.runnerId, nextRunner);
    return { runner: nextRunner, event: storedEvent };
  }

  function activeRunners() {
    return [...runners.values()].filter(active);
  }

  function assertAllocationCapacity(taskId) {
    if (activeRunners().length >= limits.maxConcurrentRunners) {
      throw new RunnerConcurrencyError("RUNNER_CONCURRENCY_LIMIT");
    }
    const forTask = activeRunners().filter(runner => runner.taskId === taskId).length;
    if (forTask >= limits.maxConcurrentRunsPerTask) {
      throw new RunnerConcurrencyError("TASK_CONCURRENCY_LIMIT");
    }
  }

  function prepare(input) {
    assertIdentifier("runnerId", input?.runnerId);
    assertIdentifier("runId", input?.runId);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion);
    assertActor(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    assertWorkspaceKey(input?.workspaceKey);
    assertBranchName(input?.branchName);
    assertBaseRef(input?.baseRef);
    const timeoutSeconds = input.timeoutSeconds ?? limits.timeoutSeconds;
    assertTimeout(timeoutSeconds);
    validateDecision(input.decision);
    if (input.decision.stepId !== input.stepId || input.decision.documentVersion !== input.documentVersion || input.decision.operation !== "develop") {
      throw new RunnerAuthorizationError("AUTHORIZATION_REQUIRED");
    }
    const valueFingerprint = commandFingerprint({ ...input, timeoutSeconds }, "prepare");
    const replayed = replay(input.runnerId, input.idempotencyKey, valueFingerprint);
    if (replayed) return replayed;
    if (runners.has(input.runnerId)) throw new RunnerAlreadyExistsError(input.runnerId);
    assertAllocationCapacity(input.taskId);

    const workspace = worktreePort.prepare({
      workspaceKey: input.workspaceKey,
      branchName: input.branchName,
      baseRef: input.baseRef,
      network: limits.network,
      baseRefReadOnly: limits.baseRefReadOnly
    });
    if (!workspace?.isolated || workspace.workspaceKey !== input.workspaceKey || workspace.baseRefReadOnly !== true) {
      throw new Error("worktreePort did not prove the required isolated workspace boundary.");
    }
    const createdAt = input.occurredAt ?? now();
    const deadlineAt = new Date(asDate(createdAt, "occurredAt").getTime() + timeoutSeconds * 1_000).toISOString();
    const initial = immutableCopy({
      runnerId: input.runnerId,
      runId: input.runId,
      taskId: input.taskId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      grantId: input.decision.authorizationId,
      workspaceKey: input.workspaceKey,
      branchName: input.branchName,
      baseRef: input.baseRef,
      timeoutSeconds,
      deadlineAt,
      network: limits.network,
      state: "prepared",
      version: 0,
      checkpoint: null,
      lastEventId: null,
      lastAction: null
    });
    const created = append({
      runner: initial,
      action: "prepare",
      input: { ...input, timeoutSeconds, occurredAt: createdAt },
      state: "prepared",
      data: { deadlineAt, timeoutSeconds, network: limits.network }
    });
    remember(input.runnerId, input.idempotencyKey, valueFingerprint, created.runner, created.event);
    return result(created.runner, created.event, false);
  }

  function transition(input, action, allowedStates, state, data = {}) {
    assertIdentifier("runnerId", input?.runnerId);
    assertActor(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    if (!RUNNER_ACTIONS.includes(action)) throw new Error("runner action is not supported.");
    const runner = runners.get(input.runnerId);
    if (!runner) throw new Error(`Runner ${input.runnerId} does not exist.`);
    const valueFingerprint = commandFingerprint(input, action);
    const replayed = replay(input.runnerId, input.idempotencyKey, valueFingerprint);
    if (replayed) return replayed;
    if (!allowedStates.includes(runner.state)) {
      throw new InvalidRunnerTransitionError({ runnerId: runner.runnerId, state: runner.state, action });
    }
    const applied = append({ runner, action, input, state, data });
    remember(input.runnerId, input.idempotencyKey, valueFingerprint, applied.runner, applied.event);
    return result(applied.runner, applied.event, false);
  }

  function start(input) {
    const runner = runners.get(input?.runnerId);
    if (runner) validateDecision(input.decision, runner);
    return transition(input, "start", ["prepared"], "running", { startedAt: input.occurredAt ?? now() });
  }

  function requestCheckpoint(input) {
    assertIdentifier("reason", input?.reason);
    return transition(input, "request-checkpoint", ["running"], "checkpoint-requested", {
      checkpointRequestedAt: input.occurredAt ?? now(),
      checkpointReason: input.reason
    });
  }

  function checkpoint(input) {
    assertIdentifier("checkpointId", input?.checkpointId);
    const summary = input.summary === undefined ? null : input.summary;
    if (summary !== null && (typeof summary !== "string" || summary.length > 500)) {
      throw new Error("checkpoint summary must be a string of at most 500 characters.");
    }
    return transition(input, "checkpoint", ["checkpoint-requested"], "checkpointed", {
      checkpoint: immutableCopy({ id: input.checkpointId, summary, recordedAt: input.occurredAt ?? now() })
    });
  }

  function cancel(input) {
    return transition(input, "cancel", ["prepared", "checkpointed"], "cancelled", {
      cancelledAt: input.occurredAt ?? now(),
      cancellationReason: input.reason ?? "owner-request"
    });
  }

  function fail(input) {
    return transition(input, "fail", ["prepared", "running", "checkpoint-requested", "checkpointed"], "failed", {
      failedAt: input.occurredAt ?? now(),
      failureReason: input.reason ?? "runner-failure"
    });
  }

  function cleanup(input) {
    const runner = runners.get(input?.runnerId);
    if (!runner) throw new Error(`Runner ${input?.runnerId} does not exist.`);
    assertActor(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const valueFingerprint = commandFingerprint(input, "cleanup");
    const replayed = replay(input.runnerId, input.idempotencyKey, valueFingerprint);
    if (replayed) return replayed;
    if (!["cancelled", "failed", "checkpointed"].includes(runner.state)) {
      throw new RunnerConcurrencyError("CLEANUP_REQUIRES_SAFE_STATE");
    }
    const expectedVersion = input.expectedVersion ?? runner.version;
    if (expectedVersion !== runner.version) {
      throw new RunnerVersionConflictError({
        runnerId: runner.runnerId,
        expectedVersion,
        actualVersion: runner.version
      });
    }
    const cleanedWorkspace = worktreePort.cleanup({ workspaceKey: runner.workspaceKey });
    if (!cleanedWorkspace?.cleaned || cleanedWorkspace.workspaceKey !== runner.workspaceKey) {
      throw new Error("worktreePort did not confirm cleanup.");
    }
    const applied = append({
      runner,
      action: "cleanup",
      input,
      state: "cleaned",
      data: { cleanedAt: input.occurredAt ?? now() }
    });
    remember(input.runnerId, input.idempotencyKey, valueFingerprint, applied.runner, applied.event);
    return result(applied.runner, applied.event, false);
  }

  function enforceTimeout(input) {
    const runner = runners.get(input?.runnerId);
    if (!runner) throw new Error(`Runner ${input?.runnerId} does not exist.`);
    if (runner.state !== "running") return immutableCopy({ runner, timedOut: false });
    const at = asDate(input?.at ?? now(), "at");
    if (at.getTime() < asDate(runner.deadlineAt, "deadlineAt").getTime()) {
      return immutableCopy({ runner, timedOut: false });
    }
    const failed = fail({
      ...input,
      actor: input.actor ?? { kind: "system", id: "hero-runner-watchdog" },
      idempotencyKey: input.idempotencyKey ?? `timeout-${runner.runnerId}-${runner.version}`,
      occurredAt: at.toISOString(),
      reason: "timeout-exceeded"
    });
    return Object.freeze({ ...failed, timedOut: true, code: "TIMEOUT_EXCEEDED" });
  }

  function get(runnerId) {
    const runner = runners.get(runnerId);
    return runner ? immutableCopy(runner) : null;
  }

  function history(runnerId) {
    return eventLog.readAggregate("runner", runnerId);
  }

  return Object.freeze({
    prepare,
    start,
    requestCheckpoint,
    checkpoint,
    cancel,
    fail,
    cleanup,
    enforceTimeout,
    get,
    history,
    contract: () => getRunnerContractSummary()
  });
}
