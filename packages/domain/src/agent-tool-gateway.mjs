import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  AGENT_TOOL_GATEWAY_CONTRACT_VERSION,
  TOOL_ARGUMENT_TYPES,
  TOOL_RISK_TIERS,
  TOOL_SIDE_EFFECTS
} from "../../contracts/src/agent-tool-gateway.mjs";
import { SENSITIVE_ACTIONS } from "../../contracts/src/operational-data.mjs";
import { analyzePromptInjection, assessUrlSyntax } from "./content-safety.mjs";

/**
 * Agent Tool Gateway — a policy decision point that sits between an AI agent and any tool.
 *
 * It never executes a tool, opens a connection or reads a Secret. The caller runs a tool only
 * after an ALLOWED decision. Every decision is appended to a hash-chained audit that keeps
 * argument names and a digest, never argument values. Default posture is deny.
 */

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SECRET_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b)/u;
const SECRET_ASSIGNMENT = /(?:\b(?:password|passwd|secret|credential|api[ _-]?key|token)\b\s*[:=]\s*\S+|(?:رمز(?:\s*عبور)?|کلید\s*api|توکن)\s*[:=]\s*\S+)/iu;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|opt|root|etc|var)\/)/u;
const MAX_ARGUMENTS = 16;
const DEFAULT_MAX_STRING = 2_000;
const DEFAULT_PROMPT_VALUE_CHARS = 200;
const DENIAL_CODES_THAT_COUNT = new Set([
  "TOOL_NOT_REGISTERED", "TOOL_DEFINITION_CHANGED", "AGENT_NOT_GRANTED", "SCOPE_VIOLATION",
  "ARGUMENT_REJECTED", "SECRET_IN_ARGUMENT", "INJECTION_BLOCKED", "SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL",
  "AUTHORIZATION_DENIED"
]);

export class AgentToolGatewayError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AgentToolGatewayError";
    this.code = code;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function identifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new AgentToolGatewayError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function assertOwner(actor) {
  if (!actor || actor.kind !== "project-owner" || typeof actor.id !== "string" || actor.id.length < 3) {
    throw new AgentToolGatewayError("OWNER_REQUIRED", "Only the project owner may change gateway policy.");
  }
}

function frozenCopy(value) {
  return Object.freeze(structuredClone(value));
}

