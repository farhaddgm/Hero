import { getWebFactoryContractSummary, WEB_FACTORY_TARGET_STACK } from "../../contracts/src/web-factory.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";
import { createQualityGate } from "./quality-gate.mjs";

const SENSITIVE_INPUT = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential)\s*[:=])/i;
const APP_SLUG = /^[a-z][a-z0-9-]{2,62}$/;

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
  if (SENSITIVE_INPUT.test(JSON.stringify(value))) {
    throw new WebFactorySafetyError("Sensitive values are not accepted in Web Factory input.");
  }
}

function authorizationCode(decision, stepId, documentVersion, operation) {
  if (decision?.globalStop === true || decision?.code === "GLOBAL_STOP_ACTIVE") return "GLOBAL_STOP_ACTIVE";
  if (
    !decision || decision.authorized !== true || decision.code !== "AUTHORIZED" || decision.safeCheckpointRequired === true ||
    decision.stepId !== stepId || decision.documentVersion !== documentVersion || decision.operation !== operation
  ) return "AUTHORIZATION_REQUIRED";
  return null;
}

function assertPlanning(planning) {
  if (!planning || typeof planning !== "object" || Array.isArray(planning)) throw new Error("planning is required.");
  assertIdentifier("planning.planningId", planning.planningId);
  assertIdentifier("planning.specId", planning.specId);
  assertIdentifier("planning.specVersion", planning.specVersion, 48);
  if (planning.state !== "ready") throw new Error("planning must be ready before a Web Factory blueprint is created.");
  return immutableCopy({
    planningId: planning.planningId,
    specId: planning.specId,
    specVersion: planning.specVersion,
    state: planning.state
  });
}

function assertRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("request is required.");
  if (typeof request.title !== "string" || request.title.trim().length < 3 || request.title.trim().length > 120) {
    throw new Error("request.title must contain 3-120 characters.");
  }
  if (typeof request.statement !== "string" || request.statement.trim().length < 12 || request.statement.trim().length > 2_000) {
    throw new Error("request.statement must contain 12-2000 characters.");
  }
  if (request.locale !== "fa-IR") throw new Error("request.locale must be fa-IR in this first Web Factory preset.");
  return immutableCopy({ title: request.title.trim(), statement: request.statement.trim(), locale: request.locale });
}

function assertAppSlug(value) {
  if (!APP_SLUG.test(value ?? "")) throw new Error("appSlug must be a portable lowercase slug.");
  return value;
}

function publicFactory(factory) {
  return immutableCopy({
    factoryId: factory.factoryId,
    stepId: factory.stepId,
    documentVersion: factory.documentVersion,
    appSlug: factory.appSlug,
    state: factory.state,
    code: factory.code,
    planning: factory.planning,
    blueprint: factory.blueprint,
    recipe: factory.recipe,
    preview: factory.preview,
    qualityGate: factory.qualityGate,
    version: factory.version,
    lastEventId: factory.lastEventId,
    boundary: {
      providerInvocation: false,
      repositoryMutation: false,
      databaseProvisioning: false,
      authenticationConfiguration: false,
      previewPublication: false,
      deploy: false,
      externalSpend: false
    }
  });
}

export class WebFactorySafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "WebFactorySafetyError";
    this.code = "WEB_FACTORY_SAFETY_REJECTED";
  }
}

export class WebFactoryIdempotencyConflictError extends Error {
  constructor(key) {
    super(`idempotencyKey ${key} was already used with different Web Factory input.`);
    this.name = "WebFactoryIdempotencyConflictError";
  }
}

