import {
  CLAUDE_REVIEW_PROVIDER,
  CURSOR_HANDOFF_MODES,
  CURSOR_HANDOFF_PROVIDER,
  CURSOR_HANDOFF_STATES,
  getCursorHandoffContractSummary
} from "../../contracts/src/index.mjs";
import { createAuthorizationEngine } from "./authorization-engine.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const OWNER = Object.freeze({ kind: "project-owner", id: "hero-owner" });
const ORCHESTRATOR = Object.freeze({ kind: "orchestrator", id: "hero-control-plane" });
const SENSITIVE_INPUT = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential)\s*[:=])/i;
const ABSOLUTE_HOST_PATH = /^(?:[A-Za-z]:[\\/]|[\\/]{1,2}|~[\\/])/;

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

function assertSafeValue(value) {
  if (SENSITIVE_INPUT.test(JSON.stringify(value))) throw new SensitiveCursorHandoffInputError();
}

function assertPortableReference(label, value) {
  const segments = typeof value === "string" ? value.split("/") : [];
  if (
    typeof value !== "string" ||
    value.length < 2 ||
    value.length > 256 ||
    ABSOLUTE_HOST_PATH.test(value) ||
    value.includes("\\") ||
    segments.some(segment => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new CursorHandoffSafetyError(`${label} must be a portable relative reference.`);
  }
}

function assertFileReferences(files) {
  if (!Array.isArray(files)) throw new Error("executionEvidence.files must be an array.");
  for (const file of files) assertPortableReference("executionEvidence.files entry", file);
}

function assertExecutionEvidence(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("executionEvidence must be a structured object.");
  }
  assertSafeValue(value);
  if (value.provider !== "codex") throw new Error("Cursor handoff requires Codex execution evidence.");
  if (value.taskId !== expected.taskId || value.stepId !== expected.stepId || value.documentVersion !== expected.documentVersion) {
    throw new CursorHandoffSafetyError("Codex execution evidence does not match the handoff Task or document version.");
  }
  if (value.status !== "completed") throw new CursorHandoffSafetyError("Cursor handoff requires completed Codex execution evidence.");
  assertFileReferences(value.files);
  if (!Array.isArray(value.errors) || value.errors.length > 0) {
    throw new CursorHandoffSafetyError("Cursor handoff requires execution evidence without unresolved errors.");
  }
  if (!value.tests || typeof value.tests !== "object" || value.tests.status !== "passed" || value.tests.failed > 0) {
    throw new CursorHandoffSafetyError("Cursor handoff requires explicitly passed test evidence.");
  }
  if (!value.artifact || value.artifact.external !== false || typeof value.artifact.reference !== "string" || !value.artifact.reference.startsWith("hero://artifacts/")) {
    throw new CursorHandoffSafetyError("Cursor handoff requires an internal Codex artifact reference.");
  }
  if (!value.workspace || typeof value.workspace !== "object" || value.workspace.isolated !== true || value.workspace.actualRepositoryMutation !== false) {
    throw new CursorHandoffSafetyError("Cursor handoff requires isolated, non-mutating workspace evidence.");
  }
  assertPortableReference("executionEvidence.workspace.workspaceKey", value.workspace.workspaceKey);
  assertPortableReference("executionEvidence.workspace.branchName", value.workspace.branchName);
  return immutableCopy(value);
}

function assertReviewEvidence(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("reviewEvidence must be a structured object.");
  }
  assertSafeValue(value);
  if (value.provider !== CLAUDE_REVIEW_PROVIDER) throw new Error("Cursor handoff requires Claude review evidence.");
  if (value.taskId !== expected.taskId || value.stepId !== expected.stepId || value.documentVersion !== expected.documentVersion) {
    throw new CursorHandoffSafetyError("Claude review evidence does not match the handoff Task or document version.");
  }
  if (!Array.isArray(value.findings) || typeof value.approved !== "boolean") {
    throw new Error("reviewEvidence.findings and reviewEvidence.approved are required.");
  }
  if (!['approved', 'changes-requested', 'blocked'].includes(value.status)) {
    throw new Error("reviewEvidence.status is invalid.");
  }
  if ((value.status === "approved") !== value.approved || (value.approved && value.findings.length > 0)) {
    throw new CursorHandoffSafetyError("Claude review approval state is internally inconsistent.");
  }
  return immutableCopy(value);
}

