import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";
import { createNotionProductProjection, projectionMarkdown, projectionSummary } from "../packages/domain/src/notion-product-projection.mjs";
import { createNotionWorkspaceBlueprint } from "../packages/contracts/src/index.mjs";
import { checksum, hasDocumentMarker, renderNotionDocumentContent } from "../packages/domain/src/notion-sync.mjs";

const POLICY_FILE = "config/product-development/notion-allowlist.json";
const AUTHORIZATION_FILE = "config/authorizations/notion-20260911-007.json";
const STEP_ID = "NOTION-PRODUCT-SYSTEM-AUTO-SYNC";
const APPROVAL_ENV = "HERO_NOTION_PRODUCT_SYSTEM_WRITE_APPROVED";
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

const STATUS_OPTIONS = ["proposed", "active", "blocked", "done", "superseded"];
const PRODUCT_STATUS_OPTIONS = ["proposed", "active", "paused", "retired", "archived"];
const SYNC_OPTIONS = ["planned", "in-sync", "source-ahead", "notion-ahead", "conflict", "blocked", "superseded"];
const TYPE_OPTIONS = ["objective", "initiative", "roadmap", "roadmap-delivery", "roadmap-task", "feature", "bug", "maintenance"];

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
  const results = [];
  let cursor;
  do {
    const response = await withRetry(() => adapter.listBlockChildren(blockId, { pageSize: 100, startCursor: cursor }));
    results.push(...(response.results ?? []));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return results;
}

function titleOfBlock(block) {
  return block?.type === "child_page" ? block.child_page?.title ?? "" : block?.type === "child_database" ? block.child_database?.title ?? "" : "";
}

function notionLink(id) {
  return `https://app.notion.com/p/${String(id).replaceAll("-", "")}`;
}

function controlCenterMarkdown(databases) {
  const link = (id, label) => databases[id] ? `- [${label}](${notionLink(databases[id].databaseId)})` : `- ${label} (در حال آماده‌سازی)`;
  return [
    "# Hero Product System — Control Center",
    "",
    "> این صفحهٔ Notion یک projection اجرایی از Git و Hero است. Git منبع حقیقت باقی می‌ماند.",
    "",
    "## برنامهٔ محصول",
    link("products", "Products — کاتالوگ محصولات"),
    link("objectives", "Objectives — هدف‌های اصلی"),
    link("initiatives", "Initiatives — ابتکارها"),
    link("roadmap-items", "Roadmap Items — رودمپ ۵۰تایی"),
    "",
    "## اجرا",
    link("work-items", "Work Items — خروجی‌های قابل‌تحویل"),
    link("tasks", "Tasks — کارهای اجرایی"),
    link("iterations", "Iterations — چرخه‌ها و backlog"),
    "",
    "## اسناد و کنترل",
    link("documents", "Documents — اسناد canonical"),
    link("decisions", "Decisions — تصمیم‌های محافظت‌شده"),
    link("evidence", "Evidence — شواهد خواندنی"),
    link("risks", "Risks — ریسک‌ها"),
    link("releases", "Releases — وضعیت انتشار"),
    link("change-proposals", "Change Proposals — پیشنهادهای تغییر"),
    link("sync-health", "Sync Health — سلامت اتصال"),
    "",
    "## روش استفاده",
    "1. ابتدا Roadmap Items را برای ترتیب و وضعیت کلی بررسی کن.",
    "2. سپس Work Items را برای خروجی‌های قابل‌تحویل دنبال کن.",
    "3. Tasks را در Board بر اساس Status مدیریت کن.",
    "4. داشبوردهای مدیریتی و Viewهای Board/Calendar/Timeline/Chart در صفحات Hero — Views & Dashboards Guide و بخش‌های مرتبط ساخته شده‌اند.",
    "5. هر تغییر canonical باید در Git ثبت شود؛ تغییر Notion مستقیم به Git منتقل نمی‌شود.",
    "6. در صورت اختلاف checksum، auto-sync از overwrite خودکار خودداری می‌کند و conflict ثبت می‌شود.",
    "",
    "## وضعیت داده",
    "Projection اسناد، رودمپ و Task Graph به‌صورت دوره‌ای از Git refresh می‌شود. اسناد restricted، دارای PII، Secret یا Production-sensitive به Notion ارسال نمی‌شوند.",
    ""
  ].join("\n");
}

