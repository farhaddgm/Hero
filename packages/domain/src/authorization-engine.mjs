import {
  AUTHORIZATION_MODES,
  DEVELOPMENT_OPERATIONS,
  getAuthorizationContractSummary
} from "../../contracts/src/authorization.mjs";
import { SENSITIVE_ACTIONS, createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const AUDIT_AGGREGATE_ID = "AUTH-DISPATCH-AUDIT";

function immutableCopy(value) {
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
  if (typeof value !== "string" || value.length < 3 || value.length > 128) {
    throw new Error(`${label} must be a 3-128 character string.`);
  }
}

function assertActor(actor) {
  if (!actor || typeof actor !== "object") throw new Error("actor is required.");
  assertIdentifier("actor.kind", actor.kind);
  assertIdentifier("actor.id", actor.id);
}

function assertOwner(actor) {
  assertActor(actor);
  if (actor.kind !== "project-owner") throw new Error("Only project-owner may change authorization or global stop.");
}

function assertIdempotencyKey(value) {
  assertIdentifier("idempotencyKey", value);
}

function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("entries must contain at least one versioned step.");
  const seen = new Set();
  for (const entry of entries) {
    assertIdentifier("entry.stepId", entry?.stepId);
    assertIdentifier("entry.documentVersion", entry?.documentVersion);
    const key = `${entry.stepId}\u0000${entry.documentVersion}`;
    if (seen.has(key)) throw new Error("Snapshot entries must be unique by Step ID and document version.");
    seen.add(key);
  }
  return Object.freeze(entries.map(entry => Object.freeze({
    stepId: entry.stepId,
    documentVersion: entry.documentVersion
  })));
}

function validateOperations(operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error("operations must contain at least one development operation.");
  }
  const unique = [...new Set(operations)];
  if (unique.length !== operations.length) throw new Error("operations must not contain duplicates.");
  for (const operation of operations) {
    if (SENSITIVE_ACTIONS.includes(operation)) {
      throw new Error(`Sensitive operation ${operation} needs separate authorization.`);
    }
    if (!DEVELOPMENT_OPERATIONS.includes(operation)) {
      throw new Error(`Unsupported development operation: ${operation}.`);
    }
  }
  return Object.freeze([...operations]);
}

function commandResult(authorization, event, idempotent) {
  return Object.freeze({
    authorization: immutableCopy(authorization),
    event: immutableCopy(event),
    idempotent
  });
}

function decisionResult(decision, event, idempotent) {
  return Object.freeze({
    decision: immutableCopy(decision),
    event: immutableCopy(event),
    idempotent
  });
}

export class AuthorizationAlreadyExistsError extends Error {
  constructor(authorizationId) {
    super(`Authorization ${authorizationId} already exists.`);
    this.name = "AuthorizationAlreadyExistsError";
  }
}

export class AuthorizationVersionConflictError extends Error {
  constructor({ authorizationId, expectedVersion, actualVersion }) {
    super(`Authorization ${authorizationId} version conflict; expected ${expectedVersion}, received ${actualVersion}.`);
    this.name = "AuthorizationVersionConflictError";
  }
}

export class AuthorizationIdempotencyConflictError extends Error {
  constructor({ scope, idempotencyKey }) {
    super(`Idempotency key ${idempotencyKey} was already used with different input for ${scope}.`);
    this.name = "AuthorizationIdempotencyConflictError";
  }
}

