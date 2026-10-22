import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EVIDENCE_KINDS, EVIDENCE_STRENGTHS, MATRIX_STATUSES, WCAG_22_CRITERIA, WCAG_22_CRITERION_IDS } from "../packages/contracts/src/wcag-22.mjs";
import { REPO_ROOT } from "./fs-policy.mjs";
import { STATIC_CHECKS, TOKEN_CONTRAST_PAIRS, auditPageDetailed, evaluateDesignSystemCss, evaluateTokenContrast } from "./ui-static-audit.mjs";

/**
 * NX-037 — WCAG 2.2 AA coverage map.
 *
 * `config/accessibility/wcag-22-aa-matrix-v1.json` says, for each of the 55 Level A and AA criteria, which
 * automated evidence exists, which needs a human, and which does not apply. This tool checks that the matrix is
 * honest (every reference resolves; deleting a referenced test or check fails the check) and builds a per-page
 * report. A criterion without automated evidence is never reported as covered. The report is not a certificate.
 */

export const MATRIX_FILE = "config/accessibility/wcag-22-aa-matrix-v1.json";
export const DESIGN_SYSTEM_FILE = "apps/control-plane/src/hero-design-system.mjs";
const DESIGN_CSS_CHECKS = Object.freeze({ "focus-style-css": ["2.4.7"], "target-size-css": ["2.5.8"] });
const STATIC_BY_ID = new Map(STATIC_CHECKS.map(check => [check.id, check]));

function readText(root, relative) {
  const absolute = path.join(root, relative);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : null;
}

/** Checks that one piece of evidence points at something that exists and really gives evidence for the criterion. */
function validateEvidence(evidence, criterionId, root) {
  const errors = [];
  if (!evidence || typeof evidence !== "object") return ["evidence must be an object"];
  if (!EVIDENCE_KINDS.includes(evidence.kind)) return [`unknown evidence kind: ${evidence.kind}`];
  if (!EVIDENCE_STRENGTHS.includes(evidence.strength)) errors.push(`evidence strength must be one of ${EVIDENCE_STRENGTHS.join(", ")}`);
  if (typeof evidence.ref !== "string" || evidence.ref.length === 0) return [...errors, "evidence needs a ref"];
  if (evidence.kind === "static-check") {
    const check = STATIC_BY_ID.get(evidence.ref);
    if (!check) errors.push(`static check ${evidence.ref} does not exist`);
    else if (!check.wcag.includes(criterionId)) errors.push(`static check ${evidence.ref} does not declare criterion ${criterionId}`);
    else if (evidence.strength === "substantial" && check.strength !== "substantial") errors.push(`static check ${evidence.ref} is only partial evidence`);
  } else if (evidence.kind === "token-contrast") {
    if (!TOKEN_CONTRAST_PAIRS.some(pair => pair.criterion === criterionId && pair.criterion === evidence.ref)) errors.push(`no contrast pair is declared for criterion ${criterionId}`);
  } else if (evidence.kind === "design-css") {
    if (!DESIGN_CSS_CHECKS[evidence.ref]?.includes(criterionId)) errors.push(`design check ${evidence.ref} does not give evidence for ${criterionId}`);
  } else {
    const text = readText(root, evidence.ref);
    if (text === null) errors.push(`${evidence.kind} file does not exist: ${evidence.ref}`);
    else if (typeof evidence.contains !== "string" || evidence.contains.length < 4 || !text.includes(evidence.contains)) errors.push(`${evidence.ref} no longer contains "${evidence.contains}"`);
  }
  return errors;
}

