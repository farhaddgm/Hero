import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextBudgetError,
  DEFAULT_CONTEXT_BUDGETS,
  OMISSION_REASONS,
  TOKEN_ESTIMATE_METHOD,
  allocateContextBudget,
  budgetForRole,
  estimateTokens
} from "../packages/domain/src/context-budget.mjs";
import { createProjectMemory } from "../packages/domain/src/project-memory.mjs";
import { createPrng } from "../tools/isolation-property.mjs";

const now = () => "2026-10-21T12:00:00.000Z";
const policy = (patch = {}) => ({ maxTokens: 1000, citationFloorTokens: 100, citationRequiredKinds: ["rule"], kindPriority: ["rule", "decision", "architecture", "evidence", "artifact"], ...patch });
const record = (id, patch = {}) => ({ memoryId: id, kind: "architecture", scope: "project", recordedAt: "2026-10-01T00:00:00.000Z", content: "x".repeat(300), source: { kind: "spec", reference: `hero://specs/${id}`, documentVersion: "v1.0" }, ...patch });
const ids = items => items.map(item => item.memoryId ?? item);

test("the token estimate is deterministic, labelled, and counts Persian more heavily than Latin", () => {
  assert.equal(estimateTokens("hello world"), estimateTokens("hello world"));
  assert.equal(TOKEN_ESTIMATE_METHOD, "offline-heuristic-v1");
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens(undefined), 0);
  assert.equal(estimateTokens("a".repeat(10)), 3);
  assert.equal(estimateTokens("س".repeat(10)), 6);
  assert.equal(estimateTokens("😀"), 1, "an emoji is one code point");
  assert.ok(estimateTokens("سلام دنیا، این یک متن فارسی است.") > estimateTokens("hello world this is English"));
  assert.ok(estimateTokens("x".repeat(100)) < estimateTokens("x".repeat(101)) + 1);
});

test("a large synthetic memory never exceeds the budget and every omission is reported with its reason", () => {
  const many = Array.from({ length: 12 }, (_, index) => record(`MEM-${String(index).padStart(3, "0")}`, { content: "y".repeat(400) }));
  const result = allocateContextBudget({ records: many, policy: policy({ maxTokens: 500, citationFloorTokens: 50 }) });
  assert.ok(result.usage.totalTokens <= 500, `used ${result.usage.totalTokens}`);
  assert.ok(result.selected.length > 0 && result.selected.length < 12);
  assert.equal(result.selected.length + result.omitted.length, 12, "nothing is dropped silently");
  assert.deepEqual([...new Set([...ids(result.selected), ...ids(result.omitted)])].sort(), ids(many).sort());
  assert.ok(result.omitted.every(item => item.reason === OMISSION_REASONS.tokenBudget || item.reason === OMISSION_REASONS.itemCap));
  assert.ok(result.omitted.every(item => item.tokens > 0 && typeof item.kind === "string"));
  assert.equal(result.usage.estimate, true);
  assert.equal(result.usage.method, TOKEN_ESTIMATE_METHOD);
  assert.equal(result.status, "complete");
});

test("the item cap still applies and is reported as item-cap", () => {
  const few = Array.from({ length: 6 }, (_, index) => record(`MEM-${index}`, { content: "short note" }));
  const result = allocateContextBudget({ records: few, policy: policy(), maxItems: 4 });
  assert.equal(result.selected.length, 4);
  assert.deepEqual(result.omitted.map(item => item.reason), [OMISSION_REASONS.itemCap, OMISSION_REASONS.itemCap]);
});

