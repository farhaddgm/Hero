import { validateOperationalEvent } from "../../contracts/src/operational-data.mjs";

function aggregateKey(event) {
  return `${event.aggregateType}:${event.aggregateId}`;
}

function immutableCopy(value) {
  return Object.freeze(structuredClone(value));
}

export class AggregateVersionConflictError extends Error {
  constructor({ aggregateType, aggregateId, expectedVersion, actualVersion }) {
    super(
      `Aggregate version conflict for ${aggregateType}:${aggregateId}; ` +
      `expected ${expectedVersion}, received ${actualVersion}.`
    );
    this.name = "AggregateVersionConflictError";
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class DuplicateEventError extends Error {
  constructor(eventId) {
    super(`Event ${eventId} already exists.`);
    this.name = "DuplicateEventError";
  }
}

export function createInMemoryEventLog({ events: initialEvents = [] } = {}) {
  const events = [];
  const eventIds = new Set();
  const sequences = new Set();
  const versions = new Map();
  let nextSequence = 0;

  function load(initial = []) {
    if (!Array.isArray(initial)) throw new TypeError("Event log hydration requires an array of events.");
    for (const event of initial) {
      const errors = validateOperationalEvent(event);
      if (errors.length > 0) throw new Error(`Invalid hydrated operational event: ${errors.join(" ")}`);
      if (eventIds.has(event.eventId)) throw new DuplicateEventError(event.eventId);
      const key = aggregateKey(event);
      const actualVersion = versions.get(key) ?? 0;
      if (event.aggregateVersion !== actualVersion + 1) {
        throw new AggregateVersionConflictError({
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          expectedVersion: actualVersion + 1,
          actualVersion: event.aggregateVersion
        });
      }
      const sequence = event.sequence ?? events.length + 1;
      if (!Number.isInteger(sequence) || sequence < 1) throw new Error("Hydrated event sequence must be a positive integer.");
      if (sequences.has(sequence)) throw new Error(`Hydrated event sequence ${sequence} already exists.`);
      const stored = immutableCopy({ ...event, sequence });
      events.push(stored);
      eventIds.add(stored.eventId);
      sequences.add(sequence);
      versions.set(key, stored.aggregateVersion);
      nextSequence = Math.max(nextSequence, sequence);
    }
    events.sort((left, right) => left.sequence - right.sequence);
    return events.length;
  }

  load(initialEvents);

  function append(event, { expectedVersion = 0 } = {}) {
    const errors = validateOperationalEvent(event);
    if (errors.length > 0) throw new Error(`Invalid operational event: ${errors.join(" ")}`);
    if (eventIds.has(event.eventId)) throw new DuplicateEventError(event.eventId);

    const key = aggregateKey(event);
    const actualVersion = versions.get(key) ?? 0;
    if (expectedVersion !== actualVersion) {
      throw new AggregateVersionConflictError({
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        expectedVersion,
        actualVersion
      });
    }

    const stored = immutableCopy({
      ...event,
      sequence: ++nextSequence,
      aggregateVersion: actualVersion + 1
    });
    events.push(stored);
    eventIds.add(stored.eventId);
    sequences.add(stored.sequence);
    versions.set(key, stored.aggregateVersion);
    return stored;
  }

  function readAggregate(aggregateType, aggregateId) {
    return Object.freeze(
      events.filter(event => event.aggregateType === aggregateType && event.aggregateId === aggregateId)
    );
  }

  function readAfter(sequence = 0) {
    return Object.freeze(events.filter(event => event.sequence > sequence));
  }

  function currentVersion(aggregateType, aggregateId) {
    return versions.get(`${aggregateType}:${aggregateId}`) ?? 0;
  }

  return Object.freeze({ append, readAggregate, readAfter, currentVersion, load });
}
