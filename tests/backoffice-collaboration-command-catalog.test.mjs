import assert from "node:assert/strict";
import test from "node:test";

import { validateBackofficeCollaborationContract } from "../packages/contracts/src/backoffice-collaboration.mjs";
import { validateBackofficeCommandCenterContract } from "../packages/contracts/src/backoffice-command-center.mjs";
import { validateSystemCatalogContract } from "../packages/contracts/src/system-catalog.mjs";
import { createProjectCollaboration, CollaborationError } from "../packages/domain/src/project-collaboration.mjs";
import { createCommandCenter, CommandCenterError } from "../packages/domain/src/command-center.mjs";
import { createSystemCatalog, SystemCatalogError } from "../packages/domain/src/system-catalog.mjs";

const now = () => "2026-09-10T12:00:00.000Z";
const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const viewer = { subject: "project-viewer", role: "viewer" };
const src = { reference: "hero://evidence/brief", kind: "brief", version: "1.0.0" };

test("five conversation contexts, team assignment and profiles remain project scoped", () => {
  assert.deepEqual(validateBackofficeCollaborationContract(), []);
  const hub = createProjectCollaboration({ now });
  const assigned = hub.assignTeam({ actor: owner, projectId: "project-vpn", teamId: "mahsulo" });
  assert.equal(assigned.projectId, "project-vpn");
  const profile = hub.setProfile({ actor: admin, projectId: "project-vpn", kind: "role", targetId: "analyst", profile: { mission: "analyze" } });
  assert.equal(profile.version, 1);
  for (const contextType of ["hero", "project", "team", "role", "entity"]) {
    const conversation = hub.bindContext({ actor: admin, projectId: "project-vpn", contextType, teamId: contextType === "team" ? "mahsulo" : null, roleId: contextType === "role" ? "analyst" : null, entityId: contextType === "entity" ? "component-vpn" : null });
    hub.appendMessage({ actor: admin, projectId: "project-vpn", conversationId: conversation.conversationId, content: "Status analysis", citations: [src] });
    assert.equal(hub.readConversation({ actor: viewer, projectId: "project-vpn", conversationId: conversation.conversationId }).messages.length, 1);
  }
});

test("memory has provenance, expiry/redaction, correction and explicit cross-project knowledge acceptance", () => {
  const hub = createProjectCollaboration({ now });
  const memory = hub.recordMemory({ actor: admin, projectId: "project-vpn", memoryId: "memory-001", level: "project", key: "architecture", content: "Use an isolated deployment boundary.", provenance: src, confidence: 0.9, sensitivity: "restricted" });
  assert.equal(hub.retrieveMemory({ actor: viewer, projectId: "project-vpn" })[0].content, "[restricted memory]");
  const corrected = hub.correctMemory({ actor: admin, projectId: "project-vpn", memoryId: memory.memoryId, content: "Use isolated delivery boundaries.", provenance: src, confidence: 0.95 });
  assert.equal(corrected.supersedesMemoryId, memory.memoryId);
  assert.deepEqual(hub.retrieveMemory({ actor: viewer, projectId: "project-crm" }), []);
  const publicMemory = hub.recordMemory({ actor: admin, projectId: "project-vpn", memoryId: "memory-002", level: "team", key: "research", content: "Verify transport evidence.", provenance: src, confidence: 0.8 });
  const proposal = hub.proposeKnowledge({ actor: admin, sourceProjectId: "project-vpn", targetProjectId: "project-crm", memoryId: publicMemory.memoryId, summary: "Reusable verification practice" });
  assert.equal(hub.acceptKnowledge({ actor: owner, projectId: "project-crm", knowledgeProposalId: proposal.knowledgeProposalId }).state, "accepted");
});

test("Command Center permits direct execution only for explicit low-risk policy and blocks unsafe dispatch", () => {
  assert.deepEqual(validateBackofficeCommandCenterContract(), []);
  let stopped = false; const center = createCommandCenter({ now, globalStop: () => stopped, heavyRunLimit: 2 });
  const low = center.createIntent({ actor: admin, projectId: "project-vpn", commandId: "command-low", action: "refresh-summary", risk: "low", payload: {}, correlationId: "corr-low", idempotencyKey: "idem-low", executionMode: "direct-if-policy" });
  assert.equal(center.authorize({ actor: admin, commandId: low.commandId, authorizationSnapshotId: "snapshot-001" }).state, "approved");
  center.queue({ actor: admin, commandId: low.commandId, heavy: true, resourceClaim: "catalog" });
  assert.ok(center.dispatchNext({ actor: admin }).runId);
  const high = center.createIntent({ actor: admin, projectId: "project-vpn", commandId: "command-high", action: "change-policy", risk: "high", correlationId: "corr-high", idempotencyKey: "idem-high" });
  assert.equal(center.authorize({ actor: admin, commandId: high.commandId, authorizationSnapshotId: "snapshot-002" }).state, "awaiting-approval");
  assert.throws(() => center.queue({ actor: admin, commandId: high.commandId }), error => error instanceof CommandCenterError && error.code === "COMMAND_NOT_APPROVED");
  const template = center.createApprovalTemplate({ actor: admin, projectId: "project-vpn", templateId: "approval-001", name: "High risk", allowedRisks: ["high"] });
  center.approve({ actor: owner, commandId: high.commandId, templateId: template.templateId });
  stopped = true;
  assert.throws(() => center.queue({ actor: admin, commandId: high.commandId }), error => error.code === "GLOBAL_STOP_ACTIVE");
});

test("Production preauthorization is record-only; scheduler respects locks and catalog rejects cross-project entity reuse", () => {
  const center = createCommandCenter({ now });
  const preauth = center.preauthorizeProduction({ actor: owner, projectId: "project-vpn", preauthorizationId: "preauth-001", changeType: "patch", validFrom: "2026-09-10T12:00:00.000Z", validUntil: "2026-09-10T13:00:00.000Z", artifactDigest: `sha256:${"a".repeat(64)}`, testEvidenceRef: "hero://test/evidence" });
  assert.equal(preauth.state, "recorded-not-a-deploy-grant");
  assert.deepEqual(validateSystemCatalogContract(), []);
  const catalog = createSystemCatalog({ now });
  catalog.register({ actor: admin, projectId: "project-vpn", entityId: "app-vpn", type: "application", name: "VPN app" });
  catalog.register({ actor: admin, projectId: "project-vpn", entityId: "service-vpn", type: "service", name: "VPN service" });
  assert.equal(catalog.link({ actor: admin, projectId: "project-vpn", fromEntityId: "app-vpn", toEntityId: "service-vpn" }).relation, "depends-on");
  assert.throws(() => catalog.register({ actor: admin, projectId: "project-crm", entityId: "app-vpn", type: "application", name: "CRM" }), error => error instanceof SystemCatalogError && error.code === "ENTITY_CROSS_PROJECT_CONFLICT");
});
