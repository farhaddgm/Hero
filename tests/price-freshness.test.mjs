import assert from "node:assert/strict";
import test from "node:test";

import { createGoldenPath } from "../packages/domain/src/golden-path.mjs";
import { DEFAULT_EXPIRY_WARNING_DAYS, PRICE_FRESHNESS_UNKNOWN, PRICE_STALE, assessPriceFreshness, assessPriceReliance, diffPricingCatalogs } from "../packages/domain/src/price-freshness.mjs";
import { estimateRun } from "../packages/domain/src/run-estimate.mjs";

const now = "2026-10-09T10:00:00.000Z";
const day = 86_400_000;
const at = offsetDays => new Date(Date.parse(now) + offsetDays * day).toISOString();

const catalogOf = (overrides = {}, entries) => ({
  catalogVersion: "catalog-freshness-001",
  sourceUrl: "https://example.com/pricing",
  fetchedAt: "2026-10-01T00:00:00.000Z",
  validUntil: "2026-12-01T00:00:00.000Z",
  entries: entries ?? [
    { providerId: "openai", modelId: "model-impl", pricingMode: "tokens", inputPricePer1mTokens: 2, outputPricePer1mTokens: 8, currency: "USD" },
    { providerId: "anthropic", modelId: "model-review", pricingMode: "tokens", inputPricePer1mTokens: 3, outputPricePer1mTokens: 15, currency: "USD" }
  ],
  ...overrides
});
const assignments = { analyst: { providerId: "openai", modelId: "model-impl" }, reviewer: { providerId: "anthropic", modelId: "model-review" } };
const tasks = [{ taskId: "a", role: "analyst" }, { taskId: "r", role: "reviewer", dependsOn: ["a"] }];

test("a price is fresh, expiring or stale and the boundary instant is already stale", () => {
  assert.equal(assessPriceFreshness({ validUntil: at(30), now }).status, "fresh");
  const expiring = assessPriceFreshness({ providerId: "openai", modelId: "m", validUntil: at(3), now });
  assert.equal(expiring.status, "expiring");
  assert.equal(expiring.daysRemaining, 3);
  assert.equal(expiring.reliable, true);
  assert.match(expiring.messageFa, /۳ روز تا انقضا/);
  assert.equal(assessPriceFreshness({ validUntil: at(DEFAULT_EXPIRY_WARNING_DAYS), now }).status, "expiring");
  assert.equal(assessPriceFreshness({ validUntil: at(DEFAULT_EXPIRY_WARNING_DAYS + 1), now }).status, "fresh");
  const equal = assessPriceFreshness({ validUntil: now, now });
  assert.equal(equal.status, "stale");
  assert.equal(equal.code, PRICE_STALE);
  assert.equal(equal.reliable, false);
  assert.equal(assessPriceFreshness({ validUntil: at(-2), now }).daysRemaining, -2);
});

test("a missing, malformed or non-string validity is stale and an unreadable clock is never healthy", () => {
  for (const validUntil of [undefined, null, "", "not-a-date", 42, {}]) {
    const result = assessPriceFreshness({ validUntil, now });
    assert.equal(result.status === "fresh" || result.status === "expiring", false, `validUntil=${JSON.stringify(validUntil)}`);
    assert.equal(result.reliable, false);
  }
  const noClock = assessPriceFreshness({ validUntil: at(30), now: "garbage" });
  assert.equal(noClock.reliable, false);
  assert.equal(noClock.code, PRICE_FRESHNESS_UNKNOWN);
  assert.throws(() => assessPriceFreshness({ validUntil: at(30), now, warnDays: -1 }), RangeError);
  assert.throws(() => assessPriceFreshness({ validUntil: at(30), now, warnDays: 1.5 }), RangeError);
});

