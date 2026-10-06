import assert from "node:assert/strict";
import test from "node:test";

import { breadcrumbsFor, parsePagination, sectionsFor, validateBackofficePortfolioContract, PORTFOLIO_KPIS } from "../packages/contracts/src/backoffice-portfolio.mjs";
import { createProjectSettingsRegistry } from "../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";
import { getPortfolioHtml } from "../apps/control-plane/src/portfolio-view.mjs";

const now = () => "2026-10-06T10:00:00.000Z";
const ownerActor = { subject: "hero-owner", role: "project-owner" };

test("BO-053/059 contract: role-gated information architecture, stable breadcrumbs and strict pagination", () => {
  assert.deepEqual(validateBackofficePortfolioContract(), []);
  assert.ok(!sectionsFor("viewer").some(section => section.id === "command"), "viewer never gets the command surface");
  assert.ok(sectionsFor("admin").some(section => section.id === "command"));
  const crumbs = breadcrumbsFor({ projectId: "project-alpha", projectName: "Alpha", sectionId: "settings", entityLabel: "ai.defaultModel" });
  assert.deepEqual(crumbs.map(crumb => crumb.id), ["portfolio", "project:project-alpha", "settings", "context"]);
  assert.equal(crumbs[1].href, "/api/portal?surface=studio&projectId=project-alpha");
  assert.equal(crumbs[2].href, "/api/portal?surface=workspace&projectId=project-alpha#settings");
  assert.deepEqual(breadcrumbsFor({ projectId: "project-alpha", projectName: "Alpha", sectionId: "settings" }), breadcrumbsFor({ projectId: "project-alpha", projectName: "Alpha", sectionId: "settings" }), "stable for the same input");
  assert.deepEqual(parsePagination({}), { page: 1, pageSize: 12 });
  for (const bad of [{ page: "0" }, { page: "1.5" }, { pageSize: "51" }, { pageSize: "x" }]) assert.equal(parsePagination(bad), null, JSON.stringify(bad));
});

