import assert from "node:assert/strict";
import test from "node:test";

import {
  getRemoteAgentContractSummary,
  validateRemoteAgentContract
} from "../packages/contracts/src/remote-agent.mjs";
import {
  createRemoteAgentKeyPair,
  createRemoteAgentRegistry,
  createSignedRemoteDispatch,
  RemoteAgentError
} from "../packages/domain/src/remote-agent.mjs";

const owner = Object.freeze({ role: "project-owner", subject: "owner-one" });
const admin = Object.freeze({ role: "admin", subject: "admin-one" });
const projectId = "project-safe";
const targetId = "target-test-one";
const agentId = "agent-test-one";
const artifactDigest = `sha256:${"a".repeat(64)}`;
const authorization = Object.freeze({
  authorizationId: "AUTH-PF4-SIM-001",
  status: "active",
  globalStop: false,
  scope: { environment: "test", projectId, targetId },
  operations: ["remote-agent-enroll", "remote-agent-revoke"]
});

function inventory(overrides = {}) {
  return {
    targetId,
    projectId,
    ownerId: "owner-one",
    environment: "test",
    endpointReference: "target.test.internal",
    transport: "outbound-https",
    publicControlListener: false,
    shellAccess: false,
    capacity: { cpuCores: 2, memoryMiB: 512, maxConcurrentRuns: 1 },
    egress: { mode: "allowlist", domains: ["registry.example.test"] },
    ...overrides
  };
}

function payload(overrides = {}) {
  return {
    dispatchId: "dispatch-test-one",
    nonce: "nonce-test-one",
    targetId,
    agentId,
    projectId,
    authorizationId: authorization.authorizationId,
    operation: "health-check",
    artifactDigest,
    issuedAt: "2026-09-18T10:00:00.000Z",
    expiresAt: "2026-09-18T10:00:30.000Z",
    ...overrides
  };
}

function setup() {
  const registry = createRemoteAgentRegistry({ now: () => "2026-09-18T10:00:10.000Z" });
  const keys = createRemoteAgentKeyPair();
  registry.registerTarget({ actor: owner, inventory: inventory(), authorization });
  registry.enrollAgent({ actor: owner, projectId, targetId, agentId, publicKey: keys.publicKey, capabilities: ["artifact-pull", "product-test", "health-report"], authorization });
  return { registry, keys };
}

test("remote-agent contract is versioned, outbound-only and allowlisted", () => {
  assert.deepEqual(validateRemoteAgentContract(), []);
  const summary = getRemoteAgentContractSummary();
  assert.equal(summary.version, "1.0");
  assert.deepEqual(summary.transports, ["outbound-https"]);
  assert.ok(summary.operations.includes("cleanup-test"));
  assert.equal(summary.signatureAlgorithm, "Ed25519");
});

test("Test target enrollment stores only redacted identity metadata and heartbeat is identity-bound", () => {
  const { registry, keys } = setup();
  const view = registry.view({ projectId, targetId });
  assert.equal(view.target.state, "approved");
  assert.equal(view.target.publicControlListener, false);
  assert.equal(view.agents[0].state, "active");
  assert.equal("publicKey" in view.agents[0], false);
  assert.equal(view.agents[0].publicKeyFingerprint, keys.fingerprint);
  const heartbeat = registry.heartbeat({
    projectId,
    targetId,
    agentId,
    identityFingerprint: keys.fingerprint,
    capabilities: ["health-report"],
    health: "healthy",
    runtimeDigest: artifactDigest
  });
  assert.equal(heartbeat.health, "healthy");
  assert.throws(
    () => registry.heartbeat({ projectId, targetId, agentId, identityFingerprint: "b".repeat(64), capabilities: ["health-report"] }),
    error => error instanceof RemoteAgentError && error.code === "AGENT_IDENTITY_REJECTED"
  );
});

