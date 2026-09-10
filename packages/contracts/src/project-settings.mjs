export const PROJECT_SETTINGS_CONTRACT_VERSION = "1.0";
export const SETTINGS_LAYERS = Object.freeze(["hero-invariant", "policy-template", "project-override", "run-override"]);
export const POLICY_RISK_LEVELS = Object.freeze(["low", "standard", "high"]);

export function getProjectSettingsContractSummary() {
  return Object.freeze({
    version: PROJECT_SETTINGS_CONTRACT_VERSION,
    layers: SETTINGS_LAYERS,
    precedence: [...SETTINGS_LAYERS].reverse(),
    nonWeakenable: ["security.projectIsolation", "security.auditRetention", "security.secretReferencesOnly"],
    conflictMode: "fail-closed",
    history: "versioned, actor/reason/impact/diff and rollback reference"
  });
}

export function validateProjectSettingsContract() {
  const errors = [];
  if (PROJECT_SETTINGS_CONTRACT_VERSION !== "1.0") errors.push("Unexpected project settings contract version.");
  if (SETTINGS_LAYERS.join(",") !== "hero-invariant,policy-template,project-override,run-override") errors.push("Settings precedence layers are invalid.");
  return errors;
}
