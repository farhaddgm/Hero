import { createHash } from "node:crypto";

import {
  EVENT_TYPES,
  validateOperationalEvent
} from "../../contracts/src/operational-data.mjs";
import {
  OPERATIONAL_DIAGNOSTIC_REGISTRY_IDS,
  OPERATIONAL_DIAGNOSTICS_CONTRACT_VERSION,
  getOperationalDiagnosticsContractSummary
} from "../../contracts/src/operational-diagnostics.mjs";
import { projectOperationalEvent } from "../../contracts/src/observability.mjs";
import { createInMemoryEventLog } from "./event-log.mjs";

const CONFIGURATION_EVENT_PREFIXES = Object.freeze([
  "ai.provider-registered",
  "ai.model-registered",
  "ai.profile-registered",
  "ai.role-bound",
  "ai.role-policy-updated"
]);
const EVENT_TYPE_SET = new Set(EVENT_TYPES);

function copy(value) {
  return structuredClone(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function issue(code, detail, extra = {}) {
  return Object.freeze({ code, detail, ...extra });
}

function registryCoverage(snapshot) {
  const registries = Array.isArray(snapshot?.registries) ? snapshot.registries : [];
  const ids = registries.map(registry => registry?.registryId).filter(value => typeof value === "string");
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].sort();
  const missing = OPERATIONAL_DIAGNOSTIC_REGISTRY_IDS.filter(id => !ids.includes(id));
  const unexpected = [...new Set(ids.filter(id => !OPERATIONAL_DIAGNOSTIC_REGISTRY_IDS.includes(id)))].sort();
  const issues = [
    ...duplicates.map(id => issue("DUPLICATE_REGISTRY", `Registry ${id} occurs more than once.`, { registryId: id })),
    ...missing.map(id => issue("MISSING_REGISTRY", `Registry ${id} is not present.`, { registryId: id })),
    ...unexpected.map(id => issue("UNEXPECTED_REGISTRY", `Registry ${id} is not in the approved projection catalog.`, { registryId: id }))
  ];
  return Object.freeze({
    status: issues.length === 0 ? "valid" : "invalid",
    expected: OPERATIONAL_DIAGNOSTIC_REGISTRY_IDS.length,
    observed: ids.length,
    registryIds: Object.freeze([...ids]),
    missing: Object.freeze(missing),
    unexpected: Object.freeze(unexpected),
    issues: Object.freeze(issues)
  });
}

function snapshotIntegrity(snapshot) {
  const registries = Array.isArray(snapshot?.registries) ? snapshot.registries : [];
  const issues = [];
  if (snapshot?.schemaVersion !== "1.0") issues.push(issue("SNAPSHOT_SCHEMA_INVALID", "The persistence snapshot schema is not 1.0."));
  if (snapshot?.source !== "hero-control-plane-domain-registries") issues.push(issue("SNAPSHOT_SOURCE_INVALID", "The persistence snapshot source is not the Hero control plane."));
  registries.forEach((registry, index) => {
    if (!registry || typeof registry !== "object" || typeof registry.registryId !== "string") {
      issues.push(issue("SNAPSHOT_REGISTRY_INVALID", `Registry snapshot ${index + 1} is invalid.`, { index: index + 1 }));
    } else if (registry.schemaVersion !== "1.0") {
      issues.push(issue("REGISTRY_SCHEMA_INVALID", `Registry ${registry.registryId} does not use schema 1.0.`, { registryId: registry.registryId }));
    }
  });
  return Object.freeze({ status: issues.length === 0 ? "valid" : "invalid", issues: Object.freeze(issues) });
}

function eventIntegrity(events) {
  const input = Array.isArray(events) ? events : [];
  const issues = [];
  const eventIds = new Set();
  const aggregateVersions = new Map();
  input.forEach((event, index) => {
    const validationErrors = validateOperationalEvent(event);
    validationErrors.forEach(detail => issues.push(issue("EVENT_INVALID", detail, { index: index + 1 })));
    if (eventIds.has(event?.eventId)) issues.push(issue("DUPLICATE_EVENT_ID", `Event ${event.eventId} occurs more than once.`, { eventId: event.eventId }));
    if (event?.eventId) eventIds.add(event.eventId);
    if (event?.type && !EVENT_TYPE_SET.has(event.type)) issues.push(issue("UNKNOWN_EVENT_TYPE", `Event type ${event.type} is not in the contract.`, { eventType: event.type }));
    if (event?.aggregateType && event?.aggregateId && Number.isInteger(event.aggregateVersion)) {
      const key = `${event.aggregateType}:${event.aggregateId}`;
      const list = aggregateVersions.get(key) ?? [];
      list.push(event.aggregateVersion);
      aggregateVersions.set(key, list);
    } else {
      issues.push(issue("AGGREGATE_VERSION_MISSING", "Every persisted event needs an aggregate version.", { index: index + 1 }));
    }
  });
  for (const [aggregate, versions] of aggregateVersions.entries()) {
    const ordered = [...versions].sort((left, right) => left - right);
    ordered.forEach((version, index) => {
      const expected = index + 1;
      if (version !== expected) issues.push(issue("AGGREGATE_VERSION_GAP", `${aggregate} has version ${version}; expected ${expected}.`, { aggregate, version, expected }));
    });
  }
  return Object.freeze({
    status: issues.length === 0 ? "valid" : "invalid",
    checked: input.length,
    uniqueEventIds: eventIds.size,
    aggregateCount: aggregateVersions.size,
    issues: Object.freeze(issues)
  });
}

function replayCheck(events) {
  const input = Array.isArray(events) ? events : [];
  const ordered = [...input]
    .sort((left, right) => `${left.aggregateType}:${left.aggregateId}`.localeCompare(`${right.aggregateType}:${right.aggregateId}`) || (left.aggregateVersion ?? 0) - (right.aggregateVersion ?? 0) || String(left.eventId).localeCompare(String(right.eventId)))
    .map((event, index) => ({ ...copy(event), sequence: index + 1 }));
  try {
    const log = createInMemoryEventLog({ events: ordered });
    return Object.freeze({ status: "replayable", checked: log.readAfter().length, note: "validation-only; no external write" });
  } catch (error) {
    return Object.freeze({ status: "blocked", checked: ordered.length, reason: error instanceof Error ? error.message.slice(0, 240) : "Replay validation failed." });
  }
}

function safeAiConfiguration(snapshot, events) {
  const ai = snapshot?.registries?.find(registry => registry?.registryId === "ai-orchestration")?.data ?? snapshot?.registries?.find(registry => registry?.registryId === "ai-orchestration") ?? {};
  const safe = {
    providers: (ai.providers ?? []).map(provider => ({ providerId: provider.providerId, mode: provider.mode, displayName: provider.displayName, capabilities: provider.capabilities ?? [], registeredAt: provider.registeredAt })),
    models: (ai.models ?? []).map(model => ({ providerId: model.providerId, modelId: model.modelId, displayName: model.displayName, metadata: model.metadata ?? {}, registeredAt: model.registeredAt })),
    profiles: (ai.profiles ?? []).map(profile => ({ profileId: profile.profileId, role: profile.role, providerId: profile.providerId, modelId: profile.modelId, promptVersion: profile.promptVersion, contextPolicy: profile.contextPolicy, toolPolicy: profile.toolPolicy, outputSchema: profile.outputSchema, status: profile.status, profileVersion: profile.profileVersion, registeredAt: profile.registeredAt })),
    bindings: (ai.currentBindings ?? ai.bindings ?? []).map(binding => ({ bindingId: binding.bindingId, projectId: binding.projectId, teamId: binding.teamId, skillId: binding.skillId, role: binding.role, profileId: binding.profileId, profileVersion: binding.profileVersion, boundAt: binding.boundAt })),
    rolePolicies: (ai.rolePolicies ?? []).map(policy => ({ role: policy.role, providerId: policy.providerId, modelId: policy.modelId, toolPolicy: policy.toolPolicy, policyVersion: policy.policyVersion, updatedAt: policy.updatedAt }))
  };
  const configurationEvents = events.filter(event => CONFIGURATION_EVENT_PREFIXES.includes(event.type)).map(projectOperationalEvent);
  return Object.freeze({
    counts: Object.freeze({ providers: safe.providers.length, models: safe.models.length, profiles: safe.profiles.length, bindings: safe.bindings.length, rolePolicies: safe.rolePolicies.length }),
    digest: digest(safe),
    changes: Object.freeze(configurationEvents.slice(-50)),
    contentPolicy: "safe metadata only; credentialRef, prompt content and model output are excluded"
  });
}

function knowledgeFreshness(snapshot, now) {
  const teams = snapshot?.registries?.find(registry => registry?.registryId === "team-registry")?.teams ?? [];
  const at = Date.parse(now);
  const summaries = teams.map(team => {
    const provenance = Array.isArray(team.knowledgeProvenance) ? team.knowledgeProvenance : [];
    const latest = [...provenance].sort((left, right) => Date.parse(right.approvedAt ?? right.observedAt ?? 0) - Date.parse(left.approvedAt ?? left.observedAt ?? 0))[0] ?? null;
    const expired = latest?.validUntil && Date.parse(latest.validUntil) <= at;
    const status = expired ? "stale" : latest ? (latest.freshness === "bounded" ? "current" : "review-on-use") : "untracked";
    return { teamId: team.teamId, knowledgeVersion: team.knowledgeVersion ?? 0, entries: Array.isArray(team.knowledge) ? team.knowledge.length : 0, provenanceEntries: provenance.length, latestSourceVersion: latest?.sourceVersion ?? null, latestObservedAt: latest?.observedAt ?? null, validUntil: latest?.validUntil ?? null, status };
  });
  const counts = summaries.reduce((result, team) => { result[team.status] = (result[team.status] ?? 0) + 1; return result; }, {});
  return Object.freeze({ expectedTeams: 11, observedTeams: summaries.length, counts: Object.freeze(counts), teams: Object.freeze(summaries) });
}

function assignmentConflicts(snapshot) {
  const teams = snapshot?.registries?.find(registry => registry?.registryId === "team-registry")?.teams ?? [];
  const activeStates = new Set(["assigned", "working", "review", "rework", "blocked", "paused"]);
  const assignments = teams.flatMap(team => (team.assignments ?? []).filter(assignment => activeStates.has(assignment.state)).map(assignment => ({ ...assignment, teamId: team.teamId })));
  const byTask = new Map();
  assignments.forEach(assignment => { const list = byTask.get(assignment.taskId) ?? []; list.push(assignment); byTask.set(assignment.taskId, list); });
  const conflicts = [...byTask.entries()].filter(([, values]) => new Set(values.map(value => value.teamId)).size > 1).map(([taskId, values]) => ({ code: "TASK_ASSIGNED_TO_MULTIPLE_TEAMS", taskId, teamIds: [...new Set(values.map(value => value.teamId))].sort() }));
  return Object.freeze({ status: conflicts.length === 0 ? "clear" : "attention", capacityModel: "not-configured", activeAssignments: assignments.length, conflicts: Object.freeze(conflicts), note: "No automatic capacity limit or assignment mutation is applied by this report." });
}

export function createOperationalDiagnostics({ persistenceSnapshot, events, now = new Date().toISOString() } = {}) {
  const snapshot = persistenceSnapshot ?? {};
  const domainEvents = Array.isArray(events) ? events : [];
  const coverage = registryCoverage(snapshot);
  const snapshotReport = snapshotIntegrity(snapshot);
  const eventReport = eventIntegrity(domainEvents);
  const replay = replayCheck(domainEvents);
  const replayReady = coverage.status === "valid" && snapshotReport.status === "valid" && eventReport.status === "valid" && replay.status === "replayable";
  const projectionDigest = digest({ snapshot, events: domainEvents });
  return Object.freeze({
    schemaVersion: OPERATIONAL_DIAGNOSTICS_CONTRACT_VERSION,
    generatedAt: now,
    status: replayReady ? "healthy" : "attention",
    contract: getOperationalDiagnosticsContractSummary(),
    registryCoverage: coverage,
    snapshotIntegrity: snapshotReport,
    eventIntegrity: eventReport,
    replayCheck: replay,
    projectionDigest: Object.freeze({ algorithm: "sha256", value: projectionDigest, eventCount: domainEvents.length }),
    aiConfiguration: safeAiConfiguration(snapshot, domainEvents),
    knowledgeFreshness: knowledgeFreshness(snapshot, now),
    assignmentConflicts: assignmentConflicts(snapshot),
    decisionBoundary: "advisory read-only; no authorization, dispatch, provider invocation, deployment or mutation"
  });
}
