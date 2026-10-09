import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createGoldenPath } from "../packages/domain/src/golden-path.mjs";
import { createProductTemplateRegistry } from "../packages/domain/src/product-templates.mjs";

const read = relative => JSON.parse(fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8"));
const now = () => "2026-10-09T10:00:00.000Z";
const impl = { providerId: "rehearsal-provider", modelId: "rehearsal-implementer" };
const assignments = { analyst: impl, designer: impl, writer: impl, implementer: impl, tester: impl, reviewer: { providerId: "rehearsal-provider", modelId: "rehearsal-reviewer" } };
const golden = createGoldenPath({ templates: createProductTemplateRegistry(read("config/product-templates/templates-v1.json")), catalog: read("config/golden-path/rehearsal-catalog.json"), assignments, benchDataset: read("config/bench/hero-bench-v1.json"), now });

test("the offline rehearsal passes every provable stage and never claims the live ones", async () => {
  const report = await golden.rehearse({ templateId: "static-site", projectId: "personal-site", name: "سایت شخصی", budgetCostUnits: 100_000 });
  assert.equal(report.rehearsalPassed, true);
  assert.equal(report.liveStatus, "not-run");
  const byId = Object.fromEntries(report.stages.map(item => [item.id, item.status]));
  assert.deepEqual(byId, { intake: "passed", estimate: "passed", "tool-policy": "passed", "bench-baseline": "passed", execution: "requires-live", "quality-review": "requires-live", assurance: "requires-live", "product-test": "requires-live", "owner-acceptance": "requires-live" });
  const policy = report.stages.find(item => item.id === "tool-policy");
  assert.equal(policy.evidence.probes, 9);
  assert.deepEqual(policy.evidence.failed, []);
  assert.equal(policy.evidence.auditChainIntact, true);
  assert.deepEqual(report.signals.map(item => [item.id, item.status]), [["golden-path-rehearsal", "passed"], ["golden-path-live", "not-run"]]);
  assert.match(report.honesty, /not evidence that a provider can build a product/);
});

test("every shipped template can be rehearsed", async () => {
  for (const templateId of ["static-site", "contact-form-site", "crud-admin-panel", "rest-api", "mobile-reminder-app"]) {
    const report = await golden.rehearse({ templateId, projectId: "demo-project", name: "نمونه" });
    assert.equal(report.rehearsalPassed, true, templateId);
  }
});

test("a conflicting owner answer blocks at intake and stops the rehearsal from pretending", async () => {
  const report = await golden.rehearse({ templateId: "contact-form-site", projectId: "contact-site", name: "فرم", answers: { personalData: "no" } });
  assert.equal(report.rehearsalPassed, false);
  assert.equal(report.stages.find(item => item.id === "intake").status, "blocked");
  assert.equal(report.stages.some(item => item.id === "estimate"), false, "later offline stages do not run on a blocked proposal");
  assert.equal(report.signals[0].status, "blocked");
});

test("a budget below the expected cost blocks the estimate stage", async () => {
  const report = await golden.rehearse({ templateId: "rest-api", projectId: "orders-api", name: "سفارش", budgetCostUnits: 1 });
  assert.equal(report.stages.find(item => item.id === "estimate").status, "blocked");
  assert.equal(report.rehearsalPassed, false);
});

test("readiness lists every missing precondition and is never an authorization", () => {
  const empty = golden.readiness({});
  assert.equal(empty.ready, false);
  assert.deepEqual(empty.blockers.map(item => item.code), ["GLOBAL_STOP_ACTIVE", "SPEND_AUTHORIZATION_MISSING", "TARGET_NOT_TEST", "BENCH_BASELINE_MISSING", "ACCEPTANCE_CRITERIA_NOT_APPROVED", "KILL_SWITCH_DRILL_MISSING"]);
  const spend = { active: true, authorizationId: "SPEND-001", stepId: "STEP-GP-001", documentVersion: "v1.0", providerId: "openai", modelIds: ["m1"], maxCostUnits: 5_000, expiresAt: "2026-12-01T00:00:00.000Z" };
  const complete = { externalSpend: spend, credentialProviders: ["openai"], globalStopActive: false, targetEnvironment: "test", benchBaselineDigest: "a".repeat(64), ownerAcceptanceApproved: true, killSwitchDrillAt: "2026-10-08T10:00:00.000Z", estimateHighCostUnits: 4_000, expectedProviderId: "openai" };
  const ready = golden.readiness(complete);
  assert.equal(ready.ready, true);
  assert.match(ready.note, /not an authorization/);
  const codes = patch => golden.readiness({ ...complete, ...patch }).blockers.map(item => item.code);
  assert.deepEqual(codes({ externalSpend: { ...spend, maxCostUnits: 3_000 } }), ["SPEND_CAP_BELOW_ESTIMATE"]);
  assert.deepEqual(codes({ externalSpend: { ...spend, expiresAt: "2026-10-01T00:00:00.000Z" } }), ["SPEND_AUTHORIZATION_EXPIRED"]);
  assert.deepEqual(codes({ externalSpend: { ...spend, providerId: "google" } }), ["SPEND_PROVIDER_MISMATCH"]);
  assert.deepEqual(codes({ credentialProviders: [] }), ["CREDENTIAL_REFERENCE_MISSING"]);
  assert.deepEqual(codes({ targetEnvironment: "production" }), ["TARGET_NOT_TEST"]);
  assert.deepEqual(codes({ globalStopActive: true }), ["GLOBAL_STOP_ACTIVE"]);
  assert.deepEqual(codes({ externalSpend: { ...spend, active: false } }), ["SPEND_AUTHORIZATION_MISSING"]);
  assert.deepEqual(codes({ externalSpend: { ...spend, modelIds: [] } }), ["SPEND_AUTHORIZATION_INCOMPLETE"]);
});

test("construction requires the registry and the bench dataset", () => {
  assert.throws(() => createGoldenPath({}), TypeError);
  assert.throws(() => createGoldenPath({ templates: createProductTemplateRegistry(read("config/product-templates/templates-v1.json")) }), TypeError);
});
