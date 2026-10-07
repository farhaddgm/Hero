// BO-153: load, soak and failure injection against a live Hero instance. Budgets
// are explicit and every outcome is a counted check; nothing is asserted by hand.
import { createRecorder } from "../acceptance/audit-lib.mjs";

export const LOAD_BUDGETS = Object.freeze({ p95Ms: 2000, errorRate: 0, soakHeapGrowthMb: 200 });
const percentile = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0;

async function pool(tasks, concurrency) {
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, async () => { while (next < tasks.length) { const index = next++; results[index] = await tasks[index](); } }));
  return results;
}
const timed = async run => { const start = performance.now(); const response = await run(); return { ...response, ms: performance.now() - start }; };

/** Reads that every page and dashboard depends on, repeated under concurrency. */
export async function runLoad(fixture, recorder, { rounds = 8, concurrency = 12 } = {}) {
  const { call, page } = fixture; const root = "/api/projects/project-alpha";
  const reads = [() => call("viewer", "GET", `${root}/notifications?view=critical`), () => call("viewer", "GET", `${root}/operations`), () => call("viewer", "GET", `${root}/ledger?groupBy=team`), () => call("viewer", "GET", `${root}/audit-log?limit=50`), () => call("viewer", "GET", `${root}/slo`), () => call("viewer", "GET", `${root}/catalog`), () => page("viewer", "inbox"), () => page("admin", "control"), () => page("viewer", "insights"), () => page("viewer", "catalog")];
  const tasks = Array.from({ length: rounds }, () => reads).flat().map(read => () => timed(read));
  const started = performance.now(); const results = await pool(tasks, concurrency); const seconds = (performance.now() - started) / 1000;
  const latencies = results.map(item => item.ms).sort((a, b) => a - b); const failures = results.filter(item => item.status !== 200);
  recorder.check(`load: ${results.length} concurrent reads finished without an error (${failures.length} failed)`, failures.length / results.length <= LOAD_BUDGETS.errorRate, failures.slice(0, 3).map(item => item.status).join(","));
  recorder.check(`load: p95 latency ${Math.round(percentile(latencies, 95))}ms is within ${LOAD_BUDGETS.p95Ms}ms`, percentile(latencies, 95) <= LOAD_BUDGETS.p95Ms);
  return { requests: results.length, seconds: Number(seconds.toFixed(2)), p50Ms: Math.round(percentile(latencies, 50)), p95Ms: Math.round(percentile(latencies, 95)), p99Ms: Math.round(percentile(latencies, 99)) };
}

/** Concurrent writes must neither lose nor duplicate anything. */
export async function runWriteConsistency(fixture, recorder, { writes = 120, keys = 12 } = {}) {
  const { call } = fixture; const root = "/api/projects/project-alpha";
  const create = index => () => call("admin", "POST", `${root}/notifications`, { category: "health", severity: "warning", title: `Load alert ${index % keys}`, deduplicationKey: `load-${index % keys}`, correlationId: `corr-load-${index % keys}`, groupKey: "load" });
  const results = await pool(Array.from({ length: writes }, (_, index) => create(index)), 24);
  recorder.check(`writes: ${writes} concurrent notification writes were all accepted`, results.every(item => item.status === 201), results.filter(item => item.status !== 201).slice(0, 3).map(item => item.status).join(","));
  const rows = ((await call("viewer", "GET", `${root}/notifications?view=all`)).body?.notifications ?? []).filter(item => item.deduplicationKey.startsWith("load-"));
  recorder.check(`writes: ${keys} keys became exactly ${keys} notifications`, rows.length === keys, rows.length);
  recorder.check("writes: no occurrence was lost or double counted", rows.reduce((sum, item) => sum + item.occurrences, 0) === writes, rows.reduce((sum, item) => sum + item.occurrences, 0));
  // many callers approve the same command at once: exactly one decision wins
  await call("admin", "POST", `${root}/commands`, { commandId: "cmd-race-1", action: "deploy.test", risk: "medium", correlationId: "corr-race-1", idempotencyKey: "idem-race-1" });
  await call("admin", "POST", `${root}/commands/cmd-race-1/authorize`, { authorizationSnapshotId: "BATCH-BACKOFFICE-20261007-026" });
  const approvals = await pool(Array.from({ length: 10 }, () => () => call("admin", "POST", `${root}/commands/cmd-race-1/approve`, { reason: "race" })), 10);
  recorder.check("writes: ten simultaneous approvals produce exactly one decision", approvals.filter(item => item.status === 200).length === 1 && approvals.filter(item => item.status === 409).length === 9, approvals.map(item => item.status).join(","));
  // reservations racing for the cap never exceed it
  await call("admin", "POST", `${root}/budget`, { softThreshold: 400, hardCap: 500 });
  const reservations = await pool(Array.from({ length: 10 }, (_, index) => () => call("admin", "POST", `${root}/budget/reservations`, { reservationId: `res-race-${index}`, estimatedTokens: 100 })), 10);
  const accepted = reservations.filter(item => item.status === 201 || item.status === 200).length;
  recorder.check(`writes: ten simultaneous 100-token reservations never exceed the cap (${accepted} accepted)`, accepted <= 5, accepted);
}

