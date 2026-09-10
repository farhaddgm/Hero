export const BACKOFFICE_COLLABORATION_CONTRACT_VERSION = "1.0";
export const CONVERSATION_CONTEXTS = Object.freeze(["hero", "project", "team", "role", "entity"]);
export const MEMORY_LEVELS = Object.freeze(["project", "team", "role", "specialist"]);
export const MEMORY_SENSITIVITIES = Object.freeze(["normal", "restricted"]);
export function getBackofficeCollaborationContractSummary() { return Object.freeze({ version: BACKOFFICE_COLLABORATION_CONTRACT_VERSION, contexts: CONVERSATION_CONTEXTS, memoryLevels: MEMORY_LEVELS, crossProject: "knowledge-proposal with target acceptance only", providerExecution: "not enabled by this contract" }); }
export function validateBackofficeCollaborationContract() { return BACKOFFICE_COLLABORATION_CONTRACT_VERSION === "1.0" && CONVERSATION_CONTEXTS.length === 5 ? [] : ["Invalid collaboration contract."]; }
