import { POLICY_RISK_LEVELS, SETTINGS_LAYERS } from "../../contracts/src/project-settings.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const PATH = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*){1,7}$/;
const SENSITIVE = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const IMMUTABLE = Object.freeze({
  "security.projectIsolation": true,
  "security.auditRetention": "required",
  "security.secretReferencesOnly": true
});

function copy(value) { return Object.freeze(structuredClone(value)); }
function assertId(label, value) { if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new ProjectSettingsError("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; }
function assertPath(path) { if (typeof path !== "string" || !PATH.test(path)) throw new ProjectSettingsError("INVALID_SETTING_PATH", "A dotted lower-case setting path is required.", 400); return path; }
function assertSafe(value, path = "value") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertSafe(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE.test(key)) throw new ProjectSettingsError("SENSITIVE_SETTING_FORBIDDEN", `${path}.${key} cannot be stored in settings.`, 400);
    assertSafe(child, `${path}.${key}`);
  }
}
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function actorId(actor) { return assertId("actor", actor?.subject ?? actor?.userId); }
function layerRank(layer) { const rank = SETTINGS_LAYERS.indexOf(layer); if (rank < 0) throw new ProjectSettingsError("INVALID_SETTINGS_LAYER", "Settings layer is invalid.", 400); return rank; }

export class ProjectSettingsError extends Error {
  constructor(code, message, statusCode = 409) { super(message); this.name = "ProjectSettingsError"; this.code = code; this.statusCode = statusCode; }
}

/** Versioned settings with explicit provenance. This registry deliberately never
 * stores credentials or raw Secret values; they belong to a later Secret Store. */
