export const OPERATIONAL_DATA_CONTRACT_VERSION = "1.0";

export const AGGREGATE_TYPES = Object.freeze([
  "project",
  "work-item",
  "task",
  "authorization",
  "runner",
  "run",
  "evidence",
  "artifact",
  "decision",
  "memory",
  "planning",
  "team",
  "principle",
  "release",
  "quality-gate",
  "web-factory",
  "mobile-factory",
  "assurance-gate",
  "portability-gate",
  "research",
  "ai-provider",
  "ai-model",
  "ai-profile",
  "ai-binding",
  "ai-role-policy",
  "ai-invocation",
  "ai-evaluation",
  "ai-decision",
  "skill",
  "skill-binding",
  "organization-performance",
  "organization-advisor"
]);

export const EVENT_TYPES = Object.freeze([
  "control.command-recorded",
  "project.requested",
  "work-item.planned",
  "task.created",
  "task.updated",
  "authorization.granted",
  "authorization.revoked",
  "authorization.dispatch-authorized",
  "authorization.dispatch-blocked",
  "authorization.global-stop-activated",
  "authorization.global-stop-cleared",
  "runner.prepared",
  "runner.started",
  "runner.checkpoint-requested",
  "runner.checkpointed",
  "runner.cancelled",
  "runner.failed",
  "runner.cleaned",
  "run.drafted",
  "run.planned",
  "run.queued",
  "run.started",
  "run.checkpointed",
  "run.review-requested",
  "run.review-approved",
  "run.review-changes-requested",
  "run.completed",
  "run.failed",
  "run.paused",
  "run.resumed",
  "run.retry-requested",
  "run.cancelled",
  "evidence.recorded",
  "decision.requested",
  "decision.resolved",
  "memory.recorded",
  "memory.superseded",
  "context.assembled",
  "planning.created",
  "planning.output-decision-recorded",
  "planning.halted",
  "task-graph.created",
  "router.selection-recorded",
  "team.contract-reviewed",
  "team.principles-updated",
  "team.deliverable-reviewed",
  "team.rework-requested",
  "team.assigned",
  "team.assignment-updated",
  "team.autonomy-changed",
  "team.training-recorded",
  "team.merged",
  "team.split",
  "team.workflow-configured",
  "team.research-requested",
  "team.research-started",
  "team.research-report-ready",
  "team.research-reviewed",
  "team.research-applied",
  "ai.provider-registered",
  "ai.model-registered",
  "ai.profile-registered",
  "ai.role-bound",
  "ai.role-policy-updated",
  "ai.provider-health-checked",
  "ai.invocation-started",
  "ai.invocation-retry-scheduled",
  "ai.invocation-completed",
  "ai.invocation-blocked",
  "ai.invocation-failed",
  "ai.evaluation-recorded",
  "ai.decision-proposed",
  "ai.decision-resolved",
  "skill.registered",
  "skill.binding-created",
  "organization-performance.review-recorded",
  "organization-advisor.created",
  "principle.defined",
  "principle.reviewed",
  "principle.rework-requested",
  "release.registered",
  "release.test-deployment-requested",
  "release.test-deployment-recorded",
  "release.test-evidence-recorded",
  "release.production-approval-requested",
  "release.production-approved",
  "release.production-promotion-requested",
  "release.production-deployment-recorded",
  "release.rolled-back",
  "quality-gate.opened",
  "quality-gate.test-recorded",
  "quality-gate.review-recorded",
  "quality-gate.correction-authorized",
  "quality-gate.approved",
  "quality-gate.stopped",
  "web-factory.blueprint-created",
  "web-factory.recipe-created",
  "web-factory.preview-gated",
  "web-factory.quality-recorded",
  "mobile-factory.blueprint-created",
  "mobile-factory.recipe-created",
  "mobile-factory.preview-gated",
  "mobile-factory.quality-recorded",
  "assurance-gate.assessment-started",
  "assurance-gate.assessment-approved",
  "assurance-gate.assessment-blocked",
  "portability-gate.assessment-started",
  "portability-gate.assessment-approved",
  "portability-gate.assessment-blocked",
  "artifact.delivered",
  "outbox.dispatch-requested"
]);

export const ACTOR_KINDS = Object.freeze([
  "project-owner",
  "admin",
  "orchestrator",
  "agent",
  "system"
]);

