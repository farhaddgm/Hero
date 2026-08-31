-- Additive, retry-safe fields and projections for reliability, organization
-- performance and synthetic benchmark evidence. No raw credentials are added.

ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS max_cost_units integer NOT NULL DEFAULT 100000
    CHECK (max_cost_units >= 0 AND max_cost_units <= 100000);

ALTER TABLE ai_invocations
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1
    CHECK (attempts >= 1 AND attempts <= 6),
  ADD COLUMN IF NOT EXISTS latency_ms integer
    CHECK (latency_ms IS NULL OR latency_ms >= 0);

CREATE TABLE IF NOT EXISTS organization_performance_reviews (
  review_id text PRIMARY KEY,
  organization_id text NOT NULL,
  period text NOT NULL,
  team_count integer NOT NULL CHECK (team_count = 11),
  average numeric NOT NULL CHECK (average >= 0 AND average <= 100),
  band text NOT NULL CHECK (band IN ('strong', 'watch', 'intervention')),
  coverage jsonb NOT NULL,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS organization_performance_metrics (
  metric_id text PRIMARY KEY,
  review_id text NOT NULL REFERENCES organization_performance_reviews(review_id),
  team_id text NOT NULL,
  evidence_ref text NOT NULL CHECK (evidence_ref LIKE 'hero://%'),
  scores jsonb NOT NULL,
  average numeric NOT NULL CHECK (average >= 0 AND average <= 100),
  band text NOT NULL CHECK (band IN ('strong', 'watch', 'intervention')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ai_benchmark_runs (
  benchmark_id text PRIMARY KEY,
  provider_id text NOT NULL,
  model_id text NOT NULL,
  profile_id text NOT NULL,
  mode text NOT NULL CHECK (mode = 'synthetic-deterministic'),
  metrics jsonb NOT NULL,
  recommendation_eligible boolean NOT NULL DEFAULT false,
  authority jsonb NOT NULL CHECK (authority->>'canAuthorizeProvider' = 'false'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ai_benchmark_results (
  result_id text PRIMARY KEY,
  benchmark_id text NOT NULL REFERENCES ai_benchmark_runs(benchmark_id),
  case_id text NOT NULL,
  role text NOT NULL,
  status text NOT NULL CHECK (status IN ('completed', 'failed')),
  schema_pass boolean NOT NULL,
  safety_pass boolean NOT NULL,
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  cost_units integer NOT NULL CHECK (cost_units >= 0),
  error_code text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

DROP TRIGGER IF EXISTS organization_performance_reviews_append_only_guard ON organization_performance_reviews;
CREATE TRIGGER organization_performance_reviews_append_only_guard
BEFORE UPDATE OR DELETE ON organization_performance_reviews
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS organization_performance_metrics_append_only_guard ON organization_performance_metrics;
CREATE TRIGGER organization_performance_metrics_append_only_guard
BEFORE UPDATE OR DELETE ON organization_performance_metrics
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS ai_benchmark_runs_append_only_guard ON ai_benchmark_runs;
CREATE TRIGGER ai_benchmark_runs_append_only_guard
BEFORE UPDATE OR DELETE ON ai_benchmark_runs
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

DROP TRIGGER IF EXISTS ai_benchmark_results_append_only_guard ON ai_benchmark_results;
CREATE TRIGGER ai_benchmark_results_append_only_guard
BEFORE UPDATE OR DELETE ON ai_benchmark_results
FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('003')
ON CONFLICT (migration_id) DO NOTHING;
