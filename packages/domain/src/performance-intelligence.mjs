import { AI_JUDGE_DRIFT_THRESHOLD, AI_JUDGE_MIN_PAIRS, CRITICAL_OVERRIDE_KINDS, EFFICIENCY_REFERENCE_TOKENS, EVALUATION_METHODS, FEEDBACK_SUBJECTS, HEALTH_FORMULA, RESERVATION_TTL_MINUTES, RISK_QUALITY_MULTIPLIER, USAGE_EVENT_FIELDS, USAGE_SCOPES, USAGE_SOURCES, WORK_TYPE_WEIGHTS } from "../../contracts/src/performance-intelligence.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
export const PERFORMANCE_RECORD_KINDS = Object.freeze(["invocation", "usage", "budget", "reservation", "pause", "dataset", "evaluation", "feedback", "override"]);
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
function copy(value) { return deepFreeze(structuredClone(value)); }
function id(label, value) { if (typeof value !== "string" || !ID.test(value)) throw new PerformanceError("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; }
function optionalId(label, value) { return value === null || value === undefined ? null : id(label, value); }
function editor(actor) { if (!actor || !["project-owner", "admin"].includes(actor.role)) throw new PerformanceError("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403); return actor; }
function owner(actor) { if (actor?.role !== "project-owner") throw new PerformanceError("OWNER_REQUIRED", "Owner access is required.", 403); return actor; }
function reader(actor) { if (!actor || !["project-owner", "admin", "viewer"].includes(actor.role)) throw new PerformanceError("PROJECT_READ_REQUIRED", "Project access is required.", 403); return actor; }
function reason(value) { if (typeof value !== "string" || value.trim().length < 3) throw new PerformanceError("REASON_REQUIRED", "A reason is required.", 400); return value.trim().slice(0, 500); }
function tokens(value, label) { if (!Number.isInteger(value) || value < 0 || value > 1e12) throw new PerformanceError("USAGE_INVALID", `${label} must be a non-negative integer.`, 400); return value; }
const sum = (items, field) => items.reduce((total, item) => total + Number(item[field] ?? 0), 0);
const round = (value, digits = 4) => value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
export class PerformanceError extends Error { constructor(code, message, statusCode = 409, details = undefined) { super(message); this.name = "PerformanceError"; this.code = code; this.statusCode = statusCode; if (details) this.details = details; } }

/**
 * Usage, budget, evaluation and health (WP-09). Every mutation emits an
 * append-only record (drainRecords) and hydrate() replays them in any order.
 * onEvent receives budget threshold and cap events so the caller can raise
 * notifications; it is never required for correctness.
 */
export function createPerformanceIntelligence({ now = () => new Date().toISOString(), onEvent = null } = {}) {
  const invocations = new Map(); const usage = new Map(); const budgets = new Map(); const budgetHistory = new Map(); const reservations = new Map(); const pauses = new Map();
  const datasets = new Map(); const evaluations = new Map(); const feedback = new Map(); const overrides = new Map();
  const outbox = []; const seen = new Map();
  const nowMs = () => Date.parse(now());
  function emit(kind, key, version, projectId, payload, actorId) { outbox.push(copy({ kind, key, version, projectId, payload, actorId, recordedAt: now() })); }
  function notify(event) { try { onEvent?.(copy(event)); } catch { /* notification is best-effort */ } }
  const projectUsage = (projectId, asOf = null) => [...usage.values()].filter(item => item.projectId === projectId && (!asOf || Date.parse(item.recordedAt) <= asOf));
  const used = projectId => sum(projectUsage(projectId), "totalTokens");
  function activeReservations(projectId) { const moment = nowMs(); return [...reservations.values()].filter(item => item.projectId === projectId && item.state === "held" && Date.parse(item.expiresAt) > moment); }
  const reserved = projectId => sum(activeReservations(projectId), "estimatedTokens");
  function decisionFor(projectId, total = used(projectId)) { const budget = budgets.get(projectId); return !budget ? "unbounded" : total >= budget.hardCap ? "hard-cap-pause-required" : total >= budget.softThreshold ? "soft-threshold-warning" : "within-budget"; }
  function setPause(projectId, state, why, actorId) { const prior = pauses.get(projectId); const next = copy({ projectId, paused: state, reason: why, version: (prior?.version ?? 0) + 1, changedAt: now(), changedBy: actorId }); pauses.set(projectId, next); emit("pause", projectId, next.version, projectId, { pause: next }, actorId); return next; }
  function scopeKey(item, groupBy) { return groupBy === "project" ? item.projectId : groupBy === "model" ? item.model : groupBy === "provider" ? item.provider : groupBy === "invocation" ? item.invocationId : item[`${groupBy}Id`] ?? "unassigned"; }
  function activeOverrides(projectId, asOf = nowMs()) { return [...overrides.values()].filter(item => item.projectId === projectId && item.active && Date.parse(item.recordedAt) <= asOf && (!item.expiresAt || Date.parse(item.expiresAt) > asOf)); }

  const api = {
    /** BO-100: an immutable snapshot of who/what spent tokens; usage inherits its scopes. */
    recordInvocation({ actor, projectId, invocationId, provider, model, teamId = null, roleId = null, taskId = null, runId = null, source = "recorded", promptVersion = null }) {
      editor(actor); id("projectId", projectId); id("invocationId", invocationId);
      if (!USAGE_SOURCES.includes(source)) throw new PerformanceError("USAGE_SOURCE_INVALID", "Usage source must be recorded, synthetic or imported.", 400);
      if (typeof provider !== "string" || provider.length < 2 || typeof model !== "string" || model.length < 2) throw new PerformanceError("INVOCATION_INVALID", "Provider and model are required.", 400);
      const snapshot = { invocationId, projectId, provider: provider.slice(0, 80), model: model.slice(0, 120), teamId: optionalId("teamId", teamId), roleId: optionalId("roleId", roleId), taskId: optionalId("taskId", taskId), runId: optionalId("runId", runId), source, promptVersion: promptVersion === null ? null : String(promptVersion).slice(0, 80) };
      const prior = invocations.get(invocationId);
      if (prior) { const { recordedAt, recordedBy, ...stored } = prior; if (JSON.stringify(stored) === JSON.stringify(snapshot)) return prior; throw new PerformanceError("INVOCATION_IMMUTABLE", "An invocation snapshot cannot change.", 409); }
      const item = copy({ ...snapshot, recordedAt: now(), recordedBy: actor.subject });
      invocations.set(invocationId, item); emit("invocation", invocationId, 1, projectId, { invocation: item }, actor.subject);
      return item;
    },
    /** BO-099/100: usage is immutable and always accepted (even past the cap) so accounting stays complete. */
    recordUsage({ actor, projectId, usageId, invocationId, provider = null, model = null, inputTokens = 0, cachedTokens = 0, outputTokens = 0, teamId = null, roleId = null, taskId = null, runId = null, source = "recorded", reservationId = null }) {
      editor(actor); id("projectId", projectId); id("usageId", usageId); id("invocationId", invocationId);
      if (usage.has(usageId)) throw new PerformanceError("USAGE_IMMUTABLE", "Usage event already exists.", 409);
      tokens(inputTokens, "inputTokens"); tokens(cachedTokens, "cachedTokens"); tokens(outputTokens, "outputTokens");
      let invocation = invocations.get(invocationId);
      if (!invocation) invocation = api.recordInvocation({ actor, projectId, invocationId, provider: provider ?? "unknown", model: model ?? "unknown", teamId, roleId, taskId, runId, source });
      if (invocation.projectId !== projectId) throw new PerformanceError("USAGE_SCOPE_MISMATCH", "The invocation belongs to another project.", 403);
      for (const [field, value] of Object.entries({ teamId, roleId, taskId, runId })) if (value !== null && invocation[field] !== null && invocation[field] !== value) throw new PerformanceError("USAGE_SCOPE_MISMATCH", `${field} differs from the invocation snapshot.`, 409);
      const entry = copy({ usageId, projectId, invocationId, provider: invocation.provider, model: invocation.model, teamId: invocation.teamId ?? teamId, roleId: invocation.roleId ?? roleId, taskId: invocation.taskId ?? taskId, runId: invocation.runId ?? runId, source: invocation.source, inputTokens, cachedTokens, outputTokens, totalTokens: inputTokens + cachedTokens + outputTokens, reservationId, recordedAt: now(), recordedBy: actor.subject });
      usage.set(usageId, entry); emit("usage", usageId, 1, projectId, { usage: entry }, actor.subject);
      if (reservationId) { const held = reservations.get(reservationId); if (held && held.projectId === projectId && held.state === "held") { const next = copy({ ...held, state: "committed", committedTokens: entry.totalTokens, committedAt: now() }); reservations.set(reservationId, next); emit("reservation", reservationId, 2, projectId, { reservation: next }, actor.subject); } }
      const before = decisionFor(projectId, used(projectId) - entry.totalTokens); const decision = decisionFor(projectId);
      if (decision === "hard-cap-pause-required" && !pauses.get(projectId)?.paused) { setPause(projectId, true, "cap-breach", actor.subject); notify({ type: "budget.hard-cap", projectId, used: used(projectId), hardCap: budgets.get(projectId).hardCap }); }
      else if (decision === "soft-threshold-warning" && before === "within-budget") notify({ type: "budget.soft-threshold", projectId, used: used(projectId), softThreshold: budgets.get(projectId).softThreshold });
      return copy({ ...entry, budgetDecision: decision });
    },
    /** BO-102: versioned caps; raising the hard cap is an owner decision. */
    setBudget({ actor, projectId, softThreshold, hardCap, expectedVersion = null, reason: why = "budget update" }) {
      editor(actor); id("projectId", projectId);
      if (!Number.isInteger(softThreshold) || !Number.isInteger(hardCap) || softThreshold < 1 || hardCap < softThreshold) throw new PerformanceError("BUDGET_INVALID", "Budget thresholds are invalid.", 400);
      const prior = budgets.get(projectId);
      if (expectedVersion !== null && expectedVersion !== (prior?.version ?? 0)) throw new PerformanceError("STALE_BUDGET", "The budget changed before this edit.", 409);
      if (prior && hardCap > prior.hardCap) owner(actor);
      const value = copy({ projectId, softThreshold, hardCap, version: (prior?.version ?? 0) + 1, reason: String(why).slice(0, 300), updatedAt: now(), updatedBy: actor.subject });
      budgets.set(projectId, value); budgetHistory.set(projectId, [...(budgetHistory.get(projectId) ?? []), value]); emit("budget", projectId, value.version, projectId, { budget: value }, actor.subject);
      return value;
    },
    budgetHistory({ actor, projectId }) { reader(actor); return Object.freeze([...(budgetHistory.get(id("projectId", projectId)) ?? [])]); },
    /** BO-102/110: an atomic check-and-hold before work starts; concurrent holds cannot overrun the cap. */
    reserve({ actor, projectId, reservationId, estimatedTokens }) {
      editor(actor); id("projectId", projectId); id("reservationId", reservationId); tokens(estimatedTokens, "estimatedTokens");
      if (reservations.has(reservationId)) { const prior = reservations.get(reservationId); if (prior.projectId === projectId && prior.estimatedTokens === estimatedTokens) return prior; throw new PerformanceError("RESERVATION_CONFLICT", "Reservation id already used.", 409); }
      if (pauses.get(projectId)?.paused) throw new PerformanceError("BUDGET_PAUSED", "The project is paused at its hard cap; the owner must raise the cap and resume.", 409);
      const budget = budgets.get(projectId);
      if (budget && used(projectId) + reserved(projectId) + estimatedTokens > budget.hardCap) throw new PerformanceError("BUDGET_HARD_CAP", "This work would exceed the hard cap.", 409, { used: used(projectId), reserved: reserved(projectId), hardCap: budget.hardCap });
      const item = copy({ reservationId, projectId, estimatedTokens, state: "held", heldAt: now(), expiresAt: new Date(nowMs() + RESERVATION_TTL_MINUTES * 60_000).toISOString(), heldBy: actor.subject });
      reservations.set(reservationId, item); emit("reservation", reservationId, 1, projectId, { reservation: item }, actor.subject);
      return item;
    },
    release({ actor, projectId, reservationId }) {
      editor(actor); const held = reservations.get(id("reservationId", reservationId));
      if (!held || held.projectId !== projectId) throw new PerformanceError("RESERVATION_NOT_FOUND", "Reservation was not found.", 404);
      if (held.state !== "held") return held;
      const next = copy({ ...held, state: "released", releasedAt: now() }); reservations.set(reservationId, next); emit("reservation", reservationId, 2, projectId, { reservation: next }, actor.subject);
      return next;
    },
    budgetStatus({ actor, projectId }) {
      reader(actor); id("projectId", projectId); const budget = budgets.get(projectId) ?? null;
      return copy({ projectId, used: used(projectId), reserved: reserved(projectId), budget, decision: decisionFor(projectId), paused: Boolean(pauses.get(projectId)?.paused), pauseReason: pauses.get(projectId)?.paused ? pauses.get(projectId).reason : null, remaining: budget ? Math.max(0, budget.hardCap - used(projectId) - reserved(projectId)) : null });
    },
    /** BO-102: leaving the safe pause needs the owner and room under the cap. */
    resume({ actor, projectId, reason: why }) {
      owner(actor); id("projectId", projectId); const note = reason(why);
      if (!pauses.get(projectId)?.paused) throw new PerformanceError("BUDGET_NOT_PAUSED", "The project is not paused.", 409);
      if (decisionFor(projectId) === "hard-cap-pause-required") throw new PerformanceError("BUDGET_STILL_OVER_CAP", "Raise the hard cap before resuming.", 409);
      return setPause(projectId, false, note, actor.subject);
    },
    /** BO-101: aggregates by scope, optionally inside a period. */
    ledger({ actor, projectId, groupBy = "project", from = null, to = null }) {
      reader(actor); id("projectId", projectId);
      if (!USAGE_SCOPES.includes(groupBy)) throw new PerformanceError("LEDGER_GROUP_INVALID", "Ledger group is invalid.", 400);
      const fromMs = from ? Date.parse(from) : -Infinity; const toMs = to ? Date.parse(to) : Infinity;
      if (Number.isNaN(fromMs) || Number.isNaN(toMs)) throw new PerformanceError("LEDGER_PERIOD_INVALID", "Ledger period is invalid.", 400);
      const buckets = new Map();
      for (const item of projectUsage(projectId).filter(entry => Date.parse(entry.recordedAt) >= fromMs && Date.parse(entry.recordedAt) <= toMs)) {
        const key = scopeKey(item, groupBy); const row = buckets.get(key) ?? { scope: key, inputTokens: 0, cachedTokens: 0, outputTokens: 0, totalTokens: 0, events: 0 };
        for (const field of USAGE_EVENT_FIELDS) row[field] += item[field]; row.events += 1; buckets.set(key, row);
      }
      return Object.freeze([...buckets.values()].sort((a, b) => b.totalTokens - a.totalTokens || a.scope.localeCompare(b.scope)));
    },
    /** BO-110: every grouping must add up to the same project total. */
    reconcile({ actor, projectId }) {
      reader(actor); const total = used(projectId); const groups = {};
      for (const groupBy of USAGE_SCOPES) groups[groupBy] = sum(api.ledger({ actor, projectId, groupBy }), "totalTokens");
      return copy({ projectId, projectTotal: total, groups, complete: Object.values(groups).every(value => value === total), events: projectUsage(projectId).length });
    },
    /** BO-103: an evaluation dataset of cases with expected outcomes. */
    registerDataset({ actor, projectId, datasetId, workType = "general", cases }) {
      editor(actor); id("projectId", projectId); id("datasetId", datasetId);
      if (!WORK_TYPE_WEIGHTS[workType]) throw new PerformanceError("WORK_TYPE_INVALID", "Work type is invalid.", 400);
      if (!Array.isArray(cases) || !cases.length || cases.length > 500) throw new PerformanceError("DATASET_INVALID", "A dataset needs 1..500 cases.", 400);
      const ids = new Set(); for (const item of cases) { id("caseId", item?.caseId); if (ids.has(item.caseId)) throw new PerformanceError("DATASET_INVALID", "Case ids must be unique.", 400); ids.add(item.caseId); }
      const prior = datasets.get(datasetId); if (prior && prior.projectId !== projectId) throw new PerformanceError("DATASET_SCOPE_INVALID", "A dataset cannot move between projects.", 409);
      const item = copy({ datasetId, projectId, workType, cases: cases.map(entry => ({ caseId: entry.caseId, expected: String(entry.expected ?? "").slice(0, 500) })), version: (prior?.version ?? 0) + 1, recordedAt: now(), recordedBy: actor.subject });
      datasets.set(datasetId, item); emit("dataset", datasetId, item.version, projectId, { dataset: item }, actor.subject);
      return item;
    },
    /** BO-103: deterministic, human and AI evaluations; an AI judge must name its model and version. */
    recordEvaluation({ actor, projectId, evaluationId, subjectType, subjectId, method, goalFit, errorCount = 0, reworkCount = 0, evidenceRefs = [], datasetId = null, caseId = null, judge = null, runId = null, workType = "general", riskLevel = "standard", cycleTimeMinutes = null }) {
      editor(actor); id("projectId", projectId); id("evaluationId", evaluationId); id("subjectId", subjectId);
      if (!EVALUATION_METHODS.includes(method) || typeof goalFit !== "number" || goalFit < 0 || goalFit > 1 || !Number.isInteger(errorCount) || errorCount < 0 || !Number.isInteger(reworkCount) || reworkCount < 0 || !Array.isArray(evidenceRefs) || evidenceRefs.some(ref => typeof ref !== "string" || !ref.startsWith("hero://"))) throw new PerformanceError("EVALUATION_INVALID", "Evaluation is invalid.", 400);
      if (!WORK_TYPE_WEIGHTS[workType] || !RISK_QUALITY_MULTIPLIER[riskLevel]) throw new PerformanceError("EVALUATION_INVALID", "Work type or risk level is invalid.", 400);
      if (method === "ai" && (!judge || typeof judge.model !== "string" || typeof judge.version !== "string")) throw new PerformanceError("AI_JUDGE_REQUIRED", "An AI evaluation must name its judge model and version.", 400);
      if (cycleTimeMinutes !== null && (!Number.isFinite(cycleTimeMinutes) || cycleTimeMinutes < 0)) throw new PerformanceError("EVALUATION_INVALID", "Cycle time is invalid.", 400);
      if (datasetId !== null) { const dataset = datasets.get(id("datasetId", datasetId)); if (!dataset || dataset.projectId !== projectId) throw new PerformanceError("DATASET_NOT_FOUND", "Dataset was not found in this project.", 404); if (!dataset.cases.some(item => item.caseId === caseId)) throw new PerformanceError("CASE_NOT_FOUND", "Case is not in the dataset.", 404); }
      if (evaluations.has(evaluationId)) throw new PerformanceError("EVALUATION_IMMUTABLE", "An evaluation cannot be rewritten.", 409);
      const item = copy({ evaluationId, projectId, subjectType: String(subjectType ?? "output").slice(0, 80), subjectId, method, goalFit, errorCount, reworkCount, evidenceRefs: [...evidenceRefs], datasetId, caseId, judge: method === "ai" ? { model: judge.model.slice(0, 120), version: judge.version.slice(0, 40) } : null, runId: optionalId("runId", runId), workType, riskLevel, cycleTimeMinutes, recordedAt: now(), recordedBy: actor.subject });
      evaluations.set(evaluationId, item); emit("evaluation", evaluationId, 1, projectId, { evaluation: item }, actor.subject);
      return item;
    },
    /** BO-110: compare AI-judge scores with human scores on the same cases. */
    judgeDrift({ actor, projectId, datasetId }) {
      reader(actor); id("datasetId", datasetId);
      const rows = [...evaluations.values()].filter(item => item.projectId === projectId && item.datasetId === datasetId);
      const pairs = [];
      for (const ai of rows.filter(item => item.method === "ai")) { const human = rows.find(item => item.method === "human" && item.caseId === ai.caseId); if (human) pairs.push({ caseId: ai.caseId, ai: ai.goalFit, human: human.goalFit, difference: round(Math.abs(ai.goalFit - human.goalFit)) }); }
      if (pairs.length < AI_JUDGE_MIN_PAIRS) return copy({ projectId, datasetId, status: "insufficient-data", pairs: pairs.length, threshold: AI_JUDGE_DRIFT_THRESHOLD });
      const meanAbsoluteDifference = round(sum(pairs, "difference") / pairs.length);
      return copy({ projectId, datasetId, status: meanAbsoluteDifference > AI_JUDGE_DRIFT_THRESHOLD ? "drifted" : "aligned", meanAbsoluteDifference, threshold: AI_JUDGE_DRIFT_THRESHOLD, pairs });
    },
    /** BO-104: feedback is optional and never gates anything. */
    recordFeedback({ actor, projectId, feedbackId, subjectId, subjectKind = "output", rating = null, comment = "" }) {
      editor(actor); id("projectId", projectId); id("feedbackId", feedbackId); id("subjectId", subjectId);
      if (!FEEDBACK_SUBJECTS.includes(subjectKind)) throw new PerformanceError("FEEDBACK_INVALID", "Feedback subject must be milestone, release or output.", 400);
      if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new PerformanceError("FEEDBACK_INVALID", "Rating is invalid.", 400);
      if (feedback.has(feedbackId)) throw new PerformanceError("FEEDBACK_IMMUTABLE", "Feedback cannot be rewritten.", 409);
      const item = copy({ feedbackId, projectId, subjectId, subjectKind, rating, comment: String(comment).slice(0, 1200), optional: true, recordedAt: now(), recordedBy: actor.subject });
      feedback.set(feedbackId, item); emit("feedback", feedbackId, 1, projectId, { feedback: item }, actor.subject);
      return item;
    },
    /** BO-105/106: goal fit, token efficiency and error/rework, normalized by work type and risk. */
    scorecard({ actor, projectId, subjectId }) {
      reader(actor); id("projectId", projectId); id("subjectId", subjectId);
      const rows = [...evaluations.values()].filter(item => item.projectId === projectId && item.subjectId === subjectId);
      const tokenUsage = sum(projectUsage(projectId).filter(item => [item.teamId, item.roleId, item.taskId, item.runId, item.model].includes(subjectId)), "totalTokens");
      const ratings = [...feedback.values()].filter(item => item.projectId === projectId && item.subjectId === subjectId && item.rating !== null);
      if (!rows.length) return copy({ projectId, subjectId, formulaVersion: HEALTH_FORMULA.version, status: "insufficient-data", tokenUsage, evaluationCount: 0 });
      const goalFit = sum(rows, "goalFit") / rows.length; const errorRework = sum(rows, "errorCount") + sum(rows, "reworkCount");
      const workType = rows.at(-1).workType; const riskLevel = rows.at(-1).riskLevel; const weights = WORK_TYPE_WEIGHTS[workType];
      const efficiency = tokenUsage === 0 ? 1 : Math.min(1, (goalFit * EFFICIENCY_REFERENCE_TOKENS) / tokenUsage * rows.length);
      const errorReworkRate = errorRework / rows.length;
      const quality = Math.max(0, 1 - Math.min(1, errorReworkRate * 0.25 * RISK_QUALITY_MULTIPLIER[riskLevel]));
      const normalizedScore = Math.round((weights.goalFit * goalFit + weights.efficiency * efficiency + weights.quality * quality) * 100);
      const cycle = rows.filter(item => item.cycleTimeMinutes !== null);
      return copy({ projectId, subjectId, formulaVersion: HEALTH_FORMULA.version, workType, riskLevel, goalFit: round(goalFit), tokenUsage, tokenEfficiency: tokenUsage === 0 ? null : round(goalFit / tokenUsage, 8), goalFitPerThousandTokens: tokenUsage === 0 ? null : round(goalFit * 1000 / tokenUsage), errorRework, errorReworkRate: round(errorReworkRate), normalizedScore, complementary: { averageCycleTimeMinutes: cycle.length ? round(sum(cycle, "cycleTimeMinutes") / cycle.length, 2) : null, ownerRating: ratings.length ? round(sum(ratings, "rating") / ratings.length, 2) : null }, evaluationCount: rows.length });
    },
    /** BO-107: deterministic and replayable — the same records and asOf always give the same result. */
    health({ actor, projectId, asOf = null, subjectId = null }) {
      reader(actor); id("projectId", projectId);
      const moment = asOf ? Date.parse(asOf) : nowMs(); if (Number.isNaN(moment)) throw new PerformanceError("HEALTH_AS_OF_INVALID", "asOf is invalid.", 400);
      const recent = [...evaluations.values()].filter(item => item.projectId === projectId && Date.parse(item.recordedAt) <= moment && (!subjectId || item.subjectId === subjectId));
      const budget = [...(budgetHistory.get(projectId) ?? [])].filter(item => Date.parse(item.updatedAt) <= moment).at(-1) ?? null;
      const total = sum(projectUsage(projectId, moment), "totalTokens");
      const critical = activeOverrides(projectId, moment); const capBreach = Boolean(budget && total >= budget.hardCap);
      const freshnessMinutes = recent.length ? Math.max(0, Math.round((moment - Math.max(...recent.map(item => Date.parse(item.recordedAt)))) / 60000)) : null;
      const ageHours = freshnessMinutes === null ? null : freshnessMinutes / 60;
      const freshnessFactor = ageHours === null ? 0 : ageHours <= HEALTH_FORMULA.freshForHours ? 1 : Math.max(HEALTH_FORMULA.staleConfidenceFloor, 1 - (ageHours - HEALTH_FORMULA.freshForHours) / (HEALTH_FORMULA.staleFloorAfterDays * 24 - HEALTH_FORMULA.freshForHours) * (1 - HEALTH_FORMULA.staleConfidenceFloor));
      const confidence = round(Math.min(1, recent.length / HEALTH_FORMULA.fullConfidenceSamples) * freshnessFactor, 3);
      const score = recent.length ? Math.round(sum(recent, "goalFit") / recent.length * 100) : null;
      let status = "unknown"; const reasons = [];
      if (score !== null && confidence >= HEALTH_FORMULA.minimumConfidence) status = score >= HEALTH_FORMULA.healthyAtOrAbove ? "healthy" : score >= HEALTH_FORMULA.degradedAtOrAbove ? "degraded" : "critical";
      else if (score !== null) reasons.push("low-confidence");
      else reasons.push("no-evaluations");
      if (capBreach) { status = "critical"; reasons.push("cap-breach"); }
      if (critical.length) { status = "critical"; reasons.push(...critical.map(item => item.kind)); }
      return copy({ projectId, subjectId, formulaVersion: HEALTH_FORMULA.version, asOf: new Date(moment).toISOString(), status, score: critical.length ? 0 : score, confidence: critical.length ? 1 : confidence, freshnessMinutes, sampleSize: recent.length, reasons: [...new Set(reasons)], criticalOverrides: critical.map(item => item.reason), tokenUsage: total, budget });
    },
    /** BO-108: outage, vulnerability, isolation and cap-breach force critical; clearing one is an owner decision. */
    setCriticalOverride({ actor, projectId, overrideId, reason: why, kind = "manual", active = true, expiresAt = null }) {
      editor(actor); id("projectId", projectId); id("overrideId", overrideId);
      if (typeof why !== "string" || why.trim().length < 3) throw new PerformanceError("OVERRIDE_INVALID", "Override reason is required.", 400);
      if (!CRITICAL_OVERRIDE_KINDS.includes(kind)) throw new PerformanceError("OVERRIDE_KIND_INVALID", `Override kind must be one of ${CRITICAL_OVERRIDE_KINDS.join(", ")}.`, 400);
      if (expiresAt !== null && (Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) <= nowMs())) throw new PerformanceError("OVERRIDE_INVALID", "Expiry must be in the future.", 400);
      const prior = overrides.get(overrideId);
      if (prior && prior.projectId !== projectId) throw new PerformanceError("OVERRIDE_SCOPE_INVALID", "An override cannot move between projects.", 409);
      if (!active) owner(actor);
      const item = copy({ overrideId, projectId, kind, reason: why.trim().slice(0, 500), active: Boolean(active), expiresAt, version: (prior?.version ?? 0) + 1, recordedAt: now(), recordedBy: actor.subject });
      overrides.set(overrideId, item); emit("override", overrideId, item.version, projectId, { override: item }, actor.subject);
      return item;
    },
    /** BO-109: from a number to the evidence behind it. */
    drillDown({ actor, projectId, kind, groupBy = "project", scope = null }) {
      reader(actor); id("projectId", projectId);
      if (kind === "cost") {
        if (!USAGE_SCOPES.includes(groupBy)) throw new PerformanceError("LEDGER_GROUP_INVALID", "Ledger group is invalid.", 400);
        const events = projectUsage(projectId).filter(item => scope === null || scopeKey(item, groupBy) === scope);
        return copy({ projectId, kind, groupBy, scope, totalTokens: sum(events, "totalTokens"), events: events.map(item => ({ usageId: item.usageId, invocationId: item.invocationId, runId: item.runId, taskId: item.taskId, model: item.model, totalTokens: item.totalTokens, recordedAt: item.recordedAt, invocation: invocations.get(item.invocationId) ?? null })) });
      }
      if (kind === "health") {
        const health = api.health({ actor, projectId, subjectId: scope });
        const rows = [...evaluations.values()].filter(item => item.projectId === projectId && (!scope || item.subjectId === scope));
        return copy({ projectId, kind, scope, health, evaluations: rows.map(item => ({ evaluationId: item.evaluationId, subjectId: item.subjectId, method: item.method, goalFit: item.goalFit, runId: item.runId, evidenceRefs: item.evidenceRefs, recordedAt: item.recordedAt })), overrides: activeOverrides(projectId) });
      }
      throw new PerformanceError("DRILL_DOWN_INVALID", "Drill-down kind must be cost or health.", 400);
    },
    purgeProject({ projectId }) {
      for (const map of [invocations, usage, reservations, datasets, evaluations, feedback, overrides]) for (const [key, value] of map) if (value.projectId === projectId) map.delete(key);
      budgets.delete(projectId); budgetHistory.delete(projectId); pauses.delete(projectId);
    },
    drainRecords() { return Object.freeze(outbox.splice(0, outbox.length)); },
    hydrate(record) {
      if (!record || !PERFORMANCE_RECORD_KINDS.includes(record.kind)) throw new PerformanceError("INVALID_HYDRATION", "Performance record is invalid.", 500);
      const data = record.payload ?? {}; const key = `${record.kind}:${record.key}`;
      if (record.kind === "budget") { const list = (budgetHistory.get(record.key) ?? []).filter(item => item.version !== data.budget.version); budgetHistory.set(record.key, [...list, copy(data.budget)].sort((a, b) => a.version - b.version)); }
      if ((seen.get(key) ?? 0) > record.version) return; seen.set(key, record.version);
      const target = { invocation: [invocations, "invocation"], usage: [usage, "usage"], budget: [budgets, "budget"], reservation: [reservations, "reservation"], pause: [pauses, "pause"], dataset: [datasets, "dataset"], evaluation: [evaluations, "evaluation"], feedback: [feedback, "feedback"], override: [overrides, "override"] }[record.kind];
      target[0].set(record.key, copy(data[target[1]]));
    }
  };
  return Object.freeze(api);
}
