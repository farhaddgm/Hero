export const BACKOFFICE_COMMAND_CENTER_CONTRACT_VERSION = "1.0";
export const COMMAND_RISKS = Object.freeze(["low", "medium", "high", "critical"]);
export const COMMAND_STATES = Object.freeze(["draft", "awaiting-approval", "approved", "queued", "running", "paused", "completed", "failed", "blocked"]);
export function getBackofficeCommandCenterContractSummary() { return Object.freeze({ version: BACKOFFICE_COMMAND_CENTER_CONTRACT_VERSION, risks: COMMAND_RISKS, highRisk: "approval required", production: "preauthorization record only; separate deploy gate remains required", heavyRunDefault: 2 }); }
export function validateBackofficeCommandCenterContract() { return BACKOFFICE_COMMAND_CENTER_CONTRACT_VERSION === "1.0" && COMMAND_RISKS.includes("critical") ? [] : ["Invalid command center contract."]; }
