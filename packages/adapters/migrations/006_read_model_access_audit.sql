-- Safe access audit for owner-facing read models.
-- Only route metadata is stored; credentials, tokens, query strings and payloads are excluded.

CREATE TABLE IF NOT EXISTS read_model_access_audit (
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
  access_id text PRIMARY KEY,
  actor_kind text NOT NULL CHECK (actor_kind IN ('anonymous', 'project-owner', 'backoffice-basic-auth')),
  actor_id text NOT NULL,
  resource text NOT NULL CHECK (resource IN ('/backoffice', '/backoffice-data', '/backoffice-events', '/api/dashboard', '/api/ai/benchmarks', '/api/ai/benchmarks/compare', '/api/audit')),
  method text NOT NULL CHECK (method = 'GET'),
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'rejected')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS read_model_access_audit_sequence_idx
  ON read_model_access_audit (sequence);

DROP TRIGGER IF EXISTS read_model_access_audit_append_only_guard ON read_model_access_audit;
CREATE TRIGGER read_model_access_audit_append_only_guard
BEFORE UPDATE OR DELETE ON read_model_access_audit
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('006')
ON CONFLICT (migration_id) DO NOTHING;
