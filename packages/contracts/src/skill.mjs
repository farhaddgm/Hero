export const SKILL_CONTRACT_VERSION = "1.0";

export const SKILL_STATUSES = Object.freeze(["draft", "active", "disabled", "retired"]);
export const SKILL_SCOPES = Object.freeze(["organization", "team", "role", "task"]);
export const SKILL_TOOL_POLICIES = Object.freeze(["read-only", "development", "owner-gated"]);
export const SKILL_BINDING_STATES = Object.freeze(["active", "superseded", "disabled"]);

export function getSkillContractSummary() {
  return Object.freeze({
    version: SKILL_CONTRACT_VERSION,
    statuses: SKILL_STATUSES,
    scopes: SKILL_SCOPES,
    toolPolicies: SKILL_TOOL_POLICIES,
    bindingStates: SKILL_BINDING_STATES,
    requiredSkillFields: Object.freeze([
      "skillId",
      "name",
      "description",
      "ownerTeamId",
      "inputSchema",
      "outputSchema",
      "allowedTools",
      "benchmarkId",
      "version",
      "status"
    ]),
    bindingModel: "organization -> team -> role -> skill -> profile/provider/model",
    safetyBoundary: "A Skill can constrain context and tools but cannot grant authorization or bypass owner gates."
  });
}

export function validateSkillContract() {
  const errors = [];
  if (SKILL_CONTRACT_VERSION !== "1.0") errors.push("Skill contract version is invalid.");
  if (!SKILL_STATUSES.includes("active") || !SKILL_STATUSES.includes("retired")) errors.push("Skill statuses are incomplete.");
  if (!SKILL_SCOPES.includes("team") || !SKILL_SCOPES.includes("task")) errors.push("Skill scopes are incomplete.");
  if (!SKILL_TOOL_POLICIES.includes("read-only") || !SKILL_TOOL_POLICIES.includes("owner-gated")) errors.push("Skill tool policies are incomplete.");
  if (!SKILL_BINDING_STATES.includes("superseded")) errors.push("Skill binding states must support immutable history.");
  return [...new Set(errors)];
}
