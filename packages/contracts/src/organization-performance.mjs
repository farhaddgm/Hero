export const ORGANIZATION_PERFORMANCE_CONTRACT_VERSION = "1.0";

export const ORGANIZATION_PERFORMANCE_METRICS = Object.freeze([
  "delivery",
  "quality",
  "evidence",
  "rework",
  "reliability"
]);

export const ORGANIZATION_PERFORMANCE_BANDS = Object.freeze(["strong", "watch", "intervention"]);

export function getOrganizationPerformanceContractSummary() {
  return Object.freeze({
    version: ORGANIZATION_PERFORMANCE_CONTRACT_VERSION,
    metrics: ORGANIZATION_PERFORMANCE_METRICS,
    bands: ORGANIZATION_PERFORMANCE_BANDS,
    scope: "all active Hero teams in one versioned review period",
    evidenceRule: "Each team must provide one internal hero:// evidence reference and all five normalized scores.",
    decisionBoundary: "The review recommends intervention; it never changes team state or grants execution authority."
  });
}

export function validateOrganizationPerformanceContract() {
  const errors = [];
  if (ORGANIZATION_PERFORMANCE_CONTRACT_VERSION !== "1.0") errors.push("Organization performance contract version is invalid.");
  if (ORGANIZATION_PERFORMANCE_METRICS.length !== 5) errors.push("Organization performance must keep five normalized metrics.");
  if (ORGANIZATION_PERFORMANCE_BANDS.length !== 3) errors.push("Organization performance bands are incomplete.");
  return errors;
}
