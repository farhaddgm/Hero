import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresOperationalStore } from "../packages/adapters/src/postgresql-operational-store.mjs";
import { createPostgresOutboxWorker } from "../packages/adapters/src/postgresql-outbox-worker.mjs";
import { createPostgresOwnerSessionStore } from "../packages/adapters/src/owner-session-store.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";
import { createCorrelationContext, childCorrelationContext } from "../packages/domain/src/observability.mjs";
import { runAiBenchmark } from "../packages/domain/src/ai-benchmark.mjs";
import { createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOperationalEvent, projectOperationalEvent, validateOperationalEvent } from "../packages/contracts/src/index.mjs";
import { validateObservabilityContract } from "../packages/contracts/src/observability.mjs";
import { validatePilotContract } from "../packages/contracts/src/pilot.mjs";

const OWNER_SECRET = "test-only-next-steps-owner-secret-1234567890";
const now = () => "2026-08-31T12:00:00.000Z";

test("observability contract creates correlated child contexts and redacts event content", () => {
  assert.deepEqual(validateObservabilityContract(), []);
  const parent = createCorrelationContext({ traceId: "0123456789abcdef0123456789abcdef", spanId: "0123456789abcdef" });
  const child = childCorrelationContext(parent);
  assert.equal(child.traceId, parent.traceId);
  assert.equal(child.parentSpanId, parent.spanId);
  const event = createOperationalEvent({
    eventId: "evt_observe_001",
    aggregateType: "ai-invocation",
    aggregateId: "inv-observe-001",
    type: "ai.invocation-completed",
    occurredAt: now(),
    actor: { kind: "orchestrator", id: "hero-orchestrator" },
    data: { projectId: "hero", role: "analyst", prompt: "نباید نمایش داده شود", responseText: "نباید نمایش داده شود", latencyMs: 12 }
  });
  assert.deepEqual(validateOperationalEvent(event), []);
  const projection = projectOperationalEvent({ ...event, sequence: 4 });
  assert.equal(projection.data.role, "analyst");
  assert.equal(projection.data.latencyMs, 12);
  assert.equal("prompt" in projection.data, false);
  assert.equal(JSON.stringify(projection).includes("نباید نمایش داده شود"), false);
});

test("owner authentication revocation fails closed and is monotonic", () => {
  const auth = createOwnerAuth({ secret: OWNER_SECRET, now });
  const token = auth.issueSession({ subject: "hero-owner", sessionId: "session-next-001", expiresAt: 2_000_000_000 });
  assert.equal(auth.authenticate(`Bearer ${token}`).decision, "OWNER_AUTHENTICATED");
  auth.revokeSession({ sessionId: "session-next-001", subject: "hero-owner", reason: "security-check" });
  assert.throws(() => auth.authenticate(`Bearer ${token}`), error => error.code === "OWNER_AUTH_REVOKED");
  assert.equal(auth.revocationSnapshot().length, 1);
  assert.throws(() => auth.restoreRevocations([{ sessionId: "x" }]), error => error.code === "OWNER_AUTH_INVALID");
});

test("PostgreSQL owner session store keeps revocations append-only and restorable", async () => {
  const record = { session_id: "session-next-002", subject: "hero-owner", revoked_at: now(), reason: "owner-request" };
  const queries = [];
  const client = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.startsWith("INSERT INTO owner_session_revocations")) return { rows: [record] };
      if (text.startsWith("SELECT session_id")) return { rows: [record] };
      return { rows: [] };
    }
  };
  const store = createPostgresOwnerSessionStore({ client });
  assert.deepEqual(await store.revoke({ sessionId: record.session_id, subject: record.subject, reason: record.reason, revokedAt: record.revoked_at }), {
    sessionId: record.session_id, subject: record.subject, revokedAt: record.revoked_at, reason: record.reason
  });
  assert.deepEqual(await store.list(), [{ sessionId: record.session_id, subject: record.subject, revokedAt: record.revoked_at, reason: record.reason }]);
  assert.match(queries[0].text, /ON CONFLICT \(session_id\) DO NOTHING/);
});

