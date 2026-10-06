import assert from "node:assert/strict";
import test from "node:test";

import { COMMAND_ACTIONS, getBackofficeCommandCenterContractSummary, validateBackofficeCommandCenterContract } from "../packages/contracts/src/backoffice-command-center.mjs";
import { createCommandCenter, CommandCenterError } from "../packages/domain/src/command-center.mjs";
import { createProjectSettingsRegistry } from "../packages/domain/src/project-settings.mjs";

const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const viewer = { subject: "project-viewer", role: "viewer" };
const code = expected => error => error instanceof CommandCenterError && error.code === expected;
const DIGEST = `sha256:${"a".repeat(64)}`;

function clock(start = "2026-10-06T10:00:00.000Z") {
  let current = Date.parse(start);
  return { now: () => new Date(current).toISOString(), advance: minutes => { current += minutes * 60_000; } };
}
function withPolicy(projectIds, settings = createProjectSettingsRegistry({ now: () => "2026-10-06T09:00:00.000Z" })) {
  for (const projectId of projectIds) { settings.suggestPolicyPack({ projectId }); settings.applyPolicyPack({ actor: owner, projectId, reason: "Initial policy" }); }
  return settings;
}
let counter = 0;
function intent(center, { projectId = "project-a", action = "run-tests", risk = "medium", actor = admin, ...rest } = {}) {
  counter += 1;
  return center.createIntent({ actor, projectId, commandId: `cmd-${counter}`, action, risk, correlationId: `corr-${counter}`, idempotencyKey: `idem-${counter}`, ...rest });
}
function ready(center, input = {}) {
  const command = intent(center, input);
  center.authorize({ actor: admin, commandId: command.commandId, authorizationSnapshotId: "BATCH-BACKOFFICE-20261006-023" });
  if (center.commandCard({ actor: viewer, commandId: command.commandId }).state === "awaiting-approval") center.approve({ actor: input.risk === "critical" ? owner : admin, commandId: command.commandId, reason: "reviewed" });
  return command;
}

test("BO-075 contract: taxonomy, risk floors and dispatch gates are explicit", () => {
  assert.deepEqual(validateBackofficeCommandCenterContract(), []);
  const summary = getBackofficeCommandCenterContractSummary();
  assert.equal(summary.version, "1.1");
  assert.ok(summary.dispatchGates.includes("production-separate-gate"));
  assert.ok(COMMAND_ACTIONS.filter(item => item.directEligible).every(item => item.minRisk === "low"));
  const center = createCommandCenter();
  assert.throws(() => intent(center, { action: "deploy-production", risk: "high" }), code("COMMAND_RISK_UNDERSTATED"));
  assert.throws(() => intent(center, { action: "change-policy", risk: "medium" }), code("COMMAND_RISK_UNDERSTATED"));
  assert.throws(() => intent(center, { action: "my-custom-job", risk: "low" }), code("COMMAND_RISK_UNDERSTATED"), "unknown actions are never low risk");
  assert.throws(() => intent(center, { payload: { nested: { apiKey: "x" } } }), code("SENSITIVE_PAYLOAD_REJECTED"));
  assert.throws(() => intent(center, { actor: viewer }), code("PROJECT_WRITE_REQUIRED"));
});

test("BO-076/077 conversation → intent cites its source and the command card previews every gate", () => {
  const center = createCommandCenter();
  const command = center.createIntentFromMessage({ actor: admin, projectId: "project-a", conversationId: "conversation-1", message: { messageId: "message-9", content: "  Please   run the test suite\nfor checkout " }, commandId: "cmd-chat", action: "run-tests", risk: "medium", correlationId: "corr-chat", idempotencyKey: "idem-chat" });
  assert.equal(command.sourceRef, "hero://projects/project-a/conversations/conversation-1/messages/message-9");
  assert.equal(command.summary, "Please run the test suite for checkout");
  assert.throws(() => intent(center, { sourceRef: "hero://projects/project-b/conversations/c/messages/m" }), code("CROSS_PROJECT_SOURCE_REJECTED"));
  assert.throws(() => intent(center, { sourceRef: "https://evil.example/x" }), code("SOURCE_INVALID"));
  const card = center.commandCard({ actor: viewer, commandId: "cmd-chat" });
  assert.equal(card.category, "execution"); assert.equal(card.riskFloor, "medium"); assert.equal(card.state, "draft");
  assert.deepEqual(card.requiredGates, ["human-approval", "global-stop", "policy-readiness"]);
  const production = intent(center, { action: "deploy-production", risk: "critical", payload: { changeType: "release", artifactDigest: DIGEST } });
  assert.ok(center.commandCard({ actor: viewer, commandId: production.commandId }).requiredGates.includes("production-separate-gate"));
});

