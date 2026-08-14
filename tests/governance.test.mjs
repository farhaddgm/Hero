import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateGovernance } from "../tools/check-governance.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

test("governance contract and active roadmap snapshot are valid", () => {
  const result = validateGovernance();
  assert.deepEqual(result.errors, []);
  assert.equal(result.snapshot.steps.length, 21);
});

test("sensitive actions are excluded from development authority", () => {
  const { governance, snapshot } = validateGovernance();
  const enabled = new Set(snapshot.operations);
  for (const operation of governance.scope.excludedUntilSeparatelyApproved) {
    assert.equal(enabled.has(operation), false, operation);
    assert.ok(snapshot.excludedOperations.includes(operation), operation);
  }
});

test("human-readable charter matches the machine authorization identity", () => {
  const charter = fs.readFileSync(
    path.join(REPO_ROOT, "docs", "governance", "PROJECT_CHARTER.md"),
    "utf8"
  );
  assert.match(charter, /BATCH-ROADMAP-20260814-001/);
  assert.match(charter, /HERO-001/);
  assert.match(charter, /Production/);
  assert.match(charter, /Clean-room/);
});
