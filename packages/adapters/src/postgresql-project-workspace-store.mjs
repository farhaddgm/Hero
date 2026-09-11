const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SENSITIVE = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;

function copy(value) { return Object.freeze(structuredClone(value)); }
function assertId(label, value) { if (typeof value !== "string" || !ID.test(value)) throw new ProjectWorkspaceStoreError("INVALID_IDENTIFIER", `${label} is invalid.`); return value; }
function safe(value, path = "data") { if (Array.isArray(value)) return value.forEach((item, index) => safe(item, `${path}[${index}]`)); if (!value || typeof value !== "object") return; for (const [key, child] of Object.entries(value)) { if (SENSITIVE.test(key)) throw new ProjectWorkspaceStoreError("SENSITIVE_PERSISTENCE_FORBIDDEN", `${path}.${key} is forbidden.`); safe(child, `${path}.${key}`); } }
function targetOf({ client, pool }) { if (client?.query) return client; if (pool?.query) return pool; throw new Error("Project workspace store requires an injected PostgreSQL client or pool."); }

export class ProjectWorkspaceStoreError extends Error { constructor(code, message) { super(message); this.name = "ProjectWorkspaceStoreError"; this.code = code; } }

/** Append-only metadata persistence. Private object bytes remain behind the
 * injected object-storage adapter and never enter PostgreSQL JSON columns. */
export function createPostgresProjectWorkspaceStore({ client, pool } = {}) {
  const target = targetOf({ client, pool });
  return Object.freeze({
    async appendProject({ projectId, version, name, description = "", lifecycle, status, intake, actorId, reason = null }) {
      assertId("projectId", projectId); assertId("actorId", actorId); if (!Number.isInteger(version) || version < 1) throw new ProjectWorkspaceStoreError("INVALID_VERSION", "Project version is invalid."); safe(intake);
      await target.query(`INSERT INTO project_registry_versions (project_id, project_version, name, description, lifecycle, status, intake, actor_id, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [projectId, version, String(name).slice(0, 160), String(description).slice(0, 2000), lifecycle, status, intake, actorId, reason]);
      return copy({ projectId, version, lifecycle, status });
    },
    async listProjects() {
      const result = await target.query(`SELECT DISTINCT ON (project_id) project_id, project_version, name, description, lifecycle, status, intake, actor_id, reason, recorded_at FROM project_registry_versions ORDER BY project_id, project_version DESC`);
      return Object.freeze((result.rows ?? []).map(row => copy({ projectId: row.project_id, version: row.project_version, name: row.name, description: row.description, lifecycle: row.lifecycle, status: row.status, intake: row.intake ?? {}, createdBy: row.actor_id, updatedAt: row.recorded_at, createdAt: row.recorded_at, archiveReason: row.reason ?? undefined })));
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
    }
  });
}
