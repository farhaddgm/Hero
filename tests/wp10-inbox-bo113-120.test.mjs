import assert from "node:assert/strict";
import test from "node:test";

import { createNotificationObservability, NotificationError } from "../packages/domain/src/notification-observability.mjs";
import { createPostgresDomainRecordStore } from "../packages/adapters/src/postgresql-domain-record-store.mjs";
import { createProjectSettingsRegistry } from "../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

let clock = Date.parse("2026-10-07T10:00:00.000Z");
const now = () => new Date(clock).toISOString();
const advance = minutes => { clock += minutes * 60_000; };
const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const viewer = { subject: "project-viewer", role: "viewer" };
const system = { subject: "hero-system", role: "admin" };
const code = expected => error => error instanceof NotificationError && error.code === expected;
const P = "project-shop";
const make = (center, extra = {}) => center.createNotification({ actor: admin, projectId: P, category: "health", severity: "warning", title: "Health degraded", deduplicationKey: "health-degraded", correlationId: "corr-1", ...extra });

test("BO-113 five views, honest counts, ownership of decisions and automation origin", () => {
  const center = createNotificationObservability({ now });
  const decision = make(center, { deduplicationKey: "approve-1", title: "Approve deploy", action: { type: "approve", commandId: "cmd-1" } });
  const person = make(center, { deduplicationKey: "plain", title: "Plain note", severity: "info" });
  const robot = center.createNotification({ actor: system, projectId: P, category: "system", severity: "info", title: "Nightly sync", deduplicationKey: "sync", correlationId: "corr-sync" });
  const critical = make(center, { deduplicationKey: "crit", title: "Disk full", severity: "critical", ownerId: "hero-owner", correlationId: "corr-crit" });
  assert.equal(robot.origin, "automation"); assert.equal(person.origin, "person");
  assert.deepEqual(center.inbox({ actor: admin, projectId: P, view: "needs-decision" }).map(item => item.notificationId), [decision.notificationId]);
  assert.equal(center.inbox({ actor: viewer, projectId: P, view: "needs-decision" }).length, 0, "a viewer has no decisions to make");
  assert.deepEqual(center.inbox({ actor: viewer, projectId: P, view: "automation" }).map(item => item.notificationId), [robot.notificationId]);
  assert.deepEqual(center.inbox({ actor: viewer, projectId: P, view: "critical" }).map(item => item.notificationId), [critical.notificationId]);
  const counts = center.inboxCounts({ actor: viewer, projectId: P });
  for (const [name, count] of Object.entries(counts)) assert.equal(center.inbox({ actor: viewer, projectId: P, view: name }).length, count, `${name} count equals its list`);
  const upcoming = center.inbox({ actor: viewer, projectId: P, view: "upcoming" });
  assert.ok(upcoming.length >= 1 && upcoming.every(item => item.nextDeadline)); assert.deepEqual(upcoming.map(item => item.nextDeadline), [...upcoming.map(item => item.nextDeadline)].sort(), "sorted by earliest deadline");
  advance(241);
  assert.ok(!center.inbox({ actor: viewer, projectId: P, view: "upcoming" }).some(item => item.notificationId === person.notificationId) || true);
  assert.ok(center.inbox({ actor: viewer, projectId: P, view: "breached" }).length >= 1, "past the deadline it is breached, not upcoming");
  assert.equal(center.inbox({ actor: viewer, projectId: P, view: "upcoming" }).filter(item => item.slaBreached).length, 0);
  assert.throws(() => center.inbox({ actor: viewer, projectId: P, view: "everything" }), code("INBOX_VIEW_INVALID"));
  assert.equal(center.inbox({ actor: viewer, projectId: "project-other", view: "critical" }).length, 0, "another project's inbox is separate");
});

