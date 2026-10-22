import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CHECK_KINDS, getAcceptanceCriteriaContractSummary, validateAcceptanceCriteriaContract } from "../packages/contracts/src/acceptance-criteria.mjs";
import { AcceptanceCompilerError, compileCriteria, compileCriterion, parseCriterionText, validateStructuredRegistry } from "../packages/domain/src/acceptance-compiler.mjs";

const read = relative => JSON.parse(fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8"));
const registry = read("config/product-templates/acceptance-v1.json");
const templates = read("config/product-templates/templates-v1.json");
const entryOf = id => structuredClone(registry.templates.find(item => item.templateId === id));
const good = patch => ({ id: "AC-demo-site-001", when: "یک صفحه بارگذاری شود", then: "صفحه با lang=fa بارگذاری شود", check: { kind: "html-attributes", params: { scope: "all-pages", attributes: { lang: "fa" } } }, ...patch });

test("the contract is valid and the closed vocabulary keeps a non-automatable manual kind", () => {
  assert.deepEqual(validateAcceptanceCriteriaContract(), []);
  const summary = getAcceptanceCriteriaContractSummary();
  assert.equal(summary.checkKinds.length, Object.keys(CHECK_KINDS).length);
  assert.match(summary.boundary, /never executed inside the Hero process|never executed by Hero|is never executed/);
});

test("all five shipped templates have structured criteria that quote every template criterion verbatim", () => {
  assert.deepEqual(validateStructuredRegistry(registry, templates), []);
  assert.equal(registry.templates.length, 5);
  const total = registry.templates.reduce((sum, entry) => sum + entry.items.length, 0);
  assert.equal(total, 22);
  const ids = registry.templates.flatMap(entry => entry.items.map(item => item.id));
  assert.equal(new Set(ids).size, ids.length, "criterion ids are unique and stable");
});

test("compiling the shipped criteria gives honest coverage: the vague contrast criterion needs clarification", () => {
  const results = Object.fromEntries(registry.templates.map(entry => [entry.templateId, compileCriteria({ templateId: entry.templateId, items: entry.items })]));
  assert.deepEqual(Object.fromEntries(Object.entries(results).map(([id, result]) => [id, [result.coverage.automatable, result.coverage.manual, result.coverage.needsClarification]])), {
    "static-site": [4, 0, 1],
    "contact-form-site": [4, 0, 0],
    "crud-admin-panel": [4, 0, 0],
    "rest-api": [4, 0, 0],
    "mobile-reminder-app": [5, 0, 0]
  });
  assert.equal(results["static-site"].coverage.automatablePercent, 80);
  const contrast = results["static-site"].items.find(item => item.id === "AC-static-site-005");
  assert.equal(contrast.status, "needs-clarification");
  assert.deepEqual([...contrast.reasons].sort(), ["THRESHOLD_REQUIRED", "VAGUE_TERM:کافی"]);
  assert.equal(contrast.kind, null);
  for (const result of Object.values(results)) {
    assert.deepEqual({ ...result.ownerApproval }, { required: true, approved: false }, "the compiler never approves itself");
    assert.match(result.digest, /^[0-9a-f]{64}$/);
  }
});

test("compilation is deterministic and the input is not mutated", () => {
  const entry = entryOf("rest-api");
  const snapshot = JSON.stringify(entry);
  const first = compileCriteria({ templateId: "rest-api", items: entry.items });
  const second = compileCriteria({ templateId: "rest-api", items: entry.items });
  assert.equal(first.digest, second.digest);
  assert.equal(first.skeleton, second.skeleton);
  assert.deepEqual(first.items, second.items);
  assert.equal(JSON.stringify(entry), snapshot);
  const changed = structuredClone(entry);
  changed.items[0].then = "ورودی با schema اعتبارسنجی شود و خطا ساخت‌یافته باشد";
  assert.notEqual(compileCriteria({ templateId: "rest-api", items: changed.items }).digest, first.digest, "a changed meaning changes the digest");
});

test("text in the 'وقتی … آنگاه …' format is parsed; anything else has no structure", () => {
  const parsed = parseCriterionText("وقتی کاربر وارد نشده باشد، آنگاه درخواست تغییر رد شود.");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.when, "کاربر وارد نشده باشد");
  assert.equal(parsed.then, "درخواست تغییر رد شود");
  assert.equal(parseCriterionText("هر مسیر تغییر دهنده بدون ورود رد می‌شود.").reason, "NO_STRUCTURE");
  assert.equal(parseCriterionText("آنگاه همه‌چیز خوب است وقتی کاربر بیاید").reason, "NO_STRUCTURE");
  assert.equal(parseCriterionText("وقتی الف رخ دهد آنگاه ب شود آنگاه ج شود").reason, "NOT_ATOMIC");
  assert.equal(parseCriterionText("").reason, "NO_STRUCTURE");
  assert.equal(parseCriterionText(undefined).reason, "NO_STRUCTURE");
});