function assertAdapter(adapter) {
  if (!adapter || adapter.provider !== CURSOR_HANDOFF_PROVIDER || !CURSOR_HANDOFF_MODES.includes(adapter.mode) || typeof adapter.prepare !== "function") {
    throw new Error("Cursor handoff adapter is invalid.");
  }
}

function safeArtifact(runId) {
  return Object.freeze({
    kind: "cursor-handoff",
    reference: `hero://artifacts/${encodeURIComponent(runId)}/cursor-handoff.json`,
    external: false
  });
}

function eventIdFactory(prefix) {
  let sequence = 0;
  return () => `${prefix}_${String(++sequence).padStart(6, "0")}`;
}

function commands() {
  return Object.freeze([
    Object.freeze({ id: "inspect-status", command: "git status --short", purpose: "Inspect the isolated branch state.", executed: false, requiresExplicitHumanConfirmation: true }),
    Object.freeze({ id: "inspect-diff", command: "git diff --stat", purpose: "Inspect the proposed change footprint.", executed: false, requiresExplicitHumanConfirmation: true }),
    Object.freeze({ id: "verify", command: "pnpm check", purpose: "Re-run the required project checks before any separately approved next action.", executed: false, requiresExplicitHumanConfirmation: true })
  ]);
}

function handoffStatus(review) {
  if (review.status === "approved" && review.approved) return { status: "ready", code: "HANDOFF_READY" };
  if (review.status === "changes-requested") return { status: "blocked", code: "CLAUDE_CHANGES_REQUESTED" };
  return { status: "blocked", code: "CLAUDE_REVIEW_BLOCKED" };
}

export class CursorHandoffUnavailableError extends Error {
  constructor() {
    super("Cursor handoff is disabled until separately configured.");
    this.name = "CursorHandoffUnavailableError";
    this.code = "CURSOR_HANDOFF_DISABLED";
  }
}

export class SensitiveCursorHandoffInputError extends Error {
  constructor() {
    super("Sensitive values are not accepted in Cursor handoff evidence.");
    this.name = "SensitiveCursorHandoffInputError";
    this.code = "SENSITIVE_INPUT_REJECTED";
  }
}

export class CursorHandoffSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "CursorHandoffSafetyError";
    this.code = "CURSOR_HANDOFF_SAFETY_BLOCK";
  }
}

export function createDeterministicCursorHandoffAdapter() {
  return Object.freeze({
    provider: CURSOR_HANDOFF_PROVIDER,
    mode: "deterministic",
    prepare(input) {
      const executionEvidence = assertExecutionEvidence(input?.executionEvidence, input);
      const reviewEvidence = assertReviewEvidence(input?.reviewEvidence, input);
      const decision = handoffStatus(reviewEvidence);
      return immutableCopy({
        provider: CURSOR_HANDOFF_PROVIDER,
        mode: "deterministic",
        handoffId: `CURSOR-HANDOFF-${input.runId}`,
        status: decision.status,
        code: decision.code,
        context: {
          task: { taskId: input.taskId, stepId: input.stepId, documentVersion: input.documentVersion },
          execution: { files: executionEvidence.files, tests: executionEvidence.tests, artifact: executionEvidence.artifact ?? null },
          review: { status: reviewEvidence.status, approved: reviewEvidence.approved, findings: reviewEvidence.findings }
        },
        workspace: {
          workspaceKey: executionEvidence.workspace.workspaceKey,
          branchName: executionEvidence.workspace.branchName,
          portable: true,
          absoluteHostPathsIncluded: false
        },
        commands: decision.status === "ready" ? commands() : [],
        continuation: {
          canContinueInCursor: decision.status === "ready",
          blockedReason: decision.status === "ready" ? null : decision.code,
          nextAction: decision.status === "ready" ? "Human may inspect this package in Cursor." : "Create a separately authorized correction Task from the Claude findings."
        },
        artifact: safeArtifact(input.runId),
        boundary: {
          actualCursorInvocation: false,
          actualRepositoryMutation: false,
          actualCommandExecution: false,
          hostPathsAllowed: false,
          codeChangesAllowed: false,
          mergePushSecretsSpendRequireSeparateApproval: true
        },
        note: "Deterministic handoff only: no Cursor CLI, API, network, credential, command execution or repository mutation was used."
      });
    }
  });
}

