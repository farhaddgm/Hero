import { createHash } from "node:crypto";

import {
  BACKOFFICE_FOUNDATION_CONTRACT_VERSION,
  assertBackofficeStableId,
  validateBackofficeEntityVersion,
  validateBackofficeEventEnvelope
} from "../../contracts/src/backoffice-foundation.mjs";

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function digestBackofficeValue(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function createBackofficeEntityVersion(input) {
  const entity = {
    entityType: input.entityType,
    entityId: input.entityId,
    projectId: input.projectId ?? null,
    schemaVersion: input.schemaVersion ?? BACKOFFICE_FOUNDATION_CONTRACT_VERSION,
    version: input.version,
    lifecycle: input.lifecycle ?? "active",
    data: structuredClone(input.data ?? {}),
    recordedAt: input.recordedAt ?? new Date().toISOString()
  };
  const errors = validateBackofficeEntityVersion(entity);
  if (errors.length > 0) throw new Error(`Invalid Back Office entity version: ${errors.join(" ")}`);
  return copy(entity);
}

export function createBackofficeEventEnvelope(input) {
  const event = {
    eventId: input.eventId,
    schemaVersion: input.schemaVersion ?? BACKOFFICE_FOUNDATION_CONTRACT_VERSION,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateVersion: input.aggregateVersion,
    type: input.type,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    actor: { kind: input.actor?.kind, id: input.actor?.id },
    projectId: input.projectId ?? null,
    correlationId: input.correlationId,
    causationId: input.causationId ?? null,
    idempotencyKey: input.idempotencyKey,
    data: structuredClone(input.data ?? {})
  };
  const errors = validateBackofficeEventEnvelope(event);
  if (errors.length > 0) throw new Error(`Invalid Back Office event envelope: ${errors.join(" ")}`);
  return copy(event);
}

export class IdempotencyConflictError extends Error {
  constructor(idempotencyKey) {
    super(`Idempotency key ${idempotencyKey} was already used with a different event.`);
    this.name = "IdempotencyConflictError";
    this.idempotencyKey = idempotencyKey;
  }
}

/**
 * A deterministic Inbox boundary. Durable adapters can persist the same key
 * and digest using the foundation migration; this implementation makes the
 * once-only and replay semantics executable without a database.
 */
export function createIdempotentEventConsumer({ consumerId = "backoffice-read-model" } = {}) {
  assertBackofficeStableId("correlation", consumerId);
  const processed = new Map();

  return Object.freeze({
    async consume(event, handler) {
      const errors = validateBackofficeEventEnvelope(event);
      if (errors.length > 0) throw new Error(`Invalid Inbox event: ${errors.join(" ")}`);
      if (typeof handler !== "function") throw new TypeError("Inbox handler must be a function.");
      const fingerprint = digestBackofficeValue(event);
      const existing = processed.get(event.idempotencyKey);
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new IdempotencyConflictError(event.idempotencyKey);
        return copy({ ...existing.result, replayed: true });
      }
      const value = await handler(copy(event));
      const result = { consumerId, eventId: event.eventId, idempotencyKey: event.idempotencyKey, value: value ?? null, replayed: false };
      processed.set(event.idempotencyKey, { fingerprint, result: copy(result) });
      return copy(result);
    },
    has(idempotencyKey) {
      return processed.has(idempotencyKey);
    },
    size() {
      return processed.size;
    }
  });
}
