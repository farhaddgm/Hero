-- System Catalog v1.1 (WP-08): dependency versions, offline inventory, drift
-- proposals and knowledge records. Entity versions keep using
-- system_catalog_entities. Both are append-only so catalog history and every
-- drift decision survive a restart unchanged.
CREATE TABLE IF NOT EXISTS system_catalog_records (
  record_key text NOT NULL, record_version integer NOT NULL CHECK (record_version > 0),
  project_id text NOT NULL, record_kind text NOT NULL, state text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, actor_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (record_kind, record_key, record_version)
);
CREATE INDEX IF NOT EXISTS system_catalog_records_project_idx ON system_catalog_records (project_id);
DROP TRIGGER IF EXISTS system_catalog_records_append_only_guard ON system_catalog_records;
CREATE TRIGGER system_catalog_records_append_only_guard BEFORE UPDATE OR DELETE ON system_catalog_records FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
INSERT INTO hero_schema_migrations (migration_id) VALUES ('022') ON CONFLICT (migration_id) DO NOTHING;
