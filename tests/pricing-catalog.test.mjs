import assert from "node:assert/strict";
import test from "node:test";

import {
  createOpenAiResponsesAdapter,
  createPostgresPricingCatalogStore,
  createPricingCatalogRegistry,
  createPricingCatalogSync,
  createRequestUnitPricingAdapter,
  createTokenPricingAdapter
} from "../packages/adapters/src/index.mjs";
import {
  HERO_COST_UNITS_PER_CURRENCY_UNIT,
  getPricingCatalogContractSummary,
  validatePricingCatalogContract
} from "../packages/contracts/src/index.mjs";

const NOW = "2026-09-10T12:00:00.000Z";
const SOURCE = "https://developers.openai.com/api/docs/models";

function catalog({ catalogVersion = "pricing-test-v1", modelId = "gpt-test", fetchedAt = NOW, validUntil = "2026-09-11T12:00:00.000Z", ...entry } = {}) {
  return {
    catalogVersion,
    sourceUrl: SOURCE,
    fetchedAt,
    validUntil,
    entries: [{ providerId: "openai", modelId, pricingMode: "tokens", inputPricePer1mTokens: 20, outputPricePer1mTokens: 40, cachedInputPricePer1mTokens: 10, currency: "USD", ...entry }]
  };
}

function activeRegistry(input = catalog(), now = NOW) {
  const registry = createPricingCatalogRegistry({ now: () => Date.parse(now) });
  registry.publish(input);
  registry.activate(input.catalogVersion);
  return registry;
}

test("Pricing Catalog contract is versioned and uses a fixed Hero unit conversion", () => {
  assert.deepEqual(validatePricingCatalogContract(), []);
  assert.equal(HERO_COST_UNITS_PER_CURRENCY_UNIT, 10_000);
  assert.deepEqual(getPricingCatalogContractSummary().modes, ["tokens", "request-units"]);
});

test("token pricing uses cached input, catalog version and conservative Hero units", () => {
  const registry = activeRegistry();
  const adapter = createTokenPricingAdapter({ catalog: registry, providerId: "openai", modelId: "gpt-test" });
  const result = adapter.estimate({ inputTokens: 1_000, cachedInputTokens: 100, outputTokens: 1_000 });
  assert.equal(result.costUnits, 590);
  assert.equal(result.pricing.catalogVersion, "pricing-test-v1");
  assert.equal(result.pricing.cachedInputPricePer1mTokens, 10);
  assert.throws(() => adapter.estimate({ inputTokens: 1, cachedInputTokens: 2, outputTokens: 1 }), error => error.code === "USAGE_INVALID");
});

test("unknown and expired model pricing fail closed", () => {
  const registry = activeRegistry();
  const adapter = createTokenPricingAdapter({ catalog: registry, providerId: "openai", modelId: "unknown-model" });
  assert.throws(() => adapter.estimate({ inputTokens: 1, outputTokens: 1 }), error => error.code === "MODEL_PRICING_NOT_FOUND");
  const expired = createPricingCatalogRegistry({ now: () => Date.parse(NOW) });
  expired.publish(catalog({ catalogVersion: "pricing-expired-v1", fetchedAt: "2026-09-09T12:00:00.000Z", validUntil: "2026-09-10T11:59:59.000Z" }));
  assert.throws(() => expired.activate("pricing-expired-v1"), error => error.code === "CATALOG_EXPIRED");
});

test("request-unit pricing supports a non-token Provider adapter", () => {
  const registry = activeRegistry(catalog({ catalogVersion: "pricing-request-v1", modelId: "image-test", pricingMode: "request-units", inputPricePer1mTokens: null, outputPricePer1mTokens: null, cachedInputPricePer1mTokens: null, unitPrice: 2, unitName: "image" }));
  const adapter = createRequestUnitPricingAdapter({ catalog: registry, providerId: "openai", modelId: "image-test" });
  const result = adapter.estimate({ units: 3 });
  assert.equal(result.costUnits, 60_000);
  assert.equal(result.unitName, "image");
  assert.equal(result.pricing.pricingMode, "request-units");
});

test("catalog sync fetches once and dispatch never performs a pricing request", async () => {
  let fetchCount = 0;
  const registry = createPricingCatalogRegistry({ now: () => Date.parse(NOW) });
  const synchronizer = createPricingCatalogSync({
    registry,
    allowedHosts: ["developers.openai.com"],
    now: () => Date.parse(NOW),
    fetchImpl: async () => {
      fetchCount += 1;
      return { ok: true, status: 200, async json() { return { entries: [{ providerId: "openai", modelId: "gpt-sync", pricingMode: "tokens", inputPricePer1mTokens: 0.2, outputPricePer1mTokens: 1.2, cachedInputPricePer1mTokens: 0.02, currency: "USD" }] }; } };
    }
  });
  await synchronizer.sync({ sourceUrl: SOURCE, providerId: "openai", catalogVersion: "pricing-sync-v1", validUntil: "2026-09-11T12:00:00.000Z" });
  registry.activate("pricing-sync-v1");
  const adapter = createTokenPricingAdapter({ catalog: registry, providerId: "openai", modelId: "gpt-sync" });
  adapter.estimate({ inputTokens: 10, outputTokens: 5 });
  adapter.estimate({ inputTokens: 10, outputTokens: 5 });
  assert.equal(fetchCount, 1);
  await assert.rejects(() => synchronizer.sync({ sourceUrl: "https://untrusted.example/catalog", providerId: "openai", catalogVersion: "pricing-untrusted-v1", validUntil: "2026-09-11T12:00:00.000Z" }), error => error.code === "SOURCE_NOT_ALLOWED");
});

