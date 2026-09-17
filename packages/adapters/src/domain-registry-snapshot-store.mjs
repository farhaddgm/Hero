import { randomUUID } from "node:crypto";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const REGISTRY_ID = /^[a-z][a-z0-9._:-]{2,63}$/;
const SENSITIVE_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|opt)\/)/;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertRegistryId(value) {
  if (typeof value !== "string" || !REGISTRY_ID.test(value)) throw new DomainRegistrySnapshotError("INVALID_REGISTRY_ID", "registryId is invalid.");
  return value;
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new DomainRegistrySnapshotError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function assertSchemaVersion(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,47}$/.test(value)) throw new DomainRegistrySnapshotError("INVALID_SCHEMA_VERSION", "schemaVersion is invalid.");
  return value;
}

function isSafeCredentialReference(value) {
  if (typeof value !== "string") return false;
  if (/^(?:runtime|env):[A-Za-z0-9._:-]{3,120}$/.test(value)) return true;
  if (!value.startsWith("vault:")) return false;
  const segments = value.slice("vault:".length).split("/");
  return segments.length >= 2
    && segments.length <= 5
    && value.length <= 160
    && segments.every(segment => /^[A-Za-z0-9._:-]{1,80}$/.test(segment) && segment !== "." && segment !== "..");
}

function assertSafe(value, path = "data") {
  if (Array.isArray(value)) return value.forEach((child, index) => assertSafe(child, `${path}[${index}]`));
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const safeReference = key === "credentialRef" && isSafeCredentialReference(child);
      const safeBoundaryFlag = key === "authorizationCreated" && typeof child === "boolean";
      if (SENSITIVE_KEY.test(key) && !safeReference && !safeBoundaryFlag) throw new DomainRegistrySnapshotError("SENSITIVE_DATA_REJECTED", `${path}.${key} is not allowed in a registry snapshot.`);
      assertSafe(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && (SENSITIVE_VALUE.test(value) || HOST_PATH.test(value))) {
    throw new DomainRegistrySnapshotError("SENSITIVE_DATA_REJECTED", `${path} contains a secret or host path.`);
  }
}

function assertTarget({ client, pool }) {
  if (client && typeof client.query === "function") return;
  if (pool && typeof pool.query === "function" && typeof pool.connect === "function") return;
  throw new DomainRegistrySnapshotError("DATABASE_TARGET_INVALID", "A PostgreSQL client or pool is required.");
}

function rowToSnapshot(row) {
  const revision = Number(row.revision);
  const sourceSequence = Number(row.source_sequence ?? 0);
  if (!Number.isInteger(revision) || revision < 1 || !Number.isInteger(sourceSequence) || sourceSequence < 0) {
    throw new DomainRegistrySnapshotError("INVALID_DATABASE_ROW", "Registry snapshot revision is invalid.");
  }
  let data = row.data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { throw new DomainRegistrySnapshotError("INVALID_DATABASE_ROW", "Registry snapshot data is not valid JSON."); }
  }
  assertSafe(data);
  return copy({
    snapshotId: row.snapshot_id,
    registryId: row.registry_id,
    schemaVersion: row.schema_version,
    revision,
    sourceSequence,
    data,
    capturedAt: row.captured_at instanceof Date ? row.captured_at.toISOString() : row.captured_at
  });
}

export class DomainRegistrySnapshotError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DomainRegistrySnapshotError";
    this.code = code;
  }
}

export function createPostgresDomainRegistrySnapshotStore({ client, pool, now = () => new Date().toISOString() } = {}) {
  assertTarget({ client, pool });
  const readTarget = client ?? pool;

  async function transaction(work) {
    if (client) {
      await client.query("BEGIN");
      try {
        const value = await work(client);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
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
      await connection.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async function latest(registryIds, target = readTarget) {
    const ids = registryIds?.map(assertRegistryId) ?? null;
    const result = ids
      ? await target.query(
        `SELECT DISTINCT ON (registry_id) snapshot_id, registry_id, schema_version,
                revision, source_sequence, data, captured_at
           FROM domain_registry_snapshots
          WHERE registry_id = ANY($1::text[])
          ORDER BY registry_id, revision DESC`,
        [ids]
      )
      : await target.query(
        `SELECT DISTINCT ON (registry_id) snapshot_id, registry_id, schema_version,
                revision, source_sequence, data, captured_at
           FROM domain_registry_snapshots
          ORDER BY registry_id, revision DESC`
      );
    return Object.freeze((result.rows ?? []).map(rowToSnapshot));
  }

  return Object.freeze({
    async save({ registryId, schemaVersion = "1.0", sourceSequence = 0, data, snapshotId = `hero-snapshot-${randomUUID().replaceAll("-", "")}` } = {}) {
      assertRegistryId(registryId);
      assertIdentifier("snapshotId", snapshotId);
      assertSchemaVersion(schemaVersion);
      if (!Number.isInteger(sourceSequence) || sourceSequence < 0) throw new DomainRegistrySnapshotError("INVALID_SEQUENCE", "sourceSequence must be a non-negative integer.");
      assertSafe(data);
      return transaction(async target => {
        await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`domain-registry-snapshot:${registryId}`]);
        const current = await target.query(
          "SELECT COALESCE(MAX(revision), 0) AS revision FROM domain_registry_snapshots WHERE registry_id = $1",
          [registryId]
        );
        const revision = Number(current.rows?.[0]?.revision ?? 0) + 1;
        if (!Number.isInteger(revision) || revision < 1) throw new DomainRegistrySnapshotError("INVALID_REVISION", "Could not allocate a snapshot revision.");
        const result = await target.query(
          `INSERT INTO domain_registry_snapshots
             (snapshot_id, registry_id, schema_version, revision, source_sequence, data, captured_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING snapshot_id, registry_id, schema_version, revision, source_sequence, data, captured_at`,
          [snapshotId, registryId, schemaVersion, revision, sourceSequence, data, now()]
        );
        return rowToSnapshot(result.rows?.[0]);
      });
    },
    async readLatest({ registryIds } = {}) {
      return latest(registryIds);
    },
    async hydrate({ registryIds = [] } = {}) {
      const requested = registryIds.map(assertRegistryId);
      const snapshots = await latest(requested.length > 0 ? requested : undefined);
      const found = new Set(snapshots.map(item => item.registryId));
      return copy({
        schemaVersion: "1.0",
        source: "postgresql-versioned-domain-registry-snapshots",
        snapshots,
        registryCount: snapshots.length,
        missingRegistryIds: requested.filter(registryId => !found.has(registryId))
      });
    }
  });
}
