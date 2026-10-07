import assert from "node:assert/strict";
import test from "node:test";

import { createOperationalHardening, HardeningError } from "../packages/domain/src/operational-hardening.mjs";
import { createPostgresDomainRecordStore } from "../packages/adapters/src/postgresql-domain-record-store.mjs";
import { validateUiLocales, UI_MESSAGES } from "../packages/contracts/src/ui-locale.mjs";
import { validateHelpContent, HELP_GLOSSARY_IDS, HELP_RUNBOOK_IDS } from "../packages/contracts/src/help-content.mjs";
import { getOperationalHardeningContractSummary, validateOperationalHardeningContract } from "../packages/contracts/src/operational-hardening.mjs";
import { auditPage, contrastRatio, createRecorder, sha256 } from "../tools/acceptance/audit-lib.mjs";
import { createAuditFixture, PAGE_SURFACES } from "../tools/audit/local-fixture.mjs";

let clock = Date.parse("2026-10-07T10:00:00.000Z");
const now = () => new Date(clock).toISOString();
const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const viewer = { subject: "project-viewer", role: "viewer" };
const code = expected => error => error instanceof HardeningError && error.code === expected;
const P = "project-shop";
const digest = character => `sha256:${character.repeat(64)}`;
const daysAgo = days => new Date(clock - days * 86_400_000).toISOString();

test("BO-147 retention is per project, never weaker than the minimum and versioned", () => {
  const hardening = createOperationalHardening({ now });
  assert.deepEqual(validateOperationalHardeningContract(), []); assert.equal(getOperationalHardeningContractSummary().version, "1.1");
  assert.equal(hardening.retention({ actor: viewer, projectId: P }).custom, false); assert.equal(hardening.retention({ actor: viewer, projectId: P }).securityDays, 730);
  assert.throws(() => hardening.setRetention({ actor: admin, projectId: P, retention: { auditDays: 364 } }), code("RETENTION_WEAKENING_FORBIDDEN"));
  assert.throws(() => hardening.setRetention({ actor: admin, projectId: P, retention: { auditDays: 365.5 } }), code("RETENTION_INVALID"));
  assert.throws(() => hardening.setRetention({ actor: admin, projectId: P, retention: { auditDays: 99999 } }), code("RETENTION_TOO_LONG"));
  assert.throws(() => hardening.setRetention({ actor: viewer, projectId: P, retention: { auditDays: 400 } }), error => error.statusCode === 403);
  assert.equal(hardening.setRetention({ actor: admin, projectId: P, retention: { auditDays: 400 } }).version, 1);
  const second = hardening.setRetention({ actor: owner, projectId: P, retention: { evidenceDays: 500 } });
  assert.equal(second.version, 2); assert.equal(second.auditDays, 400, "an earlier extension is kept when another field changes"); assert.equal(hardening.retention({ actor: viewer, projectId: "project-other" }).auditDays, 365, "another project is untouched");
});

