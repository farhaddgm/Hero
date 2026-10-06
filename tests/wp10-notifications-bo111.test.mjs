import assert from "node:assert/strict";
import test from "node:test";

import { getNotificationObservabilityContractSummary, validateNotificationObservabilityContract } from "../packages/contracts/src/notification-observability.mjs";
import { createNotificationObservability, NotificationError } from "../packages/domain/src/notification-observability.mjs";
import { createPostgresDomainRecordStore } from "../packages/adapters/src/postgresql-domain-record-store.mjs";
import { createProjectSettingsRegistry } from "../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

let clock = Date.parse("2026-10-06T10:00:00.000Z");
const now = () => new Date(clock).toISOString();
const advance = minutes => { clock += minutes * 60_000; };
const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const viewer = { subject: "project-viewer", role: "viewer" };
const code = expected => error => error instanceof NotificationError && error.code === expected;
const P = "project-shop";
const create = (center, extra = {}) => center.createNotification({ actor: admin, projectId: P, category: "health", severity: "warning", title: "Health degraded", deduplicationKey: "health-degraded", correlationId: "corr-1", ...extra });

test("BO-111 taxonomy, ownership, SLA deadlines, lifecycle and routed decision actions", () => {
  assert.deepEqual(validateNotificationObservabilityContract(), []); assert.equal(getNotificationObservabilityContractSummary().version, "1.1");
  const center = createNotificationObservability({ now });
  assert.throws(() => create(center, { category: "gossip" }), code("NOTIFICATION_CATEGORY_INVALID"));
  assert.throws(() => create(center, { severity: "critical" }), code("NOTIFICATION_OWNER_REQUIRED"));
  assert.throws(() => create(center, { sourceRef: "https://x.example" }), code("NOTIFICATION_SOURCE_INVALID"));
  assert.throws(() => center.createNotification({ actor: viewer, projectId: P, category: "health", title: "nope!", deduplicationKey: "k-viewer", correlationId: "corr-v" }), code("PROJECT_WRITE_REQUIRED"));
  const critical = create(center, { severity: "critical", ownerId: "hero-owner", deduplicationKey: "outage", title: "Test host down", correlationId: "corr-2" });
  assert.equal(critical.due.acknowledgeBy, "2026-10-06T10:15:00.000Z"); assert.equal(critical.due.resolveBy, "2026-10-06T14:00:00.000Z");
  const info = create(center, { severity: "info", deduplicationKey: "fyi", title: "FYI note", correlationId: "corr-3" }); assert.equal(info.due.resolveBy, null, "info has no SLA");
  advance(20); const breached = center.inbox({ actor: viewer, projectId: P, view: "breached" });
  assert.deepEqual(breached.map(item => item.deduplicationKey), ["outage"], "only the critical one missed its 15-minute acknowledgement");
  assert.equal(center.inbox({ actor: viewer, projectId: P, view: "critical" })[0].notificationId, critical.notificationId);
  const acked = center.act({ actor: admin, projectId: P, notificationId: critical.notificationId, action: "acknowledge" });
  assert.equal(acked.state, "acknowledged"); assert.equal(center.inbox({ actor: viewer, projectId: P, view: "breached" }).length, 0, "acknowledged in time of nothing worse: the resolve deadline is still ahead"); advance(300);
  assert.equal(center.inbox({ actor: viewer, projectId: P, view: "breached" }).length, 1, "now the 4-hour resolve deadline has passed");
  assert.throws(() => center.act({ actor: admin, projectId: P, notificationId: critical.notificationId, action: "resolve" }), code("REASON_REQUIRED"));
  assert.throws(() => center.act({ actor: admin, projectId: P, notificationId: critical.notificationId, action: "reopen" }), code("NOTIFICATION_TRANSITION_INVALID"));
  assert.throws(() => center.act({ actor: admin, projectId: P, notificationId: critical.notificationId, action: "teleport" }), code("NOTIFICATION_ACTION_INVALID"));
  assert.throws(() => center.act({ actor: admin, projectId: P, notificationId: critical.notificationId, action: "snooze", minutes: 120 }), code("SNOOZE_TOO_LONG"));
  assert.equal(center.act({ actor: admin, projectId: P, notificationId: critical.notificationId, action: "assign", ownerId: "project-admin" }).ownerId, "project-admin");
  const decision = create(center, { deduplicationKey: "approve-deploy", title: "Approve test deploy", correlationId: "corr-4", action: { type: "approve", commandId: "cmd-1" } });
  assert.equal(center.act({ actor: admin, projectId: P, notificationId: decision.notificationId, action: "approve" }).lastAction.routed, true, "decision actions are routed, never executed by the inbox");
  assert.equal(center.inbox({ actor: viewer, projectId: P, view: "decision" }).length, 1);
  const resolved = center.act({ actor: admin, projectId: P, notificationId: critical.notificationId, action: "resolve", reason: "host back online" });
  assert.equal(resolved.state, "resolved"); assert.equal(resolved.due.resolveBy, null);
  assert.equal(center.act({ actor: admin, projectId: P, notificationId: critical.notificationId, action: "reopen" }).state, "open");
  assert.throws(() => center.act({ actor: admin, projectId: "project-other", notificationId: critical.notificationId, action: "acknowledge" }), code("NOTIFICATION_NOT_FOUND"), "no cross-project access");
  assert.equal(center.inbox({ actor: viewer, projectId: "project-other" }).length, 0);
});

