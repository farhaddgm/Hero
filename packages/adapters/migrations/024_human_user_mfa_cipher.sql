-- BO-025: user MFA secrets survive a restart, sealed (AES-256-GCM, key from the
-- environment, user id bound as associated data). The column never holds a clear
-- secret; a NULL means "not stored" and the account refuses MFA login until the
-- owner enrolls again. Recovery codes are stored only as SHA-256 hashes and are
-- consumed when used.
ALTER TABLE human_users ADD COLUMN IF NOT EXISTS mfa_secret_cipher text;
ALTER TABLE human_users ADD COLUMN IF NOT EXISTS recovery_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE human_users DROP CONSTRAINT IF EXISTS human_users_mfa_cipher_shape;
ALTER TABLE human_users ADD CONSTRAINT human_users_mfa_cipher_shape CHECK (mfa_secret_cipher IS NULL OR mfa_secret_cipher ~ '^mfa1\.[a-f0-9]{8}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$');
-- BO-025/026/027: enrolment, disabling and bulk session revocation are audited in their
-- own append-only table. The original human_identity_audit event list is deliberately left
-- alone: migration 016 re-creates that CHECK on every start, so widening it would make a
-- rollback to an earlier build fail on startup once such rows exist.
CREATE TABLE IF NOT EXISTS human_identity_lifecycle_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
  audit_id text PRIMARY KEY,
  user_id text,
  event_type text NOT NULL CHECK (event_type IN ('identity.mfa-enrolled', 'identity.user-disabled', 'identity.sessions-revoked-all')),
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'rejected')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS human_identity_lifecycle_events_append_only_guard ON human_identity_lifecycle_events;
CREATE TRIGGER human_identity_lifecycle_events_append_only_guard
BEFORE UPDATE OR DELETE ON human_identity_lifecycle_events
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
INSERT INTO hero_schema_migrations (migration_id) VALUES ('024') ON CONFLICT (migration_id) DO NOTHING;
