export const ORGANIZATION_ADVISOR_CONTRACT_VERSION = "1.0";

export const ORGANIZATION_ADVISOR_PIPELINE_ROLES = Object.freeze([
  "analyst",
  "evaluator",
  "decision-maker",
  "planner",
  "researcher"
]);

export const ORGANIZATION_ADVISOR_STATES = Object.freeze(["advisory", "needs-evidence", "ready"]);

export function getOrganizationAdvisorContractSummary() {
  return Object.freeze({
    version: ORGANIZATION_ADVISOR_CONTRACT_VERSION,
    outputSchema: "organization-advisor-v1",
    pipelineRoles: ORGANIZATION_ADVISOR_PIPELINE_ROLES,
    states: ORGANIZATION_ADVISOR_STATES,
    inputs: Object.freeze(["organization snapshot", "eleven team performance evidence records", "owner question", "risks", "prior decisions"]),
    outputs: Object.freeze(["status", "findings", "options", "recommendation", "roadmap", "trainingActions", "uncertainty", "evidence"]),
    decisionBoundary: "advisory-only; no dispatch, authorization, mutation or deployment",
    researcherRule: "Researcher is conditional and is used only when the owner requests research or evidence is insufficient."
  });
}

export function validateOrganizationAdvisorContract() {
  const errors = [];
  if (ORGANIZATION_ADVISOR_CONTRACT_VERSION !== "1.0") errors.push("Organization advisor contract version is invalid.");
  if (ORGANIZATION_ADVISOR_PIPELINE_ROLES.length !== 5 || !ORGANIZATION_ADVISOR_PIPELINE_ROLES.includes("planner")) errors.push("Advisor pipeline roles are incomplete.");
  if (!ORGANIZATION_ADVISOR_STATES.includes("advisory") || !ORGANIZATION_ADVISOR_STATES.includes("needs-evidence")) errors.push("Advisor states are incomplete.");
  return errors;
}
