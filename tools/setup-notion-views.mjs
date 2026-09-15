import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createNotionWorkspaceBlueprint } from "../packages/contracts/src/index.mjs";

const PLAN_FILE = "config/product-development/notion-view-plan.json";
const AUTHORIZATION_FILE = "config/authorizations/notion-20260911-009.json";
const STEP_ID = "NOTION-PRODUCT-SYSTEM-VIEWS-SETUP";
const APPROVAL_ENV = "HERO_NOTION_VIEWS_WRITE_APPROVED";
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

const PLANNING_SCHEMA = Object.freeze({
  "work-items": { Start: { date: {} }, End: { date: {} } },
  tasks: { Start: { date: {} }, End: { date: {} }, "Due Date": { date: {} } }
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

function fail(message) { throw new Error(message); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function withRetry(operation) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try { return await operation(); } catch (error) {
      const retryable = error?.code === "NOTION_RATE_LIMITED" || error?.code === "NOTION_TIMEOUT" || Number(error?.statusCode ?? 0) >= 500;
      if (!retryable || attempt === 6) throw error;
      const retryAfter = Number(error?.details?.retryAfter ?? 0);
      await sleep(Math.min(15_000, retryAfter > 0 ? retryAfter * 1_000 : 500 * (2 ** Math.min(4, attempt - 1))));
    }
  }
  fail("Retry limit exhausted.");
}

async function listAllChildren(adapter, blockId) {
  const result = [];
  let cursor;
  do {
    const page = await withRetry(() => adapter.listBlockChildren(blockId, { pageSize: 100, ...(cursor ? { startCursor: cursor } : {}) }));
    result.push(...(page.results ?? []));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return result;
}

function titleOf(block) {
  return block?.type === "child_page" ? block.child_page?.title ?? "" : block?.type === "child_database" ? block.child_database?.title ?? "" : "";
}

function notionLink(id) {
  return `https://app.notion.com/p/${String(id).replaceAll("-", "")}`;
}

function propertyId(dataSource, name) {
  return dataSource?.properties?.[name]?.id ?? name;
}

function resolveConfiguration(value, dataSource) {
  if (Array.isArray(value)) return value.map(item => resolveConfiguration(item, dataSource));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (["property_id", "date_property_id", "end_date_property_id", "map_by", "x_axis_property_id", "y_axis_property_id", "toggle_column_id"].includes(key) && typeof item === "string") output[key] = propertyId(dataSource, item);
    else output[key] = resolveConfiguration(item, dataSource);
  }
  return output;
}

function viewPayload(spec, database, dataSource, placement = null) {
  const payload = {
    name: spec.name,
    type: spec.type,
    data_source_id: dataSource.id,
    ...(spec.filter ? { filter: spec.filter } : {}),
    ...(spec.sorts ? { sorts: spec.sorts } : {}),
    ...(spec.quick_filters ? { quick_filters: spec.quick_filters } : {}),
    ...(spec.configuration ? { configuration: resolveConfiguration(spec.configuration, dataSource) } : {})
  };
  if (database) payload.database_id = database.id;
  if (placement) payload.placement = placement;
  return payload;
}

async function fullViews(adapter, databaseId) {
  const refs = await withRetry(() => adapter.listViews({ databaseId }));
  const views = [];
  for (const reference of refs.results ?? []) {
    views.push(await withRetry(() => adapter.getView(reference.id)));
    await sleep(150);
  }
  return views;
}

async function discoverWorkspace(adapter, parentPageId, execute) {
  const blueprint = createNotionWorkspaceBlueprint();
  const rootChildren = await listAllChildren(adapter, parentPageId);
  const sections = {};
  for (const section of blueprint.sections) {
    const page = rootChildren.find(block => block.type === "child_page" && titleOf(block) === section.title);
    if (!page) {
      if (execute) fail(`Required Notion section is missing: ${section.title}. Run product-system provisioning first.`);
      continue;
    }
    sections[section.id] = page.id;
  }
  const databases = {};
  for (const definition of blueprint.databases) {
    const sectionId = DATABASE_SECTIONS[definition.id];
    const sectionPageId = sections[sectionId];
    if (!sectionPageId) continue;
    const children = await listAllChildren(adapter, sectionPageId);
    const block = children.find(item => item.type === "child_database" && titleOf(item) === definition.title);
    if (!block) {
      if (execute) fail(`Required Notion database is missing: ${definition.title}. Run product-system provisioning first.`);
      continue;
    }
    const database = await withRetry(() => adapter.getDatabase(block.id));
    const dataSourceId = database.data_sources?.[0]?.id;
    if (!dataSourceId) fail(`Database ${definition.title} has no data source.`);
    let dataSource = await withRetry(() => adapter.getDataSource(dataSourceId));
    const missing = Object.fromEntries(Object.entries(PLANNING_SCHEMA[definition.id] ?? {}).filter(([name]) => !dataSource.properties?.[name]));
    if (Object.keys(missing).length > 0 && execute) {
      await withRetry(() => adapter.updateDataSource(dataSourceId, { properties: missing }));
      await sleep(500);
      dataSource = await withRetry(() => adapter.getDataSource(dataSourceId));
    }
    databases[definition.id] = { ...database, id: block.id, dataSourceId, dataSource, sectionId };
  }
  return { blueprint, sections, databases };
}

function updatePayload(spec, dataSource) {
  const payload = {
    name: spec.name,
    ...(spec.filter ? { filter: spec.filter } : {}),
    ...(spec.sorts ? { sorts: spec.sorts } : {}),
    ...(spec.quick_filters ? { quick_filters: spec.quick_filters } : {}),
    ...(spec.configuration ? { configuration: resolveConfiguration(spec.configuration, dataSource) } : {})
  };
  return payload;
}

async function ensureDatabaseView({ adapter, database, spec, execute }) {
  const views = await fullViews(adapter, database.id);
  const existing = views.find(view => view.name === spec.name && view.type === spec.type);
  if (existing) {
    if (execute) {
      await withRetry(() => adapter.updateView(existing.id, updatePayload(spec, database.dataSource)));
      await sleep(250);
    }
    return { id: spec.id, name: spec.name, type: spec.type, status: execute ? "updated" : "existing", viewId: existing.id, url: existing.url ?? notionLink(existing.id) };
  }
  const nameCollision = views.find(view => view.name === spec.name);
  if (nameCollision) fail(`Managed view name collision for ${spec.name}: existing type is ${nameCollision.type}.`);
  if (!execute) return { id: spec.id, name: spec.name, type: spec.type, status: "planned" };
  const created = await withRetry(() => adapter.createView(viewPayload(spec, database, database.dataSource)));
  await sleep(400);
  return { id: spec.id, name: spec.name, type: spec.type, status: "created", viewId: created.id, url: created.url ?? notionLink(created.id) };
}

async function findDashboard(adapter, children, name) {
  for (const block of children.filter(item => item.type === "child_database")) {
    const views = await fullViews(adapter, block.id);
    const dashboard = views.find(view => view.name === name && view.type === "dashboard");
    if (dashboard) return { block, dashboard };
  }
  return null;
}

async function ensureDashboard({ adapter, workspace, definition, execute }) {
  const parentId = workspace.sections[definition.parent_section];
  const anchor = workspace.databases[definition.anchor_database];
  if (!parentId || !anchor) {
    if (!execute) return { id: definition.id, name: definition.name, status: "blocked", reason: "missing parent or anchor" };
    fail(`Dashboard ${definition.name} has no valid parent or anchor database.`);
  }
  let children = await listAllChildren(adapter, parentId);
  let discovered = await findDashboard(adapter, children, definition.name);
  let block = discovered?.block ?? null;
  let dashboard = discovered?.dashboard ?? null;
  if (!dashboard && execute) {
    const created = await withRetry(() => adapter.createView({
      create_database: { parent: { type: "page_id", page_id: parentId } },
      data_source_id: anchor.dataSourceId,
      name: definition.name,
      type: "dashboard"
    }));
    dashboard = created;
    await sleep(600);
    children = await listAllChildren(adapter, parentId);
    discovered = await findDashboard(adapter, children, definition.name);
    block = discovered?.block ?? block;
    dashboard = discovered?.dashboard ?? dashboard;
  }
  if (!dashboard) return { id: definition.id, name: definition.name, status: "planned", widgets: definition.widgets.length };
  const dashboardId = dashboard.id;
  const rows = dashboard.configuration?.rows ?? [];
  const rowCounts = new Map(rows.map((row, index) => [index, row.widgets?.length ?? 0]));
  const existingWidgetIds = new Set(rows.flatMap(row => (row.widgets ?? []).map(widget => widget.view_id)).filter(Boolean));
  const widgets = [];
  for (const widget of definition.widgets) {
    const source = workspace.databases[widget.database];
    if (!source) fail(`Dashboard widget ${widget.name} references unknown database ${widget.database}.`);
    let current = null;
    for (const widgetId of existingWidgetIds) {
      const candidate = await withRetry(() => adapter.getView(widgetId));
      if (candidate.name === widget.name && candidate.type === widget.type) { current = candidate; break; }
      await sleep(120);
    }
    if (current) {
      if (execute) {
        await withRetry(() => adapter.updateView(current.id, updatePayload(widget, source.dataSource)));
        await sleep(250);
      }
      widgets.push({ id: widget.id, name: widget.name, type: widget.type, status: execute ? "updated" : "existing", viewId: current.id, url: current.url ?? notionLink(current.id) });
      continue;
    }
    if (!execute) {
      widgets.push({ id: widget.id, name: widget.name, type: widget.type, status: "planned" });
      continue;
    }
    const row = Number.isInteger(widget.row) ? widget.row : rows.length;
    const count = rowCounts.get(row) ?? 0;
    const placement = count > 0 ? { type: "existing_row", row_index: row } : { type: "new_row", ...(row < rows.length ? { row_index: row } : {}) };
    const created = await withRetry(() => adapter.createView({ ...viewPayload(widget, null, source.dataSource, placement), view_id: dashboardId }));
    existingWidgetIds.add(created.id);
    rowCounts.set(row, count + 1);
    widgets.push({ id: widget.id, name: widget.name, type: widget.type, status: "created", viewId: created.id, url: created.url ?? notionLink(created.id) });
    await sleep(400);
  }
  return { id: definition.id, name: definition.name, status: execute ? "ready" : "existing", viewId: dashboardId, url: dashboard.url ?? notionLink(dashboardId), widgets };
}

function guideMarkdown({ databaseViews, dashboards }) {
  const lines = [
    "# Hero — Views & Dashboards Guide",
    "",
    "> HERO-NOTION-VIEW-GUIDE: این صفحه فهرست Viewهای مدیریتی است که از روی plan نسخه‌دار ساخته شده‌اند.",
    "",
    "## داشبوردها",
    ...dashboards.map(item => `- [${item.name}](${item.url ?? notionLink(item.viewId)}) — داشبورد ${item.id}`),
    "",
    "## Viewهای اصلی Databaseها",
    ...databaseViews.map(item => `- [${item.name}](${item.url ?? notionLink(item.viewId)}) — ${item.type} / ${item.id}`),
    "",
    "## قواعد استفاده",
    "- Git و وضعیت canonical Hero منبع حقیقت هستند؛ این Viewها projection عملیاتی‌اند.",
    "- هر View با پیشوند `Hero —` managed است و در اجرای بعدی با plan نسخه‌دار هم‌راستا می‌شود.",
    "- Viewهای موجود با نام‌های دیگر حذف یا دست‌کاری نمی‌شوند.",
    "- Start، End و Due Date فیلدهای برنامه‌ریزی هستند؛ تا وقتی تاریخ معتبر در منبع canonical تعیین نشود، خالی می‌مانند.",
    "- نمودارهای sync برای تشخیص سریع conflict ساخته شده‌اند؛ مقدار Conflicts باید صفر باشد.",
    "- تغییر محتوای canonical از داخل Notion مستقیماً Git را تغییر نمی‌دهد و باید از Change Proposal عبور کند."
  ];
  return lines.join("\n");
}

async function ensureGuide(adapter, workspace, databaseViews, dashboards, execute) {
  const parentId = workspace.sections["control-center"];
  if (!parentId) return { status: "blocked" };
  const children = await listAllChildren(adapter, parentId);
  const title = "Hero — Views & Dashboards Guide";
  const existing = children.find(block => block.type === "child_page" && titleOf(block) === title);
  const markdown = guideMarkdown({ databaseViews, dashboards });
  if (!existing && !execute) return { status: "planned", title };
  if (!existing && execute) {
    const created = await withRetry(() => adapter.createMarkdownPage({ parentPageId: parentId, markdown }));
    return { status: "created", pageId: created.id, url: created.url ?? notionLink(created.id) };
  }
  if (existing && execute) {
    const current = await withRetry(() => adapter.getMarkdownPage(existing.id));
    if (String(current?.markdown ?? "").includes("HERO-NOTION-VIEW-GUIDE")) await withRetry(() => adapter.updateMarkdownPage(existing.id, { type: "replace_content", replace_content: { new_str: markdown } }));
  }
  return { status: execute ? "updated" : "existing", pageId: existing.id, url: notionLink(existing.id) };
}

async function main() {
  loadRuntimeEnv();
  const execute = process.argv.includes("--execute");
  const authorization = JSON.parse(fs.readFileSync(AUTHORIZATION_FILE, "utf8"));
  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
  if (execute && process.env[APPROVAL_ENV] !== "true") fail(`${APPROVAL_ENV}=true is required for view and dashboard writes.`);
  if (execute && (authorization.status !== "active" || authorization.globalStop === true || authorization.steps?.[0]?.stepId !== STEP_ID)) fail("Notion view authorization is inactive or invalid.");
  const adapter = createNotionApiAdapter();
  if (!adapter.configured) fail("Notion connector is not configured.");
  const workspace = await discoverWorkspace(adapter, process.env.HERO_NOTION_PARENT_PAGE_ID, execute);
  const databaseViews = [];
  for (const spec of plan.database_views) {
    const database = workspace.databases[spec.database];
    if (!database) {
      if (execute) fail(`Database ${spec.database} is unavailable for view ${spec.name}.`);
      databaseViews.push({ id: spec.id, name: spec.name, type: spec.type, status: "blocked" });
      continue;
    }
    databaseViews.push(await ensureDatabaseView({ adapter, database, spec, execute }));
  }
  const dashboards = [];
  for (const definition of plan.dashboards) dashboards.push(await ensureDashboard({ adapter, workspace, definition, execute }));
  const guide = await ensureGuide(adapter, workspace, databaseViews, dashboards, execute);
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", stepId: STEP_ID, planVersion: plan.schema_version, databaseViews, dashboards, guide }, null, 2));
}

try { await main(); } catch (error) { console.error(`Notion view setup failed: ${error.message}`); process.exitCode = 1; }
