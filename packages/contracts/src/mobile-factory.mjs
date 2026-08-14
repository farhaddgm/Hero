export const MOBILE_FACTORY_CONTRACT_VERSION = "1.0";

export const MOBILE_FACTORY_STATES = Object.freeze([
  "ready",
  "tested",
  "blocked"
]);

export const MOBILE_FACTORY_DECISION_CODES = Object.freeze([
  "MOBILE_FACTORY_READY",
  "MOBILE_FACTORY_TESTED",
  "PLANNING_NOT_READY",
  "GLOBAL_STOP_ACTIVE",
  "ANDROID_PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION",
  "IOS_CLOUD_BUILD_REQUIRES_SEPARATE_AUTHORIZATION"
]);

export const MOBILE_FACTORY_TARGET_STACK = Object.freeze({
  mobile: "Expo + React Native + TypeScript",
  platforms: "Android and iOS from one portable codebase",
  api: "Versioned REST contract shared with the application factories",
  data: "PostgreSQL adapter contract; not provisioned by the factory",
  authentication: "Provider-neutral boundary; configuration requires separate authorization",
  testing: "Codex evidence through the bounded Quality Gate",
  androidPreview: "Isolated Android Preview; dispatch requires Preview authorization",
  iosBuild: "EAS/cloud build path; dispatch requires separate external-spend authorization"
});

export const MOBILE_FACTORY_RECIPE_FIELDS = Object.freeze([
  "recipeId",
  "version",
  "planning",
  "request",
  "screens",
  "features",
  "acceptanceCriteria",
  "handoff"
]);

export function validateMobileFactoryContract() {
  const errors = [];
  if (MOBILE_FACTORY_CONTRACT_VERSION !== "1.0") errors.push("Unexpected Mobile Factory contract version.");
  for (const state of ["ready", "tested", "blocked"]) {
    if (!MOBILE_FACTORY_STATES.includes(state)) errors.push(`Required Mobile Factory state is missing: ${state}.`);
  }
  for (const code of ["MOBILE_FACTORY_READY", "MOBILE_FACTORY_TESTED", "ANDROID_PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION", "IOS_CLOUD_BUILD_REQUIRES_SEPARATE_AUTHORIZATION"]) {
    if (!MOBILE_FACTORY_DECISION_CODES.includes(code)) errors.push(`Required Mobile Factory decision code is missing: ${code}.`);
  }
  if (!MOBILE_FACTORY_TARGET_STACK.mobile.includes("TypeScript")) errors.push("Mobile factory must standardize TypeScript.");
  if (!MOBILE_FACTORY_TARGET_STACK.iosBuild.includes("external-spend")) errors.push("iOS cloud build must remain separately authorized.");
  return errors;
}

export function getMobileFactoryContractSummary() {
  return Object.freeze({
    version: MOBILE_FACTORY_CONTRACT_VERSION,
    states: MOBILE_FACTORY_STATES,
    decisionCodes: MOBILE_FACTORY_DECISION_CODES,
    targetStack: MOBILE_FACTORY_TARGET_STACK,
    recipeFields: MOBILE_FACTORY_RECIPE_FIELDS,
    flow: "approved planning -> versioned mobile blueprint and feature recipe -> isolated tests -> independent review -> Android Preview and iOS cloud build only after their separate authorizations",
    safetyBoundary: "The factory does not install Expo, invoke a provider, provision data, configure authentication, start an Android Preview, dispatch a cloud build, deploy, spend money, or store secrets."
  });
}
