import { getAiOrchestrationContractSummary, validateAiOrchestrationContract } from "./ai-orchestration.mjs";

export const ARCHITECTURE_CONTRACT_VERSION = "1.0";

export const ARCHITECTURE_STYLE = Object.freeze({
  id: "modular-monolith-with-isolated-runners",
  label: "هستهٔ یکپارچهٔ ماژولار با Runnerهای ایزوله",
  rationale: [
    "سرعت توسعه و درک یکپارچه در شروع",
    "مرزهای روشن برای جداشدن ماژول‌ها فقط وقتی شواهد عملی نیاز را نشان دهد",
    "جداسازی اجرای Agent و کد پروژه از Control Plane"
  ]
});

export const ARCHITECTURE_LAYERS = Object.freeze([
  Object.freeze({
    id: "experience",
    responsibility: "رابط سادهٔ فارسی، مرکز تصمیم و تحویل قابل فهم",
    mayDependOn: ["application"]
  }),
  Object.freeze({
    id: "application",
    responsibility: "Use caseهای دریافت درخواست، برنامه‌ریزی، مجوز، اجرا و تحویل",
    mayDependOn: ["domain", "ports"]
  }),
  Object.freeze({
    id: "domain",
    responsibility: "قواعد قطعی، State Machine، سیاست اختیار و Definition of Done",
    mayDependOn: []
  }),
  Object.freeze({
    id: "ports",
    responsibility: "قراردادهای Storage، Agent Provider، Runner، Git و اعلان",
    mayDependOn: ["domain"]
  }),
  Object.freeze({
    id: "adapters",
    responsibility: "پیاده‌سازی قابل‌تعویض Portها بدون نشت Secret یا وابستگی میزبان",
    mayDependOn: ["ports"]
  }),
  Object.freeze({
    id: "execution",
    responsibility: "اجرای ایزوله در worktree/container، ثبت شواهد و توقف امن",
    mayDependOn: ["ports", "domain"]
  })
]);

export const ARCHITECTURE_RUNTIME = Object.freeze({
  controlPlane: Object.freeze({
    current: "Node.js 22 + ESM HTTP service",
    target: "TypeScript control plane with HTTP JSON API",
    deployment: "Linux container"
  }),
  console: Object.freeze({
    target: "React + Next.js + TypeScript",
    purpose: "رابط سادهٔ فارسی برای درخواست، تصمیم، وضعیت و تحویل"
  }),
  persistence: Object.freeze({
    target: "PostgreSQL",
    purpose: "وضعیت عملیاتی، Event Log append-only، Snapshotهای مجوز و Outbox",
    implementationStatus: "contract-defined-in-HERO-005"
  }),
  queue: Object.freeze({
    target: "PostgreSQL-backed durable dispatch and outbox",
    rule: "تا زمان نیاز اثبات‌شده، هیچ صف یا سرویس مستقل دیگری اضافه نمی‌شود."
  }),
  applicationFactories: Object.freeze({
    web: "TypeScript + Next.js/React",
    mobile: "TypeScript + Expo/React Native"
  })
});

export const PROVIDER_ARCHITECTURE = Object.freeze([
  Object.freeze({
    id: "codex-chatgpt",
    role: "تحلیل اصلی، برنامه‌ریزی، پیاده‌سازی و اصلاح",
    integration: "adapter + isolated runner",
    connectionStatus: "not-connected"
  }),
  Object.freeze({
    id: "claude",
    role: "بازبینی مستقل معماری، کیفیت، امنیت و edge case",
    integration: "adapter + isolated runner",
    connectionStatus: "not-connected"
  }),
  Object.freeze({
    id: "cursor",
    role: "بستهٔ تحویل IDE و Human-in-the-loop؛ نه نویسندهٔ هم‌زمان همان worktree",
    integration: "handoff adapter",
    connectionStatus: "not-connected"
  })
]);

export const AI_ORCHESTRATION_ARCHITECTURE = Object.freeze({
  boundary: "internal-domain-subsystem",
  contractVersion: "1.0",
  roles: getAiOrchestrationContractSummary().roles,
  providerGateway: "adapter-boundary",
  defaultExecutionProfile: Object.freeze({ provider: "openai", model: "codex", status: "policy-default-only" }),
  liveConnectionStatus: "not-connected",
  evaluationBoundary: "evidence-not-authorization",
  teamBoundary: "AI roles are capabilities; Hero teams remain governed operating units"
});

