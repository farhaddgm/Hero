export const PRICING_CATALOG_CONTRACT_VERSION = "1.0";

export const PRICING_MODES = Object.freeze(["tokens", "request-units"]);

// One Hero Cost Unit is 0.0001 of the catalog currency unit. The conversion is
// a Hero invariant, not a provider rate and is never read from Environment.
export const HERO_COST_UNITS_PER_CURRENCY_UNIT = 10_000;

export const PRICING_CATALOG_FIELDS = Object.freeze([
  "provider_id",
  "model_id",
  "input_price_per_1m_tokens",
  "output_price_per_1m_tokens",
  "cached_input_price",
  "currency",
  "source_url",
  "fetched_at",
  "valid_until",
  "catalog_version"
]);

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const CURRENCY = /^[A-Z]{3}$/;

function valueOf(input, camel, snake) {
  return input?.[camel] !== undefined ? input[camel] : input?.[snake];
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new Error(`${label} must be a safe identifier.`);
  return value;
}

function assertOptionalNumber(label, value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative number or null.`);
  return value;
}

function assertTimestamp(label, value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO timestamp.`);
  return new Date(value).toISOString();
}

function assertSourceUrl(value) {
  if (typeof value !== "string") throw new Error("sourceUrl is required.");
  let url;
  try { url = new URL(value); } catch { throw new Error("sourceUrl must be an absolute URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("sourceUrl must be an HTTPS URL without credentials, query or fragment.");
  }
  return url.toString().replace(/\/$/, "");
}

function assertSafeDigest(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new Error("sourceDigest must be a SHA-256 hex digest.");
  return value;
}

function normalizeEntry(input = {}, catalogVersion, defaults) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("pricing catalog entries must be objects.");
  const providerId = assertIdentifier("providerId", valueOf(input, "providerId", "provider_id"));
  const modelId = assertIdentifier("modelId", valueOf(input, "modelId", "model_id"));
  const pricingMode = valueOf(input, "pricingMode", "pricing_mode") ?? "tokens";
  if (!PRICING_MODES.includes(pricingMode)) throw new Error(`pricingMode ${pricingMode} is not supported.`);
  const currency = valueOf(input, "currency", "currency");
  if (typeof currency !== "string" || !CURRENCY.test(currency)) throw new Error("currency must be a three-letter uppercase code.");
  const sourceUrl = assertSourceUrl(valueOf(input, "sourceUrl", "source_url") ?? defaults.sourceUrl);
  const fetchedAt = assertTimestamp("fetchedAt", valueOf(input, "fetchedAt", "fetched_at") ?? defaults.fetchedAt);
  const validUntil = assertTimestamp("validUntil", valueOf(input, "validUntil", "valid_until") ?? defaults.validUntil);
  if (Date.parse(validUntil) <= Date.parse(fetchedAt)) throw new Error("validUntil must be after fetchedAt.");
  const heroUnitsPerCurrencyUnit = valueOf(input, "heroUnitsPerCurrencyUnit", "hero_units_per_currency_unit")
    ?? (currency === "USD" ? HERO_COST_UNITS_PER_CURRENCY_UNIT : undefined);
  if (!Number.isSafeInteger(heroUnitsPerCurrencyUnit) || heroUnitsPerCurrencyUnit < 1 || heroUnitsPerCurrencyUnit > 1_000_000_000) {
    throw new Error("heroUnitsPerCurrencyUnit must be a positive safe integer.");
  }
  const sourceDigest = assertSafeDigest(valueOf(input, "sourceDigest", "source_digest"));
  const inputPricePer1mTokens = assertOptionalNumber("inputPricePer1mTokens", valueOf(input, "inputPricePer1mTokens", "input_price_per_1m_tokens"));
  const outputPricePer1mTokens = assertOptionalNumber("outputPricePer1mTokens", valueOf(input, "outputPricePer1mTokens", "output_price_per_1m_tokens"));
  const cachedInputPricePer1mTokens = assertOptionalNumber("cachedInputPricePer1mTokens", valueOf(input, "cachedInputPricePer1mTokens", "cached_input_price"));
  const unitPrice = assertOptionalNumber("unitPrice", valueOf(input, "unitPrice", "unit_price"));
  const unitName = valueOf(input, "unitName", "unit_name") ?? null;

  if (pricingMode === "tokens") {
    if (inputPricePer1mTokens === null || outputPricePer1mTokens === null) throw new Error("token pricing requires input and output prices.");
    if (unitPrice !== null || unitName !== null) throw new Error("token pricing cannot contain request-unit pricing.");
  } else {
    if (unitPrice === null || unitName === null || typeof unitName !== "string" || !/^[a-z][a-z0-9._-]{1,31}$/.test(unitName)) {
      throw new Error("request-units pricing requires a safe unitName and unitPrice.");
    }
    if (inputPricePer1mTokens !== null || outputPricePer1mTokens !== null || cachedInputPricePer1mTokens !== null) {
      throw new Error("request-units pricing cannot contain token prices.");
    }
  }

  return {
    providerId,
    modelId,
    pricingMode,
    inputPricePer1mTokens,
    outputPricePer1mTokens,
    cachedInputPricePer1mTokens,
    unitPrice,
    unitName,
    currency,
    sourceUrl,
    fetchedAt,
    validUntil,
    catalogVersion,
    heroUnitsPerCurrencyUnit,
    sourceDigest
  };
}

