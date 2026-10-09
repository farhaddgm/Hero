import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { getProductTemplatesContractSummary, validateProductTemplatesContract } from "../packages/contracts/src/product-templates.mjs";
import { ProductTemplateError, createProductTemplateRegistry, validateTemplate, validateTemplateRegistry } from "../packages/domain/src/product-templates.mjs";

const registryJson = JSON.parse(fs.readFileSync(new URL("../config/product-templates/templates-v1.json", import.meta.url), "utf8"));
const clone = () => structuredClone(registryJson);
const template = id => structuredClone(registryJson.templates.find(item => item.templateId === id));

test("contract and shipped registry are valid", () => {
  assert.deepEqual(validateProductTemplatesContract(), []);
  assert.deepEqual(validateTemplateRegistry(registryJson), []);
  assert.equal(getProductTemplatesContractSummary().riskKeys.length, 6);
  assert.equal(registryJson.templates.length, 5);
  assert.deepEqual([...new Set(registryJson.templates.map(item => item.kind))].sort(), ["api", "mobile", "web"]);
});

test("every template keeps independent review, closed egress and the full forbidden list", () => {
  for (const item of registryJson.templates) {
    assert.equal(item.policyPack.egress, "closed", item.templateId);
    assert.equal(item.policyPack.reviewerIndependent, true);
    assert.ok(item.policyPack.requiredGates.includes("independent-review"));
    assert.ok(item.policyPack.forbidden.includes("docker-socket"));
    const reviewer = item.taskSkeleton.find(task => task.role === "reviewer");
    assert.ok(reviewer.dependsOn.includes("build"), "review depends on implementation");
  }
});

test("a template cannot disguise unknown as no: every 'no' carries a structural rationale", () => {
  for (const item of registryJson.templates) {
    for (const [key, value] of Object.entries(item.defaultRiskAnswers)) if (value === "no") assert.ok(item.riskRationale[key]?.length >= 10, `${item.templateId}.${key}`);
  }
  const bad = template("static-site"); delete bad.riskRationale.personalData;
  assert.ok(validateTemplate(bad).some(item => /disguised as no/.test(item)));
  const withoutAnswer = template("static-site"); delete withoutAnswer.defaultRiskAnswers.regulatedData;
  assert.ok(validateTemplate(withoutAnswer).some(item => /regulatedData must be yes, no or unknown/.test(item)));
});

test("validation rejects weak policy, missing roles, cycles, credentials and host paths", () => {
  const issue = (mutate, pattern) => { const item = template("rest-api"); mutate(item); assert.ok(validateTemplate(item).some(text => pattern.test(text)), String(pattern)); };
  issue(item => { item.policyPack.egress = "open"; }, /egress must be closed/);
  issue(item => { item.policyPack.reviewerIndependent = false; }, /reviewerIndependent/);
  issue(item => { item.policyPack.requiredGates = ["quality-gate"]; }, /independent-review/);
  issue(item => { item.policyPack.forbidden = item.policyPack.forbidden.filter(x => x !== "docker-socket"); }, /docker-socket/);
  issue(item => { item.policyPack.autonomy = "approved-autonomous"; }, /approval-each-stage/);
  issue(item => { item.taskSkeleton = item.taskSkeleton.filter(task => task.role !== "reviewer"); }, /needs a reviewer/);
  issue(item => { item.taskSkeleton.find(task => task.role === "reviewer").dependsOn = ["analysis"]; }, /must depend on implementation/);
  issue(item => { item.taskSkeleton.find(task => task.key === "analysis").dependsOn = ["review"]; }, /cycle/);
  issue(item => { item.taskSkeleton[1].dependsOn = ["ghost"]; }, /unknown task ghost/);
  issue(item => { item.acceptanceCriteria = ["کوتاه"]; }, /acceptance criteria/);
  issue(item => { item.outOfScope = []; }, /outOfScope/);
  issue(item => { item.summary += " password: hunter2hunter2"; }, /credential/);
  issue(item => { item.summary += ` see /${"home"}/user/project`; }, /host-specific path/);
  issue(item => { item.productTestPlan = {}; }, /health and ready/);
  const duplicate = clone(); duplicate.templates.push(structuredClone(duplicate.templates[0]));
  assert.ok(validateTemplateRegistry(duplicate).some(text => /duplicate/.test(text)));
});