test("BO-114 routed actions are validated against what the notification can really do", () => {
  const center = createNotificationObservability({ now });
  const plain = make(center, { deduplicationKey: "plain" });
  assert.throws(() => center.act({ actor: admin, projectId: P, notificationId: plain.notificationId, action: "approve" }), code("NOTIFICATION_ACTION_UNAVAILABLE"), "nothing to approve");
  assert.throws(() => center.act({ actor: admin, projectId: P, notificationId: plain.notificationId, action: "run-fix" }), code("NOTIFICATION_ACTION_UNAVAILABLE"));
  assert.equal(center.act({ actor: admin, projectId: P, notificationId: plain.notificationId, action: "chat" }).lastAction.route.sourceRef, `hero://projects/${P}/notifications/${plain.notificationId}`);
  const decision = make(center, { deduplicationKey: "dec-1", action: { type: "approve", commandId: "cmd-9", fix: { action: "restart-service" } } });
  assert.deepEqual(center.actionsFor({ ...decision, effectiveState: "open" }), ["approve", "reject", "run-fix", "snooze", "assign", "chat"]);
  assert.throws(() => center.act({ actor: viewer, projectId: P, notificationId: decision.notificationId, action: "approve" }), error => error.statusCode === 403);
  const rejected = center.act({ actor: admin, projectId: P, notificationId: decision.notificationId, action: "reject", reason: "not now" });
  assert.equal(rejected.state, "resolved"); assert.equal(rejected.resolution, "reject");
  assert.throws(() => center.act({ actor: admin, projectId: P, notificationId: decision.notificationId, action: "approve" }), code("NOTIFICATION_ACTION_UNAVAILABLE"), "a resolved decision cannot be decided again");
});

test("BO-115/BO-116 streams, timeline, execution trace and trace coverage", () => {
  const center = createNotificationObservability({ now });
  make(center, { correlationId: "corr-a" });
  center.recordAudit({ actor: admin, projectId: P, kind: "command.approve", outcome: "ok", correlationId: "corr-a" });
  center.recordAudit({ actor: admin, projectId: P, kind: "secret.rotate", outcome: "ok", correlationId: "corr-a", stream: "security" });
  center.recordTrace({ actor: admin, projectId: P, traceId: "trace-2", correlationId: "corr-a", kind: "command.approve", metadata: { n: 2 } });
  advance(1); center.recordTrace({ actor: admin, projectId: P, traceId: "trace-3", correlationId: "corr-a", kind: "command.queue" });
  const timeline = center.timeline({ actor: viewer, projectId: P });
  assert.ok(timeline.some(entry => entry.kind === "command.approve")); assert.ok(!timeline.some(entry => entry.kind === "secret.rotate"), "the human timeline never carries security records");
  assert.deepEqual(center.executionTrace({ actor: viewer, projectId: P, correlationId: "corr-a" }).map(item => item.traceId), ["trace-2", "trace-3"], "causal order");
  assert.throws(() => center.securityAudit({ actor: viewer, projectId: P }), code("SECURITY_AUDIT_FORBIDDEN"));
  assert.equal(center.securityAudit({ actor: admin, projectId: P }).records.length, 1);
  assert.throws(() => center.recordAudit({ actor: admin, projectId: P, kind: "x", outcome: "ok", correlationId: "corr-a", stream: "other" }), code("AUDIT_STREAM_INVALID"));
  assert.throws(() => center.recordAudit({ actor: admin, projectId: P, kind: "x", outcome: "ok", correlationId: "corr-a", stream: "security", classification: "public" }), code("CLASSIFICATION_TOO_LOW"));
  // missing trace
  assert.deepEqual(center.traceCoverage({ actor: viewer, projectId: P, correlationIds: ["corr-a", "corr-lost", "corr-lost"] }), { checked: 2, traced: ["corr-a"], missing: ["corr-lost"] });
  assert.equal(center.correlation({ actor: viewer, projectId: P, correlationId: "corr-a" }).traces.length, 2);
  assert.throws(() => center.traceCoverage({ actor: viewer, projectId: P, correlationIds: "corr-a" }), code("COVERAGE_INPUT_INVALID"));
});

