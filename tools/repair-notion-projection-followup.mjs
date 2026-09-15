import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";
import { checksum, hasDocumentMarker, renderNotionDocumentContent } from "../packages/domain/src/notion-sync.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";

const POLICY_FILE = "config/product-development/notion-allowlist.json";
const AUTHORIZATION_FILE = "config/authorizations/notion-20260911-006.json";
const STEP_ID = "NOTION-PROJECTION-REPAIR-FOLLOWUP";
const DOCUMENT_ID = "HERO-OPS-HERO-TEST-ENVIRONMENT";
const PAGE_ID = "3d812710-4ae0-8172-a6ac-f55579725b9b";

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

async function withRetry(operation) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try { return await operation(); } catch (error) {
      if (!(error?.code === "NOTION_RATE_LIMITED" || Number(error?.statusCode ?? 0) >= 500) || attempt === 5) throw error;
      const retryAfter = Number(error?.details?.retryAfter ?? 0);
      await new Promise(resolve => setTimeout(resolve, Math.min(10_000, retryAfter > 0 ? retryAfter * 1_000 : 500 * (2 ** (attempt - 1)))));
    }
  }
  fail("Retry limit exhausted.");
}

async function main() {
  loadRuntimeEnv();
  const policy = JSON.parse(fs.readFileSync(POLICY_FILE, "utf8"));
  const authorization = JSON.parse(fs.readFileSync(AUTHORIZATION_FILE, "utf8"));
  const scope = policy.projection_repair_followup;
  const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
  const snapshot = catalog.snapshot();
  if (process.env.HERO_NOTION_PROJECTION_REPAIR_FOLLOWUP_APPROVED !== "true") fail("Projection repair follow-up requires HERO_NOTION_PROJECTION_REPAIR_FOLLOWUP_APPROVED=true.");
  if (!scope || scope.status !== "approved" || scope.authorization_id !== authorization.authorizationId || scope.step_id !== STEP_ID || scope.document_id !== DOCUMENT_ID || scope.page_id !== PAGE_ID || scope.catalog_digest !== snapshot.digest) fail("Projection repair follow-up scope is stale or invalid.");
  if (policy.classification_review?.status !== "approved" || policy.classification_review.catalog_digest !== snapshot.digest || policy.classification_review.candidate_count !== snapshot.documents.length) fail("Classification review does not match the current catalog.");
  if (authorization.status !== "active" || authorization.globalStop === true || authorization.scope?.catalogDigest !== snapshot.digest || authorization.scope?.documentId !== DOCUMENT_ID || authorization.scope?.pageId !== PAGE_ID) fail("Authorization is inactive, stale or outside the exact follow-up scope.");
  if (!authorization.operations?.includes("read") || !authorization.operations?.includes("notion-write") || !authorization.operations?.includes("notion-canonical-refresh")) fail("Authorization does not grant the required bounded operations.");
  const document = catalog.document(DOCUMENT_ID);
  const adapter = createNotionApiAdapter();
  if (!adapter.configured) fail("Notion connector is not configured.");
  const runtime = await createPostgresRuntime();
  try {
    const mapping = await runtime.notionSyncMappings.get(DOCUMENT_ID);
    if (!mapping || mapping.pageId !== PAGE_ID) fail("The exact document mapping does not match the authorized page.");
    const before = await withRetry(() => adapter.getPage(PAGE_ID));
    if (before.in_trash === true || before.archived === true) fail("The authorized page is in trash; refresh is blocked.");
    const sourceContent = renderNotionDocumentContent(document, document.content);
    const sourceChecksum = checksum(sourceContent, document.title);
    const current = await withRetry(() => adapter.getMarkdownPage(PAGE_ID));
    const currentChecksum = checksum(current?.markdown, document.title);
    await withRetry(() => adapter.updateMarkdownPage(PAGE_ID, { type: "replace_content", replace_content: { new_str: sourceContent } }));
    const persisted = await withRetry(() => adapter.getMarkdownPage(PAGE_ID));
    const notionChecksum = checksum(persisted?.markdown, document.title);
    if (!hasDocumentMarker(persisted?.markdown, DOCUMENT_ID) || notionChecksum !== sourceChecksum) fail("Post-write verification failed for the authorized document.");
    const now = new Date().toISOString();
    await runtime.notionSyncMappings.put({ ...mapping, sourceChecksum, notionChecksum, canonicalCommit: document.sourceCommit ?? "unknown", status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: now, updatedAt: now });
    console.log(JSON.stringify({ mode: "approved-notion-projection-repair-followup", authorizationId: authorization.authorizationId, stepId: STEP_ID, catalogDigest: snapshot.digest, documentId: DOCUMENT_ID, pageId: PAGE_ID, beforeChecksum: currentChecksum, afterChecksum: notionChecksum, outcome: "refreshed-and-verified" }));
  } finally {
    await runtime.close();
  }
}

try { await main(); } catch (error) { console.error(`Notion projection repair follow-up failed: ${error.message}`); process.exitCode = 1; }
