import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = file => readFile(new URL("../" + file, import.meta.url), "utf8");

test("Test promotion is manifest-bound, metadata-only backed up and auto-rollback capable", async () => {
  const source = await read("tools/promote-test-immutable.sh");
  assert.match(source, /--manifest/);
  assert.match(source, /release_json_validate_manifest/);
  assert.doesNotMatch(source, /\bnode\b/);
  assert.match(source, /metadata-only/i);
  assert.match(source, /auto-rolled-back/);
  assert.match(source, /build-info/);
  assert.match(source, /--no-deps --no-build --force-recreate control-plane/);
  assert.doesNotMatch(source, /cp --|tar .*env|production-deploy/);
});

test("manual rollback is Test-scoped and refuses non-immutable state", async () => {
  const source = await read("tools/rollback-test-immutable.sh");
  assert.match(source, /hero\.test-release-state\/v1/);
  assert.match(source, /validate_digest/);
  assert.match(source, /Refusing a production-named environment file/);
  assert.match(source, /release_json_write_rollback_state/);
  assert.doesNotMatch(source, /\bnode\b/);
  assert.match(source, /--no-deps --no-build --force-recreate control-plane/);
});

test("GHCR checker never accepts a mutable tag", async () => {
  const source = await read("tools/check-ghcr-access.sh");
  assert.match(source, /manifest inspect/);
  assert.match(source, /sha256:\[a-f0-9\]\{64\}/);
  assert.match(source, /read:packages/);
  assert.doesNotMatch(source, /(?:TOKEN|PASSWORD|SECRET)=\$|printf .*\$\{(?:TOKEN|PASSWORD|SECRET)/i);
});

test("Docker-only Test hosts use jq or Python for release metadata, never host Node", async () => {
  const helper = await read("tools/release-json.sh");
  const verify = await read("tools/verify-test-release.sh");
  assert.match(helper, /command -v jq/);
  assert.match(helper, /command -v python3/);
  assert.match(helper, /fsync/);
  assert.doesNotMatch(verify, /\bnode\b/);
});