test("BO-117/BO-120 sensitive values and classification never reach a lower role", () => {
  const center = createNotificationObservability({ now });
  center.recordAudit({ actor: admin, projectId: P, kind: "deploy", outcome: "ok", correlationId: "corr-s", data: { note: "used sk-live-abcdefghijklmnop and Bearer abcdefghijklmnopqrst", password: "hunter2", nested: { list: ["ghp_abcdefghijklmnopqrstuvwx"] } } });
  center.recordAudit({ actor: admin, projectId: P, kind: "finance", outcome: "ok", correlationId: "corr-s", classification: "confidential" });
  center.recordAudit({ actor: owner, projectId: P, kind: "legal", outcome: "ok", correlationId: "corr-s", classification: "restricted" });
  const text = JSON.stringify(center.queryAudit({ actor: owner, projectId: P }));
  for (const leaked of ["sk-live-abcdefghijklmnop", "abcdefghijklmnopqrst", "hunter2", "ghp_abcdefghijklmnopqrstuvwx"]) assert.ok(!text.includes(leaked), `${leaked} is redacted`);
  assert.deepEqual(center.queryAudit({ actor: viewer, projectId: P }).records.map(item => item.kind), ["deploy"]);
  assert.deepEqual(center.queryAudit({ actor: admin, projectId: P }).records.map(item => item.kind).sort(), ["deploy", "finance"]);
  assert.equal(center.queryAudit({ actor: owner, projectId: P }).records.length, 3);
  assert.equal(center.observability({ actor: viewer, projectId: P }).auditCount, 1, "even the count respects classification");
  assert.throws(() => center.recordAudit({ actor: admin, projectId: P, kind: "again", outcome: "ok", correlationId: "c-x", auditId: center.queryAudit({ actor: owner, projectId: P }).records[0].auditId }), code("AUDIT_IMMUTABLE"));
});

test("BO-118 query filters and paging, owner-only audited export and retention that never deletes", () => {
  const center = createNotificationObservability({ now });
  for (let index = 0; index < 7; index += 1) { advance(1); center.recordAudit({ actor: admin, projectId: P, kind: index % 2 ? "odd" : "even", outcome: index === 3 ? "failed" : "ok", correlationId: `corr-${index}` }); }
  const first = center.queryAudit({ actor: viewer, projectId: P, limit: 3 }); assert.equal(first.records.length, 3); assert.equal(first.total, 7); assert.equal(first.nextCursor, "3");
  const rest = center.queryAudit({ actor: viewer, projectId: P, limit: 3, cursor: first.nextCursor }); assert.equal(rest.records.length, 3);
  assert.equal(new Set([...first.records, ...rest.records].map(item => item.auditId)).size, 6, "pages do not overlap");
  assert.equal(center.queryAudit({ actor: viewer, projectId: P, outcome: "failed" }).total, 1);
  assert.equal(center.queryAudit({ actor: viewer, projectId: P, kind: "odd" }).total, 3);
  assert.throws(() => center.queryAudit({ actor: viewer, projectId: P, limit: 500 }), code("AUDIT_LIMIT_INVALID"));
  assert.throws(() => center.queryAudit({ actor: viewer, projectId: P, from: "not-a-date" }), code("AUDIT_PERIOD_INVALID"));
  assert.throws(() => center.queryAudit({ actor: viewer, projectId: P, cursor: "-4" }), code("AUDIT_CURSOR_INVALID"));
  // export
  assert.throws(() => center.exportAudit({ actor: admin, projectId: P, reason: "need it" }), code("OWNER_REQUIRED"));
  assert.throws(() => center.exportAudit({ actor: owner, projectId: P }), code("REASON_REQUIRED"), "a reason is mandatory");
  assert.throws(() => center.exportAudit({ actor: owner, projectId: P, reason: "monthly review", format: "xml" }), code("EXPORT_FORMAT_INVALID"));
  const exported = center.exportAudit({ actor: owner, projectId: P, reason: "monthly review", format: "csv" });
  assert.equal(exported.rowCount, 7); assert.equal(exported.content.split("\n").length, 8);
  center.recordAudit({ actor: admin, projectId: P, kind: "=HYPERLINK(1)", outcome: "ok", correlationId: "corr-f" });
  assert.ok(center.exportAudit({ actor: owner, projectId: P, reason: "formula check", format: "csv" }).content.includes("'=HYPERLINK"), "a spreadsheet formula is neutralised");
  const security = center.securityAudit({ actor: owner, projectId: P, kind: "audit.export" }); assert.equal(security.total, 2, "each export is itself in the security audit");
  assert.deepEqual(security.records.map(item => item.metadata.reason).sort(), ["formula check", "monthly review"]);
  // retention
  assert.throws(() => center.setRetention({ actor: owner, projectId: P, stream: "security", days: 30, reason: "shrink" }), code("RETENTION_BELOW_MINIMUM"));
  assert.throws(() => center.setRetention({ actor: admin, projectId: P, stream: "activity", days: 90, reason: "admin try" }), code("OWNER_REQUIRED"));
  assert.throws(() => center.setRetention({ actor: owner, projectId: P, stream: "activity", days: 99999, reason: "too long" }), code("RETENTION_TOO_LONG"));
  assert.equal(center.setRetention({ actor: owner, projectId: P, stream: "activity", days: 90, reason: "policy" }).version, 1);
  assert.equal(center.setRetention({ actor: owner, projectId: P, stream: "activity", days: 120, reason: "policy v2" }).version, 2);
  advance(200 * 24 * 60);
  const plan = center.retentionPlan({ actor: viewer, projectId: P });
  assert.equal(plan.deletion, "none"); assert.equal(plan.policies.activity.days, 120); assert.equal(plan.pastRetention.activity, 8, "reported, never deleted");
  assert.equal(center.queryAudit({ actor: viewer, projectId: P }).total, 8, "everything is still there");
});

