import assert from "node:assert/strict";
import test from "node:test";

import {
  ORGANIZATION_ADVISOR_PIPELINE_ROLES,
  getOrganizationAdvisorContractSummary,
  validateOrganizationAdvisorContract
} from "../packages/contracts/src/organization-advisor.mjs";
import {
  getSkillContractSummary,
  validateSkillContract
} from "../packages/contracts/src/skill.mjs";
import { ORGANIZATION_PERFORMANCE_METRICS } from "../packages/contracts/src/organization-performance.mjs";
import { TEAM_CATALOG } from "../packages/contracts/src/team.mjs";
import { createOrganizationAdvisor } from "../packages/domain/src/organization-advisor.mjs";
import { createOrganizationPerformanceReview } from "../packages/domain/src/organization-performance.mjs";
import { createAiOrchestration, createDeterministicAiProviderAdapter } from "../packages/domain/src/ai-orchestration.mjs";
import { createSkillRegistry } from "../packages/domain/src/skill-registry.mjs";
import { createTeamRegistry } from "../packages/domain/src/team-registry.mjs";
import { createControlDashboard } from "../apps/control-plane/src/dashboard-service.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

const OWNER = { kind: "project-owner", id: "hero-owner" };
const ADMIN = { kind: "admin", id: "hero-admin" };

function activeSkill(registry, skillId = "skill-analysis-v1") {
  return registry.register({
    skillId,
    name: "تحلیل ساختاریافته",
    description: "تحلیل مسئله بر اساس دانش و شواهد تأییدشده.",
    ownerTeamId: "tahlilgoro",
    teamIds: ["tahlilgoro"],
    inputSchema: "analysis-input-v1",
    outputSchema: "analysis-v1",
    allowedTools: [],
    benchmarkId: "benchmark-analysis-v1",
    version: "v1.0",
    status: "active",
    knowledgeRefs: ["hero://knowledge/analysis-v1"],
    principlesRefs: ["hero://principles/analysis-v1"],
    actor: ADMIN,
    idempotencyKey: `${skillId}-register`
  }).skill;
}

function registerProviderAndModel(orchestration) {
  orchestration.registerProvider({
    providerId: "openai",
    mode: "deterministic",
    displayName: "OpenAI deterministic",
    adapter: createDeterministicAiProviderAdapter("openai"),
    actor: OWNER,
    idempotencyKey: "provider-openai"
  });
  orchestration.registerModel({
    providerId: "openai",
    modelId: "chatgpt",
    displayName: "ChatGPT",
    actor: OWNER,
    idempotencyKey: "model-chatgpt"
  });
}

function performanceInput() {
  return {
    reviewId: "performance-v3-001",
    organizationId: "hero",
    period: "2026-Q3",
    teamMetrics: TEAM_CATALOG.map((team, index) => ({
      teamId: team.teamId,
      evidenceRef: `hero://evidence/performance/${team.teamId}/2026-Q3`,
      scores: Object.fromEntries(ORGANIZATION_PERFORMANCE_METRICS.map(metric => [metric, index === 1 && metric === "quality" ? 35 : 88]))
    })),
    idempotencyKey: "performance-v3-001"
  };
}

test("Skill and organization-advisor contracts are complete and advisory-only", () => {
  assert.deepEqual(validateSkillContract(), []);
  assert.deepEqual(validateOrganizationAdvisorContract(), []);
  assert.equal(getSkillContractSummary().bindingModel, "organization -> team -> role -> skill -> profile/provider/model");
  assert.deepEqual(getOrganizationAdvisorContractSummary().pipelineRoles, ORGANIZATION_ADVISOR_PIPELINE_ROLES);
  assert.match(getOrganizationAdvisorContractSummary().decisionBoundary, /no dispatch/);
});

