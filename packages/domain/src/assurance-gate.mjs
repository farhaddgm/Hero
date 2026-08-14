import { DEFAULT_ASSURANCE_POLICY, getAssuranceGateContractSummary } from "../../contracts/src/assurance-gate.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const SENSITIVE_INPUT = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential)\s*[:=])/i;

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
  if (typeof value !== "string" || value.length < 3 || value.length > maximum || /[\\/]/.test(value)) {
    throw new Error(`${label} must be a 3-${maximum} character identifier without a path separator.`);
  }
}

function assertActor(actor) {
  assertIdentifier("actor.kind", actor?.kind, 32);
  assertIdentifier("actor.id", actor?.id);
}

function assertSafeInput(value) {
  const serialized = JSON.stringify(value);
  if (SENSITIVE_INPUT.test(serialized)) throw new AssuranceGateSafetyError("Sensitive values are not accepted in Assurance Gate input.");
  if (/(?:[A-Za-z]:[\\/]|\/Users\/|\/home\/)/.test(serialized)) throw new AssuranceGateSafetyError("Host-specific paths are not accepted in Assurance Gate input.");
}

function authorizationCode(decision, gate) {
  if (decision?.globalStop === true || decision?.code === "GLOBAL_STOP_ACTIVE") return "GLOBAL_STOP_ACTIVE";
  if (
    !decision || decision.authorized !== true || decision.code !== "AUTHORIZED" || decision.safeCheckpointRequired === true ||
    decision.stepId !== gate.stepId || decision.documentVersion !== gate.documentVersion || decision.operation !== "test"
  ) return "AUTHORIZATION_REQUIRED";
  return null;
}

function assertPolicy(policy) {
  const normalized = { ...DEFAULT_ASSURANCE_POLICY, ...(policy ?? {}) };
  if (!Number.isInteger(normalized.maxCostUnits) || normalized.maxCostUnits < 0 || normalized.maxCostUnits > 100_000) {
    throw new Error("maxCostUnits must be an integer between 0 and 100000.");
  }
  if (!Array.isArray(normalized.requiredObservabilityEvents) || normalized.requiredObservabilityEvents.length < 1 || normalized.requiredObservabilityEvents.some(value => typeof value !== "string" || value.length < 3)) {
    throw new Error("requiredObservabilityEvents must contain safe event type names.");
  }
  return immutableCopy({
    maxCostUnits: normalized.maxCostUnits,
    requiredObservabilityEvents: [...new Set(normalized.requiredObservabilityEvents)].sort()
  });
}

function evidenceResult(evidence, policy) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { code: "CI_EVIDENCE_REQUIRED", reason: "Structured local CI evidence is required." };
  const ci = evidence.ci;
  if (!ci || ci.status !== "passed" || ci.external === true || !Array.isArray(ci.checks) || ci.checks.length < 1 || ci.checks.some(check => typeof check !== "string" || check.length < 3)) {
    return { code: "CI_EVIDENCE_REQUIRED", reason: "CI evidence must be passed, local and identify at least one check." };
  }
  const security = evidence.security;
  if (!security || security.status !== "passed" || security.sensitiveValuesDetected !== false || security.networkEnabled !== false) {
    return { code: "SECURITY_POLICY_FAILED", reason: "Security evidence must prove no sensitive values and a closed network boundary." };
  }
  const observability = evidence.observability;
  if (!observability || observability.status !== "ready" || observability.externalExport !== false || !Array.isArray(observability.eventTypes)) {
    return { code: "OBSERVABILITY_CONTRACT_REQUIRED", reason: "Observability evidence must be local, ready and declare event types." };
  }
  const missingEvents = policy.requiredObservabilityEvents.filter(type => !observability.eventTypes.includes(type));
  if (missingEvents.length > 0) {
    return { code: "OBSERVABILITY_CONTRACT_REQUIRED", reason: `Observability evidence is missing: ${missingEvents.join(", ")}.` };
  }
  const cost = evidence.cost;
  if (!cost || !Number.isInteger(cost.units) || cost.units < 0 || cost.units > 100_000) {
    return { code: "BUDGET_CAP_REACHED", reason: "Cost evidence must report non-negative integer units." };
  }
  if (cost.externalSpend === true) {
    return { code: "EXTERNAL_SPEND_REQUIRES_SEPARATE_AUTHORIZATION", reason: "External spend is outside the active development and test authority." };
  }
  if (cost.units > policy.maxCostUnits) {
    return { code: "BUDGET_CAP_REACHED", reason: "Recorded cost exceeds the approved Assurance Gate cap." };
  }
  return {
    code: "ASSURANCE_APPROVED",
    reason: "Local CI, security, observability and cost evidence satisfy the approved Assurance Gate policy.",
    evidence: immutableCopy({
      ci: { checks: [...ci.checks].sort(), status: ci.status, external: false },
      security: { status: security.status, sensitiveValuesDetected: false, networkEnabled: false },
      observability: { status: observability.status, eventTypes: [...new Set(observability.eventTypes)].sort(), externalExport: false },
      cost: { units: cost.units, externalSpend: false }
    })
  };
}

