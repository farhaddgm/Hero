import {
  CLAUDE_REVIEW_CATEGORIES,
  CLAUDE_REVIEW_FINDING_FIELDS,
  CLAUDE_REVIEW_MODES,
  CLAUDE_REVIEW_OUTCOMES,
  CLAUDE_REVIEW_PROVIDER,
  CLAUDE_REVIEW_SEVERITIES,
  getClaudeReviewContractSummary
} from "../../contracts/src/claude-review.mjs";
import { createAuthorizationEngine } from "./authorization-engine.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

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

function assertSafeEvidence(value) {
  const serialized = JSON.stringify(value);
  if (SENSITIVE_INPUT.test(serialized)) throw new SensitiveClaudeReviewInputError();
}

function assertExecutionEvidence(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("executionEvidence must be a structured object.");
  }
  if (value.provider !== "codex") throw new Error("Claude review requires Codex execution evidence.");
  if (typeof value.status !== "string") throw new Error("executionEvidence.status is required.");
  if (!Array.isArray(value.files)) throw new Error("executionEvidence.files must be an array.");
  if (!Array.isArray(value.errors)) throw new Error("executionEvidence.errors must be an array.");
  if (value.tests !== null && (!value.tests || typeof value.tests !== "object" || Array.isArray(value.tests))) {
    throw new Error("executionEvidence.tests must be an object or null.");
  }
  if (!value.workspace || typeof value.workspace !== "object" || Array.isArray(value.workspace)) {
    throw new Error("executionEvidence.workspace is required.");
  }
  assertSafeEvidence(value);
  return immutableCopy(value);
}

function assertReviewer(reviewer) {
  if (!reviewer || reviewer.provider !== CLAUDE_REVIEW_PROVIDER || !CLAUDE_REVIEW_MODES.includes(reviewer.mode) || typeof reviewer.review !== "function") {
    throw new Error("Claude reviewer adapter is invalid.");
  }
}

function safeArtifact(runId) {
  return Object.freeze({
    kind: "claude-review",
    reference: `hero://artifacts/${encodeURIComponent(runId)}/claude-review.json`,
    external: false
  });
}

function finding(id, category, severity, reference, problem, recommendedAction) {
  return Object.freeze({ id, category, severity, reference, problem, recommendedAction });
}

function eventIdFactory(prefix) {
  let sequence = 0;
  return () => `${prefix}_${String(++sequence).padStart(6, "0")}`;
}

export class ClaudeReviewUnavailableError extends Error {
  constructor() {
    super("Claude review is disabled until separately configured.");
    this.name = "ClaudeReviewUnavailableError";
    this.code = "CLAUDE_REVIEW_DISABLED";
  }
}

export class SensitiveClaudeReviewInputError extends Error {
  constructor() {
    super("Sensitive values are not accepted in Claude review evidence.");
    this.name = "SensitiveClaudeReviewInputError";
    this.code = "SENSITIVE_INPUT_REJECTED";
  }
}

export function createDeterministicClaudeReviewer() {
  return Object.freeze({
    provider: CLAUDE_REVIEW_PROVIDER,
    mode: "deterministic",
    review(input) {
      const evidence = assertExecutionEvidence(input?.executionEvidence);
      const findings = [];
      if (evidence.workspace.isolated !== true) {
        findings.push(finding(
          "CLAUDE-ARCH-001",
          "architecture",
          "high",
          "executionEvidence.workspace.isolated",
          "Execution evidence does not prove an isolated workspace boundary.",
          "Stop integration and rerun the task in an authorized isolated worktree."
        ));
      }
      if (evidence.workspace.actualRepositoryMutation === true) {
        findings.push(finding(
          "CLAUDE-SEC-001",
          "security",
          "critical",
          "executionEvidence.workspace.actualRepositoryMutation",
          "The reviewer received evidence of a repository mutation outside the deterministic safety boundary.",
          "Create a separate authorized investigation task before accepting or changing repository state."
        ));
      }
      if (evidence.artifact?.external === true) {
        findings.push(finding(
          "CLAUDE-SEC-002",
          "security",
          "high",
          "executionEvidence.artifact.external",
          "Execution evidence points to an external artifact outside the local control plane.",
          "Keep the artifact internal or request an explicitly authorized external integration."
        ));
      }
      if (evidence.status !== "completed") {
        findings.push(finding(
          "CLAUDE-TEST-001",
          "tests",
          "high",
          "executionEvidence.status",
          "Execution did not complete, so its test evidence cannot be accepted.",
          "Resolve the execution block in a separately authorized task and produce a new review input."
        ));
      }
      if (evidence.errors.length > 0) {
        findings.push(finding(
          "CLAUDE-EDGE-001",
          "edge-case",
          "medium",
          "executionEvidence.errors",
          "Execution reported errors that have not been dispositioned.",
          "Classify each error and verify the affected edge case in a separately authorized correction task."
        ));
      }
      if (!evidence.tests || evidence.tests.status !== "passed" || evidence.tests.failed > 0) {
        findings.push(finding(
          "CLAUDE-TEST-002",
          "tests",
          "high",
          "executionEvidence.tests",
          "The test result is absent, failed or not explicitly passed.",
          "Run the required test suite and submit new structured evidence for review."
        ));
      }
      const approved = findings.length === 0;
      return immutableCopy({
        provider: CLAUDE_REVIEW_PROVIDER,
        mode: "deterministic",
        reviewId: `REVIEW-${input.runId}`,
        status: approved ? "approved" : "changes-requested",
        approved,
        categories: CLAUDE_REVIEW_CATEGORIES,
        findingFields: CLAUDE_REVIEW_FINDING_FIELDS,
        findings,
        reviewedEvidence: {
          files: evidence.files.length,
          errors: evidence.errors.length,
          tests: evidence.tests,
          isolatedWorkspace: evidence.workspace.isolated === true
        },
        artifact: safeArtifact(input.runId),
        boundary: {
          actualProviderCall: false,
          actualRepositoryMutation: false,
          directFixesAllowed: false,
          correctionRequiresSeparateAuthorizedTask: true
        },
        note: "Deterministic reviewer only: no Claude CLI, network, credentials, repository mutation or external spend was used."
      });
    }
  });
}

