import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKFLOW = new URL("../.github/workflows/release-candidate.yml", import.meta.url);

test("release candidate workflow is test-gated, version-bound and production-free", async () => {
  const source = await readFile(WORKFLOW, "utf8");
  assert.match(source, /push:\s*\n\s+branches:\s*\n\s+- codex\/hero-001-project-charter/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /environment:\s*\n\s+name: test/);
  assert.match(source, /contents: write/);
  assert.match(source, /packages: write/);
  assert.match(source, /pnpm check/);
  assert.match(source, /git tag --annotate/);
  assert.match(source, /git config user\.name "hero-release-bot"/);
  assert.match(source, /git config user\.email "hero-release-bot@users\.noreply\.github\.com"/);
  assert.match(source, /docker\/login-action@v3/);
  assert.match(source, /docker push "\$IMAGE_REF"/);
  assert.match(source, /RepoDigests/);
  assert.match(source, /actions\/github-script@v7/);
  assert.match(source, /prerelease: true/);
  assert.match(source, /Production deploy: not performed/);
  assert.match(source, /inputs\.release_version \|\| format\('0\.1\.0-rc\.\{0\}', github\.run_number\)/);
  assert.match(source, /printf 'release_version=%s\\ncommit_sha=%s\\nartifact=%s\\nartifact_id=%s\\n' \\\n\s+"\$RELEASE_VERSION"/);
  assert.doesNotMatch(source, /printf '[^']*\\\\n/);
  assert.doesNotMatch(source, /' \\\\\\\n/);
  assert.doesNotMatch(source, /production-promote|docker compose.*production|secrets\.(OPENAI|ANTHROPIC|GOOGLE)/i);
});

test("test verification pulls the exact published candidate instead of rebuilding it", async () => {
  const source = await readFile(new URL("../.github/workflows/release-test.yml", import.meta.url), "utf8");
  assert.match(source, /packages: read/);
  assert.match(source, /docker\/login-action@v3/);
  assert.match(source, /docker pull "\$IMAGE_REF"/);
  assert.match(source, /printf 'ghcr\.io\/%s:%s'/);
  assert.doesNotMatch(source, /printf 'ghcr\.io\/\$\{GITHUB_REPOSITORY\}/);
  assert.match(source, /RepoDigests/);
  assert.doesNotMatch(source, /docker build/);
});
