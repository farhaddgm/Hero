import assert from "node:assert/strict";
import test from "node:test";

import { validateProjectIdentityContract } from "../packages/contracts/src/project-identity.mjs";
import { createHumanIdentity, createTotpCode, HumanIdentityError, HUMAN_IDENTITY_SESSION_TTL_SECONDS } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessMiddleware } from "../packages/domain/src/project-access-middleware.mjs";
import { createProjectAccessRegistry, ProjectAccessError } from "../packages/domain/src/project-access.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";

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

test("RFC 6238 Base32 TOTP matches the published SHA-1 vector while legacy UTF-8 generation stays stable", () => {
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(createTotpCode(`base32:${rfcSecret}`, 59), "287082");
  const legacySecret = "JBSWY3DPEHPK3PXP";
  assert.equal(createTotpCode(legacySecret, epoch), createTotpCode(`legacy-utf8:${legacySecret}`, epoch));
  assert.throws(() => createTotpCode("base32:not-valid!", epoch), error => error.code === "MFA_SECRET_INVALID");
});

test("unprefixed legacy-compatible secrets also verify a standard Base32 authenticator code", () => {
  const base32Secret = "JBSWY3DPEHPK3PXP";
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({
    accessRegistry: access,
    sessionSecret,
    now,
    owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: base32Secret }
  });
  const challenge = identity.beginLogin({ email: "owner@example.test", password: "Owner password 123" });
  const login = identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(`base32:${base32Secret}`, epoch) });
  assert.equal(login.principal.role, "project-owner");
});

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
  assert.equal(login.principal.expiresAt, epoch + HUMAN_IDENTITY_SESSION_TTL_SECONDS);
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

test("identity hydration restores persisted users without persisting MFA secrets", () => {
  const first = setup();
  const owner = ownerPrincipal(first.identity);
  first.identity.createUser({ actor: owner, user: {
    userId: "project-admin",
    email: "admin@example.test",
    displayName: "Admin",
    password: "Admin password 123",
    mfaSecret: "admin-mfa-secret-123",
    mfaSecretRef: "env:HERO_ADMIN_MFA_SECRET",
    mfaRequired: true
  } });
  const persisted = first.identity.persistenceRecord({ userId: "project-admin" });
  assert.equal("mfaSecret" in persisted, false);

  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({
    accessRegistry: access,
    sessionSecret,
    now,
    owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: ownerSecret }
  });
  access.hydrateUser({ user: { userId: persisted.userId, email: persisted.email, displayName: persisted.displayName, role: "viewer" } });
  identity.hydrateUser({ user: persisted });
  const challenge = identity.beginLogin({ email: "admin@example.test", password: "Admin password 123" });
  assert.equal(challenge.mfaRequired, true);
  assert.throws(() => identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: "000000" }), error => error.code === "MFA_INVALID");
});

test("identity page is network-protected and exposes the real identity workflow", async t => {
  const { access, identity } = setup();
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, backofficeAuth: { username: "backoffice", password: "backoffice-password-123456" } });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/identity`)).status, 401);
  const credentials = Buffer.from("backoffice:backoffice-password-123456").toString("base64");
  const page = await fetch(`${base}/identity`, { headers: { authorization: `Basic ${credentials}` } });
  const body = await page.text();
  assert.equal(page.status, 200);
  assert.match(body, /\/api\/identity\/login/);
  assert.match(body, /\/api\/identity\/status/);
  assert.match(body, /\/api\/identity\/users/);
  assert.doesNotMatch(body, /sessionStorage\.(?:setItem|getItem)\([^)]*(?:identity|session|token|password|mfa)/i);
  assert.match(body, /credentials: "same-origin"/);
  assert.match(body, /نشست امن شش‌ساعته/);
  assert.match(body, /identity-configuration-status/);
  assert.match(body, /این دو رمز مستقل‌اند/);
  const status = await fetch(`${base}/api/identity/status`);
  assert.equal(status.status, 200);
  assert.deepEqual((await status.json()).identity, {
    configured: true,
    humanLoginAvailable: true,
    networkBoundary: "human-session-portal-with-legacy-basic",
    ownerMfaRequired: true,
    totp: "rfc6238-base32-with-legacy-verification",
    persistence: "not-connected",
    recoveryDelivery: "not-configured",
    sessionTtlSeconds: 21_600
  });
});

test("AI Connections keeps the legacy Portfolio route while the browser portal is the canonical human-session path", async t => {
  const { access, identity } = setup();
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, backofficeAuth: { username: "backoffice", password: "backoffice-password-123456" } });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const authorization = `Basic ${Buffer.from("backoffice:backoffice-password-123456").toString("base64")}`;

  const canonical = await fetch(`${base}/portfolio?surface=ai`, { headers: { authorization } });
  assert.equal(canonical.status, 200);
  assert.match(await canonical.text(), /Providerها و سلامت اتصال/);

  const legacy = await fetch(`${base}/backoffice?surface=ai`, { headers: { authorization }, redirect: "manual" });
  assert.equal(legacy.status, 302);
  assert.equal(legacy.headers.get("location"), "/portfolio?surface=ai");
});

test("the browser portal keeps an active Human session inside AI Connections and rejects Basic Auth as a portal principal", async t => {
  const { access, identity } = setup();
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, backofficeAuth: { username: "backoffice", password: "backoffice-password-123456" } });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const unauthenticated = await fetch(`${base}/api/portal?surface=ai`, { redirect: "manual" });
  assert.equal(unauthenticated.status, 302);
  assert.match(unauthenticated.headers.get("location"), /^\/api\/portal\?surface=identity&returnTo=/);
  const identityPage = await fetch(`${base}/api/portal?surface=identity`);
  assert.equal(identityPage.status, 200);
  assert.match(await identityPage.text(), /ورود انسانی/);

  const login = await fetch(`${base}/api/identity/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "owner@example.test", password: "Owner password 123" }) });
  const challengeId = (await login.json()).login.challengeId;
  const complete = await fetch(`${base}/api/identity/login/mfa`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId, mfaCode: createTotpCode(ownerSecret, epoch) }) });
  const cookie = complete.headers.get("set-cookie").split(";", 1)[0];
  const ai = await fetch(`${base}/api/portal?surface=ai`, { headers: { cookie } });
  assert.equal(ai.status, 200);
  assert.match(await ai.text(), /Providerها و سلامت اتصال/);
  const aiRefresh = await fetch(`${base}/api/portal-data?surface=ai`, { headers: { cookie } });
  assert.equal(aiRefresh.status, 200);
  assert.equal((await aiRefresh.json()).service, "hero-control-plane");
  assert.equal((await fetch(`${base}/api/portal-data?surface=ai`)).status, 401);
  const basic = Buffer.from("backoffice:backoffice-password-123456").toString("base64");
  const basicOnly = await fetch(`${base}/api/portal?surface=ai`, { headers: { authorization: `Basic ${basic}` }, redirect: "manual" });
  assert.equal(basicOnly.status, 302, "Basic Auth alone must never bypass the Human session portal");
});

