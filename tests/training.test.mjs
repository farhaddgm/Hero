import assert from "node:assert/strict";
import test from "node:test";

import {
  TEAM_TRAINING_BENCHMARKS,
  TRAINING_MODULE_DEFINITIONS,
  getTeamTrainingPlan,
  getTrainingContractSummary,
  validateTrainingContract
} from "../packages/contracts/src/training.mjs";
import { createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";

test("training contract covers all eleven teams and all five passing modules", () => {
  assert.deepEqual(validateTrainingContract(), []);
  assert.equal(TEAM_TRAINING_BENCHMARKS.length, 11);
  assert.equal(TRAINING_MODULE_DEFINITIONS.length, 5);
  assert.equal(getTrainingContractSummary().passScore, 80);
  assert.ok(TEAM_TRAINING_BENCHMARKS.every(benchmark => getTeamTrainingPlan(benchmark.teamId)?.benchmark.teamId === benchmark.teamId));
});

test("dashboard exposes a bounded training plan and current readiness without mutating state", () => {
  const dashboard = createControlDashboard();
  const first = dashboard.teamTrainingPlan("mahsulo");
  const second = dashboard.teamTrainingPlan("mahsulo");
  assert.equal(first.plan.version, "1.0");
  assert.equal(first.plan.benchmark.teamId, "mahsulo");
  assert.equal(first.current.ready, false);
  assert.deepEqual(first.current.missingModules, ["mission", "safety", "output-contract", "collaboration", "quality"]);
  assert.deepEqual(second, first);
});

test("training plans fail closed for an unknown team", () => {
  assert.throws(() => createControlDashboard().teamTrainingPlan("unknown-team"), error => error.code === "TEAM_NOT_FOUND");
});
