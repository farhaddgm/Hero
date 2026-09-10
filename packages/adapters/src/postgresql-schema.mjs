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

export const POSTGRES_TABLES = Object.freeze([
  ...INITIAL_TABLES,
  ...AI_TABLES,
  ...AI_RELIABILITY_TABLES,
  ...DOMAIN_SNAPSHOT_TABLES,
  ...OPERATIONS_TABLES,
  ...ACCESS_AUDIT_TABLES,
  ...PRICING_CATALOG_TABLES
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
      if (!sql.includes("CREATE TABLE")) errors.push(`${migration.name} must create tables.`);
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
