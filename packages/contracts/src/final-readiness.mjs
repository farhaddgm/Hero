export const FINAL_READINESS_CONTRACT_VERSION = "1.1";
export const READINESS_STATES = Object.freeze(["draft", "ready-for-owner-acceptance", "accepted", "rework-requested"]);
/** BO-159..BO-166: the scenario kinds the final review needs, each backed by a tool run. */
export const READINESS_SCENARIO_KINDS = Object.freeze(["e2e-multi-project", "adversarial-access", "crash-resume", "test-transfer", "traceability-audit", "help-runbook-check"]);
export const READINESS_REQUIRED_SCENARIOS = Object.freeze(["e2e-multi-project", "adversarial-access", "crash-resume", "test-transfer"]);
export const READINESS_EVIDENCE_DIGEST = /^sha256:[a-f0-9]{64}$/;
export const READINESS_RECORD_KINDS = Object.freeze(["migration", "digest", "scenario", "traceability", "review", "acceptance", "pilot", "notion-plan"]);
export const COMPATIBILITY_MAX_DAYS = 180;
export function getFinalReadinessContractSummary() {
  return Object.freeze({ version: FINAL_READINESS_CONTRACT_VERSION, states: READINESS_STATES, scenarioKinds: READINESS_SCENARIO_KINDS, requiredScenarios: READINESS_REQUIRED_SCENARIOS, scenarioEvidence: "tool, tool version, sha256 digest of the raw output and counted checks; pass is derived and a failing run is recorded as failing", compatibilityWindowMaxDays: COMPATIBILITY_MAX_DAYS, ownerAcceptance: "explicit immutable owner record", pilot: "proposal only after acceptance; execution requires a separate authorization" });
}
export function validateFinalReadinessContract() {
  const errors = [];
  if (!READINESS_STATES.includes("accepted")) errors.push("Accepted state is missing.");
  if (!READINESS_REQUIRED_SCENARIOS.every(kind => READINESS_SCENARIO_KINDS.includes(kind))) errors.push("A required scenario is not a known kind.");
  return errors;
}
