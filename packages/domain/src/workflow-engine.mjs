import {
  WORKFLOW_ACTIONS,
  WORKFLOW_TRANSITIONS,
  getWorkflowContractSummary
} from "../../contracts/src/workflow.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const EVENT_TYPE_BY_ACTION = Object.freeze({
  create: "run.drafted",
  plan: "run.planned",
  queue: "run.queued",
  start: "run.started",
  "request-review": "run.review-requested",
  "approve-review": "run.review-approved",
  "request-changes": "run.review-changes-requested",
  pause: "run.paused",
  resume: "run.resumed",
  fail: "run.failed",
  retry: "run.retry-requested",
  complete: "run.completed",
  cancel: "run.cancelled"
});

function immutableCopy(value) {
  return Object.freeze(structuredClone(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stableValue(value[key])])
    );
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
  assertIdentifier("actor.id", actor.id);
  assertIdentifier("actor.kind", actor.kind);
}

function assertIdempotencyKey(value) {
  assertIdentifier("idempotencyKey", value);
}

function idempotencyFingerprint(input, action) {
  return fingerprint({
    action,
    actor: { kind: input.actor?.kind, id: input.actor?.id },
    taskId: input.taskId,
    reason: input.reason,
    metadata: input.metadata ?? null
  });
}

function result(workflow, event, idempotent) {
  return Object.freeze({
    workflow: immutableCopy(workflow),
    event: immutableCopy(event),
    idempotent
  });
}

export class InvalidWorkflowTransitionError extends Error {
  constructor({ runId, state, action }) {
    super(`Action ${action} is not allowed while run ${runId} is ${state}.`);
    this.name = "InvalidWorkflowTransitionError";
  }
}

