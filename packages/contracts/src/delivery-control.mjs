export const DELIVERY_CONTROL_CONTRACT_VERSION = "1.1";
export const DELIVERY_RELEASE_STATES = Object.freeze(["tested", "approved", "ready", "deployed", "rolled-back", "blocked"]);
export const DELIVERY_TARGETS = Object.freeze(["web", "backend", "mobile", "data", "multi-service"]);

/** BO-139: the only legal moves. A deploy is always recorded, never executed, by Hero. */
export const RELEASE_TRANSITIONS = Object.freeze({
  tested: Object.freeze(["approved", "blocked"]),
  approved: Object.freeze(["ready", "blocked"]),
  ready: Object.freeze(["deployed", "blocked"]),
  deployed: Object.freeze(["rolled-back"]),
  blocked: Object.freeze([]),
  "rolled-back": Object.freeze([])
});

/** BO-135 / BO-136: Production telemetry is metadata only. Each kind has an exact schema; unknown keys are rejected. */
export const TELEMETRY_KINDS = Object.freeze(["health", "metric", "sanitized-log", "trace-metadata"]);
export const TELEMETRY_FIELDS = Object.freeze({
  health: Object.freeze(["component", "status"]),
  metric: Object.freeze(["name", "value", "unit"]),
  "sanitized-log": Object.freeze(["level", "code", "message"]),
  "trace-metadata": Object.freeze(["traceId", "spanCount", "durationMs", "status"])
});
export const TELEMETRY_METRIC_UNITS = Object.freeze(["count", "ms", "seconds", "bytes", "percent", "ratio"]);
export const TELEMETRY_LOG_LEVELS = Object.freeze(["debug", "info", "warn", "error"]);
export const TELEMETRY_HEALTH_STATES = Object.freeze(["healthy", "degraded", "down"]);
export const TELEMETRY_MESSAGE_MAX = 200;

/** BO-137: break-glass is a recorded, time-boxed approval. Hero never reads Production data. */
export const BREAK_GLASS_STATES = Object.freeze(["approval-required", "approved", "denied", "revoked"]);
export const BREAK_GLASS_MAX_SECONDS = 4 * 3600;

/** BO-144: recovery rehearsals must follow this order. */
export const RECOVERY_ORDER = Object.freeze(["backup", "restore", "upgrade", "rollback"]);

export function getDeliveryControlContractSummary() {
  return Object.freeze({
    version: DELIVERY_CONTROL_CONTRACT_VERSION, releaseStates: DELIVERY_RELEASE_STATES, targets: DELIVERY_TARGETS,
    releaseTransitions: RELEASE_TRANSITIONS, telemetryKinds: TELEMETRY_KINDS,
    productionTelemetry: "allowlisted metadata only, exact schema per kind, redacted before storage",
    breakGlass: "owner request, a different person approves, time-boxed, audited; Hero never reads Production data",
    productionPayload: "never enters AI, Memory or Evaluation",
    deliveryBundle: "secret-free manifest; export and deploy separately gated",
    portability: "verified by comparing the target's observed manifest digest with the bundle's digest",
    recoveryOrder: RECOVERY_ORDER
  });
}

export function validateDeliveryControlContract() {
  const errors = [];
  if (!DELIVERY_RELEASE_STATES.includes("rolled-back") || DELIVERY_TARGETS.length !== 5) errors.push("Invalid delivery-control contract.");
  for (const kind of TELEMETRY_KINDS) if (!TELEMETRY_FIELDS[kind]) errors.push(`Telemetry kind ${kind} has no schema.`);
  return errors;
}
