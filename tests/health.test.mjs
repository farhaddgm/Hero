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
