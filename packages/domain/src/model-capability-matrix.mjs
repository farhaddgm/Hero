import {
  CAPABILITY_KEYS,
  MAX_VERIFICATION_AGE_DAYS,
  UNKNOWN,
  isValidCapabilityValue,
  isValidIsoDay,
  validateModelCapabilityRegistry
} from "../../contracts/src/model-capabilities.mjs";

/**
 * NX-030 — model capability matrix: read, describe and match.
 *
 * The matrix records what a human verified about a (provider, model) pair. This module never fills a
 * gap: an unknown value stays unknown, a value without a verification day is `unverified`, an old one
 * is `stale`, and neither can confirm a requirement. Matching is advisory; it never picks a model.
 */

export class ModelCapabilityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ModelCapabilityError";
    this.code = code;
  }
}

/** What Hero declares each planned task kind needs. These are requirements, not claims about any model. */
export const TASK_CAPABILITY_NEEDS = Object.freeze({
  analysis: Object.freeze({ structuredOutput: true }),
  architecture: Object.freeze({ structuredOutput: true }),
  implementation: Object.freeze({ toolUse: true, structuredOutput: true }),
  testing: Object.freeze({ toolUse: true }),
  review: Object.freeze({ structuredOutput: true }),
  handoff: Object.freeze({})
});

const DAY_MS = 86_400_000;

function toMillis(now) {
  const value = typeof now === "function" ? now() : now;
  const parsed = typeof value === "number" ? value : Date.parse(value);
  if (Number.isNaN(parsed)) throw new ModelCapabilityError("INVALID_CLOCK", "A readable current time is required.");
  return parsed;
}

/** `unknown` | `unverified` | `stale` | `verified` for one cell. Never throws on odd data: odd data is unverified. */
export function cellStatus(cell, key, now) {
  if (!cell || cell.value === UNKNOWN || cell.value === undefined) return Object.freeze({ status: "unknown", ageDays: null });
  if (!isValidCapabilityValue(key, cell.value) || !isValidIsoDay(cell.verifiedAt) || typeof cell.source !== "string" || typeof cell.verifiedBy !== "string") return Object.freeze({ status: "unverified", ageDays: null });
  const nowMs = toMillis(now);
  const verifiedMs = Date.parse(`${cell.verifiedAt}T00:00:00.000Z`);
  if (verifiedMs > nowMs) return Object.freeze({ status: "unverified", ageDays: null });
  const ageDays = Math.floor((nowMs - verifiedMs) / DAY_MS);
  return Object.freeze({ status: ageDays > MAX_VERIFICATION_AGE_DAYS ? "stale" : "verified", ageDays });
}

function entryKey(entry) {
  return `${entry.providerId}/${entry.modelId}`;
}

function loadRegistry(registry) {
  const problems = validateModelCapabilityRegistry(registry);
  if (problems.length > 0) throw new ModelCapabilityError("REGISTRY_INVALID", `The model capability registry is invalid: ${problems[0]}`);
  return registry;
}

/** The readable view: every cell with its status. Unknown stays `unknown`; nothing is promoted to supported. */
export function describeModelCapabilities(registry, { now } = {}) {
  const loaded = loadRegistry(registry);
  const counts = { unknown: 0, unverified: 0, stale: 0, verified: 0 };
  const entries = [...loaded.entries].sort((a, b) => entryKey(a).localeCompare(entryKey(b))).map(entry => {
    const capabilities = {};
    for (const key of CAPABILITY_KEYS) {
      const cell = entry.capabilities[key];
      const { status, ageDays } = cellStatus(cell, key, now);
      counts[status] += 1;
      capabilities[key] = Object.freeze({
        status,
        // A value is exposed only when it is verified and fresh; otherwise the reader sees "unknown" so no stale or unverified value can be mistaken for a fact.
        value: status === "verified" ? cell.value : UNKNOWN,
        ageDays,
        ...(status === "verified" ? { source: cell.source, verifiedAt: cell.verifiedAt, verifiedBy: cell.verifiedBy } : {})
      });
    }
    return Object.freeze({ providerId: entry.providerId, modelId: entry.modelId, alias: entry.alias === true, capabilities: Object.freeze(capabilities) });
  });
  return Object.freeze({
    schema: "hero.model-capabilities-view/v1",
    registryVersion: loaded.version,
    maxVerificationAgeDays: MAX_VERIFICATION_AGE_DAYS,
    entryCount: entries.length,
    cellCounts: Object.freeze(counts),
    entries: Object.freeze(entries),
    boundary: "advisory: the matrix never selects or switches a model"
  });
}

