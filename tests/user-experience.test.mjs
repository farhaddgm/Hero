import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ALWAYS_SEPARATELY_APPROVED_ACTIONS,
  COLLABORATION_MODES,
  SIMPLE_DEVELOPMENT_STATUSES,
  UX_QUESTION_POLICY,
  UX_REQUIRED_SCREENS,
  validateUserExperienceContract
} from "../packages/contracts/src/user-experience.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

test("the user-experience contract keeps a simple Persian status vocabulary", () => {
  assert.deepEqual(validateUserExperienceContract(), []);
  assert.equal(SIMPLE_DEVELOPMENT_STATUSES.completed, "تکمیل");
  assert.equal(SIMPLE_DEVELOPMENT_STATUSES.needsUserDecision, "نیاز به تصمیم شما");
  assert.equal(UX_QUESTION_POLICY.maximumQuestionsPerTurn, 3);
});

test("full autonomy stays bounded and sensitive actions remain separately approved", () => {
  assert.equal(COLLABORATION_MODES.guided.default, true);
  assert.equal(
    COLLABORATION_MODES.fullAutonomySnapshot.authorizationModel,
    "versioned-snapshot"
  );

  for (const action of ALWAYS_SEPARATELY_APPROVED_ACTIONS) {
    assert.equal(COLLABORATION_MODES.fullAutonomySnapshot.allowedOperations.includes(action), false);
  }
});

test("the approved UX specification and initial screens stay aligned", () => {
  const specification = fs.readFileSync(
    path.join(REPO_ROOT, "docs", "specs", "HERO-002-v1.0.md"),
    "utf8"
  );

  for (const status of Object.values(SIMPLE_DEVELOPMENT_STATUSES)) {
    assert.match(specification, new RegExp(status));
  }

  for (const screen of ["خانه", "جزئیات کار", "مرکز تصمیم", "تحویل"]) {
    assert.match(specification, new RegExp(screen));
  }

  assert.equal(UX_REQUIRED_SCREENS.length, 4);
  assert.match(specification, /حداکثر سه پرسش/);
  assert.match(specification, /اقدام‌های حساس/);
});
