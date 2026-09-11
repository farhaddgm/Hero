import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";
import { createNotionBatchSyncService } from "../packages/domain/src/notion-batch-sync.mjs";
import { createNotionSyncRegistry } from "../packages/domain/src/notion-sync-registry.mjs";
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

async function main() {
  loadRuntimeEnv();
  const policy = JSON.parse(fs.readFileSync("config/product-development/notion-allowlist.json", "utf8"));
  const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
  const snapshot = catalog.snapshot();
  const documents = snapshot.documents.map(document => ({ ...document, content: catalog.document(document.id).content }));
  const defaultedClassifications = documents.filter(document => document.classificationSource !== "explicit");
  const classificationReviewed = policy.classification_review?.status === "approved" &&
    policy.classification_review.catalog_digest === snapshot.digest &&
    policy.classification_review.candidate_count === documents.length &&
    policy.classification_review.default_classification === "internal" &&
    Array.isArray(policy.classification_review.excluded_document_ids);
  const policyBulkWriteApproved = policy.bulk_write_approved === true;
  const runtimeBulkWriteApproved = process.env.HERO_NOTION_BULK_WRITE_APPROVED === "true";
  const policyBatchWriteApproved = policy.batch_write_approved === true;
  const runtimeBatchWriteApproved = process.env.HERO_NOTION_BATCH_WRITE_APPROVED === "true";
  const operationApproved = (policyBulkWriteApproved && runtimeBulkWriteApproved) || (policyBatchWriteApproved && runtimeBatchWriteApproved);
  const adapter = createNotionApiAdapter();
  const execute = process.argv.includes("--execute");
  if (!execute) {
    const service = createNotionBatchSyncService({ adapter, mappingStore: createNotionSyncRegistry() });
    const plan = service.plan({ documents, policy, batchSize: policy.batch_size ?? 10 });
    console.log(JSON.stringify({ ...plan, externalRequests: 0, writeGate: { policyBulk: policyBulkWriteApproved, runtimeBulk: runtimeBulkWriteApproved, policyBatch: policyBatchWriteApproved, runtimeBatch: runtimeBatchWriteApproved, classificationReviewed, ready: operationApproved && (defaultedClassifications.length === 0 || classificationReviewed) } }, null, 2));
    return;
  }
  if (!operationApproved) throw new Error("Notion batch write requires the matching policy and runtime approval gate.");
  if (defaultedClassifications.length > 0 && !classificationReviewed) throw new Error(`Bulk Notion write requires explicit classification or a matching owner-approved review; ${defaultedClassifications.length} document(s) still use default-internal classification.`);
  if (!process.env.HERO_POSTGRES_URL) throw new Error("Bulk Notion execution requires HERO_POSTGRES_URL for durable mapping storage.");
  const runtime = await createPostgresRuntime();
  try {
    const result = await createNotionBatchSyncService({ adapter, mappingStore: runtime.notionSyncMappings }).execute({
      documents,
      policy,
      parentPageId: process.env.HERO_NOTION_PARENT_PAGE_ID,
      batchSize: policy.batch_size ?? 10,
      allowExternalWrite: true,
      bulkWriteApproved: operationApproved,
      runtimeBulkWriteApproved: operationApproved
    });
    console.log(JSON.stringify({ ...result, externalRequests: result.results.length > 0 }, null, 2));
  } finally {
    await runtime.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(`Notion batch sync failed: ${error.message}`);
  process.exitCode = 1;
}
