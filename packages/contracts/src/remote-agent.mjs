export const REMOTE_AGENT_CONTRACT_VERSION = "1.0";

export const REMOTE_TARGET_STATES = Object.freeze(["planned", "approved", "revoked"]);
export const REMOTE_AGENT_STATES = Object.freeze(["pending", "active", "offline", "revoked"]);
export const REMOTE_AGENT_OPERATIONS = Object.freeze([
  "preflight",
  "health-check",
  "start-test",
  "stop-test",
  "cleanup-test"
]);
export const REMOTE_AGENT_TRANSPORTS = Object.freeze(["outbound-https"]);
export const REMOTE_AGENT_CAPABILITIES = Object.freeze([
  "artifact-pull",
  "product-test",
  "health-report"
]);
export const REMOTE_AGENT_SIGNATURE_ALGORITHM = "Ed25519";
export const REMOTE_ARTIFACT_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function getRemoteAgentContractSummary() {
  return Object.freeze({
    version: REMOTE_AGENT_CONTRACT_VERSION,
    targetStates: REMOTE_TARGET_STATES,
    agentStates: REMOTE_AGENT_STATES,
    operations: REMOTE_AGENT_OPERATIONS,
    transports: REMOTE_AGENT_TRANSPORTS,
    capabilities: REMOTE_AGENT_CAPABILITIES,
    signatureAlgorithm: REMOTE_AGENT_SIGNATURE_ALGORITHM,
    boundary: "Test-only outbound agent, immutable artifacts, allowlisted operations, no shell or public control listener"
  });
}

export function validateRemoteAgentContract() {
  const errors = [];
  if (REMOTE_AGENT_CONTRACT_VERSION !== "1.0") errors.push("Unexpected remote-agent contract version.");
  if (!REMOTE_TARGET_STATES.includes("approved") || !REMOTE_TARGET_STATES.includes("revoked")) {
    errors.push("Remote targets must support approval and revocation.");
  }
  if (!REMOTE_AGENT_STATES.includes("active") || !REMOTE_AGENT_STATES.includes("offline")) {
    errors.push("Remote agents must support active and offline states.");
  }
  for (const operation of ["preflight", "health-check", "start-test", "stop-test", "cleanup-test"]) {
    if (!REMOTE_AGENT_OPERATIONS.includes(operation)) errors.push(`Missing allowlisted operation ${operation}.`);
  }
  if (!REMOTE_AGENT_TRANSPORTS.includes("outbound-https")) errors.push("Outbound-only transport is required.");
  if (REMOTE_AGENT_SIGNATURE_ALGORITHM !== "Ed25519") errors.push("Remote dispatch must use Ed25519.");
  if (!REMOTE_ARTIFACT_DIGEST_PATTERN.test(`sha256:${"a".repeat(64)}`)) errors.push("Immutable artifact digest pattern is invalid.");
  return errors;
}
