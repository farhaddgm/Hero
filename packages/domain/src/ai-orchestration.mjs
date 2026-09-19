import {
  AI_DECISION_REQUESTS,
  AI_DECISION_STATES,
  AI_DEFAULT_ROLE_POLICIES,
  AI_EVALUATION_VERDICTS,
  AI_CONTEXT_RECIPIENT_ROLES,
  AI_OUTPUT_SCHEMAS,
  AI_PROJECT_SCOPE_CAPABILITIES,
  AI_PROJECT_SCOPE_MODES,
  AI_PROFILE_STATUSES,
  AI_PROVIDER_IDS,
  AI_PROVIDER_MODES,
  AI_ROLES,
  AI_TOOL_POLICIES,
  getAiOrchestrationContractSummary
} from "../../contracts/src/ai-orchestration.mjs";
import { createOperationalEvent, SENSITIVE_ACTIONS } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const SYSTEM = Object.freeze({ kind: "system", id: "hero-ai-orchestration" });
const ACTOR_KINDS = new Set(["project-owner", "admin", "orchestrator", "agent", "system"]);
const SENSITIVE_FIELD = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|private[_-]?key)/i;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const SENSITIVE_ASSIGNMENT = /((?:\b(?:password|secret|credential|api[ _-]?key|token|mfa|رمز(?:\s*عبور)?|کلید\s*api)\b\s*[:=]\s*))[^\s,;]+/giu;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|opt)\/)/;
const SIMPLE_CREDENTIAL_REFERENCE = /^(?:runtime|env):[A-Za-z0-9._:-]{3,120}$/;

function isSafeCredentialReference(value) {
  if (typeof value !== "string") return false;
  if (SIMPLE_CREDENTIAL_REFERENCE.test(value)) return true;
  if (!value.startsWith("vault:")) return false;
  const segments = value.slice("vault:".length).split("/");
  return segments.length >= 2
    && segments.length <= 5
    && value.length <= 160
    && segments.every(segment => /^[A-Za-z0-9._:-]{1,80}$/.test(segment) && segment !== "." && segment !== "..");
}

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
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(value) || value.length > maximum) {
    throw new AiOrchestrationError("INVALID_IDENTIFIER", `${label} is invalid.`);
  }
  return value;
}

function assertText(label, value, { minimum = 3, maximum = 2_000 } = {}) {
  if (typeof value !== "string" || value.trim().length < minimum || value.trim().length > maximum) {
    throw new AiOrchestrationError("INVALID_TEXT", `${label} must be ${minimum}-${maximum} characters.`);
  }
  const normalized = value.trim();
  if (SENSITIVE_VALUE.test(normalized) || HOST_PATH.test(normalized)) {
    throw new AiOrchestrationError("SENSITIVE_INPUT_REJECTED", `${label} contains a sensitive value or host path.`);
  }
  return normalized;
}

function safeErrorMessage(error, fallback = "Provider execution failed.") {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message || message.length > 500 || SENSITIVE_VALUE.test(message) || HOST_PATH.test(message)) return fallback;
  return message;
}

function sanitizeProviderOutput(value, path = "output", depth = 0) {
  if (depth > 8) throw new AiOrchestrationError("OUTPUT_SCHEMA_INVALID", "Provider output nesting is too deep.");
  if (typeof value === "string") {
    return value
      .replace(SENSITIVE_ASSIGNMENT, "$1[redacted]")
      .replace(SENSITIVE_VALUE, "[redacted]")
      .replace(HOST_PATH, "[redacted]")
      .slice(0, 8_000);
  }
  if (Array.isArray(value)) return value.map((item, index) => sanitizeProviderOutput(item, `${path}[${index}]`, depth + 1));
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_FIELD.test(key)) throw new AiOrchestrationError("OUTPUT_SENSITIVE_REJECTED", `${path}.${key} is not allowed in provider output.`);
      result[key] = sanitizeProviderOutput(child, `${path}.${key}`, depth + 1);
    }
    return result;
  }
  return value;
}

function assertSafePayload(value, path = "input") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafePayload(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const safeCredentialReference = key === "credentialRef" && isSafeCredentialReference(child);
      const safeAuthorizationBoundary = key === "authorizationCreated" && typeof child === "boolean";
      if (SENSITIVE_FIELD.test(key) && !safeCredentialReference && !safeAuthorizationBoundary) {
        throw new AiOrchestrationError("SENSITIVE_INPUT_REJECTED", `${path}.${key} is not allowed.`);
      }
      assertSafePayload(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && (SENSITIVE_VALUE.test(value) || HOST_PATH.test(value))) {
    throw new AiOrchestrationError("SENSITIVE_INPUT_REJECTED", `${path} contains a sensitive value or host path.`);
  }
}

function assertActor(actor, { ownerOnly = false } = {}) {
  if (!actor || !ACTOR_KINDS.has(actor.kind) || typeof actor.id !== "string" || actor.id.length < 3) {
    throw new AiOrchestrationError("INVALID_ACTOR", "actor is invalid.");
  }
  if (ownerOnly && actor.kind !== "project-owner") {
    throw new AiOrchestrationError("OWNER_APPROVAL_REQUIRED", "This AI configuration change requires the project owner.");
  }
  return immutableCopy({ kind: actor.kind, id: actor.id });
}

function assertCatalogActor(actor) {
  const normalized = assertActor(actor);
  if (!['project-owner', 'admin'].includes(normalized.kind)) {
    throw new AiOrchestrationError('ADMIN_APPROVAL_REQUIRED', 'AI catalog changes require the project owner or an admin.');
  }
  return normalized;
}

function assertEnum(label, value, values) {
  if (!values.includes(value)) throw new AiOrchestrationError("INVALID_ENUM", `${label} is not supported.`);
  return value;
}

function assertCredentialReference(value) {
  if (!isSafeCredentialReference(value)) {
    throw new AiOrchestrationError("INVALID_CREDENTIAL_REFERENCE", "credentialRef must be a runtime reference, never a secret value.");
  }
  return value;
}

function assertPositiveInteger(label, value, { minimum = 1, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new AiOrchestrationError("INVALID_NUMBER", `${label} is invalid.`);
  }
  return value;
}

function assertNonNegativeInteger(label, value, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new AiOrchestrationError("INVALID_NUMBER", `${label} is invalid.`);
  }
  return value;
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new AiOrchestrationError("PROVIDER_TIMEOUT", `Provider did not respond within ${timeoutMs}ms.`);
      error.retryable = true;
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeCircuitBreaker(value) {
  if (value === false) return null;
  const input = value && typeof value === "object" ? value : {};
  const failureThreshold = input.failureThreshold ?? 3;
  const resetTimeoutMs = input.resetTimeoutMs ?? 30_000;
  if (!Number.isInteger(failureThreshold) || failureThreshold < 1 || failureThreshold > 20) {
    throw new AiOrchestrationError("INVALID_NUMBER", "circuitBreaker.failureThreshold must be between 1 and 20.");
  }
  if (!Number.isInteger(resetTimeoutMs) || resetTimeoutMs < 1_000 || resetTimeoutMs > 86_400_000) {
    throw new AiOrchestrationError("INVALID_NUMBER", "circuitBreaker.resetTimeoutMs must be between 1000 and 86400000.");
  }
  return Object.freeze({ failureThreshold, resetTimeoutMs });
}

function circuitFailure(error) {
  const code = error?.code;
  return !["COST_LIMIT_REACHED", "OUTPUT_SCHEMA_INVALID", "USAGE_INVALID"].includes(code);
}

function hasSeparateExternalSpendAuthorization(input, projectId) {
  const authorization = input?.externalSpendAuthorization;
  if (!authorization || typeof authorization !== "object" || Array.isArray(authorization)) return false;
  if (authorization.authorized !== true || authorization.action !== "external-spend" || authorization.code !== "AUTHORIZED") return false;
  if (authorization.globalStop === true || authorization.safeCheckpointRequired === true) return false;
  if (typeof authorization.authorizationId !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(authorization.authorizationId)) return false;
  if (typeof authorization.stepId !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(authorization.stepId)) return false;
  if (typeof authorization.documentVersion !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,47}$/.test(authorization.documentVersion)) return false;
  if (!AI_PROJECT_SCOPE_CAPABILITIES.includes(authorization.capability)) return false;
  if (authorization.projectId !== undefined && authorization.projectId !== projectId) return false;
  return true;
}

function normalizeUsage(usage) {
  const value = usage ?? {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AiOrchestrationError("USAGE_INVALID", "Provider usage must be a structured object.");
  const pricing = value.pricing === undefined || value.pricing === null ? null : assertObject("usage.pricing", value.pricing);
  const inputTokens = assertNonNegativeInteger("usage.inputTokens", value.inputTokens ?? 0);
  const cachedInputTokens = assertNonNegativeInteger("usage.cachedInputTokens", value.cachedInputTokens ?? 0);
  if (cachedInputTokens > inputTokens) throw new AiOrchestrationError("USAGE_INVALID", "usage.cachedInputTokens cannot exceed usage.inputTokens.");
  return immutableCopy({
    inputTokens,
    outputTokens: assertNonNegativeInteger("usage.outputTokens", value.outputTokens ?? 0),
    cachedInputTokens,
    totalTokens: assertNonNegativeInteger("usage.totalTokens", value.totalTokens ?? 0),
    costUnits: assertNonNegativeInteger("usage.costUnits", value.costUnits ?? 0, 100_000),
    pricing
  });
}

function assertObject(label, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AiOrchestrationError("INVALID_OBJECT", `${label} must be an object.`);
  }
  assertSafePayload(value, label);
  return value;
}

