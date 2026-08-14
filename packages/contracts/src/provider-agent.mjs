export const PROVIDER_AGENT_CONTRACT_VERSION = "1.0";

export const PROVIDER_AGENT_IDS = Object.freeze([
  "chatgpt",
  "codex"
]);

export const PROVIDER_AGENT_MODES = Object.freeze([
  "deterministic",
  "disabled"
]);

export const PROVIDER_EXECUTION_STATES = Object.freeze([
  "completed",
  "blocked"
]);

export const PROVIDER_RESULT_FIELDS = Object.freeze([
  "files",
  "tests",
  "errors",
  "artifact"
]);

export function getProviderAgentContractSummary() {
  return Object.freeze({
    version: PROVIDER_AGENT_CONTRACT_VERSION,
    providers: PROVIDER_AGENT_IDS,
    modes: PROVIDER_AGENT_MODES,
    executionStates: PROVIDER_EXECUTION_STATES,
    resultFields: PROVIDER_RESULT_FIELDS,
    roleBoundary: "ChatGPT analyzes the product request; Codex receives the resulting approved task and reports execution evidence.",
    safetyBoundary: "Live providers are disabled by default. Task input never accepts credentials, and a real provider, external spend, merge, deployment or secret change needs a separate gate.",
    portabilityBoundary: "Provider results are plain structured data, so a CLI, API or deterministic test adapter can be selected without changing the orchestration core."
  });
}

export function validateProviderAgentContract() {
  const errors = [];
  if (PROVIDER_AGENT_CONTRACT_VERSION !== "1.0") errors.push("Unexpected provider-agent contract version.");
  for (const provider of ["chatgpt", "codex"]) {
    if (!PROVIDER_AGENT_IDS.includes(provider)) errors.push(`Required provider ${provider} is missing.`);
  }
  for (const mode of ["deterministic", "disabled"]) {
    if (!PROVIDER_AGENT_MODES.includes(mode)) errors.push(`Required provider mode ${mode} is missing.`);
  }
  for (const field of ["files", "tests", "errors", "artifact"]) {
    if (!PROVIDER_RESULT_FIELDS.includes(field)) errors.push(`Required structured result field ${field} is missing.`);
  }
  return errors;
}
