import {
  COMPLETION_CAPABILITIES,
  COMPLETION_EVIDENCE_KINDS,
  COMPLETION_LOCALES,
  COMPLETION_ROLES,
  COMPLETION_SETTING_LAYERS
} from "../../contracts/src/backoffice-completion.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const clone = value => Object.freeze(structuredClone(value));
const assertId = (label, value) => {
  if (typeof value !== "string" || !ID.test(value)) throw new BackofficeCompletionError("INVALID_IDENTIFIER", `${label} is invalid.`, 400);
  return value;
};
const actorId = actor => assertId("actor", actor?.subject ?? actor?.userId);
const assertActor = (actor, capability = "read") => {
  const role = actor?.role;
  if (!COMPLETION_ROLES.includes(role) || !COMPLETION_CAPABILITIES[role].includes(capability)) {
    throw new BackofficeCompletionError("CAPABILITY_REQUIRED", `The actor does not have ${capability} capability.`, 403);
  }
  return role;
};

export class BackofficeCompletionError extends Error {
  constructor(code, message, statusCode = 409) { super(message); this.name = "BackofficeCompletionError"; this.code = code; this.statusCode = statusCode; }
}

/**
 * Deterministic, project-scoped read model for the parts of the Back Office
 * that can be completed without external credentials. It is deliberately
 * append-only: edits create a new version and never erase evidence.
 */
