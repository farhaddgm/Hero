import { normalizePricingCatalog } from "../../contracts/src/pricing-catalog.mjs";
import { toPersianDigits } from "./delivery-truth.mjs";

/**
 * Estimate-before-run: cost (Hero cost units), duration and risk for a task graph, computed
 * before any dispatch. Pure function. It is a forecast, not a budget: the real cap is enforced
 * by the cost ledger. When no measured history exists the numbers rest on declared priors and
 * the result says so; unpriced models make the estimate incomplete instead of being guessed.
 */

const ROLES = ["analyst", "designer", "implementer", "tester", "reviewer", "planner", "writer"];

/** Declared assumptions, not measurements. Tokens per task and minutes per task by role. */
export const DEFAULT_PRIORS = Object.freeze({
  analyst: Object.freeze({ inputTokens: 12_000, outputTokens: 3_000, minutes: 6 }),
  designer: Object.freeze({ inputTokens: 14_000, outputTokens: 5_000, minutes: 8 }),
  implementer: Object.freeze({ inputTokens: 30_000, outputTokens: 9_000, minutes: 15 }),
  tester: Object.freeze({ inputTokens: 20_000, outputTokens: 5_000, minutes: 10 }),
  reviewer: Object.freeze({ inputTokens: 25_000, outputTokens: 3_000, minutes: 8 }),
  planner: Object.freeze({ inputTokens: 8_000, outputTokens: 3_000, minutes: 4 }),
  writer: Object.freeze({ inputTokens: 10_000, outputTokens: 4_000, minutes: 5 })
});

const REWORK_ROLES = new Set(["implementer", "tester"]);
const SCENARIOS = Object.freeze({ low: { tokens: 0.7, rework: 0 }, expected: { tokens: 1, rework: 0.5 }, high: { tokens: 1.6, rework: 2 } });

export class RunEstimateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RunEstimateError";
    this.code = code;
  }
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function priorsFor(role, history) {
  const rows = history.filter(item => item.role === role);
  if (rows.length >= 3) {
    return { inputTokens: mean(rows.map(row => row.inputTokens)), outputTokens: mean(rows.map(row => row.outputTokens)), minutes: mean(rows.map(row => row.minutes ?? DEFAULT_PRIORS[role].minutes)), basis: "history", samples: rows.length };
  }
  return { ...DEFAULT_PRIORS[role], basis: "prior", samples: rows.length };
}

function criticalPathMinutes(tasks, minutesOf) {
  const byId = new Map(tasks.map(task => [task.taskId, task]));
  const memo = new Map();
  const visiting = new Set();
  const finish = id => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) throw new RunEstimateError("CYCLE", "The task graph has a cycle.");
    visiting.add(id);
    const task = byId.get(id);
    const start = Math.max(0, ...(task.dependsOn ?? []).map(finish));
    visiting.delete(id);
    const end = start + minutesOf(task);
    memo.set(id, end);
    return end;
  };
  return Math.max(0, ...tasks.map(task => finish(task.taskId)));
}

