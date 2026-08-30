import assert from "node:assert/strict";
import test from "node:test";

import { PostgresRuntimeError, createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";

test("PostgreSQL runtime migrates, pings and exposes the operational store with an injected client", async () => {
  const queries = [];
  const client = {
    async query(text) {
      queries.push(text);
      if (text === "SELECT 1") return { rows: [{ connected: 1 }] };
      return { rows: [] };
    }
  };
  const runtime = await createPostgresRuntime({ client });
  assert.equal(runtime.configured, true);
  assert.equal(runtime.migration.schemaVersion, "1.0");
  assert.equal((await runtime.ping()).persistence, "postgresql");
  assert.equal(typeof runtime.store.appendEvent, "function");
  assert.equal(queries[0], "BEGIN");
  assert.equal(queries.at(-1), "SELECT 1");
  await runtime.close();
});

test("PostgreSQL runtime fails closed when no connection string or client is supplied", async () => {
  await assert.rejects(
    () => createPostgresRuntime({ connectionString: "" }),
    error => error instanceof PostgresRuntimeError && error.code === "POSTGRES_NOT_CONFIGURED"
  );
});
