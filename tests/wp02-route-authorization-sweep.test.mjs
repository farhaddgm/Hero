import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createMfaVault } from "../packages/domain/src/mfa-vault.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

/**
 * BO-021/BO-042: the route table is read from the Control Plane source, so a route added
 * later is swept automatically. Every /api route must refuse a caller without a session
 * and a signed-in Viewer must never get a success from a state-changing request.
 */
const source = fs.readFileSync(new URL("../apps/control-plane/src/server.mjs", import.meta.url), "utf8");
const PUBLIC = new Set(["/api/identity/status", "/api/identity/login", "/api/identity/login/mfa", "/api/identity/recovery/request", "/api/identity/recovery/complete", "/api/ui-assets/vazirmatn.woff2"]);
const SAMPLE = "sample-id";
// Self-service: a signed-in user may end their own sessions. They are covered by the identity HTTP tests
// and left out of the Viewer loop, because a successful call would revoke the Viewer token used for the rest of the sweep.
const SELF_SERVICE = new Set(["/api/identity/sessions/revoke", "/api/identity/sessions/revoke-all"]);

function sampleFromRegex(body) {
  let out = ""; let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === "\\") { out += body[i + 1] === "/" ? "/" : body[i + 1] === "." ? "." : body[i + 1] === "d" ? "1" : ""; i += 2; continue; }
    if (ch === "(") {
      let depth = 1; let j = i + 1;
      while (j < body.length && depth > 0) { if (body[j] === "\\") j += 2; else { if (body[j] === "(") depth += 1; if (body[j] === ")") depth -= 1; j += 1; } }
      const inner = body.slice(i + 1, j - 1).replace(/^\?:/, "");
      out += /[[\]{}+*]/.test(inner) ? SAMPLE : inner.split("|")[0].replace(/\\\//g, "/");
      i = j; if (body[i] === "?") i += 1; continue;
    }
    if (ch === "?" || ch === "^" || ch === "$") { i += 1; continue; }
    out += ch; i += 1;
  }
  return out;
}

function discoverRoutes() {
  const routes = new Set();
  for (const match of source.matchAll(/pathname === "(\/api\/[^"]*)"/g)) routes.add(match[1]);
  const unmatched = [];
  for (const match of source.matchAll(/\.match\(\/(\^\\\/api\\\/[^\n]*?\$)\/\)/g)) {
    const pattern = match[1]; const path = sampleFromRegex(pattern.slice(1, -1));
    let ok = false; try { ok = new RegExp(pattern).test(path); } catch { ok = false; }
    if (ok) routes.add(path); else unmatched.push(pattern);
  }
  return { routes: [...routes].filter(path => !path.includes("*")).sort(), unmatched };
}

const secretFor = { owner: "owner-mfa-secret-for-sweep-123", viewer: "viewer-mfa-secret-for-sweep-123" };
let clock = Date.parse("2026-10-08T12:00:00.000Z");
const now = () => new Date(clock).toISOString();

test("every discovered /api route refuses anonymous callers and Viewers cannot change state", async t => {
  const { routes, unmatched } = discoverRoutes();
  assert.equal(routes.length >= 100, true, `the sweep must cover the route table (found ${routes.length})`);
  assert.equal(unmatched.length <= Math.ceil(routes.length * 0.1), true, `too many patterns could not be sampled: ${unmatched.slice(0, 3).join(" | ")}`);

  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "sweep-session-secret-1234567890123456789012", now, mfaVault: createMfaVault({ key: "c".repeat(64) }), owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: secretFor.owner } });
  const ownerAuth = createOwnerAuth({ secret: "sweep-owner-auth-secret-12345678901234567890" });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth, projectAccessRegistry: access, humanIdentity: identity });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;

  const owner = identity.completeLogin({ challengeId: identity.beginLogin({ email: "owner@example.test", password: "Owner password 123" }).challengeId, mfaCode: createTotpCode(secretFor.owner, Math.floor(clock / 1000)) });
  identity.createUser({ actor: owner.principal, user: { userId: "sweep-viewer", email: "viewer@example.test", displayName: "Viewer", password: "Viewer password 123", mfaSecret: secretFor.viewer, mfaRequired: true } });
  clock += 31_000;
  const viewer = identity.completeLogin({ challengeId: identity.beginLogin({ email: "viewer@example.test", password: "Viewer password 123" }).challengeId, mfaCode: createTotpCode(secretFor.viewer, Math.floor(clock / 1000)) });

  const anonymousFailures = []; const viewerFailures = []; const serverErrors = [];
  const originalError = console.error; console.error = () => {};
  t.after(() => { console.error = originalError; });
  let swept = 0;
  for (const path of routes) {
    if (PUBLIC.has(path)) continue;
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      const anonymous = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : "{}", redirect: "manual" });
      swept += 1;
      if (anonymous.status >= 200 && anonymous.status < 300) anonymousFailures.push(`${method} ${path} -> ${anonymous.status}`);
      if (anonymous.status >= 500 && anonymous.status !== 503) serverErrors.push(`anon ${method} ${path} -> ${anonymous.status}`);
      await anonymous.arrayBuffer();
      if (method !== "GET" && !SELF_SERVICE.has(path)) {
        const asViewer = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${viewer.token}`, origin: base, "content-type": "application/json" }, body: "{}", redirect: "manual" });
        if (asViewer.status >= 200 && asViewer.status < 400) viewerFailures.push(`${method} ${path} -> ${asViewer.status}`);
        if (asViewer.status >= 500 && asViewer.status !== 503) serverErrors.push(`viewer ${method} ${path} -> ${asViewer.status}`);
        await asViewer.arrayBuffer();
      }
    }
  }
  console.error = originalError;
  assert.deepEqual(anonymousFailures, [], "anonymous callers must never succeed");
  assert.deepEqual(viewerFailures, [], "a Viewer must never change state");
  assert.deepEqual(serverErrors, [], "no route may answer with an unexpected server error");
  assert.equal(swept >= 500, true);
});
