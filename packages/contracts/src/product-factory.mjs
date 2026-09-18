export const PRODUCT_FACTORY_CONTRACT_VERSION = "1.0";

export const PRODUCT_TYPES = Object.freeze(["application", "web", "service", "data", "security-tool", "library", "other"]);
export const PRODUCT_RISK_LEVELS = Object.freeze(["low", "standard", "high", "critical"]);
export const PRODUCT_AUTONOMY_MODES = Object.freeze(["approval-each-stage", "approved-autonomous"]);
export const PRODUCT_TARGET_KINDS = Object.freeze(["product-test-local-isolated", "remote-product-target"]);
export const PRODUCT_EXECUTION_MODES = Object.freeze(["plan-only", "isolated-test", "remote-agent"]);
export const PRODUCT_RUNTIME_STATES = Object.freeze(["proposed", "approved"]);
export const PRODUCT_NETWORK_POLICIES = Object.freeze(["disabled", "egress-allowlist"]);
export const PRODUCT_RUNTIME_NETWORK_MODES = Object.freeze(["none", "bridge"]);

export const PRODUCT_RUNTIME_DEFAULTS = Object.freeze({
  environment: "test",
  executionMode: "plan-only",
  network: "disabled",
  timeoutSeconds: 1_800,
  memoryMiB: 1_024,
  cpuLimit: 1,
  pidsLimit: 256,
  maxConcurrentRuns: 1,
  repositoryMode: "separate-product-repository",
  portability: "oci-image-and-reproducible-bundle",
  privileged: false,
  hostNetwork: false,
  dockerSocket: false,
  hostMounts: false,
  nonRoot: true,
  readOnlyFilesystem: true,
  noNewPrivileges: true
});

export const PRODUCT_RUNTIME_EFFECTS = Object.freeze([
  "repositoryMutation",
  "containerStart",
  "databaseProvision",
  "secretWrite",
  "deployment",
  "externalSpend",
  "externalMessage"
]);

export function getProductFactoryContractSummary() {
  return Object.freeze({
    version: PRODUCT_FACTORY_CONTRACT_VERSION,
    productTypes: PRODUCT_TYPES,
    riskLevels: PRODUCT_RISK_LEVELS,
    autonomyModes: PRODUCT_AUTONOMY_MODES,
    targetKinds: PRODUCT_TARGET_KINDS,
    executionModes: PRODUCT_EXECUTION_MODES,
    runtimeStates: PRODUCT_RUNTIME_STATES,
    networkPolicies: PRODUCT_NETWORK_POLICIES,
    runtimeNetworkModes: PRODUCT_RUNTIME_NETWORK_MODES,
    runtimeDefaults: PRODUCT_RUNTIME_DEFAULTS,
    effects: PRODUCT_RUNTIME_EFFECTS,
    boundary: "intake and foundation produce a reviewable plan; execution requires a later authorization"
  });
}

export function validateProductFactoryContract() {
  const errors = [];
  if (PRODUCT_FACTORY_CONTRACT_VERSION !== "1.0") errors.push("Unexpected product factory contract version.");
  if (!PRODUCT_TYPES.includes("security-tool")) errors.push("Security-sensitive product type is required.");
  if (!PRODUCT_RISK_LEVELS.includes("critical")) errors.push("Critical risk level is required.");
  if (PRODUCT_RUNTIME_DEFAULTS.executionMode !== "plan-only") errors.push("Factory runtime must default to plan-only.");
  if (!PRODUCT_RUNTIME_STATES.includes("proposed") || !PRODUCT_RUNTIME_STATES.includes("approved")) errors.push("Runtime plans must have proposed and approved states.");
  if (PRODUCT_RUNTIME_DEFAULTS.network !== "disabled") errors.push("Factory runtime must default to disabled network.");
  if (!PRODUCT_RUNTIME_NETWORK_MODES.includes("none") || PRODUCT_RUNTIME_NETWORK_MODES.includes("host")) errors.push("Runtime network modes must exclude host network.");
  if (PRODUCT_RUNTIME_DEFAULTS.privileged || PRODUCT_RUNTIME_DEFAULTS.hostNetwork || PRODUCT_RUNTIME_DEFAULTS.dockerSocket || PRODUCT_RUNTIME_DEFAULTS.hostMounts) errors.push("Factory runtime must deny privileged and host escape controls by default.");
  if (!PRODUCT_RUNTIME_EFFECTS.includes("externalSpend")) errors.push("External spend must be an explicit effect gate.");
  return errors;
}

