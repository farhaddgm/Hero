export const INFRASTRUCTURE_CONTROL_CONTRACT_VERSION = "1.0";
export const HERO_ENVIRONMENTS = Object.freeze(["development", "test", "production"]);
export const NODE_STATES = Object.freeze(["pending", "registered", "offline", "revoked"]);
export const SECRET_STATES = Object.freeze(["registered", "replaced", "rotated", "revoked"]);
export function getInfrastructureControlContractSummary() { return Object.freeze({ version: INFRASTRUCTURE_CONTROL_CONTRACT_VERSION, environments: HERO_ENVIRONMENTS, nodeStates: NODE_STATES, secrets: "metadata-only; values never enter Control Plane records", github: "metadata-only; no fetch or write without a separate authorization" }); }
export function validateInfrastructureControlContract() { return HERO_ENVIRONMENTS.join(",") === "development,test,production" && NODE_STATES.includes("revoked") ? [] : ["Invalid infrastructure-control contract."]; }
