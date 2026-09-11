import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";
import { checksum, hasDocumentMarker, renderNotionDocumentContent } from "../packages/domain/src/notion-sync.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";

const POLICY_FILE = "config/product-development/notion-allowlist.json";
const AUTHORIZATION_FILE = "config/authorizations/notion-20260911-002.json";

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

function fail(message) {
  throw new Error(message);
}

function retryable(error) {
  return error?.code === "NOTION_RATE_LIMITED" || Number(error?.statusCode ?? 0) >= 500;
}

async function withRetry(operation) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!retryable(error) || attempt === 3) throw error;
      const retryAfter = Number(error?.details?.retryAfter ?? 0);
      const delay = Math.min(5_000, retryAfter > 0 ? retryAfter * 1_000 : 250 * (2 ** (attempt - 1)));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  fail("Retry limit exhausted.");
}

function validateAuthorization({ policy, authorization, snapshot }) {
  const sync = policy.new_document_sync;
  if (process.env.HERO_NOTION_NEW_DOCUMENT_SYNC_APPROVED !== "true") fail("New document sync requires HERO_NOTION_NEW_DOCUMENT_SYNC_APPROVED=true.");
  if (!sync || sync.status !== "approved") fail("The new document sync is not approved in the policy.");
  if (sync.authorization_id !== authorization.authorizationId || sync.step_id !== "NOTION-DOCUMENT-SYNC-CURRENT-CATALOG-20260911" || sync.document_version !== "1.0.0") fail("New document sync authorization does not match the policy.");
  if (sync.mode !== "git-canonical-create-or-adopt-existing-equivalent" || sync.global_stop === true) fail("New document sync scope is invalid.");
  if (!Array.isArray(sync.documents) || sync.documents.length !== 2 || !Array.isArray(sync.document_ids) || sync.document_ids.length !== 2) fail("The bounded new-document list is invalid.");
  if (authorization.status !== "active" || authorization.globalStop === true) fail("Authorization is inactive or Global Stop is active.");
  if (!authorization.operations?.includes("read") || !authorization.operations?.includes("notion-write") || !authorization.operations?.includes("notion-page-create")) fail("Authorization does not grant the required bounded operations.");
  if (sync.catalog_digest !== snapshot.digest || authorization.scope?.catalogDigest !== snapshot.digest) fail("New document sync authorization is stale for the current catalog.");
  if (policy.classification_review?.status !== "approved" || policy.classification_review.catalog_digest !== snapshot.digest || policy.classification_review.candidate_count !== snapshot.documents.length) fail("Classification review does not match the current catalog.");
  for (const item of sync.documents) {
    const authorizedDocument = authorization.documents?.find(document => document.documentId === item.document_id && document.documentVersion === item.document_version);
    const authorizedStep = authorization.steps?.find(step => step.stepId === item.step_id && step.documentVersion === item.document_version);
    if (!authorizedDocument || !authorizedStep || !authorization.scope.documentIds.includes(item.document_id)) fail(`Document or Step ID is not in the active authorization snapshot: ${item.document_id}`);
  }
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
  const results = [];
  try {
    for (const approved of policy.new_document_sync.documents) {
      const document = catalog.document(approved.document_id);
      if (document.notionEligible === false || document.classification !== "internal") fail(`The approved document is not eligible for internal Notion projection: ${document.id}`);
      const projectedContent = renderNotionDocumentContent(document, document.content);
      const sourceChecksum = checksum(projectedContent, document.title);
      const mapped = await runtime.notionSyncMappings.get(document.id);
      if (mapped?.pageId) {
        const current = await withRetry(() => adapter.getMarkdownPage(mapped.pageId));
        const notionChecksum = checksum(current?.markdown, document.title);
        if (notionChecksum !== sourceChecksum) fail(`Existing mapped page conflicts with Git: ${document.id}`);
        const now = new Date().toISOString();
        await runtime.notionSyncMappings.put({ ...mapped, sourceChecksum, notionChecksum, status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: now, updatedAt: now });
        results.push({ documentId: document.id, outcome: "already-in-sync", pageId: mapped.pageId });
        continue;
      }

      const search = await withRetry(() => adapter.searchPages(document.title, { pageSize: 20 }));
      const candidates = Array.isArray(search?.results) ? search.results.filter(candidate => candidate?.id && candidate.id !== process.env.HERO_NOTION_PARENT_PAGE_ID) : [];
      let titleConflict = false;
      for (const candidate of candidates) {
        const current = await withRetry(() => adapter.getMarkdownPage(candidate.id));
        const notionChecksum = checksum(current?.markdown, document.title);
        if (hasDocumentMarker(current?.markdown, document.id) || notionChecksum === sourceChecksum) {
          if (notionChecksum !== sourceChecksum) fail(`Existing identified page conflicts with Git: ${document.id}`);
          const now = new Date().toISOString();
          await runtime.notionSyncMappings.put({ documentId: document.id, pageId: candidate.id, canonicalCommit: document.sourceCommit ?? "unknown", sourceChecksum, notionChecksum, status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: now, updatedAt: now });
          results.push({ documentId: document.id, outcome: "adopted-equivalent", pageId: candidate.id });
          titleConflict = false;
          break;
        }
        const exactTitleHeading = `# ${document.title}`;
        if (String(current?.markdown ?? "").split("\n").some(line => line.trim() === exactTitleHeading)) titleConflict = true;
      }
      if (results.at(-1)?.documentId === document.id) continue;
      if (titleConflict) fail(`A similarly titled Notion page exists with different content; no new page was created: ${document.id}`);

      const created = await withRetry(() => adapter.createMarkdownPage({ parentPageId: process.env.HERO_NOTION_PARENT_PAGE_ID, markdown: projectedContent }));
      if (!created?.id) fail(`Notion did not return a page id for ${document.id}`);
      const verified = await withRetry(() => adapter.getMarkdownPage(created.id));
      const notionChecksum = checksum(verified?.markdown, document.title);
      if (!hasDocumentMarker(verified?.markdown, document.id) || notionChecksum !== sourceChecksum) fail(`Post-create verification failed for ${document.id}`);
      const now = new Date().toISOString();
      await runtime.notionSyncMappings.put({ documentId: document.id, pageId: created.id, canonicalCommit: document.sourceCommit ?? "unknown", sourceChecksum, notionChecksum, status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: now, updatedAt: now });
      results.push({ documentId: document.id, outcome: "created-and-verified", pageId: created.id });
    }
  } finally {
    await runtime.close();
  }
  console.log(JSON.stringify({ mode: "approved-new-document-sync", authorizationId: authorization.authorizationId, stepId: "NOTION-DOCUMENT-SYNC-CURRENT-CATALOG-20260911", catalogDigest: snapshot.digest, total: results.length, results }));
}

try {
  await main();
} catch (error) {
  console.error(`Notion new document sync failed: ${error.message}`);
  process.exitCode = 1;
}