async function setup(t) {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "portfolio-wp05-session-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-wp05" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(Date.parse(now()) / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now });
  const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  const ids = Array.from({ length: 15 }, (_, index) => `project-${String(index + 1).padStart(2, "0")}`);
  for (const projectId of ids) projectWorkspace.createProject({ actor: ownerActor, projectId, name: `Name ${projectId}` });
  const approved = projectWorkspace.createProject({ actor: ownerActor, projectId: "project-active", name: "Active one" });
  projectWorkspace.approveFoundation({ actor: ownerActor, projectId: "project-active", proposalId: approved.foundationProposal.proposalId, expectedVersion: 1 });
  for (const [userId, email, secret] of [["admin-user", "admin@example.test", "admin-mfa-secret-wp05"], ["viewer-user", "viewer@example.test", "viewer-mfa-secret-wp05"], ["nobody-user", "nobody@example.test", "nobody-mfa-secret-wp05"]]) {
    identity.createUser({ actor: ownerActor, user: { userId, email, displayName: userId, password: "User password 123", mfaSecret: secret, mfaRequired: true } });
  }
  access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-01", userId: "admin-user", role: "admin" } });
  access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-active", userId: "admin-user", role: "admin" } });
  access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-02", userId: "viewer-user", role: "viewer" } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const tokens = { owner: login("owner@example.test", "Owner password 123", "owner-mfa-secret-wp05"), admin: login("admin@example.test", "User password 123", "admin-mfa-secret-wp05"), viewer: login("viewer@example.test", "User password 123", "viewer-mfa-secret-wp05"), nobody: login("nobody@example.test", "User password 123", "nobody-mfa-secret-wp05") };
  const get = async (who, path) => { const response = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${tokens[who]}` } }); return { status: response.status, body: await response.json() }; };
  return { get, total: ids.length + 1 };
}

test("BO-055/056/060/062 portfolio is role-aware, paginated, and every KPI equals its drill-down", async t => {
  const { get, total } = await setup(t);
  const ownerPage = (await get("owner", "/api/portfolio?pageSize=5")).body.portfolio;
  assert.equal(ownerPage.pagination.total, total); assert.equal(ownerPage.pagination.pageCount, Math.ceil(total / 5));
  assert.equal(ownerPage.cards.length, 5); assert.equal(ownerPage.pagination.hasNext, true); assert.equal(ownerPage.pagination.hasPrevious, false);
  const last = (await get("owner", `/api/portfolio?pageSize=5&page=${ownerPage.pagination.pageCount}`)).body.portfolio;
  assert.equal(last.cards.length, total % 5 || 5); assert.equal(last.pagination.hasNext, false);
  const all = new Set(); for (let page = 1; page <= ownerPage.pagination.pageCount; page += 1) for (const card of (await get("owner", `/api/portfolio?pageSize=5&page=${page}`)).body.portfolio.cards) all.add(card.projectId);
  assert.equal(all.size, total, "pages cover every project exactly once");
  assert.equal((await get("owner", "/api/portfolio?page=0")).status, 400);
  assert.equal((await get("owner", "/api/portfolio?pageSize=500")).body.code, "PAGINATION_INVALID");
  assert.ok(ownerPage.cards.every(card => card.role === "project-owner" && card.capabilities.canManageLifecycle && card.latestDecision?.kind === "foundation"));

  const adminView = (await get("admin", "/api/portfolio")).body.portfolio;
  assert.deepEqual(adminView.cards.map(card => card.projectId).sort(), ["project-01", "project-active"]);
  assert.ok(adminView.cards.every(card => card.role === "admin" && card.capabilities.canEdit && !card.capabilities.canManageLifecycle));
  const viewerView = (await get("viewer", "/api/portfolio")).body.portfolio;
  assert.deepEqual(viewerView.cards.map(card => [card.projectId, card.role, card.capabilities.canEdit]), [["project-02", "viewer", false]]);
  const nobodyView = (await get("nobody", "/api/portfolio")).body.portfolio;
  assert.equal(nobodyView.cards.length, 0); assert.equal(nobodyView.pagination.total, 0); assert.ok(nobodyView.kpis.every(kpi => kpi.value === 0), "empty state has zero KPIs, not someone else's");

  for (const who of ["owner", "admin", "viewer", "nobody"]) {
    const portfolio = (await get(who, "/api/portfolio")).body.portfolio;
    assert.equal(portfolio.kpis.length, PORTFOLIO_KPIS.length);
    for (const kpi of portfolio.kpis) {
      const drill = (await get(who, kpi.drillDown)).body.kpi;
      assert.equal(drill.value, kpi.value, `${who} ${kpi.kpiId}`); assert.equal(drill.items.length, drill.value, `${who} ${kpi.kpiId} count equals items`);
      if (who !== "owner") assert.ok(drill.items.every(item => portfolio.cards.some(card => card.projectId === item.projectId)), `${who} ${kpi.kpiId} drill-down stays inside the grant`);
    }
  }
  assert.equal((await get("owner", "/api/portfolio/kpis/active-projects")).body.kpi.items[0].projectId, "project-active");
  assert.equal((await get("owner", "/api/portfolio/kpis/foundation-pending")).body.kpi.value, total - 1);
  assert.equal((await get("owner", "/api/portfolio/kpis/made-up-kpi")).status, 404);
});

test("BO-057/058/059/061/062 project overview, breadcrumbs, sections and search stay inside the grant", async t => {
  const { get } = await setup(t);
  const overview = (await get("viewer", "/api/projects/project-02/workspace-overview")).body.overview;
  assert.deepEqual(overview.breadcrumbs.map(crumb => crumb.id), ["portfolio", "project:project-02", "settings"]);
  assert.equal(overview.viewerRole, "viewer");
  assert.ok(!overview.sections.some(section => section.id === "command"), "viewer overview hides the command surface");
  assert.ok((await get("admin", "/api/projects/project-01/workspace-overview")).body.overview.sections.some(section => section.id === "command"));
  assert.equal((await get("viewer", "/api/projects/project-01/workspace-overview")).status, 403, "navigation isolation: no grant, no overview");
  const viewerSearch = (await get("viewer", "/api/portfolio/search?q=Name")).body.results;
  assert.deepEqual(viewerSearch.map(item => item.projectId), ["project-02"]);
  assert.equal(viewerSearch[0].portalHref, "/api/portal?surface=studio&projectId=project-02");
  assert.equal((await get("nobody", "/api/portfolio/search?q=Name")).body.results.length, 0);
  assert.equal((await get("owner", "/api/portfolio/search?q=Name")).body.results.length, 15, "search is capped and complete for the owner");
  assert.equal((await get("owner", "/api/portfolio/search?q=x")).status, 400, "error state for an invalid query");
});

test("BO-056/062 portfolio HTML renders roles, decisions, KPI drill-downs, pager and the empty-page notice", () => {
  const portfolio = { cards: [{ projectId: "project-02", name: "Beta", lifecycle: "foundation-review", role: "viewer", capabilities: { canEdit: false }, latestDecision: { kind: "foundation", state: "proposed", version: 1 } }], kpis: PORTFOLIO_KPIS.map(kpi => ({ ...kpi, value: 1, drillDown: `/api/portfolio/kpis/${kpi.kpiId}?view=active` })), pagination: { page: 2, pageSize: 1, total: 3, pageCount: 3, hasPrevious: true, hasNext: true, requestedPage: 9 }, generatedAt: now() };
  const html = getPortfolioHtml({ portfolio });
  for (const kpi of PORTFOLIO_KPIS) assert.ok(html.includes(`data-kpi-drilldown="${kpi.kpiId}"`), kpi.kpiId);
  assert.match(html, /data-project-role="viewer"/); assert.match(html, /مشاهده‌گر/); assert.match(html, /Foundation منتظر تصمیم · نسخهٔ 1/);
  assert.match(html, /rel="prev" href="\/api\/portal\?surface=portfolio&amp;page=1&amp;pageSize=1"/); assert.match(html, /rel="next"/);
  assert.match(html, /صفحهٔ درخواستی وجود ندارد/);
  assert.match(getPortfolioHtml({ portfolio: { cards: [], kpis: [], pagination: { page: 1, pageSize: 12, total: 0, pageCount: 1, hasPrevious: false, hasNext: false, requestedPage: 1 } } }), /پروژه‌ای برای این دسترسی وجود ندارد/, "empty state");
});