test("an item with a required citation is never dropped before an item without one", () => {
  const records = [
    record("MEM-OPTIONAL-A", { kind: "architecture", content: "a".repeat(200) }),
    record("MEM-RULE-A", { kind: "rule", content: "b".repeat(250) }),
    record("MEM-OPTIONAL-B", { kind: "artifact", content: "c".repeat(60) }),
    record("MEM-RULE-B", { kind: "rule", content: "d".repeat(250) })
  ];
  const tight = allocateContextBudget({ records, policy: policy({ maxTokens: 330, citationFloorTokens: 40 }) });
  const kept = new Set(ids(tight.selected));
  assert.ok(kept.has("MEM-RULE-A") && kept.has("MEM-RULE-B"), "both protected records survive");
  assert.equal(tight.selected.every(item => item.kind === "rule" || !tight.omitted.some(o => o.protectedByCitation)), true);
  // Squeeze until a protected record cannot fit: then no unprotected record may be included at all.
  const impossible = allocateContextBudget({ records, policy: policy({ maxTokens: 150, citationFloorTokens: 30 }) });
  assert.equal(impossible.status, "degraded");
  const droppedProtected = impossible.omitted.filter(item => item.protectedByCitation);
  assert.ok(droppedProtected.length > 0);
  assert.deepEqual(impossible.selected.filter(item => item.kind !== "rule"), [], "no unprotected record is kept while a protected one is dropped");
  assert.ok(impossible.omitted.filter(item => !item.protectedByCitation).every(item => item.reason === OMISSION_REASONS.requiredPriority));
  assert.ok([OMISSION_REASONS.requiredOverBudget, OMISSION_REASONS.tooLarge].includes(droppedProtected[0].reason));
});

test("a record larger than the whole budget is reported as too large and never cut in half", () => {
  const result = allocateContextBudget({ records: [record("MEM-HUGE", { content: "z".repeat(5000) }), record("MEM-SMALL", { content: "tiny" })], policy: policy({ maxTokens: 400, citationFloorTokens: 40 }) });
  assert.deepEqual(ids(result.selected), ["MEM-SMALL"]);
  assert.deepEqual(result.omitted.map(item => [item.memoryId, item.reason]), [["MEM-HUGE", OMISSION_REASONS.tooLarge]]);
  assert.equal(result.selected[0].content, "tiny", "content is passed through untouched");
});

test("the citation floor is reserved even when the selected citations are small", () => {
  const records = [record("MEM-A", { content: "a".repeat(600) })];
  const withFloor = allocateContextBudget({ records, policy: policy({ maxTokens: 300, citationFloorTokens: 120 }) });
  assert.equal(withFloor.selected.length, 0, "content plus the reserved floor does not fit");
  const withoutFloor = allocateContextBudget({ records, policy: policy({ maxTokens: 300, citationFloorTokens: 0 }) });
  assert.equal(withoutFloor.selected.length, 1);
  assert.ok(withoutFloor.usage.totalTokens <= 300);
  assert.ok(withFloor.usage.totalTokens >= 0);
});

test("the same input gives the same output in any input order, and a different budget changes the digest", () => {
  const items = Array.from({ length: 9 }, (_, index) => record(`MEM-${String(index).padStart(2, "0")}`, { kind: index % 3 === 0 ? "rule" : "architecture", scope: index % 2 === 0 ? "task" : "project", recordedAt: `2026-10-0${(index % 5) + 1}T00:00:00.000Z`, content: "w".repeat(150 + index * 20) }));
  const base = allocateContextBudget({ records: items, policy: policy({ maxTokens: 700 }) });
  const reversed = allocateContextBudget({ records: [...items].reverse(), policy: policy({ maxTokens: 700 }) });
  assert.deepEqual(ids(base.selected), ids(reversed.selected));
  assert.deepEqual(base.omitted, reversed.omitted);
  assert.equal(base.digest, reversed.digest);
  assert.notEqual(allocateContextBudget({ records: items, policy: policy({ maxTokens: 800 }) }).digest, base.digest);
  assert.match(base.digest, /^[0-9a-f]{64}$/);
  const shuffled = createPrng(7).shuffle(items);
  assert.equal(allocateContextBudget({ records: shuffled, policy: policy({ maxTokens: 700 }) }).digest, base.digest);
});

