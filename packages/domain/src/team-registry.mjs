import {
  TEAM_ASSIGNMENT_STATES,
  TEAM_AUTONOMY_MODES,
  TEAM_CATALOG,
  TEAM_CONTRACT_VERSION,
  TEAM_DELIVERABLE_DIRECTIONS,
  TEAM_REQUIRED_APPROVALS,
  TEAM_REVIEW_DECISIONS,
  TEAM_REVIEW_TARGETS,
  TEAM_TRAINING_MODULES,
  getTeamContractSummary
} from "../../contracts/src/team.mjs";
import { ACTOR_KINDS, createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const OWNER_KIND = "project-owner";
const SENSITIVE_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt)\/)/;
const TEAM_ID = /^[a-z][a-z0-9-]{2,63}$/;

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
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > maximum) {
    throw new TeamCommandError("INVALID_IDENTIFIER", `${label} is required and must be ${3}-${maximum} characters.`);
  }
  return value.trim();
}

function assertTeamId(value) {
  const teamId = assertIdentifier("teamId", value, 64);
  if (!TEAM_ID.test(teamId)) throw new TeamCommandError("INVALID_TEAM_ID", "teamId must use a stable lowercase identifier.");
  return teamId;
}

function assertSafe(value, path = "input") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafe(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) throw new TeamCommandError("SENSITIVE_INPUT_REJECTED", `${path}.${key} is not allowed.`);
      assertSafe(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && (SENSITIVE_VALUE.test(value) || HOST_PATH.test(value))) {
    throw new TeamCommandError("SENSITIVE_INPUT_REJECTED", `${path} contains a forbidden secret or host path.`);
  }
}

function assertActor(actor, { owner = false } = {}) {
  if (!actor || typeof actor !== "object" || !ACTOR_KINDS.includes(actor.kind)) {
    throw new TeamCommandError("INVALID_ACTOR", "actor must be a known Hero actor.");
  }
  assertIdentifier("actor.id", actor.id);
  if (owner && actor.kind !== OWNER_KIND) {
    throw new TeamCommandError("OWNER_APPROVAL_REQUIRED", "Only project-owner may change team governance.");
  }
  return { kind: actor.kind, id: actor.id };
}

function assertKey(value) {
  return assertIdentifier("idempotencyKey", value, 160);
}

function normalizeList(label, values, { minimum = 1, maximum = 32 } = {}) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new TeamCommandError("INVALID_LIST", `${label} must contain ${minimum}-${maximum} values.`);
  }
  const normalized = values.map((value, index) => {
    if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 240) {
      throw new TeamCommandError("INVALID_LIST_VALUE", `${label}[${index}] must be a 1-240 character string.`);
    }
    return value.trim();
  });
  if (new Set(normalized).size !== normalized.length) throw new TeamCommandError("DUPLICATE_VALUE", `${label} must not contain duplicates.`);
  return normalized;
}

function normalizeOptionalList(label, values, maximum = 16) {
  if (values === undefined) return [];
  return normalizeList(label, values, { minimum: 0, maximum });
}

function normalizeDefinition(definition) {
  const value = definition ?? {};
  const teamId = assertTeamId(value.teamId);
  const name = assertIdentifier("team.name", value.name, 160);
  const responsibility = assertIdentifier("team.responsibility", value.responsibility, 400);
  const defaultAutonomy = assertIdentifier("team.defaultAutonomy", value.defaultAutonomy, 80);
  if (!TEAM_AUTONOMY_MODES.includes(defaultAutonomy)) throw new TeamCommandError("INVALID_AUTONOMY_MODE", "The team default autonomy mode is not supported.");
  return {
    teamId,
    name,
    responsibility,
    decisionRights: normalizeList("team.decisionRights", value.decisionRights),
    inputs: normalizeList("team.inputs", value.inputs),
    outputs: normalizeList("team.outputs", value.outputs),
    principles: normalizeList("team.principles", value.principles),
    partners: value.partners === undefined ? [] : normalizeList("team.partners", value.partners, { minimum: 0 }),
    defaultStages: normalizeList("team.defaultStages", value.defaultStages),
    defaultAutonomy
  };
}

