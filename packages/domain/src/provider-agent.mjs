import {
  PROVIDER_AGENT_IDS,
  PROVIDER_AGENT_MODES,
  PROVIDER_EXECUTION_STATES,
  getProviderAgentContractSummary
} from "../../contracts/src/provider-agent.mjs";
import { createAuthorizationEngine } from "./authorization-engine.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";
import { createInMemoryWorktreePort, createIsolatedRunnerEngine } from "./runner-engine.mjs";
import { createWorkflowEngine } from "./workflow-engine.mjs";

const OWNER = Object.freeze({ kind: "project-owner", id: "hero-owner" });
const ORCHESTRATOR = Object.freeze({ kind: "orchestrator", id: "hero-control-plane" });
const SENSITIVE_INPUT = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential)\s*[:=])/i;

function immutableCopy(value) {
  return Object.freeze(structuredClone(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return JSON.stringify(stableValue(value));
}

function assertIdentifier(label, value, maximum = 128) {
  if (typeof value !== "string" || value.length < 3 || value.length > maximum) {
    throw new Error(`${label} must be a 3-${maximum} character string.`);
  }
}

function assertPrompt(value) {
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > 2_000) {
    throw new Error("productRequest must be a 3-2000 character string.");
  }
  if (SENSITIVE_INPUT.test(value)) {
    throw new SensitiveProviderInputError();
  }
  return value.trim();
}

function assertProvider(provider, expected) {
  if (!provider || provider.provider !== expected || !PROVIDER_AGENT_IDS.includes(provider.provider)) {
    throw new Error(`Expected a ${expected} provider adapter.`);
  }
  if (!PROVIDER_AGENT_MODES.includes(provider.mode) || typeof provider.execute !== "function") {
    throw new Error(`${expected} provider adapter is invalid.`);
  }
}

function eventIdFactory(prefix) {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `${prefix}_${String(sequence).padStart(6, "0")}`;
  };
}

function safeArtifact(runId, kind) {
  return Object.freeze({
    kind,
    reference: `hero://artifacts/${encodeURIComponent(runId)}/${kind}.json`,
    external: false
  });
}

export class ProviderUnavailableError extends Error {
  constructor(provider) {
    super(`${provider} is disabled until separately configured.`);
    this.name = "ProviderUnavailableError";
    this.code = "PROVIDER_DISABLED";
    this.provider = provider;
  }
}

export class SensitiveProviderInputError extends Error {
  constructor() {
    super("Sensitive values are not accepted in provider task input.");
    this.name = "SensitiveProviderInputError";
    this.code = "SENSITIVE_INPUT_REJECTED";
  }
}

export function createDeterministicChatGptAdapter() {
  return Object.freeze({
    provider: "chatgpt",
    mode: "deterministic",
    execute(input) {
      const productRequest = assertPrompt(input?.productRequest);
      return immutableCopy({
        provider: "chatgpt",
        mode: "deterministic",
        analysis: {
          productIntent: productRequest,
          assumptions: [
            "The task is already authorized for development and testing.",
            "No credential, deployment, merge or external purchase is included.",
            "A provider adapter may return structured evidence only."
          ],
          task: {
            taskId: input.taskId,
            stepId: input.stepId,
            documentVersion: input.documentVersion,
            acceptanceCriteria: [
              "Return files, tests, errors and an artifact in a structured result.",
              "Keep the worktree and authorization boundaries intact."
            ]
          },
          artifact: safeArtifact(input.runId, "chatgpt-analysis")
        }
      });
    }
  });
}