export function validateWcagMatrix(matrix, { root = REPO_ROOT } = {}) {
  const errors = [];
  if (!matrix || matrix.schema !== "hero.wcag-conformance-matrix/v1") return ["unexpected matrix schema"];
  if (!/^\d+\.\d+\.\d+$/.test(matrix.version ?? "")) errors.push("matrix version must be SemVer");
  const criteria = matrix.criteria && typeof matrix.criteria === "object" ? matrix.criteria : {};
  for (const id of WCAG_22_CRITERION_IDS) if (!Object.hasOwn(criteria, id)) errors.push(`${id}: criterion is missing from the matrix`);
  for (const id of Object.keys(criteria)) if (!WCAG_22_CRITERION_IDS.includes(id)) errors.push(`${id}: not a WCAG 2.2 A/AA criterion`);
  for (const id of WCAG_22_CRITERION_IDS) {
    const row = criteria[id];
    if (!row) continue;
    if (!MATRIX_STATUSES.includes(row.status)) { errors.push(`${id}: unknown status ${row.status}`); continue; }
    const evidence = Array.isArray(row.evidence) ? row.evidence : [];
    for (const item of evidence) errors.push(...validateEvidence(item, id, root).map(message => `${id}: ${message}`));
    const offline = evidence.filter(item => item?.kind !== "browser-test");
    if (row.status === "automated" && offline.length === 0) errors.push(`${id}: automated needs at least one offline evidence (a criterion without an automated check is never covered)`);
    if (row.status === "browser-only" && (evidence.length === 0 || offline.length > 0)) errors.push(`${id}: browser-only needs browser evidence and no offline evidence`);
    const known = row.knownFindings ?? [];
    if (!Array.isArray(known) || known.some(item => typeof item?.ref !== "string" || typeof item?.scope !== "string" || typeof item?.note !== "string" || item.note.trim().length < 15)) errors.push(`${id}: knownFindings need ref, scope and a note of at least 15 characters`);
    if (known.length > 0 && row.status !== "automated") errors.push(`${id}: knownFindings only apply to automated criteria`);
    if (row.status === "needs-human") {
      if (evidence.length > 0) errors.push(`${id}: needs-human must not list evidence; move it to automated or browser-only`);
      if (typeof row.humanReview !== "string" || row.humanReview.trim().length < 15) errors.push(`${id}: needs-human needs a humanReview instruction`);
    }
    if (row.status === "not-applicable") {
      if (typeof row.justification !== "string" || row.justification.trim().length < 15) errors.push(`${id}: not-applicable needs a justification`);
      if (row.applicability?.kind !== "static-check" || !STATIC_BY_ID.has(row.applicability.ref)) errors.push(`${id}: not-applicable needs an applicability check that exists`);
      if (evidence.length > 0) errors.push(`${id}: not-applicable must not list evidence`);
    }
  }
  return errors;
}

/** Builds the per-page report. A page outcome for an automated criterion is "failed" or "no-automated-failure", never "pass". */
export function buildConformanceReport({ matrix, pages, designSystemCss }) {
  const tokenResults = evaluateTokenContrast(designSystemCss);
  const cssFindings = evaluateDesignSystemCss(designSystemCss);
  const rows = WCAG_22_CRITERIA.map(criterion => ({ criterion, row: matrix.criteria[criterion.id] }));

  const summary = { total: rows.length, automated: 0, automatedSubstantial: 0, automatedPartialOnly: 0, browserOnly: 0, needsHuman: 0, notApplicable: 0 };
  for (const { row } of rows) {
    if (row.status === "automated") {
      summary.automated += 1;
      if ((row.evidence ?? []).some(item => item.strength === "substantial")) summary.automatedSubstantial += 1; else summary.automatedPartialOnly += 1;
    } else if (row.status === "browser-only") summary.browserOnly += 1;
    else if (row.status === "needs-human") summary.needsHuman += 1;
    else summary.notApplicable += 1;
  }
  const percent = value => Math.floor((value * 1000) / summary.total) / 10;
  const coverage = {
    ...summary,
    automatedPercent: percent(summary.automated),
    automatedSubstantialPercent: percent(summary.automatedSubstantial),
    note: "Automated coverage is evidence that checks exist, not that the criterion is met; partial-only criteria are listed separately."
  };

  const matched = new Set();
  const isKnown = (row, ref, scope) => {
    const index = (row.knownFindings ?? []).findIndex(item => item.ref === ref && (item.scope === scope || item.scope === "*"));
    if (index >= 0) matched.add(`${row.__id}:${index}`);
    return index >= 0;
  };
  for (const { criterion, row } of rows) row.__id = criterion.id;

  const pageReports = Object.entries(pages).map(([name, html]) => {
    const findings = auditPageDetailed(html);
    const failedChecks = new Set(findings.map(item => item.checkId));
    const criteria = rows.map(({ criterion, row }) => {
      let outcome;
      let details = [];
      if (row.status === "automated") {
        details = (row.evidence ?? []).map(item => {
          if (item.kind === "static-check") {
            const failed = failedChecks.has(item.ref);
            return { kind: item.kind, ref: item.ref, failed: failed && !isKnown(row, item.ref, name), known: failed && isKnown(row, item.ref, name) };
          }
          if (item.kind === "token-contrast") {
            const failures = tokenResults.filter(result => result.criterion === item.ref && !result.passed);
            const unexplained = failures.filter(result => !isKnown(row, result.id, result.theme));
            return { kind: item.kind, ref: item.ref, failed: unexplained.length > 0, known: failures.length > 0 && unexplained.length === 0, failures: failures.map(result => `${result.id}@${result.theme}=${result.ratio}`) };
          }
          if (item.kind === "design-css") {
            const failed = cssFindings.some(finding => finding.checkId === item.ref);
            return { kind: item.kind, ref: item.ref, failed: failed && !isKnown(row, item.ref, "*"), known: failed && isKnown(row, item.ref, "*") };
          }
          return { kind: item.kind, ref: item.ref, failed: false, known: false };
        });
        outcome = details.some(item => item.failed) ? "failed" : details.some(item => item.known) ? "known-finding" : "no-automated-failure";
      } else if (row.status === "not-applicable") {
        const violated = failedChecks.has(row.applicability.ref);
        details = [{ kind: "applicability", ref: row.applicability.ref, failed: violated, known: false }];
        outcome = violated ? "applicability-violated" : "not-applicable";
      } else outcome = row.status;
      return { id: criterion.id, level: criterion.level, name: criterion.name, status: row.status, outcome, details };
    });
    return {
      page: name,
      findings: findings.map(item => ({ checkId: item.checkId, message: item.message })),
      failedCriteria: criteria.filter(item => item.outcome === "failed" || item.outcome === "applicability-violated").map(item => item.id),
      knownFindingCriteria: criteria.filter(item => item.outcome === "known-finding").map(item => item.id),
      criteria
    };
  });
  const knownFindings = rows.flatMap(({ criterion, row }) => (row.knownFindings ?? []).map((item, index) => ({ criterion: criterion.id, ref: item.ref, scope: item.scope, note: item.note, active: matched.has(`${criterion.id}:${index}`) })));
  for (const { row } of rows) delete row.__id;
  return {
    schema: "hero.wcag-conformance-report/v1",
    standard: "WCAG 2.2",
    matrixVersion: matrix.version,
    coverage,
    tokenContrast: tokenResults,
    designSystemFindings: cssFindings,
    knownFindings,
    staleKnownFindings: knownFindings.filter(item => !item.active),
    pages: pageReports,
    boundary: "A coverage map, not a certificate of conformance. needs-human criteria are never counted as met."
  };
}