function selectOptions(names) {
  return { select: { options: names.map((name, index) => ({ name, color: ["yellow", "green", "red", "blue", "gray", "purple", "orange"][index % 7] })) } };
}

function relationSchema(dataSource) {
  return { relation: { data_source_id: dataSource.dataSourceId, single_property: {} } };
}

function schemaFor(databaseId, relationSources = {}) {
  if (databaseId === "documents") return {
    Title: { title: {} },
    ID: { rich_text: {} },
    "Document ID": { rich_text: {} },
    "Product ID": { rich_text: {} },
    Type: selectOptions(["architecture", "decision", "governance", "operation", "specification", "evidence", "roadmap", "template", "index"]),
    Scope: selectOptions(["hero", "product", "cross-project"]),
    Status: selectOptions(["active", "proposed", "superseded", "archived"]),
    Version: { rich_text: {} },
    Owner: { rich_text: {} },
    Classification: selectOptions(["internal", "restricted", "public"]),
    "Canonical Repository": { rich_text: {} },
    "Canonical Relative Path": { rich_text: {} },
    "Canonical Commit": { rich_text: {} },
    "Canonical URL": { url: {} },
    "Content Checksum": { rich_text: {} },
    "Last Canonical Update": { date: {} },
    "Review Cadence": selectOptions(["per-change", "per-release", "monthly", "quarterly", "annual", "event-driven", "none"]),
    "Next Review": { date: {} },
    "Edit Policy": selectOptions(["mirror-only", "protected-proposal", "proposal-editable", "notion-working-note"]),
    "Sync State": selectOptions(SYNC_OPTIONS),
    "Last Successful Sync": { date: {} }
  };
  const base = {
    Name: { title: {} },
    ID: { rich_text: {} },
    Status: selectOptions(STATUS_OPTIONS)
  };
  if (databaseId === "products") return {
    ...base,
    Status: selectOptions(PRODUCT_STATUS_OPTIONS),
    "Lifecycle Stage": { rich_text: {} },
    Owner: { rich_text: {} },
    "Hero Control Plane": { rich_text: {} },
    "Test Environment": { rich_text: {} },
    "Production Environment": { rich_text: {} },
    "Release Policy": { rich_text: {} },
    "Document Count": { number: {} },
    "Completeness Score": { number: {} },
    "Completeness Status": selectOptions(["ready", "blocked", "incomplete"]),
    "Source Commit": { rich_text: {} },
    "Canonical Checksum": { rich_text: {} },
    "Sync State": selectOptions(SYNC_OPTIONS)
  };
  if (databaseId === "objectives") return {
    ...base,
    "Product ID": { rich_text: {} },
    "Node Type": selectOptions(["objective", "initiative"]),
    Owner: { rich_text: {} },
    Evidence: { rich_text: {} },
    "Source Version": { rich_text: {} },
    "Canonical Checksum": { rich_text: {} },
    "Sync State": selectOptions(SYNC_OPTIONS)
  };
  if (databaseId === "initiatives") return {
    ...base,
    "Product ID": { rich_text: {} },
    "Node Type": selectOptions(["objective", "initiative"]),
    Owner: { rich_text: {} },
    Evidence: { rich_text: {} },
    "Source Version": { rich_text: {} },
    "Canonical Checksum": { rich_text: {} },
    "Sync State": selectOptions(SYNC_OPTIONS),
    ...(relationSources.objectives ? { Objective: relationSchema(relationSources.objectives) } : {})
  };
  if (databaseId === "roadmap-items") return {
    ...base,
    Order: { number: {} },
    Reference: { number: {} },
    Start: { date: {} },
    End: { date: {} },
    "Product ID": { rich_text: {} },
    Owner: { rich_text: {} },
    "Current Status": { rich_text: {} },
    "Next Action": { rich_text: {} },
    "Source Version": { rich_text: {} },
    "Canonical Checksum": { rich_text: {} },
    "Sync State": selectOptions(SYNC_OPTIONS)
  };
  if (databaseId === "work-items") return {
    ...base,
    Type: selectOptions(["roadmap-delivery", "feature", "bug", "maintenance"]),
    Priority: { number: {} },
    "Product ID": { rich_text: {} },
    "Roadmap ID": { rich_text: {} },
    Owner: { rich_text: {} },
    Start: { date: {} },
    End: { date: {} },
    "Next Action": { rich_text: {} },
    "Source Version": { rich_text: {} },
    "Canonical Checksum": { rich_text: {} },
    "Sync State": selectOptions(SYNC_OPTIONS),
    ...(relationSources["roadmap-items"] ? { "Roadmap Item": relationSchema(relationSources["roadmap-items"]) } : {})
  };
  if (databaseId === "tasks") return {
    ...base,
    Type: selectOptions(["roadmap-task", "analysis", "architecture", "implementation", "testing", "review"]),
    Priority: { number: {} },
    "Project ID": { rich_text: {} },
    "Work Item ID": { rich_text: {} },
    "Roadmap ID": { rich_text: {} },
    "Iteration ID": { rich_text: {} },
    Owner: { rich_text: {} },
    Start: { date: {} },
    End: { date: {} },
    "Due Date": { date: {} },
    "Next Action": { rich_text: {} },
    "Source Version": { rich_text: {} },
    "Canonical Checksum": { rich_text: {} },
    "Sync State": selectOptions(SYNC_OPTIONS),
    ...(relationSources["work-items"] ? { "Work Item": relationSchema(relationSources["work-items"]) } : {}),
    ...(relationSources["roadmap-items"] ? { "Roadmap Item": relationSchema(relationSources["roadmap-items"]) } : {}),
    ...(relationSources.iterations ? { Iteration: relationSchema(relationSources.iterations) } : {})
  };
  if (databaseId === "iterations") return {
    ...base,
    Goal: { rich_text: {} },
    Start: { date: {} },
    End: { date: {} },
    "Task Count": { number: {} },
    "Source Version": { rich_text: {} },
    "Canonical Checksum": { rich_text: {} },
    "Sync State": selectOptions(SYNC_OPTIONS)
  };
  if (databaseId === "sync-health") return {
    ...base,
    "Last Run": { date: {} },
    Total: { number: {} },
    "In Sync": { number: {} },
    Conflicts: { number: {} },
    Blocked: { number: {} },
    Created: { number: {} },
    Updated: { number: {} },
    "Catalog Digest": { rich_text: {} },
    "Projection Digest": { rich_text: {} },
    "Source of Truth": { rich_text: {} },
    "Sync State": selectOptions(SYNC_OPTIONS)
  };
  return base;
}

