-- Owner-confirmed, project-scoped Smart Tester error records.  Reports are
-- sanitized metadata only; raw prompts, secrets and source bytes are excluded.

CREATE TABLE IF NOT EXISTS smart_tester_error_documents (
  project_id text NOT NULL,
  error_id text NOT NULL,
  report_version text NOT NULL,
  title text NOT NULL,
  surface text NOT NULL,
  feature_key text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('none', 'low', 'medium', 'high', 'critical')),
  summary text NOT NULL,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  reproduction_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, error_id)
);

CREATE INDEX IF NOT EXISTS smart_tester_error_documents_project_idx ON smart_tester_error_documents (project_id, recorded_at DESC);

DROP TRIGGER IF EXISTS smart_tester_error_documents_append_only_guard ON smart_tester_error_documents;
CREATE TRIGGER smart_tester_error_documents_append_only_guard BEFORE UPDATE OR DELETE ON smart_tester_error_documents FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id) VALUES ('015') ON CONFLICT (migration_id) DO NOTHING;
