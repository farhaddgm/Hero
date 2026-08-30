import { FAKE_AGENT_SCENARIOS } from "../../../packages/contracts/src/fake-agent.mjs";
import { getDashboardContractSummary } from "../../../packages/contracts/src/dashboard.mjs";
import { createFakeOrchestrationHarness } from "../../../packages/domain/src/fake-agent.mjs";
import { PrincipleCommandError, createPrinciplesRegistry } from "../../../packages/domain/src/principles-registry.mjs";
import { ReleaseCommandError, createReleasePromotion } from "../../../packages/domain/src/release-promotion.mjs";
import { TeamCommandError, createTeamRegistry } from "../../../packages/domain/src/team-registry.mjs";
import { getTeamTrainingPlan } from "../../../packages/contracts/src/training.mjs";
import { PlannerIdempotencyConflictError, PlannerSafetyError, createPlanner } from "../../../packages/domain/src/planner.mjs";

const SENSITIVE_INPUT = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential)\s*[:=])/i;

function copy(value) {
  return structuredClone(value);
}

function assertText(label, value, { minimum = 0, maximum = 1000, required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new DashboardCommandError("INVALID_INPUT", `${label} الزامی است.`);
    return "";
  }
  if (typeof value !== "string") throw new DashboardCommandError("INVALID_INPUT", `${label} باید متن باشد.`);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new DashboardCommandError("INVALID_INPUT", `${label} باید بین ${minimum} تا ${maximum} نویسه باشد.`);
  }
  if (SENSITIVE_INPUT.test(normalized)) {
    throw new DashboardCommandError("SENSITIVE_INPUT_REJECTED", "اطلاعات حساس را در درخواست وارد نکنید.");
  }
  return normalized;
}

function assertScenario(value) {
  const scenario = value ?? "success";
  if (!FAKE_AGENT_SCENARIOS.includes(scenario)) {
    throw new DashboardCommandError("INVALID_SCENARIO", "سناریوی Fake Agent معتبر نیست.");
  }
  return scenario;
}

function assertProjectId(value) {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(value.trim())) {
    throw new DashboardCommandError("INVALID_INPUT", "شناسهٔ پروژه معتبر نیست.");
  }
  return value.trim();
}

function timestamp(now) {
  const value = now();
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error("Dashboard clock must return an ISO timestamp.");
  }
  return value;
}

function buildPlan(scenario) {
  const scenarioLabel = Object.freeze({
    success: "موفقیت کامل",
    "review-changes": "بازبینی و درخواست اصلاح",
    "failure-then-retry": "شکست و تلاش مجدد",
    "pause-resume": "توقف امن و ادامه"
  });
  return Object.freeze([
    Object.freeze({ order: 1, title: "تحلیل درخواست", state: "آماده" }),
    Object.freeze({ order: 2, title: `اجرای Fake Agent: ${scenarioLabel[scenario]}`, state: "نیازمند مجوز" }),
    Object.freeze({ order: 3, title: "تست، checkpoint و بازبینی", state: "در انتظار" }),
    Object.freeze({ order: 4, title: "تأیید نهایی و تحویل نتیجه", state: "در انتظار" })
  ]);
}

function publicRequest(request) {
  return Object.freeze(copy(request));
}

export class DashboardCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DashboardCommandError";
    this.code = code;
  }
}

