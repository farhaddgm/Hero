import { digestBackofficeValue } from "../../domain/src/backoffice-event-envelope.mjs";
import {
  assertBackofficeStableId,
  validateBackofficeEntityVersion,
  validateBackofficeEventEnvelope
} from "../../contracts/src/backoffice-foundation.mjs";

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function parseJson(value, label) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new BackofficeFoundationStoreError("INVALID_DATABASE_ROW", `${label} is not valid JSON.`);
  }
}

function assertDatabaseTarget({ client, pool }) {
  if (client && typeof client.query === "function") return;
  if (pool && typeof pool.query === "function" && typeof pool.connect === "function") return;
  throw new Error("Back Office foundation store requires an injected client.query or pool.query/connect.");
}

function assertDigest(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new BackofficeFoundationStoreError("INVALID_DIGEST", "digest must be a lowercase SHA-256 hex value.");
  return value;
}

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const TOPIC = /^[a-z][a-z0-9._:-]{2,127}$/;

function normalizeOutbox(outbox) {
  if (outbox === undefined || outbox === null) return null;
  if (typeof outbox.outboxId !== "string" || !IDENTIFIER.test(outbox.outboxId)) throw new BackofficeFoundationStoreError("INVALID_OUTBOX", "outboxId is invalid.");
  if (typeof outbox.topic !== "string" || !TOPIC.test(outbox.topic)) throw new BackofficeFoundationStoreError("INVALID_OUTBOX", "outbox topic is invalid.");
  return { outboxId: outbox.outboxId, topic: outbox.topic };
}

function normalizePositiveInteger(label, value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new BackofficeFoundationStoreError("INVALID_OUTBOX", `${label} must be between ${minimum} and ${maximum}.`);
  return number;
}

function rowToOutbox(row) {
  if (!row) return null;
  return copy({
    outboxId: row.outbox_id,
    eventId: row.event_id,
    topic: row.topic,
    payload: parseJson(row.payload, "backoffice_outbox.payload"),
    status: row.status,
    attemptCount: Number(row.attempt_count ?? 0),
    lockedAt: row.locked_at instanceof Date ? row.locked_at.toISOString() : row.locked_at ?? null,
    lastError: row.last_error ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    publishedAt: row.published_at instanceof Date ? row.published_at.toISOString() : row.published_at ?? null
  });
}

function rowToInbox(row, replayed) {
  return copy({
    consumerId: row.consumer_id,
    idempotencyKey: row.idempotency_key,
    eventId: row.event_id,
    eventDigest: row.event_digest,
    result: parseJson(row.result, "inbox result"),
    processedAt: row.processed_at instanceof Date ? row.processed_at.toISOString() : row.processed_at,
    replayed
  });
}

function rowToSnapshot(row) {
  return copy({
    modelId: row.model_id,
    scopeId: row.scope_id,
    modelVersion: row.model_version,
    sourceSequence: Number(row.source_sequence),
    digest: row.digest,
    data: parseJson(row.data, "read model data"),
    rebuiltAt: row.rebuilt_at instanceof Date ? row.rebuilt_at.toISOString() : row.rebuilt_at
  });
}

export class BackofficeFoundationStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BackofficeFoundationStoreError";
    this.code = code;
  }
}