test("BO-148 cleanup is a dry-run: young and held records are never eligible, digests are preserved and deletion attempts are audited", () => {
  const hardening = createOperationalHardening({ now });
  const candidates = [
    { id: "audit-old", kind: "audit", digest: digest("a"), recordedAt: daysAgo(400) },
    { id: "audit-young", kind: "audit", digest: digest("b"), recordedAt: daysAgo(30) },
    { id: "security-mid", kind: "security", digest: digest("c"), recordedAt: daysAgo(400) },
    { id: "evidence-held", kind: "evidence", digest: digest("d"), recordedAt: daysAgo(800) }
  ];
  hardening.placeHold({ actor: admin, projectId: P, targetId: "evidence-held", reason: "legal review" });
  const plan = hardening.planCleanup({ actor: admin, projectId: P, jobId: "cleanup-1", candidates });
  assert.deepEqual(plan.eligible.map(item => item.id), ["audit-old"]); assert.deepEqual(plan.held.map(item => item.id), ["evidence-held"]);
  assert.deepEqual(plan.refusedTooYoung.map(item => item.id).sort(), ["audit-young", "security-mid"], "the security stream needs 730 days, so 400 is too young");
  assert.equal(plan.dryRun, true); assert.equal(plan.deletion, "not-authorized"); assert.match(plan.preservedManifestDigest, /^sha256:[a-f0-9]{64}$/);
  assert.throws(() => hardening.planCleanup({ actor: admin, projectId: P, jobId: "cleanup-1", candidates }), code("CLEANUP_JOB_EXISTS"));
  assert.throws(() => hardening.planCleanup({ actor: admin, projectId: P, jobId: "cleanup-2", candidates: [{ id: "x-no-digest", kind: "audit", recordedAt: daysAgo(900) }] }), code("CLEANUP_INVALID"), "a candidate without a digest cannot stay provable");
  assert.throws(() => hardening.planCleanup({ actor: admin, projectId: P, jobId: "cleanup-3", candidates: [{ id: "x-bad-kind", kind: "photo", digest: digest("e"), recordedAt: daysAgo(900) }] }), code("CLEANUP_INVALID"));
  assert.throws(() => hardening.releaseHold({ actor: admin, projectId: P, targetId: "evidence-held", reason: "release" }), code("OWNER_REQUIRED"));
  assert.throws(() => hardening.executeCleanup({ actor: admin, projectId: P, jobId: "cleanup-1", reason: "delete them" }), code("OWNER_REQUIRED"));
  assert.throws(() => hardening.executeCleanup({ actor: owner, projectId: P, jobId: "cleanup-1", reason: "delete them" }), code("CLEANUP_NOT_AUTHORIZED"));
  assert.throws(() => hardening.executeCleanup({ actor: owner, projectId: P, jobId: "cleanup-missing", reason: "delete them" }), code("CLEANUP_JOB_NOT_FOUND"));
  const report = hardening.cleanupReport({ actor: viewer, projectId: P });
  assert.equal(report.deletionAttempts.length, 1); assert.equal(report.deletionAttempts[0].outcome, "refused"); assert.equal(report.holds.length, 1);
  hardening.releaseHold({ actor: owner, projectId: P, targetId: "evidence-held", reason: "review finished" });
  assert.equal(hardening.cleanupReport({ actor: viewer, projectId: P }).holds.length, 0);
  assert.equal(hardening.planCleanup({ actor: admin, projectId: P, jobId: "cleanup-4", candidates: [candidates[3]] }).eligible.length, 1, "once released the record is eligible again");
});

test("BO-150..156 a hardening audit needs the producing tool, a digest and counted checks; pass is derived", () => {
  const hardening = createOperationalHardening({ now });
  const base = { actor: admin, projectId: P, auditId: "audit-a11y", kind: "accessibility", tool: "tools/acceptance/audit-lib.accessibility", toolVersion: "1.0", evidenceDigest: digest("a"), checks: { total: 13, passed: 13 } };
  assert.throws(() => hardening.recordAudit({ ...base, evidenceDigest: "trust-me" }), code("AUDIT_EVIDENCE_REQUIRED"));
  assert.throws(() => hardening.recordAudit({ ...base, tool: "" }), code("AUDIT_TOOL_REQUIRED"));
  assert.throws(() => hardening.recordAudit({ ...base, checks: { total: 3, passed: 4 } }), code("AUDIT_CHECKS_INVALID"));
  assert.throws(() => hardening.recordAudit({ ...base, checks: undefined }), code("AUDIT_CHECKS_INVALID"));
  assert.throws(() => hardening.recordAudit({ ...base, kind: "vibes" }), code("AUDIT_KIND_INVALID"));
  assert.throws(() => hardening.recordAudit({ ...base, actor: viewer }), error => error.statusCode === 403);
  const passing = hardening.recordAudit({ ...base, passed: false /* ignored: pass is derived */ }); assert.equal(passing.passed, true);
  assert.throws(() => hardening.recordAudit(base), code("AUDIT_IMMUTABLE"));
  const failing = hardening.recordAudit({ ...base, auditId: "audit-sec", kind: "security", checks: { total: 10, passed: 9 }, findings: ["route X is open"] }); assert.equal(failing.passed, false);
  assert.equal(hardening.recordAudit({ ...base, auditId: "audit-find", kind: "load", checks: { total: 5, passed: 5 }, findings: ["slow"] }).passed, false, "a finding fails an audit even when every check passed");
  const report = hardening.report({ actor: viewer, projectId: P });
  assert.equal(report.coverage.states.accessibility, "passing"); assert.equal(report.coverage.states.security, "failing"); assert.equal(report.coverage.states.load, "failing"); assert.equal(report.coverage.states["backup-restore"], "missing");
  assert.equal(report.coverage.complete, false); assert.deepEqual(report.coverage.stale, []);
  clock += 31 * 86_400_000;
  assert.equal(hardening.report({ actor: viewer, projectId: P }).coverage.states.accessibility, "stale", "an old passing audit is stale, not current");
});

