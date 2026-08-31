import {
  ORGANIZATION_PERFORMANCE_BANDS,
  ORGANIZATION_PERFORMANCE_METRICS,
  getOrganizationPerformanceContractSummary
} from "../../contracts/src/organization-performance.mjs";
import { TEAM_CATALOG } from "../../contracts/src/team.mjs";

const SCORE_MIN = 0;
const SCORE_MAX = 100;
const SENSITIVE_FIELD = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|opt)\/)/;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertIdentifier(label, value, maximum = 128) {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(value) || value.length > maximum) throw new OrganizationPerformanceError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function assertPeriod(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,47}$/.test(value)) throw new OrganizationPerformanceError("INVALID_PERIOD", "period is invalid.");
  return value;
}

function assertSafe(value, path = "input") {
  if (Array.isArray(value)) return value.forEach((child, index) => assertSafe(child, `${path}[${index}]`));
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_FIELD.test(key)) throw new OrganizationPerformanceError("SENSITIVE_INPUT_REJECTED", `${path}.${key} is not allowed.`);
      assertSafe(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && (SENSITIVE_VALUE.test(value) || HOST_PATH.test(value))) throw new OrganizationPerformanceError("SENSITIVE_INPUT_REJECTED", `${path} contains a sensitive value or host path.`);
}

function score(label, value) {
  if (!Number.isInteger(value) || value < SCORE_MIN || value > SCORE_MAX) throw new OrganizationPerformanceError("INVALID_SCORE", `${label} must be an integer between 0 and 100.`);
  return value;
}

function bandFor(average) {
  if (average >= 80) return "strong";
  if (average >= 60) return "watch";
  return "intervention";
}

function fingerprint(value) {
  const stable = item => {
    if (Array.isArray(item)) return item.map(stable);
    if (item && typeof item === "object") return Object.fromEntries(Object.keys(item).sort().map(key => [key, stable(item[key])]));
    return item;
  };
  return JSON.stringify(stable(value));
}

function findingFor(teamId, metric, value) {
  if (value >= 60) return null;
  return Object.freeze({
    findingId: `FINDING-${teamId}-${metric}`,
    teamId,
    metric,
    severity: value < 40 ? "high" : "medium",
    message: `${metric} score is below the 60-point operating threshold.`,
    recommendation: "برنامهٔ اصلاحی، مالک و evidence دورهٔ بعد را مشخص کنید."
  });
}

export class OrganizationPerformanceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OrganizationPerformanceError";
    this.code = code;
  }
}

export function createOrganizationPerformanceReview({ teamRegistry, now = () => new Date().toISOString() } = {}) {
  const reviews = new Map();
  const idempotency = new Map();

  function review(input = {}) {
    assertSafe(input);
    const reviewId = assertIdentifier("reviewId", input.reviewId);
    const organizationId = assertIdentifier("organizationId", input.organizationId);
    const period = assertPeriod(input.period);
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const inputFingerprint = fingerprint(input);
    const replayed = idempotency.get(idempotencyKey);
    if (replayed) {
      if (replayed.fingerprint !== inputFingerprint) throw new OrganizationPerformanceError("IDEMPOTENCY_CONFLICT", "idempotencyKey was reused with different performance input.");
      return copy({ ...replayed.result, idempotent: true });
    }
    if (reviews.has(reviewId)) throw new OrganizationPerformanceError("REVIEW_EXISTS", `Performance review ${reviewId} already exists.`);
    const evidence = input.teamMetrics;
    if (!Array.isArray(evidence) || evidence.length !== TEAM_CATALOG.length) throw new OrganizationPerformanceError("TEAM_COVERAGE_INCOMPLETE", `Exactly ${TEAM_CATALOG.length} team metric records are required.`);
    const expected = new Set(TEAM_CATALOG.map(team => team.teamId));
    const seen = new Set();
    const teams = evidence.map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new OrganizationPerformanceError("INVALID_TEAM_METRIC", `teamMetrics[${index}] is invalid.`);
      const teamId = assertIdentifier(`teamMetrics[${index}].teamId`, entry.teamId, 80);
      if (!expected.has(teamId)) throw new OrganizationPerformanceError("UNKNOWN_TEAM", `${teamId} is not a Hero team.`);
      if (seen.has(teamId)) throw new OrganizationPerformanceError("DUPLICATE_TEAM", `${teamId} appears more than once.`);
      seen.add(teamId);
      if (typeof entry.evidenceRef !== "string" || !entry.evidenceRef.startsWith("hero://")) throw new OrganizationPerformanceError("INVALID_EVIDENCE_REFERENCE", `${teamId} needs an internal hero:// evidence reference.`);
      const scores = Object.fromEntries(ORGANIZATION_PERFORMANCE_METRICS.map(metric => [metric, score(`${teamId}.${metric}`, entry.scores?.[metric])]));
      const average = Number((Object.values(scores).reduce((sum, value) => sum + value, 0) / ORGANIZATION_PERFORMANCE_METRICS.length).toFixed(2));
      const findings = ORGANIZATION_PERFORMANCE_METRICS.map(metric => findingFor(teamId, metric, scores[metric])).filter(Boolean);
      return Object.freeze({ teamId, evidenceRef: entry.evidenceRef, scores: Object.freeze(scores), average, band: bandFor(average), findings: Object.freeze(findings), sourceStatus: teamRegistry?.get(teamId)?.status ?? "not-read" });
    });
    if (seen.size !== expected.size) throw new OrganizationPerformanceError("TEAM_COVERAGE_INCOMPLETE", "Every Hero team must be represented exactly once.");
    const average = Number((teams.reduce((sum, team) => sum + team.average, 0) / teams.length).toFixed(2));
    const findings = teams.flatMap(team => team.findings);
    const result = copy({
      reviewId,
      organizationId,
      period,
      teamCount: teams.length,
      coverage: { expected: expected.size, observed: teams.length, complete: true },
      average,
      band: bandFor(average),
      teams,
      findings,
      recommendation: findings.length === 0 ? "ادامهٔ روند فعلی و بازبینی دورهٔ بعد." : "برای یافته‌های ثبت‌شده owner، مهلت و evidence اصلاحی تعیین شود.",
      recordedAt: now(),
      decisionBoundary: "evidence-and-recommendation-only"
    });
    reviews.set(reviewId, result);
    idempotency.set(idempotencyKey, { fingerprint: inputFingerprint, result });
    return result;
  }

  function persistenceSnapshot() {
    return copy({
      schemaVersion: "1.0",
      registryId: "organization-performance",
      reviews: [...reviews.values()]
    });
  }

  function hydrate(input = {}) {
    const state = input.data ?? input;
    if (!state || !Array.isArray(state.reviews)) throw new OrganizationPerformanceError("HYDRATION_INVALID", "Organization performance hydration requires reviews.");
    reviews.clear();
    idempotency.clear();
    for (const review of state.reviews) {
      if (!review || typeof review !== "object" || typeof review.reviewId !== "string") throw new OrganizationPerformanceError("HYDRATION_INVALID", "A hydrated performance review is invalid.");
      reviews.set(review.reviewId, copy(review));
    }
    return copy({ registryId: "organization-performance", hydrated: true, reviews: reviews.size });
  }

  return Object.freeze({
    review,
    get: reviewId => reviews.has(reviewId) ? copy(reviews.get(reviewId)) : null,
    list: () => Object.freeze([...reviews.values()].map(copy)),
    persistenceSnapshot,
    hydrate,
    contract: () => getOrganizationPerformanceContractSummary()
  });
}
