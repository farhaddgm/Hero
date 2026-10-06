import { PRODUCT_TYPES } from "./product-factory.mjs";

export const PROJECT_SETTINGS_CONTRACT_VERSION = "1.1";
export const SETTINGS_LAYERS = Object.freeze(["hero-invariant", "policy-template", "project-override", "run-override"]);
export const POLICY_RISK_LEVELS = Object.freeze(["low", "standard", "high"]);
export const AUTOMATION_MODES = Object.freeze(["manual", "approval-required", "propose-first"]);

const MODEL_ID = "^[a-z][a-z0-9._-]{1,63}$";

/** Typed schema for known setting paths. Unknown paths stay allowed as safe JSON
 * (the Settings form offers a free path), but a known path never accepts a value
 * of the wrong type. `strictness` orders values from most to least restrictive so
 * a guarded template value can act as a floor that higher layers cannot relax. */
export const SETTINGS_FIELD_SCHEMA = Object.freeze([
  Object.freeze({ path: "ai.defaultModel", type: "string", pattern: MODEL_ID, labelFa: "مدل پیش‌فرض AI" }),
  Object.freeze({ pathPattern: "^ai\\.roleModels\\.[a-z][A-Za-z0-9]{1,31}$", type: "string", pattern: MODEL_ID, labelFa: "مدل اختصاصی نقش" }),
  Object.freeze({ pathPattern: "^ai\\.teamModels\\.[a-z][A-Za-z0-9]{1,31}$", type: "string", pattern: MODEL_ID, labelFa: "مدل اختصاصی تیم" }),
  Object.freeze({ path: "automation.mode", type: "enum", values: AUTOMATION_MODES, strictness: "ordered", labelFa: "حالت خودکارسازی" }),
  Object.freeze({ path: "budget.tokenHardCap", type: "integer", minimum: 1000, maximum: 10000000, strictness: "lower-is-stricter", labelFa: "سقف Token" }),
  Object.freeze({ path: "project.type", type: "enum", values: PRODUCT_TYPES, labelFa: "نوع پروژه" }),
  Object.freeze({ path: "project.riskLevel", type: "enum", values: POLICY_RISK_LEVELS, labelFa: "سطح ریسک" })
]);

/** Paths that must resolve before a Run may be dispatched (BO-050, fail-closed). */
export const REQUIRED_POLICY_PATHS = Object.freeze(["ai.defaultModel", "automation.mode", "budget.tokenHardCap"]);

const RISK_BASE = Object.freeze({
  low: Object.freeze({ "ai.defaultModel": "luna", "automation.mode": "propose-first", "budget.tokenHardCap": 500000 }),
  standard: Object.freeze({ "ai.defaultModel": "luna", "automation.mode": "propose-first", "budget.tokenHardCap": 250000 }),
  high: Object.freeze({ "ai.defaultModel": "sol", "automation.mode": "approval-required", "budget.tokenHardCap": 100000 })
});

/** Paths a template locks as a floor. A project or Run override may tighten them
 * but never relax them below the template value. */
const RISK_GUARDS = Object.freeze({ low: Object.freeze([]), standard: Object.freeze([]), high: Object.freeze(["automation.mode", "budget.tokenHardCap"]) });

const TYPE_ADJUSTMENTS = Object.freeze({
  "security-tool": Object.freeze({ values: Object.freeze({ "automation.mode": "approval-required" }), guards: Object.freeze(["automation.mode"]) }),
  data: Object.freeze({ values: Object.freeze({ "budget.tokenHardCap": 150000 }), guards: Object.freeze([]) }),
  library: Object.freeze({ values: Object.freeze({ "budget.tokenHardCap": 150000 }), guards: Object.freeze([]) })
});

function stricter(field, left, right) {
  if (field.strictness === "lower-is-stricter") return Math.min(left, right);
  if (field.strictness === "ordered") return field.values.indexOf(left) <= field.values.indexOf(right) ? left : right;
  return right;
}

export function settingsFieldFor(path) {
  return SETTINGS_FIELD_SCHEMA.find(field => field.path === path || (field.pathPattern && new RegExp(field.pathPattern).test(path))) ?? null;
}

