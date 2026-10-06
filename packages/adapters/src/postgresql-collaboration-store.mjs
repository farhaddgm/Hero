import { COLLABORATION_RECORD_TYPES } from "../../contracts/src/backoffice-collaboration.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SENSITIVE = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;

function copy(value) { return Object.freeze(structuredClone(value)); }
function assertId(label, value) { if (typeof value !== "string" || !ID.test(value)) throw new CollaborationStoreError("INVALID_IDENTIFIER", `${label} is invalid.`); return value; }
function safe(value, path = "metadata") { if (Array.isArray(value)) return value.forEach((item, index) => safe(item, `${path}[${index}]`)); if (!value || typeof value !== "object") return; for (const [key, child] of Object.entries(value)) { if (SENSITIVE.test(key)) throw new CollaborationStoreError("SENSITIVE_PERSISTENCE_FORBIDDEN", `${path}.${key} is forbidden.`); safe(child, `${path}.${key}`); } }
function targetOf({ client, pool }) { if (client?.query) return client; if (pool?.query) return pool; throw new Error("Collaboration store requires an injected PostgreSQL client or pool."); }

export class CollaborationStoreError extends Error {
  constructor(code, message) { super(message); this.name = "CollaborationStoreError"; this.code = code; }
}

/** Append-only persistence for project collaboration records (teams, profiles,
 * conversations, messages, memory, knowledge proposals). The table rejects
 * UPDATE/DELETE, so history is never rewritten. */
export function createPostgresCollaborationStore({ client = null, pool = null } = {}) {
  const target = targetOf({ client, pool });
  return Object.freeze({
    async appendRecord({ recordId, projectId, recordType, recordVersion = 1, metadata = {}, actorId }) {
      assertId("recordId", recordId); assertId("projectId", projectId); assertId("actorId", actorId);
      if (!COLLABORATION_RECORD_TYPES.includes(recordType)) throw new CollaborationStoreError("RECORD_TYPE_INVALID", "Collaboration record type is invalid.");
      if (!Number.isInteger(recordVersion) || recordVersion < 1) throw new CollaborationStoreError("RECORD_VERSION_INVALID", "Record version is invalid.");
      safe(metadata);
      // metadata is jsonb: always serialize explicitly (strings/arrays are not JSON otherwise).
      await target.query("INSERT INTO collaboration_records (record_id, project_id, record_type, record_version, metadata, actor_id) VALUES ($1,$2,$3,$4,$5,$6)", [recordId, projectId, recordType, recordVersion, JSON.stringify(metadata), actorId]);
      return copy({ recordId, projectId, recordType, recordVersion });
    },
    async listRecords({ projectId = null } = {}) {
      if (projectId) assertId("projectId", projectId);
      const result = await target.query(`SELECT record_id, project_id, record_type, record_version, metadata, actor_id, recorded_at FROM collaboration_records ${projectId ? "WHERE project_id = $1" : ""} ORDER BY recorded_at ASC, record_id ASC`, projectId ? [projectId] : []);
      return Object.freeze((result.rows ?? []).map(row => copy({ recordId: row.record_id, projectId: row.project_id, recordType: row.record_type, recordVersion: row.record_version, metadata: row.metadata ?? {}, actorId: row.actor_id, recordedAt: row.recorded_at })));
    }
  });
}