test("BO-151 pagination is bounded and BO-149 locale is validated", () => {
  const hardening = createOperationalHardening({ now });
  const records = Array.from({ length: 60 }, (_, index) => ({ index }));
  assert.equal(hardening.page({ actor: viewer, projectId: P, records, limit: 25 }).nextCursor, 25);
  assert.equal(hardening.page({ actor: viewer, projectId: P, records, cursor: 50, limit: 25 }).nextCursor, null);
  assert.throws(() => hardening.page({ actor: viewer, projectId: P, records, limit: 101 }), code("QUERY_BUDGET_EXCEEDED"));
  assert.throws(() => hardening.page({ actor: viewer, projectId: P, records, limit: 50, queryBudget: 20 }), code("QUERY_BUDGET_EXCEEDED"));
  assert.throws(() => hardening.page({ actor: viewer, projectId: P, records, cursor: -1 }), code("QUERY_BUDGET_EXCEEDED"));
  assert.equal(hardening.localeOf({ actor: viewer, projectId: P }), "fa");
  assert.equal(hardening.locale({ actor: admin, projectId: P, locale: "en" }).direction, "ltr"); assert.equal(hardening.localeOf({ actor: viewer, projectId: P }), "en");
  assert.throws(() => hardening.locale({ actor: admin, projectId: P, locale: "de" }), code("LOCALE_INVALID"));
});

test("hardening records persist append-only and replay in any order", async () => {
  const hardening = createOperationalHardening({ now });
  hardening.setRetention({ actor: owner, projectId: P, retention: { auditDays: 500 } }); hardening.setRetention({ actor: owner, projectId: P, retention: { auditDays: 600 } });
  hardening.placeHold({ actor: admin, projectId: P, targetId: "audit-old", reason: "review" }); hardening.planCleanup({ actor: admin, projectId: P, jobId: "cleanup-r", candidates: [{ id: "audit-old", kind: "audit", digest: digest("f"), recordedAt: daysAgo(900) }] });
  assert.throws(() => hardening.executeCleanup({ actor: owner, projectId: P, jobId: "cleanup-r", reason: "try it" }));
  hardening.recordAudit({ actor: admin, projectId: P, auditId: "audit-r", kind: "security", tool: "tools/audit/security", toolVersion: "1", evidenceDigest: digest("9"), checks: { total: 2, passed: 2 } }); hardening.locale({ actor: admin, projectId: P, locale: "en" });
  const rows = []; const client = { async query(sql, values) { if (sql.startsWith("INSERT")) { rows.push({ record_kind: values[1], record_key: values[2], record_version: values[3], project_id: values[4], metadata: JSON.parse(values[5]), actor_id: values[6] }); return { rows: [] }; } return { rows }; } };
  const store = createPostgresDomainRecordStore({ client });
  for (const record of hardening.drainRecords()) await store.appendRecord("hardening", record);
  const restored = createOperationalHardening({ now }); for (const record of [...await store.listRecords("hardening")].reverse()) restored.hydrate(record);
  assert.deepEqual(restored.retention({ actor: viewer, projectId: P }), hardening.retention({ actor: viewer, projectId: P })); assert.equal(restored.retention({ actor: viewer, projectId: P }).auditDays, 600, "the newest version wins in any replay order");
  assert.deepEqual(restored.cleanupReport({ actor: viewer, projectId: P }), hardening.cleanupReport({ actor: viewer, projectId: P })); assert.deepEqual(restored.report({ actor: viewer, projectId: P }), hardening.report({ actor: viewer, projectId: P }));
  assert.equal(restored.localeOf({ actor: viewer, projectId: P }), "en"); assert.throws(() => restored.recordAudit({ actor: admin, projectId: P, auditId: "audit-r", kind: "security", tool: "tools/audit/security", toolVersion: "1", evidenceDigest: digest("9"), checks: { total: 2, passed: 2 } }), code("AUDIT_IMMUTABLE"), "immutability survives a restart");
});

