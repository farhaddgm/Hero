import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PRIORS, RunEstimateError, estimateRun } from "../packages/domain/src/run-estimate.mjs";

const now = () => "2026-10-09T10:00:00.000Z";
const catalog = {
  catalogVersion: "catalog-test-001",
  sourceUrl: "https://example.com/pricing",
  fetchedAt: "2026-10-01T00:00:00.000Z",
  validUntil: "2026-12-01T00:00:00.000Z",
  entries: [
    { providerId: "openai", modelId: "model-impl", pricingMode: "tokens", inputPricePer1mTokens: 2, outputPricePer1mTokens: 8, currency: "USD" },
    { providerId: "anthropic", modelId: "model-review", pricingMode: "tokens", inputPricePer1mTokens: 3, outputPricePer1mTokens: 15, currency: "USD" }
  ]
};
const assignments = { analyst: { providerId: "openai", modelId: "model-impl" }, implementer: { providerId: "openai", modelId: "model-impl" }, tester: { providerId: "openai", modelId: "model-impl" }, reviewer: { providerId: "anthropic", modelId: "model-review" } };
const tasks = [
  { taskId: "a", role: "analyst", dependsOn: [] },
  { taskId: "b", role: "implementer", dependsOn: ["a"] },
  { taskId: "c", role: "tester", dependsOn: ["b"] },
  { taskId: "d", role: "reviewer", dependsOn: ["b", "c"] }
];

test("scenarios are ordered low <= expected <= high and the arithmetic matches the declared priors", () => {
  const estimate = estimateRun({ tasks, assignments, catalog, now });
  const { low, expected, high } = estimate.scenarios;
  assert.ok(low.costUnits <= expected.costUnits && expected.costUnits < high.costUnits);
  assert.ok(low.minutes <= expected.minutes && expected.minutes < high.minutes);
  // Hand-computed expected scenario for the analyst task alone: (12000*2 + 3000*8)/1e6 USD * 10000 units.
  const single = estimateRun({ tasks: [{ taskId: "a", role: "analyst" }], assignments, catalog, now });
  const usd = (DEFAULT_PRIORS.analyst.inputTokens * 2 + DEFAULT_PRIORS.analyst.outputTokens * 8) / 1_000_000;
  assert.equal(single.scenarios.expected.costUnits, Math.ceil(usd * 10_000));
  assert.equal(estimate.complete, true);
  assert.equal(estimate.basis, "prior");
  assert.match(estimate.summaryFa, /فقط پیش‌بینی است/);
  assert.ok(estimate.warnings.some(item => /فرض/.test(item)));
});

test("duration follows the critical path, not the sum of all tasks", () => {
  const parallel = estimateRun({ tasks: [{ taskId: "a", role: "analyst" }, { taskId: "b", role: "analyst" }, { taskId: "c", role: "analyst" }], assignments, catalog, now });
  const serial = estimateRun({ tasks: [{ taskId: "a", role: "analyst" }, { taskId: "b", role: "analyst", dependsOn: ["a"] }, { taskId: "c", role: "analyst", dependsOn: ["b"] }], assignments, catalog, now });
  assert.equal(serial.scenarios.expected.minutes, parallel.scenarios.expected.minutes * 3);
  assert.equal(serial.scenarios.expected.costUnits, parallel.scenarios.expected.costUnits);
});

test("an unpriced role makes the estimate incomplete instead of guessing", () => {
  const estimate = estimateRun({ tasks, assignments: { ...assignments, reviewer: { providerId: "google", modelId: "unknown-model" } }, catalog, budgetCostUnits: 1_000_000, now });
  assert.equal(estimate.complete, false);
  assert.deepEqual(estimate.unpricedRoles, ["reviewer"]);
  assert.equal(estimate.budget.status, "unknown");
  assert.equal(estimate.budget.withinBudget, null);
  assert.match(estimate.summaryFa, /کامل نیست/);
});

test("budget status distinguishes within-budget, at-risk and exceeds-budget", () => {
  const base = estimateRun({ tasks, assignments, catalog, now });
  assert.equal(estimateRun({ tasks, assignments, catalog, now, budgetCostUnits: base.scenarios.high.costUnits }).budget.status, "within-budget");
  assert.equal(estimateRun({ tasks, assignments, catalog, now, budgetCostUnits: base.scenarios.expected.costUnits }).budget.status, "at-risk");
  assert.equal(estimateRun({ tasks, assignments, catalog, now, budgetCostUnits: base.scenarios.expected.costUnits - 1 }).budget.status, "exceeds-budget");
  assert.equal(estimateRun({ tasks, assignments, catalog, now, budgetCostUnits: 0 }).budget.withinBudget, false);
});

test("measured history replaces priors once there are enough samples", () => {
  const history = Array.from({ length: 3 }, () => ({ role: "analyst", inputTokens: 1_000, outputTokens: 500, minutes: 2 }));
  const estimate = estimateRun({ tasks: [{ taskId: "a", role: "analyst" }], assignments, catalog, history, now });
  assert.equal(estimate.basis, "history");
  const prior = estimateRun({ tasks: [{ taskId: "a", role: "analyst" }], assignments, catalog, now });
  assert.ok(estimate.scenarios.expected.costUnits < prior.scenarios.expected.costUnits);
  assert.equal(estimateRun({ tasks: [{ taskId: "a", role: "analyst" }], assignments, catalog, history: history.slice(0, 2), now }).basis, "prior");
  assert.ok(!estimate.warnings.some(item => /فرض/.test(item)));
});

test("expired prices are flagged and invalid input is rejected", () => {
  const warnings = estimateRun({ tasks, assignments, catalog, now: () => "2027-01-01T00:00:00.000Z" }).warnings;
  assert.ok(warnings.some(item => /منقضی/.test(item)));
  assert.throws(() => estimateRun({ tasks: [], assignments, catalog, now }), RunEstimateError);
  assert.throws(() => estimateRun({ tasks: [{ taskId: "a", role: "wizard" }], assignments, catalog, now }), /unsupported role/);
  assert.throws(() => estimateRun({ tasks: [{ taskId: "a", role: "analyst", dependsOn: ["z"] }], assignments, catalog, now }), /unknown task/);
  assert.throws(() => estimateRun({ tasks: [{ taskId: "a", role: "analyst", dependsOn: ["b"] }, { taskId: "b", role: "analyst", dependsOn: ["a"] }], assignments, catalog, now }), error => error.code === "CYCLE");
  assert.throws(() => estimateRun({ tasks, assignments, catalog, budgetCostUnits: -1, now }), error => error.code === "INVALID_BUDGET");
  assert.throws(() => estimateRun({ tasks, assignments, catalog: { entries: [] }, now }), /catalogVersion|required/);
});