export function createProjectSettingsRegistry({ now = () => new Date().toISOString(), templates = {} } = {}) {
  const records = new Map();
  const history = new Map();
  const policyPacks = new Map();
  let proposalCounter = 0;

  function key(projectId, path, layer, runId = null) { return `${projectId}:${path}:${layer}:${runId ?? "-"}`; }
  function append(record) {
    const historyKey = `${record.projectId}:${record.path}`;
    const previous = history.get(historyKey) ?? [];
    const stored = copy({ ...record, version: previous.length + 1, recordedAt: now() });
    records.set(key(stored.projectId, stored.path, stored.layer, stored.runId), stored);
    history.set(historyKey, [...previous, stored]);
    return stored;
  }
  function hydrateRecord(record) {
    if (!record || typeof record !== "object") throw new ProjectSettingsError("INVALID_HYDRATION", "Setting record is invalid.", 500);
    const normalizedProjectId = assertId("projectId", record.projectId);
    const normalizedPath = assertPath(record.path ?? record.settingPath);
    const layer = record.layer ?? record.settingsLayer;
    layerRank(layer); assertSafe(record.value ?? record.settingValue);
    if (!Number.isInteger(record.version ?? record.settingVersion) || (record.version ?? record.settingVersion) < 1) throw new ProjectSettingsError("INVALID_HYDRATION", "Setting version is invalid.", 500);
    const normalized = copy({
      ...record,
      projectId: normalizedProjectId,
      path: normalizedPath,
      layer,
      runId: record.runId ?? record.run_id ?? null,
      version: record.version ?? record.settingVersion,
      value: structuredClone(record.value ?? record.settingValue),
      actor: record.actor ?? record.actorId,
      source: record.source ?? layer,
      state: record.state ?? "active",
      recordedAt: record.recordedAt ?? record.recorded_at ?? now()
    });
    const historyKey = `${normalizedProjectId}:${normalizedPath}`;
    const previous = history.get(historyKey) ?? [];
    const withoutDuplicate = previous.filter(item => item.version !== normalized.version || item.layer !== normalized.layer || item.runId !== normalized.runId);
    history.set(historyKey, [...withoutDuplicate, normalized].sort((left, right) => left.version - right.version));
    records.set(key(normalizedProjectId, normalizedPath, layer, normalized.runId), normalized);
    return normalized;
  }
  function templateValues({ projectType = "application", riskLevel = "standard" } = {}) {
    if (!POLICY_RISK_LEVELS.includes(riskLevel)) throw new ProjectSettingsError("INVALID_RISK_LEVEL", "Risk level is invalid.", 400);
    const risk = riskLevel === "high";
    return {
      "ai.defaultModel": risk ? "sol" : "luna",
      "automation.mode": risk ? "approval-required" : "propose-first",
      "budget.tokenHardCap": risk ? 100000 : 250000,
      "project.type": projectType,
      "project.riskLevel": riskLevel
    };
  }
  function allCandidates(projectId, path, runId) {
    return SETTINGS_LAYERS.map(layer => records.get(key(projectId, path, layer, layer === "run-override" ? runId : null))).filter(item => item && item.state !== "superseded");
  }
  function resolve({ projectId, path, runId = null }) {
    assertId("projectId", projectId); assertPath(path);
    const candidates = allCandidates(projectId, path, runId);
    if (Object.hasOwn(IMMUTABLE, path)) {
      const invalid = candidates.find(item => !equal(item.value, IMMUTABLE[path]));
      if (invalid) throw new ProjectSettingsError("INVARIANT_WEAKENING_FORBIDDEN", `${path} cannot be changed.`, 409);
      return copy({ projectId, path, value: IMMUTABLE[path], layer: "hero-invariant", provenance: "Hero invariant", version: 1 });
    }
    const winner = [...candidates].sort((left, right) => layerRank(right.layer) - layerRank(left.layer) || right.version - left.version)[0];
    if (!winner) throw new ProjectSettingsError("SETTING_NOT_FOUND", `No effective value exists for ${path}.`, 404);
    return copy({ projectId, path, value: winner.value, layer: winner.layer, provenance: winner.source, version: winner.version, updatedBy: winner.actor, recordedAt: winner.recordedAt });
  }
  function setValue({ actor, projectId, path, value, layer = "project-override", runId = null, expectedVersion = null, reason, impact = "not-assessed", rollbackReference = null, source = null }) {
    const normalizedProjectId = assertId("projectId", projectId); const normalizedPath = assertPath(path); const normalizedActor = actorId(actor); layerRank(layer); assertSafe(value);
    if (layer === "hero-invariant") throw new ProjectSettingsError("INVARIANT_WRITE_FORBIDDEN", "Hero invariants cannot be edited through a project command.", 403);
    if (layer === "run-override" && !runId) throw new ProjectSettingsError("RUN_SCOPE_REQUIRED", "runId is required for a run override.", 400);
    if (layer !== "run-override" && runId !== null) throw new ProjectSettingsError("RUN_SCOPE_FORBIDDEN", "runId only applies to a run override.", 400);
    if (Object.hasOwn(IMMUTABLE, normalizedPath) && !equal(value, IMMUTABLE[normalizedPath])) throw new ProjectSettingsError("INVARIANT_WEAKENING_FORBIDDEN", `${normalizedPath} cannot be weakened.`, 409);
    const current = records.get(key(normalizedProjectId, normalizedPath, layer, runId));
    if (expectedVersion !== null && expectedVersion !== (current?.version ?? 0)) throw new ProjectSettingsError("STALE_SETTINGS_VERSION", "The setting changed before this command was applied.", 409);
    if (typeof reason !== "string" || reason.trim().length < 3) throw new ProjectSettingsError("REASON_REQUIRED", "A concise change reason is required.", 400);
    return append({ projectId: normalizedProjectId, path: normalizedPath, value: structuredClone(value), layer, runId, state: "active", actor: normalizedActor, reason: reason.trim().slice(0, 500), impact: String(impact).slice(0, 500), rollbackReference, source: source ?? layer, priorValue: current?.value ?? null });
  }
  function suggestPolicyPack({ projectId, projectType = "application", riskLevel = "standard", actor = { subject: "hero-system" } }) {
    const normalizedProjectId = assertId("projectId", projectId); const values = templateValues({ projectType, riskLevel });
    const policyPack = copy({ policyPackId: `policy-pack-${++proposalCounter}`, projectId: normalizedProjectId, projectType, riskLevel, state: "suggested", values, createdAt: now(), createdBy: actor?.subject ?? "hero-system" });
    policyPacks.set(normalizedProjectId, policyPack); return policyPack;
  }
  return Object.freeze({
    suggestPolicyPack,
    policyPack(projectId) { assertId("projectId", projectId); return policyPacks.get(projectId) ?? null; },
    applyPolicyPack({ actor, projectId, expectedState = "suggested", reason = "Approved policy pack" }) {
      const pack = policyPacks.get(assertId("projectId", projectId));
      if (!pack || pack.state !== expectedState) throw new ProjectSettingsError("POLICY_PACK_STATE_INVALID", "The policy pack is not available for application.", 409);
      const applied = Object.entries(pack.values).map(([path, value]) => setValue({ actor, projectId, path, value, layer: "policy-template", reason, impact: "Applied from suggested policy pack", source: `policy-pack:${pack.policyPackId}` }));
      policyPacks.set(projectId, copy({ ...pack, state: "applied", appliedAt: now() })); return Object.freeze(applied);
    },
    setValue,
    hydrateRecord,
    listRecords({ projectId } = {}) {
      if (projectId) assertId("projectId", projectId);
      return Object.freeze([...records.values()].filter(item => !projectId || item.projectId === projectId).sort((a, b) => a.projectId.localeCompare(b.projectId) || a.path.localeCompare(b.path) || a.version - b.version).map(copy));
    },
    purgeProject({ projectId }) {
      const normalizedProjectId = assertId("projectId", projectId);
      for (const [recordKey, record] of records) if (record.projectId === normalizedProjectId) records.delete(recordKey);
      for (const historyKey of history.keys()) if (historyKey.startsWith(`${normalizedProjectId}:`)) history.delete(historyKey);
      policyPacks.delete(normalizedProjectId);
      return copy({ projectId: normalizedProjectId, purged: true });
    },
    removeOverride({ actor, projectId, path, layer = "project-override", runId = null, expectedVersion, reason }) {
      const current = records.get(key(assertId("projectId", projectId), assertPath(path), layer, runId));
      if (!current) throw new ProjectSettingsError("SETTING_NOT_FOUND", "No override exists to remove.", 404);
      const normalizedActor = actorId(actor);
      if (expectedVersion !== current.version) throw new ProjectSettingsError("STALE_SETTINGS_VERSION", "The setting changed before this command was applied.", 409);
      if (typeof reason !== "string" || reason.trim().length < 3) throw new ProjectSettingsError("REASON_REQUIRED", "A concise change reason is required.", 400);
      return append({ ...current, state: "superseded", actor: normalizedActor, reason: reason.trim().slice(0, 500), impact: "Override removed", source: "override-removal", priorValue: current.value });
    },
    rollback({ actor, projectId, path, toVersion, reason }) {
      const entries = history.get(`${assertId("projectId", projectId)}:${assertPath(path)}`) ?? [];
      const target = entries.find(item => item.version === toVersion);
      if (!target) throw new ProjectSettingsError("ROLLBACK_VERSION_NOT_FOUND", "Requested settings version does not exist.", 404);
      return setValue({ actor, projectId, path, value: target.value, layer: target.layer, runId: target.runId, expectedVersion: records.get(key(projectId, path, target.layer, target.runId))?.version ?? 0, reason, impact: `Rollback to version ${toVersion}`, rollbackReference: `settings:${projectId}:${path}:${toVersion}`, source: "rollback" });
    },
    effective({ projectId, path, runId = null }) { return resolve({ projectId, path, runId }); },
    effectiveProject({ projectId, runId = null }) {
      assertId("projectId", projectId); const paths = new Set([...Object.keys(IMMUTABLE), ...[...records.values()].filter(item => item.projectId === projectId).map(item => item.path)]);
      return Object.freeze([...paths].sort().map(path => resolve({ projectId, path, runId })));
    },
    history({ projectId, path }) { return Object.freeze([...(history.get(`${assertId("projectId", projectId)}:${assertPath(path)}`) ?? [])]); },
    invariants: copy(IMMUTABLE)
  });
}
