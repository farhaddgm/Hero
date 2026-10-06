export const BACKOFFICE_COMMAND_CENTER_CONTRACT_VERSION = "1.1";
export const COMMAND_RISKS = Object.freeze(["low", "medium", "high", "critical"]);
export const COMMAND_STATES = Object.freeze(["draft", "awaiting-approval", "approved", "queued", "running", "paused", "interrupted", "completed", "failed", "compensated", "cancelled", "blocked"]);
export const COMMAND_RECORD_KINDS = Object.freeze(["command", "template", "preauthorization", "scheduler"]);
export const COMMAND_DEFAULT_MAX_ATTEMPTS = 3;
export const COMMAND_DEFAULT_TIMEOUT_MINUTES = 30;

/** BO-075: action taxonomy. A declared risk may never be lower than the action's
 * floor; only taxonomy actions marked directEligible can skip human approval. */
export const COMMAND_ACTIONS = Object.freeze([
  Object.freeze({ action: "refresh-summary", category: "read", minRisk: "low", directEligible: true, sideEffect: "none", compensation: null }),
  Object.freeze({ action: "rebuild-read-model", category: "maintenance", minRisk: "low", directEligible: true, sideEffect: "derived-data", compensation: "rebuild-read-model" }),
  Object.freeze({ action: "run-tests", category: "execution", minRisk: "medium", directEligible: false, sideEffect: "compute", compensation: null }),
  Object.freeze({ action: "change-settings", category: "governance", minRisk: "medium", directEligible: false, sideEffect: "project-state", compensation: "settings-rollback" }),
  Object.freeze({ action: "change-policy", category: "governance", minRisk: "high", directEligible: false, sideEffect: "project-state", compensation: "settings-rollback" }),
  Object.freeze({ action: "deploy-test", category: "delivery", minRisk: "high", directEligible: false, sideEffect: "test-environment", compensation: "test-rollback" }),
  Object.freeze({ action: "deploy-production", category: "delivery", minRisk: "critical", directEligible: false, sideEffect: "production", compensation: "production-rollback" })
]);
const CUSTOM_ACTION = Object.freeze({ category: "custom", minRisk: "medium", directEligible: false, sideEffect: "unknown", compensation: null });

export function riskRank(risk) { return COMMAND_RISKS.indexOf(risk); }
export function actionPolicy(action) {
  const known = COMMAND_ACTIONS.find(item => item.action === action);
  return known ?? Object.freeze({ action, ...CUSTOM_ACTION });
}

export function getBackofficeCommandCenterContractSummary() {
  return Object.freeze({
    version: BACKOFFICE_COMMAND_CENTER_CONTRACT_VERSION,
    risks: COMMAND_RISKS,
    states: COMMAND_STATES,
    actions: COMMAND_ACTIONS,
    customActions: "category custom, minimum risk medium, never direct",
    highRisk: "approval required",
    direct: "only taxonomy actions marked directEligible, at low risk, under a project policy that allows it",
    dispatchGates: ["global-stop", "approval-expiry", "approval-revocation", "policy-snapshot-version", "project-policy-readiness", "production-separate-gate"],
    retry: { maxAttempts: COMMAND_DEFAULT_MAX_ATTEMPTS, timeoutMinutes: COMMAND_DEFAULT_TIMEOUT_MINUTES },
    production: "preauthorization record only; separate deploy gate remains required",
    heavyRunDefault: 2
  });
}

export function validateBackofficeCommandCenterContract() {
  const errors = [];
  if (BACKOFFICE_COMMAND_CENTER_CONTRACT_VERSION !== "1.1") errors.push("Unexpected command center contract version.");
  if (!COMMAND_RISKS.includes("critical")) errors.push("Risk taxonomy must include critical.");
  for (const item of COMMAND_ACTIONS) {
    if (!COMMAND_RISKS.includes(item.minRisk)) errors.push(`${item.action} has an invalid risk floor.`);
    if (item.directEligible && item.minRisk !== "low") errors.push(`${item.action} may only be direct at low risk.`);
  }
  if (COMMAND_ACTIONS.find(item => item.action === "deploy-production")?.directEligible !== false) errors.push("Production deploy can never be direct.");
  return errors;
}
