// Real-Chromium regression for BO-149/BO-150/BO-156: both locales, three roles and
// two desktop sizes. Direction, overflow, keyboard reach, visible focus and text
// that is not colour alone are measured in the browser, not assumed.
import assert from "node:assert/strict";
import test from "node:test";

import { findBrowser, launchBrowser, openRolePage } from "./cdp-helpers.mjs";
import { createAuditFixture } from "../../tools/audit/local-fixture.mjs";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const SIZES = [[1366, 768], [1920, 1080]];

test("Inbox and Help hold up in fa/en, for owner/admin/viewer, at two desktop sizes, with the keyboard", { timeout: 240000 }, async t => {
  const binary = findBrowser(); assert.ok(binary, "No Chromium found. Set HERO_BROWSER_BIN to run the browser suite.");
  const fixture = await createAuditFixture(); t.after(() => fixture.stop()); await fixture.seed();
  const browser = await launchBrowser(binary); t.after(() => browser.close());
  const cookie = who => `__Host-hero-human-session=${encodeURIComponent(fixture.tokens[who])}`;
  for (const who of ["owner", "admin", "viewer"]) {
    const browserPage = await openRolePage(browser, cookie(who)); await browserPage.skipGuide(fixture.base);
    for (const locale of ["fa", "en"]) for (const surface of ["inbox", "help"]) for (const [width, height] of SIZES) {
      const label = `${who}/${locale}/${surface}/${width}x${height}`; await browserPage.viewport(width, height); await browserPage.goto(`${fixture.base}/api/portal?surface=${surface}&projectId=project-alpha&lang=${locale}`);
      const facts = JSON.parse(await browserPage.evaluate(`JSON.stringify({ lang: document.documentElement.lang, dir: document.documentElement.dir, computed: getComputedStyle(document.body).direction, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, h1: document.querySelectorAll('h1').length, title: document.title })`));
      assert.equal(facts.lang, locale, label); assert.equal(facts.dir, locale === "fa" ? "rtl" : "ltr", label); assert.equal(facts.computed, locale === "fa" ? "rtl" : "ltr", `${label}: the browser really lays it out ${locale === "fa" ? "right-to-left" : "left-to-right"}`);
      assert.ok(facts.overflow <= 1, `${label}: no horizontal scrolling (${facts.overflow}px)`); assert.equal(facts.h1, 1, label); assert.ok(facts.title.length > 4, label);
    }
    // keyboard: Tab reaches the inbox tabs and Enter/Space switch panels; focus is visible
    await browserPage.viewport(1366, 768); await browserPage.goto(`${fixture.base}/api/portal?surface=inbox&projectId=project-alpha&lang=en`);
    const reached = new Set(); let visibleFocus = true;
    for (let step = 0; step < 60; step += 1) {
      await browserPage.press("Tab"); await wait(15);
      const info = JSON.parse(await browserPage.evaluate(`(() => { const a = document.activeElement; if (!a) return JSON.stringify({}); const s = getComputedStyle(a); return JSON.stringify({ tab: a.dataset?.tab ?? null, act: a.dataset?.act ?? null, tag: a.tagName, ring: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none') || s.borderStyle !== 'none' }); })()`));
      if (info.tab) reached.add(`tab:${info.tab}`); if (info.act) reached.add("act"); if ((info.tab || info.act) && !info.ring) visibleFocus = false;
    }
    for (const view of ["needs-decision", "critical", "upcoming", "automation", "resolved"]) assert.ok(reached.has(`tab:${view}`), `${who}: Tab reaches the ${view} tab`);
    assert.equal(reached.has("act"), who !== "viewer", `${who}: action buttons are ${who === "viewer" ? "absent" : "reachable"} by keyboard`); assert.equal(visibleFocus, true, `${who}: focused controls show a ring`);
    await browserPage.evaluate(`document.querySelector('[data-tab="critical"]').focus()`); await browserPage.press("Enter"); await wait(60);
    assert.equal(await browserPage.evaluate(`document.querySelector('[data-panel="critical"]').hidden`), false, `${who}: Enter on a tab opens its panel`);
    await browserPage.evaluate(`document.querySelector('[data-tab="resolved"]').focus()`); await browserPage.press("Space"); await wait(60);
    assert.equal(await browserPage.evaluate(`document.querySelector('[data-panel="resolved"]').hidden`), false, `${who}: Space on a tab opens its panel`);
    assert.equal(await browserPage.evaluate(`document.querySelectorAll('[data-panel]:not([hidden])').length`), 1, `${who}: exactly one panel is visible`);
    // statuses are words, not colour
    assert.equal(await browserPage.evaluate(`[...document.querySelectorAll('.pill')].every(el => el.textContent.trim().length > 0)`), true, `${who}: every status badge carries text`);
    // switching language keeps identifiers and counts
    const before = await browserPage.evaluate(`JSON.stringify([...document.querySelectorAll('[data-count]')].map(el => [el.dataset.count, el.dataset.countValue]))`);
    await browserPage.evaluate(`document.querySelector('[data-locale-switch]').click()`); await wait(700);
    assert.equal(await browserPage.evaluate(`document.documentElement.lang`), "fa", `${who}: the language link switches the page to Persian`);
    assert.equal(await browserPage.evaluate(`JSON.stringify([...document.querySelectorAll('[data-count]')].map(el => [el.dataset.count, el.dataset.countValue]))`), before, `${who}: identifiers and counts are the same in both languages`);
  }
});