function propertyText(value) {
  return { rich_text: [{ type: "text", text: { content: String(value ?? "").slice(0, 1_900) } }] };
}

function propertyTitle(value) {
  return { title: [{ type: "text", text: { content: String(value ?? "").slice(0, 1_900) } }] };
}

function propertySelect(value) {
  return { select: value ? { name: String(value) } : null };
}

function recordProperties(record, schema, relationPageIds = new Map()) {
  const values = {
    Name: record.title,
    Title: record.title,
    ID: record.id,
    "Document ID": record.documentId ?? record.id,
    Status: record.status,
    "Product ID": record.productId,
    "Project ID": record.projectId,
    "Node Type": record.nodeType,
    Type: record.type,
    Priority: record.priority,
    Order: record.order,
    Reference: record.reference,
    "Roadmap ID": record.roadmapId,
    "Work Item ID": record.workItemId,
    "Iteration ID": record.iterationId,
    Objective: record.objectiveId,
    "Roadmap Item": record.roadmapId,
    "Work Item": record.workItemId,
    Iteration: record.iterationId,
    Owner: record.owner,
    "Next Action": record.nextAction,
    "Current Status": record.statusText,
    Goal: record.goal,
    Start: record.start,
    End: record.end,
    "Due Date": record.dueDate,
    "Task Count": record.taskCount,
    "Lifecycle Stage": record.lifecycleStage,
    "Hero Control Plane": record.heroControlPlane,
    "Test Environment": record.testEnvironment,
    "Production Environment": record.productionEnvironment,
    "Release Policy": record.releasePolicy,
    "Document Count": record.documentCount,
    "Completeness Score": record.completenessScore,
    "Completeness Status": record.completenessStatus,
    "Source Commit": record.sourceCommit,
    "Last Run": record.lastRun,
    Total: record.total,
    "In Sync": record.inSync,
    Conflicts: record.conflicts,
    Blocked: record.blocked,
    Created: record.created,
    Updated: record.updated,
    "Catalog Digest": record.catalogDigest,
    "Projection Digest": record.projectionDigest,
    "Source of Truth": record.sourceOfTruth,
    Evidence: Array.isArray(record.evidence) ? record.evidence.join(", ") : record.evidence,
    "Source Version": record.sourceVersion,
    Version: record.version ?? record.sourceVersion,
    Classification: record.classification,
    "Canonical Repository": record.canonicalRepository,
    "Canonical Relative Path": record.path,
    "Canonical Commit": record.canonicalCommit,
    "Content Checksum": record.contentChecksum ?? record.checksum,
    "Edit Policy": record.editPolicy,
    "Last Successful Sync": record.lastSuccessfulSync,
    "Canonical Checksum": record.checksum,
    "Sync State": record.syncState ?? "in-sync"
  };
  const output = {};
  const titleProperty = Object.entries(schema ?? {}).find(([, definition]) => definition?.type === "title" || definition?.title)?.[0];
  if (titleProperty && values.Name !== undefined) output[titleProperty] = propertyTitle(values.Name);
  for (const [name, definition] of Object.entries(schema ?? {})) {
    if (!(name in values) || values[name] === undefined || values[name] === null || values[name] === "") continue;
    if (definition.type === "title" || definition.title) output[name] = propertyTitle(values[name]);
    else if (definition.type === "select" || definition.select) output[name] = propertySelect(values[name]);
    else if (definition.type === "relation" || definition.relation) {
      const pageId = relationPageIds.get(values[name]);
      if (pageId) output[name] = { relation: [{ id: pageId }] };
    }
    else if (definition.type === "number" || definition.number) output[name] = { number: Number(values[name]) };
    else if (definition.type === "date" || definition.date) output[name] = { date: { start: String(values[name]) } };
    else output[name] = propertyText(values[name]);
  }
  return output;
}

