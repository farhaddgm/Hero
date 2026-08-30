export const DASHBOARD_CONTRACT_VERSION = "1.0";

export const DASHBOARD_REQUEST_STATES = Object.freeze([
  "نیازمند تأیید",
  "آماده اجرا",
  "در حال اجرا",
  "تکمیل",
  "رد شد",
  "متوقف"
]);

export const DASHBOARD_ACTIONS = Object.freeze([
  "create-request",
  "approve-request",
  "reject-request",
  "run-fake-agent",
  "stop-request",
  "set-full-autonomy",
  "set-global-stop",
  "review-team-contract",
  "review-team-deliverable",
  "request-team-rework",
  "set-team-autonomy",
  "define-project-principle",
  "review-project-principle",
  "request-project-principle-rework",
  "check-project-principles",
  "request-team-research",
  "start-team-research",
  "submit-team-research-report",
  "review-team-research",
  "decide-product-output",
  "register-release",
  "request-test-deployment",
  "record-test-deployment",
  "record-test-evidence",
  "request-production-approval",
  "approve-production",
  "request-production-promotion",
  "rollback-release"
]);

export function getDashboardContractSummary() {
  return Object.freeze({
    version: DASHBOARD_CONTRACT_VERSION,
    language: "fa-IR",
    requestStates: DASHBOARD_REQUEST_STATES,
    actions: DASHBOARD_ACTIONS,
    dispatchBoundary: "only the deterministic fake agent may run from the initial dashboard",
    authorityBoundary: "full autonomy changes readiness only; sensitive operations and live providers remain separately gated",
    stopBoundary: "global stop blocks a new approval or fake dispatch; queued work may be stopped before execution",
    teamBoundary: "team contract, principle, research and deliverable decisions are owner-gated, versioned and recorded in the append-only event log",
    principlesBoundary: "critical principles are versioned, owner-reviewed and blocking at configured control points",
    outputBoundary: "the owner receives a multi-option product output advisory before dispatch; only an approved option becomes the production basis",
    releaseBoundary: "the exact tested commit moves from test to production only after owner approval, explicit command and separate production authorization"
  });
}

export function validateDashboardContract() {
  const errors = [];
  if (DASHBOARD_CONTRACT_VERSION !== "1.0") errors.push("Unexpected dashboard contract version.");
  for (const state of ["نیازمند تأیید", "آماده اجرا", "تکمیل", "متوقف"]) {
    if (!DASHBOARD_REQUEST_STATES.includes(state)) errors.push(`Required dashboard state is missing: ${state}.`);
  }
  for (const action of ["approve-request", "run-fake-agent", "set-global-stop"]) {
    if (!DASHBOARD_ACTIONS.includes(action)) errors.push(`Required dashboard action is missing: ${action}.`);
  }
  return errors;
}