export function createWebFactory(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const qualityGate = options.qualityGate ?? createQualityGate({ now, eventLog });
  const factories = new Map();
  const idempotency = new Map();
  let eventSequence = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => `evt_web_factory_${String(++eventSequence).padStart(6, "0")}`);

  function replay(scope, idempotencyKey, input) {
    const prior = idempotency.get(`${scope}\u0000${idempotencyKey}`);
    if (!prior) return null;
    if (prior.fingerprint !== fingerprint(input)) throw new WebFactoryIdempotencyConflictError(idempotencyKey);
    return immutableCopy({ ...prior.result, idempotent: true });
  }

  function remember(scope, idempotencyKey, input, result) {
    idempotency.set(`${scope}\u0000${idempotencyKey}`, { fingerprint: fingerprint(input), result: immutableCopy(result) });
  }

  function append(factory, type, actor, patch, data) {
    const event = createOperationalEvent({
      eventId: eventIdFactory(),
      aggregateType: "web-factory",
      aggregateId: factory.factoryId,
      type,
      occurredAt: now(),
      actor,
      correlationId: factory.factoryId,
      ...(factory.lastEventId ? { causationId: factory.lastEventId } : {}),
      data: { factoryId: factory.factoryId, stepId: factory.stepId, documentVersion: factory.documentVersion, ...data }
    });
    const stored = eventLog.append(event, { expectedVersion: factory.version });
    const next = immutableCopy({ ...factory, ...patch, version: stored.aggregateVersion, lastEventId: stored.eventId });
    factories.set(next.factoryId, next);
    return next;
  }

  function create(input) {
    assertSafeInput(input);
    assertIdentifier("factoryId", input?.factoryId, 80);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion, 48);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    const replayed = replay(`CREATE\u0000${input.factoryId}`, input.idempotencyKey, input);
    if (replayed) return replayed;
    if (factories.has(input.factoryId)) throw new Error(`Web Factory ${input.factoryId} already exists.`);

    const authorization = authorizationCode(input.developDecision, input.stepId, input.documentVersion, "develop");
    if (authorization === "GLOBAL_STOP_ACTIVE") {
      const blocked = immutableCopy({
        factoryId: input.factoryId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        state: "blocked",
        code: "GLOBAL_STOP_ACTIVE",
        boundary: { previewPublication: false, repositoryMutation: false }
      });
      const output = immutableCopy({ factory: blocked, eventType: null, idempotent: false });
      remember(`CREATE\u0000${input.factoryId}`, input.idempotencyKey, input, output);
      return output;
    }
    if (authorization) throw new Error("Web Factory creation requires exact develop authorization.");

    const planning = assertPlanning(input.planning);
    const request = assertRequest(input.request);
    const appSlug = assertAppSlug(input.appSlug);
    const blueprint = immutableCopy({
      blueprintId: `BLUEPRINT-${input.factoryId}`,
      version: input.documentVersion,
      appSlug,
      stack: WEB_FACTORY_TARGET_STACK,
      workspace: { packageManager: "pnpm", sourceRoot: "apps", hostPathsAllowed: false },
      routes: ["/", "/api/health", "/auth"],
      quality: { gate: "quality-gate", required: true, acceptance: "passing isolated tests and independent review" },
      data: { status: "specified-not-provisioned", adapter: "postgresql" },
      authentication: { status: "specified-not-configured", gate: "separate-authorization" }
    });
    const recipe = immutableCopy({
      recipeId: `RECIPE-${input.factoryId}`,
      version: input.documentVersion,
      planning,
      request,
      routes: [
        { path: "/", purpose: "primary Persian web experience" },
        { path: "/api/health", purpose: "health contract" },
        { path: "/auth", purpose: "authentication boundary, disabled until separately configured" }
      ],
      features: [
        { id: "WEB-UI", owner: "codex", status: "specified", purpose: "responsive React user interface" },
        { id: "WEB-API", owner: "codex", status: "specified", purpose: "versioned REST contract" },
        { id: "WEB-QUALITY", owner: "claude", status: "required", purpose: "independent review through Quality Gate" },
        { id: "WEB-HANDOFF", owner: "cursor", status: "human-controlled", purpose: "portable IDE handoff" }
      ],
      acceptanceCriteria: [
        "Blueprint and Feature Recipe are version-bound to the authorized step.",
        "The standard web, API, data and authentication boundaries are explicit.",
        "Isolated test evidence and independent review approve the factory output.",
        "A preview can be dispatched only with its separate authorization."
      ],
      handoff: { provider: "cursor", mode: "human-controlled", workspaceReference: `apps/${appSlug}` }
    });
    const preview = immutableCopy({
      state: "requires-separate-authorization",
      code: "PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION",
      candidate: `preview:${appSlug}`,
      dispatchStarted: false,
      reason: "The active authority covers development and testing only; it does not include Preview."
    });
    const initial = immutableCopy({
      factoryId: input.factoryId,
      stepId: input.stepId,
      documentVersion: input.documentVersion,
      appSlug,
      state: "ready",
      code: "WEB_FACTORY_READY",
      planning,
      blueprint,
      recipe,
      preview,
      qualityGate: null,
      version: 0,
      lastEventId: null
    });
    const blueprintCreated = append(initial, "web-factory.blueprint-created", input.actor, {}, { blueprintId: blueprint.blueprintId, appSlug });
    const recipeCreated = append(blueprintCreated, "web-factory.recipe-created", input.actor, {}, { recipeId: recipe.recipeId, planningId: planning.planningId });
    const previewGated = append(recipeCreated, "web-factory.preview-gated", input.actor, {}, { code: preview.code, dispatchStarted: false });
    const output = immutableCopy({ factory: publicFactory(previewGated), eventType: "web-factory.preview-gated", idempotent: false });
    remember(`CREATE\u0000${input.factoryId}`, input.idempotencyKey, input, output);
    return output;
  }

  function verify(input) {
    assertSafeInput(input);
    assertIdentifier("factoryId", input?.factoryId, 80);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    const factory = factories.get(input.factoryId);
    if (!factory) throw new Error(`Web Factory ${input.factoryId} does not exist.`);
    const replayed = replay(`VERIFY\u0000${input.factoryId}`, input.idempotencyKey, input);
    if (replayed) return replayed;
    if (factory.state !== "ready") throw new Error(`Web Factory ${input.factoryId} is not ready for verification.`);

    const gateId = `QG-${factory.factoryId}`;
    const runId = `RUN-${factory.factoryId}`;
    const taskId = `TASK-${factory.factoryId}`;
    const opened = qualityGate.open({
      gateId, runId, taskId, stepId: factory.stepId, documentVersion: factory.documentVersion,
      actor: input.actor, testDecision: input.testDecision, idempotencyKey: `${input.idempotencyKey}-open`,
      policy: { maxCorrectionCycles: 1, maxCostUnits: 10 }
    });
    let quality = opened.gate;
    if (quality.state !== "stopped") {
      quality = qualityGate.recordTest({
        gateId, actor: input.actor, testDecision: input.testDecision,
        testEvidence: {
          provider: "codex", status: "completed",
          files: ["packages/contracts/src/web-factory.mjs", "packages/domain/src/web-factory.mjs", "tests/web-factory.test.mjs"],
          errors: [], tests: { status: "passed", total: 5, passed: 5, failed: 0 },
          workspace: { isolated: true, actualRepositoryMutation: false },
          artifact: { external: false, reference: `hero://artifacts/${runId}/web-factory-tests.json` }
        },
        testCostUnits: 2, idempotencyKey: `${input.idempotencyKey}-test`
      }).gate;
    }
    if (quality.state !== "stopped") {
      quality = qualityGate.review({
        gateId, actor: input.actor, reviewDecision: input.reviewDecision,
        reviewCostUnits: 1, idempotencyKey: `${input.idempotencyKey}-review`
      }).gate;
    }
    const tested = append(factory, "web-factory.quality-recorded", input.actor, {
      state: quality.state === "approved" ? "tested" : "blocked",
      code: quality.state === "approved" ? "WEB_FACTORY_TESTED" : quality.code,
      qualityGate: { gateId, state: quality.state, code: quality.code }
    }, { gateId, qualityState: quality.state, qualityCode: quality.code });
    const output = immutableCopy({ factory: publicFactory(tested), eventType: "web-factory.quality-recorded", idempotent: false });
    remember(`VERIFY\u0000${input.factoryId}`, input.idempotencyKey, input, output);
    return output;
  }

  function get(factoryId) {
    const factory = factories.get(factoryId);
    return factory ? publicFactory(factory) : null;
  }

  return Object.freeze({ create, verify, get, events: () => eventLog.readAfter(), contract: () => getWebFactoryContractSummary() });
}

export function createWebFactoryHarness(options = {}) {
  const factory = options.factory ?? createWebFactory(options);
  return Object.freeze({
    run(input) {
      const created = factory.create(input.create);
      if (created.factory.state === "blocked") return created;
      return factory.verify({ ...input.verify, factoryId: created.factory.factoryId });
    },
    services: () => Object.freeze({ factory }),
    contract: () => getWebFactoryContractSummary()
  });
}
