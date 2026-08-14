export const PROJECT_MEMORY_CONTRACT_VERSION = "1.0";

export const PROJECT_MEMORY_KINDS = Object.freeze([
  "rule",
  "architecture",
  "decision",
  "evidence",
  "artifact"
]);

export const PROJECT_MEMORY_RECIPIENT_ROLES = Object.freeze([
  "planner",
  "implementer",
  "reviewer",
  "cursor"
]);

export const PROJECT_MEMORY_SCOPES = Object.freeze(["project", "task"]);
export const PROJECT_MEMORY_STATUSES = Object.freeze(["approved", "evidence"]);
export const PROJECT_CONTEXT_STATES = Object.freeze(["ready", "blocked"]);

export function validateProjectMemoryContract() {
  const errors = [];
  if (PROJECT_MEMORY_CONTRACT_VERSION !== "1.0") errors.push("Project memory contract version is invalid.");
  if (PROJECT_MEMORY_KINDS.length !== 5) errors.push("Project memory kinds are incomplete.");
  if (!PROJECT_MEMORY_RECIPIENT_ROLES.includes("reviewer")) errors.push("Reviewer context role is required.");
  if (!PROJECT_MEMORY_STATUSES.includes("approved")) errors.push("Approved memory status is required.");
  return errors;
}

export function getProjectMemoryContractSummary() {
  return Object.freeze({
    version: PROJECT_MEMORY_CONTRACT_VERSION,
    recordKinds: PROJECT_MEMORY_KINDS,
    recipientRoles: PROJECT_MEMORY_RECIPIENT_ROLES,
    scopes: PROJECT_MEMORY_SCOPES,
    states: PROJECT_CONTEXT_STATES,
    sourceOfTruth: "versioned-append-only-memory",
    selectionRule: "latest eligible record per memory key + exact Task/Step/document version",
    minimization: "role-filtered and bounded context packets",
    safetyBoundary: "read-only packets; secrets, host paths, and external references are rejected"
  });
}
