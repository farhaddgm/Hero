import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresProductRuntimeReservationStore } from "../packages/adapters/src/postgresql-product-runtime-reservation-store.mjs";

const fingerprint = "a".repeat(64);
const baseRow = Object.freeze({
  reservation_id: "reservation-001",
  project_id: "project-safe",
  run_id: "run-product-001",
  plan_fingerprint: fingerprint,
  ports: [18080],
  resource_names: ["hero-product-project-safe"],
  state: "active",
  reserved_at: "2026-09-18T00:00:00.000Z",
  released_at: null,
  release_reason: null
});

function fakeClient({ existing = [], conflicts = [], active = [] } = {}) {
  const queries = [];
  const client = {
    queries,
    async query(text, values = []) {
      queries.push({ text, values });
      if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") return { rows: [] };
      if (text.includes("pg_advisory_xact_lock")) return { rows: [] };
      if (text.includes("WHERE project_id = $1 AND run_id = $2 FOR UPDATE")) return { rows: existing };
      if (text.includes("state = 'active' AND (ports &&")) return { rows: conflicts };
      if (text.startsWith("INSERT INTO product_runtime_reservations")) return { rows: [baseRow] };
      if (text.startsWith("UPDATE product_runtime_reservations SET reservation_id")) return { rows: [{ ...baseRow, reservation_id: values[0], plan_fingerprint: values[2], ports: values[3], resource_names: values[4], reserved_at: values[5] }] };
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
    planFingerprint: fingerprint,
    ports: [18080],
    resourceNames: ["hero-product-project-safe"],
    ...overrides
  };
}

test("persistent reservation store serializes and inserts safe metadata only", async () => {
  const { client, store } = storeFor();
  const result = await store.reserve(input());
  assert.equal(result.status, "reserved");
  assert.equal(result.code, "PRODUCT_RUNTIME_RESERVED");
  assert.equal(result.reservation.projectId, "project-safe");
  assert.ok(client.queries.some(query => query.text.includes("pg_advisory_xact_lock")));
  const insert = client.queries.find(query => query.text.startsWith("INSERT INTO"));
  assert.deepEqual(insert.values.slice(0, 6), ["reservation-001", "project-safe", "run-product-001", fingerprint, [18080], ["hero-product-project-safe"]]);
  assert.equal(insert.values.some(value => typeof value === "string" && /secret|token|password|api[_-]?key/i.test(value)), false);
});

test("persistent reservation store blocks an active resource conflict", async () => {
  const { client, store } = storeFor({ conflicts: [{ reservation_id: "other-reservation" }] });
  const result = await store.reserve(input({ runId: "run-product-002", reservationId: "reservation-002" }));
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "PRODUCT_RUNTIME_RESOURCE_CONFLICT");
  assert.equal(client.queries.some(query => query.text.startsWith("INSERT INTO")), false);
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

test("released reservation can be reused and stop cannot use a released lease", async () => {
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
