import {
  PRODUCT_AUTONOMY_MODES,
  PRODUCT_FACTORY_CONTRACT_VERSION,
  PRODUCT_NETWORK_POLICIES,
  PRODUCT_RISK_LEVELS,
  PRODUCT_RUNTIME_DEFAULTS,
  PRODUCT_RUNTIME_EFFECTS,
  PRODUCT_TARGET_KINDS,
  PRODUCT_TYPES,
  validateProductRuntimePlan
} from "../../contracts/src/product-factory.mjs";

const RISK_RANK = Object.freeze({ low: 0, standard: 1, high: 2, critical: 3 });
const RISK_FLAGS = Object.freeze(["internetFacing", "personalData", "regulatedData", "securitySensitive", "externalIntegrations", "requiresPrivilegedAccess"]);
const FLAG_REASONS = Object.freeze({
  internetFacing: "محصول با اینترنت یا کاربر عمومی در تماس است.",
  personalData: "دادهٔ شخصی در دامنهٔ محصول وجود دارد.",
  regulatedData: "داده یا حوزهٔ مقرراتی در دامنهٔ محصول وجود دارد.",
  securitySensitive: "محصول با امنیت، دسترسی یا زیرساخت حساس مرتبط است.",
  externalIntegrations: "محصول به سرویس‌های بیرونی متصل می‌شود.",
  requiresPrivilegedAccess: "نیاز به دسترسی سطح‌بالا باید پیش از اجرا بررسی شود."
});

