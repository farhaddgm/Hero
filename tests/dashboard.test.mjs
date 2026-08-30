import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateDashboardContract } from "../packages/contracts/src/dashboard.mjs";
import { DashboardCommandError, createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

function dashboard(options = {}) {
  return createControlDashboard({ now: () => "2026-08-14T17:00:00.000Z", ...options });
}

function testOwnerAuth() {
  const now = () => "2026-08-14T17:00:00.000Z";
  const ownerAuth = createOwnerAuth({ secret: "test-only-owner-auth-secret-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "test-owner", sessionId: "session-test-001", expiresAt: 2000000000 });
  return { ownerAuth, headers: { authorization: `Bearer ${token}` } };
}

function withAuth(auth, extra = {}) {
  return { ...extra, ...auth.headers };
}

test("dashboard contract is Persian, bounded and complete", () => {
  assert.deepEqual(validateDashboardContract(), []);
  const state = dashboard().snapshot();
  assert.equal(state.contract.language, "fa-IR");
  assert.equal(state.providerMode, "Fake Agent only");
  assert.equal(state.fullAutonomy, false);
  assert.equal(state.teamControl.teams.length, 11);
  assert.equal(state.teamControl.contract.humanControl.includes("تأیید"), true);
  assert.equal(state.principlesControl.principles.length, 8);
  assert.deepEqual(state.releaseControl.environments, ["test", "production"]);
});

test("HTTP dashboard exposes the team control surface without live providers", async t => {
  const auth = testOwnerAuth();
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now: () => "2026-08-14T17:00:00.000Z", ownerAuth: auth.ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = "http://127.0.0.1:" + address.port;

  const unauthenticated = await fetch(baseUrl + "/api/teams");
  assert.equal(unauthenticated.status, 401);
  const listed = await fetch(baseUrl + "/api/teams", { headers: auth.headers });
  assert.equal(listed.status, 200);
  const teamControl = (await listed.json()).teamControl;
  assert.equal(teamControl.teams.length, 11);
  assert.equal(teamControl.teams[0].status, "proposed");

  const trainingPlan = await fetch(baseUrl + "/api/teams/mahsulo/training-plan", { headers: auth.headers });
  assert.equal(trainingPlan.status, 200);
  assert.equal((await trainingPlan.json()).training.plan.benchmark.teamId, "mahsulo");

  const planned = await fetch(baseUrl + "/api/plans", {
    method: "POST",
    headers: withAuth(auth, { "content-type": "application/json" }),
    body: JSON.stringify({
      planningId: "PLAN-HTTP-001",
      requestId: "REQ-HTTP-001",
      projectId: "hero",
      requestText: "یک داشبورد وب برای پیگیری درخواست‌های کاربران بساز.",
      idempotencyKey: "http-plan-1"
    })
  });
  assert.equal(planned.status, 201);
  const plan = (await planned.json()).plan;
  assert.equal(plan.state, "ready");
  assert.equal(plan.teamReadiness.ready, false);

  const fetchedPlan = await fetch(baseUrl + "/api/plans/PLAN-HTTP-001", { headers: auth.headers });
  assert.equal(fetchedPlan.status, 200);
  assert.equal((await fetchedPlan.json()).plan.planningId, "PLAN-HTTP-001");

  const reviewed = await fetch(baseUrl + "/api/teams/mahsulo/review", {
    method: "POST",
    headers: withAuth(auth, { "content-type": "application/json" }),
    body: JSON.stringify({ target: "output", decision: "approved", idempotencyKey: "http-team-review-1" })
  });
  assert.equal(reviewed.status, 200);
  assert.equal((await reviewed.json()).result.team.approvals.output, true);

  const trained = await fetch(baseUrl + "/api/teams/mahsulo/training", {
    method: "POST",
    headers: withAuth(auth, { "content-type": "application/json" }),
    body: JSON.stringify({ module: "mission", score: 90, idempotencyKey: "http-team-training-1" })
  });
  assert.equal(trained.status, 200);
  assert.equal((await trained.json()).result.training.passed, true);

  const autonomy = await fetch(baseUrl + "/api/teams/mahsulo/autonomy", {
    method: "POST",
    headers: withAuth(auth, { "content-type": "application/json" }),
    body: JSON.stringify({ stage: "product", mode: "stage-gated", idempotencyKey: "http-team-autonomy-1" })
  });
  assert.equal(autonomy.status, 200);
  assert.equal((await autonomy.json()).result.autonomy.mode, "stage-gated");

  const contract = await fetch(baseUrl + "/team-contract");
  assert.equal(contract.status, 200);
  assert.equal((await contract.json()).teamContract.catalogSize, 11);

  const principle = await fetch(baseUrl + "/api/projects/product-alpha/principles", {
    method: "POST",
    headers: withAuth(auth, { "content-type": "application/json" }),
    body: JSON.stringify({
      principleId: "product.no-unsafe-defaults",
      title: "پیش‌فرض‌های امن",
      statement: "قابلیت‌های خطرناک باید به‌صورت پیش‌فرض غیرفعال باشند.",
      rationale: "محصول نباید کاربر را ناخواسته در معرض ریسک قرار دهد.",
      controlPoints: ["release-production"],
      idempotencyKey: "http-principle-define"
    })
  });
  assert.equal(principle.status, 201);
  const blockedPrinciples = await fetch(baseUrl + "/api/projects/product-alpha/principles/check", {
    method: "POST",
    headers: withAuth(auth, { "content-type": "application/json" }),
    body: JSON.stringify({ controlPoint: "release-production" })
  });
  assert.equal((await blockedPrinciples.json()).result.ready, false);
  const principleReview = await fetch(baseUrl + "/api/projects/product-alpha/principles/product.no-unsafe-defaults/review", {
    method: "POST",
    headers: withAuth(auth, { "content-type": "application/json" }),
    body: JSON.stringify({ decision: "approved", idempotencyKey: "http-principle-review" })
  });
  assert.equal(principleReview.status, 200);
  const releaseContract = await fetch(baseUrl + "/release-contract");
  assert.equal(releaseContract.status, 200);
  assert.deepEqual((await releaseContract.json()).releaseContract.environments, ["test", "production"]);
});

test("a simple request exposes a plan and needs approval by default", () => {
  const control = dashboard();
  const request = control.createRequest({
    title: "صفحه ورود کاربران",
    description: "ورود ساده با ایمیل",
    scenario: "success"
  });
  assert.equal(request.status, "نیازمند تأیید");
  assert.equal(request.plan.length, 4);
  assert.throws(() => control.runFakeAgent(request.requestId), DashboardCommandError);
  assert.equal(control.approveRequest(request.requestId).status, "آماده اجرا");
  const completed = control.runFakeAgent(request.requestId);
  assert.equal(completed.status, "تکمیل");
  assert.equal(completed.result.attempts[0].outcome, "completed");
  assert.equal(completed.result.runnerStates.every(state => state === "cleaned"), true);
});

test("full autonomy prepares only new requests while global stop blocks dispatch", () => {
  const control = dashboard();
  control.setFullAutonomy(true);
  const ready = control.createRequest({ title: "داشبورد فروش", scenario: "pause-resume" });
  assert.equal(ready.status, "آماده اجرا");
  control.setGlobalStop(true);
  assert.throws(() => control.runFakeAgent(ready.requestId), error => error.code === "GLOBAL_STOP_ACTIVE");
  const stopped = control.createRequest({ title: "گزارش روزانه", scenario: "success" });
  assert.equal(stopped.status, "متوقف");
  control.setGlobalStop(false);
  assert.equal(control.approveRequest(stopped.requestId).status, "آماده اجرا");
});

test("dashboard rejects secret-shaped input instead of returning it in the snapshot", () => {
  const control = dashboard();
  assert.throws(
    () => control.createRequest({ title: "کلید سرویس", description: "api_key=abcd1234" }),
    error => error.code === "SENSITIVE_INPUT_REJECTED"
  );
  assert.equal(control.snapshot().requests.length, 0);
});

test("HTTP dashboard renders Persian controls and runs the fake-agent-only API", async t => {
  const auth = testOwnerAuth();
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now: () => "2026-08-14T17:00:00.000Z", ownerAuth: auth.ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = "http://127.0.0.1:" + address.port;

  const page = await fetch(baseUrl + "/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /اتاق کنترل ساده/);
  assert.match(await (await fetch(baseUrl + "/")).text(), /اصول حیاتی/);

  const created = await fetch(baseUrl + "/api/requests", {
    method: "POST",
    headers: withAuth(auth, { "content-type": "application/json" }),
    body: JSON.stringify({ title: "فرم ثبت نام", scenario: "failure-then-retry" })
  });
  assert.equal(created.status, 201);
  const request = (await created.json()).request;
  await fetch(baseUrl + "/api/requests/" + request.requestId + "/approve", { method: "POST", headers: withAuth(auth, { "content-type": "application/json" }), body: "{}" });
  const run = await fetch(baseUrl + "/api/requests/" + request.requestId + "/run", { method: "POST", headers: withAuth(auth, { "content-type": "application/json" }), body: "{}" });
  assert.equal(run.status, 200);
  assert.deepEqual((await run.json()).request.result.attempts.map(item => item.outcome), ["failed", "completed"]);
});

test("approved dashboard specification remains aligned with the machine contract", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-010-v1.0.md"), "utf8");
  assert.match(specification, /داشبورد کنترل/);
  assert.match(specification, /Fake Agent/);
  assert.match(specification, /توقف اضطراری/);
  assert.match(specification, /اختیار کامل/);
});
