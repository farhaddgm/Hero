-- Product Test capacity observations are safe metadata only. They describe
-- available Test capacity and never contain host credentials or command text.

CREATE TABLE IF NOT EXISTS product_runtime_capacity_snapshots (
  snapshot_id text PRIMARY KEY,
  target_id text NOT NULL DEFAULT 'hero-product-test',
  environment text NOT NULL CHECK (environment = 'test'),
  cpu_cores numeric NOT NULL CHECK (cpu_cores > 0),
  memory_mib integer NOT NULL CHECK (memory_mib > 0),
  pids_limit integer NOT NULL CHECK (pids_limit > 0),
  max_concurrent_runs integer NOT NULL CHECK (max_concurrent_runs > 0),
  source text NOT NULL CHECK (source ~ '^[a-z][a-z0-9._:-]{2,127}$'),
  observed_at timestamptz NOT NULL,
  UNIQUE (target_id, observed_at)
);

ALTER TABLE product_runtime_reservations
  ADD COLUMN IF NOT EXISTS target_id text NOT NULL DEFAULT 'hero-product-test',
  ADD COLUMN IF NOT EXISTS capacity_snapshot_id text,
  ADD COLUMN IF NOT EXISTS cpu_cores numeric NOT NULL DEFAULT 0 CHECK (cpu_cores >= 0),
  ADD COLUMN IF NOT EXISTS memory_mib integer NOT NULL DEFAULT 0 CHECK (memory_mib >= 0),
  ADD COLUMN IF NOT EXISTS pids_limit integer NOT NULL DEFAULT 0 CHECK (pids_limit >= 0);

CREATE INDEX IF NOT EXISTS product_runtime_capacity_latest_idx
  ON product_runtime_capacity_snapshots (target_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS product_runtime_reservations_target_active_idx
  ON product_runtime_reservations (target_id, state, reserved_at ASC);

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('019')
ON CONFLICT (migration_id) DO NOTHING;