export async function loadAuditedPages() {
  const [backoffice, dashboard, identity, portfolio, productStudio, controlRoom, walkthrough, workspace] = await Promise.all([
    import("../apps/control-plane/src/backoffice-view.mjs"),
    import("../apps/control-plane/src/dashboard-view.mjs"),
    import("../apps/control-plane/src/identity-view.mjs"),
    import("../apps/control-plane/src/portfolio-view.mjs"),
    import("../apps/control-plane/src/product-studio-view.mjs"),
    import("../apps/control-plane/src/project-control-room-view.mjs"),
    import("../apps/control-plane/src/project-walkthrough-view.mjs"),
    import("../apps/control-plane/src/project-workspace-view.mjs")
  ]);
  return {
    backoffice: backoffice.getBackofficeHtml(),
    dashboard: dashboard.getDashboardHtml(),
    identity: identity.getIdentityHtml(),
    portfolio: portfolio.getPortfolioHtml({ portfolio: { projects: [], kpis: [], role: "owner" } }),
    "product-studio": productStudio.getProductStudioHtml(),
    "project-control": controlRoom.getProjectControlRoomHtml(),
    walkthrough: walkthrough.getProjectWalkthroughHtml({ projectId: "demo-project" }),
    workspace: workspace.getProjectWorkspaceHtml({ projectId: "demo-project" })
  };
}

export async function designSystemCss() {
  const module = await import("../apps/control-plane/src/hero-design-system.mjs");
  return module.getHeroDesignSystemStyles();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const matrix = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, MATRIX_FILE), "utf8"));
  const errors = validateWcagMatrix(matrix);
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR ${error}`);
    console.log(`WCAG matrix: FAIL — ${errors.length} error(s)`);
    process.exitCode = 1;
  } else {
    const report = buildConformanceReport({ matrix, pages: await loadAuditedPages(), designSystemCss: await designSystemCss() });
    const failing = report.pages.flatMap(page => page.failedCriteria.map(id => `${page.page}:${id}`));
    if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
    for (const item of failing) console.error(`ERROR automated finding ${item}`);
    for (const item of report.staleKnownFindings) { console.error(`ERROR known finding no longer occurs, remove it: ${item.criterion} ${item.ref}@${item.scope}`); failing.push(`stale:${item.criterion}`); }
    for (const item of report.knownFindings.filter(entry => entry.active)) console.log(`known finding ${item.criterion} ${item.ref}@${item.scope}: ${item.note}`);
    const c = report.coverage;
    console.log(`WCAG 2.2 A/AA matrix: ${failing.length === 0 ? "PASS" : "FAIL"} — ${c.total} criteria: ${c.automated} with automated evidence (${c.automatedSubstantial} substantial, ${c.automatedPartialOnly} partial only; ${c.automatedPercent}% / ${c.automatedSubstantialPercent}%), ${c.browserOnly} browser-only, ${c.needsHuman} need a human, ${c.notApplicable} not applicable; ${report.pages.length} pages, ${failing.length} automated finding(s). Coverage map, not a certificate.`);
    if (failing.length > 0) process.exitCode = 1;
  }
}
