export const AI_ORCHESTRATION_CONTRACT_VERSION = "1.0";

export const AI_ROLES = Object.freeze([
  "analyst",
  "evaluator",
  "decision-maker",
  "planner",
  "researcher",
  "executor",
  "verifier",
  "code-reviewer"
]);

export const AI_PROVIDER_IDS = Object.freeze([
  "openai",
  "anthropic",
  "google",
  "openai-compatible",
  "deterministic"
]);

export const AI_PROVIDER_MODES = Object.freeze(["live", "deterministic", "disabled"]);

export const AI_PROFILE_STATUSES = Object.freeze(["draft", "active", "disabled", "retired"]);

export const AI_TOOL_POLICIES = Object.freeze(["read-only", "development", "owner-gated"]);

export const AI_INVOCATION_STATUSES = Object.freeze(["completed", "blocked", "failed"]);

export const AI_EVALUATION_VERDICTS = Object.freeze(["approved", "needs_revision", "rejected"]);

export const AI_DECISION_STATES = Object.freeze(["draft", "approved", "superseded", "rejected"]);

export const AI_DECISION_REQUESTS = Object.freeze([
  "owner-approval",
  "team-review",
  "rework",
  "stop-or-continue",
  "route-change"
]);

export const AI_OUTPUT_SCHEMAS = Object.freeze([
  "analysis-v1",
  "evaluation-v1",
  "decision-proposal-v1",
  "plan-v1",
  "research-v1",
  "execution-v1",
  "organization-advisor-v1",
  "generic-json-v1"
]);

export const AI_CONTEXT_RECIPIENT_ROLES = Object.freeze({
  analyst: "planner",
  evaluator: "reviewer",
  "decision-maker": "planner",
  planner: "planner",
  researcher: "planner",
  executor: "implementer",
  verifier: "reviewer",
  "code-reviewer": "reviewer"
});

export const AI_ROLE_OUTPUT_SCHEMAS = Object.freeze({
  analyst: "analysis-v1",
  evaluator: "evaluation-v1",
  "decision-maker": "decision-proposal-v1",
  planner: "plan-v1",
  researcher: "research-v1",
  executor: "execution-v1",
  verifier: "evaluation-v1",
  "code-reviewer": "evaluation-v1"
});

export const AI_ROLE_MUTATION_POLICIES = Object.freeze({
  analyst: "read-only",
  evaluator: "read-only",
  "decision-maker": "read-only",
  planner: "read-only",
  researcher: "read-only",
  executor: "development",
  verifier: "read-only",
  "code-reviewer": "read-only"
});

export const AI_WORKFLOW_DEFINITIONS = Object.freeze({
  analysis: Object.freeze(["analyst", "evaluator", "decision-maker", "planner"]),
  development: Object.freeze(["planner", "executor", "verifier", "code-reviewer"]),
  research: Object.freeze(["researcher", "evaluator", "decision-maker"]),
  review: Object.freeze(["evaluator", "decision-maker"])
});

export const AI_WORKFLOW_CONTRACTS = Object.freeze({
  analysis: Object.freeze({
    workflowId: "analysis",
    stages: Object.freeze([
      Object.freeze({ order: 1, role: "analyst", outputSchema: "analysis-v1", required: true }),
      Object.freeze({ order: 2, role: "evaluator", outputSchema: "evaluation-v1", required: true }),
      Object.freeze({ order: 3, role: "decision-maker", outputSchema: "decision-proposal-v1", required: true }),
      Object.freeze({ order: 4, role: "planner", outputSchema: "plan-v1", required: true })
    ]),
    terminal: "plan-v1"
  }),
  development: Object.freeze({
    workflowId: "development",
    stages: Object.freeze([
      Object.freeze({ order: 1, role: "planner", outputSchema: "plan-v1", required: true }),
      Object.freeze({ order: 2, role: "executor", outputSchema: "execution-v1", required: true }),
      Object.freeze({ order: 3, role: "verifier", outputSchema: "evaluation-v1", required: true }),
      Object.freeze({ order: 4, role: "code-reviewer", outputSchema: "evaluation-v1", required: true })
    ]),
    terminal: "evaluation-v1"
  }),
  research: Object.freeze({
    workflowId: "research",
    stages: Object.freeze([
      Object.freeze({ order: 1, role: "researcher", outputSchema: "research-v1", required: true }),
      Object.freeze({ order: 2, role: "evaluator", outputSchema: "evaluation-v1", required: true }),
      Object.freeze({ order: 3, role: "decision-maker", outputSchema: "decision-proposal-v1", required: true })
    ]),
    terminal: "decision-proposal-v1"
  }),
  review: Object.freeze({
    workflowId: "review",
    stages: Object.freeze([
      Object.freeze({ order: 1, role: "evaluator", outputSchema: "evaluation-v1", required: true }),
      Object.freeze({ order: 2, role: "decision-maker", outputSchema: "decision-proposal-v1", required: true })
    ]),
    terminal: "decision-proposal-v1"
  })
});

export const AI_DEFAULT_ROLE_POLICIES = Object.freeze({
  analyst: Object.freeze({ providerId: "openai", modelId: "chatgpt", toolPolicy: "read-only" }),
  evaluator: Object.freeze({ providerId: "openai", modelId: "chatgpt", toolPolicy: "read-only" }),
  "decision-maker": Object.freeze({ providerId: "openai", modelId: "chatgpt", toolPolicy: "read-only" }),
  planner: Object.freeze({ providerId: "openai", modelId: "chatgpt", toolPolicy: "read-only" }),
  researcher: Object.freeze({ providerId: "openai", modelId: "chatgpt", toolPolicy: "read-only" }),
  executor: Object.freeze({ providerId: "openai", modelId: "codex", toolPolicy: "development" }),
  verifier: Object.freeze({ providerId: "openai", modelId: "chatgpt", toolPolicy: "read-only" }),
  "code-reviewer": Object.freeze({ providerId: "openai", modelId: "chatgpt", toolPolicy: "read-only" })
});

