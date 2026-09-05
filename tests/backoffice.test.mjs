import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

test("protected development back office exposes safe data and controlled owner/admin controls", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now: () => "2026-08-30T12:00:00.000Z" });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const page = await fetch(baseUrl + "/backoffice");
  assert.equal(page.status, 200);
  const pageHtml = await page.text();
  assert.match(pageHtml, /بک‌آفیس توسعهٔ Hero/);
  assert.match(pageHtml, /IRANSans/);
  assert.match(pageHtml, /<html lang="fa" dir="rtl">/);
  assert.match(pageHtml, /button:focus-visible/);
  assert.match(pageHtml, /@media \(max-width: 820px\)/);
  assert.match(pageHtml, /همهٔ AI Roleها/);
  assert.match(pageHtml, /مفاهیم و قراردادها/);
  assert.match(pageHtml, /concept-guide/);
  assert.match(pageHtml, /concept-count/);
  assert.match(pageHtml, /۳۹ مفهوم/);
  assert.match(pageHtml, /Project/);
  assert.match(pageHtml, /Authorization/);
  assert.match(pageHtml, /Projection \/ Read Model/);
  assert.match(pageHtml, /تنظیمات کل Hero/);
  assert.match(pageHtml, /مدیریت کنترل‌شده/);
  assert.match(pageHtml, /دسترسی مالک یا Admin/);
  assert.match(pageHtml, /owner-token/);
  assert.match(pageHtml, /ai-config-form/);
  assert.match(pageHtml, /config-submit/);
  assert.match(pageHtml, /ویرایش اصول/);
  assert.match(pageHtml, /تأیید نهایی اصول \(فقط مالک\)/);
  assert.match(pageHtml, /پوشش Projection و حافظهٔ نسخه‌دار/);
  assert.match(pageHtml, /بازیابی Context/);
  assert.match(pageHtml, /تاریخچهٔ Benchmark/);
  assert.match(pageHtml, /پیکربندی Provider، Role و Skill/);
  assert.match(pageHtml, /Skill Binding/);
  assert.match(pageHtml, /Planner و تصمیم خروجی/);
  assert.match(pageHtml, /planning-list/);
  assert.match(pageHtml, /۵۰ گام اولویت‌دار و گیت‌های باز/);
  assert.match(pageHtml, /roadmap-summary/);
  assert.match(pageHtml, /roadmap-list/);
  assert.match(pageHtml, /اقدام‌هایی که قبل از ادامه به مالک یا ادمین نیاز دارند/);
  assert.match(pageHtml, /requestJson/);
  assert.match(pageHtml, /id="download-report"/);
  assert.match(pageHtml, /function downloadReport\(\)/);
  assert.match(pageHtml, /class="app-shell"/);
  assert.match(pageHtml, /data-view-target="overview"/);
  assert.match(pageHtml, /data-view-target="teams"/);
  assert.match(pageHtml, /data-view-target="ai"/);
  assert.match(pageHtml, /data-view-target="project"/);
  assert.match(pageHtml, /data-view-target="operations"/);
  assert.match(pageHtml, /data-view-target="guide"/);
  assert.match(pageHtml, /data-view-panel="overview"/);
  assert.match(pageHtml, /data-view-panel="teams"/);
  assert.match(pageHtml, /data-view-panel="ai"/);
  assert.match(pageHtml, /data-view-panel="project"/);
  assert.match(pageHtml, /data-view-panel="operations"/);
  assert.match(pageHtml, /data-view-panel="guide"/);
  assert.match(pageHtml, /function setView\(view/);
  assert.match(pageHtml, /window\.addEventListener\('hashchange'/);
  const embeddedScript = pageHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(embeddedScript, "Back Office must contain one executable client script.");
  assert.doesNotThrow(() => new vm.Script(embeddedScript, { filename: "backoffice-inline.js" }));

  const response = await fetch(baseUrl + "/backoffice-data");
  assert.equal(response.status, 200);
  const payload = await response.json();
  const backoffice = payload.backoffice;
  assert.equal(backoffice.scope, "protected-development-backoffice");
  assert.equal(backoffice.schemaVersion, "1.1");
  assert.equal(backoffice.readOnly.enabled, true);
  assert.equal(backoffice.readOnly.uiMutationControls, true);
  assert.equal(backoffice.settings.persistence.runtime, "in-memory");
  assert.equal(backoffice.settings.persistence.readiness, "development-or-optional");
  assert.deepEqual(backoffice.readOnly.allowedHttpMethods, ["GET"]);
  assert.equal(backoffice.project.service, "hero-control-plane");
  assert.equal(backoffice.project.boundary, "clean-room");
  assert.equal(backoffice.settings.security.secretValuesExposed, false);
  assert.equal(backoffice.settings.governance.mutationFromBackoffice, true);
  assert.equal(Object.keys(backoffice.contracts).length >= 25, true);
  assert.equal(backoffice.routes.some(route => route.path === "/backoffice-data" && route.method === "GET"), true);
  assert.equal(backoffice.organization.teamCount, 11);
  assert.deepEqual(backoffice.ai.roles, ["analyst", "evaluator", "decision-maker", "planner", "researcher", "executor", "verifier", "code-reviewer"]);
  assert.deepEqual(backoffice.ai.activity, { invocations: [], evaluations: [], decisions: [] });
  assert.equal(backoffice.benchmark.mode, "synthetic-deterministic");
  assert.equal(backoffice.governance.globalStop, false);
  assert.equal(backoffice.projections.registries.length, 11);
  assert.equal(backoffice.projections.registries.every(registry => "eventTypes" in registry && "collectionCounts" in registry), true);
  assert.equal(backoffice.projectMemory.total, 0);
  assert.deepEqual(backoffice.projectMemory.contextAssemblies, []);
  assert.equal(backoffice.planning.total, 0);
  assert.deepEqual(backoffice.planning.plans, []);
  assert.equal(backoffice.roadmap.ledger, "OPEN-50");
  assert.equal(backoffice.roadmap.total, 50);
  assert.equal(backoffice.roadmap.rows.length, 50);
  assert.deepEqual(backoffice.roadmap.statusCounts, { pending: 32, blocked: 8, evidence: 10 });
  assert.equal(backoffice.roadmap.ownerActions.length >= 10, true);
  assert.match(backoffice.roadmap.rows.find(row => row.reference === 19).status, /preflight واقعی دوباره موفق شد/);
  assert.match(backoffice.roadmap.rows.find(row => row.reference === 27).status, /۱۱ Projection در runtime تأیید شد/);
  assert.match(backoffice.roadmap.rows.find(row => row.reference === 79).status, /۱۷ مسیر read-only احراز شد/);
  assert.match(backoffice.roadmap.rows.find(row => row.reference === 86).status, /۱۷ مسیر read-only تأیید شد/);
  assert.equal(backoffice.roadmap.pilotBlockers.length, 3);
  assert.doesNotMatch(JSON.stringify(backoffice.roadmap), /api[_-]?key|password|Bearer|private key/i);
  assert.equal(backoffice.focus.find(item => item.id === "pilot").status, "مسدود");
  assert.equal(backoffice.organization.teams.some(team => "description" in team), false);
  assert.equal(backoffice.organization.teams[0].contract.principles.length >= 5, true);
  assert.equal(backoffice.organization.teams[0].contract.outputs.length > 0, true);
  assert.equal(backoffice.organization.teams.every(team => Array.isArray(team.details.assignments)), true);
  assert.equal(backoffice.organization.teams.every(team => Array.isArray(team.details.reviews)), true);
  assert.equal(backoffice.organization.teams.every(team => Array.isArray(team.details.deliverableReviews)), true);
  assert.equal(backoffice.organization.teams.every(team => Array.isArray(team.details.researchRequests)), true);
  assert.equal(backoffice.organization.teams.every(team => Array.isArray(team.details.trainingModules)), true);
  assert.deepEqual(backoffice.ai.providers, []);
  assert.deepEqual(backoffice.ai.models, []);
  assert.deepEqual(backoffice.ai.profiles, []);
  assert.deepEqual(backoffice.ai.bindings, []);
  assert.doesNotMatch(JSON.stringify(backoffice), /api[_-]?key\s*[:=]|access[_-]?token\s*[:=]|password\s*[:=]|Bearer\s+[A-Za-z0-9._-]{12,}|-----BEGIN/i);

  const writeAttempt = await fetch(baseUrl + "/backoffice", { method: "POST" });
  assert.equal(writeAttempt.status, 405);
  assert.equal(writeAttempt.headers.get("allow"), "GET");
  assert.equal(writeAttempt.headers.get("x-content-type-options"), "nosniff");
});

