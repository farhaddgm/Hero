import { TEAM_APPROVAL_MODES, TEAM_CATALOG } from "./team.mjs";

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

export const PLANNER_TEAM_ROUTES = Object.freeze({
  analysis: Object.freeze({ owner: "tahlilgoro", collaborators: Object.freeze(["ideh-pardazo", "dadeo"]), stage: "discovery", approvalMode: "gate-only" }),
  architecture: Object.freeze({ owner: "memaro", collaborators: Object.freeze(["designero", "aminto"]), stage: "architecture", approvalMode: "gate-only" }),
  implementation: Object.freeze({ owner: "developero", collaborators: Object.freeze(["mahsulo", "designero", "dadeo"]), stage: "implementation", approvalMode: "gate-only" }),
  testing: Object.freeze({ owner: "testero", collaborators: Object.freeze(["aminto", "developero"]), stage: "quality", approvalMode: "gate-only" }),
  review: Object.freeze({ owner: "aminto", collaborators: Object.freeze(["testero", "rahbaro"]), stage: "quality", approvalMode: "every-step" }),
  handoff: Object.freeze({ owner: "rahbaro", collaborators: Object.freeze(["mahsulo", "amaliyato"]), stage: "delivery", approvalMode: "gate-only" })
});

export function validatePlannerContract() {
  const errors = [];
  if (PLANNER_CONTRACT_VERSION !== "1.0") errors.push("Planner contract version is invalid.");
  if (!PLANNER_STATES.includes("halted")) errors.push("Planner must provide a halted state.");
  if (!PLANNER_TASK_KINDS.includes("review")) errors.push("Planner must include independent review.");
  if (JSON.stringify(PLANNER_ROUTER_PROVIDERS) !== JSON.stringify(["chatgpt", "codex", "claude", "cursor"])) {
    errors.push("Planner router must stay scoped to the initial three tools.");
  }
  const knownTeams = new Set(TEAM_CATALOG.map(team => team.teamId));
  const routedTeams = new Set();
  for (const [kind, route] of Object.entries(PLANNER_TEAM_ROUTES)) {
    if (!knownTeams.has(route.owner)) errors.push(`Planner team owner is unknown for ${kind}.`);
    routedTeams.add(route.owner);
    for (const collaborator of route.collaborators) {
      if (!knownTeams.has(collaborator)) errors.push(`Planner collaborator is unknown for ${kind}.`);
      routedTeams.add(collaborator);
    }
    if (!TEAM_APPROVAL_MODES.includes(route.approvalMode)) errors.push(`Planner approval mode is invalid for ${kind}.`);
  }
  for (const team of knownTeams) if (!routedTeams.has(team)) errors.push(`Planner does not route any task to ${team}.`);
  return errors;
}

export function getPlannerContractSummary() {
  return Object.freeze({
    version: PLANNER_CONTRACT_VERSION,
    states: PLANNER_STATES,
    taskKinds: PLANNER_TASK_KINDS,
    providers: PLANNER_ROUTER_PROVIDERS,
    teamRoutes: PLANNER_TEAM_ROUTES,
    decisionCodes: PLANNER_DECISION_CODES,
    input: "simple Persian product request + optional read-only project context",
    output: "versioned spec, explicit assumptions, acceptance criteria, valid Task Graph and explained provider routing",
    routerRule: "ChatGPT analyzes and designs; Codex implements and tests; Claude independently reviews; Cursor receives only a human-controlled handoff. Every task also has a team owner and explicit collaborators.",
    safetyBoundary: "planning is deterministic and read-only; it does not invoke providers, create runners, merge code, spend money, or bypass version-bound authorization.",
    stopRule: "a planned graph can be halted before dispatch; a halted graph emits no new runnable task"
  });
}
