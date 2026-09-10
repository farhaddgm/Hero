-- Versioned provider pricing. Rates are immutable snapshots; the active pointer
-- is append-only so a bad catalog can be rolled back without rewriting history.

CREATE TABLE IF NOT EXISTS pricing_catalogs (
  catalog_version text PRIMARY KEY,
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  source_digest text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > fetched_at),
  CHECK (source_url ~ '^https://[^/?#]+[^?#]*$'),
  CHECK (source_digest IS NULL OR source_digest ~ '^[a-f0-9]{64}$')
);

CREATE TABLE IF NOT EXISTS pricing_catalog_entries (
  catalog_version text NOT NULL REFERENCES pricing_catalogs(catalog_version),
  provider_id text NOT NULL,
  model_id text NOT NULL,
  pricing_mode text NOT NULL CHECK (pricing_mode IN ('tokens', 'request-units')),
  input_price_per_1m_tokens numeric,
  output_price_per_1m_tokens numeric,
  cached_input_price numeric,
  unit_price numeric,
  unit_name text,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  hero_units_per_currency_unit bigint NOT NULL CHECK (hero_units_per_currency_unit > 0),
  source_digest text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (catalog_version, provider_id, model_id),
  CHECK (valid_until > fetched_at),
  CHECK (input_price_per_1m_tokens IS NULL OR input_price_per_1m_tokens >= 0),
  CHECK (output_price_per_1m_tokens IS NULL OR output_price_per_1m_tokens >= 0),
  CHECK (cached_input_price IS NULL OR cached_input_price >= 0),
  CHECK (unit_price IS NULL OR unit_price >= 0),
  CHECK (source_url ~ '^https://[^/?#]+[^?#]*$'),
  CHECK (source_digest IS NULL OR source_digest ~ '^[a-f0-9]{64}$'),
  CHECK ((pricing_mode = 'tokens' AND input_price_per_1m_tokens IS NOT NULL AND output_price_per_1m_tokens IS NOT NULL AND unit_price IS NULL AND unit_name IS NULL)
      OR (pricing_mode = 'request-units' AND unit_price IS NOT NULL AND unit_name IS NOT NULL AND input_price_per_1m_tokens IS NULL AND output_price_per_1m_tokens IS NULL AND cached_input_price IS NULL))
);

CREATE TABLE IF NOT EXISTS pricing_catalog_activations (
  activation_id text PRIMARY KEY,
  catalog_version text NOT NULL REFERENCES pricing_catalogs(catalog_version),
  actor_kind text NOT NULL,
  actor_id text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS pricing_catalog_activations_latest_idx
  ON pricing_catalog_activations (activated_at DESC, activation_id DESC);

DROP TRIGGER IF EXISTS pricing_catalogs_append_only_guard ON pricing_catalogs;
CREATE TRIGGER pricing_catalogs_append_only_guard
BEFORE UPDATE OR DELETE ON pricing_catalogs
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS pricing_catalog_entries_append_only_guard ON pricing_catalog_entries;
CREATE TRIGGER pricing_catalog_entries_append_only_guard
BEFORE UPDATE OR DELETE ON pricing_catalog_entries
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS pricing_catalog_activations_append_only_guard ON pricing_catalog_activations;
CREATE TRIGGER pricing_catalog_activations_append_only_guard
BEFORE UPDATE OR DELETE ON pricing_catalog_activations
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('007')
ON CONFLICT (migration_id) DO NOTHING;
