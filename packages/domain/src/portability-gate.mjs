import { DEFAULT_PORTABILITY_POLICY, getPortabilityGateContractSummary } from "../../contracts/src/portability-gate.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const SENSITIVE_INPUT = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential)\s*[:=])/i;
const HOST_PATH = /(?:[A-Za-z]:[\\/]|\/Users\/|\/home\/|\\\\)/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

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
  if (SENSITIVE_INPUT.test(serialized)) throw new PortabilityGateSafetyError("Sensitive values are not accepted in Portability Gate input.");
  if (HOST_PATH.test(serialized)) throw new PortabilityGateSafetyError("Host-specific paths are not accepted in Portability Gate input.");
}

function authorizationCode(decision, gate) {
  if (decision?.globalStop === true || decision?.code === "GLOBAL_STOP_ACTIVE") return "GLOBAL_STOP_ACTIVE";
  if (
    !decision || decision.authorized !== true || decision.code !== "AUTHORIZED" || decision.safeCheckpointRequired === true ||
    decision.stepId !== gate.stepId || decision.documentVersion !== gate.documentVersion || decision.operation !== "test"
  ) return "AUTHORIZATION_REQUIRED";
  return null;
}

function normalizePolicy(policy) {
  const normalized = { ...DEFAULT_PORTABILITY_POLICY, ...(policy ?? {}) };
  if (!Array.isArray(normalized.requiredSourceFiles) || normalized.requiredSourceFiles.length < 4 || normalized.requiredSourceFiles.some(value => typeof value !== "string" || value.length < 3 || value.includes("..") || value.includes("\\"))) {
    throw new Error("requiredSourceFiles must contain safe repository-relative names.");
  }
  if (!Array.isArray(normalized.requiredComposeResources) || normalized.requiredComposeResources.length < 2 || normalized.requiredComposeResources.some(value => typeof value !== "string" || !value.startsWith("hero-"))) {
    throw new Error("requiredComposeResources must contain Hero-scoped resource names.");
  }
  if (normalized.requiredEnvironmentPrefix !== "HERO_" || normalized.requireCleanLinuxEvidence !== true) {
    throw new Error("Portability Gate policy must keep HERO_ configuration and clean Linux verification mandatory.");
  }
  return immutableCopy({
    requiredSourceFiles: [...new Set(normalized.requiredSourceFiles)].sort(),
    requiredComposeResources: [...new Set(normalized.requiredComposeResources)].sort(),
    requiredEnvironmentPrefix: normalized.requiredEnvironmentPrefix,
    requireCleanLinuxEvidence: true
  });
}

function missing(expected, actual) {
  return expected.filter(value => !actual.includes(value));
}

function checkEvidence(evidence, policy) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return { code: "SOURCE_BOUNDARY_FAILED", reason: "Structured portability evidence is required." };
  }
  const source = evidence.source;
  if (!source || source.status !== "passed" || source.independentRepository !== true || source.externalProjectReferenceDetected !== false || source.hostSpecificPathDetected !== false || !Array.isArray(source.files)) {
    return { code: "SOURCE_BOUNDARY_FAILED", reason: "Source evidence must prove an independent repository without foreign-project references or host paths." };
  }
  const missingSourceFiles = missing(policy.requiredSourceFiles, source.files);
  if (missingSourceFiles.length > 0) {
    return { code: "SOURCE_BOUNDARY_FAILED", reason: `Source evidence is missing: ${missingSourceFiles.join(", ")}.` };
  }

  const runtime = evidence.runtime;
  if (!runtime || runtime.status !== "passed" || runtime.linuxContainerReference !== true || runtime.environmentPrefix !== policy.requiredEnvironmentPrefix || !Array.isArray(runtime.composeResources)) {
    return { code: "RUNTIME_CONTRACT_REQUIRED", reason: "Runtime evidence must prove the Linux container contract and HERO_ configuration boundary." };
  }
  const missingResources = missing(policy.requiredComposeResources, runtime.composeResources);
  if (missingResources.length > 0) {
    return { code: "RUNTIME_CONTRACT_REQUIRED", reason: `Runtime evidence is missing Hero resources: ${missingResources.join(", ")}.` };
  }

  const backup = evidence.backup;
  if (!backup || backup.status !== "passed" || typeof backup.artifactId !== "string" || backup.artifactId.length < 3 || !DIGEST.test(backup.digest) || backup.projectScoped !== true || backup.containsSecrets !== false) {
    return { code: "BACKUP_EVIDENCE_REQUIRED", reason: "Backup evidence must be project-scoped, secret-free and include a SHA-256 digest." };
  }

  const restore = evidence.restore;
  if (!restore || restore.status !== "passed" || restore.checksumMatched !== true || restore.migrationState !== "verified" || restore.digest !== backup.digest) {
    return { code: "RESTORE_EVIDENCE_REQUIRED", reason: "Restore evidence must verify the same backup digest and migration state." };
  }
  if (policy.requireCleanLinuxEvidence && restore.cleanLinuxVerified !== true) {
    return { code: "LINUX_CLEANROOM_VERIFICATION_REQUIRED", reason: "A clean Linux restore verification is required before transfer readiness can be approved." };
  }

  return {
    code: "PORTABILITY_VERIFIED",
    reason: "Source, runtime, backup, restore and clean Linux evidence satisfy the approved portability policy.",
    evidence: immutableCopy({
      source: { files: [...new Set(source.files)].sort(), independentRepository: true, externalProjectReferenceDetected: false, hostSpecificPathDetected: false },
      runtime: { linuxContainerReference: true, environmentPrefix: policy.requiredEnvironmentPrefix, composeResources: [...new Set(runtime.composeResources)].sort() },
      backup: { artifactId: backup.artifactId, digest: backup.digest, projectScoped: true, containsSecrets: false },
      restore: { digest: restore.digest, checksumMatched: true, migrationState: "verified", cleanLinuxVerified: true }
    })
  };
}