export function createDeterministicCodexAdapter() {
  return Object.freeze({
    provider: "codex",
    mode: "deterministic",
    execute(input) {
      if (!input?.analysis?.analysis?.task) throw new Error("Codex requires a structured ChatGPT analysis.");
      if (!input?.workspace?.workspaceKey || !input?.workspace?.branchName) {
        throw new Error("Codex requires an isolated worktree reference.");
      }
      return immutableCopy({
        provider: "codex",
        mode: "deterministic",
        status: "completed",
        files: [],
        tests: { command: "deterministic-provider-check", total: 3, passed: 3, failed: 0, status: "passed" },
        errors: [],
        artifact: safeArtifact(input.runId, "codex-execution"),
        workspace: {
          workspaceKey: input.workspace.workspaceKey,
          branchName: input.workspace.branchName,
          isolated: true,
          actualRepositoryMutation: false
        },
        note: "Deterministic adapter only: no CLI, network, credentials or repository mutation was used."
      });
    }
  });
}

export function createDisabledProviderAdapter(provider) {
  if (!PROVIDER_AGENT_IDS.includes(provider)) throw new Error("Provider is not supported.");
  return Object.freeze({
    provider,
    mode: "disabled",
    execute() {
      throw new ProviderUnavailableError(provider);
    }
  });
}

export function createCodexChatGptPipeline(options = {}) {
  const chatgpt = options.chatgpt ?? createDeterministicChatGptAdapter();
  const codex = options.codex ?? createDeterministicCodexAdapter();
  assertProvider(chatgpt, "chatgpt");
  assertProvider(codex, "codex");
  const idempotency = new Map();

  function execute(input) {
    assertIdentifier("runId", input?.runId, 80);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    const productRequest = assertPrompt(input?.productRequest);
    const key = `${input.runId}\u0000${input.idempotencyKey}`;
    const commandFingerprint = fingerprint({
      taskId: input.taskId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      productRequest,
      workspace: input.workspace
    });
    const replay = idempotency.get(key);
    if (replay) {
      if (replay.fingerprint !== commandFingerprint) throw new Error("Provider pipeline idempotency key was already used with different input.");
      return immutableCopy({ ...replay.result, idempotent: true });
    }

    let analysis;
    let execution;
    try {
      analysis = chatgpt.execute({ ...input, productRequest });
      execution = codex.execute({ ...input, productRequest, analysis });
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError)) throw error;
      const blocked = immutableCopy({
        runId: input.runId,
        taskId: input.taskId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        status: "blocked",
        code: error.code,
        analysis: analysis ?? null,
        execution: null,
        result: { files: [], tests: null, errors: [{ code: error.code, provider: error.provider }], artifact: null },
        idempotent: false
      });
      idempotency.set(key, { fingerprint: commandFingerprint, result: blocked });
      return blocked;
    }

    if (!PROVIDER_EXECUTION_STATES.includes(execution.status)) throw new Error("Codex result state is invalid.");
    const result = immutableCopy({
      runId: input.runId,
      taskId: input.taskId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      status: execution.status,
      code: execution.status === "completed" ? "COMPLETED" : "BLOCKED",
      analysis,
      execution,
      result: {
        files: execution.files,
        tests: execution.tests,
        errors: execution.errors,
        artifact: execution.artifact
      },
      idempotent: false
    });
    idempotency.set(key, { fingerprint: commandFingerprint, result });
    return result;
  }

  return Object.freeze({
    execute,
    contract: () => getProviderAgentContractSummary()
  });
}

