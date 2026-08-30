export const RELEASE_CONTRACT_VERSION = "1.0";

export const RELEASE_ENVIRONMENTS = Object.freeze(["test", "production"]);
export const RELEASE_STATES = Object.freeze([
  "draft",
  "test-deployment-requested",
  "test-deployed",
  "test-passed",
  "awaiting-production-approval",
  "production-approved",
  "production-promotion-requested",
  "production",
  "blocked",
  "rolled-back"
]);

export const RELEASE_ACTIONS = Object.freeze([
  "register",
  "request-test-deployment",
  "record-test-deployment",
  "record-test-evidence",
  "request-production-approval",
  "approve-production",
  "request-production-promotion",
  "record-production-deployment",
  "rollback"
]);

export const RELEASE_DECISION_CODES = Object.freeze([
  "RELEASE_READY",
  "INVALID_VERSION",
  "ARTIFACT_MISMATCH",
  "COMMIT_REQUIRED",
  "TEST_DEPLOYMENT_REQUIRED",
  "TEST_EVIDENCE_REQUIRED",
  "TEST_EVIDENCE_FAILED",
  "PRODUCTION_APPROVAL_REQUIRED",
  "PRODUCTION_AUTHORIZATION_REQUIRED",
  "PRODUCTION_COMMAND_REQUIRED",
  "PRINCIPLES_NOT_SATISFIED",
  "RELEASE_NOT_FOUND",
  "INVALID_RELEASE_TRANSITION",
  "GLOBAL_STOP_ACTIVE"
]);

export const RELEASE_VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const RELEASE_COMMIT_PATTERN = /^[0-9a-f]{7,64}$/i;

export function getReleaseContractSummary() {
  return Object.freeze({
    version: RELEASE_CONTRACT_VERSION,
    environments: RELEASE_ENVIRONMENTS,
    states: RELEASE_STATES,
    actions: RELEASE_ACTIONS,
    decisionCodes: RELEASE_DECISION_CODES,
    versionRule: "semantic version; production reuses the exact tested version",
    promotionRule: "test deployment -> real test evidence -> owner approval -> explicit production command",
    productionBoundary: "production deployment is sensitive and requires separate authorization",
    sourceOfTruth: "versioned-release-registry-and-append-only-events"
  });
}

export function validateReleaseContract() {
  const errors = [];
  if (RELEASE_CONTRACT_VERSION !== "1.0") errors.push("Unexpected release contract version.");
  for (const environment of RELEASE_ENVIRONMENTS) {
    if (typeof environment !== "string" || environment.length < 3) errors.push(`Environment is invalid: ${environment}.`);
  }
  for (const state of ["draft", "test-deployment-requested", "test-deployed", "test-passed", "awaiting-production-approval", "production-approved", "production-promotion-requested", "production", "blocked", "rolled-back"]) {
    if (!RELEASE_STATES.includes(state)) errors.push(`Required release state is missing: ${state}.`);
  }
  for (const code of ["TEST_EVIDENCE_REQUIRED", "PRODUCTION_APPROVAL_REQUIRED", "PRODUCTION_AUTHORIZATION_REQUIRED", "PRODUCTION_COMMAND_REQUIRED", "ARTIFACT_MISMATCH"]) {
    if (!RELEASE_DECISION_CODES.includes(code)) errors.push(`Required release decision code is missing: ${code}.`);
  }
  if (!RELEASE_VERSION_PATTERN.test("1.0.0")) errors.push("Semantic version pattern rejects a valid version.");
  if (!RELEASE_COMMIT_PATTERN.test("0123456")) errors.push("Commit pattern rejects a valid short SHA.");
  return errors;
}
