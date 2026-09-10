-- Durable boundaries for collaboration, commands and the System Catalog. Raw
-- conversation bodies and Secret values are intentionally excluded from this metadata schema.
CREATE TABLE IF NOT EXISTS collaboration_records (
  record_id text PRIMARY KEY, project_id text NOT NULL, record_type text NOT NULL,
  record_version integer NOT NULL CHECK (record_version > 0), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS command_decision_records (
  command_id text NOT NULL, decision_version integer NOT NULL CHECK (decision_version > 0), project_id text NOT NULL,
  state text NOT NULL, authorization_snapshot_id text NOT NULL, correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (command_id, decision_version)
);
CREATE TABLE IF NOT EXISTS approval_records (
  approval_id text PRIMARY KEY, command_id text NOT NULL, project_id text NOT NULL, state text NOT NULL,
  expires_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS system_catalog_entities (
  entity_id text NOT NULL, entity_version integer NOT NULL CHECK (entity_version > 0), project_id text NOT NULL,
  entity_type text NOT NULL, lifecycle text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (entity_id, entity_version)
);
CREATE TABLE IF NOT EXISTS system_catalog_dependencies (
  dependency_id text PRIMARY KEY, project_id text NOT NULL, from_entity_id text NOT NULL, to_entity_id text NOT NULL,
  relation text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS collaboration_records_append_only_guard ON collaboration_records;
CREATE TRIGGER collaboration_records_append_only_guard BEFORE UPDATE OR DELETE ON collaboration_records FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
DROP TRIGGER IF EXISTS command_decision_records_append_only_guard ON command_decision_records;
CREATE TRIGGER command_decision_records_append_only_guard BEFORE UPDATE OR DELETE ON command_decision_records FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
DROP TRIGGER IF EXISTS system_catalog_entities_append_only_guard ON system_catalog_entities;
CREATE TRIGGER system_catalog_entities_append_only_guard BEFORE UPDATE OR DELETE ON system_catalog_entities FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
INSERT INTO hero_schema_migrations (migration_id) VALUES ('012') ON CONFLICT (migration_id) DO NOTHING;
