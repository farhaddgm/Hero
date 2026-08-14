export const ASSURANCE_GATE_CONTRACT_VERSION = "1.0";

export const ASSURANCE_GATE_STATES = Object.freeze([
  "evaluating",
  "approved",
  "blocked"
]);

export const ASSURANCE_GATE_DECISION_CODES = Object.freeze([
  "ASSURANCE_READY",
  "ASSURANCE_APPROVED",
  "CI_EVIDENCE_REQUIRED",
  "SECURITY_POLICY_FAILED",
  "OBSERVABILITY_CONTRACT_REQUIRED",
  "BUDGET_CAP_REACHED",
  "EXTERNAL_SPEND_REQUIRES_SEPARATE_AUTHORIZATION",
  "GLOBAL_STOP_ACTIVE",
  "RELEASE_REQUIRES_SEPARATE_AUTHORIZATION"
]);

export const DEFAULT_ASSURANCE_POLICY = Object.freeze({
  maxCostUnits: 100,
  requiredObservabilityEvents: Object.freeze([
    "authorization.dispatch-blocked",
    "quality-gate.approved",
    "run.completed"
  ])
});

export function validateAssuranceGateContract() {
  const errors = [];
  if (ASSURANCE_GATE_CONTRACT_VERSION !== "1.0") errors.push("Assurance Gate contract version is invalid.");
  for (const state of ["evaluating", "approved", "blocked"]) {
    if (!ASSURANCE_GATE_STATES.includes(state)) errors.push(`Required Assurance Gate state is missing: ${state}.`);
  }
  for (const code of ["ASSURANCE_APPROVED", "CI_EVIDENCE_REQUIRED", "SECURITY_POLICY_FAILED", "OBSERVABILITY_CONTRACT_REQUIRED", "BUDGET_CAP_REACHED", "RELEASE_REQUIRES_SEPARATE_AUTHORIZATION"]) {
    if (!ASSURANCE_GATE_DECISION_CODES.includes(code)) errors.push(`Required Assurance Gate decision code is missing: ${code}.`);
  }
  if (DEFAULT_ASSURANCE_POLICY.maxCostUnits < 1) errors.push("Assurance Gate must cap cost units.");
  if (DEFAULT_ASSURANCE_POLICY.requiredObservabilityEvents.length < 3) errors.push("Assurance Gate must require the minimum operational signals.");
  return errors;
}

export function getAssuranceGateContractSummary() {
  return Object.freeze({
    version: ASSURANCE_GATE_CONTRACT_VERSION,
    states: ASSURANCE_GATE_STATES,
    decisionCodes: ASSURANCE_GATE_DECISION_CODES,
    defaultPolicy: DEFAULT_ASSURANCE_POLICY,
    checks: Object.freeze(["CI evidence", "secret-safe security policy", "observability contract", "cost cap"]),
    flow: "exact test authorization -> local CI evidence + security + observability + cost assessment -> approved assurance record -> release only after separate authorization",
    safetyBoundary: "The deterministic gate does not dispatch CI, invoke a provider, export telemetry, mutate a repository, release, deploy, spend money, or retain secrets."
  });
}
