import {
  TEAM_RESEARCH_DECISIONS,
  TEAM_RESEARCH_FOCUS_AREAS,
  TEAM_RESEARCH_OUTPUT_TYPES,
  TEAM_RESEARCH_REPORT_REQUIREMENTS,
  getTeamResearchBrief,
  getTeamResearchContractSummary
} from "../../contracts/src/team-research.mjs";
import { ACTOR_KINDS, createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const OWNER_KIND = "project-owner";
const RESEARCH_ID = /^RESEARCH-[A-Z0-9][A-Z0-9._:-]{2,127}$/;
const SENSITIVE_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt)\/)/;

function immutableCopy(value) {
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

function assertIdentifier(label, value, maximum = 160) {
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > maximum) {
    throw new TeamResearchCommandError("INVALID_IDENTIFIER", `${label} is required and must be 3-${maximum} characters.`);
  }
  return value.trim();
}

function assertText(label, value, { minimum = 3, maximum = 2000 } = {}) {
  const normalized = assertIdentifier(label, value, maximum);
  if (normalized.length < minimum) throw new TeamResearchCommandError("INVALID_TEXT", `${label} must contain at least ${minimum} characters.`);
  return normalized;
}

function assertSafe(value, path = "input") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafe(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) throw new TeamResearchCommandError("SENSITIVE_INPUT_REJECTED", `${path}.${key} is not allowed.`);
      assertSafe(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && (SENSITIVE_VALUE.test(value) || HOST_PATH.test(value))) {
    throw new TeamResearchCommandError("SENSITIVE_INPUT_REJECTED", `${path} contains a forbidden secret or host path.`);
  }
}

function assertActor(actor, { owner = false } = {}) {
  if (!actor || !ACTOR_KINDS.includes(actor.kind)) throw new TeamResearchCommandError("INVALID_ACTOR", "actor must be a known Hero actor.");
  const id = assertIdentifier("actor.id", actor.id, 128);
  if (owner && actor.kind !== OWNER_KIND) throw new TeamResearchCommandError("OWNER_APPROVAL_REQUIRED", "Only project-owner may review research.");
  return { kind: actor.kind, id };
}

function assertList(label, values, { minimum = 1, maximum = 16, itemMaximum = 500 } = {}) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new TeamResearchCommandError("INVALID_LIST", `${label} must contain ${minimum}-${maximum} values.`);
  }
  const normalized = values.map((value, index) => assertText(`${label}[${index}]`, value, { maximum: itemMaximum }));
  if (new Set(normalized).size !== normalized.length) throw new TeamResearchCommandError("DUPLICATE_VALUE", `${label} must not contain duplicates.`);
  return normalized;
}

function assertOptionalList(label, values, options = {}) {
  return values === undefined ? [] : assertList(label, values, { minimum: 0, ...options });
}

function assertScore(label, value) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new TeamResearchCommandError("INVALID_SCORE", `${label} must be an integer from 0 to 100.`);
  return score;
}

function assertSourceRef(label, value) {
  const source = assertText(label, value, { maximum: 600 });
  if (source.startsWith("hero://")) return source;
  let parsed;
  try { parsed = new URL(source); } catch { throw new TeamResearchCommandError("INVALID_SOURCE", `${label} must be a hero:// reference or https URL.`); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new TeamResearchCommandError("INVALID_SOURCE", `${label} must be a public https URL without credentials.`);
  }
  return source;
}

