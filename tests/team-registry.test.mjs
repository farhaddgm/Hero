import assert from "node:assert/strict";
import test from "node:test";

import {
  TEAM_CATALOG,
  TEAM_REQUIRED_APPROVALS,
  TEAM_TRAINING_MODULES,
  getTeamContractSummary,
  validateTeamContract
} from "../packages/contracts/src/team.mjs";
import {
  TeamCommandError,
  createTeamRegistry
} from "../packages/domain/src/team-registry.mjs";

const owner = { kind: "project-owner", id: "hero-owner" };
const orchestrator = { kind: "orchestrator", id: "hero-control-plane" };
const fixedNow = () => "2026-08-30T12:00:00.000Z";

function approveContract(registry, teamId) {
  TEAM_REQUIRED_APPROVALS.forEach((target, index) => {
    registry.reviewContract({
      teamId,
      target,
      decision: "approved",
      actor: owner,
      idempotencyKey: `approve-${teamId}-${index}`
    });
  });
}

function trainTeam(registry, teamId) {
  TEAM_TRAINING_MODULES.forEach((module, index) => {
    registry.recordTraining({
      teamId,
      module,
      score: 90,
      evidenceRef: `hero://training/${teamId}/${module}`,
      actor: orchestrator,
      idempotencyKey: `train-${teamId}-${index}`
    });
  });
}

test("team contract contains the eleven phase-one teams from the operating-model sheet", () => {
  assert.deepEqual(validateTeamContract(), []);
  assert.equal(TEAM_CATALOG.length, 11);
  assert.equal(getTeamContractSummary().catalogSize, 11);
  assert.deepEqual(TEAM_CATALOG.map(team => team.name), [
    "راهبرو", "ایده‌پردازو", "تحلیلگرو", "محصولو", "دیزاینرو", "معمارو",
    "دولوپرو", "تسترو", "امینتو", "عملیاتو", "داده‌و"
  ]);
});

test("team contract review is owner-gated, versioned and supports explicit rework", () => {
  const registry = createTeamRegistry({ now: fixedNow });
  assert.throws(
    () => registry.reviewContract({
      teamId: "mahsulo",
      target: "output",
      decision: "approved",
      actor: orchestrator,
      idempotencyKey: "not-owner"
    }),
    error => error instanceof TeamCommandError && error.code === "OWNER_APPROVAL_REQUIRED"
  );

  const returned = registry.requestRework({
    teamId: "mahsulo",
    target: "output",
    feedback: "خروجی باید معیار پذیرش و قالب تحویل داشته باشد.",
    actor: owner,
    idempotencyKey: "rework-output-1"
  });
  assert.equal(returned.team.status, "rework");
  assert.equal(returned.event.type, "team.rework-requested");
  assert.equal(returned.team.reworkRequests[0].kind, "contract");

  const approved = registry.reviewContract({
    teamId: "mahsulo",
    target: "output",
    decision: "approved",
    actor: owner,
    idempotencyKey: "approve-output-1"
  });
  assert.equal(approved.team.approvals.output, true);
  assert.equal(approved.team.version, 2);
  const replay = registry.reviewContract({
    teamId: "mahsulo",
    target: "output",
    decision: "approved",
    actor: owner,
    idempotencyKey: "approve-output-1"
  });
  assert.equal(replay.idempotent, true);
});

test("team cannot receive project work before contract approval and training", () => {
  const registry = createTeamRegistry({ now: fixedNow });
  assert.throws(
    () => registry.assignToProject({
      teamId: "developero", projectId: "PROJECT-001", stage: "implementation", taskId: "TASK-001",
      actor: owner, idempotencyKey: "assign-too-early"
    }),
    error => error.code === "TEAM_NOT_READY"
  );
  approveContract(registry, "developero");
  assert.equal(registry.get("developero").status, "training");
  trainTeam(registry, "developero");
  assert.equal(registry.get("developero").status, "ready");
  const assigned = registry.assignToProject({
    teamId: "developero", projectId: "PROJECT-001", stage: "implementation", taskId: "TASK-001",
    actor: owner, idempotencyKey: "assign-developero"
  });
  assert.equal(assigned.assignment.state, "assigned");
  assert.equal(assigned.team.status, "assigned");
  const working = registry.updateAssignment({
    assignmentId: assigned.assignment.assignmentId,
    state: "working",
    note: "توسعه در Worktree ایزوله آغاز شد.",
    actor: orchestrator,
    idempotencyKey: "work-developero"
  });
  assert.equal(working.team.status, "working");
  const completed = registry.updateAssignment({
    assignmentId: assigned.assignment.assignmentId,
    state: "completed",
    actor: orchestrator,
    idempotencyKey: "complete-developero"
  });
  assert.equal(completed.team.status, "ready");
});

