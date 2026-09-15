import assert from "node:assert/strict";
import test from "node:test";
import { getBackofficeCompletionContractSummary, validateBackofficeCompletionContract } from "../packages/contracts/src/backoffice-completion.mjs";
import { createBackofficeCompletion } from "../packages/domain/src/backoffice-completion.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

const owner = { role: "project-owner", subject: "owner-one" };
const admin = { role: "admin", subject: "admin-one" };
const viewer = { role: "viewer", subject: "viewer-one" };
const clock = () => "2026-09-11T00:00:00.000Z";

test("completion contract exposes the three base roles and bilingual surface", () => {
  assert.deepEqual(validateBackofficeCompletionContract(), []);
  const summary = getBackofficeCompletionContractSummary();
  assert.deepEqual(summary.roles, ["project-owner", "admin", "viewer"]);
  assert.deepEqual(summary.locales, ["fa", "en"]);
});

test("completion read model enforces project capabilities and bounded pagination", () => {
  const completion = createBackofficeCompletion({ now: clock });
  assert.equal(completion.capabilities({ actor: viewer, projectId: "project-one" }).readOnly, true);
  assert.throws(() => completion.setSetting({ actor: viewer, projectId: "project-one", path: "ai.model", value: "luna", reason: "change" }), /capability/);
  const page = completion.paginate({ actor: viewer, projectId: "project-one", records: [{ id: 1 }, { id: 2 }], limit: 1 });
  assert.deepEqual(page.rows, [{ id: 1 }]);
  assert.equal(page.nextCursor, 1);
  assert.throws(() => completion.paginate({ actor: viewer, projectId: "project-one", records: [], limit: 101 }), /budget/);
});

test("layered settings, correlation chains, retention and evidence remain versioned", () => {
  const completion = createBackofficeCompletion({ now: clock });
  const first = completion.setSetting({ actor: admin, projectId: "project-one", path: "ai.model", layer: "project", value: "luna", reason: "initial model" });
  const second = completion.setSetting({ actor: admin, projectId: "project-one", path: "ai.model", layer: "project", value: "sol", expectedVersion: first.version, reason: "approved model" });
  assert.equal(second.version, 2);
  assert.equal(completion.resolveSetting({ actor: viewer, projectId: "project-one", path: "ai.model" }).value, "sol");
  completion.recordTrace({ actor: admin, projectId: "project-one", traceId: "trace-root", correlationId: "corr-one", kind: "command", ref: "hero://command/one" });
  completion.recordTrace({ actor: admin, projectId: "project-one", traceId: "trace-child", parentId: "trace-root", correlationId: "corr-one", kind: "run", ref: "hero://run/one" });
  assert.equal(completion.correlationChain({ actor: viewer, projectId: "project-one", correlationId: "corr-one" }).complete, true);
  assert.throws(() => completion.setRetention({ actor: admin, projectId: "project-one", auditDays: 30, evidenceDays: 365, securityDays: 730 }), /minimum/);
  completion.setRetention({ actor: admin, projectId: "project-one", auditDays: 365, evidenceDays: 365, securityDays: 730, hold: true });
  for (const kind of ["accessibility", "security", "load", "backup-restore", "role-isolation", "traceability", "portability", "retention"]) completion.recordEvidence({ actor: admin, projectId: "project-one", evidenceId: `e-${kind}`, kind, passed: true, refs: [`hero://evidence/${kind}`] });
  assert.equal(completion.readiness({ actor: owner, projectId: "project-one" }).state, "ready-for-owner-review");
});

test("cleanup stays a dry-run and locale controls direction", () => {
  const completion = createBackofficeCompletion({ now: clock });
  assert.equal(completion.cleanupPreview({ actor: admin, projectId: "project-one", candidates: [{ id: "record-one", digest: "sha256:a" }] }).deletion, "separate-authorization-required");
  assert.equal(completion.setLocale({ actor: owner, projectId: "project-one", locale: "en" }).direction, "ltr");
});

test("project completion API is owner-authenticated and project-scoped", async t => {
  const ownerAuth = createOwnerAuth({ secret: "completion-owner-secret-12345678901234567890", now: clock });
  const token = ownerAuth.issueSession({ subject: "owner-one", sessionId: "session-completion", expiresAt: Math.floor(Date.parse(clock()) / 1000) + 900 });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now: clock, ownerAuth });
  const address = await app.start(); t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/api/projects/project-one/completion`)).status, 401);
  const response = await fetch(`${base}/api/projects/project-one/completion`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.completion.capabilities.role, "project-owner");
  const write = await fetch(`${base}/api/projects/project-one/completion`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ action: "locale", locale: "en" }) });
  assert.equal(write.status, 200);
  assert.equal((await write.json()).result.direction, "ltr");
});
