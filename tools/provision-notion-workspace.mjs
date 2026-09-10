import fs from "node:fs";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createNotionWorkspaceBlueprint } from "../packages/contracts/src/index.mjs";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

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
  "sync-health": "integration-health"
});

const SELECT_OPTIONS = Object.freeze([
  { name: "proposed", color: "yellow" },
  { name: "active", color: "green" },
  { name: "blocked", color: "red" },
  { name: "done", color: "blue" },
  { name: "superseded", color: "gray" }
]);

function schemaFor(databaseId) {
  const title = databaseId === "documents" ? "Title" : "Name";
  const schema = {
    [title]: { title: {} },
    ID: { rich_text: {} },
    Status: { select: { options: SELECT_OPTIONS } }
  };
  if (databaseId === "documents") {
    Object.assign(schema, {
      "Document ID": { rich_text: {} },
      "Product ID": { rich_text: {} },
      Type: { select: { options: ["architecture", "decision", "governance", "operation", "specification", "evidence", "roadmap", "template", "index"].map(name => ({ name, color: "blue" })) } },
      Scope: { select: { options: ["hero", "product", "cross-project"].map(name => ({ name, color: "purple" })) } },
      Version: { rich_text: {} },
      Owner: { rich_text: {} },
      Classification: { select: { options: [{ name: "internal", color: "blue" }, { name: "restricted", color: "red" }, { name: "public", color: "green" }] } },
      "Canonical Repository": { rich_text: {} },
      "Canonical Relative Path": { rich_text: {} },
      "Canonical Commit": { rich_text: {} },
      "Canonical URL": { url: {} },
      "Content Checksum": { rich_text: {} },
      "Last Canonical Update": { date: {} },
      "Review Cadence": { select: { options: ["per-change", "per-release", "monthly", "quarterly", "annual", "event-driven", "none"].map(name => ({ name, color: "gray" })) } },
      "Next Review": { date: {} },
      "Edit Policy": { select: { options: ["mirror-only", "protected-proposal", "proposal-editable", "notion-working-note"].map(name => ({ name, color: "orange" })) } },
      "Sync State": { select: { options: ["planned", "in-sync", "source-ahead", "notion-ahead", "conflict", "blocked", "superseded"].map(name => ({ name, color: "blue" })) } },
      "Last Successful Sync": { date: {} }
    });
  }
  return schema;
}

function titleOfBlock(block) {
  if (block?.type === "child_page") return block.child_page?.title ?? null;
  if (block?.type === "child_database") return block.child_database?.title ?? null;
  return null;
}

function assertCompleteChildren(response, label) {
  if (response?.has_more === true) throw new Error(`${label} has more than one page of children; refusing to provision ambiguously.`);
  return Array.isArray(response?.results) ? response.results : [];
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function withRetry(operation) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable = error?.code === "NOTION_RATE_LIMITED" || Number(error?.statusCode) >= 500;
      if (!retryable || attempt === 3) throw error;
      const retryAfter = Number(error?.details?.retryAfter);
      await sleep(Number.isFinite(retryAfter) && retryAfter >= 0 ? Math.min(retryAfter * 1000, 5000) : 250 * (2 ** (attempt - 1)));
    }
  }
  throw new Error("unreachable");
}

async function main() {
  loadRuntimeEnv();
  const execute = process.argv.includes("--execute");
  if (execute && process.env.HERO_NOTION_WORKSPACE_WRITE_APPROVED !== "true") {
    throw new Error("Workspace provisioning requires HERO_NOTION_WORKSPACE_WRITE_APPROVED=true.");
  }
  const blueprint = createNotionWorkspaceBlueprint();
  const adapter = createNotionApiAdapter();
  if (!adapter.configured) throw new Error("Notion connector is not configured.");
  const parentPageId = process.env.HERO_NOTION_PARENT_PAGE_ID;
  const rootChildren = assertCompleteChildren(await withRetry(() => adapter.listBlockChildren(parentPageId, { pageSize: 100 })), "root page");
  const sectionPages = {};
  const createdSections = [];
  const existingSections = [];

  for (const section of blueprint.sections) {
    const existing = rootChildren.find(block => block.type === "child_page" && titleOfBlock(block) === section.title);
    if (existing) {
      sectionPages[section.id] = existing.id;
      existingSections.push(section.id);
      continue;
    }
    if (!execute) continue;
    const page = await withRetry(() => adapter.createMarkdownPage({
      parentPageId,
      markdown: `# ${section.title}\n\n${section.purpose}.\n\nمنبع حقیقت: Git و وضعیت عملیاتی Hero. این صفحهٔ Notion یک projection قابل‌بازسازی است.`
    }));
    sectionPages[section.id] = page.id;
    createdSections.push(section.id);
    await sleep(250);
  }

  const plannedDatabases = blueprint.databases.map(database => ({ ...database, sectionId: DATABASE_SECTIONS[database.id] }));
  if (plannedDatabases.some(database => !database.sectionId)) throw new Error("Every blueprint database must have a section mapping.");
  const createdDatabases = [];
  const existingDatabases = [];
  for (const database of plannedDatabases) {
    const sectionPageId = sectionPages[database.sectionId];
    if (!sectionPageId) continue;
    const children = assertCompleteChildren(await withRetry(() => adapter.listBlockChildren(sectionPageId, { pageSize: 100 })), `section ${database.sectionId}`);
    const existing = children.find(block => block.type === "child_database" && titleOfBlock(block) === database.title);
    if (existing) {
      existingDatabases.push(database.id);
      continue;
    }
    if (!execute) continue;
    await withRetry(() => adapter.createDatabase({
      parent: { type: "page_id", page_id: sectionPageId },
      title: [{ type: "text", text: { content: database.title } }],
      description: [{ type: "text", text: { content: `Projection of ${database.source}; Git and Hero remain canonical.` } }],
      is_inline: true,
      initial_data_source: { properties: schemaFor(database.id) }
    }));
    createdDatabases.push(database.id);
    await sleep(250);
  }

  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    externalRequests: execute ? createdSections.length + createdDatabases.length : 0,
    rootTitle: blueprint.rootTitle,
    sections: { planned: blueprint.sections.length, existing: existingSections, created: createdSections },
    databases: { planned: plannedDatabases.length, existing: existingDatabases, created: createdDatabases },
    next: execute ? "verify-root-and-section-children" : "rerun-with---execute-after-owner-approval"
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(`Notion workspace provisioning failed: ${error.message}`);
  process.exitCode = 1;
}
