import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_DEFAULT_ROLE_POLICIES,
  getAiOrchestrationContractSummary,
  validateAiOrchestrationContract
} from "../packages/contracts/src/ai-orchestration.mjs";
import {
  AiOrchestrationError,
  createAiOrchestration,
  createDeterministicAiProviderAdapter
} from "../packages/domain/src/ai-orchestration.mjs";
import { createProjectMemory } from "../packages/domain/src/project-memory.mjs";

const OWNER = { kind: "project-owner", id: "hero-owner" };
const AGENT = { kind: "agent", id: "ai-analyst" };

function registerBase(orchestration, handler = input => ({
  schema: input.outputSchema,
  role: input.role,
  answer: "safe deterministic answer"
})) {
  orchestration.registerProvider({
    providerId: "openai",
    mode: "deterministic",
    displayName: "OpenAI deterministic adapter",
    adapter: createDeterministicAiProviderAdapter("openai", handler),
    actor: OWNER,
    idempotencyKey: "provider-openai-once"
  });
  orchestration.registerModel({
    providerId: "openai",
    modelId: "chatgpt",
    displayName: "ChatGPT analysis profile",
    actor: OWNER,
    idempotencyKey: "model-chatgpt-once"
  });
  orchestration.registerProfile({
    profileId: "analyst-openai-v1",
    role: "analyst",
    providerId: "openai",
    modelId: "chatgpt",
    credentialRef: "runtime:openai-primary",
    promptVersion: "analyst-prompt-v1",
    contextPolicy: "project-approved-context",
    toolPolicy: "read-only",
    outputSchema: "analysis-v1",
    status: "active",
    actor: OWNER,
    idempotencyKey: "profile-analyst-once"
  });
  orchestration.bindRole({
    bindingId: "binding-product-analyst-v1",
    projectId: "product-alpha",
    role: "analyst",
    profileId: "analyst-openai-v1",
    actor: OWNER,
    idempotencyKey: "binding-analyst-once"
  });
}

test("AI orchestration contract keeps roles, provider modes and authority separate", () => {
  assert.deepEqual(validateAiOrchestrationContract(), []);
  const summary = getAiOrchestrationContractSummary();
  assert.ok(summary.roles.includes("analyst"));
  assert.ok(summary.roles.includes("executor"));
  assert.ok(summary.providers.includes("openai-compatible"));
  assert.ok(summary.providers.includes("cursor"));
  assert.match(summary.invariants.join(" "), /Team != AI Role/);
  assert.equal(summary.contextRecipientRoles.executor, "implementer");
  assert.deepEqual(summary.workflows.development, ["planner", "executor", "verifier", "code-reviewer"]);
  assert.equal(AI_DEFAULT_ROLE_POLICIES.executor.toolPolicy, "development");
});

test("Provider, Model, Profile and Role Binding are versioned independently", () => {
  const orchestration = createAiOrchestration();
  registerBase(orchestration);

  const snapshot = orchestration.snapshot();
  assert.equal(snapshot.providers.length, 1);
  assert.equal(snapshot.models.length, 1);
  assert.equal(snapshot.profiles.length, 1);
  assert.equal(snapshot.bindings.length, 1);
  assert.equal(snapshot.bindings[0].role, "analyst");
  assert.equal(snapshot.profiles[0].credentialRef, "runtime:openai-primary");
  assert.equal(orchestration.readProvider("openai").adapter, undefined);
  assert.throws(
    () => orchestration.registerProfile({
      profileId: "unsafe-profile-v1",
      role: "analyst",
      providerId: "openai",
      modelId: "chatgpt",
      credentialRef: "sk-this-must-never-be-a-reference",
      promptVersion: "analyst-prompt-v1",
      contextPolicy: "project-approved-context",
      toolPolicy: "read-only",
      outputSchema: "analysis-v1",
      actor: OWNER,
      idempotencyKey: "profile-unsafe-once"
    }),
    error => error instanceof AiOrchestrationError && error.code === "INVALID_CREDENTIAL_REFERENCE"
  );
});

