import {
  RUNNER_PROFILE_FIELDS,
  RUNNER_PROFILE_IDS,
  RUNNER_RESOURCE_CEILINGS,
  isValidLimit,
  validateRunnerProfileRegistry
} from "../../contracts/src/runner-resource-profiles.mjs";
import { normalizeProductRuntimeCapacitySnapshot } from "../../contracts/src/product-runtime-capacity.mjs";

/**
 * NX-007 — Runner resource profiles.
 *
 * Every Runner task names a profile (`light`, `standard`, `heavy`) whose CPU, memory, process,
 * disk and time limits cannot be weakened. A task without a profile is refused; there is no
 * default. Profiles map to container options as data only, and reservations are checked against
 * the observed host capacity. Applying real cgroup limits on a host is a separate gated step.
 */

export class RunnerProfileError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RunnerProfileError";
    this.code = code;
  }
}

const MICRO = 1_000_000;
const micro = value => Math.round(value * MICRO);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function frozen(value) {
  return deepFreeze(structuredClone(value));
}

/**
 * Resolves a task's profile. Project overrides may only lower a limit: a raise, a zero, a negative,
 * a non-number or an unknown field is refused instead of being clamped silently.
 */
export function resolveRunnerProfile({ registry, profileId, overrides = {} } = {}) {
  const problems = validateRunnerProfileRegistry(registry);
  if (problems.length > 0) throw new RunnerProfileError("PROFILE_REGISTRY_INVALID", `The profile registry is invalid: ${problems[0]}`);
  if (profileId === undefined || profileId === null || profileId === "") throw new RunnerProfileError("PROFILE_REQUIRED", "A Runner task must name a resource profile; there is no default.");
  if (typeof profileId !== "string" || !RUNNER_PROFILE_IDS.includes(profileId) || !Object.hasOwn(registry.profiles, profileId)) throw new RunnerProfileError("PROFILE_UNKNOWN", "The resource profile is not known.");
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) throw new RunnerProfileError("PROFILE_LIMIT_INVALID", "Overrides must be an object.");
  const base = registry.profiles[profileId];
  const limits = Object.fromEntries(RUNNER_PROFILE_FIELDS.map(field => [field, base[field]]));
  const lowered = [];
  for (const [field, value] of Object.entries(overrides)) {
    if (!RUNNER_PROFILE_FIELDS.includes(field)) throw new RunnerProfileError("PROFILE_OVERRIDE_UNKNOWN_FIELD", `${field} is not a profile limit.`);
    if (!isValidLimit(field, value)) throw new RunnerProfileError("PROFILE_LIMIT_INVALID", `${field} must be a finite positive ${Number.isInteger(base[field]) ? "integer" : "number"}; zero and unlimited are refused.`);
    if (value > base[field]) throw new RunnerProfileError("PROFILE_RAISE_REFUSED", `${field} cannot be raised above the ${profileId} profile.`);
    if (value < base[field]) lowered.push(field);
    limits[field] = value;
  }
  for (const field of RUNNER_PROFILE_FIELDS) {
    if (limits[field] > RUNNER_RESOURCE_CEILINGS[field]) throw new RunnerProfileError("PROFILE_CEILING_EXCEEDED", `${field} exceeds the hard ceiling.`);
  }
  return frozen({ profileId, limits, loweredFields: lowered.sort() });
}