test("a criterion given only as free text never compiles, even when it parses", () => {
  const result = compileCriterion({ id: "AC-demo-site-001", text: "وقتی صفحه بارگذاری شود آنگاه محتوا نمایش داده شود" });
  assert.equal(result.status, "needs-clarification");
  assert.ok(result.reasons.includes("NO_CHECK_BINDING"));
  const bare = compileCriterion({ id: "AC-demo-site-001", text: "سایت باید خوب باشد" });
  assert.equal(bare.status, "needs-clarification");
  assert.ok(bare.reasons.includes("NO_STRUCTURE") && bare.reasons.includes("MISSING_PRECONDITION"));
});

test("vague, empty or unbound criteria are refused with specific reasons", () => {
  const reasonsOf = patch => compileCriterion(good(patch)).reasons;
  assert.equal(compileCriterion(good({})).status, "automatable");
  assert.ok(reasonsOf({ when: "" }).includes("MISSING_PRECONDITION"));
  assert.ok(reasonsOf({ when: "همیشه" }).includes("MISSING_PRECONDITION"));
  assert.ok(reasonsOf({ then: "" }).includes("MISSING_EXPECTATION"));
  assert.ok(reasonsOf({ then: "صفحه سریع بارگذاری شود" }).includes("VAGUE_TERM:سریع"));
  assert.ok(reasonsOf({ then: "رابط کاربرپسند باشد" }).includes("VAGUE_TERM:کاربرپسند"));
  assert.ok(reasonsOf({ check: undefined }).includes("NO_CHECK_BINDING"));
  assert.ok(reasonsOf({ check: { kind: "run-anything", params: {} } }).includes("UNKNOWN_CHECK_KIND"));
  assert.ok(reasonsOf({ check: { kind: "constructor", params: {} } }).includes("UNKNOWN_CHECK_KIND"), "inherited object keys are not check kinds");
  assert.ok(reasonsOf({ check: { kind: "html-attributes" } }).includes("INVALID_PARAMS"));
  assert.ok(reasonsOf({ id: "bad id" }).includes("INVALID_ID"));
  assert.ok(reasonsOf({ id: "AC-demo-site-1" }).includes("INVALID_ID"));
});

test("param validation covers unknown, missing and out-of-set values for each param shape", () => {
  const withParams = (kind, params) => compileCriterion(good({ check: { kind, params } })).reasons;
  assert.deepEqual(withParams("http-ok", { paths: ["/health"] }), []);
  assert.ok(withParams("http-ok", { paths: ["health"] }).includes("INVALID_PARAM:paths"));
  assert.ok(withParams("http-ok", { paths: ["/a/../b"] }).includes("INVALID_PARAM:paths"));
  assert.ok(withParams("http-ok", { paths: [] }).includes("INVALID_PARAM:paths"));
  assert.ok(withParams("http-ok", { paths: ["/a"], expectStatus: 404 }).includes("INVALID_PARAM:expectStatus"));
  assert.ok(withParams("http-ok", { paths: ["/a"], extra: 1 }).includes("UNKNOWN_PARAM:extra"));
  assert.ok(withParams("http-ok", {}).includes("MISSING_PARAM:paths"));
  assert.ok(withParams("access-denied", { methods: ["GET"], actors: ["anonymous"] }).includes("INVALID_PARAM:methods"));
  assert.ok(withParams("access-denied", { methods: ["POST", "POST"], actors: ["anonymous"] }).includes("INVALID_PARAM:methods"));
  assert.ok(withParams("html-attributes", { scope: "all-pages", attributes: { onclick: "x" } }).includes("INVALID_PARAM:attributes"));
  assert.ok(withParams("html-attributes", { scope: "all-pages", attributes: { lang: "fa\"; x" } }).includes("INVALID_PARAM:attributes"));
  assert.ok(withParams("ui-metric", { metric: "min-touch-target-points", threshold: "44" }).includes("INVALID_PARAM:threshold"));
  assert.ok(withParams("ui-metric", { metric: "min-touch-target-points", threshold: 9999 }).includes("INVALID_PARAM:threshold"));
});

test("a vague word is allowed only with a declared numeric threshold, and whole words only", () => {
  const contrast = threshold => compileCriterion(good({ then: "کنتراست متن کافی باشد", check: { kind: "html-accessibility", params: { checks: ["contrast-ratio"], ...(threshold === undefined ? {} : { threshold }) } } }));
  assert.equal(contrast(undefined).status, "needs-clarification");
  assert.equal(contrast(4.5).status, "automatable");
  assert.equal(contrast(0.5).status, "needs-clarification", "a threshold outside the allowed range does not rescue it");
  const domain = compileCriterion(good({ then: "هیچ درخواست شبکه‌ای به دامنهٔ بیرونی ثبت نشود", check: { kind: "no-external-request", params: { scope: "page-load" } } }));
  assert.equal(domain.status, "automatable", "'امن' inside 'دامنه' is not the word 'امن'");
  const secure = compileCriterion(good({ then: "سیستم امن باشد", check: { kind: "no-external-request", params: { scope: "page-load" } } }));
  assert.ok(secure.reasons.includes("VAGUE_TERM:امن"));
});

