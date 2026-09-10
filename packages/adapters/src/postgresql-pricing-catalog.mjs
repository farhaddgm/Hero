import { randomUUID } from "node:crypto";

import { normalizePricingCatalog } from "../../contracts/src/pricing-catalog.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new PostgresPricingCatalogError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function parseTimestamp(value, label) {
  const result = value instanceof Date ? value.toISOString() : value;
  if (typeof result !== "string" || Number.isNaN(Date.parse(result))) throw new PostgresPricingCatalogError("INVALID_DATABASE_ROW", `${label} is invalid.`);
  return new Date(result).toISOString();
}

function parseNumber(value, label) {
  if (value === null || value === undefined) return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw new PostgresPricingCatalogError("INVALID_DATABASE_ROW", `${label} is invalid.`);
  return result;
}

function assertTarget({ client, pool }) {
  if (client && typeof client.query === "function") return;
  if (pool && typeof pool.query === "function" && typeof pool.connect === "function") return;
  throw new PostgresPricingCatalogError("DATABASE_TARGET_INVALID", "A PostgreSQL client or pool is required.");
}

function catalogFromRows(catalogRow, entryRows) {
  if (!catalogRow) return null;
  const catalog = {
    catalogVersion: catalogRow.catalog_version,
    sourceUrl: catalogRow.source_url,
    fetchedAt: parseTimestamp(catalogRow.fetched_at, "pricing_catalogs.fetched_at"),
    validUntil: parseTimestamp(catalogRow.valid_until, "pricing_catalogs.valid_until"),
    sourceDigest: catalogRow.source_digest ?? null,
    entries: (entryRows ?? []).map(row => ({
      providerId: row.provider_id,
      modelId: row.model_id,
      pricingMode: row.pricing_mode,
      inputPricePer1mTokens: parseNumber(row.input_price_per_1m_tokens, "pricing_catalog_entries.input_price_per_1m_tokens"),
      outputPricePer1mTokens: parseNumber(row.output_price_per_1m_tokens, "pricing_catalog_entries.output_price_per_1m_tokens"),
      cachedInputPricePer1mTokens: parseNumber(row.cached_input_price, "pricing_catalog_entries.cached_input_price"),
      unitPrice: parseNumber(row.unit_price, "pricing_catalog_entries.unit_price"),
      unitName: row.unit_name ?? null,
      currency: row.currency,
      sourceUrl: row.source_url,
      fetchedAt: parseTimestamp(row.fetched_at, "pricing_catalog_entries.fetched_at"),
      validUntil: parseTimestamp(row.valid_until, "pricing_catalog_entries.valid_until"),
      catalogVersion: row.catalog_version,
      heroUnitsPerCurrencyUnit: Number(row.hero_units_per_currency_unit),
      sourceDigest: row.source_digest ?? null
    }))
  };
  try { return normalizePricingCatalog(catalog); } catch (error) {
    throw new PostgresPricingCatalogError("INVALID_DATABASE_ROW", error instanceof Error ? error.message : "Pricing catalog row is invalid.");
  }
}

export class PostgresPricingCatalogError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PostgresPricingCatalogError";
    this.code = code;
  }
}