export function createBackofficeCompletion({ now = () => new Date().toISOString() } = {}) {
  const settings = new Map();
  const evidence = new Map();
  const traces = new Map();
  const retention = new Map();
  const locale = new Map();

  function projectKey(projectId, key) { return `${assertId("projectId", projectId)}:${key}`; }
  function settingKey(projectId, path, layer) { return projectKey(projectId, `${path}:${layer}`); }
  function settingPath(path) {
    if (typeof path !== "string" || !/^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*){1,7}$/.test(path)) throw new BackofficeCompletionError("INVALID_SETTING_PATH", "A dotted setting path is required.", 400);
    return path;
  }
  function assertLayer(layer) {
    if (!COMPLETION_SETTING_LAYERS.includes(layer)) throw new BackofficeCompletionError("INVALID_SETTING_LAYER", "Setting layer is invalid.", 400);
    return layer;
  }

  return Object.freeze({
    capabilities({ actor, projectId }) {
      assertId("projectId", projectId); const role = assertActor(actor);
      return clone({ projectId, role, capabilities: COMPLETION_CAPABILITIES[role], readOnly: role === "viewer" });
    },
    shell({ actor, projectId, sections = [] }) {
      assertId("projectId", projectId); const role = assertActor(actor);
      const requested = Array.isArray(sections) && sections.length ? sections.map(String).slice(0, 64) : ["overview", "roadmap", "teams", "settings", "conversations", "operations", "catalog", "performance", "notifications", "infrastructure", "readiness"];
      return clone({ projectId, role, sections: requested, capabilities: COMPLETION_CAPABILITIES[role], navigationVersion: "1.0" });
    },
    paginate({ actor, projectId, records = [], cursor = 0, limit = 25, queryBudget = 100, query = "" }) {
      assertId("projectId", projectId); assertActor(actor); if (!Number.isInteger(cursor) || cursor < 0 || !Number.isInteger(limit) || limit < 1 || limit > Math.min(100, queryBudget)) throw new BackofficeCompletionError("QUERY_BUDGET_EXCEEDED", "The query exceeds the bounded pagination budget.", 400);
      const needle = String(query).trim().toLowerCase(); const filtered = records.filter(row => !needle || JSON.stringify(row).toLowerCase().includes(needle));
      const rows = filtered.slice(cursor, cursor + limit);
      return clone({ projectId, rows, cursor, nextCursor: cursor + rows.length < filtered.length ? cursor + rows.length : null, total: filtered.length, queryBudget });
    },
    setSetting({ actor, projectId, path, layer = "project", value, reason, expectedVersion = null }) {
      assertId("projectId", projectId); assertActor(actor, "write"); const normalizedPath = settingPath(path); const normalizedLayer = assertLayer(layer);
      if (typeof reason !== "string" || reason.trim().length < 3) throw new BackofficeCompletionError("REASON_REQUIRED", "A change reason is required.", 400);
      const key = settingKey(projectId, normalizedPath, normalizedLayer); const history = settings.get(key) ?? [];
      const current = history.at(-1); if (expectedVersion !== null && expectedVersion !== (current?.version ?? 0)) throw new BackofficeCompletionError("STALE_SETTING_VERSION", "The setting changed before this command.", 409);
      const item = { projectId, path: normalizedPath, layer: normalizedLayer, value: structuredClone(value), version: history.length + 1, priorValue: current?.value ?? null, reason: reason.trim().slice(0, 500), actor: actorId(actor), recordedAt: now(), state: "active" };
      settings.set(key, [...history, item]); return clone(item);
    },
    resolveSetting({ actor, projectId, path }) {
      assertId("projectId", projectId); assertActor(actor); const normalizedPath = settingPath(path); const candidates = COMPLETION_SETTING_LAYERS.map(layer => settings.get(settingKey(projectId, normalizedPath, layer))?.at(-1)).filter(Boolean);
      const winner = candidates.at(-1); if (!winner) throw new BackofficeCompletionError("SETTING_NOT_FOUND", "No setting exists for this path.", 404);
      return clone({ ...winner, provenance: `${winner.layer}:v${winner.version}` });
    },
    settingHistory({ actor, projectId, path, layer }) {
      assertId("projectId", projectId); assertActor(actor); const normalizedPath = settingPath(path); const layers = layer ? [assertLayer(layer)] : COMPLETION_SETTING_LAYERS;
      return clone(layers.flatMap(item => settings.get(settingKey(projectId, normalizedPath, item)) ?? []));
    },
    recordTrace({ actor, projectId, traceId, correlationId, parentId = null, kind, ref }) {
      assertId("projectId", projectId); assertActor(actor, "write"); assertId("traceId", traceId); assertId("correlationId", correlationId); if (parentId !== null) assertId("parentId", parentId); if (typeof kind !== "string" || typeof ref !== "string") throw new BackofficeCompletionError("TRACE_FIELDS_REQUIRED", "Trace kind and ref are required.", 400);
      const item = { projectId, traceId, correlationId, parentId, kind: kind.slice(0, 80), ref: ref.slice(0, 300), actor: actorId(actor), recordedAt: now() }; traces.set(`${projectId}:${traceId}`, item); return clone(item);
    },
    correlationChain({ actor, projectId, correlationId }) {
      assertId("projectId", projectId); assertActor(actor); assertId("correlationId", correlationId);
      const rows = [...traces.values()].filter(item => item.projectId === projectId && item.correlationId === correlationId); const ids = new Set(rows.map(item => item.traceId));
      const missingParents = rows.filter(item => item.parentId && !ids.has(item.parentId)).map(item => item.parentId);
      return clone({ projectId, correlationId, traces: rows, complete: rows.length > 0 && missingParents.length === 0, missingParents });
    },
    recordEvidence({ actor, projectId, evidenceId, kind, passed, refs = [], findings = [] }) {
      assertId("projectId", projectId); assertActor(actor, "write"); assertId("evidenceId", evidenceId); if (!COMPLETION_EVIDENCE_KINDS.includes(kind)) throw new BackofficeCompletionError("EVIDENCE_KIND_INVALID", "Evidence kind is invalid.", 400);
      const item = { projectId, evidenceId, kind, passed: Boolean(passed), refs: refs.map(String).slice(0, 32), findings: findings.map(String).slice(0, 32), recordedAt: now(), recordedBy: actorId(actor) }; evidence.set(`${projectId}:${evidenceId}`, item); return clone(item);
    },
    evidenceCoverage({ actor, projectId }) {
      assertId("projectId", projectId); assertActor(actor); const rows = [...evidence.values()].filter(item => item.projectId === projectId); const required = [...COMPLETION_EVIDENCE_KINDS];
      return clone({ projectId, required, passed: required.filter(kind => rows.some(item => item.kind === kind && item.passed)), missing: required.filter(kind => !rows.some(item => item.kind === kind && item.passed)), evidence: rows });
    },
    setRetention({ actor, projectId, auditDays, evidenceDays, securityDays, hold = false }) {
      assertId("projectId", projectId); assertActor(actor, "write"); const values = { auditDays, evidenceDays, securityDays }; if (Object.values(values).some(value => !Number.isInteger(value) || value < 365) || securityDays < 730) throw new BackofficeCompletionError("RETENTION_MINIMUM_VIOLATION", "Retention is below Hero minimums.", 400);
      const item = { projectId, ...values, hold: Boolean(hold), version: (retention.get(projectId)?.version ?? 0) + 1, updatedAt: now(), updatedBy: actorId(actor) }; retention.set(projectId, item); return clone(item);
    },
    cleanupPreview({ actor, projectId, candidates = [], hold = true }) {
      assertId("projectId", projectId); assertActor(actor, "write"); if (!Array.isArray(candidates) || candidates.some(item => !item || typeof item.id !== "string" || typeof item.digest !== "string")) throw new BackofficeCompletionError("CLEANUP_CANDIDATES_INVALID", "Cleanup candidates require an id and digest.", 400);
      return clone({ projectId, candidates: candidates.map(item => ({ id: item.id, digest: item.digest })), dryRun: true, hold: Boolean(hold), deletion: "separate-authorization-required", previewedAt: now(), previewedBy: actorId(actor) });
    },
    setLocale({ actor, projectId, locale: value }) {
      assertId("projectId", projectId); assertActor(actor, "write"); if (!COMPLETION_LOCALES.includes(value)) throw new BackofficeCompletionError("LOCALE_INVALID", "Only fa and en are supported.", 400);
      const item = { projectId, locale: value, direction: value === "fa" ? "rtl" : "ltr", updatedAt: now(), updatedBy: actorId(actor) }; locale.set(projectId, item); return clone(item);
    },
    readiness({ actor, projectId }) {
      assertId("projectId", projectId); assertActor(actor); const coverage = this.evidenceCoverage({ actor, projectId }); const chainCount = [...traces.values()].filter(item => item.projectId === projectId).length;
      return clone({ projectId, state: coverage.missing.length === 0 && chainCount > 0 ? "ready-for-owner-review" : "evidence-incomplete", coverage, traceCount: chainCount, locale: locale.get(projectId) ?? { locale: "fa", direction: "rtl" }, externalOperations: "separately-gated" });
    }
  });
}
