export const PRODUCT_RUNNER_CONTRACT_VERSION = "1.0";

export const PRODUCT_RUNNER_ACTIONS = Object.freeze([
  "preflight",
  "build",
  "test",
  "start",
  "stop",
  "cleanup"
]);

export const PRODUCT_RUNNER_AUTH_OPERATIONS = Object.freeze([
  "product-test-build",
  "product-test-test",
  "product-test-start",
  "product-test-stop",
  "product-test-cleanup"
]);

export const PRODUCT_RUNNER_DECISION_CODES = Object.freeze([
  "PRODUCT_RUNNER_READY",
  "PRODUCT_RUNNER_ADMISSION_REJECTED",
  "PRODUCT_RUNNER_EXECUTOR_NOT_CONFIGURED",
  "PRODUCT_RUNNER_AUTHORIZATION_REQUIRED",
  "PRODUCT_RUNNER_MODE_NOT_ENABLED",
  "PRODUCT_RUNNER_PLAN_NOT_APPROVED",
  "PRODUCT_RUNNER_CONCURRENCY_LIMIT",
  "PRODUCT_RUNNER_EXECUTOR_FAILED",
  "PRODUCT_RUNNER_RESOURCE_CONFLICT",
  "PRODUCT_RUNNER_RESOURCE_RESERVATION_REQUIRED",
  "PRODUCT_RUNNER_RESOURCE_RESERVATION_EXPIRED",
  "PRODUCT_RUNNER_OUTPUT_REDACTED"
]);

export const PRODUCT_RUNNER_DEFAULTS = Object.freeze({
  workspaceKeyPrefix: "product-workspaces",
  composeFile: "compose.yaml",
  networkMode: "none",
  shell: false,
  output: "metadata-only"
});

export function getProductRunnerContractSummary() {
  return Object.freeze({
    version: PRODUCT_RUNNER_CONTRACT_VERSION,
    actions: PRODUCT_RUNNER_ACTIONS,
    authorizationOperations: PRODUCT_RUNNER_AUTH_OPERATIONS,
    decisionCodes: PRODUCT_RUNNER_DECISION_CODES,
    defaults: PRODUCT_RUNNER_DEFAULTS,
    boundary: "Product Runner uses a separate workspace, capacity-aware persistent reservations with lease heartbeat/reconciliation when PostgreSQL is attached (with a process-local fallback), argv-only Docker commands and a separate version-bound Product Test authorization.",
    output: "stdout/stderr are never returned; only exit code, duration and byte counts are retained."
  });
}

export function validateProductRunnerContract() {
  const errors = [];
  if (PRODUCT_RUNNER_CONTRACT_VERSION !== "1.0") errors.push("Unexpected Product Runner contract version.");
  if (!PRODUCT_RUNNER_ACTIONS.includes("preflight") || !PRODUCT_RUNNER_ACTIONS.includes("cleanup")) errors.push("Product Runner lifecycle actions are incomplete.");
  if (!PRODUCT_RUNNER_AUTH_OPERATIONS.includes("product-test-start")) errors.push("Product Test start must require a separate authorization.");
  if (PRODUCT_RUNNER_DEFAULTS.networkMode !== "none") errors.push("Product Runner network must default to none.");
  if (PRODUCT_RUNNER_DEFAULTS.shell !== false) errors.push("Product Runner must not use a shell.");
  if (!PRODUCT_RUNNER_DECISION_CODES.includes("PRODUCT_RUNNER_RESOURCE_CONFLICT")) errors.push("Product Runner must fail closed on resource conflicts.");
  return errors;
}
