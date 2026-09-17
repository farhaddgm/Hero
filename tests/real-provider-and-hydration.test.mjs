import assert from "node:assert/strict";
import test from "node:test";

import {
  createOpenAiResponsesAdapter,
  createPostgresDomainRegistrySnapshotStore,
  createPricingCatalogRegistry,
  createRuntimeExternalSpendAuthorizer,
  readRuntimeExternalSpendPolicy
} from "../packages/adapters/src/index.mjs";
import { createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";
import { createAiOrchestration } from "../packages/domain/src/ai-orchestration.mjs";

const OWNER = { kind: "project-owner", id: "hero-owner" };
const AGENT = { kind: "agent", id: "hero-live-test" };
const now = () => "2026-08-30T12:00:00.000Z";

function testPricingCatalog({ modelId = "gpt-test", inputPricePer1mTokens = 5, outputPricePer1mTokens = 10 } = {}) {
  const registry = createPricingCatalogRegistry({ now });
  registry.publish({
    catalogVersion: "test-pricing-v1",
    sourceUrl: "https://pricing.example.test/catalog",
    fetchedAt: "2026-08-30T00:00:00.000Z",
    validUntil: "2026-09-30T00:00:00.000Z",
    entries: [{ providerId: "openai", modelId, inputPricePer1mTokens, outputPricePer1mTokens, currency: "USD" }]
  });
  registry.activate("test-pricing-v1");
  return registry;
}

function liveAuthorization() {
  return {
    authorized: true,
    code: "AUTHORIZED",
    action: "external-spend",
    authorizationId: "AUTH-LIVE-001",
    projectId: "hero",
    stepId: "HERO-021",
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
    pricingCatalog: testPricingCatalog(),
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: "resp_test_001",
            output_text: JSON.stringify({ schema: "analysis-v1", summary: "safe runtime-secret-never-persisted" }),
            usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
          };
        }
      };
    }
  });
  await adapter.assertDispatchReady({ credentialRef: "env:TEST_OPENAI_KEY", modelId: "gpt-test", role: "analyst", outputSchema: "analysis-v1", maxOutputTokens: 100, maxCostUnits: 100, request: "تحلیل کن.", context: { artifact: "hero://artifact/test" } });
  const result = await adapter.generate({
    credentialRef: "env:TEST_OPENAI_KEY",
    modelId: "gpt-test",
    role: "analyst",
    outputSchema: "analysis-v1",
    maxOutputTokens: 100,
    maxCostUnits: 100,
    request: "تحلیل کن.",
    context: { artifact: "hero://artifact/test" }
  });
  assert.equal(result.output.schema, "analysis-v1");
  assert.equal(result.output.summary, "safe [redacted]");
  assert.equal(result.usage.totalTokens, 15);
  assert.equal(result.usage.costUnits, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers.authorization, "Bearer runtime-secret-never-persisted");
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.store, false);
  assert.deepEqual(body.text.format, {
    type: "json_schema",
    name: "hero_analysis-v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["schema", "answer"],
      properties: {
        schema: { type: "string", const: "analysis-v1" },
        answer: { type: "string" }
      }
    }
  });
  assert.equal(body.max_output_tokens, 100);
  assert.doesNotMatch(JSON.stringify(result), /runtime-secret/);
});

test("a configured live provider still requires version-bound external-spend authorization", async () => {
  let calls = 0;
  const orchestration = createAiOrchestration({ now, externalSpendAuthorizer: async authorization => ({ ...authorization, authorized: true, code: "AUTHORIZED", action: "external-spend", globalStop: false, safeCheckpointRequired: false, maxCostUnits: authorization.maxCostUnits }) });
  const adapter = createOpenAiResponsesAdapter({
    endpoint: "https://api.example.test/v1/responses",
    credentialEnv: "TEST_OPENAI_KEY",
    env: { TEST_OPENAI_KEY: "runtime-secret" },
    pricingCatalog: testPricingCatalog(),
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, async json() { return { output_text: '{"schema":"analysis-v1","answer":"token: hidden-value"}', usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }; } };
    }
  });
  orchestration.registerProvider({ providerId: "openai", mode: "live", displayName: "OpenAI live", adapter, actor: OWNER, idempotencyKey: "live-provider-001" });
  orchestration.registerModel({ providerId: "openai", modelId: "gpt-test", actor: OWNER, idempotencyKey: "live-model-001" });
  orchestration.registerProfile({ profileId: "live-analyst-profile", role: "analyst", providerId: "openai", modelId: "gpt-test", credentialRef: "env:TEST_OPENAI_KEY", promptVersion: "analyst-live-v1", contextPolicy: "approved", toolPolicy: "read-only", outputSchema: "analysis-v1", status: "active", actor: OWNER, idempotencyKey: "live-profile-001" });
  orchestration.bindRole({ bindingId: "live-analyst-binding", projectId: "hero", role: "analyst", profileId: "live-analyst-profile", actor: OWNER, idempotencyKey: "live-binding-001" });

  const withoutAuthorization = await orchestration.invoke({ invocationId: "live-invocation-blocked", projectId: "hero", role: "analyst", contextSnapshotId: "live-context-blocked", request: "تحلیل کن.", context: { artifact: "hero://artifact/live" }, actor: AGENT, idempotencyKey: "live-invocation-blocked-key" });
  assert.equal(withoutAuthorization.invocation.code, "LIVE_PROVIDER_REQUIRES_SEPARATE_AUTHORIZATION");
  assert.equal(calls, 0);

  const authorized = await orchestration.invoke({ invocationId: "live-invocation-approved", projectId: "hero", taskId: "live-task", stepId: "HERO-021", documentVersion: "v1.0", role: "analyst", contextSnapshotId: "live-context-approved", request: "تحلیل کن.", context: { artifact: "hero://artifact/live" }, externalSpendAuthorization: liveAuthorization(), actor: AGENT, idempotencyKey: "live-invocation-approved-key" });
  assert.equal(authorized.invocation.status, "completed");
  assert.equal(calls, 1);
  assert.equal(authorized.invocation.response.output.answer, "token: [redacted]");
  assert.doesNotMatch(JSON.stringify(authorized.invocation), /hidden-value/);
  assert.doesNotMatch(JSON.stringify(orchestration.events()), /runtime-secret/);
});