function normalizeDefinition(input) {
  if (!input || typeof input !== "object") throw new AgentToolGatewayError("INVALID_DEFINITION", "A tool definition is required.");
  const toolId = identifier("toolId", input.toolId);
  if (!TOOL_RISK_TIERS.includes(input.riskTier)) throw new AgentToolGatewayError("INVALID_DEFINITION", "riskTier is not supported.");
  const sideEffect = input.sideEffect ?? (input.riskTier === "read" ? "none" : input.riskTier === "local-write" ? "local-write" : input.riskTier === "external-read" ? "external" : "sensitive");
  if (!TOOL_SIDE_EFFECTS.includes(sideEffect)) throw new AgentToolGatewayError("INVALID_DEFINITION", "sideEffect is not supported.");
  if (input.riskTier === "read" && sideEffect !== "none") throw new AgentToolGatewayError("INVALID_DEFINITION", "A read tool cannot declare a side effect.");
  if (input.riskTier === "sensitive") {
    if (!SENSITIVE_ACTIONS.includes(input.sensitiveAction)) throw new AgentToolGatewayError("INVALID_DEFINITION", "A sensitive tool must name one of the separately gated actions.");
  } else if (input.sensitiveAction !== undefined) {
    throw new AgentToolGatewayError("INVALID_DEFINITION", "Only a sensitive tool may name a gated action.");
  }
  if (typeof input.title !== "string" || input.title.trim().length < 2 || input.title.length > 120) throw new AgentToolGatewayError("INVALID_DEFINITION", "title is required (2-120 characters).");
  if (typeof input.summary !== "string" || input.summary.trim().length < 5 || input.summary.length > 400) throw new AgentToolGatewayError("INVALID_DEFINITION", "summary is required (5-400 characters).");
  const schema = input.argumentSchema ?? {};
  const names = Object.keys(schema);
  if (names.length > MAX_ARGUMENTS) throw new AgentToolGatewayError("INVALID_DEFINITION", `At most ${MAX_ARGUMENTS} arguments are supported.`);
  const argumentSchema = {};
  for (const name of names) {
    if (!/^[a-z][A-Za-z0-9]{0,39}$/.test(name)) throw new AgentToolGatewayError("INVALID_DEFINITION", "Argument names must be short camelCase identifiers.");
    const spec = schema[name];
    if (!spec || !TOOL_ARGUMENT_TYPES.includes(spec.type)) throw new AgentToolGatewayError("INVALID_DEFINITION", `Argument ${name} has an unsupported type.`);
    if (spec.type === "enum" && (!Array.isArray(spec.values) || spec.values.length === 0 || spec.values.length > 32 || spec.values.some(item => typeof item !== "string"))) {
      throw new AgentToolGatewayError("INVALID_DEFINITION", `Argument ${name} needs a bounded list of values.`);
    }
    if (spec.pattern !== undefined) {
      if (typeof spec.pattern !== "string" || spec.pattern.length > 200) throw new AgentToolGatewayError("INVALID_DEFINITION", `Argument ${name} has an invalid pattern.`);
      try { new RegExp(spec.pattern, "u"); } catch { throw new AgentToolGatewayError("INVALID_DEFINITION", `Argument ${name} has an invalid pattern.`); }
    }
    argumentSchema[name] = { type: spec.type, required: spec.required === true, ...(spec.maxLength === undefined ? {} : { maxLength: spec.maxLength }), ...(spec.minimum === undefined ? {} : { minimum: spec.minimum }), ...(spec.maximum === undefined ? {} : { maximum: spec.maximum }), ...(spec.values === undefined ? {} : { values: [...spec.values] }), ...(spec.pattern === undefined ? {} : { pattern: spec.pattern }) };
  }
  return {
    toolId,
    title: input.title.trim(),
    summary: input.summary.trim(),
    riskTier: input.riskTier,
    sideEffect,
    ...(input.sensitiveAction === undefined ? {} : { sensitiveAction: input.sensitiveAction }),
    requiresApproval: input.requiresApproval === true || input.riskTier === "external-read" || input.riskTier === "sensitive",
    argumentSchema
  };
}

function validateArguments(schema, args) {
  const problems = [];
  if (args === null || typeof args !== "object" || Array.isArray(args)) return [{ argument: "*", rule: "arguments-must-be-an-object" }];
  for (const name of Object.keys(args)) if (!(name in schema)) problems.push({ argument: name, rule: "unknown-argument" });
  for (const [name, spec] of Object.entries(schema)) {
    const value = args[name];
    if (value === undefined) { if (spec.required) problems.push({ argument: name, rule: "required" }); continue; }
    if (spec.type === "boolean") { if (typeof value !== "boolean") problems.push({ argument: name, rule: "type" }); continue; }
    if (spec.type === "integer") {
      if (!Number.isInteger(value)) problems.push({ argument: name, rule: "type" });
      else if ((spec.minimum !== undefined && value < spec.minimum) || (spec.maximum !== undefined && value > spec.maximum)) problems.push({ argument: name, rule: "range" });
      continue;
    }
    if (typeof value !== "string") { problems.push({ argument: name, rule: "type" }); continue; }
    if (value.length > (spec.maxLength ?? DEFAULT_MAX_STRING)) { problems.push({ argument: name, rule: "length" }); continue; }
    if (spec.type === "enum" && !spec.values.includes(value)) problems.push({ argument: name, rule: "enum" });
    else if (spec.type === "relative-path") {
      const normalized = value.replace(/\\/g, "/");
      if (value.length === 0 || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || normalized.split("/").includes("..") || normalized.includes("\u0000") || normalized.startsWith("~")) problems.push({ argument: name, rule: "path" });
    } else if (spec.type === "https-url") {
      if (!assessUrlSyntax(value).ok) problems.push({ argument: name, rule: "url" });
    } else if (spec.pattern !== undefined && !new RegExp(spec.pattern, "u").test(value)) problems.push({ argument: name, rule: "pattern" });
  }
  return problems;
}

function stringValues(args) {
  return Object.values(args ?? {}).filter(value => typeof value === "string");
}