test("BO-078/079 decisions are immutable versions bound to a policy snapshot; direct runs need project policy", () => {
  const settings = withPolicy(["project-a", "project-b"]);
  settings.setValue({ actor: admin, projectId: "project-b", path: "automation.mode", value: "approval-required", reason: "Stricter for project b" });
  const center = createCommandCenter({ settings });
  const direct = intent(center, { action: "refresh-summary", risk: "low", executionMode: "direct-if-policy" });
  const decided = center.authorize({ actor: admin, commandId: direct.commandId, authorizationSnapshotId: "BATCH-1" });
  assert.equal(decided.state, "approved"); assert.equal(decided.decision.state, "eligible-for-direct");
  assert.equal(decided.decision.snapshot.policy.automationMode, "propose-first");
  const strict = intent(center, { projectId: "project-b", action: "refresh-summary", risk: "low", executionMode: "direct-if-policy" });
  assert.equal(center.authorize({ actor: admin, commandId: strict.commandId, authorizationSnapshotId: "BATCH-1" }).state, "awaiting-approval", "project policy forbids direct execution");
  const again = center.authorize({ actor: admin, commandId: direct.commandId, authorizationSnapshotId: "BATCH-2" });
  assert.equal(again.decision.version, 2); assert.equal(again.decision.supersedesDecisionId, decided.decision.decisionId);
  assert.equal(again.decisions.length, 2); assert.equal(again.decisions[0].authorizationSnapshotId, "BATCH-1", "the earlier decision is kept, not rewritten");
  assert.throws(() => { again.decisions[0].state = "tampered"; }, TypeError, "decision history is frozen");
});

test("BO-080/084 dispatch re-checks Global Stop, approval expiry, revocation, policy drift and readiness", () => {
  const time = clock(); let stopped = false;
  const settings = withPolicy(["project-a"]);
  const center = createCommandCenter({ now: time.now, settings, globalStop: () => stopped });
  const expiring = ready(center);
  center.queue({ actor: admin, commandId: expiring.commandId });
  time.advance(61);
  assert.equal(center.dispatchNext({ actor: admin }), null);
  assert.equal(center.commandCard({ actor: viewer, commandId: expiring.commandId }).blocker.code, "APPROVAL_EXPIRED");

  const revoked = ready(center);
  center.queue({ actor: admin, commandId: revoked.commandId });
  center.revokeApproval({ actor: owner, commandId: revoked.commandId, reason: "scope changed" });
  assert.equal(center.commandCard({ actor: viewer, commandId: revoked.commandId }).blocker.code, "APPROVAL_REVOKED");
  assert.throws(() => center.recover({ actor: admin, commandId: revoked.commandId, action: "retry", reason: "try anyway" }), code("COMMAND_NOT_APPROVED"));

  const drifted = ready(center);
  center.queue({ actor: admin, commandId: drifted.commandId });
  settings.setValue({ actor: admin, projectId: "project-a", path: "automation.mode", value: "approval-required", reason: "tighten" });
  assert.equal(center.dispatchNext({ actor: admin }), null);
  assert.equal(center.commandCard({ actor: viewer, commandId: drifted.commandId }).blocker.code, "POLICY_CHANGED_SINCE_DECISION");
  center.authorize({ actor: admin, commandId: drifted.commandId, authorizationSnapshotId: "BATCH-3" });
  center.approve({ actor: admin, commandId: drifted.commandId, reason: "re-reviewed under new policy" });
  center.queue({ actor: admin, commandId: drifted.commandId });
  stopped = true;
  assert.throws(() => center.dispatchNext({ actor: admin }), code("GLOBAL_STOP_ACTIVE"));
  assert.throws(() => center.queue({ actor: admin, commandId: ready(center).commandId }), code("GLOBAL_STOP_ACTIVE"));
  stopped = false;
  assert.equal(center.dispatchNext({ actor: admin }).entry.commandId, drifted.commandId);

  const unready = createCommandCenter({ now: time.now, settings: createProjectSettingsRegistry({ now: time.now }) });
  const missing = ready(unready, { projectId: "project-new" });
  unready.queue({ actor: admin, commandId: missing.commandId });
  assert.equal(unready.dispatchNext({ actor: admin }), null);
  assert.equal(unready.commandCard({ actor: viewer, commandId: missing.commandId }).blocker.code, "POLICY_INCOMPLETE");
});

