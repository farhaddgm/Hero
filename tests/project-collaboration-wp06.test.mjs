import assert from "node:assert/strict";
import test from "node:test";

import { validateBackofficeCollaborationContract, settingsKeyFor } from "../packages/contracts/src/backoffice-collaboration.mjs";
import { createProjectCollaboration, CollaborationError } from "../packages/domain/src/project-collaboration.mjs";
import { createProjectSettingsRegistry } from "../packages/domain/src/project-settings.mjs";
import { createPostgresCollaborationStore } from "../packages/adapters/src/postgresql-collaboration-store.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

let clock = Date.parse("2026-10-06T09:00:00.000Z");
const now = () => new Date(clock).toISOString();
const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const viewer = { subject: "project-viewer", role: "viewer" };
const brief = { reference: "hero://evidence/brief", kind: "brief", version: "1.0.0" };
const code = expected => error => error instanceof CollaborationError && error.code === expected;

test("BO-063/064/065 teams carry versioned project-scoped roles, principles, KPIs and policy; profiles keep history", () => {
  assert.deepEqual(validateBackofficeCollaborationContract(), []);
  const hub = createProjectCollaboration({ now });
  const first = hub.assignTeam({ actor: owner, projectId: "project-a", teamId: "developero", roleIds: ["executor", "code-reviewer"], principles: ["test first"], kpis: ["defect escape"], policy: { reviewRequired: true } });
  assert.deepEqual(first.roleIds, ["code-reviewer", "executor"]);
  assert.throws(() => hub.assignTeam({ actor: owner, projectId: "project-a", teamId: "developero", roleIds: ["executor"], expectedVersion: 0 }), code("STALE_ASSIGNMENT"));
  const second = hub.assignTeam({ actor: owner, projectId: "project-a", teamId: "developero", roleIds: ["executor"], expectedVersion: 1 });
  assert.equal(second.supersedesVersion, 1);
  assert.throws(() => hub.assignTeam({ actor: owner, projectId: "project-a", teamId: "developero", roleIds: ["wizard"] }), code("ROLE_NOT_FOUND"));
  assert.throws(() => hub.assignTeam({ actor: owner, projectId: "project-a", teamId: "unknown-team" }), code("TEAM_NOT_FOUND"));
  assert.equal(hub.listTeams({ actor: viewer, projectId: "project-b" }).find(team => team.teamId === "developero").assignment, null, "assignment never leaks to another project");
  const removed = hub.unassignTeam({ actor: owner, projectId: "project-a", teamId: "developero", expectedVersion: 2, reason: "scope reduced" });
  assert.equal(removed.status, "inactive");
  assert.equal(hub.listTeams({ actor: viewer, projectId: "project-a" }).find(team => team.teamId === "developero").assignment, null);
  hub.setProfile({ actor: admin, projectId: "project-a", kind: "role", targetId: "analyst", profile: { mission: "analyze" } });
  hub.setProfile({ actor: admin, projectId: "project-a", kind: "role", targetId: "analyst", profile: { mission: "analyze deeper" }, expectedVersion: 1 });
  assert.throws(() => hub.setProfile({ actor: admin, projectId: "project-a", kind: "role", targetId: "wizard", profile: {} }), code("ROLE_NOT_FOUND"));
  const [profile] = hub.listProfiles({ actor: viewer, projectId: "project-a", kind: "role" });
  assert.equal(profile.version, 2); assert.deepEqual(profile.history.map(item => item.version), [1, 2]);
  assert.deepEqual(hub.listProfiles({ actor: viewer, projectId: "project-b" }), []);
});

