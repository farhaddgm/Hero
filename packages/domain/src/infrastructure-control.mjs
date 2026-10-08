import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  HERO_ENVIRONMENTS, NODE_CAPABILITIES, NODE_HEARTBEAT_PERSIST_EVERY, NODE_OFFLINE_AFTER_SECONDS, NODE_PROTOCOL_VERSION,
  REVEAL_MAX_SECONDS, RUNNER_ISOLATION, RUNNER_MAX_CONCURRENCY, SECRET_STATES
} from "../../contracts/src/infrastructure-control.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SECRET_KEY = /(secret|password|credential|token|authorization|private.?key)/i;
const SECRET_REFERENCE = /^secret-ref:[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const HOST = /^[A-Za-z0-9][A-Za-z0-9.\-:\[\]]{1,251}[A-Za-z0-9\]]$/;
const DOMAIN = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const TOOL = /^[a-z][a-z0-9._-]{1,63}$/;
const LEASE_TTL_SECONDS = 3600;
const RECORD_KINDS = Object.freeze(["repository", "server", "selection", "enrollment", "node", "desired", "observed", "secret-entry", "reveal", "egress", "runner-policy", "lease"]);

const copy = value => Object.freeze(structuredClone(value));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const redact = value => (!value || typeof value !== "object" ? value : Array.isArray(value) ? value.map(redact) : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, SECRET_KEY.test(key) ? "[redacted]" : redact(child)])));