test("Human Identity issues a six-hour HttpOnly browser session that survives refreshes and tabs", async t => {
  const { access, identity } = setup();
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const login = await fetch(`${base}/api/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner@example.test", password: "Owner password 123" })
  });
  assert.equal(login.status, 200);
  const challengeId = (await login.json()).login.challengeId;
  const complete = await fetch(`${base}/api/identity/login/mfa`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeId, mfaCode: createTotpCode(ownerSecret, epoch) })
  });
  assert.equal(complete.status, 200);
  const setCookie = complete.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, /__Host-hero-human-session=/);
  assert.match(setCookie, /Max-Age=21600/);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(";", 1)[0];

  const refresh = await fetch(`${base}/api/identity/me`, { headers: { cookie } });
  assert.equal(refresh.status, 200);
  assert.equal((await refresh.json()).principal.role, "project-owner");
  const otherTab = await fetch(`${base}/api/identity/me`, { headers: { cookie, authorization: "Basic outer-network-gate" } });
  assert.equal(otherTab.status, 200);

  const advice = await fetch(`${base}/api/walkthrough/advice?projectId=project-vpn`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ stepId: "intake", projectId: "project-vpn", question: "برای هدف چه پیشنهادی داری؟" })
  });
  assert.equal(advice.status, 200);
  const advisor = (await advice.json()).advisor;
  assert.equal(advisor.mode, "local-contextual-guidance");
  assert.equal(advisor.providerInvoked, false);
  assert.equal(advisor.stepId, "intake");
  assert.equal(advisor.proposedFields.some(field => field.name === "goal"), true);
  assert.equal(JSON.stringify(advisor).includes("برای هدف چه پیشنهادی داری؟"), false, "questions must not be persisted or echoed");

  const smartTesterQuery = new URLSearchParams({ surface: "/workspace", featureKey: "workspace.intake", projectId: "project-vpn", boxId: "intake-card", boxTitle: "تعریف اولیهٔ پروژه", boxDescription: "این باکس مسئله، هدف و شیوهٔ تأیید پروژه را برای شروع جریان Hero ثبت می‌کند." }).toString();
  const smartTesterContext = await fetch(`${base}/api/smart-tester/context?${smartTesterQuery}`, { headers: { cookie } });
  assert.equal(smartTesterContext.status, 200);
  assert.equal((await smartTesterContext.json()).smartTester.context.featureKey, "workspace.intake");
  const smartTesterRun = await fetch(`${base}/api/smart-tester/run?${smartTesterQuery}`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ surface: "/workspace", featureKey: "workspace.intake", boxId: "intake-card", projectId: "project-vpn" })
  });
  assert.equal(smartTesterRun.status, 200);
  const smartTester = (await smartTesterRun.json()).smartTester;
  assert.match(smartTester.reportId, /^[0-9a-f-]{36}$/i);
  assert.equal(smartTester.report.context.projectId, "project-vpn");
  assert.equal(smartTester.report.context.boxTitle, "تعریف اولیهٔ پروژه");
  assert.equal(smartTester.report.checks.some(check => check.id === "browser.e2e" && check.status === "not-run"), true);
  const smartTesterAdvice = await fetch(`${base}/api/smart-tester/advice?${smartTesterQuery}`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ surface: "/workspace", featureKey: "workspace.intake", boxId: "intake-card", projectId: "project-vpn", reportId: smartTester.reportId, question: "اول کدام دسته از گزارش را بررسی کنم؟" })
  });
  assert.equal(smartTesterAdvice.status, 200);
  const smartTesterAdvisor = (await smartTesterAdvice.json()).smartTester.advisor;
  assert.equal(smartTesterAdvisor.providerInvoked, false);
  assert.doesNotMatch(smartTesterAdvisor.response, /اول کدام/);
  assert.match(smartTesterAdvisor.response, /تعریف اولیهٔ پروژه/);
  const smartTesterOptions = await fetch(`${base}/api/smart-tester/options?projectId=project-vpn`, { headers: { cookie } });
  assert.equal(smartTesterOptions.status, 200);
  assert.equal((await smartTesterOptions.json()).smartTester.options.localAdvisor.id, "local");
  const formSuggestionOptions = await fetch(`${base}/api/form-suggestions/options`, { headers: { cookie } });
  assert.equal(formSuggestionOptions.status, 200);
  assert.equal((await formSuggestionOptions.json()).formSuggestions.localAdvisor.id, "local");
  const formAdvisorOptions = await fetch(`${base}/api/advisor/options`, { headers: { cookie } });
  assert.equal(formAdvisorOptions.status, 200);
  assert.equal((await formAdvisorOptions.json()).advisor.localAdvisor.id, "local");
  const formSuggestion = await fetch(`${base}/api/advisor`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({
      projectId: null,
      formId: "safe-form",
      formTitle: "فرم نمونه",
      softwareGoal: "ساخت یک محصول آزمایشی قابل انتقال",
      boxDescription: "ثبت هدف کوتاه فرم",
      selectedAdvisor: "local",
      fields: [{ name: "goal", type: "textarea", label: "هدف" }, { name: "riskLevel", type: "select", label: "ریسک", options: [{ value: "low", label: "کم" }, { value: "medium", label: "متوسط" }] }]
    })
  });
  assert.equal(formSuggestion.status, 200);
  const localAdvisorPayload = await formSuggestion.json();
  const formSuggestionPayload = localAdvisorPayload.advisor;
  assert.deepEqual(localAdvisorPayload.advisor, localAdvisorPayload.formSuggestions, "canonical and legacy response keys stay compatible");
  assert.equal(formSuggestionPayload.providerInvoked, false);
  assert.equal(formSuggestionPayload.externalSpend, "none");
  assert.equal(formSuggestionPayload.suggestions.length, 3);
  const smartTesterDiagnosis = await fetch(`${base}/api/smart-tester/diagnose?${smartTesterQuery}`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ surface: "/workspace", featureKey: "workspace.intake", boxId: "intake-card", projectId: "project-vpn", reportId: smartTester.reportId, chatInformed: true, actionFailure: { label: "ثبت Intake", method: "POST", path: "/api/projects/project-vpn/intake", status: 409, code: "VERSION_CONFLICT", message: "نسخهٔ فرم با نسخهٔ جاری هماهنگ نیست." } })
  });
  assert.equal(smartTesterDiagnosis.status, 200);
  const diagnosis = (await smartTesterDiagnosis.json()).smartTester;
  assert.match(diagnosis.errorReportId, /^[0-9a-f-]{36}$/i);
  assert.equal(diagnosis.errorReport.diagnosis.classification, "state-or-version-conflict");
  assert.match(diagnosis.errorReport.diagnosis.proposedFix, /تازه‌سازی/);
  const smartTesterSubmit = await fetch(`${base}/api/smart-tester/errors/submit?${smartTesterQuery}`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ surface: "/workspace", featureKey: "workspace.intake", boxId: "intake-card", projectId: "project-vpn", errorReportId: diagnosis.errorReportId })
  });
  assert.equal(smartTesterSubmit.status, 201);
  const smartTesterDocument = (await smartTesterSubmit.json()).smartTester.document;
  assert.match(smartTesterDocument.documentId, /^smart-tester-errors:project-vpn$/);
  assert.equal(smartTesterDocument.entryCount > 0, true);
  const smartTesterNotebook = await fetch(`${base}/api/smart-tester/errors/document?projectId=project-vpn`, { headers: { cookie } });
  assert.equal(smartTesterNotebook.status, 200);
  const persistedNotebook = (await smartTesterNotebook.json()).smartTester.document;
  assert.equal(persistedNotebook.entries.at(-1).diagnosis.classification, "state-or-version-conflict");
  assert.equal((await fetch(`${base}/api/smart-tester/run?${smartTesterQuery}`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ surface: "/workspace", featureKey: "workspace.intake", projectId: "project-crm" })
  })).status, 400, "the body must not switch the authorised project scope");

  const advisorOptions = await fetch(`${base}/api/projects/project-vpn/walkthrough-advisor/options`, { headers: { cookie } });
  assert.equal(advisorOptions.status, 200);
  const options = (await advisorOptions.json()).advisorOptions;
  assert.equal(options.projectId, "project-vpn");
  assert.equal(options.localAdvisor.id, "local");
  assert.deepEqual(options.profiles, []);
  assert.equal(JSON.stringify(options).includes("credentialRef"), false);

  const providerFromHumanSession = await fetch(`${base}/api/ai/providers`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ providerId: "deterministic", mode: "deterministic", displayName: "Local test provider", capabilities: [], idempotencyKey: "human-owner-provider-001" })
  });
  assert.equal(providerFromHumanSession.status, 201, "the Owner browser session may register safe global AI metadata");

  const liveInvocationFromHumanSession = await fetch(`${base}/api/ai/invocations`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ invocationId: "human-owner-live-invocation", providerId: "deterministic", modelId: "local", profileId: "local", projectId: "project-vpn", taskId: "test", stepId: "test", idempotencyKey: "human-owner-live-invocation-001" })
  });
  assert.equal(liveInvocationFromHumanSession.status, 403, "a browser session must not gain an unscoped live invocation path");

  const invalidAdvice = await fetch(`${base}/api/walkthrough/advice?projectId=project-vpn`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ stepId: "not-a-step", projectId: "project-vpn" })
  });
  assert.equal(invalidAdvice.status, 400);
  assert.equal((await invalidAdvice.json()).code, "WALKTHROUGH_ADVICE_INVALID");

  const missingOrigin = await fetch(`${base}/api/identity/sessions/revoke`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ reason: "test-missing-origin" })
  });
  assert.equal(missingOrigin.status, 403);
  assert.equal((await missingOrigin.json()).code, "IDENTITY_CSRF_ORIGIN_REQUIRED");

  const revoke = await fetch(`${base}/api/identity/sessions/revoke`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ reason: "test-browser-logout" })
  });
  assert.equal(revoke.status, 200);
  assert.match(revoke.headers.get("set-cookie"), /__Host-hero-human-session=; Max-Age=0/);
  assert.equal((await fetch(`${base}/api/identity/me`, { headers: { cookie } })).status, 401);
});

test("identity status is safely readable and login fails explicitly when human identity is not configured", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0, humanIdentity: { configured: false }, backofficeAuth: { username: "backoffice", password: "backoffice-password-123456" } });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const status = await fetch(`${base}/api/identity/status`);
  assert.equal(status.status, 200);
  const payload = await status.json();
  assert.equal(payload.identity.configured, false);
  assert.equal(payload.identity.humanLoginAvailable, false);
  assert.equal("email" in payload.identity, false);
  const login = await fetch(`${base}/api/identity/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "owner@example.test", password: "Owner password 123" }) });
  assert.equal(login.status, 503);
  assert.equal((await login.json()).code, "IDENTITY_NOT_CONFIGURED");
});

