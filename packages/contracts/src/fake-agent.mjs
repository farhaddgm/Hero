export const FAKE_AGENT_CONTRACT_VERSION = "1.0";

export const FAKE_AGENT_SCENARIOS = Object.freeze([
  "success",
  "review-changes",
  "failure-then-retry",
  "pause-resume"
]);

export const FAKE_AGENT_OUTCOMES = Object.freeze([
  "completed",
  "review-changes-requested",
  "failed",
  "checkpoint-ready"
]);

export function getFakeAgentContractSummary() {
  return Object.freeze({
    version: FAKE_AGENT_CONTRACT_VERSION,
    scenarios: FAKE_AGENT_SCENARIOS,
    outcomes: FAKE_AGENT_OUTCOMES,
    determinism: "identical scenario, run, attempt and idempotency input returns the identical scripted result",
    providerBoundary: "no network, credentials, provider CLI, model request or repository mutation",
    orchestrationCoverage: "success, review changes, failure plus retry, safe pause plus resume, and human approval"
  });
}

export function validateFakeAgentContract() {
  const errors = [];
  if (FAKE_AGENT_CONTRACT_VERSION !== "1.0") errors.push("Unexpected fake agent contract version.");
  for (const scenario of ["success", "review-changes", "failure-then-retry", "pause-resume"]) {
    if (!FAKE_AGENT_SCENARIOS.includes(scenario)) errors.push(`Required fake agent scenario is missing: ${scenario}.`);
  }
  for (const outcome of ["completed", "review-changes-requested", "failed", "checkpoint-ready"]) {
    if (!FAKE_AGENT_OUTCOMES.includes(outcome)) errors.push(`Required fake agent outcome is missing: ${outcome}.`);
  }
  return errors;
}
