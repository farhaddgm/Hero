export const PRODUCT_TEMPLATES_CONTRACT_VERSION = "1.0";

export const PRODUCT_TEMPLATE_KINDS = Object.freeze(["web", "mobile", "api"]);

export const PRODUCT_TEMPLATE_ROLES = Object.freeze(["analyst", "designer", "implementer", "tester", "reviewer", "writer"]);

export const PRODUCT_TEMPLATE_RISK_KEYS = Object.freeze([
  "internetFacing",
  "personalData",
  "regulatedData",
  "securitySensitive",
  "externalIntegrations",
  "requiresPrivilegedAccess"
]);

export const PRODUCT_TEMPLATE_REQUIRED_GATES = Object.freeze(["quality-gate", "independent-review", "assurance-gate"]);

export const PRODUCT_TEMPLATE_REQUIRED_FORBIDDEN = Object.freeze([
  "host-network",
  "privileged-container",
  "docker-socket",
  "host-bind-mount",
  "mutable-image-tag",
  "secret-in-image",
  "production-deploy-without-separate-authorization"
]);

export function getProductTemplatesContractSummary() {
  return Object.freeze({
    version: PRODUCT_TEMPLATES_CONTRACT_VERSION,
    kinds: PRODUCT_TEMPLATE_KINDS,
    roles: PRODUCT_TEMPLATE_ROLES,
    riskKeys: PRODUCT_TEMPLATE_RISK_KEYS,
    requiredGates: PRODUCT_TEMPLATE_REQUIRED_GATES,
    requiredForbidden: PRODUCT_TEMPLATE_REQUIRED_FORBIDDEN,
    riskRule: "A template may state 'no' for a risk question only when its structure guarantees it and it says why; every other answer stays 'unknown'. 'Unknown' is never 'no'.",
    boundary: "A template is data. Instantiating one produces a reviewable proposal; it never creates a repository, container, secret or deployment."
  });
}

export function validateProductTemplatesContract() {
  const errors = [];
  if (PRODUCT_TEMPLATES_CONTRACT_VERSION !== "1.0") errors.push("Unexpected product templates contract version.");
  if (PRODUCT_TEMPLATE_RISK_KEYS.length !== 6) errors.push("The six intake risk questions must all be covered.");
  for (const gate of ["independent-review", "quality-gate"]) if (!PRODUCT_TEMPLATE_REQUIRED_GATES.includes(gate)) errors.push(`Required gate ${gate} is missing.`);
  return Object.freeze(errors);
}
