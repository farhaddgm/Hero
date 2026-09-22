const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;
const SENSITIVE = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
// Runtime plans contain policy flags such as `secretWrite: false`.  That is
// a safe, non-secret assertion about a blocked effect, not credential data.
// Keep the exception narrow and type-bound so actual secret-bearing fields
// remain rejected by the persistence boundary.
function isSafePolicyFlag(key, value) { return key === "secretWrite" && typeof value === "boolean"; }

function copy(value) { return Object.freeze(structuredClone(value)); }
function assertId(label, value) { if (typeof value !== "string" || !ID.test(value)) throw new ProjectWorkspaceStoreError("INVALID_IDENTIFIER", `${label} is invalid.`); return value; }
function safe(value, path = "data") { if (Array.isArray(value)) return value.forEach((item, index) => safe(item, `${path}[${index}]`)); if (!value || typeof value !== "object") return; for (const [key, child] of Object.entries(value)) { if (SENSITIVE.test(key) && !isSafePolicyFlag(key, child)) throw new ProjectWorkspaceStoreError("SENSITIVE_PERSISTENCE_FORBIDDEN", `${path}.${key} is forbidden.`); safe(child, `${path}.${key}`); } }
function targetOf({ client, pool }) { if (client?.query) return client; if (pool?.query) return pool; throw new Error("Project workspace store requires an injected PostgreSQL client or pool."); }
async function transaction(target, action) {
  const connection = typeof target.connect === "function" ? await target.connect() : target;
  try {
    await connection.query("BEGIN");
    const result = await action(connection);
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    try { await connection.query("ROLLBACK"); } catch { /* preserve the original failure */ }
    throw error;
  } finally {
    if (connection !== target && typeof connection.release === "function") connection.release();
  }
}

export class ProjectWorkspaceStoreError extends Error { constructor(code, message) { super(message); this.name = "ProjectWorkspaceStoreError"; this.code = code; } }

/** Append-only metadata persistence. Private object bytes remain behind the
 * injected object-storage adapter and never enter PostgreSQL JSON columns. */