test("BO-149 both locales define the same messages and the same placeholders; the audit library measures real contrast", () => {
  assert.deepEqual(validateUiLocales(), []); assert.deepEqual(validateHelpContent(), []);
  assert.ok(Object.keys(UI_MESSAGES.fa).length > 40);
  assert.ok(contrastRatio("#000000", "#ffffff") > 20.9 && contrastRatio("#777777", "#888888") < 1.5); assert.equal(contrastRatio("nope", "#ffffff"), null);
  const recorder = createRecorder("tools/test"); recorder.check("a", true); recorder.check("b", false, "why"); const result = recorder.finish();
  assert.deepEqual(result.checks, { total: 2, passed: 1 }); assert.deepEqual(result.findings, ["b: why"]); assert.match(result.evidenceDigest, /^sha256:[a-f0-9]{64}$/); assert.equal(sha256("x"), sha256("x"));
  const badPage = '<!doctype html><html><head><title>x</title><style>.a{color:#777;background:#888}button{outline:none}</style></head><body><main><h1>t</h1><button></button><input name="q"><img src="x"></main></body></html>';
  const verdict = auditPage(badPage, { name: "bad" });
  for (const needle of ["declares a language", "accessible name", "labelled", "image has alt", "focus indicator", "4.5:1"]) assert.ok(verdict.findings.some(item => item.includes(needle)), `the audit catches: ${needle}`);
});

