import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getWebFactoryContractSummary,
  validateWebFactoryContract
} from "../packages/contracts/src/web-factory.mjs";
import {
  WebFactoryIdempotencyConflictError,
  WebFactorySafetyError,
  createWebFactory,
  createWebFactoryHarness
} from "../packages/domain/src/web-factory.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const now = () => "2026-08-14T23:00:00.000Z";
const actor = { kind: "orchestrator", id: "hero-control-plane" };

function decision(operation, overrides = {}) {
  return {
    authorized: true, code: "AUTHORIZED", globalStop: false, safeCheckpointRequired: false,
    stepId: "HERO-017", documentVersion: "v1.0", operation, authorizationId: "AUTH-BATCH-20260814-001-HERO-017",
    ...overrides
  };
}

function createInput(overrides = {}) {
  return {
    factoryId: "WEBFACT-017", stepId: "HERO-017", documentVersion: "v1.0", actor,
    developDecision: decision("develop"), idempotencyKey: "create-once", appSlug: "sample-dashboard",
    planning: { planningId: "PLAN-017", specId: "SPEC-017", specVersion: "v1.0", state: "ready" },
    request: { title: "داشبورد ساده", statement: "یک داشبورد ساده فارسی برای نمایش وضعیت پروژه بساز.", locale: "fa-IR" },
    ...overrides
  };
}

function verifyInput(overrides = {}) {
  return { factoryId: "WEBFACT-017", actor, testDecision: decision("test"), reviewDecision: decision("review"), idempotencyKey: "verify-once", ...overrides };
}

test("Web Factory contract fixes a portable web preset and keeps Preview gated", () => {
  assert.deepEqual(validateWebFactoryContract(), []);
  const contract = getWebFactoryContractSummary();
  assert.equal(contract.targetStack.frontend, "Next.js + React + TypeScript");
  assert.ok(contract.decisionCodes.includes("PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION"));
  assert.match(contract.safetyBoundary, /does not provision a database/);
});

test("a simple Persian request becomes a version-bound Blueprint and Feature Recipe", () => {
  const factory = createWebFactory({ now });
  const created = factory.create(createInput());
  const replay = factory.create(createInput());

  assert.equal(created.factory.state, "ready");
  assert.equal(created.factory.code, "WEB_FACTORY_READY");
  assert.equal(created.factory.blueprint.stack.api, "Route handlers with a versioned REST contract");
  assert.equal(created.factory.recipe.request.locale, "fa-IR");
  assert.deepEqual(created.factory.recipe.routes.map(route => route.path), ["/", "/api/health", "/auth"]);
  assert.equal(created.factory.preview.code, "PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION");
  assert.equal(created.factory.preview.dispatchStarted, false);
  assert.equal(replay.idempotent, true);
  assert.throws(() => factory.create(createInput({ planning: { planningId: "PLAN-017", specId: "SPEC-017", specVersion: "v1.0", state: "draft" } })), WebFactoryIdempotencyConflictError);
});

test("Quality Gate test evidence and Claude review turn the factory output into a tested result", () => {
  const factory = createWebFactory({ now });
  factory.create(createInput());
  const verified = factory.verify(verifyInput());
  const replay = factory.verify(verifyInput());

  assert.equal(verified.factory.state, "tested");
  assert.equal(verified.factory.code, "WEB_FACTORY_TESTED");
  assert.equal(verified.factory.qualityGate.state, "approved");
  assert.equal(verified.factory.boundary.providerInvocation, false);
  assert.equal(verified.factory.boundary.previewPublication, false);
  assert.equal(replay.idempotent, true);
  assert.ok(factory.events().some(event => event.type === "quality-gate.approved"));
  assert.ok(factory.events().some(event => event.type === "web-factory.quality-recorded"));
});

test("planning, authorization, Global Stop and sensitive input fail closed", () => {
  const factory = createWebFactory({ now });
  assert.throws(() => factory.create(createInput({ planning: { planningId: "PLAN-017", specId: "SPEC-017", specVersion: "v1.0", state: "draft" } })), /planning must be ready/);
  assert.throws(() => factory.create(createInput({ developDecision: decision("test") })), /exact develop authorization/);
  const hostBoundSlug = "c" + String.fromCharCode(58) + String.fromCharCode(92) + "hero";
  assert.throws(() => factory.create(createInput({ appSlug: hostBoundSlug })), /portable lowercase slug/);
  assert.throws(() => factory.create(createInput({ request: { title: "داشبورد", statement: "Bearer token_should_not_be_accepted_123", locale: "fa-IR" } })), WebFactorySafetyError);
  const stopped = factory.create(createInput({ developDecision: decision("develop", { authorized: false, code: "GLOBAL_STOP_ACTIVE", globalStop: true }) }));
  assert.equal(stopped.factory.state, "blocked");
  assert.equal(stopped.factory.code, "GLOBAL_STOP_ACTIVE");
});

test("the harness never turns development and test authority into a preview dispatch", () => {
  const harness = createWebFactoryHarness({ now });
  const result = harness.run({ create: createInput(), verify: verifyInput() });
  assert.equal(result.factory.state, "tested");
  assert.equal(result.factory.preview.dispatchStarted, false);
  assert.equal(result.factory.preview.code, "PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION");
});

test("approved HERO-017 specification remains aligned with the executable Web Factory", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-017-v1.0.md"), "utf8");
  const architecture = fs.readFileSync(path.join(REPO_ROOT, "docs", "architecture", "WEB_FACTORY.md"), "utf8");
  assert.match(specification, /WEB_FACTORY_TESTED/);
  assert.match(specification, /PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION/);
  assert.match(architecture, /Next\.js/);
  assert.match(architecture, /Quality Gate/);
});
