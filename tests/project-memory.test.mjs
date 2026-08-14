import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getProjectMemoryContractSummary,
  validateProjectMemoryContract
} from "../packages/contracts/src/project-memory.mjs";
import {
  ProjectMemoryIdempotencyConflictError,
  ProjectMemorySafetyError,
  createProjectMemory,
  createProjectMemoryHarness
} from "../packages/domain/src/project-memory.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const fixedNow = () => "2026-08-14T20:00:00.000Z";

function memoryInput(overrides = {}) {
  return {
    memoryId: "MEM-001",
    projectId: "HERO",
    memoryKey: "architecture.control-plane",
    kind: "architecture",
    scope: "project",
    status: "approved",
    content: "The control plane stays modular and keeps provider adapters disabled by default.",
    tags: ["architecture", "control-plane"],
    recipientRoles: ["planner", "implementer", "reviewer"],
    source: { kind: "spec", reference: "hero://specs/HERO-014-v1.0", documentVersion: "v1.0" },
    actor: { kind: "project-owner", id: "hero-owner" },
    idempotencyKey: "memory-001-once",
    ...overrides
  };
}

function contextInput(overrides = {}) {
  return {
    contextId: "CTX-014",
    projectId: "HERO",
    taskId: "TASK-014",
    stepId: "HERO-014",
    documentVersion: "v1.0",
    recipientRole: "planner",
    maxItems: 4,
    idempotencyKey: "context-014-once",
    ...overrides
  };
}

test("project memory contract fixes versioning, role filtering, and read-only boundaries", () => {
  assert.deepEqual(validateProjectMemoryContract(), []);
  const summary = getProjectMemoryContractSummary();
  assert.equal(summary.sourceOfTruth, "versioned-append-only-memory");
  assert.ok(summary.recipientRoles.includes("cursor"));
  assert.match(summary.selectionRule, /exact Task\/Step\/document version/);
  assert.match(summary.safetyBoundary, /read-only packets/);
});

test("latest eligible memory is selected deterministically and context is replay-safe", () => {
  const memory = createProjectMemory({ now: fixedNow });
  memory.record(memoryInput());
  memory.record(memoryInput({
    memoryId: "MEM-002",
    content: "The control plane remains modular, portable, and provider-disabled by default.",
    supersedesMemoryId: "MEM-001",
    idempotencyKey: "memory-002-once"
  }));
  memory.record(memoryInput({
    memoryId: "MEM-003",
    memoryKey: "rule.no-secrets",
    kind: "rule",
    content: "Never place secrets or host-specific paths in project memory or agent context.",
    tags: ["safety"],
    recipientRoles: ["planner"],
    idempotencyKey: "memory-003-once"
  }));

  const first = memory.assemble(contextInput());
  const replay = memory.assemble(contextInput());
  assert.equal(first.status, "ready");
  assert.equal(first.code, "CONTEXT_READY");
  assert.deepEqual(first.context.records.map(record => record.memoryId), ["MEM-002", "MEM-003"]);
  assert.equal(first.context.minimization.latestOnly, true);
  assert.equal(first.context.boundary.readOnly, true);
  assert.equal(first.context.boundary.secretsIncluded, false);
  assert.equal(first.context.artifact.external, false);
  assert.equal(replay.idempotent, true);
  assert.throws(() => memory.assemble(contextInput({ maxItems: 3 })), ProjectMemoryIdempotencyConflictError);
});

test("a task memory from another document version fails closed", () => {
  const memory = createProjectMemory({ now: fixedNow });
  memory.record(memoryInput({
    memoryId: "MEM-STALE",
    memoryKey: "task.payment-flow",
    scope: "task",
    binding: { taskId: "TASK-014", stepId: "HERO-014", documentVersion: "v0.9" },
    idempotencyKey: "memory-stale-once"
  }));
  const result = memory.assemble(contextInput());
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "STALE_TASK_CONTEXT");
  assert.equal(result.context, null);
});

test("memory rejects sensitive values, host paths, and external references", () => {
  const memory = createProjectMemory({ now: fixedNow });
  const sensitiveField = ["api", "key"].join("_");
  assert.throws(
    () => memory.record(memoryInput({ [sensitiveField]: "not-accepted" })),
    ProjectMemorySafetyError
  );
  const hostPath = String.fromCharCode(67, 58, 92) + "Users\\agent\\memory.txt";
  assert.throws(
    () => memory.record(memoryInput({ content: `Never disclose ${hostPath}.` })),
    ProjectMemorySafetyError
  );
  assert.throws(
    () => memory.record(memoryInput({ source: { kind: "spec", reference: "https://example.invalid/memory", documentVersion: "v1.0" } })),
    ProjectMemorySafetyError
  );
});

test("memory harness checks exact authorization and does not create a runner", () => {
  const result = createProjectMemoryHarness({ now: fixedNow }).run({
    records: [memoryInput({ idempotencyKey: "harness-memory-once" })],
    context: contextInput({ contextId: "CTX-HARNESS", idempotencyKey: "harness-context-once" })
  });
  assert.equal(result.dispatch.authorized, true);
  assert.equal(result.dispatch.stepId, "HERO-014");
  assert.equal(result.result.code, "CONTEXT_READY");
  assert.ok(result.events.some(event => event.type === "authorization.dispatch-authorized"));
  assert.equal(result.events.some(event => event.type.startsWith("runner.")), false);
});

test("approved HERO-014 specification stays aligned with its executable memory boundary", () => {
  const specification = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "HERO-014-v1.0.md"), "utf8");
  assert.match(specification, /Context/);
  assert.match(specification, /CONTEXT_READY/);
  assert.match(specification, /STALE_TASK_CONTEXT/);
  assert.match(specification, /Task/);
});
