import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";
import { checksum, renderNotionDocumentContent } from "../packages/domain/src/notion-sync.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";

const POLICY_FILE = "config/product-development/notion-allowlist.json";
const AUTHORIZATION_FILE = "config/authorizations/notion-20260911-008.json";
const STEP_ID = "NOTION-PRODUCT-SYSTEM-CONFLICT-FOLLOWUP";
const APPROVAL_ENV = "HERO_NOTION_PRODUCT_SYSTEM_CONFLICT_RESOLUTION_APPROVED";

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

function fail(message) { throw new Error(message); }

async function main() {
  loadRuntimeEnv();
  if (process.env[APPROVAL_ENV] !== "true") fail(`${APPROVAL_ENV}=true is required.`);
  const policy = JSON.parse(fs.readFileSync(POLICY_FILE, "utf8"));
  const authorization = JSON.parse(fs.readFileSync(AUTHORIZATION_FILE, "utf8"));
  const scope = policy.product_system_conflict_resolution;
  const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
  const snapshot = catalog.snapshot();
  if (!scope || scope.status !== "approved" || scope.authorization_id !== authorization.authorizationId || scope.step_id !== STEP_ID || scope.catalog_digest !== snapshot.digest) fail("Product-system conflict scope is stale or invalid.");
  if (authorization.status !== "active" || authorization.globalStop === true || authorization.scope?.catalogDigest !== snapshot.digest) fail("Product-system conflict authorization is inactive or stale.");
  if (!authorization.operations?.includes("read") || !authorization.operations?.includes("notion-write") || !authorization.operations?.includes("conflict-resolution")) fail("Product-system conflict authorization is insufficient.");
  const step = authorization.steps?.find(item => item.stepId === STEP_ID);
  if (!step || step.documentVersion !== scope.document_version) fail("Product-system conflict step/version does not match authorization.");
  const expectedIds = scope.document_ids;
  if (!Array.isArray(expectedIds) || new Set(expectedIds).size !== expectedIds.length) fail("Product-system conflict document scope is invalid.");
  const documents = new Map(snapshot.documents.map(document => [document.id, { ...document, content: catalog.document(document.id).content }]));
  for (const documentId of expectedIds) if (!documents.has(documentId)) fail(`Document is missing from the current catalog: ${documentId}`);

  const adapter = createNotionApiAdapter();
  if (!adapter.configured) fail("Notion connector is not configured.");
  const runtime = await createPostgresRuntime();
  const results = [];
  try {
    const mappings = await runtime.notionSyncMappings.list({ limit: 1000 });
    for (const documentId of expectedIds) {
      const mapping = mappings.find(item => item.documentId === documentId);
      if (!mapping?.pageId) fail(`Existing mapping is required: ${documentId}`);
      const document = documents.get(documentId);
      const sourceContent = renderNotionDocumentContent(document, document.content);
      const sourceChecksum = checksum(sourceContent, document.title);
      const current = await adapter.getMarkdownPage(mapping.pageId);
      const currentChecksum = checksum(current?.markdown, document.title);
      if (currentChecksum === sourceChecksum) {
        await runtime.notionSyncMappings.put({ ...mapping, sourceChecksum, notionChecksum: currentChecksum, canonicalCommit: document.sourceCommit ?? "unknown", status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: new Date().toISOString(), updatedAt: new Date().toISOString() });
        results.push({ documentId, outcome: "already-in-sync", pageId: mapping.pageId });
        continue;
      }
      await adapter.updateMarkdownPage(mapping.pageId, { type: "replace_content", replace_content: { new_str: sourceContent } });
      const persisted = await adapter.getMarkdownPage(mapping.pageId);
      const notionChecksum = checksum(persisted?.markdown, document.title);
      if (notionChecksum !== sourceChecksum) fail(`Post-write checksum verification failed: ${documentId}`);
      const now = new Date().toISOString();
      await runtime.notionSyncMappings.put({ ...mapping, sourceChecksum, notionChecksum, canonicalCommit: document.sourceCommit ?? "unknown", status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: now, updatedAt: now });
      results.push({ documentId, outcome: "synced", pageId: mapping.pageId });
    }
  } finally {
    await runtime.close();
  }
  console.log(JSON.stringify({ mode: "git-canonical-product-system-conflict-resolution", authorizationId: authorization.authorizationId, stepId: STEP_ID, catalogDigest: snapshot.digest, total: results.length, synced: results.filter(item => item.outcome === "synced").length, alreadyInSync: results.filter(item => item.outcome === "already-in-sync").length, results }, null, 2));
}

try { await main(); } catch (error) { console.error(`Notion product-system conflict resolution failed: ${error.message}`); process.exitCode = 1; }