export function getAiOrchestrationContractSummary() {
  return Object.freeze({
    version: AI_ORCHESTRATION_CONTRACT_VERSION,
    roles: AI_ROLES,
    providers: AI_PROVIDER_IDS,
    providerModes: AI_PROVIDER_MODES,
    profileStatuses: AI_PROFILE_STATUSES,
    toolPolicies: AI_TOOL_POLICIES,
    invocationStatuses: AI_INVOCATION_STATUSES,
    evaluationVerdicts: AI_EVALUATION_VERDICTS,
    decisionStates: AI_DECISION_STATES,
    outputSchemas: AI_OUTPUT_SCHEMAS,
    contextRecipientRoles: AI_CONTEXT_RECIPIENT_ROLES,
    workflows: AI_WORKFLOW_DEFINITIONS,
    defaultRolePolicies: AI_DEFAULT_ROLE_POLICIES,
    roleOutputSchemas: AI_ROLE_OUTPUT_SCHEMAS,
    roleMutationPolicies: AI_ROLE_MUTATION_POLICIES,
    workflowContracts: AI_WORKFLOW_CONTRACTS,
    invariants: [
      "Role != Agent Profile != Provider != Model != Credential",
      "Team != AI Role",
      "Evaluation is evidence; Decision Proposal is not authorization",
      "Provider and model changes never rewrite prior invocations or memory",
  "Live provider invocation requires a separate active version-bound external-spend authorization",
  "External-spend reservations are cumulative, conservative and persisted across invocations",
  "Timeout, retry and cost limits are evaluated before an invocation can be accepted",
  "Repeated provider failures open a bounded circuit; recovery requires a half-open probe",
  "Evaluator and read-only profiles cannot execute tools or mutate code/data"
    ],
    safetyBoundary: "AI output is schema-validated and policy-checked before any workflow, tool or runner action.",
    persistenceBoundary: "append-only events plus versioned projections; credential values never enter the domain or event log"
  });
}

export function validateAiOrchestrationContract() {
  const errors = [];
  if (AI_ORCHESTRATION_CONTRACT_VERSION !== "1.0") errors.push("AI orchestration contract version is invalid.");
  if (AI_ROLES.length < 6 || !AI_ROLES.includes("analyst") || !AI_ROLES.includes("executor")) {
    errors.push("AI orchestration roles are incomplete.");
  }
  if (AI_PROVIDER_IDS.length < 4 || !AI_PROVIDER_IDS.includes("openai-compatible")) {
    errors.push("Provider catalog must support independent compatible adapters.");
  }
  if (!AI_PROVIDER_MODES.includes("disabled") || !AI_PROVIDER_MODES.includes("deterministic")) {
    errors.push("Provider modes must include disabled and deterministic safety modes.");
  }
  if (!AI_TOOL_POLICIES.includes("read-only") || !AI_TOOL_POLICIES.includes("owner-gated")) {
    errors.push("Tool policies must include read-only and owner-gated boundaries.");
  }
  for (const role of AI_ROLES) {
    if (!AI_DEFAULT_ROLE_POLICIES[role]) errors.push(`Missing default policy for AI role: ${role}.`);
    if (!AI_CONTEXT_RECIPIENT_ROLES[role]) errors.push(`Missing context recipient mapping for AI role: ${role}.`);
    if (!AI_ROLE_OUTPUT_SCHEMAS[role] || !AI_OUTPUT_SCHEMAS.includes(AI_ROLE_OUTPUT_SCHEMAS[role])) errors.push(`Missing output schema for AI role: ${role}.`);
    if (!AI_TOOL_POLICIES.includes(AI_ROLE_MUTATION_POLICIES[role])) errors.push(`Missing mutation policy for AI role: ${role}.`);
  }
  for (const [workflow, roles] of Object.entries(AI_WORKFLOW_DEFINITIONS)) {
    if (!workflow || roles.length < 2 || roles.some(role => !AI_ROLES.includes(role))) {
      errors.push(`AI workflow ${workflow} contains an unsupported role sequence.`);
    }
  }
  for (const [workflow, definition] of Object.entries(AI_WORKFLOW_CONTRACTS)) {
    if (definition.workflowId !== workflow || definition.stages.length !== AI_WORKFLOW_DEFINITIONS[workflow]?.length) {
      errors.push(`AI workflow contract ${workflow} is incomplete.`);
    }
    definition.stages.forEach(stage => {
      if (!AI_ROLES.includes(stage.role) || AI_ROLE_OUTPUT_SCHEMAS[stage.role] !== stage.outputSchema) {
        errors.push(`AI workflow contract ${workflow} has an invalid stage.`);
      }
      if (stage.required !== true) errors.push(`AI workflow contract ${workflow} must require every stage.`);
    });
  }
  if (AI_EVALUATION_VERDICTS.includes("authorized")) errors.push("Evaluation must not be an authorization state.");
  if (AI_DECISION_STATES.includes("executed")) errors.push("Decision proposal must not imply execution.");
  return [...new Set(errors)];
}
