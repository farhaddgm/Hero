export const WEB_FACTORY_CONTRACT_VERSION = "1.0";

export const WEB_FACTORY_STATES = Object.freeze([
  "ready",
  "tested",
  "blocked"
]);

export const WEB_FACTORY_DECISION_CODES = Object.freeze([
  "WEB_FACTORY_READY",
  "WEB_FACTORY_TESTED",
  "PLANNING_NOT_READY",
  "GLOBAL_STOP_ACTIVE",
  "PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION"
]);

export const WEB_FACTORY_TARGET_STACK = Object.freeze({
  frontend: "Next.js + React + TypeScript",
  api: "Route handlers with a versioned REST contract",
  data: "PostgreSQL adapter contract; not provisioned by the factory",
  authentication: "Provider-neutral boundary; configuration requires separate authorization",
  testing: "Codex evidence through the bounded Quality Gate",
  preview: "Isolated web preview; dispatch requires its own authorization"
});

export const WEB_FACTORY_RECIPE_FIELDS = Object.freeze([
  "recipeId",
  "version",
  "planning",
  "request",
  "routes",
  "features",
  "acceptanceCriteria",
  "handoff"
]);

export function validateWebFactoryContract() {
  const errors = [];
  if (WEB_FACTORY_CONTRACT_VERSION !== "1.0") errors.push("Unexpected Web Factory contract version.");
  for (const state of ["ready", "tested", "blocked"]) {
    if (!WEB_FACTORY_STATES.includes(state)) errors.push(`Required Web Factory state is missing: ${state}.`);
  }
  for (const code of ["WEB_FACTORY_READY", "WEB_FACTORY_TESTED", "PLANNING_NOT_READY", "PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION"]) {
    if (!WEB_FACTORY_DECISION_CODES.includes(code)) errors.push(`Required Web Factory decision code is missing: ${code}.`);
  }
  if (!WEB_FACTORY_TARGET_STACK.frontend.includes("TypeScript")) errors.push("Web factory must standardize TypeScript.");
  if (!WEB_FACTORY_TARGET_STACK.preview.includes("authorization")) errors.push("Preview must remain explicitly gated.");
  return errors;
}

export function getWebFactoryContractSummary() {
  return Object.freeze({
    version: WEB_FACTORY_CONTRACT_VERSION,
    states: WEB_FACTORY_STATES,
    decisionCodes: WEB_FACTORY_DECISION_CODES,
    targetStack: WEB_FACTORY_TARGET_STACK,
    recipeFields: WEB_FACTORY_RECIPE_FIELDS,
    flow: "approved planning -> versioned blueprint and feature recipe -> isolated tests -> independent review -> preview only after separate authorization",
    safetyBoundary: "The factory does not provision a database, configure authentication, invoke a provider, publish a preview, deploy, spend money, or store secrets."
  });
}
