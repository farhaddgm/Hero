import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const POSTGRES_SCHEMA_CONTRACT_VERSION = "1.0";

const INITIAL_TABLES = Object.freeze([
  "projects",
  "events",
  "principles",
  "principle_reviews",
  "releases",
  "release_evidence",
  "outbox"
]);

const AI_TABLES = Object.freeze([
  "ai_providers",
  "ai_credentials",
  "ai_models",
  "prompt_versions",
  "agent_profiles",
  "project_agent_bindings",
  "context_snapshots",
  "ai_invocations",
  "evaluations",
  "evaluation_findings",
  "decision_proposals",
  "provider_health_checks"
]);

const AI_RELIABILITY_TABLES = Object.freeze([
  "organization_performance_reviews",
  "organization_performance_metrics",
  "ai_benchmark_runs",
  "ai_benchmark_results"
]);

const DOMAIN_SNAPSHOT_TABLES = Object.freeze(["domain_registry_snapshots"]);
const OPERATIONS_TABLES = Object.freeze(["owner_session_revocations"]);
const ACCESS_AUDIT_TABLES = Object.freeze(["read_model_access_audit"]);
const PRICING_CATALOG_TABLES = Object.freeze(["pricing_catalogs", "pricing_catalog_entries", "pricing_catalog_activations"]);
const NOTION_SYNC_TABLES = Object.freeze(["notion_document_mappings"]);
const BACKOFFICE_FOUNDATION_TABLES = Object.freeze([
  "backoffice_entity_versions",
  "backoffice_event_envelopes",
  "backoffice_inbox_receipts",
  "backoffice_outbox",
  "backoffice_read_model_snapshots"
]);
const PROJECT_IDENTITY_TABLES = Object.freeze([
  "human_users",
  "project_grant_versions",
  "human_session_revocations",
  "human_identity_audit"
]);
const PROJECT_WORKSPACE_TABLES = Object.freeze([
  "project_registry_versions",
  "project_input_metadata",
  "foundation_proposal_versions",
  "project_setting_versions",
  "project_import_plans"
]);
const PRODUCT_REQUEST_TABLES = Object.freeze(["product_request_versions"]);
const PRODUCT_RUNTIME_RESERVATION_TABLES = Object.freeze(["product_runtime_reservations"]);
const PRODUCT_RUNTIME_CAPACITY_TABLES = Object.freeze(["product_runtime_capacity_snapshots"]);
const PRODUCT_RUNTIME_LEASE_TABLES = Object.freeze(["product_runtime_reconciliation_runs"]);
const PROJECT_PURGE_TABLES = Object.freeze(["project_purge_tombstones"]);
const SYSTEM_CATALOG_RECORD_TABLES = Object.freeze(["system_catalog_records"]);
const BACKOFFICE_DOMAIN_RECORD_TABLES = Object.freeze(["backoffice_domain_records"]);
const SMART_TESTER_TABLES = Object.freeze(["smart_tester_error_documents"]);
const COLLABORATION_COMMAND_CATALOG_TABLES = Object.freeze(["collaboration_records", "command_decision_records", "approval_records", "system_catalog_entities", "system_catalog_dependencies"]);
const INTELLIGENCE_NOTIFICATION_TABLES = Object.freeze(["usage_events", "evaluation_records", "health_records", "notification_records", "observability_audit_records", "catalog_drift_proposals"]);
const DELIVERY_HARDENING_READINESS_TABLES = Object.freeze(["infrastructure_control_records", "delivery_control_records", "hardening_control_records", "final_readiness_records"]);

export const POSTGRES_TABLES = Object.freeze([
  ...INITIAL_TABLES,
  ...AI_TABLES,
  ...AI_RELIABILITY_TABLES,
  ...DOMAIN_SNAPSHOT_TABLES,
  ...OPERATIONS_TABLES,
  ...ACCESS_AUDIT_TABLES,
  ...PRICING_CATALOG_TABLES,
  ...NOTION_SYNC_TABLES,
  ...BACKOFFICE_FOUNDATION_TABLES,
  ...PROJECT_IDENTITY_TABLES,
  ...PROJECT_WORKSPACE_TABLES,
  ...PRODUCT_REQUEST_TABLES,
  ...PRODUCT_RUNTIME_RESERVATION_TABLES,
  ...PRODUCT_RUNTIME_CAPACITY_TABLES,
  ...PRODUCT_RUNTIME_LEASE_TABLES,
  ...PROJECT_PURGE_TABLES,
  ...SMART_TESTER_TABLES,
  ...COLLABORATION_COMMAND_CATALOG_TABLES,
  ...INTELLIGENCE_NOTIFICATION_TABLES,
  ...DELIVERY_HARDENING_READINESS_TABLES
]);

