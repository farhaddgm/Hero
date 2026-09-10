import {
  HERO_COST_UNITS_PER_CURRENCY_UNIT,
  PRICING_MODES,
  normalizePricingCatalog
} from "../../contracts/src/pricing-catalog.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const MAX_COST_UNITS = 100_000;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new PricingCatalogError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function assertCount(label, value, maximum = 1_000_000_000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new PricingCatalogError("INVALID_USAGE", `${label} must be a non-negative safe integer.`);
  return value;
}

function assertCostUnits(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_COST_UNITS) throw new PricingCatalogError("COST_ACCOUNTING_INVALID", "The calculated Hero cost units are invalid.");
  return value;
}

function assertSourceUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new PricingCatalogError("SOURCE_URL_INVALID", "Pricing source URL is invalid."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new PricingCatalogError("SOURCE_URL_INVALID", "Pricing source URL must be HTTPS without credentials, query or fragment.");
  return url;
}

function normalizeNow(now) {
  const value = typeof now === "function" ? now() : now;
  const timestamp = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : Number(value);
  if (!Number.isFinite(timestamp)) throw new PricingCatalogError("CLOCK_INVALID", "Pricing catalog clock returned an invalid time.");
  return timestamp;
}

function pricingSnapshot(entry) {
  return copy({
    providerId: entry.providerId,
    modelId: entry.modelId,
    pricingMode: entry.pricingMode,
    inputPricePer1mTokens: entry.inputPricePer1mTokens,
    outputPricePer1mTokens: entry.outputPricePer1mTokens,
    cachedInputPricePer1mTokens: entry.cachedInputPricePer1mTokens,
    unitPrice: entry.unitPrice,
    unitName: entry.unitName,
    currency: entry.currency,
    sourceUrl: entry.sourceUrl,
    fetchedAt: entry.fetchedAt,
    validUntil: entry.validUntil,
    catalogVersion: entry.catalogVersion,
    heroUnitsPerCurrencyUnit: entry.heroUnitsPerCurrencyUnit,
    sourceDigest: entry.sourceDigest
  });
}

export class PricingCatalogError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PricingCatalogError";
    this.code = code;
  }
}

function normalizeCatalog(input) {
  try {
    return normalizePricingCatalog(input);
  } catch (error) {
    throw new PricingCatalogError("CATALOG_INVALID", error instanceof Error ? error.message : "Pricing catalog is invalid.");
  }
}

export function createPricingCatalogRegistry({ now = () => Date.now() } = {}) {
  const catalogs = new Map();
  let activeVersion = null;

  function publish(input) {
    const catalog = normalizeCatalog(input);
    const existing = catalogs.get(catalog.catalogVersion);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(catalog)) throw new PricingCatalogError("CATALOG_VERSION_CONFLICT", "A catalog version already exists with different content.");
      return copy({ catalog, idempotent: true });
    }
    catalogs.set(catalog.catalogVersion, catalog);
    return copy({ catalog, idempotent: false });
  }

  function activate(catalogVersion) {
    const version = assertIdentifier("catalogVersion", catalogVersion);
    const catalog = catalogs.get(version);
    if (!catalog) throw new PricingCatalogError("CATALOG_NOT_FOUND", `Pricing catalog ${version} was not published.`);
    if (Date.parse(catalog.validUntil) <= normalizeNow(now)) throw new PricingCatalogError("CATALOG_EXPIRED", "An expired pricing catalog cannot be activated.");
    activeVersion = version;
    return copy({ catalogVersion: version, activated: true });
  }

  function read(catalogVersion) {
    const version = assertIdentifier("catalogVersion", catalogVersion);
    return catalogs.has(version) ? copy(catalogs.get(version)) : null;
  }

  function current() {
    return activeVersion ? read(activeVersion) : null;
  }

  function resolve(providerId, modelId, { catalogVersion } = {}) {
    const provider = assertIdentifier("providerId", providerId);
    const model = assertIdentifier("modelId", modelId);
    const catalog = catalogVersion === undefined ? current() : read(catalogVersion);
    if (!catalog) throw new PricingCatalogError("CATALOG_NOT_CONFIGURED", "No active pricing catalog is configured.");
    if (Date.parse(catalog.validUntil) <= normalizeNow(now)) throw new PricingCatalogError("CATALOG_EXPIRED", `Pricing catalog ${catalog.catalogVersion} is expired.`);
    const entry = catalog.entries.find(item => item.providerId === provider && item.modelId === model);
    if (!entry) throw new PricingCatalogError("MODEL_PRICING_NOT_FOUND", `Pricing for ${provider}/${model} is not present in the active catalog.`);
    if (Date.parse(entry.validUntil) <= normalizeNow(now)) throw new PricingCatalogError("PRICING_EXPIRED", `Pricing for ${provider}/${model} is expired.`);
    return copy(entry);
  }

  function snapshot() {
    return copy({ activeVersion, versions: [...catalogs.keys()].sort(), activeCatalog: current() });
  }

  function hydrate(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new PricingCatalogError("HYDRATION_INVALID", "Pricing catalog hydration requires an object.");
    catalogs.clear();
    activeVersion = null;
    for (const catalog of input.catalogs ?? []) publish(catalog);
    if (input.activeVersion !== undefined && input.activeVersion !== null) activate(input.activeVersion);
    return snapshot();
  }

  return Object.freeze({ publish, activate, read, current, resolve, snapshot, hydrate });
}

