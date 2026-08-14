export const PORTABILITY_GATE_CONTRACT_VERSION = "1.0";

export const PORTABILITY_GATE_STATES = Object.freeze([
  "assessing",
  "ready",
  "blocked"
]);

export const PORTABILITY_GATE_DECISION_CODES = Object.freeze([
  "PORTABILITY_READY",
  "PORTABILITY_VERIFIED",
  "SOURCE_BOUNDARY_FAILED",
  "RUNTIME_CONTRACT_REQUIRED",
  "BACKUP_EVIDENCE_REQUIRED",
  "RESTORE_EVIDENCE_REQUIRED",
  "LINUX_CLEANROOM_VERIFICATION_REQUIRED",
  "GLOBAL_STOP_ACTIVE",
  "TRANSFER_REQUIRES_SEPARATE_AUTHORIZATION"
]);

export const DEFAULT_PORTABILITY_POLICY = Object.freeze({
  requiredSourceFiles: Object.freeze([
    ".env.example",
    "compose.yaml",
    "Dockerfile",
    "pnpm-lock.yaml"
  ]),
  requiredComposeResources: Object.freeze(["hero-data", "hero-private"]),
  requiredEnvironmentPrefix: "HERO_",
  requireCleanLinuxEvidence: true
});

export function validatePortabilityGateContract() {
  const errors = [];
  if (PORTABILITY_GATE_CONTRACT_VERSION !== "1.0") errors.push("Portability Gate contract version is invalid.");
  for (const state of ["assessing", "ready", "blocked"]) {
    if (!PORTABILITY_GATE_STATES.includes(state)) errors.push(`Required Portability Gate state is missing: ${state}.`);
  }
  for (const code of ["PORTABILITY_VERIFIED", "BACKUP_EVIDENCE_REQUIRED", "RESTORE_EVIDENCE_REQUIRED", "LINUX_CLEANROOM_VERIFICATION_REQUIRED", "TRANSFER_REQUIRES_SEPARATE_AUTHORIZATION"]) {
    if (!PORTABILITY_GATE_DECISION_CODES.includes(code)) errors.push(`Required Portability Gate decision code is missing: ${code}.`);
  }
  if (!DEFAULT_PORTABILITY_POLICY.requireCleanLinuxEvidence) errors.push("Portability Gate must require clean Linux evidence.");
  if (!DEFAULT_PORTABILITY_POLICY.requiredComposeResources.every(name => name.startsWith("hero-"))) {
    errors.push("Portability Gate resources must remain Hero-scoped.");
  }
  return errors;
}

export function getPortabilityGateContractSummary() {
  return Object.freeze({
    version: PORTABILITY_GATE_CONTRACT_VERSION,
    states: PORTABILITY_GATE_STATES,
    decisionCodes: PORTABILITY_GATE_DECISION_CODES,
    defaultPolicy: DEFAULT_PORTABILITY_POLICY,
    checks: Object.freeze(["independent source boundary", "Linux container contract", "checksum-bound backup evidence", "checksum-bound restore evidence", "clean Linux verification"]),
    flow: "exact test authorization -> deterministic source/runtime/backup/restore assessment -> transfer-ready record -> actual server transfer only after separate authorization",
    safetyBoundary: "The deterministic gate never copies a repository, reads or writes a backup, accesses secrets, provisions a host, starts containers, opens a network connection, or performs a transfer."
  });
}
