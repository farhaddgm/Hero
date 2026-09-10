-- Back Office foundation: versioned entities, event envelopes, Inbox receipts
-- and rebuildable read-model snapshots. Secrets remain outside all payloads.

CREATE TABLE IF NOT EXISTS backoffice_entity_versions (
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  project_id text,
  schema_version text NOT NULL,
  entity_version integer NOT NULL CHECK (entity_version > 0),
  lifecycle text NOT NULL CHECK (lifecycle IN ('draft', 'proposed', 'active', 'paused', 'superseded', 'archived')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id, entity_version)
);

CREATE TABLE IF NOT EXISTS backoffice_event_envelopes (
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
  event_id text PRIMARY KEY,
  schema_version text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_version integer NOT NULL CHECK (aggregate_version > 0),
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  actor_kind text NOT NULL,
  actor_id text NOT NULL,
  project_id text,
  correlation_id text NOT NULL,
  causation_id text,
  idempotency_key text NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version)
);

CREATE TABLE IF NOT EXISTS backoffice_inbox_receipts (
  consumer_id text NOT NULL,
  idempotency_key text NOT NULL,
  event_id text NOT NULL,
  event_digest text NOT NULL CHECK (event_digest ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS backoffice_outbox (
  outbox_id text PRIMARY KEY,
  event_id text NOT NULL UNIQUE REFERENCES backoffice_event_envelopes(event_id),
  topic text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0 AND attempt_count <= 100),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS backoffice_outbox_pending_idx
  ON backoffice_outbox (status, created_at ASC, outbox_id ASC);

CREATE TABLE IF NOT EXISTS backoffice_read_model_snapshots (
  model_id text NOT NULL,
  scope_id text NOT NULL,
  model_version text NOT NULL,
  source_sequence bigint NOT NULL CHECK (source_sequence >= 0),
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  rebuilt_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (model_id, scope_id, model_version, source_sequence)
);

DROP TRIGGER IF EXISTS backoffice_entity_versions_append_only_guard ON backoffice_entity_versions;
CREATE TRIGGER backoffice_entity_versions_append_only_guard
BEFORE UPDATE OR DELETE ON backoffice_entity_versions
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS backoffice_event_envelopes_append_only_guard ON backoffice_event_envelopes;
CREATE TRIGGER backoffice_event_envelopes_append_only_guard
BEFORE UPDATE OR DELETE ON backoffice_event_envelopes
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS backoffice_inbox_receipts_append_only_guard ON backoffice_inbox_receipts;
CREATE TRIGGER backoffice_inbox_receipts_append_only_guard
BEFORE UPDATE OR DELETE ON backoffice_inbox_receipts
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS backoffice_read_model_snapshots_append_only_guard ON backoffice_read_model_snapshots;
CREATE TRIGGER backoffice_read_model_snapshots_append_only_guard
BEFORE UPDATE OR DELETE ON backoffice_read_model_snapshots
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('009')
ON CONFLICT (migration_id) DO NOTHING;
