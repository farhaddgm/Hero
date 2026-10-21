import { AI_PROVIDER_IDS } from "./ai-orchestration.mjs";

export const MODEL_CAPABILITIES_CONTRACT_VERSION = "1.0";
export const MODEL_CAPABILITIES_SCHEMA = "hero.model-capabilities/v1";

export const CAPABILITY_KEYS = Object.freeze(["contextWindowTokens", "toolUse", "structuredOutput", "dataResidency"]);

/** A verification older than this is stale and cannot confirm anything. */
export const MAX_VERIFICATION_AGE_DAYS = 90;

export const UNKNOWN = "unknown";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{1,79}$/;
const REGION = /^[a-z][a-z0-9-]{1,31}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Shape of a known (non-unknown) value per capability. */
export function isValidCapabilityValue(key, value) {
  if (key === "contextWindowTokens") return Number.isInteger(value) && value >= 1 && value <= 100_000_000;
  if (key === "toolUse" || key === "structuredOutput") return typeof value === "boolean";
  if (key === "dataResidency") return Array.isArray(value) && value.length >= 1 && value.length <= 20 && new Set(value).size === value.length && value.every(item => typeof item === "string" && REGION.test(item));
  return false;
}

export function isValidIsoDay(value) {
  if (typeof value !== "string" || !ISO_DAY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function validateSource(source) {
  if (typeof source !== "string") return false;
  try {
    const url = new URL(source);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/**
 * Validates the registry. With `strict: true` (used for the committed file) a known value must carry its
 * source, verification day and verifier: a guessed value cannot be committed. Without `strict` a known value
 * with missing evidence is allowed to load but is reported as unverified by the matrix.
 */
export function validateModelCapabilityRegistry(registry, { strict = false } = {}) {
  const errors = [];
  if (!registry || registry.schema !== MODEL_CAPABILITIES_SCHEMA) return ["unexpected model capability registry schema"];
  if (!/^\d+\.\d+\.\d+$/.test(registry.version ?? "")) errors.push("registry version must be SemVer");
  if (!Array.isArray(registry.entries)) return [...errors, "entries must be an array"];
  const seen = new Set();
  for (const [index, entry] of registry.entries.entries()) {
    const label = `${entry?.providerId}/${entry?.modelId}`;
    if (!AI_PROVIDER_IDS.includes(entry?.providerId)) errors.push(`entry ${index}: providerId is not a known provider`);
    if (typeof entry?.modelId !== "string" || !IDENTIFIER.test(entry.modelId)) errors.push(`entry ${index}: modelId is invalid`);
    if (seen.has(label)) errors.push(`${label}: duplicate (provider, model)`);
    seen.add(label);
    if (entry?.alias !== undefined && typeof entry.alias !== "boolean") errors.push(`${label}: alias must be boolean`);
    const capabilities = entry?.capabilities;
    if (!capabilities || typeof capabilities !== "object") { errors.push(`${label}: capabilities are required`); continue; }
    for (const key of Object.keys(capabilities)) if (!CAPABILITY_KEYS.includes(key)) errors.push(`${label}.${key}: unknown capability`);
    for (const key of CAPABILITY_KEYS) {
      const cell = capabilities[key];
      if (!cell || typeof cell !== "object") { errors.push(`${label}.${key}: must be stated, even as unknown`); continue; }
      if (cell.value === UNKNOWN) {
        for (const field of ["source", "verifiedAt", "verifiedBy"]) if (cell[field] !== undefined) errors.push(`${label}.${key}: an unknown value must not claim ${field}`);
        continue;
      }
      if (!isValidCapabilityValue(key, cell.value)) { errors.push(`${label}.${key}: value is invalid`); continue; }
      if (cell.source !== undefined && !validateSource(cell.source)) errors.push(`${label}.${key}: source must be an https URL without credentials, query or fragment`);
      if (cell.verifiedAt !== undefined && !isValidIsoDay(cell.verifiedAt)) errors.push(`${label}.${key}: verifiedAt must be a YYYY-MM-DD day`);
      if (cell.verifiedBy !== undefined && (typeof cell.verifiedBy !== "string" || !IDENTIFIER.test(cell.verifiedBy))) errors.push(`${label}.${key}: verifiedBy is invalid`);
      if (strict) for (const field of ["source", "verifiedAt", "verifiedBy"]) if (cell[field] === undefined) errors.push(`${label}.${key}: a known value needs ${field} (a guessed value cannot be committed)`);
    }
  }
  return errors;
}

export function getModelCapabilitiesSummary() {
  return Object.freeze({
    version: MODEL_CAPABILITIES_CONTRACT_VERSION,
    capabilities: CAPABILITY_KEYS,
    maxVerificationAgeDays: MAX_VERIFICATION_AGE_DAYS,
    rules: Object.freeze([
      "An unknown capability is never reported as supported.",
      "A known value without a verification day, or older than the limit, cannot confirm a requirement.",
      "Values are verified by a human from the provider's official documentation; the agent never guesses them.",
      "The matrix is advisory: it never selects, switches or authorizes a model."
    ])
  });
}