export const SENSITIVE_ACTIONS = Object.freeze([
  "production-deploy",
  "destructive-data-operation",
  "external-spend",
  "secret-change",
  "external-message",
  "irreversible-operation"
]);

export const OPERATIONAL_ENTITY_MODEL = Object.freeze([
  Object.freeze({ id: "project", sourceOfTruth: "projects", purpose: "یک محصول یا درخواست مستقل" }),
  Object.freeze({ id: "work-item", sourceOfTruth: "work_items", purpose: "خواستهٔ قابل‌تحویل کاربر" }),
  Object.freeze({ id: "task", sourceOfTruth: "tasks", purpose: "واحد قابل‌اجرا در Task Graph" }),
  Object.freeze({ id: "authorization", sourceOfTruth: "authorizations", purpose: "مجوز نسخه‌دار و قابل‌ابطال" }),
  Object.freeze({ id: "run", sourceOfTruth: "runs", purpose: "اجرای ایزوله و checkpointهای آن" }),
  Object.freeze({ id: "event", sourceOfTruth: "events", purpose: "حقیقت append-only برای تغییرات عملیاتی" }),
  Object.freeze({ id: "evidence", sourceOfTruth: "evidence", purpose: "نتیجهٔ تست، review یا بررسی" }),
  Object.freeze({ id: "artifact", sourceOfTruth: "artifacts", purpose: "خروجی تحویلی، commit یا bundle" }),
  Object.freeze({ id: "memory", sourceOfTruth: "memory_records", purpose: "Versioned, minimum project context" }),
  Object.freeze({ id: "planning", sourceOfTruth: "planning_records", purpose: "Versioned product spec, task graph and routing decision" }),
  Object.freeze({ id: "team", sourceOfTruth: "teams", purpose: "قرارداد، آموزش، اختیار و عملکرد نسخه‌دار هر تیم" }),
  Object.freeze({ id: "research", sourceOfTruth: "team_research", purpose: "درخواست تحقیق، benchmark، گزارش و تصمیم مالک دربارهٔ دانش و اصول تیم" }),
  Object.freeze({ id: "principle", sourceOfTruth: "principles", purpose: "اصول حیاتی نسخه‌دار Hero و محصولات" }),
  Object.freeze({ id: "release", sourceOfTruth: "releases", purpose: "Artifact نسخه‌دار و عبور کنترل‌شده از test به production" }),
  Object.freeze({ id: "quality-gate", sourceOfTruth: "quality_gate_records", purpose: "Bounded test, review, correction and recheck evidence" }),
  Object.freeze({ id: "web-factory", sourceOfTruth: "web_factory_records", purpose: "Versioned web blueprint, feature recipe and quality evidence" }),
  Object.freeze({ id: "mobile-factory", sourceOfTruth: "mobile_factory_records", purpose: "Versioned mobile blueprint, feature recipe and quality evidence" }),
  Object.freeze({ id: "assurance-gate", sourceOfTruth: "assurance_gate_records", purpose: "Versioned local CI, security, observability and cost assessment" }),
  Object.freeze({ id: "portability-gate", sourceOfTruth: "portability_gate_records", purpose: "Versioned source, runtime, backup, restore and clean Linux evidence" }),
  Object.freeze({ id: "ai-provider", sourceOfTruth: "ai_providers", purpose: "Provider adapter identity and safe runtime mode" }),
  Object.freeze({ id: "ai-model", sourceOfTruth: "ai_models", purpose: "Provider model capability metadata" }),
  Object.freeze({ id: "ai-profile", sourceOfTruth: "agent_profiles", purpose: "Versioned role, prompt, context, tool and output policy" }),
  Object.freeze({ id: "ai-binding", sourceOfTruth: "project_agent_bindings", purpose: "Project and role to profile assignment" }),
  Object.freeze({ id: "ai-invocation", sourceOfTruth: "ai_invocations", purpose: "Provider call, profile snapshot, usage and result status" }),
  Object.freeze({ id: "ai-evaluation", sourceOfTruth: "evaluations", purpose: "Structured evaluation evidence and findings" }),
  Object.freeze({ id: "ai-decision", sourceOfTruth: "decision_proposals", purpose: "Versioned owner-resolved decision proposals" }),
  Object.freeze({ id: "ai-role-policy", sourceOfTruth: "ai_role_policies", purpose: "Versioned default Provider/Model/Tool policy per AI role" }),
  Object.freeze({ id: "skill", sourceOfTruth: "skills", purpose: "Versioned approved capability, knowledge and tool boundary" }),
  Object.freeze({ id: "skill-binding", sourceOfTruth: "skill_bindings", purpose: "Scoped Skill assignment to organization, team, role or task" }),
  Object.freeze({ id: "organization-performance", sourceOfTruth: "organization_performance_reviews", purpose: "Evidence-based performance review of all eleven teams" }),
  Object.freeze({ id: "organization-advisor", sourceOfTruth: "organization_advisor_records", purpose: "Read-only organization-level analysis, options and roadmap" }),
  Object.freeze({ id: "outbox", sourceOfTruth: "outbox", purpose: "Dispatch پایدار پس از commit تراکنش" })
]);

