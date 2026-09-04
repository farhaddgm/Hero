import {
  ORGANIZATION_ADVISOR_PIPELINE_ROLES,
  getOrganizationAdvisorContractSummary
} from "../../contracts/src/organization-advisor.mjs";
import { TEAM_CATALOG } from "../../contracts/src/team.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const ACTOR_KINDS = new Set(["project-owner", "admin", "orchestrator", "agent", "system"]);
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|opt)\/)/;
const SENSITIVE_FIELD = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}

function fingerprint(value) {
  return JSON.stringify(stableValue(value));
}

function assertIdentifier(label, value, maximum = 128) {
  if (typeof value !== "string" || value.length > maximum || !IDENTIFIER.test(value)) throw new OrganizationAdvisorError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function assertPeriod(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,47}$/.test(value)) throw new OrganizationAdvisorError("INVALID_PERIOD", "performanceReview.period is invalid.");
  return value;
}

function assertText(label, value, { minimum = 0, maximum = 2_000, required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new OrganizationAdvisorError("INVALID_TEXT", `${label} is required.`);
    return "";
  }
  if (typeof value !== "string") throw new OrganizationAdvisorError("INVALID_TEXT", `${label} must be text.`);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) throw new OrganizationAdvisorError("INVALID_TEXT", `${label} must be ${minimum}-${maximum} characters.`);
  if (SENSITIVE_VALUE.test(normalized) || HOST_PATH.test(normalized)) throw new OrganizationAdvisorError("SENSITIVE_INPUT_REJECTED", `${label} contains a sensitive value or host path.`);
  return normalized;
}

function assertSafe(value, path = "input") {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertSafe(child, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_FIELD.test(key)) throw new OrganizationAdvisorError("SENSITIVE_INPUT_REJECTED", `${path}.${key} is not allowed.`);
      assertSafe(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && (SENSITIVE_VALUE.test(value) || HOST_PATH.test(value))) {
    throw new OrganizationAdvisorError("SENSITIVE_INPUT_REJECTED", `${path} contains a sensitive value or host path.`);
  }
}

function assertActor(actor) {
  if (!actor || !ACTOR_KINDS.has(actor.kind) || typeof actor.id !== "string" || actor.id.length < 3) {
    throw new OrganizationAdvisorError("INVALID_ACTOR", "actor is invalid.");
  }
  return copy({ kind: actor.kind, id: actor.id });
}

function eventIdFactory() {
  let sequence = 0;
  return () => `evt_advisor_${String(++sequence).padStart(6, "0")}`;
}

function findingSeverityRank(severity) {
  return severity === "high" ? 0 : severity === "medium" ? 1 : 2;
}

const TRAINING_MODULE_BY_METRIC = Object.freeze({
  delivery: "output-contract",
  quality: "quality",
  evidence: "safety",
  rework: "collaboration",
  reliability: "mission"
});

function trainingActionsFor(findings) {
  return copy(findings.map(finding => ({
    actionId: `training-action-${finding.teamId}-${finding.metric}`,
    sourceFindingId: finding.findingId,
    teamId: finding.teamId,
    module: TRAINING_MODULE_BY_METRIC[finding.metric] ?? "quality",
    title: `بازآموزی ${finding.teamId} برای ${finding.metric}`,
    objective: finding.recommendation,
    status: "proposed",
    gate: "owner-review",
    evidenceRequired: true,
    decisionBoundary: "advisory-only-no-training-mutation"
  })));
}

function normalizeFinding(finding, index) {
  if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
    throw new OrganizationAdvisorError("INVALID_FINDING", `findings[${index}] is invalid.`);
  }
  const findingId = assertIdentifier(`findings[${index}].findingId`, finding.findingId ?? `finding-${index + 1}`);
  const teamId = assertIdentifier(`findings[${index}].teamId`, finding.teamId, 80);
  if (!TEAM_CATALOG.some(team => team.teamId === teamId)) throw new OrganizationAdvisorError("UNKNOWN_TEAM", `${teamId} is not a Hero team.`);
  const severity = finding.severity ?? "medium";
  if (!["high", "medium", "low"].includes(severity)) throw new OrganizationAdvisorError("INVALID_FINDING", `${findingId} has an invalid severity.`);
  return copy({
    findingId,
    teamId,
    metric: assertIdentifier(`findings[${index}].metric`, finding.metric ?? "general", 80),
    severity,
    message: assertText(`findings[${index}].message`, finding.message, { minimum: 3, maximum: 500 }),
    recommendation: assertText(`findings[${index}].recommendation`, finding.recommendation ?? "برای این یافته مالک و evidence اصلاحی تعیین شود.", { minimum: 3, maximum: 500 })
  });
}

