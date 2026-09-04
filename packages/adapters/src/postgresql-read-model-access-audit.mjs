import { randomUUID } from "node:crypto";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{1,127}$/;
const ACTOR_KINDS = new Set(["anonymous", "project-owner", "backoffice-basic-auth"]);
const RESOURCES = new Set([
  "/backoffice",
  "/backoffice-data",
  "/backoffice-events",
  "/api/dashboard",
  "/api/ai/benchmarks",
  "/api/ai/benchmarks/compare",
  "/api/audit"
]);

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertInteger(label, value, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < 0 || value > maximum) throw new ReadModelAccessAuditError("INVALID_INPUT", `${label} is invalid.`);
  return value;
}

function normalize(input = {}) {
  const actorKind = input.actorKind ?? "anonymous";
  const actorId = input.actorId ?? "anonymous";
  const resource = input.resource;
  const method = input.method ?? "GET";
  const outcome = input.outcome ?? "accepted";
  if (!ACTOR_KINDS.has(actorKind)) throw new ReadModelAccessAuditError("INVALID_ACTOR", "actorKind is invalid.");
  if (typeof actorId !== "string" || !IDENTIFIER.test(actorId)) throw new ReadModelAccessAuditError("INVALID_ACTOR", "actorId is invalid.");
  if (!RESOURCES.has(resource)) throw new ReadModelAccessAuditError("INVALID_RESOURCE", "resource is not auditable.");
  if (method !== "GET") throw new ReadModelAccessAuditError("INVALID_METHOD", "Only GET access is auditable here.");
  if (!['accepted', 'rejected'].includes(outcome)) throw new ReadModelAccessAuditError("INVALID_OUTCOME", "outcome is invalid.");
  return { actorKind, actorId, resource, method, outcome };
}

function rowToEntry(row) {
  return copy({
    sequence: row.sequence === null || row.sequence === undefined ? null : Number(row.sequence),
    accessId: row.access_id,
    actorKind: row.actor_kind,
    actorId: row.actor_id,
    resource: row.resource,
    method: row.method,
    outcome: row.outcome,
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at
  });
}

function assertTarget({ client, pool }) {
  if (client && typeof client.query === "function") return client;
  if (pool && typeof pool.query === "function") return pool;
  throw new ReadModelAccessAuditError("DATABASE_TARGET_INVALID", "A PostgreSQL client or pool is required.");
}

export class ReadModelAccessAuditError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ReadModelAccessAuditError";
    this.code = code;
  }
}

export function createPostgresReadModelAccessAuditStore({ client, pool, now = () => new Date().toISOString(), accessIdFactory } = {}) {
  const target = assertTarget({ client, pool });
  const makeAccessId = accessIdFactory ?? (() => `access_${randomUUID().replaceAll("-", "")}`);

  return Object.freeze({
    async record(input = {}) {
      const normalized = normalize(input);
      const occurredAt = now();
      const result = await target.query(
        `INSERT INTO read_model_access_audit
           (access_id, actor_kind, actor_id, resource, method, outcome, occurred_at, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING sequence, access_id, actor_kind, actor_id, resource, method, outcome, occurred_at`,
        [makeAccessId(), normalized.actorKind, normalized.actorId, normalized.resource, normalized.method, normalized.outcome, occurredAt, {}]
      );
      const row = result.rows?.[0];
      return row ? rowToEntry(row) : copy({ sequence: null, accessId: null, ...normalized, occurredAt });
    },
    async list({ after = 0, limit = 50 } = {}) {
      assertInteger("after", after);
      assertInteger("limit", limit, 100);
      if (limit < 1) throw new ReadModelAccessAuditError("INVALID_LIMIT", "limit must be between 1 and 100.");
      const result = await target.query(
        `SELECT sequence, access_id, actor_kind, actor_id, resource, method, outcome, occurred_at
           FROM read_model_access_audit
          WHERE sequence > $1
          ORDER BY sequence ASC
          LIMIT $2`,
        [after, limit + 1]
      );
      const rows = (result.rows ?? []).map(rowToEntry);
      const entries = rows.slice(0, limit);
      return copy({
        entries,
        nextAfter: entries.at(-1)?.sequence ?? after,
        hasMore: rows.length > limit
      });
    }
  });
}

export { RESOURCES as READ_MODEL_ACCESS_AUDIT_RESOURCES };
