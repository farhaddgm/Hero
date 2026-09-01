import {
  AI_ROLES
} from "../../contracts/src/ai-orchestration.mjs";
import {
  SKILL_BINDING_STATES,
  SKILL_SCOPES,
  SKILL_STATUSES,
  SKILL_TOOL_POLICIES
} from "../../contracts/src/skill.mjs";
import { TEAM_CATALOG } from "../../contracts/src/team.mjs";
import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const ACTOR_KINDS = new Set(["project-owner", "admin", "orchestrator", "system"]);
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const TEAM_IDS = new Set(TEAM_CATALOG.map(team => team.teamId));

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertActor(actor) {
  if (!actor || !ACTOR_KINDS.has(actor.kind) || typeof actor.id !== "string" || actor.id.length < 3) {
    throw new SkillRegistryError("INVALID_ACTOR", "actor is invalid.");
  }
  if (!["project-owner", "admin"].includes(actor.kind)) throw new SkillRegistryError("ADMIN_APPROVAL_REQUIRED", "Skill configuration requires the project owner or an admin.");
  return copy({ kind: actor.kind, id: actor.id });
}

function assertIdentifier(label, value, maximum = 128) {
  if (typeof value !== "string" || value.length > maximum || !IDENTIFIER.test(value)) throw new SkillRegistryError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function assertText(label, value, maximum = 2_000) {
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > maximum) throw new SkillRegistryError("INVALID_TEXT", `${label} must be 3-${maximum} characters.`);
  return value.trim();
}

function assertList(label, value, { minimum = 0, maximum = 24 } = {}) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum || value.some(item => typeof item !== "string" || item.trim() === "")) throw new SkillRegistryError("INVALID_LIST", `${label} is invalid.`);
  return Object.freeze([...new Set(value.map(item => item.trim()))]);
}

function bindingKey({ scope, scopeId, role = null, skillId }) {
  return `${scope}\u0000${scopeId}\u0000${role ?? "*"}\u0000${skillId}`;
}

function eventIdFactory() {
  let sequence = 0;
  return () => `evt_skill_${String(++sequence).padStart(6, "0")}`;
}

export class SkillRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SkillRegistryError";
    this.code = code;
  }
}