function normalizeReview(review) {
  if (!review || typeof review !== "object" || Array.isArray(review)) throw new OrganizationAdvisorError("INVALID_PERFORMANCE_REVIEW", "A performance review is required.");
  const reviewId = assertIdentifier("performanceReview.reviewId", review.reviewId);
  const organizationId = assertIdentifier("performanceReview.organizationId", review.organizationId);
  const teams = Array.isArray(review.teams) ? review.teams : [];
  const teamIds = new Set(teams.map((team, index) => assertIdentifier(`performanceReview.teams[${index}].teamId`, team?.teamId, 80)));
  const expectedTeamIds = new Set(TEAM_CATALOG.map(team => team.teamId));
  const coverageComplete = review.coverage?.complete === true && teamIds.size === expectedTeamIds.size && [...expectedTeamIds].every(teamId => teamIds.has(teamId));
  const evidenceRefs = teams.map((team, index) => {
    if (typeof team?.evidenceRef !== "string" || !team.evidenceRef.startsWith("hero://")) throw new OrganizationAdvisorError("INVALID_EVIDENCE_REFERENCE", `performanceReview.teams[${index}] needs a hero:// evidence reference.`);
    return { teamId: team.teamId, evidenceRef: team.evidenceRef };
  });
  const findings = (Array.isArray(review.findings) ? review.findings : []).map(normalizeFinding);
  return copy({
    reviewId,
    organizationId,
    period: assertPeriod(review.period),
    teamCount: Number.isInteger(review.teamCount) ? review.teamCount : teams.length,
    coverage: { expected: expectedTeamIds.size, observed: teams.length, complete: coverageComplete },
    average: typeof review.average === "number" ? review.average : null,
    band: ["strong", "watch", "intervention"].includes(review.band) ? review.band : "watch",
    teams: evidenceRefs,
    findings
  });
}

function pipelineFor({ evidenceComplete, researchRequested }) {
  return copy(ORGANIZATION_ADVISOR_PIPELINE_ROLES.map(role => ({
    role,
    status: role === "researcher" && !researchRequested && evidenceComplete ? "conditional" : evidenceComplete ? "ready" : "needs-evidence",
    purpose: {
      analyst: "ساختن تصویر وضعیت و جداکردن واقعیت از تفسیر",
      evaluator: "سنجش کیفیت evidence و شدت یافته‌ها",
      "decision-maker": "ساختن گزینه‌های قابل مقایسه بدون صدور مجوز",
      planner: "تبدیل توصیه به roadmap مرحله‌ای",
      researcher: "پرکردن خلأ evidence فقط در صورت نیاز"
    }[role]
  })));
}

function optionsFor(review, findings) {
  const hasFindings = findings.length > 0;
  return copy([
    {
      optionId: "maintain",
      title: "حفظ مسیر فعلی",
      impact: "کمترین تغییر فوری و حفظ سرعت تیم‌های سالم",
      risk: hasFindings ? "یافته‌های فعلی ممکن است باقی بمانند." : "ریسک جدیدی از evidence فعلی استخراج نشده است.",
      requiredEvidence: "بازبینی دورهٔ بعد برای همهٔ ۱۱ تیم"
    },
    {
      optionId: "targeted-improvement",
      title: "اصلاح هدفمند",
      impact: "تمرکز روی تیم‌ها و metricهای ضعیف با کمترین دامنهٔ تغییر",
      risk: "نیازمند مالک، مهلت و evidence اصلاحی برای هر یافته است.",
      requiredEvidence: "برنامهٔ اصلاحی نسخه‌دار و evidence هر finding"
    },
    {
      optionId: "organization-intervention",
      title: "مداخلهٔ سازمانی",
      impact: "بازنگری عمیق در workflow، ظرفیت یا نقش‌ها",
      risk: "هزینه و اختلال بیشتر؛ فقط برای افت پایدار یا چندتیمی مناسب است.",
      requiredEvidence: "دو دورهٔ متوالی یا شواهد مستقل برای ریسک سازمانی"
    }
  ].map(option => ({ ...option, recommended: option.optionId === (review.band === "intervention" ? "organization-intervention" : hasFindings ? "targeted-improvement" : "maintain") })));
}

