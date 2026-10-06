import { SYSTEM_RECORD_KINDS } from "../../contracts/src/system-catalog.mjs";

const KEY = /^[A-Za-z][A-Za-z0-9._:-]{2,320}$/;
const SENSITIVE = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|private[_-]?key)/i;
function copy(value) { return Object.freeze(structuredClone(value)); }
function safe(value, path = "payload") { if (Array.isArray(value)) return value.forEach((item, index) => safe(item, `${path}[${index}]`)); if (!value || typeof value !== "object") return; for (const [key, child] of Object.entries(value)) { if (SENSITIVE.test(key)) throw new SystemCatalogStoreError("SENSITIVE_PERSISTENCE_FORBIDDEN", `${path}.${key} is forbidden.`); safe(child, `${path}.${key}`); } }
function targetOf({ client, pool }) { if (client?.query) return client; if (pool?.query) return pool; throw new Error("System catalog store requires an injected PostgreSQL client or pool."); }

export class SystemCatalogStoreError extends Error {
  constructor(code, message) { super(message); this.name = "SystemCatalogStoreError"; this.code = code; }
}

/** Append-only persistence for System Catalog records. Entity versions go to
 * system_catalog_entities; dependencies, inventory, drift proposals and
 * knowledge go to system_catalog_records. Both tables reject UPDATE/DELETE. */
export function createPostgresSystemCatalogStore({ client = null, pool = null } = {}) {
  const target = targetOf({ client, pool });
  return Object.freeze({
    async appendRecord(record) {
      const { kind, key, version, projectId, state, payload = {}, actorId, recordedAt } = record ?? {};
      if (!SYSTEM_RECORD_KINDS.includes(kind)) throw new SystemCatalogStoreError("RECORD_KIND_INVALID", "Catalog record kind is invalid.");
      for (const [label, value] of [["key", key], ["projectId", projectId], ["actorId", actorId]]) if (typeof value !== "string" || !KEY.test(value)) throw new SystemCatalogStoreError("INVALID_IDENTIFIER", `${label} is invalid.`);
      if (!Number.isInteger(version) || version < 1) throw new SystemCatalogStoreError("RECORD_VERSION_INVALID", "Record version is invalid.");
      safe(payload);
      // jsonb columns: always serialize explicitly.
      if (kind === "entity") await target.query("INSERT INTO system_catalog_entities (entity_id, entity_version, project_id, entity_type, lifecycle, metadata, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7)", [key, version, projectId, payload.entity.type, payload.entity.lifecycle, JSON.stringify({ recordedAt, payload }), actorId]);
      else await target.query("INSERT INTO system_catalog_records (record_key, record_version, project_id, record_kind, state, metadata, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7)", [key, version, projectId, kind, String(state), JSON.stringify({ recordedAt, payload }), actorId]);
      return copy({ kind, key, version });
    },
    async listRecords() {
      const entities = await target.query("SELECT entity_id, entity_version, project_id, lifecycle, metadata, actor_id, recorded_at FROM system_catalog_entities ORDER BY recorded_at ASC, entity_id ASC, entity_version ASC");
      const records = await target.query("SELECT record_key, record_version, project_id, record_kind, state, metadata, actor_id, recorded_at FROM system_catalog_records ORDER BY recorded_at ASC, record_key ASC, record_version ASC");
      // Rows written before catalog v1.1 carry no payload; they cannot be replayed safely and are skipped.
      return Object.freeze([
        ...(entities.rows ?? []).filter(row => row.metadata?.payload?.entity).map(row => copy({ kind: "entity", key: row.entity_id, version: row.entity_version, projectId: row.project_id, state: row.lifecycle, actorId: row.actor_id, recordedAt: row.metadata.recordedAt ?? row.recorded_at, payload: row.metadata.payload })),
        ...(records.rows ?? []).filter(row => SYSTEM_RECORD_KINDS.includes(row.record_kind) && row.metadata?.payload).map(row => copy({ kind: row.record_kind, key: row.record_key, version: row.record_version, projectId: row.project_id, state: row.state, actorId: row.actor_id, recordedAt: row.metadata.recordedAt ?? row.recorded_at, payload: row.metadata.payload }))
      ]);
    }
  });
}
