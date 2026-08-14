import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateDashboardContract } from "../packages/contracts/src/dashboard.mjs";
import { DashboardCommandError, createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

function dashboard(options = {}) {
  return createControlDashboard({ now: () => "2026-08-14T17:00:00.000Z", ...options });
}

test("dashboard contract is Persian, bounded and complete", () => {
  assert.deepEqual(validateDashboardContract(), []);
  const state = dashboard().snapshot();
  assert.equal(state.contract.language, "fa-IR");
  assert.equal(state.providerMode, "Fake Agent only");
  assert.equal(state.fullAutonomy, false);
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
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now: () => "2026-08-14T17:00:00.000Z" });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = "http://127.0.0.1:" + address.port;

  const page = await fetch(baseUrl + "/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /اتاق کنترل ساده/);

  const created = await fetch(baseUrl + "/api/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "فرم ثبت نام", scenario: "failure-then-retry" })
  });
  assert.equal(created.status, 201);
  const request = (await created.json()).request;
  await fetch(baseUrl + "/api/requests/" + request.requestId + "/approve", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const run = await fetch(baseUrl + "/api/requests/" + request.requestId + "/run", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
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
