import { POLICY_RISK_LEVELS, REQUIRED_POLICY_PATHS, SETTINGS_LAYERS, policyPackTemplate, satisfiesFloor, settingsFieldFor, validateSettingValue } from "../../contracts/src/project-settings.mjs";
import { PRODUCT_TYPES } from "../../contracts/src/product-factory.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const PATH = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*){1,7}$/;
const SENSITIVE = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const IMMUTABLE = Object.freeze({
  "security.projectIsolation": true,
  "security.auditRetention": "required",
  "security.secretReferencesOnly": true
});
const OVERRIDE_LAYERS = Object.freeze(["project-override", "run-override"]);
const REMOVAL_SOURCE = "override-removal";
// Internal capability: only applyPolicyPack and rollback may write the template layer.
const TEMPLATE_WRITE = Symbol("template-write");

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
function diffOf(before, after, removed = false) {
  if (removed) return { kind: "removed", before, after: null };
  if (before === undefined) return { kind: "added", before: null, after };
  return { kind: equal(before, after) ? "unchanged" : "changed", before, after };
}

export class ProjectSettingsError extends Error {
  constructor(code, message, statusCode = 409, details = undefined) { super(message); this.name = "ProjectSettingsError"; this.code = code; this.statusCode = statusCode; if (details) this.details = details; }
}

/** Versioned settings with explicit provenance. This registry deliberately never
 * stores credentials or raw Secret values; they belong to a later Secret Store. */
