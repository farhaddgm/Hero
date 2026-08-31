import { PILOT_CONTRACT_VERSION } from "../../contracts/src/pilot.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SENSITIVE = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|Bearer\s+|-----BEGIN)/i;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function identifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new PilotDryRunError("INVALID_PILOT_INPUT", `${label} is invalid.`);
  return value;
}

function text(label, value, maximum) {
  if (typeof value !== "string" || value.trim() === "" || value.length > maximum || SENSITIVE.test(value)) {
    throw new PilotDryRunError("INVALID_PILOT_INPUT", `${label} is invalid or sensitive.`);
  }
  return value.trim();
}

export class PilotDryRunError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PilotDryRunError";
    this.code = code;
  }
}

/**
 * Exercises the already-governed Fake Agent path as a no-network pilot rehearsal.
 * It deliberately accepts behavior through ports, so it cannot accidentally
 * acquire a Provider, shell or deployment capability.
 */
export function runPilotDryRun({ pilotId, request = {}, createRequest, approveRequest, runFakeAgent, now = () => new Date().toISOString() } = {}) {
  identifier("pilotId", pilotId);
  if (typeof createRequest !== "function" || typeof approveRequest !== "function" || typeof runFakeAgent !== "function") {
    throw new PilotDryRunError("PILOT_PORTS_REQUIRED", "Pilot dry-run requires governed dashboard ports.");
  }
  const title = text("title", request.title, 120);
  const description = request.description === undefined ? "dry-run" : text("description", request.description, 1000);
  const projectId = identifier("projectId", request.projectId ?? "hero");
  const scenario = request.scenario ?? "success";
  const startedAt = now();
  const created = createRequest({ title, description, projectId, scenario });
  const approved = approveRequest(created.requestId);
  const completed = runFakeAgent(created.requestId);
  const cleaned = completed.result?.runnerStates?.every(state => state === "cleaned") === true;
  const acceptance = Object.freeze({
    passed: completed.status === "تکمیل" && cleaned,
    checks: Object.freeze([
      Object.freeze({ id: "request-created", passed: Boolean(created.requestId) }),
      Object.freeze({ id: "owner-approval-path", passed: approved.status === "آماده اجرا" }),
      Object.freeze({ id: "fake-run-completed", passed: completed.status === "تکمیل" }),
      Object.freeze({ id: "runner-cleaned", passed: cleaned })
    ])
  });
  if (!acceptance.passed) throw new PilotDryRunError("PILOT_ACCEPTANCE_FAILED", "Pilot dry-run acceptance checks did not pass.");
  return copy({
    pilotId,
    contractVersion: PILOT_CONTRACT_VERSION,
    state: "accepted",
    mode: "deterministic-no-network",
    startedAt,
    completedAt: now(),
    request: Object.freeze({ requestId: created.requestId, projectId, scenario, status: completed.status }),
    stages: Object.freeze([
      Object.freeze({ id: "intake", status: "completed" }),
      Object.freeze({ id: "approval", status: "completed" }),
      Object.freeze({ id: "fake-agent-run", status: "completed", eventCount: completed.result?.eventCount ?? 0 }),
      Object.freeze({ id: "acceptance", status: "passed" })
    ]),
    acceptance,
    evidence: Object.freeze({
      reference: `hero://pilot/${pilotId}`,
      external: false,
      providerCalled: false,
      externalSpend: false,
      deployment: false,
      secretChanged: false
    }),
    boundary: "dry-run evidence is not a real-provider or production readiness approval"
  });
}