function initialApprovals() {
  return Object.fromEntries(TEAM_REQUIRED_APPROVALS.map(target => [target, false]));
}

function createTeamRecord(definition) {
  return {
    ...structuredClone(definition),
    contractVersion: TEAM_CONTRACT_VERSION,
    status: "proposed",
    version: 0,
    lastEventId: null,
    approvals: initialApprovals(),
    autonomy: { default: definition.defaultAutonomy, byStage: {} },
    training: { status: "not-started", modules: {}, latestAssessment: null },
    knowledge: [],
    knowledgeVersion: 0,
    researchApplications: [],
    reviews: [],
    deliverableReviews: [],
    assignments: [],
    reworkRequests: []
  };
}

function allContractApprovals(team) {
  return TEAM_REQUIRED_APPROVALS.every(target => team.approvals[target] === true);
}

function refreshTeamReadiness(team) {
  if (team.status === "retired") return;
  if (!allContractApprovals(team)) {
    team.status = team.status === "rework" ? "rework" : "proposed";
    return;
  }
  team.status = team.training.status === "ready" ? "ready" : "training";
}

export class TeamCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TeamCommandError";
    this.code = code;
  }
}

export class TeamIdempotencyConflictError extends Error {
  constructor(idempotencyKey) {
    super(`idempotencyKey ${idempotencyKey} was already used with different team input.`);
    this.name = "TeamIdempotencyConflictError";
    this.code = "IDEMPOTENCY_CONFLICT";
  }
}