test("deterministic invocation records an immutable profile snapshot and no secret material", async () => {
  const orchestration = createAiOrchestration();
  registerBase(orchestration);
  const result = await orchestration.invoke({
    invocationId: "invocation-analysis-001",
    projectId: "product-alpha",
    taskId: "task-analysis-001",
    runId: "run-analysis-001",
    role: "analyst",
    contextSnapshotId: "context-analysis-001",
    request: "این مسئله را تحلیل کن.",
    context: { approvedDecision: "scope-v1", artifactRef: "hero://artifacts/spec-v1" },
    actor: AGENT,
    idempotencyKey: "invocation-analysis-once"
  });

  assert.equal(result.invocation.status, "completed");
  assert.equal(result.invocation.providerId, "openai");
  assert.equal(result.invocation.profileId, "analyst-openai-v1");
  assert.equal(result.invocation.response.output.schema, "analysis-v1");
  assert.equal(result.invocation.credentialRef, "runtime:openai-primary");
  const serializedEvents = JSON.stringify(orchestration.events());
  assert.doesNotMatch(serializedEvents, /openai-primary/);
  assert.ok(orchestration.events().some(event => event.type === "ai.invocation-started"));
  assert.ok(orchestration.events().some(event => event.type === "ai.invocation-completed"));

  const replay = await orchestration.invoke({
    invocationId: "invocation-analysis-001",
    projectId: "product-alpha",
    taskId: "task-analysis-001",
    runId: "run-analysis-001",
    role: "analyst",
    contextSnapshotId: "context-analysis-001",
    request: "این مسئله را تحلیل کن.",
    context: { approvedDecision: "scope-v1", artifactRef: "hero://artifacts/spec-v1" },
    actor: AGENT,
    idempotencyKey: "invocation-analysis-once"
  });
  assert.equal(replay.idempotent, true);
  assert.equal(orchestration.events().filter(event => event.type === "ai.invocation-started").length, 1);
});

test("read-only evaluator boundaries, live providers and invalid output fail closed", async () => {
  const orchestration = createAiOrchestration();
  registerBase(orchestration);
  const blocked = await orchestration.invoke({
    invocationId: "invocation-analysis-002",
    projectId: "product-alpha",
    role: "analyst",
    contextSnapshotId: "context-analysis-002",
    request: "تحلیل کن.",
    context: { approvedDecision: "scope-v1" },
    toolAction: "external-message",
    actor: AGENT,
    idempotencyKey: "invocation-read-only-once"
  });
  assert.equal(blocked.invocation.status, "blocked");
  assert.equal(blocked.invocation.code, "READ_ONLY_TOOL_POLICY");

  const live = createAiOrchestration();
  live.registerProvider({
    providerId: "anthropic",
    mode: "live",
    displayName: "Anthropic live adapter",
    adapter: { providerId: "anthropic", mode: "live", generate: async () => ({ output: {} }) },
    actor: OWNER,
    idempotencyKey: "provider-anthropic-once"
  });
  live.registerModel({ providerId: "anthropic", modelId: "default", actor: OWNER, idempotencyKey: "model-anthropic-once" });
  live.registerProfile({
    profileId: "evaluator-anthropic-v1",
    role: "evaluator",
    providerId: "anthropic",
    modelId: "default",
    credentialRef: "runtime:anthropic-primary",
    promptVersion: "evaluator-prompt-v1",
    contextPolicy: "project-approved-context",
    toolPolicy: "read-only",
    outputSchema: "evaluation-v1",
    status: "active",
    actor: OWNER,
    idempotencyKey: "profile-evaluator-once"
  });
  live.bindRole({ bindingId: "binding-evaluator-v1", projectId: "product-alpha", role: "evaluator", profileId: "evaluator-anthropic-v1", actor: OWNER, idempotencyKey: "binding-evaluator-once" });
  const liveResult = await live.invoke({ invocationId: "invocation-evaluator-001", projectId: "product-alpha", role: "evaluator", contextSnapshotId: "context-evaluator-001", request: "ارزیابی کن.", context: { artifact: "hero://artifacts/build" }, actor: AGENT, idempotencyKey: "invocation-evaluator-once" });
  assert.equal(liveResult.invocation.status, "blocked");
  assert.equal(liveResult.invocation.code, "LIVE_PROVIDER_REQUIRES_SEPARATE_AUTHORIZATION");

  const invalidOutput = createAiOrchestration();
  registerBase(invalidOutput, () => ({ schema: "evaluation-v1", answer: "wrong role schema" }));
  const invalidResult = await invalidOutput.invoke({
    invocationId: "invocation-analysis-invalid-output",
    projectId: "product-alpha",
    role: "analyst",
    contextSnapshotId: "context-analysis-invalid-output",
    request: "تحلیل کن.",
    context: { approvedDecision: "scope-v1" },
    actor: AGENT,
    idempotencyKey: "invocation-invalid-output-once"
  });
  assert.equal(invalidResult.invocation.status, "failed");
  assert.equal(invalidResult.invocation.code, "OUTPUT_SCHEMA_INVALID");
});

