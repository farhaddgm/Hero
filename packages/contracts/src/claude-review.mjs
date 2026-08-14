export const CLAUDE_REVIEW_CONTRACT_VERSION = "1.0";

export const CLAUDE_REVIEW_PROVIDER = "claude";

export const CLAUDE_REVIEW_MODES = Object.freeze([
  "deterministic",
  "disabled"
]);

export const CLAUDE_REVIEW_OUTCOMES = Object.freeze([
  "approved",
  "changes-requested",
  "blocked"
]);

export const CLAUDE_REVIEW_CATEGORIES = Object.freeze([
  "architecture",
  "security",
  "edge-case",
  "tests"
]);

export const CLAUDE_REVIEW_SEVERITIES = Object.freeze([
  "critical",
  "high",
  "medium",
  "low"
]);

export const CLAUDE_REVIEW_FINDING_FIELDS = Object.freeze([
  "id",
  "category",
  "severity",
  "reference",
  "problem",
  "recommendedAction"
]);

export function getClaudeReviewContractSummary() {
  return Object.freeze({
    version: CLAUDE_REVIEW_CONTRACT_VERSION,
    provider: CLAUDE_REVIEW_PROVIDER,
    modes: CLAUDE_REVIEW_MODES,
    outcomes: CLAUDE_REVIEW_OUTCOMES,
    categories: CLAUDE_REVIEW_CATEGORIES,
    severities: CLAUDE_REVIEW_SEVERITIES,
    findingFields: CLAUDE_REVIEW_FINDING_FIELDS,
    roleBoundary: "Claude reviews structured Codex execution evidence independently and returns findings; it never edits the repository.",
    safetyBoundary: "Live Claude is disabled by default. Credentials, network access, external spend and direct fixes are outside this contract and separately gated.",
    correctionBoundary: "A changes-requested result is evidence only. Every code correction requires a separately authorized task and version-bound document."
  });
}

export function validateClaudeReviewContract() {
  const errors = [];
  if (CLAUDE_REVIEW_CONTRACT_VERSION !== "1.0") errors.push("Unexpected Claude review contract version.");
  if (CLAUDE_REVIEW_PROVIDER !== "claude") errors.push("Claude reviewer provider is missing.");
  for (const mode of ["deterministic", "disabled"]) {
    if (!CLAUDE_REVIEW_MODES.includes(mode)) errors.push(`Required Claude review mode ${mode} is missing.`);
  }
  for (const category of ["architecture", "security", "edge-case", "tests"]) {
    if (!CLAUDE_REVIEW_CATEGORIES.includes(category)) errors.push(`Required review category ${category} is missing.`);
  }
  for (const field of ["id", "category", "severity", "reference", "problem", "recommendedAction"]) {
    if (!CLAUDE_REVIEW_FINDING_FIELDS.includes(field)) errors.push(`Required finding field ${field} is missing.`);
  }
  return errors;
}
