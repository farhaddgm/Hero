import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateProductRuntimeCapacity,
  getProductRuntimeCapacitySummary,
  normalizeProductRuntimeCapacitySnapshot,
  validateProductRuntimeCapacityContract
} from "../packages/contracts/src/product-runtime-capacity.mjs";

const capacity = {
  snapshotId: "capacity-001",
  targetId: "hero-product-test",
  cpuCores: 2,
  memoryMiB: 2048,
  pidsLimit: 512,
  maxConcurrentRuns: 2,
  source: "docker.info",
  observedAt: "2026-09-18T00:00:00.000Z"
};

test("Product Runtime Capacity contract is versioned and Test-scoped", () => {
  assert.deepEqual(validateProductRuntimeCapacityContract(), []);
  const summary = getProductRuntimeCapacitySummary();
  assert.equal(summary.target, "hero-product-test");
  assert.equal(summary.units.memory, "MiB");
});

test("capacity snapshot normalizes safe observed metadata and rejects unsafe environments", () => {
  assert.equal(normalizeProductRuntimeCapacitySnapshot(capacity).environment, "test");
  assert.throws(() => normalizeProductRuntimeCapacitySnapshot({ ...capacity, environment: "production" }), /environment/);
  assert.throws(() => normalizeProductRuntimeCapacitySnapshot({ ...capacity, source: "host password" }), /source/);
});

test("capacity admission admits within limits and rejects aggregate exhaustion", () => {
  const requested = { cpuCores: 1, memoryMiB: 1024, pidsLimit: 256, concurrentRuns: 1 };
  assert.equal(evaluateProductRuntimeCapacity({ capacity, requested }).decision, "admit");
  const rejected = evaluateProductRuntimeCapacity({ capacity, requested, reserved: { cpuCores: 2, memoryMiB: 2048, pidsLimit: 512, concurrentRuns: 2 } });
  assert.equal(rejected.decision, "reject");
  assert.match(rejected.errors.join(" "), /capacity is exhausted/);
  assert.equal(rejected.sideEffects, "none");
});