export class InfrastructureError extends Error {
  constructor(code, message, statusCode = 409) { super(message); this.name = "InfrastructureError"; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, message, statusCode = 409) => { throw new InfrastructureError(code, message, statusCode); };
const safeId = (label, value) => { if (typeof value !== "string" || !ID.test(value)) fail("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; };
const write = actor => { if (!actor || !["project-owner", "admin"].includes(actor.role)) fail("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403); return actor; };
const read = actor => { if (!actor || !["project-owner", "admin", "viewer"].includes(actor.role)) fail("PROJECT_READ_REQUIRED", "Project access is required.", 403); return actor; };
const same = (left, right) => { const a = Buffer.from(String(left)); const b = Buffer.from(String(right)); return a.length === b.length && timingSafeEqual(a, b); };

/**
 * Environments, servers, nodes, secret metadata and runners (WP-11).
 *
 * Nothing here opens a connection. Hero describes and records; a Node Agent dials out, a person
 * dispatches. State is an append-only record stream (outbox -> table -> order-independent hydrate),
 * so a restart keeps servers, nodes, policies and secret references.
 *
 * Persisted keys avoid credential-shaped names (the record store refuses them): a server's secret
 * reference is stored as `accessRef`, and a secret entry's id as `entryId`.
 */
export function createInfrastructureControl({ now = () => new Date().toISOString(), githubMetadata = null } = {}) {
  const servers = new Map(); const nodes = new Map(); const enrollments = new Map(); const desired = new Map(); const observed = new Map();
  const secrets = new Map(); const reveals = new Map(); const egress = new Map(); const repositories = new Map(); const targetSelections = new Map();
  const runnerPolicies = new Map(); const leases = new Map();
  const outbox = []; const versions = new Map(); const seen = new Map();
  const nowMs = () => Date.parse(now());

  const nextVersion = mark => { const value = (versions.get(mark) ?? 0) + 1; versions.set(mark, value); return value; };
  const emit = (kind, key, projectId, payload, actorId, version) => {
    const mark = `${kind}:${key}`; const finalVersion = version ?? nextVersion(mark); versions.set(mark, Math.max(versions.get(mark) ?? 0, finalVersion));
    outbox.push(copy({ kind, key, version: finalVersion, projectId, actorId: actorId ?? "hero-system", recordedAt: now(), payload }));
  };
  const inProject = (record, projectId, code) => { if (!record || record.projectId !== projectId) fail(code, "Resource was not found in this project.", 404); return record; };

  // ---- persisted shapes (credential-shaped names are renamed) ----
  const serverOut = item => { const { credentialReference, ...rest } = item; return { ...rest, accessRef: credentialReference }; };
  const serverIn = item => { const { accessRef, ...rest } = item; return { ...rest, credentialReference: accessRef }; };
  const secretOut = item => { const { secretId, ...rest } = item; return { ...rest, entryId: secretId }; };
  const secretIn = item => { const { entryId, ...rest } = item; return { ...rest, secretId: entryId }; };
  const revealOut = item => { const { secretId, ...rest } = item; return { ...rest, entryId: secretId }; };
  const revealIn = item => { const { entryId, ...rest } = item; return { ...rest, secretId: entryId }; };

  const publicNode = node => {
    const { tokenHash, ...rest } = node;
    const silentFor = node.lastHeartbeatAt ? (nowMs() - Date.parse(node.lastHeartbeatAt)) / 1000 : null;
    const liveState = node.state === "revoked" ? "revoked" : node.lastHeartbeatAt === null ? "awaiting-heartbeat" : silentFor > NODE_OFFLINE_AFTER_SECONDS ? "offline" : "online";
    return copy({ ...rest, liveState });
  };
  const nodeOnline = node => publicNode(node).liveState === "online";

  const bootstrapManifest = server => {
    const body = [
      `hero-node-bootstrap/${NODE_PROTOCOL_VERSION}`,
      `server=${server.serverId}`,
      `environment=${server.environment}`,
      "direction=outbound-only",
      "steps=verify-checksum;create-isolated-runner-user;install-agent;present-enrollment-nonce;start-heartbeat",
      "executes=nothing-until-a-person-runs-it"
    ].join("\n");
    return { body, digest: sha256(body) };
  };

  const api = {
    environments() { return HERO_ENVIRONMENTS; },

    // ---------------------------------------------------------------- BO-122 repositories
    registerRepository({ actor, projectId, repositoryId, name, defaultBranch = "main", metadata = {} }) {
      write(actor); safeId("projectId", projectId); safeId("repositoryId", repositoryId);
      if (repositories.has(repositoryId)) fail("REPOSITORY_EXISTS", "Repository already exists.");
      const item = copy({ projectId, repositoryId, name: String(name).slice(0, 160), defaultBranch: String(defaultBranch).slice(0, 120), metadata: redact(metadata), mode: "metadata-only-no-github-fetch", createdAt: now(), createdBy: actor.subject });
      repositories.set(repositoryId, item); emit("repository", repositoryId, projectId, { repository: item }, actor.subject); return item;
    },
    /** Pulls read-only metadata through the injected adapter. Without a connection nothing happens and nothing is recorded. */
    async syncRepositoryMetadata({ actor, projectId, repositoryId }) {
      write(actor);
      const repository = inProject(repositories.get(safeId("repositoryId", repositoryId)), projectId, "REPOSITORY_NOT_FOUND");
      if (!githubMetadata?.connected) fail("GITHUB_NOT_CONNECTED", "No GitHub connection is configured; nothing was fetched.", 503);
      const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(repository.name);
      if (!match) fail("REPOSITORY_NAME_INVALID", "The repository name must be owner/name to read metadata.", 400);
      const described = await githubMetadata.describe({ owner: match[1], repo: match[2] });
      const item = copy({ ...repository, metadata: described, mode: "read-only-metadata", syncedAt: now(), syncedBy: actor.subject });
      repositories.set(repositoryId, item); emit("repository", repositoryId, projectId, { repository: item }, actor.subject); return item;
    },

    // ---------------------------------------------------------------- BO-125 servers
    onboardServer({ actor, projectId, serverId, address, credentialReference, environment = "development" }) {
      write(actor); safeId("projectId", projectId); safeId("serverId", serverId);
      if (!HERO_ENVIRONMENTS.includes(environment) || typeof address !== "string" || !HOST.test(address) || typeof credentialReference !== "string" || !SECRET_REFERENCE.test(credentialReference)) fail("SERVER_INVALID", "Server must use a fixed environment, a plain host or IP address, and a secret reference.", 400);
      if (servers.has(serverId)) fail("SERVER_EXISTS", "Server already exists.");
      const item = copy({ projectId, serverId, address: address.slice(0, 253), credentialReference, environment, state: "planned-no-connection", createdAt: now(), createdBy: actor.subject });
      servers.set(serverId, item); emit("server", serverId, projectId, { server: serverOut(item) }, actor.subject); return item;
    },
    selectTarget({ actor, projectId, environment = "test", serverId, expectedVersion = 0 }) {
      write(actor); safeId("projectId", projectId); safeId("serverId", serverId);
      if (environment !== "test") fail("TARGET_ENVIRONMENT_INVALID", "Product target selection is currently limited to Test.", 400);
      const server = inProject(servers.get(serverId), projectId, "SERVER_NOT_FOUND");
      if (server.environment !== "test") fail("TARGET_ENVIRONMENT_MISMATCH", "Selected server must be registered for Test.", 400);
      if (server.state === "revoked") fail("TARGET_SERVER_REVOKED", "A revoked server cannot be selected as a Product Test target.", 409);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) fail("TARGET_VERSION_INVALID", "Target selection version must be a non-negative integer.", 400);
      const key = `${projectId}:${environment}`; const prior = targetSelections.get(key);
      if (expectedVersion !== (prior?.version ?? 0)) fail("TARGET_VERSION_CONFLICT", "Target selection is stale; reload the project before saving.", 409);
      const item = copy({ selectionId: `target-selection-${projectId}-${environment}`, projectId, environment, serverId, serverAddress: server.address, version: (prior?.version ?? 0) + 1, state: "selected-not-dispatched", execution: "requires-separate-product-test-authorization", selectedAt: now(), selectedBy: actor.subject });
      targetSelections.set(key, item); emit("selection", key, projectId, { selection: item }, actor.subject, item.version); return item;
    },

    // ---------------------------------------------------------------- BO-126 plan and bootstrap artifact
    connectivityPlan({ actor, projectId, serverId, bootstrapDigest }) {
      write(actor);
      const server = inProject(servers.get(safeId("serverId", serverId)), projectId, "SERVER_NOT_FOUND");
      const artifact = bootstrapManifest(server);
      if (bootstrapDigest !== undefined) {
        if (typeof bootstrapDigest !== "string" || !/^[a-f0-9]{64}$/i.test(bootstrapDigest)) fail("BOOTSTRAP_DIGEST_INVALID", "Bootstrap digest must be SHA-256.", 400);
        if (bootstrapDigest.toLowerCase() !== artifact.digest) fail("BOOTSTRAP_DIGEST_MISMATCH", "The bootstrap digest does not match the artifact Hero generated for this server.", 409);
      }
      return copy({
        projectId, serverId: server.serverId, protocol: NODE_PROTOCOL_VERSION,
        prerequisites: ["outbound-https", "time-sync", "isolated-runner", "agent-identity"],
        bootstrapArtifact: { format: "text-manifest", digest: artifact.digest, content: artifact.body },
        bootstrapDigest: artifact.digest, state: "plan-only-no-bootstrap-executed", createdAt: now()
      });
    },

    // ---------------------------------------------------------------- BO-127 enrolment, token, rotation
    createEnrollment({ actor, projectId, nodeId, serverId, expiresAt }) {
      write(actor); safeId("nodeId", nodeId);
      inProject(servers.get(safeId("serverId", serverId)), projectId, "SERVER_NOT_FOUND");
      if (nodes.has(nodeId) || enrollments.has(nodeId)) fail("NODE_EXISTS", "Node already exists.");
      const expiry = Date.parse(expiresAt);
      if (!Number.isFinite(expiry) || expiry <= nowMs() || expiry > nowMs() + 24 * 3600_000) fail("ENROLLMENT_EXPIRY_INVALID", "Enrollment must expire in the future and within 24 hours.", 400);
      const nonce = randomUUID();
      const item = copy({ projectId, nodeId, serverId, nonceHash: sha256(nonce), expiresAt: new Date(expiry).toISOString(), state: "pending", issuedAt: now(), issuedBy: actor.subject });
      enrollments.set(nodeId, item); emit("enrollment", nodeId, projectId, { enrollment: item }, actor.subject);
      return copy({ ...item, enrollmentNonce: nonce });
    },
    /** Called by the Node Agent. The node token is returned once and only its hash is kept. */
    registerNode({ projectId, nodeId, enrollmentNonce, identityFingerprint, capabilities = [] }) {
      safeId("projectId", projectId);
      const enrollment = inProject(enrollments.get(safeId("nodeId", nodeId)), projectId, "ENROLLMENT_NOT_FOUND");
      if (enrollment.state !== "pending" || Date.parse(enrollment.expiresAt) < nowMs() || !same(sha256(String(enrollmentNonce)), enrollment.nonceHash)) fail("ENROLLMENT_REJECTED", "Enrollment is expired, used or invalid.", 403);
      if (typeof identityFingerprint !== "string" || identityFingerprint.length < 16) fail("NODE_IDENTITY_INVALID", "Node identity is invalid.", 400);
      const reported = capabilityList(capabilities);
      const token = randomBytes(32).toString("base64url");
      const item = copy({ projectId, nodeId, serverId: enrollment.serverId, identityFingerprint, tokenHash: sha256(token), capabilities: reported, protocol: NODE_PROTOCOL_VERSION, state: "registered", registeredAt: now(), lastHeartbeatAt: null, sequence: 0, rotationVersion: 1 });
      nodes.set(nodeId, item);
      const consumed = copy({ ...enrollment, state: "consumed", consumedAt: now() }); enrollments.set(nodeId, consumed);
      emit("enrollment", nodeId, projectId, { enrollment: consumed }, "node-agent"); emit("node", nodeId, projectId, { node: item }, "node-agent", item.rotationVersion * 1_000_000);
      return copy({ ...publicNode(item), nodeToken: token });
    },
    /** BO-123: one message from the agent. Token, fingerprint and a strictly increasing sequence are all required. */
    heartbeat({ projectId, nodeId, nodeToken, identityFingerprint, sequence, capabilities }) {
      const node = inProject(nodes.get(safeId("nodeId", nodeId)), projectId, "NODE_NOT_FOUND");
      const reject = () => fail("NODE_IMPERSONATION_REJECTED", "Node identity is not valid.", 403);
      if (node.state === "revoked") fail("NODE_REVOKED", "This node was revoked.", 403);
      if (typeof nodeToken !== "string" || typeof identityFingerprint !== "string" || !same(sha256(nodeToken), node.tokenHash) || !same(identityFingerprint, node.identityFingerprint)) reject();
      if (!Number.isInteger(sequence) || sequence <= node.sequence) fail("NODE_REPLAY_REJECTED", "The heartbeat sequence must increase; this message was already seen.", 409);
      const reported = capabilities === undefined ? node.capabilities : capabilityList(capabilities);
      const next = copy({ ...node, capabilities: reported, lastHeartbeatAt: now(), sequence });
      nodes.set(nodeId, next);
      if (sequence % NODE_HEARTBEAT_PERSIST_EVERY === 0 || node.lastHeartbeatAt === null) emit("node", nodeId, projectId, { node: next }, "node-agent", next.rotationVersion * 1_000_000 + Math.min(sequence, 999_999));
      return publicNode(next);
    },
    rotateNodeIdentity({ actor, projectId, nodeId, identityFingerprint }) {
      write(actor);
      const node = inProject(nodes.get(safeId("nodeId", nodeId)), projectId, "NODE_NOT_FOUND");
      if (node.state === "revoked") fail("NODE_REVOKED", "A revoked node cannot be rotated.", 409);
      if (typeof identityFingerprint !== "string" || identityFingerprint.length < 16) fail("NODE_IDENTITY_INVALID", "Node identity is invalid.", 400);
      const token = randomBytes(32).toString("base64url");
      const next = copy({ ...node, identityFingerprint, tokenHash: sha256(token), rotationVersion: node.rotationVersion + 1, rotatedAt: now(), rotatedBy: actor.subject });
      nodes.set(nodeId, next); emit("node", nodeId, projectId, { node: next }, actor.subject, next.rotationVersion * 1_000_000);
      return copy({ ...publicNode(next), nodeToken: token });
    },
    revokeNode({ actor, projectId, nodeId, reason }) {
      write(actor);
      const node = inProject(nodes.get(safeId("nodeId", nodeId)), projectId, "NODE_NOT_FOUND");
      const next = copy({ ...node, state: "revoked", revokedAt: now(), revokedBy: actor.subject, reason: String(reason ?? "").slice(0, 500) });
      nodes.set(nodeId, next); emit("node", nodeId, projectId, { node: next }, actor.subject, next.rotationVersion * 1_000_000 + 999_999);
      for (const lease of leases.values()) if (lease.nodeId === nodeId && lease.state === "active") releaseLease(lease, actor.subject, "node-revoked");
      return publicNode(next);
    },

    // ---------------------------------------------------------------- BO-128 desired / observed / reconcile
    setState({ actor, projectId, environment, desiredState, observedState }) {
      write(actor);
      if (!HERO_ENVIRONMENTS.includes(environment)) fail("ENVIRONMENT_INVALID", "Only Development, Test and Production exist in v1.", 400);
      const key = `${projectId}:${environment}`; const version = (desired.get(key)?.version ?? 0) + 1;
      const target = copy({ projectId, environment, state: redact(desiredState ?? {}), version, updatedAt: now(), updatedBy: actor.subject });
      const actual = copy({ projectId, environment, state: redact(observedState ?? {}), version, observedAt: now() });
      desired.set(key, target); observed.set(key, actual);
      emit("desired", key, projectId, { state: target }, actor.subject, version); emit("observed", key, projectId, { state: actual }, actor.subject, version);
      return target;
    },
    reconcile({ actor, projectId, environment }) {
      read(actor);
      const key = `${projectId}:${environment}`; const target = desired.get(key); const actual = observed.get(key);
      if (!target || !actual) fail("STATE_NOT_FOUND", "Desired and observed state are required.", 404);
      const differences = Object.keys({ ...target.state, ...actual.state }).filter(name => JSON.stringify(target.state[name]) !== JSON.stringify(actual.state[name])).sort();
      return copy({ projectId, environment, differences, decision: differences.length ? "proposal-required" : "in-sync", automaticExecution: "forbidden-without-separate-dispatch", desiredVersion: target.version, observedAt: actual.observedAt });
    },

    // ---------------------------------------------------------------- BO-129 runners
    setRunnerPolicy({ actor, projectId, environment, maxConcurrent, nodeIds = [] }) {
      write(actor);
      if (!HERO_ENVIRONMENTS.includes(environment)) fail("ENVIRONMENT_INVALID", "Only Development, Test and Production exist in v1.", 400);
      if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > RUNNER_MAX_CONCURRENCY) fail("RUNNER_CONCURRENCY_INVALID", `Concurrency must be between 1 and ${RUNNER_MAX_CONCURRENCY}.`, 400);
      if (!Array.isArray(nodeIds) || nodeIds.length === 0 || nodeIds.length > 20) fail("RUNNER_NODES_INVALID", "Between 1 and 20 nodes are required.", 400);
      for (const nodeId of nodeIds) {
        const node = inProject(nodes.get(safeId("nodeId", nodeId)), projectId, "NODE_NOT_FOUND");
        const server = servers.get(node.serverId);
        if (!server || server.environment !== environment) fail("RUNNER_ENVIRONMENT_MISMATCH", "A runner node must belong to a server of the same environment.", 409);
        if (!node.capabilities.includes("runner")) fail("RUNNER_CAPABILITY_MISSING", "The node did not report the runner capability.", 409);
      }
      const key = `${projectId}:${environment}`; const version = (runnerPolicies.get(key)?.version ?? 0) + 1;
      const item = copy({ projectId, environment, maxConcurrent, nodeIds: [...new Set(nodeIds)].sort(), isolation: RUNNER_ISOLATION, version, updatedAt: now(), updatedBy: actor.subject });
      runnerPolicies.set(key, item); emit("runner-policy", key, projectId, { policy: item }, actor.subject, version); return item;
    },
    acquireRunner({ actor, projectId, environment, runId }) {
      write(actor); safeId("runId", runId);
      const policy = runnerPolicies.get(`${projectId}:${environment}`);
      if (!policy) fail("RUNNER_POLICY_MISSING", "No runner policy exists for this project and environment.", 409);
      const key = `${projectId}:${runId}`; const existing = leases.get(key);
      if (existing && existing.state === "active" && !leaseExpired(existing)) return existing;
      const active = [...leases.values()].filter(lease => lease.projectId === projectId && lease.environment === environment && lease.state === "active" && !leaseExpired(lease));
      if (active.length >= policy.maxConcurrent) fail("RUNNER_CONCURRENCY_EXCEEDED", "All runners for this environment are busy.", 429);
      const busy = new Set(active.map(lease => lease.nodeId));
      const node = policy.nodeIds.map(id => nodes.get(id)).find(candidate => candidate && candidate.state === "registered" && nodeOnline(candidate) && !busy.has(candidate.nodeId));
      if (!node) fail("RUNNER_UNAVAILABLE", "No online runner node is free.", 503);
      const version = (existing?.version ?? 0) + 1;
      const lease = copy({ projectId, environment, runId, leaseId: `lease-${randomUUID()}`, nodeId: node.nodeId, isolation: RUNNER_ISOLATION, state: "active", acquiredAt: now(), expiresAt: new Date(nowMs() + LEASE_TTL_SECONDS * 1000).toISOString(), version });
      leases.set(key, lease); emit("lease", key, projectId, { lease }, actor.subject, version); return lease;
    },
    releaseRunner({ actor, projectId, runId }) {
      write(actor);
      const lease = inProject(leases.get(`${projectId}:${safeId("runId", runId)}`), projectId, "LEASE_NOT_FOUND");
      return lease.state === "active" ? releaseLease(lease, actor.subject, "released") : lease;
    },

    // ---------------------------------------------------------------- BO-130 / BO-131 secret metadata
    registerSecret({ actor, projectId, secretId, reference, operation = "registered" }) {
      write(actor); safeId("secretId", secretId);
      if (!SECRET_STATES.includes(operation) || typeof reference !== "string" || !SECRET_REFERENCE.test(reference)) fail("SECRET_METADATA_INVALID", "Only a non-sensitive secret reference may be stored.", 400);
      const prior = secrets.get(secretId);
      if (prior && prior.projectId !== projectId) fail("SECRET_CROSS_PROJECT", "Secret belongs to another project.", 409);
      if (prior?.state === "revoked") fail("SECRET_REVOKED", "A revoked secret cannot change; register a new one.", 409);
      if (!prior && operation !== "registered") fail("SECRET_NOT_FOUND", "Only a registered secret can be replaced, rotated or revoked.", 404);
      if (prior && operation === "registered") fail("SECRET_EXISTS", "Secret is already registered; use replace, rotate or revoke.", 409);
      const item = copy({ projectId, secretId, reference, state: operation, version: (prior?.version ?? 0) + 1, updatedAt: now(), updatedBy: actor.subject, value: "never-stored-or-revealed" });
      secrets.set(secretId, item); emit("secret-entry", secretId, projectId, { entry: secretOut(item) }, actor.subject, item.version); return item;
    },
    /**
     * The caller (the server) must prove freshness from the signed session, never from the request body.
     * The reveal is recorded with an expiry; the value is not returned by the Control Plane.
     */
    requestReveal({ actor, projectId, secretId, mfaFresh, reAuthenticated, reason }) {
      if (!actor || actor.role !== "project-owner") fail("OWNER_REQUIRED", "Only the owner may request a reveal.", 403);
      const secret = inProject(secrets.get(safeId("secretId", secretId)), projectId, "SECRET_NOT_FOUND");
      if (secret.state === "revoked") fail("SECRET_REVOKED", "A revoked secret cannot be revealed.", 409);
      if (mfaFresh !== true || reAuthenticated !== true || typeof reason !== "string" || reason.trim().length < 8) fail("REVEAL_GUARD_FAILED", "Fresh MFA, re-authentication and reason are required.", 403);
      const recent = [...reveals.values()].filter(item => item.projectId === projectId && item.secretId === secretId && nowMs() - Date.parse(item.requestedAt) < 3600_000);
      if (recent.length >= 3) fail("REVEAL_RATE_LIMITED", "Too many reveal requests for this secret in the last hour.", 429);
      const sequence = [...reveals.values()].filter(item => item.projectId === projectId && item.secretId === secretId).length + 1;
      const item = copy({ projectId, secretId, requestId: `reveal-${secretId}-${sequence}`, reference: secret.reference, state: "reveal-request-recorded", value: "not-returned-by-control-plane", requestedAt: now(), expiresAt: new Date(nowMs() + REVEAL_MAX_SECONDS * 1000).toISOString(), reason: reason.slice(0, 500), requestedBy: actor.subject, audit: true });
      reveals.set(item.requestId, item); emit("reveal", `${projectId}:${item.requestId}`, projectId, { reveal: revealOut(item) }, actor.subject); return item;
    },

    // ---------------------------------------------------------------- BO-132 egress
    setEgressPolicy({ actor, projectId, tools = [], domains = [] }) {
      write(actor);
      const toolList = [...new Set(tools.map(String))]; const domainList = [...new Set(domains.map(String).map(value => value.toLowerCase()))];
      if (toolList.length > 100 || domainList.length > 100 || toolList.some(tool => !TOOL.test(tool)) || domainList.some(domain => !DOMAIN.test(domain))) fail("EGRESS_POLICY_INVALID", "Tools must be plain names and domains must be exact host names (no wildcards or IP addresses).", 400);
      const version = (egress.get(projectId)?.version ?? 0) + 1;
      const item = copy({ projectId, tools: toolList.sort(), domains: domainList.sort(), default: "deny", version, updatedAt: now(), updatedBy: actor.subject });
      egress.set(projectId, item); emit("egress", projectId, projectId, { policy: item }, actor.subject, version); return item;
    },
    /** Default deny: a tool and a domain must both be on the project's list. */
    checkEgress({ projectId, tool, domain }) {
      const policy = egress.get(projectId);
      if (!policy) return copy({ allowed: false, reason: "no-policy-default-deny" });
      if (!policy.tools.includes(String(tool))) return copy({ allowed: false, reason: "tool-not-allowed" });
      if (!policy.domains.includes(String(domain).toLowerCase())) return copy({ allowed: false, reason: "domain-not-allowed" });
      return copy({ allowed: true, reason: "allowlisted", policyVersion: policy.version });
    },

    view({ actor, projectId }) {
      read(actor);
      const mine = map => [...map.values()].filter(item => item.projectId === projectId);
      return copy({
        environments: HERO_ENVIRONMENTS, protocol: { version: NODE_PROTOCOL_VERSION, direction: "outbound-only" },
        githubMetadata: githubMetadata?.status ?? "not-connected",
        servers: mine(servers), targetSelections: mine(targetSelections), nodes: mine(nodes).map(publicNode),
        secrets: mine(secrets), reveals: mine(reveals).map(item => ({ requestId: item.requestId, secretId: item.secretId, state: item.state, requestedAt: item.requestedAt, expiresAt: item.expiresAt, requestedBy: item.requestedBy })),
        egress: egress.get(projectId) ?? null, repositories: mine(repositories), runnerPolicies: mine(runnerPolicies),
        leases: mine(leases).map(lease => ({ ...lease, state: lease.state === "active" && leaseExpired(lease) ? "expired" : lease.state })),
        desiredStates: mine(desired).map(item => ({ environment: item.environment, version: item.version, updatedAt: item.updatedAt }))
      });
    },

    drainRecords() { return Object.freeze(outbox.splice(0, outbox.length)); },
    /** Order-independent: for every record the highest version wins. */
    hydrate(record) {
      if (!record || !RECORD_KINDS.includes(record.kind)) fail("INVALID_HYDRATION", "Infrastructure record is invalid.", 500);
      const mark = `${record.kind}:${record.key}`; const last = seen.get(mark) ?? 0; if (record.version < last) return; seen.set(mark, record.version); versions.set(mark, Math.max(versions.get(mark) ?? 0, record.version));
      const data = record.payload ?? {};
      switch (record.kind) {
        case "repository": repositories.set(record.key, copy(data.repository)); break;
        case "server": servers.set(record.key, copy(serverIn(data.server))); break;
        case "selection": targetSelections.set(record.key, copy(data.selection)); break;
        case "enrollment": enrollments.set(record.key, copy(data.enrollment)); break;
        case "node": nodes.set(record.key, copy(data.node)); break;
        case "desired": desired.set(record.key, copy(data.state)); break;
        case "observed": observed.set(record.key, copy(data.state)); break;
        case "secret-entry": secrets.set(record.key, copy(secretIn(data.entry))); break;
        case "reveal": { const item = revealIn(data.reveal); reveals.set(item.requestId, copy(item)); break; }
        case "egress": egress.set(record.key, copy(data.policy)); break;
        case "runner-policy": runnerPolicies.set(record.key, copy(data.policy)); break;
        case "lease": leases.set(record.key, copy(data.lease)); break;
        default: break;
      }
    }
  };

  function capabilityList(value) {
    const list = Array.isArray(value) ? value.map(String) : [];
    if (list.length > NODE_CAPABILITIES.length || list.some(item => !NODE_CAPABILITIES.includes(item))) fail("NODE_CAPABILITY_INVALID", `A node may only report: ${NODE_CAPABILITIES.join(", ")}.`, 400);
    return [...new Set(list)].sort();
  }
  function leaseExpired(lease) { return Date.parse(lease.expiresAt) <= nowMs(); }
  function releaseLease(lease, actorId, reason) {
    const next = copy({ ...lease, state: "released", releasedAt: now(), releaseReason: reason, version: lease.version + 1 });
    leases.set(`${lease.projectId}:${lease.runId}`, next); emit("lease", `${lease.projectId}:${lease.runId}`, lease.projectId, { lease: next }, actorId, next.version); return next;
  }
  return Object.freeze(api);
}
