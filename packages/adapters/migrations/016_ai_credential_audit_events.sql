-- Extend the Human Identity audit contract for the Test-only AI credential
-- boundary.  This is intentionally idempotent because the migration runner
-- replays the complete schema contract during each Control Plane start. Later
-- migrations that widen this list (024) must be mirrored here, otherwise the
-- replay would narrow it again and reject rows that already exist.

CREATE TABLE IF NOT EXISTS human_identity_audit (
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
  audit_id text PRIMARY KEY,
  user_id text,
  event_type text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'rejected')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE human_identity_audit
  DROP CONSTRAINT IF EXISTS human_identity_audit_event_type_check;

ALTER TABLE human_identity_audit
  ADD CONSTRAINT human_identity_audit_event_type_check CHECK (event_type IN (
    'identity.user-created', 'identity.project-grant-upserted', 'identity.project-grant-revoked',
    'identity.login-challenged', 'identity.session-issued', 'identity.session-revoked',
    'identity.recovery-requested', 'identity.recovery-completed', 'identity.step-up-verified',
    'identity.mfa-enrolled', 'identity.user-disabled', 'identity.sessions-revoked-all',
    'ai.credential-stored', 'ai.credential-health-checked'
  ));

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('016')
ON CONFLICT (migration_id) DO NOTHING;