export const ARCHITECTURE_FLOW = Object.freeze([
  "درخواست فارسی",
  "فهم و سؤال‌های ضروری",
  "Task Graph و معیار پذیرش",
  "بررسی مجوز نسخه‌دار",
  "Dispatch به Runner ایزوله",
  "توسعه، تست و ثبت Evidence",
  "بازبینی مستقل",
  "تحویل قابل فهم"
]);

export const ARCHITECTURE_GUARDRAILS = Object.freeze([
  "Control Plane هرگز Secret را در Event Log یا خروجی کاربر ثبت نمی‌کند.",
  "هر Run فقط یک worktree و یک مسیر خروجی پروژه‌ای دارد.",
  "Adapterها فقط از Portهای قراردادشده قابل فراخوانی‌اند.",
  "اجرای Provider، Git write و commandهای پروژه در Runner انجام می‌شود؛ نه در Console.",
  "عملیات حساس پیش از Dispatch، جدا از اختیار کامل، نیازمند مجوز مستقل‌اند.",
  "در نبود Storage یا Provider معتبر، سیستم fail-closed متوقف می‌شود."
]);

export function getPublicArchitectureSummary() {
  return {
    version: ARCHITECTURE_CONTRACT_VERSION,
    style: ARCHITECTURE_STYLE.id,
    layers: ARCHITECTURE_LAYERS.map(layer => layer.id),
    providers: PROVIDER_ARCHITECTURE.map(provider => ({
      id: provider.id,
      role: provider.role,
      connectionStatus: provider.connectionStatus
    })),
    executionBoundary: "isolated-runner",
    dataStore: ARCHITECTURE_RUNTIME.persistence.target,
    aiOrchestration: {
      boundary: AI_ORCHESTRATION_ARCHITECTURE.boundary,
      contractVersion: AI_ORCHESTRATION_ARCHITECTURE.contractVersion,
      roles: AI_ORCHESTRATION_ARCHITECTURE.roles,
      providerGateway: AI_ORCHESTRATION_ARCHITECTURE.providerGateway,
      defaultExecutionProfile: AI_ORCHESTRATION_ARCHITECTURE.defaultExecutionProfile,
      liveConnectionStatus: AI_ORCHESTRATION_ARCHITECTURE.liveConnectionStatus,
      evaluationBoundary: AI_ORCHESTRATION_ARCHITECTURE.evaluationBoundary
    }
  };
}

export function validateArchitectureContract() {
  const errors = [];
  const expectedLayers = ["experience", "application", "domain", "ports", "adapters", "execution"];
  const actualLayers = ARCHITECTURE_LAYERS.map(layer => layer.id);
  const providerIds = PROVIDER_ARCHITECTURE.map(provider => provider.id);

  if (ARCHITECTURE_CONTRACT_VERSION !== "1.0") errors.push("Unexpected architecture contract version.");
  if (ARCHITECTURE_STYLE.id !== "modular-monolith-with-isolated-runners") {
    errors.push("Architecture style must keep the modular-monolith boundary.");
  }
  if (JSON.stringify(actualLayers) !== JSON.stringify(expectedLayers)) {
    errors.push("Architecture layers are out of order or incomplete.");
  }
  if (JSON.stringify(providerIds) !== JSON.stringify(["codex-chatgpt", "claude", "cursor"])) {
    errors.push("Initial provider set changed unexpectedly.");
  }
  if (PROVIDER_ARCHITECTURE.some(provider => provider.connectionStatus !== "not-connected")) {
    errors.push("Architecture design must not imply a live provider connection.");
  }
  if (ARCHITECTURE_RUNTIME.persistence.implementationStatus !== "contract-defined-in-HERO-005") {
    errors.push("Persistence contract boundary must remain assigned to HERO-005.");
  }
  if (!ARCHITECTURE_GUARDRAILS.some(rule => rule.includes("fail-closed"))) {
    errors.push("Architecture must fail closed when a required dependency is unavailable.");
  }
  for (const detail of validateAiOrchestrationContract()) errors.push(`AI orchestration: ${detail}`);
  if (AI_ORCHESTRATION_ARCHITECTURE.liveConnectionStatus !== "not-connected") {
    errors.push("AI orchestration must not imply a live provider connection in the current stage.");
  }

  return errors;
}
