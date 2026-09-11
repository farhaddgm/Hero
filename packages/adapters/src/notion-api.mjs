const DEFAULT_NOTION_VERSION = "2026-03-11";
const NOTION_BASE_URL = "https://api.notion.com/v1";

export class NotionAdapterError extends Error {
  constructor(code, message, statusCode = 502, details = {}) {
    super(message);
    this.name = "NotionAdapterError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function assertId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(value)) throw new NotionAdapterError("INVALID_NOTION_ID", `${label} is invalid.`, 400);
  return value;
}

export function createNotionApiAdapter({ token = process.env.HERO_NOTION_API_TOKEN, enabled = process.env.HERO_NOTION_ENABLED === "true", fetchImpl = globalThis.fetch, baseUrl = NOTION_BASE_URL, notionVersion = process.env.HERO_NOTION_API_VERSION ?? DEFAULT_NOTION_VERSION } = {}) {
  const configured = enabled === true && typeof token === "string" && token.trim() !== "" && typeof fetchImpl === "function";

  async function request(pathname, { method = "GET", body } = {}) {
    if (!configured) throw new NotionAdapterError("NOTION_NOT_CONFIGURED", "Notion connector is not configured; no external request was made.", 503);
    const response = await fetchImpl(`${baseUrl}${pathname}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "Notion-Version": notionVersion,
        "content-type": "application/json"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) {
      const retryAfter = response.headers?.get?.("retry-after") ?? null;
      throw new NotionAdapterError(
        response.status === 429 ? "NOTION_RATE_LIMITED" : "NOTION_REQUEST_FAILED",
        payload?.message ?? `Notion request failed with status ${response.status}.`,
        response.status,
        { retryAfter, notionCode: payload?.code ?? null }
      );
    }
    return payload;
  }

  return Object.freeze({
    configured,
    async getPage(pageId) { return request(`/pages/${assertId(pageId, "pageId")}`); },
    async getDatabase(databaseId) { return request(`/databases/${assertId(databaseId, "databaseId")}`); },
    async getDataSource(dataSourceId) { return request(`/data_sources/${assertId(dataSourceId, "dataSourceId")}`); },
    async updateDataSource(dataSourceId, payload) { return request(`/data_sources/${assertId(dataSourceId, "dataSourceId")}`, { method: "PATCH", body: payload }); },
    async queryDataSource(dataSourceId, payload = {}) { return request(`/data_sources/${assertId(dataSourceId, "dataSourceId")}/query`, { method: "POST", body: payload }); },
    async createPage(payload) { return request("/pages", { method: "POST", body: payload }); },
    async createDatabase(payload) { return request("/databases", { method: "POST", body: payload }); },
    async createMarkdownPage({ parentPageId, markdown, properties } = {}) {
      return request("/pages", {
        method: "POST",
        body: {
          parent: { page_id: assertId(parentPageId, "parentPageId") },
          ...(properties ? { properties } : {}),
          markdown: String(markdown ?? "")
        }
      });
    },
    async createMarkdownDataSourcePage({ dataSourceId, markdown, properties } = {}) {
      return request("/pages", {
        method: "POST",
        body: {
          parent: { type: "data_source_id", data_source_id: assertId(dataSourceId, "dataSourceId") },
          ...(properties ? { properties } : {}),
          markdown: String(markdown ?? "")
        }
      });
    },
    async getMarkdownPage(pageId, { includeTranscript = false } = {}) {
      const query = includeTranscript ? "?include_transcript=true" : "";
      return request(`/pages/${assertId(pageId, "pageId")}/markdown${query}`);
    },
    async updateMarkdownPage(pageId, payload) {
      return request(`/pages/${assertId(pageId, "pageId")}/markdown`, { method: "PATCH", body: payload });
    },
    async searchPages(query = "", { startCursor, pageSize = 100 } = {}) {
      const body = {
        query: String(query),
        page_size: Math.min(100, Math.max(1, pageSize)),
        filter: { property: "object", value: "page" }
      };
      if (startCursor) body.start_cursor = startCursor;
      return request("/search", { method: "POST", body });
    },
    async updatePage(pageId, payload) { return request(`/pages/${assertId(pageId, "pageId")}`, { method: "PATCH", body: payload }); },
    async archivePage(pageId) { return request(`/pages/${assertId(pageId, "pageId")}`, { method: "PATCH", body: { in_trash: true } }); },
    async listBlockChildren(blockId, { startCursor, pageSize = 100 } = {}) {
      const id = assertId(blockId, "blockId");
      const query = new URLSearchParams({ page_size: String(Math.min(100, Math.max(1, pageSize))) });
      if (startCursor) query.set("start_cursor", startCursor);
      return request(`/blocks/${id}/children?${query}`);
    }
  });
}