test("BO-066/067/068 five bound contexts, continuable threads with retention, and model precedence through project settings", () => {
  clock = Date.parse("2026-10-06T09:00:00.000Z");
  const settings = createProjectSettingsRegistry({ now });
  settings.setValue({ actor: admin, projectId: "project-a", path: "ai.defaultModel", value: "luna", reason: "default" });
  settings.setValue({ actor: admin, projectId: "project-a", path: `ai.teamModels.${settingsKeyFor("ideh-pardazo")}`, value: "terra", reason: "ideation team" });
  settings.setValue({ actor: admin, projectId: "project-a", path: `ai.roleModels.${settingsKeyFor("decision-maker")}`, value: "sol", reason: "decisions" });
  const hub = createProjectCollaboration({ now, settings, entityExists: (projectId, entityId) => projectId === "project-a" && entityId === "component-api" });
  const role = hub.bindContext({ actor: admin, projectId: "project-a", contextType: "role", roleId: "decision-maker" });
  const team = hub.bindContext({ actor: admin, projectId: "project-a", contextType: "team", teamId: "ideh-pardazo" });
  const project = hub.bindContext({ actor: admin, projectId: "project-a", contextType: "project", retentionDays: 1 });
  const pinned = hub.bindContext({ actor: admin, projectId: "project-a", contextType: "hero", model: { provider: "configured", model: "mercury" } });
  hub.bindContext({ actor: admin, projectId: "project-a", contextType: "entity", entityId: "component-api" });
  assert.throws(() => hub.bindContext({ actor: admin, projectId: "project-a", contextType: "entity", entityId: "component-other" }), code("ENTITY_NOT_FOUND"));
  assert.deepEqual([role, team, project, pinned].map(item => [item.effectiveModel.model, item.effectiveModel.source]), [["sol", "role-setting"], ["terra", "team-setting"], ["luna", "project-default"], ["mercury", "conversation"]]);
  assert.equal(createProjectCollaboration({ now }).bindContext({ actor: admin, projectId: "project-z", contextType: "project" }).effectiveModel.source, "unresolved");

  hub.appendMessage({ actor: admin, projectId: "project-a", conversationId: project.conversationId, content: "Day one note", citations: [brief, { reference: "hero://projects/project-a/decisions/7" }] });
  clock += 2 * 86_400_000;
  hub.appendMessage({ actor: admin, projectId: "project-a", conversationId: project.conversationId, content: "Day three note" });
  const read = hub.readConversation({ actor: viewer, projectId: "project-a", conversationId: project.conversationId });
  assert.deepEqual(read.messages.map(message => message.content), ["Day three note"], "retention drops expired messages from the thread");
  assert.equal(read.expiredMessageCount, 1);
  const listed = hub.listConversations({ actor: viewer, projectId: "project-a", contextType: "project" });
  assert.equal(listed[0].messageCount, 1);
  hub.closeConversation({ actor: admin, projectId: "project-a", conversationId: project.conversationId, reason: "decision recorded" });
  assert.throws(() => hub.appendMessage({ actor: admin, projectId: "project-a", conversationId: project.conversationId, content: "late" }), code("CONVERSATION_CLOSED"));
  assert.throws(() => hub.readConversation({ actor: viewer, projectId: "project-b", conversationId: project.conversationId }), code("CONVERSATION_NOT_FOUND"));
});

