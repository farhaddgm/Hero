export const OPERATIONAL_HARDENING_CONTRACT_VERSION = "1.0";
export const SUPPORTED_LOCALES = Object.freeze(["fa", "en"]);
export const RETENTION_MINIMUMS = Object.freeze({ auditDays: 365, evidenceDays: 365, securityDays: 730 });
export function getOperationalHardeningContractSummary() { return Object.freeze({ version: OPERATIONAL_HARDENING_CONTRACT_VERSION, locales: SUPPORTED_LOCALES, retentionMinimums: RETENTION_MINIMUMS, cleanup: "dry-run and hold by default; deletion separately gated" }); }
export function validateOperationalHardeningContract() { return SUPPORTED_LOCALES.length === 2 && RETENTION_MINIMUMS.auditDays >= 365 ? [] : ["Invalid operational-hardening contract."]; }