function roadmapFor(review, findings) {
  const grouped = new Map();
  findings.forEach(finding => {
    const existing = grouped.get(finding.teamId) ?? [];
    existing.push(finding);
    grouped.set(finding.teamId, existing);
  });
  const steps = [];
  if (findings.length === 0) {
    steps.push({ order: 1, id: "advisor-maintain", title: "حفظ روند و ثبت evidence دورهٔ بعد", owner: "rahbaro", teamId: null, gate: "owner-review", status: "proposed" });
  } else {
    steps.push({ order: 1, id: "advisor-triage", title: "تأیید اولویت یافته‌ها و تعیین مالک", owner: "rahbaro", teamId: null, gate: "owner-review", status: "proposed" });
    [...grouped.entries()].slice(0, 8).forEach(([teamId, teamFindings], index) => {
      const highest = [...teamFindings].sort((left, right) => findingSeverityRank(left.severity) - findingSeverityRank(right.severity))[0];
      steps.push({
        order: index + 2,
        id: `advisor-improve-${teamId}`,
        title: `اصلاح ${teamId}: ${highest.metric}`,
        owner: teamId,
        teamId,
        gate: highest.severity === "high" ? "owner-review" : "evidence-review",
        status: "proposed"
      });
    });
    steps.push({ order: steps.length + 1, id: "advisor-remeasure", title: `بازسنجی همهٔ ${TEAM_CATALOG.length} تیم`, owner: "tahlilgoro", teamId: null, gate: "evidence-review", status: "proposed" });
  }
  return copy(steps.map(step => ({ ...step, sourceReviewId: review.reviewId })));
}

export class OrganizationAdvisorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OrganizationAdvisorError";
    this.code = code;
  }
}