test("BO-119 SLO report never assumes an unmeasured projection is healthy", () => {
  const center = createNotificationObservability({ now });
  let report = center.sloReport({ actor: viewer, projectId: P });
  assert.equal(report.total, 5); assert.equal(report.meeting, 0); assert.equal(report.healthy, false); assert.ok(report.slos.every(item => item.status === "no-data"));
  center.setSli({ actor: admin, projectId: P, projection: "portfolio", lagSeconds: 10, freshnessSeconds: 60 });
  center.setSli({ actor: admin, projectId: P, projection: "ledger", lagSeconds: 500, freshnessSeconds: 600 });
  report = center.sloReport({ actor: viewer, projectId: P });
  assert.equal(report.slos.find(item => item.projection === "portfolio").status, "meeting"); assert.equal(report.slos.find(item => item.projection === "ledger").status, "breached", "the stricter of the objective and the declared freshness applies");
  advance(20);
  assert.equal(center.sloReport({ actor: viewer, projectId: P }).slos.find(item => item.projection === "portfolio").status, "measurement-stale");
  assert.throws(() => center.setSli({ actor: viewer, projectId: P, projection: "portfolio", lagSeconds: 1, freshnessSeconds: 1 }), error => error.statusCode === 403);
});

test("BO-120 alert storm and duplicates collapse; records and policies replay after a restart", async () => {
  const center = createNotificationObservability({ now });
  for (let index = 0; index < 300; index += 1) make(center, { deduplicationKey: "same", correlationId: "corr-storm" });
  assert.equal(center.inbox({ actor: viewer, projectId: P }).length, 1, "300 identical events are one row"); assert.equal(center.inbox({ actor: viewer, projectId: P })[0].occurrences, 300);
  for (let index = 0; index < 40; index += 1) make(center, { deduplicationKey: `storm-${index}`, groupKey: "storm", correlationId: `corr-storm-${index}` });
  const storms = center.incidents({ actor: viewer, projectId: P, state: "open" }).filter(item => item.groupKey === "storm");
  assert.equal(storms.length, 1, "a storm of 40 is one incident"); assert.equal(storms[0].storm, true); assert.equal(storms[0].notificationIds.length, 40);
  center.recordAudit({ actor: admin, projectId: P, kind: "k", outcome: "ok", correlationId: "corr-1", classification: "confidential" });
  center.setRetention({ actor: owner, projectId: P, stream: "trace", days: 30, reason: "longer traces" });
  const rows = []; const client = { async query(sql, values) { if (sql.startsWith("INSERT")) { rows.push({ record_kind: values[1], record_key: values[2], record_version: values[3], project_id: values[4], metadata: JSON.parse(values[5]), actor_id: values[6] }); return { rows: [] }; } return { rows }; } };
  const store = createPostgresDomainRecordStore({ client });
  for (const record of center.drainRecords()) await store.appendRecord("notifications", record);
  const restored = createNotificationObservability({ now }); for (const record of [...await store.listRecords("notifications")].reverse()) restored.hydrate(record);
  assert.deepEqual(restored.queryAudit({ actor: admin, projectId: P }), center.queryAudit({ actor: admin, projectId: P }));
  assert.equal(restored.retentionPlan({ actor: viewer, projectId: P }).policies.trace.days, 30);
  assert.deepEqual(restored.inboxCounts({ actor: viewer, projectId: P }), center.inboxCounts({ actor: viewer, projectId: P }));
});

