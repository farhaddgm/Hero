import assert from "node:assert/strict";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";

test("health and readiness endpoints expose the clean-room service", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const health = await fetch("http://127.0.0.1:" + address.port + "/health");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    service: "hero-control-plane",
    version: "0.1.0",
    status: "ok"
  });

  const ready = await fetch("http://127.0.0.1:" + address.port + "/ready");
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).boundary, "clean-room");
});

test("build-info exposes the exact release identity without changing health contract", async t => {
  const imageDigest = "ghcr.io/farhaddgm/hero@sha256:" + "b".repeat(64);
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    releaseVersion: "1.2.3",
    sourceCommit: "0123456",
    imageDigest
  });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/build-info");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "hero-control-plane",
    releaseVersion: "1.2.3",
    sourceCommit: "0123456",
    imageDigest,
    serviceVersion: "0.1.0"
  });
});

test("unknown paths return a scoped JSON 404", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/unknown");
  assert.equal(response.status, 404);
  assert.equal((await response.json()).service, "hero-control-plane");
});

test("architecture endpoint exposes only the approved public architecture summary", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/architecture");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.architecture.style, "modular-monolith-with-isolated-runners");
  assert.equal(payload.architecture.executionBoundary, "isolated-runner");
  assert.deepEqual(
    payload.architecture.providers.map(provider => provider.id),
    ["codex-chatgpt", "claude", "cursor"]
  );
  assert.ok(payload.architecture.providers.every(provider => provider.connectionStatus === "not-connected"));
});

test("data-contract endpoint exposes the safe operational data summary", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/data-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.dataContract.appendOnly, true);
  assert.equal(payload.dataContract.secretSafe, true);
  assert.equal(payload.dataContract.durableDispatch, "postgresql-outbox");
});

test("workflow endpoint exposes the explicit lifecycle without operational records", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/workflow-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.workflowContract.sourceOfTruth, "append-only-event-log");
  assert.ok(payload.workflowContract.states.includes("paused"));
  assert.ok(payload.workflowContract.actions.includes("retry"));
});

test("authorization endpoint exposes only the fail-closed governance contract", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/authorization-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.authorizationContract.matchingRule, "authorization id + exact step id + exact document version + granted operation");
  assert.ok(payload.authorizationContract.decisionCodes.includes("GLOBAL_STOP_ACTIVE"));
  assert.ok(payload.authorizationContract.separatelyApprovedOperations.includes("production-deploy"));
});

test("owner auth endpoint exposes only the signed-session boundary", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/owner-auth-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ownerAuthContract.scheme, "signed bearer session");
  assert.equal(payload.ownerAuthContract.failClosed, true);
  assert.equal(payload.ownerAuthContract.secretBoundary.includes("never logged"), true);
});

test("AI orchestration endpoint exposes replaceable roles without implying live providers", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/ai-orchestration-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.aiOrchestrationContract.roles.includes("decision-maker"));
  assert.ok(payload.aiOrchestrationContract.providers.includes("openai-compatible"));
  assert.ok(payload.aiOrchestrationContract.providers.includes("cursor"));
  assert.match(payload.aiOrchestrationContract.invariants.join(" "), /Team != AI Role/);
});

test("readiness reports the configured persistence boundary", async t => {
  const app = createHeroServer({
    host: "127.0.0.1",
    port: 0,
    postgresRuntime: { ping: async () => ({ status: "ok" }) }
  });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/ready");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).persistence, "postgresql");
});

test("required PostgreSQL keeps readiness fail-closed when persistence is missing", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0, requirePostgres: true });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/ready");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    service: "hero-control-plane",
    status: "not_ready",
    code: "PERSISTENCE_NOT_CONFIGURED",
    boundary: "clean-room",
    persistence: "postgresql-required"
  });
});

test("training contract is public while team training plans stay owner-authenticated", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const contract = await fetch("http://127.0.0.1:" + address.port + "/training-contract");
  assert.equal(contract.status, 200);
  assert.equal((await contract.json()).trainingContract.benchmarkCount, 11);

  const denied = await fetch("http://127.0.0.1:" + address.port + "/api/teams/mahsulo/training-plan");
  assert.equal(denied.status, 503);
});

test("team research, default principles and output advisory contracts are public summaries", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const principles = await fetch("http://127.0.0.1:" + address.port + "/team-principles");
  assert.equal(principles.status, 200);
  assert.equal((await principles.json()).teamPrinciples.length, 11);
  const research = await fetch("http://127.0.0.1:" + address.port + "/team-research-contract");
  assert.equal((await research.json()).teamResearchContract.requirements.minimumSources, 3);
  const output = await fetch("http://127.0.0.1:" + address.port + "/output-advisory-contract");
  assert.equal((await output.json()).outputAdvisoryContract.outputTypes.includes("web-app"), true);
});

