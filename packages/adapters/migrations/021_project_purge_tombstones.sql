-- A permanently deleted project must not reappear during startup hydration.
-- This table deliberately retains only the minimum non-secret deletion audit
-- record. The application records this tombstone before irreversible private
-- object cleanup so a failed cleanup can never revive the project on restart.

CREATE TABLE IF NOT EXISTS project_purge_tombstones (
  project_id text PRIMARY KEY,
  deleted_by text NOT NULL,
  reason text NOT NULL,
  deleted_object_count integer NOT NULL DEFAULT 0 CHECK (deleted_object_count >= 0),
  deleted_at timestamptz NOT NULL DEFAULT now()
);

-- Archive is reversible. Persist the prior lifecycle with each versioned
-- project row so a restart between archive and restore does not downgrade an
-- active project to draft.
ALTER TABLE project_registry_versions
  ADD COLUMN IF NOT EXISTS archived_lifecycle text;

INSERT INTO hero_schema_migrations (migration_id) VALUES ('021') ON CONFLICT (migration_id) DO NOTHING;
