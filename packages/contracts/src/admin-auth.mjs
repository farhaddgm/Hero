export const ADMIN_AUTH_CONTRACT_VERSION = "1.0";

export const ADMIN_AUTH_DECISIONS = Object.freeze([
  "ADMIN_AUTHENTICATED",
  "ADMIN_AUTH_REQUIRED",
  "ADMIN_AUTH_NOT_CONFIGURED",
  "ADMIN_AUTH_INVALID",
  "ADMIN_AUTH_EXPIRED",
  "ADMIN_AUTH_REVOKED",
  "ADMIN_SCOPE_FORBIDDEN"
]);

export const ADMIN_AUTH_ROLE = "admin";

export const ADMIN_AUTH_ALLOWED_MUTATIONS = Object.freeze([
  "ai.provider-register",
  "ai.model-register",
  "ai.profile-register",
  "ai.binding-create",
  "ai.skill-register",
  "ai.skill-binding-create",
  "ai.role-policy-update",
  "ai.role-policy-rollback",
  "team.principles-edit",
  "team.principles-rollback"
]);

export function getAdminAuthContractSummary() {
  return Object.freeze({
    version: ADMIN_AUTH_CONTRACT_VERSION,
    scheme: "signed bearer session",
    roles: Object.freeze([ADMIN_AUTH_ROLE]),
    decisions: ADMIN_AUTH_DECISIONS,
    allowedMutations: ADMIN_AUTH_ALLOWED_MUTATIONS,
    readBoundary: "admin may read authenticated read models",
    mutationBoundary: "admin may change the explicit AI catalog surfaces and draft team principles; owner remains required for final team approval, project, release and operational decisions",
    failClosed: true,
    secretBoundary: "admin session signing secret is runtime configuration only and never logged or stored in repository"
  });
}

export function validateAdminAuthContract() {
  const errors = [];
  if (ADMIN_AUTH_CONTRACT_VERSION !== "1.0") errors.push("Unexpected admin auth contract version.");
  if (ADMIN_AUTH_ROLE !== "admin") errors.push("Admin role must be admin.");
  if (!ADMIN_AUTH_ALLOWED_MUTATIONS.includes("ai.role-policy-update")) errors.push("Admin AI policy mutation must be explicit.");
  if (!ADMIN_AUTH_ALLOWED_MUTATIONS.includes("team.principles-edit") || !ADMIN_AUTH_ALLOWED_MUTATIONS.includes("team.principles-rollback")) errors.push("Admin team principle editing must be explicit.");
  if (ADMIN_AUTH_ALLOWED_MUTATIONS.includes("production-deploy")) errors.push("Admin must not implicitly receive production deployment authority.");
  return errors;
}
