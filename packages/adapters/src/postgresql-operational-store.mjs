import { validateOperationalEvent } from "../../contracts/src/operational-data.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const TOPIC = /^[a-z][a-z0-9._:-]{2,127}$/;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function parseJson(value, label) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new PostgresOperationalStoreError("INVALID_DATABASE_ROW", `${label} is not valid JSON.`);
  }
}

function assertDatabaseTarget({ client, pool }) {
  if (client && typeof client.query === "function") return;
  if (pool && typeof pool.query === "function" && typeof pool.connect === "function") return;
  throw new Error("PostgreSQL operational store requires an injected client.query or pool.query/connect.");
}

function assertInteger(label, value, minimum = 0) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum) {
    throw new PostgresOperationalStoreError("INVALID_DATABASE_ROW", `${label} must be a valid integer.`);
  }
  return number;
}

function rowToEvent(row) {
  const event = {
    eventId: row.event_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    type: row.event_type,
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
    actor: { kind: row.actor_kind, id: row.actor_id },
    correlationId: row.correlation_id ?? undefined,
    causationId: row.causation_id ?? undefined,
    data: parseJson(row.data, "events.data"),
    schemaVersion: row.schema_version,
    sequence: assertInteger("events.sequence", row.sequence, 1),
    aggregateVersion: assertInteger("events.aggregate_version", row.aggregate_version, 1)
  };
  const errors = validateOperationalEvent(event);
  if (errors.length > 0) throw new PostgresOperationalStoreError("INVALID_DATABASE_ROW", errors.join(" "));
  return copy(event);
}

export class PostgresOperationalStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PostgresOperationalStoreError";
    this.code = code;
  }
}

export class PostgresAggregateVersionConflictError extends PostgresOperationalStoreError {
  constructor({ aggregateType, aggregateId, expectedVersion, actualVersion }) {
    super(
      "AGGREGATE_VERSION_CONFLICT",
      `Aggregate version conflict for ${aggregateType}:${aggregateId}; expected ${expectedVersion}, received ${actualVersion}.`
    );
    this.aggregateType = aggregateType;
    this.aggregateId = aggregateId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

function normalizeExpectedVersion(value) {
  return assertInteger("expectedVersion", value ?? 0);
}

function normalizeOutbox(outbox) {
  if (outbox === undefined || outbox === null) return null;
  if (!IDENTIFIER.test(outbox.outboxId ?? "")) {
    throw new PostgresOperationalStoreError("INVALID_OUTBOX", "outboxId is invalid.");
  }
  if (!TOPIC.test(outbox.topic ?? "")) {
    throw new PostgresOperationalStoreError("INVALID_OUTBOX", "outbox topic is invalid.");
  }
  return { outboxId: outbox.outboxId, topic: outbox.topic };
}

export function createPostgresOperationalStore({ client, pool } = {}) {
  assertDatabaseTarget({ client, pool });
  const readTarget = client ?? pool;

  async function transaction(work) {
    if (client) {
      await client.query("BEGIN");
      try {
        const value = await work(client);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original operation error.
        }
        throw error;
      }
    }

    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      const value = await work(connection);
      await connection.query("COMMIT");
      return value;
    } catch (error) {
      try {
        await connection.query("ROLLBACK");
      } catch {
        // Preserve the original operation error.
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async function currentVersion(aggregateType, aggregateId, target = readTarget) {
    const result = await target.query(
      "SELECT COALESCE(MAX(aggregate_version), 0) AS version FROM events WHERE aggregate_type = $1 AND aggregate_id = $2",
      [aggregateType, aggregateId]
    );
    return assertInteger("aggregate version", result.rows?.[0]?.version, 0);
  }

  return Object.freeze({
    async appendEvent(event, { expectedVersion = 0, outbox } = {}) {
      const errors = validateOperationalEvent(event);
      if (errors.length > 0) throw new PostgresOperationalStoreError("INVALID_EVENT", errors.join(" "));
      const expected = normalizeExpectedVersion(expectedVersion);
      const normalizedOutbox = normalizeOutbox(outbox);

      return transaction(async target => {
        await target.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [`${event.aggregateType}:${event.aggregateId}`]
        );
        const actual = await currentVersion(event.aggregateType, event.aggregateId, target);
        if (actual !== expected) {
          throw new PostgresAggregateVersionConflictError({
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            expectedVersion: expected,
            actualVersion: actual
          });
        }
        const aggregateVersion = actual + 1;
        const inserted = await target.query(
          `INSERT INTO events (
             event_id, aggregate_type, aggregate_id, aggregate_version, event_type,
             occurred_at, actor_kind, actor_id, correlation_id, causation_id,
             data, schema_version
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING sequence`,
          [
            event.eventId,
            event.aggregateType,
            event.aggregateId,
            aggregateVersion,
            event.type,
            event.occurredAt,
            event.actor.kind,
            event.actor.id,
            event.correlationId ?? null,
            event.causationId ?? null,
            event.data,
            event.schemaVersion
          ]
        );
        const sequence = assertInteger("events.sequence", inserted.rows?.[0]?.sequence, 1);
        const stored = copy({ ...event, sequence, aggregateVersion });
        if (normalizedOutbox) {
          await target.query(
            `INSERT INTO outbox (outbox_id, event_id, topic, payload)
             VALUES ($1, $2, $3, $4)`,
            [normalizedOutbox.outboxId, event.eventId, normalizedOutbox.topic, stored]
          );
        }
        return stored;
      });
    },

    async readAggregate(aggregateType, aggregateId) {
      const result = await readTarget.query(
        `SELECT sequence, event_id, aggregate_type, aggregate_id, aggregate_version,
                event_type, occurred_at, actor_kind, actor_id, correlation_id,
                causation_id, data, schema_version
           FROM events
          WHERE aggregate_type = $1 AND aggregate_id = $2
          ORDER BY aggregate_version ASC`,
        [aggregateType, aggregateId]
      );
      return Object.freeze((result.rows ?? []).map(rowToEvent));
    },

    async readAfter(sequence = 0) {
      const after = assertInteger("sequence", sequence, 0);
      const result = await readTarget.query(
        `SELECT sequence, event_id, aggregate_type, aggregate_id, aggregate_version,
                event_type, occurred_at, actor_kind, actor_id, correlation_id,
                causation_id, data, schema_version
           FROM events
          WHERE sequence > $1
          ORDER BY sequence ASC`,
        [after]
      );
      return Object.freeze((result.rows ?? []).map(rowToEvent));
    },

    currentVersion
  });
}
