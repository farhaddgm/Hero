import crypto from "node:crypto";
import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";

const NOTION_ALLOWLIST = "config/product-development/notion-allowlist.json";

function loadRuntimeEnv(file = ".env") {
  if (!fs.existsSync(file)) throw new Error(".env is required for the Notion sync command.");
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

function normalizedMarkdown(value) {
  return String(value ?? "").replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "").trim();
}

function checksum(value, title = "") {
  let normalized = normalizedMarkdown(value).replace(/\n{2,}/g, "\n");
  const heading = title ? `# ${title}` : "";
  if (heading && normalized.startsWith(heading)) normalized = normalized.slice(heading.length).trim();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function hasDocumentMarker(markdown, documentId) {
  return markdown.includes(`Document ID: \`${documentId}\``) || markdown.includes(`Document ID: ${documentId}`);
}

async function main() {
  loadRuntimeEnv();
  if (process.env.HERO_NOTION_ENABLED !== "true") throw new Error("HERO_NOTION_ENABLED must be true for the explicit first sync command.");
  const documentId = process.argv.find(value => value.startsWith("--document="))?.slice("--document=".length) ?? "HERO-PRODUCT-HERO-BRIEF";
  const parentPageId = process.env.HERO_NOTION_PARENT_PAGE_ID;
  if (!parentPageId) throw new Error("HERO_NOTION_PARENT_PAGE_ID is required.");

  const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
  const document = catalog.document(documentId);
  const allowlist = JSON.parse(fs.readFileSync(NOTION_ALLOWLIST, "utf8"));
  const allowlisted = (allowlist.documents ?? []).find(item => item.document_id === document.id);
  if (!allowlisted || allowlisted.external_write_approved !== true) throw new Error(`NOTION_DOCUMENT_NOT_ALLOWLISTED:${document.id}`);
  const adapter = createNotionApiAdapter();
  if (!adapter.configured) throw new Error("Notion adapter is not configured.");

  const sourceChecksum = checksum(document.content, document.title);
  const search = await adapter.searchPages(document.title, { pageSize: 20 });
  const candidates = Array.isArray(search?.results) ? search.results : [];
  for (const candidate of candidates) {
    if (!candidate?.id || candidate.id === parentPageId) continue;
    const markdown = await adapter.getMarkdownPage(candidate.id);
    if (!hasDocumentMarker(markdown?.markdown, document.id)) continue;
    const notionChecksum = checksum(markdown.markdown, document.title);
    if (notionChecksum !== sourceChecksum) {
      throw new Error(`NOTION_DOCUMENT_CONFLICT:${document.id}:${candidate.id}`);
    }
    console.log(JSON.stringify({ outcome: "already-in-sync", documentId, title: document.title, pageId: candidate.id, pageUrl: candidate.url ?? null, sourceChecksum, notionChecksum, exactChecksumMatch: true }));
    return;
  }

  const created = await adapter.createMarkdownPage({ parentPageId, markdown: document.content });
  if (!created?.id) throw new Error("Notion did not return a page id after creation.");
  const verified = await adapter.getMarkdownPage(created.id);
  if (!hasDocumentMarker(verified?.markdown, document.id)) throw new Error(`NOTION_VERIFY_MARKER_MISSING:${document.id}:${created.id}`);
  const notionChecksum = checksum(verified.markdown, document.title);
  console.log(JSON.stringify({ outcome: "created-and-verified", documentId, title: document.title, pageId: created.id, pageUrl: created.url ?? null, sourceChecksum, notionChecksum, exactChecksumMatch: sourceChecksum === notionChecksum }));
}

try {
  await main();
} catch (error) {
  console.error(`Notion first sync failed: ${error.message}`);
  process.exitCode = 1;
}
