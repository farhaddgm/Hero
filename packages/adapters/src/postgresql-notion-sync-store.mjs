import { validateNotionSyncMapping } from "../../contracts/src/index.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const CHECKSUM = /^[a-f0-9]{64}$/;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertTarget({ client, pool }) {
  if (client && typeof client.query === "function") return;
  if (pool && typeof pool.query === "function" && typeof pool.connect === "function") return;
  throw new NotionSyncStoreError("DATABASE_TARGET_INVALID", "A PostgreSQL client or pool is required.");
}

function assertMapping(mapping) {
  const errors = validateNotionSyncMapping(mapping);
  if (errors.length > 0) throw new NotionSyncStoreError("INVALID_NOTION_MAPPING", errors.join(" "));
  if (!CHECKSUM.test(mapping.sourceChecksum) || (mapping.notionChecksum !== null && mapping.notionChecksum !== undefined && !CHECKSUM.test(mapping.notionChecksum))) throw new NotionSyncStoreError("INVALID_CHECKSUM", "Mapping checksums must be SHA-256 hex values.");
  if (typeof mapping.canonicalCommit !== "string" || mapping.canonicalCommit.trim() === "") throw new NotionSyncStoreError("INVALID_CANONICAL_COMMIT", "canonicalCommit is required.");
  return mapping;
}

function rowToMapping(row) {
  if (!row) return null;
  const mapping = {
    documentId: row.document_id,
    pageId: row.page_id,
    canonicalCommit: row.canonical_commit,
    sourceChecksum: row.source_checksum,
    notionChecksum: row.notion_checksum ?? null,
    status: row.sync_state,
    editPolicy: row.edit_policy,
    lastSuccessfulSync: row.last_successful_sync instanceof Date ? row.last_successful_sync.toISOString() : row.last_successful_sync ?? null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    data: row.data ?? {}
  };
  if (!IDENTIFIER.test(mapping.documentId)) throw new NotionSyncStoreError("INVALID_DATABASE_ROW", "document_id is invalid.");
  return copy(mapping);
}

export class NotionSyncStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "NotionSyncStoreError";
    this.code = code;
  }
}

export function createPostgresNotionSyncStore({ client, pool, now = () => new Date().toISOString() } = {}) {
  assertTarget({ client, pool });
  const target = client ?? pool;
  return Object.freeze({
    async upsert(mapping) {
      const value = assertMapping(mapping);
      const result = await target.query(
        `INSERT INTO notion_document_mappings
          (document_id, page_id, canonical_commit, source_checksum, notion_checksum, sync_state, edit_policy, last_successful_sync, updated_at, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (document_id) DO UPDATE SET
           page_id = EXCLUDED.page_id,
           canonical_commit = EXCLUDED.canonical_commit,
           source_checksum = EXCLUDED.source_checksum,
           notion_checksum = EXCLUDED.notion_checksum,
           sync_state = EXCLUDED.sync_state,
           edit_policy = EXCLUDED.edit_policy,
           last_successful_sync = EXCLUDED.last_successful_sync,
           updated_at = EXCLUDED.updated_at,
           data = EXCLUDED.data
         RETURNING document_id, page_id, canonical_commit, source_checksum, notion_checksum, sync_state, edit_policy, last_successful_sync, updated_at, data`,
        [value.documentId, value.pageId, value.canonicalCommit, value.sourceChecksum, value.notionChecksum ?? null, value.status, value.editPolicy, value.lastSuccessfulSync ?? null, value.updatedAt ?? now(), value.data ?? {}]
      );
      return rowToMapping(result.rows?.[0]);
    },
    async get(documentId) {
      if (!IDENTIFIER.test(documentId ?? "")) throw new NotionSyncStoreError("INVALID_DOCUMENT_ID", "documentId is invalid.");
      const result = await target.query(
        "SELECT document_id, page_id, canonical_commit, source_checksum, notion_checksum, sync_state, edit_policy, last_successful_sync, updated_at, data FROM notion_document_mappings WHERE document_id = $1",
        [documentId]
      );
      return rowToMapping(result.rows?.[0]);
    },
    async list({ limit = 100 } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) throw new NotionSyncStoreError("INVALID_LIMIT", "limit must be between 1 and 10000.");
      const result = await target.query(
        "SELECT document_id, page_id, canonical_commit, source_checksum, notion_checksum, sync_state, edit_policy, last_successful_sync, updated_at, data FROM notion_document_mappings ORDER BY document_id ASC LIMIT $1",
        [limit]
      );
      return copy((result.rows ?? []).map(rowToMapping));
    }
  });
}
