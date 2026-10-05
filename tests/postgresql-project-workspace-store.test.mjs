import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresProjectWorkspaceStore, ProjectWorkspaceStoreError } from "../packages/adapters/src/postgresql-project-workspace-store.mjs";

test("project workspace persistence accepts scoped, secret-free metadata only", async () => {
  const queries = []; const store = createPostgresProjectWorkspaceStore({ client: { async query(sql, values) { queries.push({ sql, values }); return { rows: [] }; } } });
  await store.appendProject({ projectId: "project-vpn", version: 1, name: "VPN", lifecycle: "intake", status: "active", intake: { intent: "Build" }, actorId: "hero-owner" });
  await store.recordInput({ inputId: "upload-123", projectId: "project-vpn", type: "text", objectKey: "hero/uploads/project-vpn/upload-123/abc", scanState: "clean", parseState: "parsed" });
  await store.appendSetting({ projectId: "project-vpn", path: "ai.defaultModel", layer: "project-override", version: 1, value: "sol", actorId: "hero-owner", reason: "fit", impact: "cost", source: "project-override" });
  assert.equal(queries.length, 3);
  assert.equal(queries[2].values[5], JSON.stringify("sol"), "jsonb setting values are serialized, not sent as bare text");
  await store.appendSetting({ projectId: "project-vpn", path: "delivery.windows", layer: "project-override", version: 2, value: ["sat", "sun"], actorId: "hero-owner", reason: "fit", impact: "cost", source: "project-override" });
  assert.equal(queries[3].values[5], '["sat","sun"]', "arrays are JSON arrays, not PostgreSQL arrays");
  queries.length = 3;
  await assert.rejects(() => store.recordInput({ inputId: "upload-456", projectId: "project-vpn", type: "text", objectKey: "other/uploads/project-vpn/x", scanState: "clean", parseState: "parsed" }), error => error instanceof ProjectWorkspaceStoreError && error.code === "OBJECT_SCOPE_INVALID");
  await assert.rejects(() => store.appendProject({ projectId: "project-vpn", version: 2, name: "VPN", lifecycle: "active", status: "active", intake: { apiKey: "no" }, actorId: "hero-owner" }), error => error.code === "SENSITIVE_PERSISTENCE_FORBIDDEN");
});

test("Product Request and project metadata are committed together and remain secret-free", async () => {
  const queries = [];
  const store = createPostgresProjectWorkspaceStore({ client: { async query(sql, values) { queries.push({ sql, values }); return { rows: [] }; } } });
  const fingerprint = "a".repeat(64);
  const result = await store.appendProjectWithRequest({ projectId: "project-replay", version: 1, name: "Replayable", lifecycle: "draft", status: "draft", intake: { goal: "safe" }, actorId: "hero-owner", requestId: "product-request-001", idempotencyKey: "product-request-key-001", requestFingerprint: fingerprint, requestMetadata: { projectId: "project-replay", source: "owner-project-intake" } });
  assert.equal(result.requestId, "product-request-001");
  assert.deepEqual(queries.map(item => item.sql), ["BEGIN", "INSERT INTO product_request_versions (request_id, request_version, idempotency_key, request_fingerprint, project_id, state, request_metadata, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", "INSERT INTO project_registry_versions (project_id, project_version, name, description, lifecycle, status, intake, archived_lifecycle, actor_id, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", "COMMIT"]);
  await assert.rejects(() => store.appendProjectWithRequest({ projectId: "project-replay", version: 1, name: "Replayable", lifecycle: "draft", status: "draft", intake: { goal: "safe", apiKey: "never" }, actorId: "hero-owner", requestId: "product-request-002", idempotencyKey: "product-request-key-002", requestFingerprint: fingerprint }), error => error.code === "SENSITIVE_PERSISTENCE_FORBIDDEN");

  const rollbackQueries = [];
  const rollbackStore = createPostgresProjectWorkspaceStore({ client: { async query(sql, values) { rollbackQueries.push({ sql, values }); if (sql.startsWith("INSERT INTO project_registry_versions")) throw new Error("project insert failed"); return { rows: [] }; } } });
  await assert.rejects(() => rollbackStore.appendProjectWithRequest({ projectId: "project-rollback", version: 1, name: "Rollback", lifecycle: "draft", status: "draft", intake: {}, actorId: "hero-owner", requestId: "product-request-rollback", idempotencyKey: "product-request-rollback-key", requestFingerprint: fingerprint }), /project insert failed/);
  assert.equal(rollbackQueries.at(-1).sql, "ROLLBACK");
});

