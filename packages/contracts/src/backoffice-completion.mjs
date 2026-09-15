export const BACKOFFICE_COMPLETION_CONTRACT_VERSION = "1.0";

export const COMPLETION_ROLES = Object.freeze(["project-owner", "admin", "viewer"]);
export const COMPLETION_LOCALES = Object.freeze(["fa", "en"]);
export const COMPLETION_SETTING_LAYERS = Object.freeze(["hero", "project", "team", "role", "model", "task", "conversation"]);
export const COMPLETION_EVIDENCE_KINDS = Object.freeze([
  "accessibility", "security", "load", "backup-restore", "role-isolation", "traceability", "portability", "retention"
]);

export const COMPLETION_CAPABILITIES = Object.freeze({
  "project-owner": Object.freeze(["read", "write", "manage-users", "manage-secrets", "production", "accept-output"]),
  admin: Object.freeze(["read", "write", "manage-secrets", "production", "accept-output"]),
  viewer: Object.freeze(["read"])
});

export function getBackofficeCompletionContractSummary() {
  return Object.freeze({
    version: BACKOFFICE_COMPLETION_CONTRACT_VERSION,
    roles: COMPLETION_ROLES,
    locales: COMPLETION_LOCALES,
    settingLayers: COMPLETION_SETTING_LAYERS,
    evidenceKinds: COMPLETION_EVIDENCE_KINDS,
    externalOperations: "separately-gated"
  });
}

export function validateBackofficeCompletionContract() {
  const errors = [];
  if (COMPLETION_ROLES.length !== 3) errors.push("Exactly three base Back Office roles are required.");
  if (!COMPLETION_LOCALES.includes("fa") || !COMPLETION_LOCALES.includes("en")) errors.push("Persian and English locales are required.");
  if (COMPLETION_CAPABILITIES.viewer.includes("write")) errors.push("Viewer must remain read-only.");
  return errors;
}