export function createAuthorizationEngine(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  let nextEvent = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => {
    nextEvent += 1;
    return `evt_authorization_${String(nextEvent).padStart(6, "0")}`;
  });
  const authorizations = new Map();
  const idempotency = new Map();
  let globalStop = immutableCopy({ active: false, version: 0, lastEventId: null, activatedAt: null });

  function scopedKey(scope, key) {
    return `${scope}\u0000${key}`;
  }

  function replay(scope, key, inputFingerprint, mapper) {
    const existing = idempotency.get(scopedKey(scope, key));
    if (!existing) return null;
    if (existing.fingerprint !== inputFingerprint) {
      throw new AuthorizationIdempotencyConflictError({ scope, idempotencyKey: key });
    }
    return mapper(existing);
  }

  function remember(scope, key, inputFingerprint, value) {
    idempotency.set(scopedKey(scope, key), { fingerprint: inputFingerprint, ...value });
  }

  function appendEvent({ aggregateType, aggregateId, type, actor, occurredAt, data, expectedVersion }) {
    const event = createOperationalEvent({
      eventId: eventIdFactory(),
      aggregateType,
      aggregateId,
      type,
      occurredAt: occurredAt ?? now(),
      actor,
      data
    });
    return eventLog.append(event, { expectedVersion });
  }

  function grant(input) {
    assertIdentifier("authorizationId", input?.authorizationId);
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    if (!AUTHORIZATION_MODES.includes(input.mode)) throw new Error("Authorization mode is not supported.");
    const entries = validateEntries(input.entries);
    if (input.mode === "direct" && entries.length !== 1) {
      throw new Error("Direct authorization must bind exactly one Step ID and document version.");
    }
    const operations = validateOperations(input.operations);
    const valueFingerprint = fingerprint({
      mode: input.mode,
      entries,
      operations,
      actor: input.actor,
      note: input.note
    });
    const replayed = replay(input.authorizationId, input.idempotencyKey, valueFingerprint, existing =>
      commandResult(existing.authorization, existing.event, true)
    );
    if (replayed) return replayed;
    if (authorizations.has(input.authorizationId)) throw new AuthorizationAlreadyExistsError(input.authorizationId);

    const storedEvent = appendEvent({
      aggregateType: "authorization",
      aggregateId: input.authorizationId,
      type: "authorization.granted",
      actor: input.actor,
      occurredAt: input.occurredAt,
      expectedVersion: 0,
      data: {
        grantId: input.authorizationId,
        mode: input.mode,
        entries,
        operations,
        ...(input.note === undefined ? {} : { note: input.note })
      }
    });
    const authorization = immutableCopy({
      authorizationId: input.authorizationId,
      mode: input.mode,
      entries,
      operations,
      status: "active",
      grantedBy: input.actor.id,
      grantedAt: storedEvent.occurredAt,
      version: storedEvent.aggregateVersion,
      lastEventId: storedEvent.eventId,
      revokedAt: null,
      revokedBy: null
    });
    authorizations.set(input.authorizationId, authorization);
    remember(input.authorizationId, input.idempotencyKey, valueFingerprint, { authorization, event: storedEvent });
    return commandResult(authorization, storedEvent, false);
  }

  function revoke(input) {
    assertIdentifier("authorizationId", input?.authorizationId);
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const authorization = authorizations.get(input.authorizationId);
    if (!authorization) throw new Error(`Authorization ${input.authorizationId} does not exist.`);
    const valueFingerprint = fingerprint({ actor: input.actor, reason: input.reason });
    const replayed = replay(input.authorizationId, input.idempotencyKey, valueFingerprint, existing =>
      commandResult(existing.authorization, existing.event, true)
    );
    if (replayed) return replayed;
    if (authorization.status !== "active") throw new Error("Authorization is not active.");
    const expectedVersion = input.expectedVersion ?? authorization.version;
    if (expectedVersion !== authorization.version) {
      throw new AuthorizationVersionConflictError({
        authorizationId: authorization.authorizationId,
        expectedVersion,
        actualVersion: authorization.version
      });
    }
    const storedEvent = appendEvent({
      aggregateType: "authorization",
      aggregateId: authorization.authorizationId,
      type: "authorization.revoked",
      actor: input.actor,
      occurredAt: input.occurredAt,
      expectedVersion: authorization.version,
      data: {
        grantId: authorization.authorizationId,
        reason: input.reason ?? "owner-revocation"
      }
    });
    const revoked = immutableCopy({
      ...authorization,
      status: "revoked",
      version: storedEvent.aggregateVersion,
      lastEventId: storedEvent.eventId,
      revokedAt: storedEvent.occurredAt,
      revokedBy: input.actor.id
    });
    authorizations.set(revoked.authorizationId, revoked);
    remember(revoked.authorizationId, input.idempotencyKey, valueFingerprint, { authorization: revoked, event: storedEvent });
    return commandResult(revoked, storedEvent, false);
  }

  function setGlobalStop(input, active) {
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const scope = "GLOBAL-STOP";
    const valueFingerprint = fingerprint({ active, actor: input.actor, reason: input.reason });
    const replayed = replay(scope, input.idempotencyKey, valueFingerprint, existing =>
      Object.freeze({ globalStop: immutableCopy(existing.globalStop), event: immutableCopy(existing.event), idempotent: true })
    );
    if (replayed) return replayed;
    if (globalStop.active === active) throw new Error(active ? "Global Stop is already active." : "Global Stop is already clear.");
    const storedEvent = appendEvent({
      aggregateType: "authorization",
      aggregateId: scope,
      type: active ? "authorization.global-stop-activated" : "authorization.global-stop-cleared",
      actor: input.actor,
      occurredAt: input.occurredAt,
      expectedVersion: globalStop.version,
      data: {
        scope: "new-dispatch",
        active,
        ...(input.reason === undefined ? {} : { reason: input.reason })
      }
    });
    globalStop = immutableCopy({
      active,
      version: storedEvent.aggregateVersion,
      lastEventId: storedEvent.eventId,
      activatedAt: active ? storedEvent.occurredAt : null
    });
    const output = Object.freeze({ globalStop: immutableCopy(globalStop), event: immutableCopy(storedEvent), idempotent: false });
    remember(scope, input.idempotencyKey, valueFingerprint, { globalStop, event: storedEvent });
    return output;
  }

  function recordDecision(input, decision) {
    const event = appendEvent({
      aggregateType: "decision",
      aggregateId: AUDIT_AGGREGATE_ID,
      type: decision.authorized ? "authorization.dispatch-authorized" : "authorization.dispatch-blocked",
      actor: input.actor,
      occurredAt: input.occurredAt,
      expectedVersion: eventLog.currentVersion("decision", AUDIT_AGGREGATE_ID),
      data: {
        grantId: input.authorizationId ?? "none",
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        operation: input.operation,
        decisionCode: decision.code,
        globalStop: globalStop.active
      }
    });
    return event;
  }

  function evaluateDispatch(input) {
    assertActor(input?.actor);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion);
    assertIdentifier("operation", input?.operation);
    assertIdempotencyKey(input?.idempotencyKey);
    const scope = `DISPATCH:${input.authorizationId ?? "none"}`;
    const valueFingerprint = fingerprint({
      authorizationId: input.authorizationId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      operation: input.operation,
      expectedVersion: input.expectedVersion,
      actor: input.actor
    });
    const replayed = replay(scope, input.idempotencyKey, valueFingerprint, existing =>
      decisionResult(existing.decision, existing.event, true)
    );
    if (replayed) return replayed;

    const authorization = typeof input.authorizationId === "string" ? authorizations.get(input.authorizationId) : null;
    let code = "AUTHORIZED";
    if (globalStop.active) code = "GLOBAL_STOP_ACTIVE";
    else if (SENSITIVE_ACTIONS.includes(input.operation)) code = "SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL";
    else if (!authorization) code = "AUTHORIZATION_NOT_FOUND";
    else if (authorization.status !== "active") code = "AUTHORIZATION_NOT_ACTIVE";
    else if (input.expectedVersion !== undefined && input.expectedVersion !== authorization.version) {
      code = "AUTHORIZATION_VERSION_CONFLICT";
    } else if (!authorization.operations.includes(input.operation)) code = "OPERATION_NOT_GRANTED";
    else if (!authorization.entries.some(entry =>
      entry.stepId === input.stepId && entry.documentVersion === input.documentVersion
    )) code = "SNAPSHOT_ENTRY_NOT_FOUND";

    const decision = immutableCopy({
      authorized: code === "AUTHORIZED",
      code,
      authorizationId: input.authorizationId ?? null,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      operation: input.operation,
      authorizationVersion: authorization?.version ?? null,
      globalStop: globalStop.active,
      safeCheckpointRequired: globalStop.active
    });
    const event = recordDecision(input, decision);
    remember(scope, input.idempotencyKey, valueFingerprint, { decision, event });
    return decisionResult(decision, event, false);
  }

  function get(authorizationId) {
    const authorization = authorizations.get(authorizationId);
    return authorization ? immutableCopy(authorization) : null;
  }

  function getGlobalStop() {
    return immutableCopy(globalStop);
  }

  function audit() {
    return Object.freeze(eventLog.readAfter().filter(event => event.type.startsWith("authorization.")));
  }

  return Object.freeze({
    grant,
    revoke,
    activateGlobalStop: input => setGlobalStop(input, true),
    clearGlobalStop: input => setGlobalStop(input, false),
    evaluateDispatch,
    get,
    getGlobalStop,
    audit,
    contract: () => getAuthorizationContractSummary()
  });
}