test("runner endpoint exposes only the isolated execution contract", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/runner-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.runnerContract.defaultLimits.network, "disabled");
  assert.equal(payload.runnerContract.defaultLimits.maxConcurrentRunners, 1);
  assert.ok(payload.runnerContract.states.includes("checkpointed"));
  assert.equal(payload.productRunnerContract.defaults.networkMode, "none");
  assert.equal(payload.productRunnerContract.defaults.shell, false);
});

test("fake agent endpoint exposes deterministic no-provider scenarios only", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/fake-agent-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.fakeAgentContract.providerBoundary.includes("no network"), true);
  assert.ok(payload.fakeAgentContract.scenarios.includes("failure-then-retry"));
  assert.ok(payload.fakeAgentContract.scenarios.includes("pause-resume"));
});

test("provider-agent endpoint describes a disabled-by-default ChatGPT and Codex boundary", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/provider-agent-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.providerAgentContract.providers, ["chatgpt", "codex"]);
  assert.deepEqual(payload.providerAgentContract.resultFields, ["files", "tests", "errors", "artifact"]);
  assert.match(payload.providerAgentContract.safetyBoundary, /disabled by default/);
});

test("Claude review endpoint describes an independent, no-fix review boundary", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/claude-review-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.claudeReviewContract.provider, "claude");
  assert.deepEqual(payload.claudeReviewContract.categories, ["architecture", "security", "edge-case", "tests"]);
  assert.match(payload.claudeReviewContract.correctionBoundary, /separately authorized task/);
});

test("Cursor handoff endpoint describes a portable, human-controlled boundary", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/cursor-handoff-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.cursorHandoffContract.provider, "cursor");
  assert.deepEqual(payload.cursorHandoffContract.states, ["ready", "blocked"]);
  assert.match(payload.cursorHandoffContract.portabilityBoundary, /relative workspace references/);
  assert.match(payload.cursorHandoffContract.safetyBoundary, /explicit human confirmation/);
});

test("project memory endpoint exposes only the versioned minimum-context contract", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/project-memory-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.projectMemoryContract.sourceOfTruth, "versioned-append-only-memory");
  assert.ok(payload.projectMemoryContract.recordKinds.includes("decision"));
  assert.match(payload.projectMemoryContract.safetyBoundary, /host paths/);
});

test("planner endpoint exposes a bounded, explained routing contract", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/planner-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.plannerContract.providers, ["chatgpt", "codex", "claude", "cursor"]);
  assert.equal(payload.plannerContract.input.includes("Persian"), true);
  assert.match(payload.plannerContract.stopRule, /halted before dispatch/);
});

test("Quality Gate endpoint exposes a bounded test, review and correction contract", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/quality-gate-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.qualityGateContract.states.includes("approved"));
  assert.ok(payload.qualityGateContract.states.includes("stopped"));
  assert.match(payload.qualityGateContract.flow, /separately authorized correction/);
  assert.match(payload.qualityGateContract.safetyBoundary, /does not invoke a provider/);
});

test("Web Factory endpoint exposes the portable, Preview-gated application preset", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/web-factory-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.webFactoryContract.targetStack.frontend, "Next.js + React + TypeScript");
  assert.ok(payload.webFactoryContract.decisionCodes.includes("PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION"));
  assert.match(payload.webFactoryContract.safetyBoundary, /does not provision a database/);
});

test("Mobile Factory endpoint exposes the portable Expo preset and separate build gates", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/mobile-factory-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.mobileFactoryContract.targetStack.mobile, "Expo + React Native + TypeScript");
  assert.ok(payload.mobileFactoryContract.decisionCodes.includes("ANDROID_PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION"));
  assert.ok(payload.mobileFactoryContract.decisionCodes.includes("IOS_CLOUD_BUILD_REQUIRES_SEPARATE_AUTHORIZATION"));
  assert.match(payload.mobileFactoryContract.safetyBoundary, /does not install Expo/);
});

test("Assurance Gate endpoint exposes local CI, security, observability and cost controls", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/assurance-gate-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.assuranceGateContract.checks.includes("CI evidence"));
  assert.ok(payload.assuranceGateContract.decisionCodes.includes("RELEASE_REQUIRES_SEPARATE_AUTHORIZATION"));
  assert.match(payload.assuranceGateContract.safetyBoundary, /does not dispatch CI/);
});

test("Portability Gate endpoint exposes transfer readiness without host operations", async t => {
  const app = createHeroServer({ host: "127.0.0.1", port: 0 });
  const address = await app.start();
  t.after(() => app.stop());

  const response = await fetch("http://127.0.0.1:" + address.port + "/portability-gate-contract");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.portabilityGateContract.checks.includes("checksum-bound backup evidence"));
  assert.ok(payload.portabilityGateContract.decisionCodes.includes("TRANSFER_REQUIRES_SEPARATE_AUTHORIZATION"));
  assert.match(payload.portabilityGateContract.safetyBoundary, /never copies a repository/);
});
