export const NOTIFICATION_OBSERVABILITY_CONTRACT_VERSION = "1.2";
/** BO-111: notification taxonomy, severity, SLA, ownership and lifecycle. */
export const NOTIFICATION_CATEGORIES = Object.freeze(["approval", "budget", "health", "quality", "security", "delivery", "system", "collaboration", "catalog"]);
export const NOTIFICATION_SEVERITIES = Object.freeze(["info", "warning", "critical"]);
export const NOTIFICATION_STATES = Object.freeze(["open", "acknowledged", "snoozed", "resolved"]);
/** Minutes until acknowledgement / resolution is due; null means no SLA. */
export const NOTIFICATION_SLA_MINUTES = Object.freeze({
  info: Object.freeze({ acknowledge: null, resolve: null }),
  warning: Object.freeze({ acknowledge: 240, resolve: 1440 }),
  critical: Object.freeze({ acknowledge: 15, resolve: 240 })
});
export const NOTIFICATION_TRANSITIONS = Object.freeze({
  open: Object.freeze(["acknowledge", "snooze", "assign", "resolve"]),
  acknowledged: Object.freeze(["snooze", "assign", "resolve"]),
  snoozed: Object.freeze(["acknowledge", "assign", "resolve"]),
  resolved: Object.freeze(["reopen"])
});
/** Decision actions are routed to their own gated surface; the inbox never executes them. */
export const NOTIFICATION_ROUTED_ACTIONS = Object.freeze(["approve", "reject", "chat", "run-fix"]);
/** BO-112: deduplication and incident grouping. */
export const INCIDENT_WINDOW_MINUTES = 30;
export const INCIDENT_STORM_THRESHOLD = 20;
export const NOTIFICATION_RECORD_KINDS = Object.freeze(["notification", "incident", "audit", "trace", "sli", "retention"]);

/** BO-113: the five Inbox views. Legacy filters stay available. */
export const INBOX_VIEWS = Object.freeze(["needs-decision", "critical", "upcoming", "automation", "resolved"]);
export const INBOX_LEGACY_VIEWS = Object.freeze(["all", "open", "decision", "breached", "mine"]);
export const NOTIFICATION_ORIGINS = Object.freeze(["person", "automation"]);
export const UPCOMING_WINDOW_MINUTES = 240;
/** BO-114: actions an Inbox card may offer. approve/reject/run-fix are routed to their own gated surface. */
export const NOTIFICATION_ACTIONS = Object.freeze(["approve", "reject", "snooze", "assign", "chat", "run-fix"]);

/** BO-116: three separate record families. Activity is human-readable history, security is the audit of sensitive operations, trace is execution detail. */
export const AUDIT_STREAMS = Object.freeze(["activity", "security"]);
/** BO-117: data classification decides who may read a record. */
export const DATA_CLASSIFICATIONS = Object.freeze(["public", "internal", "confidential", "restricted"]);
export const CLASSIFICATION_READ = Object.freeze({
  viewer: Object.freeze(["public", "internal"]),
  admin: Object.freeze(["public", "internal", "confidential"]),
  "project-owner": Object.freeze(["public", "internal", "confidential", "restricted"])
});
export const STREAM_DEFAULT_CLASSIFICATION = Object.freeze({ activity: "internal", security: "confidential" });
export const SECRET_VALUE_PATTERN = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bghp_[A-Za-z0-9]{20,}\b|\bAKIA[0-9A-Z]{16}\b)/g;

/** BO-118: query, export policy and retention hook. Retention minimums cannot be weakened. */
export const RETENTION_MINIMUM_DAYS = Object.freeze({ activity: 30, security: 365, trace: 14 });
export const RETENTION_MAXIMUM_DAYS = 3650;
export const EXPORT_MAX_ROWS = 1000;
export const EXPORT_FORMATS = Object.freeze(["json", "csv"]);
export const QUERY_MAX_PAGE = 200;

/** BO-119: Hero's own SLOs for projection freshness. A measurement older than the stale window counts as missing. */
export const HERO_SLOS = Object.freeze({
  portfolio: Object.freeze({ objectiveSeconds: 60, label: "Portfolio read model" }),
  "command-board": Object.freeze({ objectiveSeconds: 30, label: "Command board" }),
  catalog: Object.freeze({ objectiveSeconds: 120, label: "System catalog" }),
  ledger: Object.freeze({ objectiveSeconds: 60, label: "Token ledger" }),
  notifications: Object.freeze({ objectiveSeconds: 30, label: "Notification inbox" })
});
export const SLI_STALE_AFTER_SECONDS = 900;

export function severityRank(severity) { return NOTIFICATION_SEVERITIES.indexOf(severity); }

export function getNotificationObservabilityContractSummary() {
  return Object.freeze({
    version: NOTIFICATION_OBSERVABILITY_CONTRACT_VERSION,
    categories: NOTIFICATION_CATEGORIES,
    severities: NOTIFICATION_SEVERITIES,
    states: NOTIFICATION_STATES,
    sla: NOTIFICATION_SLA_MINUTES,
    transitions: NOTIFICATION_TRANSITIONS,
    routedActions: NOTIFICATION_ROUTED_ACTIONS,
    ownership: "critical notifications require an owner",
    deduplication: "same project and key while unresolved increments occurrences and keeps the highest severity; after resolution the same notification reopens",
    incidents: { groupBy: "groupKey (defaults to correlationId)", windowMinutes: INCIDENT_WINDOW_MINUTES, stormThreshold: INCIDENT_STORM_THRESHOLD },
    views: INBOX_VIEWS,
    actions: NOTIFICATION_ACTIONS,
    streams: { activity: "human-readable history", security: "audit of sensitive operations (editors only)", trace: "execution detail by correlation" },
    classification: CLASSIFICATION_READ,
    retention: { minimumDays: RETENTION_MINIMUM_DAYS, maximumDays: RETENTION_MAXIMUM_DAYS, deletion: "none; a dry-run plan only, records are append-only" },
    export: { formats: EXPORT_FORMATS, maxRows: EXPORT_MAX_ROWS, rule: "owner only, with a reason, redacted, and the export itself is audited" },
    slo: HERO_SLOS,
    channels: "in-backoffice only",
    audit: "classified/redacted/project-scoped"
  });
}

export function validateNotificationObservabilityContract() {
  const errors = [];
  if (NOTIFICATION_OBSERVABILITY_CONTRACT_VERSION !== "1.2") errors.push("Unexpected notification contract version.");
  for (const severity of NOTIFICATION_SEVERITIES) if (!NOTIFICATION_SLA_MINUTES[severity]) errors.push(`${severity} has no SLA.`);
  for (const state of NOTIFICATION_STATES) if (!NOTIFICATION_TRANSITIONS[state]) errors.push(`${state} has no transitions.`);
  for (const stream of AUDIT_STREAMS) if (!STREAM_DEFAULT_CLASSIFICATION[stream]) errors.push(`${stream} has no default classification.`);
  for (const [role, levels] of Object.entries(CLASSIFICATION_READ)) for (const level of levels) if (!DATA_CLASSIFICATIONS.includes(level)) errors.push(`${role} reads unknown classification ${level}.`);
  if (CLASSIFICATION_READ.viewer.includes("confidential")) errors.push("A viewer must never read confidential records.");
  return errors;
}
