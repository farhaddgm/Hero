import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getMobileFactoryContractSummary,
  validateMobileFactoryContract
} from "../packages/contracts/src/mobile-factory.mjs";
import {
  MobileFactoryIdempotencyConflictError,
  MobileFactorySafetyError,
  createMobileFactory,
  createMobileFactoryHarness
} from "../packages/domain/src/mobile-factory.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const now = () => "2026-08-14T23:30:00.000Z";
const actor = { kind: "orchestrator", id: "hero-control-plane" };

function decision(operation, overrides = {}) {
  return {
    authorized: true, code: "AUTHORIZED", globalStop: false, safeCheckpointRequired: false,
    stepId: "HERO-018", documentVersion: "v1.0", operation, authorizationId: "AUTH-BATCH-20260814-001-HERO-018",
    ...overrides
  };
}

function createInput(overrides = {}) {
  return {
    factoryId: "MOBFACT-018", stepId: "HERO-018", documentVersion: "v1.0", actor,
    developDecision: decision("develop"), idempotencyKey: "create-once", appSlug: "sample-mobile-app",
    planning: { planningId: "PLAN-018", specId: "SPEC-018", specVersion: "v1.0", state: "ready" },
    request: { title: "اپ وضعیت", statement: "یک اپ موبایل فارسی برای مشاهده وضعیت پروژه بساز.", locale: "fa-IR" },
    ...overrides
  };
}

function verifyInput(overrides = {}) {
  return { factoryId: "MOBFACT-018", actor, testDecision: decision("test"), reviewDecision: decision("review"), idempotencyKey: "verify-once", ...overrides };
}

test("Mobile Factory contract fixes the Expo preset and separate Android/iOS gates", () => {
  assert.deepEqual(validateMobileFactoryContract(), []);
  const contract = getMobileFactoryContractSummary();
  assert.equal(contract.targetStack.mobile, "Expo + React Native + TypeScript");
  assert.ok(contract.decisionCodes.includes("ANDROID_PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION"));
  assert.ok(contract.decisionCodes.includes("IOS_CLOUD_BUILD_REQUIRES_SEPARATE_AUTHORIZATION"));
  assert.match(contract.safetyBoundary, /does not install Expo/);
});

test("a simple Persian request becomes a portable Android and iOS Blueprint and Recipe", () => {
  const factory = createMobileFactory({ now });
  const created = factory.create(createInput());
  const replay = factory.create(createInput());

  assert.equal(created.factory.state, "ready");
  assert.equal(created.factory.code, "MOBILE_FACTORY_READY");
  assert.deepEqual(created.factory.blueprint.platforms, ["android", "ios"]);
  assert.equal(created.factory.recipe.request.locale, "fa-IR");
  assert.equal(created.factory.recipe.features.find(feature => feature.id === "MOBILE-HANDOFF").owner, "cursor");
  assert.equal(created.factory.androidPreview.dispatchStarted, false);
  assert.equal(created.factory.iosCloudBuild.dispatchStarted, false);
  assert.equal(replay.idempotent, true);
  assert.throws(() => factory.create(createInput({ planning: { planningId: "PLAN-018", specId: "SPEC-018", specVersion: "v1.0", state: "draft" } })), MobileFactoryIdempotencyConflictError);
});

test("Quality Gate test evidence and Claude review turn the mobile factory output into a tested result", () => {
  const factory = createMobileFactory({ now });
  factory.create(createInput());
  const verified = factory.verify(verifyInput());
  const replay = factory.verify(verifyInput());

  assert.equal(verified.factory.state, "tested");
  assert.equal(verified.factory.code, "MOBILE_FACTORY_TESTED");
  assert.equal(verified.factory.qualityGate.state, "approved");
  assert.equal(verified.factory.boundary.androidPreview, false);
  assert.equal(verified.factory.boundary.iosCloudBuild, false);
  assert.equal(replay.idempotent, true);
  assert.ok(factory.events().some(event => event.type === "quality-gate.approved"));
  assert.ok(factory.events().some(event => event.type === "mobile-factory.quality-recorded"));
});

test("planning, authorization, Global Stop and sensitive input fail closed", () => {
  const factory = createMobileFactory({ now });
  assert.throws(() => factory.create(createInput({ planning: { planningId: "PLAN-018", specId: "SPEC-018", specVersion: "v1.0", state: "draft" } })), /planning must be ready/);
  assert.throws(() => factory.create(createInput({ developDecision: decision("test") })), /exact develop authorization/);
  const hostBoundSlug = "c" + String.fromCharCode(58) + String.fromCharCode(92) + "hero";
  assert.throws(() => factory.create(createInput({ appSlug: hostBoundSlug })), /portable lowercase slug/);
  assert.throws(() => factory.create(createInput({ request: { title: "اپ وضعیت", statement: "Bearer token_should_not_be_accepted_123", locale: "fa-IR" } })), MobileFactorySafetyError);
  const stopped = factory.create(createInput({ developDecision: decision("develop", { authorized: false, code: "GLOBAL_STOP_ACTIVE", globalStop: true }) }));
  assert.equal(stopped.factory.state, "blocked");
  assert.equal(stopped.factory.code, "GLOBAL_STOP_ACTIVE");
});

test("the harness never converts development authority into Android Preview or iOS cloud spend", () => {
  const harness = createMobileFactoryHarness({ now });
  const result = harness.run({ create: createInput(), verify: verifyInput() });
  assert.equal(result.factory.state, "tested");
  assert.equal(result.factory.androidPreview.code, "ANDROID_PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION");
  assert.equal(result.factory.iosCloudBuild.code, "IOS_CLOUD_BUILD_REQUIRES_SEPARATE_AUTHORIZATION");
  assert.equal(result.factory.iosCloudBuild.dispatchStarted, false);
});

test("approved HERO-018 specification remains aligned with the executable Mobile Factory", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-018-v1.0.md"), "utf8");
  const architecture = fs.readFileSync(path.join(REPO_ROOT, "docs", "architecture", "MOBILE_FACTORY.md"), "utf8");
  assert.match(specification, /MOBILE_FACTORY_TESTED/);
  assert.match(specification, /ANDROID_PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION/);
  assert.match(specification, /IOS_CLOUD_BUILD_REQUIRES_SEPARATE_AUTHORIZATION/);
  assert.match(architecture, /Expo/);
  assert.match(architecture, /Quality Gate/);
});
