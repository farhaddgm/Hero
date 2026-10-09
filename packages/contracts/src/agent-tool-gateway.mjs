export const AGENT_TOOL_GATEWAY_CONTRACT_VERSION = "1.0";

export const TOOL_RISK_TIERS = Object.freeze(["read", "local-write", "external-read", "sensitive"]);

export const TOOL_SIDE_EFFECTS = Object.freeze(["none", "local-write", "external", "sensitive"]);

export const TOOL_ARGUMENT_TYPES = Object.freeze(["string", "integer", "boolean", "enum", "relative-path", "https-url"]);

export const TOOL_DECISION_CODES = Object.freeze([
  "ALLOWED",
  "APPROVAL_REQUIRED",
  "GLOBAL_STOP_ACTIVE",
  "TOOL_NOT_REGISTERED",
  "TOOL_DISABLED",
  "TOOL_DEFINITION_CHANGED",
  "AGENT_NOT_GRANTED",
  "AGENT_QUARANTINED",
  "AGENT_CIRCUIT_OPEN",
  "SCOPE_VIOLATION",
  "ARGUMENT_REJECTED",
  "SECRET_IN_ARGUMENT",
  "INJECTION_BLOCKED",
  "SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL",
  "AUTHORIZATION_DENIED",
  "RATE_LIMITED"
]);

/**
 * Mapping of the OWASP Top 10 for Agentic Applications (2026) to concrete Hero controls.
 * The category names come from secondary write-ups of the December 2025 publication and must
 * be re-confirmed against the official OWASP GenAI Security Project text before they are quoted
 * outside this repository. `tools/check-agentic-security.mjs` fails when a category loses its
 * control, its implementation file or its test.
 */
export const OWASP_AGENTIC_CONTROLS = Object.freeze([
  Object.freeze({
    id: "ASI01", name: "Agent Goal Hijack",
    controls: Object.freeze([
      Object.freeze({ control: "Untrusted content is wrapped as quoted data and injection patterns block or escalate a tool call", implementation: "packages/domain/src/content-safety.mjs", test: "tests/wp03-content-safety.test.mjs" }),
      Object.freeze({ control: "Gateway screens every string argument for injection and forces human approval when the verdict is doubtful", implementation: "packages/domain/src/agent-tool-gateway.mjs", test: "tests/agent-redteam.test.mjs" })
    ])
  }),
  Object.freeze({
    id: "ASI02", name: "Tool Misuse and Exploitation",
    controls: Object.freeze([
      Object.freeze({ control: "Allowlisted tools, typed and bounded arguments, unknown argument names refused", implementation: "packages/domain/src/agent-tool-gateway.mjs", test: "tests/agent-tool-gateway.test.mjs" })
    ])
  }),
  Object.freeze({
    id: "ASI03", name: "Identity and Privilege Abuse",
    controls: Object.freeze([
      Object.freeze({ control: "Per-agent grant with project scope; version-bound authorization snapshot and Global Stop", implementation: "packages/domain/src/authorization-engine.mjs", test: "tests/authorization-engine.test.mjs" }),
      Object.freeze({ control: "Gateway refuses cross-project calls and agent identities without a grant", implementation: "packages/domain/src/agent-tool-gateway.mjs", test: "tests/agent-tool-gateway.test.mjs" })
    ])
  }),
  Object.freeze({
    id: "ASI04", name: "Agentic Supply Chain Vulnerabilities",
    controls: Object.freeze([
      Object.freeze({ control: "Tool definitions are pinned by digest; a changed definition quarantines the tool until the owner re-approves it; a bill of materials lists every tool", implementation: "packages/domain/src/agent-tool-gateway.mjs", test: "tests/agent-redteam.test.mjs" })
    ])
  }),
  Object.freeze({
    id: "ASI05", name: "Unexpected Code Execution",
    controls: Object.freeze([
      Object.freeze({ control: "Isolated runner: closed network, relative worktree, timeout, checkpoint before cleanup", implementation: "packages/domain/src/runner-engine.mjs", test: "tests/runner-engine.test.mjs" }),
      Object.freeze({ control: "Product runner adapter rejects privileged, host-mounted and mutable-image plans", implementation: "packages/adapters/src/product-runner.mjs", test: "tests/product-runner-adapter.test.mjs" })
    ])
  }),
  Object.freeze({
    id: "ASI06", name: "Memory and Context Poisoning",
    controls: Object.freeze([
      Object.freeze({ control: "Instruction-like memory is flagged, expired memory is dropped and cross-project memory is unreachable", implementation: "packages/domain/src/project-memory.mjs", test: "tests/collaboration-adversarial-bo073.test.mjs" })
    ])
  }),
  Object.freeze({
    id: "ASI07", name: "Insecure Inter-Agent Communication",
    controls: Object.freeze([
      Object.freeze({ control: "Agent messages are HMAC-signed with a per-agent key, bound to a recipient and a nonce, and replays are refused", implementation: "packages/domain/src/agent-tool-gateway.mjs", test: "tests/agent-redteam.test.mjs" }),
      Object.freeze({ control: "Node agent commands are Ed25519-signed, scoped and expire", implementation: "packages/domain/src/remote-agent.mjs", test: "tests/remote-agent.test.mjs" })
    ])
  }),
  Object.freeze({
    id: "ASI08", name: "Cascading Failures",
    controls: Object.freeze([
      Object.freeze({ control: "Per-agent rate limit and circuit breaker that opens after consecutive denials", implementation: "packages/domain/src/agent-tool-gateway.mjs", test: "tests/agent-redteam.test.mjs" }),
      Object.freeze({ control: "Bounded concurrency and cost caps with safe pause", implementation: "packages/domain/src/runner-engine.mjs", test: "tests/runner-engine.test.mjs" })
    ])
  }),
  Object.freeze({
    id: "ASI09", name: "Human-Agent Trust Exploitation",
    controls: Object.freeze([
      Object.freeze({ control: "Approval prompts are generated from registered tool metadata, never from agent-written text; approvals are single-use and bound to the exact argument digest", implementation: "packages/domain/src/agent-tool-gateway.mjs", test: "tests/agent-redteam.test.mjs" })
    ])
  }),
  Object.freeze({
    id: "ASI10", name: "Rogue Agents",
    controls: Object.freeze([
      Object.freeze({ control: "Owner can quarantine an agent; Global Stop blocks every new call; hash-chained audit exposes drift", implementation: "packages/domain/src/agent-tool-gateway.mjs", test: "tests/agent-redteam.test.mjs" })
    ])
  })
]);

