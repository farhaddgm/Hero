import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  createRemoteAgentKeyPair,
  createRemoteAgentRegistry,
  createSignedRemoteDispatch,
  RemoteAgentError
} from "../packages/domain/src/remote-agent.mjs";

const RUN_ID = process.env.HERO_PF4_RUN_ID ?? `pf4-simulation-${Date.now()}`;
const EVIDENCE_DIR = path.resolve(process.env.HERO_PF4_EVIDENCE_DIR ?? `/tmp/hero-pf4-remote-agent-evidence-${RUN_ID}`);
const SOURCE_COMMIT = process.env.HERO_SOURCE_COMMIT ?? "workspace-uncommitted";
const PROJECT_ID = "project-safe";
const TARGET_ID = "target-test-one";
const AGENT_ID = "agent-test-one";
const ARTIFACT_DIGEST = `sha256:${"a".repeat(64)}`;
const OWNER = Object.freeze({ role: "project-owner", subject: "owner-one" });
const AUTHORIZATION = Object.freeze({
  authorizationId: "AUTH-PF4-SIM-001",
  status: "active",
  globalStop: false,
  scope: { environment: "test", projectId: PROJECT_ID, targetId: TARGET_ID },
  operations: ["remote-agent-enroll", "remote-agent-revoke"]
});
const CLOCK = () => "2026-09-18T10:00:10.000Z";

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o444 });
  chmodSync(file, 0o444);
}

function digest(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function expectCode(action, code) {
  try {
    action();
  } catch (error) {
    if (error instanceof RemoteAgentError && error.code === code) return { status: "blocked", code };
    throw error;
  }
  throw new Error(`Expected ${code} but action was accepted.`);
}

function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true, mode: 0o700 });
  const registry = createRemoteAgentRegistry({ now: CLOCK });
  const keys = createRemoteAgentKeyPair();
  const inventory = registry.registerTarget({
    actor: OWNER,
    authorization: AUTHORIZATION,
    inventory: {
      targetId: TARGET_ID,
      projectId: PROJECT_ID,
      ownerId: "owner-one",
      environment: "test",
      endpointReference: "target.test.internal",
      transport: "outbound-https",
      publicControlListener: false,
      shellAccess: false,
      capacity: { cpuCores: 2, memoryMiB: 512, maxConcurrentRuns: 1 },
      egress: { mode: "allowlist", domains: ["registry.example.test"] }
    }
  });
  const enrollment = registry.enrollAgent({
    actor: OWNER,
    authorization: AUTHORIZATION,
    projectId: PROJECT_ID,
    targetId: TARGET_ID,
    agentId: AGENT_ID,
    publicKey: keys.publicKey,
    capabilities: ["artifact-pull", "product-test", "health-report"]
  });
  const heartbeat = registry.heartbeat({
    projectId: PROJECT_ID,
    targetId: TARGET_ID,
    agentId: AGENT_ID,
    identityFingerprint: enrollment.publicKeyFingerprint,
    capabilities: ["artifact-pull", "product-test", "health-report"],
    health: "healthy",
    runtimeDigest: ARTIFACT_DIGEST
  });
  const payload = {
    dispatchId: "dispatch-test-one",
    nonce: "nonce-test-one",
    targetId: TARGET_ID,
    agentId: AGENT_ID,
    projectId: PROJECT_ID,
    authorizationId: AUTHORIZATION.authorizationId,
    operation: "health-check",
    artifactDigest: ARTIFACT_DIGEST,
    issuedAt: "2026-09-18T10:00:00.000Z",
    expiresAt: "2026-09-18T10:00:30.000Z"
  };
  const dispatch = createSignedRemoteDispatch({ payload, privateKey: keys.privateKey });
  const accepted = registry.simulateDispatch({ dispatch, projectId: PROJECT_ID, targetId: TARGET_ID, agentId: AGENT_ID });
  const negative = {
    tamper: expectCode(() => registry.simulateDispatch({ dispatch: { ...dispatch, payload: { ...dispatch.payload, operation: "start-test" } }, projectId: PROJECT_ID, targetId: TARGET_ID, agentId: AGENT_ID }), "DISPATCH_SIGNATURE_INVALID"),
    replay: expectCode(() => registry.simulateDispatch({ dispatch, projectId: PROJECT_ID, targetId: TARGET_ID, agentId: AGENT_ID }), "DISPATCH_REPLAY"),
    expiry: expectCode(() => registry.simulateDispatch({ dispatch: createSignedRemoteDispatch({ payload: { ...payload, dispatchId: "dispatch-expired-one", nonce: "nonce-expired-one" }, privateKey: keys.privateKey }), projectId: PROJECT_ID, targetId: TARGET_ID, agentId: AGENT_ID, now: "2026-09-18T10:01:00.000Z" }), "DISPATCH_EXPIRED"),
    mutableArtifact: expectCode(() => createSignedRemoteDispatch({ payload: { ...payload, dispatchId: "dispatch-mutable-one", nonce: "nonce-mutable-one", artifactDigest: "latest" }, privateKey: keys.privateKey }), "ARTIFACT_NOT_IMMUTABLE")
  };
  const revoked = registry.revokeAgent({ actor: OWNER, authorization: AUTHORIZATION, projectId: PROJECT_ID, targetId: TARGET_ID, agentId: AGENT_ID, reason: "owner requested emergency stop" });
  const afterRevoke = expectCode(() => registry.simulateDispatch({ dispatch: createSignedRemoteDispatch({ payload: { ...payload, dispatchId: "dispatch-revoked-one", nonce: "nonce-revoked-one" }, privateKey: keys.privateKey }), projectId: PROJECT_ID, targetId: TARGET_ID, agentId: AGENT_ID }), "AGENT_REVOKED");
  const evidence = {
    schema: "hero.product-factory-pf4-simulation/v1",
    runId: RUN_ID,
    sourceCommit: SOURCE_COMMIT,
    authorization: {
      id: AUTHORIZATION.authorizationId,
      mode: "synthetic-simulation-only",
      environment: "test",
      globalStop: false,
      remoteConnection: false,
      secretChange: false,
      production: false,
      pilot: false,
      liveProvider: false,
      externalSpend: false
    },
    target: { projectId: PROJECT_ID, targetId: TARGET_ID, environment: inventory.environment, transport: inventory.transport, state: inventory.state, publicControlListener: inventory.publicControlListener, shellAccess: inventory.shellAccess },
    agent: { agentId: AGENT_ID, stateBeforeRevoke: heartbeat.state, publicKeyFingerprint: enrollment.publicKeyFingerprint, capabilities: enrollment.capabilities, heartbeat: heartbeat.health, stateAfterRevoke: revoked.state },
    dispatch: { operation: accepted.operation, artifactDigest: accepted.artifactDigest, signatureAlgorithm: dispatch.algorithm, mode: accepted.mode, sideEffect: accepted.sideEffect },
    negative,
    revokeVerification: afterRevoke,
    auditDigest: digest(registry.view({ projectId: PROJECT_ID, targetId: TARGET_ID }).audit),
    evidence: { rawKeysStored: false, privateKeyStored: false, secretValues: false, networkCalls: 0, externalTargetTouched: false }
  };
  writeJson(path.join(EVIDENCE_DIR, "pf4-remote-agent-simulation.json"), evidence);
  console.log(JSON.stringify({ runId: RUN_ID, evidenceDir: EVIDENCE_DIR, evidenceDigest: digest(evidence), accepted: true, negativeChecks: Object.keys(negative).length, revoked: true }));
}

main();
