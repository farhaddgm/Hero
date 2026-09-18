import {
  evaluateProductRuntimeCapacity,
  normalizeProductRuntimeCapacitySnapshot,
  PRODUCT_RUNTIME_CAPACITY_TARGET
} from "../../contracts/src/product-runtime-capacity.mjs";
import {
  createProductRuntimeLease,
  evaluateProductRuntimeLease,
  heartbeatProductRuntimeLease,
  PRODUCT_RUNTIME_LEASE_DEFAULT_TTL_SECONDS
} from "../../contracts/src/product-runtime-lease.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;
const RESOURCE = /^hero-product-[a-z0-9-]+$/;

function copy(value) { return Object.freeze(structuredClone(value)); }

function targetOf({ client, pool }) {
  if (client?.query) return client;
  if (pool?.query) return pool;
  throw new Error("Product runtime reservation store requires an injected PostgreSQL client or pool.");
}

function assertId(label, value) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function assertFingerprint(value) {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) throw new Error("planFingerprint is invalid.");
  return value;
}

function assertPorts(value) {
  if (!Array.isArray(value) || value.some(port => !Number.isInteger(port) || port < 1024 || port > 65535)) throw new Error("ports are invalid.");
  return [...new Set(value)];
}

function assertResourceNames(value) {
  if (!Array.isArray(value) || value.some(name => typeof name !== "string" || !RESOURCE.test(name))) throw new Error("resourceNames are invalid.");
  return [...new Set(value)];
}

function assertResourceLimits(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("resourceLimits are invalid.");
  if (typeof value.cpuLimit !== "number" || !Number.isFinite(value.cpuLimit) || value.cpuLimit <= 0) throw new Error("resourceLimits.cpuLimit is invalid.");
  if (!Number.isInteger(value.memoryMiB) || value.memoryMiB <= 0) throw new Error("resourceLimits.memoryMiB is invalid.");
  if (!Number.isInteger(value.pidsLimit) || value.pidsLimit <= 0) throw new Error("resourceLimits.pidsLimit is invalid.");
  return Object.freeze({ cpuCores: value.cpuLimit, memoryMiB: value.memoryMiB, pidsLimit: value.pidsLimit, concurrentRuns: 1 });
}

function rowOf(row) {
  if (!row) return null;
  const iso = value => value instanceof Date ? value.toISOString() : value;
  return copy({
    reservationId: row.reservation_id,
    projectId: row.project_id,
    runId: row.run_id,
    targetId: row.target_id ?? PRODUCT_RUNTIME_CAPACITY_TARGET,
    capacitySnapshotId: row.capacity_snapshot_id ?? null,
    planFingerprint: row.plan_fingerprint,
    ports: row.ports ?? [],
    resourceNames: row.resource_names ?? [],
    cpuCores: Number(row.cpu_cores ?? 0),
    memoryMiB: Number(row.memory_mib ?? 0),
    pidsLimit: Number(row.pids_limit ?? 0),
    state: row.state,
    reservedAt: iso(row.reserved_at),
    leaseTtlSeconds: Number(row.lease_ttl_seconds ?? 0),
    lastHeartbeatAt: iso(row.last_heartbeat_at ?? null),
    expiresAt: iso(row.expires_at ?? null),
    releasedAt: iso(row.released_at ?? null),
    releaseReason: row.release_reason ?? null
  });
}

function capacityRowOf(row) {
  if (!row) return null;
  return copy({
    snapshotId: row.snapshot_id,
    targetId: row.target_id,
    environment: row.environment,
    cpuCores: Number(row.cpu_cores),
    memoryMiB: Number(row.memory_mib),
    pidsLimit: Number(row.pids_limit),
    maxConcurrentRuns: Number(row.max_concurrent_runs),
    source: row.source,
    observedAt: row.observed_at instanceof Date ? row.observed_at.toISOString() : row.observed_at
  });
}

const RESERVATION_COLUMNS = "reservation_id, project_id, run_id, target_id, capacity_snapshot_id, plan_fingerprint, ports, resource_names, cpu_cores, memory_mib, pids_limit, state, reserved_at, lease_ttl_seconds, last_heartbeat_at, expires_at, released_at, release_reason";
const CAPACITY_COLUMNS = "snapshot_id, target_id, environment, cpu_cores, memory_mib, pids_limit, max_concurrent_runs, source, observed_at";

