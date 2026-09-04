import {
  PROJECT_MEMORY_KINDS,
  PROJECT_MEMORY_RECIPIENT_ROLES,
  PROJECT_MEMORY_SCOPES,
  PROJECT_MEMORY_STATUSES,
  getProjectMemoryContractSummary
} from "../../contracts/src/project-memory.mjs";
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
      if (FORBIDDEN_KEY.test(key)) throw new ProjectMemorySafetyError(`${path}.${key} is a sensitive field.`);
      assertSafeValue(item, `${path}.${key}`);
    });
    return;
  }
  if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) {
    throw new ProjectMemorySafetyError(`${path} contains a sensitive value.`);
  }
  if (typeof value === "string" && HOST_PATH.test(value)) {
    throw new ProjectMemorySafetyError(`${path} contains a host-specific absolute path.`);
  }
}

function assertSource(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("source is required.");
  assertIdentifier("source.kind", source.kind, 48);
  assertIdentifier("source.documentVersion", source.documentVersion, 48);
  if (typeof source.reference !== "string" || !source.reference.startsWith("hero://") || source.reference.includes("\\")) {
    throw new ProjectMemorySafetyError("source.reference must be an internal hero reference.");
  }
  if (/^hero:\/\/https?:/i.test(source.reference)) throw new ProjectMemorySafetyError("source.reference must not point to an external service.");
  return immutableCopy({ kind: source.kind, reference: source.reference, documentVersion: source.documentVersion });
}

function assertTags(tags) {
  if (!Array.isArray(tags) || tags.length < 1 || tags.length > 8) throw new Error("tags must contain 1-8 labels.");
  const unique = [...new Set(tags)];
  if (unique.length !== tags.length) throw new Error("tags must not contain duplicates.");
  unique.forEach(tag => assertIdentifier("tag", tag, 40));
  return Object.freeze(unique);
}

function assertRoles(roles) {
  if (!Array.isArray(roles) || roles.length < 1) throw new Error("recipientRoles are required.");
  const unique = [...new Set(roles)];
  if (unique.some(role => !PROJECT_MEMORY_RECIPIENT_ROLES.includes(role))) throw new Error("recipientRoles contains an unsupported role.");
  return Object.freeze(unique);
}

function normalizeBinding(scope, binding) {
  if (scope === "project") {
    if (binding !== undefined && binding !== null) throw new Error("Project-scoped memory cannot have a task binding.");
    return null;
  }
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) throw new Error("Task-scoped memory requires a task binding.");
  assertIdentifier("binding.taskId", binding.taskId);
  assertIdentifier("binding.stepId", binding.stepId);
  assertIdentifier("binding.documentVersion", binding.documentVersion, 48);
  return immutableCopy({ taskId: binding.taskId, stepId: binding.stepId, documentVersion: binding.documentVersion });
}

function sameBinding(left, right) {
  return left?.taskId === right?.taskId && left?.stepId === right?.stepId && left?.documentVersion === right?.documentVersion;
}

function recordResult(record, event, idempotent) {
  return Object.freeze({ record: immutableCopy(record), event: immutableCopy(event), idempotent });
}

export class ProjectMemorySafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProjectMemorySafetyError";
    this.code = "MEMORY_SAFETY_REJECTED";
  }
}

export class ProjectMemoryVersionConflictError extends Error {
  constructor(memoryKey) {
    super(`memoryKey ${memoryKey} requires an explicit supersedesMemoryId for a new version.`);
    this.name = "ProjectMemoryVersionConflictError";
    this.code = "MEMORY_VERSION_CONFLICT";
  }
}

export class ProjectMemoryIdempotencyConflictError extends Error {
  constructor(key) {
    super(`idempotencyKey ${key} was already used with different memory input.`);
    this.name = "ProjectMemoryIdempotencyConflictError";
  }
}

