import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify
} from "node:crypto";

import {
  REMOTE_AGENT_CAPABILITIES,
  REMOTE_AGENT_OPERATIONS,
  REMOTE_AGENT_SIGNATURE_ALGORITHM,
  REMOTE_AGENT_STATES,
  REMOTE_AGENT_TRANSPORTS,
  REMOTE_ARTIFACT_DIGEST_PATTERN,
  REMOTE_TARGET_STATES
} from "../../contracts/src/remote-agent.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;
const SAFE_REFERENCE = /^[A-Za-z][A-Za-z0-9._:/-]{2,255}$/;
const SENSITIVE_KEY = /(?:secret|password|credential|token|authorization|private.?key|api.?key|bearer|cookie)/i;
const SENSITIVE_VALUE = /(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const DISPATCH_FIELDS = Object.freeze([
  "agentId",
  "artifactDigest",
  "authorizationId",
  "dispatchId",
  "expiresAt",
  "issuedAt",
  "nonce",
  "operation",
  "projectId",
  "targetId"
]);
const HEALTH_STATUSES = new Set(["healthy", "degraded", "failed"]);

const copy = value => Object.freeze(structuredClone(value));

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}

function canonical(value) {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertId(label, value) {
  if (typeof value !== "string" || !ID.test(value)) throw new RemoteAgentError("IDENTIFIER_INVALID", `${label} is invalid.`, 400);
  return value;
}

function assertIso(label, value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new RemoteAgentError("TIMESTAMP_INVALID", `${label} must be an ISO timestamp.`, 400);
  return value;
}

function assertDigest(value) {
  if (typeof value !== "string" || !REMOTE_ARTIFACT_DIGEST_PATTERN.test(value)) throw new RemoteAgentError("ARTIFACT_NOT_IMMUTABLE", "Remote execution requires a sha256 artifact digest.", 400);
  return value;
}

function assertNoSensitive(value, path = "input") {
  if (typeof value === "string") {
    if (SENSITIVE_VALUE.test(value)) throw new RemoteAgentError("SENSITIVE_INPUT_REJECTED", `Sensitive input is not accepted at ${path}.`, 400);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitive(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key) && key !== "authorizationId") throw new RemoteAgentError("SENSITIVE_INPUT_REJECTED", `Sensitive field ${path}.${key} is not accepted.`, 400);
      assertNoSensitive(nested, `${path}.${key}`);
    }
  }
}