test("BO-069/070/071 memory is scoped and versioned; corrections keep history; other projects and their sources are unreachable", () => {
  clock = Date.parse("2026-10-06T09:00:00.000Z");
  const hub = createProjectCollaboration({ now });
  hub.setProfile({ actor: admin, projectId: "project-a", kind: "specialist", targetId: "security-specialist", profile: { focus: "auth" } });
  const restricted = hub.recordMemory({ actor: admin, projectId: "project-a", memoryId: "memory-a1", level: "project", key: "architecture", content: "Isolated deployment boundary.", provenance: brief, confidence: 0.9, sensitivity: "restricted" });
  hub.recordMemory({ actor: admin, projectId: "project-a", memoryId: "memory-a2", level: "specialist", scopeId: "security-specialist", key: "auth-notes", content: "Rotate session keys.", provenance: brief });
  assert.throws(() => hub.recordMemory({ actor: admin, projectId: "project-a", memoryId: "memory-a3", level: "specialist", scopeId: "ghost", key: "x-notes", content: "nope", provenance: brief }), code("SPECIALIST_NOT_FOUND"));
  assert.throws(() => hub.recordMemory({ actor: admin, projectId: "project-a", memoryId: "memory-a1", level: "project", key: "dup", content: "reuse", provenance: brief }), code("MEMORY_ID_REUSED"));
  assert.throws(() => hub.recordMemory({ actor: admin, projectId: "project-a", memoryId: "memory-a4", level: "project", key: "poison", content: "Copied from B", provenance: { reference: "hero://projects/project-b/memory/9" } }), code("CROSS_PROJECT_SOURCE_REJECTED"));
  hub.recordMemory({ actor: admin, projectId: "project-b", memoryId: "memory-b1", level: "project", key: "architecture", content: "Project B secret plan.", provenance: brief });
  assert.equal(hub.retrieveMemory({ actor: viewer, projectId: "project-a", query: "architecture" })[0].content, "[restricted memory]");
  assert.ok(hub.retrieveMemory({ actor: admin, projectId: "project-a" }).every(item => item.projectId === "project-a"));
  assert.ok(!JSON.stringify(hub.retrieveMemory({ actor: admin, projectId: "project-a", query: "plan" })).includes("Project B"), "project B memory is never retrieved in A");
  assert.equal(hub.retrieveMemory({ actor: viewer, projectId: "project-a", level: "specialist", scopeId: "security-specialist" }).length, 1);

  const corrected = hub.correctMemory({ actor: admin, projectId: "project-a", memoryId: restricted.memoryId, content: "Isolated delivery boundaries.", provenance: brief });
  assert.throws(() => hub.correctMemory({ actor: admin, projectId: "project-a", memoryId: restricted.memoryId, content: "stale", provenance: brief }), code("MEMORY_NOT_ACTIVE"));
  const history = hub.memoryHistory({ actor: viewer, projectId: "project-a", memoryId: restricted.memoryId });
  assert.deepEqual(history.map(item => [item.memoryId, item.status]), [[corrected.memoryId, "active"], ["memory-a1", "superseded"]]);
  assert.ok(history.every(item => item.content === "[restricted memory]"), "history is redacted for viewers too");
  hub.disableMemory({ actor: admin, projectId: "project-a", memoryId: corrected.memoryId, reason: "wrong source" });
  assert.equal(hub.retrieveMemory({ actor: admin, projectId: "project-a", query: "boundar" }).length, 0);
  assert.equal(hub.memoryHistory({ actor: admin, projectId: "project-a", memoryId: "memory-a1" }).length, 2, "disable keeps history");
  assert.throws(() => hub.appendMessage({ actor: admin, projectId: "project-a", conversationId: hub.bindContext({ actor: admin, projectId: "project-a", contextType: "project" }).conversationId, content: "see B", citations: [{ reference: "hero://projects/project-b/docs/1" }] }), code("CROSS_PROJECT_SOURCE_REJECTED"));
});

