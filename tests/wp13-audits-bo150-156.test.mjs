import assert from "node:assert/strict";
import test from "node:test";

import { runAllAudits } from "../tools/audit/run-local-audit.mjs";
import { createAuditFixture } from "../tools/audit/local-fixture.mjs";
import { createMemoryRuntime } from "../tools/audit/memory-runtime.mjs";
import { createBackup, restoreBackup, verifyBackup, compareRuntimes, RestoreError } from "../tools/audit/backup-restore.mjs";
import { scanSecrets, scanDependencies } from "../tools/audit/secret-dependency-scan.mjs";
import { createRecorder, sha256 } from "../tools/acceptance/audit-lib.mjs";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const now = () => "2026-10-07T10:00:00.000Z";

test("BO-150/152/153/154/155/156 every executable audit passes against real instances and is recorded as evidence the server itself derives pass from", { timeout: 280000 }, async t => {
  const results = await runAllAudits({ soakSeconds: 1, now });
  for (const kind of ["accessibility", "security", "load", "backup-restore", "secret-dependency", "role-regression"]) {
    const result = results[kind]; assert.ok(result, kind); assert.equal(result.checks.passed, result.checks.total, `${kind}: ${result.findings.join(" | ")}`); assert.ok(result.checks.total >= 5, `${kind} counts real checks`);
  }
  assert.ok(results.accessibility.checks.total > 400, "accessibility measured every page, role and locale"); assert.ok(results.security.checks.total >= 90);
  for (const [kind, scenario] of Object.entries(results.__scenarios)) assert.equal(scenario.checks.passed, scenario.checks.total, `${kind}: ${scenario.findings.join(" | ")}`);
  assert.deepEqual(results["secret-dependency"].results.filter(item => !item.ok), []);
  // recorded through the real API as the owner; the server derives pass/fail
  const fixture = await createAuditFixture({ now }); t.after(() => fixture.stop()); const { call } = fixture; const root_ = "/api/projects/project-alpha";
  for (const kind of ["accessibility", "security", "load", "backup-restore", "secret-dependency", "role-regression"]) {
    const result = results[kind]; const recorded = await call("owner", "POST", `${root_}/hardening`, { action: "record-audit", auditId: `audit-${kind}`, kind, tool: result.tool, toolVersion: result.toolVersion, evidenceDigest: result.evidenceDigest, checks: result.checks, findings: result.findings });
    assert.equal(recorded.status, 201, `${kind}: ${JSON.stringify(recorded.body)}`); assert.equal(recorded.body.result.passed, true);
  }
  const report = (await call("viewer", "GET", `${root_}/hardening`)).body.hardening; assert.equal(report.coverage.complete, true); assert.deepEqual(report.coverage.missing, []);
  const worse = await call("owner", "POST", `${root_}/hardening`, { action: "record-audit", auditId: "audit-security-regress", kind: "security", tool: "tools/audit/security-review", toolVersion: "1.0", evidenceDigest: `sha256:${"4".repeat(64)}`, checks: { total: 103, passed: 102 }, findings: ["route X open"] });
  assert.equal(worse.body.result.passed, false); assert.equal((await call("viewer", "GET", `${root_}/hardening`)).body.hardening.coverage.states.security, "failing", "a newer failing audit replaces a passing one");
});

test("BO-154 backup is verified, restore refuses a dirty target and a tampered bundle, and nothing leaks", async t => {
  const runtime = createMemoryRuntime(); const fixture = await createAuditFixture({ now, serverOptions: { postgresRuntime: runtime } }); t.after(() => fixture.stop()); await fixture.seed();
  await fixture.call("owner", "POST", "/api/projects/project-alpha/notifications", { category: "health", severity: "info", title: "token sk-live-abcdefghijklmnop", deduplicationKey: "leak-check", correlationId: "corr-leak", action: { type: "fix", apiKey: "sk-live-zzzzzzzzzzzzzzzz" } });
  const bundle = await createBackup({ runtime, now }); const verdict = verifyBackup(bundle); assert.equal(verdict.checks.passed, verdict.checks.total);
  assert.ok(Object.values(bundle.sections).reduce((sum, section) => sum + section.count, 0) > 15); assert.ok(bundle.excludes.some(item => item.includes("Secret Store")));
  assert.ok(!JSON.stringify(bundle).includes("sk-live-zzzzzzzzzzzzzzzz") && !JSON.stringify(bundle).includes("sk-live-abcdefghijklmnop"), "a backup never carries a secret-shaped value");
  const clean = createMemoryRuntime(); const restored = await restoreBackup({ bundle, runtime: clean }); assert.ok(restored["command-center"] > 0);
  const compare = await compareRuntimes({ source: runtime, target: clean }); assert.equal(compare.checks.passed, compare.checks.total, compare.findings.join(";"));
  await assert.rejects(() => restoreBackup({ bundle, runtime: clean }), error => error instanceof RestoreError && error.code === "TARGET_NOT_EMPTY");
  const tampered = structuredClone(bundle); const section = Object.values(tampered.sections).find(entry => entry.records.length > 1); section.records.pop();
  const bad = verifyBackup(tampered); assert.ok(bad.findings.length >= 1); const fresh = createMemoryRuntime();
  await assert.rejects(() => restoreBackup({ bundle: tampered, runtime: fresh }), error => error.code === "BACKUP_INVALID"); assert.equal(fresh.size(), 0, "nothing was written from a tampered bundle");
  const relabelled = structuredClone(bundle); relabelled.format = "other"; assert.ok(verifyBackup(relabelled).findings.length >= 1);
});

