import assert from "node:assert/strict";
import test from "node:test";

import { createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOperationalDiagnostics } from "../packages/domain/src/operational-diagnostics.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

const NOW = "2026-09-04T12:00:00.000Z";
const OWNER = { kind: "project-owner", id: "hero-owner" };

function dashboard() {
  return createControlDashboard({ now: () => NOW });
}

test("operational diagnostics cover all eleven projections and are replayable", () => {
  const control = dashboard();
  const report = control.operationalDiagnostics();

  assert.equal(report.schemaVersion, "1.0");
  assert.equal(report.status, "healthy");
  assert.equal(report.registryCoverage.status, "valid");
  assert.equal(report.registryCoverage.observed, 11);
  assert.equal(report.snapshotIntegrity.status, "valid");
  assert.equal(report.eventIntegrity.status, "valid");
  assert.equal(report.replayCheck.status, "replayable");
  assert.match(report.projectionDigest.value, /^[0-9a-f]{64}$/);
  assert.equal(report.knowledgeFreshness.observedTeams, 11);
  assert.equal(report.knowledgeFreshness.counts.untracked, 11);
  assert.equal(report.assignmentConflicts.status, "clear");
  assert.equal(report.assignmentConflicts.capacityModel, "not-configured");
});

test("diagnostics record safe AI configuration history after a versioned local change", () => {
  const control = dashboard();
  control.registerAiProvider({ providerId: "openai", mode: "deterministic", displayName: "OpenAI deterministic", actor: OWNER, idempotencyKey: "diagnostic-provider-001" });
  control.registerAiModel({ providerId: "openai", modelId: "chatgpt", displayName: "ChatGPT", actor: OWNER, idempotencyKey: "diagnostic-model-001" });
  const report = control.operationalDiagnostics();

  assert.equal(report.aiConfiguration.counts.providers, 1);
  assert.equal(report.aiConfiguration.counts.models, 1);
  assert.equal(report.aiConfiguration.changes.length, 2);
  assert.ok(report.aiConfiguration.changes.every(event => event.data.providerId === "openai"));
  assert.doesNotMatch(JSON.stringify(report.aiConfiguration), /runtime:[A-Za-z0-9._:-]+|Bearer\s|sk-[A-Za-z0-9]/i);
});

test("diagnostics fail closed for an unknown event without mutating anything", () => {
  const control = dashboard();
  const snapshot = control.persistenceSnapshot();
  const report = createOperationalDiagnostics({
    persistenceSnapshot: snapshot,
    events: [{
      eventId: "evt_bad_diagnostic_001",
      aggregateType: "team",
      aggregateId: "mahsulo",
      aggregateVersion: 1,
      type: "unknown.event",
      occurredAt: NOW,
      actor: OWNER,
      data: {}
    }],
    now: NOW
  });

  assert.equal(report.status, "attention");
  assert.equal(report.eventIntegrity.status, "invalid");
  assert.ok(report.eventIntegrity.issues.some(issue => issue.code === "UNKNOWN_EVENT_TYPE"));
  assert.equal(report.registryCoverage.observed, 11);
});

test("operational diagnostics HTTP endpoint is owner-gated and metadata-only", async t => {
  const ownerAuth = createOwnerAuth({ secret: "test-only-diagnostics-owner-secret-1234567890", now: () => NOW });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now: () => NOW, ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const token = ownerAuth.issueSession({ subject: "diagnostics-owner", sessionId: "diagnostics-session-001", expiresAt: 2_000_000_000 });

  const denied = await fetch(baseUrl + "/api/operations/diagnostics");
  assert.equal(denied.status, 401);
  const accepted = await fetch(baseUrl + "/api/operations/diagnostics", { headers: { authorization: `Bearer ${token}` } });
  assert.equal(accepted.status, 200);
  const body = await accepted.json();
  assert.equal(body.diagnostics.registryCoverage.observed, 11);
  assert.doesNotMatch(JSON.stringify(body), /runtime:[A-Za-z0-9._:-]+|Bearer\s|sk-[A-Za-z0-9]|outputSchema.*prompt/i);
});
