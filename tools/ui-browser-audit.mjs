import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";

// Optional audit dependencies stay outside the production dependency graph.
// See docs/operations/HERO-UI-BROWSER-AUDIT.md for the pinned installation.
const { chromium } = await import("../.hero-ui/node_modules/playwright/index.mjs");
const { default: AxeBuilder } = await import("../.hero-ui/node_modules/@axe-core/playwright/dist/index.mjs");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".hero-ui", "results");
await fs.mkdir(output, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(root, ".hero-ui", "browsers");
// Never inherit operational stores, providers, credentials or network grants.
for (const name of Object.keys(process.env)) if (name.startsWith("HERO_")) delete process.env[name];
process.env.HERO_UI_ENVIRONMENT = "development";
const now = () => "2026-10-07T10:00:00.000Z";
const email = "owner@hero.example.test";
const password = randomUUID();
const mfaSecret = randomUUID();
const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email, displayName: "مالک آزمایشی" }, now });
const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: randomUUID() + randomUUID(), now, owner: { userId: "hero-owner", email, displayName: "مالک آزمایشی", password, mfaSecret } });
const workspace = createProjectWorkspace({ now });
const actor = { subject: "hero-owner", role: "project-owner" };
for (const [projectId, name] of [["hero-workshop", "کارگاه محصول"], ["hero-support", "پنل پشتیبانی"]]) {
  workspace.createProject({ actor, projectId, name, description: "پروژهٔ ساختگی برای ممیزی رابط", intake: { goal: "ساخت محصول ساده و کاربردی", users: "تیم محصول", autonomy: "approval-each-stage" } });
}
const app = createHeroServer({ host: "127.0.0.1", port: 0, now, requirePostgres: false, providerAdapters: {}, humanIdentity: identity, projectAccessRegistry: access, projectWorkspace: workspace });
let browser;
const report = { schema: "hero.ui-browser-audit/v1", startedAt: new Date().toISOString(), fixture: "isolated-in-memory", cases: [], errors: [], accessibility: [] };
try {
  const address = await app.start();
  const base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => report.errors.push(page.url().replace(base, "") + ":" + error.stack));
  // Local-only audit: a future UI regression must not call an external service.
  await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  // Inspect the anonymous entry screen separately from signed-in management.
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.goto(base + "/api/portal?surface=identity");
      await page.evaluate(theme => localStorage.setItem("hero.ui.theme", theme), theme);
      await page.reload();
      await page.waitForFunction(() => !document.querySelector("#login-submit").disabled);
      await page.evaluate(() => document.fonts.ready);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) report.errors.push(`horizontal-overflow:login:${width}:${theme}`);
      if (width !== 320) {
        await page.screenshot({ path: path.join(output, `login-${width}-${theme}.png`), fullPage: true });
        const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        report.accessibility.push({ surface: "login", width, theme, violations: audit.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
      }
      report.cases.push(`layout:login:${width}:${theme}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/api/portal?surface=identity");
  await page.route("**/api/identity/login", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "سرویس موقتاً در دسترس نیست؛ دوباره تلاش کنید." }) }), { times: 1 });
  await page.locator('#login-form input[name="email"]').fill(email);
  await page.locator('#login-form input[name="password"]').fill(password);
  await page.locator("#login-submit").click();
  await page.locator("#login-status.error").waitFor();
  assert.equal(await page.locator("#login-submit").isEnabled(), true);
  report.cases.push("login-failure-feedback-and-retry");
  await page.locator("#login-submit").click();
  await page.waitForFunction(() => document.activeElement?.name === "mfaCode");
  assert.equal(await page.locator("#identity-password").inputValue(), "");
  const code = createTotpCode(mfaSecret, Math.floor(Date.parse(now()) / 1000));
  await page.locator('#mfa-form input').fill(code.replace(/[0-9]/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]));
  assert.equal(await page.locator('#mfa-form input').inputValue(), code);
  await page.locator('#mfa-form button[type="submit"]').click();
  await page.waitForURL(/surface=portfolio/);
  report.cases.push("password-to-MFA-focus-and-Persian-digits", "local-human-login-and-cookie-navigation");
  await page.locator("[data-hero-walkthrough-launcher]").waitFor();
  assert.equal(await page.locator("[data-hero-walkthrough-coach]").count(), 0);
  report.cases.push("default-guide-starts-minimized");
  // Suppress automatic coach only for the audit, using its existing preference.
  await page.evaluate(() => { window.heroWalkthrough?.stop("closed-by-user"); localStorage.setItem("hero.project-walkthrough.owner-dismissed.v1", "true"); document.querySelector('[data-hero-action-feedback] [data-kind="close"]')?.click(); });
  await page.reload();
  await page.locator("#portfolio-search").fill("كارگاه");
  assert.equal(await page.locator("[data-project-card]:visible").count(), 1);
  await page.locator("#portfolio-search").fill("نام ناموجود");
  assert.equal(await page.locator("[data-project-card]:visible").count(), 0);
  assert.equal(await page.locator("#portfolio-no-results").isVisible(), true);
  await page.locator("#portfolio-empty-reset").click();
  assert.equal(await page.locator("[data-project-card]:visible").count(), 2);
  await page.locator("#portfolio-health").selectOption("neutral");
  assert.equal(await page.locator("[data-project-card]:visible").count(), 2);
  await page.locator("#portfolio-reset").click();
  report.cases.push("Persian-search", "no-results-and-reset", "unknown-health-filter");
  await page.keyboard.press("Control+k");
  await page.locator("[data-hero-command-input]").fill("workspace");
  assert.equal(await page.locator("[data-hero-command]:visible").count(), 1);
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.locator('[data-hero-command-active="true"]:visible').count(), 1);
  await page.keyboard.press("Escape");
  report.cases.push("command-palette-keyboard-and-filter");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(theme => localStorage.setItem("hero.ui.theme", theme), theme);
      await page.reload();
      await page.locator("#create-project-button").click();
      assert.equal(await page.locator("#create-project-dialog").evaluate(node => node.contains(document.activeElement)), true);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) report.errors.push(`horizontal-overflow:create-project:${width}:${theme}`);
      const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      report.accessibility.push({ surface: "create-project", width, theme, violations: audit.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "create-project-button");
      report.cases.push(`create-project-dialog:${width}:${theme}`);
    }
  }
  const surfaces = ["portfolio", "identity", "studio", "workspace", "control", "command", "ai", "walkthrough", "lab", "management-overview", "management-teams", "management-project", "management-operations", "management-guide"];
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(theme => localStorage.setItem("hero.ui.theme", theme), theme);
      for (const surface of surfaces) {
        const url = surface === "lab" ? base + "/" : surface.startsWith("management-") ? base + "/api/portal?surface=ai#" + surface.slice("management-".length) : base + "/api/portal?surface=" + surface + (["studio", "workspace", "control", "command", "walkthrough"].includes(surface) ? "&projectId=hero-workshop" : "");
        await page.goto(url);
        await page.locator("#hero-main").waitFor();
        if (surface === "workspace") await page.locator("#content:not([hidden])").waitFor();
        if (surface === "ai") assert.equal(await page.locator('[data-view-panel="ai"]').isVisible(), true);
        assert.equal(await page.locator("[data-hero-walkthrough-coach]").count(), 0, "A dismissed guide must stay closed across surfaces");
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => { window.scrollTo(0,0); document.querySelector('[data-hero-action-feedback] [data-kind="close"]')?.click(); });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        if (overflow) report.errors.push(`horizontal-overflow:${surface}:${width}:${theme}`);
        if (width === 1440 || width === 390) {
          await page.screenshot({ path: path.join(output, `${surface}-${width}-${theme}.png`), fullPage: true });
          const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          report.accessibility.push({ surface, width, theme, violations: audit.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
        }
        report.cases.push(`layout:${surface}:${width}:${theme}`);
      }
    }
  }
  await page.goto(base + "/api/portal?surface=portfolio");
  await page.locator("[data-hero-nav-toggle]").click();
  assert.equal(await page.locator("#hero-main").getAttribute("inert"), "");
  const close = page.locator("[data-hero-nav-close]");
  await close.focus(); await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.querySelector("#hero-navigation").contains(document.activeElement)), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#hero-main").getAttribute("inert"), null);
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-hero-nav-toggle")), true);
  report.cases.push("mobile-drawer-focus-trap-Escape-and-focus-return");
  // Browser storage denial must not disable navigation or theme controls.
  const restricted = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await restricted.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Unavailable", "SecurityError"); } }));
  const restrictedPage = await restricted.newPage();
  restrictedPage.on("pageerror", error => report.errors.push("storage-denied:" + error.message));
  await restrictedPage.goto(base + "/api/portal?surface=identity");
  await restrictedPage.locator("[data-hero-nav-toggle]").click();
  assert.equal(await restrictedPage.locator("#hero-navigation").getAttribute("data-open"), "true");
  await restrictedPage.keyboard.press("Escape");
  await restrictedPage.locator("[data-hero-theme-button]").click();
  report.cases.push("navigation-and-theme-with-storage-denied");
  await restricted.close();
  const severe = report.accessibility.flatMap(item => item.violations.filter(violation => ["serious", "critical"].includes(violation.impact)).map(violation => `${item.surface}/${item.width}/${item.theme}:${violation.id}`));
  report.errors.push(...severe);
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await app.stop();
  report.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, cases: report.cases.length, errors: report.errors, failure: report.failure, report: ".hero-ui/results/report.json" }, null, 2));
}