test("price reliance names every stale model once and sorts deterministically", () => {
  const entries = [
    { providerId: "b", modelId: "m", validUntil: at(-1) },
    { providerId: "a", modelId: "m", validUntil: at(2) },
    { providerId: "b", modelId: "m", validUntil: at(-1) },
    { providerId: "c", modelId: "m", validUntil: at(60) }
  ];
  const reliance = assessPriceReliance({ entries, now });
  assert.equal(reliance.reliable, false);
  assert.equal(reliance.code, PRICE_STALE);
  assert.deepEqual(reliance.stalePrices.map(item => `${item.providerId}/${item.modelId}`), ["b/m"]);
  assert.deepEqual(reliance.expiringSoon.map(item => `${item.providerId}/${item.modelId}`), ["a/m"]);
  assert.equal(reliance.notices.length, 2);
  assert.deepEqual(assessPriceReliance({ entries: [...entries].reverse(), now }), reliance);
  assert.equal(assessPriceReliance({ entries: [], now }).reliable, true);
});

test("an estimate on an expired price refuses the budget comparison with PRICE_STALE but keeps the old warning", () => {
  const late = () => "2026-12-02T00:00:00.000Z";
  const estimate = estimateRun({ tasks, assignments, catalog: catalogOf(), budgetCostUnits: 1_000_000, now: late });
  assert.equal(estimate.budget.status, "price-stale");
  assert.equal(estimate.budget.withinBudget, null);
  assert.equal(estimate.budget.code, PRICE_STALE);
  assert.equal(estimate.priceReliance.reliable, false);
  assert.ok(estimate.warnings.some(item => /منقضی/.test(item)), "the display warning is preserved");
  assert.match(estimate.summaryFa, /مقایسه با سقف بودجه انجام نشد/);
  assert.ok(estimate.scenarios.high.costUnits > 0, "the forecast numbers are still shown");
});

test("a fresh estimate is compared as before and an expiring price only adds a notice", () => {
  const fresh = estimateRun({ tasks, assignments, catalog: catalogOf(), budgetCostUnits: 1_000_000, now: () => now });
  assert.equal(fresh.budget.status, "within-budget");
  assert.equal(fresh.budget.code, null);
  assert.equal(fresh.priceReliance.reliable, true);
  const soon = estimateRun({ tasks, assignments, catalog: catalogOf({ validUntil: at(2) }), budgetCostUnits: 1_000_000, now: () => now });
  assert.equal(soon.budget.status, "within-budget");
  assert.ok(soon.warnings.some(item => /۲ روز تا انقضا/.test(item)));
});

test("without a budget a stale price does not invent a comparison and still reports unreliability", () => {
  const estimate = estimateRun({ tasks, assignments, catalog: catalogOf(), now: () => "2026-12-02T00:00:00.000Z" });
  assert.equal(estimate.budget.status, "unknown");
  assert.equal(estimate.priceReliance.reliable, false);
});