function normalizeReport(report) {
  const value = report ?? {};
  const methods = assertList("report.methods", value.methods, { minimum: 1, maximum: 8, itemMaximum: 600 });
  const sourceRefs = (value.sourceRefs ?? []).map((source, index) => assertSourceRef(`report.sourceRefs[${index}]`, source));
  if (sourceRefs.length < TEAM_RESEARCH_REPORT_REQUIREMENTS.minimumSources) {
    throw new TeamResearchCommandError("INSUFFICIENT_EVIDENCE", `A report needs at least ${TEAM_RESEARCH_REPORT_REQUIREMENTS.minimumSources} independent sources.`);
  }
  if (new Set(sourceRefs).size !== sourceRefs.length) throw new TeamResearchCommandError("DUPLICATE_SOURCE", "Report sources must be independent and unique.");
  const findings = (value.findings ?? []).map((finding, index) => {
    const dimension = assertIdentifier(`report.findings[${index}].dimension`, finding?.dimension, 80);
    if (!TEAM_RESEARCH_FOCUS_AREAS.includes(dimension)) throw new TeamResearchCommandError("INVALID_DIMENSION", `Unknown research dimension: ${dimension}.`);
    return {
      findingId: assertIdentifier(`report.findings[${index}].findingId`, finding?.findingId ?? `finding-${index + 1}`, 80),
      dimension,
      observation: assertText(`report.findings[${index}].observation`, finding?.observation, { maximum: 1200 }),
      evidence: assertText(`report.findings[${index}].evidence`, finding?.evidence, { maximum: 1600 }),
      confidence: assertScore(`report.findings[${index}].confidence`, finding?.confidence),
      benchmarkScore: assertScore(`report.findings[${index}].benchmarkScore`, finding?.benchmarkScore)
    };
  });
  if (findings.length < TEAM_RESEARCH_REPORT_REQUIREMENTS.minimumFindings) {
    throw new TeamResearchCommandError("INSUFFICIENT_FINDINGS", `A report needs at least ${TEAM_RESEARCH_REPORT_REQUIREMENTS.minimumFindings} findings.`);
  }
  const benchmarks = (value.benchmarks ?? []).map((benchmark, index) => ({
    benchmarkId: assertIdentifier(`report.benchmarks[${index}].benchmarkId`, benchmark?.benchmarkId ?? `benchmark-${index + 1}`, 80),
    compared: assertText(`report.benchmarks[${index}].compared`, benchmark?.compared, { maximum: 500 }),
    criteria: assertList(`report.benchmarks[${index}].criteria`, benchmark?.criteria, { minimum: 2, maximum: 8, itemMaximum: 300 }),
    winner: assertText(`report.benchmarks[${index}].winner`, benchmark?.winner, { maximum: 300 }),
    rationale: assertText(`report.benchmarks[${index}].rationale`, benchmark?.rationale, { maximum: 1200 }),
    score: assertScore(`report.benchmarks[${index}].score`, benchmark?.score)
  }));
  if (benchmarks.length < TEAM_RESEARCH_REPORT_REQUIREMENTS.minimumBenchmarkComparisons) {
    throw new TeamResearchCommandError("INSUFFICIENT_BENCHMARKS", `A report needs at least ${TEAM_RESEARCH_REPORT_REQUIREMENTS.minimumBenchmarkComparisons} benchmark comparisons.`);
  }
  const recommendations = (value.recommendations ?? []).map((recommendation, index) => {
    const type = assertIdentifier(`report.recommendations[${index}].type`, recommendation?.type, 80);
    if (!TEAM_RESEARCH_OUTPUT_TYPES.includes(type)) throw new TeamResearchCommandError("INVALID_OUTPUT_TYPE", `Unknown research output type: ${type}.`);
    return {
      recommendationId: assertIdentifier(`report.recommendations[${index}].recommendationId`, recommendation?.recommendationId ?? `recommendation-${index + 1}`, 80),
      type,
      title: assertText(`report.recommendations[${index}].title`, recommendation?.title, { maximum: 400 }),
      rationale: assertText(`report.recommendations[${index}].rationale`, recommendation?.rationale, { maximum: 1600 }),
      tradeoffs: assertList(`report.recommendations[${index}].tradeoffs`, recommendation?.tradeoffs, { minimum: 1, maximum: 8, itemMaximum: 500 }),
      confidence: assertScore(`report.recommendations[${index}].confidence`, recommendation?.confidence)
    };
  });
  if (recommendations.length < TEAM_RESEARCH_REPORT_REQUIREMENTS.minimumRecommendations) {
    throw new TeamResearchCommandError("INSUFFICIENT_RECOMMENDATIONS", "A report must contain at least one recommendation.");
  }
  return {
    reportVersion: assertIdentifier("report.reportVersion", value.reportVersion ?? "v1.0", 40),
    summary: assertText("report.summary", value.summary, { minimum: 20, maximum: 4000 }),
    methods,
    sourceRefs,
    findings,
    benchmarks,
    recommendations,
    knowledgeEntries: assertOptionalList("report.knowledgeEntries", value.knowledgeEntries, { maximum: 16, itemMaximum: 1000 }),
    principleProposals: assertOptionalList("report.principleProposals", value.principleProposals, { maximum: 16, itemMaximum: 600 }),
    trainingUpdates: assertOptionalList("report.trainingUpdates", value.trainingUpdates, { maximum: 16, itemMaximum: 600 })
  };
}

