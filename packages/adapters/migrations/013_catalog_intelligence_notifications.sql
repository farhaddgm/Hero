-- Catalog, token usage, evaluation, health, notification and audit metadata.
CREATE TABLE IF NOT EXISTS usage_events (usage_id text PRIMARY KEY, project_id text NOT NULL, invocation_id text NOT NULL, usage jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS evaluation_records (evaluation_id text PRIMARY KEY, project_id text NOT NULL, evaluation jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS health_records (health_id text PRIMARY KEY, project_id text NOT NULL, formula_version text NOT NULL, health jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS notification_records (notification_id text PRIMARY KEY, project_id text NOT NULL, deduplication_key text NOT NULL, notification jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,deduplication_key));
CREATE TABLE IF NOT EXISTS observability_audit_records (audit_id text PRIMARY KEY, project_id text NOT NULL, correlation_id text NOT NULL, audit jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS catalog_drift_proposals (proposal_id text PRIMARY KEY, project_id text NOT NULL, entity_id text NOT NULL, proposal jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());
DROP TRIGGER IF EXISTS usage_events_append_only_guard ON usage_events; CREATE TRIGGER usage_events_append_only_guard BEFORE UPDATE OR DELETE ON usage_events FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
DROP TRIGGER IF EXISTS evaluation_records_append_only_guard ON evaluation_records; CREATE TRIGGER evaluation_records_append_only_guard BEFORE UPDATE OR DELETE ON evaluation_records FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
DROP TRIGGER IF EXISTS observability_audit_records_append_only_guard ON observability_audit_records; CREATE TRIGGER observability_audit_records_append_only_guard BEFORE UPDATE OR DELETE ON observability_audit_records FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
INSERT INTO hero_schema_migrations (migration_id) VALUES ('013') ON CONFLICT (migration_id) DO NOTHING;
