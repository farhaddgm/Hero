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
  FAKE_AGENT_CONTRACT_VERSION,
  FAKE_AGENT_OUTCOMES,
  FAKE_AGENT_SCENARIOS,
  getFakeAgentContractSummary,
  validateFakeAgentContract
} from "./fake-agent.mjs";

export {
  PROVIDER_AGENT_CONTRACT_VERSION,
  PROVIDER_AGENT_IDS,
  PROVIDER_AGENT_MODES,
  PROVIDER_EXECUTION_STATES,
  PROVIDER_RESULT_FIELDS,
  getProviderAgentContractSummary,
  validateProviderAgentContract
} from "./provider-agent.mjs";

export {
  CLAUDE_REVIEW_CONTRACT_VERSION,
  CLAUDE_REVIEW_PROVIDER,
  CLAUDE_REVIEW_MODES,
  CLAUDE_REVIEW_OUTCOMES,
  CLAUDE_REVIEW_CATEGORIES,
  CLAUDE_REVIEW_SEVERITIES,
  CLAUDE_REVIEW_FINDING_FIELDS,
  getClaudeReviewContractSummary,
  validateClaudeReviewContract
} from "./claude-review.mjs";

export {
  CURSOR_HANDOFF_CONTRACT_VERSION,
  CURSOR_HANDOFF_PROVIDER,
  CURSOR_HANDOFF_MODES,
  CURSOR_HANDOFF_STATES,
  CURSOR_HANDOFF_PACKAGE_FIELDS,
  getCursorHandoffContractSummary,
  validateCursorHandoffContract
} from "./cursor-handoff.mjs";

export {
  PROJECT_CONTEXT_STATES,
  PROJECT_MEMORY_CONTRACT_VERSION,
  PROJECT_MEMORY_KINDS,
  PROJECT_MEMORY_RECIPIENT_ROLES,
  PROJECT_MEMORY_SCOPES,
  PROJECT_MEMORY_STATUSES,
  getProjectMemoryContractSummary,
  validateProjectMemoryContract
} from "./project-memory.mjs";

export {
  DASHBOARD_ACTIONS,
  DASHBOARD_CONTRACT_VERSION,
  DASHBOARD_REQUEST_STATES,
  getDashboardContractSummary,
  validateDashboardContract
} from "./dashboard.mjs";

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
