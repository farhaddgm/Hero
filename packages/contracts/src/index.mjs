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
  PLANNER_CONTRACT_VERSION,
  PLANNER_DECISION_CODES,
  PLANNER_ROUTER_PROVIDERS,
  PLANNER_STATES,
  PLANNER_TASK_KINDS,
  PLANNER_TEAM_ROUTES,
  getPlannerContractSummary,
  validatePlannerContract
} from "./planner.mjs";

export {
  DEFAULT_QUALITY_GATE_POLICY,
  QUALITY_GATE_CONTRACT_VERSION,
  QUALITY_GATE_DECISION_CODES,
  QUALITY_GATE_STATES,
  getQualityGateContractSummary,
  validateQualityGateContract
} from "./quality-gate.mjs";

export {
  WEB_FACTORY_CONTRACT_VERSION,
  WEB_FACTORY_DECISION_CODES,
  WEB_FACTORY_RECIPE_FIELDS,
  WEB_FACTORY_STATES,
  WEB_FACTORY_TARGET_STACK,
  getWebFactoryContractSummary,
  validateWebFactoryContract
} from "./web-factory.mjs";

export {
  MOBILE_FACTORY_CONTRACT_VERSION,
  MOBILE_FACTORY_DECISION_CODES,
  MOBILE_FACTORY_RECIPE_FIELDS,
  MOBILE_FACTORY_STATES,
  MOBILE_FACTORY_TARGET_STACK,
  getMobileFactoryContractSummary,
  validateMobileFactoryContract
} from "./mobile-factory.mjs";

export {
  ASSURANCE_GATE_CONTRACT_VERSION,
  ASSURANCE_GATE_DECISION_CODES,
  ASSURANCE_GATE_STATES,
  DEFAULT_ASSURANCE_POLICY,
  getAssuranceGateContractSummary,
  validateAssuranceGateContract
} from "./assurance-gate.mjs";

export {
  DEFAULT_PORTABILITY_POLICY,
  PORTABILITY_GATE_CONTRACT_VERSION,
  PORTABILITY_GATE_DECISION_CODES,
  PORTABILITY_GATE_STATES,
  getPortabilityGateContractSummary,
  validatePortabilityGateContract
} from "./portability-gate.mjs";

export {
  TEAM_APPROVAL_MODES,
  TEAM_AUTONOMY_MODES,
  TEAM_ASSIGNMENT_STATES,
  TEAM_CATALOG,
  TEAM_CONTRACT_VERSION,
  TEAM_DELIVERABLE_DIRECTIONS,
  TEAM_REQUIRED_APPROVALS,
  TEAM_REVIEW_DECISIONS,
  TEAM_REVIEW_TARGETS,
  TEAM_STATUSES,
  TEAM_TRAINING_MODULES,
  getTeamContractSummary,
  validateTeamContract
} from "./team.mjs";

export {
  TEAM_TRAINING_CONTRACT_VERSION,
  TEAM_TRAINING_BENCHMARKS,
  TRAINING_MODULE_DEFINITIONS,
  TRAINING_PASS_SCORE,
  TRAINING_PROGRAM_STATUSES,
  getTeamTrainingPlan,
  getTrainingContractSummary,
  validateTrainingContract
} from "./training.mjs";

export {
  CRITICAL_PRINCIPLES_CONTRACT_VERSION,
  HERO_CRITICAL_PRINCIPLES,
  PRINCIPLE_CONTROL_POINTS,
  PRINCIPLE_DECISIONS,
  PRINCIPLE_SCOPES,
  PRINCIPLE_STATUSES,
  getCriticalPrinciplesContractSummary,
  validateCriticalPrinciplesContract
} from "./principles.mjs";

export {
  RELEASE_ACTIONS,
  RELEASE_COMMIT_PATTERN,
  RELEASE_CONTRACT_VERSION,
  RELEASE_DECISION_CODES,
  RELEASE_ENVIRONMENTS,
  RELEASE_STATES,
  RELEASE_VERSION_PATTERN,
  getReleaseContractSummary,
  validateReleaseContract
} from "./release.mjs";

export {
  OWNER_AUTH_CONTRACT_VERSION,
  OWNER_AUTH_DECISIONS,
  OWNER_AUTH_ROLES,
  getOwnerAuthContractSummary,
  validateOwnerAuthContract
} from "./owner-auth.mjs";

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