export function createTeamRegistry(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  const catalog = options.catalog ?? TEAM_CATALOG;
  const teams = new Map(catalog.map(definition => [definition.teamId, createTeamRecord(normalizeDefinition(definition))]));
  const workflows = new Map();
  const idempotency = new Map();
  let nextEvent = 0;
  let nextReview = 0;
  let nextAssignment = 0;
  let nextTraining = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => `evt_team_${String(++nextEvent).padStart(6, "0")}`);

  function remember(scope, key, input, operation) {
    const idempotencyKey = assertKey(key);
    const replayKey = `${scope}\u0000${idempotencyKey}`;
    const valueFingerprint = fingerprint(input);
    const existing = idempotency.get(replayKey);
    if (existing) {
      if (existing.fingerprint !== valueFingerprint) throw new TeamIdempotencyConflictError(idempotencyKey);
      return immutableCopy({ ...existing.result, idempotent: true });
    }
    const result = operation();
    const stored = immutableCopy(result);
    idempotency.set(replayKey, { fingerprint: valueFingerprint, result: stored });
    return immutableCopy(result);
  }

  function getTeamOrThrow(teamId) {
    const normalized = assertTeamId(teamId);
    const team = teams.get(normalized);
    if (!team) throw new TeamCommandError("TEAM_NOT_FOUND", `Team ${normalized} does not exist.`);
    return team;
  }

  function appendTeamEvent({ aggregateType = "team", aggregateId, type, actor, data }) {
    const event = createOperationalEvent({
      eventId: eventIdFactory(),
      aggregateType,
      aggregateId,
      type,
      occurredAt: now(),
      actor,
      data
    });
    return eventLog.append(event, { expectedVersion: eventLog.currentVersion(aggregateType, aggregateId) });
  }

  function commitTeamEvent(team, event) {
    team.version = event.aggregateVersion;
    team.lastEventId = event.eventId;
  }

  function list() {
    return Object.freeze([...teams.values()].map(team => immutableCopy(team)));
  }

  function get(teamId) {
    const team = teams.get(assertTeamId(teamId));
    return team ? immutableCopy(team) : null;
  }

  function reviewContract(input) {
    assertSafe(input);
    const actor = assertActor(input?.actor, { owner: true });
    const teamId = assertTeamId(input?.teamId);
    const target = assertIdentifier("target", input?.target, 64);
    const decision = assertIdentifier("decision", input?.decision, 64);
    if (!TEAM_REVIEW_TARGETS.includes(target)) throw new TeamCommandError("INVALID_REVIEW_TARGET", "The team contract target is not supported.");
    if (!TEAM_REVIEW_DECISIONS.includes(decision)) throw new TeamCommandError("INVALID_REVIEW_DECISION", "The team review decision is not supported.");
    const feedback = input.feedback === undefined ? "" : assertIdentifier("feedback", input.feedback, 2000);
    if (decision !== "approved" && feedback.length < 3) throw new TeamCommandError("FEEDBACK_REQUIRED", "Rejecting or returning work requires actionable feedback.");
    const idempotencyKey = assertKey(input.idempotencyKey);
    return remember(`CONTRACT:${teamId}:${target}`, idempotencyKey, { teamId, target, decision, feedback, actor }, () => {
      const team = getTeamOrThrow(teamId);
      if (team.status === "retired") throw new TeamCommandError("TEAM_RETIRED", "A retired team cannot receive a new review.");
      const review = {
        reviewId: `TEAM-REVIEW-${String(++nextReview).padStart(5, "0")}`,
        target,
        decision,
        feedback,
        reviewer: actor.id,
        reviewedAt: now()
      };
      const event = appendTeamEvent({
        aggregateId: teamId,
        type: decision === "rework-requested" ? "team.rework-requested" : "team.contract-reviewed",
        actor,
        data: { reviewId: review.reviewId, target, decision, feedback }
      });
      team.approvals[target] = decision === "approved";
      team.reviews.push(review);
      if (decision !== "approved") team.reworkRequests.push({ ...review, kind: "contract" });
      if (decision !== "approved") team.status = "rework";
      refreshTeamReadiness(team);
      commitTeamEvent(team, event);
      return { team, review, event, idempotent: false };
    });
  }

  function reviewDeliverable(input) {
    assertSafe(input);
    const actor = assertActor(input?.actor, { owner: true });
    const teamId = assertTeamId(input?.teamId);
    const projectId = assertIdentifier("projectId", input?.projectId);
    const artifactId = assertIdentifier("artifactId", input?.artifactId);
    const artifactVersion = assertIdentifier("artifactVersion", input?.artifactVersion, 80);
    const direction = assertIdentifier("direction", input?.direction, 32);
    const decision = assertIdentifier("decision", input?.decision, 64);
    if (!TEAM_DELIVERABLE_DIRECTIONS.includes(direction)) throw new TeamCommandError("INVALID_DELIVERABLE_DIRECTION", "direction must be input or output.");
    if (!TEAM_REVIEW_DECISIONS.includes(decision)) throw new TeamCommandError("INVALID_REVIEW_DECISION", "The team review decision is not supported.");
    const feedback = input.feedback === undefined ? "" : assertIdentifier("feedback", input.feedback, 2000);
    if (decision !== "approved" && feedback.length < 3) throw new TeamCommandError("FEEDBACK_REQUIRED", "Rejecting or returning work requires actionable feedback.");
    const idempotencyKey = assertKey(input.idempotencyKey);
    return remember(`DELIVERABLE:${teamId}:${artifactId}:${direction}`, idempotencyKey, { teamId, projectId, artifactId, artifactVersion, direction, decision, feedback, actor }, () => {
      const team = getTeamOrThrow(teamId);
      if (team.status === "retired") throw new TeamCommandError("TEAM_RETIRED", "A retired team cannot review a deliverable.");
      const review = {
        reviewId: `DELIVERABLE-REVIEW-${String(++nextReview).padStart(5, "0")}`,
        projectId,
        artifactId,
        artifactVersion,
        direction,
        decision,
        feedback,
        reviewer: actor.id,
        reviewedAt: now()
      };
      const event = appendTeamEvent({
        aggregateId: teamId,
        type: "team.deliverable-reviewed",
        actor,
        data: { reviewId: review.reviewId, projectId, artifactId, artifactVersion, direction, decision, feedback }
      });
      team.deliverableReviews.push(review);
      if (decision !== "approved") {
        team.status = "rework";
        team.reworkRequests.push({ ...review, kind: "deliverable" });
      }
      commitTeamEvent(team, event);
      return { team, review, event, idempotent: false };
    });
  }

  function requestRework(input) {
    return reviewContract({ ...input, decision: "rework-requested" });
  }

  function recordTraining(input) {
    assertSafe(input);
    const actor = assertActor(input?.actor);
    if (![OWNER_KIND, "orchestrator"].includes(actor.kind)) {
      throw new TeamCommandError("TRAINING_ACTOR_NOT_ALLOWED", "Only project-owner or orchestrator may record training.");
    }
    const teamId = assertTeamId(input?.teamId);
    const module = assertIdentifier("module", input?.module, 80);
    if (!TEAM_TRAINING_MODULES.includes(module)) throw new TeamCommandError("INVALID_TRAINING_MODULE", "The training module is not supported.");
    const score = Number(input?.score);
    if (!Number.isInteger(score) || score < 0 || score > 100) throw new TeamCommandError("INVALID_SCORE", "Training score must be an integer from 0 to 100.");
    const note = input.note === undefined ? "" : assertIdentifier("note", input.note, 2000);
    const evidenceRef = input.evidenceRef === undefined ? null : assertIdentifier("evidenceRef", input.evidenceRef, 240);
    if (evidenceRef && !evidenceRef.startsWith("hero://")) throw new TeamCommandError("INVALID_EVIDENCE_REFERENCE", "Training evidence must use a hero:// reference.");
    const idempotencyKey = assertKey(input.idempotencyKey);
    return remember(`TRAINING:${teamId}:${module}`, idempotencyKey, { teamId, module, score, note, evidenceRef, actor }, () => {
      const team = getTeamOrThrow(teamId);
      if (team.status === "retired") throw new TeamCommandError("TEAM_RETIRED", "A retired team cannot be trained.");
      const trainingId = `TRAINING-${String(++nextTraining).padStart(5, "0")}`;
      const record = { trainingId, module, score, passed: score >= 80, note, evidenceRef, recordedBy: actor.id, recordedAt: now() };
      const event = appendTeamEvent({
        aggregateId: teamId,
        type: "team.training-recorded",
        actor,
        data: { trainingId, module, score, passed: record.passed, ...(evidenceRef ? { evidenceRef } : {}) }
      });
      team.training.modules[module] = record;
      const trained = TEAM_TRAINING_MODULES.every(required => team.training.modules[required]?.passed === true);
      team.training.status = trained ? "ready" : "in-progress";
      team.training.latestAssessment = record;
      refreshTeamReadiness(team);
      commitTeamEvent(team, event);
      return { team, training: record, event, idempotent: false };
    });
  }

  function applyResearch(input) {
    assertSafe(input);
    const actor = assertActor(input?.actor, { owner: true });
    const teamId = assertTeamId(input?.teamId);
    const researchId = assertIdentifier("researchId", input?.researchId, 128);
    const knowledgeEntries = normalizeOptionalList("knowledgeEntries", input.knowledgeEntries, 16);
    const principleAdditions = normalizeOptionalList("principleAdditions", input.principleAdditions, 16);
    const trainingUpdates = normalizeOptionalList("trainingUpdates", input.trainingUpdates, 16);
    const idempotencyKey = assertKey(input.idempotencyKey ?? `research-apply-${researchId}`);
    return remember(`RESEARCH-APPLY:${teamId}:${researchId}`, idempotencyKey, { teamId, researchId, knowledgeEntries, principleAdditions, trainingUpdates, actor }, () => {
      const team = getTeamOrThrow(teamId);
      if (team.status === "retired") throw new TeamCommandError("TEAM_RETIRED", "A retired team cannot receive research updates.");
      const knowledge = [...team.knowledge];
      for (const entry of knowledgeEntries) if (!knowledge.includes(entry)) knowledge.push(entry);
      const principles = [...team.principles];
      for (const principle of principleAdditions) if (!principles.includes(principle)) principles.push(principle);
      const event = appendTeamEvent({
        aggregateId: teamId,
        type: "team.research-applied",
        actor,
        data: {
          researchId,
          knowledgeAdded: knowledge.filter(entry => !team.knowledge.includes(entry)).length,
          principlesAdded: principles.filter(principle => !team.principles.includes(principle)).length,
          trainingUpdates: trainingUpdates.length
        }
      });
      team.knowledge = knowledge;
      team.knowledgeVersion += 1;
      team.principles = principles;
      team.researchApplications.push({ researchId, appliedAt: now(), appliedBy: actor.id, trainingUpdates });
      commitTeamEvent(team, event);
      return {
        team,
        applied: {
          researchId,
          knowledgeEntries: Object.freeze(knowledgeEntries),
          principleAdditions: Object.freeze(principleAdditions),
          trainingUpdates: Object.freeze(trainingUpdates)
        },
        event,
        idempotent: false
      };
    });
  }

  function assignToProject(input) {
    assertSafe(input);
    const actor = assertActor(input?.actor, { owner: true });
    const teamId = assertTeamId(input?.teamId);
    const projectId = assertIdentifier("projectId", input?.projectId);
    const stage = assertIdentifier("stage", input?.stage, 80);
    const taskId = assertIdentifier("taskId", input?.taskId, 128);
    const idempotencyKey = assertKey(input.idempotencyKey);
    return remember(`ASSIGN:${teamId}:${projectId}:${taskId}`, idempotencyKey, { teamId, projectId, stage, taskId, actor }, () => {
      const team = getTeamOrThrow(teamId);
      if (team.status !== "ready" && team.status !== "assigned") throw new TeamCommandError("TEAM_NOT_READY", "The team needs approved contract and completed training before assignment.");
      const assignment = {
        assignmentId: `TEAM-ASSIGN-${String(++nextAssignment).padStart(5, "0")}`,
        projectId,
        stage,
        taskId,
        state: "assigned",
        autonomyMode: team.autonomy.byStage[stage] ?? team.autonomy.default,
        assignedBy: actor.id,
        assignedAt: now(),
        updatedAt: now()
      };
      const event = appendTeamEvent({
        aggregateId: teamId,
        type: "team.assigned",
        actor,
        data: { assignmentId: assignment.assignmentId, projectId, stage, taskId, autonomyMode: assignment.autonomyMode }
      });
      team.assignments.push(assignment);
      team.status = "assigned";
      commitTeamEvent(team, event);
      return { team, assignment, event, idempotent: false };
    });
  }

  function updateAssignment(input) {
    assertSafe(input);
    const actor = assertActor(input?.actor);
    const assignmentId = assertIdentifier("assignmentId", input?.assignmentId, 128);
    const state = assertIdentifier("state", input?.state, 32);
    if (!TEAM_ASSIGNMENT_STATES.includes(state)) throw new TeamCommandError("INVALID_ASSIGNMENT_STATE", "The assignment state is not supported.");
    const note = input.note === undefined ? "" : assertIdentifier("note", input.note, 2000);
    const idempotencyKey = assertKey(input.idempotencyKey);
    return remember(`ASSIGNMENT-UPDATE:${assignmentId}`, idempotencyKey, { assignmentId, state, note, actor }, () => {
      let ownerTeam = null;
      let assignment = null;
      for (const team of teams.values()) {
        const found = team.assignments.find(item => item.assignmentId === assignmentId);
        if (found) { ownerTeam = team; assignment = found; break; }
      }
      if (!ownerTeam || !assignment) throw new TeamCommandError("ASSIGNMENT_NOT_FOUND", `Assignment ${assignmentId} does not exist.`);
      const event = appendTeamEvent({
        aggregateId: ownerTeam.teamId,
        type: "team.assignment-updated",
        actor,
        data: { assignmentId, state, note }
      });
      assignment.state = state;
      assignment.note = note;
      assignment.updatedAt = now();
      if (state === "working") ownerTeam.status = "working";
      else if (state === "review") ownerTeam.status = "review";
      else if (state === "rework" || state === "blocked") ownerTeam.status = state === "rework" ? "rework" : "paused";
      else if (state === "paused") ownerTeam.status = "paused";
      else if (state === "completed" && ownerTeam.assignments.every(item => item.state === "completed")) ownerTeam.status = "ready";
      commitTeamEvent(ownerTeam, event);
      return { team: ownerTeam, assignment, event, idempotent: false };
    });
  }

  function setAutonomy(input) {
    assertSafe(input);
    const actor = assertActor(input?.actor, { owner: true });
    const teamId = assertTeamId(input?.teamId);
    const stage = assertIdentifier("stage", input?.stage, 80);
    const mode = assertIdentifier("mode", input?.mode, 80);
    if (!TEAM_AUTONOMY_MODES.includes(mode)) throw new TeamCommandError("INVALID_AUTONOMY_MODE", "The team autonomy mode is not supported.");
    const idempotencyKey = assertKey(input.idempotencyKey);
    return remember(`AUTONOMY:${teamId}:${stage}`, idempotencyKey, { teamId, stage, mode, actor }, () => {
      const team = getTeamOrThrow(teamId);
      const event = appendTeamEvent({ aggregateId: teamId, type: "team.autonomy-changed", actor, data: { stage, mode } });
      team.autonomy.byStage[stage] = mode;
      commitTeamEvent(team, event);
      return { team, autonomy: { stage, mode }, event, idempotent: false };
    });
  }

  function configureWorkflow(input) {
    assertSafe(input);
    const actor = assertActor(input?.actor, { owner: true });
    const projectId = assertIdentifier("projectId", input?.projectId);
    if (!Array.isArray(input?.stages) || input.stages.length < 1 || input.stages.length > 40) {
      throw new TeamCommandError("INVALID_WORKFLOW", "A project workflow must contain 1-40 stages.");
    }
    const stages = input.stages.map((stage, index) => {
      const stageId = assertIdentifier(`stages[${index}].stageId`, stage?.stageId, 80);
      const teamId = assertTeamId(stage?.teamId);
      if (!teams.has(teamId)) throw new TeamCommandError("TEAM_NOT_FOUND", `Team ${teamId} does not exist.`);
      const approvalMode = assertIdentifier(`stages[${index}].approvalMode`, stage?.approvalMode, 80);
      if (!["every-step", "gate-only", "on-risk-only"].includes(approvalMode)) throw new TeamCommandError("INVALID_APPROVAL_MODE", "The workflow approval mode is not supported.");
      return { order: index + 1, stageId, teamId, approvalMode };
    });
    if (new Set(stages.map(stage => stage.stageId)).size !== stages.length) throw new TeamCommandError("DUPLICATE_STAGE", "Workflow stages must have unique IDs.");
    const idempotencyKey = assertKey(input.idempotencyKey);
    return remember(`WORKFLOW:${projectId}`, idempotencyKey, { projectId, stages, actor }, () => {
      const current = workflows.get(projectId);
      const event = appendTeamEvent({ aggregateType: "project", aggregateId: projectId, type: "team.workflow-configured", actor, data: { projectId, stages } });
      const policy = {
        projectId,
        version: (current?.version ?? 0) + 1,
        stages,
        updatedBy: actor.id,
        updatedAt: now(),
        lastEventId: event.eventId
      };
      workflows.set(projectId, policy);
      return { workflow: policy, event, idempotent: false };
    });
  }

  function mergeTeams(input) {
    assertSafe(input);
    const actor = assertActor(input?.actor, { owner: true });
    const sourceTeamIds = normalizeList("sourceTeamIds", input?.sourceTeamIds, { minimum: 2, maximum: 11 }).map(assertTeamId);
    const target = normalizeDefinition(input?.target);
    if (teams.has(target.teamId)) throw new TeamCommandError("TEAM_ID_EXISTS", `Team ${target.teamId} already exists.`);
    const idempotencyKey = assertKey(input.idempotencyKey);
    return remember(`MERGE:${target.teamId}`, idempotencyKey, { sourceTeamIds, target, actor }, () => {
      for (const sourceTeamId of sourceTeamIds) {
        const source = getTeamOrThrow(sourceTeamId);
        if (source.status === "retired") throw new TeamCommandError("TEAM_RETIRED", `Team ${sourceTeamId} is already retired.`);
      }
      const targetTeam = createTeamRecord(target);
      const targetEvent = appendTeamEvent({ aggregateId: target.teamId, type: "team.merged", actor, data: { sourceTeamIds, targetTeamId: target.teamId } });
      commitTeamEvent(targetTeam, targetEvent);
      teams.set(target.teamId, targetTeam);
      const retired = [];
      for (const sourceTeamId of sourceTeamIds) {
        const source = teams.get(sourceTeamId);
        const sourceEvent = appendTeamEvent({ aggregateId: sourceTeamId, type: "team.merged", actor, data: { sourceTeamId, targetTeamId: target.teamId } });
        source.status = "retired";
        commitTeamEvent(source, sourceEvent);
        retired.push(source);
      }
      return { targetTeam, retiredTeams: retired, event: targetEvent, idempotent: false };
    });
  }

  function splitTeam(input) {
    assertSafe(input);
    const actor = assertActor(input?.actor, { owner: true });
    const sourceTeamId = assertTeamId(input?.teamId);
    const newDefinitions = (input.newTeams ?? []).map(normalizeDefinition);
    if (newDefinitions.length < 2 || newDefinitions.length > 8) throw new TeamCommandError("INVALID_SPLIT", "A split must create 2-8 teams.");
    const newIds = newDefinitions.map(definition => definition.teamId);
    if (new Set(newIds).size !== newIds.length || newIds.some(teamId => teams.has(teamId))) throw new TeamCommandError("TEAM_ID_EXISTS", "Split team IDs must be new and unique.");
    const idempotencyKey = assertKey(input.idempotencyKey);
    return remember(`SPLIT:${sourceTeamId}`, idempotencyKey, { sourceTeamId, newDefinitions, actor }, () => {
      const source = getTeamOrThrow(sourceTeamId);
      if (source.status === "retired") throw new TeamCommandError("TEAM_RETIRED", "A retired team cannot be split.");
      const sourceEvent = appendTeamEvent({ aggregateId: sourceTeamId, type: "team.split", actor, data: { sourceTeamId, newTeamIds: newIds } });
      source.status = "retired";
      commitTeamEvent(source, sourceEvent);
      const createdTeams = [];
      for (const definition of newDefinitions) {
        const created = createTeamRecord(definition);
        const event = appendTeamEvent({ aggregateId: definition.teamId, type: "team.split", actor, data: { sourceTeamId, newTeamId: definition.teamId } });
        commitTeamEvent(created, event);
        teams.set(definition.teamId, created);
        createdTeams.push(created);
      }
      return { sourceTeam: source, newTeams: createdTeams, event: sourceEvent, idempotent: false };
    });
  }

  function snapshot() {
    return Object.freeze({
      contract: getTeamContractSummary(),
      teams: list(),
      workflows: Object.freeze([...workflows.values()].map(policy => immutableCopy(policy))),
      eventCount: eventLog.readAfter().length
    });
  }

  return Object.freeze({
    list,
    get,
    snapshot,
    reviewContract,
    requestRework,
    reviewDeliverable,
    recordTraining,
    applyResearch,
    assignToProject,
    updateAssignment,
    setAutonomy,
    configureWorkflow,
    mergeTeams,
    splitTeam,
    events: () => eventLog.readAfter(),
    contract: () => getTeamContractSummary()
  });
}
