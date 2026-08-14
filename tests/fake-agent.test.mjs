import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getFakeAgentContractSummary,
  validateFakeAgentContract
} from "../packages/contracts/src/fake-agent.mjs";
import {
  FakeAgentIdempotencyConflictError,
  createDeterministicFakeAgent,
  createFakeOrchestrationHarness
} from "../packages/domain/src/fake-agent.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const fixedNow = () => "2026-08-14T16:00:00.000Z";

function runHarness(scenario) {
  return createFakeOrchestrationHarness({ now: fixedNow }).run({
    runId: `RUN-FAKE-${scenario.toUpperCase()}`,
    taskId: "TASK-FAKE-009",
    stepId: "HERO-009",
    documentVersion: "v1.0",
    scenario
  });
}

test("fake agent contract documents deterministic no-provider coverage", () => {
  assert.deepEqual(validateFakeAgentContract(), []);
  const summary = getFakeAgentContractSummary();
  assert.equal(summary.providerBoundary.includes("no network"), true);
  assert.deepEqual(summary.scenarios, ["success", "review-changes", "failure-then-retry", "pause-resume"]);
});

test("same fake agent command replays exactly and changed input fails closed", () => {
  const agent = createDeterministicFakeAgent({ now: fixedNow });
  const command = {
    runId: "RUN-FAKE-IDEMPOTENT",
    taskId: "TASK-FAKE-009",
    stepId: "HERO-009",
    documentVersion: "v1.0",
    scenario: "success",
    attempt: 1,
    idempotencyKey: "fake-agent-once"
  };
  const first = agent.execute(command);
  const replay = agent.execute(command);
  assert.equal(first.idempotent, false);
  assert.equal(replay.idempotent, true);
  assert.deepEqual({ ...replay, idempotent: false }, first);
  assert.throws(
    () => agent.execute({ ...command, scenario: "pause-resume" }),
    FakeAgentIdempotencyConflictError
  );
});

test("success scenario reaches test checkpoint, review and owner approval", () => {
  const result = runHarness("success");
  assert.equal(result.status, "completed");
  assert.equal(result.workflow.state, "completed");
  assert.equal(result.authorization.status, "active");
  assert.equal(result.dispatch.authorized, true);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0].outcome, "completed");
  assert.deepEqual(result.runners.map(item => item.state), ["cleaned"]);
  assert.ok(result.events.some(event => event.type === "run.review-approved"));
});

test("review changes uses a second isolated attempt before approval", () => {
  const result = runHarness("review-changes");
  assert.equal(result.workflow.state, "completed");
  assert.equal(result.workflow.reviewCount, 2);
  assert.deepEqual(result.attempts.map(item => item.outcome), ["review-changes-requested", "completed"]);
  assert.deepEqual(result.runners.map(item => item.state), ["cleaned", "cleaned"]);
  assert.ok(result.events.some(event => event.type === "run.review-changes-requested"));
});

test("failure then retry records failure, opens a new attempt and completes", () => {
  const result = runHarness("failure-then-retry");
  assert.equal(result.workflow.state, "completed");
  assert.equal(result.workflow.retryCount, 1);
  assert.deepEqual(result.attempts.map(item => item.outcome), ["failed", "completed"]);
  assert.deepEqual(result.runners.map(item => item.state), ["cleaned", "cleaned"]);
  assert.ok(result.events.some(event => event.type === "run.retry-requested"));
  assert.ok(result.events.some(event => event.type === "runner.failed"));
});

test("pause and resume requires a safe checkpoint before the new attempt", () => {
  const result = runHarness("pause-resume");
  assert.equal(result.workflow.state, "completed");
  assert.deepEqual(result.attempts.map(item => item.outcome), ["checkpoint-ready", "completed"]);
  assert.deepEqual(result.runners.map(item => item.state), ["cleaned", "cleaned"]);
  assert.ok(result.events.some(event => event.type === "run.paused"));
  assert.ok(result.events.some(event => event.type === "run.resumed"));
  assert.ok(result.events.some(event => event.type === "runner.checkpointed"));
});

test("approved fake agent specification remains aligned with the machine contract", () => {
  const specification = fs.readFileSync(
    path.join(REPO_ROOT, "docs", "specs", "HERO-009-v1.0.md"),
    "utf8"
  );
  assert.match(specification, /Fake Agent/);
  assert.match(specification, /retry/);
  assert.match(specification, /Pause/);
  assert.match(specification, /Approval/);
  assert.match(specification, /شبکه/);
});
