import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresReadModelAccessAuditStore } from "../packages/adapters/src/index.mjs";

test("read-model access audit stores bounded route metadata without query strings or credentials", async () => {
  const rows = [];
  const client = {
    async query(text, params = []) {
      if (text.startsWith("INSERT INTO read_model_access_audit")) {
        const [accessId, actorKind, actorId, resource, method, outcome, occurredAt] = params;
        const row = { sequence: rows.length + 1, access_id: accessId, actor_kind: actorKind, actor_id: actorId, resource, method, outcome, occurred_at: occurredAt };
        rows.push(row);
        return { rows: [row] };
      }
      if (text.startsWith("SELECT sequence")) {
        return { rows: rows.filter(row => row.sequence > params[0]).slice(0, params[1]) };
      }
      throw new Error(`unexpected query: ${text}`);
    }
  };
  let accessNumber = 0;
  const store = createPostgresReadModelAccessAuditStore({ client, now: () => "2026-09-04T12:00:00.000Z", accessIdFactory: () => `access-test-${++accessNumber}` });
  const entry = await store.record({ actorKind: "project-owner", actorId: "hero-owner", resource: "/api/ai/benchmarks", outcome: "accepted" });
  assert.equal(entry.resource, "/api/ai/benchmarks");
  assert.equal(entry.sequence, 1);
  const rejected = await store.record({ resource: "/backoffice", outcome: "rejected" });
  assert.equal(rejected.actorKind, "anonymous");
  const page = await store.list({ after: 0, limit: 10 });
  assert.equal(page.entries.length, 2);
  assert.equal(page.nextAfter, 2);
  assert.equal(page.hasMore, false);
  assert.doesNotMatch(JSON.stringify(rows), /query|password|secret|token|credential/i);
  await assert.rejects(() => store.record({ resource: "/unknown" }), error => error.code === "INVALID_RESOURCE");
  await assert.rejects(() => store.list({ limit: 0 }), error => error.code === "INVALID_LIMIT");
});