test("BO-072 knowledge proposals are sanitized, target-accepted into target memory, and never expose the source", () => {
  clock = Date.parse("2026-10-06T09:00:00.000Z");
  const hub = createProjectCollaboration({ now });
  const sourceMemory = hub.recordMemory({ actor: admin, projectId: "project-vpn", memoryId: "memory-v1", level: "team", scopeId: "testero", key: "verification", content: "Verify transport evidence.", provenance: brief });
  hub.recordMemory({ actor: admin, projectId: "project-vpn", memoryId: "memory-v2", level: "project", key: "private", content: "Restricted detail.", provenance: brief, sensitivity: "restricted" });
  assert.throws(() => hub.proposeKnowledge({ actor: admin, sourceProjectId: "project-vpn", targetProjectId: "project-crm", memoryId: "memory-v2", summary: "leak" }), code("KNOWLEDGE_SOURCE_INVALID"));
  const proposal = hub.proposeKnowledge({ actor: admin, sourceProjectId: "project-vpn", targetProjectId: "project-crm", memoryId: sourceMemory.memoryId, summary: "In project-vpn we verify evidence; see hero://projects/project-vpn/runbooks/4 for steps." });
  assert.ok(!proposal.summary.includes("project-vpn"), proposal.summary);
  assert.match(proposal.summary, /\[source-project\]/); assert.match(proposal.summary, /\[source-reference\]/);
  const visible = hub.listKnowledgeProposals({ actor: viewer, projectId: "project-crm" });
  assert.equal(visible.length, 1); assert.equal(visible[0].sourceProjectId, undefined); assert.equal(visible[0].sourceMemoryId, undefined);
  assert.deepEqual(hub.listKnowledgeProposals({ actor: viewer, projectId: "project-vpn" }), []);
  assert.throws(() => hub.acceptKnowledge({ actor: owner, projectId: "project-vpn", knowledgeProposalId: proposal.knowledgeProposalId }), code("KNOWLEDGE_PROPOSAL_INVALID"), "only the target decides");
  const accepted = hub.acceptKnowledge({ actor: owner, projectId: "project-crm", knowledgeProposalId: proposal.knowledgeProposalId });
  const [targetMemory] = hub.retrieveMemory({ actor: viewer, projectId: "project-crm" });
  assert.equal(targetMemory.memoryId, accepted.targetMemoryId);
  assert.equal(targetMemory.provenance.reference, `hero://knowledge/${proposal.knowledgeProposalId}`);
  assert.throws(() => hub.rejectKnowledge({ actor: owner, projectId: "project-crm", knowledgeProposalId: proposal.knowledgeProposalId, reason: "late" }), code("KNOWLEDGE_PROPOSAL_INVALID"));
});

test("collaboration records persist and replay in any order to the same state", () => {
  clock = Date.parse("2026-10-06T09:00:00.000Z");
  const hub = createProjectCollaboration({ now });
  hub.assignTeam({ actor: owner, projectId: "project-a", teamId: "testero", roleIds: ["verifier"] });
  const conversation = hub.bindContext({ actor: admin, projectId: "project-a", contextType: "project", title: "Release" });
  hub.appendMessage({ actor: admin, projectId: "project-a", conversationId: conversation.conversationId, content: "First" });
  clock += 1000; hub.appendMessage({ actor: admin, projectId: "project-a", conversationId: conversation.conversationId, content: "Second" });
  hub.closeConversation({ actor: admin, projectId: "project-a", conversationId: conversation.conversationId, reason: "done now" });
  const first = hub.recordMemory({ actor: admin, projectId: "project-a", memoryId: "memory-p1", level: "project", key: "goal", content: "Ship v1.", provenance: brief });
  const second = hub.correctMemory({ actor: admin, projectId: "project-a", memoryId: first.memoryId, content: "Ship v1.1.", provenance: brief });
  const records = hub.drainRecords();
  assert.ok(records.length >= 8); assert.deepEqual(hub.drainRecords(), []);
  for (const order of [records, [...records].reverse()]) {
    const replayed = createProjectCollaboration({ now });
    for (const record of order) replayed.hydrate(structuredClone(record));
    const read = replayed.readConversation({ actor: viewer, projectId: "project-a", conversationId: conversation.conversationId });
    assert.deepEqual(read.messages.map(message => message.content), ["First", "Second"]);
    assert.equal(read.status, "closed");
    assert.deepEqual(replayed.retrieveMemory({ actor: viewer, projectId: "project-a" }).map(item => item.memoryId), [second.memoryId]);
    assert.equal(replayed.listTeams({ actor: viewer, projectId: "project-a" }).find(team => team.teamId === "testero").assignment.roleIds[0], "verifier");
    assert.deepEqual(replayed.drainRecords(), [], "replay emits no new records");
  }
});