test("runtime external-spend authorization is exact, time-bound, cost-bound and fail-closed", async () => {
  const env = {
    HERO_EXTERNAL_SPEND_AUTHORIZATION_ACTIVE: "true",
    HERO_EXTERNAL_SPEND_AUTHORIZATION_ID: "AUTH-PILOT-001",
    HERO_EXTERNAL_SPEND_PROJECT_ID: "hero",
    HERO_EXTERNAL_SPEND_STEP_ID: "HERO-021",
    HERO_EXTERNAL_SPEND_DOCUMENT_VERSION: "v1.0",
    HERO_EXTERNAL_SPEND_PROVIDER_ID: "openai",
    HERO_EXTERNAL_SPEND_MODEL_IDS: "gpt-approved,codex-approved",
    HERO_EXTERNAL_SPEND_ROLE_IDS: "analyst,executor",
    HERO_EXTERNAL_SPEND_MAX_COST_UNITS: "50000",
    HERO_EXTERNAL_SPEND_EXPIRES_AT: "2026-09-11T00:00:00.000Z",
    HERO_EXTERNAL_SPEND_GLOBAL_STOP: "false"
  };
  const policy = readRuntimeExternalSpendPolicy({ env });
  assert.equal(policy.active, true);
  assert.equal(policy.maxCostUnits, 50_000);
  const authorizer = createRuntimeExternalSpendAuthorizer({ env, clock: () => Date.parse("2026-09-10T12:00:00.000Z") });
  const approved = await authorizer({ authorizationId: "AUTH-PILOT-001", projectId: "hero", stepId: "HERO-021", documentVersion: "v1.0", operation: "external-spend", providerId: "openai", modelId: "gpt-approved", role: "analyst", maxCostUnits: 10_000 });
  assert.equal(approved.authorized, true);
  assert.equal(approved.code, "AUTHORIZED");
  const wrongModel = await authorizer({ authorizationId: "AUTH-PILOT-001", projectId: "hero", stepId: "HERO-021", documentVersion: "v1.0", operation: "external-spend", providerId: "openai", modelId: "not-approved", role: "analyst", maxCostUnits: 10_000 });
  assert.equal(wrongModel.code, "EXTERNAL_SPEND_SCOPE_MISMATCH");
  const overBudget = await authorizer({ authorizationId: "AUTH-PILOT-001", projectId: "hero", stepId: "HERO-021", documentVersion: "v1.0", operation: "external-spend", providerId: "openai", modelId: "gpt-approved", role: "analyst", maxCostUnits: 50_001 });
  assert.equal(overBudget.code, "EXTERNAL_SPEND_SCOPE_MISMATCH");
  const expired = createRuntimeExternalSpendAuthorizer({ env, clock: () => Date.parse("2026-09-11T00:00:00.000Z") });
  assert.equal((await expired({})).code, "EXTERNAL_SPEND_AUTHORIZATION_EXPIRED");
  const stopped = createRuntimeExternalSpendAuthorizer({ env: { ...env, HERO_EXTERNAL_SPEND_GLOBAL_STOP: "true" }, clock: () => Date.parse("2026-09-10T12:00:00.000Z") });
  assert.equal((await stopped({})).code, "GLOBAL_STOP_ACTIVE");
  const inactive = createRuntimeExternalSpendAuthorizer({ env: {} });
  assert.equal((await inactive({})).code, "EXTERNAL_SPEND_AUTHORIZATION_INACTIVE");
});