test("BO-111 snooze hides a notification until it ends, then it returns in its earlier state", () => {
  const center = createNotificationObservability({ now }); const item = create(center, { deduplicationKey: "snooze-me", title: "Snooze me" });
  center.act({ actor: admin, projectId: P, notificationId: item.notificationId, action: "snooze", minutes: 30 });
  assert.equal(center.inbox({ actor: viewer, projectId: P, view: "open" }).length, 0); assert.equal(center.inbox({ actor: viewer, projectId: P, view: "all" })[0].effectiveState, "snoozed");
  const other = create(center, { deduplicationKey: "snooze-bad", title: "Snooze bad", correlationId: "corr-s" });
  assert.throws(() => center.act({ actor: admin, projectId: P, notificationId: other.notificationId, action: "snooze", minutes: 1 }), code("SNOOZE_INVALID"));
  assert.throws(() => center.act({ actor: admin, projectId: P, notificationId: item.notificationId, action: "snooze", minutes: 30 }), code("NOTIFICATION_TRANSITION_INVALID"), "an already-snoozed item cannot be snoozed again");
  advance(31); assert.deepEqual(center.inbox({ actor: viewer, projectId: P, view: "open" }).map(entry => entry.effectiveState), ["open", "open"]);
});

test("BO-112 deduplication folds repeats, keeps the highest severity, reopens after resolution and groups incidents without a storm of rows", () => {
  const center = createNotificationObservability({ now });
  const first = create(center);
  for (let n = 0; n < 24; n += 1) { advance(0.5); create(center, { severity: n === 10 ? "critical" : "warning", ownerId: n === 10 ? "hero-owner" : null }); }
  const inbox = center.inbox({ actor: viewer, projectId: P });
  assert.equal(inbox.length, 1, "25 identical events are one notification"); assert.equal(inbox[0].occurrences, 25); assert.equal(inbox[0].severity, "critical", "severity only escalates"); assert.equal(inbox[0].notificationId, first.notificationId); assert.equal(inbox[0].ownerId, "hero-owner");
  const incidents = center.incidents({ actor: viewer, projectId: P });
  assert.equal(incidents.length, 1); assert.equal(incidents[0].occurrences, 25); assert.equal(incidents[0].storm, true); assert.equal(incidents[0].severity, "critical");
  const other = create(center, { deduplicationKey: "latency-high", title: "Latency high", correlationId: "corr-1" });
  assert.equal(center.incidents({ actor: viewer, projectId: P })[0].notificationIds.length, 2, "different alerts with one correlation join one incident");
  const separate = create(center, { deduplicationKey: "disk-full", title: "Disk full", correlationId: "corr-9", category: "system" });
  assert.equal(center.incidents({ actor: viewer, projectId: P }).length, 2);
  center.act({ actor: admin, projectId: P, notificationId: first.notificationId, action: "resolve", reason: "fixed" }); center.act({ actor: admin, projectId: P, notificationId: other.notificationId, action: "resolve", reason: "fixed" });
  assert.deepEqual(center.incidents({ actor: viewer, projectId: P, state: "resolved" }).map(item => item.notificationIds.length), [2], "an incident resolves when all its notifications do");
  assert.equal(center.incidents({ actor: viewer, projectId: P, state: "open" })[0].notificationIds[0], separate.notificationId);
  const again = create(center); assert.equal(again.deduplicated, true); assert.equal(again.reopened, true); assert.equal(again.state, "open"); assert.equal(again.reopenCount, 1);
  assert.equal(center.inbox({ actor: viewer, projectId: P }).length, 3, "reopening does not add a row");
  advance(60); create(center, { deduplicationKey: "disk-full", category: "system", title: "Disk full", correlationId: "corr-9" });
  assert.equal(center.incidents({ actor: viewer, projectId: P, state: "open" }).length, 3, "a recurrence after the 30-minute window starts a new incident; the old one closes with its notification");
});

