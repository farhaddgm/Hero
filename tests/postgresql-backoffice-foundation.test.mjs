import assert from "node:assert/strict";
import test from "node:test";

import { createBackofficeEventEnvelope, createBackofficeEntityVersion } from "../packages/domain/src/backoffice-event-envelope.mjs";
import { createPostgresBackofficeFoundationStore, BackofficeAggregateVersionConflictError, BackofficeFoundationStoreError } from "../packages/adapters/src/index.mjs";

function makeEvent(overrides = {}) {
  return createBackofficeEventEnvelope({
    eventId: "evt_pg_001",
    aggregateType: "project",
    aggregateId: "project-vpn",
    aggregateVersion: 1,
    type: "project.requested",
    occurredAt: "2026-09-10T10:00:00.000Z",
    actor: { kind: "project-owner", id: "owner-1" },
    projectId: "project-vpn",
    correlationId: "corr-pg-001",
    idempotencyKey: "cmd-pg-001",
    data: { name: "VPN" },
    ...overrides
  });
}

test("PostgreSQL Back Office foundation store validates and writes event/entity boundaries", async () => {
  const queries = [];
  const client = {
    async query(query, params) {
      queries.push({ query, params });
      if (query.startsWith("INSERT INTO backoffice_inbox_receipts")) {
        return { rows: [{ consumer_id: "read-model-1", idempotency_key: "cmd-pg-001", event_id: "evt_pg_001", event_digest: "0".repeat(64), result: { accepted: true }, processed_at: "2026-09-10T10:00:00.000Z" }] };
      }
      return { rows: [] };
    }
  };
  const store = createPostgresBackofficeFoundationStore({ client });
  const entity = createBackofficeEntityVersion({ entityType: "project", entityId: "project-vpn", projectId: "project-vpn", version: 1, data: { name: "VPN" } });
  const event = makeEvent();
  assert.deepEqual(await store.appendEntityVersion(entity), entity);
  assert.deepEqual(await store.appendEventEnvelope(event, { outbox: { outboxId: "outbox-1", topic: "backoffice.event" } }), event);
  await assert.rejects(() => store.appendEventEnvelope({ ...event, data: { secret: "no" } }), BackofficeFoundationStoreError);
  assert.equal(queries.filter(item => item.query.startsWith("INSERT INTO")).length, 3);
});

test("PostgreSQL Back Office foundation store requires a database target", () => {
  assert.throws(() => createPostgresBackofficeFoundationStore(), /injected client\.query/);
});

test("PostgreSQL Back Office foundation store rejects stale aggregate writes", async () => {
  const client = {
    async query(query) {
      if (query.startsWith("SELECT COALESCE(MAX(aggregate_version)")) return { rows: [{ version: "1" }] };
      return { rows: [] };
    }
  };
  const store = createPostgresBackofficeFoundationStore({ client });
  await assert.rejects(() => store.appendEventEnvelope(makeEvent()), BackofficeAggregateVersionConflictError);
});
