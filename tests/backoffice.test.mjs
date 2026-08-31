import assert from "node:assert/strict";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";

test("read-only development back office exposes a safe orientation projection", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now: () => "2026-08-30T12:00:00.000Z" });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const page = await fetch(baseUrl + "/backoffice");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /بک‌آفیس توسعهٔ Hero/);

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
  assert.doesNotMatch(JSON.stringify(backoffice), /api[_-]?key\s*[:=]|access[_-]?token\s*[:=]|password\s*[:=]|Bearer\s+[A-Za-z0-9._-]{12,}|-----BEGIN/i);
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
