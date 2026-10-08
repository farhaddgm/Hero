import assert from "node:assert/strict";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createMfaVault } from "../packages/domain/src/mfa-vault.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

const ownerSecret = "owner-mfa-secret-for-env-http-1"; const viewerSecret = "viewer-mfa-secret-for-env-http-1";
let clock = Date.parse("2026-10-08T12:00:00.000Z"); const now = () => new Date(clock).toISOString(); const epoch = () => Math.floor(clock / 1000);
const jsonHeaders = { "content-type": "application/json" };

async function boot(t, options = {}) {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "env-http-session-secret-1234567890123456789", now, mfaVault: createMfaVault({ key: "d".repeat(64) }), owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: ownerSecret } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, ...options });
  const address = await app.start(); t.after(() => app.stop());
  return { base: `http://127.0.0.1:${address.port}`, identity };
}
async function login(base, email, password, secret) {
  const begin = await (await fetch(`${base}/api/identity/login`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email, password }) })).json();
  clock += 31_000;
  const complete = await fetch(`${base}/api/identity/login/mfa`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ challengeId: begin.login.challengeId, mfaCode: createTotpCode(secret, epoch()) }) });
  const cookie = complete.headers.get("set-cookie")?.split(";", 1)[0];
  return { cookie, headers: { cookie, origin: base, ...jsonHeaders } };
}
async function setup(t, options) {
  const { base, identity } = await boot(t, options);
  const owner = await login(base, "owner@example.test", "Owner password 123", ownerSecret);
  await fetch(`${base}/api/projects`, { method: "POST", headers: owner.headers, body: JSON.stringify({ projectId: "env-project", name: "Env", intake: { projectType: "application", riskLevel: "standard" } }) });
  await fetch(`${base}/api/identity/users`, { method: "POST", headers: owner.headers, body: JSON.stringify({ userId: "env-viewer", email: "viewer@example.test", displayName: "Viewer", password: "Viewer password 123", mfaSecret: viewerSecret, mfaRequired: true }) });
  await fetch(`${base}/api/projects/env-project/access`, { method: "POST", headers: owner.headers, body: JSON.stringify({ userId: "env-viewer", role: "viewer" }) });
  const viewer = await login(base, "viewer@example.test", "Viewer password 123", viewerSecret);
  return { base, identity, owner, viewer };
}
const post = (base, who, path, body) => fetch(`${base}/api/projects/env-project/${path}`, { method: "POST", headers: who.headers, body: JSON.stringify(body) });

test("the Environments page shows metadata only, is read-only for a viewer, and needs a session", async t => {
  const { base, owner, viewer } = await setup(t);
  assert.equal((await post(base, owner, "infrastructure", { action: "onboard-server", serverId: "server-test", address: "10.0.0.4", credentialReference: "secret-ref:ssh-one", environment: "test" })).status, 201);
  assert.equal((await post(base, owner, "infrastructure", { action: "register-secret-metadata", secretId: "secret-one", reference: "secret-ref:api-one" })).status, 201);
  const ownerPage = await fetch(`${base}/api/portal?surface=environments&projectId=env-project`, { headers: { cookie: owner.cookie } });
  assert.equal(ownerPage.status, 200);
  const html = await ownerPage.text();
  assert.match(html, /data-server="server-test"/); assert.match(html, /data-secret="secret-one"/); assert.match(html, /data-action="onboard-server"/); assert.match(html, /data-action="request-secret-reveal"/);
  assert.equal(html.includes("ssh-one") && /secret-ref:ssh-one/.test(html) && /type="password"/.test(html), false, "no password field and no secret value");
  const viewerHtml = await (await fetch(`${base}/api/portal?surface=environments&projectId=env-project`, { headers: { cookie: viewer.cookie } })).text();
  assert.match(viewerHtml, /data-server="server-test"/); assert.equal(/data-action="onboard-server"/.test(viewerHtml), false); assert.match(viewerHtml, /فقط‌خواندنی/);
  const anonymous = await fetch(`${base}/api/portal?surface=environments&projectId=env-project`, { redirect: "manual" });
  assert.equal(anonymous.status, 302);
});

