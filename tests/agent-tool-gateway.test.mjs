import assert from "node:assert/strict";
import test from "node:test";

import {
  getAgentToolGatewayContractSummary,
  validateAgentToolGatewayContract
} from "../packages/contracts/src/agent-tool-gateway.mjs";
import { AgentToolGatewayError, verifyAuditChain } from "../packages/domain/src/agent-tool-gateway.mjs";
import { TOOLS, createFixture, owner } from "./helpers/gateway-fixture.mjs";

test("contract maps all ten OWASP agentic categories and stays self-consistent", () => {
  assert.deepEqual(validateAgentToolGatewayContract(), []);
  const summary = getAgentToolGatewayContractSummary();
  assert.equal(summary.defaultPosture, "deny");
  assert.equal(summary.owaspCategories.length, 10);
});

test("a granted read call with a presented pin is allowed and audited without argument values", () => {
  const f = createFixture();
  const decision = f.call({ args: { path: "docs/readme.md" } });
  assert.equal(decision.allowed, true);
  assert.equal(decision.code, "ALLOWED");
  const entry = f.gateway.audit().at(-1);
  assert.deepEqual(entry.argKeys, ["path"]);
  assert.equal(JSON.stringify(entry).includes("docs/readme.md"), false);
  assert.equal(f.gateway.verifyAudit().ok, true);
});

test("default posture is deny: unknown tool, missing grant, disabled tool and missing pin", () => {
  const f = createFixture();
  assert.equal(f.call({ toolId: "shell.exec", observedDefinitionDigest: "x" }).code, "TOOL_NOT_REGISTERED");
  assert.equal(f.call({ agentId: "agent-stranger" }).code, "AGENT_NOT_GRANTED");
  f.gateway.setToolStatus({ actor: owner, toolId: "repo.read", status: "disabled" });
  assert.equal(f.call().code, "TOOL_DISABLED");
  f.gateway.setToolStatus({ actor: owner, toolId: "repo.read", status: "active" });
  assert.equal(f.call({ observedDefinitionDigest: undefined }).code, "TOOL_DEFINITION_CHANGED");
});

test("only the project owner changes gateway policy", () => {
  const f = createFixture();
  const agent = { kind: "agent", id: "agent-codex" };
  assert.throws(() => f.gateway.registerTool({ actor: agent, definition: TOOLS.read }), error => error instanceof AgentToolGatewayError && error.code === "OWNER_REQUIRED");
  assert.throws(() => f.gateway.grantAgent({ actor: agent, agentId: "agent-codex", toolIds: ["repo.read"], projectIds: ["project-alpha"] }), /project owner/);
  assert.throws(() => f.gateway.recordApproval({ actor: agent, agentId: "agent-codex", projectId: "project-alpha", toolId: "web.fetch", args: {} }), /project owner/);
});

test("definitions are validated: sensitive tools name a gated action and read tools have no side effect", () => {
  const f = createFixture();
  const base = { toolId: "bad.tool", title: "ابزار", summary: "خلاصهٔ ابزار", argumentSchema: {} };
  assert.throws(() => f.gateway.registerTool({ actor: owner, definition: { ...base, riskTier: "sensitive" } }), /separately gated/);
  assert.throws(() => f.gateway.registerTool({ actor: owner, definition: { ...base, riskTier: "read", sensitiveAction: "external-spend" } }), /Only a sensitive tool/);
  assert.throws(() => f.gateway.registerTool({ actor: owner, definition: { ...base, riskTier: "read", sideEffect: "external" } }), /cannot declare/);
  assert.throws(() => f.gateway.registerTool({ actor: owner, definition: { ...base, riskTier: "read", argumentSchema: { Bad_Name: { type: "string" } } } }), /camelCase/);
  assert.throws(() => f.gateway.registerTool({ actor: owner, definition: { ...base, riskTier: "read", argumentSchema: { x: { type: "string", pattern: "(" } } } }), /invalid pattern/);
});