function assertStructuredResponse(profile, response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new AiOrchestrationError("OUTPUT_SCHEMA_INVALID", "Provider response must be a structured object.");
  }
  // Usage and adapter metadata are checked as a whole, while provider output
  // is sanitized independently so a model cannot echo a credential or host
  // path into the persisted invocation/evidence projection.
  const { output, ...metadata } = response;
  assertObject("provider response", metadata);
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new AiOrchestrationError("OUTPUT_SCHEMA_INVALID", "Provider response must contain a structured output object.");
  }
  const safeOutput = sanitizeProviderOutput(output);
  if (safeOutput.schema !== profile.outputSchema) {
    throw new AiOrchestrationError("OUTPUT_SCHEMA_INVALID", `Provider output schema must be ${profile.outputSchema}.`);
  }
  return { ...metadata, output: safeOutput };
}

function eventIdFactory() {
  let sequence = 0;
  return () => `evt_ai_${String(++sequence).padStart(6, "0")}`;
}

function commandScope(kind, id, idempotencyKey) {
  return `${kind}:${id}\u0000${idempotencyKey}`;
}

function roleBindingKey({ projectId, teamId = null, skillId = null, role }) {
  return [projectId, teamId ?? "*", skillId ?? "*", role].join("\u0000");
}

function projectScopeAllows(scope, capability) {
  if (!scope) return true;
  if (scope.mode === "disabled") return false;
  return scope.capabilities.includes(capability);
}

export class AiOrchestrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AiOrchestrationError";
    this.code = code;
  }
}

export class AiIdempotencyConflictError extends AiOrchestrationError {
  constructor(idempotencyKey) {
    super("IDEMPOTENCY_CONFLICT", `idempotencyKey ${idempotencyKey} was reused with different input.`);
  }
}

export function createDeterministicAiProviderAdapter(providerId = "deterministic", handler) {
  assertEnum("providerId", providerId, AI_PROVIDER_IDS);
  if (typeof handler !== "function") {
    handler = input => ({
      schema: input.outputSchema,
      role: input.role,
      modelId: input.modelId,
      summary: "deterministic-provider-result"
    });
  }
  return Object.freeze({
    providerId,
    mode: "deterministic",
    async generate(input) {
      const output = await handler(input);
      assertObject("provider response", output);
      return immutableCopy({
        output,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUnits: 0 }
      });
    },
    async validateConnection() {
      return Object.freeze({ status: "ok", providerId });
    },
    listCapabilities() {
      return Object.freeze([]);
    }
  });
}