test("PostgreSQL outbox supports bounded claim, acknowledge and retry/dead-letter", async () => {
  const row = { outbox_id: "outbox-next-001", event_id: "evt_outbox_next_001", topic: "hero.domain.events", payload: { safe: true }, status: "processing", attempt_count: "1", locked_at: now(), last_error: null, created_at: now(), published_at: null };
  const queries = [];
  const client = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.startsWith("WITH candidates")) return { rows: [row] };
      if (text.startsWith("UPDATE outbox")) return { rows: [{ ...row, status: text.includes("SET status = 'published'") ? "published" : "pending", attempt_count: "2" }] };
      return { rows: [] };
    }
  };
  const store = createPostgresOperationalStore({ client });
  const claimed = await store.claimOutbox({ limit: 2, leaseSeconds: 60 });
  assert.equal(claimed[0].status, "processing");
  assert.match(queries.find(query => query.text.startsWith("WITH candidates")).text, /SKIP LOCKED/);
  assert.equal((await store.acknowledgeOutbox(row.outbox_id)).status, "published");
  assert.equal((await store.failOutbox(row.outbox_id, "temporary", { maxAttempts: 3 })).status, "pending");
  assert.equal(queries.filter(query => query.text.startsWith("UPDATE outbox")).length, 2);
});

test("pilot dry-run produces a bounded evidence bundle without live Provider access", () => {
  assert.deepEqual(validatePilotContract(), []);
  const dashboard = createControlDashboard({ now });
  const result = dashboard.runPilotDryRun({ pilotId: "PILOT-NEXT-001", title: "پایلوت مشاهده‌ای", description: "اجرای deterministic برای بررسی مسیر", scenario: "success" });
  assert.equal(result.mode, "deterministic-no-network");
  assert.equal(result.acceptance.passed, true);
  assert.equal(result.request.status, "تکمیل");
  assert.equal(result.evidence.providerCalled, false);
  assert.equal(result.evidence.externalSpend, false);
  assert.equal(JSON.stringify(result).includes("اجرای deterministic"), false);
});

test("outbox worker acknowledges successful handlers and bounds failed deliveries", async () => {
  const rows = [
    { outboxId: "outbox-worker-ok", topic: "hero.domain.events", payload: { safe: true } },
    { outboxId: "outbox-worker-fail", topic: "hero.unknown.events", payload: { safe: true } }
  ];
  const acknowledged = [];
  const failed = [];
  const worker = createPostgresOutboxWorker({
    maxAttempts: 2,
    store: {
      async claimOutbox() { return rows; },
      async acknowledgeOutbox(id) { acknowledged.push(id); return { outboxId: id, status: "published" }; },
      async failOutbox(id, error, options) { failed.push({ id, error, options }); return { outboxId: id, status: id.endsWith("fail") ? "failed" : "pending" }; }
    },
    handlers: { "hero.domain.events": async item => ({ eventId: item.payload.safe ? "evt-safe" : null }) }
  });
  const result = await worker.drain({ limit: 2, leaseSeconds: 60 });
  assert.deepEqual(acknowledged, ["outbox-worker-ok"]);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].options.maxAttempts, 2);
  assert.deepEqual(result, {
    claimed: 2,
    published: 1,
    retried: 0,
    failed: 1,
    deliveries: [
      { outboxId: "outbox-worker-ok", topic: "hero.domain.events", status: "published", result: { eventId: "evt-safe" } },
      { outboxId: "outbox-worker-fail", topic: "hero.unknown.events", status: "failed", error: "No handler is configured for topic hero.unknown.events." }
    ]
  });
});