test("BO-147..150/156/165 HTTP: hardening roles, durable cleanup attempts, bilingual pages, help and accessibility for three roles", async t => {
  const fixture = await createAuditFixture({ now }); t.after(() => fixture.stop()); await fixture.seed();
  const { call, page } = fixture; const root = "/api/projects/project-alpha"; const body = { auditId: "audit-http", kind: "accessibility", tool: "tools/acceptance/audit-lib.accessibility", toolVersion: "1.0", evidenceDigest: digest("1"), checks: { total: 2, passed: 2 } };
  assert.equal((await call("viewer", "POST", `${root}/hardening`, { action: "set-retention", retention: { auditDays: 400 } })).status, 403);
  assert.equal((await call("admin", "POST", `${root}/hardening`, { action: "set-retention", retention: { auditDays: 100 } })).status, 400);
  assert.equal((await call("admin", "POST", `${root}/hardening`, { action: "set-retention", retention: { auditDays: 400 } })).body.result.version, 1);
  assert.equal((await call("viewer", "GET", `${root}/retention-policy`)).body.retention.auditDays, 400);
  assert.equal((await call("admin", "POST", `${root}/hardening`, { action: "record-audit", ...body, passed: false })).body.result.passed, true, "a client cannot assert a result");
  assert.equal((await call("admin", "POST", `${root}/hardening`, { action: "record-audit", ...body, auditId: "audit-bad", evidenceDigest: "nope" })).status, 400);
  assert.equal((await call("admin", "POST", `${root}/hardening`, { action: "explode" })).status, 400);
  const plan = await call("admin", "POST", `${root}/hardening`, { action: "plan-cleanup", jobId: "cleanup-http", candidates: [{ id: "audit-very-old", kind: "audit", digest: digest("2"), recordedAt: "2020-01-01T00:00:00.000Z" }] });
  assert.equal(plan.status, 201); assert.equal(plan.body.result.eligible.length, 1);
  assert.equal((await call("admin", "POST", `${root}/hardening/cleanup/cleanup-http/execute`, { reason: "please delete" })).status, 403);
  const executed = await call("owner", "POST", `${root}/hardening/cleanup/cleanup-http/execute`, { reason: "please delete" }); assert.equal(executed.status, 409); assert.equal(executed.body.code, "CLEANUP_NOT_AUTHORIZED");
  const view = (await call("viewer", "GET", `${root}/hardening`)).body; assert.equal(view.cleanup.deletionAttempts.length, 1, "the refused deletion is durable and visible"); assert.equal(view.hardening.coverage.states.accessibility, "passing");
  assert.equal((await call("admin", "GET", "/api/projects/project-beta/hardening")).status, 403, "no grant on another project");
  // locale + help + accessibility
  assert.equal((await call("admin", "POST", `${root}/hardening`, { action: "set-locale", locale: "en" })).body.result.direction, "ltr");
  const english = await page("viewer", "inbox"); assert.match(english.html, /<html lang="en" dir="ltr">/); assert.match(english.html, /Needs my decision/);
  const persian = await page("viewer", "inbox", "project-alpha", "&lang=fa"); assert.match(persian.html, /<html lang="fa" dir="rtl">/); assert.match(persian.html, /نیازمند تصمیم من/);
  const ids = html => [...html.matchAll(/data-(?:tab|panel|notification|slo|act|count)="([^"]+)"/g)].map(match => match[0]).sort();
  assert.deepEqual(ids(english.html), ids(persian.html), "identifiers are identical in both locales");
  assert.equal(await page("viewer", "inbox", "project-alpha", "&lang=xx").then(response => /<html lang="en"/.test(response.html)), true, "an unknown language falls back to the project preference");
  for (const who of ["owner", "admin", "viewer"]) {
    const helpPage = await page(who, "help"); assert.equal(helpPage.status, 200);
    for (const term of HELP_GLOSSARY_IDS) assert.ok(helpPage.html.includes(`data-term="${term}"`), `${who}: glossary ${term}`);
    for (const item of HELP_RUNBOOK_IDS) assert.ok(helpPage.html.includes(`data-runbook="${item}"`), `${who}: runbook ${item}`);
    assert.equal((helpPage.html.match(/data-own-role/g) ?? []).length, 1, `${who}: exactly one role is marked as yours`);
    assert.doesNotMatch(helpPage.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ""), /sk-[A-Za-z0-9]{12}|password|Bearer /i);
  }
  assert.equal((await page("viewer", "help", "project-beta")).status, 403);
  for (const who of ["owner", "admin", "viewer"]) for (const locale of ["fa", "en"]) for (const surface of PAGE_SURFACES) {
    const rendered = await page(who, surface, "project-alpha", `&lang=${locale}`); assert.equal(rendered.status, 200, `${who}/${surface}`);
    const verdict = auditPage(rendered.html, { name: `${surface}/${who}/${locale}`, ...(surface === "inbox" || surface === "help" ? { expectLocale: locale } : {}) });
    assert.equal(verdict.checks.passed, verdict.checks.total, verdict.findings.join(" | "));
  }
});
