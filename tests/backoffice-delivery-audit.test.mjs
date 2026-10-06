import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "../tools/fs-policy.mjs";
import { validateBackofficeDeliveryAudit } from "../tools/check-backoffice-delivery-audit.mjs";

const source = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "config/backoffice/delivery-audit-v1.0.json"), "utf8"));

test("delivery audit covers every BO-001..BO-170 step exactly once", () => {
  const result = validateBackofficeDeliveryAudit({ audit: structuredClone(source) });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.stepCount, 170);
  assert.deepEqual(result.counts, {
    verified: 70,
    partial: 72,
    gated: 26,
    owner_pending: 1,
    deferred: 1
  });
  assert.equal(result.requirementCount, 81);
  assert.deepEqual(result.requirementCounts, {
    implemented: 10,
    partial: 71,
    missing: 0
  });
});

test("delivery audit fails closed when coverage or totals are overstated", () => {
  const missing = structuredClone(source);
  missing.ranges.shift();
  assert.ok(validateBackofficeDeliveryAudit({ audit: missing }).errors.some(error => error.code === "MISSING_STEP"));

  const overstated = structuredClone(source);
  overstated.summary.verified += 1;
  assert.ok(validateBackofficeDeliveryAudit({ audit: overstated }).errors.some(error => error.code === "SUMMARY_MISMATCH"));

  const staleRequirements = structuredClone(source);
  staleRequirements.requirement_current.partial -= 1;
  staleRequirements.requirement_current.implemented += 1;
  assert.ok(validateBackofficeDeliveryAudit({ audit: staleRequirements }).errors.some(error => error.code === "REQUIREMENT_SUMMARY_MISMATCH"));
});
