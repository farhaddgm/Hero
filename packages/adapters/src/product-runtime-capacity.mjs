import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { normalizeProductRuntimeCapacitySnapshot, PRODUCT_RUNTIME_CAPACITY_TARGET } from "../../contracts/src/product-runtime-capacity.mjs";

const execFile = promisify(execFileCallback);
const SAFE_ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;

function copy(value) { return Object.freeze(structuredClone(value)); }

function assertPositiveInteger(label, value) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} is invalid.`);
  return value;
}

function assertSnapshotId(value) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error("snapshotId is invalid.");
  return value;
}

async function defaultExecutor({ argv, timeoutMs }) {
  try {
    const result = await execFile("docker", argv, { shell: false, timeout: timeoutMs, maxBuffer: 256_000, windowsHide: true, env: { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin" } });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { exitCode: Number.isInteger(error?.code) ? error.code : 1, stdout: "", stderr: "", timedOut: error?.code === "ETIMEDOUT" };
  }
}

/**
 * Observes only safe Docker host metadata. It never changes Docker state,
 * returns raw output, or grants runner authorization.
 */
export function createDockerProductRuntimeCapacityProbe({ executor = defaultExecutor, timeoutMs = 5_000 } = {}) {
  if (typeof executor !== "function") throw new Error("capacity probe executor must be a function.");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) throw new Error("capacity probe timeout is invalid.");
  return Object.freeze({
    async observe({ snapshotId, pidsLimit, maxConcurrentRuns, targetId = PRODUCT_RUNTIME_CAPACITY_TARGET, observedAt = new Date().toISOString() } = {}) {
      const safeSnapshotId = assertSnapshotId(snapshotId);
      const safePidsLimit = assertPositiveInteger("pidsLimit", pidsLimit);
      const safeMaxConcurrentRuns = assertPositiveInteger("maxConcurrentRuns", maxConcurrentRuns);
      const result = await executor({ argv: ["info", "--format", "{{json .}}"], timeoutMs });
      if (!result || result.exitCode !== 0 || typeof result.stdout !== "string") return copy({ status: "blocked", code: "PRODUCT_RUNTIME_CAPACITY_PROBE_FAILED", sideEffects: "none", timedOut: result?.timedOut === true });
      let info;
      try { info = JSON.parse(result.stdout); } catch { return copy({ status: "blocked", code: "PRODUCT_RUNTIME_CAPACITY_PROBE_INVALID_OUTPUT", sideEffects: "none" }); }
      const cpuCores = Number(info?.NCPU ?? info?.Ncpu);
      const memoryBytes = Number(info?.MemTotal ?? info?.MemTotalBytes);
      const memoryMiB = Math.floor(memoryBytes / 1_048_576);
      try {
        const snapshot = normalizeProductRuntimeCapacitySnapshot({ snapshotId: safeSnapshotId, targetId, environment: "test", cpuCores, memoryMiB, pidsLimit: safePidsLimit, maxConcurrentRuns: safeMaxConcurrentRuns, source: "docker.info", observedAt });
        return copy({ status: "observed", code: "PRODUCT_RUNTIME_CAPACITY_OBSERVED", sideEffects: "none", snapshot });
      } catch {
        return copy({ status: "blocked", code: "PRODUCT_RUNTIME_CAPACITY_PROBE_INVALID_METADATA", sideEffects: "none" });
      }
    }
  });
}
