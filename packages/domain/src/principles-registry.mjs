import {
  CRITICAL_PRINCIPLES_CONTRACT_VERSION,
  HERO_CRITICAL_PRINCIPLES,
  PRINCIPLE_CONTROL_POINTS,
  PRINCIPLE_DECISIONS,
  PRINCIPLE_SCOPES,
  PRINCIPLE_STATUSES,
  getCriticalPrinciplesContractSummary
} from "../../contracts/src/principles.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SENSITIVE_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const HOST_PATH = /(?:^|[\\/])(?:opt|home|root|Users|var|tmp)(?:[\\/]|$)|^[A-Za-z]:[\\/]/i;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return JSON.stringify(stableValue(value));
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new PrincipleCommandError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function assertOwner(actor) {
  assertIdentifier("actor.kind", actor?.kind);
  assertIdentifier("actor.id", actor?.id);
  if (actor.kind !== "project-owner") throw new PrincipleCommandError("OWNER_APPROVAL_REQUIRED", "Only project-owner may change critical principles.");
}

function assertSafe(value, path = "input") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafe(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) throw new PrincipleCommandError("SENSITIVE_INPUT_REJECTED", `${path}.${key} is not allowed.`);
      assertSafe(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && (SENSITIVE_VALUE.test(value) || HOST_PATH.test(value))) {
    throw new PrincipleCommandError("SENSITIVE_INPUT_REJECTED", `${path} contains a forbidden value.`);
  }
}

function assertIdempotencyKey(value) {
  assertIdentifier("idempotencyKey", value);
}

function normalizeList(label, value, { required = true } = {}) {
  if (!Array.isArray(value) || (required && value.length === 0)) {
    throw new PrincipleCommandError("INVALID_PRINCIPLE", `${label} must contain at least one item.`);
  }
  const list = value.map(item => {
    if (typeof item !== "string" || item.trim().length < 2 || item.trim().length > 500) {
      throw new PrincipleCommandError("INVALID_PRINCIPLE", `${label} contains invalid text.`);
    }
    return item.trim();
  });
  if (new Set(list).size !== list.length) throw new PrincipleCommandError("INVALID_PRINCIPLE", `${label} must not contain duplicates.`);
  return Object.freeze(list);
}

function normalizeDefinition(input) {
  assertSafe(input);
  const scope = input.scope ?? "product";
  if (!PRINCIPLE_SCOPES.includes(scope)) throw new PrincipleCommandError("INVALID_PRINCIPLE", "Principle scope is not supported.");
  const principleId = assertIdentifier("principleId", input.principleId);
  const projectId = assertIdentifier("projectId", input.projectId ?? "hero");
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const statement = typeof input.statement === "string" ? input.statement.trim() : "";
  const rationale = typeof input.rationale === "string" ? input.rationale.trim() : "";
  if (title.length < 3 || title.length > 160 || statement.length < 10 || statement.length > 1000 || rationale.length < 5 || rationale.length > 1000) {
    throw new PrincipleCommandError("INVALID_PRINCIPLE", "Principle title, statement or rationale is invalid.");
  }
  if (scope === "hero" && projectId !== "hero") throw new PrincipleCommandError("INVALID_PRINCIPLE", "Hero principles must belong to the hero project.");
  const controlPoints = normalizeList("controlPoints", input.controlPoints);
  if (controlPoints.some(point => !PRINCIPLE_CONTROL_POINTS.includes(point))) {
    throw new PrincipleCommandError("INVALID_PRINCIPLE", "Principle control point is not supported.");
  }
  return {
    principleId,
    projectId,
    scope,
    title,
    statement,
    rationale,
    enforcement: "block",
    controlPoints
  };
}

function result(principle, event, idempotent) {
  return Object.freeze({ principle: copy(principle), event: copy(event), idempotent });
}

export class PrincipleCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PrincipleCommandError";
    this.code = code;
  }
}

export class PrincipleIdempotencyConflictError extends PrincipleCommandError {
  constructor(idempotencyKey) {
    super("IDEMPOTENCY_CONFLICT", `Idempotency key ${idempotencyKey} was already used with different input.`);
    this.name = "PrincipleIdempotencyConflictError";
  }
}

export class CriticalPrinciplesBlockedError extends PrincipleCommandError {
  constructor(decision) {
    super("PRINCIPLES_NOT_SATISFIED", `Critical principles are not satisfied at ${decision.controlPoint}.`);
    this.name = "CriticalPrinciplesBlockedError";
    this.decision = decision;
  }
}

