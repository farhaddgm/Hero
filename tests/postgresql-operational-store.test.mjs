import assert from "node:assert/strict";
import test from "node:test";

import { createOperationalEvent } from "../packages/contracts/src/operational-data.mjs";
import {
  PostgresAggregateVersionConflictError,
  createPostgresOperationalStore
} from "../packages/adapters/src/postgresql-operational-store.mjs";

const actor = Object.freeze({ kind: "orchestrator", id: "hero-orchestrator" });

function event(eventId = "evt_store_001") {
  return createOperationalEvent({
    eventId,
    aggregateType: "release",
    aggregateId: "REL-001",
    type: "release.registered",
    occurredAt: "2026-08-30T12:00:00.000Z",
    actor,
    data: { projectId: "product-alpha", artifactId: "artifact-alpha", releaseVersion: "1.0.0" }
  });
}

test("PostgreSQL operational store appends an event and outbox record in one transaction", async () => {
  const queries = [];
  const client = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.startsWith("SELECT COALESCE(MAX")) return { rows: [{ version: "0" }] };
      if (text.startsWith("INSERT INTO events")) return { rows: [{ sequence: "7" }] };
      return { rows: [] };
    }
  };
  const stored = await createPostgresOperationalStore({ client }).appendEvent(event(), {
    expectedVersion: 0,
    outbox: { outboxId: "outbox-001", topic: "release.registered" }
  });

  assert.equal(stored.sequence, 7);
  assert.equal(stored.aggregateVersion, 1);
  assert.equal(queries[0].text, "BEGIN");
  assert.match(queries[1].text, /pg_advisory_xact_lock/);
  assert.match(queries[2].text, /MAX\(aggregate_version\)/);
  assert.match(queries[3].text, /INSERT INTO events/);
  assert.match(queries[4].text, /INSERT INTO outbox/);
  assert.equal(queries.at(-1).text, "COMMIT");
  assert.equal(JSON.stringify(queries[4].values[3]).includes("secret"), false);
});

test("PostgreSQL operational store rejects stale aggregate versions and rolls back", async () => {
  const queries = [];
  const client = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.startsWith("SELECT COALESCE(MAX")) return { rows: [{ version: "3" }] };
      return { rows: [] };
    }
  };
  await assert.rejects(
    () => createPostgresOperationalStore({ client }).appendEvent(event("evt_store_002"), { expectedVersion: 2 }),
    error => error instanceof PostgresAggregateVersionConflictError && error.code === "AGGREGATE_VERSION_CONFLICT"
  );
  assert.equal(queries.at(-1).text, "ROLLBACK");
  assert.equal(queries.some(query => query.text.startsWith("INSERT INTO events")), false);
});

test("PostgreSQL operational store maps database event rows through the operational contract", async () => {
  const row = {
    sequence: "8",
    event_id: "evt_store_003",
    aggregate_type: "release",
    aggregate_id: "REL-001",
    aggregate_version: "2",
    event_type: "release.production-approved",
    occurred_at: "2026-08-30T12:01:00.000Z",
    actor_kind: "project-owner",
    actor_id: "hero-owner",
    correlation_id: "REL-001",
    causation_id: "evt_store_002",
    data: { projectId: "product-alpha" },
    schema_version: "1.0"
  };
  const client = {
    async query(text) {
      if (text.startsWith("SELECT sequence")) return { rows: [row] };
      return { rows: [{ version: "2" }] };
    }
  };
  const store = createPostgresOperationalStore({ client });
  assert.deepEqual(await store.readAggregate("release", "REL-001"), [{
    eventId: "evt_store_003",
    aggregateType: "release",
    aggregateId: "REL-001",
    type: "release.production-approved",
    occurredAt: "2026-08-30T12:01:00.000Z",
    actor: { kind: "project-owner", id: "hero-owner" },
    correlationId: "REL-001",
    causationId: "evt_store_002",
    data: { projectId: "product-alpha" },
    schemaVersion: "1.0",
    sequence: 8,
    aggregateVersion: 2
  }]);
  assert.equal(await store.currentVersion("release", "REL-001"), 2);
});
