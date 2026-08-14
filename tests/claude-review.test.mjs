import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getClaudeReviewContractSummary,
  validateClaudeReviewContract
} from "../packages/contracts/src/claude-review.mjs";
import {
  ClaudeReviewUnavailableError,
  SensitiveClaudeReviewInputError,
  createClaudeReviewHarness,
  createClaudeReviewPipeline,
  createDisabledClaudeReviewer
} from "../packages/domain/src/claude-review.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const fixedNow = () => "2026-08-14T18:00:00.000Z";

function command(overrides = {}) {
  return {
    runId: "RUN-CLAUDE-012",
    taskId: "TASK-CLAUDE-012",
    stepId: "HERO-012",
    documentVersion: "v1.0",
    idempotencyKey: "claude-review-once",
    executionEvidence: {
      provider: "codex",
      status: "completed",
      files: ["packages/domain/src/provider-agent.mjs"],
      tests: { command: "pnpm test", total: 5, passed: 5, failed: 0, status: "passed" },
      errors: [],
      artifact: { kind: "codex-execution", reference: "hero://artifacts/RUN-CLAUDE-012/codex-execution.json", external: false },
      workspace: { isolated: true, actualRepositoryMutation: false }
    },
    ...overrides
  };
}

test("Claude review contract fixes independent findings and correction boundaries", () => {
  assert.deepEqual(validateClaudeReviewContract(), []);
  const summary = getClaudeReviewContractSummary();
  assert.equal(summary.provider, "claude");
  assert.deepEqual(summary.categories, ["architecture", "security", "edge-case", "tests"]);
  assert.match(summary.correctionBoundary, /separately authorized task/);
});

test("deterministic Claude approves clean Codex evidence and replays idempotently", () => {
  const pipeline = createClaudeReviewPipeline();
  const first = pipeline.review(command());
  const replay = pipeline.review(command());
  assert.equal(first.status, "approved");
  assert.equal(first.code, "REVIEW_APPROVED");
  assert.equal(first.review.provider, "claude");
  assert.deepEqual(first.review.findings, []);
  assert.equal(first.review.boundary.actualProviderCall, false);
  assert.equal(first.review.boundary.directFixesAllowed, false);
  assert.equal(replay.idempotent, true);
  assert.throws(() => pipeline.review(command({ taskId: "TASK-CHANGED" })), /idempotency key/);
});

test("deterministic Claude structures architecture, security, edge-case and test findings", () => {
  const result = createClaudeReviewPipeline().review(command({
    executionEvidence: {
      provider: "codex",
      status: "blocked",
      files: [],
      tests: { command: "pnpm test", total: 5, passed: 3, failed: 2, status: "failed" },
      errors: [{ code: "UNHANDLED_EDGE_CASE" }],
      artifact: { kind: "codex-execution", reference: "https://example.invalid/evidence", external: true },
      workspace: { isolated: false, actualRepositoryMutation: true }
    }
  }));
  assert.equal(result.status, "changes-requested");
  assert.equal(result.code, "CHANGES_REQUESTED");
  assert.deepEqual(
    [...new Set(result.review.findings.map(item => item.category))].sort(),
    ["architecture", "edge-case", "security", "tests"]
  );
  assert.ok(result.review.findings.every(item => Object.keys(item).join(",") === "id,category,severity,reference,problem,recommendedAction"));
  assert.ok(result.review.findings.some(item => item.severity === "critical"));
});

test("disabled Claude fails closed and sensitive evidence is rejected", () => {
  const blocked = createClaudeReviewPipeline({ reviewer: createDisabledClaudeReviewer() }).review(command());
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.code, "CLAUDE_REVIEW_DISABLED");
  assert.equal(blocked.review.artifact, null);
  assert.equal(new ClaudeReviewUnavailableError().code, "CLAUDE_REVIEW_DISABLED");
  assert.throws(
    () => createClaudeReviewPipeline().review(command({ executionEvidence: { ...command().executionEvidence, errors: [{ message: "api_key: do-not-send" }] } })),
    SensitiveClaudeReviewInputError
  );
});

test("Claude review harness requires the version-bound review authorization but creates no worktree", () => {
  const result = createClaudeReviewHarness({ now: fixedNow }).run(command());
  assert.equal(result.status, "approved");
  assert.equal(result.dispatch.authorized, true);
  assert.equal(result.dispatch.operation, "review");
  assert.ok(result.events.some(event => event.type === "authorization.granted"));
  assert.ok(result.events.some(event => event.type === "authorization.dispatch-authorized"));
  assert.equal(result.events.some(event => event.type.startsWith("runner.")), false);
});

test("approved Claude specification stays aligned with the executable boundary", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-012-v1.0.md"), "utf8");
  assert.match(specification, /Claude/);
  assert.match(specification, /changes-requested/);
  assert.match(specification, /CLAUDE_REVIEW_DISABLED/);
  assert.match(specification, /Task/);
});
