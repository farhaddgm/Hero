import { validateOperationalEvent } from "../../contracts/src/operational-data.mjs";

const AI_AGGREGATE_TYPES = new Set(["ai-provider", "ai-model", "ai-profile", "ai-binding", "ai-invocation", "ai-evaluation", "ai-decision"]);
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new AiProjectionStoreError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function assertAiEvent(event) {
  const errors = validateOperationalEvent(event);
  if (errors.length > 0) throw new AiProjectionStoreError("INVALID_EVENT", errors.join(" "));
  if (!AI_AGGREGATE_TYPES.has(event.aggregateType)) throw new AiProjectionStoreError("INVALID_AI_AGGREGATE", "Only AI orchestration aggregates may use this store.");
}

export class AiProjectionStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AiProjectionStoreError";
    this.code = code;
  }
}

/**
 * Keeps AI operational records on Hero's existing append-only event store.
 * SQL projections can be rebuilt from these events; no second source of truth is introduced.
 */
export function createAiProjectionStore({ store, topic = "hero.ai.projection" } = {}) {
  if (!store || typeof store.appendEvent !== "function" || typeof store.readAfter !== "function" || typeof store.readAggregate !== "function") {
    throw new AiProjectionStoreError("STORE_INVALID", "An operational event store is required.");
  }
  assertIdentifier("topic", topic);
  return Object.freeze({
    async append(event, { expectedVersion = 0, outboxId = `outbox-${event.eventId}` } = {}) {
      assertAiEvent(event);
      assertIdentifier("outboxId", outboxId);
      const stored = await store.appendEvent(event, { expectedVersion, outbox: { outboxId, topic } });
      return copy(stored);
    },
    async readAggregate(aggregateType, aggregateId) {
      if (!AI_AGGREGATE_TYPES.has(aggregateType)) throw new AiProjectionStoreError("INVALID_AI_AGGREGATE", "Only AI orchestration aggregates may be read.");
      assertIdentifier("aggregateId", aggregateId);
      return Object.freeze((await store.readAggregate(aggregateType, aggregateId)).map(copy));
    },
    async readAfter(sequence = 0) {
      const events = await store.readAfter(sequence);
      return Object.freeze(events.filter(event => AI_AGGREGATE_TYPES.has(event.aggregateType)).map(copy));
    },
    async rebuild({ after = 0, apply } = {}) {
      if (typeof apply !== "function") throw new AiProjectionStoreError("PROJECTOR_INVALID", "rebuild requires an apply function.");
      const events = await this.readAfter(after);
      for (const event of events) await apply(event);
      return Object.freeze({ applied: events.length, after: events.at(-1)?.sequence ?? after, source: "append-only-events" });
    }
  });
}