test("missing catalog blocks an OpenAI request before fetch or credential use", async () => {
  let calls = 0;
  const adapter = createOpenAiResponsesAdapter({
    endpoint: "https://api.example.test/v1/responses",
    credentialEnv: "TEST_OPENAI_KEY",
    env: { TEST_OPENAI_KEY: "synthetic-secret" },
    pricingCatalog: createPricingCatalogRegistry(),
    fetchImpl: async () => { calls += 1; throw new Error("network must not be reached"); }
  });
  await assert.rejects(
    () => adapter.assertDispatchReady({ credentialRef: "env:TEST_OPENAI_KEY", modelId: "gpt-missing", role: "analyst", outputSchema: "analysis-v1", maxOutputTokens: 100, maxCostUnits: 100, request: "synthetic", context: {} }),
    error => error.code === "CATALOG_NOT_CONFIGURED"
  );
  assert.equal(calls, 0);
  assert.throws(() => createOpenAiResponsesAdapter({ costUnitsPer1kTokens: 1 }), error => error.code === "LEGACY_MANUAL_PRICING_DISABLED");
});

function fakePricingClient() {
  const catalogs = new Map();
  const entries = new Map();
  const activations = [];
  const queries = [];
  return {
    queries,
    async query(text, params = []) {
      queries.push({ text, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text)) return { rows: [] };
      if (text.startsWith("SELECT catalog_version, source_url")) {
        return { rows: catalogs.has(params[0]) ? [catalogs.get(params[0])] : [] };
      }
      if (text.startsWith("SELECT catalog_version, provider_id")) {
        return { rows: [...entries.values()].filter(row => row.catalog_version === params[0]) };
      }
      if (text.startsWith("INSERT INTO pricing_catalogs")) {
        const [catalogVersion, sourceUrl, fetchedAt, validUntil, sourceDigest] = params;
        catalogs.set(catalogVersion, { catalog_version: catalogVersion, source_url: sourceUrl, fetched_at: fetchedAt, valid_until: validUntil, source_digest: sourceDigest });
        return { rows: [] };
      }
      if (text.startsWith("INSERT INTO pricing_catalog_entries")) {
        const [catalogVersion, providerId, modelId, pricingMode, inputPrice, outputPrice, cachedPrice, unitPrice, unitName, currency, sourceUrl, fetchedAt, validUntil, heroUnits, sourceDigest] = params;
        entries.set(`${catalogVersion}:${providerId}:${modelId}`, { catalog_version: catalogVersion, provider_id: providerId, model_id: modelId, pricing_mode: pricingMode, input_price_per_1m_tokens: inputPrice, output_price_per_1m_tokens: outputPrice, cached_input_price: cachedPrice, unit_price: unitPrice, unit_name: unitName, currency, source_url: sourceUrl, fetched_at: fetchedAt, valid_until: validUntil, hero_units_per_currency_unit: heroUnits, source_digest: sourceDigest });
        return { rows: [] };
      }
      if (text.startsWith("SELECT a.catalog_version")) return { rows: activations.at(-1) ? [{ catalog_version: activations.at(-1).catalog_version }] : [] };
      if (text.startsWith("SELECT catalog_version FROM pricing_catalogs")) return { rows: [...catalogs.values()].slice(0, params[0]).map(row => ({ catalog_version: row.catalog_version })) };
      if (text.startsWith("INSERT INTO pricing_catalog_activations")) {
        const [activationId, catalogVersion, actorKind, actorId, activatedAt] = params;
        const row = { activation_id: activationId, catalog_version: catalogVersion, actor_kind: actorKind, actor_id: actorId, activated_at: activatedAt };
        activations.push(row);
        return { rows: [row] };
      }
      throw new Error(`unexpected query: ${text}`);
    }
  };
}

test("PostgreSQL Pricing Catalog store is append-only, idempotent and restorable", async () => {
  const client = fakePricingClient();
  const store = createPostgresPricingCatalogStore({ client, now: () => NOW, activationIdFactory: () => "pricing-activation-001" });
  const input = catalog({ catalogVersion: "pricing-persisted-v1" });
  const saved = await store.publish(input);
  assert.equal(saved.idempotent, false);
  const replay = await store.publish(input);
  assert.equal(replay.idempotent, true);
  const activated = await store.activate(input.catalogVersion, { actor: { kind: "project-owner", id: "hero-owner" } });
  assert.equal(activated.catalogVersion, input.catalogVersion);
  assert.equal((await store.readCurrent()).catalogVersion, input.catalogVersion);
  assert.equal((await store.list()).length, 1);
  await assert.rejects(() => store.publish(catalog({ catalogVersion: "pricing-persisted-v1", modelId: "different-model" })), error => error.code === "CATALOG_VERSION_CONFLICT");
  assert.doesNotMatch(JSON.stringify(client.queries), /api[_-]?key|password|secret|credential/i);
});