export function getAgentToolGatewayContractSummary() {
  return Object.freeze({
    version: AGENT_TOOL_GATEWAY_CONTRACT_VERSION,
    riskTiers: TOOL_RISK_TIERS,
    argumentTypes: TOOL_ARGUMENT_TYPES,
    decisionCodes: TOOL_DECISION_CODES,
    owaspCategories: OWASP_AGENTIC_CONTROLS.map(item => Object.freeze({ id: item.id, name: item.name, controlCount: item.controls.length })),
    defaultPosture: "deny",
    boundary: "The gateway is a policy decision point. It never executes a tool, opens a network connection or reads a Secret; the caller executes only after an ALLOWED decision.",
    auditBoundary: "Audit records hold argument names and a digest, never argument values."
  });
}

export function validateAgentToolGatewayContract() {
  const errors = [];
  if (AGENT_TOOL_GATEWAY_CONTRACT_VERSION !== "1.0") errors.push("Unexpected gateway contract version.");
  const expected = ["ASI01", "ASI02", "ASI03", "ASI04", "ASI05", "ASI06", "ASI07", "ASI08", "ASI09", "ASI10"];
  const ids = OWASP_AGENTIC_CONTROLS.map(item => item.id);
  for (const id of expected) if (!ids.includes(id)) errors.push(`OWASP category ${id} has no mapping.`);
  if (new Set(ids).size !== ids.length) errors.push("OWASP category ids must be unique.");
  for (const item of OWASP_AGENTIC_CONTROLS) {
    if (item.controls.length === 0) errors.push(`OWASP category ${item.id} has no control.`);
    for (const control of item.controls) {
      if (!control.control || !control.implementation || !control.test) errors.push(`OWASP category ${item.id} has an incomplete control.`);
    }
  }
  for (const code of ["ALLOWED", "GLOBAL_STOP_ACTIVE", "TOOL_DEFINITION_CHANGED", "SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL"]) {
    if (!TOOL_DECISION_CODES.includes(code)) errors.push(`Required decision code ${code} is missing.`);
  }
  return Object.freeze(errors);
}
