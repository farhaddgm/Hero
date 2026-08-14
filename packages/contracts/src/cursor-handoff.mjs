export const CURSOR_HANDOFF_CONTRACT_VERSION = "1.0";

export const CURSOR_HANDOFF_PROVIDER = "cursor";

export const CURSOR_HANDOFF_MODES = Object.freeze([
  "deterministic",
  "disabled"
]);

export const CURSOR_HANDOFF_STATES = Object.freeze([
  "ready",
  "blocked"
]);

export const CURSOR_HANDOFF_PACKAGE_FIELDS = Object.freeze([
  "handoffId",
  "context",
  "workspace",
  "commands",
  "continuation",
  "artifact",
  "boundary"
]);

export function getCursorHandoffContractSummary() {
  return Object.freeze({
    version: CURSOR_HANDOFF_CONTRACT_VERSION,
    provider: CURSOR_HANDOFF_PROVIDER,
    modes: CURSOR_HANDOFF_MODES,
    states: CURSOR_HANDOFF_STATES,
    packageFields: CURSOR_HANDOFF_PACKAGE_FIELDS,
    roleBoundary: "Cursor is the human control room. Hero prepares a portable context and review handoff; it never invokes Cursor or edits a repository through Cursor.",
    portabilityBoundary: "The handoff contains only relative workspace references and internal hero artifacts; absolute host paths are rejected.",
    safetyBoundary: "Live Cursor integration is disabled by default. Every suggested command requires explicit human confirmation, and merge, push, secrets, spend and code changes remain separately gated."
  });
}

export function validateCursorHandoffContract() {
  const errors = [];
  if (CURSOR_HANDOFF_CONTRACT_VERSION !== "1.0") errors.push("Unexpected Cursor handoff contract version.");
  if (CURSOR_HANDOFF_PROVIDER !== "cursor") errors.push("Cursor handoff provider is missing.");
  for (const mode of ["deterministic", "disabled"]) {
    if (!CURSOR_HANDOFF_MODES.includes(mode)) errors.push(`Required Cursor handoff mode ${mode} is missing.`);
  }
  for (const state of ["ready", "blocked"]) {
    if (!CURSOR_HANDOFF_STATES.includes(state)) errors.push(`Required Cursor handoff state ${state} is missing.`);
  }
  for (const field of ["handoffId", "context", "workspace", "commands", "continuation", "artifact", "boundary"]) {
    if (!CURSOR_HANDOFF_PACKAGE_FIELDS.includes(field)) errors.push(`Required Cursor handoff field ${field} is missing.`);
  }
  return errors;
}
