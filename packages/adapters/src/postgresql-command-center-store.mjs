import { COMMAND_RECORD_KINDS } from "../../contracts/src/backoffice-command-center.mjs";

const KEY = /^[A-Za-z][A-Za-z0-9._:-]{2,160}$/;
const SENSITIVE = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
// Governance identifiers that merely *name* an authorization record are not credentials.
const ALLOWED_KEYS = new Set(["authorizationSnapshotId"]);

function copy(value) { return Object.freeze(structuredClone(value)); }
function safe(value, path = "metadata") { if (Array.isArray(value)) return value.forEach((item, index) => safe(item, `${path}[${index}]`)); if (!value || typeof value !== "object") return; for (const [key, child] of Object.entries(value)) { if (SENSITIVE.test(key) && !ALLOWED_KEYS.has(key)) throw new CommandCenterStoreError("SENSITIVE_PERSISTENCE_FORBIDDEN", `${path}.${key} is forbidden.`); safe(child, `${path}.${key}`); } }
function targetOf({ client, pool }) { if (client?.query) return client; if (pool?.query) return pool; throw new Error("Command center store requires an injected PostgreSQL client or pool."); }

export class CommandCenterStoreError extends Error {
  constructor(code, message) { super(message); this.name = "CommandCenterStoreError"; this.code = code; }
}

/** Append-only persistence for Command Center records (commands, approval
 * templates, Production preauthorizations, scheduler settings) in
 * command_decision_records. Each record is keyed by (key, version); the table
 * rejects UPDATE/DELETE, so every decision stays immutable history. */
export function createPostgresCommandCenterStore({ client = null, pool = null } = {}) {
  const target = targetOf({ client, pool });
  return Object.freeze({
    async appendRecord(record) {
      const { kind, key, version, projectId, state, authorizationSnapshotId = "none", correlationId = "none", actorId, recordedAt, metadata = {} } = record ?? {};
      if (!COMMAND_RECORD_KINDS.includes(kind)) throw new CommandCenterStoreError("RECORD_KIND_INVALID", "Command record kind is invalid.");
      for (const [label, value] of [["key", key], ["projectId", projectId], ["actorId", actorId]]) if (typeof value !== "string" || !KEY.test(value)) throw new CommandCenterStoreError("INVALID_IDENTIFIER", `${label} is invalid.`);
      if (!Number.isInteger(version) || version < 1) throw new CommandCenterStoreError("RECORD_VERSION_INVALID", "Record version is invalid.");
      safe(metadata);
      // metadata is jsonb: always serialize explicitly.
      await target.query("INSERT INTO command_decision_records (command_id, decision_version, project_id, state, authorization_snapshot_id, correlation_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)", [key, version, projectId, String(state), String(authorizationSnapshotId), String(correlationId), JSON.stringify({ kind, actorId, recordedAt, payload: metadata })]);
      return copy({ kind, key, version });
    },
    async listRecords() {
      const result = await target.query("SELECT command_id, decision_version, project_id, state, authorization_snapshot_id, correlation_id, metadata, recorded_at FROM command_decision_records ORDER BY recorded_at ASC, command_id ASC, decision_version ASC");
      return Object.freeze((result.rows ?? []).filter(row => COMMAND_RECORD_KINDS.includes(row.metadata?.kind)).map(row => copy({ kind: row.metadata.kind, key: row.command_id, version: row.decision_version, projectId: row.project_id, state: row.state, authorizationSnapshotId: row.authorization_snapshot_id, correlationId: row.correlation_id, actorId: row.metadata.actorId, recordedAt: row.metadata.recordedAt ?? row.recorded_at, metadata: row.metadata.payload ?? {} })));
    }
  });
}
