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
  PLANNER_AI_ROLE_ROUTES,
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
  ORGANIZATION_PERFORMANCE_BANDS,
  ORGANIZATION_PERFORMANCE_CONTRACT_VERSION,
  ORGANIZATION_PERFORMANCE_METRICS,
  getOrganizationPerformanceContractSummary,
  validateOrganizationPerformanceContract
} from "./organization-performance.mjs";

export {
  SKILL_BINDING_STATES,
  SKILL_CONTRACT_VERSION,
  SKILL_SCOPES,
  SKILL_STATUSES,
  SKILL_TOOL_POLICIES,
  getSkillContractSummary,
  validateSkillContract
} from "./skill.mjs";

export {
  ORGANIZATION_ADVISOR_CONTRACT_VERSION,
  ORGANIZATION_ADVISOR_PIPELINE_ROLES,
  ORGANIZATION_ADVISOR_STATES,
  getOrganizationAdvisorContractSummary,
  validateOrganizationAdvisorContract
} from "./organization-advisor.mjs";

export {
  AI_BENCHMARK_CASES,
  AI_BENCHMARK_CONTRACT_VERSION,
  AI_BENCHMARK_METRICS,
  getAiBenchmarkContractSummary,
  validateAiBenchmarkContract
} from "./ai-benchmark.mjs";

export {
  PILOT_ACCEPTANCE_CHECKS,
  PILOT_CONTRACT_VERSION,
  PILOT_STATES,
  getPilotContractSummary,
  validatePilotContract
} from "./pilot.mjs";

export {
  OBSERVABILITY_CONTRACT_VERSION,
  OBSERVABILITY_EVENT_KINDS,
  OBSERVABILITY_SAFE_DATA_KEYS,
  SPAN_ID_PATTERN,
  TRACE_ID_PATTERN,
  getObservabilityContractSummary,
  projectOperationalEvent,
  validateObservabilityContract
} from "./observability.mjs";

export {
  HERO_COST_UNITS_PER_CURRENCY_UNIT,
  PRICING_CATALOG_CONTRACT_VERSION,
  PRICING_CATALOG_FIELDS,
  PRICING_MODES,
  getPricingCatalogContractSummary,
  normalizePricingCatalog,
  validatePricingCatalog,
  validatePricingCatalogContract
} from "./pricing-catalog.mjs";

export {
  OPERATIONAL_DIAGNOSTICS_CONTRACT_VERSION,
  OPERATIONAL_DIAGNOSTIC_REGISTRY_IDS,
  OPERATIONAL_DIAGNOSTIC_REPORTS,
  getOperationalDiagnosticsContractSummary,
  validateOperationalDiagnosticsContract
} from "./operational-diagnostics.mjs";

export {
  PRODUCT_DEVELOPMENT_CONTRACT_VERSION,
  PRODUCT_STATUSES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  ROADMAP_ITEM_STATUSES,
  DOCUMENT_EDIT_CLASSES,
  PRODUCT_DOCUMENT_REQUIRED_ROLES,
  getProductDevelopmentContractSummary,
  validateProductManifest,
  validateDocumentCatalogEntry,
  roadmapStatusFromText
} from "./product-development.mjs";

export {
  PRODUCT_ROADMAP_CONTRACT_VERSION,
  ROADMAP_NODE_TYPES,
  ROADMAP_EDGE_TYPES,
  ROADMAP_NODE_STATUSES,
  COMPLETENESS_STAGES,
  COMPLETENESS_SEVERITIES,
  getProductRoadmapContractSummary,
  validateRoadmapGraph
} from "./product-roadmap.mjs";

