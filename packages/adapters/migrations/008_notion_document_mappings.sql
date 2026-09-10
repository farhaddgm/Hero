-- Current rebuildable mapping between a canonical Hero document and its Notion projection.
-- This table is operational state; canonical content remains in Git.

CREATE TABLE IF NOT EXISTS notion_document_mappings (
  document_id text PRIMARY KEY,
  page_id text NOT NULL UNIQUE,
  canonical_commit text NOT NULL,
  source_checksum text NOT NULL CHECK (source_checksum ~ '^[a-f0-9]{64}$'),
  notion_checksum text CHECK (notion_checksum IS NULL OR notion_checksum ~ '^[a-f0-9]{64}$'),
  sync_state text NOT NULL CHECK (sync_state IN ('not-configured', 'planned', 'pending', 'in-sync', 'source-ahead', 'notion-ahead', 'conflict', 'blocked', 'superseded')),
  edit_policy text NOT NULL CHECK (edit_policy IN ('mirror-only', 'protected-proposal', 'proposal-editable', 'notion-working-note')),
  last_successful_sync timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS notion_document_mappings_state_idx
  ON notion_document_mappings (sync_state, updated_at DESC, document_id ASC);

INSERT INTO hero_schema_migrations (migration_id)
VALUES ('008')
ON CONFLICT (migration_id) DO NOTHING;