test("property: for random memories the budget holds, nothing is lost, and the protection rule is never violated", () => {
  const kinds = ["rule", "decision", "architecture", "evidence", "artifact"];
  for (const seed of [1, 2, 3, 99, 20261021, 777777]) {
    const prng = createPrng(seed);
    for (let round = 0; round < 40; round += 1) {
      const items = Array.from({ length: prng.int(1, 40) }, (_, index) => record(`MEM-${seed}-${round}-${index}`, { kind: prng.pick(kinds), scope: prng.pick(["project", "task"]), recordedAt: `2026-10-${String(prng.int(1, 28)).padStart(2, "0")}T00:00:00.000Z`, content: "q".repeat(prng.int(5, 900)) }));
      const rules = policy({ maxTokens: prng.int(150, 3000), citationFloorTokens: prng.int(0, 70), citationRequiredKinds: prng.next() < 0.5 ? ["rule"] : ["rule", "decision"] });
      const maxItems = prng.int(1, 12);
      const result = allocateContextBudget({ records: items, policy: rules, maxItems });
      assert.ok(result.usage.totalTokens <= rules.maxTokens, `seed ${seed} round ${round}`);
      assert.ok(result.selected.length <= maxItems);
      assert.equal(result.selected.length + result.omitted.length, items.length);
      assert.equal(new Set([...ids(result.selected), ...ids(result.omitted)]).size, items.length, "selected and omitted are disjoint and complete");
      const required = new Set(rules.citationRequiredKinds);
      const droppedRequired = result.omitted.some(item => required.has(item.kind));
      if (droppedRequired) {
        assert.deepEqual(result.selected.filter(item => !required.has(item.kind)), [], `seed ${seed} round ${round}: a protected record was dropped while an unprotected one was kept`);
        assert.equal(result.status, "degraded");
      } else assert.equal(result.status, "complete");
    }
  }
});

test("bad policies and records are rejected before anything is selected", () => {
  const code = fn => { try { fn(); return null; } catch (error) { return error instanceof ContextBudgetError ? error.code : `other:${error.message}`; } };
  const good = [record("MEM-1")];
  for (const bad of [undefined, null, [], { maxTokens: 50, citationFloorTokens: 0 }, { maxTokens: 1000, citationFloorTokens: 900 }, { maxTokens: 1000, citationFloorTokens: -1 }, { maxTokens: "1000", citationFloorTokens: 0 }, { maxTokens: 1000, citationFloorTokens: 0, citationRequiredKinds: "rule" }]) {
    assert.equal(code(() => allocateContextBudget({ records: good, policy: bad })), "INVALID_POLICY", JSON.stringify(bad));
  }
  assert.equal(code(() => allocateContextBudget({ records: "x", policy: policy() })), "INVALID_RECORDS");
  assert.equal(code(() => allocateContextBudget({ records: [{ memoryId: "MEM-1" }], policy: policy() })), "INVALID_RECORD");
  assert.equal(code(() => allocateContextBudget({ records: [record("MEM-1", { source: {} })], policy: policy() })), "MISSING_CITATION");
  assert.equal(code(() => allocateContextBudget({ records: [record("MEM-1"), record("MEM-1")], policy: policy() })), "DUPLICATE_RECORD");
  assert.equal(code(() => allocateContextBudget({ records: good, policy: policy(), maxItems: 13 })), "INVALID_POLICY");
  assert.equal(allocateContextBudget({ records: [], policy: policy() }).selected.length, 0);
});

test("default budgets exist for every Project Memory recipient role and unknown roles get nothing", () => {
  for (const role of ["planner", "implementer", "reviewer", "cursor"]) {
    const budget = budgetForRole(role);
    assert.ok(budget, role);
    assert.doesNotThrow(() => allocateContextBudget({ records: [record("MEM-1")], policy: budget }), role);
    assert.ok(budget.citationRequiredKinds.includes("rule"));
  }
  assert.equal(budgetForRole("wizard"), null);
  assert.equal(budgetForRole("__proto__"), null);
  assert.equal(budgetForRole("constructor"), null);
  assert.equal(Object.isFrozen(DEFAULT_CONTEXT_BUDGETS.planner), true);
});

/* ---------------------------------------------------- Project Memory integration */

