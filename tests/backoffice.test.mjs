import assert from "node:assert/strict";
import test from "node:test";

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
  assert.match(pageHtml, /همهٔ AI Roleها/);
  assert.match(pageHtml, /مفاهیم و قراردادها/);
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
  assert.match(pageHtml, /requestJson/);

  const response = await fetch(baseUrl + "/backoffice-data");
  assert.equal(response.status, 200);
  const payload = await response.json();
  const backoffice = payload.backoffice;
  assert.equal(backoffice.scope, "protected-development-backoffice");
  assert.equal(backoffice.schemaVersion, "1.1");
  assert.equal(backoffice.readOnly.enabled, true);
  assert.equal(backoffice.readOnly.uiMutationControls, true);
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