export function createProjectMemory(options = {}) {
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const now = options.now ?? (() => new Date().toISOString());
  const records = new Map();
  const currentByKey = new Map();
  const contextAssemblies = new Map();
  const idempotency = new Map();
  let nextEvent = 0;
  const eventIdFactory = options.eventIdFactory ?? (() => `evt_memory_${String(++nextEvent).padStart(6, "0")}`);

  function currentKey(projectId, memoryKey) {
    return `${projectId}\u0000${memoryKey}`;
  }

  function append(projectId, type, actor, data) {
    const event = createOperationalEvent({
      eventId: eventIdFactory(),
      aggregateType: "memory",
      aggregateId: projectId,
      type,
      occurredAt: now(),
      actor,
      data
    });
    return eventLog.append(event, { expectedVersion: eventLog.currentVersion("memory", projectId) });
  }

  function record(input) {
    assertSafeValue(input);
    assertIdentifier("memoryId", input?.memoryId);
    assertIdentifier("projectId", input?.projectId);
    assertIdentifier("memoryKey", input?.memoryKey, 96);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    assertIdentifier("actor.id", input?.actor?.id);
    assertIdentifier("actor.kind", input?.actor?.kind, 32);
    if (!PROJECT_MEMORY_KINDS.includes(input.kind)) throw new Error("Memory kind is not supported.");
    if (!PROJECT_MEMORY_SCOPES.includes(input.scope)) throw new Error("Memory scope is not supported.");
    if (!PROJECT_MEMORY_STATUSES.includes(input.status)) throw new Error("Memory status is not supported.");
    if (typeof input.content !== "string" || input.content.length < 3 || input.content.length > 2400) {
      throw new Error("content must be a 3-2400 character string.");
    }
    const source = assertSource(input.source);
    const tags = assertTags(input.tags);
    const recipientRoles = assertRoles(input.recipientRoles);
    const binding = normalizeBinding(input.scope, input.binding);
    const valueFingerprint = fingerprint({ ...input, source, tags, recipientRoles, binding });
    const replayed = idempotency.get(input.idempotencyKey);
    if (replayed) {
      if (replayed.fingerprint !== valueFingerprint) throw new ProjectMemoryIdempotencyConflictError(input.idempotencyKey);
      return recordResult(replayed.record, replayed.event, true);
    }
    if (records.has(input.memoryId)) throw new Error(`memoryId ${input.memoryId} already exists.`);
    const key = currentKey(input.projectId, input.memoryKey);
    const currentId = currentByKey.get(key);
    if (currentId && input.supersedesMemoryId !== currentId) throw new ProjectMemoryVersionConflictError(input.memoryKey);
    if (!currentId && input.supersedesMemoryId !== undefined) throw new ProjectMemoryVersionConflictError(input.memoryKey);
    if (currentId) {
      append(input.projectId, "memory.superseded", input.actor, {
        memoryId: currentId,
        supersededBy: input.memoryId,
        memoryKey: input.memoryKey
      });
    }
    const event = append(input.projectId, "memory.recorded", input.actor, {
      memoryId: input.memoryId,
      memoryKey: input.memoryKey,
      kind: input.kind,
      scope: input.scope,
      status: input.status,
      source: { kind: source.kind, documentVersion: source.documentVersion }
    });
    const previous = currentId ? records.get(currentId) : null;
    const stored = immutableCopy({
      memoryId: input.memoryId,
      projectId: input.projectId,
      memoryKey: input.memoryKey,
      recordVersion: (previous?.recordVersion ?? 0) + 1,
      kind: input.kind,
      scope: input.scope,
      status: input.status,
      content: input.content,
      tags,
      recipientRoles,
      binding,
      source,
      supersedesMemoryId: currentId ?? null,
      recordedAt: event.occurredAt,
      eventId: event.eventId
    });
    records.set(stored.memoryId, stored);
    currentByKey.set(key, stored.memoryId);
    idempotency.set(input.idempotencyKey, { fingerprint: valueFingerprint, record: stored, event });
    return recordResult(stored, event, false);
  }

  function assemble(input) {
    assertSafeValue(input);
    assertIdentifier("contextId", input?.contextId);
    assertIdentifier("projectId", input?.projectId);
    assertIdentifier("taskId", input?.taskId);
    assertIdentifier("stepId", input?.stepId);
    assertIdentifier("documentVersion", input?.documentVersion, 48);
    assertIdentifier("recipientRole", input?.recipientRole, 32);
    assertIdentifier("idempotencyKey", input?.idempotencyKey);
    if (!PROJECT_MEMORY_RECIPIENT_ROLES.includes(input.recipientRole)) throw new Error("recipientRole is not supported.");
    if (!Number.isInteger(input.maxItems) || input.maxItems < 1 || input.maxItems > 12) throw new Error("maxItems must be an integer between 1 and 12.");
    const candidates = [...currentByKey.values()]
      .map(memoryId => records.get(memoryId))
      .filter(record => record.projectId === input.projectId && record.recipientRoles.includes(input.recipientRole));
    const exactTask = candidates.filter(record => record.scope === "task" && sameBinding(record.binding, input));
    const staleTask = candidates.filter(record =>
      record.scope === "task" && record.binding.taskId === input.taskId && record.binding.stepId === input.stepId && record.binding.documentVersion !== input.documentVersion
    );
    const selected = candidates.filter(record => record.scope === "project" || exactTask.includes(record)).slice(0, input.maxItems);
    const memoryRevision = selected.map(record => `${record.memoryId}:${record.recordVersion}`).join("|");
    const replayKey = `${input.contextId}\u0000${input.idempotencyKey}`;
    const valueFingerprint = fingerprint({ ...input, memoryRevision });
    const existing = idempotency.get(replayKey);
    if (existing) {
      if (existing.fingerprint !== valueFingerprint) throw new ProjectMemoryIdempotencyConflictError(input.idempotencyKey);
      return immutableCopy({ ...existing.result, idempotent: true });
    }
    let result;
    if (staleTask.length > 0 && exactTask.length === 0) {
      result = { status: "blocked", code: "STALE_TASK_CONTEXT", context: null, idempotent: false };
    } else if (selected.length === 0) {
      result = { status: "blocked", code: "CONTEXT_NOT_FOUND", context: null, idempotent: false };
    } else {
      const event = append(input.projectId, "context.assembled", ORCHESTRATOR, {
        contextId: input.contextId,
        taskId: input.taskId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        recipientRole: input.recipientRole,
        memoryIds: selected.map(record => record.memoryId),
        maxItems: input.maxItems,
        selectedItems: selected.length
      });
      const assembly = immutableCopy({
        contextId: input.contextId,
        projectId: input.projectId,
        taskId: input.taskId,
        stepId: input.stepId,
        documentVersion: input.documentVersion,
        recipientRole: input.recipientRole,
        memoryIds: selected.map(record => record.memoryId),
        maxItems: input.maxItems,
        selectedItems: selected.length,
        status: "ready",
        code: "CONTEXT_READY",
        assembledAt: event.occurredAt,
        eventId: event.eventId
      });
      contextAssemblies.set(event.eventId, assembly);
      result = {
        status: "ready",
        code: "CONTEXT_READY",
        context: immutableCopy({
          contextId: input.contextId,
          projectId: input.projectId,
          task: { taskId: input.taskId, stepId: input.stepId, documentVersion: input.documentVersion },
          recipientRole: input.recipientRole,
          records: selected,
          minimization: { maxItems: input.maxItems, selectedItems: selected.length, latestOnly: true, roleFiltered: true },
          artifact: { reference: `hero://artifacts/${encodeURIComponent(input.contextId)}/project-context.json`, external: false },
          boundary: { readOnly: true, providerInvocation: false, codeMutation: false, hostPathsIncluded: false, secretsIncluded: false },
          eventId: event.eventId
        }),
        idempotent: false
      };
    }
    idempotency.set(replayKey, { fingerprint: valueFingerprint, result: immutableCopy(result) });
    return immutableCopy(result);
  }

  function persistenceSnapshot() {
    return immutableCopy({
      schemaVersion: "1.0",
      registryId: "project-memory",
      records: [...records.values()],
      contextAssemblies: [...contextAssemblies.values()]
    });
  }

  function list() {
    return immutableCopy([...currentByKey.values()]
      .map(memoryId => records.get(memoryId))
      .filter(Boolean)
      .sort((left, right) => left.projectId.localeCompare(right.projectId) || left.memoryKey.localeCompare(right.memoryKey)));
  }

  function listContextAssemblies(limit = 100) {
    const normalizedLimit = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 100;
    return immutableCopy([...contextAssemblies.values()]
      .sort((left, right) => String(right.assembledAt).localeCompare(String(left.assembledAt)) || String(right.eventId).localeCompare(String(left.eventId)))
      .slice(0, normalizedLimit));
  }

  function hydrate(input = {}) {
    const state = input.data ?? input;
    if (!state || !Array.isArray(state.records)) throw new ProjectMemorySafetyError("Project Memory hydration requires records.");
    if (Array.isArray(input.events)) eventLog.load(input.events.filter(event => event.aggregateType === "memory"));
    records.clear();
    currentByKey.clear();
    contextAssemblies.clear();
    idempotency.clear();
    for (const record of state.records) {
      if (!record || typeof record !== "object" || typeof record.memoryId !== "string" || typeof record.projectId !== "string" || typeof record.memoryKey !== "string") throw new ProjectMemorySafetyError("A hydrated memory record is invalid.");
      const stored = immutableCopy(record);
      records.set(stored.memoryId, stored);
      const key = currentKey(stored.projectId, stored.memoryKey);
      const current = records.get(currentByKey.get(key));
      if (!current || (stored.recordVersion ?? 0) >= (current.recordVersion ?? 0)) currentByKey.set(key, stored.memoryId);
    }
    const storedAssemblies = Array.isArray(state.contextAssemblies) ? state.contextAssemblies : [];
    for (const assembly of storedAssemblies) {
      if (!assembly || typeof assembly !== "object" || typeof assembly.eventId !== "string" || typeof assembly.contextId !== "string") throw new ProjectMemorySafetyError("A hydrated context assembly is invalid.");
      contextAssemblies.set(assembly.eventId, immutableCopy(assembly));
    }
    if (Array.isArray(input.events)) {
      for (const event of input.events.filter(item => item?.aggregateType === "memory" && item?.type === "context.assembled")) {
        if (contextAssemblies.has(event.eventId)) continue;
        const data = event.data ?? {};
        contextAssemblies.set(event.eventId, immutableCopy({
          contextId: data.contextId,
          projectId: event.aggregateId,
          taskId: data.taskId,
          stepId: data.stepId,
          documentVersion: data.documentVersion,
          recipientRole: data.recipientRole,
          memoryIds: Array.isArray(data.memoryIds) ? data.memoryIds : [],
          maxItems: data.maxItems ?? null,
          selectedItems: data.selectedItems ?? data.memoryIds?.length ?? 0,
          status: "ready",
          code: "CONTEXT_READY",
          assembledAt: event.occurredAt,
          eventId: event.eventId
        }));
      }
    }
    return immutableCopy({ registryId: "project-memory", hydrated: true, records: records.size, currentKeys: currentByKey.size });
  }

  return Object.freeze({
    record,
    assemble,
    list,
    listContextAssemblies,
    persistenceSnapshot,
    hydrate,
    read: memoryId => records.has(memoryId) ? immutableCopy(records.get(memoryId)) : null,
    events: () => eventLog.readAfter(),
    contract: () => getProjectMemoryContractSummary()
  });
}

