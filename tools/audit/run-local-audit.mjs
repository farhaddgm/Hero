#!/usr/bin/env node
// Runs every executable audit of BO-147..BO-166 against local, in-process Hero
// instances and writes the counted evidence. Nothing here touches a network,
// a secret, a provider or any host outside this checkout.
//
//   node tools/audit/run-local-audit.mjs [--out <dir>] [--no-soak]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditPage, createRecorder, mergeResults } from "../acceptance/audit-lib.mjs";
import { createAuditFixture, PAGE_SURFACES } from "./local-fixture.mjs";
import { runSecurityReview } from "../acceptance/security-review.mjs";
import { runFailureInjection, runLoad, runSoak, runWriteConsistency } from "./load-soak.mjs";
import { auditCoverage, NOT_RUN, scanDependencies, scanSecrets } from "./secret-dependency-scan.mjs";
import { rehearseTransfer } from "./backup-restore.mjs";
import { createMemoryRuntime } from "./memory-runtime.mjs";
import { runAdversarialScenario, runCrashResumeScenario, runTransferScenario, runTwoProjectScenario } from "./scenarios.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.resolve(here, "../..");
const FIXED_NOW = () => "2026-10-07T10:00:00.000Z";

/** Maps each hardening audit kind to the BO steps and the checks that back it. */
export async function runAllAudits({ soakSeconds = 3, now = FIXED_NOW } = {}) {
  const createFixture = options => createAuditFixture({ now, ...options });
  const results = {};
  // accessibility (BO-150) and role/locale regression (BO-156)
  { const fixture = await createFixture(); try {
    await fixture.seed(); const parts = []; const regression = createRecorder("tools/audit/run-local-audit.role-regression");
    for (const who of ["owner", "admin", "viewer"]) for (const locale of ["fa", "en"]) for (const surface of PAGE_SURFACES) {
      const rendered = await fixture.page(who, surface, "project-alpha", `&lang=${locale}`); const name = `${surface}/${who}/${locale}`;
      regression.check(`${name} renders`, rendered.status === 200, rendered.status);
      if (rendered.status === 200) parts.push(auditPage(rendered.html, { name, ...(surface === "inbox" || surface === "help" ? { expectLocale: locale } : {}) }));
    }
    regression.check("another project's pages stay closed to a viewer in both locales", (await fixture.page("viewer", "inbox", "project-beta", "&lang=en")).status === 403 && (await fixture.page("viewer", "help", "project-beta", "&lang=fa")).status === 403);
    for (const locale of ["fa", "en"]) regression.check(`a viewer's inbox has no action button (${locale})`, !/data-act="/.test((await fixture.page("viewer", "inbox", "project-alpha", `&lang=${locale}`)).html.split("<script>")[0]));
    results.accessibility = mergeResults("tools/audit/run-local-audit.accessibility", parts); results["role-regression"] = regression.finish();
    // security (BO-152)
    results.security = await runSecurityReview(fixture);
  } finally { await fixture.stop(); } }
  // load / soak / failure injection (BO-153)
  { const fixture = await createFixture(); const recorder = createRecorder("tools/audit/load-soak"); try { await fixture.seed(); const load = await runLoad(fixture, recorder); await runWriteConsistency(fixture, recorder); const soak = soakSeconds > 0 ? await runSoak(fixture, recorder, { seconds: soakSeconds }) : null; results.load = { ...recorder.finish({ load, soak }) }; } finally { await fixture.stop(); } }
  { const recorder = createRecorder("tools/audit/load-soak.failure-injection"); await runFailureInjection({ createFixture: async serverOptions => { const fixture = await createFixture({ serverOptions }); await fixture.seed(); return fixture; } }, recorder); results.load = mergeResults("tools/audit/load-soak", [results.load, recorder.finish()]); }
  // backup / restore + transfer (BO-154, BO-163)
  { const recorder = createRecorder("tools/audit/backup-restore"); const transfer = await runTransferScenario({ createFixture, now }); for (const item of transfer.results) recorder.check(`transfer: ${item.name}`, item.ok, item.detail); results["backup-restore"] = recorder.finish({ records: transfer.records }); results.__transfer = transfer; }
  // secret / dependency / audit coverage (BO-155)
  { const recorder = createRecorder("tools/audit/secret-dependency-scan"); const secrets = scanSecrets({ root, recorder }); const dependencies = scanDependencies({ root, recorder }); const fixture = await createFixture(); try { await fixture.seed(); await auditCoverage(fixture, recorder); } finally { await fixture.stop(); } results["secret-dependency"] = recorder.finish({ filesScanned: secrets.scanned, directDependencies: dependencies.direct, lockedPackages: dependencies.packages, notRun: NOT_RUN }); }
  // scenarios (BO-160..BO-163)
  results.__scenarios = { "e2e-multi-project": await runTwoProjectScenario({ createFixture }), "adversarial-access": await runAdversarialScenario({ createFixture }), "crash-resume": await runCrashResumeScenario({ createFixture }), "test-transfer": results.__transfer };
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : path.join(root, "dist", "audit");
  const results = await runAllAudits({ soakSeconds: process.argv.includes("--no-soak") ? 0 : 3 }); fs.mkdirSync(out, { recursive: true });
  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    if (name === "__scenarios") { for (const [kind, scenario] of Object.entries(result)) { console.log(`${scenario.checks.passed === scenario.checks.total ? "PASS" : "FAIL"} scenario ${kind}: ${scenario.checks.passed}/${scenario.checks.total}`); if (scenario.checks.passed !== scenario.checks.total) { failed += 1; for (const finding of scenario.findings) console.log(`  - ${finding}`); } } continue; }
    if (name === "__transfer") continue;
    const ok = result.checks.passed === result.checks.total; if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${result.checks.passed}/${result.checks.total} (${result.evidenceDigest.slice(0, 19)}…)`); for (const finding of result.findings) console.log(`  - ${finding}`);
  }
  fs.writeFileSync(path.join(out, "local-audit-evidence.json"), JSON.stringify(Object.fromEntries(Object.entries(results).filter(([name]) => !name.startsWith("__")).concat(Object.entries(results.__scenarios).map(([kind, value]) => [`scenario:${kind}`, value]))), null, 2));
  console.log(`evidence written to ${path.join(out, "local-audit-evidence.json")}`); process.exit(failed ? 1 : 0);
}