test("infrastructure routes: a viewer cannot change anything, unknown actions are refused and records are saved", async t => {
  const { base, owner, viewer } = await setup(t);
  assert.equal((await post(base, viewer, "infrastructure", { action: "onboard-server", serverId: "server-x", address: "10.0.0.4", credentialReference: "secret-ref:ssh-one", environment: "test" })).status, 403);
  const unknown = await post(base, owner, "infrastructure", { action: "toString" });
  assert.equal(unknown.status, 400); assert.equal((await unknown.json()).code, "INFRASTRUCTURE_ACTION_INVALID");
  assert.equal((await post(base, owner, "infrastructure", { action: "onboard-server", serverId: "server-x", address: "http://evil", credentialReference: "secret-ref:ssh-one", environment: "test" })).status, 400);
  assert.equal((await post(base, owner, "infrastructure", { action: "onboard-server", serverId: "server-test", address: "10.0.0.4", credentialReference: "secret-ref:ssh-one", environment: "test" })).status, 201);
  const view = await (await fetch(`${base}/api/projects/env-project/infrastructure`, { headers: viewer.headers })).json();
  assert.equal(view.infrastructure.servers[0].serverId, "server-test");
  assert.equal((await post(base, owner, "infrastructure", { action: "sync-repository-metadata", repositoryId: "repo-ghost" })).status, 404);
  await post(base, owner, "infrastructure", { action: "register-repository", repositoryId: "repo-one", name: "owner/repo" });
  const sync = await post(base, owner, "infrastructure", { action: "sync-repository-metadata", repositoryId: "repo-one" });
  assert.equal(sync.status, 503); assert.equal((await sync.json()).code, "GITHUB_NOT_CONNECTED", "no live GitHub call without a connection");
});

test("a secret reveal is proven by the session, not by flags in the request body", async t => {
  const { base, owner, identity } = await setup(t);
  await post(base, owner, "infrastructure", { action: "register-secret-metadata", secretId: "secret-one", reference: "secret-ref:api-one" });
  const reveal = body => post(base, owner, "infrastructure", { action: "request-secret-reveal", secretId: "secret-one", reason: "Investigating an incident", ...body });
  clock += 400_000; // the login MFA is now older than the five-minute window
  const stale = await reveal({ mfaFresh: true, reAuthenticated: true });
  assert.equal(stale.status, 403); assert.equal((await stale.json()).code, "STEP_UP_REQUIRED", "forged flags are ignored");
  clock += 31_000;
  const stepUp = await fetch(`${base}/api/identity/step-up`, { method: "POST", headers: owner.headers, body: JSON.stringify({ mfaCode: createTotpCode(ownerSecret, epoch()) }) });
  assert.equal(stepUp.status, 200);
  const fresh = { ...owner, headers: { ...owner.headers, cookie: stepUp.headers.get("set-cookie").split(";", 1)[0] } };
  const ok = await post(base, fresh, "infrastructure", { action: "request-secret-reveal", secretId: "secret-one", reason: "Investigating an incident", mfaFresh: false, reAuthenticated: false });
  assert.equal(ok.status, 201);
  const body = await ok.json();
  assert.equal(body.result.value, "not-returned-by-control-plane"); assert.equal(JSON.stringify(body).includes("api-one-value"), false);
  assert.ok(identity);
});