function actorCanWrite(actor) {
  if (!actor || !["project-owner", "admin"].includes(actor.role)) throw new RemoteAgentError("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403);
}

function assertAuthorization(authorization, { operation, projectId, targetId }) {
  if (!authorization || authorization.status !== "active" || authorization.globalStop !== false) {
    throw new RemoteAgentError("REMOTE_AUTHORIZATION_BLOCKED", "Remote Agent authorization is missing, inactive or stopped.", 403);
  }
  if (authorization.scope?.environment !== "test" || authorization.scope?.projectId !== projectId || authorization.scope?.targetId !== targetId) {
    throw new RemoteAgentError("REMOTE_SCOPE_MISMATCH", "Remote Agent authorization is outside the Test target scope.", 403);
  }
  if (!authorization.operations?.includes(operation)) throw new RemoteAgentError("REMOTE_OPERATION_NOT_AUTHORIZED", "Remote Agent operation is not authorized.", 403);
  assertId("authorizationId", authorization.authorizationId);
  return authorization;
}

function assertCapabilities(capabilities) {
  if (!Array.isArray(capabilities) || capabilities.length === 0 || capabilities.some(value => !REMOTE_AGENT_CAPABILITIES.includes(value))) {
    throw new RemoteAgentError("AGENT_CAPABILITIES_INVALID", "Agent capabilities must be an allowlisted non-empty set.", 400);
  }
  return [...new Set(capabilities)].sort();
}

function publicKeyFingerprint(publicKey) {
  const key = publicKey?.type === "public" ? publicKey : createPublicKey(publicKey);
  return fingerprint(key.export({ type: "spki", format: "der" }));
}

function publicKeyPem(publicKey) {
  const key = publicKey?.type === "public" ? publicKey : createPublicKey(publicKey);
  return key.export({ type: "spki", format: "pem" }).toString();
}

function redactedAgent(agent) {
  const { publicKey, ...safeAgent } = agent;
  return copy(safeAgent);
}

function validateDispatchPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new RemoteAgentError("DISPATCH_INVALID", "Signed dispatch payload is invalid.", 400);
  const keys = Object.keys(payload).sort();
  if (keys.join("\u0000") !== [...DISPATCH_FIELDS].sort().join("\u0000")) throw new RemoteAgentError("DISPATCH_FIELDS_INVALID", "Signed dispatch contains an unsupported or missing field.", 400);
  assertId("dispatchId", payload.dispatchId);
  assertId("nonce", payload.nonce);
  assertId("targetId", payload.targetId);
  assertId("agentId", payload.agentId);
  assertId("projectId", payload.projectId);
  assertId("authorizationId", payload.authorizationId);
  if (!REMOTE_AGENT_OPERATIONS.includes(payload.operation)) throw new RemoteAgentError("REMOTE_OPERATION_INVALID", "Remote operation is not allowlisted.", 400);
  assertDigest(payload.artifactDigest);
  assertIso("issuedAt", payload.issuedAt);
  assertIso("expiresAt", payload.expiresAt);
  if (Date.parse(payload.expiresAt) <= Date.parse(payload.issuedAt)) throw new RemoteAgentError("DISPATCH_WINDOW_INVALID", "Dispatch expiry must be after issue time.", 400);
  assertNoSensitive(payload);
  return payload;
}

export class RemoteAgentError extends Error {
  constructor(code, message, statusCode = 409) {
    super(message);
    this.name = "RemoteAgentError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createRemoteAgentKeyPair() {
  const pair = generateKeyPairSync("ed25519");
  const publicKey = publicKeyPem(pair.publicKey);
  return Object.freeze({
    privateKey: pair.privateKey,
    publicKey,
    fingerprint: publicKeyFingerprint(publicKey),
    algorithm: REMOTE_AGENT_SIGNATURE_ALGORITHM
  });
}

export function createSignedRemoteDispatch({ payload, privateKey } = {}) {
  const normalized = validateDispatchPayload(payload);
  if (!privateKey) throw new RemoteAgentError("SIGNING_KEY_REQUIRED", "A signing key is required to create a dispatch.", 400);
  const signature = sign(null, Buffer.from(canonical(normalized)), privateKey).toString("base64");
  return copy({ algorithm: REMOTE_AGENT_SIGNATURE_ALGORITHM, payload: normalized, signature });
}

export function verifySignedRemoteDispatch({ dispatch, publicKey, now = new Date().toISOString() } = {}) {
  if (!dispatch || dispatch.algorithm !== REMOTE_AGENT_SIGNATURE_ALGORITHM || typeof dispatch.signature !== "string") {
    throw new RemoteAgentError("DISPATCH_SIGNATURE_INVALID", "Signed dispatch metadata is invalid.", 403);
  }
  const payload = validateDispatchPayload(dispatch.payload);
  assertIso("now", now);
  if (Date.parse(now) < Date.parse(payload.issuedAt) - 60_000) throw new RemoteAgentError("DISPATCH_NOT_YET_VALID", "Dispatch is not valid yet.", 403);
  if (Date.parse(now) >= Date.parse(payload.expiresAt)) throw new RemoteAgentError("DISPATCH_EXPIRED", "Signed dispatch has expired.", 403);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dispatch.signature)) throw new RemoteAgentError("DISPATCH_SIGNATURE_INVALID", "Signed dispatch signature is invalid.", 403);
  let valid = false;
  try {
    valid = verify(null, Buffer.from(canonical(payload)), createPublicKey(publicKey), Buffer.from(dispatch.signature, "base64"));
  } catch {
    valid = false;
  }
  if (!valid) throw new RemoteAgentError("DISPATCH_SIGNATURE_INVALID", "Signed dispatch signature does not match.", 403);
  return copy({ valid: true, payload, fingerprint: publicKeyFingerprint(publicKey) });
}

