import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresProjectWorkspaceStore, ProjectWorkspaceStoreError } from "../packages/adapters/src/postgresql-project-workspace-store.mjs";

test("project workspace persistence accepts scoped, secret-free metadata only", async () => {
  const queries = []; const store = createPostgresProjectWorkspaceStore({ client: { async query(sql, values) { queries.push({ sql, values }); return { rows: [] }; } } });
  await store.appendProject({ projectId: "project-vpn", version: 1, name: "VPN", lifecycle: "intake", status: "active", intake: { intent: "Build" }, actorId: "hero-owner" });
  await store.recordInput({ inputId: "upload-123", projectId: "project-vpn", type: "text", objectKey: "hero/uploads/project-vpn/upload-123/abc", scanState: "clean", parseState: "parsed" });
  await store.appendSetting({ projectId: "project-vpn", path: "ai.defaultModel", layer: "project-override", version: 1, value: "sol", actorId: "hero-owner", reason: "fit", impact: "cost", source: "project-override" });
  assert.equal(queries.length, 3);
  await assert.rejects(() => store.recordInput({ inputId: "upload-456", projectId: "project-vpn", type: "text", objectKey: "other/uploads/project-vpn/x", scanState: "clean", parseState: "parsed" }), error => error instanceof ProjectWorkspaceStoreError && error.code === "OBJECT_SCOPE_INVALID");
  await assert.rejects(() => store.appendProject({ projectId: "project-vpn", version: 2, name: "VPN", lifecycle: "active", status: "active", intake: { apiKey: "no" }, actorId: "hero-owner" }), error => error.code === "SENSITIVE_PERSISTENCE_FORBIDDEN");
});
