import { randomUUID } from "node:crypto";
import { COMMAND_DEFAULT_MAX_ATTEMPTS, COMMAND_DEFAULT_TIMEOUT_MINUTES, COMMAND_RECORD_KINDS, COMMAND_RISKS, actionPolicy, riskRank } from "../../contracts/src/backoffice-command-center.mjs";
import { createWorkflowEngine } from "./workflow-engine.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const HIGH = new Set(["high", "critical"]);
const SECRET = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
const PROJECT_REFERENCE = /^hero:\/\/projects\/([^/]+)(?:\/|$)/;
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
function copy(value) { return deepFreeze(structuredClone(value)); }
function id(label, value) { if (typeof value !== "string" || !ID.test(value)) throw new CommandCenterError("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; }
function editor(actor) { if (!actor || !["project-owner", "admin"].includes(actor.role)) throw new CommandCenterError("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403); return actor; }
function owner(actor) { if (actor?.role !== "project-owner") throw new CommandCenterError("OWNER_REQUIRED", "Owner access is required.", 403); return actor; }
function reader(actor) { if (!actor || !["project-owner", "admin", "viewer"].includes(actor.role)) throw new CommandCenterError("PROJECT_READ_REQUIRED", "Project access is required.", 403); return actor; }
function safe(value, path = "payload") { if (Array.isArray(value)) return value.forEach((item, index) => safe(item, `${path}[${index}]`)); if (!value || typeof value !== "object") return; for (const [key, child] of Object.entries(value)) { if (SECRET.test(key)) throw new CommandCenterError("SENSITIVE_PAYLOAD_REJECTED", `${path}.${key} is forbidden in a command.`, 400); safe(child, `${path}.${key}`); } }
function reason(value) { if (typeof value !== "string" || value.trim().length < 3) throw new CommandCenterError("REASON_REQUIRED", "A reason is required.", 400); return value.trim().slice(0, 500); }
export class CommandCenterError extends Error { constructor(code, message, statusCode = 409, details = undefined) { super(message); this.name = "CommandCenterError"; this.code = code; this.statusCode = statusCode; if (details) this.details = details; } }

/**
 * Command Center: intent → decision (immutable policy snapshot) → approval →
 * queue → gated dispatch → run with checkpoint, bounded retry, timeout,
 * compensation and manual recovery. Every mutation emits an append-only record
 * (drainRecords); hydrate() replays them, turning runs that were mid-flight at a
 * crash into `interrupted` so nothing is executed twice without a decision.
 *
 * settings: optional project settings registry (WP-04) for the direct-execution
 * policy, the decision snapshot and the dispatch readiness gate.
 */
export function createCommandCenter({ now = () => new Date().toISOString(), globalStop = () => false, workflow = createWorkflowEngine({ now }), heavyRunLimit = 2, settings = null, maxAttempts = COMMAND_DEFAULT_MAX_ATTEMPTS, timeoutMinutes = COMMAND_DEFAULT_TIMEOUT_MINUTES } = {}) {
  if (!Number.isInteger(heavyRunLimit) || heavyRunLimit < 1 || heavyRunLimit > 20) throw new Error("heavyRunLimit is invalid.");
  const intents = new Map(); const entries = new Map(); const templates = new Map(); const preauthorizations = new Map(); const locks = new Map();
  const outbox = []; const seenVersions = new Map();
  const scheduler = { heavyRunLimit, version: 1 };
  const nowMs = () => Date.parse(now());

  function emit(kind, key, version, projectId, state, metadata, actorId) {
    outbox.push(copy({ kind, key, version, projectId, state, authorizationSnapshotId: metadata?.intent?.decision?.authorizationSnapshotId ?? "none", correlationId: metadata?.intent?.correlationId ?? "none", actorId, recordedAt: now(), metadata }));
  }
  function save(commandId, actorId) {
    const intent = intents.get(commandId); const revision = (intent.revision ?? 0) + 1;
    const next = copy({ ...intent, revision }); intents.set(commandId, next);
    emit("command", commandId, revision, next.projectId, entries.get(commandId)?.state ?? next.state, { intent: next, entry: entries.get(commandId) ?? null }, actorId);
    return next;
  }
  function get(commandId) { const item = intents.get(id("commandId", commandId)); if (!item) throw new CommandCenterError("COMMAND_NOT_FOUND", "Command was not found.", 404); return item; }
  function update(commandId, patch) { const next = copy({ ...get(commandId), ...patch }); intents.set(commandId, next); return next; }
  function setEntry(commandId, patch) { const next = copy({ ...(entries.get(commandId) ?? {}), ...patch }); entries.set(commandId, next); return next; }
  function activeHeavy() { return [...entries.values()].filter(item => item.state === "running" && item.heavy).length; }
  function runningIn(projectId) { return [...entries.values()].filter(item => item.state === "running" && item.projectId === projectId).length; }
  function policySnapshot(projectId) {
    if (!settings?.explain) return { source: "none", automationMode: null, version: null };
    const item = settings.explain({ projectId, path: "automation.mode" });
    return { source: "project-settings", automationMode: item.status === "resolved" ? item.effective.value : null, version: item.status === "resolved" ? item.effective.version : null, status: item.status };
  }
  function directAllowed(intent, snapshot) {
    const policy = actionPolicy(intent.action);
    if (intent.executionMode !== "direct-if-policy" || !policy.directEligible || intent.risk !== "low") return false;
    // Without a settings registry the explicit direct-if-policy request is the policy;
    // with one, the project's automation mode must allow propose-first execution.
    return snapshot.source === "none" || snapshot.automationMode === "propose-first";
  }
  /** BO-084: every gate is re-evaluated at dispatch; a failing gate blocks with a reason. */
  function dispatchBlocker(entry) {
    const intent = get(entry.commandId);
    if (intent.approval?.state === "revoked") return { code: "APPROVAL_REVOKED", message: "The approval was revoked." };
    if (intent.approval && Date.parse(intent.approval.expiresAt) <= nowMs()) return { code: "APPROVAL_EXPIRED", message: "The approval expired before dispatch." };
    if (intent.state !== "queued") return { code: "COMMAND_NOT_APPROVED", message: "The command is no longer approved." };
    if (settings?.explain) {
      const current = policySnapshot(intent.projectId);
      if (intent.decision?.snapshot?.policy?.version !== current.version) return { code: "POLICY_CHANGED_SINCE_DECISION", message: "The project policy changed after the decision; re-authorize." };
      try { settings.assertDispatchable({ projectId: intent.projectId }); } catch (error) { return { code: error.code ?? "POLICY_INCOMPLETE", message: "Required project policy is missing or in conflict." }; }
    }
    if (actionPolicy(intent.action).sideEffect === "production") {
      const preauth = matchPreauthorization({ projectId: intent.projectId, changeType: intent.payload?.changeType, artifactDigest: intent.payload?.artifactDigest });
      return { code: "PRODUCTION_SEPARATE_GATE", message: preauth ? "A preauthorization matches, but Production still requires its separate deploy gate." : "Production requires a matching preauthorization and its separate deploy gate." };
    }
    return null;
  }
  function score(entry) { return entry.priority + Math.floor((nowMs() - Date.parse(entry.queuedAt)) / 60000) - 5 * runningIn(entry.projectId); }
  function matchPreauthorization({ projectId, changeType, artifactDigest }) {
    const moment = nowMs();
    return [...preauthorizations.values()].find(item => item.projectId === projectId && item.state === "recorded-not-a-deploy-grant" && item.changeType === changeType && item.artifactDigest === artifactDigest && Date.parse(item.validFrom) <= moment && moment < Date.parse(item.validUntil)) ?? null;
  }
  function card(intent) {
    const policy = actionPolicy(intent.action); const entry = entries.get(intent.commandId) ?? null;
    const gates = [HIGH.has(intent.risk) ? "human-approval" : intent.executionMode === "direct-if-policy" && policy.directEligible && intent.risk === "low" ? "explicit-direct-policy" : "human-approval", "global-stop", "policy-readiness", ...(policy.sideEffect === "production" ? ["production-preauthorization", "production-separate-gate"] : [])];
    return copy({ commandId: intent.commandId, projectId: intent.projectId, action: intent.action, category: policy.category, risk: intent.risk, riskFloor: policy.minRisk, sideEffect: policy.sideEffect, compensation: policy.compensation, summary: intent.summary, source: intent.sourceRef ?? null, payloadPreview: intent.payload, state: entry?.state ?? intent.state, requiredGates: [...new Set(gates)], decision: intent.decision ? { version: intent.decision.version, state: intent.decision.state, policyMode: intent.decision.snapshot.policy.automationMode } : null, approval: intent.approval ? { state: intent.approval.state, expiresAt: intent.approval.expiresAt, approvedBy: intent.approval.approvedBy } : null, blocker: entry?.blocker ?? null, attempts: entry?.attempts ?? 0, correlationId: intent.correlationId });
  }
  function startWorkflow(entry, actor) {
    const runId = `run-${entry.commandId}-${entry.attempts}`; const who = { kind: "project-owner", id: actor.subject };
    const run = workflow.create({ runId, taskId: entry.commandId, actor: who, idempotencyKey: `workflow-${runId}`, correlationId: entry.correlationId });
    for (const action of ["plan", "queue", "start"]) workflow.apply({ runId: run.workflow.runId, action, actor: who, idempotencyKey: `${action}-${runId}` });
    return run.workflow.runId;
  }

  const api = {
    createIntent({ actor, projectId, commandId, action, risk = "medium", payload = {}, correlationId, idempotencyKey, executionMode = "approval", sourceRef = null, summary = null }) {
      editor(actor); id("projectId", projectId); id("commandId", commandId); id("correlationId", correlationId); id("idempotencyKey", idempotencyKey);
      if (!COMMAND_RISKS.includes(risk) || typeof action !== "string" || action.length < 3) throw new CommandCenterError("COMMAND_INVALID", "Action or risk is invalid.", 400);
      if (!["approval", "direct-if-policy"].includes(executionMode)) throw new CommandCenterError("EXECUTION_MODE_INVALID", "Execution mode is invalid.", 400);
      const policy = actionPolicy(action);
      if (riskRank(risk) < riskRank(policy.minRisk)) throw new CommandCenterError("COMMAND_RISK_UNDERSTATED", `${action} requires at least ${policy.minRisk} risk.`, 400, { riskFloor: policy.minRisk });
      safe(payload);
      if (sourceRef !== null) { if (typeof sourceRef !== "string" || !sourceRef.startsWith("hero://")) throw new CommandCenterError("SOURCE_INVALID", "Source must be an internal hero:// reference.", 400); const owner = sourceRef.match(PROJECT_REFERENCE)?.[1]; if (owner && owner !== projectId) throw new CommandCenterError("CROSS_PROJECT_SOURCE_REJECTED", "A command cannot cite another project's source.", 403); }
      if (intents.has(commandId)) { const prior = intents.get(commandId); if (prior.idempotencyKey === idempotencyKey) return prior; throw new CommandCenterError("COMMAND_IDEMPOTENCY_CONFLICT", "Command id already exists with different idempotency.", 409); }
      intents.set(commandId, copy({ commandId, projectId, action: action.slice(0, 160), category: policy.category, risk, payload: structuredClone(payload), correlationId, idempotencyKey, executionMode, sourceRef, summary: summary === null ? `${action} (${risk})` : String(summary).slice(0, 240), state: "draft", decisions: [], createdAt: now(), createdBy: actor.subject, revision: 0 }));
      return save(commandId, actor.subject);
    },
    /** BO-076: turn a project conversation message into a structured intent citing it. */
    createIntentFromMessage({ actor, projectId, conversationId, message, ...input }) {
      id("conversationId", conversationId);
      if (!message || typeof message.messageId !== "string" || typeof message.content !== "string") throw new CommandCenterError("MESSAGE_REQUIRED", "A conversation message is required.", 400);
      return api.createIntent({ actor, projectId, ...input, sourceRef: `hero://projects/${projectId}/conversations/${conversationId}/messages/${message.messageId}`, summary: message.content.trim().replace(/\s+/g, " ").slice(0, 240) });
    },
    commandCard({ actor, commandId }) { reader(actor); return card(get(commandId)); },
    /** Route guard: a command id from another project is reported as not found. */
    assertInProject({ commandId, projectId }) { const intent = intents.get(commandId); if (!intent || intent.projectId !== projectId) throw new CommandCenterError("COMMAND_NOT_FOUND", "Command was not found.", 404); return true; },
    authorize({ actor, commandId, authorizationSnapshotId }) {
      editor(actor); const intent = get(commandId); id("authorizationSnapshotId", authorizationSnapshotId);
      if (!["draft", "awaiting-approval", "approved", "blocked"].includes(entries.get(commandId)?.state ?? intent.state)) throw new CommandCenterError("DECISION_STATE_INVALID", "A queued or running command cannot be re-authorized.", 409);
      const snapshot = { policy: policySnapshot(intent.projectId), globalStop: Boolean(globalStop()), decidedAt: now() };
      const prior = intent.decision ?? null;
      const state = HIGH.has(intent.risk) ? "approval-required" : directAllowed(intent, snapshot.policy) ? "eligible-for-direct" : "approval-required";
      const decision = copy({ decisionId: `decision-${randomUUID()}`, commandId, projectId: intent.projectId, authorizationSnapshotId, version: (prior?.version ?? 0) + 1, supersedesDecisionId: prior?.decisionId ?? null, state, snapshot, decidedBy: actor.subject });
      // A still-valid human approval survives a re-decision only if the policy it was given under is unchanged.
      const keptApproval = state !== "eligible-for-direct" && intent.approval?.state === "approved" && Date.parse(intent.approval.expiresAt) > nowMs() && prior?.snapshot?.policy?.version === snapshot.policy.version ? intent.approval : null;
      update(commandId, { decision, decisions: [...intent.decisions, decision], state: state === "eligible-for-direct" || keptApproval ? "approved" : "awaiting-approval", approval: keptApproval });
      if (entries.get(commandId)?.state === "blocked") entries.delete(commandId);
      return save(commandId, actor.subject);
    },
    suggestApprovalTemplate({ actor, projectId, risk }) {
      editor(actor); id("projectId", projectId);
      if (!COMMAND_RISKS.includes(risk)) throw new CommandCenterError("RISK_INVALID", "Risk is invalid.", 400);
      const minutes = { low: 240, medium: 240, high: 60, critical: 15 }[risk];
      return copy({ templateId: `approval-${risk}-${projectId}`.slice(0, 120), projectId, name: `${risk} commands for ${projectId}`, allowedRisks: [risk], expiresInMinutes: minutes, state: "suggested", ownerOnly: risk === "critical" });
    },
    createApprovalTemplate({ actor, projectId, templateId, name, allowedRisks = ["low", "medium"], expiresInMinutes = 60, expectedVersion = null }) {
      editor(actor); id("projectId", projectId); id("templateId", templateId);
      if (!Array.isArray(allowedRisks) || allowedRisks.length === 0 || allowedRisks.some(item => !COMMAND_RISKS.includes(item)) || !Number.isInteger(expiresInMinutes) || expiresInMinutes < 1 || expiresInMinutes > 43_200) throw new CommandCenterError("APPROVAL_TEMPLATE_INVALID", "Approval template is invalid.", 400);
      const prior = templates.get(templateId);
      if (prior && prior.projectId !== projectId) throw new CommandCenterError("APPROVAL_TEMPLATE_SCOPE_INVALID", "A template cannot move between projects.", 409);
      if (expectedVersion !== null && expectedVersion !== (prior?.version ?? 0)) throw new CommandCenterError("STALE_TEMPLATE", "The template changed before this edit.", 409);
      if (allowedRisks.includes("critical")) owner(actor);
      const template = copy({ templateId, projectId, name: String(name).slice(0, 160), allowedRisks: [...new Set(allowedRisks)], expiresInMinutes, version: (prior?.version ?? 0) + 1, createdAt: now(), createdBy: actor.subject });
      templates.set(templateId, template); emit("template", `template:${templateId}`, template.version, projectId, "active", { template }, actor.subject);
      return template;
    },
    approve({ actor, commandId, templateId = null, reason: why = "approved" }) {
      editor(actor); const intent = get(commandId);
      if (intent.state !== "awaiting-approval") throw new CommandCenterError("APPROVAL_STATE_INVALID", "Command is not awaiting approval.", 409);
      if (intent.risk === "critical") owner(actor);
      const template = templateId ? templates.get(id("templateId", templateId)) : null;
      if (templateId && !template) throw new CommandCenterError("APPROVAL_TEMPLATE_NOT_FOUND", "Approval template was not found.", 404);
      if (template && (template.projectId !== intent.projectId || !template.allowedRisks.includes(intent.risk))) throw new CommandCenterError("APPROVAL_TEMPLATE_SCOPE_INVALID", "Template does not permit this command.", 409);
      const approval = copy({ approvalId: `approval-${randomUUID()}`, commandId, projectId: intent.projectId, state: "approved", templateId, templateVersion: template?.version ?? null, reason: String(why).slice(0, 500), approvedAt: now(), approvedBy: actor.subject, expiresAt: new Date(nowMs() + (template?.expiresInMinutes ?? 60) * 60_000).toISOString() });
      update(commandId, { state: "approved", approval });
      return save(commandId, actor.subject);
    },
    revokeApproval({ actor, commandId, reason: why }) {
      editor(actor); const intent = get(commandId);
      if (!intent.approval || intent.approval.state !== "approved") throw new CommandCenterError("APPROVAL_NOT_ACTIVE", "No active approval exists.", 409);
      if (entries.get(commandId)?.state === "running") throw new CommandCenterError("COMMAND_RUNNING", "Pause or complete the run before revoking.", 409);
      update(commandId, { approval: copy({ ...intent.approval, state: "revoked", revokedAt: now(), revokedBy: actor.subject, revokedReason: reason(why) }), state: "awaiting-approval" });
      if (entries.get(commandId)?.state === "queued") setEntry(commandId, { state: "blocked", blocker: { code: "APPROVAL_REVOKED", message: "The approval was revoked." } });
      return save(commandId, actor.subject);
    },
    preauthorizeProduction({ actor, projectId, preauthorizationId, changeType, validFrom, validUntil, artifactDigest, testEvidenceRef }) {
      owner(actor); id("projectId", projectId); id("preauthorizationId", preauthorizationId);
      if (!/^sha256:[a-f0-9]{64}$/.test(artifactDigest) || !String(testEvidenceRef).startsWith("hero://") || Number.isNaN(Date.parse(validFrom)) || Number.isNaN(Date.parse(validUntil)) || Date.parse(validUntil) <= Date.parse(validFrom)) throw new CommandCenterError("PRODUCTION_PREAUTH_INVALID", "Production preauthorization limits are invalid.", 400);
      if (Date.parse(validUntil) - Date.parse(validFrom) > 7 * 86_400_000) throw new CommandCenterError("PRODUCTION_PREAUTH_TOO_LONG", "A preauthorization window may not exceed seven days.", 400);
      const record = copy({ preauthorizationId, projectId, changeType: String(changeType).slice(0, 120), validFrom, validUntil, artifactDigest, testEvidenceRef, state: "recorded-not-a-deploy-grant", version: 1, createdAt: now(), createdBy: actor.subject });
      preauthorizations.set(preauthorizationId, record); emit("preauthorization", `preauth:${preauthorizationId}`, 1, projectId, record.state, { preauthorization: record }, actor.subject);
      return record;
    },
    revokePreauthorization({ actor, preauthorizationId, reason: why }) {
      owner(actor); const prior = preauthorizations.get(id("preauthorizationId", preauthorizationId));
      if (!prior || prior.state !== "recorded-not-a-deploy-grant") throw new CommandCenterError("PREAUTHORIZATION_NOT_ACTIVE", "Preauthorization is not active.", 409);
      const next = copy({ ...prior, state: "revoked", version: prior.version + 1, revokedAt: now(), revokedBy: actor.subject, revokedReason: reason(why) });
      preauthorizations.set(preauthorizationId, next); emit("preauthorization", `preauth:${preauthorizationId}`, next.version, prior.projectId, "revoked", { preauthorization: next }, actor.subject);
      return next;
    },
    matchPreauthorization,
    queue({ actor, commandId, heavy = false, resourceClaim = null, priority = 0 }) {
      editor(actor); const intent = get(commandId);
      if (globalStop()) throw new CommandCenterError("GLOBAL_STOP_ACTIVE", "Global Stop blocks new dispatch.", 409);
      if (intent.state !== "approved") throw new CommandCenterError("COMMAND_NOT_APPROVED", "Command must be approved before queueing.", 409);
      if (intent.approval && Date.parse(intent.approval.expiresAt) <= nowMs()) throw new CommandCenterError("APPROVAL_EXPIRED", "Approval expired before dispatch.", 409);
      if (!Number.isInteger(priority) || priority < -100 || priority > 100) throw new CommandCenterError("PRIORITY_INVALID", "Priority is invalid.", 400);
      if (priority > 0 && actor.role !== "project-owner") throw new CommandCenterError("OWNER_REQUIRED", "Only the owner may raise priority.", 403);
      if (resourceClaim !== null) id("resourceClaim", resourceClaim);
      const entry = setEntry(commandId, { commandId, projectId: intent.projectId, correlationId: intent.correlationId, state: "queued", heavy: Boolean(heavy), resourceClaim, priority, queuedAt: now(), queuedBy: actor.subject, attempts: 0, maxAttempts, checkpoint: null, blocker: null, notBefore: null });
      update(commandId, { state: "queued" }); save(commandId, actor.subject);
      return entry;
    },
    setPriority({ actor, commandId, priority }) {
      owner(actor); const entry = entries.get(id("commandId", commandId));
      if (!entry || entry.state !== "queued") throw new CommandCenterError("COMMAND_NOT_QUEUED", "Only a queued command can be re-prioritized.", 409);
      if (!Number.isInteger(priority) || priority < -100 || priority > 100) throw new CommandCenterError("PRIORITY_INVALID", "Priority is invalid.", 400);
      const next = setEntry(commandId, { priority }); save(commandId, actor.subject); return next;
    },
    setHeavyRunLimit({ actor, limit }) {
      owner(actor);
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new CommandCenterError("HEAVY_RUN_LIMIT_INVALID", "The heavy run limit must be 1..20.", 400);
      scheduler.heavyRunLimit = limit; scheduler.version += 1;
      emit("scheduler", "scheduler:global", scheduler.version, "hero-global", "active", { scheduler: { ...scheduler } }, actor.subject);
      return copy({ ...scheduler });
    },
    dispatchNext({ actor, projectId = null }) {
      editor(actor); if (projectId !== null) id("projectId", projectId);
      if (globalStop()) throw new CommandCenterError("GLOBAL_STOP_ACTIVE", "Global Stop blocks dispatch.", 409);
      const candidates = [...entries.values()].filter(item => item.state === "queued" && (projectId === null || item.projectId === projectId) && (!item.notBefore || Date.parse(item.notBefore) <= nowMs())).sort((a, b) => score(b) - score(a) || a.commandId.localeCompare(b.commandId));
      for (const candidate of candidates) {
        const blocker = dispatchBlocker(candidate);
        if (blocker) { setEntry(candidate.commandId, { state: "blocked", blocker }); update(candidate.commandId, { state: "blocked" }); save(candidate.commandId, actor.subject); continue; }
        if (candidate.heavy && activeHeavy() >= scheduler.heavyRunLimit) continue;
        const lock = candidate.resourceClaim ? locks.get(candidate.resourceClaim) : null;
        if (lock && lock !== candidate.commandId) continue;
        if (candidate.resourceClaim) locks.set(candidate.resourceClaim, candidate.commandId);
        const running = setEntry(candidate.commandId, { state: "running", startedAt: now(), attempts: candidate.attempts + 1, blocker: null, notBefore: null });
        const runId = startWorkflow(running, actor);
        setEntry(candidate.commandId, { runId }); update(candidate.commandId, { state: "running", runId });
        save(candidate.commandId, actor.subject);
        return copy({ entry: entries.get(candidate.commandId), runId });
      }
      return null;
    },
    checkpoint({ actor, commandId, checkpoint, reason: why = "checkpoint" }) {
      editor(actor); const entry = entries.get(id("commandId", commandId));
      if (!entry || entry.state !== "running") throw new CommandCenterError("RUN_NOT_ACTIVE", "No active run exists for command.", 404);
      safe(checkpoint, "checkpoint");
      if (entry.resourceClaim) locks.delete(entry.resourceClaim);
      const next = setEntry(commandId, { state: "paused", checkpoint: { value: structuredClone(checkpoint), reason: String(why).slice(0, 300), at: now() } });
      update(commandId, { state: "paused" }); save(commandId, actor.subject); return next;
    },
    resume({ actor, commandId }) {
      editor(actor); const entry = entries.get(id("commandId", commandId));
      if (!entry || !["paused", "interrupted"].includes(entry.state)) throw new CommandCenterError("RUN_NOT_PAUSED", "No paused or interrupted run exists for command.", 404);
      if (globalStop()) throw new CommandCenterError("GLOBAL_STOP_ACTIVE", "Global Stop blocks resume.", 409);
      const next = setEntry(commandId, { state: "queued", resumedAt: now(), resumedBy: actor.subject });
      update(commandId, { state: "queued" }); save(commandId, actor.subject); return next;
    },
    complete({ actor, commandId, outcome = "completed" }) {
      editor(actor); const entry = entries.get(id("commandId", commandId));
      if (entry?.state === "completed" && outcome === "completed") return entry;
      if (!entry || !["running", "paused"].includes(entry.state)) throw new CommandCenterError("RUN_NOT_ACTIVE", "No active run exists for command.", 404);
      if (outcome !== "completed") return api.fail({ actor, commandId, error: String(outcome) });
      if (entry.resourceClaim && locks.get(entry.resourceClaim) === commandId) locks.delete(entry.resourceClaim);
      const next = setEntry(commandId, { state: "completed", completedAt: now() });
      update(commandId, { state: "completed" }); save(commandId, actor.subject); return next;
    },
    /** BO-081: bounded retry with backoff; exhausted runs fail and require compensation if defined. */
    fail({ actor, commandId, error = "failed" }) {
      editor(actor); const entry = entries.get(id("commandId", commandId));
      if (!entry || !["running", "paused"].includes(entry.state)) throw new CommandCenterError("RUN_NOT_ACTIVE", "No active run exists for command.", 404);
      if (entry.resourceClaim && locks.get(entry.resourceClaim) === commandId) locks.delete(entry.resourceClaim);
      const intent = get(commandId); const policy = actionPolicy(intent.action);
      if (entry.attempts < entry.maxAttempts) {
        const next = setEntry(commandId, { state: "queued", lastError: String(error).slice(0, 300), notBefore: new Date(nowMs() + 2 ** entry.attempts * 60_000).toISOString() });
        update(commandId, { state: "queued" }); save(commandId, actor.subject); return next;
      }
      const next = setEntry(commandId, { state: "failed", lastError: String(error).slice(0, 300), failedAt: now(), compensation: policy.compensation ? { required: true, action: policy.compensation, state: "pending" } : null });
      update(commandId, { state: "failed" }); save(commandId, actor.subject); return next;
    },
    sweepTimeouts({ actor }) {
      editor(actor); const moment = nowMs(); const timedOut = [];
      for (const entry of [...entries.values()]) if (entry.state === "running" && moment - Date.parse(entry.startedAt) > timeoutMinutes * 60_000) timedOut.push(api.fail({ actor, commandId: entry.commandId, error: "timeout" }));
      return Object.freeze(timedOut);
    },
    /** Manual recovery for failed, blocked or interrupted runs. */
    recover({ actor, commandId, action, reason: why }) {
      editor(actor); const entry = entries.get(id("commandId", commandId)); const note = reason(why);
      if (!entry || !["failed", "blocked", "interrupted"].includes(entry.state)) throw new CommandCenterError("RECOVERY_NOT_APPLICABLE", "Only failed, blocked or interrupted runs can be recovered.", 409);
      if (action === "retry") {
        const intent = get(commandId);
        if (intent.approval?.state === "revoked" || !["queued", "running", "failed", "interrupted", "paused", "blocked"].includes(intent.state)) throw new CommandCenterError("COMMAND_NOT_APPROVED", "Re-authorize or re-approve before retrying.", 409);
        const next = setEntry(commandId, { state: "queued", attempts: 0, blocker: null, notBefore: null, recoveredAt: now(), recoveredBy: actor.subject, recoveryReason: note });
        update(commandId, { state: "queued" }); save(commandId, actor.subject); return next;
      }
      if (action === "abandon") { const next = setEntry(commandId, { state: "cancelled", recoveredAt: now(), recoveredBy: actor.subject, recoveryReason: note }); update(commandId, { state: "cancelled" }); save(commandId, actor.subject); return next; }
      if (action === "compensate") {
        if (!entry.compensation?.required) throw new CommandCenterError("COMPENSATION_NOT_DEFINED", "This command has no compensation step.", 409);
        const next = setEntry(commandId, { state: "compensated", compensation: { ...entry.compensation, state: "recorded", recordedAt: now(), recordedBy: actor.subject, reason: note } });
        update(commandId, { state: "compensated" }); save(commandId, actor.subject); return next;
      }
      throw new CommandCenterError("RECOVERY_ACTION_INVALID", "Recovery action must be retry, abandon or compensate.", 400);
    },
    operations({ actor, projectId }) {
      reader(actor); id("projectId", projectId);
      const scoped = [...entries.values()].filter(item => item.projectId === projectId);
      return copy({
        queue: scoped.filter(item => item.state === "queued").sort((a, b) => score(b) - score(a)).map(item => ({ ...item, card: card(get(item.commandId)) })),
        running: scoped.filter(item => item.state === "running").map(item => ({ ...item, card: card(get(item.commandId)) })),
        paused: scoped.filter(item => item.state === "paused"),
        interrupted: scoped.filter(item => item.state === "interrupted"),
        blocked: scoped.filter(item => item.state === "blocked").map(item => ({ ...item, card: card(get(item.commandId)) })),
        failed: scoped.filter(item => item.state === "failed"),
        completed: scoped.filter(item => ["completed", "compensated", "cancelled"].includes(item.state)),
        awaitingApproval: [...intents.values()].filter(item => item.projectId === projectId && item.state === "awaiting-approval").map(card),
        approvals: [...intents.values()].filter(item => item.projectId === projectId && item.approval).map(item => item.approval),
        templates: [...templates.values()].filter(item => item.projectId === projectId),
        preauthorizations: [...preauthorizations.values()].filter(item => item.projectId === projectId),
        locks: [...locks.entries()].filter(([, commandId]) => intents.get(commandId)?.projectId === projectId).map(([resourceClaim, commandId]) => ({ resourceClaim, commandId })),
        heavyRunLimit: scheduler.heavyRunLimit,
        activeHeavy: activeHeavy()
      });
    },
    purgeProject({ projectId }) {
      for (const [key, value] of intents) if (value.projectId === projectId) { intents.delete(key); entries.delete(key); }
      for (const [key, value] of templates) if (value.projectId === projectId) templates.delete(key);
      for (const [key, value] of preauthorizations) if (value.projectId === projectId) preauthorizations.delete(key);
      for (const [claim, commandId] of locks) if (!intents.has(commandId)) locks.delete(claim);
    },
    drainRecords() { return Object.freeze(outbox.splice(0, outbox.length)); },
    /** Replays one persisted record; newest version wins regardless of order. A run
     * that was running when the process stopped becomes `interrupted`. */
    hydrate(record) {
      if (!record || !COMMAND_RECORD_KINDS.includes(record.kind)) throw new CommandCenterError("INVALID_HYDRATION", "Command record is invalid.", 500);
      const seen = seenVersions.get(record.key) ?? 0; if (record.version < seen) return; seenVersions.set(record.key, record.version);
      const data = record.metadata ?? {};
      if (record.kind === "command") {
        intents.set(data.intent.commandId, copy(data.intent));
        if (data.entry) {
          const interrupted = data.entry.state === "running";
          entries.set(data.intent.commandId, copy(interrupted ? { ...data.entry, state: "interrupted", interruptedAt: record.recordedAt } : data.entry));
          if (interrupted) intents.set(data.intent.commandId, copy({ ...data.intent, state: "interrupted" }));
        } else entries.delete(data.intent.commandId);
      }
      if (record.kind === "template") templates.set(data.template.templateId, copy(data.template));
      if (record.kind === "preauthorization") preauthorizations.set(data.preauthorization.preauthorizationId, copy(data.preauthorization));
      if (record.kind === "scheduler") Object.assign(scheduler, data.scheduler);
    }
  };
  return Object.freeze(api);
}
