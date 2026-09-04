const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const METRICS = ["completionRate", "schemaPassRate", "safetyPassRate", "averageLatencyMs", "totalCostUnits"];

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function parseJson(value, label) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new PostgresBenchmarkStoreError("INVALID_DATABASE_ROW", `${label} is not valid JSON.`);
  }
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", `${label} is invalid.`);
  }
  return value;
}

function assertTimestamp(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", "recordedAt must be an ISO timestamp.");
  }
  return value;
}

function assertNonNegativeInteger(label, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", `${label} must be a non-negative integer.`);
  }
  return value;
}

function normalizeRun(run) {
  if (!run || typeof run !== "object" || Array.isArray(run)) {
    throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", "A benchmark run is required.");
  }
  const benchmarkId = assertIdentifier("benchmarkId", run.benchmarkId);
  const providerId = assertIdentifier("providerId", run.providerId);
  const modelId = assertIdentifier("modelId", run.modelId);
  const profileId = assertIdentifier("profileId", run.profileId);
  const datasetVersion = assertIdentifier("datasetVersion", run.datasetVersion);
  if (run.mode !== "synthetic-deterministic") throw new PostgresBenchmarkStoreError("LIVE_BENCHMARK_REJECTED", "Only synthetic-deterministic benchmark runs may be persisted here.");
  if (typeof run.digest !== "string" || !/^[a-f0-9]{64}$/.test(run.digest)) throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", "digest must be a SHA-256 hex digest.");
  if (!run.authority || run.authority.canAuthorizeProvider !== false || run.authority.canAuthorizeMutation !== false || run.authority.canAuthorizeRelease !== false) {
    throw new PostgresBenchmarkStoreError("AUTHORITY_BOUNDARY_VIOLATION", "Benchmark persistence cannot store an authority-granting result.");
  }
  if (!run.metrics || typeof run.metrics !== "object") throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", "metrics are required.");
  for (const metric of METRICS) {
    if (typeof run.metrics[metric] !== "number" || !Number.isFinite(run.metrics[metric]) || run.metrics[metric] < 0) {
      throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", `${metric} must be a non-negative number.`);
    }
  }
  if (!Array.isArray(run.results) || run.results.length < 1 || run.results.length > 32) throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", "results must contain 1-32 items.");
  const caseIds = new Set();
  const results = run.results.map((result, index) => {
    const caseId = assertIdentifier(`results[${index}].caseId`, result?.caseId);
    if (caseIds.has(caseId)) throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", `results[${index}].caseId must be unique.`);
    caseIds.add(caseId);
    const role = assertIdentifier(`results[${index}].role`, result?.role);
    if (!['completed', 'failed'].includes(result?.status)) throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", `results[${index}].status is invalid.`);
    if (typeof result.schemaPass !== "boolean" || typeof result.safetyPass !== "boolean") throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK", `results[${index}] pass flags are invalid.`);
    const latencyMs = assertNonNegativeInteger(`results[${index}].latencyMs`, result.latencyMs);
    const costUnits = assertNonNegativeInteger(`results[${index}].costUnits`, result.costUnits);
    const errorCode = result.errorCode === null || result.errorCode === undefined ? null : assertIdentifier(`results[${index}].errorCode`, result.errorCode);
    return { resultId: `${benchmarkId}-${caseId}`, caseId, role, status: result.status, schemaPass: result.schemaPass, safetyPass: result.safetyPass, latencyMs, costUnits, errorCode };
  });
  return {
    benchmarkId,
    providerId,
    modelId,
    profileId,
    datasetVersion,
    mode: run.mode,
    contractVersion: run.contractVersion ?? "1.0",
    metrics: Object.fromEntries(METRICS.map(metric => [metric, run.metrics[metric]])),
    recommendationEligible: run.recommendationEligible === true,
    authority: { canAuthorizeProvider: false, canAuthorizeMutation: false, canAuthorizeRelease: false },
    digest: run.digest,
    recordedAt: assertTimestamp(run.recordedAt),
    results,
    data: { datasetVersion, contractVersion: run.contractVersion ?? "1.0", digest: run.digest, recordedAt: run.recordedAt }
  };
}

function rowToResult(row) {
  return {
    resultId: row.result_id,
    caseId: row.case_id,
    role: row.role,
    status: row.status,
    schemaPass: row.schema_pass === true,
    safetyPass: row.safety_pass === true,
    latencyMs: assertNonNegativeInteger("ai_benchmark_results.latency_ms", Number(row.latency_ms)),
    costUnits: assertNonNegativeInteger("ai_benchmark_results.cost_units", Number(row.cost_units)),
    errorCode: row.error_code ?? null
  };
}

function rowToRun(row, results) {
  const metrics = parseJson(row.metrics, "ai_benchmark_runs.metrics");
  const authority = parseJson(row.authority, "ai_benchmark_runs.authority");
  const data = parseJson(row.data, "ai_benchmark_runs.data") ?? {};
  return copy(normalizeRun({
    benchmarkId: row.benchmark_id,
    providerId: row.provider_id,
    modelId: row.model_id,
    profileId: row.profile_id,
    datasetVersion: data.datasetVersion ?? "synthetic-v1",
    mode: row.mode,
    contractVersion: data.contractVersion ?? "1.0",
    metrics,
    recommendationEligible: row.recommendation_eligible === true,
    authority,
    digest: data.digest,
    recordedAt: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : row.recorded_at,
    results: Object.freeze(results.map(rowToResult))
  }));
}