test("provider cost accounting supports separate input and output rates", async () => {
  const adapter = createOpenAiResponsesAdapter({
    endpoint: "https://api.example.test/v1/responses",
    credentialEnv: "TEST_OPENAI_KEY",
    env: { TEST_OPENAI_KEY: "runtime-secret" },
    pricingCatalog: testPricingCatalog({ modelId: "gpt-test-split", inputPricePer1mTokens: 10, outputPricePer1mTokens: 40 }),
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { output_text: '{"schema":"analysis-v1"}', usage: { input_tokens: 10, output_tokens: 5 } }; } })
  });
  const readiness = await adapter.assertDispatchReady({ credentialRef: "env:TEST_OPENAI_KEY", modelId: "gpt-test-split", role: "analyst", outputSchema: "analysis-v1", maxOutputTokens: 100, maxCostUnits: 1_000, request: "تحلیل کن.", context: {} });
  assert.ok(readiness.worstCaseCostUnits <= 1_000);
  const result = await adapter.generate({ credentialRef: "env:TEST_OPENAI_KEY", modelId: "gpt-test-split", role: "analyst", outputSchema: "analysis-v1", maxOutputTokens: 100, maxCostUnits: 1_000, request: "تحلیل کن.", context: {} });
  assert.equal(result.usage.costUnits, 3);
});

test("incomplete live-provider usage fails closed instead of becoming zero cost", async () => {
  const adapter = createOpenAiResponsesAdapter({
    endpoint: "https://api.example.test/v1/responses",
    credentialEnv: "TEST_OPENAI_KEY",
    env: { TEST_OPENAI_KEY: "runtime-secret" },
    pricingCatalog: testPricingCatalog(),
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { output_text: '{"schema":"analysis-v1"}', usage: {} }; } })
  });
  await assert.rejects(
    () => adapter.generate({ credentialRef: "env:TEST_OPENAI_KEY", modelId: "gpt-test", role: "analyst", outputSchema: "analysis-v1", maxOutputTokens: 100, maxCostUnits: 1_000, request: "تحلیل کن.", context: {} }),
    error => error.code === "USAGE_INVALID"
  );
});

test("external-spend budget is cumulative, conservative and persisted across invocations", async () => {
  let calls = 0;
  const adapter = Object.freeze({
    providerId: "openai",
    mode: "live",
    async assertDispatchReady() { return { status: "ok" }; },
    async generate() { calls += 1; return { output: { schema: "analysis-v1" }, usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20, costUnits: 40 } }; },
    async validateConnection() { return { status: "ok" }; },
    listCapabilities() { return []; }
  });
  const externalSpendAuthorizer = async input => ({ ...input, authorized: true, code: "AUTHORIZED", action: "external-spend", maxCostUnits: 99, globalStop: false, safeCheckpointRequired: false });
  const orchestration = createAiOrchestration({ now, providerAdapters: { openai: adapter }, externalSpendAuthorizer });
  orchestration.registerProvider({ providerId: "openai", mode: "live", displayName: "OpenAI live", adapter, actor: OWNER, idempotencyKey: "budget-provider-001" });
  orchestration.registerModel({ providerId: "openai", modelId: "gpt-budget", actor: OWNER, idempotencyKey: "budget-model-001" });
  orchestration.registerProfile({ profileId: "budget-profile", role: "analyst", providerId: "openai", modelId: "gpt-budget", credentialRef: "env:TEST_OPENAI_KEY", promptVersion: "budget-v1", contextPolicy: "approved", toolPolicy: "read-only", outputSchema: "analysis-v1", status: "active", maxRetries: 0, maxOutputTokens: 100, maxCostUnits: 60, actor: OWNER, idempotencyKey: "budget-profile-001" });
  orchestration.bindRole({ bindingId: "budget-binding", projectId: "hero", role: "analyst", profileId: "budget-profile", actor: OWNER, idempotencyKey: "budget-binding-001" });
  const authorization = { ...liveAuthorization(), authorizationId: "AUTH-BUDGET-001" };
  const first = await orchestration.invoke({ invocationId: "budget-invocation-001", projectId: "hero", role: "analyst", contextSnapshotId: "budget-context-001", request: "تحلیل اول", context: {}, externalSpendAuthorization: authorization, actor: AGENT, idempotencyKey: "budget-invocation-key-001" });
  assert.equal(first.invocation.status, "completed");
  assert.equal(first.invocation.accountedCostUnits, 40);
  assert.equal(first.invocation.remainingSpendCostUnits, 59);
  const second = await orchestration.invoke({ invocationId: "budget-invocation-002", projectId: "hero", role: "analyst", contextSnapshotId: "budget-context-002", request: "تحلیل دوم", context: {}, externalSpendAuthorization: authorization, actor: AGENT, idempotencyKey: "budget-invocation-key-002" });
  assert.equal(second.invocation.code, "EXTERNAL_SPEND_BUDGET_EXHAUSTED");
  assert.equal(calls, 1);
  assert.deepEqual(orchestration.persistenceSnapshot().externalSpendBudgets, [{ approvalId: "AUTH-BUDGET-001", maxCostUnits: 99, spentCostUnits: 40, reservedCostUnits: 0 }]);
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
  const safe = {
    schemaVersion: "1.0",
    registryId: "ai-orchestration",
    providers: [],
    profiles: [
      { credentialRef: "runtime:provider-key" },
      { credentialRef: "vault:hero/test/openai/default" }
    ],
    authorizationCreated: false
  };
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