function registryResolver(catalog, providerId, modelId) {
  if (!catalog || typeof catalog.resolve !== "function") throw new PricingCatalogError("CATALOG_NOT_CONFIGURED", "A pricing catalog registry is required.");
  return catalog.resolve(providerId, modelId);
}

function safeCurrencyAmount(price, units, conversion) {
  const amount = price * units * conversion / 1_000_000;
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) throw new PricingCatalogError("COST_ACCOUNTING_INVALID", "The pricing calculation overflowed.");
  return amount;
}

function safeUnitAmount(price, units, conversion) {
  const amount = price * units * conversion;
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) throw new PricingCatalogError("COST_ACCOUNTING_INVALID", "The pricing calculation overflowed.");
  return amount;
}

function tokenCost(entry, { inputTokens, outputTokens, cachedInputTokens = 0 }) {
  const input = assertCount("inputTokens", inputTokens);
  const output = assertCount("outputTokens", outputTokens);
  const cached = assertCount("cachedInputTokens", cachedInputTokens);
  if (cached > input) throw new PricingCatalogError("USAGE_INVALID", "cachedInputTokens cannot exceed inputTokens.");
  if (entry.pricingMode !== "tokens" || entry.inputPricePer1mTokens === null || entry.outputPricePer1mTokens === null) {
    throw new PricingCatalogError("PRICING_INCOMPLETE", "Complete token pricing is required for token usage accounting.");
  }
  const uncachedInput = input - cached;
  const cachedPrice = entry.cachedInputPricePer1mTokens ?? entry.inputPricePer1mTokens;
  const amount = safeCurrencyAmount(entry.inputPricePer1mTokens, uncachedInput, entry.heroUnitsPerCurrencyUnit)
    + safeCurrencyAmount(cachedPrice, cached, entry.heroUnitsPerCurrencyUnit)
    + safeCurrencyAmount(entry.outputPricePer1mTokens, output, entry.heroUnitsPerCurrencyUnit);
  return assertCostUnits(Math.ceil(amount));
}

export function createTokenPricingAdapter({ catalog, providerId, modelId } = {}) {
  const provider = assertIdentifier("providerId", providerId);
  const model = assertIdentifier("modelId", modelId);

  function resolve() {
    const entry = registryResolver(catalog, provider, model);
    if (entry.pricingMode !== "tokens") throw new PricingCatalogError("PRICING_MODE_MISMATCH", `Pricing for ${provider}/${model} is not token based.`);
    return entry;
  }

  function estimate(usage = {}) {
    const entry = resolve();
    return copy({ costUnits: tokenCost(entry, usage), pricing: pricingSnapshot(entry) });
  }

  return Object.freeze({
    mode: "tokens",
    providerId: provider,
    modelId: model,
    resolvePricing: resolve,
    estimate,
    estimateWorstCase: ({ inputTokens, outputTokens }) => estimate({ inputTokens, outputTokens, cachedInputTokens: 0 }),
    listCapabilities: () => Object.freeze(["token-accounting", "cached-input-accounting", "versioned-catalog"])
  });
}

