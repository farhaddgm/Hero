import assert from "node:assert/strict";
import test from "node:test";

import { validateProjectIdentityContract } from "../packages/contracts/src/project-identity.mjs";
import { createHumanIdentity, createTotpCode, HumanIdentityError } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessMiddleware } from "../packages/domain/src/project-access-middleware.mjs";
import { createProjectAccessRegistry, ProjectAccessError } from "../packages/domain/src/project-access.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";

const ownerSecret = "owner-mfa-secret-for-identity-tests";
const sessionSecret = "identity-session-test-secret-12345678901234567890";
const now = () => "2026-09-10T12:00:00.000Z";
const epoch = Math.floor(Date.parse(now()) / 1000);

function setup() {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({
    accessRegistry: access,
    sessionSecret,
    now,
    recoveryCodeFactory: () => "email-recovery-code",
    owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: ownerSecret, recoveryCodes: ["offline-recovery-code"] }
  });
  return { access, identity };
}

function ownerLogin(identity) {
  const challenge = identity.beginLogin({ email: "owner@example.test", password: "Owner password 123" });
  return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(ownerSecret, epoch) });
}

function ownerPrincipal(identity) {
  return ownerLogin(identity).principal;
}

test("fixed three-role project permission matrix is deny-by-default", () => {
  assert.deepEqual(validateProjectIdentityContract(), []);
  const { access, identity } = setup();
  const owner = ownerPrincipal(identity);
  identity.createUser({ actor: owner, user: { userId: "project-admin", email: "admin@example.test", displayName: "Admin", password: "Admin password 123", mfaSecret: "admin-mfa-secret-123", mfaRequired: true } });
  identity.createUser({ actor: owner, user: { userId: "project-viewer", email: "viewer@example.test", displayName: "Viewer", password: "Viewer password 123" } });
  access.upsertGrant({ actor: owner, grant: { projectId: "project-vpn", userId: "project-admin", role: "admin" } });
  access.upsertGrant({ actor: owner, grant: { projectId: "project-vpn", userId: "project-viewer", role: "viewer" } });
  assert.equal(access.authorize({ principal: { subject: "project-admin", role: "member" }, projectId: "project-vpn", action: "project.write" }).role, "admin");
  assert.equal(access.authorize({ principal: { subject: "project-viewer", role: "member" }, projectId: "project-vpn", action: "project.read" }).role, "viewer");
  assert.throws(() => access.authorize({ principal: { subject: "project-viewer", role: "member" }, projectId: "project-vpn", action: "project.write" }), ProjectAccessError);
  assert.throws(() => access.authorize({ principal: { subject: "project-admin", role: "member" }, projectId: "project-crm", action: "project.read" }), error => error.code === "PROJECT_ACCESS_DENIED");
  assert.throws(() => access.upsertGrant({ actor: { subject: "project-admin", role: "member" }, grant: { projectId: "project-vpn", userId: "project-viewer", role: "viewer" } }), error => error.code === "OWNER_REQUIRED");
});

test("email/password login requires MFA for owner/admin and issues a scoped principal", () => {
  const { access, identity } = setup();
  const owner = ownerPrincipal(identity);
  identity.createUser({ actor: owner, user: { userId: "project-admin", email: "admin@example.test", password: "Admin password 123", mfaSecret: "admin-mfa-secret-123", mfaRequired: true } });
  access.upsertGrant({ actor: owner, grant: { projectId: "project-vpn", userId: "project-admin", role: "admin" } });
  const challenge = identity.beginLogin({ email: "admin@example.test", password: "Admin password 123" });
  assert.throws(() => identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: "000000" }), error => error instanceof HumanIdentityError && error.code === "MFA_INVALID");
  const login = identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode("admin-mfa-secret-123", epoch) });
  assert.equal(login.principal.subject, "project-admin");
  const middleware = createProjectAccessMiddleware({ accessRegistry: access, identity });
  const scope = middleware.requireProject({ principal: login.principal, projectId: "project-vpn", action: "project.write" });
  assert.equal(scope.cacheKey, "hero:cache:project-vpn");
  assert.equal(scope.eventKey, "hero:event:project-vpn");
});

test("owner recovery revokes prior sessions and enforces a sensitive-action cooldown", () => {
  const { identity } = setup();
  const prior = ownerLogin(identity);
  identity.requestOwnerRecovery({ email: "owner@example.test" });
  const recovery = identity.completeOwnerRecovery({
    email: "owner@example.test",
    emailCode: "email-recovery-code",
    recoveryCode: "offline-recovery-code",
    newPassword: "Replacement owner password 123"
  });
  assert.equal(recovery.recovered, true);
  assert.throws(() => identity.authenticate(`Bearer ${prior.token}`), error => error.code === "IDENTITY_AUTH_REVOKED");
  const oldChallenge = identity.beginLogin({ email: "owner@example.test", password: "Replacement owner password 123" });
  const recovered = identity.completeLogin({ challengeId: oldChallenge.challengeId, mfaCode: createTotpCode(ownerSecret, epoch) }).principal;
  assert.throws(() => identity.assertSensitiveActionAllowed({ principal: recovered, action: "secret.reveal" }), error => error.code === "RECOVERY_COOLDOWN_ACTIVE");
  assert.equal(prior.principal.role, "project-owner");
});

test("HTTP middleware enforces grants, Viewer read-only access and cross-project denial", async t => {
  const { access, identity } = setup();
  const owner = ownerLogin(identity);
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const ownerHeaders = { authorization: `Bearer ${owner.token}`, "content-type": "application/json" };
  const created = await fetch(`${base}/api/identity/users`, {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({ userId: "project-viewer", email: "viewer@example.test", password: "Viewer password 123" })
  });
  assert.equal(created.status, 201);
  const grant = await fetch(`${base}/api/projects/project-vpn/access`, {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({ userId: "project-viewer", role: "viewer" })
  });
  assert.equal(grant.status, 201);
  const viewerChallenge = identity.beginLogin({ email: "viewer@example.test", password: "Viewer password 123" });
  const viewer = identity.completeLogin({ challengeId: viewerChallenge.challengeId }).token;
  const viewerHeaders = { authorization: `Bearer ${viewer}`, "content-type": "application/json" };
  assert.equal((await fetch(`${base}/api/projects/project-vpn/overview`, { headers: viewerHeaders })).status, 200);
  assert.equal((await fetch(`${base}/api/projects/project-crm/overview`, { headers: viewerHeaders })).status, 403);
  assert.equal((await fetch(`${base}/api/projects/project-vpn/access`, { method: "POST", headers: viewerHeaders, body: JSON.stringify({ userId: "project-viewer", role: "viewer" }) })).status, 403);
  assert.equal((await fetch(`${base}/api/projects/project-vpn/access`, { headers: ownerHeaders })).status, 200);
});
