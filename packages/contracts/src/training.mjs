import { TEAM_CATALOG, TEAM_TRAINING_MODULES } from "./team.mjs";

export const TEAM_TRAINING_CONTRACT_VERSION = "1.0";
export const TRAINING_PASS_SCORE = 80;

export const TRAINING_MODULE_DEFINITIONS = Object.freeze([
  Object.freeze({
    module: "mission",
    title: "ماموریت و مرز مسئولیت",
    objective: "تیم باید بداند برای چه مسئله‌ای پاسخ‌گوست و چه کاری خارج از اختیار آن است.",
    requiredEvidence: "hero://training/{teamId}/mission"
  }),
  Object.freeze({
    module: "safety",
    title: "ایمنی و توقف امن",
    objective: "تیم باید ریسک، اطلاعات حساس، توقف و ارجاع به مالک را درست تشخیص دهد.",
    requiredEvidence: "hero://training/{teamId}/safety"
  }),
  Object.freeze({
    module: "output-contract",
    title: "قرارداد ورودی و خروجی",
    objective: "تیم باید خروجی قابل‌بررسی، نسخه‌دار و متصل به ورودی تحویل دهد.",
    requiredEvidence: "hero://training/{teamId}/output-contract"
  }),
  Object.freeze({
    module: "collaboration",
    title: "همکاری و handoff",
    objective: "تیم باید مرز همکاری، وابستگی و انتقال کار به تیم بعدی را روشن نگه دارد.",
    requiredEvidence: "hero://training/{teamId}/collaboration"
  }),
  Object.freeze({
    module: "quality",
    title: "کیفیت و بازبینی",
    objective: "تیم باید خروجی را با معیار پذیرش، شواهد و مسیر بازکاری ارائه کند.",
    requiredEvidence: "hero://training/{teamId}/quality"
  })
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const TEAM_TRAINING_BENCHMARKS = deepFreeze(
  TEAM_CATALOG.map(team => ({
    teamId: team.teamId,
    title: `آزمون عملی ${team.name}`,
    input: team.inputs[0],
    expectedOutput: team.outputs[0],
    qualitySignals: team.principles.slice(0, 3),
    acceptance: [
      "ورودی و فرض‌ها از هم جدا باشند.",
      "خروجی با قرارداد تیم منطبق و نسخه‌دار باشد.",
      "ریسک‌ها، شواهد و مسیر بازکاری مشخص باشند."
    ]
  }))
);

export const TRAINING_PROGRAM_STATUSES = Object.freeze(["not-started", "in-progress", "ready"]);

export function getTeamTrainingPlan(teamId) {
  const benchmark = TEAM_TRAINING_BENCHMARKS.find(item => item.teamId === teamId);
  if (!benchmark) return null;
  return deepFreeze({
    version: TEAM_TRAINING_CONTRACT_VERSION,
    teamId,
    passScore: TRAINING_PASS_SCORE,
    modules: TRAINING_MODULE_DEFINITIONS,
    benchmark
  });
}

export function getTrainingContractSummary() {
  return deepFreeze({
    version: TEAM_TRAINING_CONTRACT_VERSION,
    passScore: TRAINING_PASS_SCORE,
    modules: TRAINING_MODULE_DEFINITIONS,
    benchmarkCount: TEAM_TRAINING_BENCHMARKS.length,
    programStatuses: TRAINING_PROGRAM_STATUSES,
    input: "قرارداد تیم، سناریوی benchmark و شواهد آزمون",
    output: "امتیاز هر module، شواهد قابل‌بازبینی، نتیجهٔ آمادگی و برنامهٔ بهبود",
    safetyBoundary: "آموزش deterministic است؛ قبولی بدون شواهد، تأیید مالک یا آزمون کامل ready نمی‌شود."
  });
}

export function validateTrainingContract() {
  const errors = [];
  if (TEAM_TRAINING_CONTRACT_VERSION !== "1.0") errors.push("Training contract version is invalid.");
  if (TEAM_TRAINING_MODULES.length !== TRAINING_MODULE_DEFINITIONS.length) errors.push("Training module catalog is incomplete.");
  if (TRAINING_MODULE_DEFINITIONS.some(item => !TEAM_TRAINING_MODULES.includes(item.module))) errors.push("Training module definition is not in the team contract.");
  if (TEAM_TRAINING_BENCHMARKS.length !== TEAM_CATALOG.length) errors.push("Every catalog team needs one training benchmark.");
  if (new Set(TEAM_TRAINING_BENCHMARKS.map(item => item.teamId)).size !== TEAM_TRAINING_BENCHMARKS.length) errors.push("Training benchmark team IDs must be unique.");
  if (!Number.isInteger(TRAINING_PASS_SCORE) || TRAINING_PASS_SCORE < 1 || TRAINING_PASS_SCORE > 100) errors.push("Training pass score is invalid.");
  return Object.freeze(errors);
}