export function createDisabledClaudeReviewer() {
  return Object.freeze({
    provider: CLAUDE_REVIEW_PROVIDER,
    mode: "disabled",
    review() {
      throw new ClaudeReviewUnavailableError();
    }
  });
}

export function createClaudeReviewPipeline(options = {}) {
  const reviewer = options.reviewer ?? createDeterministicClaudeReviewer();
  assertReviewer(reviewer);
  const idempotency = new Map();

  function review(input) {
    assertIdentifier("runId", input?.runId, 80);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    const executionEvidence = assertExecutionEvidence(input?.executionEvidence);
    const key = `${input.runId}\u0000${input.idempotencyKey}`;
    const commandFingerprint = fingerprint({
      taskId: input.taskId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      executionEvidence
    });
    const replay = idempotency.get(key);
    if (replay) {
      if (replay.fingerprint !== commandFingerprint) throw new Error("Claude review idempotency key was already used with different input.");
      return immutableCopy({ ...replay.result, idempotent: true });
    }

    let result;
    try {
      const reviewResult = reviewer.review({ ...input, executionEvidence });
      if (!CLAUDE_REVIEW_OUTCOMES.includes(reviewResult.status) || reviewResult.status === "blocked") {
        throw new Error("Claude reviewer returned an invalid outcome.");
      }
      result = immutableCopy({
        runId: input.runId,
        taskId: input.taskId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        status: reviewResult.status,
        code: reviewResult.approved ? "REVIEW_APPROVED" : "CHANGES_REQUESTED",
        review: reviewResult,
        idempotent: false
      });
    } catch (error) {
      if (!(error instanceof ClaudeReviewUnavailableError)) throw error;
      result = immutableCopy({
        runId: input.runId,
        taskId: input.taskId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        status: "blocked",
        code: error.code,
        review: {
          provider: CLAUDE_REVIEW_PROVIDER,
          mode: "disabled",
          approved: false,
          findings: [],
          artifact: null,
          boundary: { directFixesAllowed: false, correctionRequiresSeparateAuthorizedTask: true }
        },
        idempotent: false
      });
    }
    idempotency.set(key, { fingerprint: commandFingerprint, result });
    return result;
  }

  return Object.freeze({
    review,
    contract: () => getClaudeReviewContractSummary()
  });
}

export function createClaudeReviewHarness(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const authorization = options.authorizationEngine ?? createAuthorizationEngine({
    eventLog,
    now,
    eventIdFactory: eventIdFactory("evt_claude_review_authorization")
  });
  const pipeline = options.pipeline ?? createClaudeReviewPipeline();

  function run(input) {
    assertIdentifier("runId", input?.runId, 80);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion);
    const executionEvidence = assertExecutionEvidence(input?.executionEvidence);
    const authorizationId = `AUTH-CLAUDE-REVIEW-${input.runId}`;
    authorization.grant({
      authorizationId,
      mode: "direct",
      entries: [{ stepId: input.stepId, documentVersion: input.documentVersion }],
      operations: ["review"],
      actor: OWNER,
      idempotencyKey: `claude-review-${input.runId}-grant`,
      note: "deterministic Claude review harness only"
    });
    const dispatch = authorization.evaluateDispatch({
      authorizationId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      operation: "review",
      actor: ORCHESTRATOR,
      idempotencyKey: `claude-review-${input.runId}-dispatch`
    });
    if (!dispatch.decision.authorized) throw new Error(`Claude review dispatch was blocked: ${dispatch.decision.code}.`);
    const review = pipeline.review({
      runId: input.runId,
      taskId: input.taskId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      executionEvidence,
      idempotencyKey: `claude-review-${input.runId}-pipeline`
    });
    return immutableCopy({
      status: review.status,
      dispatch: dispatch.decision,
      review,
      events: eventLog.readAfter()
    });
  }

  return Object.freeze({
    run,
    contract: () => getClaudeReviewContractSummary(),
    services: () => Object.freeze({ authorization, pipeline, eventLog })
  });
}
