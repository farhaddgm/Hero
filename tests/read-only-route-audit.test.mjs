import assert from "node:assert/strict";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

const PUBLIC_GET_ROUTES = Object.freeze([
  "/",
  "/health",
  "/ready",
  "/architecture",
  "/data-contract",
  "/workflow-contract",
  "/authorization-contract",
  "/runner-contract",
  "/fake-agent-contract",
  "/provider-agent-contract",
  "/claude-review-contract",
  "/cursor-handoff-contract",
  "/project-memory-contract",
  "/planner-contract",
  "/quality-gate-contract",
  "/web-factory-contract",
  "/mobile-factory-contract",
  "/assurance-gate-contract",
  "/portability-gate-contract",
  "/team-contract",
  "/training-contract",
  "/team-research-contract",
  "/output-advisory-contract",
  "/principles-contract",
  "/release-contract",
  "/owner-auth-contract",
  "/admin-auth-contract",
  "/ai-orchestration-contract",
  "/skill-contract",
  "/organization-advisor-contract",
  "/ai-benchmark-contract",
  "/organization-performance-contract",
  "/observability-contract",
  "/pilot-contract"
]);

const BACKOFFICE_GET_ROUTES = Object.freeze([
  "/backoffice",
  "/backoffice-data",
  "/backoffice-events?after=0&limit=2"
]);

const OWNER_GET_ROUTES = Object.freeze([
  "/api/dashboard",
  "/api/operations/diagnostics",
  "/api/ai-orchestration",
  "/api/ai/events?after=0",
  "/api/ai/benchmarks",
  "/api/ai/benchmarks/compare?limit=2",
  "/api/ai/skills",
  "/api/ai/organization-advisor",
  "/api/teams",
  "/team-principles",
  "/api/audit?after=0&limit=2",
  "/api/audit/read-access?after=0&limit=2"
]);

test("exhaustive read-only route audit covers public, back office and owner surfaces", async t => {
  const now = () => "2026-09-05T12:00:00.000Z";
  const ownerAuth = createOwnerAuth({ secret: "test-only-read-route-audit-owner-secret-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "read-route-audit-session", expiresAt: 2_000_000_000 });
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    now,
    ownerAuth,
    backofficeAuth: { username: "hero-test-user", password: "test-backoffice-password-123" },
    postgresRuntime: {
      async ping() { return { status: "ok" }; },
      store: { async readAfter() { return []; } },
      accessAudit: {
        async record() {},
        async list() { return { entries: [], nextAfter: 0, hasMore: false }; }
      }
    }
  });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const basic = "Basic " + Buffer.from("hero-test-user:test-backoffice-password-123").toString("base64");
  const owner = { authorization: `Bearer ${token}` };
  const get = async (path, headers = {}) => {
    const response = await fetch(base + path, { headers });
    await response.arrayBuffer();
    return response;
  };

  for (const path of PUBLIC_GET_ROUTES) assert.equal((await get(path)).status, 200, path);
  for (const path of BACKOFFICE_GET_ROUTES) assert.equal((await get(path, { authorization: basic })).status, 200, path);
  for (const path of OWNER_GET_ROUTES) assert.equal((await get(path, owner)).status, 200, path);

  const emptyComparison = await fetch(base + "/api/ai/benchmarks/compare?limit=2", { headers: owner });
  assert.deepEqual((await emptyComparison.json()).comparison, {
    compared: 0,
    eligible: 0,
    winner: null,
    decision: "advisory-only",
    runs: []
  });

  const teams = (await (await fetch(base + "/api/teams", { headers: owner })).json()).teamControl.teams;
  assert.equal(teams.length, 11);
  const dynamicRoutes = teams.slice(0, 3).flatMap(team => [
    `/api/teams/${team.teamId}/contract-history`,
    `/api/teams/${team.teamId}/training-plan`,
    `/api/teams/${team.teamId}/research-requests`
  ]);
  for (const path of dynamicRoutes) assert.equal((await get(path, owner)).status, 200, path);
  assert.equal(PUBLIC_GET_ROUTES.length + BACKOFFICE_GET_ROUTES.length + OWNER_GET_ROUTES.length + dynamicRoutes.length, 58);
});
