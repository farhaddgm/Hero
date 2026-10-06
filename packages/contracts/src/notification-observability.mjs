export const NOTIFICATION_OBSERVABILITY_CONTRACT_VERSION = "1.1";
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
export const NOTIFICATION_RECORD_KINDS = Object.freeze(["notification", "incident", "audit", "trace", "sli"]);

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
    channels: "in-backoffice only",
    audit: "classified/redacted/project-scoped"
  });
}

export function validateNotificationObservabilityContract() {
  const errors = [];
  if (NOTIFICATION_OBSERVABILITY_CONTRACT_VERSION !== "1.1") errors.push("Unexpected notification contract version.");
  for (const severity of NOTIFICATION_SEVERITIES) if (!NOTIFICATION_SLA_MINUTES[severity]) errors.push(`${severity} has no SLA.`);
  for (const state of NOTIFICATION_STATES) if (!NOTIFICATION_TRANSITIONS[state]) errors.push(`${state} has no transitions.`);
  return errors;
}
