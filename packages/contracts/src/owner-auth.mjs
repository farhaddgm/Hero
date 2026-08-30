export const OWNER_AUTH_CONTRACT_VERSION = "1.0";

export const OWNER_AUTH_DECISIONS = Object.freeze([
  "OWNER_AUTHENTICATED",
  "OWNER_AUTH_REQUIRED",
  "OWNER_AUTH_NOT_CONFIGURED",
  "OWNER_AUTH_INVALID",
  "OWNER_AUTH_EXPIRED"
]);

export const OWNER_AUTH_ROLES = Object.freeze(["project-owner"]);

export function getOwnerAuthContractSummary() {
  return Object.freeze({
    version: OWNER_AUTH_CONTRACT_VERSION,
    scheme: "signed bearer session",
    roles: OWNER_AUTH_ROLES,
    decisions: OWNER_AUTH_DECISIONS,
    protectedSurface: "back-office API mutations and operational read models",
    failClosed: true,
    secretBoundary: "session signing secret is runtime configuration only and never logged or stored in repository"
  });
}

export function validateOwnerAuthContract() {
  const errors = [];
  if (OWNER_AUTH_CONTRACT_VERSION !== "1.0") errors.push("Unexpected owner auth contract version.");
  for (const decision of ["OWNER_AUTHENTICATED", "OWNER_AUTH_REQUIRED", "OWNER_AUTH_NOT_CONFIGURED", "OWNER_AUTH_INVALID", "OWNER_AUTH_EXPIRED"]) {
    if (!OWNER_AUTH_DECISIONS.includes(decision)) errors.push(`Required owner auth decision is missing: ${decision}.`);
  }
  if (!OWNER_AUTH_ROLES.includes("project-owner")) errors.push("project-owner role is required.");
  return errors;
}