export function createPostgresPricingCatalogStore({ client, pool, now = () => new Date().toISOString(), activationIdFactory } = {}) {
  assertTarget({ client, pool });
  const readTarget = client ?? pool;
  const makeActivationId = activationIdFactory ?? (() => `pricing-activation-${randomUUID().replaceAll("-", "")}`);

  async function transaction(work) {
    if (client) {
      await client.query("BEGIN");
      try {
        const result = await work(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      const result = await work(connection);
      await connection.query("COMMIT");
      return result;
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async function readVersion(catalogVersion, target = readTarget) {
    const version = assertIdentifier("catalogVersion", catalogVersion);
    const catalogResult = await target.query(
      "SELECT catalog_version, source_url, fetched_at, valid_until, source_digest FROM pricing_catalogs WHERE catalog_version = $1",
      [version]
    );
    const catalogRow = catalogResult.rows?.[0];
    if (!catalogRow) return null;
    const entries = await target.query(
      "SELECT catalog_version, provider_id, model_id, pricing_mode, input_price_per_1m_tokens, output_price_per_1m_tokens, cached_input_price, unit_price, unit_name, currency, source_url, fetched_at, valid_until, hero_units_per_currency_unit, source_digest FROM pricing_catalog_entries WHERE catalog_version = $1 ORDER BY provider_id, model_id",
      [version]
    );
    return catalogFromRows(catalogRow, entries.rows);
  }

  return Object.freeze({
    async publish(input) {
      let catalog;
      try { catalog = normalizePricingCatalog(input); } catch (error) {
        throw new PostgresPricingCatalogError("CATALOG_INVALID", error instanceof Error ? error.message : "Pricing catalog is invalid.");
      }
      return transaction(async target => {
        const existing = await readVersion(catalog.catalogVersion, target);
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(catalog)) throw new PostgresPricingCatalogError("CATALOG_VERSION_CONFLICT", "A catalog version already exists with different content.");
          return copy({ catalog: existing, idempotent: true });
        }
        await target.query(
          `INSERT INTO pricing_catalogs (catalog_version, source_url, fetched_at, valid_until, source_digest)
           VALUES ($1, $2, $3, $4, $5)`,
          [catalog.catalogVersion, catalog.sourceUrl, catalog.fetchedAt, catalog.validUntil, catalog.sourceDigest]
        );
        for (const entry of catalog.entries) {
          await target.query(
            `INSERT INTO pricing_catalog_entries
              (catalog_version, provider_id, model_id, pricing_mode, input_price_per_1m_tokens,
               output_price_per_1m_tokens, cached_input_price, unit_price, unit_name, currency,
               source_url, fetched_at, valid_until, hero_units_per_currency_unit, source_digest, data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [catalog.catalogVersion, entry.providerId, entry.modelId, entry.pricingMode, entry.inputPricePer1mTokens, entry.outputPricePer1mTokens, entry.cachedInputPricePer1mTokens, entry.unitPrice, entry.unitName, entry.currency, entry.sourceUrl, entry.fetchedAt, entry.validUntil, entry.heroUnitsPerCurrencyUnit, entry.sourceDigest, {}]
          );
        }
        return copy({ catalog, idempotent: false });
      });
    },

    async activate(catalogVersion, { actor = { kind: "system", id: "hero-pricing-catalog" }, activationId = makeActivationId() } = {}) {
      const version = assertIdentifier("catalogVersion", catalogVersion);
      const actorKind = assertIdentifier("actor.kind", actor.kind);
      const actorId = assertIdentifier("actor.id", actor.id);
      const id = assertIdentifier("activationId", activationId);
      const catalog = await readVersion(version);
      if (!catalog) throw new PostgresPricingCatalogError("CATALOG_NOT_FOUND", `Pricing catalog ${version} was not found.`);
      const nowValue = typeof now === "function" ? now() : now;
      if (Date.parse(catalog.validUntil) <= Date.parse(nowValue)) throw new PostgresPricingCatalogError("CATALOG_EXPIRED", "An expired pricing catalog cannot be activated.");
      const result = await readTarget.query(
        `INSERT INTO pricing_catalog_activations (activation_id, catalog_version, actor_kind, actor_id, activated_at, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING activation_id, catalog_version, actor_kind, actor_id, activated_at`,
        [id, version, actorKind, actorId, nowValue, {}]
      );
      const row = result.rows?.[0];
      return copy({ activationId: row?.activation_id ?? id, catalogVersion: row?.catalog_version ?? version, actor: { kind: row?.actor_kind ?? actorKind, id: row?.actor_id ?? actorId }, activatedAt: row?.activated_at instanceof Date ? row.activated_at.toISOString() : row?.activated_at ?? nowValue, idempotent: false });
    },

    async read(version) {
      return readVersion(version);
    },

    async readCurrent() {
      const result = await readTarget.query(
        `SELECT a.catalog_version
           FROM pricing_catalog_activations a
          ORDER BY a.activated_at DESC, a.activation_id DESC
          LIMIT 1`
      );
      const version = result.rows?.[0]?.catalog_version;
      return version ? readVersion(version) : null;
    },

    async list({ limit = 100 } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) throw new PostgresPricingCatalogError("INVALID_LIMIT", "limit must be between 1 and 1000.");
      const result = await readTarget.query(
        "SELECT catalog_version FROM pricing_catalogs ORDER BY fetched_at DESC, catalog_version DESC LIMIT $1",
        [limit]
      );
      const catalogs = [];
      for (const row of result.rows ?? []) {
        const catalog = await readVersion(row.catalog_version);
        if (catalog) catalogs.push(catalog);
      }
      return copy(catalogs);
    }
  });
}
