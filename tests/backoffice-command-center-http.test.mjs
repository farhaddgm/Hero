import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresCommandCenterStore } from "../packages/adapters/src/postgresql-command-center-store.mjs";
import { createCommandCenter } from "../packages/domain/src/command-center.mjs";
import { createProjectSettingsRegistry } from "../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

const now = () => "2026-10-06T10:00:00.000Z";
const ownerActor = { subject: "hero-owner", role: "project-owner" };

test("command center store serializes jsonb, keeps governance ids and refuses credentials", async () => {
  const rows = [];
  const client = { async query(sql, values) { if (sql.startsWith("INSERT")) { rows.push({ command_id: values[0], decision_version: values[1], project_id: values[2], state: values[3], authorization_snapshot_id: values[4], correlation_id: values[5], metadata: JSON.parse(values[6]), recorded_at: now() }); return { rows: [] }; } return { rows }; } };
  const store = createPostgresCommandCenterStore({ client });
  const center = createCommandCenter({ now });
  const command = center.createIntent({ actor: ownerActor, projectId: "project-a", commandId: "cmd-1", action: "run-tests", risk: "medium", correlationId: "corr-1", idempotencyKey: "idem-1" });
  center.authorize({ actor: ownerActor, commandId: command.commandId, authorizationSnapshotId: "BATCH-1" });
  for (const record of center.drainRecords()) await store.appendRecord(record);
  assert.equal(rows.length, 2); assert.equal(rows[1].authorization_snapshot_id, "BATCH-1"); assert.equal(rows[1].correlation_id, "corr-1");
  const restored = createCommandCenter({ now }); for (const record of await store.listRecords()) restored.hydrate(record);
  assert.equal(restored.commandCard({ actor: ownerActor, commandId: "cmd-1" }).decision.version, 1);
  await assert.rejects(store.appendRecord({ kind: "command", key: "cmd-2", version: 1, projectId: "project-a", state: "draft", actorId: "hero-owner", metadata: { intent: { payload: { accessToken: "x" } } } }), error => error.code === "SENSITIVE_PERSISTENCE_FORBIDDEN");
  await assert.rejects(store.appendRecord({ kind: "bogus", key: "cmd-2", version: 1, projectId: "project-a", state: "draft", actorId: "hero-owner" }), error => error.code === "RECORD_KIND_INVALID");
});

test("BO-076/077/084 HTTP: project-scoped commands, roles, chat-sourced intents and Global Stop", async t => {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "command-center-http-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-wp07" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(Date.parse(now()) / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now });
  const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  for (const projectId of ["project-alpha", "project-beta"]) { projectWorkspace.createProject({ actor: ownerActor, projectId, name: projectId }); projectSettings.suggestPolicyPack({ projectId }); projectSettings.applyPolicyPack({ actor: ownerActor, projectId, reason: "Initial policy" }); }
  for (const [userId, email, secret] of [["admin-user", "admin@example.test", "admin-mfa-secret-wp07"], ["viewer-user", "viewer@example.test", "viewer-mfa-secret-wp07"]]) identity.createUser({ actor: ownerActor, user: { userId, email, displayName: userId, password: "User password 123", mfaSecret: secret, mfaRequired: true } });
  access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-alpha", userId: "admin-user", role: "admin" } });
  access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-alpha", userId: "viewer-user", role: "viewer" } });
  const dashboard = createControlDashboard({ now });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, dashboard, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const tokens = { owner: login("owner@example.test", "Owner password 123", "owner-mfa-secret-wp07"), admin: login("admin@example.test", "User password 123", "admin-mfa-secret-wp07"), viewer: login("viewer@example.test", "User password 123", "viewer-mfa-secret-wp07") };
  const call = async (who, method, path, body) => { const response = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/json", ...(method === "GET" ? {} : { origin: base }) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
  const alpha = "/api/projects/project-alpha";

  const conversation = (await call("admin", "POST", `${alpha}/conversations`, { contextType: "project", title: "Ops" })).body.conversation;
  const message = (await call("admin", "POST", `${alpha}/conversations/${conversation.conversationId}/messages`, { content: "Run the regression suite before Friday" })).body.message;
  const created = await call("admin", "POST", `${alpha}/commands`, { conversationId: conversation.conversationId, messageId: message.messageId, commandId: "cmd-http-1", action: "run-tests", risk: "medium", correlationId: "corr-http-1", idempotencyKey: "idem-http-1" });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.card.source, `hero://projects/project-alpha/conversations/${conversation.conversationId}/messages/${message.messageId}`);
  assert.equal(created.body.card.summary, "Run the regression suite before Friday");
  assert.equal((await call("admin", "POST", `${alpha}/commands`, { conversationId: conversation.conversationId, messageId: "message-forged", commandId: "cmd-http-x", action: "run-tests", correlationId: "corr-x", idempotencyKey: "idem-x" })).body.code, "MESSAGE_NOT_FOUND");
  assert.equal((await call("viewer", "POST", `${alpha}/commands`, { commandId: "cmd-http-v", action: "run-tests", correlationId: "corr-v", idempotencyKey: "idem-v" })).status, 403, "viewer cannot create commands");
  assert.equal((await call("viewer", "GET", `${alpha}/commands/cmd-http-1`)).body.card.state, "draft", "viewer can read the card");
  assert.equal((await call("admin", "GET", "/api/projects/project-beta/commands/cmd-http-1")).status, 403, "no grant on beta");
  assert.equal((await call("owner", "GET", "/api/projects/project-beta/commands/cmd-http-1")).status, 404, "a command id from another project is not found");

  assert.equal((await call("admin", "POST", `${alpha}/commands/cmd-http-1/authorize`, { authorizationSnapshotId: "BATCH-BACKOFFICE-20261006-023" })).body.card.state, "awaiting-approval");
  assert.equal((await call("admin", "POST", `${alpha}/commands/cmd-http-1/approve`, { reason: "reviewed" })).body.card.approval.state, "approved");
  assert.equal((await call("admin", "POST", `${alpha}/commands/cmd-http-1/queue`, { priority: 5 })).body.code, "OWNER_REQUIRED", "admin cannot raise priority");
  assert.equal((await call("admin", "POST", `${alpha}/commands/cmd-http-1/queue`, {})).status, 202);
  dashboard.setGlobalStop(true); // the owner-console route is covered by the dashboard suite
  assert.equal((await call("admin", "POST", `${alpha}/operations/dispatch-next`, {})).body.code, "GLOBAL_STOP_ACTIVE");
  dashboard.setGlobalStop(false);
  const dispatched = await call("admin", "POST", `${alpha}/operations/dispatch-next`, {});
  assert.equal(dispatched.body.dispatch.entry.commandId, "cmd-http-1");
  assert.equal((await call("admin", "POST", `${alpha}/commands/cmd-http-1/complete`, {})).body.card.state, "completed");
  const operations = (await call("viewer", "GET", `${alpha}/operations`)).body.operations;
  assert.deepEqual(operations.completed.map(item => item.commandId), ["cmd-http-1"]);
  assert.equal((await call("admin", "POST", "/api/operations/heavy-run-limit", { limit: 3 })).status, 403, "only the owner sets the global heavy-run limit");
  assert.equal((await call("owner", "POST", "/api/operations/heavy-run-limit", { limit: 3 })).body.scheduler.heavyRunLimit, 3);
  assert.equal((await call("admin", "POST", `${alpha}/approval-templates/suggest`, { risk: "critical" })).body.suggestion.ownerOnly, true);
});
