import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { runIsolationChecks } from "../tools/check-isolation.mjs";
import { REPO_ROOT, isInsideRoot } from "../tools/fs-policy.mjs";

test("repository passes the clean-room scan", () => {
  const report = runIsolationChecks();
  assert.deepEqual(report.errors, []);
});

test("root policy rejects parent and sibling targets", () => {
  assert.equal(isInsideRoot(REPO_ROOT), true);
  assert.equal(isInsideRoot(path.resolve(REPO_ROOT, "..")), false);
  assert.equal(isInsideRoot(path.resolve(REPO_ROOT, "..", "another-project")), false);
});
