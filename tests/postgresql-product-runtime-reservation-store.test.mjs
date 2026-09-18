import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresProductRuntimeReservationStore } from "../packages/adapters/src/postgresql-product-runtime-reservation-store.mjs";

const fingerprint = "a".repeat(64);
const capacity = Object.freeze({
  snapshot_id: "capacity-001",
  target_id: "hero-product-test",
  environment: "test",
  cpu_cores: 2,
  memory_mib: 2048,
  pids_limit: 512,
  max_concurrent_runs: 2,
  source: "docker.info",
  observed_at: "2026-09-18T00:00:00.000Z"
});
const baseRow = Object.freeze({
  reservation_id: "reservation-001",
  project_id: "project-safe",
  run_id: "run-product-001",
  target_id: "hero-product-test",
  capacity_snapshot_id: "capacity-001",
  plan_fingerprint: fingerprint,
  ports: [18080],
  resource_names: ["hero-product-project-safe"],
  cpu_cores: 1,
  memory_mib: 1024,
  pids_limit: 256,
  state: "active",
  reserved_at: "2026-09-18T00:00:00.000Z",
  lease_ttl_seconds: 1800,
  last_heartbeat_at: "2026-09-18T00:00:00.000Z",
  expires_at: "2026-09-18T00:30:00.000Z",
  released_at: null,
  release_reason: null
});

function fakeClient({ existing = [], conflicts = [], active = [], capacityRows = [capacity], totals = null } = {}) {
  const queries = [];
  const client = {
    queries,
    async query(text, values = []) {
      queries.push({ text, values });
      if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") return { rows: [] };
      if (text.includes("pg_advisory_xact_lock")) return { rows: [] };
      if (text.startsWith("INSERT INTO product_runtime_capacity_snapshots")) return { rows: [capacity] };
      if (text.includes("FROM product_runtime_capacity_snapshots") && text.includes("ORDER BY observed_at")) return { rows: capacityRows };
      if (text.includes("FROM product_runtime_capacity_snapshots")) return { rows: capacityRows };
      if (text.includes("WHERE project_id = $1 AND run_id = $2 FOR UPDATE")) return { rows: existing };
      if (text.includes("target_id = $1 AND state = 'active' AND (ports &&")) return { rows: conflicts };
      if (text.includes("COALESCE(SUM(cpu_cores)")) return { rows: [totals ?? { cpu_cores: 0, memory_mib: 0, pids_limit: 0, concurrent_runs: 0, unknown_count: 0 }] };
      if (text.startsWith("INSERT INTO product_runtime_reservations")) return { rows: [baseRow] };
      if (text.startsWith("UPDATE product_runtime_reservations SET reservation_id")) return { rows: [{ ...baseRow, reservation_id: values[0], target_id: values[1], capacity_snapshot_id: values[2], plan_fingerprint: values[3], ports: values[4], resource_names: values[5], cpu_cores: values[6], memory_mib: values[7], pids_limit: values[8], reserved_at: values[9], lease_ttl_seconds: values[10], last_heartbeat_at: values[11], expires_at: values[12] }] };
      if (text.includes("WHERE project_id = $1 AND run_id = $2 AND reservation_id = $3 FOR UPDATE")) return { rows: existing.length ? existing : [baseRow] };
      if (text.startsWith("UPDATE product_runtime_reservations SET last_heartbeat_at")) return { rows: [{ ...baseRow, last_heartbeat_at: values[3], expires_at: values[4] }] };
      if (text.startsWith("UPDATE product_runtime_reservations SET state = 'expired'")) return { rows: [] , rowCount: 1 };
      if (text.startsWith("INSERT INTO product_runtime_reconciliation_runs")) return { rows: [] };
      if (text.startsWith("UPDATE product_runtime_reservations SET state")) return { rows: [{ ...baseRow, state: "released", released_at: values[3], release_reason: values[4] }] };
      if (text.includes("WHERE project_id = $1 AND run_id = $2 LIMIT 1")) return { rows: existing };
      if (text.includes("WHERE state = 'active' ORDER BY")) return { rows: active };
      throw new Error(`Unexpected query: ${text}`);
    }
  };
  return client;
}

function storeFor(options = {}) {
  const client = fakeClient(options);
  const store = createPostgresProductRuntimeReservationStore({ client, now: () => "2026-09-18T00:00:00.000Z" });
  return { client, store };
}

function input(overrides = {}) {
  return {
    reservationId: "reservation-001",
    projectId: "project-safe",
    runId: "run-product-001",
    targetId: "hero-product-test",
    capacitySnapshotId: "capacity-001",
    planFingerprint: fingerprint,
    ports: [18080],
    resourceNames: ["hero-product-project-safe"],
    resourceLimits: { cpuLimit: 1, memoryMiB: 1024, pidsLimit: 256 },
    ...overrides
  };
}

test("persistent store records capacity snapshots idempotently", async () => {
  const { client, store } = storeFor();
  const result = await store.recordCapacitySnapshot({ snapshotId: "capacity-001", targetId: "hero-product-test", cpuCores: 2, memoryMiB: 2048, pidsLimit: 512, maxConcurrentRuns: 2, source: "docker.info", observedAt: "2026-09-18T00:00:00.000Z" });
  assert.equal(result.status, "recorded");
  assert.equal(result.snapshot.memoryMiB, 2048);
  assert.ok(client.queries[0].text.startsWith("INSERT INTO product_runtime_capacity_snapshots"));
});

