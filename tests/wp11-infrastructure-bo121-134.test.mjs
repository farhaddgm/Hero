import assert from "node:assert/strict";
import test from "node:test";

import { INFRASTRUCTURE_THREAT_MODEL, validateInfrastructureControlContract } from "../packages/contracts/src/infrastructure-control.mjs";
import { createGithubMetadataAdapter } from "../packages/domain/src/github-metadata-adapter.mjs";
import { createInfrastructureControl } from "../packages/domain/src/infrastructure-control.mjs";

const owner = { role: "project-owner", subject: "owner-one" }; const admin = { role: "admin", subject: "admin-one" }; const viewer = { role: "viewer", subject: "viewer-one" };
const projectId = "project-one"; const other = "project-two";
let clock = Date.parse("2026-10-08T12:00:00.000Z"); const now = () => new Date(clock).toISOString();
const code = fn => { try { fn(); } catch (error) { return error.code; } return null; };
const codeAsync = async fn => { try { await fn(); } catch (error) { return error.code; } return null; };

function world(options = {}) {
  const control = createInfrastructureControl({ now, ...options });
  control.onboardServer({ actor: admin, projectId, serverId: "server-test", address: "10.0.0.4", credentialReference: "secret-ref:ssh-one", environment: "test" });
  control.onboardServer({ actor: admin, projectId, serverId: "server-prod", address: "prod.example.com", credentialReference: "secret-ref:ssh-prod", environment: "production" });
  return control;
}
function enroll(control, nodeId, serverId = "server-test", capabilities = ["runner", "telemetry"]) {
  const enrollment = control.createEnrollment({ actor: admin, projectId, nodeId, serverId, expiresAt: new Date(clock + 3600_000).toISOString() });
  return control.registerNode({ projectId, nodeId, enrollmentNonce: enrollment.enrollmentNonce, identityFingerprint: `fingerprint-${nodeId}-0001`, capabilities });
}

test("BO-121 exactly three environments exist and anything else is refused", () => {
  const control = world();
  assert.deepEqual(control.environments(), ["development", "test", "production"]);
  assert.equal(code(() => control.onboardServer({ actor: admin, projectId, serverId: "server-x", address: "10.0.0.9", credentialReference: "secret-ref:x-one", environment: "staging" })), "SERVER_INVALID");
  assert.equal(code(() => control.setState({ actor: admin, projectId, environment: "qa", desiredState: {}, observedState: {} })), "ENVIRONMENT_INVALID");
  assert.deepEqual(validateInfrastructureControlContract(), []);
});

test("BO-122 GitHub metadata is read-only, allowlisted, reduced to safe fields and never fetched without a connection", async () => {
  const none = world({ githubMetadata: createGithubMetadataAdapter() });
  none.registerRepository({ actor: admin, projectId, repositoryId: "repo-one", name: "owner/repo" });
  assert.equal(await codeAsync(() => none.syncRepositoryMetadata({ actor: admin, projectId, repositoryId: "repo-one" })), "GITHUB_NOT_CONNECTED");
  const seen = [];
  const adapter = createGithubMetadataAdapter({ fetchJson: async path => {
    seen.push(path);
    if (path.endsWith("/branches")) return [{ name: "main", protected: true, commit: { sha: "ABCDEF1234567" }, token: "ghp_leak" }];
    if (path.endsWith("/workflows")) return { workflows: [{ name: "CI", path: ".github/workflows/ci.yml", state: "active" }] };
    if (path.endsWith("/releases")) return [{ tag_name: "v1", name: "One", prerelease: true, published_at: "2026-10-01T00:00:00Z", body: "private notes" }];
    if (path.endsWith("/deployments")) return [{ environment: "test", ref: "main", sha: "abcdef1234567", created_at: "2026-10-02T00:00:00Z", creator: { email: "x@example.com" } }];
    return { full_name: "owner/repo", default_branch: "main", private: true, pushed_at: "2026-10-03T00:00:00Z", clone_url: "https://example.invalid/leak" };
  } });
  const control = world({ githubMetadata: adapter });
  control.registerRepository({ actor: admin, projectId, repositoryId: "repo-one", name: "owner/repo" });
  const synced = await control.syncRepositoryMetadata({ actor: admin, projectId, repositoryId: "repo-one" });
  assert.equal(synced.mode, "read-only-metadata");
  assert.equal(synced.metadata.branches[0].headSha, "abcdef1234567");
  assert.equal(JSON.stringify(synced).includes("ghp_leak") || JSON.stringify(synced).includes("private notes") || JSON.stringify(synced).includes("x@example.com") || JSON.stringify(synced).includes("clone_url"), false);
  assert.equal(seen.every(path => /^\/repos\/owner\/repo(\/(branches|actions\/workflows|releases|deployments))?$/.test(path)), true);
  assert.equal(await codeAsync(() => adapter.describe({ owner: "../etc", repo: "x" })), "GITHUB_REPOSITORY_INVALID");
});

