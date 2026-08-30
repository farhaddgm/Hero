import {
  PLANNER_ROUTER_PROVIDERS,
  PLANNER_TEAM_ROUTES,
  PLANNER_TASK_KINDS,
  getPlannerContractSummary
} from "../../contracts/src/planner.mjs";
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
  return Object.freeze({
    taskId,
    kind,
    dependsOn: Object.freeze([...dependsOn]),
    route: Object.freeze({ provider, operation, rationale }),
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
  }
}

export function createPlanner(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  const plans = new Map();
  const idempotency = new Map();
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
        state: "blocked", code: "CONTEXT_NOT_READY", reason: context.reason, spec: null, graph: null, teamReadiness: null, idempotent: false, eventId: event.eventId
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
    const created = append(input.planningId, "planning.created", input.actor, {
      requestId: input.requestId, documentVersion: input.documentVersion, state: "ready", specId: spec.specId, targetPlatforms: spec.targetPlatforms
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
      teamReadiness,
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

  return Object.freeze({
    plan,
    halt,
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
