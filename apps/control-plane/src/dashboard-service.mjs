import { randomUUID } from "node:crypto";

import { FAKE_AGENT_SCENARIOS } from "../../../packages/contracts/src/fake-agent.mjs";
import { getDashboardContractSummary } from "../../../packages/contracts/src/dashboard.mjs";
import { createFakeOrchestrationHarness } from "../../../packages/domain/src/fake-agent.mjs";
import { PrincipleCommandError, createPrinciplesRegistry } from "../../../packages/domain/src/principles-registry.mjs";
import { ReleaseCommandError, createReleasePromotion } from "../../../packages/domain/src/release-promotion.mjs";
import { TeamCommandError, createTeamRegistry } from "../../../packages/domain/src/team-registry.mjs";
import { TeamResearchCommandError, TeamResearchIdempotencyConflictError, createTeamResearchRegistry } from "../../../packages/domain/src/team-research-registry.mjs";
import { getTeamTrainingPlan } from "../../../packages/contracts/src/training.mjs";
import { PlannerIdempotencyConflictError, PlannerSafetyError, createPlanner } from "../../../packages/domain/src/planner.mjs";
import { ProjectMemoryIdempotencyConflictError, ProjectMemorySafetyError, createProjectMemory } from "../../../packages/domain/src/project-memory.mjs";
import { AiOrchestrationError, createAiOrchestration, createDeterministicAiProviderAdapter } from "../../../packages/domain/src/ai-orchestration.mjs";
import { OrganizationPerformanceError, createOrganizationPerformanceReview } from "../../../packages/domain/src/organization-performance.mjs";
import { OrganizationAdvisorError, createOrganizationAdvisor } from "../../../packages/domain/src/organization-advisor.mjs";
import { SkillRegistryError, createSkillRegistry } from "../../../packages/domain/src/skill-registry.mjs";
import { createInMemoryEventLog } from "../../../packages/domain/src/event-log.mjs";
import { createOperationalEvent } from "../../../packages/contracts/src/operational-data.mjs";
import { getObservabilityContractSummary, projectOperationalEvent } from "../../../packages/contracts/src/observability.mjs";
import { getAiBenchmarkContractSummary } from "../../../packages/contracts/src/ai-benchmark.mjs";
import { compareAiBenchmarks, runAiBenchmark } from "../../../packages/domain/src/ai-benchmark.mjs";
import { PilotDryRunError, runPilotDryRun } from "../../../packages/domain/src/pilot-dry-run.mjs";
import { createOperationalDiagnostics } from "../../../packages/domain/src/operational-diagnostics.mjs";
import { HERO_OPEN_ROADMAP, HERO_OPEN_ROADMAP_VERSION, HERO_OWNER_ACTIONS } from "../../../packages/contracts/src/roadmap.mjs";
import {
  HERO_BOUNDARY,
  HERO_SERVICE,
  HERO_VERSION,
  getAdminAuthContractSummary,
  getAiOrchestrationContractSummary,
  getAssuranceGateContractSummary,
  getAuthorizationContractSummary,
  getClaudeReviewContractSummary,
  getCriticalPrinciplesContractSummary,
  getCursorHandoffContractSummary,
  getFakeAgentContractSummary,
  getMobileFactoryContractSummary,
  getOperationalDataSummary,
  getOperationalDiagnosticsContractSummary,
  getOrganizationAdvisorContractSummary,
  getOrganizationPerformanceContractSummary,
  getOutputAdvisoryContractSummary,
  getPilotContractSummary,
  getPlannerContractSummary,
  getPortabilityGateContractSummary,
  getProjectMemoryContractSummary,
  getProviderAgentContractSummary,
  getQualityGateContractSummary,
  getPublicArchitectureSummary,
  getReleaseContractSummary,
  getRunnerContractSummary,
  getSkillContractSummary,
  getTeamContractSummary,
  getTeamResearchContractSummary,
  getTrainingContractSummary,
  getWebFactoryContractSummary,
  getWorkflowContractSummary,
  getOwnerAuthContractSummary
} from "../../../packages/contracts/src/index.mjs";

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

