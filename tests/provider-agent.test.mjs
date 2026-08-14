import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getProviderAgentContractSummary,
  validateProviderAgentContract
} from "../packages/contracts/src/provider-agent.mjs";
import {
  ProviderUnavailableError,
  SensitiveProviderInputError,
  createCodexChatGptHarness,
  createCodexChatGptPipeline,
  createDisabledProviderAdapter,
  createDeterministicCodexAdapter
} from "../packages/domain/src/provider-agent.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const fixedNow = () => "2026-08-14T17:00:00.000Z";

function command(overrides = {}) {
  return {
    runId: "RUN-PROVIDER-011",
    taskId: "TASK-PROVIDER-011",
    stepId: "HERO-011",
    documentVersion: "v1.0",
    productRequest: "یک فرم ثبت درخواست محصول بساز که نتیجهٔ تست را شفاف نشان دهد.",
    workspace: { workspaceKey: ".hero/worktrees/run-provider-011", branchName: "hero/task/run-provider-011" },
    idempotencyKey: "provider-once",
    ...overrides
  };
}

test("provider-agent contract fixes the two-provider boundary and evidence shape", () => {
  assert.deepEqual(validateProviderAgentContract(), []);
  const summary = getProviderAgentContractSummary();
  assert.deepEqual(summary.providers, ["chatgpt", "codex"]);
  assert.deepEqual(summary.resultFields, ["files", "tests", "errors", "artifact"]);
  assert.match(summary.safetyBoundary, /disabled by default/);
});

test("deterministic ChatGPT and Codex pipeline returns explicit structured evidence", () => {
  const pipeline = createCodexChatGptPipeline();
  const first = pipeline.execute(command());
  const replay = pipeline.execute(command());
  assert.equal(first.status, "completed");
  assert.equal(first.analysis.provider, "chatgpt");
  assert.equal(first.execution.provider, "codex");
  assert.deepEqual(Object.keys(first.result), ["files", "tests", "errors", "artifact"]);
  assert.equal(first.result.tests.status, "passed");
  assert.deepEqual(first.result.errors, []);
  assert.equal(first.execution.workspace.actualRepositoryMutation, false);
  assert.equal(replay.idempotent, true);
  assert.throws(() => pipeline.execute(command({ productRequest: "درخواست متفاوت" })), /idempotency key/);
});

test("disabled Codex fails closed without an execution artifact", () => {
  const pipeline = createCodexChatGptPipeline({ codex: createDisabledProviderAdapter("codex") });
  const result = pipeline.execute(command());
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "PROVIDER_DISABLED");
  assert.equal(result.result.artifact, null);
  assert.deepEqual(result.result.files, []);
  assert.deepEqual(result.result.errors, [{ code: "PROVIDER_DISABLED", provider: "codex" }]);
  assert.throws(() => createDisabledProviderAdapter("other"), /not supported/);
  assert.equal(new ProviderUnavailableError("codex").code, "PROVIDER_DISABLED");
});

test("sensitive task input is rejected before either provider can run", () => {
  const pipeline = createCodexChatGptPipeline();
  assert.throws(
    () => pipeline.execute(command({ productRequest: "api_key: dont-put-a-key-here" })),
    SensitiveProviderInputError
  );
});

test("provider harness binds the pipeline to authorization, worktree checkpoint and cleanup", () => {
  const result = createCodexChatGptHarness({ now: fixedNow }).run(command());
  assert.equal(result.status, "completed");
  assert.equal(result.workflow.state, "completed");
  assert.equal(result.runner.state, "cleaned");
  assert.equal(result.dispatch.authorized, true);
  assert.equal(result.structuredResult.result.tests.passed, 3);
  assert.ok(result.events.some(event => event.type === "runner.checkpointed"));
  assert.ok(result.events.some(event => event.type === "run.review-approved"));
});

test("approved provider specification stays aligned with the executable boundary", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-011-v1.0.md"), "utf8");
  assert.match(specification, /ChatGPT/);
  assert.match(specification, /Codex/);
  assert.match(specification, /Artifact/);
  assert.match(specification, /PROVIDER_DISABLED/);
});
