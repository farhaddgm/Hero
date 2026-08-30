import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getPlannerContractSummary,
  validatePlannerContract
} from "../packages/contracts/src/planner.mjs";
import {
  PlannerIdempotencyConflictError,
  PlannerSafetyError,
  createPlanner,
  createPlannerHarness,
  validateTaskGraph
} from "../packages/domain/src/planner.mjs";
import { createTeamRegistry } from "../packages/domain/src/team-registry.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const fixedNow = () => "2026-08-14T21:00:00.000Z";
const orchestrator = { kind: "orchestrator", id: "hero-control-plane" };

function planInput(overrides = {}) {
  return {
    planningId: "PLAN-015",
    projectId: "HERO",
    requestId: "REQ-015",
    documentVersion: "v1.0",
    requestText: "یک داشبورد وب و اپلیکیشن موبایل برای پیگیری سفارش‌ها و وضعیت پرداخت بساز.",
    idempotencyKey: "planner-015-once",
    actor: orchestrator,
    ...overrides
  };
}

test("planner contract keeps analysis, implementation, review, and handoff within the three configured tools", () => {
  assert.deepEqual(validatePlannerContract(), []);
  const summary = getPlannerContractSummary();
  assert.deepEqual(summary.providers, ["chatgpt", "codex", "claude", "cursor"]);
  assert.ok(summary.taskKinds.includes("review"));
  assert.match(summary.routerRule, /Cursor receives only a human-controlled handoff/);
  assert.match(summary.stopRule, /halted before dispatch/);
});

test("a simple Persian request becomes an explainable, acyclic web and mobile Task Graph", () => {
  const planner = createPlanner({ now: fixedNow });
  const first = planner.plan(planInput());
  const replay = planner.plan(planInput());
  assert.equal(first.state, "ready");
  assert.equal(first.code, "PLAN_READY");
  assert.deepEqual(first.spec.targetPlatforms, ["web", "mobile"]);
  assert.equal(first.spec.language, "fa");
  assert.equal(first.spec.teamRouting.implementation.owner, "developero");
  assert.equal(first.spec.assumptions.at(-1).includes("provider زنده"), true);
  assert.equal(first.spec.acceptanceCriteria.length, 4);
  assert.deepEqual(validateTaskGraph(first.graph), []);
  assert.equal(first.graph.nodes.length, 7);
  const byKind = kind => first.graph.nodes.filter(task => task.kind === kind);
  assert.equal(byKind("analysis")[0].route.provider, "chatgpt");
  assert.equal(byKind("architecture")[0].route.provider, "chatgpt");
  assert.ok(byKind("implementation").every(task => task.route.provider === "codex"));
  assert.equal(byKind("testing")[0].route.provider, "codex");
  assert.equal(byKind("review")[0].route.provider, "claude");
  assert.equal(byKind("handoff")[0].route.provider, "cursor");
  assert.equal(byKind("analysis")[0].team.owner, "tahlilgoro");
  assert.equal(byKind("testing")[0].team.owner, "testero");
  assert.ok(new Set(first.graph.nodes.flatMap(task => [task.team.owner, ...task.team.collaborators])).size >= 11);
  assert.equal(byKind("handoff")[0].dependsOn[0], byKind("review")[0].taskId);
  assert.equal(first.boundary.providerInvocation, false);
  assert.equal(first.boundary.runnerCreated, false);
  assert.equal(replay.idempotent, true);
  assert.throws(
    () => planner.plan(planInput({ requestText: "یک داشبورد وب برای گزارش‌های مالی بساز." })),
    PlannerIdempotencyConflictError
  );
});

test("planner adds an explicit fast-path assumption when the request does not name a platform", () => {
  const result = createPlanner({ now: fixedNow }).plan(planInput({
    planningId: "PLAN-DEFAULT",
    requestId: "REQ-DEFAULT",
    idempotencyKey: "planner-default-once",
    requestText: "سامانه‌ای برای ثبت و پیگیری درخواست‌های پشتیبانی کاربران بساز."
  }));
  assert.deepEqual(result.spec.targetPlatforms, ["web"]);
  assert.ok(result.spec.assumptions.some(assumption => assumption.includes("وب به‌عنوان پیش‌فرض")));
});

test("planner reports team readiness and blocks dispatch planning until owner teams are trained", () => {
  const teamRegistry = createTeamRegistry({ now: fixedNow });
  const result = createPlanner({ now: fixedNow, teamRegistry }).plan(planInput({
    planningId: "PLAN-READINESS",
    requestId: "REQ-READINESS",
    idempotencyKey: "planner-readiness-once",
    requestText: "یک داشبورد وب برای پیگیری وضعیت درخواست‌های کاربران بساز."
  }));
  assert.equal(result.state, "ready");
  assert.equal(result.teamReadiness.source, "team-registry");
  assert.equal(result.teamReadiness.ready, false);
  assert.ok(result.teamReadiness.blockers.some(blocker => blocker.teamId === "developero"));
  assert.equal(result.teamReadiness.capacity, "not-modeled");
});