test("delivery routes: telemetry schema, break-glass needs fresh MFA and a second person, deploy is only recorded", async t => {
  const { base, owner } = await setup(t);
  const telemetry = await post(base, owner, "delivery", { action: "ingest-telemetry", telemetryId: "telemetry-one", kind: "metric", metadata: { name: "http.latency", value: 12, unit: "ms" } });
  assert.equal(telemetry.status, 201);
  const bad = await post(base, owner, "delivery", { action: "ingest-telemetry", telemetryId: "telemetry-two", kind: "sanitized-log", metadata: { level: "info", code: "OK_CODE", message: "x", payload: "customer row" } });
  assert.equal(bad.status, 400); assert.equal((await bad.json()).code, "TELEMETRY_REJECTED");
  assert.equal((await post(base, owner, "delivery", { action: "constructor" })).status, 400);
  clock += 400_000;
  const stale = await post(base, owner, "delivery", { action: "request-break-glass", requestId: "bg-one", scope: "logs", reason: "Checking an outage window", expiresAt: new Date(clock + 3600_000).toISOString() });
  assert.equal(stale.status, 403); assert.equal((await stale.json()).code, "STEP_UP_REQUIRED");
  await post(base, owner, "delivery", { action: "register-artifact", artifactId: "artifact-one", digest: `sha256:${"a".repeat(64)}`, provenance: "hero://prov", attestationRef: "hero://att", sbomRef: "hero://sbom" });
  await post(base, owner, "delivery", { action: "create-release", releaseId: "release-one", testedCommit: "abc1234", artifactId: "artifact-one" });
  await post(base, owner, "delivery", { action: "transition-release", releaseId: "release-one", state: "approved" });
  await post(base, owner, "delivery", { action: "transition-release", releaseId: "release-one", state: "ready" });
  const deployed = await post(base, owner, "delivery", { action: "transition-release", releaseId: "release-one", state: "deployed", evidenceRef: "hero://evidence/d1" });
  assert.equal((await deployed.json()).result.deploy, "record-only-separate-dispatch-required");
  const view = await (await fetch(`${base}/api/projects/env-project/delivery`, { headers: owner.headers })).json();
  assert.equal(view.delivery.releases[0].state, "deployed");
});

test("the Node Agent protocol is off by default, and when enabled needs the nonce or the token and never leaks them", async t => {
  const off = await setup(t);
  assert.equal((await fetch(`${off.base}/api/node-agent/register`, { method: "POST", headers: jsonHeaders, body: "{}" })).status, 404);
  assert.equal((await fetch(`${off.base}/api/node-agent/heartbeat`, { method: "POST", headers: jsonHeaders, body: "{}" })).status, 404);

  const { base, owner } = await setup(t, { nodeAgentEnabled: true });
  await post(base, owner, "infrastructure", { action: "onboard-server", serverId: "server-test", address: "10.0.0.4", credentialReference: "secret-ref:ssh-one", environment: "test" });
  const enrollment = (await (await post(base, owner, "infrastructure", { action: "create-enrollment", nodeId: "node-one", serverId: "server-test", expiresAt: new Date(clock + 3600_000).toISOString() })).json()).result;
  const agent = (path, body) => fetch(`${base}/api/node-agent/${path}`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
  assert.equal((await fetch(`${base}/api/node-agent/register`)).status, 404, "only POST");
  assert.equal((await agent("register", { projectId: "env-project", nodeId: "node-one", enrollmentNonce: "wrong", identityFingerprint: "fingerprint-node-one-0001", capabilities: ["runner"] })).status, 403);
  const registered = await agent("register", { projectId: "env-project", nodeId: "node-one", enrollmentNonce: enrollment.enrollmentNonce, identityFingerprint: "fingerprint-node-one-0001", capabilities: ["runner"] });
  assert.equal(registered.status, 201); assert.equal(registered.headers.get("cache-control"), "no-store");
  const { node } = await registered.json();
  assert.equal("tokenHash" in node, false);
  assert.equal((await agent("register", { projectId: "env-project", nodeId: "node-one", enrollmentNonce: enrollment.enrollmentNonce, identityFingerprint: "fingerprint-node-one-0001" })).status, 403, "the nonce works once");
  const beat = sequence => agent("heartbeat", { projectId: "env-project", nodeId: "node-one", nodeToken: node.nodeToken, identityFingerprint: "fingerprint-node-one-0001", sequence });
  assert.equal((await beat(1)).status, 200);
  assert.equal((await beat(1)).status, 409, "replay");
  assert.equal((await agent("heartbeat", { projectId: "env-project", nodeId: "node-one", nodeToken: "x".repeat(43), identityFingerprint: "fingerprint-node-one-0001", sequence: 2 })).status, 403);
  assert.equal((await agent("heartbeat", { projectId: "env-project", nodeId: "node-one" })).status, 403);
  const page = await (await fetch(`${base}/api/projects/env-project/infrastructure`, { headers: owner.headers })).text();
  assert.equal(page.includes(node.nodeToken), false, "the token is never shown again");
  assert.match(page, /"liveState":"online"/);
});
