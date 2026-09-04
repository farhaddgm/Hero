import {
  PLANNER_ROUTER_PROVIDERS,
  PLANNER_AI_ROLE_ROUTES,
  PLANNER_TEAM_ROUTES,
  PLANNER_TASK_KINDS,
  getPlannerContractSummary
} from "../../contracts/src/planner.mjs";
import {
  OUTPUT_DECISIONS,
  PRODUCT_OUTPUT_DEFINITIONS,
  PRODUCT_OUTPUT_TYPES
} from "../../contracts/src/output-advisory.mjs";
import { TEAM_APPROVAL_MODES, TEAM_CATALOG } from "../../contracts/src/team.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createAuthorizationEngine } from "./authorization-engine.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const OWNER = Object.freeze({ kind: "project-owner", id: "hero-owner" });
const ORCHESTRATOR = Object.freeze({ kind: "orchestrator", id: "hero-control-plane" });
const FORBIDDEN_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const FORBIDDEN_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt)\/)/;

function immutableCopy(value) {
  return Object.freeze(structuredClone(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return JSON.stringify(stableValue(value));
}

function assertIdentifier(label, value, maximum = 128) {
  if (typeof value !== "string" || value.length < 3 || value.length > maximum) {
    throw new Error(`${label} must be a 3-${maximum} character string.`);
  }
}

function assertSafeValue(value, path = "input") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeValue(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      if (FORBIDDEN_KEY.test(key)) throw new PlannerSafetyError(`${path}.${key} is a sensitive field.`);
      assertSafeValue(item, `${path}.${key}`);
    });
    return;
  }
  if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) {
    throw new PlannerSafetyError(`${path} contains a sensitive value.`);
  }
  if (typeof value === "string" && HOST_PATH.test(value)) {
    throw new PlannerSafetyError(`${path} contains a host-specific absolute path.`);
  }
}

function assertActor(actor) {
  assertIdentifier("actor.kind", actor?.kind, 32);
  assertIdentifier("actor.id", actor?.id);
}

