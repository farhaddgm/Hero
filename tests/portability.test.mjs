import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "../tools/fs-policy.mjs";

test("environment example is scoped and secret-free", () => {
  const content = fs.readFileSync(path.join(REPO_ROOT, ".env.example"), "utf8");
  const keys = content.split(/\r?\n/).filter(Boolean).map(line => line.split("=", 1)[0]);
  assert.ok(keys.every(key => key.startsWith("HERO_")));
  assert.doesNotMatch(content, /(?:api[_-]?key|password|secret|token)\s*=\s*\S+/i);
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
