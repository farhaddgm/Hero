import assert from "node:assert/strict";
import test from "node:test";

import { createAiOrchestration } from "../packages/domain/src/ai-orchestration.mjs";
import { createTeamRegistry } from "../packages/domain/src/team-registry.mjs";

const owner = { kind: "project-owner", id: "hero-owner" };
const fixedNow = () => "2026-09-04T12:00:00.000Z";

test("team contract history exposes a safe diff and owner rollback creates a new version", () => {
  const registry = createTeamRegistry({ now: fixedNow });
  const original = registry.get("mahsulo").principles;
  const first = registry.updatePrinciples({
    teamId: "mahsulo",
    principles: ["اصل نسخهٔ دوم برای تصمیم محصول", "اصل نسخهٔ دوم برای خروجی قابل سنجش"],
    actor: owner,
    idempotencyKey: "team-history-first"
  });
  registry.updatePrinciples({
    teamId: "mahsulo",
    principles: ["اصل نسخهٔ سوم برای تصمیم محصول", "اصل نسخهٔ سوم برای خروجی قابل سنجش"],
    expectedVersion: first.team.version,
    actor: owner,
    idempotencyKey: "team-history-second"
  });

  const history = registry.contractHistory("mahsulo");
  assert.equal(history.length, 2);
  assert.deepEqual(history[0].diff.principles.from, original);
  assert.equal(history[0].rollbackAvailable, true);
  assert.doesNotMatch(JSON.stringify(history), /password|secret|token|Bearer/i);

  const rolledBack = registry.rollbackPrinciples({
    teamId: "mahsulo",
    targetEventId: history[0].eventId,
    expectedVersion: 2,
    actor: owner,
    idempotencyKey: "team-history-rollback"
  });
  assert.deepEqual(rolledBack.team.principles, original);
  assert.equal(rolledBack.team.version, 3);
  assert.equal(rolledBack.team.approvals.principles, false);
});

test("AI role policy history can rollback to an earlier policy without changing prior events", () => {
  const orchestration = createAiOrchestration({ now: fixedNow });
  orchestration.registerProvider({ providerId: "deterministic", mode: "deterministic", displayName: "Deterministic", actor: owner, idempotencyKey: "history-provider" });
  orchestration.registerModel({ providerId: "deterministic", modelId: "stable", displayName: "Stable", actor: owner, idempotencyKey: "history-model" });
  const first = orchestration.setDefaultRolePolicy({ role: "analyst", providerId: "deterministic", modelId: "stable", toolPolicy: "read-only", actor: owner, idempotencyKey: "history-policy-first" });
  orchestration.setDefaultRolePolicy({ role: "analyst", providerId: "deterministic", modelId: "stable", toolPolicy: "owner-gated", actor: owner, idempotencyKey: "history-policy-second" });
  const history = orchestration.rolePolicyHistory("analyst");
  assert.equal(history.length, 2);
  assert.equal(history[0].policyVersion, first.policy.policyVersion);
  const rolledBack = orchestration.rollbackRolePolicy({ role: "analyst", targetEventId: history[0].eventId, expectedVersion: 3, actor: owner, idempotencyKey: "history-policy-rollback" });
  assert.equal(rolledBack.policy.toolPolicy, "read-only");
  assert.equal(rolledBack.policy.policyVersion, 4);
  assert.equal(orchestration.rolePolicyHistory("analyst").length, 3);
});
