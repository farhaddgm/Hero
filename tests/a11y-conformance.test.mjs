import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { WCAG_22_CRITERIA, WCAG_22_CRITERION_IDS, getWcagMatrixSummary } from "../packages/contracts/src/wcag-22.mjs";
import { buildConformanceReport, designSystemCss, loadAuditedPages, validateWcagMatrix } from "../tools/a11y-conformance.mjs";
import { STATIC_CHECKS, TOKEN_CONTRAST_PAIRS, auditPageDetailed, contrastRatio, evaluateDesignSystemCss, evaluateTokenContrast, readColorTokens, relativeLuminance } from "../tools/ui-static-audit.mjs";

const matrix = JSON.parse(fs.readFileSync(new URL("../config/accessibility/wcag-22-aa-matrix-v1.json", import.meta.url), "utf8"));
const clone = () => structuredClone(matrix);
const css = await designSystemCss();
const pages = await loadAuditedPages();
const withMatrix = change => { const copy = clone(); change(copy.criteria); return validateWcagMatrix(copy); };

test("the canonical list is WCAG 2.2 Level A and AA: 55 criteria, 31 + 24, and no 4.1.1 Parsing", () => {
  assert.equal(WCAG_22_CRITERIA.length, 55);
  assert.equal(WCAG_22_CRITERIA.filter(item => item.level === "A").length, 31);
  assert.equal(WCAG_22_CRITERIA.filter(item => item.level === "AA").length, 24);
  assert.equal(new Set(WCAG_22_CRITERION_IDS).size, 55);
  assert.equal(WCAG_22_CRITERION_IDS.includes("4.1.1"), false);
  for (const id of ["2.4.11", "2.5.7", "2.5.8", "3.3.8", "3.2.6", "3.3.7"]) assert.ok(WCAG_22_CRITERION_IDS.includes(id), `${id} is new in 2.2`);
  assert.ok(WCAG_22_CRITERIA.every(item => item.name.length > 3));
  assert.equal(getWcagMatrixSummary().rules.length, 5);
});

test("the shipped matrix covers every criterion once and every reference resolves", () => {
  assert.deepEqual(validateWcagMatrix(matrix), []);
  assert.deepEqual(Object.keys(matrix.criteria), WCAG_22_CRITERION_IDS);
});

test("a criterion without any automated check is never reported as covered", () => {
  for (const [id, row] of Object.entries(matrix.criteria)) {
    if (row.status === "automated") assert.ok(row.evidence.some(item => item.kind !== "browser-test"), `${id} has offline evidence`);
    else assert.equal((row.evidence ?? []).filter(item => item.kind !== "browser-test").length, 0, `${id} lists no offline evidence while ${row.status}`);
  }
  const errors = withMatrix(criteria => { criteria["1.4.1"] = { status: "automated", evidence: [] }; });
  assert.ok(errors.some(item => /1\.4\.1: automated needs at least one offline evidence/.test(item)));
  const browserOnly = withMatrix(criteria => { criteria["1.4.1"] = { status: "automated", evidence: [{ kind: "browser-test", ref: "tests/browser/locale-a11y.browser.mjs", contains: "keyboard", strength: "partial" }] }; });
  assert.ok(browserOnly.some(item => /1\.4\.1: automated needs at least one offline evidence/.test(item)), "browser evidence alone cannot make a criterion automated");
});