/** Maps resolved limits to container options. Data only: nothing is started or applied. */
export function toContainerOptions(resolved) {
  if (!resolved || !RUNNER_PROFILE_IDS.includes(resolved.profileId) || !resolved.limits) throw new RunnerProfileError("PROFILE_REQUIRED", "A resolved profile is required.");
  const { cpuCores, memoryMiB, pidsLimit, diskMiB, timeoutSeconds } = resolved.limits;
  for (const field of RUNNER_PROFILE_FIELDS) if (!isValidLimit(field, resolved.limits[field]) || resolved.limits[field] > RUNNER_RESOURCE_CEILINGS[field]) throw new RunnerProfileError("PROFILE_LIMIT_INVALID", `${field} is not a valid limit.`);
  return frozen({
    profileId: resolved.profileId,
    argv: [
      "--cpus", String(cpuCores),
      "--memory", `${memoryMiB}m`,
      "--memory-swap", `${memoryMiB}m`,
      "--pids-limit", String(pidsLimit),
      "--tmpfs", `/tmp:rw,noexec,nosuid,size=${diskMiB}m`,
      "--read-only",
      "--security-opt", "no-new-privileges",
      "--cap-drop", "ALL",
      "--network", "none"
    ],
    composeLimits: { cpus: String(cpuCores), mem_limit: `${memoryMiB}m`, memswap_limit: `${memoryMiB}m`, pids_limit: pidsLimit },
    timeoutSeconds,
    sideEffects: "none"
  });
}

/** Sums resolved reservations in exact integer units (micro-cores) so floating point cannot hide an overrun. */
export function sumReservations(reservations = []) {
  let cpu = 0;
  const total = { memoryMiB: 0, pidsLimit: 0, diskMiB: 0, concurrentRuns: 0 };
  for (const item of reservations) {
    cpu += micro(item.limits.cpuCores);
    total.memoryMiB += item.limits.memoryMiB;
    total.pidsLimit += item.limits.pidsLimit;
    total.diskMiB += item.limits.diskMiB;
    total.concurrentRuns += 1;
  }
  return { cpuCores: cpu / MICRO, ...total };
}

/**
 * Admission against an observed capacity snapshot. Unknown capacity (including disk) is refused:
 * "we do not know how much room there is" is not "there is room".
 */
export function admitProfileRun({ capacity, reserved = [], resolved } = {}) {
  const errors = [];
  let snapshot = null;
  try { snapshot = normalizeProductRuntimeCapacitySnapshot(capacity); } catch (error) { errors.push(error.message); }
  const diskCapacity = capacity?.diskMiB;
  if (!Number.isInteger(diskCapacity) || diskCapacity <= 0) errors.push("DISK_CAPACITY_UNKNOWN: the host disk capacity was not observed.");
  if (!resolved?.limits) errors.push("A resolved profile is required.");
  if (errors.length === 0) {
    const current = sumReservations(reserved);
    const wanted = resolved.limits;
    if (micro(current.cpuCores) + micro(wanted.cpuCores) > micro(snapshot.cpuCores)) errors.push("Product Test CPU capacity is exhausted.");
    if (current.memoryMiB + wanted.memoryMiB > snapshot.memoryMiB) errors.push("Product Test memory capacity is exhausted.");
    if (current.pidsLimit + wanted.pidsLimit > snapshot.pidsLimit) errors.push("Product Test PID capacity is exhausted.");
    if (current.diskMiB + wanted.diskMiB > diskCapacity) errors.push("Product Test disk capacity is exhausted.");
    if (current.concurrentRuns + 1 > snapshot.maxConcurrentRuns) errors.push("Product Test concurrency capacity is exhausted.");
  }
  return frozen({ decision: errors.length === 0 ? "admit" : "reject", errors, sideEffects: "none" });
}

/** In-memory ledger: the sum of admitted reservations can never exceed the capacity it was built with. */
export function createRunnerReservationLedger({ capacity } = {}) {
  const held = new Map();
  return Object.freeze({
    reserve({ runId, resolved }) {
      if (typeof runId !== "string" || !/^[a-z][a-z0-9-]{2,127}$/.test(runId)) throw new RunnerProfileError("INVALID_RUN_ID", "runId is invalid.");
      if (held.has(runId)) return frozen({ decision: "reject", errors: ["The run already holds a reservation."], sideEffects: "none" });
      const decision = admitProfileRun({ capacity, reserved: [...held.values()], resolved });
      if (decision.decision === "admit") held.set(runId, resolved);
      return decision;
    },
    release(runId) {
      return held.delete(runId);
    },
    totals() {
      return frozen(sumReservations([...held.values()]));
    },
    size() {
      return held.size;
    }
  });
}
