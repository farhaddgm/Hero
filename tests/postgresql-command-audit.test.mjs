import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresCommandAudit } from "../packages/adapters/src/postgresql-command-audit.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

test("PostgreSQL command audit records a safe, paginatable control event", async () => {
  const stored = [];
  const audit = createPostgresCommandAudit({
    now: () => "2026-08-30T12:00:00.000Z",
    eventIdFactory: () => "evt_control_test_001",
    store: {
      async appendEvent(event) {
        const value = { ...event, sequence: 1, aggregateVersion: 1 };
        stored.push(value);
        return value;
      },
      async readAfter() {
        return stored;
      }
    }
  });
  const result = await audit.record({ command: "request.create", projectId: "hero" });
  assert.equal(result.type, "control.command-recorded");
  assert.equal(result.aggregateType, "decision");
  assert.deepEqual(result.data, { command: "request.create", projectId: "hero", outcome: "accepted" });
  assert.equal("input" in result.data, false);
});

test("Control Plane exposes authenticated command audit after a persisted command", async t => {
  const now = () => "2026-08-30T12:00:00.000Z";
  const ownerAuth = createOwnerAuth({ secret: "test-owner-secret-for-audit-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "test-owner", sessionId: "audit-session-001", expiresAt: 2000000000 });
  const events = [];
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    now,
    ownerAuth,
    postgresRuntime: {
      async ping() { return { status: "ok" }; },
      store: { async readAfter(after = 0) { return events.filter(event => event.sequence > after); } },
      audit: {
        async record({ command, projectId }) {
          const event = {
            type: "control.command-recorded",
            sequence: events.length + 1,
            data: { command, projectId, outcome: "accepted" }
          };
          events.push(event);
          return event;
        }
      }
    }
  });
  const address = await app.start();
  t.after(() => app.stop());
  const headers = { authorization: `Bearer ${token}` };

  const denied = await fetch(`http://127.0.0.1:${address.port}/api/audit`);
  assert.equal(denied.status, 401);
  const created = await fetch(`http://127.0.0.1:${address.port}/api/requests`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ title: "درخواست آزمون audit", description: "ثبت فرمان کنترل", projectId: "hero" })
  });
  assert.equal(created.status, 201);
  const auditResponse = await fetch(`http://127.0.0.1:${address.port}/api/audit`, { headers });
  assert.equal(auditResponse.status, 200);
  const payload = await auditResponse.json();
  assert.equal(payload.events.length, 1);
  assert.equal(payload.events[0].data.command, "request.create");
  assert.equal(payload.nextAfter, 1);
});

test("Control Plane records a rejected command without storing its input", async t => {
  const now = () => "2026-08-30T12:00:00.000Z";
  const ownerAuth = createOwnerAuth({ secret: "test-owner-secret-for-rejected-audit-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "test-owner", sessionId: "rejected-audit-session", expiresAt: 2000000000 });
  const events = [];
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    now,
    ownerAuth,
    postgresRuntime: {
      async ping() { return { status: "ok" }; },
      store: { async readAfter(after = 0) { return events.filter(event => event.sequence > after); } },
      audit: {
        async record({ command, projectId, outcome }) {
          const event = { type: "control.command-recorded", sequence: events.length + 1, data: { command, projectId, outcome } };
          events.push(event);
          return event;
        }
      }
    }
  });
  const address = await app.start();
  t.after(() => app.stop());
  const response = await fetch(`http://127.0.0.1:${address.port}/api/requests`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ title: "x", description: "input must not be persisted" })
  });
  assert.equal(response.status, 409);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].data, { command: "request.create", projectId: "hero", outcome: "rejected" });
});