export function createAiOrchestration(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  const clock = options.clock ?? (() => Date.now());
  const circuitBreaker = normalizeCircuitBreaker(options.circuitBreaker);
  const projectMemory = options.projectMemory ?? null;
  const providerAdapters = options.providerAdapters ?? Object.freeze({});
  const externalSpendAuthorizer = options.externalSpendAuthorizer ?? null;
  const skillRegistry = options.skillRegistry ?? null;
  const nextEventId = options.eventIdFactory ?? eventIdFactory();
  const providers = new Map();
  const models = new Map();
  const profiles = new Map();
  const bindings = new Map();
  const currentBindings = new Map();
  const invocations = new Map();
  const evaluations = new Map();
  const decisions = new Map();
  const projectScopes = new Map();
  const circuitStates = new Map();
  const externalSpendBudgets = new Map();
  const rolePolicies = new Map(Object.entries(options.defaultRolePolicies ?? AI_DEFAULT_ROLE_POLICIES).map(([role, policy]) => [role, { ...policy, role, policyVersion: policy.policyVersion ?? 1 }]));
  const idempotency = new Map();

  function appendEvent({ aggregateType, aggregateId, type, actor, data, correlationId, causationId }) {
    const event = createOperationalEvent({
      eventId: nextEventId(),
      aggregateType,
      aggregateId,
      type,
      occurredAt: now(),
      actor,
      data,
      correlationId,
      causationId
    });
    return eventLog.append(event, { expectedVersion: eventLog.currentVersion(aggregateType, aggregateId) });
  }

  function reserveExternalSpend(authorization, profile) {
    const approvalId = authorization.authorizationId;
    const maximum = authorization.maxCostUnits;
    const reservationCostUnits = profile.maxCostUnits * (profile.maxRetries + 1);
    const current = externalSpendBudgets.get(approvalId) ?? { approvalId, maxCostUnits: maximum, spentCostUnits: 0, reservedCostUnits: 0 };
    if (current.maxCostUnits !== maximum) {
      return { accepted: false, code: "EXTERNAL_SPEND_BUDGET_VERSION_CONFLICT", reason: "The authorization budget changed without a new authorization id." };
    }
    if (!Number.isSafeInteger(reservationCostUnits) || reservationCostUnits < 1 || current.spentCostUnits + current.reservedCostUnits + reservationCostUnits > maximum) {
      return { accepted: false, code: "EXTERNAL_SPEND_BUDGET_EXHAUSTED", reason: "The remaining authorization budget cannot cover the conservative invocation and retry limit." };
    }
    externalSpendBudgets.set(approvalId, immutableCopy({ ...current, reservedCostUnits: current.reservedCostUnits + reservationCostUnits }));
    return immutableCopy({ accepted: true, approvalId, reservationCostUnits, maxCostUnits: maximum });
  }

  function settleExternalSpend(reservation, costUnits) {
    if (!reservation) return null;
    const current = externalSpendBudgets.get(reservation.approvalId);
    if (!current) throw new AiOrchestrationError("EXTERNAL_SPEND_BUDGET_INVALID", "The external-spend reservation is missing.");
    const accountedCostUnits = Math.min(reservation.reservationCostUnits, Math.max(0, costUnits));
    const next = immutableCopy({
      ...current,
      spentCostUnits: current.spentCostUnits + accountedCostUnits,
      reservedCostUnits: Math.max(0, current.reservedCostUnits - reservation.reservationCostUnits)
    });
    externalSpendBudgets.set(reservation.approvalId, next);
    return immutableCopy({ approvalId: reservation.approvalId, accountedCostUnits, remainingCostUnits: Math.max(0, next.maxCostUnits - next.spentCostUnits - next.reservedCostUnits) });
  }

  function replayOrThrow(scope, value) {
    const existing = idempotency.get(scope);
    if (!existing) return null;
    if (existing.fingerprint !== fingerprint(value)) throw new AiIdempotencyConflictError(scope.split("\u0000").at(-1));
    return immutableCopy({ ...existing.result, idempotent: true });
  }

  function remember(scope, value, result) {
    idempotency.set(scope, { fingerprint: fingerprint(value), result: immutableCopy(result) });
    return result;
  }

  function readProvider(providerId) {
    const provider = providers.get(providerId);
    if (!provider) throw new AiOrchestrationError("PROVIDER_NOT_FOUND", `Provider ${providerId} was not registered.`);
    return provider;
  }

  function readProfile(profileId) {
    const profile = profiles.get(profileId);
    if (!profile) throw new AiOrchestrationError("PROFILE_NOT_FOUND", `Agent Profile ${profileId} was not registered.`);
    return profile;
  }

  function readSkill(skillId) {
    if (!skillId) return null;
    if (!skillRegistry || typeof skillRegistry.get !== "function") {
      throw new AiOrchestrationError("SKILL_REGISTRY_NOT_CONFIGURED", "A skill binding requires a configured Skill Registry.");
    }
    const skill = skillRegistry.get(skillId);
    if (!skill) throw new AiOrchestrationError("SKILL_NOT_FOUND", `Skill ${skillId} was not registered.`);
    if (skill.status !== "active") throw new AiOrchestrationError("SKILL_NOT_ACTIVE", "Only an active Skill can be bound.");
    return skill;
  }

  function circuitSnapshot(providerId) {
    const state = circuitStates.get(providerId) ?? { state: "closed", failureCount: 0, openedAt: null, probeInFlight: false, lastFailureAt: null };
    return { ...state };
  }

  function circuitAllowance(providerId) {
    if (!circuitBreaker) return { allowed: true, probe: false, state: "disabled" };
    const state = circuitStates.get(providerId) ?? { state: "closed", failureCount: 0, openedAt: null, probeInFlight: false, lastFailureAt: null };
    if (state.state === "open") {
      const openedAt = Date.parse(state.openedAt ?? "");
      if (!Number.isFinite(openedAt) || clock() - openedAt < circuitBreaker.resetTimeoutMs) {
        return { allowed: false, probe: false, state: "open" };
      }
      state.state = "half-open";
      state.probeInFlight = false;
    }
    if (state.state === "half-open") {
      if (state.probeInFlight) return { allowed: false, probe: false, state: "half-open" };
      state.probeInFlight = true;
      circuitStates.set(providerId, state);
      return { allowed: true, probe: true, state: "half-open" };
    }
    circuitStates.set(providerId, state);
    return { allowed: true, probe: false, state: "closed" };
  }

  function recordCircuitFailure(providerId, actor, { probe = false, code } = {}) {
    if (!circuitBreaker) return;
    const current = circuitStates.get(providerId) ?? { state: "closed", failureCount: 0, openedAt: null, probeInFlight: false, lastFailureAt: null };
    current.failureCount += 1;
    current.lastFailureAt = now();
    current.probeInFlight = false;
    const opened = probe || current.failureCount >= circuitBreaker.failureThreshold;
    current.state = opened ? "open" : "closed";
    if (opened) current.openedAt = current.lastFailureAt;
    circuitStates.set(providerId, current);
    if (opened) {
      appendEvent({
        aggregateType: "ai-provider",
        aggregateId: providerId,
        type: "ai.provider-circuit-opened",
        actor,
        data: { providerId, status: "open", code: code ?? "PROVIDER_EXECUTION_FAILED", attempts: current.failureCount }
      });
    }
  }

  function recordCircuitSuccess(providerId, actor, { probe = false } = {}) {
    if (!circuitBreaker) return;
    const current = circuitStates.get(providerId);
    if (!current || (current.failureCount === 0 && current.state === "closed")) return;
    const wasOpen = current.state === "open" || current.state === "half-open" || probe;
    circuitStates.set(providerId, { state: "closed", failureCount: 0, openedAt: null, probeInFlight: false, lastFailureAt: null });
    if (wasOpen) {
      appendEvent({
        aggregateType: "ai-provider",
        aggregateId: providerId,
        type: "ai.provider-circuit-closed",
        actor,
        data: { providerId, status: "closed", code: "PROVIDER_RECOVERED" }
      });
    }
  }

  function resolveBinding({ projectId, teamId = null, skillId = null, role }) {
    const candidates = [...currentBindings.values()]
      .filter(binding => binding.projectId === projectId && binding.role === role)
      .map(binding => {
        const teamMatch = binding.teamId === null || binding.teamId === teamId;
        const skillMatch = binding.skillId === null || binding.skillId === skillId;
        if (!teamMatch || !skillMatch) return null;
        const specificity = (binding.teamId === null ? 0 : 2) + (binding.skillId === null ? 0 : 1);
        return { binding, specificity };
      })
      .filter(Boolean)
      .sort((left, right) => right.specificity - left.specificity || String(right.binding.boundAt).localeCompare(String(left.binding.boundAt)));
    return candidates[0]?.binding ?? null;
  }

  function setDefaultRolePolicy(input = {}) {
    const actor = assertActor(input.actor);
    if (!["project-owner", "admin"].includes(actor.kind)) {
      throw new AiOrchestrationError("ADMIN_APPROVAL_REQUIRED", "Changing the default AI policy requires the project owner or an admin.");
    }
    const role = assertEnum("role", input.role, AI_ROLES);
    const providerId = assertEnum("providerId", input.providerId, AI_PROVIDER_IDS);
    const modelId = assertIdentifier("modelId", input.modelId);
    const toolPolicy = assertEnum("toolPolicy", input.toolPolicy ?? AI_DEFAULT_ROLE_POLICIES[role]?.toolPolicy, AI_TOOL_POLICIES);
    if (role !== "executor" && toolPolicy === "development") {
      throw new AiOrchestrationError("INVALID_POLICY_BOUNDARY", "Only the executor role can use the development tool policy.");
    }
    readProvider(providerId);
    if (!models.has(`${providerId}\u0000${modelId}`)) throw new AiOrchestrationError("MODEL_NOT_FOUND", `Model ${providerId}/${modelId} was not registered.`);
    const current = rolePolicies.get(role);
    const policyVersion = (current?.policyVersion ?? 0) + 1;
    const value = { role, providerId, modelId, toolPolicy, policyVersion };
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const scope = commandScope("role-policy", role, idempotencyKey);
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    const event = appendEvent({
      aggregateType: "ai-role-policy",
      aggregateId: role,
      type: "ai.role-policy-updated",
      actor,
      data: value
    });
    const policy = immutableCopy({ ...value, updatedAt: event.occurredAt, eventId: event.eventId });
    rolePolicies.set(role, policy);
    return remember(scope, value, { policy, idempotent: false });
  }

  function rolePolicyHistory(role) {
    const normalizedRole = assertEnum("role", role, AI_ROLES);
    return Object.freeze(eventLog.readAfter()
      .filter(event => event.type === "ai.role-policy-updated" && event.aggregateType === "ai-role-policy" && event.data?.role === normalizedRole)
      .sort((left, right) => (left.aggregateVersion ?? 0) - (right.aggregateVersion ?? 0))
      .map(event => immutableCopy({
        eventId: event.eventId,
        version: event.aggregateVersion,
        policyVersion: event.data.policyVersion,
        role: event.data.role,
        providerId: event.data.providerId,
        modelId: event.data.modelId,
        toolPolicy: event.data.toolPolicy,
        occurredAt: event.occurredAt,
        actor: event.actor
      })));
  }

  function rollbackRolePolicy(input = {}) {
    const actor = assertActor(input.actor);
    if (!["project-owner", "admin"].includes(actor.kind)) {
      throw new AiOrchestrationError("ADMIN_APPROVAL_REQUIRED", "Rolling back an AI policy requires the project owner or an admin.");
    }
    const role = assertEnum("role", input.role, AI_ROLES);
    const targetEventId = assertIdentifier("targetEventId", input.targetEventId, 160);
    const current = rolePolicies.get(role);
    if (input.expectedVersion !== undefined && input.expectedVersion !== current?.policyVersion) {
      throw new AiOrchestrationError("VERSION_CONFLICT", "The AI policy is stale; reload it before rollback.");
    }
    const target = eventLog.readAfter().find(event =>
      event.type === "ai.role-policy-updated" && event.aggregateType === "ai-role-policy" && event.data?.role === role && event.eventId === targetEventId
    );
    if (!target) throw new AiOrchestrationError("ROLLBACK_TARGET_NOT_FOUND", "The selected AI policy version cannot be rolled back.");
    if (target.data.policyVersion === current?.policyVersion) {
      throw new AiOrchestrationError("ROLLBACK_NOOP", "The selected AI policy is already active.");
    }
    return setDefaultRolePolicy({
      role,
      providerId: target.data.providerId,
      modelId: target.data.modelId,
      toolPolicy: target.data.toolPolicy,
      actor,
      idempotencyKey: input.idempotencyKey
    });
  }

  function registerProvider(input = {}) {
    const actor = assertCatalogActor(input.actor);
    const providerId = assertEnum("providerId", input.providerId, AI_PROVIDER_IDS);
    const mode = assertEnum("mode", input.mode, AI_PROVIDER_MODES);
    const displayName = assertText("displayName", input.displayName ?? providerId, { maximum: 160 });
    const capabilities = input.capabilities === undefined ? [] : input.capabilities;
    const adapter = input.adapter ?? (mode === "deterministic" ? createDeterministicAiProviderAdapter(providerId) : null);
    if (!Array.isArray(capabilities)) throw new AiOrchestrationError("INVALID_CAPABILITIES", "capabilities must be an array.");
    capabilities.forEach((capability, index) => assertText(`capabilities[${index}]`, capability, { maximum: 120 }));
    if (mode !== "disabled" && (!adapter || typeof adapter.generate !== "function")) {
      throw new AiOrchestrationError("INVALID_PROVIDER_ADAPTER", "A non-disabled provider requires a generate adapter.");
    }
    if (mode !== "disabled" && (adapter.providerId !== providerId || adapter.mode !== mode)) {
      throw new AiOrchestrationError("INVALID_PROVIDER_ADAPTER", "Provider adapter identity and mode must match the registered Provider.");
    }
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const value = { providerId, mode, displayName, capabilities };
    const scope = commandScope("provider", providerId, idempotencyKey);
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    if (providers.has(providerId)) throw new AiOrchestrationError("PROVIDER_EXISTS", `Provider ${providerId} already exists.`);
    const event = appendEvent({
      aggregateType: "ai-provider",
      aggregateId: providerId,
      type: "ai.provider-registered",
      actor,
      data: { providerId, mode, displayName, capabilities }
    });
    const provider = immutableCopy({ providerId, mode, displayName, capabilities, registeredAt: event.occurredAt, eventId: event.eventId });
    providers.set(providerId, { ...provider, adapter });
    return remember(scope, value, { provider, idempotent: false });
  }

  function registerModel(input = {}) {
    const actor = assertCatalogActor(input.actor);
    const providerId = assertEnum("providerId", input.providerId, AI_PROVIDER_IDS);
    const provider = readProvider(providerId);
    const modelId = assertIdentifier("modelId", input.modelId);
    const displayName = assertText("displayName", input.displayName ?? modelId, { maximum: 160 });
    const metadata = input.metadata === undefined ? {} : assertObject("metadata", input.metadata);
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const key = `${providerId}\u0000${modelId}`;
    const value = { providerId, modelId, displayName, metadata };
    const scope = commandScope("model", key, idempotencyKey);
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    if (models.has(key)) throw new AiOrchestrationError("MODEL_EXISTS", `Model ${providerId}/${modelId} already exists.`);
    const event = appendEvent({
      aggregateType: "ai-model",
      aggregateId: `${providerId}:${modelId}`,
      type: "ai.model-registered",
      actor,
      data: { providerId, modelId, displayName, metadata }
    });
    const model = immutableCopy({ providerId, modelId, displayName, metadata, registeredAt: event.occurredAt, eventId: event.eventId });
    models.set(key, model);
    return remember(scope, value, { model, provider: provider.providerId, idempotent: false });
  }

  function registerProfile(input = {}) {
    const actor = assertCatalogActor(input.actor);
    const profileId = assertIdentifier("profileId", input.profileId);
    const role = assertEnum("role", input.role, AI_ROLES);
    const providerId = assertEnum("providerId", input.providerId, AI_PROVIDER_IDS);
    const modelId = assertIdentifier("modelId", input.modelId);
    readProvider(providerId);
    if (!models.has(`${providerId}\u0000${modelId}`)) {
      throw new AiOrchestrationError("MODEL_NOT_FOUND", `Model ${providerId}/${modelId} was not registered.`);
    }
    const credentialRef = assertCredentialReference(input.credentialRef);
    const promptVersion = assertIdentifier("promptVersion", input.promptVersion);
    const contextPolicy = assertIdentifier("contextPolicy", input.contextPolicy);
    const toolPolicy = assertEnum("toolPolicy", input.toolPolicy, AI_TOOL_POLICIES);
    const outputSchema = assertEnum("outputSchema", input.outputSchema, AI_OUTPUT_SCHEMAS);
    const status = assertEnum("status", input.status ?? "draft", AI_PROFILE_STATUSES);
    const timeoutMs = assertPositiveInteger("timeoutMs", input.timeoutMs ?? 120_000, { minimum: 100, maximum: 600_000 });
    const maxRetries = assertPositiveInteger("maxRetries", input.maxRetries ?? 0, { minimum: 0, maximum: 5 });
    const maxOutputTokens = assertPositiveInteger("maxOutputTokens", input.maxOutputTokens ?? 4_096, { minimum: 16, maximum: 65_536 });
    const maxCostUnits = assertNonNegativeInteger("maxCostUnits", input.maxCostUnits ?? 100_000, 100_000);
    const costLatencyPriority = assertEnum("costLatencyPriority", input.costLatencyPriority ?? "balanced", ["cost", "latency", "quality", "balanced"]);
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const value = { profileId, role, providerId, modelId, credentialRef, promptVersion, contextPolicy, toolPolicy, outputSchema, status, timeoutMs, maxRetries, maxOutputTokens, maxCostUnits, costLatencyPriority };
    const scope = commandScope("profile", profileId, idempotencyKey);
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    if (profiles.has(profileId)) throw new AiOrchestrationError("PROFILE_EXISTS", `Agent Profile ${profileId} already exists.`);
    if (toolPolicy === "read-only" && role === "executor") {
      throw new AiOrchestrationError("INVALID_PROFILE_POLICY", "An executor profile cannot be read-only.");
    }
    const event = appendEvent({
      aggregateType: "ai-profile",
      aggregateId: profileId,
      type: "ai.profile-registered",
      actor,
      data: { profileId, role, providerId, modelId, promptVersion, contextPolicy, toolPolicy, outputSchema, status, timeoutMs, maxRetries, maxOutputTokens, maxCostUnits, costLatencyPriority }
    });
    const profile = immutableCopy({ ...value, profileVersion: 1, registeredAt: event.occurredAt, eventId: event.eventId });
    profiles.set(profileId, profile);
    return remember(scope, value, { profile, idempotent: false });
  }

  function bindRole(input = {}) {
    const actor = assertActor(input.actor);
    if (!["project-owner", "admin"].includes(actor.kind)) {
      throw new AiOrchestrationError("ADMIN_APPROVAL_REQUIRED", "Changing an AI role binding requires the project owner or an admin.");
    }
    const bindingId = assertIdentifier("bindingId", input.bindingId);
    const projectId = assertIdentifier("projectId", input.projectId);
    const role = assertEnum("role", input.role, AI_ROLES);
    const teamId = input.teamId === undefined || input.teamId === null ? null : assertIdentifier("teamId", input.teamId, 80);
    const skillId = input.skillId === undefined || input.skillId === null ? null : assertIdentifier("skillId", input.skillId, 80);
    const skill = readSkill(skillId);
    const profile = readProfile(input.profileId);
    if (profile.role !== role) throw new AiOrchestrationError("ROLE_PROFILE_MISMATCH", "The profile role does not match the binding role.");
    if (profile.status !== "active") throw new AiOrchestrationError("PROFILE_NOT_ACTIVE", "Only an active profile can be bound.");
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const key = roleBindingKey({ projectId, teamId, skillId, role });
    const current = currentBindings.get(key);
    if (current && input.supersedesBindingId !== current.bindingId) {
      throw new AiOrchestrationError("BINDING_VERSION_CONFLICT", "Replacing a role binding requires the current binding id.");
    }
    const value = { bindingId, projectId, teamId, skillId, role, profileId: profile.profileId, supersedesBindingId: input.supersedesBindingId ?? null };
    const scope = commandScope("binding", bindingId, idempotencyKey);
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    if (bindings.has(bindingId)) throw new AiOrchestrationError("BINDING_EXISTS", `Binding ${bindingId} already exists.`);
    const event = appendEvent({
      aggregateType: "ai-binding",
      aggregateId: `${projectId}:${role}`,
      type: "ai.role-bound",
      actor,
      data: { bindingId, projectId, teamId, skillId, role, profileId: profile.profileId, supersedesBindingId: input.supersedesBindingId ?? null }
    });
    const binding = immutableCopy({ ...value, boundAt: event.occurredAt, eventId: event.eventId });
    bindings.set(bindingId, binding);
    currentBindings.set(key, binding);
    return remember(scope, value, { binding, idempotent: false });
  }

  function configureProjectScope(input = {}) {
    const actor = assertActor(input.actor);
    if (!["project-owner", "admin"].includes(actor.kind)) {
      throw new AiOrchestrationError("ADMIN_APPROVAL_REQUIRED", "AI project scope changes require the project owner or an admin.");
    }
    const projectId = assertIdentifier("projectId", input.projectId);
    const mode = assertEnum("mode", input.mode ?? "enabled", AI_PROJECT_SCOPE_MODES);
    const capabilities = input.capabilities === undefined
      ? [...AI_PROJECT_SCOPE_CAPABILITIES]
      : input.capabilities;
    if (!Array.isArray(capabilities) || capabilities.length < 1 || capabilities.length > AI_PROJECT_SCOPE_CAPABILITIES.length) {
      throw new AiOrchestrationError("INVALID_PROJECT_SCOPE_CAPABILITIES", "capabilities must contain at least one approved AI capability.");
    }
    const uniqueCapabilities = [...new Set(capabilities)];
    uniqueCapabilities.forEach((capability, index) => assertEnum(`capabilities[${index}]`, capability, AI_PROJECT_SCOPE_CAPABILITIES));
    const expectedVersion = input.expectedVersion === undefined || input.expectedVersion === null ? null : input.expectedVersion;
    if (expectedVersion !== null && (!Number.isInteger(expectedVersion) || expectedVersion < 0)) {
      throw new AiOrchestrationError("INVALID_VERSION", "expectedVersion must be a non-negative integer.");
    }
    const current = projectScopes.get(projectId) ?? null;
    if (expectedVersion !== null && expectedVersion !== (current?.version ?? 0)) {
      throw new AiOrchestrationError("VERSION_CONFLICT", "AI project scope is stale; reload it before saving.");
    }
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const value = { projectId, mode, capabilities: uniqueCapabilities };
    const scope = commandScope("project-scope", projectId, idempotencyKey);
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    const version = (current?.version ?? 0) + 1;
    const event = appendEvent({
      aggregateType: "ai-project-scope",
      aggregateId: projectId,
      type: "ai.project-scope-configured",
      actor,
      data: { projectId, mode, capabilities: uniqueCapabilities, version }
    });
    const projectScope = immutableCopy({
      scopeId: `ai-scope-${projectId}`,
      projectId,
      mode,
      capabilities: uniqueCapabilities,
      version,
      configuredAt: event.occurredAt,
      configuredBy: actor,
      eventId: event.eventId,
      externalSpendBoundary: "separate-authorization-required"
    });
    projectScopes.set(projectId, projectScope);
    return remember(scope, value, { projectScope, idempotent: false });
  }

  function assembleContext(input = {}) {
    const role = assertEnum("role", input.role, AI_ROLES);
    const contextId = assertIdentifier("contextId", input.contextId);
    const projectId = assertIdentifier("projectId", input.projectId);
    const taskId = assertIdentifier("taskId", input.taskId);
    const stepId = assertIdentifier("stepId", input.stepId);
    const documentVersion = assertIdentifier("documentVersion", input.documentVersion, 48);
    const skillId = input.skillId === undefined || input.skillId === null ? null : assertIdentifier("skillId", input.skillId, 80);
    const skill = readSkill(skillId);
    const maxItems = input.maxItems ?? 12;
    if (!projectMemory) {
      return immutableCopy({
        status: "blocked",
        code: "PROJECT_MEMORY_NOT_CONFIGURED",
        context: null,
        aiRole: role,
        recipientRole: AI_CONTEXT_RECIPIENT_ROLES[role],
        skill: skill ? { skillId: skill.skillId, version: skill.version } : null
      });
    }
    try {
      const result = projectMemory.assemble({
        contextId,
        projectId,
        taskId,
        stepId,
        documentVersion,
        recipientRole: AI_CONTEXT_RECIPIENT_ROLES[role],
        maxItems,
        idempotencyKey: input.idempotencyKey ?? `ai-context-${contextId}`
      });
      return immutableCopy({
        ...result,
        aiRole: role,
        recipientRole: AI_CONTEXT_RECIPIENT_ROLES[role],
        skill: skill ? { skillId: skill.skillId, version: skill.version } : null
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Project Memory assembly failed.";
      throw new AiOrchestrationError("CONTEXT_ASSEMBLY_FAILED", reason);
    }
  }

  async function checkProviderHealth(input = {}) {
    const actor = assertActor(input.actor ?? SYSTEM);
    const providerId = assertEnum("providerId", input.providerId, AI_PROVIDER_IDS);
    const provider = readProvider(providerId);
    const timeoutMs = input.timeoutMs ?? 10_000;
    assertPositiveInteger("timeoutMs", timeoutMs, { minimum: 100, maximum: 60_000 });
    const startedAt = Date.now();
    let status = "healthy";
    let code = "PROVIDER_HEALTHY";
    let reason = null;
    try {
      if (provider.mode === "disabled") throw new AiOrchestrationError("PROVIDER_DISABLED", "Provider is disabled.");
      if (typeof provider.adapter?.validateConnection !== "function") throw new AiOrchestrationError("HEALTH_CHECK_UNAVAILABLE", "Provider health check is unavailable.");
      const requestedProfileId = input.profileId === undefined || input.profileId === null ? null : assertIdentifier("profileId", input.profileId);
      const profile = requestedProfileId ? readProfile(requestedProfileId) : null;
      if (profile && profile.providerId !== providerId) throw new AiOrchestrationError("PROFILE_PROVIDER_MISMATCH", "The selected Profile belongs to a different Provider.");
      const credentialRef = profile?.credentialRef ?? (input.credentialRef === undefined || input.credentialRef === null ? undefined : assertText("credentialRef", input.credentialRef, { maximum: 160 }));
      const result = await withTimeout(provider.adapter.validateConnection({ credentialRef }), timeoutMs);
      if (result?.status !== "ok") throw new AiOrchestrationError("PROVIDER_UNHEALTHY", "Provider health check did not return ok.");
    } catch (error) {
      status = "blocked";
      code = error instanceof AiOrchestrationError ? error.code : "PROVIDER_HEALTH_CHECK_FAILED";
      reason = safeErrorMessage(error, "Provider health check failed.");
    }
    const event = appendEvent({
      aggregateType: "ai-provider",
      aggregateId: providerId,
      type: "ai.provider-health-checked",
      actor,
      data: { providerId, status, code, ...(reason ? { reason } : {}), latencyMs: Math.max(0, Date.now() - startedAt) }
    });
    return immutableCopy({ providerId, status, code, reason, latencyMs: Math.max(0, Date.now() - startedAt), eventId: event.eventId });
  }

  function blockedInvocation({ input, actor, profile, provider, code, reason, idempotencyKey, value }) {
    const safeReason = safeErrorMessage({ message: reason }, "Invocation blocked by an AI governance boundary.");
    const event = appendEvent({
      aggregateType: "ai-invocation",
      aggregateId: input.invocationId,
      type: "ai.invocation-blocked",
      actor,
      data: {
        invocationId: input.invocationId,
        projectId: input.projectId,
        teamId: input.teamId ?? null,
        skillId: input.skillId ?? null,
        role: input.role,
        providerId: provider.providerId,
        modelId: profile.modelId,
        profileId: profile.profileId,
        contextSnapshotId: input.contextSnapshotId,
        code,
        reason: safeReason
      },
      correlationId: input.runId ?? input.projectId
    });
    const invocation = immutableCopy({
      invocationId: input.invocationId,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      runId: input.runId ?? null,
      teamId: input.teamId ?? null,
      skillId: input.skillId ?? null,
      role: input.role,
      providerId: provider.providerId,
      modelId: profile.modelId,
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      contextSnapshotId: input.contextSnapshotId,
      status: "blocked",
      code,
      reason: safeReason,
      response: null,
      requestedAt: event.occurredAt,
      eventId: event.eventId,
      credentialRef: profile.credentialRef
    });
    invocations.set(input.invocationId, invocation);
    return remember(commandScope("invocation", input.invocationId, idempotencyKey), value, { invocation, idempotent: false });
  }

  async function invoke(input = {}) {
    const actor = assertActor(input.actor ?? SYSTEM);
    const invocationId = assertIdentifier("invocationId", input.invocationId);
    const projectId = assertIdentifier("projectId", input.projectId);
    const role = assertEnum("role", input.role, AI_ROLES);
    const teamId = input.teamId === undefined || input.teamId === null ? null : assertIdentifier("teamId", input.teamId, 80);
    const skillId = input.skillId === undefined || input.skillId === null ? null : assertIdentifier("skillId", input.skillId, 80);
    const skill = readSkill(skillId);
    const contextSnapshotId = assertIdentifier("contextSnapshotId", input.contextSnapshotId);
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const request = typeof input.request === "string" ? assertText("request", input.request, { maximum: 10_000 }) : assertObject("request", input.request);
    let context = assertObject("context", input.context ?? {});
    if (projectMemory) {
      const assembledContext = assembleContext({
        role,
        contextId: contextSnapshotId,
        projectId,
        teamId,
        skillId,
        taskId: input.taskId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        maxItems: input.maxContextItems,
        idempotencyKey: input.contextIdempotencyKey
      });
      if (assembledContext.status !== "ready") {
        throw new AiOrchestrationError("CONTEXT_ASSEMBLY_BLOCKED", `Context assembly blocked: ${assembledContext.code}.`);
      }
      context = { ...context, projectMemory: assembledContext.context };
    }
    const binding = resolveBinding({ projectId, teamId, skillId, role });
    if (!binding) {
      throw new AiOrchestrationError("ROLE_NOT_BOUND", `Role ${role} is not bound for project ${projectId}.`);
    }
    const profile = readProfile(binding.profileId);
    const provider = readProvider(profile.providerId);
    const value = {
      invocationId,
      projectId,
      taskId: input.taskId ?? null,
      runId: input.runId ?? null,
      teamId,
      skillId,
      role,
      contextSnapshotId,
      request,
      context,
      skillVersion: skill?.version ?? null,
      toolAction: input.toolAction ?? null,
      spendApprovalId: input.externalSpendAuthorization?.authorizationId ?? null
    };
    const scope = commandScope("invocation", invocationId, idempotencyKey);
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    if (invocations.has(invocationId)) throw new AiOrchestrationError("INVOCATION_EXISTS", `Invocation ${invocationId} already exists.`);
    if (profile.status !== "active") return blockedInvocation({ input, actor, profile, provider, code: "PROFILE_NOT_ACTIVE", reason: "The bound Agent Profile is not active.", idempotencyKey, value });
    if (provider.mode === "disabled") return blockedInvocation({ input, actor, profile, provider, code: "PROVIDER_DISABLED", reason: "The provider is disabled.", idempotencyKey, value });
    if (skill?.toolPolicy === "read-only" && input.toolAction) {
      return blockedInvocation({ input, actor, profile, provider, code: "SKILL_READ_ONLY_TOOL_POLICY", reason: "A read-only Skill cannot request a tool action.", idempotencyKey, value });
    }
    if (skill && input.toolAction && !skill.allowedTools.includes(input.toolAction)) {
      return blockedInvocation({ input, actor, profile, provider, code: "SKILL_TOOL_NOT_ALLOWED", reason: "The requested tool action is outside the Skill allow-list.", idempotencyKey, value });
    }
    if (provider.mode === "live" && !hasSeparateExternalSpendAuthorization(input, projectId)) {
      return blockedInvocation({ input, actor, profile, provider, code: "LIVE_PROVIDER_REQUIRES_SEPARATE_AUTHORIZATION", reason: "Live provider invocation requires a separate version-bound external-spend authorization.", idempotencyKey, value });
    }
    let verifiedExternalAuthorization = null;
    let dispatchReadiness = null;
    let effectiveMaxCostUnits = profile.maxCostUnits;
    if (provider.mode === "live") {
      if (typeof externalSpendAuthorizer !== "function") {
        return blockedInvocation({ input, actor, profile, provider, code: "ACTIVE_AUTHORIZATION_SNAPSHOT_REQUIRED", reason: "The active authorization snapshot verifier is not configured.", idempotencyKey, value });
      }
      let authorization;
      // A runtime authorization may narrow a Profile's declared ceiling, but
      // can never widen it.  This avoids a stale higher Profile limit blocking
      // an otherwise valid, lower Test authorization while retaining the
      // authorization as the final source of truth for external spend.
      const authorizedCeiling = input.externalSpendAuthorization?.maxCostUnits;
      const requestedMaxCostUnits = Number.isSafeInteger(authorizedCeiling) && authorizedCeiling >= 0
        ? Math.min(profile.maxCostUnits, authorizedCeiling)
        : profile.maxCostUnits;
      try {
        authorization = await externalSpendAuthorizer({
          authorizationId: input.externalSpendAuthorization.authorizationId,
          projectId,
          taskId: input.taskId ?? null,
          runId: input.runId ?? null,
          stepId: input.externalSpendAuthorization.stepId,
          documentVersion: input.externalSpendAuthorization.documentVersion,
          operation: "external-spend",
          providerId: provider.providerId,
          modelId: profile.modelId,
          role,
          capability: input.externalSpendAuthorization.capability,
          maxCostUnits: requestedMaxCostUnits,
          globalStop: input.externalSpendAuthorization.globalStop
        });
      } catch (error) {
        return blockedInvocation({ input, actor, profile, provider, code: "ACTIVE_AUTHORIZATION_SNAPSHOT_REJECTED", reason: safeErrorMessage(error, "The active authorization snapshot could not be verified."), idempotencyKey, value });
      }
      const authorizationRejection = authorization?.authorized === false && typeof authorization.code === "string"
        ? authorization.code
        : null;
      if (
        authorization?.authorized !== true
        || authorization?.code !== "AUTHORIZED"
        || authorization?.action !== "external-spend"
        || authorization?.globalStop === true
        || authorization?.safeCheckpointRequired === true
        || authorization?.authorizationId !== input.externalSpendAuthorization.authorizationId
        || authorization?.projectId !== projectId
        || authorization?.stepId !== input.externalSpendAuthorization.stepId
        || authorization?.documentVersion !== input.externalSpendAuthorization.documentVersion
        || authorization?.providerId !== provider.providerId
        || authorization?.modelId !== profile.modelId
        || authorization?.role !== role
        || authorization?.capability !== input.externalSpendAuthorization.capability
        || !Number.isInteger(authorization?.maxCostUnits)
        || authorization.maxCostUnits < requestedMaxCostUnits
      ) {
        return blockedInvocation({
          input,
          actor,
          profile,
          provider,
          code: "ACTIVE_AUTHORIZATION_SNAPSHOT_REJECTED",
          reason: authorizationRejection
            ? `The active authorization snapshot was rejected: ${authorizationRejection}.`
            : "The active authorization snapshot does not exactly match the live invocation.",
          idempotencyKey,
          value
        });
      }
      verifiedExternalAuthorization = authorization;
      effectiveMaxCostUnits = requestedMaxCostUnits;
    }
    if (profile.toolPolicy === "read-only" && input.toolAction) {
      return blockedInvocation({ input, actor, profile, provider, code: "READ_ONLY_TOOL_POLICY", reason: "Read-only profiles cannot request a tool action.", idempotencyKey, value });
    }
    if (input.toolAction && SENSITIVE_ACTIONS.includes(input.toolAction)) {
      return blockedInvocation({ input, actor, profile, provider, code: "SENSITIVE_ACTION_REQUIRES_SEPARATE_APPROVAL", reason: "Sensitive actions require a separate authorization boundary.", idempotencyKey, value });
    }
    const circuit = circuitAllowance(provider.providerId);
    if (!circuit.allowed) {
      return blockedInvocation({ input, actor, profile, provider, code: "PROVIDER_CIRCUIT_OPEN", reason: "Provider is temporarily blocked after repeated failures; retry after the recovery window.", idempotencyKey, value });
    }
    const circuitProbe = circuit.probe === true;
    const adapterInput = {
      request,
      context,
      skill: skill ? {
        skillId: skill.skillId,
        version: skill.version,
        knowledgeRefs: skill.knowledgeRefs,
        principlesRefs: skill.principlesRefs,
        allowedTools: skill.allowedTools,
        toolPolicy: skill.toolPolicy
      } : null,
      projectId,
      taskId: input.taskId ?? null,
      runId: input.runId ?? null,
      teamId,
      skillId,
      role,
      providerId: provider.providerId,
      modelId: profile.modelId,
      profileId: profile.profileId,
      promptVersion: profile.promptVersion,
      credentialRef: profile.credentialRef,
      contextPolicy: profile.contextPolicy,
      toolPolicy: profile.toolPolicy,
      outputSchema: profile.outputSchema,
      timeoutMs: profile.timeoutMs,
      maxRetries: profile.maxRetries,
      maxOutputTokens: profile.maxOutputTokens,
      maxCostUnits: effectiveMaxCostUnits
    };
    if (provider.mode === "live") {
      if (typeof provider.adapter?.assertDispatchReady !== "function") {
        return blockedInvocation({ input, actor, profile, provider, code: "PROVIDER_ADAPTER_NOT_READY", reason: "The live provider adapter has no pre-dispatch readiness check.", idempotencyKey, value });
      }
      try {
        dispatchReadiness = await withTimeout(provider.adapter.assertDispatchReady(adapterInput), Math.min(profile.timeoutMs, 10_000));
      } catch (error) {
        return blockedInvocation({ input, actor, profile, provider, code: error?.code ?? "PROVIDER_ADAPTER_NOT_READY", reason: safeErrorMessage(error, "The live provider adapter is not ready."), idempotencyKey, value });
      }
    }
    if (input.requireHealthyProvider === true) {
      const health = await checkProviderHealth({ providerId: provider.providerId, actor, timeoutMs: Math.min(profile.timeoutMs, 10_000) });
      if (health.status !== "healthy") return blockedInvocation({ input, actor, profile, provider, code: "PROVIDER_UNHEALTHY", reason: health.reason ?? "Provider health check failed.", idempotencyKey, value });
    }

    const effectiveProfile = effectiveMaxCostUnits === profile.maxCostUnits ? profile : { ...profile, maxCostUnits: effectiveMaxCostUnits };
    const spendReservation = verifiedExternalAuthorization ? reserveExternalSpend(verifiedExternalAuthorization, effectiveProfile) : null;
    if (spendReservation && spendReservation.accepted !== true) {
      return blockedInvocation({ input, actor, profile, provider, code: spendReservation.code, reason: spendReservation.reason, idempotencyKey, value });
    }

    const started = appendEvent({
      aggregateType: "ai-invocation",
      aggregateId: invocationId,
      type: "ai.invocation-started",
      actor,
      data: {
        invocationId,
        projectId,
        teamId,
        skillId,
        role,
        providerId: provider.providerId,
        modelId: profile.modelId,
        profileId: profile.profileId,
        profileVersion: profile.profileVersion,
        spendApprovalId: verifiedExternalAuthorization?.authorizationId ?? null,
        externalSpendMaximumCostUnits: verifiedExternalAuthorization?.maxCostUnits ?? null,
        maxCostUnits: effectiveMaxCostUnits,
        catalogVersion: dispatchReadiness?.pricing?.catalogVersion ?? null,
        pricingCurrency: dispatchReadiness?.pricing?.currency ?? null,
        inputPricePer1mTokens: dispatchReadiness?.pricing?.inputPricePer1mTokens ?? null,
        outputPricePer1mTokens: dispatchReadiness?.pricing?.outputPricePer1mTokens ?? null,
        cachedInputPricePer1mTokens: dispatchReadiness?.pricing?.cachedInputPricePer1mTokens ?? null,
        contextSnapshotId,
        promptVersion: profile.promptVersion,
        outputSchema: profile.outputSchema,
        toolPolicy: profile.toolPolicy
      },
      correlationId: input.runId ?? projectId
    });

    let response;
    let failure = null;
    let attempts = 0;
    const startedAtMs = Date.now();
    while (!response && attempts <= profile.maxRetries) {
      attempts += 1;
      try {
        response = await withTimeout(provider.adapter.generate(adapterInput), profile.timeoutMs);
        response = assertStructuredResponse(profile, response);
        const usage = normalizeUsage(response.usage);
        if (usage.costUnits > effectiveMaxCostUnits) throw new AiOrchestrationError("COST_LIMIT_REACHED", "Provider usage exceeded the effective cost limit.");
        response = immutableCopy({ ...response, usage });
      } catch (error) {
        response = null;
        failure = error;
        if (attempts <= profile.maxRetries && error?.retryable !== false) {
          appendEvent({
            aggregateType: "ai-invocation",
            aggregateId: invocationId,
            type: "ai.invocation-retry-scheduled",
            actor,
            data: { invocationId, projectId, role, profileId: profile.profileId, attempt: attempts, nextAttempt: attempts + 1, code: error instanceof AiOrchestrationError ? error.code : "PROVIDER_EXECUTION_FAILED" },
            correlationId: input.runId ?? projectId,
            causationId: started.eventId
          });
        }
      }
    }
    if (!response) {
      const error = failure;
      const reason = safeErrorMessage(error);
      const code = error instanceof AiOrchestrationError ? error.code : "PROVIDER_EXECUTION_FAILED";
      const budget = settleExternalSpend(spendReservation?.accepted === true ? spendReservation : null, effectiveMaxCostUnits * attempts);
      if (circuitFailure(error)) recordCircuitFailure(provider.providerId, actor, { probe: circuitProbe, code });
      const failedEvent = appendEvent({
        aggregateType: "ai-invocation",
        aggregateId: invocationId,
        type: "ai.invocation-failed",
        actor,
        data: { invocationId, projectId, teamId, skillId, role, providerId: provider.providerId, modelId: profile.modelId, profileId: profile.profileId, spendApprovalId: budget?.approvalId ?? null, accountedCostUnits: budget?.accountedCostUnits ?? 0, remainingSpendCostUnits: budget?.remainingCostUnits ?? null, maxCostUnits: effectiveMaxCostUnits, catalogVersion: dispatchReadiness?.pricing?.catalogVersion ?? null, pricingCurrency: dispatchReadiness?.pricing?.currency ?? null, code, reason, attempts },
        correlationId: input.runId ?? projectId,
        causationId: started.eventId
      });
      const invocation = immutableCopy({ invocationId, projectId, taskId: input.taskId ?? null, runId: input.runId ?? null, teamId, skillId, role, providerId: provider.providerId, modelId: profile.modelId, profileId: profile.profileId, profileVersion: profile.profileVersion, spendApprovalId: budget?.approvalId ?? null, accountedCostUnits: budget?.accountedCostUnits ?? 0, remainingSpendCostUnits: budget?.remainingCostUnits ?? null, contextSnapshotId, status: "failed", code, reason, response: null, attempts, latencyMs: Math.max(0, Date.now() - startedAtMs), requestedAt: started.occurredAt, completedAt: failedEvent.occurredAt, eventId: failedEvent.eventId, credentialRef: profile.credentialRef });
      invocations.set(invocationId, invocation);
      return remember(scope, value, { invocation, idempotent: false });
    }

    recordCircuitSuccess(provider.providerId, actor, { probe: circuitProbe });
    const budget = settleExternalSpend(spendReservation?.accepted === true ? spendReservation : null, effectiveMaxCostUnits * Math.max(0, attempts - 1) + response.usage.costUnits);
    const completed = appendEvent({
      aggregateType: "ai-invocation",
      aggregateId: invocationId,
      type: "ai.invocation-completed",
      actor,
      data: {
        invocationId,
        projectId,
        teamId,
        skillId,
        role,
        providerId: provider.providerId,
        modelId: profile.modelId,
        profileId: profile.profileId,
        spendApprovalId: budget?.approvalId ?? null,
        accountedCostUnits: budget?.accountedCostUnits ?? response.usage.costUnits,
        remainingSpendCostUnits: budget?.remainingCostUnits ?? null,
        maxCostUnits: effectiveMaxCostUnits,
        catalogVersion: response.usage.pricing?.catalogVersion ?? dispatchReadiness?.pricing?.catalogVersion ?? null,
        pricingCurrency: response.usage.pricing?.currency ?? dispatchReadiness?.pricing?.currency ?? null,
        inputPricePer1mTokens: response.usage.pricing?.inputPricePer1mTokens ?? null,
        outputPricePer1mTokens: response.usage.pricing?.outputPricePer1mTokens ?? null,
        cachedInputPricePer1mTokens: response.usage.pricing?.cachedInputPricePer1mTokens ?? null,
        contextSnapshotId,
        responseKeys: Object.keys(response).sort(),
        usage: response.usage,
        attempts,
        latencyMs: Math.max(0, Date.now() - startedAtMs)
      },
      correlationId: input.runId ?? projectId,
      causationId: started.eventId
    });
    const invocation = immutableCopy({ invocationId, projectId, taskId: input.taskId ?? null, runId: input.runId ?? null, teamId, skillId, role, providerId: provider.providerId, modelId: profile.modelId, profileId: profile.profileId, profileVersion: profile.profileVersion, spendApprovalId: budget?.approvalId ?? null, accountedCostUnits: budget?.accountedCostUnits ?? response.usage.costUnits, remainingSpendCostUnits: budget?.remainingCostUnits ?? null, contextSnapshotId, status: "completed", code: "AI_INVOCATION_COMPLETED", response, attempts, latencyMs: Math.max(0, Date.now() - startedAtMs), requestedAt: started.occurredAt, completedAt: completed.occurredAt, eventId: completed.eventId, credentialRef: profile.credentialRef });
    invocations.set(invocationId, invocation);
    return remember(scope, value, { invocation, idempotent: false });
  }

  function recordEvaluation(input = {}) {
    const actor = assertActor(input.actor ?? SYSTEM);
    const evaluationId = assertIdentifier("evaluationId", input.evaluationId);
    const projectId = assertIdentifier("projectId", input.projectId);
    const invocationId = input.invocationId === undefined ? null : assertIdentifier("invocationId", input.invocationId);
    const target = assertObject("target", input.target);
    const verdict = assertEnum("verdict", input.verdict, AI_EVALUATION_VERDICTS);
    const score = input.score === undefined ? null : input.score;
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) throw new AiOrchestrationError("INVALID_SCORE", "score must be an integer between 0 and 100.");
    const confidence = input.confidence === undefined ? null : input.confidence;
    if (confidence !== null && (typeof confidence !== "number" || confidence < 0 || confidence > 1)) throw new AiOrchestrationError("INVALID_CONFIDENCE", "confidence must be between 0 and 1.");
    const findings = input.findings === undefined ? [] : input.findings;
    if (!Array.isArray(findings)) throw new AiOrchestrationError("INVALID_FINDINGS", "findings must be an array.");
    assertSafePayload(findings, "findings");
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const value = { evaluationId, projectId, invocationId, target, verdict, score, confidence, findings };
    const scope = commandScope("evaluation", evaluationId, idempotencyKey);
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    if (evaluations.has(evaluationId)) throw new AiOrchestrationError("EVALUATION_EXISTS", `Evaluation ${evaluationId} already exists.`);
    const event = appendEvent({
      aggregateType: "ai-evaluation",
      aggregateId: evaluationId,
      type: "ai.evaluation-recorded",
      actor,
      data: { evaluationId, projectId, invocationId, target, verdict, score, confidence, findingCount: findings.length }
    });
    const evaluation = immutableCopy({ evaluationId, projectId, invocationId, target, verdict, score, confidence, findings, recordedAt: event.occurredAt, eventId: event.eventId, approvalBoundary: "evaluation-is-evidence-not-authorization" });
    evaluations.set(evaluationId, evaluation);
    return remember(scope, value, { evaluation, idempotent: false });
  }

  function proposeDecision(input = {}) {
    const actor = assertActor(input.actor ?? SYSTEM);
    const decisionId = assertIdentifier("decisionId", input.decisionId);
    const projectId = assertIdentifier("projectId", input.projectId);
    const requestedDecision = assertEnum("requestedDecision", input.requestedDecision, AI_DECISION_REQUESTS);
    const options = input.options;
    if (!Array.isArray(options) || options.length < 1 || options.length > 12) throw new AiOrchestrationError("INVALID_OPTIONS", "options must contain 1-12 items.");
    options.forEach((option, index) => {
      const item = assertObject(`options[${index}]`, option);
      assertIdentifier(`options[${index}].optionId`, item.optionId);
      assertText(`options[${index}].title`, item.title, { maximum: 240 });
    });
    const recommendation = assertObject("recommendation", input.recommendation);
    assertIdentifier("recommendation.optionId", recommendation.optionId);
    if (!options.some(option => option.optionId === recommendation.optionId)) {
      throw new AiOrchestrationError("RECOMMENDATION_OPTION_NOT_FOUND", "The recommendation must reference one proposed option.");
    }
    const rationale = assertText("recommendation.rationale", recommendation.rationale, { maximum: 1_200 });
    const confidence = input.confidence === undefined ? null : input.confidence;
    if (confidence !== null && (typeof confidence !== "number" || confidence < 0 || confidence > 1)) throw new AiOrchestrationError("INVALID_CONFIDENCE", "confidence must be between 0 and 1.");
    const evidence = input.evidence === undefined ? [] : input.evidence;
    if (!Array.isArray(evidence)) throw new AiOrchestrationError("INVALID_EVIDENCE", "evidence must be an array.");
    assertSafePayload(evidence, "evidence");
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const value = { decisionId, projectId, requestedDecision, options, recommendation: { optionId: recommendation.optionId, rationale }, confidence, evidence };
    const scope = commandScope("decision", decisionId, idempotencyKey);
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    if (decisions.has(decisionId)) throw new AiOrchestrationError("DECISION_EXISTS", `Decision ${decisionId} already exists.`);
    const event = appendEvent({
      aggregateType: "ai-decision",
      aggregateId: decisionId,
      type: "ai.decision-proposed",
      actor,
      data: { decisionId, projectId, requestedDecision, optionIds: options.map(option => option.optionId), recommendedOptionId: recommendation.optionId, confidence, evidenceCount: evidence.length }
    });
    const decision = immutableCopy({ decisionId, projectId, requestedDecision, options, recommendation: { optionId: recommendation.optionId, rationale }, confidence, evidence, state: "draft", selectedOptionId: null, feedback: "", proposedAt: event.occurredAt, resolvedAt: null, eventId: event.eventId });
    decisions.set(decisionId, decision);
    return remember(scope, value, { decision, idempotent: false });
  }

  function evaluateInvocation(input = {}) {
    const invocationId = assertIdentifier("invocationId", input.invocationId);
    const invocation = invocations.get(invocationId);
    if (!invocation) throw new AiOrchestrationError("INVOCATION_NOT_FOUND", `Invocation ${invocationId} was not registered.`);
    if (!["evaluator", "verifier", "code-reviewer"].includes(invocation.role)) {
      throw new AiOrchestrationError("EVALUATOR_ROLE_REQUIRED", "Only evaluator, verifier or code-reviewer invocations can produce an Evaluation.");
    }
    if (invocation.status !== "completed" || invocation.response?.output?.schema !== "evaluation-v1") {
      throw new AiOrchestrationError("EVALUATION_OUTPUT_INVALID", "The invocation must complete with evaluation-v1 output.");
    }
    const output = assertObject("evaluation output", invocation.response.output);
    const evaluationId = assertIdentifier("evaluationId", input.evaluationId);
    const target = assertObject("target", input.target);
    return recordEvaluation({
      evaluationId,
      invocationId,
      projectId: invocation.projectId,
      target,
      verdict: output.verdict,
      score: output.score,
      confidence: output.confidence,
      findings: output.findings,
      actor: input.actor ?? SYSTEM,
      idempotencyKey: input.idempotencyKey
    });
  }

  function resolveDecision(input = {}) {
    const actor = assertActor(input.actor, { ownerOnly: true });
    const decisionId = assertIdentifier("decisionId", input.decisionId);
    const current = decisions.get(decisionId);
    if (!current) throw new AiOrchestrationError("DECISION_NOT_FOUND", `Decision ${decisionId} was not registered.`);
    if (current.state !== "draft") throw new AiOrchestrationError("DECISION_ALREADY_RESOLVED", "Only draft decisions can be resolved.");
    const state = assertEnum("state", input.state, AI_DECISION_STATES.filter(item => item !== "draft"));
    const selectedOptionId = input.selectedOptionId ?? null;
    if (state === "approved" && (!selectedOptionId || !current.options.some(option => option.optionId === selectedOptionId))) {
      throw new AiOrchestrationError("DECISION_OPTION_REQUIRED", "An approved decision must select one proposed option.");
    }
    const feedback = input.feedback === undefined ? "" : assertText("feedback", input.feedback, { maximum: 1_200 });
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const value = { decisionId, state, selectedOptionId, feedback };
    const scope = commandScope("decision-resolution", decisionId, idempotencyKey);
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    const event = appendEvent({
      aggregateType: "ai-decision",
      aggregateId: decisionId,
      type: "ai.decision-resolved",
      actor,
      data: { decisionId, state, selectedOptionId, feedback }
    });
    const resolved = immutableCopy({ ...current, state, selectedOptionId, feedback, resolvedAt: event.occurredAt, resolvedBy: actor, eventId: event.eventId, authorizationCreated: false });
    decisions.set(decisionId, resolved);
    return remember(scope, value, { decision: resolved, idempotent: false });
  }

  function usageByProvider({ projectId = null } = {}) {
    const totals = new Map();
    for (const invocation of invocations.values()) {
      if (projectId !== null && invocation.projectId !== projectId) continue;
      const current = totals.get(invocation.providerId) ?? {
        providerId: invocation.providerId,
        invocationCount: 0,
        completedCount: 0,
        failedCount: 0,
        blockedCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUnits: 0
      };
      const usage = invocation.status === "completed" ? invocation.response?.usage ?? {} : {};
      current.invocationCount += 1;
      if (invocation.status === "completed") current.completedCount += 1;
      else if (invocation.status === "failed") current.failedCount += 1;
      else if (invocation.status === "blocked") current.blockedCount += 1;
      current.inputTokens += Number.isInteger(usage.inputTokens) ? usage.inputTokens : 0;
      current.outputTokens += Number.isInteger(usage.outputTokens) ? usage.outputTokens : 0;
      current.totalTokens += Number.isInteger(usage.totalTokens) ? usage.totalTokens : 0;
      current.costUnits += Number.isInteger(usage.costUnits) ? usage.costUnits : 0;
      totals.set(invocation.providerId, current);
    }
    return Object.freeze([...totals.values()].sort((left, right) => left.providerId.localeCompare(right.providerId)).map(immutableCopy));
  }

  function snapshot() {
    return immutableCopy({
      contract: getAiOrchestrationContractSummary(),
      providers: [...providers.values()].map(({ adapter, ...provider }) => provider),
      models: [...models.values()],
      profiles: [...profiles.values()],
      bindings: [...currentBindings.values()],
      projectScopes: [...projectScopes.values()],
      defaultRolePolicies: [...rolePolicies.values()],
      circuitBreaker: circuitBreaker ? { ...circuitBreaker, states: [...circuitStates.entries()].map(([providerId, state]) => ({ providerId, ...circuitSnapshot(providerId) })) } : { enabled: false, states: [] },
      externalSpendBudgets: [...externalSpendBudgets.values()].map(budget => ({ ...budget })),
      usageByProvider: usageByProvider(),
      counts: { providers: providers.size, models: models.size, profiles: profiles.size, bindings: currentBindings.size, projectScopes: projectScopes.size, rolePolicies: rolePolicies.size, invocations: invocations.size, evaluations: evaluations.size, decisions: decisions.size },
      activity: activitySnapshot()
    });
  }

  function activitySnapshot(limit = 20) {
    const normalizedLimit = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 20;
    const recent = (values, timestamp) => [...values].sort((left, right) => String(right[timestamp] ?? "").localeCompare(String(left[timestamp] ?? ""))).slice(0, normalizedLimit);
    return immutableCopy({
      invocations: recent(invocations.values(), "completedAt").map(invocation => ({
        invocationId: invocation.invocationId,
        projectId: invocation.projectId,
        taskId: invocation.taskId,
        runId: invocation.runId,
        role: invocation.role,
        providerId: invocation.providerId,
        modelId: invocation.modelId,
        profileId: invocation.profileId,
        status: invocation.status,
        code: invocation.code,
        attempts: invocation.attempts,
        latencyMs: invocation.latencyMs,
        requestedAt: invocation.requestedAt,
        completedAt: invocation.completedAt
      })),
      evaluations: recent(evaluations.values(), "recordedAt").map(evaluation => ({
        evaluationId: evaluation.evaluationId,
        projectId: evaluation.projectId,
        invocationId: evaluation.invocationId,
        targetKind: evaluation.target?.kind ?? null,
        verdict: evaluation.verdict,
        score: evaluation.score,
        confidence: evaluation.confidence,
        findingCount: evaluation.findings.length,
        recordedAt: evaluation.recordedAt
      })),
      decisions: recent(decisions.values(), "proposedAt").map(decision => ({
        decisionId: decision.decisionId,
        projectId: decision.projectId,
        requestedDecision: decision.requestedDecision,
        state: decision.state,
        selectedOptionId: decision.selectedOptionId,
        confidence: decision.confidence,
        evidenceCount: decision.evidence.length,
        proposedAt: decision.proposedAt,
        resolvedAt: decision.resolvedAt
      }))
    });
  }

  function persistenceSnapshot() {
    return immutableCopy({
      schemaVersion: "1.0",
      registryId: "ai-orchestration",
      providers: [...providers.values()].map(({ adapter, ...provider }) => provider),
      models: [...models.values()],
      profiles: [...profiles.values()],
      bindings: [...bindings.values()],
      currentBindings: [...currentBindings.values()],
      projectScopes: [...projectScopes.values()],
      rolePolicies: [...rolePolicies.values()],
      circuitBreaker: circuitBreaker ? { ...circuitBreaker, states: [...circuitStates.entries()].map(([providerId, state]) => ({ providerId, ...circuitSnapshot(providerId) })) } : { enabled: false, states: [] },
      externalSpendBudgets: [...externalSpendBudgets.values()].map(budget => ({ ...budget })),
      invocations: [...invocations.values()],
      evaluations: [...evaluations.values()],
      decisions: [...decisions.values()]
    });
  }

  function hydrate(input = {}) {
    const state = input.data ?? input;
    if (!state || typeof state !== "object" || Array.isArray(state)) throw new AiOrchestrationError("HYDRATION_INVALID", "AI orchestration hydration requires an object.");
    assertSafePayload(state, "hydratedState");
    if (Array.isArray(input.events)) eventLog.load(input.events.filter(event => event.aggregateType.startsWith("ai-")));
    for (const map of [providers, models, profiles, bindings, currentBindings, projectScopes, rolePolicies, invocations, evaluations, decisions]) map.clear();
    circuitStates.clear();
    externalSpendBudgets.clear();
    for (const provider of state.providers ?? []) {
      const stored = immutableCopy(provider);
      providers.set(stored.providerId, { ...stored, adapter: providerAdapters[stored.providerId] ?? null });
    }
    for (const model of state.models ?? []) models.set(`${model.providerId}\u0000${model.modelId}`, immutableCopy(model));
    for (const profile of state.profiles ?? []) profiles.set(profile.profileId, immutableCopy({ maxOutputTokens: 4_096, ...profile }));
    for (const binding of state.bindings ?? []) bindings.set(binding.bindingId, immutableCopy(binding));
    for (const [role, policy] of Object.entries(AI_DEFAULT_ROLE_POLICIES)) rolePolicies.set(role, { ...policy, role, policyVersion: 1 });
    for (const policy of state.rolePolicies ?? []) {
      if (typeof policy?.role === "string") rolePolicies.set(policy.role, immutableCopy(policy));
    }
    for (const binding of state.currentBindings ?? state.bindings ?? []) currentBindings.set(roleBindingKey(binding), immutableCopy(binding));
    for (const projectScope of state.projectScopes ?? []) {
      if (projectScope?.projectId && AI_PROJECT_SCOPE_MODES.includes(projectScope.mode) && Array.isArray(projectScope.capabilities)) {
        const capabilities = [...new Set(projectScope.capabilities)].filter(capability => AI_PROJECT_SCOPE_CAPABILITIES.includes(capability));
        if (capabilities.length > 0) projectScopes.set(projectScope.projectId, immutableCopy({ ...projectScope, capabilities }));
      }
    }
    for (const invocation of state.invocations ?? []) invocations.set(invocation.invocationId, immutableCopy(invocation));
    for (const evaluation of state.evaluations ?? []) evaluations.set(evaluation.evaluationId, immutableCopy(evaluation));
    for (const decision of state.decisions ?? []) decisions.set(decision.decisionId, immutableCopy(decision));
    for (const budget of state.externalSpendBudgets ?? []) {
      if (
        typeof budget?.approvalId === "string"
        && Number.isInteger(budget.maxCostUnits)
        && budget.maxCostUnits > 0
        && budget.maxCostUnits <= 100_000
        && Number.isInteger(budget.spentCostUnits)
        && budget.spentCostUnits >= 0
        && Number.isInteger(budget.reservedCostUnits ?? 0)
        && (budget.reservedCostUnits ?? 0) >= 0
      ) {
        externalSpendBudgets.set(budget.approvalId, immutableCopy({
          approvalId: budget.approvalId,
          maxCostUnits: budget.maxCostUnits,
          spentCostUnits: Math.min(budget.maxCostUnits, budget.spentCostUnits + (budget.reservedCostUnits ?? 0)),
          reservedCostUnits: 0
        }));
      }
    }
    if (circuitBreaker && state.circuitBreaker?.states) {
      for (const item of state.circuitBreaker.states) {
        if (typeof item?.providerId === "string" && ["closed", "open", "half-open"].includes(item.state)) {
          circuitStates.set(item.providerId, {
            state: item.state,
            failureCount: Number.isInteger(item.failureCount) && item.failureCount >= 0 ? item.failureCount : 0,
            openedAt: typeof item.openedAt === "string" ? item.openedAt : null,
            probeInFlight: false,
            lastFailureAt: typeof item.lastFailureAt === "string" ? item.lastFailureAt : null
          });
        }
      }
    }
    return immutableCopy({ registryId: "ai-orchestration", hydrated: true, providers: providers.size, models: models.size, profiles: profiles.size, bindings: currentBindings.size, projectScopes: projectScopes.size, rolePolicies: rolePolicies.size, invocations: invocations.size, evaluations: evaluations.size, decisions: decisions.size });
  }

  return Object.freeze({
    registerProvider,
    registerModel,
    registerProfile,
    setDefaultRolePolicy,
    rolePolicyHistory,
    rollbackRolePolicy,
    bindRole,
    configureProjectScope,
    invoke,
    recordEvaluation,
    evaluateInvocation,
    checkProviderHealth,
    proposeDecision,
    resolveDecision,
    assembleContext,
    resolveBinding: input => {
      const projectId = assertIdentifier("projectId", input?.projectId);
      const role = assertEnum("role", input?.role, AI_ROLES);
      const teamId = input?.teamId === undefined || input?.teamId === null ? null : assertIdentifier("teamId", input.teamId, 80);
      const skillId = input?.skillId === undefined || input?.skillId === null ? null : assertIdentifier("skillId", input.skillId, 80);
      const binding = resolveBinding({ projectId, teamId, skillId, role });
      return binding ? immutableCopy(binding) : null;
    },
    readDefaultRolePolicy: role => rolePolicies.has(role) ? immutableCopy(rolePolicies.get(role)) : null,
    readProvider: providerId => {
      if (!providers.has(providerId)) return null;
      const { adapter, ...provider } = providers.get(providerId);
      return immutableCopy(provider);
    },
    readModel: (providerId, modelId) => models.has(`${providerId}\u0000${modelId}`) ? immutableCopy(models.get(`${providerId}\u0000${modelId}`)) : null,
    readProfile: profileId => profiles.has(profileId) ? immutableCopy(profiles.get(profileId)) : null,
    readInvocation: invocationId => invocations.has(invocationId) ? immutableCopy(invocations.get(invocationId)) : null,
    readEvaluation: evaluationId => evaluations.has(evaluationId) ? immutableCopy(evaluations.get(evaluationId)) : null,
    readDecision: decisionId => decisions.has(decisionId) ? immutableCopy(decisions.get(decisionId)) : null,
    readProjectScope: projectId => projectScopes.has(projectId) ? immutableCopy(projectScopes.get(projectId)) : null,
    listProjectScopes: () => Object.freeze([...projectScopes.values()].map(immutableCopy)),
    projectScopeAllows: (projectId, capability) => projectScopeAllows(projectScopes.get(projectId) ?? null, capability),
    snapshot,
    activitySnapshot,
    usageByProvider,
    persistenceSnapshot,
    hydrate,
    events: (after = 0) => eventLog.readAfter(after),
    contract: () => getAiOrchestrationContractSummary()
  });
}
