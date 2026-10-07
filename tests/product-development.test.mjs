import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createNotionWorkspaceBlueprint, validateRoadmapGraph } from "../packages/contracts/src/index.mjs";
import { createProductDevelopmentCatalog, ProductDevelopmentError } from "../packages/domain/src/product-development.mjs";
import { createNotionSyncService } from "../packages/domain/src/notion-sync.mjs";
import { createNotionSyncRegistry } from "../packages/domain/src/notion-sync-registry.mjs";
import { createNotionProductProjection } from "../packages/domain/src/notion-product-projection.mjs";
import { createRoadmapGraph, evaluateProductCompleteness } from "../packages/domain/src/roadmap-completeness.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Product Catalog indexes Hero and current product registry deterministically", () => {
  const catalog = createProductDevelopmentCatalog({ root, sourceCommit: "test-snapshot", now: () => "2026-09-10T12:00:00.000Z" });
  const first = catalog.snapshot();
  const second = catalog.snapshot();
  assert.equal(first.schemaVersion, "1.0");
  assert.equal(first.summary.productCount, 2);
  assert.ok(first.summary.documentCount >= 96);
  assert.equal(first.summary.errorCount, 0);
  assert.equal(first.digest, second.digest);
  assert.equal(first.products.find(product => product.product_id === "HERO-PRODUCT-HERO-001").completeness.score, 100);
  assert.equal(first.documents.every(document => document.sourceCommit === "test-snapshot"), true);
  assert.equal(first.roadmapGraph.summary.nodeCount, 8);
  assert.equal(first.roadmapGraph.summary.dependencyCycleCount, 0);
});

test("Roadmap graph validates dependencies and Completeness blocks missing required evidence", () => {
  const graph = createRoadmapGraph({
    schema_version: "1.0.0",
    nodes: [
      { id: "HERO-NODE-A", type: "objective", status: "planned", title: "A" },
      { id: "HERO-NODE-B", type: "milestone", status: "blocked", title: "B" }
    ],
    edges: [{ id: "HERO-EDGE-A-B", from: "HERO-NODE-A", to: "HERO-NODE-B", type: "contains" }]
  });
  assert.equal(graph.summary.blockedCount, 1);
  assert.deepEqual(validateRoadmapGraph({ schema_version: "1.0.0", nodes: [], edges: [{ id: "HERO-EDGE-MISSING", from: "HERO-A", to: "HERO-B", type: "depends-on" }] }).length, 2);
  const completeness = evaluateProductCompleteness({ product: { status: "active", relationErrors: [] }, productDocuments: [{ exists: true, status: "active", role: "brief" }], documents: [{ exists: true, status: "active", role: "brief" }], stage: "production-ready" });
  assert.equal(completeness.status, "blocked");
  assert.ok(completeness.missing.some(item => item.id === "required-role-test-environment"));
});

test("Notion workspace blueprint and mapping registry are deterministic and conflict-safe", () => {
  const blueprint = createNotionWorkspaceBlueprint();
  assert.equal(blueprint.initialAllowlist[0], "HERO-PRODUCT-HERO-BRIEF");
  assert.equal(blueprint.databases.length, 14);
  const registry = createNotionSyncRegistry({ now: () => "2026-09-10T12:00:00.000Z" });
  registry.put({ documentId: "HERO-PRODUCT-HERO-BRIEF", pageId: "b55c9c91-384d-452b-81db-d1ef79372b75", sourceChecksum: "source-a", notionChecksum: "notion-a", canonicalCommit: "commit-a", status: "in-sync", editPolicy: "proposal-editable" });
  assert.equal(registry.compare({ documentId: "HERO-PRODUCT-HERO-BRIEF", sourceChecksum: "source-a", notionChecksum: "notion-a", canonicalCommit: "commit-a" }).state, "in-sync");
  assert.equal(registry.compare({ documentId: "HERO-PRODUCT-HERO-BRIEF", sourceChecksum: "source-b", notionChecksum: "notion-b", canonicalCommit: "commit-b" }).state, "conflict");
});

