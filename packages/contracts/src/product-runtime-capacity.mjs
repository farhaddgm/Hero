export const PRODUCT_RUNTIME_CAPACITY_CONTRACT_VERSION = "1.0";
export const PRODUCT_RUNTIME_CAPACITY_TARGET = "hero-product-test";

const ID = /^[a-z][a-z0-9-]{2,127}$/;
const SOURCE = /^[a-z][a-z0-9._:-]{2,127}$/;

function copy(value) { return Object.freeze(structuredClone(value)); }
function positiveNumber(value) { return typeof value === "number" && Number.isFinite(value) && value > 0; }
function positiveInteger(value) { return Number.isInteger(value) && value > 0; }

export function normalizeProductRuntimeCapacitySnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("capacity snapshot must be an object.");
  const normalized = {
    snapshotId: snapshot.snapshotId,
    targetId: snapshot.targetId ?? PRODUCT_RUNTIME_CAPACITY_TARGET,
    environment: snapshot.environment ?? "test",
    cpuCores: snapshot.cpuCores,
    memoryMiB: snapshot.memoryMiB,
    pidsLimit: snapshot.pidsLimit,
    maxConcurrentRuns: snapshot.maxConcurrentRuns,
    source: snapshot.source ?? "docker.info",
    observedAt: snapshot.observedAt
  };
  if (typeof normalized.snapshotId !== "string" || !ID.test(normalized.snapshotId)) throw new Error("capacity snapshotId is invalid.");
  if (typeof normalized.targetId !== "string" || !ID.test(normalized.targetId)) throw new Error("capacity targetId is invalid.");
  if (normalized.environment !== "test") throw new Error("capacity environment must be Test.");
  if (!positiveNumber(normalized.cpuCores)) throw new Error("capacity cpuCores is invalid.");
  if (!positiveInteger(normalized.memoryMiB)) throw new Error("capacity memoryMiB is invalid.");
  if (!positiveInteger(normalized.pidsLimit)) throw new Error("capacity pidsLimit is invalid.");
  if (!positiveInteger(normalized.maxConcurrentRuns)) throw new Error("capacity maxConcurrentRuns is invalid.");
  if (typeof normalized.source !== "string" || !SOURCE.test(normalized.source)) throw new Error("capacity source is invalid.");
  if (typeof normalized.observedAt !== "string" || Number.isNaN(Date.parse(normalized.observedAt))) throw new Error("capacity observedAt is invalid.");
  return copy(normalized);
}

export function evaluateProductRuntimeCapacity({ capacity, requested, reserved = { cpuCores: 0, memoryMiB: 0, pidsLimit: 0, concurrentRuns: 0 } } = {}) {
  const errors = [];
  let safeCapacity;
  try { safeCapacity = normalizeProductRuntimeCapacitySnapshot(capacity); } catch (error) { errors.push(error.message); }
  const safeRequested = requested && typeof requested === "object" ? requested : {};
  const safeReserved = reserved && typeof reserved === "object" ? reserved : {};
  if (!positiveNumber(safeRequested.cpuCores)) errors.push("requested cpuCores is invalid.");
  if (!positiveInteger(safeRequested.memoryMiB)) errors.push("requested memoryMiB is invalid.");
  if (!positiveInteger(safeRequested.pidsLimit)) errors.push("requested pidsLimit is invalid.");
  if (!positiveInteger(safeRequested.concurrentRuns)) errors.push("requested concurrentRuns is invalid.");
  if (!Number.isFinite(safeReserved.cpuCores) || safeReserved.cpuCores < 0) errors.push("reserved cpuCores is invalid.");
  if (!Number.isInteger(safeReserved.memoryMiB) || safeReserved.memoryMiB < 0) errors.push("reserved memoryMiB is invalid.");
  if (!Number.isInteger(safeReserved.pidsLimit) || safeReserved.pidsLimit < 0) errors.push("reserved pidsLimit is invalid.");
  if (!Number.isInteger(safeReserved.concurrentRuns) || safeReserved.concurrentRuns < 0) errors.push("reserved concurrentRuns is invalid.");
  if (safeCapacity && !errors.length) {
    if (safeReserved.cpuCores + safeRequested.cpuCores > safeCapacity.cpuCores) errors.push("Product Test CPU capacity is exhausted.");
    if (safeReserved.memoryMiB + safeRequested.memoryMiB > safeCapacity.memoryMiB) errors.push("Product Test memory capacity is exhausted.");
    if (safeReserved.pidsLimit + safeRequested.pidsLimit > safeCapacity.pidsLimit) errors.push("Product Test PID capacity is exhausted.");
    if (safeReserved.concurrentRuns + safeRequested.concurrentRuns > safeCapacity.maxConcurrentRuns) errors.push("Product Test concurrency capacity is exhausted.");
  }
  return copy({ decision: errors.length ? "reject" : "admit", errors, sideEffects: "none" });
}

export function getProductRuntimeCapacitySummary() {
  return copy({ version: PRODUCT_RUNTIME_CAPACITY_CONTRACT_VERSION, target: PRODUCT_RUNTIME_CAPACITY_TARGET, units: { cpu: "cores", memory: "MiB", pids: "processes", concurrency: "runs" }, boundary: "capacity is observed metadata; reservation and execution remain separately authorized" });
}

export function validateProductRuntimeCapacityContract() {
  const errors = [];
  if (PRODUCT_RUNTIME_CAPACITY_CONTRACT_VERSION !== "1.0") errors.push("Unexpected Product Runtime Capacity contract version.");
  if (!ID.test(PRODUCT_RUNTIME_CAPACITY_TARGET)) errors.push("Product Runtime Capacity target must be a safe identifier.");
  return errors;
}
