import assert from "node:assert/strict";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

test("read-model access audit records accepted and rejected reads without affecting other routes", async t => {
  const now = () => "2026-09-04T12:00:00.000Z";
  const ownerAuth = createOwnerAuth({ secret: "test-only-access-audit-owner-secret-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "access-audit-http", expiresAt: 2_000_000_000 });
  const entries = [];
  const accessAudit = {
    async record(input) {
      const entry = { sequence: entries.length + 1, accessId: `access-http-${entries.length + 1}`, occurredAt: now(), ...input };
      entries.push(entry);
      return entry;
    },
    async list({ after = 0, limit = 50 } = {}) {
      const page = entries.filter(entry => entry.sequence > after).slice(0, limit);
      return { entries: page, nextAfter: page.at(-1)?.sequence ?? after, hasMore: false };
    }
  };
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth, postgresRuntime: { accessAudit, async ping() { return { status: "ok" }; } } });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/api/ai/benchmarks`)).status, 401);
  const headers = { authorization: `Bearer ${token}` };
  assert.equal((await fetch(`${base}/api/ai/benchmarks`, { headers })).status, 200);
  const auditResponse = await fetch(`${base}/api/audit/read-access?limit=10`, { headers });
  assert.equal(auditResponse.status, 200);
  const audit = await auditResponse.json();
  assert.equal(audit.source, "postgresql");
  assert.equal(audit.audit.entries.some(entry => entry.outcome === "rejected"), true);
  assert.equal(audit.audit.entries.some(entry => entry.outcome === "accepted" && entry.resource === "/api/ai/benchmarks"), true);
  assert.doesNotMatch(JSON.stringify(audit), /Bearer|password|secret|token|query=/i);
});
