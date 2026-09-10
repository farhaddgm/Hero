import assert from "node:assert/strict";
import test from "node:test";

import { validateBackofficeBaseline } from "../tools/check-backoffice-baseline.mjs";

test("approved Back Office baseline covers every requirement and ordered development step", () => {
  const result = validateBackofficeBaseline();
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.specification, "HERO-SPEC-022@1.0.0");
  assert.equal(result.requirementCount, 81);
  assert.equal(result.traceCount, 81);
  assert.equal(result.planStepCount, 170);
  assert.equal(result.workPackageCount, 15);
  assert.equal(Object.values(result.statusCounts).reduce((sum, value) => sum + value, 0), 81);
});

test("Back Office baseline fails closed for a missing trace entry and an expanded authorization", async () => {
  const current = validateBackofficeBaseline();
  assert.equal(current.ok, true);

  const trace = JSON.parse(JSON.stringify((await import("../config/backoffice/requirement-trace-v1.0.json", { with: { type: "json" } })).default));
  trace.requirements.pop();
  const authorization = JSON.parse(JSON.stringify((await import("../config/authorizations/backoffice-20260910-001.json", { with: { type: "json" } })).default));
  authorization.steps.push({ stepId: "BO-011", documentVersion: "1.0.0" });
  authorization.operations.push("production-deploy");

  const result = validateBackofficeBaseline({ trace, authorization });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === "TRACE_REQUIREMENT_MISSING"));
  assert.ok(result.errors.some(error => error.code === "AUTH_STEP_SCOPE_INVALID"));
  assert.ok(result.errors.some(error => error.code === "AUTH_OPERATION_INVALID"));
  assert.ok(result.errors.some(error => error.code === "SENSITIVE_OPERATION_GRANTED"));
});
