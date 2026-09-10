-- Human Identity and project-scoped authorization. Passwords, MFA values and
-- recovery codes never appear in audit/event payloads; MFA is a Secret Store reference.

CREATE TABLE IF NOT EXISTS human_users (
  user_id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'disabled')),
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  mfa_secret_ref text,
  mfa_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_grant_versions (
  project_id text NOT NULL,
  user_id text NOT NULL,
  grant_version integer NOT NULL CHECK (grant_version > 0),
  role text NOT NULL CHECK (role IN ('admin', 'viewer')),
  status text NOT NULL CHECK (status IN ('active', 'revoked')),
  granted_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id, grant_version)
);

CREATE INDEX IF NOT EXISTS project_grant_versions_active_idx
  ON project_grant_versions (project_id, user_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS human_session_revocations (
  session_id text PRIMARY KEY,
  user_id text NOT NULL,
  reason text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS human_identity_audit (
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
  audit_id text PRIMARY KEY,
  user_id text,
  event_type text NOT NULL CHECK (event_type IN (
    'identity.user-created', 'identity.project-grant-upserted', 'identity.project-grant-revoked',
    'identity.login-challenged', 'identity.session-issued', 'identity.session-revoked',
    'identity.recovery-requested', 'identity.recovery-completed', 'identity.step-up-verified'
  )),
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'rejected')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS project_grant_versions_append_only_guard ON project_grant_versions;
CREATE TRIGGER project_grant_versions_append_only_guard
BEFORE UPDATE OR DELETE ON project_grant_versions
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS human_session_revocations_append_only_guard ON human_session_revocations;
CREATE TRIGGER human_session_revocations_append_only_guard
BEFORE UPDATE OR DELETE ON human_session_revocations
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS human_identity_audit_append_only_guard ON human_identity_audit;
CREATE TRIGGER human_identity_audit_append_only_guard
BEFORE UPDATE OR DELETE ON human_identity_audit
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('010')
ON CONFLICT (migration_id) DO NOTHING;