export class TeamResearchCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TeamResearchCommandError";
    this.code = code;
  }
}

export class TeamResearchIdempotencyConflictError extends Error {
  constructor(idempotencyKey) {
    super(`idempotencyKey ${idempotencyKey} was already used with different research input.`);
    this.name = "TeamResearchIdempotencyConflictError";
    this.code = "IDEMPOTENCY_CONFLICT";
  }
}

export function createTeamResearchRegistry(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  const teamRegistry = options.teamRegistry;
  const requests = new Map();
  const idempotency = new Map();
  let nextResearch = 0;
  let nextEvent = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => `evt_research_${String(++nextEvent).padStart(6, "0")}`);

  function assertTeam(teamId) {
    const normalized = assertIdentifier("teamId", teamId, 64);
    if (!teamRegistry?.get(normalized)) throw new TeamResearchCommandError("TEAM_NOT_FOUND", `Team ${normalized} does not exist.`);
    return normalized;
  }

  function assertResearchId(value) {
    const researchId = assertIdentifier("researchId", value, 128);
    if (!RESEARCH_ID.test(researchId)) throw new TeamResearchCommandError("INVALID_RESEARCH_ID", "researchId must use RESEARCH-... format.");
    return researchId;
  }

  function append(researchId, type, actor, data) {
    return eventLog.append(createOperationalEvent({
      eventId: eventIdFactory(), aggregateType: "research", aggregateId: researchId, type, occurredAt: now(), actor, data
    }), { expectedVersion: eventLog.currentVersion("research", researchId) });
  }

  function remember(scope, key, input, operation) {
    const idempotencyKey = assertIdentifier("idempotencyKey", key, 160);
    const replayKey = `${scope}\u0000${idempotencyKey}`;
    const valueFingerprint = fingerprint(input);
    const existing = idempotency.get(replayKey);
    if (existing) {
      if (existing.fingerprint !== valueFingerprint) throw new TeamResearchIdempotencyConflictError(idempotencyKey);
      return immutableCopy({ ...existing.result, idempotent: true });
    }
    const result = operation();
    idempotency.set(replayKey, { fingerprint: valueFingerprint, result: immutableCopy(result) });
    return immutableCopy(result);
  }

  function getResearchOrThrow(researchId) {
    const research = requests.get(assertResearchId(researchId));
    if (!research) throw new TeamResearchCommandError("RESEARCH_NOT_FOUND", "Research request was not found.");
    return research;
  }

  function request(input = {}) {
    assertSafe(input);
    const actor = assertActor(input.actor, { owner: true });
    const teamId = assertTeam(input.teamId);
    const projectId = assertIdentifier("projectId", input.projectId ?? "hero", 128);
    const question = assertText("question", input.question ?? getTeamResearchBrief(teamId).benchmarkQuestion, { maximum: 1600 });
    const objective = assertText("objective", input.objective ?? "بهبود دانش، اصول و روش کاری تیم بر اساس شواهد.", { maximum: 1600 });
    const focusAreas = input.focusAreas === undefined ? ["value", "quality", "speed", "cost", "risk", "maintainability"] : input.focusAreas;
    if (!Array.isArray(focusAreas) || focusAreas.length < 2 || focusAreas.length > TEAM_RESEARCH_FOCUS_AREAS.length || focusAreas.some(area => !TEAM_RESEARCH_FOCUS_AREAS.includes(area))) {
      throw new TeamResearchCommandError("INVALID_FOCUS_AREAS", "focusAreas must contain supported research dimensions.");
    }
    const requestedOutputs = input.requestedOutputs === undefined ? [...TEAM_RESEARCH_OUTPUT_TYPES] : input.requestedOutputs;
    if (!Array.isArray(requestedOutputs) || requestedOutputs.length < 1 || requestedOutputs.length > TEAM_RESEARCH_OUTPUT_TYPES.length || requestedOutputs.some(type => !TEAM_RESEARCH_OUTPUT_TYPES.includes(type))) {
      throw new TeamResearchCommandError("INVALID_OUTPUT_TYPES", "requestedOutputs must contain supported research outputs.");
    }
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey ?? `research-${teamId}-${nextResearch + 1}`, 160);
    return remember(`REQUEST:${teamId}`, idempotencyKey, { teamId, projectId, question, objective, focusAreas, requestedOutputs, researchId: input.researchId ?? null, actor }, () => {
      const researchId = input.researchId ?? `RESEARCH-${String(++nextResearch).padStart(5, "0")}`;
      assertResearchId(researchId);
      if (requests.has(researchId)) throw new TeamResearchCommandError("RESEARCH_ID_EXISTS", `Research ${researchId} already exists.`);
      const requestedAt = now();
      const event = append(researchId, "team.research-requested", actor, { teamId, projectId, question, objective, focusAreas, requestedOutputs });
      const research = {
        researchId,
        teamId,
        projectId,
        question,
        objective,
        focusAreas,
        requestedOutputs,
        benchmark: getTeamResearchBrief(teamId),
        status: "requested",
        version: event.aggregateVersion,
        lastEventId: event.eventId,
        requestedBy: actor.id,
        requestedAt,
        startedAt: null,
        report: null,
        decision: { state: "pending-owner", decision: null, feedback: "", decidedAt: null, decidedBy: null },
        appliedAt: null
      };
      requests.set(researchId, research);
      return { research, event, idempotent: false };
    });
  }

  function start(input = {}) {
    assertSafe(input);
    const actor = assertActor(input.actor);
    const research = getResearchOrThrow(input.researchId);
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey ?? `start-${research.researchId}`, 160);
    return remember(`START:${research.researchId}`, idempotencyKey, { researchId: research.researchId, actor }, () => {
      if (!["requested", "rework-requested"].includes(research.status)) throw new TeamResearchCommandError("RESEARCH_NOT_STARTABLE", "Research is not waiting to start.");
      const event = append(research.researchId, "team.research-started", actor, { teamId: research.teamId });
      research.status = "researching";
      research.startedAt = research.startedAt ?? now();
      research.version = event.aggregateVersion;
      research.lastEventId = event.eventId;
      return { research, event, idempotent: false };
    });
  }

  function submitReport(input = {}) {
    assertSafe(input);
    const actor = assertActor(input.actor);
    const research = getResearchOrThrow(input.researchId);
    const report = normalizeReport(input.report);
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey ?? `report-${research.researchId}-${report.reportVersion}`, 160);
    return remember(`REPORT:${research.researchId}`, idempotencyKey, { researchId: research.researchId, report, actor }, () => {
      if (!["requested", "researching", "rework-requested"].includes(research.status)) throw new TeamResearchCommandError("RESEARCH_NOT_REPORTABLE", "Research is not waiting for a report.");
      const event = append(research.researchId, "team.research-report-ready", actor, {
        teamId: research.teamId,
        reportVersion: report.reportVersion,
        sourceCount: report.sourceRefs.length,
        findingCount: report.findings.length,
        benchmarkCount: report.benchmarks.length,
        recommendationCount: report.recommendations.length
      });
      research.status = "report-ready";
      research.report = { ...report, preparedBy: actor.id, preparedAt: now() };
      research.decision = { state: "pending-owner", decision: null, feedback: "", decidedAt: null, decidedBy: null };
      research.version = event.aggregateVersion;
      research.lastEventId = event.eventId;
      return { research, event, idempotent: false };
    });
  }

  function review(input = {}) {
    assertSafe(input);
    const actor = assertActor(input.actor, { owner: true });
    const research = getResearchOrThrow(input.researchId);
    const decision = assertIdentifier("decision", input.decision, 80);
    if (!TEAM_RESEARCH_DECISIONS.includes(decision)) throw new TeamResearchCommandError("INVALID_RESEARCH_DECISION", "The research decision is not supported.");
    const feedback = input.feedback === undefined ? "" : assertText("feedback", input.feedback, { maximum: 2400 });
    if (decision !== "approved" && feedback.length < 3) throw new TeamResearchCommandError("FEEDBACK_REQUIRED", "Rejecting or returning research requires actionable feedback.");
    if (research.status !== "report-ready") throw new TeamResearchCommandError("RESEARCH_NOT_REVIEWABLE", "Only a report-ready research request can be reviewed.");
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey ?? `review-${research.researchId}-${decision}`, 160);
    return remember(`REVIEW:${research.researchId}`, idempotencyKey, { researchId: research.researchId, decision, feedback, actor }, () => {
      const event = append(research.researchId, "team.research-reviewed", actor, { teamId: research.teamId, decision, feedback });
      research.decision = { state: decision === "approved" ? "approved" : decision, decision, feedback, decidedAt: now(), decidedBy: actor.id };
      research.version = event.aggregateVersion;
      research.lastEventId = event.eventId;
      if (decision === "rework-requested") {
        research.status = "rework-requested";
        return { research, event, applied: null, idempotent: false };
      }
      if (decision === "rejected") {
        research.status = "rejected";
        return { research, event, applied: null, idempotent: false };
      }
      const applied = teamRegistry.applyResearch({
        teamId: research.teamId,
        researchId: research.researchId,
        knowledgeEntries: research.report.knowledgeEntries,
        principleAdditions: research.report.principleProposals,
        trainingUpdates: research.report.trainingUpdates,
        actor,
        idempotencyKey: `research-apply-${research.researchId}`
      });
      const appliedEvent = append(research.researchId, "team.research-applied", actor, {
        teamId: research.teamId,
        knowledgeCount: applied.applied.knowledgeEntries.length,
        principleCount: applied.applied.principleAdditions.length,
        trainingUpdateCount: applied.applied.trainingUpdates.length
      });
      research.status = "applied";
      research.appliedAt = now();
      research.version = appliedEvent.aggregateVersion;
      research.lastEventId = appliedEvent.eventId;
      return { research, event, applied, appliedEvent, idempotent: false };
    });
  }

  function get(researchId) {
    const research = requests.get(assertResearchId(researchId));
    return research ? immutableCopy(research) : null;
  }

  function list(teamId) {
    const normalized = teamId === undefined ? null : assertTeam(teamId);
    return Object.freeze([...requests.values()].filter(research => normalized === null || research.teamId === normalized).map(immutableCopy));
  }

  function persistenceSnapshot() {
    return immutableCopy({
      schemaVersion: "1.0",
      registryId: "team-research",
      requests: [...requests.values()]
    });
  }

  function hydrate(input = {}) {
    const state = input.data ?? input;
    if (!state || !Array.isArray(state.requests)) throw new TeamResearchCommandError("HYDRATION_INVALID", "Team research hydration requires requests.");
    if (Array.isArray(input.events)) eventLog.load(input.events.filter(event => event.aggregateType === "research"));
    requests.clear();
    idempotency.clear();
    for (const research of state.requests) {
      if (!research || typeof research !== "object" || typeof research.researchId !== "string") throw new TeamResearchCommandError("HYDRATION_INVALID", "A hydrated research request is invalid.");
      requests.set(research.researchId, immutableCopy(research));
    }
    nextResearch = Math.max(0, ...[...requests.keys()].map(value => Number(value.match(/(\d+)$/)?.[1] ?? 0)));
    return immutableCopy({ registryId: "team-research", hydrated: true, requests: requests.size });
  }

  return Object.freeze({
    request,
    start,
    submitReport,
    review,
    get,
    list,
    persistenceSnapshot,
    hydrate,
    events: () => eventLog.readAfter(),
    contract: () => getTeamResearchContractSummary()
  });
}