export class BackofficeAggregateVersionConflictError extends BackofficeFoundationStoreError {
  constructor({ aggregateType, aggregateId, expectedVersion, actualVersion }) {
    super("AGGREGATE_VERSION_CONFLICT", `Aggregate version conflict for ${aggregateType}:${aggregateId}; expected ${expectedVersion}, received ${actualVersion}.`);
    this.aggregateType = aggregateType;
    this.aggregateId = aggregateId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class BackofficeEntityVersionConflictError extends BackofficeFoundationStoreError {
  constructor({ entityType, entityId, expectedVersion, actualVersion }) {
    super("ENTITY_VERSION_CONFLICT", `Entity version conflict for ${entityType}:${entityId}; expected ${expectedVersion}, received ${actualVersion}.`);
    this.entityType = entityType;
    this.entityId = entityId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export function createPostgresBackofficeFoundationStore({ client, pool } = {}) {
  assertDatabaseTarget({ client, pool });
  const readTarget = client ?? pool;

  async function transaction(work) {
    if (client) {
      await client.query("BEGIN");
      try {
        const result = await work(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
        throw error;
      }
    }
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      const result = await work(connection);
      await connection.query("COMMIT");
      return result;
    } catch (error) {
      try { await connection.query("ROLLBACK"); } catch { /* preserve original error */ }
      throw error;
    } finally {
      connection.release();
    }
  }

  return Object.freeze({
    async appendEntityVersion(entity) {
      const errors = validateBackofficeEntityVersion(entity);
      if (errors.length > 0) throw new BackofficeFoundationStoreError("INVALID_ENTITY", errors.join(" "));
      return transaction(async target => {
        await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`entity:${entity.entityType}:${entity.entityId}`]);
        const current = await target.query(
          "SELECT COALESCE(MAX(entity_version), 0) AS version FROM backoffice_entity_versions WHERE entity_type = $1 AND entity_id = $2",
          [entity.entityType, entity.entityId]
        );
        const actualVersion = Number(current.rows?.[0]?.version ?? 0);
        if (actualVersion !== entity.version - 1) throw new BackofficeEntityVersionConflictError({ entityType: entity.entityType, entityId: entity.entityId, expectedVersion: entity.version - 1, actualVersion });
        await target.query(
          `INSERT INTO backoffice_entity_versions
            (entity_type, entity_id, project_id, schema_version, entity_version, lifecycle, data, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [entity.entityType, entity.entityId, entity.projectId ?? null, entity.schemaVersion, entity.version, entity.lifecycle, entity.data, entity.recordedAt]
        );
        return copy(entity);
      });
    },

    async appendEventEnvelope(event, { outbox } = {}) {
      const errors = validateBackofficeEventEnvelope(event);
      if (errors.length > 0) throw new BackofficeFoundationStoreError("INVALID_EVENT", errors.join(" "));
      const normalizedOutbox = normalizeOutbox(outbox);
      return transaction(async target => {
        await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`event:${event.aggregateType}:${event.aggregateId}`]);
        const current = await target.query(
          "SELECT COALESCE(MAX(aggregate_version), 0) AS version FROM backoffice_event_envelopes WHERE aggregate_type = $1 AND aggregate_id = $2",
          [event.aggregateType, event.aggregateId]
        );
        const actualVersion = Number(current.rows?.[0]?.version ?? 0);
        if (actualVersion !== event.aggregateVersion - 1) throw new BackofficeAggregateVersionConflictError({ aggregateType: event.aggregateType, aggregateId: event.aggregateId, expectedVersion: event.aggregateVersion - 1, actualVersion });
        await target.query(
          `INSERT INTO backoffice_event_envelopes
            (event_id, schema_version, aggregate_type, aggregate_id, aggregate_version, event_type,
             occurred_at, actor_kind, actor_id, project_id, correlation_id, causation_id, idempotency_key, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [event.eventId, event.schemaVersion, event.aggregateType, event.aggregateId, event.aggregateVersion, event.type, event.occurredAt, event.actor.kind, event.actor.id, event.projectId ?? null, event.correlationId, event.causationId ?? null, event.idempotencyKey, event.data]
        );
        if (normalizedOutbox) {
          await target.query(
            `INSERT INTO backoffice_outbox (outbox_id, event_id, topic, payload)
             VALUES ($1, $2, $3, $4)`,
            [normalizedOutbox.outboxId, event.eventId, normalizedOutbox.topic, event]
          );
        }
        return copy(event);
      });
    },

    async recordInboxReceipt({ consumerId, event, result = {} }) {
      assertBackofficeStableId("correlation", consumerId);
      const errors = validateBackofficeEventEnvelope(event);
      if (errors.length > 0) throw new BackofficeFoundationStoreError("INVALID_EVENT", errors.join(" "));
      const digest = digestBackofficeValue(event);
      return transaction(async target => {
        const inserted = await target.query(
          `INSERT INTO backoffice_inbox_receipts
            (consumer_id, idempotency_key, event_id, event_digest, result)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (consumer_id, idempotency_key) DO NOTHING
           RETURNING consumer_id, idempotency_key, event_id, event_digest, result, processed_at`,
          [consumerId, event.idempotencyKey, event.eventId, digest, result]
        );
        if (inserted.rows?.[0]) return rowToInbox(inserted.rows[0], false);
        const existing = await target.query(
          `SELECT consumer_id, idempotency_key, event_id, event_digest, result, processed_at
             FROM backoffice_inbox_receipts
            WHERE consumer_id = $1 AND idempotency_key = $2`,
          [consumerId, event.idempotencyKey]
        );
        const row = existing.rows?.[0];
        if (!row) throw new BackofficeFoundationStoreError("INBOX_RACE", "Inbox receipt disappeared after conflict.");
        if (row.event_digest !== digest) throw new BackofficeFoundationStoreError("IDEMPOTENCY_CONFLICT", "Idempotency key was used with a different event.");
        return rowToInbox(row, true);
      });
    },

    async saveReadModelSnapshot({ modelId, scopeId, modelVersion, sourceSequence, digest, data }) {
      assertBackofficeStableId("correlation", modelId);
      assertBackofficeStableId("project", scopeId);
      assertDigest(digest);
      if (!Number.isInteger(sourceSequence) || sourceSequence < 0) throw new BackofficeFoundationStoreError("INVALID_SNAPSHOT", "sourceSequence must be a non-negative integer.");
      await readTarget.query(
        `INSERT INTO backoffice_read_model_snapshots
          (model_id, scope_id, model_version, source_sequence, digest, data)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [modelId, scopeId, modelVersion, sourceSequence, digest, data]
      );
      return copy({ modelId, scopeId, modelVersion, sourceSequence, digest, data });
    },

    async readReadModelSnapshot({ modelId, scopeId, modelVersion, sourceSequence } = {}) {
      assertBackofficeStableId("correlation", modelId);
      assertBackofficeStableId("project", scopeId);
      const result = await readTarget.query(
        `SELECT model_id, scope_id, model_version, source_sequence, digest, data, rebuilt_at
           FROM backoffice_read_model_snapshots
          WHERE model_id = $1 AND scope_id = $2 AND model_version = $3
            AND ($4::bigint IS NULL OR source_sequence = $4)
          ORDER BY source_sequence DESC
          LIMIT 1`,
        [modelId, scopeId, modelVersion, sourceSequence ?? null]
      );
      const row = result.rows?.[0];
      return row ? rowToSnapshot(row) : null;
    },

    async claimOutbox({ limit = 10, leaseSeconds = 300 } = {}) {
      const normalizedLimit = normalizePositiveInteger("limit", limit, 1, 100);
      const normalizedLease = normalizePositiveInteger("leaseSeconds", leaseSeconds, 1, 86_400);
      return transaction(async target => {
        const result = await target.query(
          `WITH candidates AS (
             SELECT outbox_id
               FROM backoffice_outbox
              WHERE status = 'pending'
                 OR (status = 'processing' AND (locked_at IS NULL OR locked_at < now() - ($2 * interval '1 second')))
              ORDER BY created_at ASC, outbox_id ASC
              FOR UPDATE SKIP LOCKED
              LIMIT $1
           )
           UPDATE backoffice_outbox AS item
              SET status = 'processing', attempt_count = item.attempt_count + 1, locked_at = now()
             FROM candidates
            WHERE item.outbox_id = candidates.outbox_id
           RETURNING item.outbox_id, item.event_id, item.topic, item.payload, item.status,
                     item.attempt_count, item.locked_at, item.last_error, item.created_at, item.published_at`,
          [normalizedLimit, normalizedLease]
        );
        return Object.freeze((result.rows ?? []).map(rowToOutbox));
      });
    },

    async acknowledgeOutbox(outboxId) {
      if (typeof outboxId !== "string" || !IDENTIFIER.test(outboxId)) throw new BackofficeFoundationStoreError("INVALID_OUTBOX", "outboxId is invalid.");
      const result = await readTarget.query(
        `UPDATE backoffice_outbox
            SET status = 'published', published_at = COALESCE(published_at, now()), locked_at = NULL, last_error = NULL
          WHERE outbox_id = $1 AND status = 'processing'
        RETURNING outbox_id, event_id, topic, payload, status, attempt_count, locked_at, last_error, created_at, published_at`,
        [outboxId]
      );
      return rowToOutbox(result.rows?.[0]);
    },

    async failOutbox(outboxId, error, { maxAttempts = 5 } = {}) {
      if (typeof outboxId !== "string" || !IDENTIFIER.test(outboxId)) throw new BackofficeFoundationStoreError("INVALID_OUTBOX", "outboxId is invalid.");
      const normalizedMaxAttempts = normalizePositiveInteger("maxAttempts", maxAttempts, 1, 100);
      const message = String(error?.message ?? error ?? "backoffice outbox delivery failed").trim().slice(0, 500);
      const result = await readTarget.query(
        `UPDATE backoffice_outbox
            SET status = CASE WHEN attempt_count >= $2 THEN 'failed' ELSE 'pending' END,
                locked_at = NULL, last_error = $3
          WHERE outbox_id = $1 AND status = 'processing'
        RETURNING outbox_id, event_id, topic, payload, status, attempt_count, locked_at, last_error, created_at, published_at`,
        [outboxId, normalizedMaxAttempts, message || "backoffice outbox delivery failed"]
      );
      return rowToOutbox(result.rows?.[0]);
    }
  });
}