export class WorkflowVersionConflictError extends Error {
  constructor({ runId, expectedVersion, actualVersion }) {
    super(`Run ${runId} version conflict; expected ${expectedVersion}, received ${actualVersion}.`);
    this.name = "WorkflowVersionConflictError";
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class IdempotencyConflictError extends Error {
  constructor({ runId, idempotencyKey }) {
    super(`Idempotency key ${idempotencyKey} was already used with different input for run ${runId}.`);
    this.name = "IdempotencyConflictError";
  }
}

export class WorkflowAlreadyExistsError extends Error {
  constructor(runId) {
    super(`Run ${runId} already exists.`);
    this.name = "WorkflowAlreadyExistsError";
  }
}

export function createWorkflowEngine(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  let nextEvent = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => {
    nextEvent += 1;
    return `evt_workflow_${String(nextEvent).padStart(6, "0")}`;
  });
  const workflows = new Map();
  const idempotency = new Map();

  function idempotencyKey(runId, key) {
    return `${runId}\u0000${key}`;
  }

  function readIdempotent(runId, key, valueFingerprint) {
    const existing = idempotency.get(idempotencyKey(runId, key));
    if (!existing) return null;
    if (existing.fingerprint !== valueFingerprint) {
      throw new IdempotencyConflictError({ runId, idempotencyKey: key });
    }
    return result(existing.workflow, existing.event, true);
  }

  function storeIdempotent(runId, key, valueFingerprint, workflow, event) {
    idempotency.set(idempotencyKey(runId, key), {
      fingerprint: valueFingerprint,
      workflow: immutableCopy(workflow),
      event: immutableCopy(event)
    });
  }

  function appendTransition({ workflow, action, input, toState }) {
    const expectedVersion = input.expectedVersion ?? workflow.version;
    if (expectedVersion !== workflow.version) {
      throw new WorkflowVersionConflictError({
        runId: workflow.runId,
        expectedVersion,
        actualVersion: workflow.version
      });
    }

    const retryCount = action === "retry" ? workflow.retryCount + 1 : workflow.retryCount;
    const reviewCount = action === "request-review" ? workflow.reviewCount + 1 : workflow.reviewCount;
    const resumeState = action === "pause"
      ? workflow.state
      : action === "resume"
        ? null
        : workflow.resumeState;
    const event = createOperationalEvent({
      eventId: input.eventId ?? eventIdFactory(),
      aggregateType: "run",
      aggregateId: workflow.runId,
      type: EVENT_TYPE_BY_ACTION[action],
      occurredAt: input.occurredAt ?? now(),
      actor: input.actor,
      correlationId: input.correlationId ?? workflow.taskId,
      causationId: workflow.lastEventId,
      data: {
        action,
        fromState: workflow.state,
        toState,
        taskId: workflow.taskId,
        retryCount,
        reviewCount,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        ...(input.metadata === undefined ? {} : { metadata: input.metadata })
      }
    });
    const storedEvent = eventLog.append(event, { expectedVersion: workflow.version });
    const nextWorkflow = immutableCopy({
      ...workflow,
      state: toState,
      version: storedEvent.aggregateVersion,
      retryCount,
      reviewCount,
      resumeState,
      lastEventId: storedEvent.eventId,
      lastTransition: action
    });
    workflows.set(workflow.runId, nextWorkflow);
    return { workflow: nextWorkflow, event: storedEvent };
  }

  function create(input) {
    assertIdentifier("runId", input?.runId);
    assertIdentifier("taskId", input?.taskId);
    assertActor(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const inputFingerprint = idempotencyFingerprint(input, "create");
    const replay = readIdempotent(input.runId, input.idempotencyKey, inputFingerprint);
    if (replay) return replay;
    if (workflows.has(input.runId)) throw new WorkflowAlreadyExistsError(input.runId);

    const initial = immutableCopy({
      runId: input.runId,
      taskId: input.taskId,
      state: "draft",
      version: 0,
      retryCount: 0,
      reviewCount: 0,
      resumeState: null,
      lastEventId: null,
      lastTransition: null
    });
    const event = createOperationalEvent({
      eventId: input.eventId ?? eventIdFactory(),
      aggregateType: "run",
      aggregateId: input.runId,
      type: EVENT_TYPE_BY_ACTION.create,
      occurredAt: input.occurredAt ?? now(),
      actor: input.actor,
      correlationId: input.correlationId ?? input.taskId,
      data: { action: "create", toState: "draft", taskId: input.taskId }
    });
    const storedEvent = eventLog.append(event, { expectedVersion: 0 });
    const workflow = immutableCopy({
      ...initial,
      version: storedEvent.aggregateVersion,
      lastEventId: storedEvent.eventId,
      lastTransition: "create"
    });
    workflows.set(input.runId, workflow);
    storeIdempotent(input.runId, input.idempotencyKey, inputFingerprint, workflow, storedEvent);
    return result(workflow, storedEvent, false);
  }

  function apply(input) {
    assertIdentifier("runId", input?.runId);
    assertActor(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    if (!WORKFLOW_ACTIONS.includes(input.action)) throw new Error("action is not supported.");
    const workflow = workflows.get(input.runId);
    if (!workflow) throw new Error(`Run ${input.runId} does not exist.`);
    const inputFingerprint = idempotencyFingerprint(input, input.action);
    const replay = readIdempotent(input.runId, input.idempotencyKey, inputFingerprint);
    if (replay) return replay;

    const configuredTarget = WORKFLOW_TRANSITIONS[workflow.state]?.[input.action];
    if (!configuredTarget) {
      throw new InvalidWorkflowTransitionError({
        runId: input.runId,
        state: workflow.state,
        action: input.action
      });
    }
    const toState = configuredTarget === "resume-state" ? workflow.resumeState : configuredTarget;
    if (!toState) {
      throw new InvalidWorkflowTransitionError({ runId: input.runId, state: workflow.state, action: input.action });
    }
    const transition = appendTransition({ workflow, action: input.action, input, toState });
    storeIdempotent(input.runId, input.idempotencyKey, inputFingerprint, transition.workflow, transition.event);
    return result(transition.workflow, transition.event, false);
  }

  function get(runId) {
    const workflow = workflows.get(runId);
    return workflow ? immutableCopy(workflow) : null;
  }

  function history(runId) {
    return eventLog.readAggregate("run", runId);
  }

  return Object.freeze({
    create,
    apply,
    get,
    history,
    contract: () => getWorkflowContractSummary()
  });
}
