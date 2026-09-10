export const OBSERVABILITY_CONTRACT_VERSION = "1.0";

export const OBSERVABILITY_EVENT_KINDS = Object.freeze([
  "control",
  "authorization",
  "team",
  "workflow",
  "ai",
  "quality",
  "release",
  "persistence"
]);

export const OBSERVABILITY_SAFE_DATA_KEYS = Object.freeze([
  "command",
  "projectId",
  "teamId",
  "role",
  "providerId",
  "modelId",
  "profileId",
  "invocationId",
  "evaluationId",
  "decisionId",
  "reviewId",
  "advisorId",
  "organizationId",
  "skillId",
  "bindingId",
  "planningId",
  "requestId",
  "runId",
  "taskId",
  "status",
  "state",
  "code",
  "outcome",
  "attempts",
  "latencyMs",
  "costUnits",
  "maxCostUnits",
  "catalogVersion",
  "pricingCurrency",
  "inputPricePer1mTokens",
  "outputPricePer1mTokens",
  "cachedInputPricePer1mTokens",
  "heroUnitsPerCurrencyUnit",
  "pricingMode",
  "unitName",
  "findingCount",
  "recommendation",
  "period",
  "sequence"
]);

export const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/;
export const SPAN_ID_PATTERN = /^[0-9a-f]{16}$/;

export function getObservabilityContractSummary() {
  return Object.freeze({
    version: OBSERVABILITY_CONTRACT_VERSION,
    correlation: "W3C Trace Context-compatible traceId/spanId; Hero event correlation remains append-only",
    semanticConventions: "OpenTelemetry HTTP, messaging and GenAI-aligned names",
    eventKinds: OBSERVABILITY_EVENT_KINDS,
    safeDataKeys: OBSERVABILITY_SAFE_DATA_KEYS,
    contentPolicy: "request text, prompts, model output, credentials and secrets are excluded from public projections",
    retentionBoundary: "operational events remain the source of truth; UI projections are rebuildable"
  });
}

export function validateObservabilityContract() {
  const errors = [];
  if (OBSERVABILITY_CONTRACT_VERSION !== "1.0") errors.push("Observability contract version is invalid.");
  if (OBSERVABILITY_EVENT_KINDS.length !== new Set(OBSERVABILITY_EVENT_KINDS).size) errors.push("Observability event kinds must be unique.");
  if (OBSERVABILITY_SAFE_DATA_KEYS.length !== new Set(OBSERVABILITY_SAFE_DATA_KEYS).size) errors.push("Safe data keys must be unique.");
  if (!TRACE_ID_PATTERN.test("0123456789abcdef0123456789abcdef")) errors.push("Trace ID pattern is invalid.");
  if (!SPAN_ID_PATTERN.test("0123456789abcdef")) errors.push("Span ID pattern is invalid.");
  return errors;
}

function safeScalar(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function publicKind(type = "") {
  if (type.startsWith("ai.")) return "ai";
  if (type.startsWith("skill.") || type.startsWith("organization-advisor.")) return "ai";
  if (type.startsWith("organization-performance.")) return "quality";
  if (type.startsWith("authorization.")) return "authorization";
  if (type.startsWith("team.")) return "team";
  if (type.startsWith("run.") || type.startsWith("task.") || type.startsWith("runner.") || type.startsWith("planning.")) return "workflow";
  if (type.startsWith("quality-gate.") || type.startsWith("evidence.")) return "quality";
  if (type.startsWith("release.")) return "release";
  if (type.startsWith("control.")) return "control";
  return "persistence";
}

/**
 * Converts an operational event into a redacted, UI-safe projection.
 * The allow-list is intentional: adding a new event payload does not silently
 * expose request text, prompts, outputs or runtime credentials.
 */
export function projectOperationalEvent(event = {}) {
  const data = {};
  for (const key of OBSERVABILITY_SAFE_DATA_KEYS) {
    const value = event.data?.[key];
    if (safeScalar(value)) data[key] = value;
  }
  return Object.freeze({
    sequence: Number.isInteger(event.sequence) ? event.sequence : null,
    eventId: event.eventId ?? null,
    kind: publicKind(event.type),
    aggregateType: event.aggregateType ?? null,
    aggregateId: event.aggregateId ?? null,
    type: event.type ?? null,
    occurredAt: event.occurredAt ?? null,
    actorKind: event.actor?.kind ?? null,
    correlationId: event.correlationId ?? null,
    causationId: event.causationId ?? null,
    data: Object.freeze(data)
  });
}