export function createCodexChatGptHarness(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const authorization = options.authorizationEngine ?? createAuthorizationEngine({
    eventLog,
    now,
    eventIdFactory: eventIdFactory("evt_provider_authorization")
  });
  const workflow = options.workflowEngine ?? createWorkflowEngine({
    eventLog,
    now,
    eventIdFactory: eventIdFactory("evt_provider_workflow")
  });
  const runner = options.runnerEngine ?? createIsolatedRunnerEngine({
    eventLog,
    now,
    eventIdFactory: eventIdFactory("evt_provider_runner"),
    worktreePort: options.worktreePort ?? createInMemoryWorktreePort()
  });
  const pipeline = options.pipeline ?? createCodexChatGptPipeline();

  function run(input) {
    assertIdentifier("runId", input?.runId, 80);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion);
    const productRequest = assertPrompt(input?.productRequest);
    const authorizationId = `AUTH-PROVIDER-${input.runId}`;
    authorization.grant({
      authorizationId,
      mode: "direct",
      entries: [{ stepId: input.stepId, documentVersion: input.documentVersion }],
      operations: ["develop", "test", "review"],
      actor: OWNER,
      idempotencyKey: `provider-${input.runId}-grant`,
      note: "provider adapter harness only"
    });
    const dispatch = authorization.evaluateDispatch({
      authorizationId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      operation: "develop",
      actor: ORCHESTRATOR,
      idempotencyKey: `provider-${input.runId}-dispatch`
    });
    if (!dispatch.decision.authorized) throw new Error(`Provider dispatch was blocked: ${dispatch.decision.code}.`);

    workflow.create({ runId: input.runId, taskId: input.taskId, actor: ORCHESTRATOR, idempotencyKey: `provider-${input.runId}-create` });
    for (const action of ["plan", "queue", "start"]) {
      workflow.apply({ runId: input.runId, action, actor: ORCHESTRATOR, idempotencyKey: `provider-${input.runId}-${action}` });
    }

    const runnerId = `${input.runId}-CODEX-001`;
    const prepared = runner.prepare({
      runnerId,
      runId: input.runId,
      taskId: input.taskId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      decision: dispatch.decision,
      workspaceKey: `.hero/worktrees/${runnerId.toLowerCase()}`,
      branchName: `hero/task/${runnerId.toLowerCase()}`,
      baseRef: "main",
      actor: ORCHESTRATOR,
      idempotencyKey: `provider-${input.runId}-prepare`
    });
    runner.start({
      runnerId,
      decision: dispatch.decision,
      actor: ORCHESTRATOR,
      idempotencyKey: `provider-${input.runId}-start`
    });
    const structuredResult = pipeline.execute({
      runId: input.runId,
      taskId: input.taskId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      productRequest,
      workspace: { workspaceKey: prepared.runner.workspaceKey, branchName: prepared.runner.branchName },
      idempotencyKey: `provider-${input.runId}-pipeline`
    });

    if (structuredResult.status !== "completed") {
      runner.fail({ runnerId, reason: structuredResult.code, actor: ORCHESTRATOR, idempotencyKey: `provider-${input.runId}-fail` });
      const cleaned = runner.cleanup({ runnerId, actor: ORCHESTRATOR, idempotencyKey: `provider-${input.runId}-cleanup` });
      const failed = workflow.apply({ runId: input.runId, action: "fail", actor: ORCHESTRATOR, reason: structuredResult.code, idempotencyKey: `provider-${input.runId}-workflow-fail` });
      return immutableCopy({ status: "blocked", dispatch: dispatch.decision, workflow: failed.workflow, runner: cleaned.runner, structuredResult, events: eventLog.readAfter() });
    }

    runner.requestCheckpoint({ runnerId, reason: "provider-result-recorded", actor: ORCHESTRATOR, idempotencyKey: `provider-${input.runId}-checkpoint-requested` });
    runner.checkpoint({ runnerId, checkpointId: `CHECKPOINT-${runnerId}`, summary: "provider analysis and execution evidence recorded", actor: ORCHESTRATOR, idempotencyKey: `provider-${input.runId}-checkpointed` });
    const cleaned = runner.cleanup({ runnerId, actor: ORCHESTRATOR, idempotencyKey: `provider-${input.runId}-cleanup` });
    workflow.apply({ runId: input.runId, action: "request-review", actor: ORCHESTRATOR, idempotencyKey: `provider-${input.runId}-review` });
    const completed = workflow.apply({ runId: input.runId, action: "approve-review", actor: OWNER, reason: "deterministic-provider-evidence", idempotencyKey: `provider-${input.runId}-approve` });
    return immutableCopy({ status: "completed", dispatch: dispatch.decision, workflow: completed.workflow, runner: cleaned.runner, structuredResult, events: eventLog.readAfter() });
  }

  return Object.freeze({
    run,
    contract: () => getProviderAgentContractSummary(),
    services: () => Object.freeze({ authorization, workflow, runner, pipeline, eventLog })
  });
}