/** A bounded soak: steady traffic for a few seconds, then heap growth and error count are measured. */
export async function runSoak(fixture, recorder, { seconds = 3, concurrency = 6 } = {}) {
  const { call, page } = fixture; const root = "/api/projects/project-alpha"; const before = process.memoryUsage().heapUsed; const deadline = Date.now() + seconds * 1000; let total = 0; let errors = 0;
  await Promise.all(Array.from({ length: concurrency }, async worker => { let index = 0; while (Date.now() < deadline) { const response = index % 3 === 0 ? await page("viewer", "inbox") : await call("viewer", "GET", `${root}/${index % 3 === 1 ? "notifications" : "slo"}`); total += 1; if (response.status !== 200) errors += 1; index += 1; } }));
  if (global.gc) global.gc(); const growthMb = (process.memoryUsage().heapUsed - before) / 1_048_576;
  recorder.check(`soak: ${total} requests over ${seconds}s finished with ${errors} errors`, errors === 0, errors);
  recorder.check(`soak: heap grew ${growthMb.toFixed(1)}MB, within ${LOAD_BUDGETS.soakHeapGrowthMb}MB`, growthMb <= LOAD_BUDGETS.soakHeapGrowthMb);
  return { requests: total, seconds, heapGrowthMb: Number(growthMb.toFixed(1)) };
}

/**
 * Failure injection: the database starts refusing writes. Reads must keep working,
 * writes must fail with 503 (never hang, never 200), nothing may be lost, and once
 * the database returns the queued change must be stored exactly once.
 */
export async function runFailureInjection({ createFixture }, recorder) {
  const rows = []; const store = { failing: false, async appendRecord(domain, record) { if (store.failing) { const error = new Error("simulated database outage"); error.code = "ECONNRESET"; throw error; } rows.push({ domain, kind: record.kind, key: record.key, version: record.version, json: JSON.stringify(record) }); return record; }, async listRecords() { return []; } };
  const failingCommandStore = { async appendRecord() { return {}; }, async listRecords() { return []; } };
  const fixture = await createFixture({ postgresRuntime: { async ping() { return true; }, domainRecords: store, commandCenter: failingCommandStore } });
  try {
    const { call } = fixture; const root = "/api/projects/project-alpha";
    const note = key => call("admin", "POST", `${root}/notifications`, { category: "health", severity: "warning", title: `Failure ${key}`, deduplicationKey: key, correlationId: `corr-${key}` });
    recorder.check("failure injection: a write succeeds while the database is healthy", (await note("fail-before")).status === 201);
    const stored = rows.length; store.failing = true;
    const outage = await Promise.race([note("fail-during"), new Promise(resolve => setTimeout(() => resolve({ status: "hang" }), 5000))]);
    recorder.check("failure injection: a write during the outage fails with 503 and does not hang", outage.status === 503, outage.status);
    recorder.check("failure injection: nothing was stored during the outage", rows.length === stored);
    const read = await call("viewer", "GET", `${root}/notifications`); recorder.check("failure injection: reads keep working during the outage", read.status === 200);
    recorder.check("failure injection: the queued change is visible in memory during the outage", (read.body?.notifications ?? []).some(item => item.deduplicationKey === "fail-during"));
    store.failing = false;
    recorder.check("failure injection: the next write succeeds once the database returns", (await note("fail-after")).status === 201);
    const keys = rows.map(row => `${row.domain}:${row.kind}:${row.key}:${row.version}`);
    recorder.check("failure injection: the change queued during the outage was stored after recovery", rows.some(row => row.json.includes("fail-during")));
    recorder.check("failure injection: no record was stored twice", new Set(keys).size === keys.length, keys.length - new Set(keys).size);
  } finally { await fixture.stop(); }
}