test("BO-123/127 BO-134 agent impersonation, replay, rotation and revocation", () => {
  const control = world();
  const node = enroll(control, "node-one");
  assert.match(node.nodeToken, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(JSON.stringify(control.view({ actor: viewer, projectId })).includes(node.nodeToken), false, "the token is never shown again");
  assert.equal(JSON.stringify(control.view({ actor: viewer, projectId })).includes("tokenHash"), false);
  const beat = (sequence, extra = {}) => control.heartbeat({ projectId, nodeId: "node-one", nodeToken: node.nodeToken, identityFingerprint: "fingerprint-node-one-0001", sequence, ...extra });
  assert.equal(beat(1).liveState, "online");
  // impersonation: wrong token, wrong fingerprint, missing token all look the same
  assert.equal(code(() => beat(2, { nodeToken: "x".repeat(43) })), "NODE_IMPERSONATION_REJECTED");
  assert.equal(code(() => beat(2, { identityFingerprint: "attacker-fingerprint-1" })), "NODE_IMPERSONATION_REJECTED");
  assert.equal(code(() => control.heartbeat({ projectId, nodeId: "node-one", identityFingerprint: "fingerprint-node-one-0001", sequence: 2 })), "NODE_IMPERSONATION_REJECTED");
  assert.equal(code(() => control.heartbeat({ projectId: other, nodeId: "node-one", nodeToken: node.nodeToken, identityFingerprint: "fingerprint-node-one-0001", sequence: 2 })), "NODE_NOT_FOUND", "another project cannot reach the node");
  // replay
  assert.equal(code(() => beat(1)), "NODE_REPLAY_REJECTED");
  assert.equal(code(() => beat(0)), "NODE_REPLAY_REJECTED");
  assert.equal(beat(5).sequence, 5);
  assert.equal(code(() => beat(5)), "NODE_REPLAY_REJECTED");
  // capability report: only known capabilities
  assert.equal(code(() => beat(6, { capabilities: ["runner", "root-shell"] })), "NODE_CAPABILITY_INVALID");
  // one-time enrolment
  const again = control.createEnrollment({ actor: admin, projectId, nodeId: "node-two", serverId: "server-test", expiresAt: new Date(clock + 3600_000).toISOString() });
  control.registerNode({ projectId, nodeId: "node-two", enrollmentNonce: again.enrollmentNonce, identityFingerprint: "fingerprint-node-two-0001" });
  assert.equal(code(() => control.registerNode({ projectId, nodeId: "node-two", enrollmentNonce: again.enrollmentNonce, identityFingerprint: "fingerprint-node-two-0001" })), "ENROLLMENT_REJECTED");
  assert.equal(code(() => control.createEnrollment({ actor: admin, projectId, nodeId: "node-three", serverId: "server-test", expiresAt: new Date(clock - 1000).toISOString() })), "ENROLLMENT_EXPIRY_INVALID");
  assert.equal(code(() => control.createEnrollment({ actor: admin, projectId, nodeId: "node-three", serverId: "server-test", expiresAt: new Date(clock + 48 * 3600_000).toISOString() })), "ENROLLMENT_EXPIRY_INVALID");
  // rotation: the old token stops working at once, a new one works
  const rotated = control.rotateNodeIdentity({ actor: admin, projectId, nodeId: "node-one", identityFingerprint: "fingerprint-node-one-0002" });
  assert.equal(code(() => beat(7)), "NODE_IMPERSONATION_REJECTED");
  assert.equal(control.heartbeat({ projectId, nodeId: "node-one", nodeToken: rotated.nodeToken, identityFingerprint: "fingerprint-node-one-0002", sequence: 7 }).liveState, "online");
  assert.equal(code(() => control.heartbeat({ projectId, nodeId: "node-one", nodeToken: rotated.nodeToken, identityFingerprint: "fingerprint-node-one-0002", sequence: 5 })), "NODE_REPLAY_REJECTED", "the sequence floor survives rotation");
  // viewer cannot rotate or revoke
  assert.equal(code(() => control.rotateNodeIdentity({ actor: viewer, projectId, nodeId: "node-one", identityFingerprint: "fingerprint-node-one-0003" })), "PROJECT_WRITE_REQUIRED");
  control.revokeNode({ actor: admin, projectId, nodeId: "node-one", reason: "compromised" });
  assert.equal(code(() => control.heartbeat({ projectId, nodeId: "node-one", nodeToken: rotated.nodeToken, identityFingerprint: "fingerprint-node-one-0002", sequence: 9 })), "NODE_REVOKED");
  assert.equal(code(() => control.rotateNodeIdentity({ actor: admin, projectId, nodeId: "node-one", identityFingerprint: "fingerprint-node-one-0004" })), "NODE_REVOKED");
});

test("BO-134 an offline node is shown offline and cannot take a runner", () => {
  const control = world();
  const node = enroll(control, "node-one");
  control.setRunnerPolicy({ actor: admin, projectId, environment: "test", maxConcurrent: 1, nodeIds: ["node-one"] });
  assert.equal(control.view({ actor: viewer, projectId }).nodes[0].liveState, "awaiting-heartbeat");
  assert.equal(code(() => control.acquireRunner({ actor: admin, projectId, environment: "test", runId: "run-one" })), "RUNNER_UNAVAILABLE");
  control.heartbeat({ projectId, nodeId: "node-one", nodeToken: node.nodeToken, identityFingerprint: "fingerprint-node-one-0001", sequence: 1 });
  assert.equal(control.acquireRunner({ actor: admin, projectId, environment: "test", runId: "run-one" }).nodeId, "node-one");
  control.releaseRunner({ actor: admin, projectId, runId: "run-one" });
  clock += 121_000;
  assert.equal(control.view({ actor: viewer, projectId }).nodes[0].liveState, "offline");
  assert.equal(code(() => control.acquireRunner({ actor: admin, projectId, environment: "test", runId: "run-two" })), "RUNNER_UNAVAILABLE");
  clock -= 121_000;
});

test("BO-126 the bootstrap artifact is generated by Hero, pinned by SHA-256, and executes nothing", () => {
  const control = world();
  const plan = control.connectivityPlan({ actor: admin, projectId, serverId: "server-test" });
  assert.match(plan.bootstrapDigest, /^[a-f0-9]{64}$/);
  assert.match(plan.bootstrapArtifact.content, /direction=outbound-only/);
  assert.equal(plan.state, "plan-only-no-bootstrap-executed");
  assert.equal(control.connectivityPlan({ actor: admin, projectId, serverId: "server-test", bootstrapDigest: plan.bootstrapDigest }).bootstrapDigest, plan.bootstrapDigest);
  assert.equal(code(() => control.connectivityPlan({ actor: admin, projectId, serverId: "server-test", bootstrapDigest: "a".repeat(64) })), "BOOTSTRAP_DIGEST_MISMATCH");
  assert.equal(code(() => control.connectivityPlan({ actor: admin, projectId, serverId: "server-test", bootstrapDigest: "short" })), "BOOTSTRAP_DIGEST_INVALID");
  assert.notEqual(control.connectivityPlan({ actor: admin, projectId, serverId: "server-prod" }).bootstrapDigest, plan.bootstrapDigest, "each server has its own artifact");
});

test("BO-125 servers need a plain address and a secret reference, never a URL or a secret", () => {
  const control = world();
  for (const address of ["http://10.0.0.4", "10.0.0.4/admin", "user:pass@host", "a b", ""]) assert.equal(code(() => control.onboardServer({ actor: admin, projectId, serverId: "server-new", address, credentialReference: "secret-ref:ssh-two", environment: "test" })), "SERVER_INVALID", address);
  assert.equal(code(() => control.onboardServer({ actor: admin, projectId, serverId: "server-new", address: "10.0.0.5", credentialReference: "hunter2-password", environment: "test" })), "SERVER_INVALID");
  assert.equal(code(() => control.onboardServer({ actor: admin, projectId: other, serverId: "server-test", address: "10.0.0.6", credentialReference: "secret-ref:ssh-three", environment: "test" })), "SERVER_EXISTS", "an id cannot be taken over from another project");
  assert.equal(code(() => control.onboardServer({ actor: viewer, projectId, serverId: "server-new", address: "10.0.0.5", credentialReference: "secret-ref:ssh-two", environment: "test" })), "PROJECT_WRITE_REQUIRED");
});

test("BO-128 reconcile only proposes; it never executes", () => {
  const control = world();
  control.setState({ actor: admin, projectId, environment: "test", desiredState: { version: "one", apiToken: "leak-me" }, observedState: { version: "two" } });
  const result = control.reconcile({ actor: viewer, projectId, environment: "test" });
  assert.equal(result.decision, "proposal-required");
  assert.equal(result.automaticExecution, "forbidden-without-separate-dispatch");
  assert.equal(JSON.stringify(control.view({ actor: viewer, projectId })).includes("leak-me"), false);
  control.setState({ actor: admin, projectId, environment: "test", desiredState: { version: "two" }, observedState: { version: "two" } });
  assert.equal(control.reconcile({ actor: viewer, projectId, environment: "test" }).decision, "in-sync");
});

test("BO-129 runner isolation is per project and environment, with a concurrency cap", () => {
  const control = world();
  const testNode = enroll(control, "node-test"); const prodNode = enroll(control, "node-prod", "server-prod"); const second = enroll(control, "node-two");
  for (const [node, sequence] of [[testNode, "node-test"], [second, "node-two"], [prodNode, "node-prod"]]) control.heartbeat({ projectId, nodeId: sequence, nodeToken: node.nodeToken, identityFingerprint: `fingerprint-${sequence}-0001`, sequence: 1 });
  assert.equal(code(() => control.setRunnerPolicy({ actor: admin, projectId, environment: "production", maxConcurrent: 1, nodeIds: ["node-test"] })), "RUNNER_ENVIRONMENT_MISMATCH");
  assert.equal(code(() => control.setRunnerPolicy({ actor: admin, projectId, environment: "test", maxConcurrent: 9, nodeIds: ["node-test"] })), "RUNNER_CONCURRENCY_INVALID");
  assert.equal(code(() => control.setRunnerPolicy({ actor: admin, projectId, environment: "test", maxConcurrent: 1, nodeIds: ["node-ghost"] })), "NODE_NOT_FOUND");
  assert.equal(code(() => control.setRunnerPolicy({ actor: viewer, projectId, environment: "test", maxConcurrent: 1, nodeIds: ["node-test"] })), "PROJECT_WRITE_REQUIRED");
  control.setRunnerPolicy({ actor: admin, projectId, environment: "test", maxConcurrent: 2, nodeIds: ["node-test", "node-two"] });
  const first = control.acquireRunner({ actor: admin, projectId, environment: "test", runId: "run-a" });
  assert.equal(control.acquireRunner({ actor: admin, projectId, environment: "test", runId: "run-a" }).leaseId, first.leaseId, "idempotent for the same run");
  const secondLease = control.acquireRunner({ actor: admin, projectId, environment: "test", runId: "run-b" });
  assert.notEqual(secondLease.nodeId, first.nodeId, "one run per node");
  assert.equal(code(() => control.acquireRunner({ actor: admin, projectId, environment: "test", runId: "run-c" })), "RUNNER_CONCURRENCY_EXCEEDED");
  assert.equal(code(() => control.acquireRunner({ actor: admin, projectId, environment: "production", runId: "run-d" })), "RUNNER_POLICY_MISSING");
  assert.equal(code(() => control.acquireRunner({ actor: admin, projectId: other, environment: "test", runId: "run-e" })), "RUNNER_POLICY_MISSING", "another project has no access to these runners");
  control.releaseRunner({ actor: admin, projectId, runId: "run-a" });
  assert.equal(control.acquireRunner({ actor: admin, projectId, environment: "test", runId: "run-c" }).state, "active");
  control.revokeNode({ actor: admin, projectId, nodeId: "node-two", reason: "retired" });
  assert.equal(control.view({ actor: viewer, projectId }).leases.filter(lease => lease.nodeId === "node-two" && lease.state === "active").length, 0, "revoking a node releases its runs");
  clock += 3601_000;
  assert.equal(control.view({ actor: viewer, projectId }).leases.every(lease => lease.state !== "active"), true, "a forgotten lease expires");
  clock -= 3601_000;
});

test("BO-130/131 secret metadata keeps references only; a reveal needs the owner, proof, a reason, and is limited", () => {
  const control = world();
  control.registerSecret({ actor: admin, projectId, secretId: "secret-one", reference: "secret-ref:api-one" });
  assert.equal(code(() => control.registerSecret({ actor: admin, projectId, secretId: "secret-one", reference: "secret-ref:api-two" })), "SECRET_EXISTS");
  assert.equal(code(() => control.registerSecret({ actor: admin, projectId, secretId: "secret-ghost", reference: "secret-ref:api-two", operation: "rotated" })), "SECRET_NOT_FOUND");
  assert.equal(code(() => control.registerSecret({ actor: admin, projectId, secretId: "secret-two", reference: "plain-value-not-a-reference" })), "SECRET_METADATA_INVALID");
  assert.equal(code(() => control.registerSecret({ actor: admin, projectId: other, secretId: "secret-one", reference: "secret-ref:api-two", operation: "replaced" })), "SECRET_CROSS_PROJECT");
  assert.equal(control.registerSecret({ actor: admin, projectId, secretId: "secret-one", reference: "secret-ref:api-two", operation: "rotated" }).version, 2);
  assert.equal(code(() => control.requestReveal({ actor: admin, projectId, secretId: "secret-one", mfaFresh: true, reAuthenticated: true, reason: "Investigating an incident" })), "OWNER_REQUIRED");
  assert.equal(code(() => control.requestReveal({ actor: owner, projectId, secretId: "secret-one", mfaFresh: false, reAuthenticated: true, reason: "Investigating an incident" })), "REVEAL_GUARD_FAILED");
  assert.equal(code(() => control.requestReveal({ actor: owner, projectId, secretId: "secret-one", mfaFresh: "yes", reAuthenticated: true, reason: "Investigating an incident" })), "REVEAL_GUARD_FAILED", "only a real true counts");
  assert.equal(code(() => control.requestReveal({ actor: owner, projectId, secretId: "secret-one", mfaFresh: true, reAuthenticated: true, reason: "short" })), "REVEAL_GUARD_FAILED");
  assert.equal(code(() => control.requestReveal({ actor: owner, projectId: other, secretId: "secret-one", mfaFresh: true, reAuthenticated: true, reason: "Investigating an incident" })), "SECRET_NOT_FOUND");
  const reveal = control.requestReveal({ actor: owner, projectId, secretId: "secret-one", mfaFresh: true, reAuthenticated: true, reason: "Investigating an incident" });
  assert.equal(reveal.value, "not-returned-by-control-plane");
  assert.equal(Date.parse(reveal.expiresAt) - clock, 300_000);
  control.requestReveal({ actor: owner, projectId, secretId: "secret-one", mfaFresh: true, reAuthenticated: true, reason: "Investigating an incident" });
  control.requestReveal({ actor: owner, projectId, secretId: "secret-one", mfaFresh: true, reAuthenticated: true, reason: "Investigating an incident" });
  assert.equal(code(() => control.requestReveal({ actor: owner, projectId, secretId: "secret-one", mfaFresh: true, reAuthenticated: true, reason: "Investigating an incident" })), "REVEAL_RATE_LIMITED");
  control.registerSecret({ actor: admin, projectId, secretId: "secret-one", reference: "secret-ref:api-two", operation: "revoked" });
  assert.equal(code(() => control.requestReveal({ actor: owner, projectId, secretId: "secret-one", mfaFresh: true, reAuthenticated: true, reason: "Investigating an incident" })), "SECRET_REVOKED");
  assert.equal(code(() => control.registerSecret({ actor: admin, projectId, secretId: "secret-one", reference: "secret-ref:api-three", operation: "replaced" })), "SECRET_REVOKED");
  assert.equal(control.view({ actor: viewer, projectId }).reveals.length, 3, "every request is on record");
});

test("BO-132 egress is default deny and needs both an allowed tool and an allowed domain", () => {
  const control = world();
  assert.deepEqual({ ...control.checkEgress({ projectId, tool: "git", domain: "github.com" }) }, { allowed: false, reason: "no-policy-default-deny" });
  assert.equal(code(() => control.setEgressPolicy({ actor: admin, projectId, tools: ["git"], domains: ["*.example.com"] })), "EGRESS_POLICY_INVALID");
  assert.equal(code(() => control.setEgressPolicy({ actor: admin, projectId, tools: ["git"], domains: ["10.0.0.1"] })), "EGRESS_POLICY_INVALID");
  assert.equal(code(() => control.setEgressPolicy({ actor: admin, projectId, tools: ["rm -rf /"], domains: ["github.com"] })), "EGRESS_POLICY_INVALID");
  assert.equal(code(() => control.setEgressPolicy({ actor: viewer, projectId, tools: ["git"], domains: ["github.com"] })), "PROJECT_WRITE_REQUIRED");
  control.setEgressPolicy({ actor: admin, projectId, tools: ["git"], domains: ["github.com"] });
  assert.equal(control.checkEgress({ projectId, tool: "git", domain: "GitHub.com" }).allowed, true);
  assert.equal(control.checkEgress({ projectId, tool: "curl", domain: "github.com" }).reason, "tool-not-allowed");
  assert.equal(control.checkEgress({ projectId, tool: "git", domain: "evil.example" }).reason, "domain-not-allowed");
  assert.equal(control.checkEgress({ projectId, tool: "git", domain: "github.com.evil.example" }).allowed, false);
  assert.equal(control.checkEgress({ projectId: other, tool: "git", domain: "github.com" }).allowed, false, "policies are per project");
});

test("BO-124 the threat model is complete and every threat names a test that exists in this suite", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL(import.meta.url), "utf8");
  assert.equal(INFRASTRUCTURE_THREAT_MODEL.length >= 10, true);
  for (const threat of INFRASTRUCTURE_THREAT_MODEL) {
    assert.ok(threat.control.length > 20 && threat.threat.length > 10, threat.id);
    const keyword = threat.test.replace(/^BO-\d+ /, "").split(/[ -]/)[0];
    assert.ok(source.toLowerCase().includes(keyword.toLowerCase()), `${threat.id} points at "${threat.test}" but nothing in the suite mentions ${keyword}`);
  }
});

