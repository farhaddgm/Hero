-- Product Test resource leases are mutable lifecycle metadata, not evidence.
-- They contain only project/run/resource identifiers and no artifact secret or
-- credential value. Advisory locking in the adapter serializes reservations.

CREATE TABLE IF NOT EXISTS product_runtime_reservations (
  reservation_id text PRIMARY KEY,
  project_id text NOT NULL,
  run_id text NOT NULL,
  plan_fingerprint text NOT NULL CHECK (plan_fingerprint ~ '^[a-f0-9]{64}$'),
  ports integer[] NOT NULL DEFAULT ARRAY[]::integer[],
  resource_names text[] NOT NULL DEFAULT ARRAY[]::text[],
  state text NOT NULL CHECK (state IN ('active', 'released')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  release_reason text,
  UNIQUE (project_id, run_id)
);

CREATE INDEX IF NOT EXISTS product_runtime_reservations_active_idx
  ON product_runtime_reservations (state, reserved_at DESC);

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('018')
ON CONFLICT (migration_id) DO NOTHING;