test("evaluation is evidence and decision proposal still requires owner resolution", () => {
  const orchestration = createAiOrchestration();
  const evaluation = orchestration.recordEvaluation({
    evaluationId: "evaluation-001",
    projectId: "product-alpha",
    target: { artifactId: "artifact-spec-001", artifactVersion: "v1" },
    verdict: "needs_revision",
    score: 72,
    confidence: 0.84,
    findings: [{ severity: "high", category: "missing_requirement", message: "یک معیار پذیرش ناقص است." }],
    actor: AGENT,
    idempotencyKey: "evaluation-once"
  });
  assert.equal(evaluation.evaluation.approvalBoundary, "evaluation-is-evidence-not-authorization");

  const proposed = orchestration.proposeDecision({
    decisionId: "decision-001",
    projectId: "product-alpha",
    requestedDecision: "owner-approval",
    options: [
      { optionId: "revise", title: "بازکاری مشخصات" },
      { optionId: "continue", title: "ادامه با ریسک ثبت‌شده" }
    ],
    recommendation: { optionId: "revise", rationale: "معیار پذیرش باید قبل از اجرا کامل شود." },
    confidence: 0.91,
    evidence: [{ evaluationId: "evaluation-001" }],
    actor: AGENT,
    idempotencyKey: "decision-proposal-once"
  });
  assert.equal(proposed.decision.state, "draft");
  assert.equal(proposed.decision.authorizationCreated, undefined);
  assert.throws(() => orchestration.resolveDecision({ decisionId: "decision-001", state: "approved", selectedOptionId: "revise", actor: AGENT, idempotencyKey: "decision-resolve-agent" }), /project owner/);
  const resolved = orchestration.resolveDecision({ decisionId: "decision-001", state: "approved", selectedOptionId: "revise", feedback: "با بازکاری موافقم.", actor: OWNER, idempotencyKey: "decision-resolve-owner" });
  assert.equal(resolved.decision.state, "approved");
  assert.equal(resolved.decision.authorizationCreated, false);
  assert.ok(orchestration.events().some(event => event.type === "ai.decision-resolved"));
});