test("new Product Request, Project and Foundation are committed in one transaction", async () => {
  const queries = [];
  const store = createPostgresProjectWorkspaceStore({ client: { async query(sql, values) { queries.push({ sql, values }); return { rows: [] }; } } });
  const result = await store.appendProjectWithRequestAndFoundation({
    projectId: "project-atomic",
    version: 1,
    name: "Atomic",
    lifecycle: "draft",
    status: "draft",
    intake: { goal: "safe" },
    actorId: "hero-owner",
    requestId: "product-request-atomic",
    idempotencyKey: "product-request-atomic-key",
    requestFingerprint: "a".repeat(64),
    requestMetadata: { projectId: "project-atomic", source: "owner-project-intake" },
    proposalId: "foundation-atomic",
    proposalVersion: 1,
    proposalState: "proposed",
    proposal: { suggested: { runtimePlan: { effects: { secretWrite: false } } } }
  });
  assert.equal(result.proposalId, "foundation-atomic");
  assert.deepEqual(queries.map(item => item.sql), ["BEGIN", "INSERT INTO product_request_versions (request_id, request_version, idempotency_key, request_fingerprint, project_id, state, request_metadata, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", "INSERT INTO project_registry_versions (project_id, project_version, name, description, lifecycle, status, intake, archived_lifecycle, actor_id, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", "INSERT INTO foundation_proposal_versions (proposal_id, project_id, proposal_version, state, proposal, actor_id) VALUES ($1,$2,$3,$4,$5,$6)", "COMMIT"]);
  const rollbackQueries = [];
  const rollbackStore = createPostgresProjectWorkspaceStore({ client: { async query(sql, values) { rollbackQueries.push({ sql, values }); if (sql.startsWith("INSERT INTO foundation_proposal_versions")) throw new Error("foundation insert failed"); return { rows: [] }; } } });
  await assert.rejects(() => rollbackStore.appendProjectWithRequestAndFoundation({ projectId: "project-atomic-fail", version: 1, name: "Atomic fail", lifecycle: "draft", status: "draft", intake: {}, actorId: "hero-owner", requestId: "product-request-atomic-fail", idempotencyKey: "product-request-atomic-fail-key", requestFingerprint: "b".repeat(64), proposalId: "foundation-atomic-fail", proposalVersion: 1, proposalState: "proposed", proposal: {} }), /foundation insert failed/);
  assert.equal(rollbackQueries.at(-1).sql, "ROLLBACK");
});