test("back office read models have a bounded response and a local rate limit", async t => {
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    now: () => "2026-08-30T12:00:00.000Z",
    backofficeRateLimit: { max: 1, windowMs: 60_000 },
    backofficeResponseLimitBytes: 1_024
  });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const oversized = await fetch(baseUrl + "/backoffice-data");
  assert.equal(oversized.status, 413);
  assert.equal(oversized.headers.get("x-content-type-options"), "nosniff");

  const limited = await fetch(baseUrl + "/backoffice-events?after=0&limit=1");
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) >= 1);
});

test("back office exposes a safe AI configuration catalog without credential references", async () => {
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

test("back office projection contains no sensitive data or raw request text", async () => {
  const dashboard = createControlDashboard({ now: () => "2026-08-30T12:00:00.000Z" });
  const request = dashboard.createRequest({ title: "درخواست خصوصی آزمایشی", description: "این متن نباید در projection بیاید." });
  const projection = dashboard.backofficeSnapshot();
  assert.equal(projection.requests.total, 1);
  assert.equal(JSON.stringify(projection).includes(request.description), false);
  assert.equal(typeof projection.createRequest, "undefined");
});

test("back office exposes current Project Memory metadata while redacting content", () => {
  const dashboard = createControlDashboard({ now: () => "2026-08-30T12:00:00.000Z" });
  dashboard.recordProjectMemory({
    memoryId: "MEM-BACKOFFICE-001",
    projectId: "hero",
    memoryKey: "project.goal",
    kind: "decision",
    scope: "project",
    status: "approved",
    content: "این متن باید فقط در حافظهٔ داخلی بماند.",
    tags: ["scope"],
    recipientRoles: ["planner"],
    source: { kind: "specification", reference: "hero://docs/spec-v1", documentVersion: "v1.0" },
    idempotencyKey: "backoffice-memory-001"
  });
  const memory = dashboard.backofficeSnapshot().projectMemory;
  assert.equal(memory.total, 1);
  assert.equal(memory.records[0].memoryKey, "project.goal");
  assert.equal(memory.records[0].source.reference, "hero://docs/spec-v1");
  assert.equal("content" in memory.records[0], false);
  assert.doesNotMatch(JSON.stringify(memory), /این متن باید فقط/);
});

test("back office exposes safe Planner state without raw request text", () => {
  const dashboard = createControlDashboard({ now: () => "2026-08-30T12:00:00.000Z" });
  const requestText = "یک داشبورد وب برای پیگیری وضعیت درخواست‌های کاربران بساز.";
  dashboard.createPlan({
    planningId: "PLAN-BACKOFFICE-001",
    requestId: "REQ-BACKOFFICE-001",
    projectId: "hero",
    requestText
  });
  const planning = dashboard.backofficeSnapshot().planning;
  assert.equal(planning.total, 1);
  assert.equal(planning.plans[0].planningId, "PLAN-BACKOFFICE-001");
  assert.equal(planning.plans[0].taskCount >= 6, true);
  assert.ok(Array.isArray(planning.plans[0].escalations));
  assert.doesNotMatch(JSON.stringify(planning), /پیگیری وضعیت درخواست‌های کاربران/);
  assert.doesNotMatch(JSON.stringify(planning), /requestText|intent/);
});

test("back office exposes Context retrieval metadata without memory content", () => {
  const dashboard = createControlDashboard({ now: () => "2026-08-30T12:00:00.000Z" });
  dashboard.recordProjectMemory({
    memoryId: "MEM-CONTEXT-BACKOFFICE-001",
    projectId: "hero",
    memoryKey: "backoffice.context.rule",
    kind: "rule",
    scope: "project",
    status: "approved",
    content: "این محتوای داخلی نباید در پنل نمایش داده شود.",
    tags: ["context", "safe"],
    recipientRoles: ["planner"],
    source: { kind: "specification", reference: "hero://docs/context-v1", documentVersion: "v1.0" },
    idempotencyKey: "backoffice-context-memory-001"
  });
  const result = dashboard.assembleAiContext({
    role: "planner",
    contextId: "CTX-BACKOFFICE-001",
    projectId: "hero",
    taskId: "TASK-BACKOFFICE-001",
    stepId: "HERO-016",
    documentVersion: "v1.0",
    idempotencyKey: "backoffice-context-001"
  });
  assert.equal(result.status, "ready");
  const memory = dashboard.backofficeSnapshot().projectMemory;
  assert.equal(memory.contextAssemblies.length, 1);
  assert.equal(memory.contextAssemblies[0].contextId, "CTX-BACKOFFICE-001");
  assert.equal(memory.contextAssemblies[0].selectedItems, 1);
  assert.equal("content" in memory.records[0], false);
  assert.doesNotMatch(JSON.stringify({ ...memory, redacted: [] }), /این محتوای داخلی|content/i);
});
