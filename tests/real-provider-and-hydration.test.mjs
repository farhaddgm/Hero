import assert from "node:assert/strict";
import test from "node:test";

import {
  createOpenAiResponsesAdapter,
  createPostgresDomainRegistrySnapshotStore
} from "../packages/adapters/src/index.mjs";
import { createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";
import { createAiOrchestration } from "../packages/domain/src/ai-orchestration.mjs";

const OWNER = { kind: "project-owner", id: "hero-owner" };
const AGENT = { kind: "agent", id: "hero-live-test" };
const now = () => "2026-08-30T12:00:00.000Z";

function liveAuthorization() {
  return {
    authorized: true,
    code: "AUTHORIZED",
    action: "external-spend",
    authorizationId: "AUTH-LIVE-001",
    projectId: "hero",
    stepId: "HERO-022",
    documentVersion: "v1.0",
    globalStop: false,
    safeCheckpointRequired: false
  };
}

test("OpenAI Responses adapter uses runtime credentials, structured JSON and usage accounting", async () => {
  const requests = [];
  const adapter = createOpenAiResponsesAdapter({
    endpoint: "https://api.example.test/v1/responses",
    credentialEnv: "TEST_OPENAI_KEY",
    env: { TEST_OPENAI_KEY: "runtime-secret-never-persisted" },
    costUnitsPer1kTokens: 10,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: "resp_test_001",
            output_text: JSON.stringify({ schema: "analysis-v1", summary: "safe" }),
            usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
          };
        }
      };
    }
  });
  await adapter.assertDispatchReady({ credentialRef: "env:TEST_OPENAI_KEY" });
  const result = await adapter.generate({
    credentialRef: "env:TEST_OPENAI_KEY",
    modelId: "gpt-test",
    role: "analyst",
    outputSchema: "analysis-v1",
    request: "تحلیل کن.",
    context: { artifact: "hero://artifact/test" }
  });
  assert.equal(result.output.schema, "analysis-v1");
  assert.equal(result.usage.totalTokens, 15);
  assert.equal(result.usage.costUnits, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers.authorization, "Bearer runtime-secret-never-persisted");
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.store, false);
  assert.deepEqual(body.text.format, { type: "json_object" });
  assert.doesNotMatch(JSON.stringify(result), /runtime-secret/);
});

test("a configured live provider still requires version-bound external-spend authorization", async () => {
  let calls = 0;
  const orchestration = createAiOrchestration({ now, externalSpendAuthorizer: async authorization => ({ authorized: true, globalStop: false, stepId: authorization.stepId, documentVersion: authorization.documentVersion }) });
  const adapter = createOpenAiResponsesAdapter({
    endpoint: "https://api.example.test/v1/responses",
    credentialEnv: "TEST_OPENAI_KEY",
    env: { TEST_OPENAI_KEY: "runtime-secret" },
    costUnitsPer1kTokens: 10,
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, async json() { return { output_text: '{"schema":"analysis-v1"}', usage: {} }; } };
    }
  });
  orchestration.registerProvider({ providerId: "openai", mode: "live", displayName: "OpenAI live", adapter, actor: OWNER, idempotencyKey: "live-provider-001" });
  orchestration.registerModel({ providerId: "openai", modelId: "gpt-test", actor: OWNER, idempotencyKey: "live-model-001" });
  orchestration.registerProfile({ profileId: "live-analyst-profile", role: "analyst", providerId: "openai", modelId: "gpt-test", credentialRef: "env:TEST_OPENAI_KEY", promptVersion: "analyst-live-v1", contextPolicy: "approved", toolPolicy: "read-only", outputSchema: "analysis-v1", status: "active", actor: OWNER, idempotencyKey: "live-profile-001" });
  orchestration.bindRole({ bindingId: "live-analyst-binding", projectId: "hero", role: "analyst", profileId: "live-analyst-profile", actor: OWNER, idempotencyKey: "live-binding-001" });

  const withoutAuthorization = await orchestration.invoke({ invocationId: "live-invocation-blocked", projectId: "hero", role: "analyst", contextSnapshotId: "live-context-blocked", request: "تحلیل کن.", context: { artifact: "hero://artifact/live" }, actor: AGENT, idempotencyKey: "live-invocation-blocked-key" });
  assert.equal(withoutAuthorization.invocation.code, "LIVE_PROVIDER_REQUIRES_SEPARATE_AUTHORIZATION");
  assert.equal(calls, 0);

  const authorized = await orchestration.invoke({ invocationId: "live-invocation-approved", projectId: "hero", taskId: "live-task", stepId: "HERO-022", documentVersion: "v1.0", role: "analyst", contextSnapshotId: "live-context-approved", request: "تحلیل کن.", context: { artifact: "hero://artifact/live" }, externalSpendAuthorization: liveAuthorization(), actor: AGENT, idempotencyKey: "live-invocation-approved-key" });
  assert.equal(authorized.invocation.status, "completed");
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(orchestration.events()), /runtime-secret/);
});

test("domain registry snapshots are append-only, secret-safe and hydrate all control-plane registries", async () => {
  const rows = new Map();
  const client = {
    async query(text, params = []) {
      if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK" || text.startsWith("SELECT pg_advisory")) return { rows: [] };
      if (text.startsWith("SELECT COALESCE(MAX(revision)")) return { rows: [{ revision: rows.size }] };
      if (text.startsWith("INSERT INTO domain_registry_snapshots")) {
        const [snapshotId, registryId, schemaVersion, revision, sourceSequence, data, capturedAt] = params;
        const row = { snapshot_id: snapshotId, registry_id: registryId, schema_version: schemaVersion, revision, source_sequence: sourceSequence, data, captured_at: capturedAt };
        rows.set(`${registryId}:${revision}`, row);
        return { rows: [row] };
      }
      if (text.includes("FROM domain_registry_snapshots")) {
        return { rows: [...rows.values()].sort((left, right) => right.revision - left.revision) };
      }
      return { rows: [] };
    }
  };
  const store = createPostgresDomainRegistrySnapshotStore({ client, now });
  const safe = { schemaVersion: "1.0", registryId: "ai-orchestration", providers: [], profiles: [{ credentialRef: "runtime:provider-key" }], authorizationCreated: false };
  const saved = await store.save({ registryId: "ai-orchestration", sourceSequence: 12, data: safe, snapshotId: "snapshot-ai-001" });
  assert.equal(saved.revision, 1);
  const hydrated = await store.hydrate({ registryIds: ["ai-orchestration", "team-registry"] });
  assert.equal(hydrated.registryCount, 1);
  assert.deepEqual(hydrated.missingRegistryIds, ["team-registry"]);
  await assert.rejects(() => store.save({ registryId: "ai-orchestration", data: { apiKey: "secret" }, snapshotId: "snapshot-ai-002" }), error => error.code === "SENSITIVE_DATA_REJECTED");

  const first = createControlDashboard({ now });
  const second = createControlDashboard({ now });
  const state = first.persistenceSnapshot();
  const result = second.hydrateFromPersistence({
    source: "test-snapshot",
    snapshots: state.registries.map(data => ({ registryId: data.registryId, schemaVersion: data.schemaVersion, sourceSequence: 1, data })),
    events: []
  });
  assert.equal(result.status, "hydrated");
  assert.equal(second.snapshot().teamControl.teams.length, 11);
  assert.equal(second.snapshot().persistenceHydration.registryCount, 11);
});
