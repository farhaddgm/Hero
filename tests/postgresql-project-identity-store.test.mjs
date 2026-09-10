import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresProjectIdentityStore, ProjectIdentityStoreError } from "../packages/adapters/src/index.mjs";

test("PostgreSQL project identity store persists append-only grants and rejects secret-shaped audit data", async () => {
  const queries = [];
  const client = {
    async query(query, params) {
      queries.push({ query, params });
      if (query.startsWith("SELECT COALESCE(MAX(grant_version)")) return { rows: [{ version: "0" }] };
      if (query.startsWith("INSERT INTO project_grant_versions")) return { rows: [{ project_id: "project-vpn", user_id: "project-admin", grant_version: 1, role: "admin", status: "active", granted_by: "hero-owner", recorded_at: "2026-09-10T12:00:00.000Z" }] };
      return { rows: [] };
    }
  };
  const store = createPostgresProjectIdentityStore({ client });
  const grant = await store.appendGrant({ projectId: "project-vpn", userId: "project-admin", role: "admin", grantedBy: "hero-owner" });
  assert.deepEqual(grant, { projectId: "project-vpn", userId: "project-admin", role: "admin", status: "active", version: 1, grantedBy: "hero-owner", recordedAt: "2026-09-10T12:00:00.000Z" });
  await assert.rejects(() => store.recordAudit({ auditId: "audit-001", eventType: "identity.session-issued", outcome: "accepted", data: { password: "never" } }), ProjectIdentityStoreError);
  assert.equal(queries.some(item => item.query.startsWith("INSERT INTO project_grant_versions")), true);
});