test("arguments are typed and bounded: unknown names, wrong types, traversal and bad urls are refused", () => {
  const f = createFixture({ circuitThreshold: 100 });
  assert.equal(f.call({ args: { path: "a", extra: "x" } }).code, "ARGUMENT_REJECTED");
  assert.equal(f.call({ args: {} }).reasons[0], "path:required");
  assert.equal(f.call({ args: { path: 42 } }).code, "ARGUMENT_REJECTED");
  for (const bad of ["../secrets", "/etc/passwd", ["C:", "Windows"].join("\\"), "a/../../b", "~/x"]) {
    assert.equal(f.call({ args: { path: bad } }).code, "ARGUMENT_REJECTED", bad);
  }
  assert.equal(f.call({ toolId: "web.fetch", args: { url: "http://example.com" } }).code, "ARGUMENT_REJECTED");
  assert.equal(f.call({ toolId: "web.fetch", args: { url: "https://169.254.169.254/latest" } }).code, "ARGUMENT_REJECTED");
  assert.equal(f.call({ toolId: "web.fetch", args: { url: "https://metadata.google.internal/x" } }).code, "ARGUMENT_REJECTED");
  assert.equal(f.call({ toolId: "notes.add", args: { text: "x".repeat(501) } }).code, "ARGUMENT_REJECTED");
  assert.equal(f.call({ args: [] }).code, "ARGUMENT_REJECTED");
});

test("credentials and host paths in arguments are refused with a distinct code", () => {
  const f = createFixture({ circuitThreshold: 100 });
  for (const text of [`use ${"sk-"}${"abcdefghijklmnopqrstuvwx"} for this`, "password: hunter2hunter2", "Bearer abcdefghijklmnop1234", `open /${"home"}/user/.ssh/id_rsa`, "رمز عبور: abc12345"]) {
    assert.equal(f.call({ toolId: "notes.add", args: { text } }).code, "SECRET_IN_ARGUMENT", text);
  }
});

test("a local write needs an active version-bound authorization and honours Global Stop", () => {
  const f = createFixture();
  const args = { path: "src/a.mjs", content: "export const a = 1;" };
  assert.equal(f.call({ toolId: "repo.write", args }).code, "AUTHORIZATION_DENIED");
  const ok = f.call({ toolId: "repo.write", args, authorization: f.authorizationRef });
  assert.equal(ok.allowed, true);
  const wrongStep = f.call({ toolId: "repo.write", args, authorization: { ...f.authorizationRef, stepId: "STEP-OTHER" } });
  assert.equal(wrongStep.code, "AUTHORIZATION_DENIED");
  assert.deepEqual(wrongStep.reasons, ["SNAPSHOT_ENTRY_NOT_FOUND"]);
  f.stop(true);
  assert.equal(f.call({ toolId: "repo.write", args, authorization: f.authorizationRef }).code, "GLOBAL_STOP_ACTIVE");
  assert.equal(f.call().code, "GLOBAL_STOP_ACTIVE", "Global Stop blocks reads too");
  f.stop(false);
  f.authorization.revoke({ authorizationId: "AUTH-GW-001", actor: owner, idempotencyKey: "idem-revoke-gw-001" });
  assert.equal(f.call({ toolId: "repo.write", args, authorization: f.authorizationRef }).code, "AUTHORIZATION_DENIED", "a revoked snapshot is never replayed from cache");
});

test("an external read needs a single-use approval bound to the exact arguments", () => {
  const f = createFixture();
  const args = { url: "https://example.com/docs" };
  const first = f.call({ toolId: "web.fetch", args });
  assert.equal(first.code, "APPROVAL_REQUIRED");
  assert.equal(first.approvalPrompt.source, "registered-tool-metadata");
  assert.equal(first.approvalPrompt.title, TOOLS.fetch.title);
  const approvalId = f.gateway.recordApproval({ actor: owner, agentId: "agent-codex", projectId: "project-alpha", toolId: "web.fetch", args });
  assert.equal(f.call({ toolId: "web.fetch", args: { url: "https://example.com/other" }, approvalId }).code, "APPROVAL_REQUIRED", "different arguments do not reuse the approval");
  assert.equal(f.call({ toolId: "web.fetch", args, approvalId }).allowed, true);
  assert.equal(f.call({ toolId: "web.fetch", args, approvalId }).code, "APPROVAL_REQUIRED", "an approval is single-use");
});