function publicGate(gate) {
  return immutableCopy({
    assessmentId: gate.assessmentId,
    stepId: gate.stepId,
    documentVersion: gate.documentVersion,
    state: gate.state,
    code: gate.code,
    policy: gate.policy,
    evidence: gate.evidence,
    reason: gate.reason,
    transfer: {
      state: "requires-separate-authorization",
      code: "TRANSFER_REQUIRES_SEPARATE_AUTHORIZATION",
      repositoryCopied: false,
      backupRead: false,
      backupWritten: false,
      hostProvisioned: false,
      containersStarted: false,
      secretsTouched: false
    },
    version: gate.version,
    lastEventId: gate.lastEventId,
    boundary: {
      filesystemBackupOperation: false,
      secretAccess: false,
      networkAccess: false,
      hostProvisioning: false,
      containerStart: false,
      repositoryTransfer: false
    }
  });
}

export class PortabilityGateSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "PortabilityGateSafetyError";
    this.code = "PORTABILITY_GATE_SAFETY_REJECTED";
  }
}

export class PortabilityGateIdempotencyConflictError extends Error {
  constructor(key) {
    super(`idempotencyKey ${key} was already used with different Portability Gate input.`);
    this.name = "PortabilityGateIdempotencyConflictError";
  }
}

export function createPortabilityGate(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const gates = new Map();
  const idempotency = new Map();
  let eventSequence = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => `evt_portability_gate_${String(++eventSequence).padStart(6, "0")}`);

  function replay(scope, idempotencyKey, input) {
    const prior = idempotency.get(`${scope}\u0000${idempotencyKey}`);
    if (!prior) return null;
    if (prior.fingerprint !== fingerprint(input)) throw new PortabilityGateIdempotencyConflictError(idempotencyKey);
    return immutableCopy({ ...prior.result, idempotent: true });
  }

  function remember(scope, idempotencyKey, input, result) {
    idempotency.set(`${scope}\u0000${idempotencyKey}`, { fingerprint: fingerprint(input), result: immutableCopy(result) });
  }

  function append(gate, type, actor, patch, data) {
    const event = createOperationalEvent({
      eventId: eventIdFactory(),
      aggregateType: "portability-gate",
      aggregateId: gate.assessmentId,
      type,
      occurredAt: now(),
      actor,
      correlationId: gate.assessmentId,
      ...(gate.lastEventId ? { causationId: gate.lastEventId } : {}),
      data: { assessmentId: gate.assessmentId, stepId: gate.stepId, documentVersion: gate.documentVersion, ...data }
    });
    const stored = eventLog.append(event, { expectedVersion: gate.version });
    const next = immutableCopy({ ...gate, ...patch, version: stored.aggregateVersion, lastEventId: stored.eventId });
    gates.set(next.assessmentId, next);
    return next;
  }

  function assess(input) {
    assertSafeInput(input);
    assertIdentifier("assessmentId", input?.assessmentId, 80);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion, 48);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    const replayed = replay(`ASSESS\u0000${input.assessmentId}`, input.idempotencyKey, input);
    if (replayed) return replayed;
    if (gates.has(input.assessmentId)) throw new Error(`Portability Gate ${input.assessmentId} already exists.`);

    const policy = normalizePolicy(input.policy);
    const initial = immutableCopy({
      assessmentId: input.assessmentId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      state: "assessing",
      code: "PORTABILITY_READY",
      policy,
      evidence: null,
      reason: null,
      version: 0,
      lastEventId: null
    });
    const authorization = authorizationCode(input.testDecision, initial);
    let output;
    if (authorization === "GLOBAL_STOP_ACTIVE") {
      const blocked = immutableCopy({ ...initial, state: "blocked", code: "GLOBAL_STOP_ACTIVE", reason: "Global Stop was active before portability assessment." });
      output = immutableCopy({ gate: publicGate(blocked), eventType: null, idempotent: false });
    } else if (authorization) {
      throw new Error("Portability Gate assessment requires exact test authorization.");
    } else {
      const started = append(initial, "portability-gate.assessment-started", input.actor, {}, { policy });
      const assessment = checkEvidence(input.evidence, policy);
      const approved = assessment.code === "PORTABILITY_VERIFIED";
      const completed = append(started, approved ? "portability-gate.assessment-approved" : "portability-gate.assessment-blocked", input.actor, {
        state: approved ? "ready" : "blocked",
        code: assessment.code,
        evidence: assessment.evidence ?? null,
        reason: assessment.reason
      }, {
        code: assessment.code,
        backupDigest: assessment.evidence?.backup.digest ?? null,
        cleanLinuxVerified: assessment.evidence?.restore.cleanLinuxVerified ?? false,
        transferStarted: false
      });
      output = immutableCopy({ gate: publicGate(completed), eventType: approved ? "portability-gate.assessment-approved" : "portability-gate.assessment-blocked", idempotent: false });
    }
    remember(`ASSESS\u0000${input.assessmentId}`, input.idempotencyKey, input, output);
    return output;
  }

  function get(assessmentId) {
    const gate = gates.get(assessmentId);
    return gate ? publicGate(gate) : null;
  }

  return Object.freeze({ assess, get, events: () => eventLog.readAfter(), contract: () => getPortabilityGateContractSummary() });
}

export function createPortabilityGateHarness(options = {}) {
  const gate = options.gate ?? createPortabilityGate(options);
  return Object.freeze({
    run: input => gate.assess(input),
    services: () => Object.freeze({ gate }),
    contract: () => getPortabilityGateContractSummary()
  });
}