const memoryInput = (id, patch = {}) => ({ memoryId: id, projectId: "HERO", memoryKey: `k.${id}`, kind: "architecture", scope: "project", status: "approved", content: `Record ${id}: ${"important detail ".repeat(20)}`, tags: ["note"], recipientRoles: ["planner", "reviewer"], source: { kind: "spec", reference: `hero://specs/${id}`, documentVersion: "v1.0" }, actor: { kind: "project-owner", id: "hero-owner" }, idempotencyKey: `memory-${id}-once`, ...patch });
const contextInput = (patch = {}) => ({ contextId: "CTX-NX025", projectId: "HERO", taskId: "TASK-1", stepId: "STEP-1", documentVersion: "v1.0", recipientRole: "planner", maxItems: 12, idempotencyKey: "ctx-nx025-once", ...patch });

test("Project Memory with a token budget reports omissions, keeps role and project isolation, and is unchanged without a budget", () => {
  const memory = createProjectMemory({ now });
  for (let index = 0; index < 11; index += 1) memory.record(memoryInput(`MEM-${String(index).padStart(2, "0")}`, { kind: index === 0 ? "rule" : "architecture" }));
  memory.record(memoryInput("MEM-SECRET-IMPL", { recipientRoles: ["implementer"] }));
  memory.record(memoryInput("MEM-OTHER-PROJECT", { projectId: "OTHER" }));

  const plain = memory.assemble(contextInput({ contextId: "CTX-PLAIN", idempotencyKey: "ctx-plain-once" }));
  assert.equal(plain.context.records.length, 11, "without a budget the item cap alone applies");
  assert.equal(plain.context.omitted, undefined);
  assert.equal(plain.context.tokenUsage, undefined);

  const budgeted = memory.assemble(contextInput({ contextId: "CTX-BUDGET", idempotencyKey: "ctx-budget-once", tokenBudget: { maxTokens: 600, citationFloorTokens: 60, citationRequiredKinds: ["rule"], kindPriority: ["rule", "architecture"] } }));
  assert.equal(budgeted.status, "ready");
  const selectedIds = budgeted.context.records.map(item => item.memoryId);
  assert.ok(selectedIds.includes("MEM-00"), "the rule record is kept first");
  assert.ok(selectedIds.length < 11 && budgeted.context.omitted.length > 0);
  assert.equal(selectedIds.length + budgeted.context.omitted.length, 11, "selected plus omitted equals what the role may see");
  assert.ok(!selectedIds.includes("MEM-SECRET-IMPL") && !budgeted.context.omitted.some(item => item.memoryId === "MEM-SECRET-IMPL"), "role filtering is untouched");
  assert.ok(!selectedIds.includes("MEM-OTHER-PROJECT") && !budgeted.context.omitted.some(item => item.memoryId === "MEM-OTHER-PROJECT"), "project isolation is untouched");
  assert.ok(budgeted.context.tokenUsage.totalTokens <= 600);
  assert.equal(budgeted.context.tokenUsage.estimate, true);
  assert.equal(budgeted.context.budgetStatus, "complete");
  const assembly = memory.listContextAssemblies().find(item => item.contextId === "CTX-BUDGET");
  assert.equal(assembly.omittedItems, budgeted.context.omitted.length);
  assert.deepEqual(assembly.memoryIds, selectedIds);

  const replay = memory.assemble(contextInput({ contextId: "CTX-BUDGET", idempotencyKey: "ctx-budget-once", tokenBudget: { maxTokens: 600, citationFloorTokens: 60, citationRequiredKinds: ["rule"], kindPriority: ["rule", "architecture"] } }));
  assert.equal(replay.idempotent, true);
  assert.throws(() => memory.assemble(contextInput({ contextId: "CTX-BUDGET", idempotencyKey: "ctx-budget-once", tokenBudget: { maxTokens: 700, citationFloorTokens: 60, citationRequiredKinds: ["rule"], kindPriority: ["rule"] } })), /already used with different/, "a different budget under the same key is a conflict");
  assert.throws(() => memory.assemble(contextInput({ contextId: "CTX-BAD", idempotencyKey: "ctx-bad-once", tokenBudget: { maxTokens: 10, citationFloorTokens: 0 } })), ContextBudgetError);
});