test("Walk-Through lists active global advisor Profiles and preserves the project dispatch boundary", async t => {
  const { access, identity } = setup();
  const owner = ownerLogin(identity);
  const dashboard = createControlDashboard({ now });
  const actor = { kind: "project-owner", id: "hero-owner" };
  dashboard.registerAiProvider({ providerId: "deterministic", mode: "deterministic", displayName: "Local Advisor", capabilities: [], idempotencyKey: "advisor-provider-001", actor });
  dashboard.registerAiModel({ providerId: "deterministic", modelId: "local-advisor-v1", displayName: "Local Advisor v1", metadata: {}, idempotencyKey: "advisor-model-001", actor });
  dashboard.registerAiProfile({ profileId: "walkthrough-analyst-v1", role: "analyst", providerId: "deterministic", modelId: "local-advisor-v1", credentialRef: "runtime:local-advisor", promptVersion: "walkthrough-prompt-v1", contextPolicy: "project-approved-context", toolPolicy: "read-only", outputSchema: "analysis-v1", status: "active", timeoutMs: 1000, maxRetries: 0, maxOutputTokens: 128, maxCostUnits: 0, costLatencyPriority: "balanced", idempotencyKey: "advisor-profile-001", actor });
  dashboard.bindAiRole({ bindingId: "walkthrough-analyst-binding-v1", projectId: "project-vpn", teamId: null, skillId: null, role: "analyst", profileId: "walkthrough-analyst-v1", supersedesBindingId: null, idempotencyKey: "advisor-binding-001", actor });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, dashboard, projectAccessRegistry: access, humanIdentity: identity });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${owner.token}`, "content-type": "application/json" };
  const options = await fetch(`${base}/api/projects/project-vpn/walkthrough-advisor/options`, { headers });
  assert.equal(options.status, 200);
  const payload = (await options.json()).advisorOptions;
  assert.equal(payload.localAdvisor.selectable, true);
  assert.equal(payload.profiles.length, 1);
  assert.deepEqual(payload.profiles[0], {
    profileId: "walkthrough-analyst-v1",
    role: "analyst",
    providerId: "deterministic",
    providerName: "Local Advisor",
    modelId: "local-advisor-v1",
    modelName: "Local Advisor v1",
    profileVersion: 1,
    outputSchema: "analysis-v1",
    connectionState: "local-ready",
    selectable: true,
    dispatchReady: true,
    selectionNotice: "پاسخ deterministic و بدون هزینهٔ Provider خارجی است."
  });
  assert.equal(JSON.stringify(payload).includes("credentialRef"), false);
  const advice = await fetch(`${base}/api/walkthrough/advice?projectId=project-vpn`, { method: "POST", headers, body: JSON.stringify({ stepId: "intake", projectId: "project-vpn", advisorProfileId: "walkthrough-analyst-v1", question: "برای هدف چه پیشنهادی داری؟" }) });
  assert.equal(advice.status, 200);
  const selected = (await advice.json()).advisor.selectedAdvisor;
  assert.deepEqual(selected, { kind: "profile", profileId: "walkthrough-analyst-v1", providerId: "deterministic", modelId: "local-advisor-v1", profileVersion: 1, dispatch: "local-response" });
  const unavailable = await fetch(`${base}/api/walkthrough/advice?projectId=project-vpn`, {
    method: "POST",
    headers,
    body: JSON.stringify({ stepId: "intake", projectId: "project-vpn", advisorProfileId: "missing-advisor-v1", question: "راهنمای Intake" })
  });
  assert.equal(unavailable.status, 400, "a caller cannot bypass the picker with an unbound or unavailable profile");
  assert.equal((await unavailable.json()).code, "WALKTHROUGH_ADVISOR_PROFILE_UNAVAILABLE");
});

test("Project-bound live advisor profiles invoke through the bounded authorization path", async t => {
  const { access, identity } = setup();
  const owner = ownerLogin(identity);
  let providerCalls = 0;
  let dispatchedMaxCostUnits = null;
  let lastProviderInput = null;
  let rejectLiveInvocation = false;
  const persistedDomainEvents = [];
  const commandAudits = [];
  let liveAdvisorPolicy = { active: true, authorizationId: "AUTH-AI-TEST-001", projectId: "project-vpn", stepId: "HERO-AI-TEST-001", documentVersion: "v1.0", providerId: "openai", modelIds: ["gpt-5.6-luna"], roleIds: ["analyst"], capabilities: ["smart-tester", "walkthrough-guide", "form-suggestions"], maxCostUnits: 50000, expiresAtMs: Date.parse("2027-02-23T23:59:59Z"), globalStop: false };
  const adapter = {
    providerId: "openai",
    mode: "live",
    async validateConnection() { return { status: "ok" }; },
    async assertDispatchReady(input) { dispatchedMaxCostUnits = input.maxCostUnits; return { status: "ok", pricing: { catalogVersion: "test", currency: "USD", inputPricePer1mTokens: 0.2, outputPricePer1mTokens: 1.2, cachedInputPricePer1mTokens: 0.02 } }; },
    async generate(input) {
      providerCalls += 1;
      lastProviderInput = structuredClone(input);
      const refined = input.context?.featureKey === "form.suggestions.refine";
      const fieldAwareRefinement = refined && input.request?.question?.includes("فیلد اول را کوتاه‌تر");
      const detailedConstraints = "این محدودیت‌ها فقط محیط Test ایزوله، بازبینی انسانی پیش از هر تغییر، جلوگیری از ورود Secret و هزینهٔ خارجی، ثبت شواهد قابل بررسی، امکان rollback و انتقال‌پذیری artifact را مشخص می‌کند تا پیشنهاد برای ادمین روشن و قابل ارزیابی بماند و هیچ اجرای خودکاری آغاز نشود.";
      const answer = input.request?.purpose === "form-suggestions"
        ? JSON.stringify({
          schema: "form-suggestions-v1",
          boxPurpose: "این باکس برای ثبت اطلاعات پایهٔ پروژه است تا هدف، سطح ریسک، محدودیت‌ها و تأیید ادمین پیش از برنامه‌ریزی و هرگونه اقدام اجرایی روشن و قابل بازبینی باشند.",
          ...(refined ? { feedbackResponse: fieldAwareRefinement ? "درخواست شما را به کوتاه‌سازی «هدف» و افزودن جزئیات به «محدودیت» تفسیر کردم؛ پیشنهاد تازه فقط برای بازبینی ادمین است." : "بازخورد ادمین را به درخواستِ شرح تفصیلی‌تر تفسیر کردم؛ گزینهٔ تازه هدف را با جزئیات بیشتری بازنویسی می‌کند و همچنان فقط برای بازبینی است." } : {}),
          suggestions: [{
            title: refined ? "پیشنهاد بهبودیافتهٔ فرم Test" : "پیشنهاد فرم Test",
            rationale: refined ? "بازخوردِ معتبرِ ادمین در پیشنهاد تازه اعمال شد." : "مقدارهای کم‌ریسک و قابل بازبینی.",
            entries: [{ name: "goal", type: refined ? "text" : "textarea", value: fieldAwareRefinement ? "هدف کوتاه و قابل بررسی Test" : refined ? "هدف تفصیلی Test پس از بازخورد" : "هدف نمونهٔ Test", checked: false }, { name: "riskLevel", type: "select", value: "low", checked: false }, { name: "constraints", type: "textarea", value: fieldAwareRefinement ? detailedConstraints : "فقط Test و بدون هزینهٔ خارجی", checked: false }, { name: "approved", type: "checkbox", value: "approved", checked: false }]
          }]
        })
        : "پاسخ زنده و محدود برای همین Project آماده شد.";
      return { output: { schema: input.outputSchema, answer }, usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20, costUnits: 1 } };
    },
    listCapabilities() { return []; }
  };
  const externalSpendAuthorizer = async input => rejectLiveInvocation
    ? ({ authorized: false, code: "EXTERNAL_SPEND_SCOPE_MISMATCH", action: "external-spend", globalStop: false, reason: "The approved authorization does not match the invocation." })
    : ({ authorized: true, code: "AUTHORIZED", action: "external-spend", authorizationId: input.authorizationId, projectId: input.projectId, stepId: input.stepId, documentVersion: input.documentVersion, providerId: input.providerId, modelId: input.modelId, role: input.role, capability: input.capability, maxCostUnits: 50000, globalStop: false, safeCheckpointRequired: false });
  Object.defineProperty(externalSpendAuthorizer, "policySnapshot", { value: () => liveAdvisorPolicy });
  const dashboard = createControlDashboard({ now, providerAdapters: { openai: adapter }, externalSpendAuthorizer });
  const actor = { kind: "project-owner", id: "hero-owner" };
  const projectWorkspace = createProjectWorkspace({ now });
  projectWorkspace.createProject({ actor: { role: "project-owner", subject: "hero-owner" }, projectId: "project-vpn", name: "VPN sample", intake: { intent: "نمونهٔ بی‌خطر برای تست فرم", goal: "هدف نمونهٔ Test" }, idempotencyKey: "live-form-project" });
  dashboard.registerAiProvider({ providerId: "openai", mode: "live", displayName: "OpenAI Test", capabilities: [], idempotencyKey: "live-advisor-provider", actor });
  dashboard.registerAiModel({ providerId: "openai", modelId: "gpt-5.6-luna", displayName: "GPT-5.6 Luna", metadata: {}, idempotencyKey: "live-advisor-model", actor });
  dashboard.registerAiProfile({ profileId: "live-advisor-profile", role: "analyst", providerId: "openai", modelId: "gpt-5.6-luna", credentialRef: "vault:hero/test/openai/default", promptVersion: "live-advisor-v1", contextPolicy: "redacted-project-context", toolPolicy: "read-only", outputSchema: "analysis-v1", status: "active", timeoutMs: 1000, maxRetries: 0, maxOutputTokens: 128, maxCostUnits: 100000, costLatencyPriority: "cost", idempotencyKey: "live-advisor-profile-key", actor });
  dashboard.bindAiRole({ bindingId: "live-advisor-binding", projectId: "project-vpn", teamId: null, skillId: null, role: "analyst", profileId: "live-advisor-profile", supersedesBindingId: null, idempotencyKey: "live-advisor-binding-key", actor });
  dashboard.registerAiProfile({ profileId: "live-evaluator-profile", role: "evaluator", providerId: "openai", modelId: "gpt-5.6-luna", credentialRef: "vault:hero/test/openai/default", promptVersion: "live-evaluator-v1", contextPolicy: "redacted-project-context", toolPolicy: "read-only", outputSchema: "evaluation-v1", status: "active", timeoutMs: 1000, maxRetries: 0, maxOutputTokens: 128, maxCostUnits: 100000, costLatencyPriority: "cost", idempotencyKey: "live-evaluator-profile-key", actor });
  dashboard.bindAiRole({ bindingId: "live-evaluator-binding", projectId: "project-vpn", teamId: null, skillId: null, role: "evaluator", profileId: "live-evaluator-profile", supersedesBindingId: null, idempotencyKey: "live-evaluator-binding-key", actor });
  dashboard.registerAiProfile({ profileId: "live-advisor-profile-copy", role: "analyst", providerId: "openai", modelId: "gpt-5.6-luna", credentialRef: "vault:hero/test/openai/default", promptVersion: "live-advisor-v1", contextPolicy: "redacted-project-context", toolPolicy: "read-only", outputSchema: "analysis-v1", status: "active", timeoutMs: 1000, maxRetries: 0, maxOutputTokens: 128, maxCostUnits: 100000, costLatencyPriority: "cost", idempotencyKey: "live-advisor-profile-copy-key", actor });
  // Do not seed Project Memory: the first authorized live request must safely
  // bootstrap its fixed redacted context anchor, then invoke once.
  await dashboard.checkAiProviderHealth({ providerId: "openai", profileId: "live-advisor-profile", actor });
  const app = createHeroServer({
    host: "127.0.0.1", port: 0, now, dashboard, externalSpendAuthorizer, projectAccessRegistry: access, humanIdentity: identity,
    projectWorkspace,
    postgresRuntime: {
      async ping() { return { status: "ok" }; },
      store: {
        async appendEvent(event) {
          persistedDomainEvents.push(structuredClone(event));
          return { ...event, sequence: persistedDomainEvents.length };
        },
        async readAfter(after = 0) { return persistedDomainEvents.filter(event => (event.sequence ?? 0) > after); }
      },
      audit: {
        async record(input) {
          commandAudits.push(structuredClone(input));
          return { sequence: commandAudits.length };
        }
      }
    }
  });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${owner.token}`, "content-type": "application/json" };
  const walkthroughOptions = await fetch(`${base}/api/projects/project-vpn/walkthrough-advisor/options`, { headers });
  assert.equal(walkthroughOptions.status, 200);
  const walkthroughOptionPayload = (await walkthroughOptions.json()).advisorOptions;
  assert.equal(walkthroughOptionPayload.profiles.length, 1, "advisor options must exclude other role Profiles and duplicate Provider/Model entries");
  assert.deepEqual(walkthroughOptionPayload.profiles.map(profile => profile.role), ["analyst"]);
  assert.equal(walkthroughOptionPayload.profiles[0].profileId, "live-advisor-profile");
  assert.equal(walkthroughOptionPayload.profiles[0].selectable, true, "a healthy live profile is selectable only when its scoped authorization is active");
  const globalSmartOptions = await fetch(`${base}/api/smart-tester/options`, { headers });
  assert.equal(globalSmartOptions.status, 200);
  const globalSmartOptionPayload = (await globalSmartOptions.json()).smartTester.options;
  assert.equal(globalSmartOptionPayload.profiles.length, 1, "global advisor options must collapse duplicate Provider/Model Profiles");
  assert.deepEqual(globalSmartOptionPayload.profiles.map(profile => profile.role), ["analyst"]);
  projectWorkspace.createProject({ actor: { role: "project-owner", subject: "hero-owner" }, projectId: "project-new", name: "New project", intake: { intent: "پروژهٔ تازه", goal: "هدف پروژهٔ تازه" }, idempotencyKey: "global-advisor-catalog-project" });
  const newProjectOptions = await fetch(`${base}/api/smart-tester/options?projectId=project-new`, { headers });
  assert.equal(newProjectOptions.status, 200);
  const newProjectProfile = (await newProjectOptions.json()).smartTester.options.profiles.find(profile => profile.profileId === "live-advisor-profile");
  assert.equal(newProjectProfile?.selectable, true, "a healthy compatible AI must appear in a newly created project's global service picker");
  assert.equal(newProjectProfile?.dispatchReady, false, "an unbound project must still fail closed before a live external request");
  assert.match(newProjectProfile?.selectionNotice ?? "", /سراسری/);
  // A Test-wide authorization changes only the cost-policy boundary. It does
  // not loosen the Project context boundary: the first live request below
  // must create an append-only, project-specific binding rather than asking
  // an admin to configure every newly created Project by hand.
  liveAdvisorPolicy = { ...liveAdvisorPolicy, projectId: "all-test-projects", projectScope: "all-test-projects" };
  const globalAuthorizedOptions = await fetch(`${base}/api/projects/project-new/walkthrough-advisor/options`, { headers });
  assert.equal(globalAuthorizedOptions.status, 200);
  const globalAuthorizedProfile = (await globalAuthorizedOptions.json()).advisorOptions.profiles.find(profile => profile.profileId === "live-advisor-profile");
  assert.equal(globalAuthorizedProfile?.selectable, true);
  assert.equal(globalAuthorizedProfile?.dispatchReady, true, "a Test-wide advisor authorization must not require an admin-created project binding or scope");
  const firstNewProjectWalkthrough = await fetch(`${base}/api/walkthrough/advice?projectId=project-new`, {
    method: "POST",
    headers,
    body: JSON.stringify({ stepId: "intake", projectId: "project-new", advisorProfileId: "live-advisor-profile", question: "راهنمای پروژهٔ تازه چیست؟" })
  });
  assert.equal(firstNewProjectWalkthrough.status, 200);
  assert.equal((await firstNewProjectWalkthrough.json()).advisor.providerInvoked, true);
  const autoProvisionedBinding = dashboard.aiOrchestration.resolveBinding({ projectId: "project-new", role: "analyst" });
  assert.equal(autoProvisionedBinding?.profileId, "live-advisor-profile");
  assert.match(autoProvisionedBinding?.bindingId ?? "", /^advisor-service-project-new-/);
  const walkthrough = await fetch(`${base}/api/walkthrough/advice?projectId=project-vpn`, { method: "POST", headers, body: JSON.stringify({ stepId: "intake", projectId: "project-vpn", advisorProfileId: "live-advisor-profile", question: "گام بعدی چیست؟" }) });
  assert.equal(walkthrough.status, 200);
  const walkthroughAdvisor = (await walkthrough.json()).advisor;
  assert.equal(walkthroughAdvisor.providerInvoked, true);
  assert.equal(walkthroughAdvisor.selectedAdvisor.dispatch, "live-response");
  assert.match(walkthroughAdvisor.response, /پاسخ زنده/);
  assert.deepEqual(walkthroughAdvisor.result, { schema: "analysis-v1", answer: "پاسخ زنده و محدود برای همین Project آماده شد." });
  assert.equal(walkthroughAdvisor.evidence.capability, "walkthrough-guide");
  assert.equal(walkthroughAdvisor.evidence.bindingId, "live-advisor-binding");
  assert.equal(walkthroughAdvisor.evidence.usage.totalTokens, 20);
  assert.equal(walkthroughAdvisor.evidence.resultSchema, "analysis-v1");
  assert.ok(persistedDomainEvents.some(event => event.type === "ai.invocation-completed"), "live advisor invocation must be persisted through the PostgreSQL boundary");
  assert.ok(commandAudits.some(event => event.command === "ai.invoke" && event.projectId === "project-vpn"), "live advisor invocation must have a project-scoped command audit");
  assert.doesNotMatch(JSON.stringify(persistedDomainEvents), /credentialRef|secret|پاسخ زنده و محدود/, "persisted domain events must not contain credentials or provider output");
  assert.equal(dispatchedMaxCostUnits, 10_000, "the Test advisor must clamp a stale higher Profile ceiling to its versioned per-request limit");
  assert.doesNotMatch(JSON.stringify(walkthroughAdvisor.evidence), /(?:credential|secret|prompt|response)/i);
  assert.equal(lastProviderInput.context.repositoryContext.access.mode, "read-only");
  assert.equal(lastProviderInput.context.repositoryContext.access.codeMutation, false);
  assert.equal(lastProviderInput.context.repositoryContext.selection.surface, "/walkthrough");
  assert.equal(lastProviderInput.context.repositoryContext.selection.featureKey, "guide.walkthrough");
  assert.ok(lastProviderInput.context.repositoryContext.files.some(file => file.path === "apps/control-plane/src/project-walkthrough.mjs"));
  assert.ok(lastProviderInput.context.repositoryContext.files.some(file => file.path === "apps/control-plane/src/project-walkthrough-view.mjs"));
  assert.ok(lastProviderInput.context.repositoryContext.availableFiles.some(file => file.path === "docs/operations/HERO-PROJECT-WALKTHROUGH.md"));
  const smart = await fetch(`${base}/api/smart-tester/advice?projectId=project-vpn&surface=%2Fworkspace&featureKey=workspace.intake&boxId=intake-card`, { method: "POST", headers, body: JSON.stringify({ surface: "/workspace", featureKey: "workspace.intake", boxId: "intake-card", projectId: "project-vpn", advisorProfileId: "live-advisor-profile", question: "چه چیزی را بررسی کنم؟" }) });
  assert.equal(smart.status, 200);
  const smartAdvisor = (await smart.json()).smartTester.advisor;
  assert.equal(smartAdvisor.providerInvoked, true);
  assert.match(smartAdvisor.response, /پاسخ زنده/);
  assert.equal(smartAdvisor.result.schema, "analysis-v1");
  assert.equal(smartAdvisor.evidence.capability, "smart-tester");
  assert.equal(smartAdvisor.evidence.bindingId, "live-advisor-binding");
  assert.equal(lastProviderInput.context.repositoryContext.access.mode, "read-only");
  assert.equal(lastProviderInput.context.repositoryContext.access.codeMutation, false);
  assert.ok(lastProviderInput.context.repositoryContext.files.some(file => file.path === "apps/control-plane/src/smart-tester.mjs"));
  assert.ok(lastProviderInput.context.repositoryContext.availableFiles.some(file => file.path === "docs/operations/HERO-SMART-TESTER.md"));
  const repositoryPaths = JSON.stringify([
    ...lastProviderInput.context.repositoryContext.availableFiles.map(file => file.path),
    ...lastProviderInput.context.repositoryContext.files.map(file => file.path)
  ]);
  assert.doesNotMatch(repositoryPaths, /\/opt\/hero|(?:^|[\\/])\.env(?:\.|$)|(?:^|[\\/])node_modules(?:[\\/]|$)/i);
  const formSuggestion = await fetch(`${base}/api/advisor?projectId=project-vpn`, {
    method: "POST",
    headers,
    body: JSON.stringify({ projectId: "project-vpn", formId: "intake-form", formTitle: "Intake پروژه", softwareGoal: "هدف فعلی فرم", boxDescription: "ثبت هدف و محدودیت‌ها", selectedAdvisor: "live-advisor-profile", fields: [{ name: "goal", type: "textarea", label: "هدف", value: "مقدار قبلی محرمانه نیست اما نباید به Provider ارسال شود" }, { name: "riskLevel", type: "select", label: "ریسک", options: [{ value: "low", label: "کم" }, { value: "high", label: "زیاد" }] }, { name: "constraints", type: "textarea", label: "محدودیت" }, { name: "approved", type: "checkbox", label: "تأیید", value: "approved" }] })
  });
  assert.equal(formSuggestion.status, 200);
  const formPayload = await formSuggestion.json();
  assert.equal(formPayload.formSuggestions.providerInvoked, true);
  assert.equal(formPayload.formSuggestions.providerSchema, "form-suggestions-v1");
  assert.match(formPayload.formSuggestions.boxPurpose, /اطلاعات پایهٔ پروژه/);
  assert.equal(formPayload.formSuggestions.suggestions.length, 3, "a live first response must always populate the three starting cards");
  assert.equal(formPayload.formSuggestions.suggestions[1].fallbackSuggestion, true, "a missing Provider alternative is safely completed rather than treated as a user-facing error");
  assert.equal(formPayload.formSuggestions.suggestions[0].entries[1].value, "low");
  assert.equal(formPayload.providerInvocation.status, "completed");
  assert.equal(formPayload.evidence.capability, "form-suggestions");
  assert.equal(lastProviderInput.context.formSuggestion.fields[0].value, undefined, "existing form values must not enter the Provider context");
  assert.doesNotMatch(JSON.stringify(formPayload), /مقدار قبلی محرمانه/);
  const formRefinement = await fetch(`${base}/api/advisor/refine?projectId=project-vpn`, {
    method: "POST",
    headers,
    body: JSON.stringify({ projectId: "project-vpn", formId: "intake-form", formTitle: "Intake پروژه", softwareGoal: "هدف فعلی فرم", boxDescription: "ثبت هدف و محدودیت‌ها", selectedAdvisor: "live-advisor-profile", feedback: "فیلد اول را کوتاه‌تر کن و برای فیلد سوم توضیح مفصل‌تری بنویس.", iteration: 1, fields: [{ name: "goal", type: "textarea", label: "هدف", value: "مقدار قبلی محرمانه نیست اما نباید به Provider ارسال شود" }, { name: "riskLevel", type: "select", label: "ریسک", options: [{ value: "low", label: "کم" }, { value: "high", label: "زیاد" }] }, { name: "constraints", type: "textarea", label: "محدودیت" }, { name: "approved", type: "checkbox", label: "تأیید", value: "approved" }] })
  });
  assert.equal(formRefinement.status, 200);
  const refinementPayload = await formRefinement.json();
  assert.equal(refinementPayload.formSuggestions.providerInvoked, true);
  assert.deepEqual(refinementPayload.formSuggestions.refinement, { iteration: 1, feedbackAcknowledged: true });
  assert.equal(refinementPayload.formSuggestions.suggestions.length, 1, "each feedback adds one card to the existing UI list");
  assert.equal(refinementPayload.formSuggestions.suggestions[0].suggestionId, "provider-form-suggestion-4");
  assert.equal(refinementPayload.formSuggestions.suggestions[0].entries[0].value, "هدف کوتاه و قابل بررسی Test", "a safe field-aware Provider value must not be discarded only because its type was omitted or generalized");
  assert.ok(refinementPayload.formSuggestions.suggestions[0].entries[2].value.length >= 220, "a detailed instruction is enforced only for the matching field");
  assert.match(refinementPayload.formSuggestions.feedbackResponse, /محدودیت/, "the Provider's field-aware feedback interpretation is returned only to this transient popup response");
  assert.equal(refinementPayload.evidence.capability, "form-suggestions");
  assert.equal(lastProviderInput.context.featureKey, "form.suggestions.refine");
  assert.equal(lastProviderInput.context.formSuggestion.feedback, undefined, "feedback must not be embedded in the structured provider context");
  assert.equal(lastProviderInput.context.formSuggestion.fieldDirectives, undefined, "field-aware feedback must not be embedded in structured provider context");
  assert.match(lastProviderInput.request.question, /فیلد اول را کوتاه‌تر/);
  assert.match(lastProviderInput.request.question, /فیلد شمارهٔ 1/);
  assert.doesNotMatch(JSON.stringify(persistedDomainEvents), /فیلد اول را کوتاه‌تر/, "feedback must not be persisted in domain events");
  assert.doesNotMatch(JSON.stringify(persistedDomainEvents), /افزودن جزئیات به «محدودیت»/, "the transient Provider feedback explanation must not be persisted in domain events");
  const persistedAiRegistry = dashboard.persistenceSnapshot().registries.find(registry => registry.registryId === "ai-orchestration");
  const persistedRefinement = persistedAiRegistry.invocations.find(invocation => invocation.invocationId === refinementPayload.providerInvocation.invocationId);
  assert.equal(persistedRefinement.response, null, "a form-suggestion response is not retained in the invocation registry");
  assert.equal(persistedRefinement.responseRetention, "transient");
  assert.doesNotMatch(JSON.stringify(persistedAiRegistry), /پیشنهادها کوتاه‌تر باشند|شرح تفصیلی‌تر/, "feedback and its conversational response must not enter a durable registry snapshot");
  rejectLiveInvocation = true;
  const blockedResponse = await fetch(`${base}/api/smart-tester/advice?projectId=project-vpn&surface=%2Fworkspace&featureKey=workspace.intake&boxId=intake-card`, { method: "POST", headers, body: JSON.stringify({ surface: "/workspace", featureKey: "workspace.intake", boxId: "intake-card", projectId: "project-vpn", advisorProfileId: "live-advisor-profile", question: "درخواست باید در مرز مجوز متوقف شود" }) });
  assert.equal(blockedResponse.status, 502);
  const blockedPayload = await blockedResponse.json();
  assert.equal(blockedPayload.code, "LIVE_ADVISOR_INVOCATION_FAILED");
  assert.match(blockedPayload.message, /ACTIVE_AUTHORIZATION_SNAPSHOT_REJECTED/);
  assert.match(blockedPayload.message, /authorizationId/);
  assert.ok(persistedDomainEvents.some(event => event.type === "ai.invocation-blocked"), "a blocked live advisor invocation must be persisted for diagnosis");
  rejectLiveInvocation = false;
  const callsBeforeDeniedRequest = providerCalls;
  liveAdvisorPolicy = { ...liveAdvisorPolicy, roleIds: ["evaluator"] };
  const unavailableOptions = await fetch(`${base}/api/smart-tester/options?projectId=project-vpn`, { headers });
  assert.equal(unavailableOptions.status, 200);
  const unavailableProfile = (await unavailableOptions.json()).smartTester.options.profiles.find(profile => profile.profileId === "live-advisor-profile");
  assert.equal(unavailableProfile?.selectable, true, "a healthy global service remains selectable after a project authorization changes");
  assert.equal(unavailableProfile?.dispatchReady, false, "Smart Tester must not dispatch a live request after the scoped authorization changes");
  assert.match(unavailableProfile?.selectionNotice ?? "", /سراسری/);
  const denied = await fetch(`${base}/api/smart-tester/advice?projectId=project-vpn&surface=%2Fworkspace&featureKey=workspace.intake&boxId=intake-card`, { method: "POST", headers, body: JSON.stringify({ surface: "/workspace", featureKey: "workspace.intake", boxId: "intake-card", projectId: "project-vpn", advisorProfileId: "live-advisor-profile", question: "نباید به Provider برسد" }) });
  assert.equal(denied.status, 400);
  assert.equal((await denied.json()).code, "SMART_TESTER_ADVISOR_UNAVAILABLE");
  assert.equal(providerCalls, callsBeforeDeniedRequest);
});

