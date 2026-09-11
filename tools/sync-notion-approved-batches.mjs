import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";
import { createNotionBatchSyncService } from "../packages/domain/src/notion-batch-sync.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";

function loadRuntimeEnv(file = ".env") {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const separator = normalized.indexOf("=");
    if (separator < 1) continue;
    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function classificationReviewMatches(policy, snapshot, candidateCount) {
  return policy.classification_review?.status === "approved" &&
    policy.classification_review.catalog_digest === snapshot.digest &&
    policy.classification_review.candidate_count === candidateCount &&
    policy.classification_review.default_classification === "internal" &&
    Array.isArray(policy.classification_review.excluded_document_ids);
}

async function main() {
  loadRuntimeEnv();
  const policy = JSON.parse(fs.readFileSync("config/product-development/notion-allowlist.json", "utf8"));
  if (process.env.HERO_NOTION_BATCH_WRITE_APPROVED !== "true") throw new Error("Approved batch execution requires HERO_NOTION_BATCH_WRITE_APPROVED=true.");
  if (!process.env.HERO_POSTGRES_URL) throw new Error("Approved batch execution requires HERO_POSTGRES_URL.");

  const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
  const snapshot = catalog.snapshot();
  const candidates = snapshot.documents.filter(document => document.notionEligible !== false && (policy.allowed_classifications ?? ["internal"]).includes(document.classification ?? "internal"));
  if (!classificationReviewMatches(policy, snapshot, candidates.length)) throw new Error("Classification review does not match the current catalog snapshot; no external write was attempted.");
  const approvedIds = new Set((policy.documents ?? []).filter(item => item.external_write_approved === true).map(item => item.document_id));
  const pending = candidates.filter(document => !approvedIds.has(document.id));
  const batchSize = policy.batch_size ?? 10;
  const totalBatches = Math.ceil(candidates.length / batchSize);
  const remainingBatches = Math.ceil(pending.length / batchSize);
  const adapter = createNotionApiAdapter();
  if (!adapter.configured) throw new Error("Notion connector is not configured; no external write was attempted.");

  const runtime = await createPostgresRuntime();
  const allResults = [];
  try {
    for (let offset = 0; offset < pending.length; offset += batchSize) {
      const batch = pending.slice(offset, offset + batchSize);
      const batchNumber = Math.floor(offset / batchSize) + 2;
      const batchPolicy = {
        ...policy,
        batch_write_approved: true,
        documents: batch.map(document => ({
          document_id: document.id,
          write_policy: document.editClass,
          external_write_approved: true,
          reason: "Owner-approved controlled continuation batch."
        }))
      };
      const documents = batch.map(document => ({ ...document, content: catalog.document(document.id).content }));
      const service = createNotionBatchSyncService({ adapter, mappingStore: runtime.notionSyncMappings });
      const result = await service.execute({
        documents,
        policy: batchPolicy,
        parentPageId: process.env.HERO_NOTION_PARENT_PAGE_ID,
        batchSize,
        allowExternalWrite: true,
        bulkWriteApproved: true,
        runtimeBulkWriteApproved: true
      });
      allResults.push(...result.results);
      console.log(JSON.stringify({ batch: batchNumber, totalBatches, remainingBatches, ...result.summary }));
      if (result.summary.conflicts > 0) throw new Error(`Batch ${batchNumber} stopped after ${result.summary.conflicts} conflict(s).`);
    }
  } finally {
    await runtime.close();
  }
  console.log(JSON.stringify({ mode: "executed-approved-continuation", totalBatches, batchesExecuted: remainingBatches, documentsProcessed: allResults.length, synced: allResults.filter(item => item.outcome === "synced").length, alreadyInSync: allResults.filter(item => item.outcome === "already-in-sync").length, conflicts: allResults.filter(item => item.outcome === "conflict").length }));
}

try {
  await main();
} catch (error) {
  console.error(`Approved Notion batch continuation failed: ${error.message}`);
  process.exitCode = 1;
}
