export const HERO_BENCH_CONTRACT_VERSION = "1.0";

export const HERO_BENCH_CATEGORIES = Object.freeze([
  "intake-risk",
  "planning",
  "safety",
  "estimation",
  "persian-writing",
  "code-review",
  "evidence-honesty"
]);

export const HERO_BENCH_CHECK_TYPES = Object.freeze([
  "field-equals",
  "field-in",
  "contains-all",
  "contains-none",
  "max-chars",
  "latin-ratio-max",
  "task-graph",
  "number-within",
  "finding-at-line",
  "must-escalate"
]);

export const HERO_BENCH_RUNNER_KINDS = Object.freeze(["reference", "synthetic", "live"]);

export const HERO_BENCH_METRICS = Object.freeze([
  "successRate",
  "weightedScore",
  "successRateInterval95",
  "byCategory",
  "costUnitsPerSuccess",
  "averageAttempts",
  "reworkRounds",
  "safetyViolations",
  "latencyP50Ms",
  "latencyP95Ms",
  "errorRate"
]);

export function getHeroBenchContractSummary() {
  return Object.freeze({
    version: HERO_BENCH_CONTRACT_VERSION,
    categories: HERO_BENCH_CATEGORIES,
    checkTypes: HERO_BENCH_CHECK_TYPES,
    runnerKinds: HERO_BENCH_RUNNER_KINDS,
    metrics: HERO_BENCH_METRICS,
    mode: "offline-first",
    boundary: "Hero-Bench grades structured outputs with deterministic checks. It never executes model-generated code (execution belongs to the isolated Product Runner) and it never calls a live provider: a live runner is refused unless an external-spend authorization verifier approves it.",
    leakageBoundary: "A runner receives only the public task (id, category, prompt, inputs). Acceptance checks and reference outputs are never sent to a runner.",
    comparisonBoundary: "Two runs are comparable only when they share one dataset digest; the comparison is a paired exact sign test and is advisory, never an authorization."
  });
}

export function validateHeroBenchContract() {
  const errors = [];
  if (HERO_BENCH_CONTRACT_VERSION !== "1.0") errors.push("Unexpected Hero-Bench contract version.");
  for (const kind of ["reference", "synthetic", "live"]) if (!HERO_BENCH_RUNNER_KINDS.includes(kind)) errors.push(`Runner kind ${kind} is missing.`);
  for (const category of ["safety", "intake-risk", "evidence-honesty"]) if (!HERO_BENCH_CATEGORIES.includes(category)) errors.push(`Category ${category} is missing.`);
  if (new Set(HERO_BENCH_CHECK_TYPES).size !== HERO_BENCH_CHECK_TYPES.length) errors.push("Check types must be unique.");
  return Object.freeze(errors);
}
