import { AI_PROJECT_SCOPE_CAPABILITIES } from "../../contracts/src/ai-orchestration.mjs";

const SAFE_ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,47}$/;
const SAFE_ROLE = /^[a-z][a-z0-9-]{2,63}$/;
const SAFE_CAPABILITY = /^[a-z][a-z0-9-]{2,63}$/;
// A single live invocation is separately clamped by its read-only Profile;
// this is the cumulative authorization ceiling.  The larger limit is usable
// only by the explicit all-test-projects policy below, never by an implicit
// or Production configuration.
const MAX_COST_UNITS = 200_000;
const LEGACY_CAPABILITIES = Object.freeze(["smart-tester", "walkthrough-guide"]);
const PROJECT_SCOPE_MODES = Object.freeze(["single-project", "all-test-projects"]);

function immutable(value) {
  return Object.freeze(structuredClone(value));
}

export class ExternalSpendAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ExternalSpendAuthorizationError";
    this.code = code;
  }
}

function required(env, name, pattern = SAFE_ID) {
  const value = env[name];
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", `${name} is required and must use the approved safe format.`);
  }
  return value;
}

function booleanValue(env, name, fallback = false) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", `${name} must be true or false.`);
}

function boundedInteger(env, name) {
  const raw = env[name];
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", `${name} must be a positive integer.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_COST_UNITS) {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", `${name} must be between 1 and ${MAX_COST_UNITS}.`);
  }
  return value;
}

function allowList(env, name, pattern) {
  const raw = env[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", `${name} must contain at least one explicitly approved value.`);
  }
  const values = [...new Set(raw.split(",").map(value => value.trim()).filter(Boolean))];
  if (values.length === 0 || values.length > 32 || values.some(value => !pattern.test(value))) {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", `${name} contains an invalid value.`);
  }
  return Object.freeze(values);
}

function capabilityAllowList(env) {
  // Keep existing v1.0 Test authorization compatible during migration, but
  // require an explicit environment allowlist before any new capability such
  // as form-suggestions can be used.
  if (env.HERO_EXTERNAL_SPEND_CAPABILITIES === undefined || env.HERO_EXTERNAL_SPEND_CAPABILITIES.trim() === "") return LEGACY_CAPABILITIES;
  const values = allowList(env, "HERO_EXTERNAL_SPEND_CAPABILITIES", SAFE_CAPABILITY);
  if (values.some(value => !AI_PROJECT_SCOPE_CAPABILITIES.includes(value))) {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", "HERO_EXTERNAL_SPEND_CAPABILITIES contains an unsupported capability.");
  }
  return values;
}

function projectScope(env) {
  const value = env.HERO_EXTERNAL_SPEND_PROJECT_SCOPE ?? "single-project";
  if (!PROJECT_SCOPE_MODES.includes(value)) {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", "HERO_EXTERNAL_SPEND_PROJECT_SCOPE must be single-project or all-test-projects.");
  }
  if (value === "all-test-projects" && env.HERO_EXTERNAL_SPEND_ENVIRONMENT !== "test") {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", "all-test-projects requires HERO_EXTERNAL_SPEND_ENVIRONMENT=test.");
  }
  return value;
}

function expiry(env) {
  const value = env.HERO_EXTERNAL_SPEND_EXPIRES_AT;
  if (typeof value !== "string" || value.trim() === "" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", "HERO_EXTERNAL_SPEND_EXPIRES_AT must be an explicit UTC timestamp.");
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", "HERO_EXTERNAL_SPEND_EXPIRES_AT is invalid.");
  }
  return { value, timestamp };
}