test("persistent reservation store serializes and inserts capacity-bounded safe metadata", async () => {
  const { client, store } = storeFor();
  const result = await store.reserve(input());
  assert.equal(result.status, "reserved");
  assert.equal(result.code, "PRODUCT_RUNTIME_RESERVED");
  assert.equal(result.reservation.projectId, "project-safe");
  assert.equal(result.reservation.cpuCores, 1);
  assert.ok(client.queries.some(query => query.text.includes("pg_advisory_xact_lock")));
  const insert = client.queries.find(query => query.text.startsWith("INSERT INTO product_runtime_reservations"));
  assert.deepEqual(insert.values.slice(0, 9), ["reservation-001", "project-safe", "run-product-001", "hero-product-test", "capacity-001", fingerprint, [18080], ["hero-product-project-safe"], 1]);
  assert.equal(insert.values.some(value => typeof value === "string" && /secret|token|password|api[_-]?key/i.test(value)), false);
});

test("persistent reservation store blocks an active resource conflict", async () => {
  const { client, store } = storeFor({ conflicts: [{ reservation_id: "other-reservation" }] });
  const result = await store.reserve(input({ runId: "run-product-002", reservationId: "reservation-002" }));
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "PRODUCT_RUNTIME_RESOURCE_CONFLICT");
  assert.equal(client.queries.some(query => query.text.startsWith("INSERT INTO product_runtime_reservations")), false);
});

test("persistent reservation store blocks capacity exhaustion before insert", async () => {
  const { client, store } = storeFor({ totals: { cpu_cores: 2, memory_mib: 2048, pids_limit: 512, concurrent_runs: 2, unknown_count: 0 } });
  const result = await store.reserve(input({ runId: "run-product-002", reservationId: "reservation-002" }));
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "PRODUCT_RUNTIME_CAPACITY_EXHAUSTED");
  assert.equal(client.queries.some(query => query.text.startsWith("INSERT INTO product_runtime_reservations")), false);
});

test("persistent reservation store fails closed when an older active lease has unknown capacity", async () => {
  const { client, store } = storeFor({ totals: { cpu_cores: 0, memory_mib: 0, pids_limit: 0, concurrent_runs: 1, unknown_count: 1 } });
  const result = await store.reserve(input({ runId: "run-product-003", reservationId: "reservation-003" }));
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "PRODUCT_RUNTIME_CAPACITY_REQUIRED");
  assert.equal(client.queries.some(query => query.text.startsWith("INSERT INTO product_runtime_reservations")), false);
});

test("same active reservation replays, while a changed plan is blocked", async () => {
  const replay = storeFor({ existing: [baseRow] });
  const replayResult = await replay.store.reserve(input());
  assert.equal(replayResult.status, "replayed");
  assert.equal(replayResult.reservation.reservationId, "reservation-001");

  const changed = storeFor({ existing: [{ ...baseRow, plan_fingerprint: "b".repeat(64) }] });
  const changedResult = await changed.store.reserve(input());
  assert.equal(changedResult.status, "blocked");
  assert.equal(changedResult.code, "PRODUCT_RUNTIME_RESOURCE_CONFLICT");
});

test("released reservation can be reused and inspect preserves its state", async () => {
  const releasedRow = { ...baseRow, state: "released", released_at: "2026-09-18T00:01:00.000Z", release_reason: "runner-lifecycle-complete" };
  const reused = storeFor({ existing: [releasedRow] });
  const reuseResult = await reused.store.reserve(input({ reservationId: "reservation-002" }));
  assert.equal(reuseResult.status, "reserved");
  assert.equal(reuseResult.reservation.reservationId, "reservation-002");
  const inspected = await reused.store.inspect({ projectId: "project-safe", runId: "run-product-001" });
  assert.equal(inspected.state, "released");
});

test("release is transactional, redacts unsafe reasons, and lists active rows", async () => {
  const { client, store } = storeFor({ active: [baseRow] });
  await assert.rejects(() => store.release(input({ reason: "contains-api-key" })), /release reason is invalid/);
  const released = await store.release(input({ reason: "runner-lifecycle-complete" }));
  assert.equal(released.status, "released");
  assert.equal(released.reservation.state, "released");
  assert.deepEqual((await store.listActive()).map(row => row.reservationId), ["reservation-001"]);
  assert.ok(client.queries.some(query => query.text === "COMMIT"));
});

test("persistent store reports expired leases and requires explicit reconciliation", async () => {
  const expiredRow = { ...baseRow, expires_at: "2026-09-17T23:00:00.000Z" };
  const { store } = storeFor({ active: [expiredRow] });
  const report = await store.reconcile();
  assert.equal(report.status, "report-only");
  assert.equal(report.expiredCount, 1);
  assert.equal((await store.reconcile({ mode: "expire" })).code, "PRODUCT_RUNTIME_RECONCILIATION_CONFIRMATION_REQUIRED");
});

test("persistent store renews a live lease without exposing command data", async () => {
  const { store } = storeFor({ existing: [baseRow] });
  const renewed = await store.heartbeat({ projectId: "project-safe", runId: "run-product-001", reservationId: "reservation-001" });
  assert.equal(renewed.status, "renewed");
  assert.equal(renewed.reservation.lastHeartbeatAt, "2026-09-18T00:00:00.000Z");
  assert.equal(Object.hasOwn(renewed, "stdout"), false);
});
