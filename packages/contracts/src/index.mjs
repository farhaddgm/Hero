export const HERO_SERVICE = "hero-control-plane";
export const HERO_VERSION = "0.1.0";
export const HERO_BOUNDARY = "clean-room";

export {
  ACTOR_KINDS,
  AGGREGATE_TYPES,
  EVENT_TYPES,
  OPERATIONAL_DATA_CONTRACT_VERSION,
  OPERATIONAL_ENTITY_MODEL,
  SENSITIVE_ACTIONS,
  createOperationalEvent,
  getOperationalDataSummary,
  validateOperationalEvent
} from "./operational-data.mjs";

export {
  RUN_STATES,
  TERMINAL_RUN_STATES,
  WORKFLOW_ACTIONS,
  WORKFLOW_CONTRACT_VERSION,
  WORKFLOW_TRANSITIONS,
  getWorkflowContractSummary,
  validateWorkflowContract
} from "./workflow.mjs";

export {
  AUTHORIZATION_CONTRACT_VERSION,
  AUTHORIZATION_DECISION_CODES,
  AUTHORIZATION_MODES,
  AUTHORIZATION_STATUSES,
  DEVELOPMENT_OPERATIONS,
  getAuthorizationContractSummary,
  validateAuthorizationContract
} from "./authorization.mjs";

export {
  DEFAULT_RUNNER_LIMITS,
  RUNNER_ACTIONS,
  RUNNER_CONTRACT_VERSION,
  RUNNER_DECISION_CODES,
  RUNNER_STATES,
  getRunnerContractSummary,
  validateRunnerContract
} from "./runner.mjs";

export {
  ARCHITECTURE_CONTRACT_VERSION,
  ARCHITECTURE_FLOW,
  ARCHITECTURE_GUARDRAILS,
  ARCHITECTURE_LAYERS,
  ARCHITECTURE_RUNTIME,
  ARCHITECTURE_STYLE,
  PROVIDER_ARCHITECTURE,
  getPublicArchitectureSummary,
  validateArchitectureContract
} from "./architecture.mjs";

export {
  ALWAYS_SEPARATELY_APPROVED_ACTIONS,
  COLLABORATION_MODES,
  SIMPLE_DEVELOPMENT_STATUSES,
  USER_EXPERIENCE_CONTRACT_VERSION,
  USER_EXPERIENCE_LANGUAGE,
  UX_QUESTION_POLICY,
  UX_REQUIRED_SCREENS,
  validateUserExperienceContract
} from "./user-experience.mjs";
