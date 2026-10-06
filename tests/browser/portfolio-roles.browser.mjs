// Browser-level three-role isolation test (BO-062). Run with `pnpm test:browser`.
// It drives a real headless Chromium over the DevTools protocol with no extra
// dependencies. Set HERO_BROWSER_BIN to the Chromium binary; without one this
// suite fails loudly instead of silently passing.
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createProjectSettingsRegistry } from "../../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace } from "../../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../../packages/domain/src/project-access.mjs";

const now = () => new Date().toISOString();
const ownerActor = { subject: "hero-owner", role: "project-owner" };

function findBrowser() {
  if (process.env.HERO_BROWSER_BIN) return process.env.HERO_BROWSER_BIN;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return null;
  for (const entry of readdirSync(root).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
    const candidate = path.join(root, entry, "chrome-linux", "chrome");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function launchBrowser(binary) {
  const profile = mkdtempSync(path.join(os.tmpdir(), "hero-cdp-"));
  const child = spawn(binary, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const endpoint = await new Promise((resolve, reject) => {
    let buffer = ""; const timer = setTimeout(() => reject(new Error("Chromium did not expose DevTools")), 20000);
    child.stderr.on("data", chunk => { buffer += chunk; const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    child.on("exit", code => { clearTimeout(timer); reject(new Error(`Chromium exited early (${code})`)); });
  });
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0; const pending = new Map(); const listeners = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
    else for (const listener of listeners) listener(message);
  };
  const send = (method, params = {}, sessionId = undefined) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  return {
    send,
    on: listener => listeners.push(listener),
    async close() { try { socket.close(); } catch {} child.kill("SIGKILL"); await new Promise(resolve => setTimeout(resolve, 200)); rmSync(profile, { recursive: true, force: true }); }
  };
}

async function openRolePage(browser, cookieHeader) {
  const { browserContextId } = await browser.send("Target.createBrowserContext");
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  await browser.send("Network.enable", {}, sessionId);
  await browser.send("Network.setExtraHTTPHeaders", { headers: { Cookie: cookieHeader } }, sessionId);
  await browser.send("Page.enable", {}, sessionId);
  const evaluate = async expression => (await browser.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
  return {
    async goto(url) {
      await browser.send("Page.navigate", { url }, sessionId);
      for (let attempt = 0; attempt < 100; attempt += 1) { if (await evaluate("document.readyState") === "complete") break; await new Promise(resolve => setTimeout(resolve, 100)); }
      await new Promise(resolve => setTimeout(resolve, 400)); // let the page script hydrate role-gated controls
    },
    evaluate,
    async screenshot(file) { const { data } = await browser.send("Page.captureScreenshot", { format: "png" }, sessionId); writeFileSync(file, Buffer.from(data, "base64")); }
  };
}

test("Owner, Admin and Viewer each see only their own Portfolio and projects in a real browser", { timeout: 120000 }, async t => {
  const binary = findBrowser();
  assert.ok(binary, "No Chromium found. Set HERO_BROWSER_BIN to run the browser suite.");
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "browser-roles-session-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-browser" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(Date.now() / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now });
  const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  for (const projectId of ["project-alpha", "project-beta", "project-gamma"]) projectWorkspace.createProject({ actor: ownerActor, projectId, name: `Name ${projectId}` });
  identity.createUser({ actor: ownerActor, user: { userId: "admin-user", email: "admin@example.test", displayName: "Admin", password: "User password 123", mfaSecret: "admin-mfa-secret-browser", mfaRequired: true } });
  identity.createUser({ actor: ownerActor, user: { userId: "viewer-user", email: "viewer@example.test", displayName: "Viewer", password: "User password 123", mfaSecret: "viewer-mfa-secret-browser", mfaRequired: true } });
  access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-alpha", userId: "admin-user", role: "admin" } });
  access.upsertGrant({ actor: ownerActor, grant: { projectId: "project-beta", userId: "viewer-user", role: "viewer" } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await launchBrowser(binary); t.after(() => browser.close());
  const evidenceDir = process.env.HERO_BROWSER_EVIDENCE_DIR ?? null;

  const roles = {
    owner: { token: login("owner@example.test", "Owner password 123", "owner-mfa-secret-browser"), projects: ["project-alpha", "project-beta", "project-gamma"], role: "project-owner" },
    admin: { token: login("admin@example.test", "User password 123", "admin-mfa-secret-browser"), projects: ["project-alpha"], role: "admin" },
    viewer: { token: login("viewer@example.test", "User password 123", "viewer-mfa-secret-browser"), projects: ["project-beta"], role: "viewer" }
  };
  for (const [name, expected] of Object.entries(roles)) {
    const page = await openRolePage(browser, `__Host-hero-human-session=${encodeURIComponent(expected.token)}`);
    await page.goto(`${base}/api/portal?surface=portfolio`);
    const rendered = await page.evaluate(`(() => ({
      cards: [...document.querySelectorAll('[data-project-card]')].map(card => ({ projectId: card.querySelector('code')?.textContent, role: card.querySelector('[data-project-role]')?.dataset.projectRole })),
      kpiVisible: document.querySelector('[data-kpi="visible-projects"] strong')?.textContent,
      createVisible: (() => { const button = document.getElementById('create-project-button'); return Boolean(button && button.offsetParent !== null && getComputedStyle(button).display !== 'none'); })(),
      ownerActionsVisible: [...document.querySelectorAll('.owner-action')].filter(button => button.offsetParent !== null).length,
      text: document.body.innerText
    }))()`);
    assert.deepEqual(rendered.cards.map(card => card.projectId).sort(), expected.projects, `${name} sees exactly its projects`);
    assert.ok(rendered.cards.every(card => card.role === expected.role), `${name} cards show its own role`);
    assert.equal(rendered.kpiVisible, String(expected.projects.length), `${name} KPI counts only its projects`);
    assert.equal(rendered.createVisible, expected.role === "project-owner", `${name} create-project control visibility`);
    assert.equal(rendered.ownerActionsVisible > 0, expected.role === "project-owner", `${name} owner-only lifecycle controls visibility`);
    for (const other of ["project-alpha", "project-beta", "project-gamma"].filter(id => !expected.projects.includes(id))) assert.ok(!rendered.text.includes(other), `${name} page never mentions ${other}`);
    for (const other of ["project-alpha", "project-beta", "project-gamma"].filter(id => !expected.projects.includes(id))) {
      const status = await page.evaluate(`fetch('/api/projects/${other}/workspace-overview', { credentials: 'include' }).then(response => response.status)`);
      assert.equal(status, 403, `${name} cannot open ${other} from the browser`);
    }
    if (evidenceDir) await page.screenshot(path.join(evidenceDir, `portfolio-${name}.png`));
  }
});