function targetFromInventory(inventory) {
  if (!inventory || typeof inventory !== "object") throw new RemoteAgentError("TARGET_INVENTORY_INVALID", "Target inventory is required.", 400);
  assertId("targetId", inventory.targetId);
  assertId("projectId", inventory.projectId);
  assertId("ownerId", inventory.ownerId);
  if (inventory.environment !== "test") throw new RemoteAgentError("TARGET_ENVIRONMENT_INVALID", "Remote Product Target must be Test.", 400);
  if (typeof inventory.endpointReference !== "string" || !SAFE_REFERENCE.test(inventory.endpointReference)) throw new RemoteAgentError("TARGET_ENDPOINT_INVALID", "Target endpoint must be a non-secret reference.", 400);
  if (inventory.transport !== "outbound-https" || !REMOTE_AGENT_TRANSPORTS.includes(inventory.transport)) throw new RemoteAgentError("TARGET_TRANSPORT_INVALID", "Target must use outbound-only HTTPS transport.", 400);
  if (inventory.publicControlListener !== false || inventory.shellAccess !== false) throw new RemoteAgentError("TARGET_BOUNDARY_INVALID", "Public control listeners and shell access are forbidden.", 400);
  if (!inventory.capacity || !Number.isInteger(inventory.capacity.cpuCores) || inventory.capacity.cpuCores < 1 || !Number.isInteger(inventory.capacity.memoryMiB) || inventory.capacity.memoryMiB < 128 || !Number.isInteger(inventory.capacity.maxConcurrentRuns) || inventory.capacity.maxConcurrentRuns < 1) {
    throw new RemoteAgentError("TARGET_CAPACITY_INVALID", "Target capacity must be bounded.", 400);
  }
  if (!inventory.egress || inventory.egress.mode !== "allowlist" || !Array.isArray(inventory.egress.domains)) throw new RemoteAgentError("TARGET_EGRESS_INVALID", "Target egress must use an explicit allowlist.", 400);
  assertNoSensitive(inventory);
  return copy({
    targetId: inventory.targetId,
    projectId: inventory.projectId,
    ownerId: inventory.ownerId,
    environment: "test",
    endpointReference: inventory.endpointReference,
    transport: "outbound-https",
    publicControlListener: false,
    shellAccess: false,
    capacity: {
      cpuCores: inventory.capacity.cpuCores,
      memoryMiB: inventory.capacity.memoryMiB,
      maxConcurrentRuns: inventory.capacity.maxConcurrentRuns
    },
    egress: { mode: "allowlist", domains: [...new Set(inventory.egress.domains.map(String).map(value => value.toLowerCase()))].sort() },
    state: "planned"
  });
}

