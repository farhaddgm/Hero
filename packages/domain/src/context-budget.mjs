import { createHash } from "node:crypto";

/**
 * NX-025 — token budget allocator for assembled context.
 *
 * Project Memory used to cut context with a bare item cap (`slice(0, maxItems)`): a silent drop,
 * in insertion order, with no token limit and no report. This allocator selects records against a
 * per-role token budget in a deterministic order, never cuts a record in half, and reports every
 * record it left out with the reason. It does not change which records a role may see: it only
 * orders and trims what Project Memory already allowed (role and project isolation are untouched).
 *
 * Token counts are offline heuristic ESTIMATES (no external tokenizer) and are labelled as such.
 * The heuristic over-counts on purpose: an estimate that is too high only wastes room, one that is
 * too low would overrun a model's window.
 */

export const CONTEXT_BUDGET_VERSION = "1.0";
export const TOKEN_ESTIMATE_METHOD = "offline-heuristic-v1";

export class ContextBudgetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ContextBudgetError";
    this.code = code;
  }
}

export const OMISSION_REASONS = Object.freeze({
  tokenBudget: "token-budget",
  itemCap: "item-cap",
  tooLarge: "item-too-large",
  requiredOverBudget: "citation-required-over-budget",
  requiredPriority: "kept-out-for-citation-required"
});

/** A role's budget. `citationRequiredKinds` are the memory kinds whose citation must survive trimming. */
export const DEFAULT_CONTEXT_BUDGETS = Object.freeze({
  planner: Object.freeze({ maxTokens: 6000, citationFloorTokens: 600, citationRequiredKinds: Object.freeze(["rule", "decision"]), kindPriority: Object.freeze(["rule", "decision", "architecture", "evidence", "artifact"]) }),
  implementer: Object.freeze({ maxTokens: 8000, citationFloorTokens: 600, citationRequiredKinds: Object.freeze(["rule", "decision"]), kindPriority: Object.freeze(["rule", "architecture", "decision", "artifact", "evidence"]) }),
  reviewer: Object.freeze({ maxTokens: 6000, citationFloorTokens: 800, citationRequiredKinds: Object.freeze(["rule", "decision", "evidence"]), kindPriority: Object.freeze(["rule", "decision", "evidence", "architecture", "artifact"]) }),
  cursor: Object.freeze({ maxTokens: 4000, citationFloorTokens: 400, citationRequiredKinds: Object.freeze(["rule"]), kindPriority: Object.freeze(["rule", "architecture", "decision", "artifact", "evidence"]) })
});

/**
 * Deterministic token estimate. Weights per character: Arabic-script letters 0.6, ASCII letters and
 * digits 0.3, whitespace 0.15, everything else 1. The sum is rounded up.
 */
export function estimateTokens(text) {
  const value = String(text ?? "");
  let total = 0;
  for (const char of value) {
    if (/\p{Script=Arabic}/u.test(char)) total += 0.6;
    else if (/[A-Za-z0-9]/.test(char)) total += 0.3;
    else if (/\s/.test(char)) total += 0.15;
    else total += 1;
  }
  return Math.ceil(total);
}

function assertPolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) throw new ContextBudgetError("INVALID_POLICY", "A token budget policy object is required.");
  const { maxTokens, citationFloorTokens, citationRequiredKinds = [], kindPriority = [] } = policy;
  if (!Number.isInteger(maxTokens) || maxTokens < 100 || maxTokens > 200_000) throw new ContextBudgetError("INVALID_POLICY", "maxTokens must be an integer from 100 to 200000.");
  if (!Number.isInteger(citationFloorTokens) || citationFloorTokens < 0 || citationFloorTokens > Math.floor(maxTokens / 2)) throw new ContextBudgetError("INVALID_POLICY", "citationFloorTokens must be an integer from 0 to half of maxTokens.");
  if (!Array.isArray(citationRequiredKinds) || !Array.isArray(kindPriority) || [...citationRequiredKinds, ...kindPriority].some(item => typeof item !== "string")) throw new ContextBudgetError("INVALID_POLICY", "kind lists must be arrays of strings.");
  return { maxTokens, citationFloorTokens, citationRequiredKinds: new Set(citationRequiredKinds), kindPriority: [...kindPriority] };
}

function recordCost(record) {
  const contentTokens = estimateTokens(record.content);
  // The citation is the source reference plus a fixed label for kind and version.
  const citationTokens = estimateTokens(record.source?.reference ?? "") + estimateTokens(record.source?.documentVersion ?? "") + 4;
  return { contentTokens, citationTokens };
}