test("the catalog diff is deterministic and classifies every kind of change", () => {
  const before = catalogOf({}, [
    { providerId: "openai", modelId: "model-up", pricingMode: "tokens", inputPricePer1mTokens: 2, outputPricePer1mTokens: 8, currency: "USD" },
    { providerId: "openai", modelId: "model-down", pricingMode: "tokens", inputPricePer1mTokens: 4, outputPricePer1mTokens: 16, currency: "USD" },
    { providerId: "openai", modelId: "model-same", pricingMode: "tokens", inputPricePer1mTokens: 1, outputPricePer1mTokens: 2, currency: "USD" },
    { providerId: "openai", modelId: "model-gone", pricingMode: "tokens", inputPricePer1mTokens: 1, outputPricePer1mTokens: 2, currency: "USD" },
    { providerId: "openai", modelId: "model-mixed", pricingMode: "tokens", inputPricePer1mTokens: 1, outputPricePer1mTokens: 2, currency: "USD" },
    { providerId: "openai", modelId: "model-money", pricingMode: "tokens", inputPricePer1mTokens: 1, outputPricePer1mTokens: 2, currency: "USD" }
  ]);
  const after = catalogOf({ catalogVersion: "catalog-freshness-002" }, [
    { providerId: "openai", modelId: "model-up", pricingMode: "tokens", inputPricePer1mTokens: 3, outputPricePer1mTokens: 8, currency: "USD" },
    { providerId: "openai", modelId: "model-down", pricingMode: "tokens", inputPricePer1mTokens: 2, outputPricePer1mTokens: 16, currency: "USD" },
    { providerId: "openai", modelId: "model-same", pricingMode: "tokens", inputPricePer1mTokens: 1, outputPricePer1mTokens: 2, currency: "USD" },
    { providerId: "openai", modelId: "model-mixed", pricingMode: "tokens", inputPricePer1mTokens: 2, outputPricePer1mTokens: 1, currency: "USD" },
    { providerId: "openai", modelId: "model-money", pricingMode: "tokens", inputPricePer1mTokens: 1, outputPricePer1mTokens: 2, currency: "EUR", heroUnitsPerCurrencyUnit: 10000 },
    { providerId: "google", modelId: "model-new", pricingMode: "tokens", inputPricePer1mTokens: 1, outputPricePer1mTokens: 1, currency: "USD" }
  ]);
  const diff = diffPricingCatalogs(before, after);
  assert.deepEqual({ ...diff.counts }, { added: 1, removed: 1, increased: 1, decreased: 1, mixed: 1, incomparable: 1, unchanged: 1 });
  const byModel = Object.fromEntries(diff.changes.map(item => [item.modelId, item]));
  assert.equal(byModel["model-up"].fields.inputPricePer1mTokens.percent, 50);
  assert.equal(byModel["model-down"].fields.inputPricePer1mTokens.percent, -50);
  assert.equal(byModel["model-money"].change, "incomparable");
  assert.equal(byModel["model-new"].change, "added");
  assert.equal(byModel["model-gone"].change, "removed");
  assert.deepEqual(diff.changes.map(item => `${item.providerId}/${item.modelId}`), [...diff.changes.map(item => `${item.providerId}/${item.modelId}`)].sort());
  const again = diffPricingCatalogs(before, after);
  assert.equal(again.digest, diff.digest);
  assert.match(diff.digest, /^[0-9a-f]{64}$/);
  assert.equal(diffPricingCatalogs(before, before).changes.length, 0);
  assert.match(diff.boundary, /never fetches/);
  assert.throws(() => diffPricingCatalogs(before, { entries: [] }), /catalogVersion|required/);
});

test("golden readiness treats a stale or unknown estimate price as an incomplete precondition", () => {
  const golden = createGoldenPath({ templates: { instantiate() { throw new Error("unused"); } }, benchDataset: { tasks: [] }, now: () => now });
  const spend = { active: true, authorizationId: "SPEND-001", stepId: "STEP-GP-001", documentVersion: "v1.0", providerId: "openai", modelIds: ["m1"], maxCostUnits: 5_000, expiresAt: "2026-12-01T00:00:00.000Z" };
  const complete = { externalSpend: spend, credentialProviders: ["openai"], globalStopActive: false, targetEnvironment: "test", benchBaselineDigest: "a".repeat(64), ownerAcceptanceApproved: true, killSwitchDrillAt: "2026-10-08T10:00:00.000Z", estimateHighCostUnits: 4_000, expectedProviderId: "openai" };
  const codes = patch => golden.readiness({ ...complete, ...patch }).blockers.map(item => item.code);
  assert.deepEqual(codes({ estimatePriceReliance: { reliable: true, code: null } }), []);
  assert.deepEqual(codes({ estimatePriceReliance: { reliable: false, code: PRICE_STALE } }), ["ESTIMATE_PRICE_STALE"]);
  assert.deepEqual(codes({}), ["ESTIMATE_PRICE_FRESHNESS_UNKNOWN"]);
  assert.deepEqual(codes({ estimatePriceReliance: { reliable: "yes" } }), ["ESTIMATE_PRICE_FRESHNESS_UNKNOWN"], "only literal true counts");
});