test("signed dispatch accepts only immutable Test operations and rejects tamper, shell and replay", () => {
  const { registry, keys } = setup();
  const dispatch = createSignedRemoteDispatch({ payload: payload(), privateKey: keys.privateKey });
  const result = registry.simulateDispatch({ dispatch, projectId, targetId, agentId });
  assert.equal(result.code, "REMOTE_AGENT_SIMULATION_COMPLETED");
  assert.equal(result.mode, "simulation-only");
  assert.equal(result.sideEffect, false);
  assert.throws(
    () => registry.simulateDispatch({ dispatch, projectId, targetId, agentId }),
    error => error instanceof RemoteAgentError && error.code === "DISPATCH_REPLAY"
  );

  const tampered = { ...dispatch, payload: { ...dispatch.payload, operation: "start-test" } };
  assert.throws(
    () => registry.simulateDispatch({ dispatch: tampered, projectId, targetId, agentId }),
    error => error instanceof RemoteAgentError && error.code === "DISPATCH_SIGNATURE_INVALID"
  );
  const shellAttempt = { ...dispatch, payload: { ...dispatch.payload, dispatchId: "dispatch-shell-one", shell: "rm -rf /" } };
  assert.throws(
    () => registry.simulateDispatch({ dispatch: shellAttempt, projectId, targetId, agentId }),
    error => error instanceof RemoteAgentError && error.code === "DISPATCH_FIELDS_INVALID"
  );
  assert.throws(
    () => createSignedRemoteDispatch({ payload: payload({ dispatchId: "dispatch-mutable-one", artifactDigest: "latest" }), privateKey: keys.privateKey }),
    error => error instanceof RemoteAgentError && error.code === "ARTIFACT_NOT_IMMUTABLE"
  );
});

test("expired, cross-scope and sensitive dispatches fail closed", () => {
  const { registry, keys } = setup();
  const expired = createSignedRemoteDispatch({ payload: payload({ dispatchId: "dispatch-expired-one", nonce: "nonce-expired-one" }), privateKey: keys.privateKey });
  assert.throws(
    () => registry.simulateDispatch({ dispatch: expired, projectId, targetId, agentId, now: "2026-09-18T10:01:00.000Z" }),
    error => error instanceof RemoteAgentError && error.code === "DISPATCH_EXPIRED"
  );
  const crossScope = createSignedRemoteDispatch({ payload: payload({ dispatchId: "dispatch-cross-one", nonce: "nonce-cross-one", targetId: "target-other-one" }), privateKey: keys.privateKey });
  assert.throws(
    () => registry.simulateDispatch({ dispatch: crossScope, projectId, targetId, agentId }),
    error => error instanceof RemoteAgentError && error.code === "DISPATCH_SCOPE_MISMATCH"
  );
  assert.throws(
    () => createSignedRemoteDispatch({ payload: payload({ dispatchId: "dispatch-secret-one", nonce: "sk-abcdefghijkl" }), privateKey: keys.privateKey }),
    error => error instanceof RemoteAgentError && error.code === "SENSITIVE_INPUT_REJECTED"
  );
});

test("revocation blocks later dispatch and production target enrollment is impossible", () => {
  const { registry, keys } = setup();
  const revoked = registry.revokeAgent({ actor: admin, projectId, targetId, agentId, authorization, reason: "owner requested emergency stop" });
  assert.equal(revoked.state, "revoked");
  const dispatch = createSignedRemoteDispatch({ payload: payload({ dispatchId: "dispatch-revoked-one", nonce: "nonce-revoked-one" }), privateKey: keys.privateKey });
  assert.throws(
    () => registry.simulateDispatch({ dispatch, projectId, targetId, agentId }),
    error => error instanceof RemoteAgentError && error.code === "AGENT_REVOKED"
  );
  const otherRegistry = createRemoteAgentRegistry();
  assert.throws(
    () => otherRegistry.registerTarget({ actor: owner, inventory: inventory({ targetId: "target-production-one", environment: "production" }), authorization: { ...authorization, scope: { ...authorization.scope, targetId: "target-production-one" } } }),
    error => error instanceof RemoteAgentError && error.code === "TARGET_ENVIRONMENT_INVALID"
  );
});