test("Notion product projection preserves the canonical roadmap and creates execution records", () => {
  const catalog = createProductDevelopmentCatalog({ root, sourceCommit: "test-snapshot", now: () => "2026-09-10T12:00:00.000Z" });
  const snapshot = catalog.snapshot();
  const projection = createNotionProductProjection({ roadmap: snapshot.roadmap, roadmapGraph: snapshot.roadmapGraph, products: snapshot.products });
  assert.deepEqual({
    objectives: projection.objectives.length,
    initiatives: projection.initiatives.length,
    roadmapItems: projection.roadmapItems.length,
    workItems: projection.workItems.length,
    tasks: projection.tasks.length,
    iterations: projection.iterations.length,
    products: projection.products.length
  }, { objectives: 1, initiatives: 2, roadmapItems: 50, workItems: 50, tasks: 50, iterations: 1, products: 2 });
  assert.equal(projection.roadmapItems[0].id, "HERO-ROADMAP-001");
  assert.equal(projection.initiatives.every(initiative => initiative.objectiveId === "HERO-OBJ-TRUSTWORTHY-PRODUCT-OS"), true);
  assert.equal(projection.workItems[0].roadmapId, projection.roadmapItems[0].id);
  assert.equal(projection.tasks[0].workItemId, projection.workItems[0].id);
  assert.equal(projection.tasks[0].iterationId, projection.iterations[0].id);
  assert.equal(projection.products.find(product => product.id === "HERO-PRODUCT-HERO-001").completenessStatus, "ready");
  assert.match(projection.tasks[0].checksum, /^[a-f0-9]{64}$/);
});

test("Product Catalog search, document reads and proposal boundary are safe", () => {
  const catalog = createProductDevelopmentCatalog({ root, now: () => "2026-09-10T12:00:00.000Z" });
  assert.ok(catalog.search({ query: "Notion" }).some(document => document.id === "HERO-OPS-NOTION-SETUP"));
  const document = catalog.document("HERO-PRODUCT-HERO-BRIEF");
  assert.match(document.content, /Product Brief/);
  assert.throws(
    () => catalog.createChangeProposal({ documentId: "HERO-PRODUCT-HERO-RELEASE", proposedContent: document.content }),
    error => error instanceof ProductDevelopmentError && error.code === "DOCUMENT_MIRROR_ONLY"
  );
  const proposal = catalog.createChangeProposal({ documentId: "HERO-PRODUCT-HERO-BRIEF", proposedContent: `${document.content}\n\n## یادداشت\n` });
  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.gitWrite, "not-executed");
  assert.equal(catalog.listChangeProposals().length, 1);
});

test("Product Studio requires a project selection and returns only the selected project snapshot", async t => {
  const now = () => "2026-09-10T12:00:00.000Z";
  const workspace = createProjectWorkspace({ ownerUserId: "hero-owner", now });
  workspace.createProject({ actor: { subject: "hero-owner", role: "project-owner" }, projectId: "project-vpn", name: "VPN" });
  // Pin the adapter so a host that has Notion variables set cannot flip the expected default.
  const notionAdapter = createNotionApiAdapter({ enabled: false, token: "" });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, repositoryRoot: root, now, projectWorkspace: workspace, notionAdapter });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const selection = await fetch(`${base}/product-studio`, { redirect: "manual" });
  assert.equal(selection.status, 302);
  assert.equal(selection.headers.get("location"), "/portfolio?select=project&next=studio");
  const page = await fetch(`${base}/product-studio?projectId=project-vpn`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /استودیوی محصول/);
  const data = await (await fetch(`${base}/product-studio-data?projectId=project-vpn`)).json();
  assert.equal(data.scope.projectId, "project-vpn");
  assert.equal(data.summary.productCount, 1);
  assert.equal(data.products[0].name, "VPN");
  assert.equal(data.roadmapGraph.summary.nodeCount, 4);
  assert.equal(data.notion.configured, false);
  const unscopedData = await fetch(`${base}/product-studio-data`);
  assert.equal(unscopedData.status, 400);
  const unscopedDocument = await fetch(`${base}/product-studio-document?documentId=HERO-PRODUCT-HERO-BRIEF`);
  assert.equal(unscopedDocument.status, 400);
});

test("Portfolio deep-links to a project-scoped Product Studio workspace", async t => {
  const workspace = createProjectWorkspace({ ownerUserId: "hero-owner", now: () => "2026-09-10T12:00:00.000Z" });
  workspace.createProject({ actor: { subject: "hero-owner", role: "project-owner" }, projectId: "project-vpn", name: "VPN Pilot", description: "First product pilot" });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, repositoryRoot: root, now: () => "2026-09-10T12:00:00.000Z", projectWorkspace: workspace });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const portfolio = await fetch(`${base}/portfolio`);
  assert.equal(portfolio.status, 200);
  assert.match(await portfolio.text(), /\/api\/portal\?surface=studio&amp;projectId=project-vpn/);
  const data = await (await fetch(`${base}/product-studio-data?projectId=project-vpn`)).json();
  assert.equal(data.projectOverview.project.projectId, "project-vpn");
  assert.equal(data.projectOverview.project.name, "VPN Pilot");
  const page = await fetch(`${base}/product-studio?projectId=project-vpn`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /فضای پروژه/);
});