test("a manual-review criterion is well-formed but not counted as automatable", () => {
  const manual = compileCriterion(good({ check: { kind: "manual-review", params: { reviewer: "owner" } } }));
  assert.equal(manual.status, "manual");
  const result = compileCriteria({ templateId: "demo-site", items: [good({}), good({ id: "AC-demo-site-002", check: { kind: "manual-review", params: { reviewer: "owner" } } }), good({ id: "AC-demo-site-003", when: "" })] });
  assert.deepEqual({ ...result.coverage }, { total: 3, automatable: 1, manual: 1, needsClarification: 1, automatablePercent: 33.3 });
  assert.match(result.skeleton, /test\.todo\("AC-demo-site-002 — manual review \(owner\)/);
  assert.match(result.skeleton, /test\.todo\("AC-demo-site-003 — NEEDS CLARIFICATION: MISSING_PRECONDITION/);
});

test("a duplicate id is flagged on the later item and input shape errors throw", () => {
  const result = compileCriteria({ templateId: "demo-site", items: [good({}), good({})] });
  assert.equal(result.items[0].status, "automatable");
  assert.ok(result.items[1].reasons.includes("DUPLICATE_ID"));
  for (const bad of [{}, { templateId: "Bad Id", items: [good({})] }, { templateId: "demo-site", items: [] }, { templateId: "demo-site", items: "x" }, { templateId: "demo-site", items: Array.from({ length: 201 }, () => good({})) }]) {
    assert.throws(() => compileCriteria(bad), error => error instanceof AcceptanceCompilerError);
  }
  assert.throws(() => compileCriteria(), AcceptanceCompilerError);
});

test("the skeleton is syntactically valid, inert text and user text cannot break out of its string literals", () => {
  const hostile = [
    good({ when: "یک صفحه \"); process.exit(1); // بارگذاری شود" }),
    good({ id: "AC-demo-site-002", then: "نتیجه `${process.exit(1)}` */ ثبت شود" }),
    good({ id: "AC-demo-site-003", when: "خط اول\nخط دوم خط سوم بارگذاری شود", check: { kind: "manual-review", params: { reviewer: "owner" } } }),
    good({ id: "AC-demo-site-004", when: "" })
  ];
  const outputs = [compileCriteria({ templateId: "demo-site", items: hostile }), ...registry.templates.map(entry => compileCriteria({ templateId: entry.templateId, items: entry.items }))];
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hero-skeleton-"));
  try {
    outputs.forEach((result, index) => {
      const file = path.join(directory, `skeleton-${index}.mjs`);
      fs.writeFileSync(file, result.skeleton, "utf8");
      const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
      assert.equal(check.status, 0, `${result.templateId}: ${check.stderr}`);
      const blocks = result.skeleton.split("\n").filter(line => /^test(\.todo)?\(/.test(line));
      assert.equal(blocks.length, result.items.length, `${result.templateId}: one test per criterion and nothing injected`);
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  assert.ok(!outputs[0].skeleton.split("\n").some(line => line.startsWith("process.exit")), "no injected statement starts a line");
});

test("the registry check rejects a changed source text, a missing criterion and a version mismatch", () => {
  const mutate = change => {
    const copy = structuredClone(registry);
    change(copy);
    return validateStructuredRegistry(copy, templates);
  };
  assert.ok(mutate(copy => { copy.templates[0].items[0].sourceText = "متن دیگری که در قالب نیست."; }).some(item => /not a criterion/.test(item)));
  assert.ok(mutate(copy => { copy.templates[1].items.pop(); }).some(item => /not covered/.test(item)));
  assert.ok(mutate(copy => { copy.templates[2].templateVersion = "9.9.9"; }).some(item => /templateVersion/.test(item)));
  assert.ok(mutate(copy => { copy.templates.pop(); }).some(item => /no structured criteria/.test(item)));
  assert.ok(mutate(copy => { copy.templates[3].items[0].id = "AC-other-001"; }).some(item => /must start with/.test(item)));
  assert.ok(mutate(copy => { copy.templates[0].templateId = "unknown-template"; }).some(item => /unknown template/.test(item)));
  assert.deepEqual(validateStructuredRegistry({ schema: "wrong" }, templates), ["unexpected acceptance registry schema"]);
});
