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
  "set-global-stop"
]);

export function getDashboardContractSummary() {
  return Object.freeze({
    version: DASHBOARD_CONTRACT_VERSION,
    language: "fa-IR",
    requestStates: DASHBOARD_REQUEST_STATES,
    actions: DASHBOARD_ACTIONS,
    dispatchBoundary: "only the deterministic fake agent may run from the initial dashboard",
    authorityBoundary: "full autonomy changes readiness only; sensitive operations and live providers remain separately gated",
    stopBoundary: "global stop blocks a new approval or fake dispatch; queued work may be stopped before execution"
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
