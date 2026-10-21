import { createHash } from "node:crypto";

import {
  ACCEPTANCE_CRITERION_ID,
  CHECK_KINDS,
  EMPTY_PRECONDITIONS,
  VAGUE_TERMS
} from "../../contracts/src/acceptance-criteria.mjs";

/**
 * NX-011 — acceptance criteria compiler.
 *
 * Turns structured Persian criteria ("وقتی … آنگاه …" plus a check from a closed vocabulary) into a
 * machine checklist and an inert test skeleton for the isolated Product Runner. Pure and
 * deterministic. A criterion the compiler cannot bind to a known check is `needs-clarification`;
 * it is never reported as passing. The compiler does not approve anything: using the output
 * requires the project owner's approval, and the skeleton is text that Hero never executes.
 */

export class AcceptanceCompilerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AcceptanceCompilerError";
    this.code = code;
  }
}

const TEMPLATE_ID = /^[a-z][a-z0-9-]{2,40}$/;
const PATH_PATTERN = /^\/[A-Za-z0-9._~\-/]{0,100}$/;
const MAP_VALUE = /^[A-Za-z0-9._-]{1,40}$/;
const STRUCTURE = /^\s*وقتی\s+([\s\S]+?)\s*[،,]?\s+آنگاه\s+([\s\S]+?)\s*[.؟!]?\s*$/u;

function squash(text) {
  // Bidi marks are dropped; the zero-width non-joiner is kept because it is part of Persian spelling.
  return String(text ?? "").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim();
}

/** Splits "وقتی … آنگاه …". Anything else has no structure and is refused. */
export function parseCriterionText(text) {
  const normalized = squash(text);
  const match = STRUCTURE.exec(normalized);
  if (!match) return Object.freeze({ ok: false, reason: "NO_STRUCTURE" });
  if (/آنگاه/u.test(match[1]) || /وقتی/u.test(match[2]) || (normalized.match(/آنگاه/gu) ?? []).length > 1) return Object.freeze({ ok: false, reason: "NOT_ATOMIC" });
  return Object.freeze({ ok: true, when: match[1].trim(), then: match[2].trim() });
}

function checkParam(name, spec, value) {
  if (spec.enum) return spec.enum.includes(value) ? null : `INVALID_PARAM:${name}`;
  if (spec.subset) {
    if (!Array.isArray(value) || value.length === 0 || new Set(value).size !== value.length) return `INVALID_PARAM:${name}`;
    return value.every(item => spec.subset.includes(item)) ? null : `INVALID_PARAM:${name}`;
  }
  if (spec.paths) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 10 || new Set(value).size !== value.length) return `INVALID_PARAM:${name}`;
    return value.every(item => typeof item === "string" && PATH_PATTERN.test(item) && !item.includes("..")) ? null : `INVALID_PARAM:${name}`;
  }
  if (spec.map) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return `INVALID_PARAM:${name}`;
    const keys = Object.keys(value);
    if (keys.length === 0 || !keys.every(key => spec.map.includes(key) && typeof value[key] === "string" && MAP_VALUE.test(value[key]))) return `INVALID_PARAM:${name}`;
    return null;
  }
  if (spec.integer) return Number.isInteger(value) && value >= spec.integer[0] && value <= spec.integer[1] ? null : `INVALID_PARAM:${name}`;
  if (spec.number) return typeof value === "number" && Number.isFinite(value) && value >= spec.number[0] && value <= spec.number[1] ? null : `INVALID_PARAM:${name}`;
  return `INVALID_PARAM:${name}`;
}

