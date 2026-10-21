import { PRODUCT_RUNTIME_DEFAULTS } from "./product-factory.mjs";

export const RUNNER_RESOURCE_PROFILES_CONTRACT_VERSION = "1.0";

export const RUNNER_PROFILE_IDS = Object.freeze(["light", "standard", "heavy"]);

export const RUNNER_PROFILE_FIELDS = Object.freeze(["cpuCores", "memoryMiB", "pidsLimit", "diskMiB", "timeoutSeconds", "maxConcurrentRuns"]);

/**
 * Hard ceilings that no profile, project override or request may exceed. CPU, memory, process count,
 * timeout and concurrency are tied to the Product runtime defaults so the two contracts cannot
 * drift; the disk ceiling is declared here because the Product runtime plan has no disk field yet.
 */
export const RUNNER_RESOURCE_CEILINGS = Object.freeze({
  cpuCores: PRODUCT_RUNTIME_DEFAULTS.cpuLimit,
  memoryMiB: PRODUCT_RUNTIME_DEFAULTS.memoryMiB,
  pidsLimit: PRODUCT_RUNTIME_DEFAULTS.pidsLimit,
  diskMiB: 4_096,
  timeoutSeconds: PRODUCT_RUNTIME_DEFAULTS.timeoutSeconds,
  maxConcurrentRuns: PRODUCT_RUNTIME_DEFAULTS.maxConcurrentRuns
});

const INTEGER_FIELDS = new Set(["memoryMiB", "pidsLimit", "diskMiB", "timeoutSeconds", "maxConcurrentRuns"]);

/** True for a finite positive number (integer for the integer-only fields). Zero, negative, NaN, Infinity and strings are all invalid. */
export function isValidLimit(field, value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return false;
  return INTEGER_FIELDS.has(field) ? Number.isInteger(value) : true;
}

export function getRunnerResourceProfilesSummary() {
  return Object.freeze({
    version: RUNNER_RESOURCE_PROFILES_CONTRACT_VERSION,
    profileIds: RUNNER_PROFILE_IDS,
    fields: RUNNER_PROFILE_FIELDS,
    ceilings: RUNNER_RESOURCE_CEILINGS,
    rules: Object.freeze([
      "A task without a known profile is refused (fail closed); there is no default profile.",
      "A limit is a finite positive number; zero, unlimited or missing is refused.",
      "A project may lower a profile limit but never raise it, and nothing exceeds the hard ceilings.",
      "The sum of reservations never exceeds the observed host capacity; unknown capacity is not enough."
    ]),
    boundary: "Profiles map to container options as data only. Applying real cgroup limits on a host is a separate gated step."
  });
}

/** Validates the profile registry against the contract (also used by check:deployment-contract). */
export function validateRunnerProfileRegistry(registry) {
  const errors = [];
  if (!registry || registry.schema !== "hero.runner-resource-profiles/v1") return ["unexpected runner profile registry schema"];
  if (!/^\d+\.\d+\.\d+$/.test(registry.version ?? "")) errors.push("runner profile registry version must be SemVer");
  const profiles = registry.profiles && typeof registry.profiles === "object" ? registry.profiles : {};
  for (const id of RUNNER_PROFILE_IDS) if (!profiles[id]) errors.push(`profile ${id} is missing`);
  for (const id of Object.keys(profiles)) if (!RUNNER_PROFILE_IDS.includes(id)) errors.push(`profile ${id} is not part of the contract`);
  for (const id of RUNNER_PROFILE_IDS) {
    const profile = profiles[id];
    if (!profile) continue;
    for (const field of RUNNER_PROFILE_FIELDS) {
      const value = profile[field];
      if (!isValidLimit(field, value)) errors.push(`${id}.${field} must be a finite positive ${INTEGER_FIELDS.has(field) ? "integer" : "number"}`);
      else if (value > RUNNER_RESOURCE_CEILINGS[field]) errors.push(`${id}.${field} exceeds the hard ceiling ${RUNNER_RESOURCE_CEILINGS[field]}`);
    }
    for (const field of Object.keys(profile)) if (!RUNNER_PROFILE_FIELDS.includes(field) && field !== "purpose") errors.push(`${id}.${field} is not a known limit`);
  }
  for (const [smaller, larger] of [["light", "standard"], ["standard", "heavy"]]) {
    for (const field of RUNNER_PROFILE_FIELDS) {
      if (profiles[smaller] && profiles[larger] && profiles[smaller][field] > profiles[larger][field]) errors.push(`${smaller}.${field} must not exceed ${larger}.${field}`);
    }
  }
  return errors;
}
