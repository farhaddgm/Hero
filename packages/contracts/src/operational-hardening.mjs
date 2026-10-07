export const OPERATIONAL_HARDENING_CONTRACT_VERSION = "1.1";
export const SUPPORTED_LOCALES = Object.freeze(["fa", "en"]);
/** BO-147: per-project retention can be lengthened, never shortened below these. */
export const RETENTION_MINIMUMS = Object.freeze({ auditDays: 365, evidenceDays: 365, securityDays: 730 });
export const RETENTION_MAXIMUM_DAYS = 3650;
/** BO-155/BO-152/...: the six kinds of hardening evidence a project must hold. */
export const HARDENING_AUDIT_KINDS = Object.freeze(["accessibility", "security", "load", "backup-restore", "secret-dependency", "role-regression"]);
/** An audit is accepted only with the tool that produced it and a digest of its raw output. */
export const EVIDENCE_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
export const AUDIT_STALE_AFTER_DAYS = 30;
export const CLEANUP_CANDIDATE_LIMIT = 500;
export const CLEANUP_KINDS = Object.freeze(["audit", "evidence", "security"]);
/** Which retention field protects which kind of record. */
export const CLEANUP_RETENTION_FIELD = Object.freeze({ audit: "auditDays", evidence: "evidenceDays", security: "securityDays" });
export const HARDENING_RECORD_KINDS = Object.freeze(["policy", "cleanup", "hold", "audit", "deletion-attempt", "locale"]);
export const QUERY_BUDGET_MAXIMUM = 100;
export function getOperationalHardeningContractSummary() {
  return Object.freeze({ version: OPERATIONAL_HARDENING_CONTRACT_VERSION, locales: SUPPORTED_LOCALES, retentionMinimums: RETENTION_MINIMUMS, retentionMaximumDays: RETENTION_MAXIMUM_DAYS, auditKinds: HARDENING_AUDIT_KINDS, auditEvidence: "tool name, tool version, sha256 digest of the raw output and counted checks; pass is derived, never asserted", cleanup: "dry-run and hold by default; candidates younger than retention are refused; every deletion attempt is recorded as refused; deletion separately gated" });
}
export function validateOperationalHardeningContract() {
  const errors = [];
  if (SUPPORTED_LOCALES.length !== 2) errors.push("Exactly two locales are supported.");
  if (RETENTION_MINIMUMS.auditDays < 365 || RETENTION_MINIMUMS.securityDays < RETENTION_MINIMUMS.auditDays) errors.push("Retention minimums are weakened.");
  if (!EVIDENCE_DIGEST_PATTERN.test(`sha256:${"a".repeat(64)}`)) errors.push("Digest pattern is broken.");
  return errors;
}
