import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ARCHITECTURE_FLOW,
  ARCHITECTURE_LAYERS,
  ARCHITECTURE_RUNTIME,
  PROVIDER_ARCHITECTURE,
  getPublicArchitectureSummary,
  validateArchitectureContract
} from "../packages/contracts/src/architecture.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

test("the architecture contract preserves the modular control-plane and isolated-runner boundary", () => {
  assert.deepEqual(validateArchitectureContract(), []);
  assert.deepEqual(
    ARCHITECTURE_LAYERS.map(layer => layer.id),
    ["experience", "application", "domain", "ports", "adapters", "execution"]
  );
  assert.equal(getPublicArchitectureSummary().executionBoundary, "isolated-runner");
});

test("the initial provider roles are distinct and are not live integrations", () => {
  assert.deepEqual(
    PROVIDER_ARCHITECTURE.map(provider => provider.id),
    ["codex-chatgpt", "claude", "cursor"]
  );
  assert.ok(PROVIDER_ARCHITECTURE.every(provider => provider.connectionStatus === "not-connected"));
  assert.match(PROVIDER_ARCHITECTURE[1].role, /بازبینی مستقل/);
});

test("the approved architecture specification and ADR preserve the chosen technology path", () => {
  const specification = fs.readFileSync(
    path.join(REPO_ROOT, "docs", "specs", "HERO-003-v1.0.md"),
    "utf8"
  );
  const decision = fs.readFileSync(
    path.join(REPO_ROOT, "docs", "decisions", "ADR-0002-modular-monolith-and-adapter-ports.md"),
    "utf8"
  );

  assert.equal(ARCHITECTURE_RUNTIME.persistence.target, "PostgreSQL");
  assert.match(specification, /PostgreSQL/);
  assert.match(specification, /Expo\/React Native/);
  assert.match(specification, /modular-monolith-with-isolated-runners/);
  assert.match(decision, /microservice/);
  assert.ok(ARCHITECTURE_FLOW.includes("تحویل قابل فهم"));
});
