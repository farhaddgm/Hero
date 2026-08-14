import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getCursorHandoffContractSummary,
  validateCursorHandoffContract
} from "../packages/contracts/src/cursor-handoff.mjs";
import {
  CursorHandoffSafetyError,
  CursorHandoffUnavailableError,
  SensitiveCursorHandoffInputError,
  createCursorHandoffHarness,
  createCursorHandoffPipeline,
  createDisabledCursorHandoffAdapter
} from "../packages/domain/src/cursor-handoff.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const fixedNow = () => "2026-08-14T19:00:00.000Z";

function command(overrides = {}) {
  return {
    runId: "RUN-CURSOR-013",
    taskId: "TASK-CURSOR-013",
    stepId: "HERO-013",
    documentVersion: "v1.0",
    idempotencyKey: "cursor-handoff-once",
    executionEvidence: {
      provider: "codex",
      taskId: "TASK-CURSOR-013",
      stepId: "HERO-013",
      documentVersion: "v1.0",
      status: "completed",
      files: ["packages/domain/src/cursor-handoff.mjs", "tests/cursor-handoff.test.mjs"],
      tests: { command: "pnpm check", total: 1, passed: 1, failed: 0, status: "passed" },
      errors: [],
      artifact: { kind: "codex-execution", reference: "hero://artifacts/RUN-CURSOR-013/codex-execution.json", external: false },
      workspace: {
        workspaceKey: ".hero/worktrees/run-cursor-013",
        branchName: "hero/task/run-cursor-013",
        isolated: true,
        actualRepositoryMutation: false
      }
    },
    reviewEvidence: {
      provider: "claude",
      taskId: "TASK-CURSOR-013",
      stepId: "HERO-013",
      documentVersion: "v1.0",
      status: "approved",
      approved: true,
      findings: []
    },
    ...overrides
  };
}

test("Cursor handoff contract fixes its portable human-control boundary", () => {
  assert.deepEqual(validateCursorHandoffContract(), []);
  const summary = getCursorHandoffContractSummary();
  assert.equal(summary.provider, "cursor");
  assert.deepEqual(summary.states, ["ready", "blocked"]);
  assert.match(summary.portabilityBoundary, /absolute host paths are rejected/);
  assert.match(summary.safetyBoundary, /explicit human confirmation/);
});

test("deterministic Cursor handoff prepares a portable package and replays idempotently", () => {
  const pipeline = createCursorHandoffPipeline();
  const first = pipeline.prepare(command());
  const replay = pipeline.prepare(command());
  assert.equal(first.status, "ready");
  assert.equal(first.code, "HANDOFF_READY");
  assert.equal(first.handoff.provider, "cursor");
  assert.equal(first.handoff.workspace.portable, true);
  assert.equal(first.handoff.workspace.absoluteHostPathsIncluded, false);
  assert.equal(first.handoff.boundary.actualCursorInvocation, false);
  assert.equal(first.handoff.boundary.actualCommandExecution, false);
  assert.equal(first.handoff.commands.length, 3);
  assert.ok(first.handoff.commands.every(command => command.executed === false && command.requiresExplicitHumanConfirmation === true));
  assert.equal(replay.idempotent, true);
  assert.throws(() => pipeline.prepare(command({
    taskId: "TASK-CHANGED",
    executionEvidence: { ...command().executionEvidence, taskId: "TASK-CHANGED" },
    reviewEvidence: { ...command().reviewEvidence, taskId: "TASK-CHANGED" }
  })), /idempotency key/);
});

test("Claude changes-requested blocks Cursor continuation and removes suggested commands", () => {
  const result = createCursorHandoffPipeline().prepare(command({
    reviewEvidence: { ...command().reviewEvidence, status: "changes-requested", approved: false, findings: [{ id: "CLAUDE-TEST-002" }] }
  }));
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "CLAUDE_CHANGES_REQUESTED");
  assert.equal(result.handoff.continuation.canContinueInCursor, false);
  assert.deepEqual(result.handoff.commands, []);
});

test("disabled Cursor fails closed while sensitive or host-bound evidence is rejected", () => {
  const blocked = createCursorHandoffPipeline({ adapter: createDisabledCursorHandoffAdapter() }).prepare(command());
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.code, "CURSOR_HANDOFF_DISABLED");
  assert.equal(blocked.handoff.artifact, null);
  assert.equal(new CursorHandoffUnavailableError().code, "CURSOR_HANDOFF_DISABLED");
  assert.throws(
    () => createCursorHandoffPipeline().prepare(command({ executionEvidence: { ...command().executionEvidence, errors: [{ message: "api_key: do-not-send" }] } })),
    SensitiveCursorHandoffInputError
  );
  assert.throws(
    () => createCursorHandoffPipeline().prepare(command({ executionEvidence: { ...command().executionEvidence, files: [String.fromCharCode(67, 58, 92) + "agent\\leak.mjs"] } })),
    CursorHandoffSafetyError
  );
  assert.throws(
    () => createCursorHandoffPipeline().prepare(command({ executionEvidence: { ...command().executionEvidence, artifact: { ...command().executionEvidence.artifact, external: true } } })),
    CursorHandoffSafetyError
  );
});

test("Cursor handoff harness requires exact review authorization but creates no runner", () => {
  const result = createCursorHandoffHarness({ now: fixedNow }).run(command());
  assert.equal(result.status, "ready");
  assert.equal(result.dispatch.authorized, true);
  assert.equal(result.dispatch.operation, "review");
  assert.ok(result.events.some(event => event.type === "authorization.granted"));
  assert.ok(result.events.some(event => event.type === "authorization.dispatch-authorized"));
  assert.equal(result.events.some(event => event.type.startsWith("runner.")), false);
});

test("approved Cursor specification stays aligned with the executable boundary", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-013-v1.0.md"), "utf8");
  assert.match(specification, /Cursor/);
  assert.match(specification, /HANDOFF_READY/);
  assert.match(specification, /CURSOR_HANDOFF_DISABLED/);
  assert.match(specification, /Task/);
});