export function validateProductRuntimePlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return ["runtime plan must be an object."];
  if (plan.schemaVersion !== PRODUCT_FACTORY_CONTRACT_VERSION) errors.push("runtime plan schemaVersion is invalid.");
  if (typeof plan.projectId !== "string" || !/^[a-z][a-z0-9-]{2,62}$/.test(plan.projectId)) errors.push("runtime plan projectId is invalid.");
  if (!PRODUCT_RUNTIME_STATES.includes(plan.state)) errors.push("runtime plan state is invalid.");
  if (!PRODUCT_TARGET_KINDS.includes(plan.target?.kind)) errors.push("runtime plan target kind is invalid.");
  if (plan.target?.environment !== "test") errors.push("runtime plan must target Test.");
  if (!PRODUCT_EXECUTION_MODES.includes(plan.execution?.mode)) errors.push("runtime plan execution mode is invalid.");
  if (!PRODUCT_NETWORK_POLICIES.includes(plan.execution?.network)) errors.push("runtime plan network policy is invalid.");
  if (!Number.isInteger(plan.execution?.timeoutSeconds) || plan.execution.timeoutSeconds < 30 || plan.execution.timeoutSeconds > PRODUCT_RUNTIME_DEFAULTS.timeoutSeconds) errors.push("runtime plan timeout exceeds the Test quota.");
  if (!Number.isInteger(plan.execution?.maxConcurrentRuns) || plan.execution.maxConcurrentRuns < 1 || plan.execution.maxConcurrentRuns > PRODUCT_RUNTIME_DEFAULTS.maxConcurrentRuns) errors.push("runtime plan concurrency exceeds the Test quota.");
  if (!Number.isFinite(plan.resources?.cpuLimit) || plan.resources.cpuLimit <= 0 || plan.resources.cpuLimit > PRODUCT_RUNTIME_DEFAULTS.cpuLimit) errors.push("runtime plan CPU quota is invalid.");
  if (!Number.isInteger(plan.resources?.memoryMiB) || plan.resources.memoryMiB <= 0 || plan.resources.memoryMiB > PRODUCT_RUNTIME_DEFAULTS.memoryMiB) errors.push("runtime plan memory quota is invalid.");
  if (!Number.isInteger(plan.resources?.pidsLimit) || plan.resources.pidsLimit < 32 || plan.resources.pidsLimit > PRODUCT_RUNTIME_DEFAULTS.pidsLimit) errors.push("runtime plan process quota is invalid.");
  if (!Array.isArray(plan.isolation?.ports) || plan.isolation.ports.some(port => !Number.isInteger(port) || port < 1024 || port > 65535)) errors.push("runtime plan ports are invalid.");
  if (!Array.isArray(plan.isolation?.hostMounts) || plan.isolation.hostMounts.length > 0) errors.push("runtime plan host mounts must remain empty.");
  for (const effect of PRODUCT_RUNTIME_EFFECTS) {
    if (plan.effects?.[effect] !== false) errors.push(`runtime plan effect must remain false before authorization: ${effect}.`);
  }
  for (const field of ["privileged", "hostNetwork", "dockerSocket", "hostMounts", "nonRoot", "readOnlyFilesystem", "noNewPrivileges"]) {
    if (plan.security?.[field] !== PRODUCT_RUNTIME_DEFAULTS[field]) errors.push(`runtime plan security invariant is invalid: ${field}.`);
  }
  return errors;
}
