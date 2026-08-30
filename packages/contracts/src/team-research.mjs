import { TEAM_CATALOG } from "./team.mjs";

export const TEAM_RESEARCH_CONTRACT_VERSION = "1.0";

export const TEAM_RESEARCH_STATES = Object.freeze([
  "requested",
  "researching",
  "report-ready",
  "rework-requested",
  "rejected",
  "applied"
]);

export const TEAM_RESEARCH_DECISIONS = Object.freeze([
  "approved",
  "rejected",
  "rework-requested"
]);

export const TEAM_RESEARCH_FOCUS_AREAS = Object.freeze([
  "value",
  "quality",
  "speed",
  "cost",
  "risk",
  "maintainability",
  "user-fit",
  "scalability",
  "compliance"
]);

export const TEAM_RESEARCH_OUTPUT_TYPES = Object.freeze([
  "knowledge-pack",
  "principle-proposals",
  "benchmark-scorecard",
  "process-playbook",
  "training-update"
]);

export const TEAM_RESEARCH_REPORT_REQUIREMENTS = Object.freeze({
  minimumSources: 3,
  minimumFindings: 3,
  minimumBenchmarkComparisons: 2,
  minimumRecommendations: 1
});

const BENCHMARK_DIMENSIONS = Object.freeze(["quality", "speed", "cost", "risk", "maintainability", "user-fit"]);

export const TEAM_RESEARCH_BENCHMARKS = Object.freeze(TEAM_CATALOG.map(team => Object.freeze({
  teamId: team.teamId,
  benchmarkQuestion: `برای تیم ${team.name}، بهترین الگوها و رویه‌های قابل اتکا برای «${team.responsibility}» کدام‌اند؟`,
  benchmarkScope: Object.freeze([
    "الگوهای حرفه‌ای و قابل اجرا",
    "مقایسهٔ دست‌کم دو گزینه یا رویکرد",
    "ریسک‌ها، هزینه‌ها و محدودیت‌های هر گزینه",
    "تأثیر بر کیفیت خروجی و همکاری با تیم‌های دیگر"
  ]),
  dimensions: BENCHMARK_DIMENSIONS,
  requiredEvidence: Object.freeze([
    "حداقل سه منبع مستقل و قابل بررسی",
    "حداقل دو مقایسهٔ صریح با معیارهای مشترک",
    "تفکیک واقعیت، تفسیر، فرض و توصیه",
    "پیشنهاد قابل تبدیل به اصل، دانش، فرایند یا آموزش"
  ])
})));

export function getTeamResearchBrief(teamId) {
  return TEAM_RESEARCH_BENCHMARKS.find(item => item.teamId === teamId) ?? null;
}

export function getTeamResearchContractSummary() {
  return Object.freeze({
    version: TEAM_RESEARCH_CONTRACT_VERSION,
    states: TEAM_RESEARCH_STATES,
    decisions: TEAM_RESEARCH_DECISIONS,
    focusAreas: TEAM_RESEARCH_FOCUS_AREAS,
    outputTypes: TEAM_RESEARCH_OUTPUT_TYPES,
    requirements: TEAM_RESEARCH_REPORT_REQUIREMENTS,
    benchmarkCount: TEAM_RESEARCH_BENCHMARKS.length,
    input: "درخواست مالک شامل تیم، پرسش، هدف، حوزه‌های بررسی و خروجی‌های مورد انتظار",
    output: "گزارش شواهد‌محور شامل یافته، benchmark، گزینه‌ها، ریسک، توصیه، دانش و اصول پیشنهادی",
    ownerBoundary: "هیچ دانش یا اصل پیشنهادی پیش از تأیید صریح مالک به تیم اضافه نمی‌شود.",
    providerBoundary: "ثبت درخواست و گزارش، Provider واقعی را خودکار فعال نمی‌کند؛ اجرای بیرونی نیازمند مجوز مستقل است."
  });
}

export function validateTeamResearchContract() {
  const errors = [];
  if (TEAM_RESEARCH_CONTRACT_VERSION !== "1.0") errors.push("Team research contract version is invalid.");
  if (TEAM_RESEARCH_BENCHMARKS.length !== TEAM_CATALOG.length) errors.push("Every team needs one research benchmark.");
  const ids = new Set();
  for (const benchmark of TEAM_RESEARCH_BENCHMARKS) {
    if (ids.has(benchmark.teamId)) errors.push(`Duplicate research benchmark: ${benchmark.teamId}.`);
    ids.add(benchmark.teamId);
    if (!TEAM_CATALOG.some(team => team.teamId === benchmark.teamId)) errors.push(`Unknown research team: ${benchmark.teamId}.`);
    if (benchmark.dimensions.length < 4) errors.push(`Research benchmark is too narrow: ${benchmark.teamId}.`);
    if (benchmark.requiredEvidence.length < 3) errors.push(`Research benchmark evidence is incomplete: ${benchmark.teamId}.`);
  }
  for (const focus of TEAM_RESEARCH_FOCUS_AREAS) {
    if (typeof focus !== "string") errors.push("Research focus area IDs must be strings.");
  }
  return Object.freeze([...new Set(errors)]);
}
