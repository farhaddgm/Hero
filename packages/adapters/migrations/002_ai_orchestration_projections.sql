-- Hero Multi-AI projections. Raw credentials are never stored here; only
-- runtime-safe references and provider/model/profile metadata are allowed.

CREATE TABLE IF NOT EXISTS ai_providers (
  provider_id text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('live', 'deterministic', 'disabled')),
  display_name text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_credentials (
  credential_ref text PRIMARY KEY CHECK (credential_ref ~ '^(runtime|vault|env):[A-Za-z0-9._:-]{3,120}$'),
  provider_id text NOT NULL REFERENCES ai_providers(provider_id),
  status text NOT NULL DEFAULT 'configured',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_models (
  provider_id text NOT NULL REFERENCES ai_providers(provider_id),
  model_id text NOT NULL,
  display_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, model_id)
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  prompt_version text PRIMARY KEY,
  role text NOT NULL,
  content_ref text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_profiles (
  profile_id text PRIMARY KEY,
  role text NOT NULL,
  provider_id text NOT NULL,
  model_id text NOT NULL,
  credential_ref text NOT NULL CHECK (credential_ref ~ '^(runtime|vault|env):[A-Za-z0-9._:-]{3,120}$'),
  prompt_version text NOT NULL REFERENCES prompt_versions(prompt_version),
  context_policy text NOT NULL,
  tool_policy text NOT NULL CHECK (tool_policy IN ('read-only', 'development', 'owner-gated')),
  output_schema text NOT NULL,
  profile_version integer NOT NULL CHECK (profile_version > 0),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'disabled', 'retired')),
  timeout_ms integer NOT NULL CHECK (timeout_ms >= 100 AND timeout_ms <= 600000),
  max_retries integer NOT NULL CHECK (max_retries >= 0 AND max_retries <= 5),
  cost_latency_priority text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (provider_id, model_id) REFERENCES ai_models(provider_id, model_id)
);

CREATE TABLE IF NOT EXISTS project_agent_bindings (
  binding_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  role text NOT NULL,
  profile_id text NOT NULL REFERENCES agent_profiles(profile_id),
  supersedes_binding_id text,
  bound_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS context_snapshots (
  context_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  task_id text NOT NULL,
  step_id text NOT NULL,
  document_version text NOT NULL,
  recipient_role text NOT NULL,
  memory_revision text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_invocations (
  invocation_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  task_id text,
  run_id text,
  role text NOT NULL,
  provider_id text NOT NULL,
  model_id text NOT NULL,
  profile_id text NOT NULL,
  profile_version integer NOT NULL CHECK (profile_version > 0),
  context_snapshot_id text NOT NULL REFERENCES context_snapshots(context_id),
  status text NOT NULL CHECK (status IN ('completed', 'blocked', 'failed')),
  code text NOT NULL,
  usage jsonb,
  response jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL,
  completed_at timestamptz,
  FOREIGN KEY (provider_id, model_id) REFERENCES ai_models(provider_id, model_id),
  FOREIGN KEY (profile_id) REFERENCES agent_profiles(profile_id)
);

CREATE TABLE IF NOT EXISTS evaluations (
  evaluation_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  invocation_id text REFERENCES ai_invocations(invocation_id),
  target jsonb NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('approved', 'needs_revision', 'rejected')),
  score integer CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  approval_boundary text NOT NULL CHECK (approval_boundary = 'evaluation-is-evidence-not-authorization'),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluation_findings (
  finding_id text PRIMARY KEY,
  evaluation_id text NOT NULL REFERENCES evaluations(evaluation_id),
  severity text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decision_proposals (
  decision_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  requested_decision text NOT NULL,
  options jsonb NOT NULL,
  recommendation jsonb NOT NULL,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  state text NOT NULL CHECK (state IN ('draft', 'approved', 'superseded', 'rejected')),
  selected_option_id text,
  feedback text NOT NULL DEFAULT '',
  authorization_created boolean NOT NULL DEFAULT false CHECK (authorization_created = false),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS provider_health_checks (
  health_check_id text PRIMARY KEY,
  provider_id text NOT NULL REFERENCES ai_providers(provider_id),
  status text NOT NULL,
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  error_code text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

DROP TRIGGER IF EXISTS ai_credentials_append_only_guard ON ai_credentials;
CREATE TRIGGER ai_credentials_append_only_guard
BEFORE UPDATE OR DELETE ON ai_credentials
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS context_snapshots_append_only_guard ON context_snapshots;
CREATE TRIGGER context_snapshots_append_only_guard
BEFORE UPDATE OR DELETE ON context_snapshots
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS ai_invocations_append_only_guard ON ai_invocations;
CREATE TRIGGER ai_invocations_append_only_guard
BEFORE UPDATE OR DELETE ON ai_invocations
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS evaluations_append_only_guard ON evaluations;
CREATE TRIGGER evaluations_append_only_guard
BEFORE UPDATE OR DELETE ON evaluations
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS evaluation_findings_append_only_guard ON evaluation_findings;
CREATE TRIGGER evaluation_findings_append_only_guard
BEFORE UPDATE OR DELETE ON evaluation_findings
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS decision_proposals_append_only_guard ON decision_proposals;
CREATE TRIGGER decision_proposals_append_only_guard
BEFORE UPDATE OR DELETE ON decision_proposals
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS provider_health_checks_append_only_guard ON provider_health_checks;
CREATE TRIGGER provider_health_checks_append_only_guard
BEFORE UPDATE OR DELETE ON provider_health_checks
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('002')
ON CONFLICT (migration_id) DO NOTHING;
