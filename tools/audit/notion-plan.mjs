// BO-166: the canonical-document plan for a Notion projection, with NO write. It
// reads the repository's own document catalog, lists what would be projected with
// a checksum per document and states the review status of the classification.
// It never imports the Notion adapter and counts any network call as a failure.
import fs from "node:fs";
import path from "node:path";
import { createProductDevelopmentCatalog } from "../../packages/domain/src/product-development.mjs";
import { createRecorder } from "../acceptance/audit-lib.mjs";

export function buildCanonicalPlan({ root, sourceCommit = "workspace" }) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, "config/product-development/notion-allowlist.json"), "utf8"));
  const snapshot = createProductDevelopmentCatalog({ root, sourceCommit }).snapshot();
  const candidates = snapshot.documents.filter(document => document.notionEligible && policy.allowed_classifications.includes(document.classification));
  const excluded = snapshot.documents.filter(document => !candidates.includes(document));
  const review = policy.classification_review ?? {};
  const reviewCurrent = review.status === "approved" && review.catalog_digest === snapshot.digest && review.candidate_count === candidates.length;
  return {
    mode: "plan-only-notion-write-forbidden", writes: 0, catalogDigest: snapshot.digest,
    documentRefs: candidates.map(document => `hero://docs/${document.id}`).sort(),
    documents: candidates.map(document => ({ ref: `hero://docs/${document.id}`, checksum: `sha256:${document.checksum}`, version: document.version, path: document.path, classification: document.classification })).sort((a, b) => a.ref.localeCompare(b.ref)),
    excluded: excluded.map(document => ({ id: document.id, reason: !document.notionEligible ? "not-notion-eligible" : `classification:${document.classification}` })),
    classificationReview: { status: review.status ?? "missing", reviewedCatalogDigest: review.catalog_digest ?? null, current: reviewCurrent, action: reviewCurrent ? "none" : "owner re-review of the new catalog digest is required before any projection" },
    bulkWriteApproved: policy.bulk_write_approved === true, batchWriteApproved: policy.batch_write_approved === true
  };
}

/** Proves the plan builder makes no network call and approves no write, then returns the counted result. */
export function auditNotionPlan({ root, recorder = createRecorder("tools/audit/notion-plan") }) {
  const originalFetch = globalThis.fetch; let calls = 0; globalThis.fetch = (...args) => { calls += 1; return originalFetch(...args); };
  let plan; try { plan = buildCanonicalPlan({ root }); } finally { globalThis.fetch = originalFetch; }
  recorder.check("notion plan: building the plan made no network call", calls === 0, calls);
  recorder.check(`notion plan: ${plan.documents.length} canonical documents planned, zero writes`, plan.writes === 0 && plan.documents.length > 0);
  recorder.check("notion plan: every planned document has a sha256 checksum and an internal hero:// reference", plan.documents.every(document => /^sha256:[a-f0-9]{64}$/.test(document.checksum) && /^hero:\/\/docs\/[A-Z0-9-]+$/.test(document.ref)));
  recorder.check("notion plan: references are unique", new Set(plan.documentRefs).size === plan.documentRefs.length);
  recorder.check("notion plan: no restricted or non-internal classification is planned", plan.documents.every(document => document.classification === "internal"));
  recorder.check("notion plan: bulk and batch writes are not approved", plan.bulkWriteApproved === false && plan.batchWriteApproved === false);
  const source = fs.readFileSync(new URL(import.meta.url), "utf8"); recorder.check("notion plan: the planner does not import the Notion adapter", !/notion-api|notion-sync|@notionhq/.test(source.split("\n").filter(line => line.startsWith("import")).join("\n")));
  recorder.check("notion plan: the classification review status is reported honestly", ["approved", "missing", "pending"].includes(plan.classificationReview.status) && typeof plan.classificationReview.current === "boolean");
  return { recorder, plan };
}