test("BO-085 Production stays behind its separate gate even with a matching preauthorization", () => {
  const time = clock(); const center = createCommandCenter({ now: time.now });
  const production = intent(center, { action: "deploy-production", risk: "critical", payload: { changeType: "release", artifactDigest: DIGEST } });
  center.authorize({ actor: admin, commandId: production.commandId, authorizationSnapshotId: "BATCH-1" });
  assert.throws(() => center.approve({ actor: admin, commandId: production.commandId }), code("OWNER_REQUIRED"));
  center.approve({ actor: owner, commandId: production.commandId, reason: "owner reviewed" });
  assert.throws(() => center.preauthorizeProduction({ actor: admin, projectId: "project-a", preauthorizationId: "preauth-1", changeType: "release", validFrom: time.now(), validUntil: "2026-10-07T10:00:00.000Z", artifactDigest: DIGEST, testEvidenceRef: "hero://evidence/rc" }), code("OWNER_REQUIRED"));
  assert.throws(() => center.preauthorizeProduction({ actor: owner, projectId: "project-a", preauthorizationId: "preauth-1", changeType: "release", validFrom: time.now(), validUntil: "2026-10-20T10:00:00.000Z", artifactDigest: DIGEST, testEvidenceRef: "hero://evidence/rc" }), code("PRODUCTION_PREAUTH_TOO_LONG"));
  const record = center.preauthorizeProduction({ actor: owner, projectId: "project-a", preauthorizationId: "preauth-1", changeType: "release", validFrom: time.now(), validUntil: "2026-10-07T10:00:00.000Z", artifactDigest: DIGEST, testEvidenceRef: "hero://evidence/rc" });
  assert.equal(record.state, "recorded-not-a-deploy-grant");
  assert.equal(center.matchPreauthorization({ projectId: "project-a", changeType: "release", artifactDigest: DIGEST }).preauthorizationId, "preauth-1");
  assert.equal(center.matchPreauthorization({ projectId: "project-a", changeType: "release", artifactDigest: `sha256:${"b".repeat(64)}` }), null, "a different artifact never matches");
  center.queue({ actor: owner, commandId: production.commandId });
  assert.equal(center.dispatchNext({ actor: owner }), null, "Production is never dispatched by the Command Center");
  const blocker = center.commandCard({ actor: viewer, commandId: production.commandId }).blocker;
  assert.equal(blocker.code, "PRODUCTION_SEPARATE_GATE"); assert.match(blocker.message, /matches/);
  center.revokePreauthorization({ actor: owner, preauthorizationId: "preauth-1", reason: "release withdrawn" });
  assert.equal(center.matchPreauthorization({ projectId: "project-a", changeType: "release", artifactDigest: DIGEST }), null);
});

