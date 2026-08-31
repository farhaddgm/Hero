import {
  RELEASE_COMMIT_PATTERN,
  RELEASE_ENVIRONMENTS,
  RELEASE_STATES,
  RELEASE_VERSION_PATTERN,
  getReleaseContractSummary
} from "../../contracts/src/release.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SENSITIVE_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const HOST_PATH = /(?:^|[\\/])(?:opt|home|root|Users|var|tmp)(?:[\\/]|$)|^[A-Za-z]:[\\/]/i;

function copy(value) {
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

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new ReleaseCommandError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function assertActor(actor) {
  assertIdentifier("actor.kind", actor?.kind);
  assertIdentifier("actor.id", actor?.id);
}

function assertOwner(actor) {
  assertActor(actor);
  if (actor.kind !== "project-owner") throw new ReleaseCommandError("OWNER_APPROVAL_REQUIRED", "Only project-owner may approve or promote production.");
}

function assertSafe(value, path = "input") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafe(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) throw new ReleaseCommandError("SENSITIVE_INPUT_REJECTED", `${path}.${key} is not allowed.`);
      assertSafe(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && (SENSITIVE_VALUE.test(value) || HOST_PATH.test(value))) {
    throw new ReleaseCommandError("SENSITIVE_INPUT_REJECTED", `${path} contains a forbidden value.`);
  }
}

function assertIdempotencyKey(value) {
  assertIdentifier("idempotencyKey", value);
}

function normalizeRelease(input) {
  assertSafe(input);
  const releaseId = assertIdentifier("releaseId", input.releaseId);
  const projectId = assertIdentifier("projectId", input.projectId);
  const artifactId = assertIdentifier("artifactId", input.artifactId);
  const version = typeof input.version === "string" ? input.version.trim() : "";
  const commitSha = typeof input.commitSha === "string" ? input.commitSha.trim() : "";
  if (!RELEASE_VERSION_PATTERN.test(version)) throw new ReleaseCommandError("INVALID_VERSION", "Release version must be semantic versioning.");
  if (!RELEASE_COMMIT_PATTERN.test(commitSha)) throw new ReleaseCommandError("COMMIT_REQUIRED", "A valid commit SHA is required.");
  return { releaseId, projectId, artifactId, version, commitSha };
}

function assertSameArtifact(release, input, label = "artifact") {
  if (input.environment !== undefined && input.environment !== "test" && input.environment !== "production") {
    throw new ReleaseCommandError("INVALID_ENVIRONMENT", `${label} environment is invalid.`);
  }
  if (input.artifactId !== release.artifactId || input.version !== release.releaseVersion || input.commitSha !== release.commitSha) {
    throw new ReleaseCommandError("ARTIFACT_MISMATCH", `${label} must reference the exact registered artifact, version and commit.`);
  }
}

function result(release, event, idempotent) {
  return Object.freeze({ release: copy(release), event: copy(event), idempotent });
}

export class ReleaseCommandError extends Error {
  constructor(code, message, decision = null) {
    super(message);
    this.name = "ReleaseCommandError";
    this.code = code;
    this.decision = decision;
  }
}

export class ReleaseIdempotencyConflictError extends ReleaseCommandError {
  constructor(idempotencyKey) {
    super("IDEMPOTENCY_CONFLICT", `Idempotency key ${idempotencyKey} was already used with different input.`);
    this.name = "ReleaseIdempotencyConflictError";
  }
}

