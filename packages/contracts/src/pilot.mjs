export const PILOT_CONTRACT_VERSION = "1.0";

export const PILOT_STATES = Object.freeze([
  "intake",
  "approved",
  "running",
  "accepted",
  "blocked"
]);

export const PILOT_ACCEPTANCE_CHECKS = Object.freeze([
  "request-created",
  "owner-approval-path",
  "fake-run-completed",
  "runner-cleaned"
]);

export function getPilotContractSummary() {
  return Object.freeze({
    version: PILOT_CONTRACT_VERSION,
    states: PILOT_STATES,
    acceptanceChecks: PILOT_ACCEPTANCE_CHECKS,
    dryRunMode: "deterministic-no-network",
    decisionBoundary: "pilot evidence informs owner decision; it does not authorize provider access, spend or production deployment"
  });
}

export function validatePilotContract() {
  const errors = [];
  if (PILOT_CONTRACT_VERSION !== "1.0") errors.push("Pilot contract version is invalid.");
  if (PILOT_STATES.length !== new Set(PILOT_STATES).size) errors.push("Pilot states must be unique.");
  if (PILOT_ACCEPTANCE_CHECKS.length !== new Set(PILOT_ACCEPTANCE_CHECKS).size) errors.push("Pilot acceptance checks must be unique.");
  if (!PILOT_STATES.includes("blocked") || !PILOT_STATES.includes("accepted")) errors.push("Pilot must have blocked and accepted states.");
  return errors;
}