export function estimateRun({ tasks, assignments, catalog, history = [], budgetCostUnits = null, now = () => new Date().toISOString() } = {}) {
  if (!Array.isArray(tasks) || tasks.length === 0 || tasks.length > 200) throw new RunEstimateError("INVALID_TASKS", "tasks must contain 1-200 items.");
  const ids = new Set();
  for (const task of tasks) {
    if (typeof task?.taskId !== "string" || ids.has(task.taskId)) throw new RunEstimateError("INVALID_TASKS", "Each task needs a unique taskId.");
    if (!ROLES.includes(task.role)) throw new RunEstimateError("INVALID_TASKS", `Task ${task.taskId} has an unsupported role.`);
    ids.add(task.taskId);
  }
  for (const task of tasks) if ((task.dependsOn ?? []).some(dep => !ids.has(dep))) throw new RunEstimateError("INVALID_TASKS", `Task ${task.taskId} depends on an unknown task.`);
  if (!assignments || typeof assignments !== "object") throw new RunEstimateError("INVALID_ASSIGNMENTS", "assignments are required (role → provider/model).");
  const normalizedCatalog = normalizePricingCatalog(catalog);
  if (budgetCostUnits !== null && (!Number.isSafeInteger(budgetCostUnits) || budgetCostUnits < 0)) throw new RunEstimateError("INVALID_BUDGET", "budgetCostUnits must be a non-negative integer or null.");

  const warnings = [];
  const unpriced = new Set();
  const nowMs = Date.parse(now());
  const priceOf = role => {
    const assignment = assignments[role];
    const entry = assignment && normalizedCatalog.entries.find(item => item.providerId === assignment.providerId && item.modelId === assignment.modelId);
    if (!entry || entry.pricingMode !== "tokens") { unpriced.add(role); return null; }
    if (Date.parse(entry.validUntil) < nowMs) warnings.push(`قیمت ${assignment.providerId}/${assignment.modelId} منقضی شده است.`);
    return { entry, perInputToken: entry.inputPricePer1mTokens / 1_000_000, perOutputToken: entry.outputPricePer1mTokens / 1_000_000 };
  };
  const prices = new Map([...new Set(tasks.map(task => task.role))].map(role => [role, priceOf(role)]));
  const priors = new Map([...prices.keys()].map(role => [role, priorsFor(role, history)]));

  const scenarios = {};
  for (const [name, factors] of Object.entries(SCENARIOS)) {
    let costUnits = 0;
    for (const task of tasks) {
      const price = prices.get(task.role);
      if (!price) continue;
      const prior = priors.get(task.role);
      const rounds = 1 + (REWORK_ROLES.has(task.role) ? factors.rework : 0);
      const currency = (prior.inputTokens * price.perInputToken + prior.outputTokens * price.perOutputToken) * factors.tokens * rounds;
      costUnits += currency * price.entry.heroUnitsPerCurrencyUnit;
    }
    const reworkFactor = 1 + factors.rework * (tasks.some(task => REWORK_ROLES.has(task.role)) ? 0.6 : 0);
    const minutes = criticalPathMinutes(tasks, task => priors.get(task.role).minutes * factors.tokens * (REWORK_ROLES.has(task.role) ? 1 + factors.rework * 0.6 : 1));
    scenarios[name] = Object.freeze({ costUnits: Math.ceil(costUnits), minutes: Math.ceil(minutes), reworkRounds: factors.rework, reworkFactor: Number(reworkFactor.toFixed(2)) });
  }

  const bases = [...priors.values()].map(prior => prior.basis);
  const basis = bases.every(item => item === "history") ? "history" : bases.some(item => item === "history") ? "mixed" : "prior";
  const complete = unpriced.size === 0;
  if (!complete) warnings.push(`برای نقش‌های ${[...unpriced].join("، ")} قیمت مدل در کاتالوگ نیست؛ برآورد ناقص است و حدس زده نشده است.`);
  if (basis !== "history") warnings.push("این برآورد بر پایهٔ فرض‌های پیش‌فرض است، نه اندازه‌گیری واقعی؛ پس از چند اجرای ثبت‌شده دقیق‌تر می‌شود.");
  const withinBudget = budgetCostUnits === null || !complete ? null : scenarios.high.costUnits <= budgetCostUnits;
  const budgetStatus = budgetCostUnits === null || !complete ? "unknown" : scenarios.high.costUnits <= budgetCostUnits ? "within-budget" : scenarios.expected.costUnits <= budgetCostUnits ? "at-risk" : "exceeds-budget";

  const summaryFa = complete
    ? `هزینهٔ محتمل حدود ${toPersianDigits(scenarios.expected.costUnits)} واحد (از ${toPersianDigits(scenarios.low.costUnits)} تا ${toPersianDigits(scenarios.high.costUnits)}) و زمان محتمل حدود ${toPersianDigits(scenarios.expected.minutes)} دقیقه است. ${budgetStatus === "exceeds-budget" ? "حتی حالت محتمل از سقف بودجه بیشتر است." : budgetStatus === "at-risk" ? "در بدترین حالت از سقف بودجه عبور می‌کند." : budgetStatus === "within-budget" ? "در همهٔ حالت‌ها در سقف بودجه می‌ماند." : "سقف بودجه ثبت نشده است."} این فقط پیش‌بینی است و سقف واقعی را دفتر هزینه اعمال می‌کند.`
    : "برآورد کامل نیست چون قیمت بعضی مدل‌ها در کاتالوگ وجود ندارد.";

  return Object.freeze({
    schema: "hero.run-estimate/v1",
    generatedAt: now(),
    complete,
    basis,
    taskCount: tasks.length,
    catalogVersion: normalizedCatalog.catalogVersion,
    scenarios: Object.freeze(scenarios),
    budget: Object.freeze({ budgetCostUnits, status: budgetStatus, withinBudget }),
    unpricedRoles: Object.freeze([...unpriced]),
    warnings: Object.freeze(warnings),
    summaryFa,
    boundary: "forecast-only: never an authorization, never a cap"
  });
}
