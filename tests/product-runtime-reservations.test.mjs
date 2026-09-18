import assert from "node:assert/strict";
import test from "node:test";

import { createProductRuntimePlan } from "../packages/domain/src/product-factory.mjs";
import { createProductRuntimeReservationRegistry } from "../packages/adapters/src/product-runtime-reservations.mjs";

function plan(projectId = "project-safe") {
  const value = structuredClone(createProductRuntimePlan({ projectId }));
  value.state = "approved";
  value.execution.mode = "isolated-test";
  return value;
}

test("reservation registry accepts an approved isolated Product Test plan", () => {
  const registry = createProductRuntimeReservationRegistry({ now: () => "2026-09-18T00:00:00.000Z" });
  const result = registry.reserve({ projectId: "project-safe", runId: "run-product-001", plan: plan() });
  assert.equal(result.status, "reserved");
  assert.equal(result.code, "PRODUCT_RUNTIME_RESERVED");
  assert.equal(result.reservation.projectId, "project-safe");
  assert.equal(result.reservation.resourceNames[0], "hero-product-project-safe");
});

test("reservation registry rejects resource reuse across runs", () => {
  const registry = createProductRuntimeReservationRegistry();
  const first = registry.reserve({ projectId: "project-safe", runId: "run-product-001", plan: plan() });
  const second = registry.reserve({ projectId: "project-safe", runId: "run-product-002", plan: plan() });
  assert.equal(first.status, "reserved");
  assert.equal(second.status, "blocked");
  assert.equal(second.code, "PRODUCT_RUNTIME_RESOURCE_CONFLICT");
  assert.equal(registry.snapshot().reservations.length, 1);
});

test("same reservation is idempotent and release requires the matching reservation", () => {
  const registry = createProductRuntimeReservationRegistry();
  const first = registry.reserve({ projectId: "project-safe", runId: "run-product-001", plan: plan() });
  const replay = registry.reserve({ projectId: "project-safe", runId: "run-product-001", plan: plan() });
  assert.equal(replay.status, "replayed");
  assert.equal(replay.reservation.reservationId, first.reservation.reservationId);
  assert.equal(registry.release({ projectId: "project-safe", runId: "run-product-001", reservationId: "wrong" }).status, "not-found");
  assert.equal(registry.release({ projectId: "project-safe", runId: "run-product-001", reservationId: first.reservation.reservationId }).status, "released");
  assert.equal(registry.snapshot().reservations.length, 0);
});

test("invalid plans and non-product resource names fail closed", () => {
  const registry = createProductRuntimeReservationRegistry();
  assert.throws(() => registry.reserve({ projectId: "project-safe", runId: "run-product-001", plan: plan(), resourceNames: ["hero-test-control-plane"] }));
  const invalid = plan();
  invalid.execution.mode = "plan-only";
  const result = registry.reserve({ projectId: "project-safe", runId: "run-product-001", plan: invalid });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "PRODUCT_RUNTIME_RESOURCE_CONFLICT");
});

test("snapshot contains only safe reservation metadata", () => {
  const registry = createProductRuntimeReservationRegistry();
  registry.reserve({ projectId: "project-safe", runId: "run-product-001", plan: plan(), ports: [18080] });
  const snapshot = registry.snapshot();
  assert.equal(snapshot.reservations[0].ports[0], 18080);
  assert.equal(Object.hasOwn(snapshot.reservations[0], "secret"), false);
  assert.equal(Object.hasOwn(snapshot.reservations[0], "credential"), false);
});
