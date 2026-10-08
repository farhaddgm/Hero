-- BO-025: user MFA secrets survive a restart, sealed (AES-256-GCM, key from the
-- environment, user id bound as associated data). The column never holds a clear
-- secret; a NULL means "not stored" and the account refuses MFA login until the
-- owner enrolls again. Recovery codes are stored only as SHA-256 hashes and are
-- consumed when used.
ALTER TABLE human_users ADD COLUMN IF NOT EXISTS mfa_secret_cipher text;
ALTER TABLE human_users ADD COLUMN IF NOT EXISTS recovery_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE human_users DROP CONSTRAINT IF EXISTS human_users_mfa_cipher_shape;
ALTER TABLE human_users ADD CONSTRAINT human_users_mfa_cipher_shape CHECK (mfa_secret_cipher IS NULL OR mfa_secret_cipher ~ '^mfa1\.[a-f0-9]{8}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$');
-- BO-025/026/027: enrolment, disabling and bulk session revocation are audited.
ALTER TABLE human_identity_audit DROP CONSTRAINT IF EXISTS human_identity_audit_event_type_check;
ALTER TABLE human_identity_audit ADD CONSTRAINT human_identity_audit_event_type_check CHECK (event_type IN (
  'identity.user-created', 'identity.project-grant-upserted', 'identity.project-grant-revoked',
  'identity.login-challenged', 'identity.session-issued', 'identity.session-revoked',
  'identity.recovery-requested', 'identity.recovery-completed', 'identity.step-up-verified',
  'identity.mfa-enrolled', 'identity.user-disabled', 'identity.sessions-revoked-all',
  'ai.credential-stored', 'ai.credential-health-checked'
));
INSERT INTO hero_schema_migrations (migration_id) VALUES ('024') ON CONFLICT (migration_id) DO NOTHING;