/** Recomputes the hash chain of gateway audit entries; any edit, removal or reordering is detected. */
export function verifyAuditChain(entries) {
  let previous = "genesis";
  for (const entry of entries) {
    const { hash, ...body } = entry;
    if (body.previousHash !== previous || digest(body) !== hash) return Object.freeze({ ok: false, brokenAt: entry.seq });
    previous = hash;
  }
  return Object.freeze({ ok: true, entries: entries.length });
}

/** Signs a message so a receiving agent can prove origin, recipient, freshness and integrity. */
export function signAgentMessage({ key, from, to, nonce, issuedAt, body }) {
  identifier("from", from);
  identifier("to", to);
  identifier("nonce", nonce);
  if (!Buffer.isBuffer(key) || key.length < 32) throw new AgentToolGatewayError("INVALID_KEY", "A signing key of at least 32 bytes is required.");
  const bodyText = typeof body === "string" ? body : JSON.stringify(stable(body));
  const bodyDigest = createHash("sha256").update(bodyText).digest("hex");
  const mac = createHmac("sha256", key).update(`${from}\n${to}\n${nonce}\n${issuedAt}\n${bodyDigest}`).digest("hex");
  return Object.freeze({ from, to, nonce, issuedAt, body: bodyText, bodyDigest, mac });
}

