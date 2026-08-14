export const RUNNER_CONTRACT_VERSION = "1.0";

export const RUNNER_STATES = Object.freeze([
  "prepared",
  "running",
  "checkpoint-requested",
  "checkpointed",
  "cancelled",
  "failed",
  "cleaned"
]);

export const RUNNER_ACTIONS = Object.freeze([
  "prepare",
  "start",
  "request-checkpoint",
  "checkpoint",
  "cancel",
  "fail",
  "cleanup"
]);

export const RUNNER_DECISION_CODES = Object.freeze([
  "RUNNER_PREPARED",
  "RUNNER_STARTED",
  "CHECKPOINT_REQUIRED",
  "CHECKPOINT_RECORDED",
  "RUNNER_CANCELLED",
  "RUNNER_CLEANED",
  "AUTHORIZATION_REQUIRED",
  "GLOBAL_STOP_REQUIRES_CHECKPOINT",
  "TASK_CONCURRENCY_LIMIT",
  "RUNNER_CONCURRENCY_LIMIT",
  "TIMEOUT_EXCEEDED",
  "CLEANUP_REQUIRES_SAFE_STATE"
]);

export const DEFAULT_RUNNER_LIMITS = Object.freeze({
  maxConcurrentRunners: 1,
  maxConcurrentRunsPerTask: 1,
  timeoutSeconds: 1_800,
  network: "disabled",
  baseRefReadOnly: true,
  workspaceRoot: ".hero/worktrees"
});

export function getRunnerContractSummary() {
  return Object.freeze({
    version: RUNNER_CONTRACT_VERSION,
    states: RUNNER_STATES,
    actions: RUNNER_ACTIONS,
    decisionCodes: RUNNER_DECISION_CODES,
    defaultLimits: DEFAULT_RUNNER_LIMITS,
    authorizationBoundary: "exact authorization decision must be authorized before prepare and start",
    worktreeBoundary: "relative workspace key only; base ref remains read-only",
    cancellationBoundary: "a running runner must checkpoint before cancellation and cleanup"
  });
}

export function validateRunnerContract() {
  const errors = [];
  if (RUNNER_CONTRACT_VERSION !== "1.0") errors.push("Unexpected runner contract version.");
  for (const state of ["prepared", "checkpoint-requested", "checkpointed", "cleaned"]) {
    if (!RUNNER_STATES.includes(state)) errors.push(`Required runner state is missing: ${state}.`);
  }
  for (const action of ["request-checkpoint", "checkpoint", "cleanup"]) {
    if (!RUNNER_ACTIONS.includes(action)) errors.push(`Required runner action is missing: ${action}.`);
  }
  if (DEFAULT_RUNNER_LIMITS.network !== "disabled") errors.push("Runner network must default to disabled.");
  if (!DEFAULT_RUNNER_LIMITS.baseRefReadOnly) errors.push("Runner base ref must default to read-only.");
  return errors;
}