test("WP-10 records persist append-only and replay in any order; secrets in actions are redacted", async () => {
  const center = createNotificationObservability({ now });
  const item = create(center, { action: { type: "approve", apiKey: "sk-should-never-persist" } }); assert.equal(item.action.apiKey, "[redacted]");
  create(center); center.act({ actor: admin, projectId: P, notificationId: item.notificationId, action: "acknowledge" });
  center.recordAudit({ actor: admin, projectId: P, kind: "budget", outcome: "paused", correlationId: "corr-1", data: { password: "x", ok: 1 } }); center.setSli({ actor: admin, projectId: P, projection: "portfolio", lagSeconds: 5, freshnessSeconds: 60 });
  const rows = []; const client = { async query(sql, values) { if (sql.startsWith("INSERT")) { rows.push({ record_kind: values[1], record_key: values[2], record_version: values[3], project_id: values[4], metadata: JSON.parse(values[5]), actor_id: values[6] }); return { rows: [] }; } return { rows }; } };
  const store = createPostgresDomainRecordStore({ client });
  for (const record of center.drainRecords()) await store.appendRecord("notifications", record);
  const restored = createNotificationObservability({ now }); for (const record of [...await store.listRecords("notifications")].reverse()) restored.hydrate(record);
  assert.deepEqual(restored.inbox({ actor: viewer, projectId: P }), center.inbox({ actor: viewer, projectId: P }));
  assert.deepEqual(restored.incidents({ actor: viewer, projectId: P }), center.incidents({ actor: viewer, projectId: P }));
  assert.equal(restored.observability({ actor: viewer, projectId: P }).auditCount, 1);
  assert.equal(create(restored).deduplicated, true, "deduplication survives a restart");
  assert.ok(!JSON.stringify(rows).includes("sk-should-never-persist"));
});

