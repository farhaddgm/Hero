import assert from "node:assert/strict";
import test from "node:test";

import { createDockerProductRuntimeCapacityProbe } from "../packages/adapters/src/product-runtime-capacity.mjs";

test("capacity probe uses argv-only Docker metadata and returns no raw output", async () => {
  const calls = [];
  const probe = createDockerProductRuntimeCapacityProbe({ executor: async request => { calls.push(request); return { exitCode: 0, stdout: JSON.stringify({ NCPU: 4, MemTotal: 4 * 1_048_576 * 1_024 }), stderr: "secret must not return" }; } });
  const result = await probe.observe({ snapshotId: "capacity-001", pidsLimit: 512, maxConcurrentRuns: 2, observedAt: "2026-09-18T00:00:00.000Z" });
  assert.equal(result.status, "observed");
  assert.equal(result.snapshot.cpuCores, 4);
  assert.equal(result.snapshot.memoryMiB, 4096);
  assert.deepEqual(calls[0].argv, ["info", "--format", "{{json .}}"]);
  assert.equal(Object.hasOwn(result, "stdout"), false);
  assert.equal(result.sideEffects, "none");
});

test("capacity probe fails closed for Docker failure or malformed output", async () => {
  const failed = createDockerProductRuntimeCapacityProbe({ executor: async () => ({ exitCode: 1, stdout: "", timedOut: true }) });
  assert.equal((await failed.observe({ snapshotId: "capacity-001", pidsLimit: 512, maxConcurrentRuns: 2 })).code, "PRODUCT_RUNTIME_CAPACITY_PROBE_FAILED");
  const malformed = createDockerProductRuntimeCapacityProbe({ executor: async () => ({ exitCode: 0, stdout: "not-json" }) });
  assert.equal((await malformed.observe({ snapshotId: "capacity-002", pidsLimit: 512, maxConcurrentRuns: 2 })).code, "PRODUCT_RUNTIME_CAPACITY_PROBE_INVALID_OUTPUT");
});
