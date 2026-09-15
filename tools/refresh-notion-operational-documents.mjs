import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";
import { checksum, hasDocumentMarker, renderNotionDocumentContent } from "../packages/domain/src/notion-sync.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";

const POLICY_FILE = "config/product-development/notion-allowlist.json";
const AUTHORIZATION_FILE = "config/authorizations/notion-20260911-003.json";
const STEP_ID = "NOTION-OPERATIONAL-DOC-REFRESH";

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
  const refresh = policy.operational_document_refresh;
  if (process.env.HERO_NOTION_OPERATIONAL_REFRESH_APPROVED !== "true") fail("Operational document refresh requires HERO_NOTION_OPERATIONAL_REFRESH_APPROVED=true.");
  if (!refresh || refresh.status !== "approved") fail("Operational document refresh is not approved in the policy.");
  if (refresh.authorization_id !== authorization.authorizationId || refresh.step_id !== STEP_ID || refresh.document_version !== "1.0.0") fail("Operational document refresh authorization does not match the policy.");
  if (refresh.mode !== "git-canonical-refresh-existing-mapped-pages" || refresh.global_stop === true) fail("Operational document refresh scope is invalid.");
  if (authorization.status !== "active" || authorization.globalStop === true) fail("Authorization is inactive or Global Stop is active.");
  if (!authorization.operations?.includes("read") || !authorization.operations?.includes("notion-write") || !authorization.operations?.includes("notion-canonical-refresh")) fail("Authorization does not grant the required bounded operations.");
  if (refresh.catalog_digest !== snapshot.digest || authorization.scope?.catalogDigest !== snapshot.digest) fail("Operational document refresh authorization is stale for the current catalog.");
  if (policy.classification_review?.status !== "approved" || policy.classification_review.catalog_digest !== snapshot.digest || policy.classification_review.candidate_count !== snapshot.documents.length) fail("Classification review does not match the current catalog.");
  if (!Array.isArray(refresh.documents) || refresh.documents.length !== 3 || !Array.isArray(refresh.document_ids) || refresh.document_ids.length !== 3) fail("The bounded operational document list is invalid.");
  for (const item of refresh.documents) {
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
    for (const approved of policy.operational_document_refresh.documents) {
      const document = catalog.document(approved.document_id);
      if (document.notionEligible === false || document.classification !== "internal") fail(`The approved document is not eligible for internal Notion projection: ${document.id}`);
      const mapping = await runtime.notionSyncMappings.get(document.id);
      if (!mapping?.pageId) fail(`Existing mapped page is required; no page mapping exists for ${document.id}`);
      const sourceContent = renderNotionDocumentContent(document, document.content);
      const sourceChecksum = checksum(sourceContent, document.title);
      await withRetry(() => adapter.updateMarkdownPage(mapping.pageId, { type: "replace_content", replace_content: { new_str: sourceContent } }));
      const persisted = await withRetry(() => adapter.getMarkdownPage(mapping.pageId));
      const notionChecksum = checksum(persisted?.markdown, document.title);
      if (!hasDocumentMarker(persisted?.markdown, document.id) || notionChecksum !== sourceChecksum) fail(`Post-write verification failed for ${document.id}`);
      const now = new Date().toISOString();
      await runtime.notionSyncMappings.put({ ...mapping, sourceChecksum, notionChecksum, canonicalCommit: document.sourceCommit ?? "unknown", status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: now, updatedAt: now });
      results.push({ documentId: document.id, outcome: "refreshed-and-verified", pageId: mapping.pageId });
    }
  } finally {
    await runtime.close();
  }
  console.log(JSON.stringify({ mode: "approved-operational-document-refresh", authorizationId: authorization.authorizationId, stepId: STEP_ID, catalogDigest: snapshot.digest, total: results.length, results }));
}

try {
  await main();
} catch (error) {
  console.error(`Notion operational document refresh failed: ${error.message}`);
  process.exitCode = 1;
}
