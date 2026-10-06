import { randomUUID } from "node:crypto";
import { INCIDENT_STORM_THRESHOLD, INCIDENT_WINDOW_MINUTES, NOTIFICATION_CATEGORIES, NOTIFICATION_RECORD_KINDS, NOTIFICATION_ROUTED_ACTIONS, NOTIFICATION_SEVERITIES, NOTIFICATION_SLA_MINUTES, NOTIFICATION_TRANSITIONS, severityRank } from "../../contracts/src/notification-observability.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/; const SECRET = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
function copy(value) { return deepFreeze(structuredClone(value)); }
function id(label, value) { if (typeof value !== "string" || !ID.test(value)) throw new NotificationError("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; }
function editor(actor) { if (!actor || !["project-owner", "admin"].includes(actor.role)) throw new NotificationError("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403); return actor; }
function reader(actor) { if (!actor || !["project-owner", "admin", "viewer"].includes(actor.role)) throw new NotificationError("PROJECT_READ_REQUIRED", "Project access is required.", 403); return actor; }
function redact(value) { if (Array.isArray(value)) return value.map(redact); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, SECRET.test(key) ? "[redacted]" : redact(child)])); }
const addMinutes = (iso, minutes) => minutes === null ? null : new Date(Date.parse(iso) + minutes * 60_000).toISOString();
export class NotificationError extends Error { constructor(code, message, statusCode = 409) { super(message); this.name = "NotificationError"; this.code = code; this.statusCode = statusCode; } }

/**
 * Back Office notifications, incidents, audit, traces and SLIs (WP-10).
 * A repeated key never creates a second notification while the first is
 * unresolved; related notifications join one incident per group window.
 */
export function createNotificationObservability({ now = () => new Date().toISOString() } = {}) {
  const notifications = new Map(); const dedup = new Map(); const incidents = new Map(); const audits = new Map(); const traces = new Map(); const sli = new Map();
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
    return copy({ ...item, effectiveState, due: deadlines, slaBreached: breached });
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
    createNotification({ actor, projectId, notificationId = `notification-${randomUUID()}`, category, severity = "info", title, ownerId = null, deduplicationKey, correlationId, groupKey = null, action = null, sourceRef = null }) {
      editor(actor); id("projectId", projectId); id("notificationId", notificationId); id("deduplicationKey", deduplicationKey); id("correlationId", correlationId);
      if (!NOTIFICATION_CATEGORIES.includes(category)) throw new NotificationError("NOTIFICATION_CATEGORY_INVALID", `Category must be one of ${NOTIFICATION_CATEGORIES.join(", ")}.`, 400);
      if (!NOTIFICATION_SEVERITIES.includes(severity) || typeof title !== "string" || title.trim().length < 3) throw new NotificationError("NOTIFICATION_INVALID", "Notification fields are invalid.", 400);
      if (ownerId !== null) id("ownerId", ownerId);
      if (severity === "critical" && !ownerId) throw new NotificationError("NOTIFICATION_OWNER_REQUIRED", "A critical notification needs an owner.", 400);
      if (groupKey !== null) id("groupKey", groupKey);
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
      const value = save({ notificationId, projectId, category, severity, title: title.trim().slice(0, 240), ownerId, state: "open", deduplicationKey, correlationId, groupKey: groupKey ?? correlationId, action: action ? redact(action) : null, sourceRef, occurrences: 1, reopenCount: 0, createdAt: now(), lastOpenedAt: now(), lastSeenAt: now(), createdBy: actor.subject, history: [] }, actor.subject);
      dedup.set(key, notificationId);
      joinIncident(value, actor.subject);
      return view(value);
    },
    inbox({ actor, projectId, view: filter = "all" }) {
      reader(actor); id("projectId", projectId);
      if (!["all", "open", "critical", "decision", "breached", "mine"].includes(filter)) throw new NotificationError("INBOX_VIEW_INVALID", "Inbox view is invalid.", 400);
      return Object.freeze([...notifications.values()].filter(item => item.projectId === projectId).map(view)
        .filter(item => item.effectiveState !== "snoozed" || filter === "all")
        .filter(item => filter === "all" || (filter === "open" && item.effectiveState !== "resolved") || (filter === "critical" && item.severity === "critical" && item.effectiveState !== "resolved") || (filter === "decision" && item.action && item.effectiveState !== "resolved") || (filter === "breached" && item.slaBreached) || (filter === "mine" && item.ownerId === actor.subject))
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || String(a.createdAt).localeCompare(String(b.createdAt))));
    },
    /** Lifecycle transitions; decision actions are recorded and routed, never executed here. */
    act({ actor, projectId, notificationId, action, reason = "", ownerId = null, minutes = 60 }) {
      editor(actor); const prior = get(projectId, notificationId); const current = view(prior).effectiveState;
      if (NOTIFICATION_ROUTED_ACTIONS.includes(action)) return save({ ...prior, lastAction: { action, routed: true, reason: String(reason).slice(0, 500), actor: actor.subject, at: now() }, history: [...prior.history, { action, at: now(), actor: actor.subject }] }, actor.subject);
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
    recordAudit({ actor, projectId, auditId = `audit-${randomUUID()}`, kind, outcome, correlationId, data = {}, classification = "internal" }) { editor(actor); id("projectId", projectId); id("auditId", auditId); id("correlationId", correlationId); const value = copy({ auditId, projectId, kind: String(kind).slice(0, 120), outcome: String(outcome).slice(0, 80), correlationId, classification, metadata: redact(data), recordedAt: now(), recordedBy: actor.subject }); audits.set(auditId, value); emit("audit", auditId, 1, projectId, { audit: value }, actor.subject); return value; },
    recordTrace({ actor, projectId, traceId, correlationId, kind, metadata = {} }) { editor(actor); id("projectId", projectId); id("traceId", traceId); id("correlationId", correlationId); const value = copy({ traceId, projectId, correlationId, kind: String(kind).slice(0, 80), metadata: redact(metadata), recordedAt: now(), recordedBy: actor.subject }); traces.set(traceId, value); emit("trace", traceId, 1, projectId, { trace: value }, actor.subject); return value; },
    audit({ actor, projectId, kind = null, limit = 100 }) { reader(actor); id("projectId", projectId); return Object.freeze([...audits.values()].filter(item => item.projectId === projectId && (!kind || item.kind === kind)).slice(-limit).map(copy)); },
    setSli({ actor, projectId, projection, lagSeconds, freshnessSeconds }) { editor(actor); id("projectId", projectId); id("projection", projection); if (!Number.isInteger(lagSeconds) || lagSeconds < 0 || !Number.isInteger(freshnessSeconds) || freshnessSeconds < 0) throw new NotificationError("SLI_INVALID", "SLI values are invalid.", 400); const key = `${projectId}:${projection}`; const value = copy({ projectId, projection, lagSeconds, freshnessSeconds, status: lagSeconds <= freshnessSeconds ? "within-slo" : "stale", version: (sli.get(key)?.version ?? 0) + 1, recordedAt: now(), recordedBy: actor.subject }); sli.set(key, value); emit("sli", key, value.version, projectId, { sli: value }, actor.subject); return value; },
    observability({ actor, projectId }) { reader(actor); id("projectId", projectId); return copy({ sli: [...sli.values()].filter(item => item.projectId === projectId), traceCount: [...traces.values()].filter(item => item.projectId === projectId).length, auditCount: [...audits.values()].filter(item => item.projectId === projectId).length, openIncidents: [...incidents.values()].filter(item => item.projectId === projectId && item.state === "open").length, retention: { audit: "configured-hook", trace: "bounded-metadata", export: "policy-required" } }); },
    purgeProject({ projectId }) {
      for (const map of [notifications, incidents, audits, traces, sli]) for (const [key, value] of map) if (value.projectId === projectId) map.delete(key);
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
    }
  };
  return Object.freeze(api);
}