function checkReasons(check) {
  if (!check || typeof check !== "object" || Array.isArray(check)) return ["NO_CHECK_BINDING"];
  const spec = Object.hasOwn(CHECK_KINDS, check.kind) ? CHECK_KINDS[check.kind] : null;
  if (!spec) return ["UNKNOWN_CHECK_KIND"];
  const params = check.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) return ["INVALID_PARAMS"];
  const reasons = [];
  for (const key of Object.keys(params)) if (!Object.hasOwn(spec.params, key)) reasons.push(`UNKNOWN_PARAM:${key}`);
  for (const [name, paramSpec] of Object.entries(spec.params)) {
    if (params[name] === undefined) {
      if (!paramSpec.optional) reasons.push(`MISSING_PARAM:${name}`);
      continue;
    }
    const problem = checkParam(name, paramSpec, params[name]);
    if (problem) reasons.push(problem);
  }
  if (spec.thresholdRequiredFor && Array.isArray(params.checks) && params.checks.includes(spec.thresholdRequiredFor) && typeof params.threshold !== "number") reasons.push("THRESHOLD_REQUIRED");
  return reasons;
}

function clip(text, limit = 220) {
  const value = squash(text);
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/** Compiles one structured criterion. Never throws for bad data: bad data is `needs-clarification`. */
export function compileCriterion(item, { seenIds = new Set() } = {}) {
  const reasons = [];
  const id = typeof item?.id === "string" ? item.id : "";
  if (!ACCEPTANCE_CRITERION_ID.test(id)) reasons.push("INVALID_ID");
  else if (seenIds.has(id)) reasons.push("DUPLICATE_ID");

  let when = squash(item?.when);
  let then = squash(item?.then);
  if (!when && !then && typeof item?.text === "string") {
    const parsed = parseCriterionText(item.text);
    if (parsed.ok) { when = parsed.when; then = parsed.then; } else reasons.push(parsed.reason);
  }
  if (when.length < 5 || EMPTY_PRECONDITIONS.includes(when)) reasons.push("MISSING_PRECONDITION");
  if (then.length < 5) reasons.push("MISSING_EXPECTATION");

  reasons.push(...checkReasons(item?.check));

  const declaredThreshold = typeof item?.check?.params?.threshold === "number" && Number.isFinite(item.check.params.threshold);
  if (!declaredThreshold) {
    // Whole words only: "امن" must not match inside "دامنه". A word with up to three extra letters
    // ("درستی", "امنیت") is still the vague word.
    const words = `${when} ${then}`.split(/[\s،,.؛;:!؟()«»"'\-/]+/u).filter(Boolean);
    for (const term of VAGUE_TERMS) if (words.some(word => word === term || (word.startsWith(term) && word.length - term.length <= 3))) reasons.push(`VAGUE_TERM:${term}`);
  }

  const spec = reasons.length === 0 ? CHECK_KINDS[item.check.kind] : null;
  const status = reasons.length > 0 ? "needs-clarification" : spec.automatable ? "automatable" : "manual";
  return Object.freeze({
    id: id || null,
    sourceText: typeof item?.sourceText === "string" ? item.sourceText : null,
    when,
    then,
    status,
    kind: reasons.length === 0 ? item.check.kind : null,
    params: reasons.length === 0 ? structuredClone(item.check.params) : null,
    reasons: Object.freeze([...new Set(reasons)])
  });
}

function percent(part, total) {
  return total === 0 ? 0 : Math.floor((part * 1000) / total) / 10;
}

/** Renders the inert Product Runner test skeleton. User text only ever appears inside JSON string literals. */
export function renderSkeleton({ templateId, items, digest }) {
  const lines = [
    `// GENERATED by the Hero acceptance compiler for template ${templateId} (digest ${digest}).`,
    "// This file is inert text. It runs only inside the isolated Product Runner, never inside Hero.",
    "// Using it requires the project owner's approval of the criteria it was generated from.",
    "import test from \"node:test\";",
    "import { createProductHarness } from \"./product-harness.mjs\"; // supplied by the Product Runner",
    "",
    "const harness = createProductHarness();",
    ""
  ];
  for (const item of items) {
    const title = JSON.stringify(`${item.id ?? "AC-INVALID"} — وقتی ${clip(item.when)} آنگاه ${clip(item.then)}`);
    if (item.status === "automatable") {
      lines.push(`test(${title}, async () => {`, `  await harness.assertCheck(${JSON.stringify(item.kind)}, ${JSON.stringify(item.params)});`, "});", "");
    } else if (item.status === "manual") {
      lines.push(`test.todo(${JSON.stringify(`${item.id} — manual review (${item.params.reviewer}) — وقتی ${clip(item.when)} آنگاه ${clip(item.then)}`)});`, "");
    } else {
      lines.push(`test.todo(${JSON.stringify(`${item.id ?? "AC-INVALID"} — NEEDS CLARIFICATION: ${item.reasons.join(", ")}`)});`, "");
    }
  }
  return lines.join("\n");
}

/** Compiles a template's structured criteria into a checklist, a coverage counter and a skeleton. */
export function compileCriteria({ templateId, items } = {}) {
  if (typeof templateId !== "string" || !TEMPLATE_ID.test(templateId)) throw new AcceptanceCompilerError("INVALID_TEMPLATE_ID", "templateId is invalid.");
  if (!Array.isArray(items) || items.length === 0 || items.length > 200) throw new AcceptanceCompilerError("INVALID_ITEMS", "items must contain 1-200 criteria.");
  const seenIds = new Set();
  const compiled = items.map(item => {
    const result = compileCriterion(item, { seenIds });
    if (result.id) seenIds.add(result.id);
    return result;
  });
  const automatable = compiled.filter(item => item.status === "automatable").length;
  const manual = compiled.filter(item => item.status === "manual").length;
  const needsClarification = compiled.filter(item => item.status === "needs-clarification").length;
  const canonical = compiled.map(item => ({ id: item.id, sourceText: item.sourceText, when: item.when, then: item.then, status: item.status, kind: item.kind, params: item.params, reasons: item.reasons }));
  const digest = createHash("sha256").update(JSON.stringify({ templateId, items: canonical })).digest("hex");
  return Object.freeze({
    schema: "hero.acceptance-checklist/v1",
    templateId,
    items: Object.freeze(compiled),
    coverage: Object.freeze({ total: compiled.length, automatable, manual, needsClarification, automatablePercent: percent(automatable, compiled.length) }),
    digest,
    skeleton: renderSkeleton({ templateId, items: compiled, digest }),
    ownerApproval: Object.freeze({ required: true, approved: false }),
    boundary: "The compiler never approves criteria. The skeleton is text for the isolated Product Runner and is never executed by Hero."
  });
}

/**
 * Checks that the structured registry says the same thing as the template criteria: every template
 * criterion is covered by at least one structured item quoting it verbatim, and no item quotes text
 * the template does not contain. This is the machine-checkable part of "same meaning".
 */
export function validateStructuredRegistry(registry, templateRegistry) {
  const errors = [];
  if (!registry || registry.schema !== "hero.acceptance-criteria-registry/v1") return ["unexpected acceptance registry schema"];
  const templates = new Map((templateRegistry?.templates ?? []).map(template => [template.templateId, template]));
  const seenTemplates = new Set();
  for (const entry of registry.templates ?? []) {
    const template = templates.get(entry.templateId);
    if (!template) { errors.push(`${entry.templateId}: unknown template`); continue; }
    if (seenTemplates.has(entry.templateId)) errors.push(`${entry.templateId}: listed twice`);
    seenTemplates.add(entry.templateId);
    if (entry.templateVersion !== template.version) errors.push(`${entry.templateId}: templateVersion ${entry.templateVersion} != ${template.version}`);
    const sources = new Set(template.acceptanceCriteria);
    const covered = new Set();
    for (const item of entry.items ?? []) {
      if (!sources.has(item.sourceText)) errors.push(`${item.id}: sourceText is not a criterion of ${entry.templateId}`);
      covered.add(item.sourceText);
      if (typeof item.id === "string" && !item.id.startsWith(`AC-${entry.templateId}-`)) errors.push(`${item.id}: id must start with AC-${entry.templateId}-`);
    }
    for (const source of sources) if (!covered.has(source)) errors.push(`${entry.templateId}: criterion not covered: ${source}`);
    try {
      compileCriteria({ templateId: entry.templateId, items: entry.items });
    } catch (error) {
      errors.push(`${entry.templateId}: ${error.message}`);
    }
  }
  for (const id of templates.keys()) if (!seenTemplates.has(id)) errors.push(`${id}: no structured criteria`);
  return errors;
}
