import {
  ACTOR_KINDS,
  AGGREGATE_TYPES,
  EVENT_TYPES,
  OPERATIONAL_DATA_CONTRACT_VERSION
} from "./operational-data.mjs";

export const BACKOFFICE_FOUNDATION_CONTRACT_VERSION = "1.0";

export const BACKOFFICE_CONTEXTS = Object.freeze([
  "portfolio",
  "project",
  "identity",
  "policy",
  "conversation",
  "workflow",
  "catalog",
  "evaluation",
  "infrastructure",
  "delivery"
]);

export const BACKOFFICE_PLANES = Object.freeze(["control", "execution", "data"]);

export const BACKOFFICE_ID_KINDS = Object.freeze([
  "project",
  "user",
  "command",
  "run",
  "artifact",
  "correlation"
]);

export const BACKOFFICE_LIFECYCLE_STATES = Object.freeze([
  "draft",
  "proposed",
  "active",
  "paused",
  "superseded",
  "archived"
]);

export const BACKOFFICE_CORE_ENTITIES = Object.freeze([
  "hero-instance",
  "user",
  "project",
  "project-grant",
  "project-policy-version",
  "effective-setting",
  "roadmap-node",
  "work-item",
  "run",
  "evidence",
  "system-entity",
  "dependency",
  "team",
  "role-profile",
  "agent-assignment",
  "conversation",
  "context-binding",
  "command-intent",
  "authorization-snapshot",
  "approval",
  "workflow-execution",
  "environment",
  "server",
  "node-agent",
  "deployment",
  "release",
  "artifact",
  "provenance",
  "delivery-bundle",
  "acceptance",
  "notification",
  "evaluation",
  "scorecard-metric",
  "knowledge-item",
  "knowledge-proposal",
  "secret-reference",
  "audit-event",
  "domain-event",
  "telemetry-link"
]);

const SAFE_ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const EVENT_ID = /^evt_[a-z0-9][a-z0-9_-]{2,127}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;
const FORBIDDEN_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const FORBIDDEN_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function secretViolation(value, path = "data") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const violation = secretViolation(value[index], `${path}[${index}]`);
      if (violation) return violation;
    }
    return null;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (FORBIDDEN_KEY.test(key)) return `${childPath}: sensitive field name is forbidden`;
      const violation = secretViolation(child, childPath);
      if (violation) return violation;
    }
  } else if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) {
    return `${path}: sensitive value is forbidden`;
  }
  return null;
}

export function isBackofficeStableId(value) {
  return typeof value === "string" && SAFE_ID.test(value);
}

export function assertBackofficeStableId(kind, value) {
  if (!BACKOFFICE_ID_KINDS.includes(kind)) throw new Error(`Unsupported Back Office ID kind: ${kind}`);
  if (!isBackofficeStableId(value)) throw new Error(`${kind} must be a stable Hero identifier.`);
  return value;
}

export function validateBackofficeEntityVersion(entity) {
  const errors = [];
  if (!isPlainObject(entity)) return ["Entity version must be an object."];
  if (!BACKOFFICE_CORE_ENTITIES.includes(entity.entityType)) errors.push("entityType is not a supported core entity.");
  if (!isBackofficeStableId(entity.entityId)) errors.push("entityId must be a stable identifier.");
  if (entity.projectId !== null && entity.projectId !== undefined && !isBackofficeStableId(entity.projectId)) {
    errors.push("projectId must be a stable identifier or null.");
  }
  if (!Number.isInteger(entity.version) || entity.version < 1) errors.push("version must be a positive integer.");
  if (typeof entity.schemaVersion !== "string" || !/^\d+\.\d+$/.test(entity.schemaVersion)) {
    errors.push("schemaVersion must be a numeric major.minor version.");
  }
  if (!BACKOFFICE_LIFECYCLE_STATES.includes(entity.lifecycle)) errors.push("lifecycle is not supported.");
  if (!isPlainObject(entity.data)) errors.push("data must be an object.");
  const violation = secretViolation(entity.data);
  if (violation) errors.push(violation);
  return errors;
}

