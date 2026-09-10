export const NOTION_PRODUCT_DEVELOPMENT_CONTRACT_VERSION = "1.0";

export const NOTION_SYNC_STATES = Object.freeze([
  "not-configured",
  "planned",
  "pending",
  "in-sync",
  "source-ahead",
  "notion-ahead",
  "conflict",
  "blocked",
  "superseded"
]);

export const NOTION_EDIT_POLICIES = Object.freeze([
  "mirror-only",
  "protected-proposal",
  "proposal-editable",
  "notion-working-note"
]);

export const NOTION_DATABASE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "products", title: "Products", source: "hero-product-catalog", writePolicy: "proposal-editable" }),
  Object.freeze({ id: "objectives", title: "Objectives", source: "hero-roadmap", writePolicy: "proposal-editable" }),
  Object.freeze({ id: "initiatives", title: "Initiatives", source: "hero-roadmap", writePolicy: "proposal-editable" }),
  Object.freeze({ id: "roadmap-items", title: "Roadmap Items", source: "hero-roadmap-and-planner", writePolicy: "proposal-editable" }),
  Object.freeze({ id: "documents", title: "Documents", source: "git-document-catalog", writePolicy: "document-edit-policy" }),
  Object.freeze({ id: "decisions", title: "Decisions", source: "hero-and-git", writePolicy: "protected-proposal" }),
  Object.freeze({ id: "evidence", title: "Evidence", source: "hero-event-store-and-git", writePolicy: "mirror-only" }),
  Object.freeze({ id: "risks", title: "Risks", source: "hero-risk-register", writePolicy: "proposal-editable" }),
  Object.freeze({ id: "releases", title: "Releases", source: "hero-release-projection", writePolicy: "mirror-only" }),
  Object.freeze({ id: "change-proposals", title: "Change Proposals", source: "hero-change-workflow", writePolicy: "protected-proposal" }),
  Object.freeze({ id: "sync-health", title: "Sync Health", source: "hero-integration-projection", writePolicy: "mirror-only" })
]);

const IDENTIFIER = /^[A-Z][A-Z0-9._:-]{2,127}$/;

export function validateNotionSyncMapping(mapping) {
  const errors = [];
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) return ["mapping must be an object."];
  for (const field of ["documentId", "pageId", "sourceChecksum"]) {
    if (typeof mapping[field] !== "string" || mapping[field].trim() === "") errors.push(`${field} is required.`);
  }
  if (typeof mapping.documentId === "string" && !IDENTIFIER.test(mapping.documentId)) errors.push("documentId must be a safe identifier.");
  if (typeof mapping.status !== "string" || !NOTION_SYNC_STATES.includes(mapping.status)) errors.push("status is invalid.");
  if (typeof mapping.editPolicy !== "string" || !NOTION_EDIT_POLICIES.includes(mapping.editPolicy)) errors.push("editPolicy is invalid.");
  if (mapping.notionChecksum !== null && mapping.notionChecksum !== undefined && typeof mapping.notionChecksum !== "string") errors.push("notionChecksum must be a string or null.");
  if (mapping.canonicalCommit !== undefined && (typeof mapping.canonicalCommit !== "string" || mapping.canonicalCommit.trim() === "")) errors.push("canonicalCommit must be a non-empty string when provided.");
  return errors;
}

export function createNotionWorkspaceBlueprint({ rootTitle = "Hero Product Development" } = {}) {
  return Object.freeze({
    contractVersion: NOTION_PRODUCT_DEVELOPMENT_CONTRACT_VERSION,
    rootTitle,
    sections: [
      { id: "control-center", title: "00 — Control Center", purpose: "owner dashboard and decision queue" },
      { id: "hero-product", title: "10 — Hero Product", purpose: "self-development and canonical Hero views" },
      { id: "portfolio", title: "20 — Product Portfolio", purpose: "products and product homes" },
      { id: "shared-knowledge", title: "30 — Shared Knowledge", purpose: "versioned inherited policies and guides" },
      { id: "decisions-evidence", title: "40 — Decisions and Evidence", purpose: "decision and evidence projections" },
      { id: "integration-health", title: "90 — Integration and Sync Health", purpose: "mapping, conflicts and operational status" }
    ],
    databases: NOTION_DATABASE_DEFINITIONS.map(database => ({ ...database })),
    documentProperties: [
      "Document ID", "Title", "Product ID", "Type", "Scope", "Status", "Version", "Owner",
      "Classification", "Canonical Repository", "Canonical Relative Path", "Canonical Commit",
      "Canonical URL", "Content Checksum", "Last Canonical Update", "Review Cadence", "Next Review",
      "Edit Policy", "Sync State", "Last Successful Sync"
    ],
    authorityRule: "Git content and Hero operational state are canonical; Notion is a rebuildable projection and proposal surface.",
    initialAllowlist: ["HERO-PRODUCT-HERO-BRIEF"]
  });
}

export function getNotionProductDevelopmentContractSummary() {
  return Object.freeze({
    contractVersion: NOTION_PRODUCT_DEVELOPMENT_CONTRACT_VERSION,
    syncStates: NOTION_SYNC_STATES,
    editPolicies: NOTION_EDIT_POLICIES,
    databaseCount: NOTION_DATABASE_DEFINITIONS.length,
    inboundRule: "Notion edits create proposals; they never directly mutate canonical Git content."
  });
}