function projectContractCatalog() {
  return Object.freeze({
    architecture: getPublicArchitectureSummary(),
    authorization: getAuthorizationContractSummary(),
    ownerAuth: getOwnerAuthContractSummary(),
    adminAuth: getAdminAuthContractSummary(),
    dashboard: getDashboardContractSummary(),
    team: getTeamContractSummary(),
    training: getTrainingContractSummary(),
    teamResearch: getTeamResearchContractSummary(),
    aiOrchestration: getAiOrchestrationContractSummary(),
    providerAgent: getProviderAgentContractSummary(),
    fakeAgent: getFakeAgentContractSummary(),
    planner: getPlannerContractSummary(),
    workflow: getWorkflowContractSummary(),
    runner: getRunnerContractSummary(),
    qualityGate: getQualityGateContractSummary(),
    criticalPrinciples: getCriticalPrinciplesContractSummary(),
    release: getReleaseContractSummary(),
    projectMemory: getProjectMemoryContractSummary(),
    skill: getSkillContractSummary(),
    outputAdvisory: getOutputAdvisoryContractSummary(),
    organizationPerformance: getOrganizationPerformanceContractSummary(),
    organizationAdvisor: getOrganizationAdvisorContractSummary(),
    benchmark: getAiBenchmarkContractSummary(),
    pilot: getPilotContractSummary(),
    observability: getObservabilityContractSummary(),
    diagnostics: getOperationalDiagnosticsContractSummary(),
    operationalData: getOperationalDataSummary(),
    webFactory: getWebFactoryContractSummary(),
    mobileFactory: getMobileFactoryContractSummary(),
    assuranceGate: getAssuranceGateContractSummary(),
    portabilityGate: getPortabilityGateContractSummary(),
    claudeReview: getClaudeReviewContractSummary(),
    cursorHandoff: getCursorHandoffContractSummary()
  });
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
  const providerAdapters = options.providerAdapters ?? Object.freeze({});
  const eventIdFactories = {
    control: () => `evt_control_${randomUUID().replaceAll("-", "")}`,
    team: () => `evt_team_${randomUUID().replaceAll("-", "")}`,
    research: () => `evt_research_${randomUUID().replaceAll("-", "")}`,
    principle: () => `evt_principle_${randomUUID().replaceAll("-", "")}`,
    release: () => `evt_release_${randomUUID().replaceAll("-", "")}`,
    planner: () => `evt_planner_${randomUUID().replaceAll("-", "")}`,
    memory: () => `evt_memory_${randomUUID().replaceAll("-", "")}`,
    ai: () => `evt_ai_${randomUUID().replaceAll("-", "")}`,
    performance: () => `evt_performance_${randomUUID().replaceAll("-", "")}`,
    skill: () => `evt_skill_${randomUUID().replaceAll("-", "")}`,
    advisor: () => `evt_advisor_${randomUUID().replaceAll("-", "")}`,
    ...(options.eventIdFactories ?? {})
  };
  const teamRegistry = options.teamRegistry ?? createTeamRegistry({ now, eventIdFactory: eventIdFactories.team });
  const researchRegistry = options.researchRegistry ?? createTeamResearchRegistry({ now, teamRegistry, eventIdFactory: eventIdFactories.research });
  const requests = new Map();
  let controlEventLog = createInMemoryEventLog();
  let sequence = 0;
  let teamCommandSequence = 0;
  let skillCommandSequence = 0;
  let principleCommandSequence = 0;
  let releaseCommandSequence = 0;
  let researchCommandSequence = 0;
  let aiCommandSequence = 0;
  let fullAutonomy = options.fullAutonomy === true;
  let globalStop = false;
  const principlesRegistry = options.principlesRegistry ?? createPrinciplesRegistry({ now, eventIdFactory: eventIdFactories.principle });
  const releasePromotion = options.releasePromotion ?? createReleasePromotion({
    now,
    principlesRegistry,
    authorizeProduction: options.authorizeProduction,
    eventIdFactory: eventIdFactories.release
  });
  const planner = options.planner ?? createPlanner({ now, teamRegistry, eventIdFactory: eventIdFactories.planner });
  const projectMemory = options.projectMemory ?? createProjectMemory({ now, eventIdFactory: eventIdFactories.memory });
  const skillRegistry = options.skillRegistry ?? createSkillRegistry({ now, eventIdFactory: eventIdFactories.skill });
  const aiOrchestration = options.aiOrchestration ?? createAiOrchestration({ now, projectMemory, skillRegistry, providerAdapters, externalSpendAuthorizer: options.externalSpendAuthorizer, eventIdFactory: eventIdFactories.ai });
  const organizationPerformance = options.organizationPerformance ?? createOrganizationPerformanceReview({ now, teamRegistry, eventIdFactory: eventIdFactories.performance });
  const organizationAdvisor = options.organizationAdvisor ?? createOrganizationAdvisor({ now, eventIdFactory: eventIdFactories.advisor });
  let hydrationState = Object.freeze({ status: "not-configured", source: null, registryCount: 0, missingRegistryIds: [] });
  let planningSequence = 0;
  const benchmarkRuns = new Map();
  let aiBenchmarkStore = options.aiBenchmarkStore ?? null;

  function getRequest(requestId) {
    const request = requests.get(requestId);
    if (!request) throw new DashboardCommandError("REQUEST_NOT_FOUND", "درخواست پیدا نشد.");
    return request;
  }

  const CONTROL_EVENT_TYPES = new Set([
    "control.command-recorded",
    "authorization.global-stop-activated",
    "authorization.global-stop-cleared"
  ]);

  function isControlEvent(event) {
    return CONTROL_EVENT_TYPES.has(event?.type);
  }

  function projectControlEvents(events = []) {
    const requests = new Map();
    let fullAutonomy = false;
    let globalStop = false;
    const ordered = [...events]
      .filter(isControlEvent)
      .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0) || String(left.eventId).localeCompare(String(right.eventId)));
    for (const event of ordered) {
      const data = event.data ?? {};
      if (event.type === "authorization.global-stop-activated") globalStop = true;
      if (event.type === "authorization.global-stop-cleared") globalStop = false;
      if (data.command === "authority.update") fullAutonomy = data.state === "enabled";
      if (!data.requestId) continue;
      const current = requests.get(data.requestId) ?? {
        requestId: data.requestId,
        projectId: data.projectId ?? event.aggregateId,
        scenario: data.scenario ?? null,
        status: data.status ?? "نامشخص",
        lastEventId: event.eventId,
        lastSequence: event.sequence ?? null
      };
      requests.set(data.requestId, {
        ...current,
        projectId: data.projectId ?? current.projectId,
        scenario: data.scenario ?? current.scenario,
        status: data.status ?? current.status,
        lastEventId: event.eventId,
        lastSequence: event.sequence ?? current.lastSequence
      });
    }
    return Object.freeze({
      source: "append-only-control-events",
      eventCount: ordered.length,
      requestCount: requests.size,
      fullAutonomy,
      globalStop,
      requests: Object.freeze([...requests.values()].map(request => Object.freeze(request)))
    });
  }

  function recordControlCommand({ command, projectId = "hero", requestId, status, state, scenario, type = "control.command-recorded", aggregateType = "project", aggregateId = projectId } = {}) {
    const data = { command, projectId };
    if (requestId) data.requestId = requestId;
    if (status) data.status = status;
    if (state) data.state = state;
    if (scenario) data.scenario = scenario;
    const event = createOperationalEvent({
      eventId: eventIdFactories.control(),
      aggregateType,
      aggregateId,
      type,
      occurredAt: timestamp(now),
      actor: { kind: "project-owner", id: "hero-owner" },
      data
    });
    return controlEventLog.append(event, { expectedVersion: controlEventLog.currentVersion(aggregateType, aggregateId) });
  }

  function controlDashboardPersistenceSnapshot() {
    const commandProjection = projectControlEvents(controlEventLog.readAfter());
    return Object.freeze({
      schemaVersion: "1.0",
      registryId: "control-dashboard",
      requests: Object.freeze([...requests.values()].map(publicRequest)),
      fullAutonomy,
      globalStop,
      sequence,
      events: Object.freeze(controlEventLog.readAfter()),
      commandProjection
    });
  }

  function snapshot() {
    return Object.freeze({
      contract: getDashboardContractSummary(),
      fullAutonomy,
      globalStop,
      providerMode: Object.keys(providerAdapters).length > 0 ? "Configured adapters; external spend separately gated" : "Fake Agent only",
      teamControl: teamRegistry.snapshot(),
      principlesControl: principlesRegistry.snapshot(),
      releaseControl: releasePromotion.snapshot(),
      aiOrchestration: aiOrchestration.snapshot(),
      skills: skillRegistry.snapshot(),
      organizationAdvisor: organizationAdvisor.snapshot(),
      organizationPerformance: organizationPerformance.contract(),
      persistenceHydration: hydrationState,
      projections: domainProjectionStatus(),
      requests: [...requests.values()]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(publicRequest)
    });
  }

  function backofficeSnapshot() {
    const current = snapshot();
    const diagnostics = operationalDiagnostics();
    const teams = current.teamControl.teams.map(team => {
      const approvalValues = Object.values(team.approvals);
      const approvedSections = approvalValues.filter(Boolean).length;
      const safeReviews = Object.freeze((team.reviews ?? []).map(review => Object.freeze({
        reviewId: review.reviewId,
        target: review.target,
        decision: review.decision,
        reviewer: review.reviewer,
        reviewedAt: review.reviewedAt
      })));
      const safeDeliverableReviews = Object.freeze((team.deliverableReviews ?? []).map(review => Object.freeze({
        reviewId: review.reviewId,
        projectId: review.projectId,
        artifactId: review.artifactId,
        artifactVersion: review.artifactVersion,
        direction: review.direction,
        decision: review.decision,
        reviewer: review.reviewer,
        reviewedAt: review.reviewedAt
      })));
      const safeAssignments = Object.freeze((team.assignments ?? []).map(assignment => Object.freeze({
        assignmentId: assignment.assignmentId,
        projectId: assignment.projectId,
        stage: assignment.stage,
        taskId: assignment.taskId,
        state: assignment.state,
        autonomyMode: assignment.autonomyMode,
        assignedBy: assignment.assignedBy,
        assignedAt: assignment.assignedAt,
        updatedAt: assignment.updatedAt
      })));
      const safeReworkRequests = Object.freeze((team.reworkRequests ?? []).map(request => Object.freeze({
        kind: request.kind,
        reviewId: request.reviewId,
        target: request.target,
        artifactId: request.artifactId,
        decision: request.decision,
        requestedBy: request.reviewer ?? request.requestedBy,
        requestedAt: request.reviewedAt ?? request.requestedAt
      })));
      const safeResearchApplications = Object.freeze((team.researchApplications ?? []).map(application => Object.freeze({
        researchId: application.researchId,
        appliedAt: application.appliedAt,
        appliedBy: application.appliedBy,
        trainingUpdates: Object.freeze([...(application.trainingUpdates ?? [])]),
        provenance: application.provenance ? Object.freeze({
          sourceRefs: Object.freeze([...(application.provenance.sourceRefs ?? [])]),
          sourceVersion: application.provenance.sourceVersion,
          observedAt: application.provenance.observedAt,
          validUntil: application.provenance.validUntil,
          freshness: application.provenance.freshness
        }) : null
      })));
      const safeResearchRequests = Object.freeze((researchRegistry.list(team.teamId) ?? []).map(research => Object.freeze({
        researchId: research.researchId,
        projectId: research.projectId,
        status: research.status,
        version: research.version,
        lastEventId: research.lastEventId,
        requestedBy: research.requestedBy,
        requestedAt: research.requestedAt,
        startedAt: research.startedAt,
        submittedAt: research.submittedAt,
        reviewedAt: research.reviewedAt,
        appliedAt: research.appliedAt,
        focusAreas: Object.freeze([...(research.focusAreas ?? [])]),
        requestedOutputs: Object.freeze([...(research.requestedOutputs ?? [])]),
        reportVersion: research.report?.reportVersion ?? null,
        sourceCount: research.report?.sourceRefs?.length ?? 0,
        findingCount: research.report?.findings?.length ?? 0,
        benchmarkCount: research.report?.benchmarks?.length ?? 0,
        recommendationCount: research.report?.recommendations?.length ?? 0,
        hasReport: Boolean(research.report)
      })));
      const trainingModules = Object.freeze(Object.values(team.training?.modules ?? {}).map(module => Object.freeze({
        trainingId: module.trainingId,
        module: module.module,
        score: module.score,
        passed: module.passed,
        recordedBy: module.recordedBy,
        recordedAt: module.recordedAt,
        evidencePresent: Boolean(module.evidenceRef)
      })));
      const latestAssessment = team.training?.latestAssessment;
      return Object.freeze({
        teamId: team.teamId,
        name: team.name,
        status: team.status,
        version: team.version,
        lastEventId: team.lastEventId,
        responsibility: team.responsibility,
        approvals: Object.freeze({
          approved: approvedSections,
          total: approvalValues.length,
          byTarget: Object.freeze({ ...team.approvals })
        }),
        trainingStatus: team.training.status,
        ready: team.status === "ready",
        contract: Object.freeze({
          version: team.contractVersion,
          decisionRights: Object.freeze([...team.decisionRights]),
          inputs: Object.freeze([...team.inputs]),
          outputs: Object.freeze([...team.outputs]),
          principles: Object.freeze([...team.principles]),
          partners: Object.freeze([...team.partners]),
          defaultStages: Object.freeze([...team.defaultStages]),
          autonomy: Object.freeze({
            default: team.autonomy.default,
            byStage: Object.freeze({ ...team.autonomy.byStage })
          })
        }),
        training: Object.freeze({
          status: team.training.status,
          modules: trainingModules,
          latestAssessment: latestAssessment ? Object.freeze({
            trainingId: latestAssessment.trainingId,
            module: latestAssessment.module,
            score: latestAssessment.score,
            passed: latestAssessment.passed,
            recordedBy: latestAssessment.recordedBy,
            recordedAt: latestAssessment.recordedAt,
            evidencePresent: Boolean(latestAssessment.evidenceRef)
          }) : null
        }),
        knowledge: Object.freeze([...team.knowledge]),
        knowledgeVersion: team.knowledgeVersion,
        knowledgeProvenance: Object.freeze((team.knowledgeProvenance ?? []).map(item => Object.freeze({
          knowledge: item.knowledge,
          sourceRefs: Object.freeze([...(item.sourceRefs ?? [])]),
          sourceVersion: item.sourceVersion,
          observedAt: item.observedAt,
          validUntil: item.validUntil,
          freshness: item.freshness,
          approvedBy: item.approvedBy,
          approvedAt: item.approvedAt,
          researchId: item.researchId
        }))),
        contractHistory: Object.freeze(typeof teamRegistry.contractHistory === "function" ? teamRegistry.contractHistory(team.teamId) : []),
        assignmentCount: safeAssignments.length,
        reviewCount: safeReviews.length,
        details: Object.freeze({
          approvalTargets: Object.freeze([...Object.keys(team.approvals)]),
          reviews: safeReviews,
          deliverableReviews: safeDeliverableReviews,
          assignments: safeAssignments,
          reworkRequests: safeReworkRequests,
          researchApplications: safeResearchApplications,
          researchRequests: safeResearchRequests,
          trainingModules,
          latestAssessment: latestAssessment ? Object.freeze({
            trainingId: latestAssessment.trainingId,
            module: latestAssessment.module,
            score: latestAssessment.score,
            passed: latestAssessment.passed,
            recordedBy: latestAssessment.recordedBy,
            recordedAt: latestAssessment.recordedAt,
            evidencePresent: Boolean(latestAssessment.evidenceRef)
          }) : null
        })
      });
    });
    const requestStatuses = current.requests.reduce((statuses, request) => {
      statuses[request.status] = (statuses[request.status] ?? 0) + 1;
      return statuses;
    }, {});
    const timeline = [...domainEvents()]
      .sort((left, right) => Date.parse(right.occurredAt ?? 0) - Date.parse(left.occurredAt ?? 0) || String(right.eventId).localeCompare(String(left.eventId)))
      .slice(0, 24)
      .map(projectOperationalEvent);
    const benchmark = benchmarkSnapshot();
    const aiConfiguration = current.aiOrchestration;
    const performanceReviews = typeof organizationPerformance.list === "function"
      ? [...organizationPerformance.list()]
        .sort((left, right) => String(right.recordedAt).localeCompare(String(left.recordedAt)))
        .slice(0, 5)
        .map(review => Object.freeze({
          reviewId: review.reviewId,
          organizationId: review.organizationId,
          period: review.period,
          average: review.average,
          band: review.band,
          teamCount: review.teamCount,
          coverage: review.coverage,
          recordedAt: review.recordedAt,
          decisionBoundary: review.decisionBoundary
        }))
      : [];
    const contracts = projectContractCatalog();
    const plannerPlans = typeof planner.persistenceSnapshot === "function"
      ? planner.persistenceSnapshot().plans ?? []
      : [];
    const planningReadModel = Object.freeze({
      total: plannerPlans.length,
      plans: Object.freeze(plannerPlans.slice(-50).reverse().map(plan => Object.freeze({
        planningId: plan.planningId,
        requestId: plan.requestId,
        projectId: plan.projectId,
        documentVersion: plan.documentVersion,
        state: plan.state,
        code: plan.code,
        version: plan.version,
        eventId: plan.eventId,
        taskCount: Array.isArray(plan.graph?.nodes) ? plan.graph.nodes.length : 0,
        dispatch: plan.dispatch ? Object.freeze({ ready: plan.dispatch.ready, reason: plan.dispatch.reason }) : null,
        teamReadiness: plan.teamReadiness ? Object.freeze({
          ready: plan.teamReadiness.ready,
          capacity: plan.teamReadiness.capacity,
          blockers: Object.freeze((plan.teamReadiness.blockers ?? []).map(blocker => Object.freeze({ teamId: blocker.teamId, status: blocker.status, reason: blocker.reason })))
        }) : null,
        escalations: Object.freeze((plan.escalations ?? []).map(escalation => Object.freeze({
          escalationId: escalation.escalationId,
          type: escalation.type,
          status: escalation.status,
          owner: escalation.owner,
          question: escalation.question,
          reason: escalation.reason
        }))),
        outputAdvisory: plan.outputAdvisory ? Object.freeze({
          recommendation: plan.outputAdvisory.recommendation,
          decision: plan.outputAdvisory.decision,
          dispatch: plan.outputAdvisory.dispatch,
          options: Object.freeze((plan.outputAdvisory.options ?? []).map(option => Object.freeze({
            outputId: option.outputId,
            label: option.label,
            totalScore: option.totalScore,
            scores: option.scores
          })))
        }) : null,
        redacted: Object.freeze(["request text", "prompt", "context content", "credential values"])
      }))),
      decisionBoundary: "planning is advisory; it never authorizes dispatch"
    });
    const projectMemoryRecords = typeof projectMemory.list === "function" ? projectMemory.list() : [];
    const contextAssemblies = typeof projectMemory.listContextAssemblies === "function" ? projectMemory.listContextAssemblies(100) : [];
    const projectMemoryReadModel = Object.freeze({
      mode: "current-version-only",
      total: projectMemoryRecords.length,
      records: Object.freeze(projectMemoryRecords.slice(0, 100).map(record => Object.freeze({
        memoryId: record.memoryId,
        projectId: record.projectId,
        memoryKey: record.memoryKey,
        recordVersion: record.recordVersion,
        kind: record.kind,
        scope: record.scope,
        status: record.status,
        tags: Object.freeze([...(record.tags ?? [])]),
        recipientRoles: Object.freeze([...(record.recipientRoles ?? [])]),
        binding: record.binding,
        source: record.source ? Object.freeze({
          kind: record.source.kind,
          reference: record.source.reference,
          documentVersion: record.source.documentVersion
        }) : null,
        supersedesMemoryId: record.supersedesMemoryId,
        recordedAt: record.recordedAt,
        eventId: record.eventId
      }))),
      contextAssemblies: Object.freeze(contextAssemblies.map(assembly => Object.freeze({
        contextId: assembly.contextId,
        projectId: assembly.projectId,
        taskId: assembly.taskId,
        stepId: assembly.stepId,
        documentVersion: assembly.documentVersion,
        recipientRole: assembly.recipientRole,
        memoryIds: Object.freeze([...(assembly.memoryIds ?? [])]),
        maxItems: assembly.maxItems,
        selectedItems: assembly.selectedItems,
        status: assembly.status,
        code: assembly.code,
        assembledAt: assembly.assembledAt,
        eventId: assembly.eventId
      }))),
      redacted: Object.freeze(["content", "prompt", "model output", "credential values"])
    });
    const projectControls = Object.freeze({
      criticalPrinciples: Object.freeze((current.principlesControl.principles ?? []).map(principle => Object.freeze({
        projectId: principle.projectId,
        principleId: principle.principleId,
        title: principle.title,
        scope: principle.scope,
        controlPoints: Object.freeze([...(principle.controlPoints ?? [])]),
        enforcement: principle.enforcement,
        status: principle.status,
        version: principle.version,
        approvedBy: principle.approvedBy,
        approvedAt: principle.approvedAt,
        lastEventId: principle.lastEventId,
        feedbackPresent: Boolean(principle.feedback)
      }))),
      releases: Object.freeze((current.releaseControl.releases ?? []).map(release => Object.freeze({
        releaseId: release.releaseId,
        projectId: release.projectId,
        artifactId: release.artifactId,
        releaseVersion: release.releaseVersion,
        commitSha: release.commitSha,
        state: release.state,
        aggregateVersion: release.aggregateVersion,
        createdAt: release.createdAt,
        updatedAt: release.updatedAt,
        testEnvironment: Object.freeze({ status: release.testEnvironment?.status, deployedAt: release.testEnvironment?.deployedAt }),
        productionEnvironment: Object.freeze({ status: release.productionEnvironment?.status, deployedAt: release.productionEnvironment?.deployedAt }),
        testEvidence: release.testEvidence ? Object.freeze({ evidenceId: release.testEvidence.evidenceId, runId: release.testEvidence.runId, exitCode: release.testEvidence.exitCode, result: release.testEvidence.result, recordedAt: release.testEvidence.recordedAt }) : null,
        productionApproval: release.productionApproval ? Object.freeze({ decision: release.productionApproval.decision, actorId: release.productionApproval.actorId, approvedAt: release.productionApproval.approvedAt }) : null,
        lastEventId: release.lastEventId
      }))),
      teamWorkflows: Object.freeze((current.teamControl.workflows ?? []).map(workflow => Object.freeze(copy(workflow))))
    });
    const roadmapStatusCounts = HERO_OPEN_ROADMAP.reduce((counts, item) => {
      const key = item.status.includes("blocker") || item.status.includes("خارج از اختیار")
        ? "blocked"
        : item.status.includes("نیازمند") || item.status.includes("باقی") || item.status.includes("مرور")
          ? "pending"
          : "evidence";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
    const roadmap = Object.freeze({
      ledger: "OPEN-50",
      version: HERO_OPEN_ROADMAP_VERSION,
      total: HERO_OPEN_ROADMAP.length,
      statusCounts: Object.freeze(roadmapStatusCounts),
      rows: HERO_OPEN_ROADMAP,
      ownerActions: HERO_OWNER_ACTIONS,
      pilotBlockers: Object.freeze(HERO_OWNER_ACTIONS.filter(item => ["ADMIN-04", "ADMIN-06", "OWNER-07"].includes(item.id))),
      decisionBoundary: "roadmap is a read-only execution aid; it never grants authorization, dispatch, secret change or deployment",
      source: "versioned Hero roadmap ledger; docs/roadmap/OPEN-50-PRIORITY-20260904.md"
    });
    return Object.freeze({
      schemaVersion: "1.1",
      generatedAt: timestamp(now),
      scope: "protected-development-backoffice",
      readOnly: Object.freeze({
        enabled: true,
        uiMutationControls: true,
        allowedHttpMethods: Object.freeze(["GET"]),
        reason: "Projection همچنان فقط‌خواندنی و امن است؛ کنترل‌های UI فقط فرمان‌های محدود را از APIهای محافظت‌شده ارسال می‌کنند.",
        redacted: Object.freeze(["secret values", "credential values", "raw request text", "prompts", "model output", "private feedback"])
      }),
      access: Object.freeze({
        mode: "same-host-only",
        path: "/backoffice",
        dataPath: "/backoffice-data",
        bindDefault: "127.0.0.1",
        browserRequirement: "مرورگر باید روی همان ماشینی باشد که Docker میزبان Hero است"
      }),
      project: Object.freeze({
        name: "Hero",
        service: HERO_SERVICE,
        version: HERO_VERSION,
        boundary: HERO_BOUNDARY,
        locale: "fa-IR",
        runtime: "Linux container",
        sourceOfTruth: "versioned domain registries, append-only events and safe read projections"
      }),
      settings: Object.freeze({
        runtime: Object.freeze({
          service: HERO_SERVICE,
          node: "Node.js 22 + ESM HTTP service",
          deployment: "Linux container",
          host: "runtime-configured",
          port: "runtime-configured",
          dataDirectory: "runtime-configured",
          providerGateway: "adapter-boundary",
          liveProviderCalls: "disabled unless separately configured and authorized",
          externalSpend: "separately authorized"
        }),
        persistence: Object.freeze({
          mode: current.persistenceHydration.status === "hydrated" ? "hydrated" : "runtime-configured",
          hydration: current.persistenceHydration,
          eventLog: "append-only operational events",
          snapshots: "versioned registry snapshots",
          rebuildableReadModel: true,
          benchmarkHistorySource: benchmark.latest ? "benchmark store" : "empty"
        }),
        security: Object.freeze({
          access: "same-host-only",
          backofficeAuthentication: "runtime-configured Basic Auth",
          ownerAuthentication: "runtime-configured signed session",
          adminAuthentication: "runtime-configured signed session",
          secretValuesExposed: false,
          rawPrivateContentExposed: false,
          publicIndexing: "blocked by noindex headers",
          hostFileAccess: "excluded by clean-room boundary"
        }),
        governance: Object.freeze({
          globalStop: current.globalStop,
          fullAutonomy: current.fullAutonomy,
          mutationFromBackoffice: true,
          sensitiveActions: Object.freeze(["production-deploy", "secret-change", "external-spend", "external-message", "destructive-data-operation"]),
          decisionBoundary: "read models and evaluations never grant authorization",
          ownerBoundary: "project, release and operational decisions remain owner-gated"
        }),
        catalog: Object.freeze({
          teamCount: teams.length,
          aiRoleCount: current.aiOrchestration.contract.roles?.length ?? 0,
          providerCount: aiConfiguration.providers?.length ?? 0,
          modelCount: aiConfiguration.models?.length ?? 0,
          profileCount: aiConfiguration.profiles?.length ?? 0,
          bindingCount: aiConfiguration.bindings?.length ?? 0,
          skillCount: current.skills.skills?.length ?? 0,
          contractCount: Object.keys(contracts).length
        })
      }),
      projectControls,
      planning: planningReadModel,
      projectMemory: projectMemoryReadModel,
      contracts,
      routes: Object.freeze([
        Object.freeze({ method: "GET", path: "/backoffice", purpose: "رابط فارسی فقط‌خواندنی", access: "same-host Basic Auth" }),
        Object.freeze({ method: "GET", path: "/backoffice-data", purpose: "projection امن تنظیمات و وضعیت", access: "same-host Basic Auth" }),
        Object.freeze({ method: "GET", path: "/backoffice-events", purpose: "Timeline خلاصه‌شده و امن", access: "same-host Basic Auth" }),
        Object.freeze({ method: "GET", path: "/api/dashboard", purpose: "read model عملیاتی محافظت‌شده", access: "Owner/Admin" }),
        Object.freeze({ method: "GET", path: "/api/operations/diagnostics", purpose: "تشخیص وضعیت runtime", access: "Owner/Admin" }),
        Object.freeze({ method: "GET", path: "/api/audit", purpose: "خلاصهٔ audit بدون محتوای حساس", access: "Owner/Admin" })
      ]),
      organization: Object.freeze({ name: "Hero", teamCount: teams.length, teams: Object.freeze(teams) }),
      ai: Object.freeze({
        roles: Object.freeze([...(current.aiOrchestration.contract.roles ?? [])]),
        counts: current.aiOrchestration.counts,
        defaultRolePolicies: current.aiOrchestration.defaultRolePolicies,
        rolePolicyHistories: Object.freeze((current.aiOrchestration.contract.roles ?? []).map(role => Object.freeze({
          role,
          versions: Object.freeze(typeof aiOrchestration.rolePolicyHistory === "function" ? aiOrchestration.rolePolicyHistory(role) : [])
        }))),
        providers: Object.freeze((aiConfiguration.providers ?? []).map(provider => Object.freeze({
          providerId: provider.providerId,
          mode: provider.mode,
          displayName: provider.displayName,
          capabilities: Object.freeze([...(provider.capabilities ?? [])]),
          registeredAt: provider.registeredAt
        }))),
        models: Object.freeze((aiConfiguration.models ?? []).map(model => Object.freeze({
          providerId: model.providerId,
          modelId: model.modelId,
          displayName: model.displayName,
          metadata: Object.freeze({ ...model.metadata }),
          registeredAt: model.registeredAt
        }))),
        profiles: Object.freeze((aiConfiguration.profiles ?? []).map(profile => Object.freeze({
          profileId: profile.profileId,
          role: profile.role,
          providerId: profile.providerId,
          modelId: profile.modelId,
          promptVersion: profile.promptVersion,
          contextPolicy: profile.contextPolicy,
          toolPolicy: profile.toolPolicy,
          outputSchema: profile.outputSchema,
          status: profile.status,
          profileVersion: profile.profileVersion,
          timeoutMs: profile.timeoutMs,
          maxRetries: profile.maxRetries,
          maxCostUnits: profile.maxCostUnits,
          registeredAt: profile.registeredAt
        }))),
        bindings: Object.freeze((aiConfiguration.bindings ?? []).map(binding => Object.freeze({
          bindingId: binding.bindingId,
          projectId: binding.projectId,
          teamId: binding.teamId,
          skillId: binding.skillId,
          role: binding.role,
          profileId: binding.profileId,
          profileVersion: binding.profileVersion,
          boundAt: binding.boundAt
        }))),
        activity: current.aiOrchestration.activity,
        providerMode: current.providerMode,
        liveStatus: "گیت‌شده؛ بدون credential، cost policy و مجوز مستقل هیچ تماس بیرونی انجام نمی‌شود"
      }),
      skills: Object.freeze({
        counts: current.skills.counts,
        skills: current.skills.skills,
        bindings: current.skills.bindings,
        decisionBoundary: "skills constrain context and tools; they never grant authorization"
      }),
      advisor: Object.freeze({
        contract: current.organizationAdvisor.contract,
        latest: current.organizationAdvisor.latest,
        count: current.organizationAdvisor.count,
        decisionBoundary: "advisory-only-no-dispatch-no-authorization-no-mutation"
      }),
      benchmark: Object.freeze({
        mode: getAiBenchmarkContractSummary().mode,
        metrics: getAiBenchmarkContractSummary().metrics,
        latest: benchmark.latest,
        recent: benchmark.recent,
        decisionBoundary: "advisory-only; no authorization"
      }),
      projections: domainProjectionStatus(),
      observability: getObservabilityContractSummary(),
      diagnostics,
      governance: Object.freeze({
        globalStop: current.globalStop,
        fullAutonomy: current.fullAutonomy,
        persistenceHydration: current.persistenceHydration
      }),
      requests: Object.freeze({ total: current.requests.length, byStatus: Object.freeze(requestStatuses) }),
      performance: Object.freeze({
        reviews: Object.freeze(performanceReviews),
        latest: performanceReviews[0] ?? null,
        decisionBoundary: "evidence-and-recommendation-only"
      }),
      timeline: Object.freeze(timeline),
      roadmap,
      focus: Object.freeze([
        Object.freeze({ id: "core", title: "هستهٔ Hero و ۱۱ تیم", status: "تکمیل محلی", detail: "Team Registry، Planner، Workflow، Runner و Quality Gate", next: "ادامهٔ توسعه بر اساس Roadmap", tone: "good" }),
        Object.freeze({ id: "multi-ai", title: "Multi-AI و Role Routing", status: "تکمیل محلی", detail: "Role، Profile، Provider/Model، Invocation، Evaluation و Decision", next: "بازبینی مرز اجرای live", tone: "good" }),
        Object.freeze({ id: "provider", title: "Provider واقعی", status: "مسدود", detail: "Adapterها آماده‌اند؛ credential، cost و verifier مجوز لازم است", next: "HERO-024 — مجوز مستقل و Secret Store", tone: "blocked" }),
        Object.freeze({ id: "recovery", title: "Clean Linux و Recovery", status: "شاهد محلی؛ انتقال مسدود", detail: "Build لینوکس و Backup/Restore disposable موفق است", next: "HERO-025 — مقصد پاک و artifact عملیاتی", tone: "warn" }),
        Object.freeze({ id: "pilot", title: "پایلوت انتهابه‌انتها", status: "مسدود", detail: "Provider واقعی، مقصد و درخواست/معیار پذیرش هنوز باز نشده‌اند", next: "HERO-026 — یک Task کوچک کنترل‌شده", tone: "blocked" })
      ]),
      nextSteps: Object.freeze([
        "۱) Timeline را برای یافتن آخرین تغییر و علت آن بررسی کن.",
        "۲) یک درخواست کوچک واقعی و معیار پذیرش آن را نسخه‌دار کن.",
        "۳) یک Provider/Model و سقف هزینهٔ هر Run را انتخاب کن.",
        "۴) Secret را فقط در Secret Store محیط اجرا قرار بده و مجوز external-spend مستقل صادر کن.",
        "۵) یک اجرای کنترل‌شده انجام بده؛ سپس Evaluator و مالک نتیجه را بررسی کنند."
      ])
    });
  }

  function benchmarkSnapshot() {
    const recent = [...benchmarkRuns.values()]
      .sort((left, right) => String(right.recordedAt).localeCompare(String(left.recordedAt)) || right.benchmarkId.localeCompare(left.benchmarkId))
      .slice(0, 10)
      .map(run => Object.freeze(copy({
        benchmarkId: run.benchmarkId,
        providerId: run.providerId,
        modelId: run.modelId,
        profileId: run.profileId,
        datasetVersion: run.datasetVersion,
        mode: run.mode,
        metrics: run.metrics,
        recommendationEligible: run.recommendationEligible,
        authority: run.authority,
        digest: run.digest,
        recordedAt: run.recordedAt
      })));
    return Object.freeze({ latest: recent[0] ?? null, recent: Object.freeze(recent) });
  }

  function domainProjectionStatus() {
    const registries = [
      ["team-registry", teamRegistry],
      ["team-research", researchRegistry],
      ["principles-registry", principlesRegistry],
      ["release-promotion", releasePromotion],
      ["planner", planner],
      ["project-memory", projectMemory],
      ["ai-orchestration", aiOrchestration],
      ["organization-performance", organizationPerformance],
      ["skill-registry", skillRegistry],
      ["organization-advisor", organizationAdvisor],
      ["control-dashboard", { events: () => controlEventLog.readAfter(), persistenceSnapshot: controlDashboardPersistenceSnapshot, hydrate: hydrateFromPersistence }]
    ].map(([registryId, registry]) => {
      const events = registry.events?.() ?? [];
      const persisted = registryId === "control-dashboard" ? controlDashboardPersistenceSnapshot() : registry.persistenceSnapshot?.();
      const state = persisted?.data ?? persisted ?? {};
      const collectionCounts = Object.fromEntries(Object.entries(state).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]));
      const projection = Object.freeze({
        registryId,
        eventCount: events.length,
        eventTypes: Object.freeze([...new Set(events.map(event => event.type).filter(Boolean))].sort()),
        lastEventAt: events.at(-1)?.occurredAt ?? null,
        snapshotSchemaVersion: persisted?.schemaVersion ?? null,
        collectionCounts: Object.freeze(collectionCounts),
        snapshotSupported: typeof registry.persistenceSnapshot === "function",
        hydrationSupported: typeof registry.hydrate === "function"
      });
      return registryId === "control-dashboard"
        ? Object.freeze({ ...projection, commandProjection: Object.freeze({ supported: true, eventCount: persisted?.commandProjection?.eventCount ?? 0, requestCount: persisted?.commandProjection?.requestCount ?? 0 }) })
        : projection;
    });
    const missing = registries.filter(registry => !registry.snapshotSupported || !registry.hydrationSupported).map(registry => registry.registryId);
    return Object.freeze({
      contractVersion: "1.0",
      coverage: missing.length === 0 ? "complete" : "partial",
      registries: Object.freeze(registries),
      missingRegistries: Object.freeze(missing),
      eventCount: domainEvents().length,
      rebuild: Object.freeze({ mode: "snapshot-plus-append-only-event-log-validation", supported: missing.length === 0, source: hydrationState.source }),
      boundary: "projection is read-only; event replay never grants authorization or dispatch"
    });
  }

  async function runSyntheticBenchmark(input = {}) {
    const benchmarkId = input.benchmarkId ?? `BENCH-UI-${String(benchmarkRuns.size + 1).padStart(3, "0")}`;
    const providerId = input.providerId ?? "deterministic";
    const modelId = input.modelId ?? "default";
    const profileId = input.profileId ?? "hero-default-v1";
    const latencyMs = input.latencyMs === undefined ? 1 : input.latencyMs;
    if (!Number.isInteger(latencyMs) || latencyMs < 0 || latencyMs > 60_000) {
      throw new DashboardCommandError("INVALID_INPUT", "latencyMs باید عدد صحیح بین ۰ تا ۶۰۰۰۰ باشد.");
    }
    const run = await runAiBenchmark({
      benchmarkId,
      providerId,
      modelId,
      profileId,
      datasetVersion: input.datasetVersion ?? "synthetic-v1",
      runner: async ({ benchmarkCase }) => ({
        status: "completed",
        schema: benchmarkCase.outputSchema,
        safetyPass: true,
        costUnits: 0,
        latencyMs
      })
    });
    const recorded = Object.freeze({ ...run, recordedAt: timestamp(now) });
    if (aiBenchmarkStore?.save) await aiBenchmarkStore.save(recorded);
    benchmarkRuns.set(recorded.benchmarkId, recorded);
    return copy(recorded);
  }

  function hydrateBenchmarks(runs = []) {
    if (!Array.isArray(runs)) throw new DashboardCommandError("HYDRATION_INVALID", "Benchmark hydration requires an array.");
    benchmarkRuns.clear();
    for (const run of runs) {
      if (!run || typeof run.benchmarkId !== "string" || run.mode !== "synthetic-deterministic") {
        throw new DashboardCommandError("HYDRATION_INVALID", "A hydrated benchmark run is invalid.");
      }
      benchmarkRuns.set(run.benchmarkId, Object.freeze(copy(run)));
    }
    return Object.freeze({ status: "hydrated", count: benchmarkRuns.size });
  }

  function attachAiBenchmarkStore(store) {
    if (store !== null && (typeof store !== "object" || typeof store.save !== "function" || typeof store.list !== "function")) {
      throw new DashboardCommandError("BENCHMARK_STORE_INVALID", "Benchmark persistence store is invalid.");
    }
    aiBenchmarkStore = store;
    return Object.freeze({ attached: aiBenchmarkStore !== null });
  }

  async function compareBenchmarks(input = {}) {
    if (aiBenchmarkStore?.compare) return aiBenchmarkStore.compare(input);
    const runs = Array.isArray(input.benchmarkIds) && input.benchmarkIds.length > 0
      ? input.benchmarkIds.map(id => benchmarkRuns.get(id)).filter(Boolean)
      : [...benchmarkRuns.values()];
    if (runs.length === 0) {
      return Object.freeze({ compared: 0, eligible: 0, winner: null, decision: "advisory-only", runs: Object.freeze([]) });
    }
    return compareAiBenchmarks(runs);
  }

  function backofficeEvents({ after = 0, limit = 24 } = {}) {
    if (!Number.isInteger(after) || after < 0) throw new DashboardCommandError("INVALID_INPUT", "مقدار after معتبر نیست.");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new DashboardCommandError("INVALID_INPUT", "مقدار limit باید بین ۱ تا ۱۰۰ باشد.");
    const ordered = [...domainEvents()]
      .sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? "") || (left.eventId ?? "").localeCompare(right.eventId ?? ""));
    const numbered = ordered.map((event, index) => ({ event, sequence: index + 1 }));
    const page = numbered.filter(item => item.sequence > after).slice(0, limit);
    const nextAfter = page.at(-1)?.sequence ?? after;
    return Object.freeze({
      events: Object.freeze(page.map(item => projectOperationalEvent({ ...item.event, sequence: item.sequence }))),
      nextAfter,
      hasMore: numbered.some(item => item.sequence > nextAfter),
      source: "in-memory-domain-events"
    });
  }

  function runTeamCommand(command, input = {}, actor = { kind: "project-owner", id: "hero-owner" }) {
    teamCommandSequence += 1;
    const { actor: ignoredActor, ...payload } = input;
    try {
      return command({
        ...payload,
        actor,
        idempotencyKey: payload.idempotencyKey ?? `dashboard-team-${teamCommandSequence}`
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

  function runResearchCommand(command, input = {}, actor = { kind: "project-owner", id: "hero-owner" }) {
    researchCommandSequence += 1;
    try {
      return command({
        ...input,
        actor,
        idempotencyKey: input.idempotencyKey ?? `dashboard-research-${researchCommandSequence}`
      });
    } catch (error) {
      if (error instanceof TeamResearchCommandError || error instanceof TeamResearchIdempotencyConflictError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function runAiCommand(command, input = {}, actor = { kind: "project-owner", id: "hero-owner" }) {
    aiCommandSequence += 1;
    try {
      return command({
        ...input,
        actor,
        idempotencyKey: input.idempotencyKey ?? `dashboard-ai-${aiCommandSequence}`
      });
    } catch (error) {
      if (error instanceof AiOrchestrationError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function runSkillCommand(command, input = {}, actor = { kind: "project-owner", id: "hero-owner" }) {
    skillCommandSequence += 1;
    try {
      return command({
        ...input,
        actor,
        idempotencyKey: input.idempotencyKey ?? `dashboard-skill-${skillCommandSequence}`
      });
    } catch (error) {
      if (error instanceof SkillRegistryError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  async function runAiAsyncCommand(operation) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AiOrchestrationError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function runMemoryCommand(command, input = {}) {
    try {
      return command({
        ...input,
        actor: { kind: "project-owner", id: "hero-owner" },
        idempotencyKey: input.idempotencyKey ?? `dashboard-memory-${aiCommandSequence + 1}`
      });
    } catch (error) {
      if (error instanceof ProjectMemorySafetyError || error instanceof ProjectMemoryIdempotencyConflictError || error?.code) {
        throw new DashboardCommandError(error.code ?? "MEMORY_COMMAND_REJECTED", error.message);
      }
      throw new DashboardCommandError("MEMORY_COMMAND_REJECTED", error.message);
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
    recordControlCommand({ command: "request.create", projectId, requestId: request.requestId, status: request.status, scenario: request.scenario });
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
    const approvedAt = timestamp(now);
    recordControlCommand({ command: "request.approve", projectId: request.projectId, requestId, status: "آماده اجرا" });
    request.status = "آماده اجرا";
    request.approvedAt = approvedAt;
    request.updatedAt = approvedAt;
    request.stoppedAt = null;
    return publicRequest(request);
  }

  function rejectRequest(requestId) {
    const request = getRequest(requestId);
    if (["تکمیل", "رد شد"].includes(request.status)) {
      throw new DashboardCommandError("REQUEST_NOT_REJECTABLE", "این درخواست دیگر قابل رد نیست.");
    }
    const rejectedAt = timestamp(now);
    recordControlCommand({ command: "request.reject", projectId: request.projectId, requestId, status: "رد شد" });
    request.status = "رد شد";
    request.rejectedAt = rejectedAt;
    request.updatedAt = rejectedAt;
    return publicRequest(request);
  }

  function stopRequest(requestId) {
    const request = getRequest(requestId);
    if (!["نیازمند تأیید", "آماده اجرا"].includes(request.status)) {
      throw new DashboardCommandError("REQUEST_NOT_STOPPABLE", "فقط درخواست اجرا نشده را می‌توان متوقف کرد.");
    }
    const stoppedAt = timestamp(now);
    recordControlCommand({ command: "request.stop", projectId: request.projectId, requestId, status: "متوقف" });
    request.status = "متوقف";
    request.stoppedAt = stoppedAt;
    request.updatedAt = stoppedAt;
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
    const previous = { status: request.status, updatedAt: request.updatedAt, result: request.result };
    request.status = "در حال اجرا";
    request.updatedAt = timestamp(now);
    try {
      const result = createFakeOrchestrationHarness({ now }).run({
        runId: `RUN-UI-${request.requestId}`,
        taskId: `TASK-UI-${request.requestId}`,
        stepId: "HERO-009",
        documentVersion: "v1.0",
        scenario: request.scenario
      });
      const completedAt = timestamp(now);
      const publicResult = Object.freeze({
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
      recordControlCommand({ command: "request.run", projectId: request.projectId, requestId, status: "تکمیل" });
      request.status = "تکمیل";
      request.updatedAt = completedAt;
      request.result = publicResult;
      return publicRequest(request);
    } catch (error) {
      request.status = previous.status;
      request.updatedAt = previous.updatedAt;
      request.result = previous.result;
      throw error;
    }
  }

  function setFullAutonomy(value) {
    if (typeof value !== "boolean") throw new DashboardCommandError("INVALID_INPUT", "وضعیت اختیار کامل باید درست یا نادرست باشد.");
    recordControlCommand({ command: "authority.update", state: value ? "enabled" : "disabled", aggregateType: "authorization", aggregateId: "hero-full-autonomy" });
    fullAutonomy = value;
    return snapshot();
  }

  function setGlobalStop(value) {
    if (typeof value !== "boolean") throw new DashboardCommandError("INVALID_INPUT", "وضعیت توقف اضطراری باید درست یا نادرست باشد.");
    recordControlCommand({
      command: "global-stop.update",
      state: value ? "active" : "cleared",
      type: value ? "authorization.global-stop-activated" : "authorization.global-stop-cleared",
      aggregateType: "authorization",
      aggregateId: "hero-global-stop"
    });
    globalStop = value;
    return snapshot();
  }

  function reviewTeam(teamId, input) {
    return runTeamCommand(teamRegistry.reviewContract, { ...input, teamId });
  }

  function updateTeamPrinciples(teamId, input, actor) {
    return runTeamCommand(teamRegistry.updatePrinciples, { ...input, teamId }, actor);
  }

  function teamContractHistory(teamId) {
    return teamRegistry.contractHistory(teamId);
  }

  function rollbackTeamPrinciples(teamId, input, actor) {
    return runTeamCommand(teamRegistry.rollbackPrinciples, { ...input, teamId }, actor);
  }

  function requestTeamRework(teamId, input) {
    return runTeamCommand(teamRegistry.requestRework, { ...input, teamId });
  }

  function requestTeamResearch(teamId, input) {
    return runResearchCommand(researchRegistry.request, { ...input, teamId });
  }

  function startTeamResearch(researchId, input) {
    return runResearchCommand(researchRegistry.start, { ...input, researchId });
  }

  function submitTeamResearchReport(researchId, input) {
    return runResearchCommand(researchRegistry.submitReport, { ...input, researchId }, { kind: "orchestrator", id: "hero-research" });
  }

  function reviewTeamResearch(researchId, input) {
    return runResearchCommand(researchRegistry.review, { ...input, researchId });
  }

  function getTeamResearch(researchId) {
    const result = researchRegistry.get(researchId);
    if (!result) throw new DashboardCommandError("RESEARCH_NOT_FOUND", "تحقیق پیدا نشد.");
    return result;
  }

  function listTeamResearch(teamId) {
    return researchRegistry.list(teamId);
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

  function recordProjectMemory(input = {}) {
    return runMemoryCommand(projectMemory.record, input);
  }

  function assembleAiContext(input = {}) {
    return runAiCommand(aiOrchestration.assembleContext, input, { kind: "system", id: "hero-ai-orchestration" });
  }

  function registerAiProvider(input = {}) {
    const { adapter: ignoredAdapter, actor: inputActor, ...payload } = input;
    const actor = inputActor ?? { kind: "project-owner", id: "hero-owner" };
    const adapter = payload.mode === "deterministic"
      ? createDeterministicAiProviderAdapter(payload.providerId)
      : payload.mode === "live"
        ? providerAdapters[payload.providerId]
        : undefined;
    if (payload.mode === "live" && !adapter) {
      throw new DashboardCommandError("LIVE_PROVIDER_REQUIRES_SEPARATE_AUTHORIZATION", "Provider زنده فقط با Adapter زمان اجرا و مجوز مستقل قابل ثبت است.");
    }
    return runAiCommand(aiOrchestration.registerProvider, { ...payload, ...(adapter ? { adapter } : {}) }, actor);
  }

  function registerAiModel(input = {}) {
    const { actor: inputActor, ...payload } = input;
    return runAiCommand(aiOrchestration.registerModel, payload, inputActor ?? { kind: "project-owner", id: "hero-owner" });
  }

  function registerAiProfile(input = {}) {
    const { actor: inputActor, ...payload } = input;
    return runAiCommand(aiOrchestration.registerProfile, payload, inputActor ?? { kind: "project-owner", id: "hero-owner" });
  }

  function bindAiRole(input = {}) {
    const { actor: inputActor, ...payload } = input;
    return runAiCommand(aiOrchestration.bindRole, payload, inputActor ?? { kind: "project-owner", id: "hero-owner" });
  }

  function registerAiSkill(input = {}) {
    const { actor: inputActor, ...payload } = input;
    return runSkillCommand(skillRegistry.register, payload, inputActor ?? { kind: "project-owner", id: "hero-owner" });
  }

  function bindAiSkill(input = {}) {
    const { actor: inputActor, ...payload } = input;
    return runSkillCommand(skillRegistry.bind, payload, inputActor ?? { kind: "project-owner", id: "hero-owner" });
  }

  function setAiRolePolicy(input = {}) {
    const { actor: inputActor, ...payload } = input;
    return runAiCommand(aiOrchestration.setDefaultRolePolicy, payload, inputActor ?? { kind: "project-owner", id: "hero-owner" });
  }

  function aiRolePolicyHistory(role) {
    return aiOrchestration.rolePolicyHistory(role);
  }

  function rollbackAiRolePolicy(role, input = {}) {
    const { actor: inputActor, ...payload } = input;
    return runAiCommand(aiOrchestration.rollbackRolePolicy, { ...payload, role }, inputActor ?? { kind: "project-owner", id: "hero-owner" });
  }

  function recordAiEvaluation(input = {}) {
    const { actor: ignoredActor, ...payload } = input;
    return runAiCommand(aiOrchestration.recordEvaluation, payload, { kind: "system", id: "hero-ai-orchestration" });
  }

  function proposeAiDecision(input = {}) {
    const { actor: ignoredActor, ...payload } = input;
    return runAiCommand(aiOrchestration.proposeDecision, payload, { kind: "system", id: "hero-ai-orchestration" });
  }

  function evaluateAiInvocation(input = {}) {
    const { actor: ignoredActor, ...payload } = input;
    return runAiCommand(aiOrchestration.evaluateInvocation, payload, { kind: "system", id: "hero-ai-orchestration" });
  }

  function resolveAiDecision(decisionId, input = {}) {
    const { actor: ignoredActor, ...payload } = input;
    return runAiCommand(aiOrchestration.resolveDecision, { ...payload, decisionId });
  }

  function reviewOrganizationPerformance(input = {}) {
    try {
      const review = organizationPerformance.review(input);
      const verdict = review.band === "strong" ? "approved" : review.band === "watch" ? "needs_revision" : "rejected";
      const evaluation = aiOrchestration.recordEvaluation({
        evaluationId: input.evaluationId ?? `EVAL-${review.reviewId}`,
        projectId: input.organizationId,
        target: { kind: "organization-performance", reviewId: review.reviewId, organizationId: review.organizationId, period: review.period },
        verdict,
        score: Math.round(review.average),
        confidence: 1,
        findings: review.findings,
        actor: { kind: "system", id: "hero-organization-evaluator" },
        idempotencyKey: input.evaluationId ? `${input.evaluationId}-record` : `organization-evaluation-${review.reviewId}`
      });
      return Object.freeze({ review, evaluation: evaluation.evaluation });
    } catch (error) {
      if (error instanceof OrganizationPerformanceError || error instanceof AiOrchestrationError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function adviseOrganization(input = {}) {
    const reviewId = input.reviewId ?? organizationPerformance.list().sort((left, right) => String(right.recordedAt).localeCompare(String(left.recordedAt)))[0]?.reviewId;
    if (!reviewId) throw new DashboardCommandError("PERFORMANCE_REVIEW_REQUIRED", "ابتدا ارزیابی عملکرد هر ۱۱ تیم را ثبت کنید.");
    const performanceReview = organizationPerformance.get(reviewId);
    if (!performanceReview) throw new DashboardCommandError("PERFORMANCE_REVIEW_NOT_FOUND", "ارزیابی عملکرد انتخاب‌شده پیدا نشد.");
    const { actor: ignoredActor, performanceReview: ignoredReview, ...payload } = input;
    try {
      return organizationAdvisor.advise({
        ...payload,
        advisorId: payload.advisorId ?? `ADVISOR-${reviewId}`,
        organizationId: performanceReview.organizationId,
        performanceReview,
        actor: { kind: "system", id: "hero-organization-advisor" },
        idempotencyKey: payload.idempotencyKey ?? `organization-advisor-${reviewId}`
      });
    } catch (error) {
      if (error instanceof OrganizationAdvisorError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function persistenceSnapshot() {
    const registries = [
      teamRegistry,
      researchRegistry,
      principlesRegistry,
      releasePromotion,
      planner,
      projectMemory,
      aiOrchestration,
      organizationPerformance,
      skillRegistry,
      organizationAdvisor
    ];
    const dashboardState = controlDashboardPersistenceSnapshot();
    return Object.freeze({
      schemaVersion: "1.0",
      source: "hero-control-plane-domain-registries",
      registries: Object.freeze([...registries.map(registry => registry.persistenceSnapshot?.()).filter(Boolean), dashboardState])
    });
  }

  function domainEvents() {
    const registries = [teamRegistry, researchRegistry, principlesRegistry, releasePromotion, planner, projectMemory, aiOrchestration, organizationPerformance, skillRegistry, organizationAdvisor];
    const seen = new Set();
    return Object.freeze([...registries.flatMap(registry => registry.events?.() ?? []), ...controlEventLog.readAfter()].filter(event => {
      if (seen.has(event.eventId)) return false;
      seen.add(event.eventId);
      return true;
    }).sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? "") || (left.eventId ?? "").localeCompare(right.eventId ?? "")));
  }

  function operationalDiagnostics() {
    return createOperationalDiagnostics({
      persistenceSnapshot: persistenceSnapshot(),
      events: domainEvents(),
      capacity: planner.capacitySnapshot?.(),
      now: timestamp(now)
    });
  }

  function rebuildReadModel(input = {}) {
    const source = persistenceSnapshot();
    const sourceSnapshots = Array.isArray(input.snapshots) && input.snapshots.length > 0
      ? input.snapshots
      : source.registries.map(registry => ({ registryId: registry.registryId, schemaVersion: registry.schemaVersion, data: registry }));
    const sourceEvents = Array.isArray(input.events) ? input.events : domainEvents();
    const rebuilt = createControlDashboard({ now, providerAdapters });
    const hydration = rebuilt.hydrateFromPersistence({
      source: input.source ?? "local-append-only-rebuild",
      snapshots: sourceSnapshots,
      events: sourceEvents
    });
    const beforeReport = operationalDiagnostics();
    const afterReport = rebuilt.operationalDiagnostics();
    const status = hydration.status === "hydrated" && afterReport.status !== "attention" && beforeReport.projectionDigest.value === afterReport.projectionDigest.value
      ? "rebuilt"
      : "attention";
    return Object.freeze({
      status,
      source: "append-only-events-plus-versioned-snapshots",
      hydration,
      before: Object.freeze({ digest: beforeReport.projectionDigest.value, eventCount: beforeReport.projectionDigest.eventCount }),
      after: Object.freeze({ digest: afterReport.projectionDigest.value, eventCount: afterReport.projectionDigest.eventCount }),
      mutation: Object.freeze({ external: false, sourceDashboardChanged: false }),
      decisionBoundary: "read-only-validation-no-authorization-no-dispatch"
    });
  }

  function hydrateFromPersistence(input = {}) {
    const snapshots = Array.isArray(input.snapshots) ? input.snapshots : [];
    const events = Array.isArray(input.events) ? input.events : [];
    const byId = new Map(snapshots.map(snapshot => [snapshot.registryId, snapshot]));
    const targets = [
      ["team-registry", teamRegistry],
      ["team-research", researchRegistry],
      ["principles-registry", principlesRegistry],
      ["release-promotion", releasePromotion],
      ["planner", planner],
      ["project-memory", projectMemory],
      ["ai-orchestration", aiOrchestration],
      ["organization-performance", organizationPerformance],
      ["skill-registry", skillRegistry],
      ["organization-advisor", organizationAdvisor]
    ];
    const hydrated = [];
    const missingRegistryIds = [];
    const dashboardSnapshot = byId.get("control-dashboard");
    if (dashboardSnapshot) {
      const state = dashboardSnapshot.data;
      if (!state || !Array.isArray(state.requests)) throw new DashboardCommandError("HYDRATION_INVALID", "Control dashboard hydration requires requests.");
      requests.clear();
      for (const request of state.requests) {
        if (!request || typeof request !== "object" || typeof request.requestId !== "string") throw new DashboardCommandError("HYDRATION_INVALID", "A hydrated dashboard request is invalid.");
        requests.set(request.requestId, structuredClone(request));
      }
      fullAutonomy = state.fullAutonomy === true;
      globalStop = state.globalStop === true;
      sequence = Number.isInteger(state.sequence) && state.sequence >= 0 ? state.sequence : requests.size;
      const storedControlEvents = Array.isArray(state.events) ? state.events : [];
      const sourceControlEvents = events.length > 0 ? events.filter(isControlEvent) : storedControlEvents.filter(isControlEvent);
      controlEventLog = createInMemoryEventLog({ events: sourceControlEvents });
      const eventProjection = projectControlEvents(sourceControlEvents);
      for (const projectedRequest of eventProjection.requests) {
        const snapshotRequest = requests.get(projectedRequest.requestId);
        if (!snapshotRequest || snapshotRequest.projectId !== projectedRequest.projectId || snapshotRequest.status !== projectedRequest.status) {
          throw new DashboardCommandError("HYDRATION_PROJECTION_MISMATCH", `وضعیت درخواست ${projectedRequest.requestId} با Eventهای append-only هم‌خوان نیست.`);
        }
      }
      if (sourceControlEvents.some(event => event.data?.command === "authority.update") && eventProjection.fullAutonomy !== fullAutonomy) {
        throw new DashboardCommandError("HYDRATION_PROJECTION_MISMATCH", "وضعیت اختیار کامل با Eventهای append-only هم‌خوان نیست.");
      }
      if (sourceControlEvents.some(event => event.type === "authorization.global-stop-activated" || event.type === "authorization.global-stop-cleared") && eventProjection.globalStop !== globalStop) {
        throw new DashboardCommandError("HYDRATION_PROJECTION_MISMATCH", "وضعیت Global Stop با Eventهای append-only هم‌خوان نیست.");
      }
      hydrated.push(Object.freeze({ registryId: "control-dashboard", hydrated: true, requests: requests.size }));
    } else {
      missingRegistryIds.push("control-dashboard");
    }
    for (const [registryId, registry] of targets) {
      const snapshot = byId.get(registryId);
      if (!snapshot) {
        missingRegistryIds.push(registryId);
        continue;
      }
      if (typeof registry.hydrate !== "function") throw new DashboardCommandError("HYDRATION_UNSUPPORTED", `${registryId} hydration is unavailable.`);
      hydrated.push(registry.hydrate({ data: snapshot.data, events }));
    }
    hydrationState = Object.freeze({
      status: missingRegistryIds.length === 0 ? "hydrated" : hydrated.length === 0 ? "empty" : "partial",
      source: input.source ?? "postgresql-versioned-domain-registry-snapshots",
      registryCount: hydrated.length,
      missingRegistryIds: Object.freeze(missingRegistryIds),
      sourceSequence: Math.max(0, ...snapshots.map(snapshot => Number(snapshot.sourceSequence) || 0))
    });
    return Object.freeze({ ...hydrationState, results: Object.freeze(hydrated) });
  }

  async function invokeAi(input = {}) {
    if (globalStop) throw new DashboardCommandError("GLOBAL_STOP_ACTIVE", "توقف اضطراری فعال است؛ اجرای Provider مجاز نیست.");
    const { actor: ignoredActor, ...payload } = input;
    return runAiAsyncCommand(() => aiOrchestration.invoke({
      ...payload,
      actor: { kind: "orchestrator", id: "hero-ai-control-plane" }
    }));
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

  function runPilotDryRunCommand(input = {}) {
    try {
      return runPilotDryRun({
        pilotId: input.pilotId,
        request: input,
        createRequest,
        approveRequest: requestId => approveRequest(requestId),
        runFakeAgent: requestId => runFakeAgent(requestId),
        now
      });
    } catch (error) {
      if (error instanceof PilotDryRunError || error instanceof DashboardCommandError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
  }

  function getPlan(planningId) {
    const result = planner.get(planningId);
    if (!result) throw new DashboardCommandError("PLAN_NOT_FOUND", "برنامه پیدا نشد.");
    return result;
  }

  function decidePlanOutput(planningId, input) {
    try {
      return planner.decideOutput({
        ...input,
        planningId,
        actor: { kind: "project-owner", id: "hero-owner" }
      });
    } catch (error) {
      if (error instanceof PlannerSafetyError || error instanceof PlannerIdempotencyConflictError) throw new DashboardCommandError(error.code, error.message);
      throw error;
    }
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
    backofficeSnapshot,
    persistenceSnapshot,
    domainEvents,
    domainProjectionStatus,
    controlCommandProjection: () => projectControlEvents(domainEvents()),
    backofficeEvents,
    hydrateFromPersistence,
    createRequest,
    approveRequest,
    rejectRequest,
    stopRequest,
    runFakeAgent,
    setFullAutonomy,
    setGlobalStop,
    teamSnapshot: () => teamRegistry.snapshot(),
    aiOrchestrationSnapshot: () => aiOrchestration.snapshot(),
    aiOrchestrationEvents: after => aiOrchestration.events(after),
    operationalDiagnostics,
    rebuildReadModel,
    aiOrchestration,
    recordProjectMemory,
    assembleAiContext,
    registerAiProvider,
    registerAiModel,
    registerAiProfile,
    bindAiRole,
    registerAiSkill,
    bindAiSkill,
    setAiRolePolicy,
    invokeAi,
    recordAiEvaluation,
    evaluateAiInvocation,
    reviewOrganizationPerformance,
    adviseOrganization,
    benchmarkSnapshot,
    runSyntheticBenchmark,
    hydrateBenchmarks,
    attachAiBenchmarkStore,
    compareBenchmarks,
    organizationPerformanceContract: () => organizationPerformance.contract(),
    organizationAdvisorSnapshot: () => organizationAdvisor.snapshot(),
    organizationAdvisorEvents: after => organizationAdvisor.events(after),
    skillSnapshot: () => skillRegistry.snapshot(),
    proposeAiDecision,
    resolveAiDecision,
    aiRolePolicyHistory,
    rollbackAiRolePolicy,
    teamResearchContract: () => researchRegistry.contract(),
    requestTeamResearch,
    startTeamResearch,
    submitTeamResearchReport,
    reviewTeamResearch,
    getTeamResearch,
    listTeamResearch,
    teamTrainingPlan,
    createPlan,
    runPilotDryRun: runPilotDryRunCommand,
    getPlan,
    decidePlanOutput,
    reviewTeam,
    updateTeamPrinciples,
    teamContractHistory,
    rollbackTeamPrinciples,
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
