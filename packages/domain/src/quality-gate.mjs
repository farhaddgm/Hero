import {
  DEFAULT_QUALITY_GATE_POLICY,
  getQualityGateContractSummary
} from "../../contracts/src/quality-gate.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createClaudeReviewPipeline } from "./claude-review.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const SENSITIVE_INPUT = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential)\s*[:=])/i;

function immutableCopy(value) {
  return Object.freeze(structuredClone(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
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

function assertActor(actor) {
  assertIdentifier("actor.kind", actor?.kind, 32);
  assertIdentifier("actor.id", actor?.id);
}

function assertSafeInput(value) {
  if (SENSITIVE_INPUT.test(JSON.stringify(value))) {
    throw new QualityGateSafetyError("Sensitive values are not accepted in Quality Gate input.");
  }
}

function assertPolicy(policy) {
  const normalized = { ...DEFAULT_QUALITY_GATE_POLICY, ...(policy ?? {}) };
  if (!Number.isInteger(normalized.maxCorrectionCycles) || normalized.maxCorrectionCycles < 0 || normalized.maxCorrectionCycles > 5) {
    throw new Error("maxCorrectionCycles must be an integer between 0 and 5.");
  }
  if (!Number.isInteger(normalized.maxCostUnits) || normalized.maxCostUnits < 0 || normalized.maxCostUnits > 100_000) {
    throw new Error("maxCostUnits must be an integer between 0 and 100000.");
  }
  return Object.freeze(normalized);
}

function assertCost(label, value) {
  if (!Number.isInteger(value) || value < 0 || value > 100_000) {
    throw new Error(`${label} must be a non-negative integer no larger than 100000.`);
  }
}

function assertDecision(decision, gate, operation) {
  if (decision?.globalStop === true || decision?.code === "GLOBAL_STOP_ACTIVE") return "GLOBAL_STOP_ACTIVE";
  if (
    !decision || decision.authorized !== true || decision.code !== "AUTHORIZED" || decision.safeCheckpointRequired === true ||
    decision.stepId !== gate.stepId || decision.documentVersion !== gate.documentVersion || decision.operation !== operation
  ) return "AUTHORIZATION_REQUIRED";
  return null;
}

function assertTestEvidence(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("testEvidence must be a structured object.");
  assertSafeInput(value);
  if (value.provider !== "codex") throw new Error("Quality Gate accepts Codex test evidence only.");
  if (value.status !== "completed" || !Array.isArray(value.files) || !Array.isArray(value.errors)) {
    throw new Error("testEvidence must include completed status, files and errors.");
  }
  if (!value.tests || value.tests.status !== "passed" || !Number.isInteger(value.tests.total) || !Number.isInteger(value.tests.passed) || value.tests.failed !== 0) {
    throw new Error("Quality Gate requires explicitly passing structured tests.");
  }
  if (value.tests.total < 1 || value.tests.passed !== value.tests.total) throw new Error("Passing tests must have a positive matching total.");
  if (!value.workspace || value.workspace.isolated !== true || value.workspace.actualRepositoryMutation === true) {
    throw new Error("Test evidence must prove an isolated workspace without direct repository mutation.");
  }
  if (value.artifact?.external === true) throw new Error("Test evidence cannot reference an external artifact.");
  return immutableCopy(value);
}

function eventIdFactory(prefix) {
  let sequence = 0;
  return () => `${prefix}_${String(++sequence).padStart(6, "0")}`;
}

function publicGate(gate) {
  return immutableCopy({
    gateId: gate.gateId,
    runId: gate.runId,
    taskId: gate.taskId,
    stepId: gate.stepId,
    documentVersion: gate.documentVersion,
    state: gate.state,
    code: gate.code,
    correctionCycles: gate.correctionCycles,
    costUnits: gate.costUnits,
    policy: gate.policy,
    latestReview: gate.latestReview,
    stopReason: gate.stopReason,
    version: gate.version,
    boundary: {
      providerInvocation: false,
      repositoryMutation: false,
      merge: false,
      deploy: false,
      externalSpend: false
    }
  });
}

export class QualityGateSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "QualityGateSafetyError";
    this.code = "QUALITY_GATE_SAFETY_REJECTED";
  }
}

export class QualityGateIdempotencyConflictError extends Error {
  constructor(key) {
    super(`idempotencyKey ${key} was already used with different Quality Gate input.`);
    this.name = "QualityGateIdempotencyConflictError";
  }
}

export class QualityGateTransitionError extends Error {
  constructor({ gateId, state, action }) {
    super(`Quality Gate ${gateId} cannot ${action} while ${state}.`);
    this.name = "QualityGateTransitionError";
  }
}

export function createQualityGate(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const reviewPipeline = options.reviewPipeline ?? createClaudeReviewPipeline();
  if (typeof reviewPipeline.review !== "function") throw new Error("reviewPipeline must provide review.");
  const asyncReviewPipeline = options.asyncReviewPipeline ?? reviewPipeline;
  if (typeof asyncReviewPipeline.reviewAsync !== "function" && typeof asyncReviewPipeline.review !== "function") {
    throw new Error("asyncReviewPipeline must provide reviewAsync or review.");
  }
  const gates = new Map();
  const idempotency = new Map();
  const nextEventId = options.eventIdFactory ?? eventIdFactory("evt_quality_gate");

  function replay(scope, key, input) {
    const replayed = idempotency.get(`${scope}\u0000${key}`);
    if (!replayed) return null;
    const inputFingerprint = fingerprint(input);
    if (replayed.fingerprint !== inputFingerprint) throw new QualityGateIdempotencyConflictError(key);
    return immutableCopy({ ...replayed.result, idempotent: true });
  }

  function remember(scope, key, input, result) {
    idempotency.set(`${scope}\u0000${key}`, { fingerprint: fingerprint(input), result: immutableCopy(result) });
  }

  function append(gate, type, actor, patch, data) {
    const event = createOperationalEvent({
      eventId: nextEventId(),
      aggregateType: "quality-gate",
      aggregateId: gate.gateId,
      type,
      occurredAt: now(),
      actor,
      correlationId: gate.runId,
      ...(gate.lastEventId ? { causationId: gate.lastEventId } : {}),
      data: { gateId: gate.gateId, runId: gate.runId, taskId: gate.taskId, stepId: gate.stepId, documentVersion: gate.documentVersion, ...data }
    });
    const stored = eventLog.append(event, { expectedVersion: gate.version });
    const next = immutableCopy({ ...gate, ...patch, version: stored.aggregateVersion, lastEventId: stored.eventId });
    gates.set(gate.gateId, next);
    return next;
  }

  function result(gate, eventType, idempotent = false) {
    return immutableCopy({ gate: publicGate(gate), eventType, idempotent });
  }

  function stop(gate, actor, code, reason) {
    const stopped = append(gate, "quality-gate.stopped", actor, { state: "stopped", code, stopReason: reason }, { code, reason });
    return result(stopped, "quality-gate.stopped");
  }

  function applyReview(gate, input, reviewResult) {
    if (!reviewResult || !["approved", "changes-requested", "blocked"].includes(reviewResult.status)) {
      throw new Error("reviewPipeline returned an invalid review result.");
    }
    const latestReview = immutableCopy({
      status: reviewResult.status,
      code: reviewResult.code,
      findings: reviewResult.review?.findings ?? [],
      ...(reviewResult.evaluationId ? { evaluationId: reviewResult.evaluationId } : {})
    });
    const basePatch = { costUnits: gate.costUnits + input.reviewCostUnits, latestReview };
    let output;
    if (reviewResult.status === "approved") {
      const approved = append(gate, "quality-gate.approved", input.actor, { ...basePatch, state: "approved", code: "QUALITY_APPROVED" }, { reviewCostUnits: input.reviewCostUnits, findings: 0, ...(reviewResult.evaluationId ? { evaluationId: reviewResult.evaluationId } : {}) });
      output = result(approved, "quality-gate.approved");
    } else if (reviewResult.status === "blocked") {
      const blocked = append(gate, "quality-gate.stopped", input.actor, { ...basePatch, state: "stopped", code: "REVIEW_BLOCKED", stopReason: reviewResult.code }, { code: "REVIEW_BLOCKED", reviewCostUnits: input.reviewCostUnits, ...(reviewResult.evaluationId ? { evaluationId: reviewResult.evaluationId } : {}) });
      output = result(blocked, "quality-gate.stopped");
    } else if (gate.correctionCycles >= gate.policy.maxCorrectionCycles) {
      const capped = append(gate, "quality-gate.stopped", input.actor, { ...basePatch, state: "stopped", code: "CYCLE_LIMIT_REACHED", stopReason: "Independent review requested another correction after the cycle cap." }, { code: "CYCLE_LIMIT_REACHED", reviewCostUnits: input.reviewCostUnits, findings: basePatch.latestReview.findings.length, ...(reviewResult.evaluationId ? { evaluationId: reviewResult.evaluationId } : {}) });
      output = result(capped, "quality-gate.stopped");
    } else {
      const changes = append(gate, "quality-gate.review-recorded", input.actor, { ...basePatch, state: "fix-required", code: "FIX_REQUIRED" }, { reviewCostUnits: input.reviewCostUnits, findings: basePatch.latestReview.findings.length, ...(reviewResult.evaluationId ? { evaluationId: reviewResult.evaluationId } : {}) });
      output = result(changes, "quality-gate.review-recorded");
    }
    return output;
  }

  function reviewInput(input, scope) {
    assertSafeInput(input);
    assertIdentifier("gateId", input?.gateId, 80);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    assertCost("reviewCostUnits", input?.reviewCostUnits);
    const gate = gates.get(input.gateId);
    if (!gate) throw new Error(`Quality Gate ${input.gateId} does not exist.`);
    const replayed = replay(`${scope}\u0000${input.gateId}`, input.idempotencyKey, input);
    if (replayed) return { gate, replayed };
    if (gate.state !== "review-ready") throw new QualityGateTransitionError({ gateId: gate.gateId, state: gate.state, action: "run review" });
    const authorization = assertDecision(input.reviewDecision, gate, "review");
    if (authorization === "GLOBAL_STOP_ACTIVE") return { gate, stopped: stop(gate, input.actor, "GLOBAL_STOP_ACTIVE", "Global Stop was active before independent review.") };
    if (authorization) throw new Error("Quality Gate review requires exact review authorization.");
    if (gate.costUnits + input.reviewCostUnits > gate.policy.maxCostUnits) return { gate, stopped: stop(gate, input.actor, "BUDGET_LIMIT_REACHED", "The next review would exceed the Quality Gate cost cap.") };
    return { gate };
  }

  function open(input) {
    assertSafeInput(input);
    assertIdentifier("gateId", input?.gateId, 80);
    assertIdentifier("runId", input?.runId, 80);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion, 48);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    const replayed = replay(`OPEN\u0000${input.gateId}`, input.idempotencyKey, input);
    if (replayed) return replayed;
    if (gates.has(input.gateId)) throw new Error(`Quality Gate ${input.gateId} already exists.`);
    const policy = assertPolicy(input.policy);
    const initial = immutableCopy({
      gateId: input.gateId, runId: input.runId, taskId: input.taskId, stepId: input.stepId, documentVersion: input.documentVersion,
      state: "awaiting-test", code: null, correctionCycles: 0, costUnits: 0, policy, latestEvidence: null, latestReview: null,
      stopReason: null, version: 0, lastEventId: null
    });
    const authorization = assertDecision(input.testDecision, initial, "test");
    let output;
    if (authorization === "GLOBAL_STOP_ACTIVE") {
      output = stop(initial, input.actor, "GLOBAL_STOP_ACTIVE", "Global Stop was active before the first test dispatch.");
    } else if (authorization) {
      throw new Error("Quality Gate open requires exact test authorization.");
    } else {
      const opened = append(initial, "quality-gate.opened", input.actor, {}, { policy });
      output = result(opened, "quality-gate.opened");
    }
    remember(`OPEN\u0000${input.gateId}`, input.idempotencyKey, input, output);
    return output;
  }

  function recordTest(input) {
    assertSafeInput(input);
    assertIdentifier("gateId", input?.gateId, 80);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    assertCost("testCostUnits", input?.testCostUnits);
    const gate = gates.get(input.gateId);
    if (!gate) throw new Error(`Quality Gate ${input.gateId} does not exist.`);
    const replayed = replay(`TEST\u0000${input.gateId}`, input.idempotencyKey, input);
    if (replayed) return replayed;
    if (!["awaiting-test", "awaiting-retest"].includes(gate.state)) throw new QualityGateTransitionError({ gateId: gate.gateId, state: gate.state, action: "record test evidence" });
    const authorization = assertDecision(input.testDecision, gate, "test");
    let output;
    if (authorization === "GLOBAL_STOP_ACTIVE") {
      output = stop(gate, input.actor, "GLOBAL_STOP_ACTIVE", "Global Stop was active before test evidence was accepted.");
    } else if (authorization) {
      throw new Error("Quality Gate test requires exact test authorization.");
    } else if (gate.costUnits + input.testCostUnits > gate.policy.maxCostUnits) {
      output = stop(gate, input.actor, "BUDGET_LIMIT_REACHED", "The next test would exceed the Quality Gate cost cap.");
    } else {
      let evidence;
      try {
        evidence = assertTestEvidence(input.testEvidence);
      } catch (error) {
        if (error instanceof QualityGateSafetyError) throw error;
        output = stop(gate, input.actor, "TEST_EVIDENCE_REJECTED", error.message);
      }
      if (!output) {
        const tested = append(gate, "quality-gate.test-recorded", input.actor, {
          state: "review-ready", code: null, costUnits: gate.costUnits + input.testCostUnits, latestEvidence: evidence
        }, { testCostUnits: input.testCostUnits, tests: evidence.tests, files: evidence.files.length });
        output = result(tested, "quality-gate.test-recorded");
      }
    }
    remember(`TEST\u0000${input.gateId}`, input.idempotencyKey, input, output);
    return output;
  }

  function review(input) {
    const prepared = reviewInput(input, "REVIEW");
    if (prepared.replayed) return prepared.replayed;
    if (prepared.stopped) {
      remember(`REVIEW\u0000${input.gateId}`, input.idempotencyKey, input, prepared.stopped);
      return prepared.stopped;
    }
    const { gate } = prepared;
    const reviewResult = reviewPipeline.review({
      gateId: gate.gateId,
      correctionCycles: gate.correctionCycles,
      runId: gate.runId,
      taskId: gate.taskId,
      stepId: gate.stepId,
      documentVersion: gate.documentVersion,
      executionEvidence: gate.latestEvidence,
      idempotencyKey: `quality-gate-${gate.gateId}-review-${gate.correctionCycles}`
    });
    const output = applyReview(gate, input, reviewResult);
    remember(`REVIEW\u0000${input.gateId}`, input.idempotencyKey, input, output);
    return output;
  }

  async function reviewAsync(input) {
    const prepared = reviewInput(input, "REVIEW");
    if (prepared.replayed) return prepared.replayed;
    if (prepared.stopped) {
      remember(`REVIEW\u0000${input.gateId}`, input.idempotencyKey, input, prepared.stopped);
      return prepared.stopped;
    }
    const { gate } = prepared;
    const reviewMethod = asyncReviewPipeline.reviewAsync ?? asyncReviewPipeline.review;
    const reviewResult = await reviewMethod({
      gateId: gate.gateId,
      correctionCycles: gate.correctionCycles,
      runId: gate.runId,
      taskId: gate.taskId,
      stepId: gate.stepId,
      documentVersion: gate.documentVersion,
      executionEvidence: gate.latestEvidence,
      idempotencyKey: `quality-gate-${gate.gateId}-review-${gate.correctionCycles}`
    });
    const output = applyReview(gate, input, reviewResult);
    remember(`REVIEW\u0000${input.gateId}`, input.idempotencyKey, input, output);
    return output;
  }

  function authorizeFix(input) {
    assertSafeInput(input);
    assertIdentifier("gateId", input?.gateId, 80);
    assertIdentifier("correctionTaskId", input?.correctionTaskId, 128);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    const gate = gates.get(input.gateId);
    if (!gate) throw new Error(`Quality Gate ${input.gateId} does not exist.`);
    const replayed = replay(`FIX\u0000${input.gateId}`, input.idempotencyKey, input);
    if (replayed) return replayed;
    if (gate.state !== "fix-required") throw new QualityGateTransitionError({ gateId: gate.gateId, state: gate.state, action: "authorize correction" });
    const authorization = assertDecision(input.developDecision, gate, "develop");
    let output;
    if (authorization === "GLOBAL_STOP_ACTIVE") {
      output = stop(gate, input.actor, "GLOBAL_STOP_ACTIVE", "Global Stop was active before the correction dispatch.");
    } else if (authorization) {
      throw new Error("Quality Gate correction requires exact develop authorization.");
    } else if (gate.correctionCycles >= gate.policy.maxCorrectionCycles) {
      output = stop(gate, input.actor, "CYCLE_LIMIT_REACHED", "The correction cycle cap was reached before another correction dispatch.");
    } else {
      const corrected = append(gate, "quality-gate.correction-authorized", input.actor, {
        state: "awaiting-retest", code: null, correctionCycles: gate.correctionCycles + 1
      }, { correctionTaskId: input.correctionTaskId, correctionCycles: gate.correctionCycles + 1, separateAuthorizedTask: true });
      output = result(corrected, "quality-gate.correction-authorized");
    }
    remember(`FIX\u0000${input.gateId}`, input.idempotencyKey, input, output);
    return output;
  }

  function get(gateId) {
    const gate = gates.get(gateId);
    return gate ? publicGate(gate) : null;
  }

  return Object.freeze({ open, recordTest, review, reviewAsync, authorizeFix, get, events: () => eventLog.readAfter(), contract: () => getQualityGateContractSummary() });
}

export function createQualityGateHarness(options = {}) {
  const gate = options.gate ?? createQualityGate(options);
  return Object.freeze({
    run(input) {
      const opened = gate.open(input.open);
      if (opened.gate.state === "stopped") return opened;
      const tested = gate.recordTest(input.test);
      if (tested.gate.state === "stopped") return tested;
      return gate.review(input.review);
    },
    services: () => Object.freeze({ gate }),
    contract: () => getQualityGateContractSummary()
  });
}