test("Control Plane startup hydrates identity users, grants and revocations from its PostgreSQL boundary", async t => {
  const first = setup();
  const owner = ownerPrincipal(first.identity);
  first.identity.createUser({ actor: owner, user: { userId: "project-viewer", email: "viewer@example.test", password: "Viewer password 123" } });
  first.access.upsertGrant({ actor: owner, grant: { projectId: "project-vpn", userId: "project-viewer", role: "viewer" } });
  const persistedUser = first.identity.persistenceRecord({ userId: "project-viewer" });
  const persistedGrant = first.access.listProjectGrants({ principal: owner, projectId: "project-vpn" })[0];
  const saved = [];
  const second = setup();
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    now,
    projectAccessRegistry: second.access,
    humanIdentity: second.identity,
    postgresRuntime: {
      async ping() { return { status: "ok" }; },
      projectIdentity: {
        async listUsers() { return [persistedUser]; },
        async listCurrentGrants() { return [persistedGrant]; },
        async listSessionRevocations() { return []; },
        async saveUser(user) { saved.push(user); }
      }
    }
  });
  await app.start();
  t.after(() => app.stop());
  const restored = second.identity.getUser("project-viewer");
  assert.equal(restored.email, "viewer@example.test");
  assert.equal(second.access.authorize({ principal: { subject: "project-viewer", role: "member" }, projectId: "project-vpn", action: "project.read" }).role, "viewer");
  assert.equal(saved.some(user => user.userId === "hero-owner"), true);
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
  const viewerAdvice = await fetch(`${base}/api/walkthrough/advice?projectId=project-vpn`, {
    method: "POST",
    headers: viewerHeaders,
    body: JSON.stringify({ stepId: "intake", projectId: "project-vpn", question: "راهنمای Intake" })
  });
  assert.equal(viewerAdvice.status, 200, "a Viewer may read local guidance for a granted project");
  assert.equal((await fetch(`${base}/api/walkthrough/advice?projectId=project-crm`, {
    method: "POST",
    headers: viewerHeaders,
    body: JSON.stringify({ stepId: "intake", projectId: "project-crm" })
  })).status, 403, "the advisor must not cross a Project Grant boundary");
  assert.equal((await fetch(`${base}/api/smart-tester/context?surface=%2Fworkspace&featureKey=workspace.intake&projectId=project-vpn`, { headers: viewerHeaders })).status, 403, "Smart Tester remains owner-only even when a Viewer can read project guidance");
  assert.equal((await fetch(`${base}/api/projects/project-vpn/access`, { method: "POST", headers: viewerHeaders, body: JSON.stringify({ userId: "project-viewer", role: "viewer" }) })).status, 403);
  assert.equal((await fetch(`${base}/api/projects/project-vpn/access`, { headers: ownerHeaders })).status, 200);
  assert.equal((await fetch(`${base}/api/identity/users`, { headers: ownerHeaders })).status, 200);
});