function copy(value) { return Object.freeze(structuredClone(value)); }
function safeList(value, label, maxItems = 20) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label} must be an array with at most ${maxItems} items.`);
  return value.map(item => {
    if (typeof item !== "string" || item.trim().length === 0 || item.trim().length > 240) throw new Error(`${label} contains an invalid item.`);
    return item.trim();
  });
}
function maxRisk(left, right) { return RISK_RANK[left] >= RISK_RANK[right] ? left : right; }
function requiredText(value, label, max = 500) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new Error(`${label} is invalid.`);
  return text;
}

export function normalizeRiskFlags(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("riskFlags must be an object.");
  const unknown = Object.keys(value).filter(key => !RISK_FLAGS.includes(key));
  if (unknown.length) throw new Error(`Unknown risk flag: ${unknown[0]}.`);
  return Object.freeze(Object.fromEntries(RISK_FLAGS.map(key => [key, value[key] === true])));
}

export function classifyProductRisk({ projectType = "application", requestedLevel = "standard", riskFlags = {} } = {}) {
  if (!PRODUCT_TYPES.includes(projectType)) throw new Error(`projectType must be one of: ${PRODUCT_TYPES.join(", ")}.`);
  if (!PRODUCT_RISK_LEVELS.includes(requestedLevel)) throw new Error(`riskLevel must be one of: ${PRODUCT_RISK_LEVELS.join(", ")}.`);
  const flags = normalizeRiskFlags(riskFlags);
  let level = requestedLevel;
  const reasons = [];
  if (projectType === "security-tool") { level = maxRisk(level, "high"); reasons.push("نوع محصول امنیتی است."); }
  for (const key of RISK_FLAGS) if (flags[key]) { level = maxRisk(level, ["regulatedData", "requiresPrivilegedAccess"].includes(key) ? "high" : "standard"); reasons.push(FLAG_REASONS[key]); }
  if (flags.securitySensitive && flags.internetFacing) { level = maxRisk(level, "critical"); reasons.push("محصول امنیتی و در معرض اینترنت است؛ بررسی مالک پیش از هر اجرای واقعی الزامی است."); }
  if (!reasons.length) reasons.push(level === "low" ? "هیچ سیگنال ریسک اضافه‌ای در Intake ثبت نشده است." : "سطح پایهٔ استاندارد برای محصول انتخاب شده است.");
  return copy({ level, requestedLevel, flags, reasons, requiredApprovals: level === "critical" ? ["foundation-approval", "owner-risk-approval", "execution-authorization"] : level === "high" ? ["foundation-approval", "owner-risk-review", "execution-authorization"] : ["foundation-approval", "execution-authorization"], blockedActions: ["repositoryMutation", "containerStart", "databaseProvision", "secretWrite", "deployment", "externalSpend", "externalMessage"] });
}

export function createProductRuntimePlan({ projectId, riskLevel = "standard", targetKind = "product-test-local-isolated" } = {}) {
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{2,62}$/.test(projectId)) throw new Error("projectId must be a lower-case stable slug.");
  if (!PRODUCT_RISK_LEVELS.includes(riskLevel)) throw new Error("riskLevel is invalid.");
  if (!PRODUCT_TARGET_KINDS.includes(targetKind)) throw new Error("targetKind is invalid.");
  const slug = projectId.slice(0, 50);
  const plan = {
    schemaVersion: PRODUCT_FACTORY_CONTRACT_VERSION,
    projectId,
    riskLevel,
    state: "proposed",
    target: { kind: targetKind, environment: "test", hostBoundary: "hero-test-product-runtime", repositoryMode: PRODUCT_RUNTIME_DEFAULTS.repositoryMode, portability: PRODUCT_RUNTIME_DEFAULTS.portability },
    execution: { mode: PRODUCT_RUNTIME_DEFAULTS.executionMode, network: PRODUCT_RUNTIME_DEFAULTS.network, timeoutSeconds: PRODUCT_RUNTIME_DEFAULTS.timeoutSeconds, maxConcurrentRuns: PRODUCT_RUNTIME_DEFAULTS.maxConcurrentRuns },
    isolation: { composeProject: `hero-product-${slug}`, database: `hero-product-${slug}-db`, volume: `hero-product-${slug}-data`, network: `hero-product-${slug}-network`, ports: [], hostMounts: [] },
    resources: { cpuLimit: PRODUCT_RUNTIME_DEFAULTS.cpuLimit, memoryMiB: PRODUCT_RUNTIME_DEFAULTS.memoryMiB, pidsLimit: PRODUCT_RUNTIME_DEFAULTS.pidsLimit },
    security: { privileged: PRODUCT_RUNTIME_DEFAULTS.privileged, hostNetwork: PRODUCT_RUNTIME_DEFAULTS.hostNetwork, dockerSocket: PRODUCT_RUNTIME_DEFAULTS.dockerSocket, hostMounts: PRODUCT_RUNTIME_DEFAULTS.hostMounts, nonRoot: PRODUCT_RUNTIME_DEFAULTS.nonRoot, readOnlyFilesystem: PRODUCT_RUNTIME_DEFAULTS.readOnlyFilesystem, noNewPrivileges: PRODUCT_RUNTIME_DEFAULTS.noNewPrivileges },
    effects: Object.fromEntries(PRODUCT_RUNTIME_EFFECTS.map(effect => [effect, false])),
    gates: ["foundation-approval", "product-test-authorization", "runtime-preflight", "test-evidence"]
  };
  const errors = validateProductRuntimePlan(plan);
  if (errors.length) throw new Error(`Invalid product runtime plan: ${errors.join(" ")}`);
  return copy(plan);
}

export function normalizeProductIntake({ name, intake = {} } = {}) {
  if (!intake || typeof intake !== "object" || Array.isArray(intake)) throw new Error("intake must be an object.");
  const projectType = intake.projectType ?? "application";
  const requestedLevel = intake.riskLevel ?? "standard";
  const autonomy = intake.autonomy ?? "approval-each-stage";
  if (!PRODUCT_AUTONOMY_MODES.includes(autonomy)) throw new Error("autonomy is invalid.");
  const riskAssessment = classifyProductRisk({ projectType, requestedLevel, riskFlags: intake.riskFlags });
  return copy({
    intent: requiredText(intake.intent ?? name, "intake.intent"),
    goal: requiredText(intake.goal ?? "Define the desired product outcome", "intake.goal"),
    users: requiredText(intake.users ?? "Owner-defined users", "intake.users"),
    constraints: safeList(intake.constraints, "constraints"),
    expectedOutputs: safeList(intake.expectedOutputs, "expectedOutputs"),
    autonomy,
    projectType,
    riskLevel: riskAssessment.level,
    requestedRiskLevel: requestedLevel,
    riskFlags: riskAssessment.flags,
    riskAssessment
  });
}
