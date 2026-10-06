// Browser test for the actionable Command Center board (BO-086). The owner
// approves, queues and dispatches a command by clicking the rendered buttons;
// a viewer sees the same board but every write is rejected by the server.
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import { findBrowser, launchBrowser, openRolePage } from "./cdp-helpers.mjs";
import { createProjectSettingsRegistry } from "../../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace } from "../../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../../packages/domain/src/project-access.mjs";

const now = () => new Date().toISOString();
const ownerActor = { subject: "hero-owner", role: "project-owner" };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test("The Command Center board drives approve → queue → dispatch through real clicks", { timeout: 120000 }, async t => {
  const binary = findBrowser();
  assert.ok(binary, "No Chromium found. Set HERO_BROWSER_BIN to run the browser suite.");
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "browser-command-board-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-board" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(Date.now() / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now });
  const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  projectWorkspace.createProject({ actor: ownerActor, projectId: "project-board", name: "Board" });
  projectSettings.suggestPolicyPack({ projectId: "project-board" }); projectSettings.applyPolicyPack({ actor: ownerActor, projectId: "project-board", reason: "Initial policy" });
  identity.createUser({ actor: ownerActor, user: { userId: "viewer-user", email: "viewer@example.test", displayName: "Viewer", password: "User password 123", mfaSecret: "viewer-mfa-secret-board", mfaRequired: true } });
  access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-board", userId: "viewer-user", role: "viewer" } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const ownerToken = login("owner@example.test", "Owner password 123", "owner-mfa-secret-board");
  const api = (method, route, body) => fetch(`${base}${route}`, { method, headers: { authorization: `Bearer ${ownerToken}`, "content-type": "application/json", ...(method === "GET" ? {} : { origin: base }) }, body: method === "GET" ? undefined : JSON.stringify(body) }).then(response => response.json());
  await api("POST", "/api/projects/project-board/commands", { commandId: "cmd-board-1", action: "run-tests", risk: "medium", summary: "Run the regression suite", correlationId: "corr-board-1", idempotencyKey: "idem-board-1" });
  await api("POST", "/api/projects/project-board/commands/cmd-board-1/authorize", { authorizationSnapshotId: "BATCH-BACKOFFICE-20261006-023" });

  const browser = await launchBrowser(binary); t.after(() => browser.close());
  const evidenceDir = process.env.HERO_BROWSER_EVIDENCE_DIR ?? null;
  const owner = await openRolePage(browser, `__Host-hero-human-session=${encodeURIComponent(ownerToken)}`);
  const url = `${base}/api/portal?surface=control&projectId=project-board`;
  await owner.skipGuide(base); await owner.goto(url);
  const card = () => owner.evaluate(`(() => { const el = document.querySelector('[data-command-card="cmd-board-1"]'); return el ? { state: el.dataset.commandState, actions: [...el.querySelectorAll('[data-command-action]')].map(button => button.dataset.commandAction) } : null; })()`);
  const click = async selector => { await owner.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); for (let attempt = 0; attempt < 40; attempt += 1) { await wait(100); const text = await owner.evaluate("document.querySelector('#command-status')?.textContent || ''"); if (text && text !== 'در حال ارسال…') return text; } return "timeout"; };
  assert.deepEqual(await card(), { state: "awaiting-approval", actions: ["approve"] });
  assert.equal(await click('[data-command-id="cmd-board-1"][data-command-action="approve"]'), "ثبت شد.");
  assert.deepEqual(await card(), { state: "approved", actions: ["queue"] }, "the board re-renders from fresh server data");
  assert.equal(await click('[data-command-id="cmd-board-1"][data-command-action="queue"]'), "ثبت شد.");
  assert.equal((await card()).state, "queued");
  assert.equal(await click('#dispatch-next'), "ثبت شد.");
  assert.deepEqual(await card(), { state: "running", actions: ["checkpoint", "complete", "fail"] });
  if (evidenceDir) await owner.screenshot(path.join(evidenceDir, "command-board-owner.png"));
  assert.equal(await click('[data-command-id="cmd-board-1"][data-command-action="complete"]'), "ثبت شد.");
  assert.equal(await card(), null, "a completed command leaves the active board");

  await api("POST", "/api/projects/project-board/commands", { commandId: "cmd-board-2", action: "run-tests", risk: "medium", correlationId: "corr-board-2", idempotencyKey: "idem-board-2" });
  await api("POST", "/api/projects/project-board/commands/cmd-board-2/authorize", { authorizationSnapshotId: "BATCH-BACKOFFICE-20261006-023" });
  const viewer = await openRolePage(browser, `__Host-hero-human-session=${encodeURIComponent(login("viewer@example.test", "User password 123", "viewer-mfa-secret-board"))}`);
  await viewer.skipGuide(base); await viewer.goto(url);
  assert.equal(await viewer.evaluate(`document.querySelector('[data-command-card="cmd-board-2"]')?.dataset.commandState ?? 'missing'`), "awaiting-approval", "viewer can see the board");
  await viewer.evaluate(`document.querySelector('[data-command-id="cmd-board-2"][data-command-action="approve"]')?.click()`);
  await wait(800);
  assert.match(await viewer.evaluate("document.querySelector('#command-status')?.textContent || ''"), /PROJECT_WRITE_REQUIRED|403|رد|مجاز|access/i, "the server rejects a viewer's write");
  assert.equal((await api("GET", "/api/projects/project-board/commands/cmd-board-2")).card.state, "awaiting-approval");
});
