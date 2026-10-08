const KEY = /^[A-Za-z][A-Za-z0-9._:-]{2,320}$/;
const SENSITIVE = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|private[_-]?key)/i;
export const DOMAIN_RECORD_DOMAINS = Object.freeze(["performance", "notifications", "hardening", "readiness", "infrastructure", "delivery"]);
function copy(value) { return Object.freeze(structuredClone(value)); }
// A credential-shaped key is allowed only when its value was already redacted by the domain.
function safe(value, path = "payload") { if (Array.isArray(value)) return value.forEach((item, index) => safe(item, `${path}[${index}]`)); if (!value || typeof value !== "object") return; for (const [key, child] of Object.entries(value)) { if (SENSITIVE.test(key) && child !== "[redacted]") throw new DomainRecordStoreError("SENSITIVE_PERSISTENCE_FORBIDDEN", `${path}.${key} is forbidden.`); safe(child, `${path}.${key}`); } }
function targetOf({ client, pool }) { if (client?.query) return client; if (pool?.query) return pool; throw new Error("Domain record store requires an injected PostgreSQL client or pool."); }

export class DomainRecordStoreError extends Error {
  constructor(code, message) { super(message); this.name = "DomainRecordStoreError"; this.code = code; }
}

/** Append-only persistence for WP-09/WP-10 domain records (outbox → table →
 * order-independent hydrate). The table rejects UPDATE/DELETE. */
export function createPostgresDomainRecordStore({ client = null, pool = null } = {}) {
  const target = targetOf({ client, pool });
  return Object.freeze({
    async appendRecord(domain, record) {
      const { kind, key, version, projectId, payload = {}, actorId, recordedAt } = record ?? {};
      if (!DOMAIN_RECORD_DOMAINS.includes(domain)) throw new DomainRecordStoreError("DOMAIN_INVALID", "Record domain is invalid.");
      if (typeof kind !== "string" || !/^[a-z][a-z-]{1,40}$/.test(kind)) throw new DomainRecordStoreError("RECORD_KIND_INVALID", "Record kind is invalid.");
      for (const [label, value] of [["key", key], ["projectId", projectId], ["actorId", actorId]]) if (typeof value !== "string" || !KEY.test(value)) throw new DomainRecordStoreError("INVALID_IDENTIFIER", `${label} is invalid.`);
      if (!Number.isInteger(version) || version < 1) throw new DomainRecordStoreError("RECORD_VERSION_INVALID", "Record version is invalid.");
      safe(payload);
      // jsonb: always serialize explicitly.
      await target.query("INSERT INTO backoffice_domain_records (domain, record_kind, record_key, record_version, project_id, metadata, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7)", [domain, kind, key, version, projectId, JSON.stringify({ recordedAt, payload }), actorId]);
      return copy({ domain, kind, key, version });
    },
    async listRecords(domain) {
      if (!DOMAIN_RECORD_DOMAINS.includes(domain)) throw new DomainRecordStoreError("DOMAIN_INVALID", "Record domain is invalid.");
      const result = await target.query("SELECT record_kind, record_key, record_version, project_id, metadata, actor_id, recorded_at FROM backoffice_domain_records WHERE domain = $1 ORDER BY recorded_at ASC, record_key ASC, record_version ASC", [domain]);
      return Object.freeze((result.rows ?? []).map(row => copy({ kind: row.record_kind, key: row.record_key, version: row.record_version, projectId: row.project_id, actorId: row.actor_id, recordedAt: row.metadata?.recordedAt ?? row.recorded_at, payload: row.metadata?.payload ?? {} })));
    }
  });
}
