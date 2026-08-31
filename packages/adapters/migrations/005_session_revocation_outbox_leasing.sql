-- Durable owner-session revocation and bounded outbox leasing.
-- Revocations are append-only; outbox status is operational delivery state.

ALTER TABLE outbox
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0 AND attempt_count <= 100),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE TABLE IF NOT EXISTS owner_session_revocations (
  session_id text PRIMARY KEY,
  subject text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL
);

DROP TRIGGER IF EXISTS owner_session_revocations_append_only_guard ON owner_session_revocations;
CREATE TRIGGER owner_session_revocations_append_only_guard
BEFORE UPDATE OR DELETE ON owner_session_revocations
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('005')
ON CONFLICT (migration_id) DO NOTHING;
