export const OPERATIONAL_DATA_CONTRACT_VERSION = "1.0";

export const AGGREGATE_TYPES = Object.freeze([
  "project",
  "work-item",
  "task",
  "authorization",
  "run",
  "evidence",
  "artifact",
  "decision"
]);

export const EVENT_TYPES = Object.freeze([
  "project.requested",
  "work-item.planned",
  "task.created",
  "task.updated",
  "authorization.granted",
  "authorization.revoked",
  "authorization.dispatch-authorized",
  "authorization.dispatch-blocked",
  "authorization.global-stop-activated",
  "authorization.global-stop-cleared",
  "run.drafted",
  "run.planned",
  "run.queued",
  "run.started",
  "run.checkpointed",
  "run.review-requested",
  "run.review-approved",
  "run.review-changes-requested",
  "run.completed",
  "run.failed",
  "run.paused",
  "run.resumed",
  "run.retry-requested",
  "run.cancelled",
  "evidence.recorded",
  "decision.requested",
  "decision.resolved",
  "artifact.delivered",
  "outbox.dispatch-requested"
]);

export const ACTOR_KINDS = Object.freeze([
  "project-owner",
  "orchestrator",
  "agent",
  "system"
]);

export const SENSITIVE_ACTIONS = Object.freeze([
  "production-deploy",
  "destructive-data-operation",
  "external-spend",
  "secret-change",
  "external-message",
  "irreversible-operation"
]);

export const OPERATIONAL_ENTITY_MODEL = Object.freeze([
  Object.freeze({ id: "project", sourceOfTruth: "projects", purpose: "یک محصول یا درخواست مستقل" }),
  Object.freeze({ id: "work-item", sourceOfTruth: "work_items", purpose: "خواستهٔ قابل‌تحویل کاربر" }),
  Object.freeze({ id: "task", sourceOfTruth: "tasks", purpose: "واحد قابل‌اجرا در Task Graph" }),
  Object.freeze({ id: "authorization", sourceOfTruth: "authorizations", purpose: "مجوز نسخه‌دار و قابل‌ابطال" }),
  Object.freeze({ id: "run", sourceOfTruth: "runs", purpose: "اجرای ایزوله و checkpointهای آن" }),
  Object.freeze({ id: "event", sourceOfTruth: "events", purpose: "حقیقت append-only برای تغییرات عملیاتی" }),
  Object.freeze({ id: "evidence", sourceOfTruth: "evidence", purpose: "نتیجهٔ تست، review یا بررسی" }),
  Object.freeze({ id: "artifact", sourceOfTruth: "artifacts", purpose: "خروجی تحویلی، commit یا bundle" }),
  Object.freeze({ id: "outbox", sourceOfTruth: "outbox", purpose: "Dispatch پایدار پس از commit تراکنش" })
]);

const FORBIDDEN_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const FORBIDDEN_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const EVENT_ID = /^evt_[a-z0-9][a-z0-9_-]{2,127}$/;
const AGGREGATE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && /T/.test(value);
}

function findSecretViolation(value, path = "data") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const violation = findSecretViolation(value[index], `${path}[${index}]`);
      if (violation) return violation;
    }
    return null;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (FORBIDDEN_KEY.test(key)) return `${childPath}: sensitive field name is forbidden`;
      const violation = findSecretViolation(child, childPath);
      if (violation) return violation;
    }
    return null;
  }

  if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) {
    return `${path}: sensitive value is forbidden`;
  }
  return null;
}

export function validateOperationalEvent(event) {
  const errors = [];
  if (!isPlainObject(event)) return ["Event must be an object."];
  if (!EVENT_ID.test(event.eventId ?? "")) errors.push("eventId must use the evt_ identifier format.");
  if (!AGGREGATE_TYPES.includes(event.aggregateType)) errors.push("aggregateType is not supported.");
  if (!AGGREGATE_ID.test(event.aggregateId ?? "")) errors.push("aggregateId is invalid.");
  if (!EVENT_TYPES.includes(event.type)) errors.push("event type is not supported.");
  if (!isIsoTimestamp(event.occurredAt)) errors.push("occurredAt must be an ISO timestamp.");
  if (!ACTOR_KINDS.includes(event.actor?.kind)) errors.push("actor.kind is not supported.");
  if (typeof event.actor?.id !== "string" || event.actor.id.length < 3) {
    errors.push("actor.id is required.");
  }
  if (!isPlainObject(event.data)) errors.push("data must be an object.");
  if (event.correlationId !== undefined && !AGGREGATE_ID.test(event.correlationId)) {
    errors.push("correlationId is invalid.");
  }
  if (event.causationId !== undefined && !EVENT_ID.test(event.causationId)) {
    errors.push("causationId is invalid.");
  }
  if (event.schemaVersion !== OPERATIONAL_DATA_CONTRACT_VERSION) {
    errors.push("schemaVersion must match the operational data contract.");
  }
  if (event.data && findSecretViolation(event.data)) errors.push(findSecretViolation(event.data));
  return errors;
}

export function createOperationalEvent(input) {
  const event = Object.freeze({
    eventId: input.eventId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    type: input.type,
    occurredAt: input.occurredAt,
    actor: Object.freeze({ kind: input.actor?.kind, id: input.actor?.id }),
    correlationId: input.correlationId,
    causationId: input.causationId,
    data: Object.freeze({ ...(input.data ?? {}) }),
    schemaVersion: OPERATIONAL_DATA_CONTRACT_VERSION
  });
  const errors = validateOperationalEvent(event);
  if (errors.length > 0) throw new Error(`Invalid operational event: ${errors.join(" ")}`);
  return event;
}

export function getOperationalDataSummary() {
  return Object.freeze({
    version: OPERATIONAL_DATA_CONTRACT_VERSION,
    aggregateTypes: AGGREGATE_TYPES,
    eventTypes: EVENT_TYPES,
    entityTables: OPERATIONAL_ENTITY_MODEL.map(entity => entity.sourceOfTruth),
    appendOnly: true,
    secretSafe: true,
    durableDispatch: "postgresql-outbox"
  });
}
