import assert from "node:assert/strict";
import test from "node:test";

import { runPf6HardeningSimulation } from "../packages/domain/src/pf6-hardening-harness.mjs";

test("PF-6 hardening simulation covers two projects, observability, failure recovery and bounded cleanup", () => {
  const result = runPf6HardeningSimulation();
  assert.equal(result.status, "passed");
  assert.equal(result.projects.length, 2);
  assert.ok(result.projects.every(item => item.hardeningMissing.length === 0));
  assert.equal(result.failureInjection.staleSliDetected, true);
  assert.equal(result.failureInjection.recoveryDetected, true);
  assert.equal(result.loadSoak.tracesWritten, 102);
  assert.equal(result.security.cleanupDeletion, false);
  assert.equal(result.security.secretValues, false);
  assert.equal(result.browserE2e.realBrowserExecuted, false);
});
