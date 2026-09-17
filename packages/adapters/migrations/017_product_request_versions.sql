-- Product Request metadata is append-only and secret-free.  The request
-- record makes owner retries safe across process restarts without persisting
-- the raw form or any credential material.

CREATE TABLE IF NOT EXISTS product_request_versions (
  request_id text NOT NULL,
  request_version integer NOT NULL CHECK (request_version > 0),
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  project_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('accepted', 'rejected')),
  request_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, request_version),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS product_request_versions_project_idx
  ON product_request_versions (project_id, recorded_at DESC);

DROP TRIGGER IF EXISTS product_request_versions_append_only_guard ON product_request_versions;
CREATE TRIGGER product_request_versions_append_only_guard
  BEFORE UPDATE OR DELETE ON product_request_versions
  FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('017')
ON CONFLICT (migration_id) DO NOTHING;