function verdictFor(key, requirement, cell, now) {
  const { status } = cellStatus(cell, key, now);
  if (status !== "verified") return Object.freeze({ capability: key, verdict: "cannot-confirm", reason: status });
  const value = cell.value;
  if (key === "toolUse" || key === "structuredOutput") return Object.freeze({ capability: key, verdict: value === requirement ? "meets" : "does-not-meet", reason: "verified" });
  if (key === "contextWindowTokens") return Object.freeze({ capability: key, verdict: value >= requirement ? "meets" : "does-not-meet", reason: "verified" });
  if (key === "dataResidency") return Object.freeze({ capability: key, verdict: value.every(region => requirement.includes(region)) ? "meets" : "does-not-meet", reason: "verified" });
  return Object.freeze({ capability: key, verdict: "cannot-confirm", reason: "unsupported-requirement" });
}

function assertRequirements(requirements) {
  if (!requirements || typeof requirements !== "object" || Array.isArray(requirements)) throw new ModelCapabilityError("INVALID_REQUIREMENTS", "Requirements must be an object.");
  for (const [key, value] of Object.entries(requirements)) {
    if (!CAPABILITY_KEYS.includes(key)) throw new ModelCapabilityError("INVALID_REQUIREMENTS", `${key} is not a capability.`);
    if ((key === "toolUse" || key === "structuredOutput") && value !== true) throw new ModelCapabilityError("INVALID_REQUIREMENTS", `${key} can only be required as true.`);
    if (key === "contextWindowTokens" && !(Number.isInteger(value) && value >= 1)) throw new ModelCapabilityError("INVALID_REQUIREMENTS", "contextWindowTokens must be a positive integer.");
    if (key === "dataResidency" && !isValidCapabilityValue("dataResidency", value)) throw new ModelCapabilityError("INVALID_REQUIREMENTS", "dataResidency must list the acceptable regions.");
  }
  return requirements;
}

/**
 * "What does this task need, and which models can be confirmed to meet it?"
 * fit: `meets` (every requirement confirmed), `does-not-meet` (at least one confirmed failure),
 * `cannot-confirm` (something unknown, unverified or stale). With no verified value nothing `meets`.
 */
export function matchRequirementsToModels({ requirements, registry, now } = {}) {
  assertRequirements(requirements);
  const loaded = loadRegistry(registry);
  const models = [...loaded.entries].sort((a, b) => entryKey(a).localeCompare(entryKey(b))).map(entry => {
    const verdicts = Object.entries(requirements).map(([key, requirement]) => verdictFor(key, requirement, entry.capabilities[key], now));
    const fit = verdicts.some(item => item.verdict === "does-not-meet") ? "does-not-meet" : verdicts.every(item => item.verdict === "meets") ? "meets" : "cannot-confirm";
    return Object.freeze({ providerId: entry.providerId, modelId: entry.modelId, alias: entry.alias === true, fit, verdicts: Object.freeze(verdicts) });
  });
  return Object.freeze({
    schema: "hero.model-capability-match/v1",
    requirements: Object.freeze({ ...requirements }),
    models: Object.freeze(models),
    counts: Object.freeze({ meets: models.filter(item => item.fit === "meets").length, doesNotMeet: models.filter(item => item.fit === "does-not-meet").length, cannotConfirm: models.filter(item => item.fit === "cannot-confirm").length }),
    advisory: true,
    decision: null
  });
}

/** The single advisory field a Planner receives. It lists facts about models and decides nothing. */
export function adviseTaskGraph({ graph, registry, now } = {}) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const tasks = nodes.map(node => {
    const needs = Object.hasOwn(TASK_CAPABILITY_NEEDS, node.kind) ? TASK_CAPABILITY_NEEDS[node.kind] : null;
    if (needs === null) return Object.freeze({ taskId: node.taskId, kind: node.kind, requirements: null, counts: null, meets: Object.freeze([]), note: "no declared capability needs for this task kind" });
    const match = matchRequirementsToModels({ requirements: needs, registry, now });
    return Object.freeze({
      taskId: node.taskId,
      kind: node.kind,
      requirements: Object.freeze({ ...needs }),
      counts: match.counts,
      meets: Object.freeze(match.models.filter(item => item.fit === "meets").map(item => `${item.providerId}/${item.modelId}`))
    });
  });
  return Object.freeze({
    schema: "hero.model-capability-advice/v1",
    registryVersion: registry?.version ?? null,
    tasks: Object.freeze(tasks),
    advisory: true,
    decision: null,
    note: "Models that are not confirmed to meet a need are not excluded: the answer is unknown, not no."
  });
}