test("collaboration store serializes jsonb metadata and rejects unsafe records", async () => {
  const queries = []; const store = createPostgresCollaborationStore({ client: { async query(sql, values) { queries.push({ sql, values }); return { rows: [] }; } } });
  await store.appendRecord({ recordId: "message-1", projectId: "project-a", recordType: "message", metadata: { conversationId: "conversation-1", message: { content: "hi" } }, actorId: "hero-owner" });
  assert.equal(queries[0].values[4], JSON.stringify({ conversationId: "conversation-1", message: { content: "hi" } }));
  await assert.rejects(() => store.appendRecord({ recordId: "memory-1", projectId: "project-a", recordType: "memory", metadata: { apiKey: "x" }, actorId: "hero-owner" }), error => error.code === "SENSITIVE_PERSISTENCE_FORBIDDEN");
  await assert.rejects(() => store.appendRecord({ recordId: "x-1", projectId: "project-a", recordType: "unknown", metadata: {}, actorId: "hero-owner" }), error => error.code === "RECORD_TYPE_INVALID");
});

test("HTTP: a user who is admin in one project and viewer in another gets redacted memory in the viewer project", async t => {
  clock = Date.parse("2026-10-06T09:00:00.000Z");
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "collab-http-session-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-for-collab" } });
  const epoch = () => Math.floor(clock / 1000);
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, epoch()) }).token; };
  const ownerToken = login("owner@example.test", "Owner password 123", "owner-mfa-secret-for-collab");
  const projectSettings = createProjectSettingsRegistry({ now });
  const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const ownerHeaders = { authorization: `Bearer ${ownerToken}`, "content-type": "application/json" };
  for (const projectId of ["project-alpha", "project-beta"]) {
    const created = await fetch(`${base}/api/projects`, { method: "POST", headers: ownerHeaders, body: JSON.stringify({ projectId, name: projectId, idempotencyKey: `create-${projectId}-001` }) });
    assert.equal(created.status, 201);
  }
  const user = identity.createUser({ actor: { subject: "hero-owner", role: "project-owner" }, user: { userId: "mixed-user", email: "mixed@example.test", displayName: "Mixed", password: "Mixed password 123", mfaSecret: "mixed-mfa-secret-for-collab", mfaRequired: true } });
  access.upsertGrant({ actor: { subject: "hero-owner", role: "project-owner" }, grant: { projectId: "project-alpha", userId: user.userId, role: "admin" } });
  access.upsertGrant({ actor: { subject: "hero-owner", role: "project-owner" }, grant: { projectId: "project-beta", userId: user.userId, role: "viewer" } });
  const restricted = { level: "project", key: "plan", content: "Restricted roadmap detail.", provenance: brief, sensitivity: "restricted" };
  for (const projectId of ["project-alpha", "project-beta"]) {
    const saved = await fetch(`${base}/api/projects/${projectId}/memory`, { method: "POST", headers: ownerHeaders, body: JSON.stringify({ memoryId: `memory-${projectId}`, ...restricted }) });
    assert.equal(saved.status, 201, await saved.text());
  }
  const mixedHeaders = { authorization: `Bearer ${login("mixed@example.test", "Mixed password 123", "mixed-mfa-secret-for-collab")}`, "content-type": "application/json" };
  const alpha = await (await fetch(`${base}/api/projects/project-alpha/memory`, { headers: mixedHeaders })).json();
  const beta = await (await fetch(`${base}/api/projects/project-beta/memory`, { headers: mixedHeaders })).json();
  assert.equal(alpha.memory[0].content, "Restricted roadmap detail.", "admin grant sees content");
  assert.equal(beta.memory[0].content, "[restricted memory]", "viewer grant is redacted even though the user's global role is admin");
  const write = await fetch(`${base}/api/projects/project-beta/memory`, { method: "POST", headers: mixedHeaders, body: JSON.stringify({ memoryId: "memory-x", ...restricted, sensitivity: "normal" }) });
  assert.equal(write.status, 403, "viewer grant cannot write");
  const knowledge = await fetch(`${base}/api/projects/project-alpha/knowledge-proposals`, { method: "POST", headers: ownerHeaders, body: JSON.stringify({ targetProjectId: "project-beta", memoryId: "memory-project-alpha", summary: "x" }) });
  assert.equal(knowledge.status, 409, "restricted memory is never proposed across projects");
});
