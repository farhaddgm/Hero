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

test("PostgreSQL project identity store restores users, grants and session revocations without raw secrets", async () => {
  const client = {
    async query(query) {
      if (query.includes("FROM human_users")) return { rows: [{ user_id: "project-admin", email: "admin@example.test", display_name: "Admin", status: "active", password_hash: "hash", password_salt: "salt", mfa_secret_ref: "env:HERO_ADMIN_MFA_SECRET", mfa_required: true, created_at: new Date("2026-09-10T12:00:00.000Z") }] };
      if (query.includes("FROM project_grant_versions")) return { rows: [{ project_id: "project-vpn", user_id: "project-admin", grant_version: 2, role: "admin", status: "active", granted_by: "hero-owner", recorded_at: new Date("2026-09-10T12:00:00.000Z") }] };
      if (query.includes("FROM human_session_revocations")) return { rows: [{ session_id: "human-session-001", user_id: "project-admin", reason: "security-review", revoked_at: new Date("2026-09-10T12:00:00.000Z") }] };
      return { rows: [] };
    }
  };
  const store = createPostgresProjectIdentityStore({ client });
  const users = await store.listUsers();
  const grants = await store.listCurrentGrants();
  const revocations = await store.listSessionRevocations();
  assert.deepEqual(users[0], { userId: "project-admin", email: "admin@example.test", displayName: "Admin", status: "active", passwordHash: "hash", passwordSalt: "salt", mfaSecretRef: "env:HERO_ADMIN_MFA_SECRET", mfaRequired: true, createdAt: "2026-09-10T12:00:00.000Z" });
  assert.deepEqual(grants[0], { projectId: "project-vpn", userId: "project-admin", role: "admin", status: "active", version: 2, grantedBy: "hero-owner", recordedAt: "2026-09-10T12:00:00.000Z" });
  assert.deepEqual(revocations[0], { sessionId: "human-session-001", userId: "project-admin", reason: "security-review", revokedAt: "2026-09-10T12:00:00.000Z" });
});
