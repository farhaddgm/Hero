import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "../tools/fs-policy.mjs";

test("environment example is scoped and secret-free", () => {
  const examples = [
    ".env.example",
    "deploy/test/hero-test.env.example",
    "deploy/production/hero-production.env.example"
  ];
  for (const name of examples) {
    const content = fs.readFileSync(path.join(REPO_ROOT, name), "utf8");
    const keys = content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
      .map(line => line.split("=", 1)[0]);
    assert.ok(keys.every(key => key.startsWith("HERO_")), name);
    assert.doesNotMatch(content, /(?:api[_-]?key|password|secret|token)[ \t]*=[ \t]*\S+/i, name);
  }
});

test("compose resources are isolated and host binding is configurable", () => {
  const compose = fs.readFileSync(path.join(REPO_ROOT, "compose.yaml"), "utf8");
  assert.match(compose, /hero-data/);
  assert.match(compose, /hero-private/);
  assert.match(compose, /HERO_BIND_ADDRESS/);
  assert.match(compose, /HERO_EXPOSE_PORT/);
  assert.doesNotMatch(compose, /container_name:/);
});

test("runtime image is pinned, non-root, and health checked", () => {
  const dockerfile = fs.readFileSync(path.join(REPO_ROOT, "Dockerfile"), "utf8");
  assert.match(dockerfile, /node:22\.13\.1-alpine/);
  assert.match(dockerfile, /USER hero/);
  assert.match(dockerfile, /HEALTHCHECK/);
});

test("transfer runbook keeps source, backup and restore evidence explicitly separate", () => {
  const runbook = fs.readFileSync(path.join(REPO_ROOT, "docs", "operations", "MOVE-TO-ANOTHER-SERVER.md"), "utf8");
  assert.match(runbook, /PORTABILITY_VERIFIED/);
  assert.match(runbook, /checksum/);
  assert.match(runbook, /separate authorization/);
});
