// Real-Chromium test of the cost/health page (BO-104/BO-109): an admin submits
// optional feedback through the form, the page shows it, and a viewer sees the
// same page without any form.
import assert from "node:assert/strict";
import test from "node:test";

import { findBrowser, launchBrowser, openRolePage } from "./cdp-helpers.mjs";
import { createProjectSettingsRegistry } from "../../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace } from "../../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../../packages/domain/src/project-access.mjs";

const now = () => new Date().toISOString();
const ownerActor = { subject: "hero-owner", role: "project-owner" };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test("An admin submits feedback with real clicks and typing; a viewer sees it read-only", { timeout: 120000 }, async t => {
  const binary = findBrowser(); assert.ok(binary, "No Chromium found. Set HERO_BROWSER_BIN to run the browser suite.");
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "browser-insights-secret-1234567890abc", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-insights" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(Date.now() / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now }); const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  projectWorkspace.createProject({ actor: ownerActor, projectId: "project-insight", name: "Insight" });
  for (const [userId, email, secret] of [["admin-user", "admin@example.test", "admin-mfa-secret-insights"], ["viewer-user", "viewer@example.test", "viewer-mfa-secret-insights"]]) identity.createUser({ actor: ownerActor, user: { userId, email, displayName: userId, password: "User password 123", mfaSecret: secret, mfaRequired: true } });
  access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-insight", userId: "admin-user", role: "admin" } }); access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-insight", userId: "viewer-user", role: "viewer" } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop()); const base = `http://127.0.0.1:${address.port}`;
  const url = `${base}/api/portal?surface=insights&projectId=project-insight`;
  const browser = await launchBrowser(binary); t.after(() => browser.close());
  const cookie = who => `__Host-hero-human-session=${encodeURIComponent(who === "admin" ? login("admin@example.test", "User password 123", "admin-mfa-secret-insights") : login("viewer@example.test", "User password 123", "viewer-mfa-secret-insights"))}`;

  const admin = await openRolePage(browser, cookie("admin")); await admin.skipGuide(base); await admin.goto(url);
  assert.equal(await admin.evaluate(`Boolean(document.querySelector('#feedback-form'))`), true, "the admin sees the form");
  await admin.evaluate(`(() => { const f = document.querySelector('#feedback-form'); f.subjectId.value = 'release-7'; f.subjectKind.value = 'release'; f.rating.value = '4'; f.comment.value = 'Clear and calm release'; f.requestSubmit(); })()`);
  let shown = false;
  for (let attempt = 0; attempt < 40 && !shown; attempt += 1) { await wait(150); shown = await admin.evaluate(`Boolean(document.querySelector('[data-feedback-id] code')?.textContent === 'release-7')`); }
  assert.equal(shown, true, "after submitting, the page reloads with the stored feedback");
  assert.match(await admin.evaluate(`document.querySelector('[data-feedback-id]').innerText`), /Clear and calm release/);
  await admin.evaluate(`(() => { const f = document.querySelector('#feedback-form'); f.subjectId.value = 'ab'; f.requestSubmit(); })()`);
  let message = "";
  for (let attempt = 0; attempt < 40 && !message; attempt += 1) { await wait(150); message = await admin.evaluate(`document.querySelector('#feedback-status').textContent.replace('در حال ثبت…', '')`); }
  assert.match(message, /INVALID_IDENTIFIER|\(/, "a bad subject id is refused by the server and the reason is shown on the page");
  assert.equal(await admin.evaluate(`document.querySelectorAll('[data-feedback-id]').length`), 1, "nothing extra was stored");

  const viewer = await openRolePage(browser, cookie("viewer")); await viewer.skipGuide(base); await viewer.goto(url);
  assert.equal(await viewer.evaluate(`Boolean(document.querySelector('#feedback-form'))`), false, "the viewer has no form");
  assert.equal(await viewer.evaluate(`Boolean(document.querySelector('[data-feedback-readonly]'))`), true);
  assert.equal(await viewer.evaluate(`document.querySelector('[data-feedback-id] code')?.textContent`), "release-7", "the viewer reads the same feedback");
  const status = await viewer.evaluate(`fetch('/api/projects/project-insight/feedback', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ feedbackId: 'feedback-sneaky', subjectId: 'release-8', subjectKind: 'release' }) }).then(response => response.status)`);
  assert.equal(status, 403, "even crafted from the viewer's browser, the server refuses the write");
});