function readProperty(page, name) {
  const property = page?.properties?.[name];
  if (!property) return "";
  if (property.type === "title") return (property.title ?? []).map(item => item.plain_text ?? item.text?.content ?? "").join("");
  if (property.type === "rich_text") return (property.rich_text ?? []).map(item => item.plain_text ?? item.text?.content ?? "").join("");
  if (property.type === "select") return property.select?.name ?? "";
  if (property.type === "number") return property.number ?? null;
  if (property.type === "date") return property.date?.start ?? "";
  return "";
}

async function discoverWorkspace(adapter, parentPageId, execute) {
  const blueprint = createNotionWorkspaceBlueprint();
  const rootChildren = await listAllChildren(adapter, parentPageId);
  const sections = {};
  const createdSections = [];
  for (const section of blueprint.sections) {
    let page = rootChildren.find(block => block.type === "child_page" && titleOfBlock(block) === section.title);
    if (!page) {
      if (!execute) continue;
      page = await withRetry(() => adapter.createMarkdownPage({ parentPageId, markdown: `# ${section.title}\n\n${section.purpose}.\n\nمنبع حقیقت: Git و Hero.` }));
      createdSections.push(section.id);
      await sleep(400);
    }
    sections[section.id] = page.id;
  }
  const databases = {};
  const createdDatabases = [];
  const createdPages = [];
  for (const definition of blueprint.databases) {
    const sectionId = DATABASE_SECTIONS[definition.id];
    const sectionPageId = sections[sectionId];
    if (!sectionPageId) continue;
    const children = await listAllChildren(adapter, sectionPageId);
    let database = children.find(block => block.type === "child_database" && titleOfBlock(block) === definition.title);
    if (!database) {
      if (!execute) continue;
      database = await withRetry(() => adapter.createDatabase({
        parent: { type: "page_id", page_id: sectionPageId },
        title: [{ type: "text", text: { content: definition.title } }],
        description: [{ type: "text", text: { content: `Projection of ${definition.source}; Git and Hero remain canonical.` } }],
        is_inline: true,
        initial_data_source: { properties: schemaFor(definition.id) }
      }));
      createdDatabases.push(definition.id);
      await sleep(500);
    }
    const databaseId = database.id;
    const databaseObject = database.object === "database" ? database : await withRetry(() => adapter.getDatabase(databaseId));
    const dataSourceId = databaseObject.data_sources?.[0]?.id;
    if (!dataSourceId) fail(`Database ${definition.title} has no data source.`);
    const dataSource = await withRetry(() => adapter.getDataSource(dataSourceId));
    const expected = schemaFor(definition.id);
    const missing = Object.fromEntries(Object.entries(expected).filter(([name]) => !dataSource.properties?.[name]));
    if (Object.keys(missing).length > 0) {
      if (!execute) continue;
      await withRetry(() => adapter.updateDataSource(dataSourceId, { properties: missing }));
      await sleep(500);
    }
    databases[definition.id] = { databaseId, dataSourceId, schema: { ...dataSource.properties, ...expected } };
  }
  for (const definition of blueprint.databases) {
    const database = databases[definition.id];
    if (!database) continue;
    const expected = schemaFor(definition.id, databases);
    const missing = Object.fromEntries(Object.entries(expected).filter(([name]) => !database.schema?.[name]));
    if (Object.keys(missing).length > 0) {
      if (!execute) continue;
      await withRetry(() => adapter.updateDataSource(database.dataSourceId, { properties: missing }));
      await sleep(500);
    }
    const refreshed = await withRetry(() => adapter.getDataSource(database.dataSourceId));
    database.schema = { ...refreshed.properties, ...expected };
  }
  const controlCenterId = sections["control-center"];
  if (controlCenterId) {
    const children = await listAllChildren(adapter, controlCenterId);
    const existing = children.find(block => block.type === "child_page" && titleOfBlock(block) === "Hero Product System — Control Center");
    if (!existing && execute) {
      await withRetry(() => adapter.createMarkdownPage({ parentPageId: controlCenterId, markdown: controlCenterMarkdown(databases) }));
      createdPages.push("hero-product-system-control-center");
    } else if (existing && execute) {
      const current = await withRetry(() => adapter.getMarkdownPage(existing.id));
      if (String(current?.markdown ?? "").includes("این صفحهٔ Notion یک projection اجرایی")) {
        await withRetry(() => adapter.updateMarkdownPage(existing.id, { type: "replace_content", replace_content: { new_str: controlCenterMarkdown(databases) } }));
      }
    }
  }
  return { blueprint, sections, databases, createdSections, createdDatabases, createdPages };
}