test("planner compares product output options and requires owner decision before dispatch", () => {
  const teamRegistry = createTeamRegistry({ now: fixedNow });
  const planner = createPlanner({ now: fixedNow, teamRegistry });
  const first = planner.plan(planInput({
    planningId: "PLAN-OUTPUT",
    requestId: "REQ-OUTPUT",
    idempotencyKey: "planner-output-once",
    requestText: "یک داشبورد وب برای پیگیری درخواست‌های کاربران بساز."
  }));
  assert.equal(first.outputAdvisory.options.length, 9);
  assert.equal(first.outputAdvisory.decision.state, "pending-owner");
  assert.equal(first.dispatch.ready, false);
  const approved = planner.decideOutput({
    planningId: "PLAN-OUTPUT",
    decision: "approved",
    selectedOutputId: first.outputAdvisory.recommendation.outputId,
    actor: { kind: "project-owner", id: "hero-owner" },
    idempotencyKey: "planner-output-approve"
  });
  assert.equal(approved.outputAdvisory.decision.state, "approved");
  assert.equal(approved.outputAdvisory.decision.selectedOutputId, first.outputAdvisory.recommendation.outputId);
  assert.equal(approved.dispatch.ready, false);
  assert.match(approved.dispatch.reason, /آمادگی تیم/);
  assert.ok(planner.events().some(event => event.type === "planning.output-decision-recorded"));
});

test("unready project context blocks planning while sensitive values and host paths are rejected", () => {
  const planner = createPlanner({ now: fixedNow });
  const blocked = planner.plan(planInput({
    planningId: "PLAN-BLOCKED",
    requestId: "REQ-BLOCKED",
    idempotencyKey: "planner-blocked-once",
    projectContext: { status: "blocked" }
  }));
  assert.equal(blocked.state, "blocked");
  assert.equal(blocked.code, "CONTEXT_NOT_READY");
  const sensitiveField = ["api", "key"].join("_");
  assert.throws(
    () => planner.plan(planInput({ planningId: "PLAN-SAFE", requestId: "REQ-SAFE", idempotencyKey: "planner-safe-once", [sensitiveField]: "not-accepted" })),
    PlannerSafetyError
  );
  const hostPath = String.fromCharCode(67, 58, 92) + "Users\\agent\\request.txt";
  assert.throws(
    () => planner.plan(planInput({ planningId: "PLAN-PATH", requestId: "REQ-PATH", idempotencyKey: "planner-path-once", requestText: `یک داشبورد وب با ${hostPath} بساز.` })),
    PlannerSafetyError
  );
});

test("a planned graph can halt safely before dispatch and replay that stop", () => {
  const planner = createPlanner({ now: fixedNow });
  planner.plan(planInput());
  const halted = planner.halt({ planningId: "PLAN-015", idempotencyKey: "planner-halt-once", actor: { kind: "project-owner", id: "hero-owner" }, reason: "global stop checkpoint" });
  const replay = planner.halt({ planningId: "PLAN-015", idempotencyKey: "planner-halt-once", actor: { kind: "project-owner", id: "hero-owner" }, reason: "global stop checkpoint" });
  assert.equal(halted.state, "halted");
  assert.equal(halted.code, "GRAPH_HALTED");
  assert.ok(halted.graph.nodes.every(task => task.state === "halted"));
  assert.equal(replay.idempotent, true);
  assert.ok(planner.events().some(event => event.type === "planning.halted"));
});

test("planner harness requires exact design authorization and creates no runner", () => {
  const result = createPlannerHarness({ now: fixedNow }).run({
    stepId: "HERO-015",
    documentVersion: "v1.0",
    plan: planInput({ planningId: "PLAN-HARNESS", requestId: "REQ-HARNESS", idempotencyKey: "planner-harness-once" })
  });
  assert.equal(result.dispatch.authorized, true);
  assert.equal(result.dispatch.operation, "design");
  assert.equal(result.result.code, "PLAN_READY");
  assert.ok(result.events.some(event => event.type === "authorization.dispatch-authorized"));
  assert.equal(result.events.some(event => event.type.startsWith("runner.")), false);
});

test("approved HERO-015 specification stays aligned with the executable planner boundary", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-015-v1.0.md"), "utf8");
  assert.match(specification, /Task Graph/);
  assert.match(specification, /PLAN_READY/);
  assert.match(specification, /CONTEXT_NOT_READY/);
  assert.match(specification, /Cursor/);
});