export function createSkillRegistry({ now = () => new Date().toISOString(), eventLog = createInMemoryEventLog(), eventIdFactory: nextEventId = eventIdFactory() } = {}) {
  const skills = new Map();
  const bindings = new Map();
  const idempotency = new Map();

  function appendEvent({ aggregateType, aggregateId, type, actor, data }) {
    const event = createOperationalEvent({ eventId: nextEventId(), aggregateType, aggregateId, type, occurredAt: now(), actor, data });
    return eventLog.append(event, { expectedVersion: eventLog.currentVersion(aggregateType, aggregateId) });
  }

  function replayOrThrow(scope, value) {
    const stored = idempotency.get(scope);
    if (!stored) return null;
    if (JSON.stringify(stored.value) !== JSON.stringify(value)) throw new SkillRegistryError("IDEMPOTENCY_CONFLICT", "idempotencyKey was reused with different Skill input.");
    return copy({ ...stored.result, idempotent: true });
  }

  function register(input = {}) {
    const actor = assertActor(input.actor);
    const skillId = assertIdentifier("skillId", input.skillId, 80);
    const name = assertText("name", input.name, 160);
    const description = assertText("description", input.description);
    const ownerTeamId = assertIdentifier("ownerTeamId", input.ownerTeamId, 80);
    if (ownerTeamId !== "hero" && !TEAM_IDS.has(ownerTeamId)) throw new SkillRegistryError("UNKNOWN_OWNER_TEAM", `${ownerTeamId} is not a Hero team.`);
    const teamIds = assertList("teamIds", input.teamIds ?? [ownerTeamId], { maximum: TEAM_CATALOG.length });
    if (teamIds.some(teamId => teamId !== "hero" && !TEAM_IDS.has(teamId))) throw new SkillRegistryError("UNKNOWN_TEAM", "Skill teamIds must reference Hero teams.");
    const inputSchema = assertIdentifier("inputSchema", input.inputSchema ?? "generic-json-v1");
    const outputSchema = assertIdentifier("outputSchema", input.outputSchema ?? "generic-json-v1");
    const allowedTools = assertList("allowedTools", input.allowedTools ?? [], { maximum: 24 });
    const toolPolicy = input.toolPolicy ?? "read-only";
    if (!SKILL_TOOL_POLICIES.includes(toolPolicy)) throw new SkillRegistryError("INVALID_TOOL_POLICY", "Skill toolPolicy is invalid.");
    const benchmarkId = assertIdentifier("benchmarkId", input.benchmarkId ?? `skill-benchmark-${skillId}`);
    const version = assertIdentifier("version", input.version ?? "v1.0", 48);
    const status = input.status ?? "draft";
    if (!SKILL_STATUSES.includes(status)) throw new SkillRegistryError("INVALID_STATUS", "Skill status is invalid.");
    const knowledgeRefs = assertList("knowledgeRefs", input.knowledgeRefs ?? [], { maximum: 100 });
    const principlesRefs = assertList("principlesRefs", input.principlesRefs ?? [], { maximum: 100 });
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const value = { skillId, name, description, ownerTeamId, teamIds, inputSchema, outputSchema, allowedTools, toolPolicy, benchmarkId, version, status, knowledgeRefs, principlesRefs };
    const scope = `skill:${skillId}\u0000${idempotencyKey}`;
    const replay = replayOrThrow(scope, value);
    if (replay) return replay;
    if (skills.has(skillId)) throw new SkillRegistryError("SKILL_EXISTS", `Skill ${skillId} already exists.`);
    const event = appendEvent({ aggregateType: "skill", aggregateId: skillId, type: "skill.registered", actor, data: value });
    const skill = copy({ ...value, skillVersion: 1, registeredAt: event.occurredAt, eventId: event.eventId });
    skills.set(skillId, skill);
    const result = { skill, idempotent: false };
    idempotency.set(scope, { value, result: copy(result) });
    return result;
  }

  function bind(input = {}) {
    const actor = assertActor(input.actor);
    const bindingId = assertIdentifier("bindingId", input.bindingId, 80);
    const skillId = assertIdentifier("skillId", input.skillId, 80);
    const skill = skills.get(skillId);
    if (!skill) throw new SkillRegistryError("SKILL_NOT_FOUND", `Skill ${skillId} was not registered.`);
    if (skill.status !== "active") throw new SkillRegistryError("SKILL_NOT_ACTIVE", "Only an active Skill can be bound.");
    const scope = input.scope ?? "team";
    if (!SKILL_SCOPES.includes(scope)) throw new SkillRegistryError("INVALID_SCOPE", "Skill scope is invalid.");
    const scopeId = assertIdentifier("scopeId", input.scopeId, 80);
    const role = input.role === undefined || input.role === null ? null : input.role;
    if (role !== null && !AI_ROLES.includes(role)) throw new SkillRegistryError("INVALID_ROLE", "Skill binding role is invalid.");
    if (scope === "team" && !TEAM_IDS.has(scopeId)) throw new SkillRegistryError("UNKNOWN_TEAM", `${scopeId} is not a Hero team.`);
    if (scope === "role" && role === null) throw new SkillRegistryError("ROLE_REQUIRED", "Role-scoped Skill bindings require a role.");
    const status = input.status ?? "active";
    if (!SKILL_BINDING_STATES.includes(status)) throw new SkillRegistryError("INVALID_BINDING_STATUS", "Skill binding status is invalid.");
    const idempotencyKey = assertIdentifier("idempotencyKey", input.idempotencyKey);
    const value = { bindingId, skillId, scope, scopeId, role, status, supersedesBindingId: input.supersedesBindingId ?? null };
    const commandScope = `skill-binding:${bindingId}\u0000${idempotencyKey}`;
    const replay = replayOrThrow(commandScope, value);
    if (replay) return replay;
    if (bindings.has(bindingId)) throw new SkillRegistryError("BINDING_EXISTS", `Skill binding ${bindingId} already exists.`);
    const key = bindingKey({ scope, scopeId, role, skillId });
    const current = [...bindings.values()].find(item => item.currentKey === key && item.status === "active");
    if (current && input.supersedesBindingId !== current.bindingId) throw new SkillRegistryError("BINDING_VERSION_CONFLICT", "Replacing a Skill binding requires the current binding id.");
    const event = appendEvent({ aggregateType: "skill-binding", aggregateId: bindingId, type: "skill.binding-created", actor, data: value });
    const binding = copy({ ...value, currentKey: key, boundAt: event.occurredAt, eventId: event.eventId });
    bindings.set(bindingId, binding);
    const result = { binding, idempotent: false };
    idempotency.set(commandScope, { value, result: copy(result) });
    return result;
  }

  function resolve({ teamId = null, role = null, skillId = null } = {}) {
    const candidates = [...bindings.values()].filter(binding => binding.status === "active" && (!skillId || binding.skillId === skillId) && ((binding.scope === "organization") || (binding.scope === "team" && binding.scopeId === teamId) || (binding.scope === "role" && binding.role === role) || (binding.scope === "task" && binding.scopeId === teamId)));
    candidates.sort((left, right) => (right.scope === "team" ? 4 : right.scope === "role" ? 3 : right.scope === "task" ? 2 : 1) - (left.scope === "team" ? 4 : left.scope === "role" ? 3 : left.scope === "task" ? 2 : 1) || String(right.boundAt).localeCompare(String(left.boundAt)));
    const binding = candidates[0];
    if (!binding) return null;
    const skill = skills.get(binding.skillId);
    return skill ? copy({ skill, binding }) : null;
  }

  function snapshot() {
    return copy({ skills: [...skills.values()], bindings: [...bindings.values()], counts: { skills: skills.size, bindings: bindings.size } });
  }

  function persistenceSnapshot() {
    return copy({ schemaVersion: "1.0", registryId: "skill-registry", skills: [...skills.values()], bindings: [...bindings.values()] });
  }

  function hydrate(input = {}) {
    const state = input.data ?? input;
    if (!state || !Array.isArray(state.skills) || !Array.isArray(state.bindings)) throw new SkillRegistryError("HYDRATION_INVALID", "Skill registry hydration requires skills and bindings.");
    skills.clear();
    bindings.clear();
    for (const skill of state.skills) skills.set(skill.skillId, copy(skill));
    for (const binding of state.bindings) bindings.set(binding.bindingId, copy(binding));
    return copy({ registryId: "skill-registry", hydrated: true, skills: skills.size, bindings: bindings.size });
  }

  return Object.freeze({ register, bind, resolve, get: skillId => skills.has(skillId) ? copy(skills.get(skillId)) : null, list: () => copy([...skills.values()]), snapshot, persistenceSnapshot, hydrate, events: (after = 0) => eventLog.readAfter(after) });
}