function assertRecord(record, index) {
  if (!record || typeof record.memoryId !== "string" || typeof record.content !== "string" || typeof record.kind !== "string") throw new ContextBudgetError("INVALID_RECORD", `Record ${index} needs memoryId, kind and content.`);
  if (typeof record.source?.reference !== "string" || record.source.reference.length === 0) throw new ContextBudgetError("MISSING_CITATION", `Record ${record.memoryId} has no source reference to cite.`);
}

/**
 * Selects records for a context under a token budget.
 *
 * Order: citation-required records first, then by the policy's kind priority, task-scoped before
 * project-scoped, newer first, then memoryId (a total order, so the result never depends on input
 * order). Citation-required records are never dropped for a record without that protection: if one
 * cannot fit, no unprotected record is included either, and the result is `degraded`.
 */
export function allocateContextBudget({ records, policy, maxItems = 12 } = {}) {
  const rules = assertPolicy(policy);
  if (!Array.isArray(records) || records.length > 5_000) throw new ContextBudgetError("INVALID_RECORDS", "records must be an array of at most 5000 items.");
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 12) throw new ContextBudgetError("INVALID_POLICY", "maxItems must be an integer from 1 to 12.");
  records.forEach(assertRecord);
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.memoryId)) throw new ContextBudgetError("DUPLICATE_RECORD", `Record ${record.memoryId} appears twice.`);
    seen.add(record.memoryId);
  }

  const priorityIndex = kind => {
    const index = rules.kindPriority.indexOf(kind);
    return index === -1 ? rules.kindPriority.length : index;
  };
  const ranked = records.map(record => ({ record, protectedByCitation: rules.citationRequiredKinds.has(record.kind), ...recordCost(record) })).sort((a, b) =>
    Number(b.protectedByCitation) - Number(a.protectedByCitation)
    || priorityIndex(a.record.kind) - priorityIndex(b.record.kind)
    || Number(b.record.scope === "task") - Number(a.record.scope === "task")
    || String(b.record.recordedAt ?? "").localeCompare(String(a.record.recordedAt ?? ""))
    || a.record.memoryId.localeCompare(b.record.memoryId));

  const selected = [];
  const omitted = [];
  let contentUsed = 0;
  let citationUsed = 0;
  const fits = item => contentUsed + item.contentTokens + Math.max(rules.citationFloorTokens, citationUsed + item.citationTokens) <= rules.maxTokens;
  const take = item => { selected.push(item); contentUsed += item.contentTokens; citationUsed += item.citationTokens; };
  const leave = (item, reason) => omitted.push(Object.freeze({ memoryId: item.record.memoryId, kind: item.record.kind, reason, tokens: item.contentTokens + item.citationTokens, protectedByCitation: item.protectedByCitation }));

  let requiredDropped = false;
  for (const item of ranked) {
    if (item.protectedByCitation) {
      if (selected.length >= maxItems) { leave(item, OMISSION_REASONS.itemCap); requiredDropped = true; }
      else if (fits(item)) take(item);
      else { leave(item, item.contentTokens + item.citationTokens + rules.citationFloorTokens > rules.maxTokens ? OMISSION_REASONS.tooLarge : OMISSION_REASONS.requiredOverBudget); requiredDropped = true; }
      continue;
    }
    if (requiredDropped) { leave(item, OMISSION_REASONS.requiredPriority); continue; }
    if (selected.length >= maxItems) leave(item, OMISSION_REASONS.itemCap);
    else if (item.contentTokens + item.citationTokens + rules.citationFloorTokens > rules.maxTokens) leave(item, OMISSION_REASONS.tooLarge);
    else if (fits(item)) take(item);
    else leave(item, OMISSION_REASONS.tokenBudget);
  }

  const usage = {
    estimate: true,
    method: TOKEN_ESTIMATE_METHOD,
    limit: rules.maxTokens,
    citationFloor: rules.citationFloorTokens,
    contentTokens: contentUsed,
    citationTokens: citationUsed,
    totalTokens: contentUsed + Math.max(rules.citationFloorTokens, citationUsed)
  };
  const status = requiredDropped ? "degraded" : "complete";
  const digest = createHash("sha256").update(JSON.stringify({ selected: selected.map(item => item.record.memoryId), omitted: omitted.map(item => [item.memoryId, item.reason]), usage })).digest("hex");
  return Object.freeze({
    schema: "hero.context-budget/v1",
    status,
    selected: Object.freeze(selected.map(item => item.record)),
    omitted: Object.freeze(omitted),
    usage: Object.freeze(usage),
    digest
  });
}

/** The budget policy for a recipient role, or nothing for an unknown role (fail closed: no silent default). */
export function budgetForRole(role) {
  return Object.hasOwn(DEFAULT_CONTEXT_BUDGETS, role) ? DEFAULT_CONTEXT_BUDGETS[role] : null;
}
