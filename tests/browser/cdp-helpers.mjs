// Shared DevTools-protocol helpers for the browser suite (no extra dependencies).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function findBrowser() {
  if (process.env.HERO_BROWSER_BIN) return process.env.HERO_BROWSER_BIN;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return null;
  for (const entry of readdirSync(root).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
    const candidate = path.join(root, entry, "chrome-linux", "chrome");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function launchBrowser(binary) {
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

export async function openRolePage(browser, cookieHeader) {
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
    /** A fresh profile auto-starts the first-run Guide, which navigates away; mark it stopped first. */
    async skipGuide(base) {
      await this.goto(`${base}/health`);
      await evaluate(`localStorage.setItem("hero.project-walkthrough.state.v1", JSON.stringify({ version: 1, active: false, status: "stopped", stepId: "project-selection", updatedAt: Date.now() }))`);
    },
    async screenshot(file) { const { data } = await browser.send("Page.captureScreenshot", { format: "png" }, sessionId); writeFileSync(file, Buffer.from(data, "base64")); }
  };
}
