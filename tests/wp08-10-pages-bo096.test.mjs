import assert from "node:assert/strict";
import test from "node:test";

import { dependencyGraphSvg } from "../apps/control-plane/src/project-catalog-view.mjs";
import { createProjectSettingsRegistry } from "../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

const now = () => "2026-10-06T10:00:00.000Z";
const owner = { subject: "hero-owner", role: "project-owner" };
const P = "project-shop";

test("BO-096 dependency graph SVG is deterministic, layered by type and carries every node and edge", () => {
  const graph = { nodes: [{ entityId: "shop-web", type: "application", name: "Web", lifecycle: "active" }, { entityId: "shop-api", type: "service", name: "API", lifecycle: "active" }, { entityId: "shop-db", type: "data", name: "DB", lifecycle: "planned" }], edges: [{ dependencyId: "a", from: "shop-web", to: "shop-api", relation: "depends-on" }, { dependencyId: "b", from: "shop-api", to: "shop-db", relation: "writes" }, { dependencyId: "c", from: "shop-api", to: "ghost", relation: "depends-on" }] };
  const svg = dependencyGraphSvg(graph);
  assert.equal(svg, dependencyGraphSvg(structuredClone(graph)), "same input, same drawing");
  assert.match(svg, /data-node-count="3"/); assert.match(svg, /data-edge-count="3"/);
  for (const id of ["shop-web", "shop-api", "shop-db"]) assert.ok(svg.includes(`data-graph-node="${id}"`), id);
  assert.equal((svg.match(/data-edge-from=/g) ?? []).length, 2, "an edge to an unknown node is skipped, not drawn to nowhere");
  assert.ok(svg.indexOf("data-graph-node=\"shop-web\"") < svg.indexOf("data-graph-node=\"shop-api\"") && svg.indexOf("data-graph-node=\"shop-api\"") < svg.indexOf("data-graph-node=\"shop-db\""), "application, then service, then data");
  assert.ok(!dependencyGraphSvg({ nodes: [{ entityId: "<script>x", type: "service", name: "x", lifecycle: "active" }], edges: [] }).includes("<script>"), "entity ids are escaped");
});

