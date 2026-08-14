import {
  FAKE_AGENT_SCENARIOS,
  getFakeAgentContractSummary
} from "../../contracts/src/fake-agent.mjs";
import { createAuthorizationEngine } from "./authorization-engine.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";
import { createInMemoryWorktreePort, createIsolatedRunnerEngine } from "./runner-engine.mjs";
import { createWorkflowEngine } from "./workflow-engine.mjs";

const OWNER = Object.freeze({ kind: "project-owner", id: "hero-owner" });
const ORCHESTRATOR = Object.freeze({ kind: "orchestrator", id: "hero-control-plane" });

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

function assertScenario(value) {
  if (!FAKE_AGENT_SCENARIOS.includes(value)) {
    throw new Error(`scenario must be one of: ${FAKE_AGENT_SCENARIOS.join(", ")}.`);
  }
}

function assertAttempt(value) {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error("attempt must be an integer between 1 and 10.");
  }
}

function scenarioResult(scenario, attempt) {
  if (scenario === "review-changes" && attempt === 1) {
    return Object.freeze({
      outcome: "review-changes-requested",
      checkpointReason: "review-changes-requested",
      checkpoints: ["analysis-complete", "implementation-complete", "review-feedback-recorded"],
      tests: Object.freeze({ total: 3, passed: 3, failed: 0 })
    });
  }
  if (scenario === "failure-then-retry" && attempt === 1) {
    return Object.freeze({
      outcome: "failed",
      checkpointReason: null,
      checkpoints: ["analysis-complete", "implementation-failed"],
      tests: Object.freeze({ total: 3, passed: 2, failed: 1 })
    });
  }
  if (scenario === "pause-resume" && attempt === 1) {
    return Object.freeze({
      outcome: "checkpoint-ready",
      checkpointReason: "owner-pause-requested",
      checkpoints: ["analysis-complete", "safe-checkpoint-recorded"],
      tests: Object.freeze({ total: 2, passed: 2, failed: 0 })
    });
  }
  return Object.freeze({
    outcome: "completed",
    checkpointReason: "completed-for-review",
    checkpoints: ["analysis-complete", "implementation-complete", "tests-passed"],
    tests: Object.freeze({ total: 3, passed: 3, failed: 0 })
  });
}

export class FakeAgentIdempotencyConflictError extends Error {
  constructor({ runId, idempotencyKey }) {
    super(`Fake agent idempotency key ${idempotencyKey} was already used with different input for ${runId}.`);
    this.name = "FakeAgentIdempotencyConflictError";
  }
}

export function createDeterministicFakeAgent(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const idempotency = new Map();

  function execute(input) {
    assertIdentifier("runId", input?.runId, 80);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertScenario(input?.scenario);
    assertAttempt(input?.attempt);

    const key = `${input.runId}\u0000${input.idempotencyKey}`;
    const inputFingerprint = fingerprint({
      taskId: input.taskId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      scenario: input.scenario,
      attempt: input.attempt
    });
    const replay = idempotency.get(key);
    if (replay) {
      if (replay.fingerprint !== inputFingerprint) {
        throw new FakeAgentIdempotencyConflictError({ runId: input.runId, idempotencyKey: input.idempotencyKey });
      }
      return immutableCopy({ ...replay.result, idempotent: true });
    }

    const script = scenarioResult(input.scenario, input.attempt);
    const result = immutableCopy({
      agent: "hero-deterministic-fake",
      contractVersion: getFakeAgentContractSummary().version,
      runId: input.runId,
      taskId: input.taskId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      scenario: input.scenario,
      attempt: input.attempt,
      executedAt: input.occurredAt ?? now(),
      ...script,
      idempotent: false
    });
    idempotency.set(key, { fingerprint: inputFingerprint, result });
    return result;
  }

  return Object.freeze({ execute, contract: () => getFakeAgentContractSummary() });
}

function eventIdFactory(prefix) {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `${prefix}_${String(sequence).padStart(6, "0")}`;
  };
}