export function createRemoteAgentRegistry({ now = () => new Date().toISOString() } = {}) {
  const targets = new Map();
  const agents = new Map();
  const dispatches = new Set();
  const audit = [];

  function event(type, data) {
    audit.push(copy({ type, at: now(), ...data }));
  }

  function targetKey(projectId, targetId) { return `${projectId}\u0000${targetId}`; }
  function agentKey(projectId, targetId, agentId) { return `${projectId}\u0000${targetId}\u0000${agentId}`; }
  function getTarget(projectId, targetId) {
    const target = targets.get(targetKey(projectId, targetId));
    if (!target) throw new RemoteAgentError("TARGET_NOT_FOUND", "Remote target is not registered in this project.", 404);
    return target;
  }
  function getAgent(projectId, targetId, agentId) {
    const agent = agents.get(agentKey(projectId, targetId, agentId));
    if (!agent) throw new RemoteAgentError("AGENT_NOT_FOUND", "Remote Agent is not enrolled in this project target.", 404);
    return agent;
  }

  function registerTarget({ actor, inventory, authorization } = {}) {
    actorCanWrite(actor);
    const normalized = targetFromInventory(inventory);
    assertAuthorization(authorization, { operation: "remote-agent-enroll", projectId: normalized.projectId, targetId: normalized.targetId });
    const key = targetKey(normalized.projectId, normalized.targetId);
    if (targets.has(key)) throw new RemoteAgentError("TARGET_EXISTS", "Remote target already exists.", 409);
    const target = copy({ ...normalized, state: "approved", approvedAt: now(), approvedBy: actor.subject, authorizationId: authorization.authorizationId });
    targets.set(key, target);
    event("remote-target.approved", { projectId: target.projectId, targetId: target.targetId, authorizationId: target.authorizationId });
    return target;
  }

  function enrollAgent({ actor, projectId, targetId, agentId, publicKey, capabilities, authorization } = {}) {
    actorCanWrite(actor);
    assertId("projectId", projectId); assertId("targetId", targetId); assertId("agentId", agentId);
    const target = getTarget(projectId, targetId);
    assertAuthorization(authorization, { operation: "remote-agent-enroll", projectId, targetId });
    if (target.state !== "approved") throw new RemoteAgentError("TARGET_NOT_APPROVED", "Remote target is not approved.", 403);
    const normalizedCapabilities = assertCapabilities(capabilities);
    const fingerprintValue = publicKeyFingerprint(publicKey);
    const key = agentKey(projectId, targetId, agentId);
    if (agents.has(key)) throw new RemoteAgentError("AGENT_EXISTS", "Remote Agent already exists.", 409);
    const agent = {
      projectId, targetId, agentId, publicKey: publicKeyPem(publicKey), publicKeyFingerprint: fingerprintValue,
      capabilities: normalizedCapabilities, transport: "outbound-https", state: "active", enrolledAt: now(), lastHeartbeatAt: null,
      heartbeatTtlSeconds: 90, rotationVersion: 1, authorizationId: authorization.authorizationId
    };
    agents.set(key, agent);
    event("remote-agent.enrolled", { projectId, targetId, agentId, publicKeyFingerprint: fingerprintValue, authorizationId: authorization.authorizationId });
    return redactedAgent(agent);
  }

  function heartbeat({ projectId, targetId, agentId, identityFingerprint, capabilities, health = "healthy", runtimeDigest = null } = {}) {
    assertId("projectId", projectId); assertId("targetId", targetId); assertId("agentId", agentId);
    const agent = getAgent(projectId, targetId, agentId);
    if (agent.state !== "active" || agent.publicKeyFingerprint !== identityFingerprint) throw new RemoteAgentError("AGENT_IDENTITY_REJECTED", "Agent identity is invalid or revoked.", 403);
    if (!HEALTH_STATUSES.has(health)) throw new RemoteAgentError("HEALTH_INVALID", "Health status is not allowlisted.", 400);
    const normalizedCapabilities = assertCapabilities(capabilities);
    if (runtimeDigest !== null) assertDigest(runtimeDigest);
    const updated = { ...agent, capabilities: normalizedCapabilities, health, runtimeDigest, lastHeartbeatAt: now(), state: "active" };
    agents.set(agentKey(projectId, targetId, agentId), updated);
    event("remote-agent.heartbeat", { projectId, targetId, agentId, health, runtimeDigest: runtimeDigest ?? null });
    return redactedAgent(updated);
  }

  function simulateDispatch({ dispatch, projectId, targetId, agentId, now: at = now() } = {}) {
    assertId("projectId", projectId); assertId("targetId", targetId); assertId("agentId", agentId);
    const target = getTarget(projectId, targetId);
    const agent = getAgent(projectId, targetId, agentId);
    if (target.state !== "approved") throw new RemoteAgentError("TARGET_REVOKED", "Remote target is not approved.", 403);
    if (agent.state !== "active") throw new RemoteAgentError("AGENT_REVOKED", "Remote Agent is not active.", 403);
    const verified = verifySignedRemoteDispatch({ dispatch, publicKey: agent.publicKey, now: at });
    const payload = verified.payload;
    if (payload.projectId !== projectId || payload.targetId !== targetId || payload.agentId !== agentId) throw new RemoteAgentError("DISPATCH_SCOPE_MISMATCH", "Dispatch is outside the enrolled target scope.", 403);
    if (dispatches.has(payload.dispatchId) || dispatches.has(payload.nonce)) throw new RemoteAgentError("DISPATCH_REPLAY", "Dispatch or nonce was already consumed.", 409);
    dispatches.add(payload.dispatchId); dispatches.add(payload.nonce);
    const result = copy({
      status: "completed",
      code: "REMOTE_AGENT_SIMULATION_COMPLETED",
      mode: "simulation-only",
      sideEffect: false,
      dispatchId: payload.dispatchId,
      projectId,
      targetId,
      agentId,
      operation: payload.operation,
      artifactDigest: payload.artifactDigest,
      receivedAt: at,
      publicKeyFingerprint: agent.publicKeyFingerprint
    });
    event("remote-agent.dispatch-simulated", { ...result });
    return result;
  }

  function revokeAgent({ actor, projectId, targetId, agentId, authorization, reason } = {}) {
    actorCanWrite(actor); assertId("projectId", projectId); assertId("targetId", targetId); assertId("agentId", agentId);
    const agent = getAgent(projectId, targetId, agentId);
    assertAuthorization(authorization, { operation: "remote-agent-revoke", projectId, targetId });
    if (typeof reason !== "string" || reason.trim().length < 8 || SENSITIVE_VALUE.test(reason)) throw new RemoteAgentError("REVOKE_REASON_INVALID", "A non-sensitive revoke reason is required.", 400);
    const updated = { ...agent, state: "revoked", revokedAt: now(), revokedBy: actor.subject, revokeReason: reason.trim().slice(0, 240) };
    agents.set(agentKey(projectId, targetId, agentId), updated);
    event("remote-agent.revoked", { projectId, targetId, agentId, reason: updated.revokeReason });
    return copy({ ...updated, publicKey: undefined });
  }

  function revokeTarget({ actor, projectId, targetId, authorization, reason } = {}) {
    actorCanWrite(actor); assertId("projectId", projectId); assertId("targetId", targetId);
    const target = getTarget(projectId, targetId);
    assertAuthorization(authorization, { operation: "remote-agent-revoke", projectId, targetId });
    if (typeof reason !== "string" || reason.trim().length < 8 || SENSITIVE_VALUE.test(reason)) throw new RemoteAgentError("REVOKE_REASON_INVALID", "A non-sensitive revoke reason is required.", 400);
    const updated = { ...target, state: "revoked", revokedAt: now(), revokedBy: actor.subject, revokeReason: reason.trim().slice(0, 240) };
    targets.set(targetKey(projectId, targetId), updated);
    event("remote-target.revoked", { projectId, targetId, reason: updated.revokeReason });
    return updated;
  }

  function view({ projectId, targetId } = {}) {
    assertId("projectId", projectId); assertId("targetId", targetId);
    const target = getTarget(projectId, targetId);
    const targetAgents = [...agents.values()].filter(agent => agent.projectId === projectId && agent.targetId === targetId).map(redactedAgent);
    return copy({ target, agents: targetAgents, audit: audit.filter(item => item.projectId === projectId && item.targetId === targetId) });
  }

  return Object.freeze({ registerTarget, enrollAgent, heartbeat, simulateDispatch, revokeAgent, revokeTarget, view });
}