export function validateBackofficeEventEnvelope(event) {
  const errors = [];
  if (!isPlainObject(event)) return ["Event envelope must be an object."];
  if (!EVENT_ID.test(event.eventId ?? "")) errors.push("eventId must use the evt_ identifier format.");
  if (!AGGREGATE_TYPES.includes(event.aggregateType)) errors.push("aggregateType is not supported.");
  if (!isBackofficeStableId(event.aggregateId)) errors.push("aggregateId must be a stable identifier.");
  if (!Number.isInteger(event.aggregateVersion) || event.aggregateVersion < 1) errors.push("aggregateVersion must be positive.");
  if (!EVENT_TYPES.includes(event.type)) errors.push("event type is not supported.");
  if (typeof event.schemaVersion !== "string" || !/^\d+\.\d+$/.test(event.schemaVersion)) errors.push("schemaVersion is invalid.");
  if (event.schemaVersion !== BACKOFFICE_FOUNDATION_CONTRACT_VERSION) errors.push("schemaVersion must match the Back Office foundation contract.");
  if (!isPlainObject(event.actor) || !ACTOR_KINDS.includes(event.actor.kind) || !isBackofficeStableId(event.actor.id)) {
    errors.push("actor must contain a supported kind and stable id.");
  }
  if (event.projectId !== null && event.projectId !== undefined && !isBackofficeStableId(event.projectId)) errors.push("projectId must be a stable identifier or null.");
  if (!isBackofficeStableId(event.correlationId)) errors.push("correlationId must be a stable identifier.");
  if (event.causationId !== null && event.causationId !== undefined && !EVENT_ID.test(event.causationId)) errors.push("causationId must be an event id or null.");
  if (!isBackofficeStableId(event.idempotencyKey)) errors.push("idempotencyKey must be a stable identifier.");
  if (typeof event.occurredAt !== "string" || !ISO_TIMESTAMP.test(event.occurredAt) || !Number.isFinite(Date.parse(event.occurredAt))) errors.push("occurredAt must be an ISO timestamp.");
  if (!isPlainObject(event.data)) errors.push("data must be an object.");
  const violation = secretViolation(event.data);
  if (violation) errors.push(violation);
  return errors;
}

export function getBackofficeFoundationContractSummary() {
  return Object.freeze({
    version: BACKOFFICE_FOUNDATION_CONTRACT_VERSION,
    operationalDataVersion: OPERATIONAL_DATA_CONTRACT_VERSION,
    contexts: BACKOFFICE_CONTEXTS,
    planes: BACKOFFICE_PLANES,
    stableIdKinds: BACKOFFICE_ID_KINDS,
    coreEntities: BACKOFFICE_CORE_ENTITIES,
    lifecycleStates: BACKOFFICE_LIFECYCLE_STATES,
    eventEnvelope: "versioned, actor/project/correlation/idempotency aware",
    replay: "deterministic read models from append-only events",
    secretSafe: true
  });
}

export function validateBackofficeFoundationContract() {
  const errors = [];
  if (BACKOFFICE_FOUNDATION_CONTRACT_VERSION !== "1.0") errors.push("foundation version must be 1.0.");
  if (BACKOFFICE_CONTEXTS.length !== new Set(BACKOFFICE_CONTEXTS).size) errors.push("contexts must be unique.");
  if (BACKOFFICE_PLANES.length !== 3) errors.push("control, execution and data planes are required.");
  if (BACKOFFICE_CORE_ENTITIES.length !== new Set(BACKOFFICE_CORE_ENTITIES).size) errors.push("core entities must be unique.");
  if (BACKOFFICE_ID_KINDS.some(kind => !/^[a-z][a-z-]+$/.test(kind))) errors.push("stable ID kinds must use safe names.");
  if (BACKOFFICE_LIFECYCLE_STATES.includes("deleted")) errors.push("deleted is not a valid lifecycle state; use archived or superseded.");
  return errors;
}