/** Returns null when valid, otherwise a short machine-safe reason. */
export function validateSettingValue(path, value) {
  const field = settingsFieldFor(path);
  if (!field) return null;
  if (field.type === "string") return typeof value === "string" && new RegExp(field.pattern).test(value) ? null : "expected a model identifier";
  if (field.type === "enum") return field.values.includes(value) ? null : `expected one of: ${field.values.join(", ")}`;
  if (field.type === "integer") return Number.isInteger(value) && value >= field.minimum && value <= field.maximum ? null : `expected an integer between ${field.minimum} and ${field.maximum}`;
  return "unsupported field type";
}

/** True when `candidate` is at least as strict as `floor` for a guarded field. */
export function satisfiesFloor(path, candidate, floor) {
  const field = settingsFieldFor(path);
  if (!field?.strictness) return true;
  if (field.strictness === "lower-is-stricter") return candidate <= floor;
  return field.values.indexOf(candidate) <= field.values.indexOf(floor);
}

/** Deterministic Policy Pack template for a project type and risk level (BO-048). */
export function policyPackTemplate({ projectType = "application", riskLevel = "standard" } = {}) {
  if (!PRODUCT_TYPES.includes(projectType)) throw new TypeError(`projectType must be one of: ${PRODUCT_TYPES.join(", ")}.`);
  if (!POLICY_RISK_LEVELS.includes(riskLevel)) throw new TypeError(`riskLevel must be one of: ${POLICY_RISK_LEVELS.join(", ")}.`);
  const values = { ...RISK_BASE[riskLevel] };
  const guards = new Set(RISK_GUARDS[riskLevel]);
  const adjustment = TYPE_ADJUSTMENTS[projectType];
  if (adjustment) {
    for (const [path, value] of Object.entries(adjustment.values)) values[path] = stricter(settingsFieldFor(path), values[path], value);
    for (const path of adjustment.guards) guards.add(path);
  }
  values["project.type"] = projectType;
  values["project.riskLevel"] = riskLevel;
  return Object.freeze({
    templateId: `policy-template:${projectType}:${riskLevel}`,
    projectType,
    riskLevel,
    values: Object.freeze(values),
    guardedPaths: Object.freeze([...guards].sort())
  });
}

export function getProjectSettingsContractSummary() {
  return Object.freeze({
    version: PROJECT_SETTINGS_CONTRACT_VERSION,
    layers: SETTINGS_LAYERS,
    precedence: [...SETTINGS_LAYERS].reverse(),
    nonWeakenable: ["security.projectIsolation", "security.auditRetention", "security.secretReferencesOnly"],
    fields: SETTINGS_FIELD_SCHEMA,
    requiredPolicyPaths: REQUIRED_POLICY_PATHS,
    templates: Object.freeze(PRODUCT_TYPES.flatMap(projectType => POLICY_RISK_LEVELS.map(riskLevel => policyPackTemplate({ projectType, riskLevel })))),
    conflictMode: "fail-closed",
    history: "versioned, actor/reason/impact/diff and rollback reference",
    persistence: "append-only PostgreSQL records with exact version hydration after restart"
  });
}

export function validateProjectSettingsContract() {
  const errors = [];
  if (PROJECT_SETTINGS_CONTRACT_VERSION !== "1.1") errors.push("Unexpected project settings contract version.");
  if (SETTINGS_LAYERS.join(",") !== "hero-invariant,policy-template,project-override,run-override") errors.push("Settings precedence layers are invalid.");
  for (const projectType of PRODUCT_TYPES) {
    for (const riskLevel of POLICY_RISK_LEVELS) {
      const template = policyPackTemplate({ projectType, riskLevel });
      for (const [path, value] of Object.entries(template.values)) {
        const reason = validateSettingValue(path, value);
        if (reason) errors.push(`${template.templateId} ${path}: ${reason}.`);
      }
      for (const path of REQUIRED_POLICY_PATHS) if (!Object.hasOwn(template.values, path)) errors.push(`${template.templateId} misses required ${path}.`);
    }
  }
  return errors;
}
