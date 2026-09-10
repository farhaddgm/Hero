export const PRODUCT_DEVELOPMENT_CONTRACT_VERSION = "1.0";

export const PRODUCT_STATUSES = Object.freeze(["proposed", "active", "paused", "retired", "archived"]);
export const DOCUMENT_STATUSES = Object.freeze(["active", "proposed", "superseded", "archived"]);
export const DOCUMENT_TYPES = Object.freeze([
  "architecture",
  "decision",
  "governance",
  "operation",
  "specification",
  "evidence",
  "roadmap",
  "template",
  "index"
]);
export const ROADMAP_ITEM_STATUSES = Object.freeze(["idea", "planned", "in_progress", "blocked", "evidence", "done", "retired"]);
export const DOCUMENT_EDIT_CLASSES = Object.freeze(["mirror-only", "protected-proposal", "proposal-editable", "notion-working-note"]);

export const PRODUCT_DOCUMENT_REQUIRED_ROLES = Object.freeze([
  "brief",
  "test-environment",
  "release-policy"
]);

const IDENTIFIER = /^[A-Z][A-Z0-9._:-]{2,127}$/;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;

export function getProductDevelopmentContractSummary() {
  return Object.freeze({
    contractVersion: PRODUCT_DEVELOPMENT_CONTRACT_VERSION,
    sourceOfTruth: {
      documents: "git",
      operationalState: "hero-event-store",
      projections: "rebuildable"
    },
    productStatuses: PRODUCT_STATUSES,
    documentStatuses: DOCUMENT_STATUSES,
    documentTypes: DOCUMENT_TYPES,
    roadmapItemStatuses: ROADMAP_ITEM_STATUSES,
    documentEditClasses: DOCUMENT_EDIT_CLASSES,
    requiredProductDocumentRoles: PRODUCT_DOCUMENT_REQUIRED_ROLES,
    externalWritePolicy: "notion-edit-creates-change-proposal"
  });
}

export function validateProductManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return ["manifest must be an object."];
  if (typeof manifest.schema_version !== "string" || manifest.schema_version.length === 0) errors.push("schema_version is required.");
  if (typeof manifest.product_id !== "string" || !IDENTIFIER.test(manifest.product_id)) errors.push("product_id must be a safe uppercase identifier.");
  if (typeof manifest.name !== "string" || manifest.name.trim() === "") errors.push("name is required.");
  if (typeof manifest.repository !== "object" || !manifest.repository) errors.push("repository is required.");
  if (manifest.repository && typeof manifest.repository.kind !== "string") errors.push("repository.kind is required.");
  if (manifest.repository && manifest.repository.kind === "remote" && typeof manifest.repository.url !== "string") errors.push("remote repository.url is required.");
  if (!PRODUCT_STATUSES.includes(manifest.status)) errors.push(`status must be one of: ${PRODUCT_STATUSES.join(", ")}.`);
  for (const field of ["inherited_document_ids", "product_specific_document_ids"]) {
    if (!Array.isArray(manifest[field]) || manifest[field].some(value => typeof value !== "string" || !IDENTIFIER.test(value))) {
      errors.push(`${field} must be an array of safe document identifiers.`);
    }
  }
  if (manifest.docs_root !== undefined && (typeof manifest.docs_root !== "string" || !SAFE_PATH.test(manifest.docs_root))) {
    errors.push("docs_root must be a repository-relative safe path.");
  }
  return errors;
}

export function validateDocumentCatalogEntry(document) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return ["document must be an object."];
  if (typeof document.id !== "string" || !IDENTIFIER.test(document.id)) errors.push("id must be a safe identifier.");
  if (typeof document.path !== "string" || !SAFE_PATH.test(document.path)) errors.push("path must be a safe repository-relative path.");
  if (typeof document.title !== "string" || document.title.trim() === "") errors.push("title is required.");
  if (!DOCUMENT_TYPES.includes(document.type)) errors.push(`type must be one of: ${DOCUMENT_TYPES.join(", ")}.`);
  if (!DOCUMENT_STATUSES.includes(document.status)) errors.push(`status must be one of: ${DOCUMENT_STATUSES.join(", ")}.`);
  if (typeof document.version !== "string" || document.version.trim() === "") errors.push("version is required.");
  if (typeof document.owner !== "string" || document.owner.trim() === "") errors.push("owner is required.");
  if (document.canonical !== true) errors.push("canonical must be true for a catalog entry.");
  if (!Array.isArray(document.supersedes)) errors.push("supersedes must be an array.");
  return errors;
}

export function roadmapStatusFromText(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("blocker") || text.includes("مسدود") || text.includes("متوقف")) return "blocked";
  if (text.includes("انجام شد") || text.includes("تکمیل") || text.includes("تأیید شد")) return "evidence";
  if (text.includes("در حال") || text.includes("جاری")) return "in_progress";
  return "planned";
}
