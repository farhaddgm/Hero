-- Product Runtime leases are safe lifecycle metadata. Reconciliation is
-- report-only by default and never grants a Product Test authorization.

CREATE TABLE IF NOT EXISTS product_runtime_reconciliation_runs (
  reconciliation_id text PRIMARY KEY,
  target_id text NOT NULL DEFAULT 'hero-product-test',
  mode text NOT NULL CHECK (mode IN ('report', 'expire')),
  observed_at timestamptz NOT NULL,
  inspected_count integer NOT NULL CHECK (inspected_count >= 0),
  expired_count integer NOT NULL CHECK (expired_count >= 0),
  unknown_count integer NOT NULL CHECK (unknown_count >= 0),
  decision text NOT NULL CHECK (decision IN ('report-only', 'applied'))
);

ALTER TABLE product_runtime_reservations
  ADD COLUMN IF NOT EXISTS lease_ttl_seconds integer NOT NULL DEFAULT 0 CHECK (lease_ttl_seconds >= 0),
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE product_runtime_reservations
  DROP CONSTRAINT IF EXISTS product_runtime_reservations_state_check;

ALTER TABLE product_runtime_reservations
  ADD CONSTRAINT product_runtime_reservations_state_check CHECK (state IN ('active', 'released', 'expired'));

CREATE INDEX IF NOT EXISTS product_runtime_reservations_expiry_idx
  ON product_runtime_reservations (target_id, state, expires_at ASC);

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('020')
ON CONFLICT (migration_id) DO NOTHING;