test("BO-081/082 weighted fair scheduling, owner-only priority and the heavy-run limit", () => {
  const time = clock(); const center = createCommandCenter({ now: time.now, heavyRunLimit: 1 });
  const runningA = ready(center, { projectId: "project-a" }); center.queue({ actor: admin, commandId: runningA.commandId }); center.dispatchNext({ actor: admin });
  const nextA = ready(center, { projectId: "project-a" }); center.queue({ actor: admin, commandId: nextA.commandId });
  const nextB = ready(center, { projectId: "project-b" }); center.queue({ actor: admin, commandId: nextB.commandId });
  assert.equal(center.dispatchNext({ actor: admin }).entry.commandId, nextB.commandId, "a project with a running command yields to an idle project");
  assert.throws(() => center.queue({ actor: admin, commandId: ready(center).commandId, priority: 10 }), code("OWNER_REQUIRED"));
  assert.throws(() => center.setPriority({ actor: admin, commandId: nextA.commandId, priority: 50 }), code("OWNER_REQUIRED"));
  assert.equal(center.setPriority({ actor: owner, commandId: nextA.commandId, priority: 50 }).priority, 50);
  const heavy1 = ready(center, { projectId: "project-c" }); center.queue({ actor: admin, commandId: heavy1.commandId, heavy: true, priority: 0 });
  const heavy2 = ready(center, { projectId: "project-d" }); center.queue({ actor: admin, commandId: heavy2.commandId, heavy: true });
  assert.equal(center.dispatchNext({ actor: admin }).entry.commandId, nextA.commandId, "owner priority wins");
  assert.equal(center.dispatchNext({ actor: admin }).entry.commandId, heavy1.commandId);
  assert.equal(center.dispatchNext({ actor: admin }), null, "heavy limit 1 holds the second heavy run");
  assert.throws(() => center.setHeavyRunLimit({ actor: admin, limit: 2 }), code("OWNER_REQUIRED"));
  assert.equal(center.setHeavyRunLimit({ actor: owner, limit: 2 }).heavyRunLimit, 2);
  assert.equal(center.dispatchNext({ actor: admin }).entry.commandId, heavy2.commandId);
  const scoped = createCommandCenter({ now: time.now });
  const other = ready(scoped, { projectId: "project-b" }); scoped.queue({ actor: admin, commandId: other.commandId });
  assert.equal(scoped.dispatchNext({ actor: admin, projectId: "project-a" }), null, "a project route never dispatches another project's command");
});

test("BO-083/086 bounded retry with backoff, timeout sweep, compensation and manual recovery", () => {
  const time = clock(); const center = createCommandCenter({ now: time.now });
  const command = ready(center, { action: "change-settings", risk: "medium" });
  center.queue({ actor: admin, commandId: command.commandId });
  center.dispatchNext({ actor: admin });
  const retry = center.fail({ actor: admin, commandId: command.commandId, error: "boom" });
  assert.equal(retry.state, "queued"); assert.equal(retry.notBefore, "2026-10-06T10:02:00.000Z");
  assert.equal(center.dispatchNext({ actor: admin }), null, "backoff holds the retry");
  time.advance(2); center.dispatchNext({ actor: admin });
  time.advance(31);
  assert.equal(center.sweepTimeouts({ actor: admin })[0].lastError, "timeout");
  time.advance(4); center.dispatchNext({ actor: admin });
  const failed = center.fail({ actor: admin, commandId: command.commandId, error: "still broken" });
  assert.equal(failed.state, "failed"); assert.equal(failed.attempts, 3);
  assert.deepEqual(failed.compensation, { required: true, action: "settings-rollback", state: "pending" });
  assert.throws(() => center.recover({ actor: admin, commandId: command.commandId, action: "compensate", reason: "" }), code("REASON_REQUIRED"));
  assert.equal(center.recover({ actor: admin, commandId: command.commandId, action: "compensate", reason: "rolled settings back" }).state, "compensated");
  const plain = ready(center); center.queue({ actor: admin, commandId: plain.commandId }); center.dispatchNext({ actor: admin });
  for (let attempt = 0; attempt < 3; attempt += 1) { center.fail({ actor: admin, commandId: plain.commandId }); time.advance(10); if (attempt < 2) center.dispatchNext({ actor: admin }); }
  assert.throws(() => center.recover({ actor: admin, commandId: plain.commandId, action: "compensate", reason: "nothing to undo" }), code("COMPENSATION_NOT_DEFINED"));
  assert.equal(center.recover({ actor: admin, commandId: plain.commandId, action: "retry", reason: "fixed the flaky host" }).attempts, 0);
  assert.equal(center.dispatchNext({ actor: admin }).entry.attempts, 1);
});

