import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createNotionWorkspaceBlueprint } from "../packages/contracts/src/index.mjs";

const PLAN_FILE = "config/product-development/notion-view-plan.json";
const DATABASE_SECTIONS = Object.freeze({
  products: "portfolio",
  objectives: "hero-product",
  initiatives: "hero-product",
  "roadmap-items": "hero-product",
  documents: "shared-knowledge",
  decisions: "decisions-evidence",
  evidence: "decisions-evidence",
  risks: "decisions-evidence",
  releases: "decisions-evidence",
  "change-proposals": "decisions-evidence",
  "sync-health": "integration-health",
  "work-items": "execution-management",
  tasks: "execution-management",
  iterations: "execution-management"
});

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

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function withRetry(operation) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try { return await operation(); } catch (error) {
      const retryable = error?.code === "NOTION_RATE_LIMITED" || error?.code === "NOTION_TIMEOUT" || Number(error?.statusCode ?? 0) >= 500;
      if (!retryable || attempt === 6) throw error;
      const retryAfter = Number(error?.details?.retryAfter ?? 0);
      await sleep(Math.min(30_000, retryAfter > 0 ? retryAfter * 1_000 : 1_000 * (2 ** Math.min(4, attempt - 1))));
    }
  }
}

async function children(adapter, parentId) {
  const result = [];
  let cursor;
  do {
    const page = await withRetry(() => adapter.listBlockChildren(parentId, { pageSize: 100, ...(cursor ? { startCursor: cursor } : {}) }));
    result.push(...(page.results ?? []));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return result;
}

async function fullViews(adapter, databaseId) {
  const refs = await withRetry(() => adapter.listViews({ databaseId }));
  const result = [];
  for (const reference of refs.results ?? []) {
    result.push(await withRetry(() => adapter.getView(reference.id)));
    await sleep(350);
  }
  return result;
}

function titleOf(block) {
  return block?.type === "child_page" ? block.child_page?.title ?? "" : block?.type === "child_database" ? block.child_database?.title ?? "" : "";
}

function notionLink(id) { return `https://app.notion.com/p/${String(id).replaceAll("-", "")}`; }

loadRuntimeEnv();
const adapter = createNotionApiAdapter();
if (!adapter.configured) throw new Error("Notion connector is not configured.");
const plan = JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
const blueprint = createNotionWorkspaceBlueprint();
const rootChildren = await children(adapter, process.env.HERO_NOTION_PARENT_PAGE_ID);
const sections = Object.fromEntries(blueprint.sections.map(section => [section.id, rootChildren.find(block => block.type === "child_page" && titleOf(block) === section.title)]).filter(([, block]) => block).map(([id, block]) => [id, block.id]));
const databases = {};
for (const definition of blueprint.databases) {
  const sectionId = DATABASE_SECTIONS[definition.id];
  const sectionChildren = sections[sectionId] ? await children(adapter, sections[sectionId]) : [];
  const block = sectionChildren.find(item => item.type === "child_database" && titleOf(item) === definition.title);
  if (!block) continue;
  const database = await withRetry(() => adapter.getDatabase(block.id));
  const dataSourceId = database.data_sources?.[0]?.id;
  databases[definition.id] = { id: block.id, dataSourceId, dataSource: dataSourceId ? await withRetry(() => adapter.getDataSource(dataSourceId)) : null };
}

const databaseViewResults = [];
for (const spec of plan.database_views) {
  const database = databases[spec.database];
  const views = database ? await fullViews(adapter, database.id) : [];
  const view = views.find(item => item.name === spec.name && item.type === spec.type);
  const dateProperty = spec.configuration?.date_property_id;
  const endDateProperty = spec.configuration?.end_date_property_id;
  const requiredProperties = [dateProperty, endDateProperty].filter(Boolean);
  const missingProperties = requiredProperties.filter(name => !database?.dataSource?.properties?.[name]);
  databaseViewResults.push({ id: spec.id, name: spec.name, type: spec.type, found: Boolean(view), valid: Boolean(view) && missingProperties.length === 0, missingProperties, viewId: view?.id ?? null, url: view?.url ?? (view ? notionLink(view.id) : null) });
}

const dashboardResults = [];
for (const definition of plan.dashboards) {
  const sectionId = sections[definition.parent_section];
  const sectionChildren = sectionId ? await children(adapter, sectionId) : [];
  let block = null;
  let dashboard = null;
  for (const candidate of sectionChildren.filter(item => item.type === "child_database")) {
    const views = await fullViews(adapter, candidate.id);
    const match = views.find(view => view.name === definition.name && view.type === "dashboard");
    if (match) { block = candidate; dashboard = match; break; }
  }
  const widgetIds = new Set((dashboard?.configuration?.rows ?? []).flatMap(row => (row.widgets ?? []).map(widget => widget.view_id)).filter(Boolean));
  const actualWidgets = [];
  for (const widgetId of widgetIds) {
    actualWidgets.push(await withRetry(() => adapter.getView(widgetId)));
    await sleep(350);
  }
  const widgets = definition.widgets.map(expected => {
    const view = actualWidgets.find(item => item.name === expected.name && item.type === expected.type);
    return { id: expected.id, name: expected.name, type: expected.type, found: Boolean(view), viewId: view?.id ?? null, url: view?.url ?? (view ? notionLink(view.id) : null) };
  });
  dashboardResults.push({ id: definition.id, name: definition.name, found: Boolean(dashboard), valid: Boolean(dashboard) && widgets.every(widget => widget.found), viewId: dashboard?.id ?? null, url: dashboard?.url ?? (dashboard ? notionLink(dashboard.id) : null), widgetCount: actualWidgets.length, expectedWidgetCount: definition.widgets.length, widgets });
}

const guideBlock = sections["control-center"] ? (await children(adapter, sections["control-center"])).find(block => block.type === "child_page" && titleOf(block) === "Hero — Views & Dashboards Guide") : null;
const result = {
  ok: databaseViewResults.every(item => item.valid) && dashboardResults.every(item => item.valid) && Boolean(guideBlock),
  databaseViews: { expected: databaseViewResults.length, valid: databaseViewResults.filter(item => item.valid).length, items: databaseViewResults },
  dashboards: { expected: dashboardResults.length, valid: dashboardResults.filter(item => item.valid).length, items: dashboardResults },
  guide: { found: Boolean(guideBlock), pageId: guideBlock?.id ?? null, url: guideBlock ? notionLink(guideBlock.id) : null },
  planningFields: {
    workItems: ["Start", "End"].map(name => ({ name, present: Boolean(databases["work-items"]?.dataSource?.properties?.[name]) })),
    tasks: ["Start", "End", "Due Date"].map(name => ({ name, present: Boolean(databases.tasks?.dataSource?.properties?.[name]) }))
  }
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 2;
