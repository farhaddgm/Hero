import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";
import { checksum, renderNotionDocumentContent } from "../packages/domain/src/notion-sync.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";

const POLICY_FILE = "config/product-development/notion-allowlist.json";
const AUTHORIZATION_FILE = "config/authorizations/notion-20260911-001.json";

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

function sameIds(left, right) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
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
  const resolution = policy.conflict_resolution;
  if (process.env.HERO_NOTION_CONFLICT_RESOLUTION_APPROVED !== "true") fail("Conflict resolution requires HERO_NOTION_CONFLICT_RESOLUTION_APPROVED=true.");
  if (!resolution || resolution.status !== "approved") fail("Conflict resolution is not approved in the policy.");
  if (resolution.authorization_id !== authorization.authorizationId) fail("Conflict resolution authorization id does not match the policy.");
  if (resolution.step_id !== "NOTION-CONFLICT-RESOLUTION" || resolution.document_version !== "1.0.0") fail("Conflict resolution step or document version is invalid.");
  if (resolution.mode !== "git-canonical-overwrite-notion" || resolution.global_stop === true) fail("Conflict resolution mode or Global Stop is invalid.");
  if (authorization.status !== "active" || authorization.globalStop === true) fail("Authorization is inactive or Global Stop is active.");
  if (!authorization.operations?.includes("read") || !authorization.operations?.includes("notion-write") || !authorization.operations?.includes("conflict-resolution")) fail("Authorization does not grant the required bounded operations.");
  const step = authorization.steps?.find(item => item.stepId === resolution.step_id);
  if (!step || step.documentVersion !== resolution.document_version) fail("Step ID and document version do not match the active authorization snapshot.");
  if (resolution.catalog_digest !== snapshot.digest || authorization.scope?.catalogDigest !== snapshot.digest) fail("Conflict resolution authorization is stale for the current catalog.");
  if (policy.classification_review?.status !== "approved" || policy.classification_review.catalog_digest !== snapshot.digest || policy.classification_review.candidate_count !== snapshot.documents.length) fail("Classification review does not match the current catalog.");
}

async function main() {
  loadRuntimeEnv();
  const policy = JSON.parse(fs.readFileSync(POLICY_FILE, "utf8"));
  const authorization = JSON.parse(fs.readFileSync(AUTHORIZATION_FILE, "utf8"));
  const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
  const snapshot = catalog.snapshot();
  validateAuthorization({ policy, authorization, snapshot });
  if (!process.env.HERO_POSTGRES_URL) fail("Conflict resolution requires HERO_POSTGRES_URL.");
  if (!process.env.HERO_NOTION_PARENT_PAGE_ID) fail("Conflict resolution requires HERO_NOTION_PARENT_PAGE_ID.");

  const expectedIds = policy.conflict_resolution.document_ids;
  if (!Array.isArray(expectedIds) || expectedIds.length === 0 || new Set(expectedIds).size !== expectedIds.length) fail("The conflict queue must contain unique document IDs.");
  const documents = new Map(snapshot.documents.map(document => [document.id, { ...document, content: catalog.document(document.id).content }]));
  for (const documentId of expectedIds) {
    const document = documents.get(documentId);
    if (!document || document.notionEligible === false || (document.classification ?? "internal") !== "internal") fail(`Conflict queue contains an ineligible document: ${documentId}`);
  }

  const adapter = createNotionApiAdapter();
  if (!adapter.configured) fail("Notion connector is not configured.");
  const runtime = await createPostgresRuntime();
  const results = [];
  try {
    const mappings = await runtime.notionSyncMappings.list({ limit: 1000 });
    const conflictMappings = mappings.filter(mapping => mapping.status === "conflict");
    const unexpected = conflictMappings.map(mapping => mapping.documentId).filter(documentId => !expectedIds.includes(documentId));
    if (unexpected.length > 0) fail(`Unexpected conflict(s) outside the approved queue: ${unexpected.join(", ")}`);
    const pendingIds = expectedIds.filter(documentId => conflictMappings.some(mapping => mapping.documentId === documentId));
    if (pendingIds.length === 0) {
      console.log(JSON.stringify({ mode: "git-canonical-conflict-resolution", authorizationId: authorization.authorizationId, stepId: "NOTION-CONFLICT-RESOLUTION", catalogDigest: snapshot.digest, total: 0, synced: 0, alreadyInSync: 0, conflicts: 0, message: "No approved conflict remains." }));
      return;
    }
    if (!sameIds(pendingIds, conflictMappings.map(mapping => mapping.documentId))) fail("Conflict queue changed during preflight; no external write was attempted.");

    const preflight = [];
    for (const documentId of pendingIds) {
      const mapping = conflictMappings.find(item => item.documentId === documentId);
      if (!mapping?.pageId) fail(`Conflict mapping has no existing Notion page: ${documentId}`);
      const document = documents.get(documentId);
      const sourceContent = renderNotionDocumentContent(document, document.content);
      const sourceChecksum = checksum(sourceContent, document.title);
      const current = await withRetry(() => adapter.getMarkdownPage(mapping.pageId));
      preflight.push({ document, mapping, sourceContent, sourceChecksum, currentChecksum: checksum(current?.markdown, document.title) });
    }

    for (const item of preflight) {
      const { document, mapping, sourceContent, sourceChecksum, currentChecksum } = item;
      if (currentChecksum === sourceChecksum) {
        await runtime.notionSyncMappings.put({ ...mapping, sourceChecksum, notionChecksum: currentChecksum, canonicalCommit: document.sourceCommit ?? "unknown", status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: new Date().toISOString(), updatedAt: new Date().toISOString() });
        results.push({ documentId: document.id, outcome: "already-in-sync", pageId: mapping.pageId });
        continue;
      }
      await withRetry(() => adapter.updateMarkdownPage(mapping.pageId, { type: "replace_content", replace_content: { new_str: sourceContent } }));
      const persisted = await withRetry(() => adapter.getMarkdownPage(mapping.pageId));
      const notionChecksum = checksum(persisted?.markdown, document.title);
      if (notionChecksum !== sourceChecksum) fail(`Post-write verification failed for ${document.id}`);
      const now = new Date().toISOString();
      await runtime.notionSyncMappings.put({ ...mapping, sourceChecksum, notionChecksum, canonicalCommit: document.sourceCommit ?? "unknown", status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: now, updatedAt: now });
      results.push({ documentId: document.id, outcome: "synced", pageId: mapping.pageId });
    }
  } finally {
    await runtime.close();
  }
  console.log(JSON.stringify({ mode: "git-canonical-conflict-resolution", authorizationId: authorization.authorizationId, stepId: "NOTION-CONFLICT-RESOLUTION", catalogDigest: snapshot.digest, total: results.length, synced: results.filter(item => item.outcome === "synced").length, alreadyInSync: results.filter(item => item.outcome === "already-in-sync").length, conflicts: results.filter(item => item.outcome === "conflict").length, results }));
}

try {
  await main();
} catch (error) {
  console.error(`Notion conflict resolution failed: ${error.message}`);
  process.exitCode = 1;
}
