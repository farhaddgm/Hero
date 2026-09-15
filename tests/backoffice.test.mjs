import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";

test("Back Office requires a project selection before every project-scoped surface", async t => {
  const now = () => "2026-08-30T12:00:00.000Z";
  const workspace = createProjectWorkspace({ ownerUserId: "hero-owner", now });
  workspace.createProject({ actor: { subject: "hero-owner", role: "project-owner" }, projectId: "project-vpn", name: "VPN", description: "Private connectivity" });
  workspace.createProject({ actor: { subject: "hero-owner", role: "project-owner" }, projectId: "project-crm", name: "CRM", description: "Customer relationship management" });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectWorkspace: workspace });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const [path, expected] of [
    ["/backoffice", "/portfolio?select=project"],
    ["/product-studio", "/portfolio?select=project&next=studio"],
    ["/workspace", "/portfolio?select=project&next=workspace"],
    ["/project-control", "/portfolio?select=project&next=control"],
    ["/portfolio?surface=command", "/portfolio?select=project&next=command"]
  ]) {
    const selection = await fetch(baseUrl + path, { redirect: "manual" });
    assert.equal(selection.status, 302);
    assert.equal(selection.headers.get("location"), expected);
  }
  const portfolio = await fetch(baseUrl + "/portfolio?select=project");
  assert.equal(portfolio.status, 200);
  const portfolioHtml = await portfolio.text();
  assert.match(portfolioHtml, /برای ادامه، یک پروژه را انتخاب کنید/);
  assert.match(portfolioHtml, /VPN/);
  assert.match(portfolioHtml, /project-vpn[\s\S]*draft/);

  const walkthrough = await fetch(baseUrl + "/walkthrough?projectId=project-vpn");
  assert.equal(walkthrough.status, 200);
  const walkthroughHtml = await walkthrough.text();
  assert.match(walkthroughHtml, /راهنمای گام‌به‌گام ساخت محصول/);
  assert.match(walkthroughHtml, /project-vpn/);
  assert.match(walkthroughHtml, /راهنمای ساخت/);
  const proxyCompatibleWalkthrough = await fetch(baseUrl + "/portfolio?surface=walkthrough&projectId=project-vpn");
  assert.equal(proxyCompatibleWalkthrough.status, 200);
  assert.match(await proxyCompatibleWalkthrough.text(), /راهنمای گام‌به‌گام ساخت محصول/);

  const commandAlias = await fetch(baseUrl + "/portfolio?surface=command&projectId=project-vpn");
  assert.equal(commandAlias.status, 200);
  const commandHtml = await commandAlias.text();
  assert.match(commandHtml, /مرکز فرمان: VPN/);
  assert.match(commandHtml, /project-vpn/);
  assert.match(commandHtml, /Vazirmatn/);
  assert.match(commandHtml, /\/api\/ui-assets\/vazirmatn\.woff2/);
  const commandData = await fetch(baseUrl + "/portfolio-data?surface=command&projectId=project-vpn");
  assert.equal(commandData.status, 200);
  const commandPayload = await commandData.json();
  assert.equal(commandPayload.controlRoom.project.projectId, "project-vpn");
  assert.equal("backoffice" in commandPayload, false);
  assert.doesNotMatch(JSON.stringify(commandPayload), /CRM/);
  const studioData = await (await fetch(baseUrl + "/product-studio-data?projectId=project-vpn")).json();
  assert.equal(studioData.scope.projectId, "project-vpn");
  assert.equal(studioData.products.length, 1);
  assert.doesNotMatch(JSON.stringify(studioData), /CRM/);

  const font = await fetch(baseUrl + "/api/ui-assets/vazirmatn.woff2");
  assert.equal(font.status, 200);
  assert.equal(font.headers.get("content-type"), "font/woff2");
  assert.ok((await font.arrayBuffer()).byteLength > 100_000);

  const writeAttempt = await fetch(baseUrl + "/backoffice", { method: "POST" });
  assert.equal(writeAttempt.status, 405);
  assert.equal(writeAttempt.headers.get("allow"), "GET");
  assert.equal(writeAttempt.headers.get("x-content-type-options"), "nosniff");
});

test("back office reports PostgreSQL readiness when a persistence runtime is attached", async t => {
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    requirePostgres: true,
    postgresRuntime: { ping: async () => {} }
  });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch(`http://127.0.0.1:${address.port}/backoffice-data`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.backoffice.settings.persistence.runtime, "postgresql");
  assert.equal(payload.backoffice.settings.persistence.readiness, "ready");
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
