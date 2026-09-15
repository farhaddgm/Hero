import fs from "node:fs";

import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";

const policy = JSON.parse(fs.readFileSync("config/product-development/notion-allowlist.json", "utf8"));
const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
const snapshot = catalog.snapshot();
const allowlisted = new Set((policy.documents ?? []).filter(item => item.external_write_approved === true).map(item => item.document_id));
const candidates = snapshot.documents.filter(document => document.notionEligible && policy.allowed_classifications.includes(document.classification));
const excluded = snapshot.documents.filter(document => !candidates.includes(document));
const remaining = candidates.filter(document => !allowlisted.has(document.id));
const counts = candidates.reduce((result, document) => {
  result[document.editClass] = (result[document.editClass] ?? 0) + 1;
  return result;
}, {});
const classificationReview = {
  explicitCount: candidates.filter(document => document.classificationSource === "explicit").length,
  defaultedCount: candidates.filter(document => document.classificationSource !== "explicit").length,
  policyReviewed: policy.classification_review?.status === "approved" &&
    policy.classification_review.catalog_digest === snapshot.digest &&
    policy.classification_review.candidate_count === candidates.length &&
    policy.classification_review.default_classification === "internal" &&
    Array.isArray(policy.classification_review.excluded_document_ids),
  ready: candidates.every(document => document.classificationSource === "explicit") || (
    policy.classification_review?.status === "approved" &&
    policy.classification_review.catalog_digest === snapshot.digest &&
    policy.classification_review.candidate_count === candidates.length &&
    policy.classification_review.default_classification === "internal" &&
    Array.isArray(policy.classification_review.excluded_document_ids)
  )
};
const policyBulkWriteApproved = policy.bulk_write_approved === true;
const runtimeBulkWriteApproved = process.env.HERO_NOTION_BULK_WRITE_APPROVED === "true";
const policyBatchWriteApproved = policy.batch_write_approved === true;
const runtimeBatchWriteApproved = process.env.HERO_NOTION_BATCH_WRITE_APPROVED === "true";

console.log(JSON.stringify({
  mode: policy.mode,
  externalRequests: 0,
  source: { documentCount: snapshot.documents.length, catalogDigest: snapshot.digest },
  candidates: { count: candidates.length, allowlistedCount: allowlisted.size, remainingCount: remaining.length, editClassCounts: counts, classificationReview },
  excluded: excluded.map(document => ({ documentId: document.id, classification: document.classification, reason: document.notionEligible ? "classification-not-allowed" : "restricted" })),
  batching: { batchSize: policy.batch_size, estimatedBatches: Math.ceil(candidates.length / policy.batch_size), estimatedRemainingBatches: Math.ceil(remaining.length / policy.batch_size) },
  writeGate: { policyBulkWriteApproved, runtimeBulkWriteApproved, policyBatchWriteApproved, runtimeBatchWriteApproved, ready: classificationReview.ready && ((policyBulkWriteApproved && runtimeBulkWriteApproved) || (policyBatchWriteApproved && runtimeBatchWriteApproved)) },
  nextAction: !classificationReview.ready ? "owner-classification-review-required-before-bulk" : policyBatchWriteApproved ? "run-approved-batch-after-runtime-approval" : policyBulkWriteApproved ? "run-test-batch-after-runtime-approval" : "owner-approval-required-for-all-internal-batch"
}, null, 2));