test("Foundation persistence accepts blocked-effect policy flags without weakening secret rejection", async () => {
  const queries = [];
  const store = createPostgresProjectWorkspaceStore({ client: { async query(sql, values) { queries.push({ sql, values }); return { rows: [] }; } } });
  await store.appendFoundationProposal({
    proposalId: "foundation-policy-001",
    projectId: "project-policy",
    version: 1,
    state: "proposed",
    proposal: { suggested: { runtimePlan: { effects: { secretWrite: false } } } },
    actorId: "hero-owner"
  });
  assert.equal(queries.length, 1);
  await assert.rejects(
    () => store.appendFoundationProposal({ proposalId: "foundation-policy-002", projectId: "project-policy", version: 2, state: "proposed", proposal: { secretWrite: "credential-ref" }, actorId: "hero-owner" }),
    error => error instanceof ProjectWorkspaceStoreError && error.code === "SENSITIVE_PERSISTENCE_FORBIDDEN"
  );
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

test("project purge persistence retains only a minimal tombstone for startup exclusion", async () => {
  const queries = [];
  const store = createPostgresProjectWorkspaceStore({ client: { async query(sql, values) {
    queries.push({ sql, values });
    if (sql.includes("FROM project_purge_tombstones")) return { rows: [{ project_id: "project-vpn", deleted_by: "hero-owner", reason: "owner removal", deleted_object_count: 2, deleted_at: "2026-09-21T00:00:00.000Z" }] };
    return { rows: [] };
  } } });
  const recorded = await store.recordProjectPurge({ projectId: "project-vpn", deletedBy: "hero-owner", reason: "owner removal", deletedObjectCount: 2 });
  assert.equal(recorded.projectId, "project-vpn");
  assert.match(queries[0].sql, /INSERT INTO project_purge_tombstones/);
  assert.equal((await store.listProjectPurgeTombstones())[0].deletedObjectCount, 2);
  await assert.rejects(() => store.recordProjectPurge({ projectId: "project-vpn", deletedBy: "hero-owner", reason: "", deletedObjectCount: 0 }), error => error.code === "INVALID_PURGE_REASON");
});

test("project read-model carries Product Request project scope for restart hydration", async () => {
  const client = { async query(sql) {
    if (sql.includes("FROM project_registry_versions")) return { rows: [{ project_id: "project-replay", project_version: 1, name: "Replayable", description: "safe", lifecycle: "draft", status: "draft", intake: { goal: "safe" }, actor_id: "hero-owner", recorded_at: "2026-09-18T00:00:00.000Z", request_id: "product-request-001", request_version: 1, idempotency_key: "product-request-key-001", request_fingerprint: "a".repeat(64), request_state: "accepted", request_actor_id: "hero-owner", request_recorded_at: "2026-09-18T00:00:00.000Z" }] };
    return { rows: [] };
  } };
  const store = createPostgresProjectWorkspaceStore({ client });
  const project = (await store.listProjects())[0];
  assert.equal(project.productRequest.projectId, project.projectId);
});

test("Smart Tester error documents are scoped, append-only and secret-free", async () => {
  const queries = [];
  const store = createPostgresProjectWorkspaceStore({ client: { async query(sql, values) { queries.push({ sql, values }); return { rows: [{ project_id: "project-vpn", error_id: "error-123", report_version: "1.0.0", title: "دفتر خطا", surface: "/workspace", feature_key: "workspace.intake", severity: "medium", summary: "یک یافته", findings: [], reproduction_steps: [], limitations: [], source_report: {}, actor_id: "hero-owner", recorded_at: "2026-09-14T00:00:00.000Z" }] }; } } });
  await store.appendSmartTesterError({ projectId: "project-vpn", errorId: "error-123", reportVersion: "1.0.0", title: "دفتر خطا", surface: "/workspace", featureKey: "workspace.intake", severity: "medium", summary: "یک یافته", findings: [], reproductionSteps: [], limitations: [], sourceReport: {}, actorId: "hero-owner" });
  assert.equal((await store.listSmartTesterErrors({ projectId: "project-vpn" }))[0].errorId, "error-123");
  assert.equal(queries.length, 2);
  await assert.rejects(() => store.appendSmartTesterError({ projectId: "project-vpn", errorId: "error-124", reportVersion: "1.0.0", title: "دفتر خطا", surface: "/workspace", featureKey: "workspace.intake", severity: "medium", summary: "x", findings: [{ secret: "no" }], actorId: "hero-owner" }), error => error instanceof ProjectWorkspaceStoreError && error.code === "SENSITIVE_PERSISTENCE_FORBIDDEN");
});
