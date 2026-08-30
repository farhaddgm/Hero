import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const POSTGRES_SCHEMA_CONTRACT_VERSION = "1.0";

export const POSTGRES_TABLES = Object.freeze([
  "projects",
  "events",
  "principles",
  "principle_reviews",
  "releases",
  "release_evidence",
  "outbox"
]);

export const POSTGRES_MIGRATIONS = Object.freeze([
  Object.freeze({
    id: "001",
    name: "principles-release-audit",
    file: "001_principles_release_audit.sql"
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
  for (const migration of POSTGRES_MIGRATIONS) {
    if (!/^\d{3}$/.test(migration.id)) errors.push(`${migration.name} has an invalid migration id.`);
    if (!/^\d{3}_[a-z][a-z0-9_-]+\.sql$/.test(migration.file)) errors.push(`${migration.name} has an invalid migration file.`);
    try {
      const sql = readPostgresMigration(migration.id);
      if (!sql.includes("CREATE TABLE")) errors.push(`${migration.name} must create tables.`);
      for (const table of POSTGRES_TABLES) {
        if (!sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
          errors.push(`${migration.name} must define ${table}.`);
        }
      }
    } catch (error) {
      errors.push(`${migration.name} cannot be read: ${error.message}`);
    }
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
