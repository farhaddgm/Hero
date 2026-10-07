import { createHash } from "node:crypto";
import { AUDIT_STALE_AFTER_DAYS, CLEANUP_CANDIDATE_LIMIT, CLEANUP_KINDS, CLEANUP_RETENTION_FIELD, EVIDENCE_DIGEST_PATTERN, HARDENING_AUDIT_KINDS, HARDENING_RECORD_KINDS, QUERY_BUDGET_MAXIMUM, RETENTION_MAXIMUM_DAYS, RETENTION_MINIMUMS, SUPPORTED_LOCALES } from "../../contracts/src/operational-hardening.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const copy = value => Object.freeze(structuredClone(value));
export class HardeningError extends Error { constructor(code, message, statusCode = 409) { super(message); this.name = "HardeningError"; this.code = code; this.statusCode = statusCode; } }
const id = (label, value) => { if (typeof value !== "string" || !ID.test(value)) throw new HardeningError("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; };
const write = actor => { if (!actor || !["project-owner", "admin"].includes(actor.role)) throw new HardeningError("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403); return actor; };
const owner = actor => { if (actor?.role !== "project-owner") throw new HardeningError("OWNER_REQUIRED", "Only the project owner may perform this action.", 403); return actor; };
const read = actor => { if (!actor || !["project-owner", "admin", "viewer"].includes(actor.role)) throw new HardeningError("PROJECT_READ_REQUIRED", "Project access is required.", 403); return actor; };
const reason = value => { const text = typeof value === "string" ? value.trim() : ""; if (text.length < 3) throw new HardeningError("REASON_REQUIRED", "A reason of at least 3 characters is required.", 400); return text.slice(0, 500); };
const manifestDigest = candidates => `sha256:${createHash("sha256").update(JSON.stringify([...candidates].sort((a, b) => a.id.localeCompare(b.id)).map(item => [item.id, item.digest]))).digest("hex")}`;

/**
 * Operational hardening (WP-13): per-project retention with minimums that
 * cannot be weakened, cleanup planning that is dry-run only, holds, refused
 * deletion attempts that are themselves audited, tool-evidenced hardening
 * audits, bounded pagination and the locale preference. State is an append-only
 * record stream (drainRecords/hydrate) like the other Back Office domains.
 */
export function createOperationalHardening({ now = () => new Date().toISOString() } = {}) {
  const policies = new Map(); const jobs = new Map(); const holds = new Map(); const audits = new Map(); const attempts = new Map(); const locales = new Map();
  const outbox = []; const seen = new Map(); const nowMs = () => Date.parse(now());
  function emit(kind, key, version, projectId, payload, actorId) { outbox.push(copy({ kind, key, version, projectId, actorId, recordedAt: now(), payload })); }
  // Sorted by key so a replay in any order shows the same list.
  const rows = (map, projectId) => [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value).filter(item => item.projectId === projectId);
  const effective = projectId => ({ ...RETENTION_MINIMUMS, ...(policies.get(projectId) ? { auditDays: policies.get(projectId).auditDays, evidenceDays: policies.get(projectId).evidenceDays, securityDays: policies.get(projectId).securityDays } : {}) });

  const api = {
    /** BO-147 */
    setRetention({ actor, projectId, retention = {} }) {
      write(actor); id("projectId", projectId);
      const value = { ...effective(projectId), ...retention };
      for (const [field, minimum] of Object.entries(RETENTION_MINIMUMS)) {
        if (!Number.isInteger(value[field])) throw new HardeningError("RETENTION_INVALID", `${field} must be a whole number of days.`, 400);
        if (value[field] < minimum) throw new HardeningError("RETENTION_WEAKENING_FORBIDDEN", `${field} cannot be below Hero minimum.`, 400);
        if (value[field] > RETENTION_MAXIMUM_DAYS) throw new HardeningError("RETENTION_TOO_LONG", `${field} may not exceed ${RETENTION_MAXIMUM_DAYS} days.`, 400);
      }
      const item = copy({ projectId, auditDays: value.auditDays, evidenceDays: value.evidenceDays, securityDays: value.securityDays, version: (policies.get(projectId)?.version ?? 0) + 1, updatedAt: now(), updatedBy: actor.subject });
      policies.set(projectId, item); emit("policy", projectId, item.version, projectId, { policy: item }, actor.subject); return item;
    },
    retention({ actor, projectId }) { read(actor); id("projectId", projectId); const base = effective(projectId); return copy({ projectId, ...base, minimums: RETENTION_MINIMUMS, version: policies.get(projectId)?.version ?? 0, custom: policies.has(projectId) }); },
    /** BO-148: hold or release a record from cleanup. Releasing is an owner decision. */
    placeHold({ actor, projectId, targetId, reason: why }) {
      write(actor); id("projectId", projectId); id("targetId", targetId); const note = reason(why); const key = `${projectId}:${targetId}`;
      const prior = holds.get(key); if (prior?.active) return prior;
      const item = copy({ projectId, targetId, active: true, reason: note, version: (prior?.version ?? 0) + 1, changedAt: now(), changedBy: actor.subject });
      holds.set(key, item); emit("hold", key, item.version, projectId, { hold: item }, actor.subject); return item;
    },
    releaseHold({ actor, projectId, targetId, reason: why }) {
      owner(actor); id("projectId", projectId); id("targetId", targetId); const note = reason(why); const key = `${projectId}:${targetId}`; const prior = holds.get(key);
      if (!prior?.active) throw new HardeningError("HOLD_NOT_ACTIVE", "No active hold exists for this record.", 404);
      const item = copy({ ...prior, active: false, releaseReason: note, version: prior.version + 1, changedAt: now(), changedBy: actor.subject });
      holds.set(key, item); emit("hold", key, item.version, projectId, { hold: item }, actor.subject); return item;
    },
    /** BO-148: dry-run plan. A record younger than its retention, or on hold, is never eligible; every digest is preserved in the manifest. */
    planCleanup({ actor, projectId, jobId, candidates }) {
      write(actor); id("projectId", projectId); id("jobId", jobId);
      if (jobs.has(`${projectId}:${jobId}`)) throw new HardeningError("CLEANUP_JOB_EXISTS", "A cleanup plan cannot be rewritten.", 409);
      if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > CLEANUP_CANDIDATE_LIMIT) throw new HardeningError("CLEANUP_INVALID", `Between 1 and ${CLEANUP_CANDIDATE_LIMIT} candidates are required.`, 400);
      const policy = effective(projectId); const eligible = []; const held = []; const tooYoung = [];
      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object" || !EVIDENCE_DIGEST_PATTERN.test(String(candidate.digest ?? ""))) throw new HardeningError("CLEANUP_INVALID", "Every candidate needs a sha256 digest so the record stays provable after deletion.", 400);
        id("candidate id", candidate.id); if (!CLEANUP_KINDS.includes(candidate.kind)) throw new HardeningError("CLEANUP_INVALID", `Candidate kind must be one of ${CLEANUP_KINDS.join(", ")}.`, 400);
        const recorded = Date.parse(candidate.recordedAt); if (Number.isNaN(recorded)) throw new HardeningError("CLEANUP_INVALID", "Candidate recordedAt is invalid.", 400);
        const entry = { id: candidate.id, kind: candidate.kind, digest: candidate.digest, recordedAt: new Date(recorded).toISOString() };
        if (holds.get(`${projectId}:${candidate.id}`)?.active) held.push(entry);
        else if (nowMs() - recorded < policy[CLEANUP_RETENTION_FIELD[candidate.kind]] * 86_400_000) tooYoung.push(entry);
        else eligible.push(entry);
      }
      const item = copy({ projectId, jobId, dryRun: true, deletion: "not-authorized", eligible, held, refusedTooYoung: tooYoung, preservedManifestDigest: manifestDigest(candidates.map(entry => ({ id: entry.id, digest: entry.digest }))), retentionApplied: policy, createdAt: now(), createdBy: actor.subject });
      jobs.set(`${projectId}:${jobId}`, item); emit("cleanup", `${projectId}:${jobId}`, 1, projectId, { job: item }, actor.subject); return item;
    },
    /** BO-148: nothing is ever deleted here. The attempt is the deletion audit. */
    executeCleanup({ actor, projectId, jobId, reason: why }) {
      owner(actor); id("projectId", projectId); id("jobId", jobId); const note = reason(why);
      const job = jobs.get(`${projectId}:${jobId}`); if (!job) throw new HardeningError("CLEANUP_JOB_NOT_FOUND", "Cleanup plan was not found in this project.", 404);
      const attempt = copy({ attemptId: `attempt-${attempts.size + 1}-${createHash("sha256").update(`${projectId}${jobId}${now()}${attempts.size}`).digest("hex").slice(0, 10)}`, projectId, jobId, outcome: "refused", why: "deletion requires a separate owner authorization that is not granted", eligibleCount: job.eligible.length, reason: note, at: now(), by: actor.subject });
      attempts.set(attempt.attemptId, attempt); emit("deletion-attempt", attempt.attemptId, 1, projectId, { attempt }, actor.subject);
      throw new HardeningError("CLEANUP_NOT_AUTHORIZED", "Deletion is not authorized. The attempt was recorded.", 409);
    },
    cleanupReport({ actor, projectId }) { read(actor); id("projectId", projectId); return copy({ projectId, jobs: rows(jobs, projectId), holds: rows(holds, projectId).filter(item => item.active), deletionAttempts: rows(attempts, projectId) }); },
    /** BO-149 */
    locale({ actor, projectId, locale }) {
      write(actor); id("projectId", projectId);
      if (!SUPPORTED_LOCALES.includes(locale)) throw new HardeningError("LOCALE_INVALID", "Only fa and en are supported.", 400);
      const prior = locales.get(projectId); const item = copy({ projectId, locale, direction: locale === "fa" ? "rtl" : "ltr", identifierPolicy: "stable-ascii-identifiers", version: (prior?.version ?? 0) + 1, updatedAt: now(), updatedBy: actor.subject });
      locales.set(projectId, item); emit("locale", projectId, item.version, projectId, { locale: item }, actor.subject); return item;
    },
    localeOf({ actor, projectId }) { read(actor); return locales.get(projectId)?.locale ?? "fa"; },
    /** BO-150/152/153/154/155/156: a hardening audit exists only with the tool that produced it, a digest of its raw output and counted checks. `passed` is derived. */
    recordAudit({ actor, projectId, auditId, kind, tool, toolVersion, evidenceDigest, checks, findings = [] }) {
      write(actor); id("projectId", projectId); id("auditId", auditId);
      if (!HARDENING_AUDIT_KINDS.includes(kind)) throw new HardeningError("AUDIT_KIND_INVALID", "Audit kind is invalid.", 400);
      if (typeof tool !== "string" || !/^[a-z][a-z0-9./_-]{2,120}$/.test(tool) || typeof toolVersion !== "string" || toolVersion.length < 1 || toolVersion.length > 40) throw new HardeningError("AUDIT_TOOL_REQUIRED", "The producing tool and its version are required.", 400);
      if (!EVIDENCE_DIGEST_PATTERN.test(String(evidenceDigest ?? ""))) throw new HardeningError("AUDIT_EVIDENCE_REQUIRED", "A sha256 digest of the raw tool output is required.", 400);
      if (!checks || !Number.isInteger(checks.total) || !Number.isInteger(checks.passed) || checks.total < 1 || checks.passed < 0 || checks.passed > checks.total) throw new HardeningError("AUDIT_CHECKS_INVALID", "Counted checks (total >= 1, 0 <= passed <= total) are required.", 400);
      if (!Array.isArray(findings)) throw new HardeningError("AUDIT_FINDINGS_INVALID", "Findings must be a list.", 400);
      if (audits.has(`${projectId}:${auditId}`)) throw new HardeningError("AUDIT_IMMUTABLE", "An audit cannot be rewritten.", 409);
      const sequence = Math.max(0, ...rows(audits, projectId).map(entry => entry.sequence ?? 0)) + 1;
      const item = copy({ projectId, auditId, sequence, kind, tool, toolVersion, evidenceDigest, checks: { total: checks.total, passed: checks.passed }, findings: findings.slice(0, 50).map(entry => String(entry).slice(0, 500)), passed: checks.passed === checks.total && findings.length === 0, recordedAt: now(), recordedBy: actor.subject });
      audits.set(`${projectId}:${auditId}`, item); emit("audit", `${projectId}:${auditId}`, 1, projectId, { audit: item }, actor.subject); return item;
    },
    /** BO-151 */
    page({ actor, projectId, records = [], cursor = 0, limit = 25, queryBudget = QUERY_BUDGET_MAXIMUM }) {
      read(actor); id("projectId", projectId);
      if (!Number.isInteger(cursor) || cursor < 0 || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(queryBudget) || queryBudget < 1 || limit > QUERY_BUDGET_MAXIMUM || limit > queryBudget) throw new HardeningError("QUERY_BUDGET_EXCEEDED", "Query exceeds bounded pagination budget.", 400);
      const slice = records.slice(cursor, cursor + limit);
      return copy({ projectId, rows: slice, nextCursor: cursor + slice.length < records.length ? cursor + slice.length : null, lazyTrace: true, queryBudget });
    },
    /** Coverage counts only a passing, non-stale audit of each kind. */
    report({ actor, projectId }) {
      read(actor); id("projectId", projectId); const list = rows(audits, projectId); const moment = nowMs();
      const latest = kind => list.filter(item => item.kind === kind).sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0))[0] ?? null;
      const state = kind => { const item = latest(kind); if (!item) return "missing"; if (!item.passed) return "failing"; return moment - Date.parse(item.recordedAt) > AUDIT_STALE_AFTER_DAYS * 86_400_000 ? "stale" : "passing"; };
      const coverage = Object.fromEntries(HARDENING_AUDIT_KINDS.map(kind => [kind, state(kind)]));
      return copy({ projectId, retention: api.retention({ actor, projectId }), cleanup: rows(jobs, projectId), audits: list, coverage: { required: HARDENING_AUDIT_KINDS, states: coverage, missing: HARDENING_AUDIT_KINDS.filter(kind => coverage[kind] === "missing"), failing: HARDENING_AUDIT_KINDS.filter(kind => coverage[kind] === "failing"), stale: HARDENING_AUDIT_KINDS.filter(kind => coverage[kind] === "stale"), complete: HARDENING_AUDIT_KINDS.every(kind => coverage[kind] === "passing") } });
    },
    drainRecords() { return Object.freeze(outbox.splice(0, outbox.length)); },
    purgeProject({ projectId }) { for (const map of [policies, jobs, holds, audits, attempts, locales]) for (const [key, value] of [...map]) if (value.projectId === projectId) map.delete(key); },
    hydrate(record) {
      if (!record || !HARDENING_RECORD_KINDS.includes(record.kind)) throw new HardeningError("INVALID_HYDRATION", "Hardening record is invalid.", 500);
      const mark = `${record.kind}:${record.key}`; const last = seen.get(mark) ?? 0; if (record.version < last) return; seen.set(mark, record.version);
      const data = record.payload ?? {};
      if (record.kind === "policy") policies.set(record.key, copy(data.policy));
      if (record.kind === "cleanup") jobs.set(record.key, copy(data.job));
      if (record.kind === "hold") holds.set(record.key, copy(data.hold));
      if (record.kind === "audit") audits.set(record.key, copy(data.audit));
      if (record.kind === "deletion-attempt") attempts.set(record.key, copy(data.attempt));
      if (record.kind === "locale") locales.set(record.key, copy(data.locale));
    }
  };
  return Object.freeze(api);
}