test("BO-099..112 HTTP: usage past the cap pauses the project, raises an owner-routed notification and survives role checks", async t => {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "wp09-http-session-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-wp09" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(clock / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now }); const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  for (const projectId of [P, "project-other"]) projectWorkspace.createProject({ actor: owner, projectId, name: projectId });
  for (const [userId, email, secret] of [["admin-user", "admin@example.test", "admin-mfa-secret-wp09"], ["viewer-user", "viewer@example.test", "viewer-mfa-secret-wp09"]]) identity.createUser({ actor: owner, user: { userId, email, displayName: userId, password: "User password 123", mfaSecret: secret, mfaRequired: true } });
  access.upsertGrant({ actor: owner, grant: { projectId: P, userId: "admin-user", role: "admin" } }); access.upsertGrant({ actor: owner, grant: { projectId: P, userId: "viewer-user", role: "viewer" } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop()); const base = `http://127.0.0.1:${address.port}`;
  const tokens = { owner: login("owner@example.test", "Owner password 123", "owner-mfa-secret-wp09"), admin: login("admin@example.test", "User password 123", "admin-mfa-secret-wp09"), viewer: login("viewer@example.test", "User password 123", "viewer-mfa-secret-wp09") };
  const call = async (who, method, route, body) => { const response = await fetch(`${base}${route}`, { method, headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/json", ...(method === "GET" ? {} : { origin: base }) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
  const root = `/api/projects/${P}`;
  assert.equal((await call("admin", "POST", `${root}/budget`, { softThreshold: 100, hardCap: 200 })).status, 200);
  assert.equal((await call("viewer", "POST", `${root}/usage`, { usageId: "usage-v", invocationId: "invoke-v", provider: "openai", model: "sol" })).status, 403);
  assert.equal((await call("admin", "POST", `${root}/usage`, { usageId: "usage-1", invocationId: "invoke-1", provider: "openai", model: "sol", inputTokens: 150, teamId: "developero" })).body.usage.budgetDecision, "soft-threshold-warning");
  assert.equal((await call("admin", "POST", `${root}/usage`, { usageId: "usage-2", invocationId: "invoke-2", provider: "openai", model: "sol", inputTokens: 100 })).body.usage.budgetDecision, "hard-cap-pause-required");
  const notifications = (await call("viewer", "GET", `${root}/notifications?view=critical`)).body.notifications;
  assert.equal(notifications.length, 1); assert.equal(notifications[0].ownerId, "hero-owner"); assert.equal(notifications[0].category, "budget");
  assert.equal((await call("admin", "POST", `${root}/budget/reservations`, { reservationId: "res-1", estimatedTokens: 10 })).status, 409);
  assert.equal((await call("admin", "POST", `${root}/budget/resume`, { reason: "try" })).status, 403);
  assert.equal((await call("admin", "POST", `${root}/budget`, { softThreshold: 100, hardCap: 900 })).status, 403, "raising the cap is owner-only");
  assert.equal((await call("owner", "POST", `${root}/budget`, { softThreshold: 100, hardCap: 900, reason: "owner raised" })).status, 200);
  assert.equal((await call("owner", "POST", `${root}/budget/resume`, { reason: "cap raised" })).body.pause.paused, false);
  assert.equal((await call("viewer", "GET", `${root}/ledger/reconcile`)).body.reconciliation.complete, true);
  assert.equal((await call("viewer", "GET", `${root}/drill-down?kind=cost&groupBy=team&scope=developero`)).body.drillDown.totalTokens, 150);
  assert.equal((await call("viewer", "GET", `${root}/health`)).body.health.status, "unknown");
  assert.equal((await call("admin", "GET", "/api/projects/project-other/ledger")).status, 403, "no grant on another project");
  assert.equal((await call("admin", "POST", `${root}/health/overrides`, { overrideId: "override-1", kind: "outage", reason: "Test host unreachable" })).status, 201);
  assert.equal((await call("viewer", "GET", `${root}/health`)).body.health.status, "critical");
  const notificationId = notifications[0].notificationId;
  assert.equal((await call("admin", "POST", `${root}/notifications/${notificationId}/act`, { action: "acknowledge" })).body.notification.state, "acknowledged");
  assert.equal((await call("viewer", "POST", `${root}/notifications/${notificationId}/act`, { action: "resolve", reason: "nope" })).status, 403);
  assert.equal((await call("viewer", "GET", `${root}/incidents`)).body.incidents.length, 1);
  // catalog integration through HTTP
  const catalog = `${root}/catalog`;
  await call("admin", "POST", catalog, { entityId: "shop-api", type: "service", name: "Shop API", lifecycle: "active", metadata: { owner: "hero-owner" } });
  assert.equal((await call("admin", "POST", `${catalog}/entities/shop-api/references`, { references: { team: "developero", health: "healthy" } })).status, 200);
  assert.equal((await call("admin", "POST", `${catalog}/entities/shop-api/references`, { references: { team: "shadow-team" } })).status, 400);
  assert.equal((await call("admin", "POST", `${catalog}/knowledge`, { knowledgeId: "pricing-note", kind: "note", title: "Discount floor thirty percent", sourceRef: "hero://docs/pricing", sensitivity: "restricted" })).status, 201);
  assert.equal((await call("viewer", "GET", `${catalog}/search?q=discount`)).body.results.length, 0);
  assert.equal((await call("admin", "GET", `${catalog}/search?q=discount`)).body.results.length, 1);
  assert.equal((await call("viewer", "GET", `${catalog}/documents/graph`)).body.graph.nodes[0].title, "[restricted document]");
  assert.deepEqual((await call("viewer", "POST", `${catalog}/impact`, { entityIds: ["shop-api"] })).status, 403, "impact analysis needs a write grant like other catalog writes");
});