export function createAgentToolGateway(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const globalStop = options.globalStop ?? (() => false);
  const authorization = options.authorization ?? null;
  const sensitiveVerifier = options.sensitiveVerifier ?? null;
  const maxCallsPerWindow = options.maxCallsPerWindow ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const circuitThreshold = options.circuitThreshold ?? 5;
  const approvalTtlMs = options.approvalTtlMs ?? 10 * 60_000;
  const messageTtlMs = options.messageTtlMs ?? 5 * 60_000;
  const requireDefinitionPin = options.requireDefinitionPin !== false;

  const tools = new Map();
  const grants = new Map();
  const approvals = new Map();
  const keys = new Map();
  const windows = new Map();
  const nonces = new Set();
  const audit = [];
  let approvalSequence = 0;

  const nowMs = () => Date.parse(now());

  function record(kind, data) {
    const previous = audit.length === 0 ? "genesis" : audit[audit.length - 1].hash;
    const body = { seq: audit.length + 1, at: now(), kind, ...data, previousHash: previous };
    const entry = Object.freeze({ ...body, hash: digest(body) });
    audit.push(entry);
    return entry;
  }

  function grantFor(agentId) {
    return grants.get(agentId);
  }

  function describeForApproval(tool, projectId, args) {
    const lines = Object.entries(args ?? {}).map(([name, value]) => {
      const text = typeof value === "string" ? value.slice(0, DEFAULT_PROMPT_VALUE_CHARS) : String(value);
      return `${name}: «${text.replace(/[\r\n]+/g, " ")}»`;
    });
    return Object.freeze({
      source: "registered-tool-metadata",
      title: tool.title,
      summary: tool.summary,
      riskTier: tool.riskTier,
      sensitiveAction: tool.sensitiveAction ?? null,
      projectId,
      quotedArguments: Object.freeze(lines),
      notice: "این توضیح از تعریف ثبت‌شدهٔ ابزار ساخته شده است، نه از متن نوشته‌شده توسط عامل. مقدارهای نقل‌شده داده‌اند و دستور نیستند."
    });
  }

  function finish({ input, tool, code, reasons = [], argsDigest, argKeys, approvalPrompt }) {
    const agent = input.agentId && grantFor(input.agentId);
    const allowed = code === "ALLOWED";
    if (agent) {
      if (allowed) agent.consecutiveDenials = 0;
      else if (DENIAL_CODES_THAT_COUNT.has(code)) {
        agent.consecutiveDenials += 1;
        if (agent.consecutiveDenials >= circuitThreshold && !agent.circuitOpen) {
          agent.circuitOpen = true;
          record("circuit-opened", { agentId: input.agentId, consecutiveDenials: agent.consecutiveDenials });
        }
      }
    }
    const entry = record("tool-call", {
      agentId: input.agentId ?? null,
      projectId: input.projectId ?? null,
      toolId: input.toolId ?? null,
      toolVersion: tool?.version ?? null,
      code,
      allowed,
      argKeys,
      argsDigest,
      reasons
    });
    return Object.freeze({ allowed, code, reasons: Object.freeze([...reasons]), approvalRequired: code === "APPROVAL_REQUIRED", ...(approvalPrompt ? { approvalPrompt } : {}), argsDigest, auditSeq: entry.seq });
  }

  const gateway = {
    registerTool({ actor, definition }) {
      assertOwner(actor);
      const normalized = normalizeDefinition(definition);
      const previous = tools.get(normalized.toolId);
      const version = (previous?.version ?? 0) + 1;
      const toolDigest = digest(normalized);
      const stored = Object.freeze({ definition: frozenCopy(normalized), version, digest: toolDigest, status: "active", registeredBy: actor.id, registeredAt: now() });
      tools.set(normalized.toolId, stored);
      record("tool-registered", { toolId: normalized.toolId, version, digest: toolDigest, riskTier: normalized.riskTier, actorId: actor.id });
      return Object.freeze({ toolId: normalized.toolId, version, digest: toolDigest });
    },

    setToolStatus({ actor, toolId, status }) {
      assertOwner(actor);
      identifier("toolId", toolId);
      if (!["active", "disabled"].includes(status)) throw new AgentToolGatewayError("INVALID_STATUS", "Status must be active or disabled.");
      const tool = tools.get(toolId);
      if (!tool) throw new AgentToolGatewayError("TOOL_NOT_REGISTERED", "Tool is not registered.");
      tools.set(toolId, Object.freeze({ ...tool, status }));
      record("tool-status", { toolId, status, actorId: actor.id });
    },

    grantAgent({ actor, agentId, toolIds, projectIds }) {
      assertOwner(actor);
      identifier("agentId", agentId);
      if (!Array.isArray(toolIds) || toolIds.length === 0 || !Array.isArray(projectIds) || projectIds.length === 0) throw new AgentToolGatewayError("INVALID_GRANT", "toolIds and projectIds are required.");
      toolIds.forEach(id => identifier("toolId", id));
      projectIds.forEach(id => identifier("projectId", id));
      const previous = grants.get(agentId);
      grants.set(agentId, { toolIds: new Set(toolIds), projectIds: new Set(projectIds), quarantined: previous?.quarantined === true, circuitOpen: false, consecutiveDenials: 0 });
      record("agent-granted", { agentId, toolIds: [...toolIds].sort(), projectIds: [...projectIds].sort(), actorId: actor.id });
    },

    quarantineAgent({ actor, agentId, reason }) {
      assertOwner(actor);
      identifier("agentId", agentId);
      const grant = grants.get(agentId);
      if (!grant) throw new AgentToolGatewayError("AGENT_NOT_GRANTED", "Agent has no grant.");
      grant.quarantined = true;
      record("agent-quarantined", { agentId, actorId: actor.id, reasonDigest: digest(String(reason ?? "")) });
    },

    releaseAgent({ actor, agentId }) {
      assertOwner(actor);
      const grant = grants.get(identifier("agentId", agentId));
      if (!grant) throw new AgentToolGatewayError("AGENT_NOT_GRANTED", "Agent has no grant.");
      grant.quarantined = false;
      grant.circuitOpen = false;
      grant.consecutiveDenials = 0;
      record("agent-released", { agentId, actorId: actor.id });
    },

    registerAgentKey({ actor, agentId, key }) {
      assertOwner(actor);
      identifier("agentId", agentId);
      if (!Buffer.isBuffer(key) || key.length < 32) throw new AgentToolGatewayError("INVALID_KEY", "A key of at least 32 bytes is required.");
      keys.set(agentId, Buffer.from(key));
      record("agent-key-registered", { agentId, actorId: actor.id });
    },

    /** Records a single-use approval bound to the exact agent, project, tool and argument digest. Only a human owner can approve. */
    recordApproval({ actor, agentId, projectId, toolId, args }) {
      assertOwner(actor);
      identifier("agentId", agentId);
      identifier("projectId", projectId);
      identifier("toolId", toolId);
      if (!tools.has(toolId)) throw new AgentToolGatewayError("TOOL_NOT_REGISTERED", "Tool is not registered.");
      approvalSequence += 1;
      const approvalId = `approval-${String(approvalSequence).padStart(6, "0")}`;
      approvals.set(approvalId, { agentId, projectId, toolId, argsDigest: digest(args ?? {}), expiresAtMs: nowMs() + approvalTtlMs, used: false, toolDigest: tools.get(toolId).digest });
      record("approval-recorded", { approvalId, agentId, projectId, toolId, actorId: actor.id });
      return approvalId;
    },

    evaluateCall(input = {}) {
      identifier("agentId", input.agentId);
      identifier("projectId", input.projectId);
      identifier("toolId", input.toolId);
      const args = input.args ?? {};
      const argsDigest = digest(args);
      const argKeys = args && typeof args === "object" && !Array.isArray(args) ? Object.keys(args).sort() : [];
      const stored = tools.get(input.toolId);
      const deny = (code, reasons = [], extra = {}) => finish({ input, tool: stored, code, reasons, argsDigest, argKeys, ...extra });

      if (globalStop()) return deny("GLOBAL_STOP_ACTIVE", ["Global Stop blocks every new tool call."]);
      if (!stored) return deny("TOOL_NOT_REGISTERED", ["The tool is not on the allowlist."]);
      if (stored.status !== "active") return deny("TOOL_DISABLED", [`The tool is ${stored.status}.`]);
      if (input.observedDefinitionDigest === undefined) {
        if (requireDefinitionPin) return deny("TOOL_DEFINITION_CHANGED", ["The served tool definition was not presented for pin verification."]);
      } else if (input.observedDefinitionDigest !== stored.digest) {
        tools.set(input.toolId, Object.freeze({ ...stored, status: "quarantined" }));
        record("tool-quarantined", { toolId: input.toolId, pinned: stored.digest, observed: String(input.observedDefinitionDigest).slice(0, 64) });
        return deny("TOOL_DEFINITION_CHANGED", ["The served definition differs from the pinned one; the tool is quarantined until the owner re-registers it."]);
      }

      const grant = grantFor(input.agentId);
      if (!grant) return deny("AGENT_NOT_GRANTED", ["The agent has no grant."]);
      if (grant.quarantined) return deny("AGENT_QUARANTINED", ["The agent is quarantined by the owner."]);
      if (grant.circuitOpen) return deny("AGENT_CIRCUIT_OPEN", ["Repeated denials opened the circuit; the owner must review and release the agent."]);
      if (!grant.toolIds.has(input.toolId)) return deny("AGENT_NOT_GRANTED", ["The agent is not granted this tool."]);
      if (!grant.projectIds.has(input.projectId)) return deny("SCOPE_VIOLATION", ["The agent is not granted this project."]);

      const stamps = (windows.get(input.agentId) ?? []).filter(stamp => stamp > nowMs() - windowMs);
      if (stamps.length >= maxCallsPerWindow) { windows.set(input.agentId, stamps); return deny("RATE_LIMITED", ["The agent exceeded its call budget for this window."]); }
      stamps.push(nowMs());
      windows.set(input.agentId, stamps);

      const definition = stored.definition;
      const problems = validateArguments(definition.argumentSchema, args);
      if (problems.length > 0) return deny("ARGUMENT_REJECTED", problems.map(problem => `${problem.argument}:${problem.rule}`));
      const strings = stringValues(args);
      if (strings.some(text => SECRET_VALUE.test(text) || SECRET_ASSIGNMENT.test(text) || HOST_PATH.test(text))) {
        return deny("SECRET_IN_ARGUMENT", ["A tool argument looks like a credential or a host path; pass a reference instead."]);
      }
      let needsApproval = definition.requiresApproval;
      const reasons = [];
      for (const text of strings) {
        const verdict = analyzePromptInjection(text);
        if (verdict.risk === "high") return deny("INJECTION_BLOCKED", verdict.findings.map(item => item.rule ?? item.id ?? "injection"));
        if (verdict.risk === "medium") { needsApproval = true; reasons.push("An argument contains doubtful instruction-like text; a human must review it."); }
      }

      if (definition.riskTier === "sensitive") {
        const verified = typeof sensitiveVerifier === "function" && sensitiveVerifier({ agentId: input.agentId, projectId: input.projectId, toolId: input.toolId, sensitiveAction: definition.sensitiveAction, authorization: input.authorization }) === true;
        if (!verified) return deny("SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL", [`${definition.sensitiveAction} needs its own version-bound authorization; a gateway approval cannot replace it.`]);
      }

      if (definition.riskTier === "local-write") {
        if (!authorization || !input.authorization) return deny("AUTHORIZATION_DENIED", ["A local write needs an active version-bound authorization."]);
        let decision;
        try {
          decision = authorization.evaluateDispatch({ actor: { kind: "agent", id: input.agentId }, authorizationId: input.authorization.authorizationId, stepId: input.authorization.stepId, documentVersion: input.authorization.documentVersion, operation: "develop", idempotencyKey: `gw-${digest({ n: audit.length, agentId: input.agentId, argsDigest }).slice(0, 40)}`, expectedVersion: input.authorization.expectedVersion });
        } catch {
          return deny("AUTHORIZATION_DENIED", ["The authorization request was malformed."]);
        }
        if (!decision.decision.authorized) return deny("AUTHORIZATION_DENIED", [decision.decision.code]);
      }

      if (needsApproval) {
        const approval = input.approvalId === undefined ? null : approvals.get(input.approvalId);
        const valid = approval && !approval.used && approval.expiresAtMs > nowMs() && approval.agentId === input.agentId && approval.projectId === input.projectId && approval.toolId === input.toolId && approval.argsDigest === argsDigest && approval.toolDigest === stored.digest;
        if (!valid) return deny("APPROVAL_REQUIRED", reasons.length > 0 ? reasons : ["This tool needs a single-use human approval."], { approvalPrompt: describeForApproval(definition, input.projectId, args) });
        approval.used = true;
        record("approval-consumed", { approvalId: input.approvalId, toolId: input.toolId });
      }

      return finish({ input, tool: stored, code: "ALLOWED", reasons, argsDigest, argKeys });
    },

    verifyAgentMessage(message, { expectedRecipient } = {}) {
      const result = (ok, code) => {
        record("agent-message", { from: message?.from ?? null, to: message?.to ?? null, ok, code });
        return Object.freeze({ ok, code });
      };
      if (!message || typeof message !== "object") return result(false, "MALFORMED");
      const key = keys.get(message.from);
      if (!key) return result(false, "UNKNOWN_SENDER");
      if (expectedRecipient !== undefined && message.to !== expectedRecipient) return result(false, "WRONG_RECIPIENT");
      if (typeof message.body !== "string" || createHash("sha256").update(message.body).digest("hex") !== message.bodyDigest) return result(false, "BODY_TAMPERED");
      const expected = createHmac("sha256", key).update(`${message.from}\n${message.to}\n${message.nonce}\n${message.issuedAt}\n${message.bodyDigest}`).digest();
      let provided;
      try { provided = Buffer.from(String(message.mac), "hex"); } catch { provided = Buffer.alloc(0); }
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return result(false, "BAD_SIGNATURE");
      const issued = Date.parse(message.issuedAt);
      if (!Number.isFinite(issued) || Math.abs(nowMs() - issued) > messageTtlMs) return result(false, "EXPIRED");
      const nonceKey = `${message.from}\u0000${message.nonce}`;
      if (nonces.has(nonceKey)) return result(false, "REPLAYED");
      nonces.add(nonceKey);
      const analysis = analyzePromptInjection(message.body);
      record("agent-message", { from: message.from, to: message.to, ok: true, code: "VERIFIED", injectionRisk: analysis.risk });
      return Object.freeze({ ok: true, code: "VERIFIED", injection: analysis });
    },

    /** Bill of materials of every tool the gateway knows, with pinned digests. */
    bom() {
      return Object.freeze([...tools.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([toolId, tool]) => Object.freeze({ toolId, version: tool.version, digest: tool.digest, riskTier: tool.definition.riskTier, status: tool.status })));
    },

    toolDigest(toolId) {
      return tools.get(toolId)?.digest ?? null;
    },

    audit() {
      return Object.freeze([...audit]);
    },

    verifyAudit() {
      return verifyAuditChain(audit);
    },

    contractVersion: AGENT_TOOL_GATEWAY_CONTRACT_VERSION
  };

  return Object.freeze(gateway);
}