export {
  NOTION_PRODUCT_DEVELOPMENT_CONTRACT_VERSION,
  NOTION_SYNC_STATES,
  NOTION_EDIT_POLICIES,
  NOTION_DATABASE_DEFINITIONS,
  validateNotionSyncMapping,
  createNotionWorkspaceBlueprint,
  getNotionProductDevelopmentContractSummary
} from "./notion-product-development.mjs";

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
  TEAM_RESEARCH_CONTRACT_VERSION,
  TEAM_RESEARCH_BENCHMARKS,
  TEAM_RESEARCH_DECISIONS,
  TEAM_RESEARCH_FOCUS_AREAS,
  TEAM_RESEARCH_OUTPUT_TYPES,
  TEAM_RESEARCH_REPORT_REQUIREMENTS,
  TEAM_RESEARCH_STATES,
  getTeamResearchBrief,
  getTeamResearchContractSummary,
  validateTeamResearchContract
} from "./team-research.mjs";

export {
  OUTPUT_ADVISORY_CONTRACT_VERSION,
  OUTPUT_DECISIONS,
  OUTPUT_DECISION_STATES,
  OUTPUT_EVALUATION_DIMENSIONS,
  PRODUCT_OUTPUT_DEFINITIONS,
  PRODUCT_OUTPUT_TYPES,
  getOutputAdvisoryContractSummary,
  validateOutputAdvisoryContract
} from "./output-advisory.mjs";

export {
  AI_ORCHESTRATION_CONTRACT_VERSION,
  AI_ROLES,
  AI_PROVIDER_IDS,
  AI_PROVIDER_MODES,
  AI_PROFILE_STATUSES,
  AI_TOOL_POLICIES,
  AI_INVOCATION_STATUSES,
  AI_EVALUATION_VERDICTS,
  AI_DECISION_STATES,
  AI_DECISION_REQUESTS,
  AI_OUTPUT_SCHEMAS,
  AI_CONTEXT_RECIPIENT_ROLES,
  AI_ROLE_OUTPUT_SCHEMAS,
  AI_ROLE_MUTATION_POLICIES,
  AI_WORKFLOW_DEFINITIONS,
  AI_WORKFLOW_CONTRACTS,
  AI_DEFAULT_ROLE_POLICIES,
  getAiOrchestrationContractSummary,
  validateAiOrchestrationContract
} from "./ai-orchestration.mjs";

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
  RELEASE_MANIFEST_SCHEMA,
  RELEASE_MANIFEST_CONTRACT_VERSION,
  RELEASE_ARTIFACT_PATTERN,
  RELEASE_URL_PATTERN,
  createReleaseManifest,
  getReleaseManifestContractSummary,
  validateReleaseManifest
} from "./release-manifest.mjs";

export {
  OWNER_AUTH_CONTRACT_VERSION,
  OWNER_AUTH_DECISIONS,
  OWNER_AUTH_ROLES,
  getOwnerAuthContractSummary,
  validateOwnerAuthContract
} from "./owner-auth.mjs";

export {
  ADMIN_AUTH_ALLOWED_MUTATIONS,
  ADMIN_AUTH_CONTRACT_VERSION,
  ADMIN_AUTH_DECISIONS,
  ADMIN_AUTH_ROLE,
  getAdminAuthContractSummary,
  validateAdminAuthContract
} from "./admin-auth.mjs";

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

export {
  BACKOFFICE_CONTEXTS,
  BACKOFFICE_CORE_ENTITIES,
  BACKOFFICE_FOUNDATION_CONTRACT_VERSION,
  BACKOFFICE_ID_KINDS,
  BACKOFFICE_LIFECYCLE_STATES,
  BACKOFFICE_PLANES,
  assertBackofficeStableId,
  getBackofficeFoundationContractSummary,
  isBackofficeStableId,
  validateBackofficeEntityVersion,
  validateBackofficeEventEnvelope,
  validateBackofficeFoundationContract
} from "./backoffice-foundation.mjs";

export {
  HUMAN_IDENTITY_EVENTS,
  HUMAN_ROLES,
  MFA_REQUIRED_ROLES,
  OWNER_ONLY_ACTIONS,
  PROJECT_ACCESS_ACTIONS,
  PROJECT_IDENTITY_CONTRACT_VERSION,
  PROJECT_ROLE_PERMISSIONS,
  getProjectIdentityContractSummary,
  validateProjectIdentityContract
} from "./project-identity.mjs";

