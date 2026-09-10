import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createNotionApiAdapter } from "../packages/adapters/src/notion-api.mjs";
import { createNotionWorkspaceBlueprint, validateRoadmapGraph } from "../packages/contracts/src/index.mjs";
import { createProductDevelopmentCatalog, ProductDevelopmentError } from "../packages/domain/src/product-development.mjs";
import { createNotionSyncService } from "../packages/domain/src/notion-sync.mjs";
import { createNotionSyncRegistry } from "../packages/domain/src/notion-sync-registry.mjs";
import { createRoadmapGraph, evaluateProductCompleteness } from "../packages/domain/src/roadmap-completeness.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

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
  assert.equal(blueprint.databases.length, 11);
  const registry = createNotionSyncRegistry({ now: () => "2026-09-10T12:00:00.000Z" });
  registry.put({ documentId: "HERO-PRODUCT-HERO-BRIEF", pageId: "b55c9c91-384d-452b-81db-d1ef79372b75", sourceChecksum: "source-a", notionChecksum: "notion-a", canonicalCommit: "commit-a", status: "in-sync", editPolicy: "proposal-editable" });
  assert.equal(registry.compare({ documentId: "HERO-PRODUCT-HERO-BRIEF", sourceChecksum: "source-a", notionChecksum: "notion-a", canonicalCommit: "commit-a" }).state, "in-sync");
  assert.equal(registry.compare({ documentId: "HERO-PRODUCT-HERO-BRIEF", sourceChecksum: "source-b", notionChecksum: "notion-b", canonicalCommit: "commit-b" }).state, "conflict");
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

test("Product Studio exposes catalog and document content without requiring Notion", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0, repositoryRoot: root, now: () => "2026-09-10T12:00:00.000Z" });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const page = await fetch(`${base}/product-studio`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /مرکز توسعهٔ محصول و دانش Hero/);
  const data = await (await fetch(`${base}/product-studio-data`)).json();
  assert.equal(data.summary.productCount, 2);
  assert.equal(data.roadmapGraph.summary.nodeCount, 8);
  assert.equal(data.notion.configured, false);
  const document = await (await fetch(`${base}/product-studio-document?documentId=HERO-PRODUCT-HERO-BRIEF`)).json();
  assert.match(document.document.content, /مأموریت/);
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
  assert.equal(requests.length, 4);
  assert.equal(requests[0].url, "https://api.notion.com/v1/pages");
  assert.equal(requests[1].url.endsWith("/markdown"), true);
  assert.equal(requests[2].options.headers["Notion-Version"], "2026-03-11");
  assert.equal(requests[0].options.headers.authorization, "Bearer secret-token");
  assert.equal(requests[3].url, "https://api.notion.com/v1/search");
});

test("Notion sync requires explicit external-write authorization", async () => {
  const adapter = createNotionApiAdapter({ token: "secret-token", enabled: true, fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, async json() { return { id: "b55c9c91-384d-452b-81db-d1ef79372b75", markdown: "# Hero" }; } }) });
  const sync = createNotionSyncService({ adapter, now: () => "2026-09-10T12:00:00.000Z" });
  const document = { id: "HERO-PRODUCT-HERO-BRIEF", title: "Hero", sourceCommit: "test", editClass: "proposal-editable" };
  const plan = await sync.syncDocument({ document, content: "# Hero", parentPageId: "b55c9c91-384d-452b-81db-d1ef79372b75" });
  assert.equal(plan.mode, "dry-run");
  await assert.rejects(() => sync.syncDocument({ document, content: "# Hero", parentPageId: "b55c9c91-384d-452b-81db-d1ef79372b75", mode: "execute" }), error => error.code === "EXTERNAL_WRITE_NOT_AUTHORIZED");
});