test("persistence: servers, nodes, policies, secret references and reveal requests survive a restart in any record order; heartbeats keep the replay floor", () => {
  const first = world();
  const node = enroll(first, "node-one");
  first.setRunnerPolicy({ actor: admin, projectId, environment: "test", maxConcurrent: 1, nodeIds: ["node-one"] });
  first.registerSecret({ actor: admin, projectId, secretId: "secret-one", reference: "secret-ref:api-one" });
  first.registerSecret({ actor: admin, projectId, secretId: "secret-one", reference: "secret-ref:api-two", operation: "rotated" });
  first.requestReveal({ actor: owner, projectId, secretId: "secret-one", mfaFresh: true, reAuthenticated: true, reason: "Investigating an incident" });
  first.setEgressPolicy({ actor: admin, projectId, tools: ["git"], domains: ["github.com"] });
  first.setState({ actor: admin, projectId, environment: "test", desiredState: { v: 1 }, observedState: { v: 1 } });
  first.selectTarget({ actor: admin, projectId, environment: "test", serverId: "server-test", expectedVersion: 0 });
  for (let sequence = 1; sequence <= 10; sequence += 1) first.heartbeat({ projectId, nodeId: "node-one", nodeToken: node.nodeToken, identityFingerprint: "fingerprint-node-one-0001", sequence });
  const records = [...first.drainRecords()];
  assert.equal(records.some(record => JSON.stringify(record).includes(node.nodeToken)), false, "no token in any record");
  for (const record of records) for (const key of JSON.stringify(record.payload).match(/"[A-Za-z]+":/g) ?? []) assert.equal(/credential|secretId|"secret"|password|api[_-]?key/i.test(key), false, `${record.kind} carries a credential-shaped key ${key}`);
  for (const order of [records, [...records].reverse(), [...records].sort((a, b) => b.version - a.version)]) {
    const second = createInfrastructureControl({ now });
    for (const record of order) second.hydrate(record);
    const view = second.view({ actor: viewer, projectId });
    assert.equal(view.servers.length, 2); assert.equal(view.nodes.length, 1); assert.equal(view.secrets[0].version, 2); assert.equal(view.secrets[0].reference, "secret-ref:api-two");
    assert.equal(view.runnerPolicies[0].maxConcurrent, 1); assert.equal(view.egress.domains[0], "github.com"); assert.equal(view.reveals.length, 1);
    assert.equal(view.targetSelections[0].serverId, "server-test");
    assert.equal(second.reconcile({ actor: viewer, projectId, environment: "test" }).decision, "in-sync");
    assert.equal(view.servers.find(server => server.serverId === "server-test").credentialReference, "secret-ref:ssh-one", "the reference round-trips under its API name");
    assert.equal(code(() => second.heartbeat({ projectId, nodeId: "node-one", nodeToken: node.nodeToken, identityFingerprint: "fingerprint-node-one-0001", sequence: 10 })), "NODE_REPLAY_REJECTED", "the replay floor is restored");
    assert.equal(second.heartbeat({ projectId, nodeId: "node-one", nodeToken: node.nodeToken, identityFingerprint: "fingerprint-node-one-0001", sequence: 11 }).sequence, 11, "the token still works after a restart");
  }
});

test("a viewer reads everything but changes nothing, and other projects see nothing", () => {
  const control = world();
  assert.equal(control.view({ actor: viewer, projectId }).servers.length, 2);
  assert.equal(control.view({ actor: viewer, projectId: other }).servers.length, 0);
  assert.equal(code(() => control.view({ actor: null, projectId })), "PROJECT_READ_REQUIRED");
  assert.equal(code(() => control.registerRepository({ actor: viewer, projectId, repositoryId: "repo-two", name: "x/y" })), "PROJECT_WRITE_REQUIRED");
});