test("approvals expire and cannot be moved to another agent or project", () => {
  const f = createFixture();
  f.gateway.grantAgent({ actor: owner, agentId: "agent-claude", toolIds: ["web.fetch"], projectIds: ["project-alpha", "project-beta"] });
  const args = { url: "https://example.com/docs" };
  const approvalId = f.gateway.recordApproval({ actor: owner, agentId: "agent-codex", projectId: "project-alpha", toolId: "web.fetch", args });
  assert.equal(f.call({ agentId: "agent-claude", toolId: "web.fetch", args, approvalId }).code, "APPROVAL_REQUIRED");
  f.advance(11 * 60_000);
  assert.equal(f.call({ toolId: "web.fetch", args, approvalId }).code, "APPROVAL_REQUIRED", "expired");
});

test("sensitive tools are denied even with an approval unless a separate verifier agrees", () => {
  const denied = createFixture();
  const approvalId = denied.gateway.recordApproval({ actor: owner, agentId: "agent-codex", projectId: "project-alpha", toolId: "db.drop", args: { database: "staging" } });
  const result = denied.call({ toolId: "db.drop", args: { database: "staging" }, approvalId });
  assert.equal(result.code, "SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL");

  const seen = [];
  const allowed = createFixture({ sensitiveVerifier: input => { seen.push(input.sensitiveAction); return input.sensitiveAction === "destructive-data-operation"; } });
  const id = allowed.gateway.recordApproval({ actor: owner, agentId: "agent-codex", projectId: "project-alpha", toolId: "db.drop", args: { database: "staging" } });
  assert.equal(allowed.call({ toolId: "db.drop", args: { database: "staging" } }).code, "APPROVAL_REQUIRED", "verifier agrees but a human approval is still needed");
  assert.equal(allowed.call({ toolId: "db.drop", args: { database: "staging" }, approvalId: id }).allowed, true);
  assert.deepEqual([...new Set(seen)], ["destructive-data-operation"]);
  const other = allowed.call({ toolId: "prod.deploy", args: { version: "1.0.0" } });
  assert.equal(other.code, "SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL", "the verifier is per action");
});

test("tool scope is enforced per project and per tool", () => {
  const f = createFixture();
  assert.equal(f.call({ projectId: "project-beta" }).code, "SCOPE_VIOLATION");
  f.gateway.grantAgent({ actor: owner, agentId: "agent-narrow", toolIds: ["repo.read"], projectIds: ["project-alpha"] });
  assert.equal(f.call({ agentId: "agent-narrow", toolId: "notes.add", args: { text: "hi" } }).code, "AGENT_NOT_GRANTED");
});

test("rate limit applies per agent and recovers after the window", () => {
  const f = createFixture({ maxCallsPerWindow: 3, windowMs: 60_000 });
  for (let i = 0; i < 3; i += 1) assert.equal(f.call().allowed, true);
  assert.equal(f.call().code, "RATE_LIMITED");
  f.advance(61_000);
  assert.equal(f.call().allowed, true);
});

test("audit chain detects tampering, removal and reordering", () => {
  const f = createFixture();
  f.call(); f.call({ args: { path: "b" } }); f.call({ args: { path: "../c" } });
  const entries = f.gateway.audit();
  assert.equal(verifyAuditChain(entries).ok, true);
  assert.equal(verifyAuditChain([{ ...entries[2], code: "ALLOWED" }, ...entries.slice(3)]).ok, false);
  assert.equal(verifyAuditChain(entries.filter((_, index) => index !== 3)).ok, false);
  assert.equal(verifyAuditChain([entries[4], entries[3], ...entries.slice(5)]).ok, false);
});

test("bill of materials lists every pinned tool deterministically", () => {
  const f = createFixture();
  const bom = f.gateway.bom();
  assert.deepEqual(bom.map(item => item.toolId), ["db.drop", "notes.add", "prod.deploy", "repo.read", "repo.write", "web.fetch"]);
  assert.ok(bom.every(item => /^[0-9a-f]{64}$/.test(item.digest) && item.status === "active" && item.version === 1));
});