test("back office exposes same-host access metadata, paginated safe events and pilot contract", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const backoffice = await (await fetch(`${baseUrl}/backoffice-data`)).json();
  assert.equal(backoffice.backoffice.access.mode, "same-host-only");
  const events = await (await fetch(`${baseUrl}/backoffice-events?after=0&limit=2`)).json();
  assert.deepEqual(events.events, []);
  assert.equal(events.hasMore, false);
  const pilot = await (await fetch(`${baseUrl}/pilot-contract`)).json();
  assert.equal(pilot.pilotContract.version, "1.0");
  assert.ok(pilot.pilotContract.acceptanceChecks.includes("runner-cleaned"));
});

test("authenticated synthetic benchmark is advisory and appears in the back office", async t => {
  const ownerAuth = createOwnerAuth({ secret: OWNER_SECRET, now });
  const token = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "benchmark-http-session", expiresAt: 2_000_000_000 });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const response = await fetch(`${baseUrl}/api/ai/benchmarks/synthetic`, { method: "POST", headers, body: JSON.stringify({ benchmarkId: "BENCH-HTTP-001", latencyMs: 4 }) });
  assert.equal(response.status, 201);
  const result = (await response.json()).result;
  assert.equal(result.metrics.completionRate, 1);
  assert.equal(result.authority.canAuthorizeProvider, false);
  const projection = (await (await fetch(`${baseUrl}/backoffice-data`)).json()).backoffice;
  assert.equal(projection.benchmark.latest.benchmarkId, "BENCH-HTTP-001");
  assert.equal(projection.benchmark.latest.metrics.averageLatencyMs, 4);
});

test("Back Office Basic Auth protects the public surface and indexing is disabled", async t => {
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    now,
    backofficeAuth: { username: "hero-owner", password: "test-backoffice-password-123" }
  });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const denied = await fetch(`${baseUrl}/backoffice`);
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get("www-authenticate"), /Basic/);
  const credentials = Buffer.from("hero-owner:test-backoffice-password-123").toString("base64");
  const allowed = await fetch(`${baseUrl}/backoffice-data`, { headers: { authorization: `Basic ${credentials}` } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate");
  const page = await fetch(`${baseUrl}/backoffice`, { headers: { authorization: `Basic ${credentials}` } });
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate");
  assert.match(await page.text(), /<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate">/);
  const dashboard = await fetch(`${baseUrl}/`);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate");
  assert.match(await dashboard.text(), /<meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate">/);
  const robots = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.equal(robots.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate");
  assert.match(await robots.text(), /Disallow: \/\n/);
  const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemap.status, 404);
  assert.equal(sitemap.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate");
});

test("benchmark result has repeatable timing and evidence digest", async () => {
  const input = { benchmarkId: "BENCH-NEXT-001", providerId: "deterministic", modelId: "default", profileId: "analyst-next", nowMs: () => 100, runner: async ({ benchmarkCase }) => ({ status: "completed", schema: benchmarkCase.outputSchema, safetyPass: true, costUnits: 2, latencyMs: 7 }) };
  const first = await runAiBenchmark(input);
  const second = await runAiBenchmark(input);
  assert.equal(first.metrics.averageLatencyMs, 7);
  assert.equal(first.digest, second.digest);
  assert.equal(first.digest.length, 64);
  assert.equal(first.authority.canAuthorizeProvider, false);
});

test("server revocation blocks the same session on the next API request", async t => {
  const ownerAuth = createOwnerAuth({ secret: OWNER_SECRET, now });
  const token = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "session-next-http", expiresAt: 2_000_000_000 });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  assert.equal((await fetch(`${baseUrl}/api/dashboard`, { headers })).status, 200);
  const revoked = await fetch(`${baseUrl}/api/auth/revoke-session`, { method: "POST", headers, body: JSON.stringify({ reason: "test-revocation" }) });
  assert.equal(revoked.status, 200);
  const blocked = await fetch(`${baseUrl}/api/dashboard`, { headers });
  assert.equal(blocked.status, 401);
  assert.equal((await (await fetch(`${baseUrl}/observability-contract`)).json()).observabilityContract.version, "1.0");
});
