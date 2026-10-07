import { createHash } from "node:crypto";
import { COMPATIBILITY_MAX_DAYS, READINESS_EVIDENCE_DIGEST, READINESS_RECORD_KINDS, READINESS_REQUIRED_SCENARIOS, READINESS_SCENARIO_KINDS } from "../../contracts/src/final-readiness.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const copy = value => Object.freeze(structuredClone(value));
export class FinalReadinessError extends Error { constructor(code, message, statusCode = 409) { super(message); this.name = "FinalReadinessError"; this.code = code; this.statusCode = statusCode; } }
const id = (label, value) => { if (typeof value !== "string" || !ID.test(value)) throw new FinalReadinessError("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; };
const write = actor => { if (!actor || !["project-owner", "admin"].includes(actor.role)) throw new FinalReadinessError("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403); return actor; };
const owner = actor => { if (!actor || actor.role !== "project-owner") throw new FinalReadinessError("OWNER_REQUIRED", "Only the owner may perform this action.", 403); return actor; };
const read = actor => { if (!actor || !["project-owner", "admin", "viewer"].includes(actor.role)) throw new FinalReadinessError("PROJECT_READ_REQUIRED", "Project access is required.", 403); return actor; };
const digestOf = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const internalRef = value => typeof value === "string" && /^hero:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]{3,300}$/.test(value);

/**
 * Final readiness (WP-14): compatibility migration plans with a bounded window,
 * deterministic read-model digest comparison, scenario evidence that is derived
 * from counted checks and a tool digest, traceability, a plan-only Notion
 * projection, the readiness review, the owner acceptance and the proposal-only
 * pilot gate. State is an append-only record stream.
 */
export function createFinalReadiness({ now = () => new Date().toISOString() } = {}) {
  const migrations = new Map(); const readModels = new Map(); const scenarios = new Map(); const traceability = new Map(); const reviews = new Map(); const acceptances = new Map(); const pilotProposals = new Map(); const notionPlans = new Map();
  const outbox = []; const seen = new Map(); const nowMs = () => Date.parse(now());
  const emit = (kind, key, projectId, payload, actorId, version = 1) => outbox.push(copy({ kind, key, version, projectId, actorId, recordedAt: now(), payload }));
  // Sorted by key so a replay in any order shows the same list.
  const rows = (map, projectId) => [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value).filter(item => item.projectId === projectId);

  const api = {
    /** BO-157: the old route keeps working until the window ends; the window is bounded and nothing is deleted before the new route is verified. */
    planMigration({ actor, projectId, migrationId, oldRoute, newRoute, compatibilityUntil }) {
      write(actor); id("projectId", projectId); id("migrationId", migrationId);
      if (typeof oldRoute !== "string" || typeof newRoute !== "string" || !oldRoute.startsWith("/") || !newRoute.startsWith("/") || oldRoute === newRoute) throw new FinalReadinessError("MIGRATION_INVALID", "Two different absolute routes are required.", 400);
      const until = Date.parse(compatibilityUntil);
      if (Number.isNaN(until) || until <= nowMs()) throw new FinalReadinessError("MIGRATION_INVALID", "A future compatibility window is required.", 400);
      if (until - nowMs() > COMPATIBILITY_MAX_DAYS * 86_400_000) throw new FinalReadinessError("MIGRATION_WINDOW_TOO_LONG", `The compatibility window may not exceed ${COMPATIBILITY_MAX_DAYS} days.`, 400);
      if (migrations.has(`${projectId}:${migrationId}`)) throw new FinalReadinessError("MIGRATION_EXISTS", "A migration plan cannot be rewritten.", 409);
      const item = copy({ projectId, migrationId, oldRoute, newRoute, compatibilityUntil: new Date(until).toISOString(), deletion: "forbidden-until-verified", createdAt: now(), createdBy: actor.subject });
      migrations.set(`${projectId}:${migrationId}`, item); emit("migration", `${projectId}:${migrationId}`, projectId, { migration: item }, actor.subject); return item;
    },
    /** BO-157: whether the old route is still inside its window. */
    compatibility({ actor, projectId, migrationId }) {
      read(actor); const item = migrations.get(`${projectId}:${id("migrationId", migrationId)}`); if (!item) throw new FinalReadinessError("MIGRATION_NOT_FOUND", "Migration was not found in this project.", 404);
      return copy({ migrationId, oldRoute: item.oldRoute, newRoute: item.newRoute, oldRouteStatus: nowMs() <= Date.parse(item.compatibilityUntil) ? "compatible" : "window-ended", compatibilityUntil: item.compatibilityUntil });
    },
    /** BO-159: compare digests of a read model before and after a rebuild. Either states or ready digests are accepted; equality is derived. */
    rebuildReadModel({ actor, projectId, modelId, beforeState, afterState, beforeDigest = null, afterDigest = null }) {
      write(actor); id("projectId", projectId); id("modelId", modelId);
      const before = beforeDigest ?? (beforeState === undefined ? null : `sha256:${digestOf(beforeState)}`); const after = afterDigest ?? (afterState === undefined ? null : `sha256:${digestOf(afterState)}`);
      if (!READINESS_EVIDENCE_DIGEST.test(String(before)) || !READINESS_EVIDENCE_DIGEST.test(String(after))) throw new FinalReadinessError("DIGEST_REQUIRED", "A sha256 digest (or the state) of both sides is required.", 400);
      const version = (readModels.get(`${projectId}:${modelId}`)?.version ?? 0) + 1;
      const item = copy({ projectId, modelId, beforeDigest: before, afterDigest: after, equal: before === after, rebuild: "deterministic", version, recordedAt: now(), recordedBy: actor.subject });
      readModels.set(`${projectId}:${modelId}`, item); emit("digest", `${projectId}:${modelId}`, projectId, { digest: item }, actor.subject, version); return item;
    },
    /** BO-160..BO-165: a scenario is recorded with the tool that ran it and counted checks; a failing run is recorded as failing, never hidden. */
    recordScenario({ actor, projectId, scenarioId, kind, tool, toolVersion, evidenceDigest, checks, projects = [], details = {} }) {
      write(actor); id("projectId", projectId); id("scenarioId", scenarioId);
      if (!READINESS_SCENARIO_KINDS.includes(kind)) throw new FinalReadinessError("SCENARIO_KIND_INVALID", "Scenario kind is invalid.", 400);
      if (typeof tool !== "string" || !/^[a-z][a-z0-9./_-]{2,120}$/.test(tool) || typeof toolVersion !== "string" || !toolVersion || toolVersion.length > 40) throw new FinalReadinessError("SCENARIO_TOOL_REQUIRED", "The producing tool and its version are required.", 400);
      if (!READINESS_EVIDENCE_DIGEST.test(String(evidenceDigest ?? ""))) throw new FinalReadinessError("SCENARIO_EVIDENCE_REQUIRED", "A sha256 digest of the raw tool output is required.", 400);
      if (!checks || !Number.isInteger(checks.total) || !Number.isInteger(checks.passed) || checks.total < 1 || checks.passed < 0 || checks.passed > checks.total) throw new FinalReadinessError("SCENARIO_CHECKS_INVALID", "Counted checks are required.", 400);
      if (!Array.isArray(projects) || projects.some(entry => typeof entry !== "string" || !ID.test(entry))) throw new FinalReadinessError("SCENARIO_PROJECTS_INVALID", "Projects must be a list of project ids.", 400);
      if (projects.length && !projects.includes(projectId)) throw new FinalReadinessError("SCENARIO_PROJECT_MISMATCH", "A scenario must include the project it is recorded under.", 400);
      if (kind === "e2e-multi-project" && new Set(projects).size < 2) throw new FinalReadinessError("SCENARIO_NEEDS_TWO_PROJECTS", "An end-to-end multi-project scenario needs at least two projects.", 400);
      if (scenarios.has(`${projectId}:${scenarioId}`)) throw new FinalReadinessError("SCENARIO_IMMUTABLE", "A scenario record cannot be rewritten.", 409);
      const item = copy({ projectId, scenarioId, kind, tool, toolVersion, evidenceDigest, checks: { total: checks.total, passed: checks.passed }, projects: [...new Set(projects)].sort(), passed: checks.passed === checks.total, details: structuredClone(details), mode: "local-evidence-no-external-target", recordedAt: now(), recordedBy: actor.subject });
      scenarios.set(`${projectId}:${scenarioId}`, item); emit("scenario", `${projectId}:${scenarioId}`, projectId, { scenario: item }, actor.subject); return item;
    },
    /** BO-164 */
    setTraceability({ actor, projectId, requirementId, testRef, evidenceRef }) {
      write(actor); id("projectId", projectId); id("requirementId", requirementId);
      if (!internalRef(testRef) || !internalRef(evidenceRef)) throw new FinalReadinessError("TRACEABILITY_INVALID", "Internal hero:// test and evidence references are required.", 400);
      const key = `${projectId}:${requirementId}`; const version = (traceability.get(key)?.version ?? 0) + 1;
      const item = copy({ projectId, requirementId, testRef, evidenceRef, version, updatedAt: now(), updatedBy: actor.subject });
      traceability.set(key, item); emit("traceability", key, projectId, { traceability: item }, actor.subject, version); return item;
    },
    /** BO-166: a plan only. The plan lists what would be projected, with a checksum per document, and states that zero writes happen. */
    prepareNotionProjection({ actor, projectId, documentRefs, documents = [] }) {
      write(actor); id("projectId", projectId);
      if (!Array.isArray(documentRefs) || documentRefs.length === 0 || documentRefs.some(ref => !internalRef(ref))) throw new FinalReadinessError("NOTION_PLAN_INVALID", "Only internal canonical references may be planned.", 400);
      if (!Array.isArray(documents) || documents.some(entry => !entry || typeof entry.ref !== "string" || !READINESS_EVIDENCE_DIGEST.test(String(entry.checksum ?? "")))) throw new FinalReadinessError("NOTION_PLAN_INVALID", "Each document needs a ref and a sha256 checksum.", 400);
      const unlisted = documents.filter(entry => !documentRefs.includes(entry.ref)); if (unlisted.length) throw new FinalReadinessError("NOTION_PLAN_INVALID", "A checksum was supplied for a document that is not in the plan.", 400);
      const version = (notionPlans.get(projectId)?.version ?? 0) + 1;
      const item = copy({ projectId, documentRefs: [...new Set(documentRefs)].sort(), documents: documents.map(entry => ({ ref: entry.ref, checksum: entry.checksum })).sort((a, b) => a.ref.localeCompare(b.ref)), mode: "plan-only-notion-write-forbidden", writes: 0, version, preparedAt: now(), preparedBy: actor.subject });
      notionPlans.set(projectId, item); emit("notion-plan", projectId, projectId, { plan: item }, actor.subject, version); return item;
    },
    /** BO-168: ready only when every required scenario passed, no gap is open and the migration digests are equal. */
    readinessReview({ actor, projectId, reviewId, gaps = [], risks = [], limitations = [], rollbackRef }) {
      write(actor); id("projectId", projectId); id("reviewId", reviewId);
      if (!internalRef(rollbackRef)) throw new FinalReadinessError("READINESS_INVALID", "An internal rollback reference is required.", 400);
      if (reviews.has(`${projectId}:${reviewId}`)) throw new FinalReadinessError("REVIEW_IMMUTABLE", "A review cannot be rewritten.", 409);
      const passedKinds = new Set(rows(scenarios, projectId).filter(item => item.passed).map(item => item.kind));
      const digestMismatch = rows(readModels, projectId).filter(item => !item.equal).map(item => item.modelId);
      const open = [...gaps.map(String), ...digestMismatch.map(model => `read-model digest differs: ${model}`)];
      const state = READINESS_REQUIRED_SCENARIOS.every(kind => passedKinds.has(kind)) && open.length === 0 ? "ready-for-owner-acceptance" : "draft";
      const item = copy({ projectId, reviewId, state, gaps: open, risks: risks.map(String), limitations: limitations.map(String), rollbackRef, scenarioCoverage: READINESS_REQUIRED_SCENARIOS.map(kind => ({ kind, passed: passedKinds.has(kind) })), createdAt: now(), createdBy: actor.subject });
      reviews.set(`${projectId}:${reviewId}`, item); emit("review", `${projectId}:${reviewId}`, projectId, { review: item }, actor.subject); return item;
    },
    /** BO-169: only the owner, only on a review that is ready, only with an explicit artifact identity. */
    accept({ actor, projectId, reviewId, artifactIdentity, decision = "accepted", reason = "" }) {
      owner(actor); id("projectId", projectId); id("reviewId", reviewId);
      const review = reviews.get(`${projectId}:${reviewId}`); if (!review) throw new FinalReadinessError("REVIEW_NOT_FOUND", "Review was not found in this project.", 404);
      if (!["accepted", "rework-requested"].includes(decision) || typeof artifactIdentity !== "string" || artifactIdentity.length < 8) throw new FinalReadinessError("ACCEPTANCE_INVALID", "Explicit artifact identity and decision are required.", 400);
      if (decision === "accepted" && review.state !== "ready-for-owner-acceptance") throw new FinalReadinessError("READINESS_NOT_COMPLETE", "Review is not ready for acceptance.", 409);
      if (acceptances.has(`${projectId}:${reviewId}`)) throw new FinalReadinessError("ACCEPTANCE_IMMUTABLE", "An acceptance record cannot be rewritten.", 409);
      const item = copy({ projectId, reviewId, artifactIdentity, decision, reason: String(reason).slice(0, 500), state: decision, acceptedAt: now(), acceptedBy: actor.subject });
      acceptances.set(`${projectId}:${reviewId}`, item); emit("acceptance", `${projectId}:${reviewId}`, projectId, { acceptance: item }, actor.subject); return item;
    },
    pilotProposal({ actor, projectId, proposalId, reviewId, scope }) {
      owner(actor); id("projectId", projectId); id("proposalId", proposalId); id("reviewId", reviewId);
      const acceptance = acceptances.get(`${projectId}:${reviewId}`);
      if (!acceptance || acceptance.decision !== "accepted") throw new FinalReadinessError("OWNER_ACCEPTANCE_REQUIRED", "An explicit owner acceptance is required before a pilot proposal.", 409);
      if (pilotProposals.has(`${projectId}:${proposalId}`)) throw new FinalReadinessError("PROPOSAL_IMMUTABLE", "A proposal cannot be rewritten.", 409);
      const item = copy({ projectId, proposalId, reviewId, scope: String(scope).slice(0, 500), state: "proposal-only", execution: "forbidden-without-separate-pilot-authorization", createdAt: now(), createdBy: actor.subject });
      pilotProposals.set(`${projectId}:${proposalId}`, item); emit("pilot", `${projectId}:${proposalId}`, projectId, { proposal: item }, actor.subject); return item;
    },
    view({ actor, projectId }) {
      read(actor); id("projectId", projectId);
      return copy({ migrations: rows(migrations, projectId), readModels: rows(readModels, projectId), scenarios: rows(scenarios, projectId), traceability: rows(traceability, projectId), notionPlan: notionPlans.get(projectId) ?? null, reviews: rows(reviews, projectId), acceptance: rows(acceptances, projectId), pilotProposals: rows(pilotProposals, projectId) });
    },
    drainRecords() { return Object.freeze(outbox.splice(0, outbox.length)); },
    purgeProject({ projectId }) { for (const map of [migrations, readModels, scenarios, traceability, reviews, acceptances, pilotProposals, notionPlans]) for (const [key, value] of [...map]) if (value.projectId === projectId) map.delete(key); },
    hydrate(record) {
      if (!record || !READINESS_RECORD_KINDS.includes(record.kind)) throw new FinalReadinessError("INVALID_HYDRATION", "Readiness record is invalid.", 500);
      const mark = `${record.kind}:${record.key}`; const last = seen.get(mark) ?? 0; if (record.version < last) return; seen.set(mark, record.version);
      const data = record.payload ?? {};
      const targets = { migration: [migrations, "migration"], digest: [readModels, "digest"], scenario: [scenarios, "scenario"], traceability: [traceability, "traceability"], review: [reviews, "review"], acceptance: [acceptances, "acceptance"], pilot: [pilotProposals, "proposal"], "notion-plan": [notionPlans, "plan"] };
      const [map, field] = targets[record.kind]; map.set(record.key, copy(data[field]));
    }
  };
  return Object.freeze(api);
}