test("Product Development API remains owner-authenticated and proposal-only", async t => {
  const now = () => "2026-09-10T12:00:00.000Z";
  const ownerAuth = createOwnerAuth({ secret: "test-product-development-owner-secret-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "product-development-session", expiresAt: 2_000_000_000 });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, repositoryRoot: root, now, ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/api/product-development/catalog`)).status, 401);
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const catalog = await (await fetch(`${base}/api/product-development/catalog`, { headers })).json();
  assert.equal(catalog.catalog.summary.productCount, 2);
  const proposal = await fetch(`${base}/api/product-development/proposals`, { method: "POST", headers, body: JSON.stringify({
    documentId: "HERO-PRODUCT-HERO-BRIEF",
    proposedContent: "# proposed",
    idempotencyKey: "test-product-development-proposal-1"
  }) });
  assert.equal(proposal.status, 201);
  assert.equal((await proposal.json()).proposal.status, "proposed");
});

test("Notion Adapter stays disabled by default and uses current Markdown API when explicitly enabled", async () => {
  let calls = 0;
  const disabled = createNotionApiAdapter({ token: "secret-token", enabled: false, fetchImpl: async () => { calls += 1; } });
  assert.equal(disabled.configured, false);
  await assert.rejects(() => disabled.getMarkdownPage("b55c9c91-384d-452b-81db-d1ef79372b75"), error => error.code === "NOTION_NOT_CONFIGURED");
  assert.equal(calls, 0);

  const requests = [];
  const adapter = createNotionApiAdapter({
    token: "secret-token",
    enabled: true,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, headers: { get: () => null }, async json() { return { id: "b55c9c91-384d-452b-81db-d1ef79372b75", markdown: "# Hero" }; } };
    }
  });
  assert.equal(adapter.configured, true);
  await adapter.createMarkdownPage({ parentPageId: "b55c9c91-384d-452b-81db-d1ef79372b75", markdown: "# Hero" });
  await adapter.getMarkdownPage("b55c9c91-384d-452b-81db-d1ef79372b75");
  await adapter.updateMarkdownPage("b55c9c91-384d-452b-81db-d1ef79372b75", { type: "replace_content", replace_content: { new_str: "# Updated" } });
  await adapter.searchPages("Hero");
  await adapter.listViews({ databaseId: "b55c9c91-384d-452b-81db-d1ef79372b75" });
  await adapter.getView("b55c9c91-384d-452b-81db-d1ef79372b75");
  await adapter.createView({ database_id: "b55c9c91-384d-452b-81db-d1ef79372b75", data_source_id: "b55c9c91-384d-452b-81db-d1ef79372b75", name: "Hero — Test", type: "table" });
  await adapter.updateView("b55c9c91-384d-452b-81db-d1ef79372b75", { name: "Hero — Test" });
  assert.equal(requests.length, 8);
  assert.equal(requests[0].url, "https://api.notion.com/v1/pages");
  assert.equal(requests[1].url.endsWith("/markdown"), true);
  assert.equal(requests[2].options.headers["Notion-Version"], "2026-03-11");
  assert.equal(requests[0].options.headers.authorization, "Bearer secret-token");
  assert.equal(requests[3].url, "https://api.notion.com/v1/search");
  assert.equal(requests[4].url, "https://api.notion.com/v1/views?database_id=b55c9c91-384d-452b-81db-d1ef79372b75");
  assert.equal(requests[5].url, "https://api.notion.com/v1/views/b55c9c91-384d-452b-81db-d1ef79372b75");
  assert.equal(requests[6].url, "https://api.notion.com/v1/views");
  assert.equal(requests[7].url, "https://api.notion.com/v1/views/b55c9c91-384d-452b-81db-d1ef79372b75");
});

test("Notion sync requires explicit external-write authorization", async () => {
  const adapter = createNotionApiAdapter({ token: "secret-token", enabled: true, fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, async json() { return { id: "b55c9c91-384d-452b-81db-d1ef79372b75", markdown: "# Hero" }; } }) });
  const sync = createNotionSyncService({ adapter, now: () => "2026-09-10T12:00:00.000Z" });
  const document = { id: "HERO-PRODUCT-HERO-BRIEF", title: "Hero", sourceCommit: "test", editClass: "proposal-editable" };
  const plan = await sync.syncDocument({ document, content: "# Hero", parentPageId: "b55c9c91-384d-452b-81db-d1ef79372b75" });
  assert.equal(plan.mode, "dry-run");
  await assert.rejects(() => sync.syncDocument({ document, content: "# Hero", parentPageId: "b55c9c91-384d-452b-81db-d1ef79372b75", mode: "execute" }), error => error.code === "EXTERNAL_WRITE_NOT_AUTHORIZED");
});