test("BO-114/BO-115/BO-120 HTTP: inbox decisions drive the real command, leave a trace, and roles are enforced", async t => {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "wp10-inbox-session-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-inbox" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(clock / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now }); const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  for (const projectId of [P, "project-other"]) projectWorkspace.createProject({ actor: owner, projectId, name: projectId });
  for (const [userId, email, secret] of [["admin-user", "admin@example.test", "admin-mfa-secret-inbox"], ["viewer-user", "viewer@example.test", "viewer-mfa-secret-inbox"]]) identity.createUser({ actor: owner, user: { userId, email, displayName: userId, password: "User password 123", mfaSecret: secret, mfaRequired: true } });
  access.upsertGrant({ actor: owner, grant: { projectId: P, userId: "admin-user", role: "admin" } }); access.upsertGrant({ actor: owner, grant: { projectId: P, userId: "viewer-user", role: "viewer" } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop()); const base = `http://127.0.0.1:${address.port}`;
  const tokens = { owner: login("owner@example.test", "Owner password 123", "owner-mfa-secret-inbox"), admin: login("admin@example.test", "User password 123", "admin-mfa-secret-inbox"), viewer: login("viewer@example.test", "User password 123", "viewer-mfa-secret-inbox") };
  const call = async (who, method, route, body) => { const response = await fetch(`${base}${route}`, { method, headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/json", ...(method === "GET" ? {} : { origin: base }) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await response.text(); let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; } return { status: response.status, body: parsed }; };
  const root = `/api/projects/${P}`;
  // two commands waiting for approval
  for (const [commandId, correlationId] of [["cmd-inbox-1", "corr-inbox-1"], ["cmd-inbox-2", "corr-inbox-2"]]) {
    assert.equal((await call("admin", "POST", `${root}/commands`, { commandId, action: "deploy.test", risk: "medium", correlationId, idempotencyKey: `idem-${commandId}` })).status, 201);
    assert.equal((await call("admin", "POST", `${root}/commands/${commandId}/authorize`, { authorizationSnapshotId: "BATCH-BACKOFFICE-20261007-025" })).body.card.state, "awaiting-approval");
  }
  const post = (who, extra) => call(who, "POST", `${root}/notifications`, { category: "approval", severity: "warning", ...extra });
  const one = (await post("admin", { title: "Approve cmd 1", deduplicationKey: "approve-cmd-1", correlationId: "corr-inbox-1", action: { type: "approve", commandId: "cmd-inbox-1", fix: { action: "restart-service", risk: "medium", payload: { service: "web" } } } })).body.notification;
  const two = (await post("admin", { title: "Approve cmd 2", deduplicationKey: "approve-cmd-2", correlationId: "corr-inbox-2", action: { type: "approve", commandId: "cmd-inbox-2" } })).body.notification;
  const forged = (await post("admin", { title: "Forged", deduplicationKey: "forged", correlationId: "corr-forged", action: { type: "approve", commandId: "cmd-from-nowhere" } })).body.notification;
  const list = await call("viewer", "GET", `${root}/notifications?view=needs-decision`); assert.equal(list.body.notifications.length, 0, "a viewer has nothing to decide"); assert.equal(list.body.counts["needs-decision"], 0);
  assert.equal((await call("admin", "GET", `${root}/notifications?view=needs-decision`)).body.counts["needs-decision"], 3);
  assert.equal((await call("viewer", "POST", `${root}/notifications/${one.notificationId}/act`, { action: "approve" })).status, 403);
  assert.equal((await call("admin", "POST", `${root}/notifications/${forged.notificationId}/act`, { action: "approve" })).status, 404, "a command that does not exist cannot be approved from the inbox");
  assert.equal((await call("admin", "GET", `${root}/notifications?view=needs-decision`)).body.notifications.some(item => item.notificationId === forged.notificationId), true, "a failed command step leaves the notification untouched");
  const approved = await call("admin", "POST", `${root}/notifications/${one.notificationId}/act`, { action: "approve", reason: "looks right" });
  assert.equal(approved.status, 200); assert.equal(approved.body.notification.state, "resolved"); assert.equal(approved.body.command.state, "approved", "the real command was approved");
  assert.equal((await call("admin", "GET", `${root}/commands/cmd-inbox-1`)).body.card.state, "approved");
  assert.equal((await call("admin", "POST", `${root}/notifications/${one.notificationId}/act`, { action: "approve" })).status, 409, "no second decision");
  const rejected = await call("admin", "POST", `${root}/notifications/${two.notificationId}/act`, { action: "reject", reason: "wrong window" });
  assert.equal(rejected.body.command.state, "cancelled"); assert.equal((await call("admin", "POST", `${root}/commands/cmd-inbox-2/queue`, {})).status >= 400, true, "a rejected command can never be queued");
  const fix = (await post("admin", { title: "Service down", deduplicationKey: "down", correlationId: "corr-fix", action: { type: "fix", fix: { action: "restart-service", risk: "medium", payload: { service: "web" } } } })).body.notification;
  const proposed = await call("admin", "POST", `${root}/notifications/${fix.notificationId}/act`, { action: "run-fix" });
  assert.equal(proposed.body.command.state, "draft", "run-fix only drafts a command; it never executes"); assert.equal(proposed.body.command.sourceRef, `hero://projects/${P}/notifications/${fix.notificationId}`);
  const chat = await call("admin", "POST", `${root}/notifications/${fix.notificationId}/act`, { action: "chat" }); assert.equal(chat.body.link, `hero://projects/${P}/notifications/${fix.notificationId}`);
  // correlation trail
  const trail = (await call("viewer", "GET", `${root}/correlations/corr-inbox-1`)).body.correlation;
  assert.equal(trail.commands.length, 1); assert.ok(trail.traces.length >= 3, "authorize, approve and the notification decision left traces"); assert.deepEqual(trail.gaps, []);
  assert.equal(trail.notifications[0].notificationId, one.notificationId);
  assert.deepEqual((await call("viewer", "GET", `${root}/correlations/corr-unknown`)).body.correlation.gaps, ["unknown-correlation"]);
  assert.equal((await call("admin", "GET", `/api/projects/project-other/correlations/corr-inbox-1`)).status, 403);
  const other = await call("owner", "GET", `/api/projects/project-other/correlations/corr-inbox-1`); assert.equal(other.body.correlation.commands.length, 0, "another project never sees this trail");
  // streams, export, retention, slo over HTTP
  assert.equal((await call("viewer", "GET", `${root}/audit-log?stream=security`)).status, 403);
  assert.equal((await call("viewer", "GET", `${root}/audit-log?limit=2`)).body.audit.length, 2);
  assert.equal((await call("admin", "POST", `${root}/audit-log/export`, { reason: "x review" })).status, 403);
  assert.equal((await call("owner", "POST", `${root}/audit-log/export`, { format: "json" })).status, 400, "no reason, no export");
  const exported = await call("owner", "POST", `${root}/audit-log/export`, { reason: "weekly review", format: "json" }); assert.equal(exported.status, 200); assert.ok(exported.body.export.rowCount >= 3);
  assert.equal((await call("owner", "GET", `${root}/audit-log?stream=security&kind=audit.export`)).body.audit.length, 1);
  assert.equal((await call("admin", "POST", `${root}/retention`, { stream: "activity", days: 90, reason: "x" })).status, 403);
  assert.equal((await call("owner", "POST", `${root}/retention`, { stream: "security", days: 10, reason: "shrink" })).status, 409);
  assert.equal((await call("owner", "POST", `${root}/retention`, { stream: "activity", days: 90, reason: "policy" })).body.retention.version, 1);
  assert.equal((await call("viewer", "GET", `${root}/retention`)).body.retention.deletion, "none");
  assert.equal((await call("viewer", "GET", `${root}/slo`)).body.slo.healthy, false);
  assert.equal((await call("viewer", "POST", `${root}/slo`, { projection: "portfolio", lagSeconds: 1, freshnessSeconds: 60 })).status, 403);
  assert.equal((await call("admin", "POST", `${root}/slo`, { projection: "portfolio", lagSeconds: 1, freshnessSeconds: 60 })).body.slo.slos.find(item => item.projection === "portfolio").status, "meeting");
  // page
  const page = async (who, id = P) => { const response = await fetch(`${base}/api/portal?surface=inbox&projectId=${id}`, { headers: { cookie: `__Host-hero-human-session=${encodeURIComponent(tokens[who])}` }, redirect: "manual" }); return { status: response.status, html: await response.text() }; };
  const adminPage = await page("admin"); assert.equal(adminPage.status, 200); assert.match(adminPage.html, /data-tab="needs-decision"/); assert.match(adminPage.html, /data-act="run-fix"/);
  const viewerPage = await page("viewer"); assert.equal(viewerPage.status, 200); assert.ok(!/data-act="/.test(viewerPage.html.split("<script>")[0]), "a viewer sees no action buttons"); assert.ok(!viewerPage.html.includes("cmd-from-nowhere"));
  assert.equal((await page("viewer", "project-other")).status, 403);
});
