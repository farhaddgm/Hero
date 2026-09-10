export const DELIVERY_CONTROL_CONTRACT_VERSION = "1.0";
export const DELIVERY_RELEASE_STATES = Object.freeze(["tested", "approved", "ready", "deployed", "rolled-back", "blocked"]);
export const DELIVERY_TARGETS = Object.freeze(["web", "backend", "mobile", "data", "multi-service"]);
export function getDeliveryControlContractSummary() { return Object.freeze({ version: DELIVERY_CONTROL_CONTRACT_VERSION, releaseStates: DELIVERY_RELEASE_STATES, targets: DELIVERY_TARGETS, productionTelemetry: "allowlisted metadata only", deliveryBundle: "secret-free manifest; export and deploy separately gated" }); }
export function validateDeliveryControlContract() { return DELIVERY_RELEASE_STATES.includes("rolled-back") && DELIVERY_TARGETS.length === 5 ? [] : ["Invalid delivery-control contract."]; }
