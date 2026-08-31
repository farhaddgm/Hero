export const QUALITY_GATE_CONTRACT_VERSION = "1.0";

export const QUALITY_GATE_STATES = Object.freeze([
  "awaiting-test",
  "review-ready",
  "fix-required",
  "awaiting-retest",
  "approved",
  "stopped"
]);

export const QUALITY_GATE_DECISION_CODES = Object.freeze([
  "QUALITY_APPROVED",
  "FIX_REQUIRED",
  "CYCLE_LIMIT_REACHED",
  "BUDGET_LIMIT_REACHED",
  "TEST_EVIDENCE_REJECTED",
  "REVIEW_BLOCKED",
  "GLOBAL_STOP_ACTIVE",
  "AI_EVALUATION_APPROVED",
  "AI_EVALUATION_NEEDS_REVISION",
  "AI_EVALUATION_REJECTED"
]);

export const DEFAULT_QUALITY_GATE_POLICY = Object.freeze({
  maxCorrectionCycles: 2,
  maxCostUnits: 100
});

export function validateQualityGateContract() {
  const errors = [];
  if (QUALITY_GATE_CONTRACT_VERSION !== "1.0") errors.push("Quality Gate contract version is invalid.");
  for (const state of ["awaiting-test", "review-ready", "fix-required", "awaiting-retest", "approved", "stopped"]) {
    if (!QUALITY_GATE_STATES.includes(state)) errors.push(`Required Quality Gate state is missing: ${state}.`);
  }
  for (const code of ["QUALITY_APPROVED", "FIX_REQUIRED", "CYCLE_LIMIT_REACHED", "BUDGET_LIMIT_REACHED", "GLOBAL_STOP_ACTIVE"]) {
    if (!QUALITY_GATE_DECISION_CODES.includes(code)) errors.push(`Required Quality Gate decision code is missing: ${code}.`);
  }
  if (DEFAULT_QUALITY_GATE_POLICY.maxCorrectionCycles < 1) errors.push("Quality Gate must cap correction cycles.");
  if (DEFAULT_QUALITY_GATE_POLICY.maxCostUnits < 1) errors.push("Quality Gate must cap cost units.");
  return errors;
}

export function getQualityGateContractSummary() {
  return Object.freeze({
    version: QUALITY_GATE_CONTRACT_VERSION,
    states: QUALITY_GATE_STATES,
    decisionCodes: QUALITY_GATE_DECISION_CODES,
    defaultPolicy: DEFAULT_QUALITY_GATE_POLICY,
    flow: "authorized Codex test evidence -> independent Claude review -> separately authorized correction -> retest",
    evidenceRule: "A success claim requires structured, passing test evidence from an isolated workspace.",
    limitRule: "The gate stops safely before a correction cycle or accounted cost can exceed its approved policy.",
    safetyBoundary: "The deterministic gate does not invoke a provider, mutate a repository, merge, deploy, spend money, or bypass version-bound authorization.",
    asyncBoundary: "An optional AI evaluator may provide schema-validated evidence through reviewAsync; the gate still owns correction limits and authorization boundaries."
  });
}
