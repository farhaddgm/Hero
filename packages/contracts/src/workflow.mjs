export const WORKFLOW_CONTRACT_VERSION = "1.0";

export const RUN_STATES = Object.freeze([
  "draft",
  "planned",
  "queued",
  "running",
  "awaiting-review",
  "paused",
  "failed",
  "completed",
  "cancelled"
]);

export const TERMINAL_RUN_STATES = Object.freeze(["completed", "cancelled"]);

export const WORKFLOW_ACTIONS = Object.freeze([
  "plan",
  "queue",
  "start",
  "request-review",
  "approve-review",
  "request-changes",
  "pause",
  "resume",
  "fail",
  "retry",
  "complete",
  "cancel"
]);

export const WORKFLOW_TRANSITIONS = Object.freeze({
  draft: Object.freeze({ plan: "planned", cancel: "cancelled" }),
  planned: Object.freeze({ queue: "queued", pause: "paused", cancel: "cancelled" }),
  queued: Object.freeze({ start: "running", pause: "paused", fail: "failed", cancel: "cancelled" }),
  running: Object.freeze({
    "request-review": "awaiting-review",
    complete: "completed",
    pause: "paused",
    fail: "failed",
    cancel: "cancelled"
  }),
  "awaiting-review": Object.freeze({
    "approve-review": "completed",
    "request-changes": "running",
    pause: "paused",
    fail: "failed",
    cancel: "cancelled"
  }),
  paused: Object.freeze({ resume: "resume-state", cancel: "cancelled" }),
  failed: Object.freeze({ retry: "queued", cancel: "cancelled" }),
  completed: Object.freeze({}),
  cancelled: Object.freeze({})
});

export function getWorkflowContractSummary() {
  return Object.freeze({
    version: WORKFLOW_CONTRACT_VERSION,
    states: RUN_STATES,
    terminalStates: TERMINAL_RUN_STATES,
    actions: WORKFLOW_ACTIONS,
    sourceOfTruth: "append-only-event-log",
    idempotency: "per-run idempotency key with payload fingerprint",
    failurePolicy: "failed runs may retry; terminal runs never transition"
  });
}

export function validateWorkflowContract() {
  const errors = [];
  if (WORKFLOW_CONTRACT_VERSION !== "1.0") errors.push("Unexpected workflow contract version.");
  for (const state of ["draft", "paused", "failed", "completed", "cancelled"]) {
    if (!RUN_STATES.includes(state)) errors.push(`Required state is missing: ${state}.`);
  }
  for (const action of ["pause", "resume", "retry", "request-review", "fail", "cancel"]) {
    if (!WORKFLOW_ACTIONS.includes(action)) errors.push(`Required action is missing: ${action}.`);
  }
  if (WORKFLOW_TRANSITIONS.paused.resume !== "resume-state") {
    errors.push("Paused runs must retain a resumable state.");
  }
  if (Object.keys(WORKFLOW_TRANSITIONS.completed).length !== 0) {
    errors.push("Completed runs must be terminal.");
  }
  return errors;
}