export function createReleasePromotion(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  const principles = options.principlesRegistry;
  let nextEvent = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => `evt_release_${String(++nextEvent).padStart(6, "0")}`);
  const releases = new Map();
  const idempotency = new Map();

  function getRelease(releaseId) {
    const release = releases.get(releaseId);
    if (!release) throw new ReleaseCommandError("RELEASE_NOT_FOUND", "Release not found.");
    return release;
  }

  function append({ release, type, actor, data }) {
    const event = createOperationalEvent({
      eventId: eventIdFactory(),
      aggregateType: "release",
      aggregateId: release.releaseId,
      type,
      occurredAt: now(),
      actor,
      correlationId: release.projectId,
      data,
      ...(release.lastEventId ? { causationId: release.lastEventId } : {})
    });
    return eventLog.append(event, { expectedVersion: release.aggregateVersion });
  }

  function execute(release, input, type, nextState, data, mutator = value => value) {
    if (!RELEASE_STATES.includes(nextState)) throw new ReleaseCommandError("INVALID_RELEASE_TRANSITION", "Release state is not supported.");
    const event = append({ release, type, actor: input.actor, data: { releaseId: release.releaseId, ...data } });
    const next = Object.freeze(mutator({
      ...release,
      state: nextState,
      aggregateVersion: event.aggregateVersion,
      updatedAt: event.occurredAt,
      lastEventId: event.eventId
    }));
    releases.set(release.releaseId, next);
    return result(next, event, false);
  }

  function remember(scope, key, value, producer) {
    const lookup = `${scope}\u0000${key}`;
    const existing = idempotency.get(lookup);
    if (existing) {
      if (existing.fingerprint !== fingerprint(value)) throw new ReleaseIdempotencyConflictError(key);
      return result(existing.release, existing.event, true);
    }
    const created = producer();
    idempotency.set(lookup, { fingerprint: fingerprint(value), release: copy(created.release), event: copy(created.event) });
    return created;
  }

  function checkPrinciples(projectId, controlPoint) {
    if (!principles) return;
    try {
      principles.assertSatisfied({ projectId, controlPoint });
    } catch (error) {
      if (error.code === "PRINCIPLES_NOT_SATISFIED") throw new ReleaseCommandError("PRINCIPLES_NOT_SATISFIED", error.message, error.decision);
      throw error;
    }
  }

  function register(input) {
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const normalized = normalizeRelease(input);
    const value = { action: "register", ...normalized, actor: input.actor };
    const lookup = `REGISTER:${normalized.releaseId}`;
    const existing = idempotency.get(`${lookup}\u0000${input.idempotencyKey}`);
    if (existing) {
      if (existing.fingerprint !== fingerprint(value)) throw new ReleaseIdempotencyConflictError(input.idempotencyKey);
      return result(existing.release, existing.event, true);
    }
    if (releases.has(normalized.releaseId)) throw new ReleaseCommandError("RELEASE_ALREADY_EXISTS", "Release already exists.");
    checkPrinciples(normalized.projectId, "release-test");
    const { version: releaseVersion, ...releaseIdentity } = normalized;
    const initial = Object.freeze({
      ...releaseIdentity,
      releaseVersion,
      aggregateVersion: 0,
      state: "draft",
      createdAt: now(),
      updatedAt: null,
      testEnvironment: Object.freeze({ environment: "test", status: "not-deployed", deploymentId: null, deployedAt: null }),
      productionEnvironment: Object.freeze({ environment: "production", status: "not-deployed", deploymentId: null, deployedAt: null }),
      testEvidence: null,
      productionApproval: null,
      productionPromotion: null,
      lastEventId: null
    });
    const created = execute(initial, input, "release.registered", "draft", {
      projectId: normalized.projectId,
      artifactId: normalized.artifactId,
      releaseVersion: normalized.version,
      commitSha: normalized.commitSha
    }, release => ({ ...release, createdAt: release.createdAt }));
    idempotency.set(`${lookup}\u0000${input.idempotencyKey}`, { fingerprint: fingerprint(value), release: copy(created.release), event: copy(created.event) });
    return created;
  }

  function requestTestDeployment(input) {
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const release = getRelease(assertIdentifier("releaseId", input.releaseId));
    if (release.state !== "draft") throw new ReleaseCommandError("INVALID_RELEASE_TRANSITION", "Only a draft release can request test deployment.");
    checkPrinciples(release.projectId, "release-test");
    const value = { releaseId: release.releaseId, action: "request-test-deployment", actor: input.actor };
    return remember(`RELEASE:${release.releaseId}`, input.idempotencyKey, value, () => execute(release, input, "release.test-deployment-requested", "test-deployment-requested", {
      environment: "test",
      artifactId: release.artifactId,
      releaseVersion: release.releaseVersion,
      commitSha: release.commitSha
    }, next => ({
      ...next,
      testEnvironment: Object.freeze({ ...next.testEnvironment, status: "deployment-requested" })
    })));
  }

  function recordTestDeployment(input) {
    assertActor(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const release = getRelease(assertIdentifier("releaseId", input.releaseId));
    if (release.state !== "test-deployment-requested") throw new ReleaseCommandError("TEST_DEPLOYMENT_REQUIRED", "A test deployment request is required first.");
    assertSameArtifact(release, { ...input, environment: "test" }, "Test deployment");
    const deploymentId = assertIdentifier("deploymentId", input.deploymentId);
    if (input.completed !== true) throw new ReleaseCommandError("TEST_DEPLOYMENT_REQUIRED", "Test deployment must provide completed evidence.");
    const value = { releaseId: release.releaseId, deploymentId, completed: true, actor: input.actor };
    return remember(`TEST-DEPLOYMENT:${release.releaseId}`, input.idempotencyKey, value, () => execute(release, input, "release.test-deployment-recorded", "test-deployed", {
      environment: "test",
      deploymentId,
      completed: true,
      artifactId: release.artifactId,
      releaseVersion: release.releaseVersion,
      commitSha: release.commitSha
    }, next => ({
      ...next,
      testEnvironment: Object.freeze({ ...next.testEnvironment, status: "deployed", deploymentId, deployedAt: next.updatedAt })
    })));
  }

  function recordTestEvidence(input) {
    assertActor(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const release = getRelease(assertIdentifier("releaseId", input.releaseId));
    if (release.state !== "test-deployed") throw new ReleaseCommandError("TEST_DEPLOYMENT_REQUIRED", "A completed test deployment is required first.");
    assertSameArtifact(release, { ...input, environment: "test" }, "Test evidence");
    const evidenceId = assertIdentifier("evidenceId", input.evidenceId);
    const runId = assertIdentifier("runId", input.runId);
    const command = typeof input.command === "string" ? input.command.trim() : "";
    if (command.length < 3 || command.length > 500 || input.completed !== true || !Number.isInteger(input.exitCode)) {
      throw new ReleaseCommandError("TEST_EVIDENCE_REQUIRED", "Test evidence needs runId, command, exitCode and completed=true.");
    }
    const passed = input.result === "passed" && input.exitCode === 0;
    const value = { releaseId: release.releaseId, evidenceId, runId, result: input.result, exitCode: input.exitCode, actor: input.actor };
    return remember(`TEST-EVIDENCE:${release.releaseId}`, input.idempotencyKey, value, () => execute(release, input, "release.test-evidence-recorded", passed ? "test-passed" : "blocked", {
      environment: "test",
      evidenceId,
      runId,
      command,
      exitCode: input.exitCode,
      result: passed ? "passed" : "failed",
      artifactId: release.artifactId,
      releaseVersion: release.releaseVersion,
      commitSha: release.commitSha
    }, next => ({ ...next, testEvidence: Object.freeze({ evidenceId, runId, command, exitCode: input.exitCode, result: passed ? "passed" : "failed", recordedAt: next.updatedAt }) })));
  }

  function requestProductionApproval(input) {
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const release = getRelease(assertIdentifier("releaseId", input.releaseId));
    if (release.state !== "test-passed") throw new ReleaseCommandError("TEST_EVIDENCE_REQUIRED", "A passing test evidence is required before production approval.");
    checkPrinciples(release.projectId, "release-production");
    const value = { releaseId: release.releaseId, action: "request-production-approval", actor: input.actor };
    return remember(`RELEASE:${release.releaseId}`, input.idempotencyKey, value, () => execute(release, input, "release.production-approval-requested", "awaiting-production-approval", {
      environment: "production",
      testedArtifactId: release.artifactId,
      testedVersion: release.releaseVersion,
      testedCommitSha: release.commitSha
    }));
  }

  function approveProduction(input) {
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const release = getRelease(assertIdentifier("releaseId", input.releaseId));
    if (release.state !== "awaiting-production-approval") throw new ReleaseCommandError("PRODUCTION_APPROVAL_REQUIRED", "This release is not waiting for production approval.");
    const value = { releaseId: release.releaseId, action: "approve-production", reason: input.reason ?? "", actor: input.actor };
    return remember(`RELEASE:${release.releaseId}`, input.idempotencyKey, value, () => execute(release, input, "release.production-approved", "production-approved", {
      environment: "production",
      decision: "approved",
      reason: input.reason ?? "owner-approved",
      artifactId: release.artifactId,
      releaseVersion: release.releaseVersion,
      commitSha: release.commitSha
    }, next => ({ ...next, productionApproval: Object.freeze({ decision: "approved", actorId: input.actor.id, reason: input.reason ?? "owner-approved", approvedAt: next.updatedAt }) })));
  }

  function requestProductionPromotion(input) {
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const release = getRelease(assertIdentifier("releaseId", input.releaseId));
    if (release.state !== "production-approved") throw new ReleaseCommandError("PRODUCTION_APPROVAL_REQUIRED", "Owner production approval is required first.");
    const commandId = assertIdentifier("commandId", input.commandId);
    const sensitiveApprovalReference = assertIdentifier("sensitiveApprovalReference", input.sensitiveApprovalReference);
    checkPrinciples(release.projectId, "release-production");
    const authorization = options.authorizeProduction?.({
      releaseId: release.releaseId,
      projectId: release.projectId,
      artifactId: release.artifactId,
      version: release.releaseVersion,
      commitSha: release.commitSha,
      sensitiveApprovalReference,
      actor: input.actor
    }) ?? { authorized: false, code: "PRODUCTION_AUTHORIZATION_REQUIRED" };
    if (!authorization?.authorized) throw new ReleaseCommandError("PRODUCTION_AUTHORIZATION_REQUIRED", "Separate production-deploy authorization is required.");
    const value = { releaseId: release.releaseId, action: "request-production-promotion", commandId, sensitiveApprovalReference, actor: input.actor };
    return remember(`RELEASE:${release.releaseId}`, input.idempotencyKey, value, () => execute(release, input, "release.production-promotion-requested", "production-promotion-requested", {
      environment: "production",
      commandId,
      sensitiveApprovalReference,
      grantDecisionCode: authorization.code ?? "AUTHORIZED",
      artifactId: release.artifactId,
      releaseVersion: release.releaseVersion,
      commitSha: release.commitSha
    }, next => ({
      ...next,
      productionPromotion: Object.freeze({ commandId, sensitiveApprovalReference, requestedAt: next.updatedAt }),
      productionEnvironment: Object.freeze({ ...next.productionEnvironment, status: "promotion-requested" })
    })));
  }

  function recordProductionDeployment(input) {
    assertActor(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    if (input.actor.kind !== "system") throw new ReleaseCommandError("SYSTEM_EVIDENCE_REQUIRED", "Only the deployment adapter may record production deployment evidence.");
    const release = getRelease(assertIdentifier("releaseId", input.releaseId));
    if (release.state !== "production-promotion-requested") throw new ReleaseCommandError("PRODUCTION_COMMAND_REQUIRED", "An approved production promotion command is required first.");
    assertSameArtifact(release, { ...input, environment: "production" }, "Production deployment");
    const deploymentId = assertIdentifier("deploymentId", input.deploymentId);
    if (input.completed !== true) throw new ReleaseCommandError("PRODUCTION_COMMAND_REQUIRED", "Production deployment evidence must be completed.");
    const value = { releaseId: release.releaseId, deploymentId, completed: true, actor: input.actor };
    return remember(`PRODUCTION-DEPLOYMENT:${release.releaseId}`, input.idempotencyKey, value, () => execute(release, input, "release.production-deployment-recorded", "production", {
      environment: "production",
      deploymentId,
      completed: true,
      artifactId: release.artifactId,
      releaseVersion: release.releaseVersion,
      commitSha: release.commitSha
    }, next => ({
      ...next,
      productionEnvironment: Object.freeze({ ...next.productionEnvironment, status: "deployed", deploymentId, deployedAt: next.updatedAt })
    })));
  }

  function rollback(input) {
    assertOwner(input?.actor);
    assertIdempotencyKey(input?.idempotencyKey);
    const release = getRelease(assertIdentifier("releaseId", input.releaseId));
    if (release.state !== "production") throw new ReleaseCommandError("INVALID_RELEASE_TRANSITION", "Only a production release can be rolled back.");
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason.length < 3 || reason.length > 500) throw new ReleaseCommandError("INVALID_INPUT", "Rollback reason is required.");
    const value = { releaseId: release.releaseId, action: "rollback", reason, actor: input.actor };
    return remember(`RELEASE:${release.releaseId}`, input.idempotencyKey, value, () => execute(release, input, "release.rolled-back", "rolled-back", { environment: "production", reason }));
  }

  function get(releaseId) {
    const release = releases.get(releaseId);
    return release ? copy(release) : null;
  }

  function list() {
    return Object.freeze([...releases.values()].sort((left, right) => left.releaseId.localeCompare(right.releaseId)).map(copy));
  }

  function history(releaseId) {
    return Object.freeze(eventLog.readAggregate("release", releaseId));
  }

  function snapshot() {
    return Object.freeze({
      contract: getReleaseContractSummary(),
      environments: RELEASE_ENVIRONMENTS,
      releases: list(),
      sourceOfTruth: "versioned-release-registry-and-append-only-events",
      liveDeploymentAdapter: "disabled"
    });
  }

  function persistenceSnapshot() {
    return copy({
      schemaVersion: "1.0",
      registryId: "release-promotion",
      releases: list()
    });
  }

  function hydrate(input = {}) {
    const state = input.data ?? input;
    if (!state || !Array.isArray(state.releases)) throw new ReleaseCommandError("HYDRATION_INVALID", "Release registry hydration requires releases.");
    if (Array.isArray(input.events)) eventLog.load(input.events.filter(event => event.aggregateType === "release"));
    releases.clear();
    for (const release of state.releases) {
      if (!release || typeof release !== "object" || typeof release.releaseId !== "string") throw new ReleaseCommandError("HYDRATION_INVALID", "A hydrated release is invalid.");
      releases.set(release.releaseId, copy(release));
    }
    idempotency.clear();
    return copy({ registryId: "release-promotion", hydrated: true, releases: releases.size });
  }

  return Object.freeze({
    register,
    requestTestDeployment,
    recordTestDeployment,
    recordTestEvidence,
    requestProductionApproval,
    approveProduction,
    requestProductionPromotion,
    recordProductionDeployment,
    rollback,
    get,
    list,
    history,
    snapshot,
    persistenceSnapshot,
    hydrate,
    contract: () => getReleaseContractSummary()
  });
}