export function createProjectSettingsRegistry({ now = () => new Date().toISOString() } = {}) {
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
    const source = record.source ?? layer;
    const normalized = copy({
      ...record,
      projectId: normalizedProjectId,
      path: normalizedPath,
      layer,
      runId: record.runId ?? record.run_id ?? null,
      version: record.version ?? record.settingVersion,
      value: structuredClone(record.value ?? record.settingValue),
      actor: record.actor ?? record.actorId,
      source,
      // The removal row is persisted like any version; its lifecycle is derived from
      // the source so a restart can never resurrect a removed override.
      state: source === REMOVAL_SOURCE ? "superseded" : (record.state ?? "active"),
      recordedAt: record.recordedAt ?? record.recorded_at ?? now()
    });
    const historyKey = `${normalizedProjectId}:${normalizedPath}`;
    const previous = history.get(historyKey) ?? [];
    const withoutDuplicate = previous.filter(item => item.version !== normalized.version || item.layer !== normalized.layer || item.runId !== normalized.runId);
    history.set(historyKey, [...withoutDuplicate, normalized].sort((left, right) => left.version - right.version));
    const recordKey = key(normalizedProjectId, normalizedPath, layer, normalized.runId);
    const current = records.get(recordKey);
    if (!current || current.version <= normalized.version) records.set(recordKey, normalized);
    return normalized;
  }
  function templateFor({ projectType = "application", riskLevel = "standard" } = {}) {
    if (!POLICY_RISK_LEVELS.includes(riskLevel)) throw new ProjectSettingsError("INVALID_RISK_LEVEL", "Risk level is invalid.", 400);
    if (!PRODUCT_TYPES.includes(projectType)) throw new ProjectSettingsError("INVALID_PROJECT_TYPE", "Project type is invalid.", 400);
    return policyPackTemplate({ projectType, riskLevel });
  }
  /** Guards come from the canonical contract template selected by the applied pack,
   * never from stored values, so a tampered or hand-written row cannot lower a floor. */
  function guardsFor(projectId) {
    const type = records.get(key(projectId, "project.type", "policy-template"));
    const risk = records.get(key(projectId, "project.riskLevel", "policy-template"));
    if (!type || !risk || type.state === "superseded" || risk.state === "superseded") return null;
    if (!PRODUCT_TYPES.includes(type.value) || !POLICY_RISK_LEVELS.includes(risk.value)) throw new ProjectSettingsError("POLICY_CONFLICT", "The applied policy template is not recognised.", 409);
    return policyPackTemplate({ projectType: type.value, riskLevel: risk.value });
  }
  function floorFor(projectId, path) {
    const template = guardsFor(projectId);
    return template && template.guardedPaths.includes(path) ? { value: template.values[path], templateId: template.templateId } : null;
  }
  function assertFloor(projectId, path, value) {
    const floor = floorFor(projectId, path);
    if (floor && !satisfiesFloor(path, value, floor.value)) throw new ProjectSettingsError("POLICY_FLOOR_VIOLATION", `${path} cannot be relaxed below the ${floor.templateId} floor.`, 409, { path, floor: floor.value });
  }
  function candidateFor(projectId, path, layer, runId) { return records.get(key(projectId, path, layer, layer === "run-override" ? runId : null)) ?? null; }
  function allCandidates(projectId, path, runId) {
    return SETTINGS_LAYERS.map(layer => candidateFor(projectId, path, layer, runId)).filter(item => item && item.state !== "superseded");
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
    // Fail closed rather than serve a value that a hydrated or legacy row made invalid.
    const schemaReason = validateSettingValue(path, winner.value);
    if (schemaReason) throw new ProjectSettingsError("SETTING_SCHEMA_CONFLICT", `${path} has an invalid stored value: ${schemaReason}.`, 409, { path, layer: winner.layer, version: winner.version });
    const floor = floorFor(projectId, path);
    if (floor && !satisfiesFloor(path, winner.value, floor.value)) throw new ProjectSettingsError("POLICY_CONFLICT", `${path} relaxes the ${floor.templateId} floor.`, 409, { path, layer: winner.layer, version: winner.version, floor: floor.value });
    return copy({ projectId, path, value: winner.value, layer: winner.layer, provenance: winner.source, version: winner.version, updatedBy: winner.actor, recordedAt: winner.recordedAt });
  }
  function explain({ projectId, path, runId = null }) {
    assertId("projectId", projectId); assertPath(path);
    let effective = null; let conflict = null;
    try { effective = resolve({ projectId, path, runId }); } catch (error) {
      if (!(error instanceof ProjectSettingsError)) throw error;
      if (error.code !== "SETTING_NOT_FOUND") conflict = { code: error.code, message: error.message };
    }
    const chain = [...SETTINGS_LAYERS].reverse().map(layer => {
      if (layer === "hero-invariant") return Object.hasOwn(IMMUTABLE, path) ? { layer, status: effective?.layer === layer ? "winner" : "locked", value: IMMUTABLE[path], version: 1, source: "Hero invariant" } : { layer, status: "absent" };
      if (layer === "run-override" && !runId) return { layer, status: "not-applicable" };
      const item = candidateFor(projectId, path, layer, runId);
      if (!item) return { layer, status: "absent" };
      const status = item.state === "superseded" ? "removed" : effective && effective.layer === layer && effective.version === item.version ? "winner" : conflict ? "conflict" : "shadowed";
      return { layer, status, value: item.value, version: item.version, source: item.source, actor: item.actor, recordedAt: item.recordedAt, reason: item.reason ?? null };
    });
    const floor = Object.hasOwn(IMMUTABLE, path) ? null : floorFor(projectId, path);
    return copy({ projectId, path, runId, status: conflict ? "conflict" : effective ? "resolved" : "missing", effective, conflict, floor, field: settingsFieldFor(path), chain });
  }
  function changeLog({ projectId, path }) {
    const entries = history.get(`${assertId("projectId", projectId)}:${assertPath(path)}`) ?? [];
    const lastByScope = new Map();
    return Object.freeze(entries.map(entry => {
      const scope = `${entry.layer}:${entry.runId ?? "-"}`;
      const prior = lastByScope.get(scope);
      lastByScope.set(scope, entry);
      const removed = entry.source === REMOVAL_SOURCE;
      return copy({ path: entry.path, layer: entry.layer, runId: entry.runId ?? null, version: entry.version, actor: entry.actor, reason: entry.reason ?? null, impact: entry.impact ?? null, source: entry.source, rollbackReference: entry.rollbackReference ?? null, supersedesVersion: prior?.version ?? null, recordedAt: entry.recordedAt, diff: diffOf(removed ? entry.value : (prior && prior.source !== REMOVAL_SOURCE ? prior.value : undefined), entry.value, removed) });
    }));
  }
  function setValue({ actor, projectId, path, value, layer = "project-override", runId = null, expectedVersion = null, reason, impact = "not-assessed", rollbackReference = null, source = null, [TEMPLATE_WRITE]: templateWrite = false }) {
    const normalizedProjectId = assertId("projectId", projectId); const normalizedPath = assertPath(path); const normalizedActor = actorId(actor); layerRank(layer); assertSafe(value);
    if (layer === "hero-invariant") throw new ProjectSettingsError("INVARIANT_WRITE_FORBIDDEN", "Hero invariants cannot be edited through a project command.", 403);
    if (layer === "policy-template" && !templateWrite) throw new ProjectSettingsError("TEMPLATE_WRITE_FORBIDDEN", "The policy template layer only changes by applying a Policy Pack or by rollback.", 403);
    if (layer === "run-override" && !runId) throw new ProjectSettingsError("RUN_SCOPE_REQUIRED", "runId is required for a run override.", 400);
    if (layer !== "run-override" && runId !== null) throw new ProjectSettingsError("RUN_SCOPE_FORBIDDEN", "runId only applies to a run override.", 400);
    if (runId !== null) assertId("runId", runId);
    if (Object.hasOwn(IMMUTABLE, normalizedPath) && !equal(value, IMMUTABLE[normalizedPath])) throw new ProjectSettingsError("INVARIANT_WEAKENING_FORBIDDEN", `${normalizedPath} cannot be weakened.`, 409);
    const schemaReason = validateSettingValue(normalizedPath, value);
    if (schemaReason) throw new ProjectSettingsError("SETTING_SCHEMA_VIOLATION", `${normalizedPath}: ${schemaReason}.`, 400, { path: normalizedPath });
    const current = records.get(key(normalizedProjectId, normalizedPath, layer, runId));
    if (expectedVersion !== null && expectedVersion !== (current?.version ?? 0)) throw new ProjectSettingsError("STALE_SETTINGS_VERSION", "The setting changed before this command was applied.", 409);
    if (typeof reason !== "string" || reason.trim().length < 3) throw new ProjectSettingsError("REASON_REQUIRED", "A concise change reason is required.", 400);
    if (layer !== "policy-template") assertFloor(normalizedProjectId, normalizedPath, value);
    const priorValue = current && current.state !== "superseded" ? current.value : null;
    return append({ projectId: normalizedProjectId, path: normalizedPath, value: structuredClone(value), layer, runId, state: "active", actor: normalizedActor, reason: reason.trim().slice(0, 500), impact: String(impact).slice(0, 500), rollbackReference, source: source ?? layer, priorValue, supersedesVersion: current?.version ?? null, diff: diffOf(current && current.state !== "superseded" ? current.value : undefined, value) });
  }
  function suggestPolicyPack({ projectId, projectType = "application", riskLevel = "standard", actor = { subject: "hero-system" } }) {
    const normalizedProjectId = assertId("projectId", projectId); const template = templateFor({ projectType, riskLevel });
    const policyPack = copy({ policyPackId: `policy-pack-${++proposalCounter}`, projectId: normalizedProjectId, projectType, riskLevel, templateId: template.templateId, guardedPaths: template.guardedPaths, state: "suggested", values: template.values, createdAt: now(), createdBy: actor?.subject ?? "hero-system" });
    policyPacks.set(normalizedProjectId, policyPack); return policyPack;
  }
  function readiness({ projectId, runId = null }) {
    assertId("projectId", projectId);
    const missing = []; const conflicts = [];
    for (const path of REQUIRED_POLICY_PATHS) {
      const item = explain({ projectId, path, runId });
      if (item.status === "missing") missing.push(path);
      if (item.status === "conflict") conflicts.push({ path, code: item.conflict.code });
    }
    return copy({ projectId, runId, ready: missing.length === 0 && conflicts.length === 0, missing, conflicts, requiredPaths: REQUIRED_POLICY_PATHS });
  }
  return Object.freeze({
    suggestPolicyPack,
    policyPack(projectId) { assertId("projectId", projectId); return policyPacks.get(projectId) ?? null; },
    applyPolicyPack({ actor, projectId, expectedState = "suggested", reason = "Approved policy pack" }) {
      const pack = policyPacks.get(assertId("projectId", projectId));
      if (!pack || pack.state !== expectedState) throw new ProjectSettingsError("POLICY_PACK_STATE_INVALID", "The policy pack is not available for application.", 409);
      // Identity fields first so the guards of the new template apply to the rest.
      const ordered = Object.entries(pack.values).sort(([left], [right]) => Number(!left.startsWith("project.")) - Number(!right.startsWith("project.")));
      const applied = ordered.map(([path, value]) => setValue({ actor, projectId, path, value, layer: "policy-template", reason, impact: "Applied from suggested policy pack", source: `policy-pack:${pack.policyPackId}`, [TEMPLATE_WRITE]: true }));
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
      if (!OVERRIDE_LAYERS.includes(layer)) throw new ProjectSettingsError("OVERRIDE_LAYER_REQUIRED", "Only a project or Run override can be removed.", 400);
      const current = records.get(key(assertId("projectId", projectId), assertPath(path), layer, runId));
      if (!current || current.state === "superseded") throw new ProjectSettingsError("SETTING_NOT_FOUND", "No override exists to remove.", 404);
      const normalizedActor = actorId(actor);
      if (expectedVersion !== current.version) throw new ProjectSettingsError("STALE_SETTINGS_VERSION", "The setting changed before this command was applied.", 409);
      if (typeof reason !== "string" || reason.trim().length < 3) throw new ProjectSettingsError("REASON_REQUIRED", "A concise change reason is required.", 400);
      return append({ ...current, state: "superseded", actor: normalizedActor, reason: reason.trim().slice(0, 500), impact: "Override removed", source: REMOVAL_SOURCE, rollbackReference: null, priorValue: current.value, supersedesVersion: current.version, diff: diffOf(current.value, null, true) });
    },
    rollback({ actor, projectId, path, toVersion, reason }) {
      const entries = history.get(`${assertId("projectId", projectId)}:${assertPath(path)}`) ?? [];
      const target = entries.find(item => item.version === toVersion);
      if (!target) throw new ProjectSettingsError("ROLLBACK_VERSION_NOT_FOUND", "Requested settings version does not exist.", 404);
      if (target.source === REMOVAL_SOURCE) throw new ProjectSettingsError("ROLLBACK_TARGET_INVALID", "A removal record is not a value to roll back to.", 409);
      // Rollback re-applies every write gate: schema, invariants, floors and staleness.
      return setValue({ actor, projectId, path, value: target.value, layer: target.layer, runId: target.runId, expectedVersion: records.get(key(projectId, path, target.layer, target.runId))?.version ?? 0, reason, impact: `Rollback to version ${toVersion}`, rollbackReference: `settings:${projectId}:${path}:${toVersion}`, source: "rollback", [TEMPLATE_WRITE]: target.layer === "policy-template" });
    },
    effective({ projectId, path, runId = null }) { return resolve({ projectId, path, runId }); },
    effectiveProject({ projectId, runId = null }) {
      assertId("projectId", projectId);
      return Object.freeze(projectPaths(projectId).map(path => resolve({ projectId, path, runId })));
    },
    explain,
    explainProject({ projectId, runId = null }) {
      assertId("projectId", projectId);
      return Object.freeze(projectPaths(projectId).map(path => explain({ projectId, path, runId })));
    },
    changeLog,
    readiness,
    assertDispatchable({ projectId, runId = null }) {
      const result = readiness({ projectId, runId });
      if (!result.ready) throw new ProjectSettingsError("POLICY_INCOMPLETE", "Required policy is missing or in conflict; dispatch stays closed.", 409, { missing: result.missing, conflicts: result.conflicts });
      return result;
    },
    history({ projectId, path }) { return Object.freeze([...(history.get(`${assertId("projectId", projectId)}:${assertPath(path)}`) ?? [])]); },
    invariants: copy(IMMUTABLE)
  });

  function projectPaths(projectId) {
    return [...new Set([...Object.keys(IMMUTABLE), ...[...records.values()].filter(item => item.projectId === projectId).map(item => item.path)])].sort();
  }
}