test("BO-087/088 crash recovery: replay in any order marks in-flight runs interrupted; completion is idempotent", () => {
  const time = clock(); const center = createCommandCenter({ now: time.now });
  const done = ready(center); center.queue({ actor: admin, commandId: done.commandId }); center.dispatchNext({ actor: admin }); center.complete({ actor: admin, commandId: done.commandId });
  assert.equal(center.complete({ actor: admin, commandId: done.commandId }).state, "completed", "a repeated completion is a no-op");
  const inflight = ready(center); center.queue({ actor: admin, commandId: inflight.commandId, resourceClaim: "repo-main" }); center.dispatchNext({ actor: admin });
  center.createApprovalTemplate({ actor: owner, projectId: "project-a", templateId: "tmpl-low", name: "Low", allowedRisks: ["low"] });
  center.setHeavyRunLimit({ actor: owner, limit: 4 });
  const records = center.drainRecords();
  assert.ok(records.every(record => record.version >= 1 && record.key && record.projectId));
  assert.equal(center.drainRecords().length, 0);

  const restarted = createCommandCenter({ now: time.now });
  for (const record of [...records].reverse()) restarted.hydrate(record);
  const operations = restarted.operations({ actor: viewer, projectId: "project-a" });
  assert.deepEqual(operations.interrupted.map(item => item.commandId), [inflight.commandId]);
  assert.deepEqual(operations.completed.map(item => item.commandId), [done.commandId]);
  assert.equal(operations.templates[0].templateId, "tmpl-low"); assert.equal(operations.heavyRunLimit, 4);
  assert.throws(() => restarted.hydrate({ kind: "unknown" }), code("INVALID_HYDRATION"));
  assert.equal(restarted.resume({ actor: admin, commandId: inflight.commandId }).state, "queued");
  const rerun = restarted.dispatchNext({ actor: admin });
  assert.equal(rerun.entry.commandId, inflight.commandId); assert.equal(rerun.entry.attempts, 2, "the interrupted attempt is counted");
});

test("BO-080 approval templates: suggestion, optimistic edit and owner-only critical scope", () => {
  const center = createCommandCenter();
  const suggestion = center.suggestApprovalTemplate({ actor: admin, projectId: "project-a", risk: "high" });
  assert.equal(suggestion.state, "suggested"); assert.equal(suggestion.expiresInMinutes, 60);
  const created = center.createApprovalTemplate({ actor: admin, projectId: "project-a", templateId: "tmpl-a", name: "Medium", allowedRisks: ["medium"], expiresInMinutes: 30 });
  assert.throws(() => center.createApprovalTemplate({ actor: admin, projectId: "project-a", templateId: "tmpl-a", name: "Edit", allowedRisks: ["medium"], expectedVersion: 0 }), code("STALE_TEMPLATE"));
  assert.equal(center.createApprovalTemplate({ actor: admin, projectId: "project-a", templateId: "tmpl-a", name: "Edit", allowedRisks: ["medium", "high"], expectedVersion: created.version }).version, 2);
  assert.throws(() => center.createApprovalTemplate({ actor: admin, projectId: "project-a", templateId: "tmpl-c", name: "Critical", allowedRisks: ["critical"] }), code("OWNER_REQUIRED"));
  assert.throws(() => center.createApprovalTemplate({ actor: admin, projectId: "project-b", templateId: "tmpl-a", name: "Move", allowedRisks: ["medium"] }), code("APPROVAL_TEMPLATE_SCOPE_INVALID"));
  const command = intent(center, { risk: "high" }); center.authorize({ actor: admin, commandId: command.commandId, authorizationSnapshotId: "BATCH-1" });
  assert.equal(center.approve({ actor: admin, commandId: command.commandId, templateId: "tmpl-a" }).approval.templateVersion, 2);
});
