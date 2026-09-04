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
import { getObservabilityContractSummary, projectOperationalEvent } from "../../../packages/contracts/src/observability.mjs";
import { getAiBenchmarkContractSummary } from "../../../packages/contracts/src/ai-benchmark.mjs";
import { compareAiBenchmarks, runAiBenchmark } from "../../../packages/domain/src/ai-benchmark.mjs";
import { PilotDryRunError, runPilotDryRun } from "../../../packages/domain/src/pilot-dry-run.mjs";
import { createOperationalDiagnostics } from "../../../packages/domain/src/operational-diagnostics.mjs";

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
  const providerAdapters = options.providerAdapters ?? Object.freeze({});
  const eventIdFactories = {
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
  let sequence = 0;
  let teamCommandSequence = 0;
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
      return Object.freeze({
        teamId: team.teamId,
        name: team.name,
        status: team.status,
        version: team.version,
        lastEventId: team.lastEventId,
        responsibility: team.responsibility,
        approvals: Object.freeze({ approved: approvedSections, total: approvalValues.length }),
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
          modules: Object.freeze(Object.values(team.training.modules).map(module => Object.freeze({
            module: module.module,
            score: module.score,
            passed: module.passed,
            recordedAt: module.recordedAt
          })))
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
        assignmentCount: team.assignments.length,
        reviewCount: team.reviews.length
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
    return Object.freeze({
      schemaVersion: "1.0",
      generatedAt: timestamp(now),
      scope: "read-only-development-backoffice",
      access: Object.freeze({
        mode: "same-host-only",
        path: "/backoffice",
        dataPath: "/backoffice-data",
        bindDefault: "127.0.0.1",
        browserRequirement: "مرورگر باید روی همان ماشینی باشد که Docker میزبان Hero است"
      }),
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
      ["control-dashboard", { events: () => [], persistenceSnapshot, hydrate: hydrateFromPersistence }]
    ].map(([registryId, registry]) => Object.freeze({ registryId, eventCount: registry.events?.().length ?? 0, snapshotSupported: typeof registry.persistenceSnapshot === "function", hydrationSupported: typeof registry.hydrate === "function" }));
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
    return compareAiBenchmarks(runs);
  }

  function backofficeEvents({ after = 0, limit = 24 } = {}) {
    if (!Number.isInteger(after) || after < 0) throw new DashboardCommandError("INVALID_INPUT", "مقدار after معتبر نیست.");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new DashboardCommandError("INVALID_INPUT", "مقدار limit باید بین ۱ تا ۱۰۰ باشد.");
    const ordered = [...domainEvents()]
      .sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? "") || (left.eventId ?? "").localeCompare(right.eventId ?? ""));
    const numbered = ordered.map((event, index) => ({ event, sequence: Number.isInteger(event.sequence) ? event.sequence : index + 1 }));
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
    try {
      return command({
        ...input,
        actor,
        idempotencyKey: input.idempotencyKey ?? `dashboard-skill-${aiCommandSequence + 1}`
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
    const dashboardState = Object.freeze({
      schemaVersion: "1.0",
      registryId: "control-dashboard",
      requests: Object.freeze([...requests.values()].map(publicRequest)),
      fullAutonomy,
      globalStop,
      sequence
    });
    return Object.freeze({
      schemaVersion: "1.0",
      source: "hero-control-plane-domain-registries",
      registries: Object.freeze([...registries.map(registry => registry.persistenceSnapshot?.()).filter(Boolean), dashboardState])
    });
  }

  function domainEvents() {
    const registries = [teamRegistry, researchRegistry, principlesRegistry, releasePromotion, planner, projectMemory, aiOrchestration, organizationPerformance, skillRegistry, organizationAdvisor];
    const seen = new Set();
    return Object.freeze(registries.flatMap(registry => registry.events?.() ?? []).filter(event => {
      if (seen.has(event.eventId)) return false;
      seen.add(event.eventId);
      return true;
    }).sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? "") || (left.eventId ?? "").localeCompare(right.eventId ?? "")));
  }

  function operationalDiagnostics() {
    return createOperationalDiagnostics({
      persistenceSnapshot: persistenceSnapshot(),
      events: domainEvents(),
      now: timestamp(now)
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
