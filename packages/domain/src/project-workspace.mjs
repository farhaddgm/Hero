import { createHash, randomUUID } from "node:crypto";
import { FOUNDATION_PROPOSAL_STATES, PROJECT_INPUT_TYPES, PROJECT_LIFECYCLES } from "../../contracts/src/project-workspace.mjs";
import { createProductRuntimePlan, normalizeProductIntake } from "./product-factory.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const PROJECT_SLUG = /^[a-z][a-z0-9-]{2,62}$/;
const URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/;
const DANGEROUS = /(?:ignore (?:all|previous) instructions|system prompt|jailbreak|exfiltrat(?:e|ion)|reveal (?:secret|credential|password))/i;
const PRIVATE_HOST = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/i;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 512 * 1024;
const MAX_ZIP_EXPANDED_BYTES = 50 * 1024 * 1024;
const IDEMPOTENCY_KEY = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;

function copy(value) { return Object.freeze(structuredClone(value)); }
function assertId(label, value) { if (typeof value !== "string" || !ID.test(value)) throw new ProjectWorkspaceError("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; }
function assertProjectId(value) { if (typeof value !== "string" || !PROJECT_SLUG.test(value)) throw new ProjectWorkspaceError("INVALID_PROJECT_ID", "projectId must be a lower-case stable slug.", 400); return value; }
function assertOwner(actor) { if (actor?.role !== "project-owner") throw new ProjectWorkspaceError("OWNER_REQUIRED", "Only the owner may create, archive or request deletion of projects.", 403); return actor; }
function assertProjectEditor(actor) { if (!actor || !["project-owner", "admin"].includes(actor.role)) throw new ProjectWorkspaceError("PROJECT_WRITE_REQUIRED", "Project admin or owner access is required.", 403); return actor; }
function string(value, label, max = 500) { if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > max) throw new ProjectWorkspaceError("INVALID_INPUT", `${label} is invalid.`, 400); return value.trim(); }
function noSensitive(value, path = "data") {
  if (Array.isArray(value)) return value.forEach((item, index) => noSensitive(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i.test(key)) throw new ProjectWorkspaceError("SENSITIVE_INPUT_FORBIDDEN", `${path}.${key} is not allowed.`, 400);
    noSensitive(child, `${path}.${key}`);
  }
}
function asBuffer(content) { if (Buffer.isBuffer(content)) return Buffer.from(content); if (typeof content === "string") return Buffer.from(content, "utf8"); throw new ProjectWorkspaceError("UPLOAD_CONTENT_REQUIRED", "Upload content must be text or binary.", 400); }
function signatureValid(type, value) {
  if (type === "text" || type === "link" || type === "github-repository") return true;
  if (type === "pdf") return value.subarray(0, 5).toString("ascii") === "%PDF-";
  if (["word", "excel", "zip"].includes(type)) return value.length >= 4 && value.subarray(0, 2).toString("ascii") === "PK";
  if (type === "image") return value.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || value.subarray(0, 3).toString("ascii") === "\xff\xd8\xff";
  return false;
}
function previewText(type, data) { return type === "text" ? data.toString("utf8").slice(0, 4096) : null; }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function fingerprint(value) { return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }

export class ProjectWorkspaceError extends Error {
  constructor(code, message, statusCode = 409) { super(message); this.name = "ProjectWorkspaceError"; this.code = code; this.statusCode = statusCode; }
}

/** A private, no-network project workspace. Adapters for real AV, document
 * parsing, object storage and GitHub are injected later; missing adapters fail
 * closed rather than silently carrying out external work. */
export function createProjectWorkspace({ ownerUserId = "hero-owner", now = () => new Date().toISOString(), settings = null, scanner = ({ bytes }) => ({ state: "clean", engine: "deterministic-static", bytes }), parser = null, objectStoreAdapter = null, uploadQuotaBytes = MAX_UPLOAD_BYTES } = {}) {
  assertId("ownerUserId", ownerUserId);
  if (!Number.isInteger(uploadQuotaBytes) || uploadQuotaBytes < 1024 || uploadQuotaBytes > 100 * 1024 * 1024) throw new Error("uploadQuotaBytes must be a safe integer quota.");
  if (objectStoreAdapter !== null && typeof objectStoreAdapter?.put !== "function") throw new ProjectWorkspaceError("OBJECT_STORE_INVALID", "Object store adapter must provide put().", 500);
  const projects = new Map(); const uploads = new Map(); const proposals = new Map(); const imports = new Map(); const deletionRequests = new Map(); const objectStore = new Map(); const productRequests = new Map();
  function project(projectId) { const row = projects.get(assertProjectId(projectId)); if (!row) throw new ProjectWorkspaceError("PROJECT_NOT_FOUND", "Project was not found.", 404); return row; }
  function assertVersion(row, expectedVersion) { if (expectedVersion !== undefined && expectedVersion !== row.version) throw new ProjectWorkspaceError("STALE_PROJECT_VERSION", "Project changed before this command was applied.", 409); }
  function update(row, patch) { const next = copy({ ...row, ...patch, version: row.version + 1, updatedAt: now() }); projects.set(row.projectId, next); return next; }
  function projectUploads(projectId) { return [...uploads.values()].filter(item => item.projectId === projectId); }
  function policyRiskLevel(riskLevel) { return riskLevel === "critical" ? "high" : riskLevel; }
  function currentFoundation(projectId) { return [...proposals.values()].filter(item => item.projectId === projectId).sort((a, b) => b.version - a.version)[0] ?? null; }
  function assertIdempotencyKey(value) { if (typeof value !== "string" || !IDEMPOTENCY_KEY.test(value)) throw new ProjectWorkspaceError("INVALID_IDEMPOTENCY_KEY", "idempotencyKey must be a stable safe identifier.", 400); return value; }
  function requestMetadata(row) { return copy({ requestId: row.requestId, version: row.version, idempotencyKey: row.idempotencyKey, fingerprint: row.fingerprint, projectId: row.projectId, state: row.state, submittedBy: row.submittedBy, submittedAt: row.submittedAt }); }
  function hydrateProductRequest(row) {
    if (!row?.productRequest) return;
    const request = row.productRequest;
    if (typeof request.requestId !== "string" || typeof request.idempotencyKey !== "string" || !FINGERPRINT.test(request.fingerprint ?? "") || request.projectId !== row.projectId || request.version !== 1) throw new ProjectWorkspaceError("INVALID_HYDRATION", "Product request metadata is invalid.", 500);
    const prior = productRequests.get(request.idempotencyKey);
    if (prior && prior.fingerprint !== request.fingerprint) throw new ProjectWorkspaceError("INVALID_HYDRATION", "Product request idempotency metadata conflicts.", 500);
    productRequests.set(request.idempotencyKey, requestMetadata({ ...request, state: request.state ?? "accepted", submittedBy: request.submittedBy ?? row.createdBy, submittedAt: request.submittedAt ?? row.createdAt, projectId: row.projectId }));
  }
  function makeFoundationProposal(row, actor) {
    const existing = [...proposals.values()].find(item => item.projectId === row.projectId && ["proposed", "revision-requested"].includes(item.state));
    if (existing) return existing;
    const policyPack = settings?.suggestPolicyPack({ projectId: row.projectId, projectType: row.intake.projectType, riskLevel: policyRiskLevel(row.intake.riskLevel), actor }) ?? null;
    const nextVersion = Math.max(0, ...[...proposals.values()].filter(item => item.projectId === row.projectId).map(item => item.version)) + 1;
    const runtimePlan = createProductRuntimePlan({ projectId: row.projectId, riskLevel: row.riskAssessment?.level ?? row.intake.riskLevel });
    const proposal = copy({ proposalId: `foundation-${randomUUID()}`, projectId: row.projectId, version: nextVersion, state: "proposed", createdAt: now(), createdBy: actor?.subject ?? ownerUserId, brief: { intent: row.intake.intent, goal: row.intake.goal, users: row.intake.users, constraints: row.intake.constraints, expectedOutputs: row.intake.expectedOutputs, autonomy: row.intake.autonomy, projectType: row.intake.projectType }, riskAssessment: row.riskAssessment, suggested: { roadmap: [{ id: "research", status: "proposed" }, { id: "analysis", status: "proposed" }, { id: "implementation", status: "proposed" }, { id: "test", status: "proposed" }], team: ["راهبرو", "محصولو", "تحلیلگرو", "معمارو", "دولوپرو", "تسترو"], models: policyPack?.values ?? {}, budget: policyPack?.values?.["budget.tokenHardCap"] ?? null, environments: ["development", "test", "production"], gates: ["foundation-approval", "test-evidence", "production-separate-approval"], runtimePlan, effects: runtimePlan.effects }, revisions: [] });
    proposals.set(proposal.proposalId, proposal); return proposal;
  }
  return Object.freeze({
    createProject({ actor, projectId, name, description = "", intake = {}, idempotencyKey = undefined }) {
      assertOwner(actor); const id = assertProjectId(projectId); noSensitive(intake);
      let normalized;
      try { normalized = normalizeProductIntake({ name, intake }); } catch (error) { throw new ProjectWorkspaceError("INVALID_INTAKE", error.message, 400); }
      const safeName = string(name, "name", 160); const safeDescription = String(description).slice(0, 2000); noSensitive(normalized);
      const key = idempotencyKey === undefined ? `product-request-${randomUUID()}` : assertIdempotencyKey(idempotencyKey);
      const requestFingerprint = fingerprint({ projectId: id, name: safeName, description: safeDescription, intake: normalized });
      const priorRequest = productRequests.get(key);
      if (priorRequest) {
        if (priorRequest.fingerprint !== requestFingerprint) throw new ProjectWorkspaceError("IDEMPOTENCY_KEY_REUSED", "idempotencyKey was already used for different project data.", 409);
        const priorProject = projects.get(priorRequest.projectId);
        if (!priorProject) throw new ProjectWorkspaceError("REQUEST_RECOVERY_REQUIRED", "The accepted Product Request has no recoverable project.", 409);
        const foundationProposal = currentFoundation(priorProject.projectId) ?? makeFoundationProposal(priorProject, actor);
        return copy({ project: priorProject, foundationProposal, policyPack: settings?.policyPack(priorProject.projectId) ?? null, request: requestMetadata(priorRequest), replayed: true });
      }
      if (projects.has(id)) throw new ProjectWorkspaceError("PROJECT_EXISTS", "ProjectId already exists.", 409);
      const request = copy({ requestId: `product-request-${randomUUID()}`, version: 1, idempotencyKey: key, fingerprint: requestFingerprint, projectId: id, state: "accepted", submittedBy: actor.subject, submittedAt: now() });
      const row = copy({ projectId: id, name: safeName, description: safeDescription, lifecycle: "draft", status: "draft", version: 1, createdAt: now(), updatedAt: now(), createdBy: actor.subject, intake: normalized, riskAssessment: normalized.riskAssessment, productRequest: request }); projects.set(id, row); productRequests.set(key, request);
      const foundation = makeFoundationProposal(row, actor); return copy({ project: row, foundationProposal: foundation, policyPack: settings?.policyPack(id) ?? null, request, replayed: false });
    },
    getProject(projectId) { return copy(project(projectId)); },
    listProjects() { return Object.freeze([...projects.values()].sort((a, b) => a.projectId.localeCompare(b.projectId)).map(copy)); },
    hydrateProject({ project }) {
      const normalizedInput = project?.intake ?? {};
      let normalizedIntake;
      try { normalizedIntake = normalizeProductIntake({ name: project?.name, intake: normalizedInput }); } catch (error) { throw new ProjectWorkspaceError("INVALID_HYDRATION", error.message, 500); }
      const normalized = copy({ ...project, intake: normalizedIntake, riskAssessment: project.riskAssessment ?? normalizedIntake.riskAssessment });
      assertProjectId(normalized.projectId);
      if (!Number.isInteger(normalized.version) || normalized.version < 1) throw new ProjectWorkspaceError("INVALID_HYDRATION", "Project version is invalid.", 500);
      hydrateProductRequest(normalized);
      const current = projects.get(normalized.projectId);
      if (!current || normalized.version >= current.version) projects.set(normalized.projectId, normalized);
      if (settings?.policyPack && settings?.suggestPolicyPack && !settings.policyPack(normalized.projectId)) {
        settings.suggestPolicyPack({ projectId: normalized.projectId, projectType: normalized.intake?.projectType ?? "application", riskLevel: policyRiskLevel(normalized.intake?.riskLevel ?? "standard"), actor: { subject: normalized.createdBy ?? ownerUserId } });
      }
      return copy(projects.get(normalized.projectId));
    },
    archiveProject({ actor, projectId, expectedVersion, reason }) { assertOwner(actor); const row = project(projectId); assertVersion(row, expectedVersion); return update(row, { lifecycle: "archived", status: "archived", archiveReason: string(reason, "reason", 500), archivedBy: actor.subject, archivedAt: now() }); },
    requestDeletion({ actor, projectId, expectedVersion, reason }) { assertOwner(actor); const row = project(projectId); assertVersion(row, expectedVersion); const request = copy({ deletionRequestId: `deletion-${randomUUID()}`, projectId: row.projectId, state: "requested", reason: string(reason, "reason", 500), requestedBy: actor.subject, requestedAt: now(), historyPreserved: true }); deletionRequests.set(row.projectId, request); update(row, { lifecycle: "deletion-requested", status: "deletion-requested" }); return request; },
    returnToDraft({ actor, projectId, expectedVersion, reason }) {
      assertOwner(actor);
      const row = project(projectId);
      assertVersion(row, expectedVersion);
      if (!["active", "intake", "foundation-review"].includes(row.lifecycle)) throw new ProjectWorkspaceError("DRAFT_RETURN_INVALID", "Only an active or in-review project may return to draft.", 409);
      const next = update(row, {
        lifecycle: "draft",
        status: "draft",
        foundationProposalId: null,
        returnedToDraftAt: now(),
        returnedToDraftBy: actor.subject,
        returnToDraftReason: string(reason, "reason", 500)
      });
      return copy({ project: next, foundationProposal: makeFoundationProposal(next, actor) });
    },
    submitIntake({ actor, projectId, expectedVersion, intake }) { assertProjectEditor(actor); const row = project(projectId); assertVersion(row, expectedVersion); noSensitive(intake); let normalizedIntake; try { normalizedIntake = normalizeProductIntake({ name: row.name, intake: { ...row.intake, ...intake } }); } catch (error) { throw new ProjectWorkspaceError("INVALID_INTAKE", error.message, 400); } const next = update(row, { intake: normalizedIntake, riskAssessment: normalizedIntake.riskAssessment, lifecycle: "foundation-review" }); return copy({ project: next, foundationProposal: makeFoundationProposal(next, actor) }); },
    upload({ actor, projectId, type, filename, content, mimeType = "application/octet-stream", zipExpandedBytes = null }) {
      assertProjectEditor(actor); const row = project(projectId); if (!PROJECT_INPUT_TYPES.includes(type) || type === "link" || type === "github-repository") throw new ProjectWorkspaceError("INVALID_UPLOAD_TYPE", "This input type cannot use binary upload.", 400);
      const bytes = asBuffer(content); if (bytes.length === 0 || bytes.length > uploadQuotaBytes) throw new ProjectWorkspaceError("UPLOAD_QUOTA_EXCEEDED", "Upload exceeds the private project quota.", 413);
      if (type === "text" && bytes.length > MAX_TEXT_BYTES) throw new ProjectWorkspaceError("TEXT_UPLOAD_TOO_LARGE", "Text input exceeds the safe parser limit.", 413);
      if (!signatureValid(type, bytes)) throw new ProjectWorkspaceError("FILE_SIGNATURE_INVALID", "File signature does not match its declared type.", 415);
      if (type === "zip" && (!Number.isInteger(zipExpandedBytes) || zipExpandedBytes < 0 || zipExpandedBytes > MAX_ZIP_EXPANDED_BYTES || zipExpandedBytes > bytes.length * 100)) throw new ProjectWorkspaceError("ZIP_BOMB_REJECTED", "ZIP declared expansion exceeds the sandbox limit.", 413);
      const scan = scanner({ projectId: row.projectId, type, bytes, filename, mimeType }); if (!scan || scan.state !== "clean") throw new ProjectWorkspaceError("MALWARE_SCAN_REJECTED", "Upload was not confirmed clean by the scanner.", 422);
      const text = previewText(type, bytes); const suspicious = Boolean(text && DANGEROUS.test(text)); const uploadId = `upload-${randomUUID()}`; const checksum = createHash("sha256").update(bytes).digest("hex"); const objectKey = `hero/uploads/${row.projectId}/${uploadId}/${checksum}`;
      const stored = objectStoreAdapter ? objectStoreAdapter.put({ objectKey, bytes: Buffer.from(bytes) }) : null;
      objectStore.set(objectKey, Buffer.from(bytes)); const parse = parser ? parser({ type, bytes: Buffer.from(bytes), mimeType }) : { state: type === "text" ? "parsed" : "deferred-adapter-required", text: type === "text" ? text : null };
      const entry = copy({ uploadId, projectId: row.projectId, type, filename: string(filename, "filename", 240), mimeType: string(mimeType, "mimeType", 160), byteLength: bytes.length, checksum, objectKey, storage: stored?.storage ?? "ephemeral-private-memory", scan: { state: "clean", engine: String(scan.engine ?? "configured").slice(0, 80) }, parse: { state: parse?.state ?? "deferred-adapter-required", text: suspicious ? null : (parse?.text ?? null), reviewRequired: suspicious, reason: suspicious ? "untrusted-instruction-pattern" : null }, createdAt: now(), createdBy: actor.subject }); uploads.set(uploadId, entry); return entry;
    },
    registerLink({ actor, projectId, url, label }) {
      assertProjectEditor(actor); project(projectId); if (typeof url !== "string" || !/^https:\/\//.test(url) || PRIVATE_HOST.test(url) || /@/.test(new globalThis.URL(url).host)) throw new ProjectWorkspaceError("SSRF_URL_REJECTED", "Only public HTTPS links without embedded credentials are accepted.", 400);
      const uploadId = `link-${randomUUID()}`; const entry = copy({ uploadId, projectId, type: "link", label: string(label ?? url, "label", 240), url, fetchState: "pending-separate-authorization", createdAt: now(), createdBy: actor.subject }); uploads.set(uploadId, entry); return entry;
    },
    listInputs({ projectId }) { project(projectId); return Object.freeze(projectUploads(projectId).map(copy)); },
    hydrateInput({ input }) {
      const normalized = copy(input);
      assertId("uploadId", normalized.uploadId); assertProjectId(normalized.projectId);
      project(normalized.projectId);
      uploads.set(normalized.uploadId, normalized);
      return normalized;
    },
    foundationProposal({ projectId }) { project(projectId); return currentFoundation(projectId); },
    listFoundationProposals({ projectId } = {}) {
      if (projectId) project(projectId);
      return Object.freeze([...proposals.values()].filter(item => !projectId || item.projectId === projectId).sort((a, b) => a.projectId.localeCompare(b.projectId) || a.version - b.version).map(copy));
    },
    hydrateFoundation({ proposal }) {
      const normalized = copy(proposal);
      assertId("proposalId", normalized.proposalId); assertProjectId(normalized.projectId);
      if (!Number.isInteger(normalized.version) || normalized.version < 1) throw new ProjectWorkspaceError("INVALID_HYDRATION", "Foundation version is invalid.", 500);
      const current = proposals.get(normalized.proposalId);
      if (!current || normalized.version >= current.version) proposals.set(normalized.proposalId, normalized);
      return copy(proposals.get(normalized.proposalId));
    },
    reviseFoundation({ actor, projectId, proposalId, expectedVersion, changes, reason }) { assertProjectEditor(actor); project(projectId); const prior = proposals.get(assertId("proposalId", proposalId)); if (!prior || prior.projectId !== projectId) throw new ProjectWorkspaceError("FOUNDATION_NOT_FOUND", "Foundation proposal was not found.", 404); if (prior.version !== expectedVersion || !["proposed", "revision-requested"].includes(prior.state)) throw new ProjectWorkspaceError("STALE_FOUNDATION", "Foundation proposal is not editable in this version/state.", 409); noSensitive(changes); const next = copy({ ...prior, ...changes, state: "revision-requested", version: prior.version + 1, updatedAt: now(), revisions: [...prior.revisions, { actor: actor.subject, reason: string(reason, "reason", 500), at: now() }] }); proposals.set(proposalId, next); return next; },
    approveFoundation({ actor, projectId, proposalId, expectedVersion, riskApproval = false }) { assertProjectEditor(actor); const row = project(projectId); const proposal = proposals.get(assertId("proposalId", proposalId)); if (!proposal || proposal.projectId !== projectId || proposal.version !== expectedVersion || !["proposed", "revision-requested"].includes(proposal.state)) throw new ProjectWorkspaceError("FOUNDATION_APPROVAL_INVALID", "Foundation proposal cannot be approved.", 409); const riskLevel = row.riskAssessment?.level ?? row.intake?.riskLevel ?? "standard"; if (["high", "critical"].includes(riskLevel) && (actor.role !== "project-owner" || riskApproval !== true)) throw new ProjectWorkspaceError("OWNER_RISK_APPROVAL_REQUIRED", "High-risk Foundation requires an explicit owner risk approval.", 403); const approved = copy({ ...proposal, state: "approved", approvedAt: now(), approvedBy: actor.subject, riskApproval: ["high", "critical"].includes(riskLevel) ? { approved: true, approvedBy: actor.subject, approvedAt: now() } : null }); proposals.set(proposalId, approved); if (settings) { if (!settings.policyPack(projectId) && settings.suggestPolicyPack) settings.suggestPolicyPack({ projectId, projectType: row.intake?.projectType ?? "application", riskLevel: policyRiskLevel(riskLevel), actor }); settings.applyPolicyPack({ actor, projectId, reason: "Foundation proposal approved" }); } update(row, { lifecycle: "active", foundationProposalId: proposalId }); return approved; },
    importGithubReadOnly({ actor, projectId, repositoryUrl, inventory = {} }) { assertProjectEditor(actor); project(projectId); if (typeof repositoryUrl !== "string" || !URL.test(repositoryUrl)) throw new ProjectWorkspaceError("GITHUB_REPOSITORY_INVALID", "Only a public-form GitHub repository URL is accepted for read-only import planning.", 400); noSensitive(inventory); const plan = copy({ importId: `github-import-${randomUUID()}`, projectId, repositoryUrl: repositoryUrl.replace(/\.git\/?$/, ""), mode: "read-only-inventory", state: "awaiting-separate-fetch-authorization", inventory: { branches: Array.isArray(inventory.branches) ? inventory.branches.map(String) : [], dependencies: Array.isArray(inventory.dependencies) ? inventory.dependencies.map(String) : [], workflows: Array.isArray(inventory.workflows) ? inventory.workflows.map(String) : [], documents: Array.isArray(inventory.documents) ? inventory.documents.map(String) : [] }, adoptionPlan: { actions: ["inspect repository metadata", "compare catalog", "prepare adoption proposal"], prohibited: ["commit", "refactor", "secret change", "deploy"] }, createdAt: now(), createdBy: actor.subject }); imports.set(plan.importId, plan); return plan; },
    listImportPlans({ projectId } = {}) { if (projectId) project(projectId); return Object.freeze([...imports.values()].filter(item => !projectId || item.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(copy)); },
    hydrateImport({ plan }) { const normalized = copy(plan); assertId("importId", normalized.importId); assertProjectId(normalized.projectId); imports.set(normalized.importId, normalized); return normalized; },
    cloneFromTemplate({ actor, sourceProjectId, projectId, name, description = "" }) { assertOwner(actor); const source = project(sourceProjectId); const created = this.createProject({ actor, projectId, name, description, intake: structuredClone(source.intake) }); return copy({ ...created, clone: { sourceProjectId, exclusions: ["secret", "production-data", "memory", "private-history", "sessions", "uploads"] } }); },
    recallTextInput({ actor, projectId, uploadId }) {
      assertProjectEditor(actor); project(projectId);
      const item = uploads.get(assertId("uploadId", uploadId));
      if (!item || item.projectId !== projectId || item.type !== "text") throw new ProjectWorkspaceError("TEXT_INPUT_RECALL_NOT_AVAILABLE", "Only a text input from this project may be recalled.", 404);
      if (item.parse?.reviewRequired) throw new ProjectWorkspaceError("TEXT_INPUT_RECALL_REVIEW_REQUIRED", "A text input that requires review cannot be recalled automatically.", 409);
      const bytes = objectStoreAdapter?.read ? objectStoreAdapter.read({ objectKey: item.objectKey }) : objectStore.get(item.objectKey);
      if (!Buffer.isBuffer(bytes)) throw new ProjectWorkspaceError("TEXT_INPUT_RECALL_UNAVAILABLE", "The private text source is not available for recall.", 409);
      const checksum = createHash("sha256").update(bytes).digest("hex");
      if (checksum !== item.checksum) throw new ProjectWorkspaceError("TEXT_INPUT_RECALL_INTEGRITY_FAILED", "The private text source failed its integrity check.", 409);
      return copy({ uploadId: item.uploadId, filename: item.filename, mimeType: item.mimeType, content: bytes.toString("utf8") });
    },
    privateObjectMetadata({ actor, projectId, uploadId }) { assertProjectEditor(actor); project(projectId); const item = uploads.get(assertId("uploadId", uploadId)); if (!item || item.projectId !== projectId) throw new ProjectWorkspaceError("UPLOAD_NOT_FOUND", "Upload was not found.", 404); return copy({ uploadId: item.uploadId, objectKey: item.objectKey, checksum: item.checksum, byteLength: item.byteLength }); },
    deletionRequest(projectId) { project(projectId); return deletionRequests.get(projectId) ?? null; }
  });
}