test("owner can review project input/output, change autonomy and workflow policy", () => {
  const registry = createTeamRegistry({ now: fixedNow });
  approveContract(registry, "mahsulo");
  trainTeam(registry, "mahsulo");
  const inputReview = registry.reviewDeliverable({
    teamId: "mahsulo", projectId: "PROJECT-002", artifactId: "BRIEF-002", artifactVersion: "v1.0",
    direction: "input", decision: "approved", actor: owner, idempotencyKey: "input-approved"
  });
  assert.equal(inputReview.review.direction, "input");
  const outputReview = registry.reviewDeliverable({
    teamId: "mahsulo", projectId: "PROJECT-002", artifactId: "PRD-002", artifactVersion: "v1.0",
    direction: "output", decision: "rework-requested", feedback: "معیار پذیرش برای همه قابلیت‌ها کامل نیست.",
    actor: owner, idempotencyKey: "output-rework"
  });
  assert.equal(outputReview.team.status, "rework");
  assert.equal(outputReview.event.type, "team.deliverable-reviewed");
  const autonomy = registry.setAutonomy({
    teamId: "mahsulo", stage: "product", mode: "autonomous-with-escalation",
    actor: owner, idempotencyKey: "autonomy-product"
  });
  assert.equal(autonomy.team.autonomy.byStage.product, "autonomous-with-escalation");
  const workflow = registry.configureWorkflow({
    projectId: "PROJECT-002",
    stages: [
      { stageId: "discovery", teamId: "tahlilgoro", approvalMode: "gate-only" },
      { stageId: "product", teamId: "mahsulo", approvalMode: "every-step" }
    ],
    actor: owner,
    idempotencyKey: "workflow-project-002"
  });
  assert.equal(workflow.workflow.stages[1].approvalMode, "every-step");
  assert.equal(registry.snapshot().workflows.length, 1);
});

test("team merge and split preserve an auditable retired history", () => {
  const registry = createTeamRegistry({ now: fixedNow });
  const target = {
    teamId: "product-discovery",
    name: "محصول و کشف",
    responsibility: "کشف فرصت و تبدیل آن به محصول قابل ساخت",
    decisionRights: ["اولویت‌بندی"],
    inputs: ["مسئله"],
    outputs: ["PRD"],
    principles: ["شواهد‌محور"],
    partners: ["rahbaro"],
    defaultStages: ["discovery", "product"],
    defaultAutonomy: "stage-gated"
  };
  const merged = registry.mergeTeams({
    sourceTeamIds: ["ideh-pardazo", "tahlilgoro"], target, actor: owner, idempotencyKey: "merge-discovery"
  });
  assert.equal(merged.targetTeam.status, "proposed");
  assert.equal(registry.get("ideh-pardazo").status, "retired");
  assert.equal(registry.get("tahlilgoro").status, "retired");

  const split = registry.splitTeam({
    teamId: "product-discovery",
    newTeams: [
      { ...target, teamId: "product-team", name: "محصولو جدید", defaultStages: ["product"] },
      { ...target, teamId: "discovery-team", name: "کشفو جدید", defaultStages: ["discovery"] }
    ],
    actor: owner,
    idempotencyKey: "split-product-discovery"
  });
  assert.equal(split.sourceTeam.status, "retired");
  assert.equal(registry.get("product-team").status, "proposed");
  assert.ok(registry.events().some(event => event.type === "team.merged"));
  assert.ok(registry.events().some(event => event.type === "team.split"));
});
