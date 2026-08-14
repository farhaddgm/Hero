import { SENSITIVE_ACTIONS } from "./operational-data.mjs";

export const AUTHORIZATION_CONTRACT_VERSION = "1.0";

export const AUTHORIZATION_MODES = Object.freeze(["direct", "batch-snapshot"]);

export const AUTHORIZATION_STATUSES = Object.freeze(["active", "revoked"]);

export const DEVELOPMENT_OPERATIONS = Object.freeze([
  "design",
  "document",
  "version",
  "develop",
  "test",
  "review",
  "commit"
]);

export const AUTHORIZATION_DECISION_CODES = Object.freeze([
  "AUTHORIZED",
  "GLOBAL_STOP_ACTIVE",
  "AUTHORIZATION_NOT_FOUND",
  "AUTHORIZATION_NOT_ACTIVE",
  "AUTHORIZATION_VERSION_CONFLICT",
  "SNAPSHOT_ENTRY_NOT_FOUND",
  "OPERATION_NOT_GRANTED",
  "SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL"
]);

export function getAuthorizationContractSummary() {
  return Object.freeze({
    version: AUTHORIZATION_CONTRACT_VERSION,
    modes: AUTHORIZATION_MODES,
    statuses: AUTHORIZATION_STATUSES,
    developmentOperations: DEVELOPMENT_OPERATIONS,
    separatelyApprovedOperations: SENSITIVE_ACTIONS,
    decisionCodes: AUTHORIZATION_DECISION_CODES,
    matchingRule: "authorization id + exact step id + exact document version + granted operation",
    globalStop: "blocks new dispatch and requires a safe checkpoint for active runs"
  });
}

export function validateAuthorizationContract() {
  const errors = [];
  if (AUTHORIZATION_CONTRACT_VERSION !== "1.0") errors.push("Unexpected authorization contract version.");
  if (!AUTHORIZATION_MODES.includes("direct") || !AUTHORIZATION_MODES.includes("batch-snapshot")) {
    errors.push("Authorization modes are incomplete.");
  }
  if (DEVELOPMENT_OPERATIONS.some(operation => SENSITIVE_ACTIONS.includes(operation))) {
    errors.push("Development authority must not contain sensitive operations.");
  }
  for (const code of ["GLOBAL_STOP_ACTIVE", "SNAPSHOT_ENTRY_NOT_FOUND", "SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL"]) {
    if (!AUTHORIZATION_DECISION_CODES.includes(code)) errors.push(`Required decision code is missing: ${code}.`);
  }
  return errors;
}
