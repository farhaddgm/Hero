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