test("BO-096/BO-104/BO-109 catalog and insights pages render per role without leaking and feedback needs a write grant", async t => {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "wp-pages-session-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-pages" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(Date.parse(now()) / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now }); const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  for (const projectId of [P, "project-other"]) projectWorkspace.createProject({ actor: owner, projectId, name: `Name ${projectId}` });
  for (const [userId, email, secret] of [["admin-user", "admin@example.test", "admin-mfa-secret-pages"], ["viewer-user", "viewer@example.test", "viewer-mfa-secret-pages"]]) identity.createUser({ actor: owner, user: { userId, email, displayName: userId, password: "User password 123", mfaSecret: secret, mfaRequired: true } });
  access.upsertGrant({ actor: owner, grant: { projectId: P, userId: "admin-user", role: "admin" } }); access.upsertGrant({ actor: owner, grant: { projectId: P, userId: "viewer-user", role: "viewer" } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop()); const base = `http://127.0.0.1:${address.port}`;
  const tokens = { owner: login("owner@example.test", "Owner password 123", "owner-mfa-secret-pages"), admin: login("admin@example.test", "User password 123", "admin-mfa-secret-pages"), viewer: login("viewer@example.test", "User password 123", "viewer-mfa-secret-pages") };
  const call = async (who, method, route, body) => { const response = await fetch(`${base}${route}`, { method, headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/json", ...(method === "GET" ? {} : { origin: base }) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
  const page = async (who, surface, projectId = P) => { const response = await fetch(`${base}/api/portal?surface=${surface}&projectId=${projectId}`, { headers: { cookie: `__Host-hero-human-session=${encodeURIComponent(tokens[who])}` }, redirect: "manual" }); return { status: response.status, html: await response.text() }; };
  const root = `/api/projects/${P}`;
  await call("admin", "POST", `${root}/catalog`, { entityId: "shop-web", type: "application", name: "Shop web", lifecycle: "active", metadata: { owner: "hero-owner" } });
  await call("admin", "POST", `${root}/catalog`, { entityId: "shop-api", type: "service", name: "Shop API", lifecycle: "active", metadata: { owner: "hero-owner" } });
  await call("admin", "POST", `${root}/catalog`, { entityId: "shop-db", type: "data", name: "Shop DB", metadata: { classification: "internal" } });
  await call("admin", "POST", `${root}/catalog/dependencies`, { fromEntityId: "shop-web", toEntityId: "shop-api" }); await call("admin", "POST", `${root}/catalog/dependencies`, { fromEntityId: "shop-api", toEntityId: "shop-db", relation: "writes" });
  await call("admin", "POST", `${root}/catalog/entities/shop-api/references`, { references: { owner: "hero-owner", team: "developero", health: "degraded" } });
  await call("admin", "POST", `${root}/catalog/knowledge`, { knowledgeId: "pricing-note", kind: "note", title: "Discount floor thirty percent", sourceRef: "hero://docs/pricing", sensitivity: "restricted" });
  await call("admin", "POST", `${root}/catalog/knowledge`, { knowledgeId: "decision-db", kind: "decision", title: "Use PostgreSQL", sourceRef: "hero://docs/db" });

  const viewerCatalog = await page("viewer", "catalog");
  assert.equal(viewerCatalog.status, 200); assert.match(viewerCatalog.html, /data-viewer-role="viewer"/);
  assert.match(viewerCatalog.html, /data-node-count="3"/); assert.match(viewerCatalog.html, /data-edge-count="2"/);
  assert.match(viewerCatalog.html, /data-impact-for="shop-db"[\s\S]*data-affected="shop-api"[\s\S]*data-affected="shop-web"/, "the impact of changing the database lists everything above it with its path");
  assert.match(viewerCatalog.html, /مسیر: shop-db ← shop-api ← shop-web/);
  assert.match(viewerCatalog.html, /تیم: developero/); assert.match(viewerCatalog.html, /\[restricted document\]/); assert.ok(!viewerCatalog.html.includes("Discount floor"), "restricted text never reaches a viewer");
  assert.ok(!viewerCatalog.html.includes("project-other"), "no other project is mentioned");
  assert.ok((await page("admin", "catalog")).html.includes("Discount floor"), "an editor sees the document");
  assert.equal((await page("admin", "catalog", "project-other")).status, 403, "no grant, no page");
  assert.match((await page("owner", "control")).html, /surface=catalog&projectId=project-shop|surface=catalog&amp;projectId=project-shop/, "operations links to the catalog");

  assert.equal((await call("admin", "POST", `${root}/budget`, { softThreshold: 100, hardCap: 400 })).status, 200);
  await call("admin", "POST", `${root}/usage`, { usageId: "usage-1", invocationId: "invoke-1", provider: "synthetic", model: "sol", source: "synthetic", inputTokens: 150, teamId: "developero" });
  await call("admin", "POST", `${root}/evaluations`, { evaluationId: "eval-1", subjectId: "developero", method: "human", goalFit: 0.85, evidenceRefs: ["hero://evidence/x"] });
  const viewerInsights = await page("viewer", "insights");
  assert.equal(viewerInsights.status, 200); assert.match(viewerInsights.html, /data-budget-decision="soft-threshold-warning"/); assert.match(viewerInsights.html, /data-reconcile-complete="true"/);
  assert.match(viewerInsights.html, /data-ledger-scope="developero"/); assert.match(viewerInsights.html, /drill-down\?kind=cost&amp;groupBy=team&amp;scope=developero/); assert.match(viewerInsights.html, /data-scorecard="developero"/);
  assert.match(viewerInsights.html, /data-feedback-readonly/); assert.ok(!viewerInsights.html.includes("<form id=\"feedback-form\""), "a viewer gets no feedback form");
  assert.match((await page("admin", "insights")).html, /<form id="feedback-form"/);
  assert.equal((await page("viewer", "insights", "project-other")).status, 403);
  const drill = await call("viewer", "GET", `${root}/drill-down?kind=cost&groupBy=team&scope=developero`); assert.equal(drill.body.drillDown.events[0].invocation.provider, "synthetic", "the page's link resolves to real evidence");
  assert.equal((await call("viewer", "POST", `${root}/feedback`, { feedbackId: "feedback-v", subjectId: "release-1", subjectKind: "release", rating: 5 })).status, 403);
  assert.equal((await call("admin", "POST", `${root}/feedback`, { feedbackId: "feedback-a", subjectId: "release-1", subjectKind: "release", rating: 4, comment: "Looks <b>good</b>" })).status, 201);
  const after = await page("viewer", "insights");
  assert.match(after.html, /data-feedback-id="feedback-a"/); assert.match(after.html, /Looks &lt;b&gt;good&lt;\/b&gt;/, "feedback text is escaped"); assert.equal((await call("viewer", "GET", `${root}/feedback`)).body.feedback.length, 1);
});
