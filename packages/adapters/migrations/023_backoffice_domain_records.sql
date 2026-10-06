-- WP-09/WP-10 durable records: usage, invocation snapshots, budgets,
-- reservations, evaluations, health overrides, notifications, incidents,
-- audit, traces and SLIs. One append-only table keyed by
-- (domain, kind, key, version); history is never rewritten.
CREATE TABLE IF NOT EXISTS backoffice_domain_records (
  domain text NOT NULL, record_kind text NOT NULL, record_key text NOT NULL,
  record_version integer NOT NULL CHECK (record_version > 0), project_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, actor_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, record_kind, record_key, record_version)
);
CREATE INDEX IF NOT EXISTS backoffice_domain_records_project_idx ON backoffice_domain_records (domain, project_id);
DROP TRIGGER IF EXISTS backoffice_domain_records_append_only_guard ON backoffice_domain_records;
CREATE TRIGGER backoffice_domain_records_append_only_guard BEFORE UPDATE OR DELETE ON backoffice_domain_records FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
INSERT INTO hero_schema_migrations (migration_id) VALUES ('023') ON CONFLICT (migration_id) DO NOTHING;
