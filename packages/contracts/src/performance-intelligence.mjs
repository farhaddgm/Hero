export const PERFORMANCE_INTELLIGENCE_CONTRACT_VERSION = "1.1";
/** BO-099: one usage event shape. totalTokens = inputTokens + cachedTokens + outputTokens. */
export const USAGE_EVENT_FIELDS = Object.freeze(["inputTokens", "cachedTokens", "outputTokens", "totalTokens"]);
export const USAGE_SCOPES = Object.freeze(["project", "team", "role", "task", "run", "model", "provider", "invocation"]);
/** Usage is recorded from internal events or synthetic fixtures only; no live Provider is called. */
export const USAGE_SOURCES = Object.freeze(["recorded", "synthetic", "imported"]);
export const HEALTH_STATUSES = Object.freeze(["unknown", "healthy", "degraded", "critical"]);
export const EVALUATION_METHODS = Object.freeze(["deterministic", "human", "ai"]);
export const FEEDBACK_SUBJECTS = Object.freeze(["milestone", "release", "output"]);
export const CRITICAL_OVERRIDE_KINDS = Object.freeze(["outage", "vulnerability", "isolation", "cap-breach", "manual"]);
export const RESERVATION_TTL_MINUTES = 15;

/** BO-105/106: scorecard weights per work type; risk raises the weight of errors and rework. */
export const WORK_TYPE_WEIGHTS = Object.freeze({
  research: Object.freeze({ goalFit: 0.5, efficiency: 0.2, quality: 0.3 }),
  build: Object.freeze({ goalFit: 0.4, efficiency: 0.3, quality: 0.3 }),
  operations: Object.freeze({ goalFit: 0.3, efficiency: 0.2, quality: 0.5 }),
  general: Object.freeze({ goalFit: 0.4, efficiency: 0.25, quality: 0.35 })
});
export const RISK_QUALITY_MULTIPLIER = Object.freeze({ low: 0.8, standard: 1, high: 1.5 });
/** Tokens per unit of goal fit that count as "fully efficient" for normalization. */
export const EFFICIENCY_REFERENCE_TOKENS = 1000;

/** BO-107: versioned, replayable health formula. */
export const HEALTH_FORMULA = Object.freeze({
  version: "1.1",
  healthyAtOrAbove: 80,
  degradedAtOrAbove: 55,
  fullConfidenceSamples: 5,
  minimumConfidence: 0.2,
  freshForHours: 24,
  staleFloorAfterDays: 7,
  staleConfidenceFloor: 0.25
});
export const AI_JUDGE_DRIFT_THRESHOLD = 0.2;
export const AI_JUDGE_MIN_PAIRS = 3;

export function getPerformanceIntelligenceContractSummary() {
  return Object.freeze({
    version: PERFORMANCE_INTELLIGENCE_CONTRACT_VERSION,
    usageFields: USAGE_EVENT_FIELDS,
    scopes: USAGE_SCOPES,
    sources: USAGE_SOURCES,
    budget: "soft threshold warns; hard cap blocks new reservations and pauses the project until the owner raises the cap and resumes; recorded usage is always accepted so accounting stays complete",
    evaluation: { methods: EVALUATION_METHODS, aiJudge: `drift when mean |ai-human| > ${AI_JUDGE_DRIFT_THRESHOLD} over at least ${AI_JUDGE_MIN_PAIRS} paired cases` },
    scorecard: { weights: WORK_TYPE_WEIGHTS, riskQualityMultiplier: RISK_QUALITY_MULTIPLIER },
    health: HEALTH_FORMULA,
    overrides: CRITICAL_OVERRIDE_KINDS,
    cost: "token usage only; external-provider monetary accounting remains separate"
  });
}

export function validatePerformanceIntelligenceContract() {
  const errors = [];
  if (PERFORMANCE_INTELLIGENCE_CONTRACT_VERSION !== "1.1") errors.push("Unexpected performance intelligence contract version.");
  if (USAGE_EVENT_FIELDS.length !== 4) errors.push("Usage event must have four token fields.");
  for (const [type, weights] of Object.entries(WORK_TYPE_WEIGHTS)) if (Math.abs(weights.goalFit + weights.efficiency + weights.quality - 1) > 1e-9) errors.push(`${type} weights must sum to 1.`);
  if (HEALTH_FORMULA.healthyAtOrAbove <= HEALTH_FORMULA.degradedAtOrAbove) errors.push("Health thresholds are inverted.");
  return errors;
}
