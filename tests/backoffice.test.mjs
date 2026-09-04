import assert from "node:assert/strict";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

test("read-only development back office exposes a safe orientation projection", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now: () => "2026-08-30T12:00:00.000Z" });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const page = await fetch(baseUrl + "/backoffice");
  assert.equal(page.status, 200);
  const pageHtml = await page.text();
  assert.match(pageHtml, /بک‌آفیس توسعهٔ Hero/);
  assert.match(pageHtml, /IRANSans/);
  assert.match(pageHtml, /همهٔ AI Roleها/);
  assert.match(pageHtml, /مفاهیم و قراردادها/);
  assert.match(pageHtml, /پیکربندی Provider و Role/);
  assert.match(pageHtml, /تاریخچهٔ Benchmark/);
  assert.match(pageHtml, /ai-config-form/);
  assert.match(pageHtml, /ویرایش اصول/);
  assert.match(pageHtml, /توکن مالک یا Admin/);
  assert.match(pageHtml, /برای ویرایش نسخهٔ اصول تیم و پیکربندی AI، توکن مالک یا Admin پذیرفته می‌شود/);

  const response = await fetch(baseUrl + "/backoffice-data");
  assert.equal(response.status, 200);
  const payload = await response.json();
  const backoffice = payload.backoffice;
  assert.equal(backoffice.scope, "read-only-development-backoffice");
  assert.equal(backoffice.organization.teamCount, 11);
  assert.deepEqual(backoffice.ai.roles, ["analyst", "evaluator", "decision-maker", "planner", "researcher", "executor", "verifier", "code-reviewer"]);
  assert.deepEqual(backoffice.ai.activity, { invocations: [], evaluations: [], decisions: [] });
  assert.equal(backoffice.benchmark.mode, "synthetic-deterministic");
  assert.equal(backoffice.governance.globalStop, false);
  assert.equal(backoffice.focus.find(item => item.id === "pilot").status, "مسدود");
  assert.equal(backoffice.organization.teams.some(team => "description" in team), false);
  assert.equal(backoffice.organization.teams[0].contract.principles.length >= 5, true);
  assert.equal(backoffice.organization.teams[0].contract.outputs.length > 0, true);
  assert.deepEqual(backoffice.ai.providers, []);
  assert.deepEqual(backoffice.ai.models, []);
  assert.deepEqual(backoffice.ai.profiles, []);
  assert.deepEqual(backoffice.ai.bindings, []);
  assert.doesNotMatch(JSON.stringify(backoffice), /api[_-]?key\s*[:=]|access[_-]?token\s*[:=]|password\s*[:=]|Bearer\s+[A-Za-z0-9._-]{12,}|-----BEGIN/i);
});

test("back office exposes a safe AI configuration catalog without credential references", async () => {
  const { createControlDashboard } = await import("../apps/control-plane/src/dashboard-service.mjs");
  const dashboard = createControlDashboard({ now: () => "2026-08-30T12:00:00.000Z" });
  dashboard.registerAiProvider({ providerId: "openai", mode: "deterministic", displayName: "OpenAI test", idempotencyKey: "backoffice-catalog-provider" });
  dashboard.registerAiModel({ providerId: "openai", modelId: "chatgpt", displayName: "ChatGPT test", idempotencyKey: "backoffice-catalog-model" });
  dashboard.registerAiProfile({ profileId: "backoffice-analyst-profile", role: "analyst", providerId: "openai", modelId: "chatgpt", credentialRef: "env:OPENAI_API_KEY", promptVersion: "analyst-v1", contextPolicy: "approved", toolPolicy: "read-only", outputSchema: "analysis-v1", status: "draft", idempotencyKey: "backoffice-catalog-profile" });
  const ai = dashboard.backofficeSnapshot().ai;
  assert.equal(ai.providers[0].providerId, "openai");
  assert.equal(ai.models[0].modelId, "chatgpt");
  assert.equal(ai.profiles[0].profileId, "backoffice-analyst-profile");
  assert.equal("credentialRef" in ai.profiles[0], false);
  assert.doesNotMatch(JSON.stringify(ai), /OPENAI_API_KEY|credentialRef/i);
});

test("owner can edit team principles through the protected back office command", async t => {
  const now = () => "2026-08-30T12:00:00.000Z";
  const ownerAuth = createOwnerAuth({ secret: "test-only-owner-auth-secret-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "backoffice-principles-session", expiresAt: 2_000_000_000 });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const endpoint = `http://127.0.0.1:${address.port}/api/teams/mahsulo/principles`;
  const denied = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ principles: ["اصل اول برای پنل"] }) });
  assert.equal(denied.status, 401);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      principles: ["اصل اول برای پنل", "اصل دوم برای تحویل"],
      expectedVersion: 0,
      idempotencyKey: "backoffice-principles-http-1"
    })
  });
  assert.equal(response.status, 200);
  const result = (await response.json()).result;
  assert.equal(result.event.type, "team.principles-updated");
  assert.deepEqual(result.team.principles, ["اصل اول برای پنل", "اصل دوم برای تحویل"]);
  assert.equal(result.team.approvals.principles, false);
});

test("back office projection contains no mutation controls or raw request text", async () => {
  const { createControlDashboard } = await import("../apps/control-plane/src/dashboard-service.mjs");
  const dashboard = createControlDashboard({ now: () => "2026-08-30T12:00:00.000Z" });
  const request = dashboard.createRequest({ title: "درخواست خصوصی آزمایشی", description: "این متن نباید در projection بیاید." });
  const projection = dashboard.backofficeSnapshot();
  assert.equal(projection.requests.total, 1);
  assert.equal(JSON.stringify(projection).includes(request.description), false);
  assert.equal(typeof projection.createRequest, "undefined");
});
