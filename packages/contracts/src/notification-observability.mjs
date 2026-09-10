export const NOTIFICATION_OBSERVABILITY_CONTRACT_VERSION = "1.0";
export const NOTIFICATION_SEVERITIES = Object.freeze(["info","warning","critical"]);
export const NOTIFICATION_STATES = Object.freeze(["open","snoozed","resolved"]);
export function getNotificationObservabilityContractSummary(){return Object.freeze({version:NOTIFICATION_OBSERVABILITY_CONTRACT_VERSION,severities:NOTIFICATION_SEVERITIES,states:NOTIFICATION_STATES,channels:"in-backoffice only",audit:"classified/redacted/project-scoped"});}
export function validateNotificationObservabilityContract(){return NOTIFICATION_OBSERVABILITY_CONTRACT_VERSION==="1.0"?[]:["Invalid notification/observability contract."];}
