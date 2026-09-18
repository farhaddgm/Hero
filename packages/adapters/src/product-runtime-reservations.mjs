import { evaluateProductRuntimeAdmission } from "../../domain/src/product-factory.mjs";

const SAFE_PROJECT = /^[a-z][a-z0-9-]{2,62}$/;
const SAFE_RUN = /^[a-z][a-z0-9-]{2,127}$/;

function immutableCopy(value) { return Object.freeze(structuredClone(value)); }

function assertId(label, value, pattern) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function assertList(label, value, predicate) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.some(item => !predicate(item))) throw new Error(`${label} contains an invalid item.`);
  return [...value];
}

function resourceNamesFor(plan, resourceNames) {
  return resourceNames ?? [
    plan?.isolation?.composeProject,
    plan?.isolation?.database,
    plan?.isolation?.volume,
    plan?.isolation?.network
  ].filter(Boolean);
}

function reservationKey(projectId, runId) { return `${projectId}:${runId}`; }

/**
 * Process-local Product Test reservation guard.
 *
 * This is intentionally not a host inventory or a persistence substitute. It
 * protects one configured Runner from concurrent port/resource collisions;
 * cross-process and restart-safe reservations remain a later Product Test
 * infrastructure gate.
 */
export function createProductRuntimeReservationRegistry({ now = () => new Date().toISOString() } = {}) {
  const reservations = new Map();

  function occupied(exceptKey = null) {
    const active = [...reservations.values()].filter(item => item.key !== exceptKey);
    return {
      ports: active.flatMap(item => item.ports),
      resourceNames: active.flatMap(item => item.resourceNames)
    };
  }

  function reserve({ projectId, runId, plan, ports = plan?.isolation?.ports, resourceNames = resourceNamesFor(plan) } = {}) {
    const safeProjectId = assertId("projectId", projectId, SAFE_PROJECT);
    const safeRunId = assertId("runId", runId, SAFE_RUN);
    const key = reservationKey(safeProjectId, safeRunId);
    const requestedPorts = assertList("ports", ports ?? [], port => Number.isInteger(port) && port >= 1024 && port <= 65535);
    const requestedNames = assertList("resourceNames", resourceNames ?? [], name => typeof name === "string" && /^hero-product-[a-z0-9-]+$/.test(name));
    if (plan?.state !== "approved" || plan?.execution?.mode !== "isolated-test") return immutableCopy({ status: "blocked", code: "PRODUCT_RUNTIME_RESOURCE_CONFLICT", admission: { decision: "reject", errors: ["Product Test reservations require an approved isolated-test plan."], sideEffects: "none" } });
    const existing = reservations.get(key);
    if (existing) {
      const same = JSON.stringify(existing.ports) === JSON.stringify(requestedPorts) && JSON.stringify(existing.resourceNames) === JSON.stringify(requestedNames);
      return immutableCopy({ status: same ? "replayed" : "blocked", code: same ? "PRODUCT_RUNTIME_RESERVATION_REPLAY" : "PRODUCT_RUNTIME_RESOURCE_CONFLICT", reservation: same ? existing : null });
    }
    const current = occupied();
    const admission = evaluateProductRuntimeAdmission({
      plan,
      networkMode: "none",
      ports: requestedPorts,
      reservedPorts: current.ports,
      resourceNames: requestedNames,
      reservedResourceNames: current.resourceNames,
      hostPaths: [],
      resourceLimits: {
        cpuLimit: plan?.resources?.cpuLimit,
        memoryMiB: plan?.resources?.memoryMiB,
        pidsLimit: plan?.resources?.pidsLimit,
        timeoutSeconds: plan?.execution?.timeoutSeconds,
        maxConcurrentRuns: plan?.execution?.maxConcurrentRuns
      }
    });
    if (admission.decision !== "admit") return immutableCopy({ status: "blocked", code: "PRODUCT_RUNTIME_RESOURCE_CONFLICT", admission });
    const reservation = immutableCopy({
      reservationId: `product-reservation-${safeProjectId}-${safeRunId}`,
      key,
      projectId: safeProjectId,
      runId: safeRunId,
      state: "active",
      ports: requestedPorts,
      resourceNames: requestedNames,
      reservedAt: now()
    });
    reservations.set(key, reservation);
    return immutableCopy({ status: "reserved", code: "PRODUCT_RUNTIME_RESERVED", reservation });
  }

  function inspect({ projectId, runId } = {}) {
    const safeProjectId = assertId("projectId", projectId, SAFE_PROJECT);
    const safeRunId = assertId("runId", runId, SAFE_RUN);
    return reservations.get(reservationKey(safeProjectId, safeRunId)) ?? null;
  }

  function release({ projectId, runId, reservationId } = {}) {
    const current = inspect({ projectId, runId });
    if (!current || (reservationId && current.reservationId !== reservationId)) return immutableCopy({ status: "not-found", code: "PRODUCT_RUNTIME_RESERVATION_NOT_FOUND" });
    reservations.delete(current.key);
    return immutableCopy({ status: "released", code: "PRODUCT_RUNTIME_RELEASED", reservation: current });
  }

  function snapshot() {
    return immutableCopy({ reservations: [...reservations.values()] });
  }

  return Object.freeze({ reserve, inspect, release, snapshot });
}
