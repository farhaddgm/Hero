import assert from "node:assert/strict";
import test from "node:test";

import {
  HERO_REPOSITORY_READ_CONTEXT_MAX_BYTES,
  HERO_REPOSITORY_READ_CONTEXT_VERSION,
  createRepositoryReadContext
} from "../apps/control-plane/src/repository-read-context.mjs";

test("repository context exposes safe project code and documents without host or secret boundaries", () => {
  assert.equal(HERO_REPOSITORY_READ_CONTEXT_VERSION, "1.0.0");
  const reader = createRepositoryReadContext({ root: process.cwd(), now: () => "2026-09-18T12:00:00.000Z" });
  const context = reader.build({
    sourceFiles: ["apps/control-plane/src/smart-tester.mjs"],
    surface: "/workspace",
    featureKey: "workspace.intake",
    question: "کد و سند مربوط به Smart Tester و فضای کاری پروژه را بررسی کن."
  });
  const serialized = JSON.stringify(context);
  assert.equal(context.access.mode, "read-only");
  assert.equal(context.access.sensitiveValuesIncluded, false);
  assert.equal(context.access.codeMutation, false);
  assert.equal(context.access.externalFetch, false);
  assert.ok(context.availableFiles.some(file => file.path === "apps/control-plane/src/smart-tester.mjs"));
  assert.ok(context.availableFiles.some(file => file.path === "docs/operations/HERO-SMART-TESTER.md"));
  assert.ok(context.files.some(file => file.path === "apps/control-plane/src/smart-tester.mjs"));
  assert.doesNotMatch(serialized, /(?:^|[\\/])\.env(?:\.|$)/i);
  assert.doesNotMatch(serialized, /(?:^|[\\/])node_modules(?:[\\/]|$)/i);
  assert.doesNotMatch(serialized, /(?:^|[\\/])\.git(?:[\\/]|$)/i);
  assert.doesNotMatch(serialized, /\/opt\/hero|\/home\/|[A-Z]:[\\/](?:Users|home|opt|tmp)[\\/]/i);
  assert.ok(Buffer.byteLength(serialized, "utf8") <= HERO_REPOSITORY_READ_CONTEXT_MAX_BYTES);
});

test("repository context never follows an unsafe requested source path", () => {
  const reader = createRepositoryReadContext({ root: process.cwd() });
  const context = reader.build({ sourceFiles: ["../other-project/secret.mjs", "/opt/hero/.env"] });
  assert.equal(context.access.sensitiveValuesIncluded, false);
  assert.equal(context.files.some(file => file.path.includes("other-project") || file.path.includes(".env")), false);
});