export function createDisabledCursorHandoffAdapter() {
  return Object.freeze({
    provider: CURSOR_HANDOFF_PROVIDER,
    mode: "disabled",
    prepare() {
      throw new CursorHandoffUnavailableError();
    }
  });
}

export function createCursorHandoffPipeline(options = {}) {
  const adapter = options.adapter ?? createDeterministicCursorHandoffAdapter();
  assertAdapter(adapter);
  const idempotency = new Map();

  function prepare(input) {
    assertIdentifier("runId", input?.runId, 80);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    const executionEvidence = assertExecutionEvidence(input?.executionEvidence, input);
    const reviewEvidence = assertReviewEvidence(input?.reviewEvidence, input);
    const key = `${input.runId}\u0000${input.idempotencyKey}`;
    const commandFingerprint = fingerprint({ taskId: input.taskId, stepId: input.stepId, documentVersion: input.documentVersion, executionEvidence, reviewEvidence });
    const replay = idempotency.get(key);
    if (replay) {
      if (replay.fingerprint !== commandFingerprint) throw new Error("Cursor handoff idempotency key was already used with different input.");
      return immutableCopy({ ...replay.result, idempotent: true });
    }

    let result;
    try {
      const handoff = adapter.prepare({ ...input, executionEvidence, reviewEvidence });
      if (!CURSOR_HANDOFF_STATES.includes(handoff.status)) throw new Error("Cursor handoff adapter returned an invalid state.");
      result = immutableCopy({
        runId: input.runId,
        taskId: input.taskId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        status: handoff.status,
        code: handoff.code,
        handoff,
        idempotent: false
      });
    } catch (error) {
      if (!(error instanceof CursorHandoffUnavailableError)) throw error;
      result = immutableCopy({
        runId: input.runId,
        taskId: input.taskId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        status: "blocked",
        code: error.code,
        handoff: {
          provider: CURSOR_HANDOFF_PROVIDER,
          mode: "disabled",
          commands: [],
          artifact: null,
          boundary: { actualCursorInvocation: false, actualRepositoryMutation: false, codeChangesAllowed: false }
        },
        idempotent: false
      });
    }
    idempotency.set(key, { fingerprint: commandFingerprint, result });
    return result;
  }

  return Object.freeze({
    prepare,
    contract: () => getCursorHandoffContractSummary()
  });
}

export function createCursorHandoffHarness(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const authorization = options.authorizationEngine ?? createAuthorizationEngine({
    eventLog,
    now,
    eventIdFactory: eventIdFactory("evt_cursor_handoff_authorization")
  });
  const pipeline = options.pipeline ?? createCursorHandoffPipeline();

  function run(input) {
    assertIdentifier("runId", input?.runId, 80);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion);
    const authorizationId = `AUTH-CURSOR-HANDOFF-${input.runId}`;
    authorization.grant({
      authorizationId,
      mode: "direct",
      entries: [{ stepId: input.stepId, documentVersion: input.documentVersion }],
      operations: ["review"],
      actor: OWNER,
      idempotencyKey: `cursor-handoff-${input.runId}-grant`,
      note: "deterministic Cursor handoff harness only"
    });
    const dispatch = authorization.evaluateDispatch({
      authorizationId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      operation: "review",
      actor: ORCHESTRATOR,
      idempotencyKey: `cursor-handoff-${input.runId}-dispatch`
    });
    if (!dispatch.decision.authorized) throw new Error(`Cursor handoff dispatch was blocked: ${dispatch.decision.code}.`);
    const handoff = pipeline.prepare({ ...input, idempotencyKey: input.idempotencyKey ?? `cursor-handoff-${input.runId}-pipeline` });
    return immutableCopy({ status: handoff.status, dispatch: dispatch.decision, handoff, events: eventLog.readAfter() });
  }

  return Object.freeze({
    run,
    contract: () => getCursorHandoffContractSummary(),
    services: () => Object.freeze({ authorization, pipeline, eventLog })
  });
}
