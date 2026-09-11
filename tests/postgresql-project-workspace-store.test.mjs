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

test("project workspace store reads latest projects and all append-only metadata", async () => {
  const client = { async query(sql) {
    if (sql.includes("FROM project_registry_versions")) return { rows: [{ project_id: "project-vpn", project_version: 2, name: "VPN", description: "Private", lifecycle: "active", status: "active", intake: { goal: "connect" }, actor_id: "hero-owner", recorded_at: "2026-09-11T10:00:00.000Z" }] };
    if (sql.includes("FROM project_input_metadata")) return { rows: [{ input_id: "upload-1", project_id: "project-vpn", input_type: "text", filename: "brief.txt", object_key: "hero/uploads/project-vpn/upload-1/hash", checksum_sha256: "hash", byte_length: 12, scan_state: "clean", parse_state: "parsed", review_required: false, metadata: {}, recorded_at: "2026-09-11T10:00:00.000Z" }] };
    if (sql.includes("FROM foundation_proposal_versions")) return { rows: [{ proposal_id: "foundation-1", project_id: "project-vpn", proposal_version: 1, state: "proposed", proposal: { suggested: { roadmap: [] } }, actor_id: "hero-owner", recorded_at: "2026-09-11T10:00:00.000Z" }] };
    if (sql.includes("FROM project_setting_versions")) return { rows: [{ project_id: "project-vpn", setting_path: "ai.defaultModel", settings_layer: "project-override", run_id: "", setting_version: 1, setting_value: "luna", actor_id: "hero-owner", reason: "fit", impact: "cost", rollback_reference: null, source: "project-override", recorded_at: "2026-09-11T10:00:00.000Z" }] };
    if (sql.includes("FROM project_import_plans")) return { rows: [{ import_id: "import-1", project_id: "project-vpn", repository_url: "https://github.com/acme/vpn", state: "awaiting-separate-fetch-authorization", inventory: {}, adoption_plan: {}, actor_id: "hero-owner", recorded_at: "2026-09-11T10:00:00.000Z" }] };
    return { rows: [] };
  } };
  const store = createPostgresProjectWorkspaceStore({ client });
  assert.equal((await store.listProjects())[0].version, 2);
  assert.equal((await store.listInputs({ projectId: "project-vpn" }))[0].checksum, "hash");
  assert.equal((await store.listFoundationProposals())[0].state, "proposed");
  assert.equal((await store.listSettings({ projectId: "project-vpn" }))[0].value, "luna");
  assert.equal((await store.listImportPlans())[0].repositoryUrl, "https://github.com/acme/vpn");
});
