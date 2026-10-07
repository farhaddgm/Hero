// Real-Chromium test of the Inbox (BO-113/BO-114): an admin approves a decision
// with a real click, the real command changes state, and a viewer sees no buttons.
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

test("An admin approves a decision from the Inbox with a click; a viewer cannot act", { timeout: 120000 }, async t => {
  const binary = findBrowser(); assert.ok(binary, "No Chromium found. Set HERO_BROWSER_BIN to run the browser suite.");
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "browser-inbox-secret-1234567890abcdef", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-inbox" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(Date.now() / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now }); const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  projectWorkspace.createProject({ actor: ownerActor, projectId: "project-inbox", name: "Inbox" });
  for (const [userId, email, secret] of [["admin-user", "admin@example.test", "admin-mfa-secret-inbox"], ["viewer-user", "viewer@example.test", "viewer-mfa-secret-inbox"]]) identity.createUser({ actor: ownerActor, user: { userId, email, displayName: userId, password: "User password 123", mfaSecret: secret, mfaRequired: true } });
  access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-inbox", userId: "admin-user", role: "admin" } }); access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-inbox", userId: "viewer-user", role: "viewer" } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop()); const base = `http://127.0.0.1:${address.port}`;
  const url = `${base}/api/portal?surface=inbox&projectId=project-inbox`;
  const browser = await launchBrowser(binary); t.after(() => browser.close());
  const cookie = who => `__Host-hero-human-session=${encodeURIComponent(who === "admin" ? login("admin@example.test", "User password 123", "admin-mfa-secret-inbox") : login("viewer@example.test", "User password 123", "viewer-mfa-secret-inbox"))}`;
  const post = (path, body) => `fetch('/api/projects/project-inbox/${path}', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(body)}) }).then(response => response.status)`;

  const admin = await openRolePage(browser, cookie("admin")); await admin.skipGuide(base); await admin.goto(url);
  assert.equal(await admin.evaluate(post("commands", { commandId: "cmd-click-1", action: "deploy.test", risk: "medium", correlationId: "corr-click-1", idempotencyKey: "idem-click-1" })), 201);
  assert.equal(await admin.evaluate(post("commands/cmd-click-1/authorize", { authorizationSnapshotId: "BATCH-BACKOFFICE-20261007-025" })), 200);
  assert.equal(await admin.evaluate(post("notifications", { category: "approval", severity: "warning", title: "Approve the test deploy", deduplicationKey: "approve-click-1", correlationId: "corr-click-1", action: { type: "approve", commandId: "cmd-click-1" } })), 201);
  await admin.goto(url);
  assert.equal(await admin.evaluate(`document.querySelector('[data-count="needs-decision"]').dataset.countValue`), "1");
  await admin.evaluate(`document.querySelector('[data-tab="needs-decision"]').click()`);
  assert.equal(await admin.evaluate(`document.querySelector('[data-panel="needs-decision"]').hidden`), false);
  assert.equal(await admin.evaluate(`document.querySelector('[data-panel="critical"]').hidden`), true, "only the chosen tab is shown");
  assert.equal(await admin.evaluate(`Boolean(document.querySelector('[data-panel="needs-decision"] [data-act="approve"]'))`), true);
  await admin.evaluate(`document.querySelector('[data-panel="needs-decision"] [data-act="approve"]').click()`);
  let resolved = false;
  for (let attempt = 0; attempt < 40 && !resolved; attempt += 1) { await wait(150); resolved = await admin.evaluate(`document.querySelector('[data-count="needs-decision"]')?.dataset.countValue === '0' && document.querySelector('[data-count="resolved"]')?.dataset.countValue === '1'`); }
  assert.equal(resolved, true, "after the click the page reloads: the decision moved to Resolved");
  assert.equal(await admin.evaluate(`fetch('/api/projects/project-inbox/commands/cmd-click-1', { credentials: 'include' }).then(response => response.json()).then(body => body.card.state)`), "approved", "the click really approved the command");
  assert.equal(await admin.evaluate(`document.querySelectorAll('[data-slo]').length`), 5, "the SLO table lists all five projections");
  assert.equal(await admin.evaluate(`document.querySelector('[data-slo="portfolio"]').dataset.sloStatus`), "no-data", "an unmeasured projection is not shown as healthy");

  const viewer = await openRolePage(browser, cookie("viewer")); await viewer.skipGuide(base); await viewer.goto(url);
  assert.equal(await viewer.evaluate(`document.querySelectorAll('button[data-act]').length`), 0, "the viewer has no action buttons");
  assert.equal(await viewer.evaluate(`document.querySelector('[data-count="resolved"]').dataset.countValue`), "1", "the viewer reads the same state");
  const status = await viewer.evaluate(`fetch('/api/projects/project-inbox/notifications/anything-here/act', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) }).then(response => response.status)`);
  assert.equal(status, 403, "even crafted from the viewer's browser, the server refuses the decision");
});
