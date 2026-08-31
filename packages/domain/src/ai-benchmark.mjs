import { createHash } from "node:crypto";

import { AI_BENCHMARK_CASES, getAiBenchmarkContractSummary } from "../../contracts/src/ai-benchmark.mjs";

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function identifier(label, value) {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(value)) throw new AiBenchmarkError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function rate(part, whole) {
  return whole === 0 ? 0 : Number((part / whole).toFixed(4));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

export function digestAiBenchmark(run) {
  const { digest: ignoredDigest, ...withoutDigest } = run ?? {};
  return createHash("sha256").update(JSON.stringify(stable(withoutDigest))).digest("hex");
}

export class AiBenchmarkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AiBenchmarkError";
    this.code = code;
  }
}

/**
 * Runs a provider/profile comparison against injected deterministic runners.
 * The runner is intentionally an adapter: this module never opens a network connection.
 */
export async function runAiBenchmark({ benchmarkId, providerId, modelId, profileId, datasetVersion = "synthetic-v1", cases = AI_BENCHMARK_CASES, runner, nowMs = Date.now } = {}) {
  identifier("benchmarkId", benchmarkId);
  identifier("providerId", providerId);
  identifier("modelId", modelId);
  identifier("profileId", profileId);
  identifier("datasetVersion", datasetVersion);
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 32) throw new AiBenchmarkError("INVALID_CASES", "cases must contain 1-32 items.");
  if (typeof runner !== "function") throw new AiBenchmarkError("RUNNER_REQUIRED", "A deterministic benchmark runner is required.");
  const results = [];
  for (const benchmarkCase of cases) {
    const started = nowMs();
    let result;
    try {
      result = await runner(copy({ benchmarkId, providerId, modelId, profileId, benchmarkCase }));
    } catch (error) {
      result = { status: "failed", errorCode: error?.code ?? "RUNNER_FAILED" };
    }
    const observedLatency = Number.isInteger(result?.latencyMs) && result.latencyMs >= 0 ? result.latencyMs : Math.max(0, nowMs() - started);
    const latencyMs = observedLatency;
    const completed = result?.status === "completed";
    const schemaPass = completed && result.schema === benchmarkCase.outputSchema;
    const safetyPass = result?.safetyPass === true;
    const costUnits = Number.isInteger(result?.costUnits) && result.costUnits >= 0 ? result.costUnits : 0;
    results.push(Object.freeze({ caseId: benchmarkCase.caseId, role: benchmarkCase.role, status: completed ? "completed" : "failed", schemaPass, safetyPass, latencyMs, costUnits, errorCode: completed ? null : result?.errorCode ?? "RUNNER_FAILED" }));
  }
  const completed = results.filter(result => result.status === "completed").length;
  const schemaPass = results.filter(result => result.schemaPass).length;
  const safetyPass = results.filter(result => result.safetyPass).length;
  const totalCostUnits = results.reduce((sum, result) => sum + result.costUnits, 0);
  const averageLatencyMs = Number((results.reduce((sum, result) => sum + result.latencyMs, 0) / results.length).toFixed(2));
  const run = {
    benchmarkId,
    providerId,
    modelId,
    profileId,
    datasetVersion,
    mode: "synthetic-deterministic",
    contractVersion: "1.0",
    results,
    metrics: { completionRate: rate(completed, results.length), schemaPassRate: rate(schemaPass, results.length), safetyPassRate: rate(safetyPass, results.length), averageLatencyMs, totalCostUnits },
    recommendationEligible: completed === results.length && schemaPass === results.length && safetyPass === results.length,
    authority: { canAuthorizeProvider: false, canAuthorizeMutation: false, canAuthorizeRelease: false }
  };
  return copy({ ...run, digest: digestAiBenchmark(run) });
}

export function compareAiBenchmarks(runs) {
  if (!Array.isArray(runs) || runs.length < 1) throw new AiBenchmarkError("RUNS_REQUIRED", "At least one benchmark run is required.");
  const valid = runs.filter(run => run?.recommendationEligible === true);
  const sorted = [...valid].sort((left, right) => left.metrics.totalCostUnits - right.metrics.totalCostUnits || left.metrics.averageLatencyMs - right.metrics.averageLatencyMs || right.metrics.schemaPassRate - left.metrics.schemaPassRate || left.providerId.localeCompare(right.providerId));
  return copy({ compared: runs.length, eligible: valid.length, winner: sorted[0] ? { providerId: sorted[0].providerId, modelId: sorted[0].modelId, profileId: sorted[0].profileId } : null, decision: "advisory-only", runs });
}

export function getAiBenchmarkContract() {
  return getAiBenchmarkContractSummary();
}
