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

function rowOf(row) {
  if (!row) return null;
  return copy({
    reservationId: row.reservation_id,
    projectId: row.project_id,
    runId: row.run_id,
    planFingerprint: row.plan_fingerprint,
    ports: row.ports ?? [],
    resourceNames: row.resource_names ?? [],
    state: row.state,
    reservedAt: row.reserved_at,
    releasedAt: row.released_at ?? null,
    releaseReason: row.release_reason ?? null
  });
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
    async reserve({ reservationId, projectId, runId, planFingerprint, ports = [], resourceNames = [] } = {}) {
      const safeReservationId = assertId("reservationId", reservationId);
      const safeProjectId = assertId("projectId", projectId);
      const safeRunId = assertId("runId", runId);
      const safeFingerprint = assertFingerprint(planFingerprint);
      const safePorts = assertPorts(ports);
      const safeResourceNames = assertResourceNames(resourceNames);
      return transaction(target, async connection => {
        await connection.query("SELECT pg_advisory_xact_lock(hashtext('hero-product-runtime-reservations'))");
        const existingResult = await connection.query("SELECT reservation_id, project_id, run_id, plan_fingerprint, ports, resource_names, state, reserved_at, released_at, release_reason FROM product_runtime_reservations WHERE project_id = $1 AND run_id = $2 FOR UPDATE", [safeProjectId, safeRunId]);
        const existing = existingResult.rows?.[0];
        if (existing?.state === "active") {
          const same = existing.reservation_id === safeReservationId && existing.plan_fingerprint === safeFingerprint && JSON.stringify(existing.ports ?? []) === JSON.stringify(safePorts) && JSON.stringify(existing.resource_names ?? []) === JSON.stringify(safeResourceNames);
          return copy({ status: same ? "replayed" : "blocked", code: same ? "PRODUCT_RUNTIME_RESERVATION_REPLAY" : "PRODUCT_RUNTIME_RESOURCE_CONFLICT", reservation: same ? rowOf(existing) : null });
        }
        const conflictResult = await connection.query("SELECT reservation_id FROM product_runtime_reservations WHERE state = 'active' AND (ports && $1::integer[] OR resource_names && $2::text[]) LIMIT 1 FOR UPDATE", [safePorts, safeResourceNames]);
        if (conflictResult.rows?.length) return copy({ status: "blocked", code: "PRODUCT_RUNTIME_RESOURCE_CONFLICT", reservation: null });
        if (existing) {
          const result = await connection.query("UPDATE product_runtime_reservations SET reservation_id = $1, plan_fingerprint = $3, ports = $4, resource_names = $5, state = 'active', reserved_at = $6, released_at = NULL, release_reason = NULL WHERE project_id = $2 AND run_id = $7 RETURNING reservation_id, project_id, run_id, plan_fingerprint, ports, resource_names, state, reserved_at, released_at, release_reason", [safeReservationId, safeProjectId, safeFingerprint, safePorts, safeResourceNames, now(), safeRunId]);
          return copy({ status: "reserved", code: "PRODUCT_RUNTIME_RESERVED", reservation: rowOf(result.rows?.[0]) });
        }
        const result = await connection.query("INSERT INTO product_runtime_reservations (reservation_id, project_id, run_id, plan_fingerprint, ports, resource_names, state, reserved_at) VALUES ($1,$2,$3,$4,$5,$6,'active',$7) RETURNING reservation_id, project_id, run_id, plan_fingerprint, ports, resource_names, state, reserved_at, released_at, release_reason", [safeReservationId, safeProjectId, safeRunId, safeFingerprint, safePorts, safeResourceNames, now()]);
        return copy({ status: "reserved", code: "PRODUCT_RUNTIME_RESERVED", reservation: rowOf(result.rows?.[0]) });
      });
    },
    async inspect({ projectId, runId } = {}) {
      const result = await target.query("SELECT reservation_id, project_id, run_id, plan_fingerprint, ports, resource_names, state, reserved_at, released_at, release_reason FROM product_runtime_reservations WHERE project_id = $1 AND run_id = $2 LIMIT 1", [assertId("projectId", projectId), assertId("runId", runId)]);
      return rowOf(result.rows?.[0]);
    },
    async release({ projectId, runId, reservationId, reason = "runner-lifecycle-complete" } = {}) {
      const safeProjectId = assertId("projectId", projectId);
      const safeRunId = assertId("runId", runId);
      const safeReservationId = reservationId ? assertId("reservationId", reservationId) : null;
      if (typeof reason !== "string" || reason.length < 3 || reason.length > 160 || /(?:secret|token|password|credential|api[_-]?key)/i.test(reason)) throw new Error("release reason is invalid.");
      return transaction(target, async connection => {
        await connection.query("SELECT pg_advisory_xact_lock(hashtext('hero-product-runtime-reservations'))");
        const result = await connection.query("UPDATE product_runtime_reservations SET state = 'released', released_at = $4, release_reason = $5 WHERE project_id = $1 AND run_id = $2 AND state = 'active' AND ($3::text IS NULL OR reservation_id = $3) RETURNING reservation_id, project_id, run_id, plan_fingerprint, ports, resource_names, state, reserved_at, released_at, release_reason", [safeProjectId, safeRunId, safeReservationId, now(), reason]);
        return result.rows?.[0] ? copy({ status: "released", code: "PRODUCT_RUNTIME_RELEASED", reservation: rowOf(result.rows[0]) }) : copy({ status: "not-found", code: "PRODUCT_RUNTIME_RESERVATION_NOT_FOUND" });
      });
    },
    async listActive() {
      const result = await target.query("SELECT reservation_id, project_id, run_id, plan_fingerprint, ports, resource_names, state, reserved_at, released_at, release_reason FROM product_runtime_reservations WHERE state = 'active' ORDER BY reserved_at ASC");
      return Object.freeze((result.rows ?? []).map(rowOf));
    }
  });
}