export {
  PROJECT_WORKSPACE_CONTRACT_VERSION,
  PROJECT_LIFECYCLES,
  PROJECT_INPUT_TYPES,
  FOUNDATION_PROPOSAL_STATES,
  getProjectWorkspaceContractSummary,
  validateProjectWorkspaceContract
} from "./project-workspace.mjs";

export {
  PROJECT_SETTINGS_CONTRACT_VERSION,
  SETTINGS_LAYERS,
  POLICY_RISK_LEVELS,
  getProjectSettingsContractSummary,
  validateProjectSettingsContract
} from "./project-settings.mjs";

export {
  PRODUCT_AUTONOMY_MODES,
  PRODUCT_EXECUTION_MODES,
  PRODUCT_FACTORY_CONTRACT_VERSION,
  PRODUCT_NETWORK_POLICIES,
  PRODUCT_RISK_LEVELS,
  PRODUCT_RUNTIME_DEFAULTS,
  PRODUCT_RUNTIME_EFFECTS,
  PRODUCT_RUNTIME_NETWORK_MODES,
  PRODUCT_TARGET_KINDS,
  PRODUCT_TYPES,
  getProductFactoryContractSummary,
  validateProductFactoryContract,
  validateProductRuntimePlan
} from "./product-factory.mjs";

export { BACKOFFICE_COLLABORATION_CONTRACT_VERSION, CONVERSATION_CONTEXTS, MEMORY_LEVELS, MEMORY_SENSITIVITIES, getBackofficeCollaborationContractSummary, validateBackofficeCollaborationContract } from "./backoffice-collaboration.mjs";
export { BACKOFFICE_COMMAND_CENTER_CONTRACT_VERSION, COMMAND_RISKS, COMMAND_STATES, getBackofficeCommandCenterContractSummary, validateBackofficeCommandCenterContract } from "./backoffice-command-center.mjs";
export { SYSTEM_CATALOG_CONTRACT_VERSION, SYSTEM_ENTITY_TYPES, SYSTEM_ENTITY_LIFECYCLES, getSystemCatalogContractSummary, validateSystemCatalogContract } from "./system-catalog.mjs";
export { PERFORMANCE_INTELLIGENCE_CONTRACT_VERSION, USAGE_EVENT_FIELDS, HEALTH_STATUSES, getPerformanceIntelligenceContractSummary, validatePerformanceIntelligenceContract } from "./performance-intelligence.mjs";
export { NOTIFICATION_OBSERVABILITY_CONTRACT_VERSION, NOTIFICATION_SEVERITIES, NOTIFICATION_STATES, getNotificationObservabilityContractSummary, validateNotificationObservabilityContract } from "./notification-observability.mjs";
export { INFRASTRUCTURE_CONTROL_CONTRACT_VERSION, HERO_ENVIRONMENTS, NODE_STATES, SECRET_STATES, getInfrastructureControlContractSummary, validateInfrastructureControlContract } from "./infrastructure-control.mjs";
export { DELIVERY_CONTROL_CONTRACT_VERSION, DELIVERY_RELEASE_STATES, DELIVERY_TARGETS, getDeliveryControlContractSummary, validateDeliveryControlContract } from "./delivery-control.mjs";
export { OPERATIONAL_HARDENING_CONTRACT_VERSION, SUPPORTED_LOCALES, RETENTION_MINIMUMS, getOperationalHardeningContractSummary, validateOperationalHardeningContract } from "./operational-hardening.mjs";
export { FINAL_READINESS_CONTRACT_VERSION, READINESS_STATES, getFinalReadinessContractSummary, validateFinalReadinessContract } from "./final-readiness.mjs";
export { BACKOFFICE_COMPLETION_CONTRACT_VERSION, COMPLETION_CAPABILITIES, COMPLETION_EVIDENCE_KINDS, COMPLETION_LOCALES, COMPLETION_ROLES, COMPLETION_SETTING_LAYERS, getBackofficeCompletionContractSummary, validateBackofficeCompletionContract } from "./backoffice-completion.mjs";
