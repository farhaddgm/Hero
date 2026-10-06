export const BACKOFFICE_COLLABORATION_CONTRACT_VERSION = "1.1";
export const CONVERSATION_CONTEXTS = Object.freeze(["hero", "project", "team", "role", "entity"]);
export const MEMORY_LEVELS = Object.freeze(["project", "team", "role", "specialist"]);
export const MEMORY_SENSITIVITIES = Object.freeze(["normal", "restricted"]);
/** Append-only record types persisted in collaboration_records. */
export const COLLABORATION_RECORD_TYPES = Object.freeze(["team-assignment", "profile", "conversation", "message", "conversation-state", "memory", "knowledge"]);
/** Model precedence for a conversation, highest first (BO-068). */
export const CONVERSATION_MODEL_PRECEDENCE = Object.freeze(["conversation", "role-setting", "team-setting", "project-default"]);

/** Maps a role or team id (e.g. "decision-maker", "ideh-pardazo") to a settings path segment. */
export function settingsKeyFor(identifier) {
  return String(identifier).replace(/[-_.:]+([a-zA-Z0-9])/g, (_, next) => next.toUpperCase()).replace(/[^A-Za-z0-9]/g, "");
}

export function getBackofficeCollaborationContractSummary() {
  return Object.freeze({
    version: BACKOFFICE_COLLABORATION_CONTRACT_VERSION,
    contexts: CONVERSATION_CONTEXTS,
    memoryLevels: MEMORY_LEVELS,
    recordTypes: COLLABORATION_RECORD_TYPES,
    modelPrecedence: CONVERSATION_MODEL_PRECEDENCE,
    citations: "hero:// sources must be global or belong to the same project",
    crossProject: "sanitized knowledge proposal with target acceptance only",
    providerExecution: "not enabled by this contract"
  });
}

export function validateBackofficeCollaborationContract() {
  const errors = [];
  if (BACKOFFICE_COLLABORATION_CONTRACT_VERSION !== "1.1") errors.push("Unexpected collaboration contract version.");
  if (CONVERSATION_CONTEXTS.length !== 5) errors.push("Exactly five conversation contexts are required.");
  if (settingsKeyFor("decision-maker") !== "decisionMaker" || settingsKeyFor("ideh-pardazo") !== "idehPardazo") errors.push("Settings key mapping is invalid.");
  return errors;
}