test("deleting a referenced check or test makes the matrix check fail", () => {
  const withoutCheck = withMatrix(criteria => { criteria["3.1.1"].evidence[0].ref = "html-language-removed"; });
  assert.ok(withoutCheck.some(item => /static check html-language-removed does not exist/.test(item)));
  const wrongCriterion = withMatrix(criteria => { criteria["2.4.2"].evidence[0].ref = "html-lang"; });
  assert.ok(wrongCriterion.some(item => /does not declare criterion 2\.4\.2/.test(item)));
  const inflated = withMatrix(criteria => { criteria["1.3.1"].evidence[0].strength = "substantial"; });
  assert.ok(inflated.some(item => /only partial evidence/.test(item)));

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hero-a11y-"));
  try {
    for (const relative of ["tests/ui-static-audit.test.mjs", "tests/browser/locale-a11y.browser.mjs"]) {
      fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      fs.copyFileSync(new URL(`../${relative}`, import.meta.url), path.join(root, relative));
    }
    assert.deepEqual(validateWcagMatrix(matrix, { root }), [], "with the referenced files present it is valid");
    const target = path.join(root, "tests/ui-static-audit.test.mjs");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("every page shares the same Persian shell", "renamed"));
    assert.ok(validateWcagMatrix(matrix, { root }).some(item => /3\.2\.3: tests\/ui-static-audit\.test\.mjs no longer contains/.test(item)), "the test the matrix points at was renamed or removed");
    fs.rmSync(path.join(root, "tests/browser/locale-a11y.browser.mjs"));
    assert.ok(validateWcagMatrix(matrix, { root }).some(item => /browser-test file does not exist/.test(item)));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("matrix rows are validated per status: browser-only, needs-human, not-applicable and known findings", () => {
  assert.ok(withMatrix(criteria => { delete criteria["2.4.2"]; }).some(item => /2\.4\.2: criterion is missing/.test(item)));
  assert.ok(withMatrix(criteria => { criteria["4.1.1"] = { status: "needs-human", humanReview: "obsolete criterion kept by mistake" }; }).some(item => /4\.1\.1: not a WCAG 2\.2/.test(item)));
  assert.ok(withMatrix(criteria => { criteria["2.1.1"].evidence.push({ kind: "static-check", ref: "page-title", strength: "partial" }); }).some(item => /2\.1\.1/.test(item)));
  assert.ok(withMatrix(criteria => { criteria["1.4.1"].evidence = [{ kind: "static-check", ref: "img-alt", strength: "partial" }]; }).some(item => /1\.4\.1: needs-human must not list evidence/.test(item)));
  assert.ok(withMatrix(criteria => { criteria["1.4.1"].humanReview = "short"; }).some(item => /needs a humanReview/.test(item)));
  assert.ok(withMatrix(criteria => { criteria["1.2.1"].justification = "x"; }).some(item => /needs a justification/.test(item)));
  assert.ok(withMatrix(criteria => { criteria["1.2.1"].applicability = { kind: "static-check", ref: "ghost-check" }; }).some(item => /applicability check that exists/.test(item)));
  assert.ok(withMatrix(criteria => { criteria["1.4.11"].knownFindings = [{ ref: "x", scope: "light", note: "short" }]; }).some(item => /knownFindings need/.test(item)));
  assert.ok(withMatrix(criteria => { criteria["1.4.1"].knownFindings = [{ ref: "x", scope: "*", note: "a finding on a criterion that has no automated check" }]; }).some(item => /knownFindings only apply to automated/.test(item)));
  assert.ok(withMatrix(criteria => { criteria["3.1.1"].status = "passed"; }).some(item => /unknown status/.test(item)));
  assert.ok(withMatrix(criteria => { criteria["3.1.1"].evidence[0].kind = "magic"; }).some(item => /unknown evidence kind/.test(item)));
  assert.deepEqual(validateWcagMatrix({ schema: "x" }), ["unexpected matrix schema"]);
});

test("coverage numbers add up and automated coverage is not inflated by partial evidence", () => {
  const report = buildConformanceReport({ matrix, pages, designSystemCss: css });
  const c = report.coverage;
  assert.equal(c.total, 55);
  assert.equal(c.automated + c.browserOnly + c.needsHuman + c.notApplicable, 55);
  assert.equal(c.automatedSubstantial + c.automatedPartialOnly, c.automated);
  const counts = status => Object.values(matrix.criteria).filter(row => row.status === status).length;
  assert.deepEqual([c.automated, c.browserOnly, c.needsHuman, c.notApplicable], [counts("automated"), counts("browser-only"), counts("needs-human"), counts("not-applicable")]);
  assert.equal(c.automatedPercent, Math.floor((c.automated * 1000) / 55) / 10);
  assert.ok(c.automatedSubstantialPercent < c.automatedPercent, "partial-only criteria are listed separately");
  assert.ok(c.needsHuman > c.automated / 2, "most criteria honestly need a human today");
  assert.match(c.note, /not that the criterion is met/);
  assert.match(report.boundary, /not a certificate/);
  assert.ok(c.automatedPercent < 50 && c.automatedSubstantialPercent < 20, "the figures stay modest");
});

test("the per-page report never turns a human or browser criterion into a pass", () => {
  const report = buildConformanceReport({ matrix, pages, designSystemCss: css });
  assert.equal(report.pages.length, Object.keys(pages).length);
  for (const page of report.pages) {
    assert.equal(page.criteria.length, 55);
    assert.deepEqual(page.failedCriteria, [], `${page.page}: no unexplained automated failure`);
    for (const item of page.criteria) {
      if (item.status === "needs-human" || item.status === "browser-only") assert.equal(item.outcome, item.status, `${page.page} ${item.id}`);
      assert.notEqual(item.outcome, "pass");
      if (item.status === "not-applicable") assert.equal(item.outcome, "not-applicable");
    }
    assert.deepEqual(page.knownFindingCriteria, ["1.4.11"], `${page.page}: the known control-border finding`);
  }
  assert.equal(report.knownFindings.length, 2);
  assert.ok(report.knownFindings.every(item => item.active));
  assert.deepEqual(report.staleKnownFindings, []);
});

test("a broken page is reported on exactly the criteria its failing check supports", () => {
  const bad = pages.workspace.replace(/<html[^>]*lang="fa"/i, "<html lang=\"en\"").replace(/<title>[^<]*<\/title>/i, "");
  const report = buildConformanceReport({ matrix, pages: { good: pages.workspace, bad }, designSystemCss: css });
  const [good, broken] = report.pages;
  assert.deepEqual(good.failedCriteria, []);
  assert.ok(broken.failedCriteria.includes("3.1.1") && broken.failedCriteria.includes("2.4.2"));
  assert.equal(broken.criteria.find(item => item.id === "1.1.1").outcome, "no-automated-failure", "unrelated criteria are unaffected");
  const withVideo = pages.identity.replace("</body>", "<video src=\"x.mp4\"></video></body>");
  const media = buildConformanceReport({ matrix, pages: { media: withVideo }, designSystemCss: css });
  assert.ok(media.pages[0].failedCriteria.includes("1.2.1") && media.pages[0].criteria.find(item => item.id === "1.2.1").outcome === "applicability-violated", "'no media' is only true while it stays true");
});

test("a known finding that no longer occurs is flagged as stale, and a new finding is not hidden by it", () => {
  const fixed = css.replace("--hero-line-strong: #b9ccc4;", "--hero-line-strong: #6b7d75;").replace("--hero-line-strong: #527060;", "--hero-line-strong: #8ca698;");
  const fixedReport = buildConformanceReport({ matrix, pages: { identity: pages.identity }, designSystemCss: fixed });
  assert.deepEqual(fixedReport.staleKnownFindings.map(item => `${item.ref}@${item.scope}`), ["control-border-on-surface@light", "control-border-on-surface@dark"]);
  assert.deepEqual(fixedReport.pages[0].knownFindingCriteria, []);
  const worse = css.replace("--hero-muted: #586e68;", "--hero-muted: #aab8b3;");
  const worseReport = buildConformanceReport({ matrix, pages: { identity: pages.identity }, designSystemCss: worse });
  assert.ok(worseReport.pages[0].failedCriteria.includes("1.4.3"), "a text-contrast regression is not covered by the 1.4.11 known finding");
});

test("contrast maths matches published vectors and the design tokens are read for both themes", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
  assert.equal(contrastRatio("#767676", "#ffffff"), 4.54, "the well-known smallest grey that passes 4.5 on white");
  assert.equal(contrastRatio("#777777", "#ffffff"), 4.48);
  assert.equal(contrastRatio("#ffffff", "#767676"), 4.54, "order does not matter");
  assert.equal(relativeLuminance("#000000"), 0);
  assert.equal(relativeLuminance("#ffffff"), 1);
  assert.throws(() => contrastRatio("red", "#ffffff"), RangeError);
  assert.throws(() => contrastRatio("#fff", "#ffffff"), RangeError);
  const tokens = readColorTokens(css);
  assert.equal(tokens.light["--hero-surface"], "#ffffff");
  assert.equal(tokens.dark["--hero-surface"], "#172621");
  assert.equal(tokens.dark["--hero-line-strong"], "#527060");
  const results = evaluateTokenContrast(css);
  assert.equal(results.length, TOKEN_CONTRAST_PAIRS.length * 2);
  assert.ok(results.filter(item => item.criterion === "1.4.3").every(item => item.passed), "every text pair passes 4.5:1 in both themes");
  assert.deepEqual(results.filter(item => !item.passed).map(item => `${item.id}@${item.theme}`), ["control-border-on-surface@light", "control-border-on-surface@dark"]);
  const missing = evaluateTokenContrast(css.replace("--hero-ink: #192b29;", ""));
  assert.ok(missing.some(item => item.reason === "token-missing" && !item.passed), "a missing token is reported, not skipped");
});

test("design-system CSS checks catch a removed focus outline and a smaller target size", () => {
  assert.deepEqual(evaluateDesignSystemCss(css), []);
  assert.ok(evaluateDesignSystemCss(css.replace("outline: 3px solid var(--hero-brand);", "outline: none;")).some(item => item.checkId === "focus-style-css"));
  assert.ok(evaluateDesignSystemCss(css.replace("--hero-control-height: 44px;", "--hero-control-height: 30px;")).some(item => item.checkId === "target-size-css"));
});

test("every static check is named, mapped to real criteria, and exercised by the audit", () => {
  const ids = STATIC_CHECKS.map(check => check.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const check of STATIC_CHECKS) {
    assert.ok(["substantial", "partial"].includes(check.strength), check.id);
    for (const criterion of check.wcag) assert.ok(WCAG_22_CRITERION_IDS.includes(criterion), `${check.id} maps to ${criterion}`);
  }
  const bad = `<html lang="en"><head><meta name="viewport" content="width=device-width, user-scalable=no"></head><body><div tabindex="3" id="a"></div><div id="a"></div><img src="x"><input id="n" type="password"><button></button><a href="/x"></a><h1></h1><h3>x</h3><video></video><main></main><main></main><p aria-labelledby="ghost"></p><script>screen.orientation.lock("portrait"); addEventListener("devicemotion", () => {});</script></body></html>`;
  const fired = new Set([...auditPageDetailed(bad), ...auditPageDetailed("<html><body></body></html>")].map(item => item.checkId));
  for (const id of ids) assert.ok(fired.has(id), `check ${id} has a bad-input case that fires it`);
});
