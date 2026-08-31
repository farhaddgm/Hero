-- Versioned read projections for the in-process Domain registries.
-- The append-only event log remains the source of truth; snapshots are a
-- restart optimization and must never contain runtime credentials.

CREATE TABLE IF NOT EXISTS domain_registry_snapshots (
  snapshot_id text PRIMARY KEY,
  registry_id text NOT NULL,
  schema_version text NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  source_sequence bigint NOT NULL DEFAULT 0 CHECK (source_sequence >= 0),
  data jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registry_id, revision)
);

CREATE INDEX IF NOT EXISTS domain_registry_snapshots_latest_idx
  ON domain_registry_snapshots (registry_id, revision DESC);

DROP TRIGGER IF EXISTS domain_registry_snapshots_append_only_guard ON domain_registry_snapshots;
CREATE TRIGGER domain_registry_snapshots_append_only_guard
BEFORE UPDATE OR DELETE ON domain_registry_snapshots
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('004')
ON CONFLICT (migration_id) DO NOTHING;