function normalizeStrings(label, values, { minimum = 1, maximum = 8, itemMaximum = 240 } = {}) {
  if (values === undefined) return Object.freeze([]);
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new Error(`${label} must contain ${minimum}-${maximum} values.`);
  }
  const normalized = values.map((value, index) => {
    if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > itemMaximum) {
      throw new Error(`${label}[${index}] is invalid.`);
    }
    return value.trim();
  });
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates.`);
  return Object.freeze(normalized);
}

function inferPlatforms(requestText) {
  const web = /\bweb\b|وب|سایت|داشبورد|پنل/i.test(requestText);
  const mobile = /\bmobile\b|موبایل|اندروید|آیفون|آی او اس|ios|react native|اکسپو/i.test(requestText);
  if (web || mobile) return Object.freeze({ platforms: Object.freeze([...(web ? ["web"] : []), ...(mobile ? ["mobile"] : [])]), assumption: null });
  return Object.freeze({
    platforms: Object.freeze(["web"]),
    assumption: "پلتفرم صریح نبود؛ برای سریع‌ترین مسیر، وب به‌عنوان پیش‌فرض قابل‌تغییر برنامه‌ریزی شد."
  });
}

function normalizeContext(value, projectId) {
  if (value === undefined || value === null) return Object.freeze({ ok: true, artifact: null });
  if (!value || typeof value !== "object" || value.status !== "ready" || !value.context) {
    return Object.freeze({ ok: false, reason: "Context آماده و قابل‌خواندن نیست." });
  }
  const context = value.context;
  if (
    context.projectId !== projectId ||
    context.recipientRole !== "planner" ||
    context.boundary?.readOnly !== true ||
    context.boundary?.secretsIncluded !== false ||
    context.boundary?.hostPathsIncluded !== false ||
    context.artifact?.external !== false ||
    typeof context.artifact?.reference !== "string" ||
    !context.artifact.reference.startsWith("hero://")
  ) {
    return Object.freeze({ ok: false, reason: "Context با مرز planner و پروژهٔ جاری منطبق نیست." });
  }
  return Object.freeze({ ok: true, artifact: context.artifact.reference });
}

function routedTask({ planningId, suffix, kind, dependsOn, provider, operation, rationale, teamRoute }) {
  const taskId = `TASK-${planningId}-${suffix}`;
  const aiRoute = PLANNER_AI_ROLE_ROUTES[kind];
  return Object.freeze({
    taskId,
    kind,
    dependsOn: Object.freeze([...dependsOn]),
    route: Object.freeze({
      provider,
      operation,
      rationale,
      aiRole: aiRoute.aiRole,
      providerId: aiRoute.providerId,
      modelId: aiRoute.modelId,
      outputSchema: aiRoute.outputSchema
    }),
    team: Object.freeze({
      owner: teamRoute.owner,
      collaborators: Object.freeze([...teamRoute.collaborators]),
      stage: teamRoute.stage,
      approvalMode: teamRoute.approvalMode
    }),
    state: "planned",
    stoppableBeforeDispatch: true
  });
}

function buildGraph(planningId, platforms) {
  const teamRoute = kind => PLANNER_TEAM_ROUTES[kind];
  const analysis = routedTask({
    planningId, suffix: "ANALYSIS", kind: "analysis", dependsOn: [], provider: "chatgpt", operation: "design",
    rationale: "درخواست فارسی به مسئله، فرض‌ها و معیارهای پذیرش تبدیل می‌شود.", teamRoute: teamRoute("analysis")
  });
  const architecture = routedTask({
    planningId, suffix: "ARCHITECTURE", kind: "architecture", dependsOn: [analysis.taskId], provider: "chatgpt", operation: "design",
    rationale: "طرح فنی و مرزهای اجرا پیش از توسعه مشخص می‌شود.", teamRoute: teamRoute("architecture")
  });
  const implementations = platforms.map(platform => routedTask({
    planningId,
    suffix: platform === "web" ? "IMPLEMENT-WEB" : "IMPLEMENT-MOBILE",
    kind: "implementation",
    dependsOn: [architecture.taskId],
    provider: "codex",
    operation: "develop",
    rationale: platform === "web" ? "Codex پیاده‌سازی وب را در Run ایزوله انجام می‌دهد." : "Codex پیاده‌سازی موبایل را در Run ایزوله انجام می‌دهد.", teamRoute: teamRoute("implementation")
  }));
  const testing = routedTask({
    planningId, suffix: "TEST", kind: "testing", dependsOn: implementations.map(task => task.taskId), provider: "codex", operation: "test",
    rationale: "نتیجهٔ توسعه با تست ساختاریافته و شواهد قابل‌تکرار بررسی می‌شود.", teamRoute: teamRoute("testing")
  });
  const review = routedTask({
    planningId, suffix: "REVIEW", kind: "review", dependsOn: [testing.taskId], provider: "claude", operation: "review",
    rationale: "Claude بازبینی مستقل معماری، امنیت، edge case و تست را انجام می‌دهد.", teamRoute: teamRoute("review")
  });
  const handoff = routedTask({
    planningId, suffix: "CURSOR-HANDOFF", kind: "handoff", dependsOn: [review.taskId], provider: "cursor", operation: "review",
    rationale: "Cursor فقط بستهٔ تحویل IDE و checkpoint انسانی دریافت می‌کند.", teamRoute: teamRoute("handoff")
  });
  return Object.freeze({ nodes: Object.freeze([analysis, architecture, ...implementations, testing, review, handoff]) });
}

function assessTeamReadiness(graph, teamRegistry) {
  if (!teamRegistry) return null;
  const teamIds = [...new Set(graph.nodes.flatMap(node => [node.team.owner, ...node.team.collaborators]))];
  const teams = teamIds.map(teamId => {
    const team = teamRegistry.get(teamId);
    const status = team?.status ?? "unknown";
    return Object.freeze({ teamId, status, eligible: status === "ready" });
  });
  const ownerIds = [...new Set(graph.nodes.map(node => node.team.owner))];
  const blockers = ownerIds
    .map(teamId => teams.find(team => team.teamId === teamId))
    .filter(team => !team?.eligible)
    .map(team => ({ teamId: team.teamId, status: team.status, reason: "تیم مالک هنوز آمادهٔ تخصیص نیست." }));
  return Object.freeze({
    source: "team-registry",
    ready: blockers.length === 0,
    capacity: "not-modeled",
    teams: Object.freeze(teams),
    blockers: Object.freeze(blockers)
  });
}

function assertIsoTimestamp(label, value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new PlannerSafetyError(`${label} must be an ISO timestamp.`);
  return value;
}

function assessCapacity(capacityInput, graph) {
  if (capacityInput === undefined || capacityInput === null) {
    return Object.freeze({ status: "not-provided", ready: true, conflicts: Object.freeze([]), teamUsage: Object.freeze([]), resourceClaims: Object.freeze([]) });
  }
  if (!capacityInput || typeof capacityInput !== "object" || Array.isArray(capacityInput)) throw new PlannerSafetyError("capacity must be an object.");
  const teamLimits = capacityInput.teamLimits === undefined ? [] : capacityInput.teamLimits;
  const resourceClaims = capacityInput.resourceClaims === undefined ? [] : capacityInput.resourceClaims;
  if (!Array.isArray(teamLimits) || teamLimits.length > 32) throw new PlannerSafetyError("capacity.teamLimits must contain at most 32 items.");
  if (!Array.isArray(resourceClaims) || resourceClaims.length > 64) throw new PlannerSafetyError("capacity.resourceClaims must contain at most 64 items.");
  const limits = new Map();
  for (const [index, item] of teamLimits.entries()) {
    assertIdentifier(`capacity.teamLimits[${index}].teamId`, item?.teamId, 64);
    const maxConcurrent = Number(item?.maxConcurrent);
    const active = Number(item?.active ?? 0);
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 0 || maxConcurrent > 1000 || !Number.isInteger(active) || active < 0 || active > 1000) throw new PlannerSafetyError("capacity team limits must use non-negative integer counts.");
    if (limits.has(item.teamId)) throw new PlannerSafetyError(`capacity has duplicate team limit: ${item.teamId}.`);
    limits.set(item.teamId, { teamId: item.teamId, maxConcurrent, active });
  }
  const claims = resourceClaims.map((item, index) => {
    assertIdentifier(`capacity.resourceClaims[${index}].claimId`, item?.claimId, 128);
    assertIdentifier(`capacity.resourceClaims[${index}].resourceId`, item?.resourceId, 128);
    assertIdentifier(`capacity.resourceClaims[${index}].teamId`, item?.teamId, 64);
    const startsAt = assertIsoTimestamp(`capacity.resourceClaims[${index}].startsAt`, item?.startsAt);
    const endsAt = assertIsoTimestamp(`capacity.resourceClaims[${index}].endsAt`, item?.endsAt);
    if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new PlannerSafetyError("capacity claim end must be later than start.");
    return { claimId: item.claimId, resourceId: item.resourceId, teamId: item.teamId, taskId: item.taskId ?? null, startsAt, endsAt };
  });
  const conflicts = [];
  for (const [resourceId, sameResource] of Map.groupBy(claims, claim => claim.resourceId)) {
    for (let index = 0; index < sameResource.length; index += 1) {
      for (let next = index + 1; next < sameResource.length; next += 1) {
        const left = sameResource[index];
        const right = sameResource[next];
        if (Date.parse(left.startsAt) < Date.parse(right.endsAt) && Date.parse(right.startsAt) < Date.parse(left.endsAt)) {
          conflicts.push({ type: "resource-overlap", resourceId, claimIds: [left.claimId, right.claimId], reason: "یک منبع در دو بازهٔ هم‌پوشان تخصیص یافته است." });
        }
      }
    }
  }
  const plannedByTeam = new Map();
  for (const node of graph.nodes) plannedByTeam.set(node.team.owner, (plannedByTeam.get(node.team.owner) ?? 0) + 1);
  const teamUsage = [...limits.values()].map(limit => {
    const planned = plannedByTeam.get(limit.teamId) ?? 0;
    const total = limit.active + planned;
    if (total > limit.maxConcurrent) conflicts.push({ type: "team-capacity", teamId: limit.teamId, active: limit.active, planned, capacity: limit.maxConcurrent, reason: "ظرفیت هم‌زمان تیم برای این برنامه کافی نیست." });
    return { ...limit, planned, total, available: Math.max(0, limit.maxConcurrent - total) };
  });
  return Object.freeze({ status: conflicts.length ? "conflict" : "checked", ready: conflicts.length === 0, conflicts: Object.freeze(conflicts), teamUsage: Object.freeze(teamUsage), resourceClaims: Object.freeze(claims) });
}

function outputSignals(requestText) {
  return {
    automation: /اتوماسیون|خودکار|workflow|فرایند تکراری|یکپارچه‌سازی/i.test(requestText),
    data: /داده|سنجه|KPI|داشبورد تحلیلی|گزارش‌گیری|هوش مصنوعی/i.test(requestText),
    research: /تحقیق|بررسی|benchmark|بنچمارک|مطالعه|مقایسهٔ گزینه/i.test(requestText),
    decision: /تصمیم|انتخاب بین|ارزیابی گزینه/i.test(requestText)
  };
}

function scoreOutputOption(outputId, { platforms, signals }) {
  const scores = {
    value: 3,
    deliverySpeed: 3,
    cost: 3,
    risk: 3,
    maintainability: 3,
    scalability: 3,
    userFit: 3
  };
  const fitReasons = [];
  if (outputId === "prototype") {
    scores.deliverySpeed = 5; scores.cost = 5; scores.risk = 4; scores.userFit = 4;
    fitReasons.push("برای کاهش ابهام و یادگیری سریع مناسب است.");
  }
  if (outputId === "web-app") {
    scores.deliverySpeed = 4; scores.cost = 4; scores.maintainability = 4; scores.userFit = platforms.includes("web") ? 5 : 2;
    if (platforms.includes("web")) fitReasons.push("با پلتفرم وب استنباط‌شده هم‌راستاست.");
  }
  if (outputId === "mobile-app") {
    scores.deliverySpeed = 3; scores.cost = 3; scores.userFit = platforms.includes("mobile") ? 5 : 2;
    if (platforms.includes("mobile")) fitReasons.push("با نیاز موبایل هم‌راستاست.");
  }
  if (outputId === "web-and-mobile") {
    scores.value = platforms.length === 2 ? 5 : 2; scores.deliverySpeed = 2; scores.cost = 2; scores.risk = 2; scores.scalability = 4; scores.userFit = platforms.length === 2 ? 5 : 2;
    if (platforms.length === 2) fitReasons.push("پوشش هم‌زمان وب و موبایل را فراهم می‌کند.");
  }
  if (outputId === "api-service") {
    scores.maintainability = 4; scores.scalability = 5; scores.userFit = signals.automation || signals.data ? 4 : 3;
    if (signals.automation || signals.data) fitReasons.push("برای اتصال چند مصرف‌کننده یا سیستم مناسب است.");
  }
  if (outputId === "workflow-automation") {
    scores.value = signals.automation ? 5 : 2; scores.deliverySpeed = 4; scores.cost = 4; scores.risk = signals.automation ? 4 : 2; scores.userFit = signals.automation ? 5 : 2;
    if (signals.automation) fitReasons.push("درخواست نشانهٔ مستقیم اتوماسیون فرایند دارد.");
  }
  if (outputId === "data-product") {
    scores.value = signals.data ? 5 : 2; scores.maintainability = 4; scores.scalability = 4; scores.userFit = signals.data ? 5 : 2;
    if (signals.data) fitReasons.push("درخواست به داده، سنجه یا گزارش‌گیری اشاره دارد.");
  }
  if (outputId === "research-report") {
    scores.value = signals.research ? 5 : 2; scores.deliverySpeed = 4; scores.cost = 4; scores.risk = 5; scores.userFit = signals.research ? 5 : 2;
    if (signals.research) fitReasons.push("پیش از ساخت، تحقیق و مقایسه را در اولویت می‌گذارد.");
  }
  if (outputId === "decision-brief") {
    scores.value = signals.decision || signals.research ? 5 : 2; scores.deliverySpeed = 5; scores.cost = 5; scores.risk = 5; scores.userFit = signals.decision || signals.research ? 5 : 2;
    if (signals.decision || signals.research) fitReasons.push("برای تصمیم‌گیری بین گزینه‌ها خروجی کم‌هزینه و شفاف می‌دهد.");
  }
  const totalScore = Number((Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length).toFixed(2));
  return Object.freeze({ scores: Object.freeze(scores), totalScore, fitReasons: Object.freeze(fitReasons) });
}

function buildOutputAdvisory(requestText, platforms, preferredOutputType) {
  const signals = outputSignals(requestText);
  const scored = PRODUCT_OUTPUT_DEFINITIONS.map(definition => {
    const score = scoreOutputOption(definition.outputId, { platforms, signals });
    return Object.freeze({
      ...definition,
      scores: score.scores,
      totalScore: score.totalScore,
      fitReasons: score.fitReasons
    });
  });
  let options = [...scored];
  if (preferredOutputType !== undefined) {
    if (typeof preferredOutputType !== "string" || !PRODUCT_OUTPUT_TYPES.includes(preferredOutputType)) throw new PlannerSafetyError("preferredOutputType is not supported.");
    options = options.map(option => option.outputId === preferredOutputType ? Object.freeze({ ...option, totalScore: option.totalScore + 0.5, fitReasons: Object.freeze([...option.fitReasons, "این گزینه به‌صورت صریح توسط درخواست‌کننده ترجیح داده شده است."]) }) : option);
  }
  options.sort((left, right) => right.totalScore - left.totalScore || left.outputId.localeCompare(right.outputId));
  const recommendation = options[0];
  return Object.freeze({
    advisoryVersion: "1.0",
    evaluatedDimensions: Object.freeze(["value", "deliverySpeed", "cost", "risk", "maintainability", "scalability", "userFit"]),
    options: Object.freeze(options),
    recommendation: Object.freeze({ outputId: recommendation.outputId, label: recommendation.label, rationale: Object.freeze([...recommendation.fitReasons, "امتیاز ترکیبی ابعاد و trade-offها بالاتر است."]) }),
    decision: Object.freeze({ state: "pending-owner", decision: null, selectedOutputId: null, feedback: "", decidedAt: null, decidedBy: null }),
    dispatch: Object.freeze({ ready: false, reason: "ابتدا تصمیم مالک دربارهٔ گزینهٔ خروجی و سپس آمادگی تیم‌های مالک لازم است." })
  });
}

function withOutputDecision(plan, decision, teamReadiness) {
  const teamsReady = teamReadiness?.ready === true;
  const capacityReady = teamReadiness?.capacityCheck?.ready !== false;
  const outputAdvisory = {
    ...plan.outputAdvisory,
    decision,
    dispatch: {
      ready: decision.state === "approved" && teamsReady && capacityReady,
      reason: decision.state !== "approved"
        ? "تا تأیید گزینهٔ خروجی توسط مالک، تولید آغاز نمی‌شود."
        : !teamsReady
          ? "گزینهٔ خروجی تأیید شده، اما آمادگی تیم‌های مالک هنوز کامل نیست."
          : !capacityReady
            ? "گزینهٔ خروجی تأیید شده، اما تعارض ظرفیت یا منبع باید رفع شود."
            : "گزینهٔ خروجی تأیید و تیم‌های مالک آماده‌اند؛ dispatch طبق مجوز مستقل بعدی ممکن است."
    }
  };
  return immutableCopy({
    ...plan,
    outputAdvisory,
    dispatch: outputAdvisory.dispatch
  });
}

export function validateTaskGraph(graph) {
  const errors = [];
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length < 6) return ["Task Graph is incomplete."];
  const ids = new Set();
  const byId = new Map();
  const knownTeams = new Set(TEAM_CATALOG.map(team => team.teamId));
  for (const node of graph.nodes) {
    if (ids.has(node.taskId)) errors.push(`Duplicate task ID: ${node.taskId}.`);
    ids.add(node.taskId);
    byId.set(node.taskId, node);
    if (!PLANNER_TASK_KINDS.includes(node.kind)) errors.push(`Unsupported task kind: ${node.kind}.`);
    if (!PLANNER_ROUTER_PROVIDERS.includes(node.route?.provider)) errors.push(`Unsupported route provider: ${node.route?.provider}.`);
    if (!Array.isArray(node.dependsOn)) errors.push(`Task ${node.taskId} has invalid dependencies.`);
    if (!knownTeams.has(node.team?.owner)) errors.push(`Task ${node.taskId} has an unknown team owner.`);
    if (!Array.isArray(node.team?.collaborators)) errors.push(`Task ${node.taskId} has invalid team collaborators.`);
    for (const collaborator of node.team?.collaborators ?? []) {
      if (!knownTeams.has(collaborator)) errors.push(`Task ${node.taskId} has an unknown team collaborator.`);
      if (collaborator === node.team?.owner) errors.push(`Task ${node.taskId} repeats its team owner as collaborator.`);
    }
    if (!TEAM_APPROVAL_MODES.includes(node.team?.approvalMode)) errors.push(`Task ${node.taskId} has an invalid team approval mode.`);
    if (typeof node.team?.stage !== "string" || node.team.stage.length < 3) errors.push(`Task ${node.taskId} has an invalid team stage.`);
  }
  for (const node of graph.nodes) {
    for (const dependency of node.dependsOn ?? []) {
      if (!byId.has(dependency)) errors.push(`Task ${node.taskId} depends on an unknown task.`);
      if (dependency === node.taskId) errors.push(`Task ${node.taskId} cannot depend on itself.`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(taskId) {
    if (visiting.has(taskId)) { errors.push("Task Graph contains a cycle."); return; }
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    for (const dependency of byId.get(taskId)?.dependsOn ?? []) visit(dependency);
    visiting.delete(taskId);
    visited.add(taskId);
  }
  for (const node of graph.nodes) visit(node.taskId);
  return Object.freeze([...new Set(errors)]);
}

export class PlannerSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "PlannerSafetyError";
    this.code = "PLANNER_SAFETY_REJECTED";
  }
}

export class PlannerIdempotencyConflictError extends Error {
  constructor(key) {
    super(`idempotencyKey ${key} was already used with different planner input.`);
    this.name = "PlannerIdempotencyConflictError";
    this.code = "IDEMPOTENCY_CONFLICT";
  }
}

export function createPlanner(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  const plans = new Map();
  const idempotency = new Map();
  const outputDecisionIdempotency = new Map();
  const teamRegistry = options.teamRegistry ?? null;
  let nextEvent = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => `evt_planner_${String(++nextEvent).padStart(6, "0")}`);

  function append(planningId, type, actor, data) {
    const event = createOperationalEvent({
      eventId: eventIdFactory(), aggregateType: "planning", aggregateId: planningId, type, occurredAt: now(), actor, data
    });
    return eventLog.append(event, { expectedVersion: eventLog.currentVersion("planning", planningId) });
  }

  function plan(input) {
    assertSafeValue(input);
    assertIdentifier("planningId", input?.planningId, 80);
    assertIdentifier("projectId", input?.projectId);
    assertIdentifier("requestId", input?.requestId, 80);
    assertIdentifier("documentVersion", input?.documentVersion, 48);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    if (typeof input.requestText !== "string" || input.requestText.trim().length < 12 || input.requestText.trim().length > 1600) {
      throw new Error("requestText must be a 12-1600 character string.");
    }
    const extraAssumptions = normalizeStrings("assumptions", input.assumptions, { minimum: 1, maximum: 6 });
    const customCriteria = normalizeStrings("acceptanceCriteria", input.acceptanceCriteria, { minimum: 1, maximum: 8 });
    const inputFingerprint = fingerprint({ ...input, requestText: input.requestText.trim(), extraAssumptions, customCriteria });
    const replayKey = `PLAN\u0000${input.planningId}\u0000${input.idempotencyKey}`;
    const replayed = idempotency.get(replayKey);
    if (replayed) {
      if (replayed.fingerprint !== inputFingerprint) throw new PlannerIdempotencyConflictError(input.idempotencyKey);
      return immutableCopy({ ...replayed.result, idempotent: true });
    }
    if (plans.has(input.planningId)) throw new Error(`planningId ${input.planningId} already exists.`);
    const context = normalizeContext(input.projectContext, input.projectId);
    if (!context.ok) {
      const event = append(input.planningId, "planning.created", input.actor, {
        requestId: input.requestId, documentVersion: input.documentVersion, state: "blocked", code: "CONTEXT_NOT_READY"
      });
      const result = immutableCopy({
        planningId: input.planningId, requestId: input.requestId, projectId: input.projectId, documentVersion: input.documentVersion,
        state: "blocked", code: "CONTEXT_NOT_READY", reason: context.reason, spec: null, graph: null, teamReadiness: null, outputAdvisory: null, dispatch: { ready: false, reason: "Context آماده نیست." }, idempotent: false, eventId: event.eventId
      });
      plans.set(input.planningId, result);
      idempotency.set(replayKey, { fingerprint: inputFingerprint, result });
      return result;
    }
    const inferred = inferPlatforms(input.requestText.trim());
    const assumptions = Object.freeze([
      ...extraAssumptions,
      ...(inferred.assumption ? [inferred.assumption] : []),
      "هیچ provider زنده، merge، deploy، secret change یا عملیات حساس با ساخت Plan انجام نمی‌شود."
    ]);
    const acceptanceCriteria = customCriteria.length > 0 ? customCriteria : Object.freeze([
      "Spec، فرض‌ها و معیارهای پذیرش برای مالک قابل‌فهم باشد.",
      "Task Graph بدون چرخه و با وابستگی‌های صریح ساخته شود.",
      "برای هر Task، دلیل انتخاب Agent و عملیات مجاز روشن باشد.",
      "Graph پیش از Dispatch قابل توقف باشد و عملیات حساس را شامل نشود."
    ]);
    const spec = immutableCopy({
      specId: `SPEC-${input.planningId}`,
      version: input.documentVersion,
      intent: input.requestText.trim(),
      targetPlatforms: inferred.platforms,
      assumptions,
      acceptanceCriteria,
      contextArtifact: context.artifact,
      language: "fa",
      teamRouting: PLANNER_TEAM_ROUTES
    });
    const graph = buildGraph(input.planningId, inferred.platforms);
    const graphErrors = validateTaskGraph(graph);
    if (graphErrors.length > 0) throw new Error(`Invalid Task Graph: ${graphErrors.join(" ")}`);
    const teamReadiness = assessTeamReadiness(graph, teamRegistry);
    const capacity = assessCapacity(input.capacity, graph);
    const readiness = teamReadiness ? Object.freeze({ ...teamReadiness, capacityCheck: capacity }) : Object.freeze({ source: "team-registry", ready: true, capacityCheck: capacity, teams: Object.freeze([]), blockers: Object.freeze([]) });
    const outputAdvisory = buildOutputAdvisory(input.requestText.trim(), inferred.platforms, input.preferredOutputType);
    const created = append(input.planningId, "planning.created", input.actor, {
      requestId: input.requestId, documentVersion: input.documentVersion, state: "ready", specId: spec.specId, targetPlatforms: spec.targetPlatforms,
      recommendedOutputId: outputAdvisory.recommendation.outputId
    });
    const graphEvent = append(input.planningId, "task-graph.created", input.actor, {
      specId: spec.specId, taskIds: graph.nodes.map(node => node.taskId)
    });
    for (const node of graph.nodes) {
      append(input.planningId, "router.selection-recorded", input.actor, {
        taskId: node.taskId,
        kind: node.kind,
        provider: node.route.provider,
        operation: node.route.operation,
        teamOwner: node.team.owner,
        teamCollaborators: node.team.collaborators,
        teamStage: node.team.stage,
        teamApprovalMode: node.team.approvalMode
      });
    }
    const result = immutableCopy({
      planningId: input.planningId,
      requestId: input.requestId,
      projectId: input.projectId,
      documentVersion: input.documentVersion,
      state: "ready",
      code: "PLAN_READY",
      spec,
      graph,
      teamReadiness: readiness,
      outputAdvisory,
      dispatch: outputAdvisory.dispatch,
      stop: { canHaltBeforeDispatch: true, nextState: "halted" },
      boundary: { providerInvocation: false, runnerCreated: false, codeMutation: false, sensitiveOperation: false },
      version: eventLog.currentVersion("planning", input.planningId),
      eventId: graphEvent.eventId,
      idempotent: false
    });
    plans.set(input.planningId, result);
    idempotency.set(replayKey, { fingerprint: inputFingerprint, result });
    return result;
  }

  function decideOutput(input = {}) {
    assertSafeValue(input);
    assertIdentifier("planningId", input?.planningId, 80);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    if (input.actor.kind !== OWNER.kind) throw new PlannerSafetyError("Only project-owner may decide the product output.");
    const existing = plans.get(input.planningId);
    if (!existing || !existing.outputAdvisory) throw new PlannerSafetyError("A ready plan with an output advisory is required.");
    const decision = input.decision;
    if (!OUTPUT_DECISIONS.includes(decision)) throw new PlannerSafetyError("Output decision must be approved, rejected or rework-requested.");
    const selectedOutputId = input.selectedOutputId ?? (decision === "approved" ? existing.outputAdvisory.recommendation.outputId : null);
    if (selectedOutputId !== null && (!PRODUCT_OUTPUT_TYPES.includes(selectedOutputId) || !existing.outputAdvisory.options.some(option => option.outputId === selectedOutputId))) {
      throw new PlannerSafetyError("selectedOutputId is not one of the evaluated product outputs.");
    }
    const feedback = input.feedback === undefined ? "" : String(input.feedback).trim();
    if (decision !== "approved" && feedback.length < 3) throw new PlannerSafetyError("Rejecting or returning an output decision requires actionable feedback.");
    const value = { planningId: input.planningId, decision, selectedOutputId, feedback, actor: input.actor };
    const replayKey = `OUTPUT\u0000${input.planningId}\u0000${input.idempotencyKey}`;
    const inputFingerprint = fingerprint(value);
    const replayed = outputDecisionIdempotency.get(replayKey);
    if (replayed) {
      if (replayed.fingerprint !== inputFingerprint) throw new PlannerIdempotencyConflictError(input.idempotencyKey);
      return immutableCopy({ ...replayed.result, idempotent: true });
    }
    const event = append(input.planningId, "planning.output-decision-recorded", input.actor, { decision, selectedOutputId, feedback });
    const decisionRecord = {
      state: decision === "approved" ? "approved" : decision,
      decision,
      selectedOutputId,
      feedback,
      decidedAt: now(),
      decidedBy: input.actor.id
    };
    const result = withOutputDecision({ ...existing, version: event.aggregateVersion, eventId: event.eventId }, decisionRecord, existing.teamReadiness);
    plans.set(input.planningId, result);
    for (const stored of idempotency.values()) {
      if (stored.result?.planningId === input.planningId) stored.result = result;
    }
    outputDecisionIdempotency.set(replayKey, { fingerprint: inputFingerprint, result });
    return result;
  }

  function halt(input) {
    assertSafeValue(input);
    assertIdentifier("planningId", input?.planningId, 80);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertActor(input?.actor);
    const existing = plans.get(input.planningId);
    if (!existing) throw new Error(`planningId ${input.planningId} does not exist.`);
    const haltFingerprint = fingerprint({ actor: input.actor, reason: input.reason ?? "owner-stop" });
    const replayKey = `HALT\u0000${input.planningId}\u0000${input.idempotencyKey}`;
    const replayed = idempotency.get(replayKey);
    if (replayed) {
      if (replayed.fingerprint !== haltFingerprint) throw new PlannerIdempotencyConflictError(input.idempotencyKey);
      return immutableCopy({ ...replayed.result, idempotent: true });
    }
    if (existing.state !== "ready") throw new Error("Only a ready plan can be halted.");
    const event = append(input.planningId, "planning.halted", input.actor, { reason: input.reason ?? "owner-stop", pendingTaskIds: existing.graph.nodes.map(node => node.taskId) });
    const result = immutableCopy({
      ...existing,
      state: "halted",
      code: "GRAPH_HALTED",
      graph: { ...existing.graph, nodes: existing.graph.nodes.map(node => ({ ...node, state: "halted" })) },
      stop: { canHaltBeforeDispatch: false, haltedAtSafeCheckpoint: true },
      version: event.aggregateVersion,
      eventId: event.eventId,
      idempotent: false
    });
    plans.set(input.planningId, result);
    idempotency.set(replayKey, { fingerprint: haltFingerprint, result });
    return result;
  }

  function persistenceSnapshot() {
    return immutableCopy({
      schemaVersion: "1.0",
      registryId: "planner",
      plans: [...plans.values()]
    });
  }

  function hydrate(input = {}) {
    const state = input.data ?? input;
    if (!state || !Array.isArray(state.plans)) throw new PlannerSafetyError("Planner hydration requires plans.");
    if (Array.isArray(input.events)) eventLog.load(input.events.filter(event => event.aggregateType === "planning"));
    plans.clear();
    idempotency.clear();
    outputDecisionIdempotency.clear();
    for (const plan of state.plans) {
      if (!plan || typeof plan !== "object" || typeof plan.planningId !== "string") throw new PlannerSafetyError("A hydrated plan is invalid.");
      plans.set(plan.planningId, immutableCopy(plan));
    }
    return immutableCopy({ registryId: "planner", hydrated: true, plans: plans.size });
  }

  return Object.freeze({
    plan,
    decideOutput,
    halt,
    persistenceSnapshot,
    hydrate,
    get: planningId => plans.has(planningId) ? immutableCopy(plans.get(planningId)) : null,
    events: () => eventLog.readAfter(),
    contract: () => getPlannerContractSummary()
  });
}

export function createPlannerHarness(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const authorization = options.authorizationEngine ?? createAuthorizationEngine({ eventLog, now });
  const planner = options.planner ?? createPlanner({ eventLog, now });

  function run(input) {
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion, 48);
    const authorizationId = `AUTH-PLANNER-${input.plan.planningId}`;
    authorization.grant({
      authorizationId, mode: "direct", entries: [{ stepId: input.stepId, documentVersion: input.documentVersion }], operations: ["design"],
      actor: OWNER, idempotencyKey: `${input.plan.planningId}-grant`, note: "deterministic planner harness only"
    });
    const dispatch = authorization.evaluateDispatch({
      authorizationId, stepId: input.stepId, documentVersion: input.documentVersion, operation: "design", actor: ORCHESTRATOR,
      idempotencyKey: `${input.plan.planningId}-dispatch`
    });
    if (!dispatch.decision.authorized) throw new Error(`Planner dispatch was blocked: ${dispatch.decision.code}.`);
    const result = planner.plan({ ...input.plan, documentVersion: input.documentVersion, actor: ORCHESTRATOR });
    return immutableCopy({ dispatch: dispatch.decision, result, events: eventLog.readAfter() });
  }

  return Object.freeze({ run, contract: () => getPlannerContractSummary() });
}