function checkpointAndClean({ runner, runnerId, idempotencyPrefix, reason, summary }) {
  runner.requestCheckpoint({
    runnerId,
    reason,
    actor: ORCHESTRATOR,
    idempotencyKey: `${idempotencyPrefix}-checkpoint-requested`
  });
  runner.checkpoint({
    runnerId,
    checkpointId: `CHECKPOINT-${runnerId}`,
    summary,
    actor: ORCHESTRATOR,
    idempotencyKey: `${idempotencyPrefix}-checkpointed`
  });
  return runner.cleanup({
    runnerId,
    actor: ORCHESTRATOR,
    idempotencyKey: `${idempotencyPrefix}-cleanup`
  });
}

export function createFakeOrchestrationHarness(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const authorization = options.authorizationEngine ?? createAuthorizationEngine({
    eventLog,
    now,
    eventIdFactory: eventIdFactory("evt_fake_authorization")
  });
  const workflow = options.workflowEngine ?? createWorkflowEngine({
    eventLog,
    now,
    eventIdFactory: eventIdFactory("evt_fake_workflow")
  });
  const runner = options.runnerEngine ?? createIsolatedRunnerEngine({
    eventLog,
    now,
    eventIdFactory: eventIdFactory("evt_fake_runner"),
    worktreePort: options.worktreePort ?? createInMemoryWorktreePort()
  });
  const agent = options.agent ?? createDeterministicFakeAgent({ now });

  function startRunnerAttempt({ runId, taskId, stepId, documentVersion, decision, attempt }) {
    const runnerId = `${runId}-ATTEMPT-${attempt}`;
    const idempotencyPrefix = `fake-${runId}-attempt-${attempt}`;
    runner.prepare({
      runnerId,
      runId,
      taskId,
      stepId,
      documentVersion,
      decision,
      workspaceKey: `.hero/worktrees/${runnerId.toLowerCase()}`,
      branchName: `hero/task/${runnerId.toLowerCase()}`,
      baseRef: "main",
      actor: ORCHESTRATOR,
      idempotencyKey: `${idempotencyPrefix}-prepare`
    });
    runner.start({
      runnerId,
      decision,
      actor: ORCHESTRATOR,
      idempotencyKey: `${idempotencyPrefix}-start`
    });
    return Object.freeze({ runnerId, idempotencyPrefix });
  }

  function run(input) {
    assertIdentifier("runId", input?.runId, 80);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion);
    assertScenario(input?.scenario);

    const authorizationId = `AUTH-FAKE-${input.runId}`;
    authorization.grant({
      authorizationId,
      mode: "direct",
      entries: [{ stepId: input.stepId, documentVersion: input.documentVersion }],
      operations: ["develop", "test", "review"],
      actor: OWNER,
      idempotencyKey: `fake-${input.runId}-grant`,
      note: "deterministic fake agent test only"
    });
    const dispatch = authorization.evaluateDispatch({
      authorizationId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      operation: "develop",
      actor: ORCHESTRATOR,
      idempotencyKey: `fake-${input.runId}-dispatch`
    });
    if (!dispatch.decision.authorized) throw new Error(`Fake harness dispatch was blocked: ${dispatch.decision.code}.`);

    workflow.create({
      runId: input.runId,
      taskId: input.taskId,
      actor: ORCHESTRATOR,
      idempotencyKey: `fake-${input.runId}-create`
    });
    for (const action of ["plan", "queue", "start"]) {
      workflow.apply({
        runId: input.runId,
        action,
        actor: ORCHESTRATOR,
        idempotencyKey: `fake-${input.runId}-${action}`
      });
    }

    const attempts = [];
    let attempt = 1;
    let current = startRunnerAttempt({
      runId: input.runId,
      taskId: input.taskId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      decision: dispatch.decision,
      attempt
    });

    while (true) {
      const agentResult = agent.execute({
        runId: input.runId,
        taskId: input.taskId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        scenario: input.scenario,
        attempt,
        idempotencyKey: `fake-${input.runId}-agent-${attempt}`
      });
      attempts.push(agentResult);

      if (agentResult.outcome === "failed") {
        runner.fail({
          runnerId: current.runnerId,
          reason: "fake-agent-failure",
          actor: ORCHESTRATOR,
          idempotencyKey: `${current.idempotencyPrefix}-fail`
        });
        runner.cleanup({
          runnerId: current.runnerId,
          actor: ORCHESTRATOR,
          idempotencyKey: `${current.idempotencyPrefix}-cleanup`
        });
        workflow.apply({
          runId: input.runId,
          action: "fail",
          actor: ORCHESTRATOR,
          reason: "fake-agent-failure",
          idempotencyKey: `fake-${input.runId}-workflow-fail`
        });
        workflow.apply({
          runId: input.runId,
          action: "retry",
          actor: OWNER,
          reason: "deterministic-retry",
          idempotencyKey: `fake-${input.runId}-workflow-retry`
        });
        workflow.apply({
          runId: input.runId,
          action: "start",
          actor: ORCHESTRATOR,
          idempotencyKey: `fake-${input.runId}-workflow-retry-start`
        });
      } else if (agentResult.outcome === "review-changes-requested") {
        checkpointAndClean({
          runner,
          runnerId: current.runnerId,
          idempotencyPrefix: current.idempotencyPrefix,
          reason: agentResult.checkpointReason,
          summary: "deterministic review feedback is ready"
        });
        workflow.apply({
          runId: input.runId,
          action: "request-review",
          actor: ORCHESTRATOR,
          idempotencyKey: `fake-${input.runId}-workflow-review-request`
        });
        workflow.apply({
          runId: input.runId,
          action: "request-changes",
          actor: OWNER,
          reason: "deterministic-review-feedback",
          idempotencyKey: `fake-${input.runId}-workflow-review-changes`
        });
      } else if (agentResult.outcome === "checkpoint-ready") {
        checkpointAndClean({
          runner,
          runnerId: current.runnerId,
          idempotencyPrefix: current.idempotencyPrefix,
          reason: agentResult.checkpointReason,
          summary: "deterministic pause checkpoint is ready"
        });
        workflow.apply({
          runId: input.runId,
          action: "pause",
          actor: OWNER,
          reason: "deterministic-pause",
          idempotencyKey: `fake-${input.runId}-workflow-pause`
        });
        workflow.apply({
          runId: input.runId,
          action: "resume",
          actor: OWNER,
          reason: "deterministic-resume",
          idempotencyKey: `fake-${input.runId}-workflow-resume`
        });
      } else {
        checkpointAndClean({
          runner,
          runnerId: current.runnerId,
          idempotencyPrefix: current.idempotencyPrefix,
          reason: agentResult.checkpointReason,
          summary: "deterministic implementation and tests are complete"
        });
        workflow.apply({
          runId: input.runId,
          action: "request-review",
          actor: ORCHESTRATOR,
          idempotencyKey: `fake-${input.runId}-workflow-final-review`
        });
        const completed = workflow.apply({
          runId: input.runId,
          action: "approve-review",
          actor: OWNER,
          reason: "deterministic-approval",
          idempotencyKey: `fake-${input.runId}-workflow-approval`
        });
        return immutableCopy({
          scenario: input.scenario,
          status: "completed",
          authorization: authorization.get(authorizationId),
          dispatch: dispatch.decision,
          workflow: completed.workflow,
          attempts,
          runners: attempts.map((_, index) => runner.get(`${input.runId}-ATTEMPT-${index + 1}`)),
          events: eventLog.readAfter()
        });
      }

      attempt += 1;
      current = startRunnerAttempt({
        runId: input.runId,
        taskId: input.taskId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        decision: dispatch.decision,
        attempt
      });
    }
  }

  return Object.freeze({
    run,
    contract: () => getFakeAgentContractSummary(),
    services: () => Object.freeze({ authorization, workflow, runner, agent, eventLog })
  });
}