test("instantiate builds a proposal: defaults, owner answers and unknowns stay distinct", () => {
  const registry = createProductTemplateRegistry(registryJson);
  assert.equal(registry.list().length, 5);
  const proposal = registry.instantiate({ templateId: "static-site", projectId: "personal-site", name: "سایت شخصی" });
  assert.equal(proposal.riskAnswers.externalIntegrations, "no");
  assert.equal(proposal.riskAnswers.internetFacing, "unknown", "the template does not decide whether the site is public");
  assert.equal(proposal.riskCompleteness, "needs-review");
  assert.deepEqual([...proposal.unknownRiskQuestions].sort(), ["internetFacing", "regulatedData", "requiresPrivilegedAccess", "securitySensitive"]);
  assert.equal(proposal.ready, true);
  assert.ok(proposal.taskGraph.every(task => task.taskId.startsWith("personal-site-")));
  assert.ok(proposal.taskGraph.every(task => task.dependsOn.every(dep => dep.startsWith("personal-site-"))));
  assert.match(proposal.boundary, /no repository, container, secret or deployment/);

  const answered = registry.instantiate({ templateId: "static-site", projectId: "personal-site", name: "سایت", answers: { internetFacing: "yes", regulatedData: "no", securitySensitive: "no", requiresPrivilegedAccess: "no" } });
  assert.equal(answered.riskCompleteness, "complete");
  assert.equal(answered.riskAnswers.regulatedData, "no");
  const stillUnknown = registry.instantiate({ templateId: "static-site", projectId: "personal-site", name: "سایت", answers: { personalData: "unknown" } });
  assert.equal(stillUnknown.riskAnswers.personalData, "no", "structural 'no' is kept when the owner leaves it unknown");
});

test("an owner answer that contradicts a structural 'yes' is a conflict that blocks the proposal", () => {
  const registry = createProductTemplateRegistry(registryJson);
  const proposal = registry.instantiate({ templateId: "contact-form-site", projectId: "contact-site", name: "فرم تماس", answers: { personalData: "no" } });
  assert.equal(proposal.ready, false);
  assert.equal(proposal.conflicts[0].question, "personalData");
  assert.equal(registry.instantiate({ templateId: "contact-form-site", projectId: "contact-site", name: "فرم تماس", answers: { personalData: "unknown" } }).riskAnswers.personalData, "yes", "unknown never overrides a structural yes downward");
});

test("instantiate and registry creation fail closed on bad input", () => {
  const registry = createProductTemplateRegistry(registryJson);
  const ok = { templateId: "rest-api", projectId: "orders-api", name: "سفارش" };
  assert.throws(() => registry.instantiate({ ...ok, templateId: "nope" }), error => error instanceof ProductTemplateError && error.code === "TEMPLATE_NOT_FOUND");
  assert.throws(() => registry.instantiate({ ...ok, projectId: "BAD ID" }), error => error.code === "INVALID_PROJECT_ID");
  assert.throws(() => registry.instantiate({ ...ok, name: "" }), error => error.code === "INVALID_NAME");
  assert.throws(() => registry.instantiate({ ...ok, answers: { personalData: "maybe" } }), error => error.code === "INVALID_ANSWER");
  const broken = clone(); broken.templates[0].policyPack.egress = "open";
  assert.throws(() => createProductTemplateRegistry(broken), error => error.code === "INVALID_REGISTRY");
  assert.equal(Object.isFrozen(registry.get("rest-api")), true);
  assert.throws(() => { registry.get("rest-api").title = "x"; }, TypeError);
});
