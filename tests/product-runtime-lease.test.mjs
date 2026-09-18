import assert from "node:assert/strict";
import test from "node:test";

import {
  createProductRuntimeLease,
  evaluateProductRuntimeLease,
  heartbeatProductRuntimeLease,
  validateProductRuntimeLeaseContract
} from "../packages/contracts/src/product-runtime-lease.mjs";

const reservedAt = "2026-09-18T00:00:00.000Z";

test("Product Runtime Lease contract is versioned and bounded", () => {
  assert.deepEqual(validateProductRuntimeLeaseContract(), []);
  const lease = createProductRuntimeLease({ reservationId: "reservation-001", reservedAt, leaseTtlSeconds: 600 });
  assert.equal(lease.expiresAt, "2026-09-18T00:10:00.000Z");
});

test("lease evaluation distinguishes active, expired and invalid metadata", () => {
  const lease = createProductRuntimeLease({ reservationId: "reservation-001", reservedAt, leaseTtlSeconds: 600 });
  assert.equal(evaluateProductRuntimeLease({ lease, now: "2026-09-18T00:05:00.000Z" }).decision, "active");
  assert.equal(evaluateProductRuntimeLease({ lease, now: "2026-09-18T00:10:00.000Z" }).decision, "expire");
  assert.equal(evaluateProductRuntimeLease({ lease: { ...lease, expiresAt: null }, now: reservedAt }).decision, "reject");
});

test("heartbeat renews only a live lease and never authorizes execution", () => {
  const lease = createProductRuntimeLease({ reservationId: "reservation-001", reservedAt, leaseTtlSeconds: 600 });
  const renewed = heartbeatProductRuntimeLease({ lease, now: "2026-09-18T00:05:00.000Z" });
  assert.equal(renewed.status, "renewed");
  assert.equal(renewed.lease.expiresAt, "2026-09-18T00:15:00.000Z");
  assert.equal(renewed.decision.sideEffects, "none");
  assert.equal(heartbeatProductRuntimeLease({ lease, now: "2026-09-18T00:11:00.000Z" }).status, "blocked");
});
