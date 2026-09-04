import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresBenchmarkStore } from "../packages/adapters/src/index.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";

const now = () => "2026-09-04T12:00:00.000Z";

function sampleRun(overrides = {}) {
  return {
    benchmarkId: "BENCH-PERSIST-001",
    providerId: "deterministic",
    modelId: "default",
    profileId: "hero-default-v1",
    datasetVersion: "synthetic-v1",
    mode: "synthetic-deterministic",
    contractVersion: "1.0",
    metrics: { completionRate: 1, schemaPassRate: 1, safetyPassRate: 1, averageLatencyMs: 4, totalCostUnits: 0 },
    recommendationEligible: true,
    authority: { canAuthorizeProvider: false, canAuthorizeMutation: false, canAuthorizeRelease: false },
    digest: "a".repeat(64),
    recordedAt: now(),
    results: [{ caseId: "structured-analysis", role: "analyst", status: "completed", schemaPass: true, safetyPass: true, latencyMs: 4, costUnits: 0, errorCode: null }],
    ...overrides
  };
}

function fakeClient() {
  const runs = new Map();
  const results = new Map();
  const queries = [];
  return {
    queries,
    async query(text, params = []) {
      queries.push({ text, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text) || text.startsWith("SELECT pg_advisory")) return { rows: [] };
      if (text.startsWith("SELECT benchmark_id") && text.includes("WHERE benchmark_id")) {
        return { rows: runs.has(params[0]) ? [runs.get(params[0])] : [] };
      }
      if (text.startsWith("SELECT result_id")) return { rows: [...results.values()].filter(row => row.benchmark_id === params[0]) };
      if (text.startsWith("SELECT benchmark_id") && text.includes("ORDER BY recorded_at")) return { rows: [...runs.values()] };
      if (text.startsWith("INSERT INTO ai_benchmark_runs")) {
        const [benchmarkId, providerId, modelId, profileId, mode, metrics, recommendationEligible, authority, recordedAt, data] = params;
        runs.set(benchmarkId, { benchmark_id: benchmarkId, provider_id: providerId, model_id: modelId, profile_id: profileId, mode, metrics, recommendation_eligible: recommendationEligible, authority, recorded_at: recordedAt, data });
        return { rows: [] };
      }
      if (text.startsWith("INSERT INTO ai_benchmark_results")) {
        const [resultId, benchmarkId, caseId, role, status, schemaPass, safetyPass, latencyMs, costUnits, errorCode, data] = params;
        results.set(resultId, { result_id: resultId, benchmark_id: benchmarkId, case_id: caseId, role, status, schema_pass: schemaPass, safety_pass: safetyPass, latency_ms: latencyMs, cost_units: costUnits, error_code: errorCode, data });
        return { rows: [] };
      }
      throw new Error(`unexpected query: ${text}`);
    }
  };
}

test("PostgreSQL benchmark store persists a safe run and replays idempotently", async () => {
  const client = fakeClient();
  const store = createPostgresBenchmarkStore({ client, now });
  const run = sampleRun();
  const saved = await store.save(run);
  assert.equal(saved.idempotent, false);
  assert.equal(saved.results[0].resultId, "BENCH-PERSIST-001-structured-analysis");
  const replay = await store.save(run);
  assert.equal(replay.idempotent, true);
  assert.equal(replay.digest, run.digest);
  await assert.rejects(() => store.save({ ...run, digest: "b".repeat(64) }), error => error.code === "IDEMPOTENCY_CONFLICT");
  await assert.rejects(() => store.save({ ...run, benchmarkId: "BENCH-PERSIST-002", results: [...run.results, { ...run.results[0] }] }), error => error.code === "INVALID_BENCHMARK");
  assert.doesNotMatch(JSON.stringify(client.queries), /prompt|password|credential|secret|token/i);
});

test("PostgreSQL benchmark store restores, lists and compares only advisory runs", async () => {
  const client = fakeClient();
  const store = createPostgresBenchmarkStore({ client, now });
  await store.save(sampleRun());
  await store.save(sampleRun({ benchmarkId: "BENCH-PERSIST-002", profileId: "hero-fast-v1", digest: "b".repeat(64), metrics: { completionRate: 1, schemaPassRate: 1, safetyPassRate: 1, averageLatencyMs: 2, totalCostUnits: 0 }, recordedAt: "2026-09-04T12:01:00.000Z" }));
  const restored = await store.read("BENCH-PERSIST-002");
  assert.equal(restored.results.length, 1);
  const listed = await store.list({ limit: 10 });
  assert.equal(listed.length, 2);
  const comparison = await store.compare({ limit: 10 });
  assert.equal(comparison.winner.benchmarkId, "BENCH-PERSIST-002");
  assert.equal(comparison.decision, "advisory-only");
  assert.equal(comparison.runs[0].authority.canAuthorizeProvider, false);
  await assert.rejects(() => store.save({ ...sampleRun(), mode: "live" }), error => error.code === "LIVE_BENCHMARK_REJECTED");
  await assert.rejects(() => store.compare({ limit: 0 }), error => error.code === "INVALID_LIMIT");
});

test("Control Plane hydrates persisted benchmarks and keeps the HTTP surface advisory-only", async t => {
  const ownerAuth = createOwnerAuth({ secret: "test-only-postgres-benchmark-owner-secret-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "benchmark-persistence-http", expiresAt: 2_000_000_000 });
  const persisted = sampleRun({ benchmarkId: "BENCH-PERSISTED-HTTP", recordedAt: "2026-09-04T12:02:00.000Z" });
  const saved = [];
  const benchmarkStore = {
    async list() { return [persisted]; },
    async save(run) { saved.push(run); return { ...run, idempotent: false }; },
    async compare() {
      return {
        compared: 1,
        eligible: 1,
        winner: { benchmarkId: persisted.benchmarkId, providerId: persisted.providerId, modelId: persisted.modelId, profileId: persisted.profileId },
        decision: "advisory-only",
        runs: [persisted]
      };
    }
  };
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    now,
    ownerAuth,
    postgresRuntime: { benchmarkStore, async ping() { return { status: "ok", persistence: "postgresql" }; } }
  });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const history = await fetch(`${baseUrl}/api/ai/benchmarks`, { headers });
  assert.equal(history.status, 200);
  const historyBody = await history.json();
  assert.equal(historyBody.source, "postgresql");
  assert.equal(historyBody.benchmark.latest.benchmarkId, persisted.benchmarkId);

  const created = await fetch(`${baseUrl}/api/ai/benchmarks/synthetic`, {
    method: "POST",
    headers,
    body: JSON.stringify({ benchmarkId: "BENCH-PERSISTED-NEW", latencyMs: 3 })
  });
  assert.equal(created.status, 201);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].authority.canAuthorizeRelease, false);

  const comparison = await fetch(`${baseUrl}/api/ai/benchmarks/compare?limit=10`, { headers });
  assert.equal(comparison.status, 200);
  assert.equal((await comparison.json()).comparison.decision, "advisory-only");
});