test("admin can register and scope a Skill without gaining execution authorization", () => {
  const skills = createSkillRegistry();
  const skill = activeSkill(skills);
  const binding = skills.bind({
    bindingId: "skill-binding-analysis-team",
    skillId: skill.skillId,
    scope: "team",
    scopeId: "tahlilgoro",
    role: "analyst",
    actor: ADMIN,
    idempotencyKey: "skill-binding-analysis-team"
  }).binding;

  const resolved = skills.resolve({ teamId: "tahlilgoro", role: "analyst", skillId: skill.skillId });
  assert.equal(binding.status, "active");
  assert.equal(resolved.skill.skillId, skill.skillId);
  assert.equal(resolved.binding.bindingId, binding.bindingId);
  assert.equal(skills.snapshot().counts.skills, 1);
  assert.equal(skills.events().at(-1).actor.kind, "admin");
});

test("role policy defaults are versioned and scoped role bindings prefer the most specific match", async () => {
  const skills = createSkillRegistry();
  const skill = activeSkill(skills, "skill-routing-v1");
  const orchestration = createAiOrchestration({ skillRegistry: skills });
  registerProviderAndModel(orchestration);

  const defaultPolicy = orchestration.setDefaultRolePolicy({
    role: "analyst",
    providerId: "openai",
    modelId: "chatgpt",
    toolPolicy: "read-only",
    actor: ADMIN,
    idempotencyKey: "policy-analyst-chatgpt"
  }).policy;
  assert.equal(defaultPolicy.policyVersion, 2);
  assert.equal(orchestration.readDefaultRolePolicy("analyst").modelId, "chatgpt");

  orchestration.registerProfile({
    profileId: "analyst-general-v1",
    role: "analyst",
    providerId: "openai",
    modelId: "chatgpt",
    credentialRef: "runtime:openai-primary",
    promptVersion: "analyst-prompt-v1",
    contextPolicy: "project-approved-context",
    toolPolicy: "read-only",
    outputSchema: "analysis-v1",
    status: "active",
    actor: OWNER,
    idempotencyKey: "profile-analyst-general"
  });
  orchestration.registerProfile({
    profileId: "analyst-skilled-v1",
    role: "analyst",
    providerId: "openai",
    modelId: "chatgpt",
    credentialRef: "runtime:openai-primary",
    promptVersion: "analyst-skilled-prompt-v1",
    contextPolicy: "approved-skill-context",
    toolPolicy: "read-only",
    outputSchema: "analysis-v1",
    status: "active",
    actor: OWNER,
    idempotencyKey: "profile-analyst-skilled"
  });
  orchestration.bindRole({ bindingId: "role-general-v1", projectId: "hero", role: "analyst", profileId: "analyst-general-v1", actor: OWNER, idempotencyKey: "role-general-v1" });
  orchestration.bindRole({ bindingId: "role-skilled-v1", projectId: "hero", teamId: "tahlilgoro", skillId: skill.skillId, role: "analyst", profileId: "analyst-skilled-v1", actor: ADMIN, idempotencyKey: "role-skilled-v1" });

  assert.equal(orchestration.resolveBinding({ projectId: "hero", role: "analyst" }).bindingId, "role-general-v1");
  assert.equal(orchestration.resolveBinding({ projectId: "hero", teamId: "tahlilgoro", skillId: skill.skillId, role: "analyst" }).bindingId, "role-skilled-v1");
  const skillBoundary = await orchestration.invoke({
    invocationId: "skill-boundary-invocation",
    projectId: "hero",
    teamId: "tahlilgoro",
    skillId: skill.skillId,
    role: "analyst",
    contextSnapshotId: "skill-boundary-context",
    request: "با Skill تحلیل کن.",
    context: { artifact: "hero://artifact/skill-boundary" },
    toolAction: "file-read",
    actor: { kind: "agent", id: "skill-test-agent" },
    idempotencyKey: "skill-boundary-invocation"
  });
  assert.equal(skillBoundary.invocation.code, "SKILL_READ_ONLY_TOOL_POLICY");
  assert.equal(orchestration.snapshot().counts.rolePolicies, 8);
});

