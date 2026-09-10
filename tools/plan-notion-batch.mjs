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

console.log(JSON.stringify({
  mode: policy.mode,
  externalRequests: 0,
  source: { documentCount: snapshot.documents.length, catalogDigest: snapshot.digest },
  candidates: { count: candidates.length, allowlistedCount: allowlisted.size, remainingCount: remaining.length, editClassCounts: counts },
  excluded: excluded.map(document => ({ documentId: document.id, classification: document.classification, reason: document.notionEligible ? "classification-not-allowed" : "restricted" })),
  batching: { batchSize: policy.batch_size, estimatedBatches: Math.ceil(candidates.length / policy.batch_size), estimatedRemainingBatches: Math.ceil(remaining.length / policy.batch_size) },
  writeGate: { policyBulkWriteApproved: policy.bulk_write_approved === true, runtimeBulkWriteApproved: process.env.HERO_NOTION_BULK_WRITE_APPROVED === "true", ready: policy.bulk_write_approved === true && process.env.HERO_NOTION_BULK_WRITE_APPROVED === "true" },
  nextAction: policy.bulk_write_approved === true ? "run-test-batch-after-runtime-approval" : "owner-approval-required-for-all-internal-batch"
}, null, 2));