export function createPostgresProjectWorkspaceStore({ client, pool } = {}) {
  const target = targetOf({ client, pool });
  return Object.freeze({
    async appendProject({ projectId, version, name, description = "", lifecycle, status, intake, archivedLifecycle = null, actorId, reason = null }) {
      assertId("projectId", projectId); assertId("actorId", actorId); if (!Number.isInteger(version) || version < 1) throw new ProjectWorkspaceStoreError("INVALID_VERSION", "Project version is invalid."); safe(intake);
      if (archivedLifecycle !== null && typeof archivedLifecycle !== "string") throw new ProjectWorkspaceStoreError("INVALID_ARCHIVED_LIFECYCLE", "Archived lifecycle is invalid.");
      await target.query(`INSERT INTO project_registry_versions (project_id, project_version, name, description, lifecycle, status, intake, archived_lifecycle, actor_id, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [projectId, version, String(name).slice(0, 160), String(description).slice(0, 2000), lifecycle, status, intake, archivedLifecycle, actorId, reason]);
      return copy({ projectId, version, lifecycle, status });
    },
    async appendProjectWithRequest({ projectId, version, name, description = "", lifecycle, status, intake, archivedLifecycle = null, actorId, reason = null, requestId, requestVersion = 1, idempotencyKey, requestFingerprint, requestMetadata = {}, requestState = "accepted" }) {
      assertId("projectId", projectId); assertId("actorId", actorId); assertId("requestId", requestId); assertId("idempotencyKey", idempotencyKey);
      if (!Number.isInteger(version) || version < 1 || !Number.isInteger(requestVersion) || requestVersion < 1) throw new ProjectWorkspaceStoreError("INVALID_VERSION", "Project or request version is invalid.");
      if (typeof requestFingerprint !== "string" || !FINGERPRINT.test(requestFingerprint)) throw new ProjectWorkspaceStoreError("INVALID_FINGERPRINT", "Product request fingerprint is invalid.");
      if (!["accepted", "rejected"].includes(requestState)) throw new ProjectWorkspaceStoreError("INVALID_REQUEST_STATE", "Product request state is invalid.");
      safe(intake); safe(requestMetadata);
      await transaction(target, async connection => {
        await connection.query(`INSERT INTO product_request_versions (request_id, request_version, idempotency_key, request_fingerprint, project_id, state, request_metadata, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [requestId, requestVersion, idempotencyKey, requestFingerprint, projectId, requestState, requestMetadata, actorId]);
        await connection.query(`INSERT INTO project_registry_versions (project_id, project_version, name, description, lifecycle, status, intake, archived_lifecycle, actor_id, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [projectId, version, String(name).slice(0, 160), String(description).slice(0, 2000), lifecycle, status, intake, archivedLifecycle, actorId, reason]);
      });
      return copy({ projectId, version, requestId, requestVersion, idempotencyKey, lifecycle, status });
    },
    async appendProjectWithRequestAndFoundation({ projectId, version, name, description = "", lifecycle, status, intake, archivedLifecycle = null, actorId, reason = null, requestId, requestVersion = 1, idempotencyKey, requestFingerprint, requestMetadata = {}, requestState = "accepted", proposalId, proposalVersion, proposalState, proposal, proposalActorId }) {
      assertId("projectId", projectId); assertId("actorId", actorId); assertId("requestId", requestId); assertId("idempotencyKey", idempotencyKey); assertId("proposalId", proposalId); assertId("proposalActorId", proposalActorId ?? actorId);
      if (!Number.isInteger(version) || version < 1 || !Number.isInteger(requestVersion) || requestVersion < 1 || !Number.isInteger(proposalVersion) || proposalVersion < 1) throw new ProjectWorkspaceStoreError("INVALID_VERSION", "Project, request or proposal version is invalid.");
      if (typeof requestFingerprint !== "string" || !FINGERPRINT.test(requestFingerprint)) throw new ProjectWorkspaceStoreError("INVALID_FINGERPRINT", "Product request fingerprint is invalid.");
      if (!["accepted", "rejected"].includes(requestState)) throw new ProjectWorkspaceStoreError("INVALID_REQUEST_STATE", "Product request state is invalid.");
      if (!["proposed", "revision-requested", "approved", "superseded"].includes(proposalState)) throw new ProjectWorkspaceStoreError("INVALID_PROPOSAL_STATE", "Foundation proposal state is invalid.");
      safe(intake); safe(requestMetadata); safe(proposal);
      await transaction(target, async connection => {
        await connection.query(`INSERT INTO product_request_versions (request_id, request_version, idempotency_key, request_fingerprint, project_id, state, request_metadata, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [requestId, requestVersion, idempotencyKey, requestFingerprint, projectId, requestState, requestMetadata, actorId]);
        await connection.query(`INSERT INTO project_registry_versions (project_id, project_version, name, description, lifecycle, status, intake, archived_lifecycle, actor_id, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [projectId, version, String(name).slice(0, 160), String(description).slice(0, 2000), lifecycle, status, intake, archivedLifecycle, actorId, reason]);
        await connection.query(`INSERT INTO foundation_proposal_versions (proposal_id, project_id, proposal_version, state, proposal, actor_id) VALUES ($1,$2,$3,$4,$5,$6)`, [proposalId, projectId, proposalVersion, proposalState, proposal, proposalActorId ?? actorId]);
      });
      return copy({ projectId, version, requestId, requestVersion, idempotencyKey, proposalId, proposalVersion, lifecycle, status });
    },
    async listProjects() {
      const result = await target.query(`SELECT DISTINCT ON (p.project_id) p.project_id, p.project_version, p.name, p.description, p.lifecycle, p.status, p.intake, p.archived_lifecycle, p.actor_id, p.reason, p.recorded_at, r.request_id, r.request_version, r.idempotency_key, r.request_fingerprint, r.state AS request_state, r.actor_id AS request_actor_id, r.recorded_at AS request_recorded_at FROM project_registry_versions p LEFT JOIN product_request_versions r ON r.project_id = p.project_id AND r.request_version = 1 ORDER BY p.project_id, p.project_version DESC`);
      return Object.freeze((result.rows ?? []).map(row => copy({ projectId: row.project_id, version: row.project_version, name: row.name, description: row.description, lifecycle: row.lifecycle, status: row.status, intake: row.intake ?? {}, archivedLifecycle: row.archived_lifecycle ?? undefined, createdBy: row.actor_id, updatedAt: row.recorded_at, createdAt: row.recorded_at, archiveReason: row.reason ?? undefined, ...(row.request_id ? { productRequest: { requestId: row.request_id, version: row.request_version, idempotencyKey: row.idempotency_key, fingerprint: row.request_fingerprint, projectId: row.project_id, state: row.request_state, submittedBy: row.request_actor_id, submittedAt: row.request_recorded_at } } : {}) })));
    },
    async recordProjectPurge({ projectId, deletedBy, reason, deletedObjectCount = 0 }) {
      assertId("projectId", projectId); assertId("deletedBy", deletedBy);
      if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > 500) throw new ProjectWorkspaceStoreError("INVALID_PURGE_REASON", "Project purge reason is invalid.");
      if (!Number.isInteger(deletedObjectCount) || deletedObjectCount < 0 || deletedObjectCount > 100000) throw new ProjectWorkspaceStoreError("INVALID_PURGE_OBJECT_COUNT", "Project purge object count is invalid.");
      await target.query(`INSERT INTO project_purge_tombstones (project_id, deleted_by, reason, deleted_object_count) VALUES ($1,$2,$3,$4) ON CONFLICT (project_id) DO NOTHING`, [projectId, deletedBy, reason.trim(), deletedObjectCount]);
      return copy({ projectId, deletedBy, deletedObjectCount });
    },
    async listProjectPurgeTombstones() {
      const result = await target.query(`SELECT project_id, deleted_by, reason, deleted_object_count, deleted_at FROM project_purge_tombstones ORDER BY project_id`);
      return Object.freeze((result.rows ?? []).map(row => copy({ projectId: row.project_id, deletedBy: row.deleted_by, reason: row.reason, deletedObjectCount: Number(row.deleted_object_count ?? 0), deletedAt: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : row.deleted_at })));
    },
    async findProductRequest({ idempotencyKey }) {
      assertId("idempotencyKey", idempotencyKey);
      const result = await target.query(`SELECT request_id, request_version, idempotency_key, request_fingerprint, project_id, state, actor_id, recorded_at FROM product_request_versions WHERE idempotency_key = $1 LIMIT 1`, [idempotencyKey]);
      const row = result.rows?.[0];
      return row ? copy({ requestId: row.request_id, version: row.request_version, idempotencyKey: row.idempotency_key, fingerprint: row.request_fingerprint, projectId: row.project_id, state: row.state, submittedBy: row.actor_id, submittedAt: row.recorded_at }) : null;
    },
    async recordInput({ inputId, projectId, type, filename = null, objectKey = null, checksum = null, byteLength = null, scanState, parseState, reviewRequired = false, metadata = {} }) {
      assertId("inputId", inputId); assertId("projectId", projectId); safe(metadata); if (objectKey && !String(objectKey).startsWith(`hero/uploads/${projectId}/`)) throw new ProjectWorkspaceStoreError("OBJECT_SCOPE_INVALID", "Private object key must be project scoped.");
      await target.query(`INSERT INTO project_input_metadata (input_id, project_id, input_type, filename, object_key, checksum_sha256, byte_length, scan_state, parse_state, review_required, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [inputId, projectId, type, filename, objectKey, checksum, byteLength, scanState, parseState, Boolean(reviewRequired), metadata]);
      return copy({ inputId, projectId, type, objectKey, checksum });
    },
    async listInputs({ projectId } = {}) {
      const values = projectId ? [projectId] : [];
      const result = await target.query(`SELECT input_id, project_id, input_type, filename, object_key, checksum_sha256, byte_length, scan_state, parse_state, review_required, metadata, recorded_at FROM project_input_metadata ${projectId ? "WHERE project_id = $1" : ""} ORDER BY recorded_at ASC`, values);
      return Object.freeze((result.rows ?? []).map(row => copy({ uploadId: row.input_id, projectId: row.project_id, type: row.input_type, filename: row.filename, objectKey: row.object_key, checksum: row.checksum_sha256, byteLength: row.byte_length, scan: { state: row.scan_state }, parse: { state: row.parse_state, ...(row.metadata?.parse ?? {}) }, createdAt: row.recorded_at, ...(row.metadata?.public ?? {}) })));
    },
    async appendFoundationProposal({ proposalId, projectId, version, state, proposal, actorId }) {
      assertId("proposalId", proposalId); assertId("projectId", projectId); assertId("actorId", actorId); safe(proposal);
      await target.query(`INSERT INTO foundation_proposal_versions (proposal_id, project_id, proposal_version, state, proposal, actor_id) VALUES ($1,$2,$3,$4,$5,$6)`, [proposalId, projectId, version, state, proposal, actorId]);
      return copy({ proposalId, projectId, version, state });
    },
    async listFoundationProposals({ projectId } = {}) {
      const values = projectId ? [projectId] : [];
      const result = await target.query(`SELECT proposal_id, project_id, proposal_version, state, proposal, actor_id, recorded_at FROM foundation_proposal_versions ${projectId ? "WHERE project_id = $1" : ""} ORDER BY project_id, proposal_version ASC`, values);
      return Object.freeze((result.rows ?? []).map(row => copy({ ...(row.proposal ?? {}), proposalId: row.proposal_id, projectId: row.project_id, version: row.proposal_version, state: row.state, updatedAt: row.recorded_at, createdBy: row.actor_id })));
    },
    async appendSetting({ projectId, path, layer, runId = "", version, value, actorId, reason, impact, rollbackReference = null, source }) {
      assertId("projectId", projectId); assertId("actorId", actorId); safe(value); if (typeof path !== "string" || !path.includes(".")) throw new ProjectWorkspaceStoreError("INVALID_SETTING_PATH", "Setting path is invalid.");
      await target.query(`INSERT INTO project_setting_versions (project_id, setting_path, settings_layer, run_id, setting_version, setting_value, actor_id, reason, impact, rollback_reference, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [projectId, path, layer, runId ?? "", version, value, actorId, reason, impact, rollbackReference, source]);
      return copy({ projectId, path, layer, runId, version });
    },
    async listSettings({ projectId } = {}) {
      const values = projectId ? [projectId] : [];
      const result = await target.query(`SELECT project_id, setting_path, settings_layer, run_id, setting_version, setting_value, actor_id, reason, impact, rollback_reference, source, recorded_at FROM project_setting_versions ${projectId ? "WHERE project_id = $1" : ""} ORDER BY project_id, setting_path, setting_version ASC`, values);
      return Object.freeze((result.rows ?? []).map(row => copy({ projectId: row.project_id, path: row.setting_path, layer: row.settings_layer, runId: row.run_id || null, version: row.setting_version, value: row.setting_value, actor: row.actor_id, reason: row.reason, impact: row.impact, rollbackReference: row.rollback_reference, source: row.source, recordedAt: row.recorded_at, state: "active" })));
    },
    async recordImportPlan({ importId, projectId, repositoryUrl, state, inventory, adoptionPlan, actorId }) {
      assertId("importId", importId); assertId("projectId", projectId); assertId("actorId", actorId); safe(inventory); safe(adoptionPlan);
      await target.query(`INSERT INTO project_import_plans (import_id, project_id, repository_url, state, inventory, adoption_plan, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [importId, projectId, repositoryUrl, state, inventory, adoptionPlan, actorId]);
      return copy({ importId, projectId, state });
    },
    async listImportPlans({ projectId } = {}) {
      const values = projectId ? [projectId] : [];
      const result = await target.query(`SELECT import_id, project_id, repository_url, state, inventory, adoption_plan, actor_id, recorded_at FROM project_import_plans ${projectId ? "WHERE project_id = $1" : ""} ORDER BY recorded_at ASC`, values);
      return Object.freeze((result.rows ?? []).map(row => copy({ importId: row.import_id, projectId: row.project_id, repositoryUrl: row.repository_url, state: row.state, mode: "read-only-inventory", inventory: row.inventory ?? {}, adoptionPlan: row.adoption_plan ?? {}, createdBy: row.actor_id, createdAt: row.recorded_at })));
    },
    async appendSmartTesterError({ projectId, errorId, reportVersion, title, surface, featureKey, severity, summary, findings = [], reproductionSteps = [], limitations = [], sourceReport = {}, actorId }) {
      assertId("projectId", projectId); assertId("errorId", errorId); assertId("actorId", actorId); safe({ findings, reproductionSteps, limitations, sourceReport });
      if (!['none', 'low', 'medium', 'high', 'critical'].includes(severity)) throw new ProjectWorkspaceStoreError("INVALID_ERROR_SEVERITY", "Smart Tester error severity is invalid.");
      await target.query(`INSERT INTO smart_tester_error_documents (project_id, error_id, report_version, title, surface, feature_key, severity, summary, findings, reproduction_steps, limitations, source_report, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [projectId, errorId, String(reportVersion).slice(0, 32), String(title).slice(0, 240), String(surface).slice(0, 120), String(featureKey).slice(0, 160), severity, String(summary).slice(0, 2000), JSON.stringify(findings), JSON.stringify(reproductionSteps), JSON.stringify(limitations), JSON.stringify(sourceReport), actorId]);
      return copy({ projectId, errorId, severity });
    },
    async listSmartTesterErrors({ projectId } = {}) {
      const values = projectId ? [projectId] : [];
      const result = await target.query(`SELECT project_id, error_id, report_version, title, surface, feature_key, severity, summary, findings, reproduction_steps, limitations, source_report, actor_id, recorded_at FROM smart_tester_error_documents ${projectId ? "WHERE project_id = $1" : ""} ORDER BY recorded_at ASC`, values);
      return Object.freeze((result.rows ?? []).map(row => copy({ projectId: row.project_id, errorId: row.error_id, reportVersion: row.report_version, title: row.title, surface: row.surface, featureKey: row.feature_key, severity: row.severity, summary: row.summary, findings: row.findings ?? [], reproductionSteps: row.reproduction_steps ?? [], limitations: row.limitations ?? [], sourceReport: row.source_report ?? {}, actorId: row.actor_id, recordedAt: row.recorded_at })));
    }
  });
}
