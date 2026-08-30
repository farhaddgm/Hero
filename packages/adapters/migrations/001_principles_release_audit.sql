-- Hero PostgreSQL boundary. Values are validated by the contracts/domain layer
-- before insertion; this migration never stores credentials or secret material.

CREATE TABLE IF NOT EXISTS hero_schema_migrations (
  migration_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  project_id text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
  event_id text PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_version integer NOT NULL CHECK (aggregate_version > 0),
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  actor_kind text NOT NULL,
  actor_id text NOT NULL,
  correlation_id text,
  causation_id text,
  data jsonb NOT NULL,
  schema_version text NOT NULL,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version)
);

CREATE TABLE IF NOT EXISTS principles (
  principle_id text NOT NULL,
  project_id text NOT NULL REFERENCES projects(project_id),
  scope text NOT NULL CHECK (scope IN ('hero', 'product')),
  title text NOT NULL,
  statement text NOT NULL,
  rationale text NOT NULL,
  control_points jsonb NOT NULL,
  enforcement text NOT NULL CHECK (enforcement = 'block'),
  status text NOT NULL,
  principle_version integer NOT NULL CHECK (principle_version > 0),
  owner_decision text NOT NULL,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, principle_id)
);

CREATE TABLE IF NOT EXISTS principle_reviews (
  review_id text PRIMARY KEY,
  principle_id text NOT NULL,
  project_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  actor_kind text NOT NULL,
  actor_id text NOT NULL,
  feedback text,
  idempotency_key text NOT NULL UNIQUE,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, principle_id) REFERENCES principles(project_id, principle_id)
);

CREATE TABLE IF NOT EXISTS releases (
  release_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  artifact_id text NOT NULL,
  release_version text NOT NULL,
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  state text NOT NULL,
  test_environment_status text NOT NULL DEFAULT 'not-started',
  production_environment_status text NOT NULL DEFAULT 'not-started',
  production_authorization_reference text,
  owner_command_id text,
  aggregate_version integer NOT NULL CHECK (aggregate_version > 0),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, artifact_id, release_version, commit_sha)
);

CREATE TABLE IF NOT EXISTS release_evidence (
  evidence_id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES releases(release_id),
  environment text NOT NULL CHECK (environment IN ('test', 'production')),
  evidence_kind text NOT NULL,
  artifact_id text NOT NULL,
  release_version text NOT NULL,
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  result text NOT NULL,
  data jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox (
  outbox_id text PRIMARY KEY,
  event_id text NOT NULL UNIQUE REFERENCES events(event_id),
  topic text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE OR REPLACE FUNCTION hero_reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hero append-only record cannot be updated or deleted: %', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS events_append_only_guard ON events;
CREATE TRIGGER events_append_only_guard
BEFORE UPDATE OR DELETE ON events
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS principle_reviews_append_only_guard ON principle_reviews;
CREATE TRIGGER principle_reviews_append_only_guard
BEFORE UPDATE OR DELETE ON principle_reviews
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS release_evidence_append_only_guard ON release_evidence;
CREATE TRIGGER release_evidence_append_only_guard
BEFORE UPDATE OR DELETE ON release_evidence
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('001')
ON CONFLICT (migration_id) DO NOTHING;