function assertLeaseTtl(value) {
  if (!Number.isInteger(value) || value < 60 || value > 86_400) throw new Error("leaseTtlSeconds is invalid.");
  return value;
}

async function transaction(target, action) {
  const connection = typeof target.connect === "function" ? await target.connect() : target;
  try {
    await connection.query("BEGIN");
    const result = await action(connection);
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    try { await connection.query("ROLLBACK"); } catch { /* preserve original failure */ }
    throw error;
  } finally {
    if (connection !== target && typeof connection.release === "function") connection.release();
  }
}

export function createPostgresProductRuntimeReservationStore({ client, pool, now = () => new Date().toISOString() } = {}) {
  const target = targetOf({ client, pool });
  return Object.freeze({
    async recordCapacitySnapshot(snapshot) {
      const safe = normalizeProductRuntimeCapacitySnapshot(snapshot);
      const result = await target.query(`INSERT INTO product_runtime_capacity_snapshots (${CAPACITY_COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (snapshot_id) DO NOTHING RETURNING ${CAPACITY_COLUMNS}`, [safe.snapshotId, safe.targetId, safe.environment, safe.cpuCores, safe.memoryMiB, safe.pidsLimit, safe.maxConcurrentRuns, safe.source, safe.observedAt]);
      if (result.rows?.[0]) return copy({ status: "recorded", code: "PRODUCT_RUNTIME_CAPACITY_RECORDED", snapshot: capacityRowOf(result.rows[0]) });
      const existing = await target.query(`SELECT ${CAPACITY_COLUMNS} FROM product_runtime_capacity_snapshots WHERE snapshot_id = $1`, [safe.snapshotId]);
      const current = capacityRowOf(existing.rows?.[0]);
      if (!current || JSON.stringify(current) !== JSON.stringify(safe)) throw new Error("capacity snapshot is immutable and conflicts with an existing snapshot.");
      return copy({ status: "replayed", code: "PRODUCT_RUNTIME_CAPACITY_REPLAY", snapshot: current });
    },
    async latestCapacity({ targetId = PRODUCT_RUNTIME_CAPACITY_TARGET } = {}) {
      const result = await target.query(`SELECT ${CAPACITY_COLUMNS} FROM product_runtime_capacity_snapshots WHERE target_id = $1 ORDER BY observed_at DESC LIMIT 1`, [assertId("targetId", targetId)]);
      return capacityRowOf(result.rows?.[0]);
    },
    async reserve({ reservationId, projectId, runId, targetId = PRODUCT_RUNTIME_CAPACITY_TARGET, capacitySnapshotId = null, planFingerprint, ports = [], resourceNames = [], resourceLimits = {}, leaseTtlSeconds = PRODUCT_RUNTIME_LEASE_DEFAULT_TTL_SECONDS } = {}) {
      const safeReservationId = assertId("reservationId", reservationId);
      const safeProjectId = assertId("projectId", projectId);
      const safeRunId = assertId("runId", runId);
      const safeTargetId = assertId("targetId", targetId);
      const safeCapacitySnapshotId = capacitySnapshotId ? assertId("capacitySnapshotId", capacitySnapshotId) : null;
      const safeFingerprint = assertFingerprint(planFingerprint);
      const safePorts = assertPorts(ports);
      const safeResourceNames = assertResourceNames(resourceNames);
      const safeLimits = assertResourceLimits(resourceLimits);
      const safeLeaseTtlSeconds = assertLeaseTtl(leaseTtlSeconds);
      return transaction(target, async connection => {
        await connection.query("SELECT pg_advisory_xact_lock(hashtext('hero-product-runtime-reservations'))");
        const existingResult = await connection.query(`SELECT ${RESERVATION_COLUMNS} FROM product_runtime_reservations WHERE project_id = $1 AND run_id = $2 FOR UPDATE`, [safeProjectId, safeRunId]);
        const existing = existingResult.rows?.[0];
        if (existing?.state === "active") {
          const currentLease = rowOf(existing);
          const leaseState = evaluateProductRuntimeLease({ lease: currentLease, now: now() });
          if (leaseState.decision === "reject") return copy({ status: "blocked", code: "PRODUCT_RUNTIME_LEASE_REQUIRED", reservation: null });
          if (leaseState.decision === "expire") return copy({ status: "blocked", code: "PRODUCT_RUNTIME_RESERVATION_EXPIRED", reservation: null });
          const same = existing.reservation_id === safeReservationId && existing.target_id === safeTargetId && existing.plan_fingerprint === safeFingerprint && JSON.stringify(existing.ports ?? []) === JSON.stringify(safePorts) && JSON.stringify(existing.resource_names ?? []) === JSON.stringify(safeResourceNames) && Number(existing.cpu_cores ?? 0) === safeLimits.cpuCores && Number(existing.memory_mib ?? 0) === safeLimits.memoryMiB && Number(existing.pids_limit ?? 0) === safeLimits.pidsLimit && Number(existing.lease_ttl_seconds ?? 0) === safeLeaseTtlSeconds;
          return copy({ status: same ? "replayed" : "blocked", code: same ? "PRODUCT_RUNTIME_RESERVATION_REPLAY" : "PRODUCT_RUNTIME_RESOURCE_CONFLICT", reservation: same ? rowOf(existing) : null });
        }
        const capacityResult = safeCapacitySnapshotId
          ? await connection.query(`SELECT ${CAPACITY_COLUMNS} FROM product_runtime_capacity_snapshots WHERE snapshot_id = $1 AND target_id = $2 AND environment = 'test' FOR SHARE`, [safeCapacitySnapshotId, safeTargetId])
          : await connection.query(`SELECT ${CAPACITY_COLUMNS} FROM product_runtime_capacity_snapshots WHERE target_id = $1 AND environment = 'test' ORDER BY observed_at DESC LIMIT 1 FOR SHARE`, [safeTargetId]);
        const capacity = capacityRowOf(capacityResult.rows?.[0]);
        if (!capacity) return copy({ status: "blocked", code: "PRODUCT_RUNTIME_CAPACITY_REQUIRED", reservation: null });
        const conflictResult = await connection.query("SELECT reservation_id FROM product_runtime_reservations WHERE target_id = $1 AND state = 'active' AND (ports && $2::integer[] OR resource_names && $3::text[]) LIMIT 1 FOR UPDATE", [safeTargetId, safePorts, safeResourceNames]);
        if (conflictResult.rows?.length) return copy({ status: "blocked", code: "PRODUCT_RUNTIME_RESOURCE_CONFLICT", reservation: null });
        const totalsResult = await connection.query("SELECT COALESCE(SUM(cpu_cores), 0) AS cpu_cores, COALESCE(SUM(memory_mib), 0) AS memory_mib, COALESCE(SUM(pids_limit), 0) AS pids_limit, COUNT(*)::integer AS concurrent_runs, COUNT(*) FILTER (WHERE cpu_cores <= 0 OR memory_mib <= 0 OR pids_limit <= 0)::integer AS unknown_count FROM product_runtime_reservations WHERE target_id = $1 AND state = 'active'", [safeTargetId]);
        if (Number(totalsResult.rows?.[0]?.unknown_count ?? 0) > 0) return copy({ status: "blocked", code: "PRODUCT_RUNTIME_CAPACITY_REQUIRED", reservation: null });
        const admission = evaluateProductRuntimeCapacity({ capacity, requested: safeLimits, reserved: totalsResult.rows?.[0] ? { cpuCores: Number(totalsResult.rows[0].cpu_cores), memoryMiB: Number(totalsResult.rows[0].memory_mib), pidsLimit: Number(totalsResult.rows[0].pids_limit), concurrentRuns: Number(totalsResult.rows[0].concurrent_runs) } : undefined });
        if (admission.decision !== "admit") return copy({ status: "blocked", code: "PRODUCT_RUNTIME_CAPACITY_EXHAUSTED", reservation: null, admission });
        const reservedAt = now();
        const lease = createProductRuntimeLease({ reservationId: safeReservationId, reservedAt, leaseTtlSeconds: safeLeaseTtlSeconds });
        if (existing) {
          const result = await connection.query(`UPDATE product_runtime_reservations SET reservation_id = $1, target_id = $2, capacity_snapshot_id = $3, plan_fingerprint = $4, ports = $5, resource_names = $6, cpu_cores = $7, memory_mib = $8, pids_limit = $9, state = 'active', reserved_at = $10, lease_ttl_seconds = $11, last_heartbeat_at = $12, expires_at = $13, released_at = NULL, release_reason = NULL WHERE project_id = $14 AND run_id = $15 RETURNING ${RESERVATION_COLUMNS}`, [safeReservationId, safeTargetId, safeCapacitySnapshotId, safeFingerprint, safePorts, safeResourceNames, safeLimits.cpuCores, safeLimits.memoryMiB, safeLimits.pidsLimit, reservedAt, lease.leaseTtlSeconds, lease.lastHeartbeatAt, lease.expiresAt, safeProjectId, safeRunId]);
          return copy({ status: "reserved", code: "PRODUCT_RUNTIME_RESERVED", reservation: rowOf(result.rows?.[0]) });
        }
        const result = await connection.query(`INSERT INTO product_runtime_reservations (reservation_id, project_id, run_id, target_id, capacity_snapshot_id, plan_fingerprint, ports, resource_names, cpu_cores, memory_mib, pids_limit, state, reserved_at, lease_ttl_seconds, last_heartbeat_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12,$13,$14,$15) RETURNING ${RESERVATION_COLUMNS}`, [safeReservationId, safeProjectId, safeRunId, safeTargetId, safeCapacitySnapshotId, safeFingerprint, safePorts, safeResourceNames, safeLimits.cpuCores, safeLimits.memoryMiB, safeLimits.pidsLimit, reservedAt, lease.leaseTtlSeconds, lease.lastHeartbeatAt, lease.expiresAt]);
        return copy({ status: "reserved", code: "PRODUCT_RUNTIME_RESERVED", reservation: rowOf(result.rows?.[0]) });
      });
    },
    async inspect({ projectId, runId } = {}) {
      const result = await target.query(`SELECT ${RESERVATION_COLUMNS} FROM product_runtime_reservations WHERE project_id = $1 AND run_id = $2 LIMIT 1`, [assertId("projectId", projectId), assertId("runId", runId)]);
      return rowOf(result.rows?.[0]);
    },
    async heartbeat({ projectId, runId, reservationId } = {}) {
      const safeProjectId = assertId("projectId", projectId);
      const safeRunId = assertId("runId", runId);
      const safeReservationId = assertId("reservationId", reservationId);
      return transaction(target, async connection => {
        await connection.query("SELECT pg_advisory_xact_lock(hashtext('hero-product-runtime-reservations'))");
        const result = await connection.query(`SELECT ${RESERVATION_COLUMNS} FROM product_runtime_reservations WHERE project_id = $1 AND run_id = $2 AND reservation_id = $3 FOR UPDATE`, [safeProjectId, safeRunId, safeReservationId]);
        const current = rowOf(result.rows?.[0]);
        if (!current) return copy({ status: "not-found", code: "PRODUCT_RUNTIME_RESERVATION_NOT_FOUND" });
        if (current.state !== "active") return copy({ status: "blocked", code: "PRODUCT_RUNTIME_LEASE_NOT_ACTIVE", reservation: current });
        const renewed = heartbeatProductRuntimeLease({ lease: current, now: now() });
        if (renewed.status !== "renewed") return copy({ status: "blocked", code: "PRODUCT_RUNTIME_RESERVATION_EXPIRED", reservation: current });
        const updated = await connection.query(`UPDATE product_runtime_reservations SET last_heartbeat_at = $4, expires_at = $5 WHERE project_id = $1 AND run_id = $2 AND reservation_id = $3 AND state = 'active' RETURNING ${RESERVATION_COLUMNS}`, [safeProjectId, safeRunId, safeReservationId, renewed.lease.lastHeartbeatAt, renewed.lease.expiresAt]);
        return updated.rows?.[0] ? copy({ status: "renewed", code: "PRODUCT_RUNTIME_LEASE_HEARTBEAT", reservation: rowOf(updated.rows[0]) }) : copy({ status: "not-found", code: "PRODUCT_RUNTIME_RESERVATION_NOT_FOUND" });
      });
    },
    async release({ projectId, runId, reservationId, reason = "runner-lifecycle-complete" } = {}) {
      const safeProjectId = assertId("projectId", projectId);
      const safeRunId = assertId("runId", runId);
      const safeReservationId = reservationId ? assertId("reservationId", reservationId) : null;
      if (typeof reason !== "string" || reason.length < 3 || reason.length > 160 || /(?:secret|token|password|credential|api[_-]?key)/i.test(reason)) throw new Error("release reason is invalid.");
      return transaction(target, async connection => {
        await connection.query("SELECT pg_advisory_xact_lock(hashtext('hero-product-runtime-reservations'))");
        const result = await connection.query(`UPDATE product_runtime_reservations SET state = 'released', released_at = $4, release_reason = $5 WHERE project_id = $1 AND run_id = $2 AND state = 'active' AND ($3::text IS NULL OR reservation_id = $3) RETURNING ${RESERVATION_COLUMNS}`, [safeProjectId, safeRunId, safeReservationId, now(), reason]);
        return result.rows?.[0] ? copy({ status: "released", code: "PRODUCT_RUNTIME_RELEASED", reservation: rowOf(result.rows[0]) }) : copy({ status: "not-found", code: "PRODUCT_RUNTIME_RESERVATION_NOT_FOUND" });
      });
    },
    async listActive({ targetId = null } = {}) {
      const result = targetId
        ? await target.query(`SELECT ${RESERVATION_COLUMNS} FROM product_runtime_reservations WHERE target_id = $1 AND state = 'active' ORDER BY reserved_at ASC`, [assertId("targetId", targetId)])
        : await target.query(`SELECT ${RESERVATION_COLUMNS} FROM product_runtime_reservations WHERE state = 'active' ORDER BY reserved_at ASC`);
      return Object.freeze((result.rows ?? []).map(rowOf));
    },
    async reconcile({ targetId = null, mode = "report", apply = false, reconciliationId = `reconciliation-${Date.now()}` } = {}) {
      if (!['report', 'expire'].includes(mode)) throw new Error("reconciliation mode is invalid.");
      if (mode === "expire" && apply !== true) return copy({ status: "blocked", code: "PRODUCT_RUNTIME_RECONCILIATION_CONFIRMATION_REQUIRED", sideEffects: "none" });
      const safeTargetId = targetId === null ? null : assertId("targetId", targetId);
      const safeReconciliationId = assertId("reconciliationId", reconciliationId);
      const observedAt = now();
      const query = safeTargetId
        ? `SELECT ${RESERVATION_COLUMNS} FROM product_runtime_reservations WHERE target_id = $1 AND state = 'active' ORDER BY reserved_at ASC`
        : `SELECT ${RESERVATION_COLUMNS} FROM product_runtime_reservations WHERE state = 'active' ORDER BY reserved_at ASC`;
      const rows = await target.query(query, safeTargetId ? [safeTargetId] : []);
      const proposals = [];
      for (const raw of rows.rows ?? []) {
        const reservation = rowOf(raw);
        const decision = evaluateProductRuntimeLease({ lease: reservation, now: observedAt });
        if (decision.decision === "expire") proposals.push({ reservationId: reservation.reservationId, projectId: reservation.projectId, runId: reservation.runId, reason: "lease-expired" });
        else if (decision.decision === "reject") proposals.push({ reservationId: reservation.reservationId, projectId: reservation.projectId, runId: reservation.runId, reason: "lease-metadata-missing" });
      }
      const unknownCount = proposals.filter(item => item.reason === "lease-metadata-missing").length;
      const expired = proposals.filter(item => item.reason === "lease-expired");
      if (mode === "report") return copy({ status: "report-only", code: "PRODUCT_RUNTIME_RECONCILIATION_REPORT", sideEffects: "none", inspectedCount: rows.rows?.length ?? 0, expiredCount: expired.length, unknownCount, proposals });
      return transaction(target, async connection => {
        await connection.query("SELECT pg_advisory_xact_lock(hashtext('hero-product-runtime-reservations'))");
        let expiredCount = 0;
        for (const item of expired) {
          const result = await connection.query("UPDATE product_runtime_reservations SET state = 'expired', released_at = $3, release_reason = 'lease-expired' WHERE reservation_id = $1 AND state = 'active' AND expires_at <= $2", [item.reservationId, observedAt, observedAt]);
          expiredCount += result.rowCount ?? result.rows?.length ?? 0;
        }
        await connection.query("INSERT INTO product_runtime_reconciliation_runs (reconciliation_id, target_id, mode, observed_at, inspected_count, expired_count, unknown_count, decision) VALUES ($1,$2,$3,$4,$5,$6,$7,'applied')", [safeReconciliationId, safeTargetId ?? PRODUCT_RUNTIME_CAPACITY_TARGET, mode, observedAt, rows.rows?.length ?? 0, expiredCount, unknownCount]);
        return copy({ status: "applied", code: "PRODUCT_RUNTIME_RECONCILIATION_APPLIED", sideEffects: "bounded-product-metadata", inspectedCount: rows.rows?.length ?? 0, expiredCount, unknownCount, proposals });
      });
    }
  });
}