const FORBIDDEN_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const FORBIDDEN_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const EVENT_ID = /^evt_[a-z0-9][a-z0-9_-]{2,127}$/;
const AGGREGATE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && /T/.test(value);
}

function findSecretViolation(value, path = "data") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const violation = findSecretViolation(value[index], `${path}[${index}]`);
      if (violation) return violation;
    }
    return null;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (FORBIDDEN_KEY.test(key)) return `${childPath}: sensitive field name is forbidden`;
      const violation = findSecretViolation(child, childPath);
      if (violation) return violation;
    }
    return null;
  }

  if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) {
    return `${path}: sensitive value is forbidden`;
  }
  return null;
}

export function validateOperationalEvent(event) {
  const errors = [];
  if (!isPlainObject(event)) return ["Event must be an object."];
  if (!EVENT_ID.test(event.eventId ?? "")) errors.push("eventId must use the evt_ identifier format.");
  if (!AGGREGATE_TYPES.includes(event.aggregateType)) errors.push("aggregateType is not supported.");
  if (!AGGREGATE_ID.test(event.aggregateId ?? "")) errors.push("aggregateId is invalid.");
  if (!EVENT_TYPES.includes(event.type)) errors.push("event type is not supported.");
  if (!isIsoTimestamp(event.occurredAt)) errors.push("occurredAt must be an ISO timestamp.");
  if (!ACTOR_KINDS.includes(event.actor?.kind)) errors.push("actor.kind is not supported.");
  if (typeof event.actor?.id !== "string" || event.actor.id.length < 3) {
    errors.push("actor.id is required.");
  }
  if (!isPlainObject(event.data)) errors.push("data must be an object.");
  if (event.correlationId !== undefined && !AGGREGATE_ID.test(event.correlationId)) {
    errors.push("correlationId is invalid.");
  }
  if (event.causationId !== undefined && !EVENT_ID.test(event.causationId)) {
    errors.push("causationId is invalid.");
  }
  if (event.schemaVersion !== OPERATIONAL_DATA_CONTRACT_VERSION) {
    errors.push("schemaVersion must match the operational data contract.");
  }
  if (event.data && findSecretViolation(event.data)) errors.push(findSecretViolation(event.data));
  return errors;
}

export function createOperationalEvent(input) {
  const event = Object.freeze({
    eventId: input.eventId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    type: input.type,
    occurredAt: input.occurredAt,
    actor: Object.freeze({ kind: input.actor?.kind, id: input.actor?.id }),
    correlationId: input.correlationId,
    causationId: input.causationId,
    data: Object.freeze({ ...(input.data ?? {}) }),
    schemaVersion: OPERATIONAL_DATA_CONTRACT_VERSION
  });
  const errors = validateOperationalEvent(event);
  if (errors.length > 0) throw new Error(`Invalid operational event: ${errors.join(" ")}`);
  return event;
}

export function getOperationalDataSummary() {
  return Object.freeze({
    version: OPERATIONAL_DATA_CONTRACT_VERSION,
    aggregateTypes: AGGREGATE_TYPES,
    eventTypes: EVENT_TYPES,
    entityTables: OPERATIONAL_ENTITY_MODEL.map(entity => entity.sourceOfTruth),
    appendOnly: true,
    secretSafe: true,
    durableDispatch: "postgresql-outbox"
  });
}
