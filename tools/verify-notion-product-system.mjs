import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";
import { checksum, renderNotionDocumentContent } from "../packages/domain/src/notion-sync.mjs";

function loadRuntimeEnv(file = ".env") {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

async function children(adapter, parentId) {
  const result = [];
  let cursor;
  do {
    const page = await adapter.listBlockChildren(parentId, { pageSize: 100, ...(cursor ? { startCursor: cursor } : {}) });
    result.push(...(page.results ?? []));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return result;
}

async function queryAll(adapter, dataSourceId) {
  const result = [];
  let cursor;
  do {
    const page = await adapter.queryDataSource(dataSourceId, { page_size: 100, result_type: "page", ...(cursor ? { start_cursor: cursor } : {}) });
    result.push(...(page.results ?? page.page_or_data_source?.results ?? []));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return result;
}

function titleOf(block) {
  return block?.type === "child_page" ? block.child_page?.title : block?.type === "child_database" ? block.child_database?.title : "";
}

function propertyText(page, name) {
  const property = page?.properties?.[name];
  if (!property) return "";
  if (property.type === "title") return (property.title ?? []).map(item => item.plain_text ?? item.text?.content ?? "").join("");
  if (property.type === "rich_text") return (property.rich_text ?? []).map(item => item.plain_text ?? item.text?.content ?? "").join("");
  return property.select?.name ?? "";
}

function relationCount(page, name) {
  return page?.properties?.[name]?.type === "relation" ? (page.properties[name].relation ?? []).length : 0;
}

function notionLink(id) {
  return `https://app.notion.com/p/${String(id).replaceAll("-", "")}`;
}

loadRuntimeEnv();
const adapter = createNotionApiAdapter();
if (!adapter.configured) throw new Error("Notion connector is not configured.");
const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
const snapshot = catalog.snapshot();
const rootId = process.env.HERO_NOTION_PARENT_PAGE_ID;
const root = await children(adapter, rootId);
const sections = {};
for (const block of root) if (block.type === "child_page") sections[titleOf(block)] = block.id;

const expected = {
  Products: "20 — Product Portfolio",
  Objectives: "10 — Hero Product",
  Initiatives: "10 — Hero Product",
  "Roadmap Items": "10 — Hero Product",
  Documents: "30 — Shared Knowledge",
  Decisions: "40 — Decisions and Evidence",
  Evidence: "40 — Decisions and Evidence",
  Risks: "40 — Decisions and Evidence",
  Releases: "40 — Decisions and Evidence",
  "Change Proposals": "40 — Decisions and Evidence",
  "Sync Health": "90 — Integration and Sync Health",
  "Work Items": "15 — Execution and Task Management",
  Tasks: "15 — Execution and Task Management",
  Iterations: "15 — Execution and Task Management"
};
const controlCenterChildren = sections["00 — Control Center"] ? await children(adapter, sections["00 — Control Center"]) : [];
const controlCenter = controlCenterChildren.find(block => block.type === "child_page" && titleOf(block) === "Hero Product System — Control Center");
const databases = {};
let documentProjection = null;
for (const [databaseTitle, sectionTitle] of Object.entries(expected)) {
  const sectionId = sections[sectionTitle];
  const sectionChildren = sectionId ? await children(adapter, sectionId) : [];
  const databaseBlock = sectionChildren.find(block => block.type === "child_database" && titleOf(block) === databaseTitle);
  if (!databaseBlock) {
    databases[databaseTitle] = { found: false, count: 0 };
    continue;
  }
  const database = await adapter.getDatabase(databaseBlock.id);
  const dataSourceId = database.data_sources?.[0]?.id;
  const dataSource = dataSourceId ? await adapter.getDataSource(dataSourceId) : null;
  const pages = dataSourceId ? await queryAll(adapter, dataSourceId) : [];
  if (databaseTitle === "Documents") {
    const eligible = snapshot.documents.filter(document => document.notionEligible !== false && document.classification === "internal");
    const byId = new Map(pages.map(page => [propertyText(page, "Document ID") || propertyText(page, "ID"), page]).filter(([id]) => id));
    const mismatchedIds = eligible.filter(document => {
      const page = byId.get(document.id);
      const source = catalog.document(document.id);
      const expectedChecksum = checksum(renderNotionDocumentContent(source, source.content), document.title);
      return !page || propertyText(page, "Content Checksum") !== expectedChecksum || propertyText(page, "Sync State") !== "in-sync";
    }).map(document => document.id);
    documentProjection = { expectedEligible: eligible.length, databasePages: pages.length, metadataMatches: eligible.length - mismatchedIds.length, mismatchedIds };
  }
  databases[databaseTitle] = {
    found: true,
    databaseId: databaseBlock.id,
    notionUrl: database.url ?? databaseBlock.url ?? null,
    pageCount: pages.length,
    sampleIds: pages.slice(0, 3).map(page => propertyText(page, "ID") || propertyText(page, "Document ID")),
    relationProperties: Object.entries(dataSource?.properties ?? {}).filter(([, property]) => property.type === "relation").map(([name, property]) => ({ name, targetDataSourceId: property.relation?.data_source_id ?? null })),
    relationCoverage: Object.fromEntries(["Objective", "Roadmap Item", "Work Item", "Iteration"].filter(name => pages.some(page => page.properties?.[name])).map(name => [name, { populated: pages.filter(page => relationCount(page, name) > 0).length, total: pages.length }])),
    dataSourceId
  };
}

const runtime = await createPostgresRuntime();
try {
  const mappings = await runtime.notionSyncMappings.list({ limit: 1000 });
  const byStatus = Object.fromEntries([...new Set(mappings.map(mapping => mapping.status))].map(status => [status, mappings.filter(mapping => mapping.status === status).length]));
  console.log(JSON.stringify({
    controlCenter: controlCenter ? { pageId: controlCenter.id, notionUrl: notionLink(controlCenter.id) } : { found: false },
    documentProjection,
    rootSections: Object.fromEntries(Object.entries(sections).filter(([title]) => ["00 — Control Center", "10 — Hero Product", "15 — Execution and Task Management", "20 — Product Portfolio", "30 — Shared Knowledge", "40 — Decisions and Evidence", "90 — Integration and Sync Health"].includes(title))),
    databases,
    documentMappings: { total: mappings.length, byStatus }
  }, null, 2));
} finally {
  await runtime.close();
}
