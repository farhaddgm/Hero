import crypto from "node:crypto";

import { NotionAdapterError } from "../../adapters/src/notion-api.mjs";

const MAX_MARKDOWN_BYTES = 512_000;

function checksum(value, title = "") {
  let normalized = String(value ?? "").replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "").replace(/\n{2,}/g, "\n").trim();
  const heading = title ? `# ${title}` : "";
  if (heading && normalized.startsWith(heading)) normalized = normalized.slice(heading.length).trim();
  return crypto.createHash("sha256").update(normalized).digest("hex");
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
    return Object.freeze({
      syncPlanVersion: "1.0",
      documentId: document.id,
      title: document.title,
      sourceChecksum: checksum(content, document.title),
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
    try {
      const result = pageId
        ? await adapter.updateMarkdownPage(pageId, { type: "replace_content", replace_content: { new_str: content } })
        : await adapter.createMarkdownPage({ parentPageId, markdown: content });
      return Object.freeze({ ...plan, mode: "executed", notion: { pageId: result?.id ?? pageId, checksum: checksum(result?.markdown ?? content, document.title) }, result });
    } catch (error) {
      if (error instanceof NotionAdapterError) throw new NotionSyncError(error.code, error.message, error.statusCode);
      throw error;
    }
  }

  return Object.freeze({ planDocument, syncDocument, status: () => Object.freeze({ configured: adapter.configured, mode: adapter.configured ? "api-ready" : "disabled" }) });
}