export function readRuntimeExternalSpendPolicy({ env = process.env } = {}) {
  const active = booleanValue(env, "HERO_EXTERNAL_SPEND_AUTHORIZATION_ACTIVE", false);
  if (!active) return immutable({ active: false, globalStop: booleanValue(env, "HERO_EXTERNAL_SPEND_GLOBAL_STOP", false) });
  const expiresAt = expiry(env);
  const approvedProjectScope = projectScope(env);
  const approvedProjectId = required(env, "HERO_EXTERNAL_SPEND_PROJECT_ID");
  if (approvedProjectScope === "all-test-projects" && approvedProjectId !== "all-test-projects") {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", "all-test-projects requires HERO_EXTERNAL_SPEND_PROJECT_ID=all-test-projects.");
  }
  const maxCostUnits = boundedInteger(env, "HERO_EXTERNAL_SPEND_MAX_COST_UNITS");
  if (maxCostUnits > 100_000 && approvedProjectScope !== "all-test-projects") {
    throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", "A cumulative authorization above 100000 requires the explicit all-test-projects Test scope.");
  }
  return immutable({
    active: true,
    authorizationId: required(env, "HERO_EXTERNAL_SPEND_AUTHORIZATION_ID"),
    projectId: approvedProjectId,
    projectScope: approvedProjectScope,
    stepId: required(env, "HERO_EXTERNAL_SPEND_STEP_ID"),
    documentVersion: required(env, "HERO_EXTERNAL_SPEND_DOCUMENT_VERSION", SAFE_VERSION),
    providerId: required(env, "HERO_EXTERNAL_SPEND_PROVIDER_ID", SAFE_ROLE),
    modelIds: allowList(env, "HERO_EXTERNAL_SPEND_MODEL_IDS", SAFE_ID),
    roleIds: allowList(env, "HERO_EXTERNAL_SPEND_ROLE_IDS", SAFE_ROLE),
    capabilities: capabilityAllowList(env),
    maxCostUnits,
    expiresAt: expiresAt.value,
    expiresAtMs: expiresAt.timestamp,
    globalStop: booleanValue(env, "HERO_EXTERNAL_SPEND_GLOBAL_STOP", false)
  });
}

function rejection(policy, code, reason) {
  return immutable({
    authorized: false,
    code,
    action: "external-spend",
    globalStop: policy.globalStop === true,
    reason
  });
}

export function createRuntimeExternalSpendAuthorizer({ env = process.env, clock = () => Date.now() } = {}) {
  const policy = readRuntimeExternalSpendPolicy({ env });
  if (typeof clock !== "function") throw new ExternalSpendAuthorizationError("EXTERNAL_SPEND_CONFIGURATION_INVALID", "clock must be a function.");

  const authorizeExternalSpend = async function authorizeExternalSpend(input = {}) {
    if (!policy.active) return rejection(policy, "EXTERNAL_SPEND_AUTHORIZATION_INACTIVE", "External spend authorization is inactive.");
    if (policy.globalStop) return rejection(policy, "GLOBAL_STOP_ACTIVE", "External spend Global Stop is active.");
    if (clock() >= policy.expiresAtMs) return rejection(policy, "EXTERNAL_SPEND_AUTHORIZATION_EXPIRED", "External spend authorization has expired.");
    const requestedCost = Number(input.maxCostUnits);
    const projectMatches = policy.projectScope === "all-test-projects"
      ? typeof input.projectId === "string" && SAFE_ID.test(input.projectId) && input.projectId !== "all-test-projects"
      : input.projectId === policy.projectId;
    const exactMatch = input.operation === "external-spend"
      && input.authorizationId === policy.authorizationId
      && projectMatches
      && input.stepId === policy.stepId
      && input.documentVersion === policy.documentVersion
      && input.providerId === policy.providerId
      && policy.modelIds.includes(input.modelId)
      && policy.roleIds.includes(input.role)
      && policy.capabilities.includes(input.capability)
      && Number.isSafeInteger(requestedCost)
      && requestedCost >= 0
      && requestedCost <= policy.maxCostUnits;
    if (!exactMatch) return rejection(policy, "EXTERNAL_SPEND_SCOPE_MISMATCH", "The invocation does not exactly match the approved external-spend scope.");
    return immutable({
      authorized: true,
      code: "AUTHORIZED",
      action: "external-spend",
      authorizationId: policy.authorizationId,
      // The immutable policy explicitly covers every Test project, but the
      // verified authorization must still carry the exact Project being
      // charged and audited for this invocation.
      projectId: input.projectId,
      projectScope: policy.projectScope,
      stepId: policy.stepId,
      documentVersion: policy.documentVersion,
      providerId: policy.providerId,
      modelId: input.modelId,
      role: input.role,
      // Capability is part of the exact authorization scope and must survive
      // verification so the orchestration layer can compare one complete,
      // immutable snapshot instead of rejecting an otherwise valid grant.
      capability: input.capability,
      maxCostUnits: policy.maxCostUnits,
      expiresAt: policy.expiresAt,
      globalStop: false,
      safeCheckpointRequired: false
    });
  };

  // Keep advisor preflight and invocation verification on one immutable,
  // non-sensitive authorization snapshot. A rotated Test env is adopted on
  // restart, never half-way through a running process.
  Object.defineProperty(authorizeExternalSpend, "policySnapshot", {
    value: () => policy,
    enumerable: false,
    configurable: false,
    writable: false
  });

  return Object.freeze(authorizeExternalSpend);
}
