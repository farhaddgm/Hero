-- Project Registry, private input metadata, Foundation Proposal and effective
-- Settings. Object bytes and raw credentials are intentionally excluded.

CREATE TABLE IF NOT EXISTS project_registry_versions (
  project_id text NOT NULL,
  project_version integer NOT NULL CHECK (project_version > 0),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  lifecycle text NOT NULL CHECK (lifecycle IN ('draft', 'intake', 'foundation-review', 'active', 'archived', 'deletion-requested')),
  status text NOT NULL,
  intake jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id text NOT NULL,
  reason text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, project_version)
);

CREATE TABLE IF NOT EXISTS project_input_metadata (
  input_id text PRIMARY KEY,
  project_id text NOT NULL,
  input_type text NOT NULL CHECK (input_type IN ('text', 'pdf', 'word', 'excel', 'image', 'zip', 'link', 'github-repository')),
  filename text,
  object_key text,
  checksum_sha256 text,
  byte_length bigint,
  scan_state text NOT NULL CHECK (scan_state IN ('clean', 'rejected', 'pending-separate-authorization')),
  parse_state text NOT NULL,
  review_required boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS foundation_proposal_versions (
  proposal_id text NOT NULL,
  project_id text NOT NULL,
  proposal_version integer NOT NULL CHECK (proposal_version > 0),
  state text NOT NULL CHECK (state IN ('proposed', 'revision-requested', 'approved', 'superseded')),
  proposal jsonb NOT NULL,
  actor_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, proposal_version)
);

CREATE TABLE IF NOT EXISTS project_setting_versions (
  project_id text NOT NULL,
  setting_path text NOT NULL,
  settings_layer text NOT NULL CHECK (settings_layer IN ('hero-invariant', 'policy-template', 'project-override', 'run-override')),
  run_id text NOT NULL DEFAULT '',
  setting_version integer NOT NULL CHECK (setting_version > 0),
  setting_value jsonb NOT NULL,
  actor_id text NOT NULL,
  reason text NOT NULL,
  impact text NOT NULL,
  rollback_reference text,
  source text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, setting_path, settings_layer, run_id, setting_version)
);

CREATE TABLE IF NOT EXISTS project_import_plans (
  import_id text PRIMARY KEY,
  project_id text NOT NULL,
  repository_url text NOT NULL,
  state text NOT NULL CHECK (state IN ('awaiting-separate-fetch-authorization', 'inventory-recorded', 'superseded')),
  inventory jsonb NOT NULL DEFAULT '{}'::jsonb,
  adoption_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_input_metadata_project_idx ON project_input_metadata (project_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS project_setting_versions_project_idx ON project_setting_versions (project_id, setting_path, recorded_at DESC);

DROP TRIGGER IF EXISTS project_registry_versions_append_only_guard ON project_registry_versions;
CREATE TRIGGER project_registry_versions_append_only_guard BEFORE UPDATE OR DELETE ON project_registry_versions FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
DROP TRIGGER IF EXISTS foundation_proposal_versions_append_only_guard ON foundation_proposal_versions;
CREATE TRIGGER foundation_proposal_versions_append_only_guard BEFORE UPDATE OR DELETE ON foundation_proposal_versions FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();
DROP TRIGGER IF EXISTS project_setting_versions_append_only_guard ON project_setting_versions;
CREATE TRIGGER project_setting_versions_append_only_guard BEFORE UPDATE OR DELETE ON project_setting_versions FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id) VALUES ('011') ON CONFLICT (migration_id) DO NOTHING;
