import assert from "node:assert/strict";
import test from "node:test";

import {
  POSTGRES_MIGRATIONS,
  POSTGRES_TABLES,
  createPostgresMigrationRunner,
  readPostgresMigration,
  validatePostgresSchemaContract
} from "../packages/adapters/src/postgresql-schema.mjs";

test("PostgreSQL schema contract covers append-only audit and release boundaries", () => {
  assert.deepEqual(validatePostgresSchemaContract(), []);
  assert.deepEqual(POSTGRES_TABLES, [
    "projects",
    "events",
    "principles",
    "principle_reviews",
    "releases",
    "release_evidence",
    "outbox"
  ]);
  const sql = readPostgresMigration("001");
  assert.match(sql, /sequence bigint GENERATED ALWAYS AS IDENTITY/);
  assert.match(sql, /UNIQUE \(aggregate_type, aggregate_id, aggregate_version\)/);
  assert.match(sql, /hero_reject_append_only_mutation/);
  assert.match(sql, /production_authorization_reference/);
});

test("PostgreSQL migration runner is transaction-bound and requires an injected client", async () => {
  const queries = [];
  const client = {
    async query(query) {
      queries.push(query);
      return { rowCount: 0 };
    }
  };
  const result = await createPostgresMigrationRunner({ client }).migrate();
  assert.deepEqual(result.applied, POSTGRES_MIGRATIONS.map(migration => migration.id));
  assert.equal(queries[0], "BEGIN");
  assert.match(queries[1], /CREATE TABLE IF NOT EXISTS events/);
  assert.equal(queries.at(-1), "COMMIT");
  assert.throws(() => createPostgresMigrationRunner(), /injected client\.query/);
});

test("PostgreSQL migration runner rolls back when a migration fails", async () => {
  const queries = [];
  const client = {
    async query(query) {
      queries.push(query);
      if (query !== "BEGIN" && query !== "ROLLBACK") throw new Error("database unavailable");
      return { rowCount: 0 };
    }
  };
  await assert.rejects(() => createPostgresMigrationRunner({ client }).migrate(), /database unavailable/);
  assert.deepEqual(queries, ["BEGIN", readPostgresMigration("001"), "ROLLBACK"]);
});