test("BO-155 the secret scanner finds a planted secret, honours only exact allowlist entries, and the dependency scan rejects unpinned or non-registry packages", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hero-scan-"));
  try {
    fs.mkdirSync(path.join(directory, "tests")); fs.mkdirSync(path.join(directory, "config/audit"), { recursive: true });
    fs.writeFileSync(path.join(directory, "src.mjs"), `const key = "${"sk-live-" + "a1B2c3D4e5F6g7H8i9J0k1L2"}";\n`); fs.writeFileSync(path.join(directory, "tests/neg.test.mjs"), `const fake = "sk-live-this-must-never-be-accepted-123";\n`);
    fs.writeFileSync(path.join(directory, "tests/real.test.mjs"), `const real = "${"sk-test-" + "Zx9Yw8Vu7Ts6Rq5Po4Nm3Lk2"}";\n`); fs.writeFileSync(path.join(directory, ".env"), "A=b\n");
    const recorder = createRecorder("t"); const found = scanSecrets({ root: directory, files: ["src.mjs", "tests/neg.test.mjs", "tests/real.test.mjs", ".env"], recorder, allowlist: [] });
    assert.deepEqual(found.findings.map(item => item.file).sort(), ["src.mjs", "tests/real.test.mjs"], "a real-looking key is found even in a test and even with a test- prefix; an explicit negative test string is not");
    assert.equal(found.synthetic, 1); assert.ok(recorder.finish().findings.some(item => item.includes(".env")), "a tracked .env is reported");
    const allowed = scanSecrets({ root: directory, files: ["src.mjs"], recorder: createRecorder("t"), allowlist: [{ file: "src.mjs", label: "API key (sk- style)", valueSha256: sha256("sk-live-other-value") }] }); assert.equal(allowed.findings.length, 1, "an allowlist entry never covers a different value");
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: "x", dependencies: { good: "1.2.3", loose: "^1.0.0", gitdep: "github:evil/repo", local: "file:../x" } })); fs.writeFileSync(path.join(directory, "pnpm-lock.yaml"), "packages:\n\n  good@1.2.3:\n    resolution: {integrity: sha512-AAAA}\n\n  bad@1.0.0:\n    resolution: {tarball: https://evil.example/bad.tgz}\n\nsnapshots:\n\n  good@1.2.3: {}\n");
    const dependencyRecorder = createRecorder("d"); scanDependencies({ root: directory, recorder: dependencyRecorder }); const findings = dependencyRecorder.finish().findings.join(" | ");
    for (const needle of ["none from a path, git or URL", "pinned to an exact version", "integrity hash", "raw tarball"]) assert.ok(findings.includes(needle), needle);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  const real = createRecorder("r"); scanSecrets({ root, recorder: real }); scanDependencies({ root, recorder: real }); const verdict = real.finish(); assert.equal(verdict.checks.passed, verdict.checks.total, verdict.findings.join(" | "));
});

test("BO-151 lists are paged under one query budget and trace bodies load lazily", async t => {
  const fixture = await createAuditFixture({ now }); t.after(() => fixture.stop()); const { call, page } = fixture; const root_ = "/api/projects/project-alpha";
  for (let index = 0; index < 130; index += 1) await call("admin", "POST", `${root_}/notifications`, { category: "health", severity: "warning", title: `Bulk ${index}`, deduplicationKey: `bulk-${index}`, correlationId: `corr-bulk-${index}` });
  const first = (await call("viewer", "GET", `${root_}/notifications?view=all`)).body; assert.equal(first.notifications.length, 100); assert.equal(first.total, 130); assert.equal(first.nextCursor, 100);
  const second = (await call("viewer", "GET", `${root_}/notifications?view=all&cursor=100`)).body; assert.equal(second.notifications.length, 30); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.notifications, ...second.notifications].map(item => item.notificationId)).size, 130, "pages do not overlap");
  for (const bad of ["limit=101", "limit=0", "limit=abc", "cursor=-1"]) assert.equal((await call("viewer", "GET", `${root_}/notifications?${bad}`)).status, 400, bad);
  assert.equal((await call("viewer", "GET", `${root_}/notifications?limit=5`)).body.notifications.length, 5); assert.equal((await call("viewer", "GET", `${root_}/incidents?limit=1`)).status, 200);
  const inbox = await page("viewer", "inbox"); assert.match(inbox.html, /data-truncated="true"/); assert.match(inbox.html, /data-truncated-note/); assert.equal((inbox.html.match(/data-notification="/g) ?? []).length <= 5 * 100, true);
  await call("admin", "POST", `${root_}/commands`, { commandId: "cmd-lazy-1", action: "deploy.test", risk: "medium", correlationId: "corr-lazy", idempotencyKey: "idem-lazy" }); await call("admin", "POST", `${root_}/commands/cmd-lazy-1/authorize`, { authorizationSnapshotId: "BATCH-BACKOFFICE-20261007-026" });
  const lazy = (await call("viewer", "GET", `${root_}/correlations/corr-lazy`)).body.correlation; assert.ok(lazy.traceCount >= 2); assert.equal(lazy.traces.length, 0); assert.equal(lazy.tracesLoaded, false);
  const full = (await call("viewer", "GET", `${root_}/correlations/corr-lazy?include=traces&limit=1`)).body.correlation; assert.equal(full.traces.length, 1); assert.equal(full.nextTraceCursor, 1);
  assert.equal((await call("viewer", "GET", `${root_}/correlations/corr-lazy?include=traces&limit=1000`)).status, 400);
});
