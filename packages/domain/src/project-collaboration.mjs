import { randomUUID } from "node:crypto";
import { COLLABORATION_RECORD_TYPES, CONVERSATION_CONTEXTS, MEMORY_LEVELS, MEMORY_SENSITIVITIES, settingsKeyFor } from "../../contracts/src/backoffice-collaboration.mjs";
import { AI_ROLES } from "../../contracts/src/ai-orchestration.mjs";
import { TEAM_CATALOG } from "../../contracts/src/team.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SECRET = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const SECRET_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN .*PRIVATE KEY-----)/i;
const PROJECT_REFERENCE = /^hero:\/\/projects\/([^/]+)(?:\/|$)/;
const DAY_MS = 86_400_000;
function copy(value) { return Object.freeze(structuredClone(value)); }
function id(label, value) { if (typeof value !== "string" || !ID.test(value)) throw new CollaborationError("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; }
function safe(value, path = "data") { if (Array.isArray(value)) return value.forEach((item, index) => safe(item, `${path}[${index}]`)); if (!value || typeof value !== "object") { if (typeof value === "string" && SECRET_VALUE.test(value)) throw new CollaborationError("SENSITIVE_CONTENT_REJECTED", `${path} contains a secret-shaped value.`, 400); return; } for (const [key, child] of Object.entries(value)) { if (SECRET.test(key)) throw new CollaborationError("SENSITIVE_CONTENT_REJECTED", `${path}.${key} is forbidden.`, 400); safe(child, `${path}.${key}`); } }
function editor(actor) { if (!actor || !["project-owner", "admin"].includes(actor.role)) throw new CollaborationError("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403); return actor; }
function reader(actor) { if (!actor || !["project-owner", "admin", "viewer"].includes(actor.role)) throw new CollaborationError("PROJECT_READ_REQUIRED", "Project access is required.", 403); return actor; }
function reason(value) { if (typeof value !== "string" || value.trim().length < 3) throw new CollaborationError("REASON_REQUIRED", "Reason is required.", 400); return value.trim().slice(0, 500); }
/** An internal source may be global (hero://evidence/…) or belong to exactly this project. */
function source(value, projectId) {
  if (!value || typeof value !== "object" || typeof value.reference !== "string" || !value.reference.startsWith("hero://")) throw new CollaborationError("SOURCE_REQUIRED", "An internal hero:// source reference is required.", 400);
  const owner = value.reference.match(PROJECT_REFERENCE)?.[1];
  if (owner && owner !== projectId) throw new CollaborationError("CROSS_PROJECT_SOURCE_REJECTED", "A source from another project cannot be cited; use a knowledge proposal.", 403);
  return copy({ reference: value.reference.slice(0, 512), kind: String(value.kind ?? "evidence").slice(0, 80), version: String(value.version ?? "1.0.0").slice(0, 48) });
}
export class CollaborationError extends Error { constructor(code, message, statusCode = 409) { super(message); this.name = "CollaborationError"; this.code = code; this.statusCode = statusCode; } }

/**
 * Project-scoped teams, roles, profiles, conversations, memory and knowledge
 * proposals. Every mutation emits an append-only record (drainRecords) that a
 * store persists; hydrate() replays those records after a restart.
 *
 * Options:
 * - settings: the project settings registry, used to resolve conversation models
 *   through the WP-04 layers instead of a second, divergent model store.
 * - entityExists(projectId, entityId): optional catalog check for entity contexts.
 */
export function createProjectCollaboration({ now = () => new Date().toISOString(), teamCatalog = TEAM_CATALOG, settings = null, entityExists = null } = {}) {
  const catalog = new Map(teamCatalog.map(team => [team.teamId, team]));
  const assignments = new Map(); const profiles = new Map(); const profileHistory = new Map();
  const conversations = new Map(); const memory = new Map(); const currentMemory = new Map(); const proposals = new Map();
  const outbox = [];
  const hydratedVersions = { assignment: new Map(), profile: new Map(), memory: new Map(), knowledge: new Map() };
  const pendingConversation = new Map();

  function emit(recordType, projectId, actorId, metadata, recordVersion = 1) {
    const record = copy({ recordId: `${recordType}-${randomUUID()}`, projectId, recordType, recordVersion, actorId, recordedAt: now(), metadata });
    outbox.push(record); return record;
  }
  function scoped(projectId) { return id("projectId", projectId); }
  function assignmentKey(projectId, teamId) { return `${projectId}:${teamId}`; }
  function profileKey(projectId, kind, targetId) { return `${projectId}:${kind}:${targetId}`; }
  function requireConversation(conversationId, projectId) { const item = conversations.get(id("conversationId", conversationId)); if (!item || item.projectId !== projectId) throw new CollaborationError("CONVERSATION_NOT_FOUND", "Conversation was not found in this project.", 404); return item; }
  function requireMemory(memoryId, projectId) { const item = memory.get(id("memoryId", memoryId)); if (!item || item.projectId !== projectId) throw new CollaborationError("MEMORY_NOT_FOUND", "Memory was not found in this project.", 404); return item; }
  function roleList(roleIds) {
    if (!Array.isArray(roleIds)) throw new CollaborationError("ROLES_INVALID", "roleIds must be an array.", 400);
    const unique = [...new Set(roleIds)];
    for (const role of unique) if (!AI_ROLES.includes(role)) throw new CollaborationError("ROLE_NOT_FOUND", `Role ${role} is not a Hero role.`, 404);
    return unique.sort();
  }
  function activeAssignment(projectId, teamId) { const item = assignments.get(assignmentKey(projectId, teamId)); return item && item.status === "active" ? item : null; }
  function liveMessages(conversation) {
    const cutoff = Date.parse(now()) - conversation.retentionDays * DAY_MS;
    return conversation.messages.filter(message => Date.parse(message.createdAt) >= cutoff);
  }
  function settingValue(projectId, path) {
    if (!settings?.explain || !path) return null;
    try { const item = settings.explain({ projectId, path }); return item.status === "resolved" ? item.effective : null; } catch { return null; }
  }
  /** Conversation > Role > Team > Project default (BO-068). */
  function resolveModel(conversation) {
    const explicit = conversation.model && conversation.model.model && conversation.model.model !== "default" ? conversation.model : null;
    if (explicit) return copy({ model: explicit.model, provider: explicit.provider ?? "configured", source: "conversation", path: null });
    const chain = [
      ["role-setting", conversation.binding.roleId ? `ai.roleModels.${settingsKeyFor(conversation.binding.roleId)}` : null],
      ["team-setting", conversation.binding.teamId ? `ai.teamModels.${settingsKeyFor(conversation.binding.teamId)}` : null],
      ["project-default", "ai.defaultModel"]
    ];
    for (const [kind, path] of chain) {
      const value = settingValue(conversation.projectId, path);
      if (value) return copy({ model: value.value, provider: "configured", source: kind, path, layer: value.layer, version: value.version });
    }
    return copy({ model: null, provider: null, source: "unresolved", path: null });
  }
  function view(conversation, actor) {
    const messages = liveMessages(conversation);
    return copy({ ...conversation, messages, expiredMessageCount: conversation.messages.length - messages.length, effectiveModel: resolveModel(conversation), viewer: actor.role });
  }
  function redact(item, actor) { return copy({ ...item, content: item.sensitivity === "restricted" && actor.role === "viewer" ? "[restricted memory]" : item.content }); }
  function applyMemory(entry) {
    memory.set(entry.memoryId, entry);
    const currentKey = `${entry.projectId}:${entry.level}:${entry.scopeId ?? "-"}:${entry.key}`;
    if (entry.status === "active") currentMemory.set(currentKey, entry.memoryId);
    else if (currentMemory.get(currentKey) === entry.memoryId) currentMemory.delete(currentKey);
  }
  function sanitizeForTarget(text, sourceProjectId) {
    // Cross-project knowledge never carries the source project's identity or links.
    return String(text)
      .replace(new RegExp(`hero://projects/${sourceProjectId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\s)]*`, "g"), "[source-reference]")
      .replace(new RegExp(sourceProjectId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "[source-project]")
      .slice(0, 2400);
  }

  const api = {
    assignTeam({ actor, projectId, teamId, roleIds = [], principles = [], kpis = [], policy = {}, expectedVersion = null }) {
      editor(actor); scoped(projectId); id("teamId", teamId);
      if (!catalog.has(teamId)) throw new CollaborationError("TEAM_NOT_FOUND", "Team is not in the approved Hero catalog.", 404);
      safe({ principles, kpis, policy });
      const prior = assignments.get(assignmentKey(projectId, teamId));
      if (expectedVersion !== null && expectedVersion !== (prior?.version ?? 0)) throw new CollaborationError("STALE_ASSIGNMENT", "Team assignment changed before update.", 409);
      const assignment = copy({ projectId, teamId, roleIds: roleList(roleIds), status: "active", principles: [...principles], kpis: [...kpis], policy: structuredClone(policy), version: (prior?.version ?? 0) + 1, supersedesVersion: prior?.version ?? null, assignedAt: now(), assignedBy: actor.subject });
      assignments.set(assignmentKey(projectId, teamId), assignment);
      emit("team-assignment", projectId, actor.subject, assignment, assignment.version);
      return assignment;
    },
    unassignTeam({ actor, projectId, teamId, expectedVersion, reason: why }) {
      editor(actor); scoped(projectId);
      const prior = activeAssignment(projectId, id("teamId", teamId));
      if (!prior) throw new CollaborationError("ASSIGNMENT_NOT_FOUND", "The team is not assigned to this project.", 404);
      if (expectedVersion !== prior.version) throw new CollaborationError("STALE_ASSIGNMENT", "Team assignment changed before update.", 409);
      const next = copy({ ...prior, status: "inactive", version: prior.version + 1, supersedesVersion: prior.version, unassignedAt: now(), unassignedBy: actor.subject, reason: reason(why) });
      assignments.set(assignmentKey(projectId, teamId), next);
      emit("team-assignment", projectId, actor.subject, next, next.version);
      return next;
    },
    listTeams({ actor, projectId }) {
      reader(actor); scoped(projectId);
      return Object.freeze([...catalog.values()].map(team => copy({ teamId: team.teamId, name: team.name, responsibility: team.responsibility, assignment: activeAssignment(projectId, team.teamId) })));
    },
    setProfile({ actor, projectId, kind, targetId, profile, expectedVersion = 0 }) {
      editor(actor); scoped(projectId);
      if (!["role", "specialist"].includes(kind)) throw new CollaborationError("PROFILE_KIND_INVALID", "Profile kind is invalid.", 400);
      id("targetId", targetId);
      if (kind === "role" && !AI_ROLES.includes(targetId)) throw new CollaborationError("ROLE_NOT_FOUND", `Role ${targetId} is not a Hero role.`, 404);
      safe(profile);
      const key = profileKey(projectId, kind, targetId); const prior = profiles.get(key) ?? null;
      if ((prior?.version ?? 0) !== expectedVersion) throw new CollaborationError("STALE_PROFILE", "Profile changed before update.", 409);
      const next = copy({ profileId: `profile-${randomUUID()}`, projectId, kind, targetId, version: expectedVersion + 1, status: "active", profile: structuredClone(profile), updatedAt: now(), updatedBy: actor.subject, supersedesProfileId: prior?.profileId ?? null });
      profiles.set(key, next); profileHistory.set(key, [...(profileHistory.get(key) ?? []), next]);
      emit("profile", projectId, actor.subject, next, next.version);
      return next;
    },
    listProfiles({ actor, projectId, kind = null }) {
      reader(actor); scoped(projectId);
      return Object.freeze([...profiles.values()].filter(item => item.projectId === projectId && (!kind || item.kind === kind)).map(item => copy({ ...item, history: (profileHistory.get(profileKey(projectId, item.kind, item.targetId)) ?? []).map(entry => ({ profileId: entry.profileId, version: entry.version, updatedAt: entry.updatedAt, updatedBy: entry.updatedBy })) })));
    },
    bindContext({ actor, projectId, contextType, teamId = null, roleId = null, entityId = null, model = null, retentionDays = 30, title = null }) {
      editor(actor); scoped(projectId);
      if (!CONVERSATION_CONTEXTS.includes(contextType)) throw new CollaborationError("CONTEXT_INVALID", "Conversation context is invalid.", 400);
      if (contextType === "team") { id("teamId", teamId); if (!catalog.has(teamId)) throw new CollaborationError("TEAM_NOT_FOUND", "Team is not in the approved Hero catalog.", 404); }
      if (contextType === "role") { id("roleId", roleId); if (!AI_ROLES.includes(roleId)) throw new CollaborationError("ROLE_NOT_FOUND", `Role ${roleId} is not a Hero role.`, 404); }
      if (contextType === "entity") { id("entityId", entityId); if (entityExists && !entityExists(projectId, entityId)) throw new CollaborationError("ENTITY_NOT_FOUND", "The entity is not in this project's catalog.", 404); }
      if (model !== null) safe(model);
      if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new CollaborationError("RETENTION_INVALID", "Retention is invalid.", 400);
      const conversation = copy({ conversationId: `conversation-${randomUUID()}`, projectId, contextType, binding: { teamId: contextType === "team" ? teamId : null, roleId: contextType === "role" ? roleId : null, entityId: contextType === "entity" ? entityId : null }, model: model === null ? null : structuredClone(model), retentionDays, title: title === null ? null : String(title).slice(0, 160), status: "open", messages: [], createdAt: now(), createdBy: actor.subject });
      conversations.set(conversation.conversationId, conversation);
      const { messages, ...header } = conversation;
      emit("conversation", projectId, actor.subject, header);
      return view(conversation, actor);
    },
    listConversations({ actor, projectId, contextType = null, status = null }) {
      reader(actor); scoped(projectId);
      return Object.freeze([...conversations.values()].filter(item => item.projectId === projectId && (!contextType || item.contextType === contextType) && (!status || item.status === status)).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))).map(item => { const messages = liveMessages(item); return copy({ conversationId: item.conversationId, contextType: item.contextType, binding: item.binding, title: item.title, status: item.status, retentionDays: item.retentionDays, messageCount: messages.length, lastMessageAt: messages.at(-1)?.createdAt ?? null, createdAt: item.createdAt }); }));
    },
    appendMessage({ actor, projectId, conversationId, content, citations = [] }) {
      editor(actor); scoped(projectId); safe({ content, citations });
      if (typeof content !== "string" || content.trim().length < 1 || content.length > 12000) throw new CollaborationError("MESSAGE_INVALID", "Message content is invalid.", 400);
      const prior = requireConversation(conversationId, projectId);
      if (prior.status !== "open") throw new CollaborationError("CONVERSATION_CLOSED", "A closed conversation cannot be continued.", 409);
      if (liveMessages(prior).length >= 1000) throw new CollaborationError("RETENTION_LIMIT", "Conversation retention limit reached.", 409);
      if (!Array.isArray(citations)) throw new CollaborationError("CITATIONS_INVALID", "citations must be an array.", 400);
      const message = copy({ messageId: `message-${randomUUID()}`, actor: actor.subject, content: content.trim(), citations: citations.map(item => source(item, projectId)), createdAt: now() });
      conversations.set(conversationId, copy({ ...prior, messages: [...prior.messages, message] }));
      emit("message", projectId, actor.subject, { conversationId, message });
      return message;
    },
    closeConversation({ actor, projectId, conversationId, reason: why }) {
      editor(actor); scoped(projectId);
      const prior = requireConversation(conversationId, projectId);
      if (prior.status !== "open") throw new CollaborationError("CONVERSATION_CLOSED", "The conversation is already closed.", 409);
      const next = copy({ ...prior, status: "closed", closedAt: now(), closedBy: actor.subject, closedReason: reason(why) });
      conversations.set(conversationId, next);
      emit("conversation-state", projectId, actor.subject, { conversationId, status: "closed", closedAt: next.closedAt, closedBy: next.closedBy, closedReason: next.closedReason });
      return view(next, actor);
    },
    readConversation({ actor, projectId, conversationId }) { reader(actor); return view(requireConversation(conversationId, projectId), actor); },
    recordMemory({ actor, projectId, memoryId, level, key, content, provenance, confidence = 0.5, sensitivity = "normal", expiresAt = null, supersedesMemoryId = null, scopeId = null }) {
      editor(actor); scoped(projectId); id("memoryId", memoryId);
      if (!MEMORY_LEVELS.includes(level) || !MEMORY_SENSITIVITIES.includes(sensitivity)) throw new CollaborationError("MEMORY_FIELD_INVALID", "Memory level or sensitivity is invalid.", 400);
      if (level === "project" && scopeId !== null) throw new CollaborationError("MEMORY_SCOPE_INVALID", "Project memory has no narrower scope.", 400);
      if (scopeId !== null) {
        id("scopeId", scopeId);
        if (level === "team" && !catalog.has(scopeId)) throw new CollaborationError("TEAM_NOT_FOUND", "Team is not in the approved Hero catalog.", 404);
        if (level === "role" && !AI_ROLES.includes(scopeId)) throw new CollaborationError("ROLE_NOT_FOUND", "Role is not a Hero role.", 404);
        if (level === "specialist" && !profiles.has(profileKey(projectId, "specialist", scopeId))) throw new CollaborationError("SPECIALIST_NOT_FOUND", "The specialist profile does not exist in this project.", 404);
      }
      if (memory.has(memoryId)) throw new CollaborationError("MEMORY_ID_REUSED", "memoryId already exists.", 409);
      if (typeof key !== "string" || key.length < 3 || key.length > 120 || typeof content !== "string" || content.length < 3 || content.length > 4000) throw new CollaborationError("MEMORY_INVALID", "Memory key/content is invalid.", 400);
      if (typeof confidence !== "number" || confidence < 0 || confidence > 1) throw new CollaborationError("MEMORY_CONFIDENCE_INVALID", "Memory confidence must be 0..1.", 400);
      safe({ content, key });
      const src = source(provenance, projectId);
      const currentKey = `${projectId}:${level}:${scopeId ?? "-"}:${key}`; const previousId = currentMemory.get(currentKey) ?? null;
      if (previousId !== supersedesMemoryId) throw new CollaborationError("MEMORY_SUPERSEDE_REQUIRED", "Memory updates must explicitly supersede the current memory.", 409);
      if (expiresAt !== null && (Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.parse(now()))) throw new CollaborationError("MEMORY_EXPIRY_INVALID", "Expiry must be in the future.", 400);
      const entry = copy({ memoryId, projectId, level, scopeId, key, content, provenance: src, confidence, sensitivity, status: "active", expiresAt, supersedesMemoryId: previousId, recordedAt: now(), recordedBy: actor.subject });
      if (previousId) { const superseded = copy({ ...memory.get(previousId), status: "superseded", supersededBy: memoryId }); applyMemory(superseded); emit("memory", projectId, actor.subject, superseded, 2); }
      applyMemory(entry); emit("memory", projectId, actor.subject, entry);
      return entry;
    },
    correctMemory({ actor, projectId, memoryId, content, provenance, confidence, expiresAt = null }) {
      editor(actor); const prior = requireMemory(memoryId, projectId);
      if (prior.status !== "active") throw new CollaborationError("MEMORY_NOT_ACTIVE", "Only the active memory can be corrected.", 409);
      return api.recordMemory({ actor, projectId, memoryId: `memory-${randomUUID()}`, level: prior.level, scopeId: prior.scopeId ?? null, key: prior.key, content, provenance, confidence: confidence ?? prior.confidence, expiresAt, sensitivity: prior.sensitivity, supersedesMemoryId: memoryId });
    },
    disableMemory({ actor, projectId, memoryId, reason: why }) {
      editor(actor); const prior = requireMemory(memoryId, projectId);
      const next = copy({ ...prior, status: "disabled", disabledAt: now(), disabledBy: actor.subject, disabledReason: reason(why) });
      applyMemory(next); emit("memory", projectId, actor.subject, next, 2);
      return next;
    },
    memoryHistory({ actor, projectId, memoryId }) {
      reader(actor); let cursor = requireMemory(memoryId, projectId);
      while (cursor.supersededBy && memory.get(cursor.supersededBy)) cursor = memory.get(cursor.supersededBy);
      const chain = [];
      for (let item = cursor; item; item = item.supersedesMemoryId ? memory.get(item.supersedesMemoryId) : null) chain.push(redact(item, actor));
      return Object.freeze(chain);
    },
    retrieveMemory({ actor, projectId, level = null, scopeId = null, query = "" }) {
      reader(actor); scoped(projectId); const moment = Date.parse(now()); const needle = String(query ?? "").toLowerCase();
      return Object.freeze([...memory.values()].filter(item => item.projectId === projectId && item.status === "active" && (!item.expiresAt || Date.parse(item.expiresAt) > moment) && (!level || item.level === level) && (!scopeId || item.scopeId === scopeId) && `${item.key} ${item.content}`.toLowerCase().includes(needle)).map(item => redact(item, actor)));
    },
    proposeKnowledge({ actor, sourceProjectId, targetProjectId, memoryId, summary }) {
      editor(actor); scoped(sourceProjectId); scoped(targetProjectId);
      if (sourceProjectId === targetProjectId) throw new CollaborationError("KNOWLEDGE_TARGET_INVALID", "Knowledge proposal requires a different target project.", 400);
      const item = memory.get(id("memoryId", memoryId));
      if (!item || item.projectId !== sourceProjectId || item.status !== "active" || item.sensitivity === "restricted") throw new CollaborationError("KNOWLEDGE_SOURCE_INVALID", "Only active normal-sensitivity source memory may be proposed.", 409);
      safe({ summary });
      if (typeof summary !== "string" || summary.trim().length < 3) throw new CollaborationError("KNOWLEDGE_SUMMARY_REQUIRED", "A summary is required.", 400);
      const proposal = copy({ knowledgeProposalId: `knowledge-${randomUUID()}`, sourceProjectId, targetProjectId, sourceMemoryId: memoryId, summary: sanitizeForTarget(summary.trim(), sourceProjectId), sourceKind: item.provenance.kind, state: "proposed", createdAt: now(), createdBy: actor.subject });
      proposals.set(proposal.knowledgeProposalId, proposal);
      emit("knowledge", targetProjectId, actor.subject, proposal);
      return proposal;
    },
    listKnowledgeProposals({ actor, projectId }) {
      reader(actor); scoped(projectId);
      // The target sees only the sanitized proposal, never the source memory itself.
      return Object.freeze([...proposals.values()].filter(item => item.targetProjectId === projectId).map(({ sourceMemoryId, sourceProjectId, ...rest }) => copy(rest)));
    },
    acceptKnowledge({ actor, projectId, knowledgeProposalId }) {
      editor(actor); const proposal = proposals.get(id("knowledgeProposalId", knowledgeProposalId));
      if (!proposal || proposal.targetProjectId !== projectId || proposal.state !== "proposed") throw new CollaborationError("KNOWLEDGE_PROPOSAL_INVALID", "Knowledge proposal is not available for target acceptance.", 409);
      const memoryEntry = api.recordMemory({ actor, projectId, memoryId: `memory-${randomUUID()}`, level: "project", key: `knowledge:${knowledgeProposalId}`.slice(0, 120), content: proposal.summary, provenance: { reference: `hero://knowledge/${knowledgeProposalId}`, kind: "accepted-knowledge-proposal", version: "1.0.0" }, confidence: 0.6, supersedesMemoryId: null });
      const accepted = copy({ ...proposal, state: "accepted", acceptedAt: now(), acceptedBy: actor.subject, targetMemoryId: memoryEntry.memoryId });
      proposals.set(knowledgeProposalId, accepted); emit("knowledge", projectId, actor.subject, accepted, 2);
      return accepted;
    },
    rejectKnowledge({ actor, projectId, knowledgeProposalId, reason: why }) {
      editor(actor); const proposal = proposals.get(id("knowledgeProposalId", knowledgeProposalId));
      if (!proposal || proposal.targetProjectId !== projectId || proposal.state !== "proposed") throw new CollaborationError("KNOWLEDGE_PROPOSAL_INVALID", "Knowledge proposal is not available for target decision.", 409);
      const rejected = copy({ ...proposal, state: "rejected", rejectedAt: now(), rejectedBy: actor.subject, rejectedReason: reason(why) });
      proposals.set(knowledgeProposalId, rejected); emit("knowledge", projectId, actor.subject, rejected, 2);
      return rejected;
    },
    purgeProject({ projectId }) {
      scoped(projectId);
      for (const [key, value] of assignments) if (value.projectId === projectId) assignments.delete(key);
      for (const [key, value] of profiles) if (value.projectId === projectId) { profiles.delete(key); profileHistory.delete(key); }
      for (const [key, value] of conversations) if (value.projectId === projectId) conversations.delete(key);
      for (const [key, value] of memory) if (value.projectId === projectId) memory.delete(key);
      for (const key of currentMemory.keys()) if (key.startsWith(`${projectId}:`)) currentMemory.delete(key);
      for (const [key, value] of proposals) if (value.targetProjectId === projectId || value.sourceProjectId === projectId) proposals.delete(key);
    },
    /** Records created since the last drain, oldest first, for an append-only store. */
    drainRecords() { return Object.freeze(outbox.splice(0, outbox.length)); },
    /** Replays one persisted record. Replay is order-independent: an entity is
     * only replaced by a newer version, and messages or state that arrive before
     * their conversation are held until it is hydrated. */
    hydrate(record) {
      if (!record || !COLLABORATION_RECORD_TYPES.includes(record.recordType)) throw new CollaborationError("INVALID_HYDRATION", "Collaboration record is invalid.", 500);
      const data = record.metadata ?? {}; const version = record.recordVersion ?? 1;
      const newer = (key, versions) => { const seen = versions.get(key) ?? 0; if (version < seen) return false; versions.set(key, version); return true; };
      if (record.recordType === "team-assignment" && newer(assignmentKey(data.projectId, data.teamId), hydratedVersions.assignment)) assignments.set(assignmentKey(data.projectId, data.teamId), copy(data));
      if (record.recordType === "profile") {
        const key = profileKey(data.projectId, data.kind, data.targetId);
        profileHistory.set(key, [...(profileHistory.get(key) ?? []).filter(item => item.profileId !== data.profileId), copy(data)].sort((left, right) => left.version - right.version));
        if (newer(key, hydratedVersions.profile)) profiles.set(key, copy(data));
      }
      if (record.recordType === "conversation") {
        const held = pendingConversation.get(data.conversationId) ?? { messages: [], state: null };
        const messages = [...(conversations.get(data.conversationId)?.messages ?? []), ...held.messages].sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
        conversations.set(data.conversationId, copy({ ...data, status: "open", ...(held.state ?? {}), messages }));
        pendingConversation.delete(data.conversationId);
      }
      if (record.recordType === "message") {
        const prior = conversations.get(data.conversationId);
        if (!prior) { const held = pendingConversation.get(data.conversationId) ?? { messages: [], state: null }; held.messages.push(data.message); pendingConversation.set(data.conversationId, held); }
        else if (!prior.messages.some(item => item.messageId === data.message.messageId)) conversations.set(data.conversationId, copy({ ...prior, messages: [...prior.messages, data.message].sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))) }));
      }
      if (record.recordType === "conversation-state") {
        const prior = conversations.get(data.conversationId);
        if (prior) conversations.set(data.conversationId, copy({ ...prior, ...data }));
        else { const held = pendingConversation.get(data.conversationId) ?? { messages: [], state: null }; held.state = data; pendingConversation.set(data.conversationId, held); }
      }
      if (record.recordType === "memory" && newer(data.memoryId, hydratedVersions.memory)) applyMemory(copy(data));
      if (record.recordType === "knowledge" && newer(data.knowledgeProposalId, hydratedVersions.knowledge)) proposals.set(data.knowledgeProposalId, copy(data));
    }
  };
  return Object.freeze(api);
}
