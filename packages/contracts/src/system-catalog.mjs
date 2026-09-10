export const SYSTEM_CATALOG_CONTRACT_VERSION = "1.0";
export const SYSTEM_ENTITY_TYPES = Object.freeze(["project", "application", "component", "service", "repository", "api", "data", "environment", "server"]);
export const SYSTEM_ENTITY_LIFECYCLES = Object.freeze(["planned", "active", "retired"]);
export function getSystemCatalogContractSummary() { return Object.freeze({ version: SYSTEM_CATALOG_CONTRACT_VERSION, entityTypes: SYSTEM_ENTITY_TYPES, lifecycle: SYSTEM_ENTITY_LIFECYCLES, sourceOfTruth: "Git is canonical; Notion remains projection/proposal only" }); }
export function validateSystemCatalogContract() { return SYSTEM_CATALOG_CONTRACT_VERSION === "1.0" && SYSTEM_ENTITY_TYPES.length === 9 ? [] : ["Invalid System Catalog contract."]; }
