import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";

const POLICY_FILE = "config/product-development/notion-allowlist.json";
const AUTHORIZATION_FILE = "config/authorizations/notion-20260911-005.json";
const PAGE_ID = "3d812710-4ae0-800a-b703-c34d1f4641f1";
const STEP_ID = "NOTION-EMPTY-PAGE-ARCHIVE";

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
  const policy = JSON.parse(fs.readFileSync(POLICY_FILE, "utf8"));
  const authorization = JSON.parse(fs.readFileSync(AUTHORIZATION_FILE, "utf8"));
  const scope = policy.empty_page_archive;
  if (process.env.HERO_NOTION_EMPTY_PAGE_ARCHIVE_APPROVED !== "true") fail("Empty page archive requires HERO_NOTION_EMPTY_PAGE_ARCHIVE_APPROVED=true.");
  if (!scope || scope.status !== "approved" || scope.authorization_id !== authorization.authorizationId || scope.step_id !== STEP_ID || scope.page_id !== PAGE_ID) fail("Empty page archive scope does not match the authorization.");
  if (authorization.status !== "active" || authorization.globalStop === true || !authorization.operations?.includes("read") || !authorization.operations?.includes("notion-page-archive")) fail("Archive authorization is inactive or insufficient.");
  if (authorization.scope?.pageId !== PAGE_ID || authorization.scope?.mode !== "archive-exact-empty-unmapped-page") fail("Archive authorization page scope is invalid.");
  const adapter = createNotionApiAdapter();
  if (!adapter.configured) fail("Notion connector is not configured.");
  const runtime = await createPostgresRuntime();
  try {
    const mappings = await runtime.notionSyncMappings.list({ limit: 1000 });
    if (mappings.some(mapping => mapping.pageId === PAGE_ID)) fail("The exact page is mapped; archive is blocked.");
    const page = await adapter.getPage(PAGE_ID);
    const markdown = await adapter.getMarkdownPage(PAGE_ID);
    if (page.in_trash === true || page.archived === true) {
      console.log(JSON.stringify({ mode: "approved-empty-page-archive", authorizationId: authorization.authorizationId, stepId: STEP_ID, pageId: PAGE_ID, outcome: "already-archived" }));
      return;
    }
    if (String(markdown?.markdown ?? "").trim() !== "") fail("The exact page is not empty; archive is blocked.");
    const properties = page.properties ?? {};
    const hasUnexpectedContent = Object.entries(properties).some(([key, value]) => {
      if (!["ID", "Status", "Name"].includes(key)) return false;
      return (value?.type === "rich_text" && (value.rich_text?.length ?? 0) > 0) || (value?.type === "select" && value.select !== null) || (value?.type === "title" && (value.title?.length ?? 0) > 0);
    });
    if (hasUnexpectedContent) fail("The exact page has property content; archive is blocked.");
    await adapter.archivePage(PAGE_ID);
    const after = await adapter.getPage(PAGE_ID);
    if (after.in_trash !== true && after.archived !== true) fail("Archive verification failed.");
    console.log(JSON.stringify({ mode: "approved-empty-page-archive", authorizationId: authorization.authorizationId, stepId: STEP_ID, pageId: PAGE_ID, outcome: "archived-and-verified" }));
  } finally { await runtime.close(); }
}

try { await main(); } catch (error) { console.error(`Notion empty page archive failed: ${error.message}`); process.exitCode = 1; }
