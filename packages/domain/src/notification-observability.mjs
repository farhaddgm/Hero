import { randomUUID } from "node:crypto";
import { AUDIT_STREAMS, CLASSIFICATION_READ, DATA_CLASSIFICATIONS, EXPORT_FORMATS, EXPORT_MAX_ROWS, HERO_SLOS, INBOX_LEGACY_VIEWS, INBOX_VIEWS, INCIDENT_STORM_THRESHOLD, INCIDENT_WINDOW_MINUTES, NOTIFICATION_ACTIONS, NOTIFICATION_CATEGORIES, NOTIFICATION_ORIGINS, NOTIFICATION_RECORD_KINDS, NOTIFICATION_ROUTED_ACTIONS, NOTIFICATION_SEVERITIES, NOTIFICATION_SLA_MINUTES, NOTIFICATION_TRANSITIONS, QUERY_MAX_PAGE, RETENTION_MAXIMUM_DAYS, RETENTION_MINIMUM_DAYS, SECRET_VALUE_PATTERN, SLI_STALE_AFTER_SECONDS, STREAM_DEFAULT_CLASSIFICATION, UPCOMING_WINDOW_MINUTES, severityRank } from "../../contracts/src/notification-observability.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/; const SECRET = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
function copy(value) { return deepFreeze(structuredClone(value)); }
function id(label, value) { if (typeof value !== "string" || !ID.test(value)) throw new NotificationError("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; }
function editor(actor) { if (!actor || !["project-owner", "admin"].includes(actor.role)) throw new NotificationError("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403); return actor; }
function owner(actor) { if (actor?.role !== "project-owner") throw new NotificationError("OWNER_REQUIRED", "Owner access is required.", 403); return actor; }
/** A cell that starts like a formula is neutralised so a spreadsheet never executes exported text. */
function csvCell(value) { let text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? ""); text = text.replace(/\r?\n/g, " "); if (/^[=+\-@\t]/.test(text)) text = `'${text}`; return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function reason(value) { const text = typeof value === "string" ? value.trim() : ""; if (text.length < 3) throw new NotificationError("REASON_REQUIRED", "A reason of at least 3 characters is required.", 400); return text.slice(0, 500); }
function reader(actor) { if (!actor || !["project-owner", "admin", "viewer"].includes(actor.role)) throw new NotificationError("PROJECT_READ_REQUIRED", "Project access is required.", 403); return actor; }
function redact(value) { if (Array.isArray(value)) return value.map(redact); if (typeof value === "string") return value.replace(SECRET_VALUE_PATTERN, "[redacted]"); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, SECRET.test(key) ? "[redacted]" : redact(child)])); }
const addMinutes = (iso, minutes) => minutes === null ? null : new Date(Date.parse(iso) + minutes * 60_000).toISOString();
export class NotificationError extends Error { constructor(code, message, statusCode = 409) { super(message); this.name = "NotificationError"; this.code = code; this.statusCode = statusCode; } }

/**
 * Back Office notifications, incidents, audit, traces and SLIs (WP-10).
 * A repeated key never creates a second notification while the first is
 * unresolved; related notifications join one incident per group window.
 */
export function createNotificationObservability({ now = () => new Date().toISOString() } = {}) {
  const notifications = new Map(); const dedup = new Map(); const incidents = new Map(); const audits = new Map(); const traces = new Map(); const sli = new Map(); const retention = new Map();
  const outbox = []; const seen = new Map();
  const nowMs = () => Date.parse(now());
  function emit(kind, key, version, projectId, payload, actorId) { outbox.push(copy({ kind, key, version, projectId, payload, actorId, recordedAt: now() })); }
  function save(item, actorId) { const next = copy({ ...item, version: (item.version ?? 0) + 1 }); notifications.set(next.notificationId, next); emit("notification", next.notificationId, next.version, next.projectId, { notification: next }, actorId); return next; }
  function saveIncident(item, actorId) { const next = copy({ ...item, version: (item.version ?? 0) + 1 }); incidents.set(next.incidentId, next); emit("incident", next.incidentId, next.version, next.projectId, { incident: next }, actorId); return next; }
  function due(item) { const sla = NOTIFICATION_SLA_MINUTES[item.severity]; return { acknowledgeBy: item.state === "open" ? addMinutes(item.lastOpenedAt ?? item.createdAt, sla.acknowledge) : null, resolveBy: item.state === "resolved" ? null : addMinutes(item.lastOpenedAt ?? item.createdAt, sla.resolve) }; }
  function view(item) {
    const moment = nowMs(); const deadlines = due(item);
    const snoozed = item.state === "snoozed" && item.snoozedUntil && Date.parse(item.snoozedUntil) > moment;
    const effectiveState = item.state === "snoozed" && !snoozed ? item.stateBeforeSnooze ?? "open" : item.state;
    const breached = [deadlines.acknowledgeBy, deadlines.resolveBy].some(value => value && Date.parse(value) < moment && effectiveState !== "resolved");
    const nextDeadline = [deadlines.acknowledgeBy, deadlines.resolveBy].filter(Boolean).sort()[0] ?? null;
    return copy({ ...item, origin: item.origin ?? "person", effectiveState, due: deadlines, nextDeadline: effectiveState === "resolved" ? null : nextDeadline, slaBreached: breached });
  }
  function joinIncident(item, actorId) {
    const groupKey = item.groupKey; const window = INCIDENT_WINDOW_MINUTES * 60_000; const moment = nowMs();
    let incident = [...incidents.values()].find(entry => entry.projectId === item.projectId && entry.groupKey === groupKey && entry.state === "open" && moment - Date.parse(entry.lastSeenAt) <= window);
    if (!incident) incident = { incidentId: `incident-${randomUUID()}`, projectId: item.projectId, groupKey, state: "open", severity: item.severity, notificationIds: [], occurrences: 0, firstSeenAt: now(), lastSeenAt: now(), storm: false };
    const ids = incident.notificationIds.includes(item.notificationId) ? incident.notificationIds : [...incident.notificationIds, item.notificationId];
    const occurrences = incident.occurrences + 1;
    return saveIncident({ ...incident, notificationIds: ids, occurrences, severity: severityRank(item.severity) > severityRank(incident.severity) ? item.severity : incident.severity, lastSeenAt: now(), storm: incident.storm || occurrences >= INCIDENT_STORM_THRESHOLD }, actorId);
  }
  function settleIncidents(projectId, actorId) {
    for (const incident of [...incidents.values()].filter(entry => entry.projectId === projectId && entry.state === "open")) {
      if (incident.notificationIds.every(notificationId => notifications.get(notificationId)?.state === "resolved")) saveIncident({ ...incident, state: "resolved", resolvedAt: now() }, actorId);
    }
  }
  function get(projectId, notificationId) { const item = notifications.get(id("notificationId", notificationId)); if (!item || item.projectId !== projectId) throw new NotificationError("NOTIFICATION_NOT_FOUND", "Notification was not found.", 404); return item; }

  const api = {
    /** BO-111/112: create, or fold into the unresolved notification with the same key. */
    createNotification({ actor, projectId, notificationId = `notification-${randomUUID()}`, category, severity = "info", title, ownerId = null, deduplicationKey, correlationId, groupKey = null, action = null, sourceRef = null, origin = null }) {
      editor(actor); id("projectId", projectId); id("notificationId", notificationId); id("deduplicationKey", deduplicationKey); id("correlationId", correlationId);
      if (!NOTIFICATION_CATEGORIES.includes(category)) throw new NotificationError("NOTIFICATION_CATEGORY_INVALID", `Category must be one of ${NOTIFICATION_CATEGORIES.join(", ")}.`, 400);
      if (!NOTIFICATION_SEVERITIES.includes(severity) || typeof title !== "string" || title.trim().length < 3) throw new NotificationError("NOTIFICATION_INVALID", "Notification fields are invalid.", 400);
      if (ownerId !== null) id("ownerId", ownerId);
      if (severity === "critical" && !ownerId) throw new NotificationError("NOTIFICATION_OWNER_REQUIRED", "A critical notification needs an owner.", 400);
      if (groupKey !== null) id("groupKey", groupKey);
      const resolvedOrigin = origin ?? (actor.subject === "hero-system" ? "automation" : "person");
      if (!NOTIFICATION_ORIGINS.includes(resolvedOrigin)) throw new NotificationError("NOTIFICATION_ORIGIN_INVALID", "Origin must be person or automation.", 400);
      if (sourceRef !== null && (typeof sourceRef !== "string" || !sourceRef.startsWith("hero://"))) throw new NotificationError("NOTIFICATION_SOURCE_INVALID", "Source must be an internal hero:// reference.", 400);
      const key = `${projectId}:${deduplicationKey}`; const currentId = dedup.get(key);
      if (currentId) {
        const prior = notifications.get(currentId);
        const reopened = prior.state === "resolved";
        const next = save({ ...prior, occurrences: prior.occurrences + 1, lastSeenAt: now(), severity: severityRank(severity) > severityRank(prior.severity) ? severity : prior.severity, ownerId: prior.ownerId ?? ownerId, ...(reopened ? { state: "open", reopenCount: (prior.reopenCount ?? 0) + 1, lastOpenedAt: now(), resolvedAt: null } : {}) }, actor.subject);
        joinIncident(next, actor.subject);
        return copy({ ...view(next), deduplicated: true, reopened });
      }
      if (notifications.has(notificationId)) throw new NotificationError("NOTIFICATION_ID_REUSED", "notificationId already exists.", 409);
      const value = save({ notificationId, projectId, category, severity, title: redact(title.trim().slice(0, 240)), ownerId, state: "open", deduplicationKey, correlationId, groupKey: groupKey ?? correlationId, action: action ? redact(action) : null, sourceRef, origin: resolvedOrigin, occurrences: 1, reopenCount: 0, createdAt: now(), lastOpenedAt: now(), lastSeenAt: now(), createdBy: actor.subject, history: [] }, actor.subject);
      dedup.set(key, notificationId);
      joinIncident(value, actor.subject);
      return view(value);
    },
    /** BO-113: Needs my decision, Critical, Upcoming, Automation and Resolved, plus the legacy filters. */
    inbox({ actor, projectId, view: filter = "all" }) {
      reader(actor); id("projectId", projectId);
      if (![...INBOX_VIEWS, ...INBOX_LEGACY_VIEWS].includes(filter)) throw new NotificationError("INBOX_VIEW_INVALID", "Inbox view is invalid.", 400);
      const moment = nowMs(); const editorRole = ["project-owner", "admin"].includes(actor.role); const unresolved = item => item.effectiveState !== "resolved";
      const isDecision = item => Boolean(item.action) && NOTIFICATION_ROUTED_ACTIONS.some(name => api.actionsFor(item).includes(name));
      const rows = [...notifications.values()].filter(item => item.projectId === projectId).map(view);
      const pick = {
        "needs-decision": item => editorRole && unresolved(item) && isDecision(item) && (!item.ownerId || item.ownerId === actor.subject || actor.role === "project-owner"),
        critical: item => item.severity === "critical" && unresolved(item),
        upcoming: item => unresolved(item) && !item.slaBreached && item.nextDeadline && Date.parse(item.nextDeadline) - moment <= UPCOMING_WINDOW_MINUTES * 60_000,
        automation: item => item.origin === "automation" && unresolved(item),
        resolved: item => item.effectiveState === "resolved",
        all: () => true,
        open: unresolved,
        decision: item => item.action && unresolved(item),
        breached: item => item.slaBreached,
        mine: item => item.ownerId === actor.subject
      }[filter];
      const visible = rows.filter(item => item.effectiveState !== "snoozed" || filter === "all" || filter === "resolved").filter(pick);
      const bySeverity = (a, b) => severityRank(b.severity) - severityRank(a.severity) || String(a.createdAt).localeCompare(String(b.createdAt));
      return Object.freeze(visible.sort(filter === "upcoming" ? (a, b) => String(a.nextDeadline).localeCompare(String(b.nextDeadline)) : filter === "resolved" ? (a, b) => String(b.resolvedAt).localeCompare(String(a.resolvedAt)) : bySeverity));
    },
    /** BO-113: the number on every tab equals the length of its list. */
    inboxCounts({ actor, projectId }) { return Object.freeze(Object.fromEntries(INBOX_VIEWS.map(name => [name, api.inbox({ actor, projectId, view: name }).length]))); },
    read({ actor, projectId, notificationId }) { reader(actor); return view(get(projectId, notificationId)); },
    /** BO-114: which of approve / reject / snooze / assign / chat / run-fix this notification can really offer. */
    actionsFor(item) {
      const offered = []; const descriptor = item.action ?? {}; const open = (item.effectiveState ?? item.state) !== "resolved";
      if (open && descriptor.commandId) offered.push("approve", "reject");
      if (open && descriptor.fix) offered.push("run-fix");
      if (open) offered.push("snooze", "assign");
      offered.push("chat");
      return Object.freeze(offered);
    },
    /** Lifecycle transitions; decision actions are recorded and routed, never executed here. */
    act({ actor, projectId, notificationId, action, reason = "", ownerId = null, minutes = 60 }) {
      editor(actor); const prior = get(projectId, notificationId); const current = view(prior).effectiveState;
      if (NOTIFICATION_ROUTED_ACTIONS.includes(action)) {
        if (!api.actionsFor({ ...prior, effectiveState: current }).includes(action)) throw new NotificationError("NOTIFICATION_ACTION_UNAVAILABLE", `${action} is not available for this notification.`, 409);
        const route = { approve: { kind: "command-approval", commandId: prior.action?.commandId }, reject: { kind: "command-rejection", commandId: prior.action?.commandId }, "run-fix": { kind: "fix-command", fix: prior.action?.fix }, chat: { kind: "conversation", sourceRef: `hero://projects/${projectId}/notifications/${prior.notificationId}` } }[action];
        const decided = action === "approve" || action === "reject";
        const next = save({ ...prior, ...(decided ? { state: "resolved", resolvedAt: now(), resolvedBy: actor.subject, resolution: action } : {}), lastAction: { action, routed: true, route, reason: String(reason).slice(0, 500), actor: actor.subject, at: now() }, history: [...prior.history, { action, from: current, at: now(), actor: actor.subject }] }, actor.subject);
        if (decided) settleIncidents(projectId, actor.subject);
        return view(next);
      }
      if (!NOTIFICATION_TRANSITIONS[current]?.includes(action)) throw new NotificationError(Object.values(NOTIFICATION_TRANSITIONS).some(list => list.includes(action)) ? "NOTIFICATION_TRANSITION_INVALID" : "NOTIFICATION_ACTION_INVALID", `${action} is not allowed from ${current}.`, 409);
      const patch = { lastAction: { action, reason: String(reason).slice(0, 500), actor: actor.subject, at: now() }, history: [...prior.history, { action, from: current, at: now(), actor: actor.subject }] };
      if (action === "acknowledge") Object.assign(patch, { state: "acknowledged", acknowledgedAt: now(), acknowledgedBy: actor.subject });
      if (action === "snooze") { if (!Number.isInteger(minutes) || minutes < 5 || minutes > 7 * 24 * 60) throw new NotificationError("SNOOZE_INVALID", "Snooze must be 5 minutes to 7 days.", 400); if (prior.severity === "critical" && minutes > 60) throw new NotificationError("SNOOZE_TOO_LONG", "A critical notification can be snoozed for at most 60 minutes.", 409); Object.assign(patch, { state: "snoozed", stateBeforeSnooze: current, snoozedUntil: addMinutes(now(), minutes) }); }
      if (action === "assign") Object.assign(patch, { ownerId: id("ownerId", ownerId) });
      if (action === "resolve") { if (String(reason).trim().length < 3) throw new NotificationError("REASON_REQUIRED", "Resolving needs a reason.", 400); Object.assign(patch, { state: "resolved", resolvedAt: now(), resolvedBy: actor.subject }); }
      if (action === "reopen") Object.assign(patch, { state: "open", reopenCount: (prior.reopenCount ?? 0) + 1, lastOpenedAt: now(), resolvedAt: null });
      const next = save({ ...prior, ...patch }, actor.subject);
      settleIncidents(projectId, actor.subject);
      return view(next);
    },
    incidents({ actor, projectId, state = null }) {
      reader(actor); id("projectId", projectId);
      return Object.freeze([...incidents.values()].filter(item => item.projectId === projectId && (!state || item.state === state)).sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || String(b.lastSeenAt).localeCompare(String(a.lastSeenAt))).map(copy));
    },
    /** BO-116/BO-117: an audit record belongs to the activity or security stream and carries a classification. */
    recordAudit({ actor, projectId, auditId = `audit-${randomUUID()}`, kind, outcome, correlationId, data = {}, classification = null, stream = "activity" }) {
      editor(actor); id("projectId", projectId); id("auditId", auditId); id("correlationId", correlationId);
      if (!AUDIT_STREAMS.includes(stream)) throw new NotificationError("AUDIT_STREAM_INVALID", "Stream must be activity or security.", 400);
      const level = classification ?? STREAM_DEFAULT_CLASSIFICATION[stream];
      if (!DATA_CLASSIFICATIONS.includes(level)) throw new NotificationError("CLASSIFICATION_INVALID", "Classification is invalid.", 400);
      if (stream === "security" && level === "public") throw new NotificationError("CLASSIFICATION_TOO_LOW", "A security record cannot be public.", 400);
      if (audits.has(auditId)) throw new NotificationError("AUDIT_IMMUTABLE", "An audit record cannot be rewritten.", 409);
      const value = copy({ auditId, projectId, stream, kind: String(kind).slice(0, 120), outcome: String(outcome).slice(0, 80), correlationId, classification: level, metadata: redact(data), recordedAt: now(), recordedBy: actor.subject });
      audits.set(auditId, value); emit("audit", auditId, 1, projectId, { audit: value }, actor.subject); return value;
    },
    recordTrace({ actor, projectId, traceId, correlationId, kind, metadata = {}, parentTraceId = null }) {
      editor(actor); id("projectId", projectId); id("traceId", traceId); id("correlationId", correlationId); if (parentTraceId !== null) id("parentTraceId", parentTraceId);
      if (traces.has(traceId)) throw new NotificationError("TRACE_IMMUTABLE", "A trace record cannot be rewritten.", 409);
      const value = copy({ traceId, projectId, correlationId, parentTraceId, kind: String(kind).slice(0, 80), metadata: redact(metadata), recordedAt: now(), recordedBy: actor.subject }); traces.set(traceId, value); emit("trace", traceId, 1, projectId, { trace: value }, actor.subject); return value;
    },
    /** BO-118: filtered, paginated, classification-aware query. A viewer never receives a security record. */
    queryAudit({ actor, projectId, stream = null, kind = null, outcome = null, correlationId = null, from = null, to = null, limit = 50, cursor = null }) {
      reader(actor); id("projectId", projectId);
      if (stream !== null && !AUDIT_STREAMS.includes(stream)) throw new NotificationError("AUDIT_STREAM_INVALID", "Stream must be activity or security.", 400);
      if (stream === "security" && !["project-owner", "admin"].includes(actor.role)) throw new NotificationError("SECURITY_AUDIT_FORBIDDEN", "The security audit is for owners and admins.", 403);
      const fromMs = from ? Date.parse(from) : -Infinity; const toMs = to ? Date.parse(to) : Infinity;
      if (Number.isNaN(fromMs) || Number.isNaN(toMs)) throw new NotificationError("AUDIT_PERIOD_INVALID", "The period is invalid.", 400);
      if (!Number.isInteger(limit) || limit < 1 || limit > QUERY_MAX_PAGE) throw new NotificationError("AUDIT_LIMIT_INVALID", `limit must be 1..${QUERY_MAX_PAGE}.`, 400);
      const offset = cursor === null ? 0 : Number(cursor); if (!Number.isInteger(offset) || offset < 0) throw new NotificationError("AUDIT_CURSOR_INVALID", "The cursor is invalid.", 400);
      const allowed = CLASSIFICATION_READ[actor.role];
      const matching = [...audits.values()].filter(item => item.projectId === projectId && allowed.includes(item.classification) && (item.stream !== "security" || ["project-owner", "admin"].includes(actor.role)) && (!stream || item.stream === stream) && (!kind || item.kind === kind) && (!outcome || item.outcome === outcome) && (!correlationId || item.correlationId === correlationId) && Date.parse(item.recordedAt) >= fromMs && Date.parse(item.recordedAt) <= toMs)
        .sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)) || b.auditId.localeCompare(a.auditId));
      const records = matching.slice(offset, offset + limit).map(copy);
      return copy({ records, total: matching.length, nextCursor: offset + limit < matching.length ? String(offset + limit) : null });
    },
    audit({ actor, projectId, kind = null, limit = 100 }) { return Object.freeze(api.queryAudit({ actor, projectId, kind, limit: Math.min(limit, QUERY_MAX_PAGE) }).records.slice().reverse()); },
    securityAudit({ actor, projectId, ...filters }) { return api.queryAudit({ actor, projectId, ...filters, stream: "security" }); },
    /** BO-116: human-readable history — notifications and their actions plus activity records, never security records or traces. */
    timeline({ actor, projectId, correlationId = null, limit = 50 }) {
      reader(actor); id("projectId", projectId); const allowed = CLASSIFICATION_READ[actor.role]; const entries = [];
      for (const item of notifications.values()) {
        if (item.projectId !== projectId || (correlationId && item.correlationId !== correlationId)) continue;
        entries.push({ at: item.createdAt, source: "notification", kind: "notification.created", correlationId: item.correlationId, summary: item.title, severity: item.severity, ref: item.notificationId });
        for (const step of item.history ?? []) entries.push({ at: step.at, source: "notification", kind: `notification.${step.action}`, correlationId: item.correlationId, summary: `${step.action}: ${item.title}`, actor: step.actor, ref: item.notificationId });
      }
      for (const item of audits.values()) if (item.projectId === projectId && item.stream === "activity" && allowed.includes(item.classification) && (!correlationId || item.correlationId === correlationId)) entries.push({ at: item.recordedAt, source: "activity", kind: item.kind, correlationId: item.correlationId, summary: `${item.kind} → ${item.outcome}`, actor: item.recordedBy, ref: item.auditId });
      return copy(entries.sort((a, b) => String(b.at).localeCompare(String(a.at)) || String(a.ref).localeCompare(String(b.ref))).slice(0, Math.min(Math.max(1, limit), QUERY_MAX_PAGE)));
    },
    /** BO-115/BO-116: execution detail for one correlation, in causal order. */
    executionTrace({ actor, projectId, correlationId }) {
      reader(actor); id("projectId", projectId); id("correlationId", correlationId);
      return copy([...traces.values()].filter(item => item.projectId === projectId && item.correlationId === correlationId).sort((a, b) => String(a.recordedAt).localeCompare(String(b.recordedAt)) || a.traceId.localeCompare(b.traceId)));
    },
    /** BO-115/BO-120: which correlations have at least one trace; the rest are reported as missing. */
    traceCoverage({ actor, projectId, correlationIds }) {
      reader(actor); id("projectId", projectId);
      if (!Array.isArray(correlationIds)) throw new NotificationError("COVERAGE_INPUT_INVALID", "correlationIds must be an array.", 400);
      const traced = new Set([...traces.values()].filter(item => item.projectId === projectId).map(item => item.correlationId));
      const unique = [...new Set(correlationIds)].sort();
      return copy({ checked: unique.length, traced: unique.filter(item => traced.has(item)), missing: unique.filter(item => !traced.has(item)) });
    },
    correlation({ actor, projectId, correlationId }) {
      reader(actor); id("projectId", projectId); id("correlationId", correlationId);
      const related = [...notifications.values()].filter(item => item.projectId === projectId && item.correlationId === correlationId).map(view);
      const ids = new Set(related.map(item => item.notificationId));
      return copy({ correlationId, notifications: related, incidents: [...incidents.values()].filter(item => item.projectId === projectId && item.notificationIds.some(entry => ids.has(entry))), timeline: api.timeline({ actor, projectId, correlationId }), traces: api.executionTrace({ actor, projectId, correlationId }), audits: api.queryAudit({ actor, projectId, correlationId, stream: "activity", limit: QUERY_MAX_PAGE }).records });
    },
    /** BO-118: export is an owner decision with a reason; the export itself is written to the security audit. */
    exportAudit({ actor, projectId, stream = "activity", format = "json", reason: why, from = null, to = null, kind = null, correlationId = null }) {
      owner(actor); const note = reason(why);
      if (!EXPORT_FORMATS.includes(format)) throw new NotificationError("EXPORT_FORMAT_INVALID", `Format must be one of ${EXPORT_FORMATS.join(", ")}.`, 400);
      const result = api.queryAudit({ actor, projectId, stream, kind, correlationId, from, to, limit: QUERY_MAX_PAGE }); let records = result.records; let cursor = result.nextCursor;
      while (cursor !== null && records.length < EXPORT_MAX_ROWS) { const page = api.queryAudit({ actor, projectId, stream, kind, correlationId, from, to, limit: QUERY_MAX_PAGE, cursor }); records = [...records, ...page.records]; cursor = page.nextCursor; }
      const truncated = records.length > EXPORT_MAX_ROWS || cursor !== null; records = records.slice(0, EXPORT_MAX_ROWS);
      const columns = ["auditId", "stream", "kind", "outcome", "classification", "correlationId", "recordedAt", "recordedBy", "metadata"];
      const content = format === "json" ? JSON.stringify(records.map(item => redact(item)), null, 2) : [columns.join(","), ...records.map(item => columns.map(column => csvCell(redact(item[column]))).join(","))].join("\n");
      api.recordAudit({ actor, projectId, stream: "security", kind: "audit.export", outcome: "exported", correlationId: `export-${randomUUID()}`.slice(0, 60), data: { stream, format, rows: records.length, truncated, reason: note, kindFilter: kind } });
      return copy({ stream, format, rowCount: records.length, truncated, maxRows: EXPORT_MAX_ROWS, content });
    },
    /** BO-118: retention hook. The minimums cannot be lowered and nothing is ever deleted; the plan only lists what is past its window. */
    setRetention({ actor, projectId, stream, days, reason: why }) {
      owner(actor); id("projectId", projectId); const note = reason(why);
      if (!RETENTION_MINIMUM_DAYS[stream]) throw new NotificationError("RETENTION_STREAM_INVALID", "Stream must be activity, security or trace.", 400);
      if (!Number.isInteger(days) || days < RETENTION_MINIMUM_DAYS[stream]) throw new NotificationError("RETENTION_BELOW_MINIMUM", `${stream} must be kept at least ${RETENTION_MINIMUM_DAYS[stream]} days.`, 409, { minimumDays: RETENTION_MINIMUM_DAYS[stream] });
      if (days > RETENTION_MAXIMUM_DAYS) throw new NotificationError("RETENTION_TOO_LONG", `Retention may not exceed ${RETENTION_MAXIMUM_DAYS} days.`, 400);
      const key = `${projectId}:${stream}`; const prior = retention.get(key);
      const value = copy({ projectId, stream, days, reason: note, version: (prior?.version ?? 0) + 1, recordedAt: now(), recordedBy: actor.subject });
      retention.set(key, value); emit("retention", key, value.version, projectId, { retention: value }, actor.subject); return value;
    },
    retentionPlan({ actor, projectId }) {
      reader(actor); id("projectId", projectId); const moment = nowMs();
      const policy = stream => retention.get(`${projectId}:${stream}`)?.days ?? RETENTION_MINIMUM_DAYS[stream];
      const expired = (map, stream, field = "recordedAt") => [...map.values()].filter(item => item.projectId === projectId && (item.stream ?? stream) === stream && moment - Date.parse(item[field]) > policy(stream) * 86_400_000).length;
      return copy({ projectId, mode: "dry-run", deletion: "none", policies: Object.fromEntries(Object.keys(RETENTION_MINIMUM_DAYS).map(stream => [stream, { days: policy(stream), minimumDays: RETENTION_MINIMUM_DAYS[stream], custom: retention.has(`${projectId}:${stream}`) }])), pastRetention: { activity: expired(audits, "activity"), security: expired(audits, "security"), trace: expired(traces, "trace") } });
    },
    setSli({ actor, projectId, projection, lagSeconds, freshnessSeconds }) { editor(actor); id("projectId", projectId); id("projection", projection); if (!Number.isInteger(lagSeconds) || lagSeconds < 0 || !Number.isInteger(freshnessSeconds) || freshnessSeconds < 0) throw new NotificationError("SLI_INVALID", "SLI values are invalid.", 400); const key = `${projectId}:${projection}`; const value = copy({ projectId, projection, lagSeconds, freshnessSeconds, status: lagSeconds <= freshnessSeconds ? "within-slo" : "stale", version: (sli.get(key)?.version ?? 0) + 1, recordedAt: now(), recordedBy: actor.subject }); sli.set(key, value); emit("sli", key, value.version, projectId, { sli: value }, actor.subject); return value; },
    /** BO-119: Hero's own SLOs. A projection with no recent measurement is reported, never assumed healthy. */
    sloReport({ actor, projectId }) {
      reader(actor); id("projectId", projectId); const moment = nowMs();
      const rows = Object.entries(HERO_SLOS).map(([projection, slo]) => {
        const measured = sli.get(`${projectId}:${projection}`);
        if (!measured) return { projection, label: slo.label, objectiveSeconds: slo.objectiveSeconds, status: "no-data", lagSeconds: null, measuredAt: null };
        const ageSeconds = Math.round((moment - Date.parse(measured.recordedAt)) / 1000);
        const status = ageSeconds > SLI_STALE_AFTER_SECONDS ? "measurement-stale" : measured.lagSeconds > Math.min(slo.objectiveSeconds, measured.freshnessSeconds) ? "breached" : "meeting";
        return { projection, label: slo.label, objectiveSeconds: slo.objectiveSeconds, status, lagSeconds: measured.lagSeconds, freshnessSeconds: measured.freshnessSeconds, measuredAt: measured.recordedAt, measurementAgeSeconds: ageSeconds };
      });
      return copy({ projectId, slos: rows, meeting: rows.filter(row => row.status === "meeting").length, total: rows.length, healthy: rows.every(row => row.status === "meeting") });
    },
    observability({ actor, projectId }) { reader(actor); id("projectId", projectId); const allowed = CLASSIFICATION_READ[actor.role]; return copy({ sli: [...sli.values()].filter(item => item.projectId === projectId), traceCount: [...traces.values()].filter(item => item.projectId === projectId).length, auditCount: [...audits.values()].filter(item => item.projectId === projectId && allowed.includes(item.classification) && (item.stream !== "security" || ["project-owner", "admin"].includes(actor.role))).length, openIncidents: [...incidents.values()].filter(item => item.projectId === projectId && item.state === "open").length, retention: api.retentionPlan({ actor, projectId }).policies }); },
    purgeProject({ projectId }) {
      for (const map of [notifications, incidents, audits, traces, sli, retention]) for (const [key, value] of map) if (value.projectId === projectId) map.delete(key);
      for (const key of [...dedup.keys()]) if (key.startsWith(`${projectId}:`)) dedup.delete(key);
    },
    drainRecords() { return Object.freeze(outbox.splice(0, outbox.length)); },
    hydrate(record) {
      if (!record || !NOTIFICATION_RECORD_KINDS.includes(record.kind)) throw new NotificationError("INVALID_HYDRATION", "Notification record is invalid.", 500);
      const key = `${record.kind}:${record.key}`; if ((seen.get(key) ?? 0) > record.version) return; seen.set(key, record.version);
      const data = record.payload ?? {};
      if (record.kind === "notification") { notifications.set(record.key, copy(data.notification)); dedup.set(`${data.notification.projectId}:${data.notification.deduplicationKey}`, record.key); }
      if (record.kind === "incident") incidents.set(record.key, copy(data.incident));
      if (record.kind === "audit") audits.set(record.key, copy(data.audit));
      if (record.kind === "trace") traces.set(record.key, copy(data.trace));
      if (record.kind === "sli") sli.set(record.key, copy(data.sli));
      if (record.kind === "retention") retention.set(record.key, copy(data.retention));
    }
  };
  return Object.freeze(api);
}
