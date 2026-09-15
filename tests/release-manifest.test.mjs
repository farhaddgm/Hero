import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createReleaseManifest,
  validateReleaseManifest
} from "../packages/contracts/src/release-manifest.mjs";
import { writeReleaseManifest } from "../tools/create-release-manifest.mjs";

const artifact = "ghcr.io/farhaddgm/hero@sha256:" + "a".repeat(64);
const commitSha = "0123456789abcdef0123456789abcdef01234567";

test("release manifest accepts only immutable Test artifacts and is secret-safe", () => {
  const manifest = createReleaseManifest({
    releaseVersion: "1.2.3-rc.4",
    commitSha,
    artifact,
    workflowRunId: 42,
    createdAt: "2026-09-16T12:00:00.000Z"
  });
  assert.deepEqual(validateReleaseManifest(manifest), []);
  assert.equal(manifest.environment, "test");
  assert.equal(Object.keys(manifest).some(key => /secret|password|token|key/i.test(key)), false);
});

test("release manifest rejects tags, production and malformed metadata", () => {
  const base = createReleaseManifest({ releaseVersion: "1.2.3", commitSha, artifact });
  assert.match(validateReleaseManifest({ ...base, artifact: "ghcr.io/farhaddgm/hero:latest" }).join("\n"), /artifact/);
  assert.match(validateReleaseManifest({ ...base, environment: "production" }).join("\n"), /Test/);
  assert.match(validateReleaseManifest({ ...base, releaseVersion: "latest" }).join("\n"), /SemVer/);
  assert.match(validateReleaseManifest({ ...base, releaseUrl: "https://evil.example/release" }).join("\n"), /releaseUrl/);
});

test("release manifest writer creates an atomic mode-restricted file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hero-release-manifest-"));
  try {
    const result = writeReleaseManifest({ repositoryRoot: root, output: "manifest.json", releaseVersion: "1.2.3", commitSha, artifact });
    const contents = JSON.parse(await readFile(result.output, "utf8"));
    assert.equal(contents.artifact, artifact);
    assert.equal((await stat(result.output)).mode & 0o777, 0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release manifest writer rejects symlinked output paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hero-release-manifest-link-"));
  try {
    await symlink(root, path.join(root, "linked"), "dir");
    assert.throws(() => writeReleaseManifest({ repositoryRoot: root, output: "linked/manifest.json", releaseVersion: "1.2.3", commitSha, artifact }), /symlink/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