async function queryAllPages(adapter, dataSourceId) {
  const pages = [];
  let cursor;
  do {
    const response = await withRetry(() => adapter.queryDataSource(dataSourceId, { page_size: 100, result_type: "page", ...(cursor ? { start_cursor: cursor } : {}) }));
    pages.push(...(response.results ?? response.page_or_data_source?.results ?? []));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return pages;
}

async function upsertProjectionRecords({ adapter, database, kind, records, execute, relationPageIds }) {
  if (!database) return { kind, created: 0, updated: 0, skipped: records.length };
  const existing = await queryAllPages(adapter, database.dataSourceId);
  const byId = new Map(existing.map(page => [readProperty(page, "ID"), page]).filter(([id]) => id));
  for (const page of existing) {
    const id = readProperty(page, "ID");
    if (id) relationPageIds.set(id, page.id);
  }
  let created = 0;
  let updated = 0;
  for (const record of records) {
    const properties = recordProperties(record, database.schema, relationPageIds);
    const markdown = projectionMarkdown(kind, record);
    const page = byId.get(record.id);
    if (!page) {
      if (!execute) continue;
      const createdPage = await withRetry(() => adapter.createMarkdownDataSourcePage({ dataSourceId: database.dataSourceId, properties, markdown }));
      relationPageIds.set(record.id, createdPage.id);
      created += 1;
    } else if (execute) {
      await withRetry(() => adapter.updatePage(page.id, { properties }));
      const current = await withRetry(() => adapter.getMarkdownPage(page.id));
      if (!String(current?.markdown ?? "").includes(`Hero Projection: \`${record.id}\``) || !String(current?.markdown ?? "").includes(record.checksum)) {
        await withRetry(() => adapter.updateMarkdownPage(page.id, { type: "replace_content", replace_content: { new_str: markdown } }));
      }
      updated += 1;
    }
    await sleep(350);
  }
  return { kind, created, updated, skipped: 0, existing: existing.length };
}

function documentProperties(document, schema, sourceChecksum) {
  return recordProperties({
    id: document.id,
    documentId: document.id,
    title: document.title,
    status: document.status,
    productId: document.productId ?? "HERO-PRODUCT-HERO-001",
    type: document.type,
    owner: document.owner,
    classification: document.classification,
    version: document.version,
    path: document.path,
    canonicalCommit: document.sourceCommit ?? "unknown",
    contentChecksum: sourceChecksum,
    editPolicy: document.editClass,
    sourceVersion: document.version,
    checksum: sourceChecksum,
    nextAction: document.path
  }, schema);
}

async function syncDocuments({ adapter, runtime, database, catalog, snapshot, execute }) {
  if (!database) return { total: 0, synced: 0, created: 0, conflicts: 0, blocked: snapshot.documents.length };
  const mappings = await runtime.notionSyncMappings.list({ limit: 1000 });
  const mappingByDocument = new Map(mappings.map(mapping => [mapping.documentId, mapping]));
  const pages = await queryAllPages(adapter, database.dataSourceId);
  const pageByDocument = new Map(pages.map(page => [readProperty(page, "Document ID") || readProperty(page, "ID"), page]).filter(([id]) => id));
  const result = { total: 0, synced: 0, created: 0, conflicts: 0, blocked: 0, blockedDocumentIds: [] };
  for (const entry of snapshot.documents) {
    if (entry.notionEligible === false || entry.classification !== "internal") {
      result.blocked += 1;
      result.blockedDocumentIds.push(entry.id);
      continue;
    }
    result.total += 1;
    const document = catalog.document(entry.id);
    const sourceContent = renderNotionDocumentContent(document, document.content);
    const sourceChecksum = checksum(sourceContent, document.title);
    const mapped = mappingByDocument.get(document.id);
    // Older sync runs created direct child pages under the root. Prefer the
    // canonical Documents database and migrate the mapping when the legacy
    // page is not a member of this data source.
    let pageId = pageByDocument.get(document.id)?.id ?? null;
    if (!pageId) {
      if (!execute) continue;
      const createdPage = await withRetry(() => adapter.createMarkdownDataSourcePage({ dataSourceId: database.dataSourceId, properties: documentProperties(document, database.schema, sourceChecksum), markdown: sourceContent }));
      pageId = createdPage.id;
      const persisted = await withRetry(() => adapter.getMarkdownPage(pageId));
      const notionChecksum = checksum(persisted?.markdown, document.title);
      const now = new Date().toISOString();
      await runtime.notionSyncMappings.put({ documentId: document.id, pageId, canonicalCommit: document.sourceCommit ?? "unknown", sourceChecksum, notionChecksum, status: sourceChecksum === notionChecksum ? "in-sync" : "blocked", editPolicy: document.editClass, lastSuccessfulSync: sourceChecksum === notionChecksum ? now : null, updatedAt: now });
      if (sourceChecksum === notionChecksum) result.created += 1; else result.conflicts += 1;
      await sleep(350);
      continue;
    }
    const current = await withRetry(() => adapter.getMarkdownPage(pageId));
    const notionChecksum = checksum(current?.markdown, document.title);
    if (notionChecksum === sourceChecksum) {
      if (execute) {
        if (readProperty(pageByDocument.get(document.id), "Content Checksum") !== sourceChecksum || readProperty(pageByDocument.get(document.id), "Sync State") !== "in-sync") {
          await withRetry(() => adapter.updatePage(pageId, { properties: documentProperties(document, database.schema, sourceChecksum) }));
        }
        await runtime.notionSyncMappings.put({ ...mapped, documentId: document.id, pageId, sourceChecksum, notionChecksum, canonicalCommit: document.sourceCommit ?? "unknown", status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
      continue;
    }
    const notionChanged = mapped?.notionChecksum && notionChecksum !== mapped.notionChecksum;
    if (notionChanged) {
      if (execute && mapped) await runtime.notionSyncMappings.put({ ...mapped, status: "conflict", updatedAt: new Date().toISOString() });
      result.conflicts += 1;
      continue;
    }
    if (!execute) continue;
    await withRetry(() => adapter.updateMarkdownPage(pageId, { type: "replace_content", replace_content: { new_str: sourceContent } }));
    const persisted = await withRetry(() => adapter.getMarkdownPage(pageId));
    const verifiedChecksum = checksum(persisted?.markdown, document.title);
    if (!hasDocumentMarker(persisted?.markdown, document.id) || verifiedChecksum !== sourceChecksum) fail(`Document verification failed for ${document.id}`);
    await withRetry(() => adapter.updatePage(pageId, { properties: documentProperties(document, database.schema, sourceChecksum) }));
    const now = new Date().toISOString();
    await runtime.notionSyncMappings.put({ ...mapped, documentId: document.id, pageId, sourceChecksum, notionChecksum: verifiedChecksum, canonicalCommit: document.sourceCommit ?? "unknown", status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: now, updatedAt: now });
    result.synced += 1;
    await sleep(350);
  }
  return result;
}

async function once({ execute }) {
  loadRuntimeEnv();
  const policy = JSON.parse(fs.readFileSync(POLICY_FILE, "utf8"));
  const authorization = JSON.parse(fs.readFileSync(AUTHORIZATION_FILE, "utf8"));
  if (execute && process.env[APPROVAL_ENV] !== "true") fail(`${APPROVAL_ENV}=true is required for Notion product-system writes.`);
  if (execute && (authorization.status !== "active" || authorization.globalStop === true || authorization.steps?.[0]?.stepId !== STEP_ID)) fail("Notion product-system authorization is inactive or invalid.");
  if (execute && policy.automatic_sync?.status !== "approved" || execute && policy.automatic_sync?.authorization_id !== authorization.authorizationId) fail("Automatic sync policy does not match authorization.");
  const adapter = createNotionApiAdapter();
  if (!adapter.configured) fail("Notion connector is not configured.");
  const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
  const snapshot = catalog.snapshot();
  if (execute && (policy.classification_review?.status !== "approved" || policy.classification_review?.catalog_digest !== snapshot.digest || policy.classification_review?.candidate_count !== snapshot.documents.length || policy.classification_review?.default_classification !== "internal")) fail("Classification review does not match the current catalog.");
  const workspace = await discoverWorkspace(adapter, process.env.HERO_NOTION_PARENT_PAGE_ID, execute);
  const runtime = await createPostgresRuntime();
  try {
    const projection = createNotionProductProjection({ roadmapGraph: snapshot.roadmapGraph, products: snapshot.products });
    const result = {
      mode: execute ? "execute" : "dry-run",
      stepId: STEP_ID,
      catalogDigest: snapshot.digest,
      workspace: { createdSections: workspace.createdSections, createdDatabases: workspace.createdDatabases, createdPages: workspace.createdPages },
      projection: projectionSummary(projection),
      records: [],
      documents: null
    };
    const relationPageIds = new Map();
    const records = [
      ["products", "product", projection.products],
      ["objectives", "objective", projection.objectives],
      ["initiatives", "initiative", projection.initiatives],
      ["roadmap-items", "roadmap-item", projection.roadmapItems],
      ["iterations", "iteration", projection.iterations],
      ["work-items", "work-item", projection.workItems],
      ["tasks", "task", projection.tasks]
    ];
    for (const [databaseId, kind, rows] of records) {
      result.records.push(await upsertProjectionRecords({ adapter, database: workspace.databases[databaseId], kind, records: rows, execute, relationPageIds }));
    }
    result.documents = await syncDocuments({ adapter, runtime, database: workspace.databases.documents, catalog, snapshot, execute });
    const syncHealth = {
      id: "HERO-NOTION-SYNC-HEALTH",
      title: "Notion Product System — آخرین وضعیت همگام‌سازی",
      status: result.documents.conflicts > 0 ? "blocked" : "active",
      syncState: result.documents.conflicts > 0 ? "conflict" : "in-sync",
      lastRun: new Date().toISOString(),
      total: result.documents.total,
      inSync: result.documents.total - result.documents.conflicts,
      conflicts: result.documents.conflicts,
      blocked: result.documents.blocked,
      created: result.documents.created,
      updated: result.documents.synced,
      catalogDigest: snapshot.digest,
      projectionDigest: snapshot.digest,
      sourceOfTruth: "Git + Hero; Notion projection"
    };
    result.records.push(await upsertProjectionRecords({ adapter, database: workspace.databases["sync-health"], kind: "sync-health", records: [syncHealth], execute, relationPageIds }));
    console.log(JSON.stringify(result, null, 2));
    if (execute && result.documents.conflicts > 0) process.exitCode = 2;
  } finally {
    await runtime.close();
  }
}

async function main() {
  const execute = process.argv.includes("--execute") || process.argv.includes("--watch");
  if (!process.argv.includes("--watch")) return once({ execute });
  const interval = Math.max(60, Number(process.env.HERO_NOTION_AUTO_SYNC_INTERVAL_SECONDS ?? 300)) * 1_000;
  while (true) {
    try { await once({ execute: true }); } catch (error) { console.error(`Notion auto-sync cycle failed: ${error.message}`); }
    await sleep(interval);
  }
}

try { await main(); } catch (error) { console.error(`Notion product-system sync failed: ${error.message}`); process.exitCode = 1; }