export function createControlDashboard(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const teamRegistry = options.teamRegistry ?? createTeamRegistry({ now });
  const requests = new Map();
  let sequence = 0;
  let teamCommandSequence = 0;
  let principleCommandSequence = 0;
  let releaseCommandSequence = 0;
  let fullAutonomy = options.fullAutonomy === true;
  let globalStop = false;
  const principlesRegistry = options.principlesRegistry ?? createPrinciplesRegistry({ now });
  const releasePromotion = options.releasePromotion ?? createReleasePromotion({
    now,
    principlesRegistry,
    authorizeProduction: options.authorizeProduction
  });
  const planner = options.planner ?? createPlanner({ now, teamRegistry });
  let planningSequence = 0;

  function getRequest(requestId) {
    const request = requests.get(requestId);
    if (!request) throw new DashboardCommandError("REQUEST_NOT_FOUND", "درخواست پیدا نشد.");
    return request;
  }

  function snapshot() {
    return Object.freeze({
      contract: getDashboardContractSummary(),
      fullAutonomy,
      globalStop,
      providerMode: "Fake Agent only",
      teamControl: teamRegistry.snapshot(),
      principlesControl: principlesRegistry.snapshot(),
      releaseControl: releasePromotion.snapshot(),
      requests: [...requests.values()]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(publicRequest)
    });
  }

  function runTeamCommand(command, input = {}) {
    teamCommandSequence += 1;
    try {
      return command({
        ...input,
        actor: { kind: "project-owner", id: "hero-owner" },
        idempotencyKey: input.idempotencyKey ?? `dashboard-team-${teamCommandSequence}`
      });
    } catch (error) {
      if (error instanceof TeamCommandError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function runPrincipleCommand(command, input = {}) {
    principleCommandSequence += 1;
    try {
      return command({
        ...input,
        actor: { kind: "project-owner", id: "hero-owner" },
        idempotencyKey: input.idempotencyKey ?? `dashboard-principle-${principleCommandSequence}`
      });
    } catch (error) {
      if (error instanceof PrincipleCommandError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function runReleaseCommand(command, input = {}) {
    releaseCommandSequence += 1;
    try {
      return command({
        ...input,
        actor: { kind: "project-owner", id: "hero-owner" },
        idempotencyKey: input.idempotencyKey ?? `dashboard-release-${releaseCommandSequence}`
      });
    } catch (error) {
      if (error instanceof ReleaseCommandError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function createRequest(input) {
    const title = assertText("عنوان", input?.title, { minimum: 3, maximum: 120, required: true });
    const description = assertText("شرح", input?.description, { maximum: 1000 });
    const scenario = assertScenario(input?.scenario);
    const projectId = assertProjectId(input?.projectId ?? "hero");
    try {
      principlesRegistry.assertSatisfied({ projectId, controlPoint: "project-intake" });
    } catch (error) {
      if (error instanceof PrincipleCommandError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
    sequence += 1;
    const createdAt = timestamp(now);
    const request = {
      requestId: `REQ-${String(sequence).padStart(3, "0")}`,
      projectId,
      title,
      description,
      scenario,
      status: globalStop ? "متوقف" : fullAutonomy ? "آماده اجرا" : "نیازمند تأیید",
      plan: buildPlan(scenario),
      createdAt,
      updatedAt: createdAt,
      approvedAt: fullAutonomy && !globalStop ? createdAt : null,
      rejectedAt: null,
      stoppedAt: globalStop ? createdAt : null,
      result: null
    };
    requests.set(request.requestId, request);
    return publicRequest(request);
  }

  function approveRequest(requestId) {
    if (globalStop) throw new DashboardCommandError("GLOBAL_STOP_ACTIVE", "توقف اضطراری فعال است؛ اجرای جدید مجاز نیست.");
    const request = getRequest(requestId);
    try {
      principlesRegistry.assertSatisfied({ projectId: request.projectId, controlPoint: "planning" });
    } catch (error) {
      if (error instanceof PrincipleCommandError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
    if (!["نیازمند تأیید", "متوقف"].includes(request.status)) {
      throw new DashboardCommandError("REQUEST_NOT_APPROVABLE", "این درخواست در وضعیت قابل تأیید نیست.");
    }
    request.status = "آماده اجرا";
    request.approvedAt = timestamp(now);
    request.updatedAt = request.approvedAt;
    request.stoppedAt = null;
    return publicRequest(request);
  }

  function rejectRequest(requestId) {
    const request = getRequest(requestId);
    if (["تکمیل", "رد شد"].includes(request.status)) {
      throw new DashboardCommandError("REQUEST_NOT_REJECTABLE", "این درخواست دیگر قابل رد نیست.");
    }
    request.status = "رد شد";
    request.rejectedAt = timestamp(now);
    request.updatedAt = request.rejectedAt;
    return publicRequest(request);
  }

  function stopRequest(requestId) {
    const request = getRequest(requestId);
    if (!["نیازمند تأیید", "آماده اجرا"].includes(request.status)) {
      throw new DashboardCommandError("REQUEST_NOT_STOPPABLE", "فقط درخواست اجرا نشده را می‌توان متوقف کرد.");
    }
    request.status = "متوقف";
    request.stoppedAt = timestamp(now);
    request.updatedAt = request.stoppedAt;
    return publicRequest(request);
  }

  function runFakeAgent(requestId) {
    if (globalStop) throw new DashboardCommandError("GLOBAL_STOP_ACTIVE", "توقف اضطراری فعال است؛ اجرای جدید مجاز نیست.");
    const request = getRequest(requestId);
    if (request.status !== "آماده اجرا") {
      throw new DashboardCommandError("REQUEST_NOT_READY", "پیش از اجرای Fake Agent، درخواست باید تأیید شود.");
    }
    try {
      principlesRegistry.assertSatisfied({ projectId: request.projectId, controlPoint: "development" });
      principlesRegistry.assertSatisfied({ projectId: request.projectId, controlPoint: "test" });
    } catch (error) {
      if (error instanceof PrincipleCommandError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
    request.status = "در حال اجرا";
    request.updatedAt = timestamp(now);
    const result = createFakeOrchestrationHarness({ now }).run({
      runId: `RUN-UI-${request.requestId}`,
      taskId: `TASK-UI-${request.requestId}`,
      stepId: "HERO-009",
      documentVersion: "v1.0",
      scenario: request.scenario
    });
    request.status = "تکمیل";
    request.updatedAt = timestamp(now);
    request.result = Object.freeze({
      status: "تکمیل",
      scenario: result.scenario,
      attempts: result.attempts.map(attempt => Object.freeze({
        attempt: attempt.attempt,
        outcome: attempt.outcome,
        tests: attempt.tests
      })),
      eventCount: result.events.length,
      runnerStates: result.runners.map(runner => runner.state),
      summary: "Fake Agent بدون شبکه، Provider زنده یا هزینه اجرا شد."
    });
    return publicRequest(request);
  }

  function setFullAutonomy(value) {
    if (typeof value !== "boolean") throw new DashboardCommandError("INVALID_INPUT", "وضعیت اختیار کامل باید درست یا نادرست باشد.");
    fullAutonomy = value;
    return snapshot();
  }

  function setGlobalStop(value) {
    if (typeof value !== "boolean") throw new DashboardCommandError("INVALID_INPUT", "وضعیت توقف اضطراری باید درست یا نادرست باشد.");
    globalStop = value;
    return snapshot();
  }

  function reviewTeam(teamId, input) {
    return runTeamCommand(teamRegistry.reviewContract, { ...input, teamId });
  }

  function requestTeamRework(teamId, input) {
    return runTeamCommand(teamRegistry.requestRework, { ...input, teamId });
  }

  function reviewTeamDeliverable(teamId, input) {
    return runTeamCommand(teamRegistry.reviewDeliverable, { ...input, teamId });
  }

  function setTeamAutonomy(teamId, input) {
    return runTeamCommand(teamRegistry.setAutonomy, { ...input, teamId });
  }

  function recordTeamTraining(teamId, input) {
    return runTeamCommand(teamRegistry.recordTraining, { ...input, teamId });
  }

  function updateTeamAssignment(assignmentId, input) {
    return runTeamCommand(teamRegistry.updateAssignment, { ...input, assignmentId });
  }

  function mergeTeams(input) {
    return runTeamCommand(teamRegistry.mergeTeams, input);
  }

  function splitTeam(teamId, input) {
    return runTeamCommand(teamRegistry.splitTeam, { ...input, teamId });
  }

  function requirePrinciples(projectId, controlPoint) {
    try {
      return principlesRegistry.assertSatisfied({ projectId: assertProjectId(projectId), controlPoint });
    } catch (error) {
      if (error instanceof PrincipleCommandError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function assignTeam(teamId, input) {
    requirePrinciples(input?.projectId, "team-assignment");
    return runTeamCommand(teamRegistry.assignToProject, { ...input, teamId });
  }

  function configureTeamWorkflow(projectId, input) {
    requirePrinciples(projectId, "team-assignment");
    return runTeamCommand(teamRegistry.configureWorkflow, { ...input, projectId });
  }

  function defineProjectPrinciple(projectId, input) {
    return runPrincipleCommand(principlesRegistry.define, { ...input, projectId, scope: "product" });
  }

  function reviewProjectPrinciple(projectId, principleId, input) {
    return runPrincipleCommand(principlesRegistry.review, { ...input, projectId, principleId });
  }

  function requestProjectPrincipleRework(projectId, principleId, input) {
    return runPrincipleCommand(principlesRegistry.requestRework, { ...input, projectId, principleId });
  }

  function checkProjectPrinciples(projectId, controlPoint) {
    try {
      return principlesRegistry.evaluate({ projectId, controlPoint });
    } catch (error) {
      if (error instanceof PrincipleCommandError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function projectPrinciples(projectId) {
    try {
      const normalizedProjectId = assertProjectId(projectId);
      return Object.freeze({
        projectId: normalizedProjectId,
        principles: principlesRegistry.list(normalizedProjectId),
        checks: Object.freeze(["project-intake", "planning", "team-assignment", "development", "test", "release-test", "release-production"].map(controlPoint => principlesRegistry.evaluate({ projectId: normalizedProjectId, controlPoint })))
      });
    } catch (error) {
      if (error instanceof PrincipleCommandError || error instanceof DashboardCommandError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function teamTrainingPlan(teamId) {
    const plan = getTeamTrainingPlan(teamId);
    const team = teamRegistry.get(teamId);
    if (!plan || !team) throw new DashboardCommandError("TEAM_NOT_FOUND", "تیم پیدا نشد.");
    const completedModules = Object.values(team.training.modules).filter(module => module.passed === true).map(module => module.module);
    return Object.freeze({
      plan,
      current: Object.freeze({
        status: team.training.status,
        completedModules: Object.freeze(completedModules),
        missingModules: Object.freeze(plan.modules.map(module => module.module).filter(module => !completedModules.includes(module))),
        teamStatus: team.status,
        ready: team.status === "ready"
      })
    });
  }

  function createPlan(input = {}) {
    planningSequence += 1;
    const planningId = input.planningId ?? `PLAN-UI-${String(planningSequence).padStart(3, "0")}`;
    const requestId = input.requestId ?? `REQ-PLAN-${String(planningSequence).padStart(3, "0")}`;
    try {
      return planner.plan({
        ...input,
        planningId,
        requestId,
        projectId: input.projectId ?? "hero",
        documentVersion: input.documentVersion ?? "v1.0",
        idempotencyKey: input.idempotencyKey ?? `dashboard-plan-${planningSequence}`,
        actor: { kind: "orchestrator", id: "hero-control-plane" }
      });
    } catch (error) {
      if (error instanceof PlannerSafetyError || error instanceof PlannerIdempotencyConflictError) {
        throw new DashboardCommandError(error.code, error.message);
      }
      throw error;
    }
  }

  function getPlan(planningId) {
    const result = planner.get(planningId);
    if (!result) throw new DashboardCommandError("PLAN_NOT_FOUND", "برنامه پیدا نشد.");
    return result;
  }

  function registerRelease(input) {
    return runReleaseCommand(releasePromotion.register, input);
  }

  function requestTestDeployment(input) {
    return runReleaseCommand(releasePromotion.requestTestDeployment, input);
  }

  function recordTestDeployment(input) {
    return runReleaseCommand(releasePromotion.recordTestDeployment, input);
  }

  function recordTestEvidence(input) {
    return runReleaseCommand(releasePromotion.recordTestEvidence, input);
  }

  function requestProductionApproval(input) {
    return runReleaseCommand(releasePromotion.requestProductionApproval, input);
  }

  function approveProduction(input) {
    return runReleaseCommand(releasePromotion.approveProduction, input);
  }

  function requestProductionPromotion(input) {
    return runReleaseCommand(releasePromotion.requestProductionPromotion, input);
  }

  function rollbackRelease(input) {
    return runReleaseCommand(releasePromotion.rollback, input);
  }

  return Object.freeze({
    snapshot,
    createRequest,
    approveRequest,
    rejectRequest,
    stopRequest,
    runFakeAgent,
    setFullAutonomy,
    setGlobalStop,
    teamSnapshot: () => teamRegistry.snapshot(),
    teamTrainingPlan,
    createPlan,
    getPlan,
    reviewTeam,
    requestTeamRework,
    reviewTeamDeliverable,
    setTeamAutonomy,
    recordTeamTraining,
    assignTeam,
    updateTeamAssignment,
    configureTeamWorkflow,
    mergeTeams,
    splitTeam,
    defineProjectPrinciple,
    reviewProjectPrinciple,
    requestProjectPrincipleRework,
    checkProjectPrinciples,
    projectPrinciples,
    registerRelease,
    requestTestDeployment,
    recordTestDeployment,
    recordTestEvidence,
    requestProductionApproval,
    approveProduction,
    requestProductionPromotion,
    rollbackRelease
  });
}