export function createOrganizationAdvisor({ now = () => new Date().toISOString(), eventLog = createInMemoryEventLog(), eventIdFactory: nextEventId = eventIdFactory() } = {}) {
  const records = new Map();
  const idempotency = new Map();

  function appendEvent({ advisorId, actor, data }) {
    return eventLog.append(createOperationalEvent({
      eventId: nextEventId(),
      aggregateType: "organization-advisor",
      aggregateId: advisorId,
      type: "organization-advisor.created",
      occurredAt: now(),
      actor,
      data
    }), { expectedVersion: eventLog.currentVersion("organization-advisor", advisorId) });
  }

  function advise(input = {}) {
    assertSafe(input);
    const actor = assertActor(input.actor ?? { kind: "system", id: "hero-organization-advisor" });
    const advisorId = assertIdentifier("advisorId", input.advisorId);
    const ownerQuestion = assertText("question", input.question, { maximum: 1_200 });
    const review = normalizeReview(input.performanceReview);
    const researchRequested = input.researchRequested === true;
    const priorDecisions = Array.isArray(input.priorDecisions) ? copy(input.priorDecisions.slice(0, 12)) : [];
    const value = {
      advisorId,
      organizationId: review.organizationId,
      reviewId: review.reviewId,
      question: ownerQuestion,
      researchRequested,
      priorDecisions,
      performanceFingerprint: fingerprint(review)
    };
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const key = `advisor:${advisorId}\u0000${idempotencyKey}`;
    const existing = idempotency.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint(value)) throw new OrganizationAdvisorError("IDEMPOTENCY_CONFLICT", "idempotencyKey was reused with different advisor input.");
      return copy({ ...existing.result, idempotent: true });
    }
    if (records.has(advisorId)) throw new OrganizationAdvisorError("ADVISOR_EXISTS", `Advisor record ${advisorId} already exists.`);

    const findings = [...review.findings].sort((left, right) => findingSeverityRank(left.severity) - findingSeverityRank(right.severity) || left.teamId.localeCompare(right.teamId)).slice(0, 24);
    const evidenceComplete = review.coverage.complete && review.teamCount === TEAM_CATALOG.length && review.teams.length === TEAM_CATALOG.length;
    const options = optionsFor(review, findings);
    const recommendation = options.find(option => option.recommended) ?? options[0];
    const trainingActions = trainingActionsFor(findings);
    const event = appendEvent({
      advisorId,
      actor,
      data: {
        advisorId,
        organizationId: review.organizationId,
        reviewId: review.reviewId,
        period: review.period,
        state: evidenceComplete ? "ready" : "needs-evidence",
        findingCount: findings.length,
        recommendation: recommendation.optionId,
        researchRequested
      }
    });
    const result = copy({
      advisorId,
      organizationId: review.organizationId,
      reviewId: review.reviewId,
      question: ownerQuestion,
      status: "advisory",
      state: evidenceComplete ? "ready" : "needs-evidence",
      pipeline: pipelineFor({ evidenceComplete, researchRequested }),
      findings,
      options,
      recommendation: {
        optionId: recommendation.optionId,
        rationale: review.band === "intervention"
          ? "میانگین عملکرد زیر آستانه است؛ مداخله فقط پس از بررسی مالک و evidence مستقل پیشنهاد می‌شود."
          : findings.length > 0
            ? "یافته‌ها به‌صورت هدفمند اصلاح و در دورهٔ بعد دوباره سنجیده شوند."
            : "evidence فعلی نشانهٔ افت عملیاتی نشان نمی‌دهد؛ پایش دوره‌ای ادامه پیدا کند."
      },
      roadmap: roadmapFor(review, findings),
      trainingActions,
      uncertainty: {
        level: evidenceComplete ? findings.length > 0 ? "medium" : "low" : "high",
        reasons: evidenceComplete ? findings.length > 0 ? ["یافته‌های performance نیازمند evidence اصلاحی هستند."] : ["این پیشنهاد فقط بر اساس یک دورهٔ performance ساخته شده است."] : ["پوشش evidence برای هر ۱۱ تیم کامل نیست."]
      },
      evidence: {
        reviewId: review.reviewId,
        organizationId: review.organizationId,
        period: review.period,
        teamCount: review.teamCount,
        coverage: review.coverage,
        average: review.average,
        band: review.band,
        refs: review.teams
      },
      priorDecisions,
      createdAt: event.occurredAt,
      eventId: event.eventId,
      decisionBoundary: "advisory-only-no-dispatch-no-authorization-no-mutation",
      contract: getOrganizationAdvisorContractSummary()
    });
    records.set(advisorId, result);
    const stored = { result, fingerprint: fingerprint(value) };
    idempotency.set(key, stored);
    return result;
  }

  function persistenceSnapshot() {
    return copy({ schemaVersion: "1.0", registryId: "organization-advisor", records: [...records.values()] });
  }

  function hydrate(input = {}) {
    const state = input.data ?? input;
    if (!state || !Array.isArray(state.records)) throw new OrganizationAdvisorError("HYDRATION_INVALID", "Organization advisor hydration requires records.");
    records.clear();
    idempotency.clear();
    for (const record of state.records) {
      if (!record || typeof record !== "object" || typeof record.advisorId !== "string") throw new OrganizationAdvisorError("HYDRATION_INVALID", "A hydrated advisor record is invalid.");
      records.set(record.advisorId, copy(record));
    }
    return copy({ registryId: "organization-advisor", hydrated: true, records: records.size });
  }

  return Object.freeze({
    advise,
    get: advisorId => records.has(advisorId) ? copy(records.get(advisorId)) : null,
    latest: () => [...records.values()].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0] ? copy([...records.values()].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0]) : null,
    list: () => copy([...records.values()]),
    snapshot: () => copy({ contract: getOrganizationAdvisorContractSummary(), latest: [...records.values()].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0] ?? null, count: records.size }),
    persistenceSnapshot,
    hydrate,
    events: (after = 0) => eventLog.readAfter(after),
    contract: () => getOrganizationAdvisorContractSummary()
  });
}
