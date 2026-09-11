import crypto from "node:crypto";

import { NotionAdapterError } from "../../adapters/src/notion-api.mjs";

const MAX_MARKDOWN_BYTES = 512_000;

function legacyNormalizedMarkdown(value, title = "") {
  let normalized = String(value ?? "").replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "").replace(/\n{2,}/g, "\n").trim();
  const heading = title ? `# ${title}` : "";
  if (heading && normalized.startsWith(heading)) normalized = normalized.slice(heading.length).trim();
  return normalized;
}

function markdownTableCells(line) {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  return value.split("|").map(cell => cell.trim());
}

function isMarkdownTableSeparator(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function canonicalizeMarkdown(value) {
  let normalized = String(value ?? "").replaceAll("\r\n", "\n").replace(/^```text$/gm, "```plain text").replace(/\]\((?!https?:\/\/|mailto:|#)([^)\s]+)\)/g, "](https://$1)");
  normalized = normalized.replace(/<table(?:\s+[^>]*)?>[\s\S]*?<\/table>/g, match => {
    const rows = [...match.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(row => [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(cell => cell[1].trim()));
    return `TABLE:${JSON.stringify(rows)}`;
  });
  const lines = normalized.split("\n");
  const output = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim().startsWith("|") && isMarkdownTableSeparator(lines[index + 1] ?? "")) {
      const rows = [markdownTableCells(lines[index])];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(markdownTableCells(lines[index]));
        index += 1;
      }
      index -= 1;
      output.push(`TABLE:${JSON.stringify(rows)}`);
    } else {
      output.push(lines[index]);
    }
  }
  return output.join("\n").replace(/[ \t]+$/gm, "").replace(/\n{2,}/g, "\n").trim();
}

export function hasDocumentMarker(markdown, documentId) {
  return String(markdown ?? "").includes(`Document ID: \`${documentId}\``) || String(markdown ?? "").includes(`Document ID: ${documentId}`);
}

export function renderNotionDocumentContent(document, content) {
  const source = String(content ?? "");
  if (hasDocumentMarker(source, document?.id)) return source;
  return `> Hero Document ID: \`${document?.id}\`\n\n${source}`;
}

export function checksum(value, title = "") {
  let normalized = canonicalizeMarkdown(value);
  const heading = title ? `# ${title}` : "";
  if (heading && normalized.startsWith(heading)) normalized = normalized.slice(heading.length).trim();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function legacyChecksum(value, title = "") {
  return crypto.createHash("sha256").update(legacyNormalizedMarkdown(value, title)).digest("hex");
}

export class NotionSyncError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "NotionSyncError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createNotionSyncService({ adapter, now = () => new Date().toISOString() } = {}) {
  if (!adapter || typeof adapter.configured !== "boolean") throw new NotionSyncError("NOTION_ADAPTER_REQUIRED", "A Notion adapter is required.", 500);

  function planDocument({ document, content, parentPageId, pageId = null } = {}) {
    if (!document?.id || typeof content !== "string") throw new NotionSyncError("INVALID_SYNC_INPUT", "document and content are required.");
    if (Buffer.byteLength(content) > MAX_MARKDOWN_BYTES) throw new NotionSyncError("MARKDOWN_TOO_LARGE", "Document content exceeds the bounded sync size.");
    if (!parentPageId && !pageId) throw new NotionSyncError("NOTION_PARENT_REQUIRED", "parentPageId or pageId is required.");
    const projectedContent = renderNotionDocumentContent(document, content);
    return Object.freeze({
      syncPlanVersion: "1.0",
      documentId: document.id,
      title: document.title,
      sourceChecksum: checksum(projectedContent, document.title),
      sourceCommit: document.sourceCommit ?? "unknown",
      editClass: document.editClass,
      operation: pageId ? "update-markdown" : "create-markdown",
      parentPageId: parentPageId ?? null,
      pageId,
      createdAt: now(),
      mode: "dry-run"
    });
  }

  async function syncDocument({ document, content, parentPageId, pageId = null, mode = "dry-run", allowExternalWrite = false } = {}) {
    const plan = planDocument({ document, content, parentPageId, pageId });
    if (mode !== "execute") return plan;
    if (!allowExternalWrite) throw new NotionSyncError("EXTERNAL_WRITE_NOT_AUTHORIZED", "Notion write requires explicit runtime authorization.", 403);
    if (!adapter.configured) throw new NotionSyncError("NOTION_NOT_CONFIGURED", "Notion connector is not configured.", 503);
    const projectedContent = renderNotionDocumentContent(document, content);
    try {
      const result = pageId
        ? await adapter.updateMarkdownPage(pageId, { type: "replace_content", replace_content: { new_str: projectedContent } })
        : await adapter.createMarkdownPage({ parentPageId, markdown: projectedContent });
      const persistedPageId = result?.id ?? pageId;
      let persistedContent = result?.markdown ?? projectedContent;
      if (persistedPageId && typeof adapter.getMarkdownPage === "function") {
        const persisted = await adapter.getMarkdownPage(persistedPageId);
        if (typeof persisted?.markdown === "string") persistedContent = persisted.markdown;
      }
      return Object.freeze({ ...plan, mode: "executed", notion: { pageId: persistedPageId, checksum: checksum(persistedContent, document.title) }, result });
    } catch (error) {
      if (error instanceof NotionAdapterError) throw new NotionSyncError(error.code, error.message, error.statusCode);
      throw error;
    }
  }

  return Object.freeze({ planDocument, syncDocument, status: () => Object.freeze({ configured: adapter.configured, mode: adapter.configured ? "api-ready" : "disabled" }) });
}
