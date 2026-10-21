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
import { auditPage } from "../tools/ui-static-audit.mjs";

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