export const POSTGRES_MIGRATIONS = Object.freeze([
  Object.freeze({
    id: "001",
    name: "principles-release-audit",
    file: "001_principles_release_audit.sql",
    tables: INITIAL_TABLES
  }),
  Object.freeze({
    id: "002",
    name: "ai-orchestration-projections",
    file: "002_ai_orchestration_projections.sql",
    tables: AI_TABLES
  }),
  Object.freeze({
    id: "003",
    name: "ai-reliability-and-team-performance",
    file: "003_ai_reliability_and_team_performance.sql",
    tables: AI_RELIABILITY_TABLES
  }),
  Object.freeze({
    id: "004",
    name: "domain-registry-snapshots",
    file: "004_domain_registry_snapshots.sql",
    tables: DOMAIN_SNAPSHOT_TABLES
  }),
  Object.freeze({
    id: "005",
    name: "session-revocation-and-outbox-leasing",
    file: "005_session_revocation_outbox_leasing.sql",
    tables: OPERATIONS_TABLES
  }),
  Object.freeze({
    id: "006",
    name: "read-model-access-audit",
    file: "006_read_model_access_audit.sql",
    tables: ACCESS_AUDIT_TABLES
  }),
  Object.freeze({
    id: "007",
    name: "pricing-catalog",
    file: "007_pricing_catalog.sql",
    tables: PRICING_CATALOG_TABLES
  }),
  Object.freeze({
    id: "008",
    name: "notion-document-mappings",
    file: "008_notion_document_mappings.sql",
    tables: NOTION_SYNC_TABLES
  }),
  Object.freeze({
    id: "009",
    name: "backoffice-data-foundation",
    file: "009_backoffice_data_foundation.sql",
    tables: BACKOFFICE_FOUNDATION_TABLES
  }),
  Object.freeze({
    id: "010",
    name: "project-identity-and-grants",
    file: "010_project_identity_and_grants.sql",
    tables: PROJECT_IDENTITY_TABLES
  }),
  Object.freeze({
    id: "011",
    name: "project-workspace-and-settings",
    file: "011_project_workspace_and_settings.sql",
    tables: PROJECT_WORKSPACE_TABLES
  }),
  Object.freeze({
    id: "012",
    name: "collaboration-command-catalog",
    file: "012_collaboration_command_catalog.sql",
    tables: COLLABORATION_COMMAND_CATALOG_TABLES
  }),
  Object.freeze({
    id: "013",
    name: "catalog-intelligence-notifications",
    file: "013_catalog_intelligence_notifications.sql",
    tables: INTELLIGENCE_NOTIFICATION_TABLES
  }),
  Object.freeze({
    id: "014",
    name: "backoffice-delivery-hardening-readiness",
    file: "014_backoffice_delivery_hardening_readiness.sql",
    tables: DELIVERY_HARDENING_READINESS_TABLES
  }),
  Object.freeze({
    id: "015",
    name: "smart-tester-error-documents",
    file: "015_smart_tester_error_documents.sql",
    tables: Object.freeze(["smart_tester_error_documents"])
  }),
  Object.freeze({
    id: "016",
    name: "ai-credential-audit-events",
    file: "016_ai_credential_audit_events.sql",
    tables: Object.freeze(["human_identity_audit"])
  }),
  Object.freeze({
    id: "017",
    name: "product-request-versions",
    file: "017_product_request_versions.sql",
    tables: PRODUCT_REQUEST_TABLES
  }),
  Object.freeze({
    id: "018",
    name: "product-runtime-reservations",
    file: "018_product_runtime_reservations.sql",
    tables: PRODUCT_RUNTIME_RESERVATION_TABLES
  }),
  Object.freeze({
    id: "019",
    name: "product-runtime-capacity",
    file: "019_product_runtime_capacity.sql",
    tables: PRODUCT_RUNTIME_CAPACITY_TABLES
  }),
  Object.freeze({
    id: "020",
    name: "product-runtime-leases",
    file: "020_product_runtime_leases.sql",
    tables: PRODUCT_RUNTIME_LEASE_TABLES
  }),
  Object.freeze({
    id: "021",
    name: "project-purge-tombstones",
    file: "021_project_purge_tombstones.sql",
    tables: PROJECT_PURGE_TABLES
  }),
  Object.freeze({
    id: "022",
    name: "system-catalog-records",
    file: "022_system_catalog_records.sql",
    tables: SYSTEM_CATALOG_RECORD_TABLES
  }),
  Object.freeze({
    id: "023",
    name: "backoffice-domain-records",
    file: "023_backoffice_domain_records.sql",
    tables: BACKOFFICE_DOMAIN_RECORD_TABLES
  }),
  Object.freeze({
    id: "024",
    name: "human-user-mfa-cipher",
    file: "024_human_user_mfa_cipher.sql",
    tables: Object.freeze(["human_identity_lifecycle_events"]),
    alters: Object.freeze(["human_users"])
  })
]);

const migrationsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

function migrationPath(migration) {
  const candidate = path.resolve(migrationsRoot, migration.file);
  const relative = path.relative(migrationsRoot, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("PostgreSQL migration must stay inside the adapter migrations directory.");
  }
  return candidate;
}

export function readPostgresMigration(migrationId) {
  const migration = POSTGRES_MIGRATIONS.find(item => item.id === migrationId);
  if (!migration) throw new Error(`Unknown PostgreSQL migration: ${migrationId}`);
  return fs.readFileSync(migrationPath(migration), "utf8");
}

export function validatePostgresSchemaContract() {
  const errors = [];
  if (POSTGRES_SCHEMA_CONTRACT_VERSION !== "1.0") errors.push("schema version must be 1.0.");
  if (POSTGRES_TABLES.length !== new Set(POSTGRES_TABLES).size) errors.push("table names must be unique.");
  if (POSTGRES_TABLES.some(table => !/^[a-z][a-z0-9_]+$/.test(table))) {
    errors.push("table names must use safe PostgreSQL identifiers.");
  }
  if (POSTGRES_MIGRATIONS.length === 0) errors.push("at least one migration is required.");
  const declaredTables = new Set();
  for (const migration of POSTGRES_MIGRATIONS) {
    if (!/^\d{3}$/.test(migration.id)) errors.push(`${migration.name} has an invalid migration id.`);
    if (!/^\d{3}_[a-z][a-z0-9_-]+\.sql$/.test(migration.file)) errors.push(`${migration.name} has an invalid migration file.`);
    try {
      const sql = readPostgresMigration(migration.id);
      if (!sql.includes("CREATE TABLE") && !(migration.alters && sql.includes("ALTER TABLE"))) errors.push(`${migration.name} must create tables.`);
      for (const table of migration.tables ?? []) {
        declaredTables.add(table);
        if (!sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
          errors.push(`${migration.name} must define ${table}.`);
        }
      }
    } catch (error) {
      errors.push(`${migration.name} cannot be read: ${error.message}`);
    }
  }
  for (const table of POSTGRES_TABLES) {
    if (!declaredTables.has(table)) errors.push(`No migration declares ${table}.`);
  }
  return errors;
}

function assertClient(client) {
  if (!client || typeof client.query !== "function") {
    throw new Error("PostgreSQL migration runner requires an injected client.query function.");
  }
}

export function createPostgresMigrationRunner({ client, migrations = POSTGRES_MIGRATIONS } = {}) {
  assertClient(client);
  const selected = Object.freeze([...migrations]);

  return Object.freeze({
    async migrate() {
      await client.query("BEGIN");
      const applied = [];
      try {
        for (const migration of selected) {
          await client.query(readPostgresMigration(migration.id));
          applied.push(migration.id);
        }
        await client.query("COMMIT");
        return Object.freeze({ schemaVersion: POSTGRES_SCHEMA_CONTRACT_VERSION, applied: Object.freeze(applied) });
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the migration error; the caller still receives a failed transaction.
        }
        throw error;
      }
    }
  });
}