export function createPrinciplesRegistry(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  let nextEvent = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => `evt_principle_${String(++nextEvent).padStart(6, "0")}`);
  const principles = new Map();
  const idempotency = new Map();

  for (const definition of options.seeds ?? HERO_CRITICAL_PRINCIPLES) {
    const normalized = normalizeDefinition({ ...definition, projectId: "hero" });
    const key = `${normalized.projectId}\u0000${normalized.principleId}`;
    principles.set(key, Object.freeze({
      ...normalized,
      status: "approved",
      version: 0,
      proposedBy: "project-owner",
      approvedBy: "project-owner",
      approvedAt: "2026-08-14T00:00:00.000Z",
      rejectedAt: null,
      feedback: null,
      lastEventId: null
    }));
  }

  function getKey(projectId, principleId) {
    return `${projectId}\u0000${principleId}`;
  }

  function getPrinciple(projectId, principleId) {
    const value = principles.get(getKey(projectId, principleId));
    if (!value) throw new PrincipleCommandError("PRINCIPLE_NOT_FOUND", "Critical principle not found.");
    return value;
  }

  function remember(scope, idempotencyKey, valueFingerprint, value) {
    const key = `${scope}\u0000${idempotencyKey}`;
    const existing = idempotency.get(key);
    if (existing) {
      if (existing.fingerprint !== valueFingerprint) throw new PrincipleIdempotencyConflictError(idempotencyKey);
      return { ...existing.value, idempotent: true };
    }
    idempotency.set(key, { fingerprint: valueFingerprint, value });
    return { ...value, idempotent: false };
  }

  function append({ aggregateId, type, actor, data, expectedVersion, correlationId }) {
    const event = createOperationalEvent({
      eventId: eventIdFactory(),
      aggregateType: "principle",
      aggregateId,
      type,
      occurredAt: now(),
      actor,
      correlationId: correlationId ?? aggregateId,
      data
    });
    return eventLog.append(event, { expectedVersion });
  }

  function define(input) {
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const definition = normalizeDefinition(input);
    const key = getKey(definition.projectId, definition.principleId);
    const valueFingerprint = fingerprint({ definition, actor: input.actor });
    const replay = remember(`DEFINE:${key}`, input.idempotencyKey, valueFingerprint, { principle: null, event: null });
    if (replay.principle) return replay;
    if (principles.has(key)) throw new PrincipleCommandError("PRINCIPLE_ALREADY_EXISTS", "Critical principle already exists.");
    const event = append({
      aggregateId: `${definition.projectId}:${definition.principleId}`,
      type: "principle.defined",
      actor: input.actor,
      expectedVersion: 0,
      data: { projectId: definition.projectId, ...definition, status: "proposed" }
    });
    const principle = Object.freeze({
      ...definition,
      status: "proposed",
      version: event.aggregateVersion,
      proposedBy: input.actor.id,
      approvedBy: null,
      approvedAt: null,
      rejectedAt: null,
      feedback: null,
      lastEventId: event.eventId
    });
    principles.set(key, principle);
    idempotency.set(`DEFINE:${key}\u0000${input.idempotencyKey}`, { fingerprint: valueFingerprint, value: { principle: copy(principle), event: copy(event) } });
    return result(principle, event, false);
  }

  function review(input) {
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    if (!PRINCIPLE_DECISIONS.includes(input?.decision)) throw new PrincipleCommandError("INVALID_DECISION", "Principle decision must be approved or rejected.");
    const projectId = assertIdentifier("projectId", input.projectId ?? "hero");
    const principleId = assertIdentifier("principleId", input.principleId);
    const current = getPrinciple(projectId, principleId);
    const valueFingerprint = fingerprint({ projectId, principleId, decision: input.decision, reason: input.reason ?? "", expectedVersion: input.expectedVersion, actor: input.actor });
    const scope = `REVIEW:${projectId}:${principleId}`;
    const replay = remember(scope, input.idempotencyKey, valueFingerprint, { principle: copy(current), event: null });
    if (replay.event) return replay;
    const expectedVersion = input.expectedVersion ?? current.version;
    if (expectedVersion !== current.version) throw new PrincipleCommandError("VERSION_CONFLICT", "Principle version is stale.");
    const event = append({
      aggregateId: `${projectId}:${principleId}`,
      type: "principle.reviewed",
      actor: input.actor,
      expectedVersion: current.version,
      data: { projectId, principleId, decision: input.decision, reason: input.reason ?? "" }
    });
    const next = Object.freeze({
      ...current,
      status: input.decision,
      version: event.aggregateVersion,
      approvedBy: input.decision === "approved" ? input.actor.id : null,
      approvedAt: input.decision === "approved" ? event.occurredAt : null,
      rejectedAt: input.decision === "rejected" ? event.occurredAt : null,
      feedback: input.reason ?? null,
      lastEventId: event.eventId
    });
    principles.set(getKey(projectId, principleId), next);
    idempotency.set(`${scope}\u0000${input.idempotencyKey}`, { fingerprint: valueFingerprint, value: { principle: copy(next), event: copy(event) } });
    return result(next, event, false);
  }

  function requestRework(input) {
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const projectId = assertIdentifier("projectId", input.projectId ?? "hero");
    const principleId = assertIdentifier("principleId", input.principleId);
    const feedback = typeof input.feedback === "string" ? input.feedback.trim() : "";
    if (feedback.length < 3 || feedback.length > 1000) throw new PrincipleCommandError("INVALID_INPUT", "Rework feedback is required.");
    const current = getPrinciple(projectId, principleId);
    const valueFingerprint = fingerprint({ projectId, principleId, feedback, expectedVersion: input.expectedVersion, actor: input.actor });
    const scope = `REWORK:${projectId}:${principleId}`;
    const replay = remember(scope, input.idempotencyKey, valueFingerprint, { principle: copy(current), event: null });
    if (replay.event) return replay;
    const expectedVersion = input.expectedVersion ?? current.version;
    if (expectedVersion !== current.version) throw new PrincipleCommandError("VERSION_CONFLICT", "Principle version is stale.");
    const event = append({
      aggregateId: `${projectId}:${principleId}`,
      type: "principle.rework-requested",
      actor: input.actor,
      expectedVersion: current.version,
      data: { projectId, principleId, feedback }
    });
    const next = Object.freeze({ ...current, status: "proposed", version: event.aggregateVersion, feedback, lastEventId: event.eventId });
    principles.set(getKey(projectId, principleId), next);
    idempotency.set(`${scope}\u0000${input.idempotencyKey}`, { fingerprint: valueFingerprint, value: { principle: copy(next), event: copy(event) } });
    return result(next, event, false);
  }

  function evaluate(input = {}) {
    const projectId = assertIdentifier("projectId", input.projectId ?? "hero");
    const controlPoint = input.controlPoint ?? "project-intake";
    if (!PRINCIPLE_CONTROL_POINTS.includes(controlPoint)) throw new PrincipleCommandError("INVALID_CONTROL_POINT", "Control point is not supported.");
    const relevant = [...principles.values()]
      .filter(principle => (principle.scope === "hero" || principle.projectId === projectId) && principle.controlPoints.includes(controlPoint))
      .sort((left, right) => left.principleId.localeCompare(right.principleId));
    const blockers = relevant.filter(principle => principle.status !== "approved").map(principle => ({
      principleId: principle.principleId,
      title: principle.title,
      status: principle.status,
      feedback: principle.feedback
    }));
    return Object.freeze({
      projectId,
      controlPoint,
      checkedCount: relevant.length,
      ready: blockers.length === 0,
      decisionCode: blockers.length === 0 ? "PRINCIPLES_READY" : "PRINCIPLES_NOT_SATISFIED",
      blockers: Object.freeze(blockers)
    });
  }

  function assertSatisfied(input) {
    const decision = evaluate(input);
    if (!decision.ready) throw new CriticalPrinciplesBlockedError(decision);
    return decision;
  }

  function list(projectId = "hero") {
    assertIdentifier("projectId", projectId);
    return Object.freeze([...principles.values()]
      .filter(principle => principle.scope === "hero" || principle.projectId === projectId)
      .sort((left, right) => left.principleId.localeCompare(right.principleId))
      .map(copy));
  }

  function snapshot() {
    return Object.freeze({
      contract: getCriticalPrinciplesContractSummary(),
      registryVersion: CRITICAL_PRINCIPLES_CONTRACT_VERSION,
      principles: list("hero"),
      projects: Object.freeze([...new Set([...principles.values()].filter(principle => principle.scope === "product").map(principle => principle.projectId))].sort()),
      sourceOfTruth: "versioned-principle-registry"
    });
  }

  function persistenceSnapshot() {
    return copy({
      schemaVersion: "1.0",
      registryId: "principles-registry",
      principles: [...principles.values()].map(copy)
    });
  }

  function hydrate(input = {}) {
    const state = input.data ?? input;
    if (!state || !Array.isArray(state.principles)) throw new PrincipleCommandError("HYDRATION_INVALID", "Principles registry hydration requires principles.");
    if (Array.isArray(input.events)) eventLog.load(input.events.filter(event => event.aggregateType === "principle"));
    principles.clear();
    for (const principle of state.principles) {
      if (!principle || typeof principle !== "object" || typeof principle.projectId !== "string" || typeof principle.principleId !== "string") throw new PrincipleCommandError("HYDRATION_INVALID", "A hydrated principle is invalid.");
      principles.set(getKey(principle.projectId, principle.principleId), copy(principle));
    }
    idempotency.clear();
    return copy({ registryId: "principles-registry", hydrated: true, principles: principles.size });
  }

  function history(projectId, principleId) {
    assertIdentifier("projectId", projectId ?? "hero");
    assertIdentifier("principleId", principleId);
    return Object.freeze(eventLog.readAggregate("principle", `${projectId}:${principleId}`));
  }

  return Object.freeze({
    define,
    review,
    requestRework,
    evaluate,
    assertSatisfied,
    get: (projectId, principleId) => copy(getPrinciple(projectId ?? "hero", principleId)),
    list,
    snapshot,
    persistenceSnapshot,
    hydrate,
    history,
    events: () => eventLog.readAfter(),
    contract: () => getCriticalPrinciplesContractSummary()
  });
}
