export const PLANNER_CONTRACT_VERSION = "1.0";

export const PLANNER_STATES = Object.freeze([
  "ready",
  "needs-clarification",
  "blocked",
  "halted"
]);

export const PLANNER_TASK_KINDS = Object.freeze([
  "analysis",
  "architecture",
  "implementation",
  "testing",
  "review",
  "handoff"
]);

export const PLANNER_ROUTER_PROVIDERS = Object.freeze([
  "chatgpt",
  "codex",
  "claude",
  "cursor"
]);

export const PLANNER_DECISION_CODES = Object.freeze([
  "PLAN_READY",
  "CONTEXT_NOT_READY",
  "GRAPH_HALTED"
]);

export function validatePlannerContract() {
  const errors = [];
  if (PLANNER_CONTRACT_VERSION !== "1.0") errors.push("Planner contract version is invalid.");
  if (!PLANNER_STATES.includes("halted")) errors.push("Planner must provide a halted state.");
  if (!PLANNER_TASK_KINDS.includes("review")) errors.push("Planner must include independent review.");
  if (JSON.stringify(PLANNER_ROUTER_PROVIDERS) !== JSON.stringify(["chatgpt", "codex", "claude", "cursor"])) {
    errors.push("Planner router must stay scoped to the initial three tools.");
  }
  return errors;
}

export function getPlannerContractSummary() {
  return Object.freeze({
    version: PLANNER_CONTRACT_VERSION,
    states: PLANNER_STATES,
    taskKinds: PLANNER_TASK_KINDS,
    providers: PLANNER_ROUTER_PROVIDERS,
    decisionCodes: PLANNER_DECISION_CODES,
    input: "simple Persian product request + optional read-only project context",
    output: "versioned spec, explicit assumptions, acceptance criteria, valid Task Graph and explained provider routing",
    routerRule: "ChatGPT analyzes and designs; Codex implements and tests; Claude independently reviews; Cursor receives only a human-controlled handoff.",
    safetyBoundary: "planning is deterministic and read-only; it does not invoke providers, create runners, merge code, spend money, or bypass version-bound authorization.",
    stopRule: "a planned graph can be halted before dispatch; a halted graph emits no new runnable task"
  });
}
