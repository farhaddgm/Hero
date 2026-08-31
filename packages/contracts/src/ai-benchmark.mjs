export const AI_BENCHMARK_CONTRACT_VERSION = "1.0";

export const AI_BENCHMARK_CASES = Object.freeze([
  Object.freeze({ caseId: "structured-analysis", role: "analyst", outputSchema: "analysis-v1" }),
  Object.freeze({ caseId: "evidence-evaluation", role: "evaluator", outputSchema: "evaluation-v1" }),
  Object.freeze({ caseId: "bounded-plan", role: "planner", outputSchema: "plan-v1" }),
  Object.freeze({ caseId: "execution-evidence", role: "executor", outputSchema: "execution-v1" })
]);

export const AI_BENCHMARK_METRICS = Object.freeze([
  "completionRate",
  "schemaPassRate",
  "safetyPassRate",
  "averageLatencyMs",
  "totalCostUnits"
]);

export function getAiBenchmarkContractSummary() {
  return Object.freeze({
    version: AI_BENCHMARK_CONTRACT_VERSION,
    mode: "synthetic-deterministic",
    cases: AI_BENCHMARK_CASES,
    metrics: AI_BENCHMARK_METRICS,
    rule: "Synthetic benchmark results inform routing; they do not authorize provider access, mutation or release."
  });
}

export function validateAiBenchmarkContract() {
  const errors = [];
  if (AI_BENCHMARK_CONTRACT_VERSION !== "1.0") errors.push("AI benchmark contract version is invalid.");
  if (AI_BENCHMARK_CASES.length < 4) errors.push("AI benchmark must cover core role cases.");
  if (AI_BENCHMARK_METRICS.length !== 5) errors.push("AI benchmark metrics are incomplete.");
  return errors;
}