export function createProjectMemoryHarness(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const eventLog = options.eventLog ?? createInMemoryEventLog();
  const authorization = options.authorizationEngine ?? createAuthorizationEngine({ eventLog, now });
  const memory = options.memory ?? createProjectMemory({ eventLog, now });

  function run(input) {
    const authorizationId = `AUTH-MEMORY-${input.context.contextId}`;
    authorization.grant({
      authorizationId,
      mode: "direct",
      entries: [{ stepId: input.context.stepId, documentVersion: input.context.documentVersion }],
      operations: ["review"],
      actor: OWNER,
      idempotencyKey: `${input.context.contextId}-grant`,
      note: "deterministic project memory harness only"
    });
    const dispatch = authorization.evaluateDispatch({
      authorizationId,
      stepId: input.context.stepId,
      documentVersion: input.context.documentVersion,
      operation: "review",
      actor: ORCHESTRATOR,
      idempotencyKey: `${input.context.contextId}-dispatch`
    });
    if (!dispatch.decision.authorized) throw new Error(`Project memory dispatch was blocked: ${dispatch.decision.code}.`);
    input.records.forEach(entry => memory.record(entry));
    return immutableCopy({ dispatch: dispatch.decision, result: memory.assemble(input.context), events: eventLog.readAfter() });
  }

  return Object.freeze({ run, contract: () => getProjectMemoryContractSummary() });
}