function assertTarget({ client, pool }) {
  if (client && typeof client.query === "function") return;
  if (pool && typeof pool.query === "function" && typeof pool.connect === "function") return;
  throw new PostgresBenchmarkStoreError("DATABASE_TARGET_INVALID", "A PostgreSQL client or pool is required.");
}

export class PostgresBenchmarkStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PostgresBenchmarkStoreError";
    this.code = code;
  }
}

export function createPostgresBenchmarkStore({ client, pool, now = () => new Date().toISOString() } = {}) {
  assertTarget({ client, pool });
  const readTarget = client ?? pool;

  async function transaction(work) {
    if (client) {
      await client.query("BEGIN");
      try {
        const value = await work(client);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      const value = await work(connection);
      await connection.query("COMMIT");
      return value;
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async function readById(benchmarkId, target = readTarget) {
    const runResult = await target.query(
      `SELECT benchmark_id, provider_id, model_id, profile_id, mode, metrics,
              recommendation_eligible, authority, recorded_at, data
         FROM ai_benchmark_runs
        WHERE benchmark_id = $1`,
      [assertIdentifier("benchmarkId", benchmarkId)]
    );
    const row = runResult.rows?.[0];
    if (!row) return null;
    const resultRows = await target.query(
      `SELECT result_id, benchmark_id, case_id, role, status, schema_pass,
              safety_pass, latency_ms, cost_units, error_code, data
         FROM ai_benchmark_results
        WHERE benchmark_id = $1
        ORDER BY result_id ASC`,
      [benchmarkId]
    );
    return rowToRun(row, resultRows.rows ?? []);
  }

  return Object.freeze({
    async save(run) {
      const normalized = normalizeRun(run);
      return transaction(async target => {
        await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`ai-benchmark:${normalized.benchmarkId}`]);
        const existing = await readById(normalized.benchmarkId, target);
        if (existing) {
          if (existing.digest !== normalized.digest) throw new PostgresBenchmarkStoreError("IDEMPOTENCY_CONFLICT", `benchmarkId ${normalized.benchmarkId} already contains a different digest.`);
          return copy({ ...existing, idempotent: true });
        }
        await target.query(
          `INSERT INTO ai_benchmark_runs
             (benchmark_id, provider_id, model_id, profile_id, mode, metrics,
              recommendation_eligible, authority, recorded_at, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [normalized.benchmarkId, normalized.providerId, normalized.modelId, normalized.profileId, normalized.mode, normalized.metrics, normalized.recommendationEligible, normalized.authority, normalized.recordedAt, normalized.data]
        );
        for (const result of normalized.results) {
          await target.query(
            `INSERT INTO ai_benchmark_results
               (result_id, benchmark_id, case_id, role, status, schema_pass,
                safety_pass, latency_ms, cost_units, error_code, data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [result.resultId, normalized.benchmarkId, result.caseId, result.role, result.status, result.schemaPass, result.safetyPass, result.latencyMs, result.costUnits, result.errorCode, {}]
          );
        }
        return copy({ ...normalized, idempotent: false });
      });
    },
    async read(benchmarkId) {
      return readById(benchmarkId);
    },
    async list({ limit = 50 } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new PostgresBenchmarkStoreError("INVALID_LIMIT", "limit must be between 1 and 100.");
      const result = await readTarget.query(
        `SELECT benchmark_id, provider_id, model_id, profile_id, mode, metrics,
                recommendation_eligible, authority, recorded_at, data
           FROM ai_benchmark_runs
          ORDER BY recorded_at DESC, benchmark_id DESC
          LIMIT $1`,
        [limit]
      );
      const runs = [];
      for (const row of result.rows ?? []) {
        const run = await readById(row.benchmark_id);
        if (run) runs.push(run);
      }
      return Object.freeze(runs);
    },
    async compare({ benchmarkIds, limit = 50 } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new PostgresBenchmarkStoreError("INVALID_LIMIT", "limit must be between 1 and 100.");
      if (benchmarkIds !== undefined && (!Array.isArray(benchmarkIds) || benchmarkIds.length < 1 || benchmarkIds.length > 100)) {
        throw new PostgresBenchmarkStoreError("INVALID_BENCHMARK_IDS", "benchmarkIds must contain between 1 and 100 items.");
      }
      const runs = Array.isArray(benchmarkIds) && benchmarkIds.length > 0
        ? (await Promise.all(benchmarkIds.map(id => readById(id)))).filter(Boolean)
        : await this.list({ limit });
      const eligible = runs.filter(run => run.recommendationEligible === true);
      const sorted = [...eligible].sort((left, right) => left.metrics.totalCostUnits - right.metrics.totalCostUnits || left.metrics.averageLatencyMs - right.metrics.averageLatencyMs || right.metrics.schemaPassRate - left.metrics.schemaPassRate || left.providerId.localeCompare(right.providerId));
      return copy({
        compared: runs.length,
        eligible: eligible.length,
        winner: sorted[0] ? { providerId: sorted[0].providerId, modelId: sorted[0].modelId, profileId: sorted[0].profileId, benchmarkId: sorted[0].benchmarkId } : null,
        decision: "advisory-only",
        runs
      });
    }
  });
}