test("organization advisor turns eleven-team evidence into options and a non-authorizing roadmap", () => {
  const teamRegistry = createTeamRegistry();
  const performance = createOrganizationPerformanceReview({ teamRegistry });
  const review = performance.review(performanceInput());
  const advisor = createOrganizationAdvisor();
  const result = advisor.advise({
    advisorId: "advisor-performance-v3-001",
    question: "کدام تیم‌ها و metricها به اصلاح هدفمند نیاز دارند؟",
    performanceReview: review,
    actor: ADMIN,
    idempotencyKey: "advisor-performance-v3-001"
  });

  assert.equal(result.status, "advisory");
  assert.equal(result.state, "ready");
  assert.equal(result.evidence.teamCount, 11);
  assert.equal(result.recommendation.optionId, "targeted-improvement");
  assert.ok(result.roadmap.some(step => step.teamId === "ideh-pardazo"));
  assert.equal(result.decisionBoundary, "advisory-only-no-dispatch-no-authorization-no-mutation");
  assert.equal(advisor.persistenceSnapshot().records.length, 1);
  assert.equal(advisor.latest().advisorId, result.advisorId);
});

test("control dashboard exposes Skills and the organization advisor through its persisted surface", () => {
  const dashboard = createControlDashboard();
  dashboard.registerAiSkill({
    skillId: "skill-dashboard-v1",
    name: "پایش عملکرد تیم",
    description: "خواندن evidence عملکرد و تولید ورودی برای مشاور سازمان.",
    ownerTeamId: "rahbaro",
    teamIds: TEAM_CATALOG.map(team => team.teamId),
    inputSchema: "performance-input-v1",
    outputSchema: "organization-advisor-v1",
    status: "active",
    actor: ADMIN,
    idempotencyKey: "dashboard-skill-v1"
  });
  const reviewed = dashboard.reviewOrganizationPerformance(performanceInput());
  const advised = dashboard.adviseOrganization({
    reviewId: reviewed.review.reviewId,
    advisorId: "advisor-dashboard-v3-001",
    question: "خلاصهٔ وضعیت سازمان چیست؟",
    idempotencyKey: "advisor-dashboard-v3-001"
  });
  const snapshot = dashboard.backofficeSnapshot();
  assert.equal(snapshot.organization.teamCount, 11);
  assert.equal(snapshot.skills.counts.skills, 1);
  assert.equal(snapshot.advisor.latest.advisorId, advised.advisorId);
  assert.ok(dashboard.domainEvents().some(event => event.type === "organization-advisor.created"));
  assert.ok(dashboard.persistenceSnapshot().registries.some(registry => registry.registryId === "skill-registry"));
  assert.ok(dashboard.persistenceSnapshot().registries.some(registry => registry.registryId === "organization-advisor"));
});

test("HTTP exposes the new contracts and keeps Skill/Advisor API routes owner-authenticated", async t => {
  const now = () => "2026-09-01T12:00:00.000Z";
  const ownerAuth = createOwnerAuth({ secret: "test-only-owner-auth-secret-architecture-v3", now });
  const token = ownerAuth.issueSession({ subject: "test-owner", sessionId: "architecture-v3-session", expiresAt: 2_000_000_000 });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth });
  const address = await app.start();
  t.after(() => app.stop());
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const skillContract = await fetch(`${baseUrl}/skill-contract`);
  assert.equal(skillContract.status, 200);
  assert.equal((await skillContract.json()).skillContract.version, "1.0");
  const advisorContract = await fetch(`${baseUrl}/organization-advisor-contract`);
  assert.equal(advisorContract.status, 200);
  assert.equal((await advisorContract.json()).organizationAdvisorContract.outputSchema, "organization-advisor-v1");

  const unauthenticated = await fetch(`${baseUrl}/api/ai/skills`);
  assert.equal(unauthenticated.status, 401);
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const created = await fetch(`${baseUrl}/api/ai/skills`, {
    method: "POST",
    headers,
    body: JSON.stringify({ skillId: "skill-http-v3", name: "مهارت HTTP", description: "مهارت آزمایشی برای بررسی مسیر API.", ownerTeamId: "rahbaro", status: "active", idempotencyKey: "skill-http-v3" })
  });
  assert.equal(created.status, 201);
  const listed = await fetch(`${baseUrl}/api/ai/skills`, { headers });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).skills.counts.skills, 1);
});
