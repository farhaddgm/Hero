import assert from "node:assert/strict";
import test from "node:test";

import { getBackofficeHtml } from "../apps/control-plane/src/backoffice-view.mjs";
import { getDashboardHtml } from "../apps/control-plane/src/dashboard-view.mjs";
import { getIdentityHtml } from "../apps/control-plane/src/identity-view.mjs";
import { getPortfolioHtml } from "../apps/control-plane/src/portfolio-view.mjs";
import { getProductStudioHtml } from "../apps/control-plane/src/product-studio-view.mjs";
import { getProjectControlRoomHtml } from "../apps/control-plane/src/project-control-room-view.mjs";
import { getProjectWalkthroughHtml } from "../apps/control-plane/src/project-walkthrough-view.mjs";
import { getProjectWorkspaceHtml } from "../apps/control-plane/src/project-workspace-view.mjs";

/**
 * Static accessibility and right-to-left audit of every full-page view. It needs no browser, so it
 * runs inside `pnpm check`; the real-browser checks stay in tests/browser. It looks at structure only
 * (language, direction, landmarks, names, unique ids), not at colour contrast or focus order.
 */
const pages = {
  backoffice: getBackofficeHtml(),
  dashboard: getDashboardHtml(),
  identity: getIdentityHtml(),
  portfolio: getPortfolioHtml({ portfolio: { projects: [], kpis: [], role: "owner" } }),
  "product-studio": getProductStudioHtml(),
  "project-control": getProjectControlRoomHtml(),
  walkthrough: getProjectWalkthroughHtml({ projectId: "demo-project" }),
  workspace: getProjectWorkspaceHtml({ projectId: "demo-project" })
};

const withoutScripts = html => html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map(match => match[1]);
const attr = (attrs, name) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs)?.slice(1).find(value => value !== undefined);

/** Returns a list of structural problems; an empty list means the page passes. */
function auditPage(source) {
  const html = withoutScripts(source);
  const problems = [];
  const root = tags(html, "html")[0] ?? "";
  if (attr(root, "lang") !== "fa") problems.push("lang must be fa");
  if (attr(root, "dir") !== "rtl") problems.push("dir must be rtl");
  if (!/<meta[^>]+name="viewport"[^>]+width=device-width/.test(html)) problems.push("responsive viewport is missing");
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?\b/.test(html)) problems.push("zoom is disabled");
  if (!/<title>[^<]{2,}<\/title>/.test(html)) problems.push("title is missing");
  if (tags(html, "main").length !== 1) problems.push("exactly one main landmark is required");
  if (!/class="hero-skip-link"[^>]*href="#hero-main"/.test(html) || !/id="hero-main"/.test(html)) problems.push("skip link or its target is missing");
  for (const attrs of tags(html, "[a-z]+")) {
    const tabindex = Number(attr(attrs, "tabindex"));
    if (Number.isFinite(tabindex) && tabindex > 0) problems.push(`positive tabindex: ${attrs.slice(0, 60)}`);
  }
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  for (const id of new Set(ids.filter((value, index) => ids.indexOf(value) !== index))) problems.push(`duplicate id: ${id}`);
  const known = new Set(ids);
  // Dynamic regions are filled by the page script; only references no script could define are errors.
  const scriptsCreateIds = (source.match(/\.id\s*=|setAttribute\(["']id["']/g) ?? []).length > 0;
  if (!scriptsCreateIds) {
    for (const match of html.matchAll(/\saria-(?:labelledby|describedby|controls)="([^"]+)"/g)) {
      for (const ref of match[1].split(/\s+/)) if (!known.has(ref)) problems.push(`aria reference to missing id: ${ref}`);
    }
  }
  for (const attrs of tags(html, "img")) if (attr(attrs, "alt") === undefined) problems.push(`img without alt: ${attrs.slice(0, 60)}`);
  const labelFor = new Set([...html.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map(match => match[1]));
  const wrapped = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map(match => match[1]);
  for (const element of ["input", "select", "textarea"]) {
    for (const match of html.matchAll(new RegExp(`<${element}\\b([^>]*)>`, "gi"))) {
      const attrs = match[1];
      const type = (attr(attrs, "type") ?? "text").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
      const id = attr(attrs, "id");
      const named = attr(attrs, "aria-label") || attr(attrs, "aria-labelledby") || attr(attrs, "title") || (id && labelFor.has(id));
      if (!named && !wrapped.some(body => body.includes(match[0]))) problems.push(`${element}${id ? `#${id}` : ""} has no accessible name`);
    }
  }
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (!text && !attr(match[1], "aria-label") && !attr(match[1], "aria-labelledby") && !attr(match[1], "title")) problems.push(`button has no accessible name: ${match[1].slice(0, 60)}`);
  }
  return problems;
}

test("the audit itself detects the defects it claims to detect", () => {
  const bad = `<html lang="en"><head><meta name="viewport" content="width=device-width, user-scalable=no"></head><body>
    <div tabindex="3" id="a"></div><div id="a"></div><img src="x.png"><input id="name"><select></select><button></button>
    <p aria-labelledby="ghost"></p><main></main><main></main></body></html>`;
  const problems = auditPage(bad).join(" | ");
  for (const expected of ["lang must be fa", "dir must be rtl", "zoom is disabled", "title is missing", "exactly one main", "skip link", "positive tabindex", "duplicate id: a", "img without alt", "input#name has no accessible name", "select has no accessible name", "button has no accessible name", "aria reference to missing id: ghost"]) {
    assert.ok(problems.includes(expected), `not detected: ${expected}`);
  }
});

for (const [name, source] of Object.entries(pages)) {
  test(`${name}: is Persian, right-to-left, responsive, landmarked and every control has a name`, () => {
    assert.deepEqual(auditPage(source), []);
  });
}

test("every page shares the same Persian shell: skip link and the Persian font are present", () => {
  for (const [name, html] of Object.entries(pages)) {
    assert.match(html, /hero-skip-link/, name);
    assert.match(html, /Vazirmatn/, `${name} loads the Persian font`);
  }
});
