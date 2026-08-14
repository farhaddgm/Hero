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

export function createInMemoryEventLog() {
  const events = [];
  const eventIds = new Set();
  const versions = new Map();

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
      sequence: events.length + 1,
      aggregateVersion: actualVersion + 1
    });
    events.push(stored);
    eventIds.add(stored.eventId);
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

  return Object.freeze({ append, readAggregate, readAfter, currentVersion });
}
