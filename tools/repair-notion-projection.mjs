import crypto from "node:crypto";
import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";
import { checksum, hasDocumentMarker, renderNotionDocumentContent } from "../packages/domain/src/notion-sync.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";

const POLICY_FILE = "config/product-development/notion-allowlist.json";
const AUTHORIZATION_FILE = "config/authorizations/notion-20260911-004.json";
const STEP_ID = "NOTION-PROJECTION-REPAIR";

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

function retryable(error) { return error?.code === "NOTION_RATE_LIMITED" || Number(error?.statusCode ?? 0) >= 500; }

async function withRetry(operation) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { return await operation(); } catch (error) {
      if (!retryable(error) || attempt === 3) throw error;
      const retryAfter = Number(error?.details?.retryAfter ?? 0);
      await new Promise(resolve => setTimeout(resolve, Math.min(5_000, retryAfter > 0 ? retryAfter * 1_000 : 250 * (2 ** (attempt - 1)))));
    }
  }
  fail("Retry limit exhausted.");
}

function pageTitle(page) {
  const properties = page?.properties ?? {};
  for (const key of ["title", "Title", "Name", "name"]) {
    const value = properties[key];
    if (value?.type === "title" && Array.isArray(value.title)) return value.title.map(item => item.plain_text ?? item.text?.content ?? "").join("");
    if (value?.type === "rich_text" && Array.isArray(value.rich_text)) return value.rich_text.map(item => item.plain_text ?? item.text?.content ?? "").join("");
  }
  return null;
}

function validateAuthorization({ policy, authorization, snapshot }) {
  const repair = policy.projection_repair;
  if (process.env.HERO_NOTION_PROJECTION_REPAIR_APPROVED !== "true") fail("Projection repair requires HERO_NOTION_PROJECTION_REPAIR_APPROVED=true.");
  if (!repair || repair.status !== "approved") fail("Projection repair is not approved in the policy.");
  if (repair.authorization_id !== authorization.authorizationId || repair.step_id !== STEP_ID || repair.document_version !== "1.0.0") fail("Projection repair authorization does not match the policy.");
  if (repair.mode !== "git-canonical-refresh-and-title-repair" || repair.global_stop === true) fail("Projection repair scope is invalid.");
  if (authorization.status !== "active" || authorization.globalStop === true) fail("Authorization is inactive or Global Stop is active.");
  if (!authorization.operations?.includes("read") || !authorization.operations?.includes("notion-write") || !authorization.operations?.includes("notion-canonical-refresh") || !authorization.operations?.includes("notion-page-title-update")) fail("Authorization does not grant the required bounded operations.");
  if (repair.catalog_digest !== snapshot.digest || authorization.scope?.catalogDigest !== snapshot.digest) fail("Projection repair authorization is stale for the current catalog.");
  if (policy.classification_review?.status !== "approved" || policy.classification_review.catalog_digest !== snapshot.digest || policy.classification_review.candidate_count !== snapshot.documents.length) fail("Classification review does not match the current catalog.");
}

async function main() {
  loadRuntimeEnv();
  const policy = JSON.parse(fs.readFileSync(POLICY_FILE, "utf8"));
  const authorization = JSON.parse(fs.readFileSync(AUTHORIZATION_FILE, "utf8"));
  const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
  const snapshot = catalog.snapshot();
  validateAuthorization({ policy, authorization, snapshot });
  if (!process.env.HERO_POSTGRES_URL || !process.env.HERO_NOTION_PARENT_PAGE_ID) fail("PostgreSQL and Notion parent page are required.");
  const adapter = createNotionApiAdapter();
  if (!adapter.configured) fail("Notion connector is not configured.");
  const runtime = await createPostgresRuntime();
  const documents = new Map(snapshot.documents.map(document => [document.id, catalog.document(document.id)]));
  const mappings = await runtime.notionSyncMappings.list({ limit: 1000 });
  const mappingByDocument = new Map(mappings.map(mapping => [mapping.documentId, mapping]));
  const staleIds = [...policy.projection_repair.stale_document_ids].sort();
  const staleResults = [];
  try {
    const titleTargets = [];
    for (const mapping of mappings) {
      if (!documents.has(mapping.documentId)) fail(`Mapping is outside the current catalog: ${mapping.documentId}`);
      const page = await withRetry(() => adapter.getPage(mapping.pageId));
      if (pageTitle(page) === null || pageTitle(page) === "") titleTargets.push(mapping.documentId);
    }
    titleTargets.sort();
    const selector = policy.projection_repair.title_repair_selector;
    const selectorDigest = crypto.createHash("sha256").update(JSON.stringify(titleTargets)).digest("hex");
    if (titleTargets.length !== selector.count || selectorDigest !== selector.document_ids_digest) fail("Title repair selector changed during preflight; no write was attempted.");
    if (staleIds.length !== 4 || !staleIds.every(documentId => documents.has(documentId))) fail("The stale-document repair scope is invalid.");

    for (const documentId of staleIds) {
      const document = documents.get(documentId);
      const mapping = mappingByDocument.get(documentId);
      if (!mapping?.pageId) fail(`Stale document has no mapped page: ${documentId}`);
      const sourceContent = renderNotionDocumentContent(document, document.content);
      const sourceChecksum = checksum(sourceContent, document.title);
      await withRetry(() => adapter.updateMarkdownPage(mapping.pageId, { type: "replace_content", replace_content: { new_str: sourceContent } }));
      const persisted = await withRetry(() => adapter.getMarkdownPage(mapping.pageId));
      const notionChecksum = checksum(persisted?.markdown, document.title);
      if (!hasDocumentMarker(persisted?.markdown, document.id) || notionChecksum !== sourceChecksum) fail(`Post-write verification failed for stale document ${documentId}`);
      const now = new Date().toISOString();
      await runtime.notionSyncMappings.put({ ...mapping, sourceChecksum, notionChecksum, canonicalCommit: document.sourceCommit ?? "unknown", status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: now, updatedAt: now });
      staleResults.push({ documentId, outcome: "refreshed-and-verified", pageId: mapping.pageId });
    }

    const titleResults = [];
    for (const documentId of titleTargets) {
      const document = documents.get(documentId);
      const mapping = mappingByDocument.get(documentId);
      const before = await withRetry(() => adapter.getPage(mapping.pageId));
      if (before.properties?.title?.type !== "title") fail(`Title property is not a page title property: ${documentId}`);
      await withRetry(() => adapter.updatePage(mapping.pageId, { properties: { title: { title: [{ type: "text", text: { content: document.title } }] } } }));
      const after = await withRetry(() => adapter.getPage(mapping.pageId));
      if (pageTitle(after) !== document.title) fail(`Title verification failed for ${documentId}`);
      titleResults.push({ documentId, pageId: mapping.pageId, title: document.title });
    }
    console.log(JSON.stringify({ mode: "approved-notion-projection-repair", authorizationId: authorization.authorizationId, stepId: STEP_ID, catalogDigest: snapshot.digest, stale: { total: staleResults.length, results: staleResults }, titles: { total: titleResults.length, results: titleResults } }));
  } finally {
    await runtime.close();
  }
}

try { await main(); } catch (error) { console.error(`Notion projection repair failed: ${error.message}`); process.exitCode = 1; }
