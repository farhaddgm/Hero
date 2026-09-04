export const OPERATIONAL_DIAGNOSTICS_CONTRACT_VERSION = "1.0";

export const OPERATIONAL_DIAGNOSTIC_REGISTRY_IDS = Object.freeze([
  "team-registry",
  "team-research",
  "principles-registry",
  "release-promotion",
  "planner",
  "project-memory",
  "ai-orchestration",
  "organization-performance",
  "skill-registry",
  "organization-advisor",
  "control-dashboard"
]);

export const OPERATIONAL_DIAGNOSTIC_REPORTS = Object.freeze([
  "registry-coverage",
  "snapshot-integrity",
  "projection-data-integrity",
  "snapshot-freshness",
  "event-integrity",
  "event-projection-coverage",
  "replay-check",
  "projection-digest",
  "ai-configuration-history",
  "knowledge-freshness",
  "assignment-conflicts",
  "capacity-and-resource-conflicts"
]);

export function getOperationalDiagnosticsContractSummary() {
  return Object.freeze({
    version: OPERATIONAL_DIAGNOSTICS_CONTRACT_VERSION,
    registryIds: OPERATIONAL_DIAGNOSTIC_REGISTRY_IDS,
    reports: OPERATIONAL_DIAGNOSTIC_REPORTS,
    safetyBoundary: "read-only diagnostic; it never dispatches, authorizes, mutates or changes external infrastructure",
    replayBoundary: "replay-check is a validation dry-run over an in-memory event log; it does not write or restore production data",
    contentPolicy: "raw prompts, model outputs, credential references and secrets are excluded from the diagnostic projection"
  });
}

export function validateOperationalDiagnosticsContract() {
  const errors = [];
  if (OPERATIONAL_DIAGNOSTICS_CONTRACT_VERSION !== "1.0") errors.push("Operational diagnostics contract version is invalid.");
  if (OPERATIONAL_DIAGNOSTIC_REGISTRY_IDS.length !== 11) errors.push("Operational diagnostics must cover eleven registry projections.");
  if (new Set(OPERATIONAL_DIAGNOSTIC_REGISTRY_IDS).size !== OPERATIONAL_DIAGNOSTIC_REGISTRY_IDS.length) errors.push("Diagnostic registry IDs must be unique.");
  if (OPERATIONAL_DIAGNOSTIC_REPORTS.length < 6) errors.push("Operational diagnostics reports are incomplete.");
  return errors;
}
