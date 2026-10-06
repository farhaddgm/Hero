import { createHash } from "node:crypto";
import { KNOWLEDGE_KINDS, KNOWLEDGE_RELATIONS, KNOWLEDGE_SENSITIVITIES, SYSTEM_DEPENDENCY_RELATIONS, SYSTEM_DISCOVERY_SOURCES, SYSTEM_DRIFT_RESOLUTIONS, SYSTEM_ENTITY_LIFECYCLES, SYSTEM_ENTITY_RULES, SYSTEM_ENTITY_TYPES, SYSTEM_HEALTH_VALUES, SYSTEM_LIFECYCLE_TRANSITIONS, SYSTEM_RECORD_KINDS } from "../../contracts/src/system-catalog.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SECRET = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|private[_-]?key)/i;
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
function copy(value) { return deepFreeze(structuredClone(value)); }
function id(label, value) { if (typeof value !== "string" || !ID.test(value)) throw new SystemCatalogError("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; }
function reader(actor) { if (!actor || !["project-owner", "admin", "viewer"].includes(actor.role)) throw new SystemCatalogError("PROJECT_READ_REQUIRED", "Project access is required.", 403); return actor; }
function owner(actor) { if (actor?.role !== "project-owner") throw new SystemCatalogError("OWNER_REQUIRED", "Owner access is required.", 403); return actor; }
function redactKnowledge(item, actor) { return item.sensitivity === "restricted" && actor?.role === "viewer" ? { knowledgeId: item.knowledgeId, projectId: item.projectId, kind: item.kind, sensitivity: item.sensitivity, current: item.current, title: "[restricted document]", redacted: true } : item; }
function fingerprint(value) { return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`; }
function editor(actor) { if (!actor || !["project-owner", "admin"].includes(actor.role)) throw new SystemCatalogError("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403); return actor; }
function reason(value) { if (typeof value !== "string" || value.trim().length < 3) throw new SystemCatalogError("REASON_REQUIRED", "A reason is required.", 400); return value.trim().slice(0, 500); }
function safe(value, path = "metadata") { if (Array.isArray(value)) return value.forEach((item, index) => safe(item, `${path}[${index}]`)); if (!value || typeof value !== "object") return; for (const [key, child] of Object.entries(value)) { if (SECRET.test(key)) throw new SystemCatalogError("SENSITIVE_METADATA_REJECTED", `${path}.${key} is forbidden in the catalog.`, 400); safe(child, `${path}.${key}`); } }
const stable = value => JSON.stringify(value, (key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export class SystemCatalogError extends Error { constructor(code, message, statusCode = 409, details = undefined) { super(message); this.name = "SystemCatalogError"; this.code = code; this.statusCode = statusCode; if (details) this.details = details; } }

/** Field-level comparison of desired vs observed metadata (nested objects are walked). */
export function diffMetadata(desired = {}, observed = {}, prefix = "") {
  const changes = [];
  for (const key of [...new Set([...Object.keys(desired ?? {}), ...Object.keys(observed ?? {})])].sort()) {
    const path = prefix ? `${prefix}.${key}` : key; const left = desired?.[key]; const right = observed?.[key];
    if (left && right && typeof left === "object" && typeof right === "object" && !Array.isArray(left) && !Array.isArray(right)) { changes.push(...diffMetadata(left, right, path)); continue; }
    if (stable(left) === stable(right)) continue;
    changes.push({ path, kind: left === undefined ? "unexpected-observed" : right === undefined ? "missing-observed" : "changed", desired: left ?? null, observed: right ?? null });
  }
  return changes;
}

/** BO-091: normalize an offline GitHub-API-shaped repository snapshot. The
 * catalog never fetches it; a separate, authorized step produces the file. */
export function normalizeGithubSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || typeof snapshot.full_name !== "string") throw new SystemCatalogError("DISCOVERY_SNAPSHOT_INVALID", "A GitHub repository snapshot needs full_name.", 400);
  return {
    provider: "github",
    fullName: snapshot.full_name,
    defaultBranch: snapshot.default_branch ?? null,
    visibility: snapshot.visibility ?? (snapshot.private === true ? "private" : snapshot.private === false ? "public" : null),
    archived: Boolean(snapshot.archived),
    topics: Array.isArray(snapshot.topics) ? [...snapshot.topics].map(String).sort() : [],
    languages: snapshot.languages && typeof snapshot.languages === "object" ? Object.keys(snapshot.languages).sort() : [],
    ...(snapshot.branch_protection ? { branchProtection: { requiredReviews: Number(snapshot.branch_protection.required_approving_review_count ?? 0), requireStatusChecks: Boolean(snapshot.branch_protection.required_status_checks) } } : {})
  };
}

/** Explicit placeholder for live discovery: refuses until a separate authorization exists. */
export function createGithubLiveDiscoverySource({ authorized = false } = {}) {
  return Object.freeze({ source: "github-live", async fetchRepository() { if (!authorized) throw new SystemCatalogError("GITHUB_LIVE_CALL_NOT_AUTHORIZED", "Live GitHub discovery needs its own authorization; ingest an offline snapshot instead.", 403); throw new SystemCatalogError("GITHUB_LIVE_DISCOVERY_NOT_IMPLEMENTED", "Live GitHub discovery is not part of this build.", 501); } });
}

/**
 * System Catalog v1.1: typed, lifecycle-governed entities and dependencies for a
 * project, with offline discovery and drift proposals that never overwrite the
 * desired state on their own. Every mutation emits an append-only record;
 * hydrate() replays them in any order (newest version per key wins).
 */
export function createSystemCatalog({ now = () => new Date().toISOString(), teamExists = null, healthFor = null } = {}) {
  const entities = new Map(); const history = new Map(); const dependencies = new Map(); const inventoryPlans = new Map(); const driftProposals = new Map(); const knowledge = new Map(); const knowledgeLinks = new Map(); const projectionProposals = new Map();
  const outbox = []; const seen = new Map(); let proposalCounter = 0;
  function emit(kind, key, version, projectId, state, payload, actorId) { outbox.push(copy({ kind, key, version, projectId, state, payload, actorId, recordedAt: now() })); }
  function get(entityId, projectId) { const entity = entities.get(id("entityId", entityId)); if (!entity || entity.projectId !== projectId) throw new SystemCatalogError("ENTITY_NOT_FOUND", "Entity was not found in this project.", 404); return entity; }
  function storeEntity(entity, actorId) { entities.set(entity.entityId, entity); history.set(entity.entityId, [...(history.get(entity.entityId) ?? []), entity]); emit("entity", entity.entityId, entity.version, entity.projectId, entity.lifecycle, { entity }, actorId); return entity; }
  function validateMetadata(type, lifecycle, metadata) {
    const rule = SYSTEM_ENTITY_RULES[type];
    for (const [field, values] of Object.entries(rule.enums)) if (metadata[field] !== undefined && !values.includes(metadata[field])) throw new SystemCatalogError("ENTITY_METADATA_INVALID", `${type}.${field} must be one of ${values.join(", ")}.`, 400, { field });
    if (lifecycle === "active") { const missing = rule.requiredForActive.filter(field => metadata[field] === undefined || metadata[field] === null || metadata[field] === ""); if (missing.length) throw new SystemCatalogError("ENTITY_METADATA_INCOMPLETE", `An active ${type} needs ${missing.join(", ")}.`, 400, { missing }); }
  }
  function activeLinks(projectId) { return [...dependencies.values()].filter(link => link.projectId === projectId && link.state === "active"); }
  /** Acyclic relations share one graph: a loop through any mix of them is a cycle. */
  function reaches(projectId, start, goal) {
    const stack = [start]; const visited = new Set();
    while (stack.length) { const current = stack.pop(); if (current === goal) return true; if (visited.has(current)) continue; visited.add(current); for (const link of activeLinks(projectId)) if (link.fromEntityId === current && SYSTEM_DEPENDENCY_RELATIONS[link.relation]?.acyclic) stack.push(link.toEntityId); }
    return false;
  }
  function liveDependents(projectId, entityId) { return activeLinks(projectId).filter(link => link.toEntityId === entityId && ["depends-on", "hosted-on", "built-from", "runs-in"].includes(link.relation) && ["active", "deprecated"].includes(entities.get(link.fromEntityId)?.lifecycle)); }
  function proposalFor(entity, source, observed, actor) {
    const changes = diffMetadata(entity.metadata?.desired ?? {}, observed);
    const fingerprint = stable(changes);
    const open = [...driftProposals.values()].find(item => item.projectId === entity.projectId && item.entityId === entity.entityId && item.state === "proposed");
    if (open && open.fingerprint === fingerprint && open.entityVersion === entity.version) return copy({ ...open, deduplicated: true });
    if (open) { const superseded = copy({ ...open, state: "superseded", version: open.version + 1, decidedAt: now() }); driftProposals.set(open.driftProposalId, superseded); emit("drift-proposal", open.driftProposalId, superseded.version, entity.projectId, "superseded", { proposal: superseded }, actor.subject); }
    proposalCounter += 1;
    const proposal = copy({ driftProposalId: `drift-${entity.entityId}-${entity.version}-${proposalCounter}`, projectId: entity.projectId, entityId: entity.entityId, entityVersion: entity.version, source, state: changes.length ? "proposed" : "no-drift", differences: [...new Set(changes.map(change => change.path.split(".")[0]))].sort(), changes, fingerprint, desired: structuredClone(entity.metadata?.desired ?? {}), observed: structuredClone(observed), overwrite: "forbidden", version: 1, createdAt: now(), createdBy: actor.subject });
    driftProposals.set(proposal.driftProposalId, proposal); emit("drift-proposal", proposal.driftProposalId, 1, entity.projectId, proposal.state, { proposal }, actor.subject);
    return proposal;
  }

  const api = {
    register({ actor, projectId, entityId, type, name, lifecycle = "planned", metadata = {}, expectedVersion = null }) {
      editor(actor); id("projectId", projectId); id("entityId", entityId);
      if (!SYSTEM_ENTITY_TYPES.includes(type) || !SYSTEM_ENTITY_LIFECYCLES.includes(lifecycle) || typeof name !== "string" || name.trim().length < 1 || !metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new SystemCatalogError("ENTITY_INVALID", "Entity type, lifecycle or name is invalid.", 400);
      safe(metadata);
      const prior = entities.get(entityId);
      if (prior && prior.projectId !== projectId) throw new SystemCatalogError("ENTITY_CROSS_PROJECT_CONFLICT", "Entity id cannot cross project boundaries.", 409);
      if (prior && prior.type !== type) throw new SystemCatalogError("ENTITY_TYPE_IMMUTABLE", "An entity's type cannot change; register a new entity.", 409);
      if (expectedVersion !== null && expectedVersion !== (prior?.version ?? 0)) throw new SystemCatalogError("STALE_ENTITY", "The entity changed before this edit.", 409);
      if (prior && prior.lifecycle !== lifecycle) throw new SystemCatalogError("LIFECYCLE_CHANGE_REQUIRES_TRANSITION", "Use the lifecycle transition to change lifecycle.", 409);
      if (prior?.lifecycle === "retired") throw new SystemCatalogError("ENTITY_RETIRED", "A retired entity is read-only.", 409);
      validateMetadata(type, lifecycle, metadata);
      return storeEntity(copy({ entityId, projectId, type, name: name.trim().slice(0, 160), lifecycle, metadata: structuredClone(metadata), version: (prior?.version ?? 0) + 1, updatedAt: now(), updatedBy: actor.subject }), actor.subject);
    },
    transition({ actor, projectId, entityId, to, expectedVersion, reason: why }) {
      editor(actor); const entity = get(entityId, projectId); const note = reason(why);
      if (expectedVersion !== entity.version) throw new SystemCatalogError("STALE_ENTITY", "The entity changed before this transition.", 409);
      if (!SYSTEM_LIFECYCLE_TRANSITIONS[entity.lifecycle].includes(to)) throw new SystemCatalogError("LIFECYCLE_TRANSITION_INVALID", `${entity.lifecycle} cannot move to ${to}.`, 409, { allowed: SYSTEM_LIFECYCLE_TRANSITIONS[entity.lifecycle] });
      validateMetadata(entity.type, to, entity.metadata);
      if (to === "retired") { const dependents = liveDependents(projectId, entityId); if (dependents.length) throw new SystemCatalogError("ENTITY_HAS_ACTIVE_DEPENDENTS", "Live entities still depend on this one.", 409, { dependents: dependents.map(link => link.fromEntityId).sort() }); }
      return storeEntity(copy({ ...entity, lifecycle: to, version: entity.version + 1, updatedAt: now(), updatedBy: actor.subject, transitionReason: note }), actor.subject);
    },
    history({ projectId, entityId }) { get(entityId, projectId); return Object.freeze([...(history.get(entityId) ?? [])].sort((a, b) => a.version - b.version)); },
    link({ actor, projectId, fromEntityId, toEntityId, relation = "depends-on" }) {
      editor(actor); const from = get(fromEntityId, projectId); const to = get(toEntityId, projectId); const rule = SYSTEM_DEPENDENCY_RELATIONS[relation];
      if (!rule) throw new SystemCatalogError("RELATION_INVALID", "Relation is not part of the catalog contract.", 400);
      if (from.entityId === to.entityId) throw new SystemCatalogError("DEPENDENCY_SELF_REFERENCE", "Entity cannot depend on itself.", 400);
      if (!rule.from.includes(from.type) || !rule.to.includes(to.type)) throw new SystemCatalogError("RELATION_TYPE_MISMATCH", `${from.type} cannot ${relation} ${to.type}.`, 400);
      if ([from, to].some(entity => entity.lifecycle === "retired")) throw new SystemCatalogError("ENTITY_RETIRED", "A retired entity cannot gain dependencies.", 409);
      const key = `${projectId}:${from.entityId}:${to.entityId}:${relation}`; const prior = dependencies.get(key);
      if (prior?.state === "active") return prior;
      if (rule.acyclic && reaches(projectId, to.entityId, from.entityId)) throw new SystemCatalogError("DEPENDENCY_CYCLE", "This link would create a dependency cycle.", 409);
      const link = copy({ dependencyId: key, projectId, fromEntityId: from.entityId, toEntityId: to.entityId, relation, state: "active", version: (prior?.version ?? 0) + 1, createdAt: now(), createdBy: actor.subject });
      dependencies.set(key, link); emit("dependency", key, link.version, projectId, "active", { dependency: link }, actor.subject);
      return link;
    },
    unlink({ actor, projectId, dependencyId, reason: why }) {
      editor(actor); const prior = dependencies.get(dependencyId); const note = reason(why);
      if (!prior || prior.projectId !== projectId || prior.state !== "active") throw new SystemCatalogError("DEPENDENCY_NOT_FOUND", "Dependency was not found in this project.", 404);
      const next = copy({ ...prior, state: "removed", version: prior.version + 1, removedAt: now(), removedBy: actor.subject, removedReason: note });
      dependencies.set(dependencyId, next); emit("dependency", dependencyId, next.version, projectId, "removed", { dependency: next }, actor.subject);
      return next;
    },
    list({ projectId, type = null, lifecycle = null }) { id("projectId", projectId); return Object.freeze([...entities.values()].filter(item => item.projectId === projectId && (!type || item.type === type) && (!lifecycle || item.lifecycle === lifecycle)).sort((a, b) => a.entityId.localeCompare(b.entityId)).map(copy)); },
    dependencies({ projectId, entityId }) { get(entityId, projectId); return Object.freeze(activeLinks(projectId).filter(item => item.fromEntityId === entityId || item.toEntityId === entityId).map(copy)); },
    graph({ projectId }) { id("projectId", projectId); return copy({ nodes: [...entities.values()].filter(item => item.projectId === projectId).map(item => ({ entityId: item.entityId, type: item.type, name: item.name, lifecycle: item.lifecycle })).sort((a, b) => a.entityId.localeCompare(b.entityId)), edges: activeLinks(projectId).map(link => ({ dependencyId: link.dependencyId, from: link.fromEntityId, to: link.toEntityId, relation: link.relation })) }); },
    recordRepositoryInventory({ actor, projectId, repositoryEntityId, observed = {}, source = "local-manifest" }) {
      editor(actor); const repository = get(repositoryEntityId, projectId);
      if (repository.type !== "repository") throw new SystemCatalogError("REPOSITORY_REQUIRED", "Inventory can only bind to a repository entity.", 400);
      if (!SYSTEM_DISCOVERY_SOURCES.includes(source)) throw new SystemCatalogError("DISCOVERY_SOURCE_INVALID", "Only offline discovery sources are accepted.", 400);
      safe(observed, "observed");
      const plan = copy({ inventoryId: `inventory-${repositoryEntityId}-${repository.version}-${inventoryPlans.size + 1}`, projectId, repositoryEntityId, entityVersion: repository.version, source, mode: "local-observed-metadata", observed: structuredClone(observed), state: "recorded-no-external-fetch", recordedAt: now(), recordedBy: actor.subject });
      inventoryPlans.set(plan.inventoryId, plan); emit("inventory", plan.inventoryId, 1, projectId, plan.state, { inventory: plan }, actor.subject);
      return plan;
    },
    /** BO-091: ingest an offline GitHub snapshot for a repository and compare it with the desired catalog. */
    ingestGithubSnapshot({ actor, projectId, repositoryEntityId, snapshot }) {
      editor(actor); const repository = get(repositoryEntityId, projectId);
      if (repository.type !== "repository") throw new SystemCatalogError("REPOSITORY_REQUIRED", "A GitHub snapshot can only bind to a repository entity.", 400);
      const observed = normalizeGithubSnapshot(snapshot);
      if (repository.metadata?.fullName && repository.metadata.fullName !== observed.fullName) throw new SystemCatalogError("DISCOVERY_REPOSITORY_MISMATCH", "The snapshot is for a different repository.", 409);
      const inventory = api.recordRepositoryInventory({ actor, projectId, repositoryEntityId, observed, source: "github-snapshot" });
      return copy({ inventory, proposal: proposalFor(get(repositoryEntityId, projectId), "github-snapshot", observed, actor) });
    },
    detectDrift({ actor, projectId, entityId, observed = {}, source = "local-manifest" }) {
      editor(actor); const entity = get(entityId, projectId);
      if (!SYSTEM_DISCOVERY_SOURCES.includes(source)) throw new SystemCatalogError("DISCOVERY_SOURCE_INVALID", "Only offline discovery sources are accepted.", 400);
      safe(observed, "observed");
      return proposalFor(entity, source, observed, actor);
    },
    listDriftProposals({ projectId, state = null }) { id("projectId", projectId); return Object.freeze([...driftProposals.values()].filter(item => item.projectId === projectId && (!state || item.state === state)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.driftProposalId.localeCompare(a.driftProposalId))); },
    /** BO-092: a human resolves drift. adopt-observed writes a new desired version;
     * fix-source records that the source must change (nothing is written to it); reject closes it. */
    resolveDrift({ actor, projectId, driftProposalId, resolution, reason: why }) {
      editor(actor); const proposal = driftProposals.get(id("driftProposalId", driftProposalId)); const note = reason(why);
      if (!proposal || proposal.projectId !== projectId) throw new SystemCatalogError("DRIFT_PROPOSAL_NOT_FOUND", "Drift proposal was not found in this project.", 404);
      if (proposal.state !== "proposed") throw new SystemCatalogError("DRIFT_PROPOSAL_CLOSED", "The proposal is already closed.", 409);
      if (!SYSTEM_DRIFT_RESOLUTIONS.includes(resolution)) throw new SystemCatalogError("DRIFT_RESOLUTION_INVALID", "Resolution must be adopt-observed, fix-source or reject.", 400);
      const entity = get(proposal.entityId, projectId);
      if (entity.version !== proposal.entityVersion) { const stale = copy({ ...proposal, state: "stale", version: proposal.version + 1, decidedAt: now() }); driftProposals.set(driftProposalId, stale); emit("drift-proposal", driftProposalId, stale.version, projectId, "stale", { proposal: stale }, actor.subject); throw new SystemCatalogError("DRIFT_PROPOSAL_STALE", "The entity changed after this proposal; detect drift again.", 409); }
      let updatedEntity = null;
      if (resolution === "adopt-observed") {
        if (entity.lifecycle === "retired") throw new SystemCatalogError("ENTITY_RETIRED", "A retired entity is read-only.", 409);
        const desired = { ...(entity.metadata?.desired ?? {}) };
        for (const key of proposal.differences) { if (proposal.observed[key] === undefined) delete desired[key]; else desired[key] = structuredClone(proposal.observed[key]); }
        updatedEntity = storeEntity(copy({ ...entity, metadata: { ...entity.metadata, desired }, version: entity.version + 1, updatedAt: now(), updatedBy: actor.subject, adoptedFromProposal: driftProposalId }), actor.subject);
      }
      const state = { "adopt-observed": "accepted-adopt-observed", "fix-source": "accepted-fix-source", reject: "rejected" }[resolution];
      const next = copy({ ...proposal, state, resolution, version: proposal.version + 1, decidedAt: now(), decidedBy: actor.subject, decisionReason: note, ...(resolution === "fix-source" ? { remediation: { target: "source", automated: false, note } } : {}) });
      driftProposals.set(driftProposalId, next); emit("drift-proposal", driftProposalId, next.version, projectId, state, { proposal: next }, actor.subject);
      return copy({ proposal: next, entity: updatedEntity });
    },
    /** BO-093: typed references; the team must exist and a document/artifact must be an internal reference. */
    attachReferences({ actor, projectId, entityId, references }) {
      editor(actor); const entity = get(entityId, projectId); const normalized = {};
      for (const [key, raw] of Object.entries(references ?? {})) {
        const value = String(raw ?? "").trim();
        const valid = {
          owner: () => ID.test(value),
          team: () => ID.test(value) && (!teamExists || teamExists(value)),
          document: () => value.startsWith("hero://") && value.length <= 512,
          run: () => ID.test(value),
          artifact: () => /^sha256:[a-f0-9]{64}$/.test(value) || value.startsWith("hero://"),
          health: () => SYSTEM_HEALTH_VALUES.includes(value)
        }[key];
        if (!valid) throw new SystemCatalogError("REFERENCE_INVALID", `Unsupported reference ${key}.`, 400);
        if (!valid()) throw new SystemCatalogError("REFERENCE_VALUE_INVALID", `Reference ${key} is not valid.`, 400, { reference: key });
        normalized[key] = value;
      }
      if (entity.lifecycle === "retired") throw new SystemCatalogError("ENTITY_RETIRED", "A retired entity is read-only.", 409);
      return storeEntity(copy({ ...entity, metadata: { ...entity.metadata, references: normalized }, version: entity.version + 1, updatedAt: now(), updatedBy: actor.subject }), actor.subject);
    },
    /** BO-093: one view of an entity with its references, live health and dependencies. */
    entityView({ actor = null, projectId, entityId }) {
      if (actor) reader(actor);
      const entity = get(entityId, projectId); const references = entity.metadata?.references ?? {};
      const liveHealth = healthFor ? healthFor(projectId, entityId) : null;
      return copy({ entity, references, health: liveHealth ?? references.health ?? "unknown", healthSource: liveHealth ? "health-engine" : references.health ? "reference" : "none", dependencies: activeLinks(projectId).filter(link => link.fromEntityId === entityId || link.toEntityId === entityId), blastRadius: api.blastRadius({ projectId, entityId }) });
    },
    /** BO-094: canonical documents (decision, research, evidence, roadmap …) live in Git; the catalog indexes them. */
    registerKnowledge({ actor, projectId, knowledgeId, kind, title, sourceRef, tags = [], sensitivity = "normal", entityIds = [] }) {
      editor(actor); id("projectId", projectId); id("knowledgeId", knowledgeId);
      if (typeof sourceRef !== "string" || !sourceRef.startsWith("hero://")) throw new SystemCatalogError("KNOWLEDGE_SOURCE_INVALID", "Knowledge source must be internal hero:// reference.", 400);
      if (!KNOWLEDGE_KINDS.includes(kind)) throw new SystemCatalogError("KNOWLEDGE_KIND_INVALID", `Knowledge kind must be one of ${KNOWLEDGE_KINDS.join(", ")}.`, 400);
      if (!KNOWLEDGE_SENSITIVITIES.includes(sensitivity)) throw new SystemCatalogError("KNOWLEDGE_SENSITIVITY_INVALID", "Sensitivity is invalid.", 400);
      if (!Array.isArray(tags) || !Array.isArray(entityIds)) throw new SystemCatalogError("KNOWLEDGE_INVALID", "tags and entityIds must be arrays.", 400);
      for (const entityId of entityIds) get(entityId, projectId);
      const prior = knowledge.get(knowledgeId); if (prior && prior.projectId !== projectId) throw new SystemCatalogError("KNOWLEDGE_CROSS_PROJECT_CONFLICT", "Knowledge id cannot cross project boundaries.", 409);
      const item = copy({ knowledgeId, projectId, kind, title: String(title).slice(0, 240), sourceRef, tags: tags.map(String).slice(0, 20), sensitivity, entityIds: [...new Set(entityIds)].sort(), version: (prior?.version ?? 0) + 1, createdAt: prior?.createdAt ?? now(), createdBy: prior?.createdBy ?? actor.subject, updatedAt: now() });
      knowledge.set(knowledgeId, item); emit("knowledge", knowledgeId, item.version, projectId, "active", { knowledge: item }, actor.subject);
      return item;
    },
    linkKnowledge({ actor, projectId, fromKnowledgeId, toKnowledgeId, relation }) {
      editor(actor); const rule = KNOWLEDGE_RELATIONS[relation];
      if (!rule) throw new SystemCatalogError("KNOWLEDGE_RELATION_INVALID", "Relation is not part of the document graph.", 400);
      const from = knowledge.get(id("fromKnowledgeId", fromKnowledgeId)); const to = knowledge.get(id("toKnowledgeId", toKnowledgeId));
      if (!from || !to || from.projectId !== projectId || to.projectId !== projectId) throw new SystemCatalogError("KNOWLEDGE_NOT_FOUND", "Both documents must be in this project.", 404);
      if (from.knowledgeId === to.knowledgeId) throw new SystemCatalogError("KNOWLEDGE_SELF_REFERENCE", "A document cannot link to itself.", 400);
      const key = `${projectId}:${from.knowledgeId}:${to.knowledgeId}:${relation}`;
      if (knowledgeLinks.has(key)) return knowledgeLinks.get(key);
      if (rule.acyclic) {
        const stack = [to.knowledgeId]; const visited = new Set();
        while (stack.length) { const current = stack.pop(); if (current === from.knowledgeId) throw new SystemCatalogError("KNOWLEDGE_CYCLE", "This link would create a cycle in the document graph.", 409); if (visited.has(current)) continue; visited.add(current); for (const link of knowledgeLinks.values()) if (link.projectId === projectId && link.from === current && KNOWLEDGE_RELATIONS[link.relation].acyclic) stack.push(link.to); }
      }
      const link = copy({ linkId: key, projectId, from: from.knowledgeId, to: to.knowledgeId, relation, createdAt: now(), createdBy: actor.subject });
      knowledgeLinks.set(key, link); emit("knowledge-link", key, 1, projectId, "active", { link }, actor.subject);
      return link;
    },
    /** BO-094: the document/decision/roadmap graph; a superseded document is marked, never removed. */
    documentGraph({ actor, projectId }) {
      reader(actor); id("projectId", projectId);
      const links = [...knowledgeLinks.values()].filter(link => link.projectId === projectId);
      const superseded = new Set(links.filter(link => link.relation === "supersedes").map(link => link.to));
      return copy({ nodes: [...knowledge.values()].filter(item => item.projectId === projectId).map(item => redactKnowledge({ ...item, current: !superseded.has(item.knowledgeId) }, actor)).sort((a, b) => a.knowledgeId.localeCompare(b.knowledgeId)), edges: links.map(link => ({ from: link.from, to: link.to, relation: link.relation })) });
    },
    /** BO-095: permission-aware search inside one project; viewers never see restricted knowledge text. */
    search({ actor = null, projectId, query, types = null, limit = 50 }) {
      if (actor) reader(actor); id("projectId", projectId);
      const needle = String(query ?? "").trim().toLowerCase(); if (needle.length < 2) throw new SystemCatalogError("SEARCH_QUERY_INVALID", "Search query is too short.", 400);
      const pool = [...[...entities.values()].map(item => ({ resultType: "entity", item })), ...[...knowledge.values()].map(item => ({ resultType: "knowledge", item }))]
        .filter(({ resultType, item }) => item.projectId === projectId && (!types || types.includes(resultType)));
      const scored = [];
      for (const { resultType, item } of pool) {
        const visible = resultType === "knowledge" && actor ? redactKnowledge(item, actor) : item;
        const title = String(visible.name ?? visible.title ?? "").toLowerCase();
        const haystack = resultType === "knowledge" && visible.redacted ? `${visible.knowledgeId} ${visible.kind}`.toLowerCase() : JSON.stringify(visible).toLowerCase();
        if (!haystack.includes(needle)) continue;
        scored.push({ score: title.includes(needle) ? 2 : 1, result: copy({ ...visible, resultType }) });
      }
      return Object.freeze(scored.sort((a, b) => b.score - a.score || String(a.result.entityId ?? a.result.knowledgeId).localeCompare(String(b.result.entityId ?? b.result.knowledgeId))).slice(0, Math.min(Math.max(1, limit), 50)).map(entry => entry.result));
    },
    blastRadius({ projectId, entityId }) { get(entityId, projectId); const reached = new Set([entityId]); let changed = true; while (changed) { changed = false; for (const link of activeLinks(projectId)) if (reached.has(link.toEntityId) && !reached.has(link.fromEntityId)) { reached.add(link.fromEntityId); changed = true; } } return Object.freeze([...reached].sort()); },
    /** BO-096: impact of changing several entities, with the dependency path that reaches each one. */
    impact({ projectId, entityIds }) {
      id("projectId", projectId);
      if (!Array.isArray(entityIds) || !entityIds.length) throw new SystemCatalogError("IMPACT_INPUT_INVALID", "entityIds must be a non-empty array.", 400);
      for (const entityId of entityIds) get(entityId, projectId);
      const paths = new Map(entityIds.map(entityId => [entityId, [entityId]])); const queue = [...entityIds];
      while (queue.length) { const current = queue.shift(); for (const link of activeLinks(projectId)) if (link.toEntityId === current && !paths.has(link.fromEntityId)) { paths.set(link.fromEntityId, [...paths.get(current), link.fromEntityId]); queue.push(link.fromEntityId); } }
      const affected = [...paths.entries()].filter(([entityId]) => !entityIds.includes(entityId)).map(([entityId, path]) => ({ entityId, type: entities.get(entityId).type, lifecycle: entities.get(entityId).lifecycle, path })).sort((a, b) => a.path.length - b.path.length || a.entityId.localeCompare(b.entityId));
      return copy({ changed: [...entityIds].sort(), affected, affectedCount: affected.length, liveAffected: affected.filter(item => ["active", "deprecated"].includes(item.lifecycle)).length });
    },
    /** BO-097: a deterministic, non-sensitive projection of a canonical entity for Notion. */
    projection({ projectId, entityId }) {
      const entity = get(entityId, projectId);
      const fields = { name: entity.name, type: entity.type, lifecycle: entity.lifecycle, desired: entity.metadata?.desired ?? {}, references: entity.metadata?.references ?? {} };
      return copy({ projectId, entityId, canonical: "git", canonicalVersion: entity.version, canonicalHash: fingerprint(fields), fields });
    },
    /** BO-097: a Notion edit never overwrites Git. It becomes a proposal, or a conflict when the canonical entity moved since the projection. */
    reconcileProjectionEdit({ actor, projectId, entityId, baseVersion, baseHash, editedFields }) {
      editor(actor); const current = api.projection({ projectId, entityId });
      if (!editedFields || typeof editedFields !== "object" || Array.isArray(editedFields)) throw new SystemCatalogError("PROJECTION_EDIT_INVALID", "editedFields must be an object.", 400);
      const allowed = ["name", "lifecycle", "desired", "references"]; const unknown = Object.keys(editedFields).filter(key => !allowed.includes(key));
      if (unknown.length) throw new SystemCatalogError("PROJECTION_FIELD_READ_ONLY", `Fields ${unknown.join(", ")} cannot be proposed from a projection.`, 400);
      safe(editedFields, "editedFields");
      const changes = diffMetadata(Object.fromEntries(Object.keys(editedFields).map(key => [key, current.fields[key]])), editedFields);
      const stale = baseVersion !== current.canonicalVersion || baseHash !== current.canonicalHash;
      const state = !changes.length ? "no-change" : stale ? "conflict" : "proposed";
      proposalCounter += 1;
      const proposal = copy({ projectionProposalId: `projection-${entityId}-${current.canonicalVersion}-${proposalCounter}`, projectId, entityId, source: "notion-projection", state, baseVersion, canonicalVersion: current.canonicalVersion, changes, overwrite: "forbidden", version: 1, createdAt: now(), createdBy: actor.subject });
      projectionProposals.set(proposal.projectionProposalId, proposal); emit("projection-proposal", proposal.projectionProposalId, 1, projectId, state, { proposal }, actor.subject);
      return proposal;
    },
    listProjectionProposals({ projectId, state = null }) { id("projectId", projectId); return Object.freeze([...projectionProposals.values()].filter(item => item.projectId === projectId && (!state || item.state === state)).sort((a, b) => b.projectionProposalId.localeCompare(a.projectionProposalId))); },
    decideProjectionProposal({ actor, projectId, projectionProposalId, decision, reason: why }) {
      owner(actor); const note = reason(why); const proposal = projectionProposals.get(id("projectionProposalId", projectionProposalId));
      if (!proposal || proposal.projectId !== projectId) throw new SystemCatalogError("PROJECTION_PROPOSAL_NOT_FOUND", "Projection proposal was not found.", 404);
      if (proposal.state !== "proposed") throw new SystemCatalogError("PROJECTION_PROPOSAL_CLOSED", "Only an open proposal can be decided; resolve a conflict by re-projecting.", 409);
      if (!["accept", "reject"].includes(decision)) throw new SystemCatalogError("PROJECTION_DECISION_INVALID", "Decision must be accept or reject.", 400);
      // Accepting records the owner's decision; the canonical change itself lands through Git review.
      const next = copy({ ...proposal, state: decision === "accept" ? "accepted" : "rejected", version: proposal.version + 1, decidedAt: now(), decidedBy: actor.subject, decisionReason: note, canonicalChange: decision === "accept" ? { via: "git-review", automated: false } : null });
      projectionProposals.set(projectionProposalId, next); emit("projection-proposal", projectionProposalId, next.version, projectId, next.state, { proposal: next }, actor.subject);
      return next;
    },
    purgeProject({ projectId }) {
      for (const map of [entities, dependencies, inventoryPlans, driftProposals, knowledge, knowledgeLinks, projectionProposals]) for (const [key, value] of map) if (value.projectId === projectId) map.delete(key);
      for (const [key, versions] of history) if (versions[0]?.projectId === projectId) history.delete(key);
    },
    drainRecords() { return Object.freeze(outbox.splice(0, outbox.length)); },
    hydrate(record) {
      if (!record || !SYSTEM_RECORD_KINDS.includes(record.kind)) throw new SystemCatalogError("INVALID_HYDRATION", "Catalog record is invalid.", 500);
      const payload = record.payload ?? {}; const key = `${record.kind}:${record.key}`;
      if (record.kind === "entity") { const versions = (history.get(record.key) ?? []).filter(item => item.version !== payload.entity.version); history.set(record.key, [...versions, copy(payload.entity)].sort((a, b) => a.version - b.version)); }
      if ((seen.get(key) ?? 0) > record.version) return; seen.set(key, record.version);
      if (record.kind === "entity") entities.set(record.key, copy(payload.entity));
      if (record.kind === "dependency") dependencies.set(record.key, copy(payload.dependency));
      if (record.kind === "inventory") inventoryPlans.set(record.key, copy(payload.inventory));
      if (record.kind === "drift-proposal") { driftProposals.set(record.key, copy(payload.proposal)); proposalCounter = Math.max(proposalCounter, Number(record.key.split("-").at(-1)) || 0); }
      if (record.kind === "knowledge") knowledge.set(record.key, copy(payload.knowledge));
      if (record.kind === "knowledge-link") knowledgeLinks.set(record.key, copy(payload.link));
      if (record.kind === "projection-proposal") { projectionProposals.set(record.key, copy(payload.proposal)); proposalCounter = Math.max(proposalCounter, Number(record.key.split("-").at(-1)) || 0); }
    }
  };
  return Object.freeze(api);
}