export function normalizePricingCatalog(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("A pricing catalog object is required.");
  const catalogVersion = assertIdentifier("catalogVersion", valueOf(input, "catalogVersion", "catalog_version"));
  const sourceUrl = assertSourceUrl(valueOf(input, "sourceUrl", "source_url"));
  const fetchedAt = assertTimestamp("fetchedAt", valueOf(input, "fetchedAt", "fetched_at"));
  const validUntil = assertTimestamp("validUntil", valueOf(input, "validUntil", "valid_until"));
  if (Date.parse(validUntil) <= Date.parse(fetchedAt)) throw new Error("validUntil must be after fetchedAt.");
  if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 2_000) throw new Error("entries must contain 1-2000 items.");
  const keys = new Set();
  const entries = input.entries.map(entry => {
    const normalized = normalizeEntry(entry, catalogVersion, { sourceUrl, fetchedAt, validUntil });
    const key = `${normalized.providerId}\u0000${normalized.modelId}`;
    if (keys.has(key)) throw new Error(`duplicate pricing entry for ${normalized.providerId}/${normalized.modelId}.`);
    keys.add(key);
    return normalized;
  });
  return Object.freeze({
    catalogVersion,
    sourceUrl,
    fetchedAt,
    validUntil,
    entries: Object.freeze(entries.map(entry => Object.freeze(entry))),
    sourceDigest: assertSafeDigest(valueOf(input, "sourceDigest", "source_digest"))
  });
}

export function validatePricingCatalog(input = {}) {
  try {
    normalizePricingCatalog(input);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : "pricing catalog is invalid."];
  }
}

export function getPricingCatalogContractSummary() {
  return Object.freeze({
    version: PRICING_CATALOG_CONTRACT_VERSION,
    modes: PRICING_MODES,
    fields: PRICING_CATALOG_FIELDS,
    heroCostUnitsPerCurrencyUnit: HERO_COST_UNITS_PER_CURRENCY_UNIT,
    invariants: [
      "Pricing is resolved from a versioned catalog, never from per-request network access",
      "Unknown, expired or incomplete pricing blocks dispatch before a provider call",
      "Provider and model selection is independent from pricing source",
      "Token and request-unit providers use separate cost adapters",
      "Secrets and raw provider payloads never enter the catalog or cost audit metadata"
    ]
  });
}

export function validatePricingCatalogContract() {
  const errors = [];
  if (PRICING_CATALOG_CONTRACT_VERSION !== "1.0") errors.push("Pricing Catalog contract version is invalid.");
  if (PRICING_MODES.length !== 2 || !PRICING_MODES.includes("tokens") || !PRICING_MODES.includes("request-units")) errors.push("Pricing modes are incomplete.");
  if (HERO_COST_UNITS_PER_CURRENCY_UNIT !== 10_000) errors.push("Hero cost unit conversion must remain 10000 units per currency unit.");
  if (PRICING_CATALOG_FIELDS.length !== new Set(PRICING_CATALOG_FIELDS).size) errors.push("Pricing Catalog fields must be unique.");
  return errors;
}