function publicGate(gate) {
  return immutableCopy({
    gateId: gate.gateId,
    stepId: gate.stepId,
    documentVersion: gate.documentVersion,
    state: gate.state,
    code: gate.code,
    policy: gate.policy,
    evidence: gate.evidence,
    reason: gate.reason,
    release: {
      state: "requires-separate-authorization",
      code: "RELEASE_REQUIRES_SEPARATE_AUTHORIZATION",
      dispatchStarted: false
    },
    version: gate.version,
    lastEventId: gate.lastEventId,
    boundary: {
      ciDispatch: false,
      providerInvocation: false,
      repositoryMutation: false,
      telemetryExport: false,
      release: false,
      deploy: false,
      externalSpend: false
    }
  });
}

export class AssuranceGateSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssuranceGateSafetyError";
    this.code = "ASSURANCE_GATE_SAFETY_REJECTED";
  }
}

export class AssuranceGateIdempotencyConflictError extends Error {
  constructor(key) {
    super(`idempotencyKey ${key} was already used with different Assurance Gate input.`);
    this.name = "AssuranceGateIdempotencyConflictError";
  }
}

export function createAssuranceGate(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const gates = new Map();
  const idempotency = new Map();
  let eventSequence = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => `evt_assurance_gate_${String(++eventSequence).padStart(6, "0")}`);

  function replay(scope, idempotencyKey, input) {
    const prior = idempotency.get(`${scope}\u0000${idempotencyKey}`);
    if (!prior) return null;
    if (prior.fingerprint !== fingerprint(input)) throw new AssuranceGateIdempotencyConflictError(idempotencyKey);
    return immutableCopy({ ...prior.result, idempotent: true });
  }

  function remember(scope, idempotencyKey, input, result) {
    idempotency.set(`${scope}\u0000${idempotencyKey}`, { fingerprint: fingerprint(input), result: immutableCopy(result) });
  }

  function append(gate, type, actor, patch, data) {
    const event = createOperationalEvent({
      eventId: eventIdFactory(),
      aggregateType: "assurance-gate",
      aggregateId: gate.gateId,
      type,
      occurredAt: now(),
      actor,
      correlationId: gate.gateId,
      ...(gate.lastEventId ? { causationId: gate.lastEventId } : {}),
      data: { gateId: gate.gateId, stepId: gate.stepId, documentVersion: gate.documentVersion, ...data }
    });
    const stored = eventLog.append(event, { expectedVersion: gate.version });
    const next = immutableCopy({ ...gate, ...patch, version: stored.aggregateVersion, lastEventId: stored.eventId });
    gates.set(next.gateId, next);
    return next;
  }

  function assess(input) {
    assertSafeInput(input);
    assertIdentifier("gateId", input?.gateId, 80);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion, 48);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    const replayed = replay(`ASSESS\u0000${input.gateId}`, input.idempotencyKey, input);
    if (replayed) return replayed;
    if (gates.has(input.gateId)) throw new Error(`Assurance Gate ${input.gateId} already exists.`);

    const policy = assertPolicy(input.policy);
    const initial = immutableCopy({
      gateId: input.gateId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      state: "evaluating",
      code: "ASSURANCE_READY",
      policy,
      evidence: null,
      reason: null,
      version: 0,
      lastEventId: null
    });
    const authorization = authorizationCode(input.testDecision, initial);
    let output;
    if (authorization === "GLOBAL_STOP_ACTIVE") {
      const blocked = immutableCopy({ ...initial, state: "blocked", code: "GLOBAL_STOP_ACTIVE", reason: "Global Stop was active before assurance assessment." });
      output = immutableCopy({ gate: publicGate(blocked), eventType: null, idempotent: false });
    } else if (authorization) {
      throw new Error("Assurance Gate assessment requires exact test authorization.");
    } else {
      const started = append(initial, "assurance-gate.assessment-started", input.actor, {}, { policy });
      const assessment = evidenceResult(input.evidence, policy);
      const approved = assessment.code === "ASSURANCE_APPROVED";
      const completed = append(started, approved ? "assurance-gate.assessment-approved" : "assurance-gate.assessment-blocked", input.actor, {
        state: approved ? "approved" : "blocked",
        code: assessment.code,
        evidence: assessment.evidence ?? null,
        reason: assessment.reason
      }, {
        code: assessment.code,
        ciChecks: assessment.evidence?.ci.checks.length ?? 0,
        costUnits: assessment.evidence?.cost.units ?? null,
        externalDispatchStarted: false
      });
      output = immutableCopy({ gate: publicGate(completed), eventType: approved ? "assurance-gate.assessment-approved" : "assurance-gate.assessment-blocked", idempotent: false });
    }
    remember(`ASSESS\u0000${input.gateId}`, input.idempotencyKey, input, output);
    return output;
  }

  function get(gateId) {
    const gate = gates.get(gateId);
    return gate ? publicGate(gate) : null;
  }

  return Object.freeze({ assess, get, events: () => eventLog.readAfter(), contract: () => getAssuranceGateContractSummary() });
}

export function createAssuranceGateHarness(options = {}) {
  const gate = options.gate ?? createAssuranceGate(options);
  return Object.freeze({
    run: input => gate.assess(input),
    services: () => Object.freeze({ gate }),
    contract: () => getAssuranceGateContractSummary()
  });
}