test("completed evaluator output becomes linked evidence, while invalid recommendations fail closed", async () => {
  const orchestration = createAiOrchestration();
  orchestration.registerProvider({
    providerId: "anthropic",
    mode: "deterministic",
    displayName: "Deterministic evaluator adapter",
    adapter: createDeterministicAiProviderAdapter("anthropic", input => ({
      schema: input.outputSchema,
      verdict: "needs_revision",
      score: 68,
      confidence: 0.88,
      findings: [{ severity: "medium", category: "coverage", message: "یک سناریو پوشش داده نشده است." }]
    })),
    actor: OWNER,
    idempotencyKey: "provider-anthropic-evaluator-once"
  });
  orchestration.registerModel({ providerId: "anthropic", modelId: "default", actor: OWNER, idempotencyKey: "model-anthropic-evaluator-once" });
  orchestration.registerProfile({
    profileId: "evaluator-anthropic-deterministic-v1",
    role: "evaluator",
    providerId: "anthropic",
    modelId: "default",
    credentialRef: "runtime:anthropic-primary",
    promptVersion: "evaluator-prompt-v1",
    contextPolicy: "project-approved-context",
    toolPolicy: "read-only",
    outputSchema: "evaluation-v1",
    status: "active",
    actor: OWNER,
    idempotencyKey: "profile-anthropic-evaluator-once"
  });
  orchestration.bindRole({ bindingId: "binding-evaluator-deterministic-v1", projectId: "product-alpha", role: "evaluator", profileId: "evaluator-anthropic-deterministic-v1", actor: OWNER, idempotencyKey: "binding-evaluator-deterministic-once" });
  await orchestration.invoke({
    invocationId: "invocation-evaluator-deterministic-001",
    projectId: "product-alpha",
    role: "evaluator",
    contextSnapshotId: "context-evaluator-deterministic-001",
    request: "این Artifact را ارزیابی کن.",
    context: { artifactRef: "hero://artifacts/build-v1" },
    actor: AGENT,
    idempotencyKey: "invocation-evaluator-deterministic-once"
  });
  const evaluation = orchestration.evaluateInvocation({
    invocationId: "invocation-evaluator-deterministic-001",
    evaluationId: "evaluation-from-invocation-001",
    target: { artifactId: "artifact-build-001", artifactVersion: "v1" },
    actor: AGENT,
    idempotencyKey: "evaluation-from-invocation-once"
  });
  assert.equal(evaluation.evaluation.invocationId, "invocation-evaluator-deterministic-001");
  assert.equal(evaluation.evaluation.verdict, "needs_revision");

  assert.throws(() => orchestration.proposeDecision({
    decisionId: "decision-invalid-recommendation",
    projectId: "product-alpha",
    requestedDecision: "owner-approval",
    options: [{ optionId: "revise", title: "بازکاری" }],
    recommendation: { optionId: "missing", rationale: "این گزینه وجود ندارد." },
    actor: AGENT,
    idempotencyKey: "decision-invalid-recommendation-once"
  }), error => error instanceof AiOrchestrationError && error.code === "RECOMMENDATION_OPTION_NOT_FOUND");
});

test("AI invocation consumes an exact, role-filtered Project Memory context", async () => {
  const projectMemory = createProjectMemory();
  projectMemory.record({
    memoryId: "memory-analysis-001",
    projectId: "product-alpha",
    memoryKey: "product-scope",
    kind: "decision",
    scope: "task",
    status: "approved",
    content: "دامنهٔ نسخهٔ اول فقط شامل ورود و خروج کاربر است.",
    tags: ["scope", "version1"],
    recipientRoles: ["planner"],
    binding: { taskId: "task-analysis-003", stepId: "HERO-015", documentVersion: "v1.0" },
    source: { kind: "decision", reference: "hero://decisions/scope-v1", documentVersion: "v1.0" },
    actor: OWNER,
    idempotencyKey: "memory-analysis-001-once"
  });
  const orchestration = createAiOrchestration({ projectMemory });
  registerBase(orchestration);
  const result = await orchestration.invoke({
    invocationId: "invocation-analysis-context-001",
    projectId: "product-alpha",
    taskId: "task-analysis-003",
    stepId: "HERO-015",
    documentVersion: "v1.0",
    role: "analyst",
    contextSnapshotId: "context-analysis-003",
    request: "با توجه به حافظهٔ پروژه تحلیل کن.",
    context: { requestClass: "scope-review" },
    actor: AGENT,
    idempotencyKey: "invocation-analysis-context-once"
  });
  assert.equal(result.invocation.status, "completed");
  assert.equal(result.invocation.response.output.schema, "analysis-v1");

  const blocked = createAiOrchestration({ projectMemory });
  registerBase(blocked);
  await assert.rejects(
    () => blocked.invoke({
      invocationId: "invocation-analysis-stale-context",
      projectId: "product-alpha",
      taskId: "task-analysis-003",
      stepId: "HERO-015",
      documentVersion: "v2.0",
      role: "analyst",
      contextSnapshotId: "context-analysis-stale",
      request: "با حافظهٔ قدیمی تحلیل کن.",
      context: {},
      actor: AGENT,
      idempotencyKey: "invocation-analysis-stale-once"
    }),
    error => error instanceof AiOrchestrationError && error.code === "CONTEXT_ASSEMBLY_BLOCKED"
  );
});
