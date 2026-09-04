import assert from "node:assert/strict";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

test("owner can inspect persisted-ready benchmark history and advisory comparison", async t => {
  const now = () => "2026-09-04T12:00:00.000Z";
  const ownerAuth = createOwnerAuth({ secret: "test-only-benchmark-http-secret-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "benchmark-http-session-001", expiresAt: 2_000_000_000 });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  assert.equal((await fetch(`${base}/api/ai/benchmarks`)).status, 401);
  for (const [benchmarkId, latencyMs] of [["BENCH-HTTP-001", 8], ["BENCH-HTTP-002", 3]]) {
    const response = await fetch(`${base}/api/ai/benchmarks/synthetic`, { method: "POST", headers, body: JSON.stringify({ benchmarkId, latencyMs }) });
    assert.equal(response.status, 201);
  }
  const listed = await fetch(`${base}/api/ai/benchmarks`, { headers });
  assert.equal(listed.status, 200);
  const payload = await listed.json();
  assert.equal(payload.source, "in-memory");
  assert.equal(payload.benchmark.recent.length, 2);
  const comparison = await fetch(`${base}/api/ai/benchmarks/compare?limit=10`, { headers });
  assert.equal(comparison.status, 200);
  const comparisonPayload = await comparison.json();
  assert.equal(comparisonPayload.comparison.winner.benchmarkId, "BENCH-HTTP-002");
  assert.equal(comparisonPayload.comparison.decision, "advisory-only");
});