export function createRequestUnitPricingAdapter({ catalog, providerId, modelId } = {}) {
  const provider = assertIdentifier("providerId", providerId);
  const model = assertIdentifier("modelId", modelId);

  function resolve() {
    const entry = registryResolver(catalog, provider, model);
    if (entry.pricingMode !== "request-units" || entry.unitPrice === null || !entry.unitName) throw new PricingCatalogError("PRICING_INCOMPLETE", `Request-unit pricing for ${provider}/${model} is incomplete.`);
    return entry;
  }

  function estimate({ units = 1 } = {}) {
    const entry = resolve();
    const count = assertCount("units", units, 1_000_000);
    const costUnits = assertCostUnits(Math.ceil(safeUnitAmount(entry.unitPrice, count, entry.heroUnitsPerCurrencyUnit)));
    return copy({ costUnits, pricing: pricingSnapshot(entry), units, unitName: entry.unitName });
  }

  return Object.freeze({
    mode: "request-units",
    providerId: provider,
    modelId: model,
    resolvePricing: resolve,
    estimate,
    estimateWorstCase: ({ units = 1 }) => estimate({ units }),
    listCapabilities: () => Object.freeze(["request-unit-accounting", "versioned-catalog"])
  });
}

export function createPricingCatalogSync({ registry, fetchImpl = globalThis.fetch, allowedHosts = ["developers.openai.com"], now = () => Date.now() } = {}) {
  if (!registry || typeof registry.publish !== "function") throw new PricingCatalogError("REGISTRY_INVALID", "A pricing catalog registry is required.");
  if (typeof fetchImpl !== "function") throw new PricingCatalogError("FETCH_UNAVAILABLE", "A fetch implementation is required for catalog synchronization.");
  const hosts = new Set(allowedHosts);
  if (hosts.size === 0 || [...hosts].some(host => typeof host !== "string" || !/^[a-z0-9.-]+$/.test(host))) throw new PricingCatalogError("ALLOWLIST_INVALID", "Pricing source host allow-list is invalid.");

  async function sync({ sourceUrl, providerId, catalogVersion, validUntil, parse = body => body } = {}) {
    assertIdentifier("providerId", providerId);
    assertIdentifier("catalogVersion", catalogVersion);
    const url = assertSourceUrl(sourceUrl);
    if (!hosts.has(url.hostname)) throw new PricingCatalogError("SOURCE_NOT_ALLOWED", "Pricing source host is not allow-listed.");
    const response = await fetchImpl(url.toString(), { method: "GET", headers: { accept: "application/json" } }).catch(() => {
      throw new PricingCatalogError("CATALOG_FETCH_FAILED", "Pricing catalog source could not be fetched.");
    });
    if (!response?.ok) throw new PricingCatalogError("CATALOG_FETCH_FAILED", `Pricing catalog source returned HTTP ${Number(response?.status) || 0}.`);
    let body;
    try { body = await response.json(); } catch { throw new PricingCatalogError("CATALOG_RESPONSE_INVALID", "Pricing catalog source did not return valid JSON."); }
    let parsed;
    try { parsed = await parse(body); } catch { throw new PricingCatalogError("CATALOG_RESPONSE_INVALID", "Pricing catalog response parser failed."); }
    const fetchedAt = new Date(normalizeNow(now)).toISOString();
    const candidate = normalizeCatalog({ ...parsed, providerId, catalogVersion, sourceUrl: url.toString().replace(/\/$/, ""), fetchedAt, validUntil });
    const providerEntries = candidate.entries.filter(entry => entry.providerId === providerId);
    if (providerEntries.length === 0) throw new PricingCatalogError("CATALOG_PROVIDER_MISSING", `Catalog does not contain provider ${providerId}.`);
    registry.publish(candidate);
    return copy({ catalog: candidate, activated: false, sourceUrl: url.toString().replace(/\/$/, "") });
  }

  return Object.freeze({ sync });
}

export function createPricingCostAccounting({ catalog, providerId, modelId } = {}) {
  const entry = registryResolver(catalog, providerId, modelId);
  if (!PRICING_MODES.includes(entry.pricingMode)) throw new PricingCatalogError("PRICING_MODE_MISMATCH", "Pricing mode is unsupported.");
  return entry.pricingMode === "tokens"
    ? createTokenPricingAdapter({ catalog, providerId, modelId })
    : createRequestUnitPricingAdapter({ catalog, providerId, modelId });
}

export { HERO_COST_UNITS_PER_CURRENCY_UNIT };
