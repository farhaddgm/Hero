// BO-155: offline secret scan, offline dependency scan and a runtime audit-coverage
// report. The dependency scan reads the lockfile only; it does NOT consult any
// advisory database (that needs a registry call and is reported as not run).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRecorder, sha256 } from "../acceptance/audit-lib.mjs";

const SECRET_PATTERNS = Object.freeze([
  ["private key block", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ["API key (sk- style)", /\bsk-(?:live-|test-|proj-|ant-)?[A-Za-z0-9_-]{24,}\b/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{20,}\b/],
  ["bearer credential literal", /\bBearer\s+[A-Za-z0-9._-]{32,}\b/],
  ["password literal in a URL", /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:(?!\$\{|<|%|\{|PASSWORD|password|changeme|example)[^\s@/]{8,}@[^\s/]+/i]
]);
const SKIP_DIRECTORIES = new Set(["node_modules", ".git", "dist", "release-download-1.1.5-rc.13", "release-download-1.1.5-rc.14", "release-download-1.1.5-rc.16"]);
// Only phrases that announce a negative test count; a bare "test" or "fake" prefix does not, since real test keys look like that too.
const SYNTHETIC_MARKER = /(?:must[-_]never|should[-_](?:not|never)|never[-_](?:be|persist|logged)|not[-_]accepted)/i;
const BINARY = /\.(png|jpg|jpeg|gif|ico|woff2?|ttf|zip|gz|pdf)$/i;

export function listTrackedFiles(root) {
  try { return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean); }
  catch { const out = []; const walk = directory => { for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) { if (SKIP_DIRECTORIES.has(entry.name)) continue; const relative = path.join(directory, entry.name); if (entry.isDirectory()) walk(relative); else out.push(relative); } }; walk("."); return out.map(file => file.replace(/^\.\//, "")); }
}

function loadAllowlist(root) { try { return JSON.parse(fs.readFileSync(path.join(root, "config/audit/secret-scan-allowlist.json"), "utf8")).entries ?? []; } catch { return []; } }

export function scanSecrets({ root, files = listTrackedFiles(root), recorder, allowlist = loadAllowlist(root) }) {
  const findings = []; const synthetic = []; let scanned = 0;
  for (const file of files) {
    if (BINARY.test(file) || file.split("/").some(part => SKIP_DIRECTORIES.has(part))) continue;
    let content; try { const absolute = path.join(root, file); if (fs.statSync(absolute).size > 2_000_000) continue; content = fs.readFileSync(absolute, "utf8"); } catch { continue; }
    scanned += 1;
    for (const [label, pattern] of SECRET_PATTERNS) {
      const match = content.match(pattern); if (!match) continue;
      // A deliberately fake value in a test that proves it is rejected is not a secret; the wording must say so.
      if (/^(?:tests|tools\/(?:acceptance|audit))\//.test(file) && SYNTHETIC_MARKER.test(match[0])) { synthetic.push({ file, label }); continue; }
      if (allowlist.some(entry => entry.file === file && entry.label === label && entry.valueSha256 === sha256(match[0]))) { synthetic.push({ file, label }); continue; }
      findings.push({ file, label });
    }
  }
  recorder.check(`secret scan: ${scanned} tracked files contain no secret-shaped value`, findings.length === 0, findings.slice(0, 5).map(item => `${item.file} (${item.label})`).join("; "));
  const envFiles = files.filter(file => /(^|\/)\.env(\.|$)/.test(file) && !/\.example$|\.sample$/.test(file));
  recorder.check("secret scan: no real .env file is tracked", envFiles.length === 0, envFiles.join(","));
  const keyFiles = files.filter(file => /\.(pem|key|p12|pfx)$/i.test(file)); recorder.check("secret scan: no key or certificate file is tracked", keyFiles.length === 0, keyFiles.join(","));
  return { scanned, findings, synthetic: synthetic.length };
}

/** Offline lockfile checks: every package comes from the registry with an integrity hash; nothing is linked, vendored or fetched from git. */
export function scanDependencies({ root, recorder }) {
  const manifests = ["package.json", ...["apps", "packages"].flatMap(group => fs.existsSync(path.join(root, group)) ? fs.readdirSync(path.join(root, group)).map(name => `${group}/${name}/package.json`) : [])].filter(file => fs.existsSync(path.join(root, file)));
  const root_ = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")); const lockPath = path.join(root, "pnpm-lock.yaml");
  recorder.check("dependency scan: a lockfile exists", fs.existsSync(lockPath));
  const lock = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, "utf8") : "";
  const direct = {}; for (const file of manifests) { const manifest = JSON.parse(fs.readFileSync(path.join(root, file), "utf8")); for (const [name, spec] of Object.entries({ ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}), ...(manifest.optionalDependencies ?? {}) })) direct[`${file}:${name}`] = spec; }
  const forbidden = Object.entries(direct).filter(([, spec]) => /^(?:file:|link:|workspace:|git\+|git:|github:|https?:|\.{1,2}\/|\/)/.test(String(spec)));
  recorder.check(`dependency scan: ${Object.keys(direct).length} direct dependencies across ${manifests.length} manifests, none from a path, git or URL`, forbidden.length === 0, forbidden.map(([name, spec]) => `${name}@${spec}`).join(","));
  const unpinned = Object.entries(direct).filter(([, spec]) => !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(String(spec)));
  recorder.check("dependency scan: every direct dependency is pinned to an exact version", unpinned.length === 0, unpinned.map(([name, spec]) => `${name}@${spec}`).join(","));
  const packagesStart = lock.search(/(^|\n)packages:/); const snapshotsStart = lock.search(/\nsnapshots:/); const packagesSection = packagesStart >= 0 ? lock.slice(packagesStart, snapshotsStart > packagesStart ? snapshotsStart : undefined) : "";
  const entries = [...packagesSection.matchAll(/^ {2}(?:'[^']+'|"[^"]+"|[^\s:]+):\s*\n((?: {4}.*\n?)+)/gm)];
  const withIntegrity = entries.filter(entry => /integrity: sha(?:512|384|256)-/.test(entry[1])).length;
  recorder.check(`dependency scan: every locked package (${entries.length}) has an integrity hash`, entries.length > 0 && withIntegrity === entries.length, `${withIntegrity}/${entries.length}`);
  const rawSources = entries.filter(entry => /tarball:|type: git|repo:|commit:/.test(entry[1])).length;
  recorder.check("dependency scan: no locked package is fetched from a git repository or a raw tarball URL", rawSources === 0, rawSources);
  const scripts = Object.keys(root_.scripts ?? {}).filter(name => /^(?:pre|post)?install$/.test(name)); recorder.check("dependency scan: the root package defines no install-time script", scripts.length === 0, scripts.join(","));
  const pnpmWorkspace = fs.existsSync(path.join(root, "pnpm-workspace.yaml")) ? fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8") : "";
  recorder.check("dependency scan: dependency build scripts are not blanket-approved", !/dangerouslyAllowAllBuilds\s*:\s*true/.test(pnpmWorkspace));
  return { direct: Object.keys(direct).length, packages: entries.length, integrity: withIntegrity };
}

export const NOT_RUN = Object.freeze(["online advisory lookup (npm/GitHub advisory database) — needs a registry call; run `pnpm audit` where network access is authorized", "licence classification"]);

/**
 * Audit coverage: exercise state-changing project routes and prove each one left
 * an audit record, and that refusals left a security record.
 */
export async function auditCoverage(fixture, recorder) {
  const { call } = fixture; const root = "/api/projects/project-alpha";
  const count = async stream => (await call("owner", "GET", `${root}/audit-log?limit=200&stream=${stream}`)).body?.total ?? 0;
  const probes = [
    ["activity", "owner", "POST", `${root}/notifications`, { category: "health", severity: "info", title: "coverage", deduplicationKey: "coverage-note", correlationId: "corr-coverage" }],
    ["activity", "admin", "POST", `${root}/usage`, { usageId: "usage-coverage", invocationId: "invoke-coverage", provider: "openai", model: "sol", inputTokens: 5 }],
    ["activity", "admin", "POST", `${root}/catalog`, { entityId: "coverage-entity", type: "service", name: "Coverage", lifecycle: "active", metadata: { owner: "hero-owner" } }],
    ["activity", "admin", "POST", `${root}/slo`, { projection: "ledger", lagSeconds: 1, freshnessSeconds: 60 }],
    ["security", "admin", "POST", `${root}/hardening`, { action: "set-retention", retention: { auditDays: 400 } }],
    ["security", "admin", "POST", `${root}/hardening`, { action: "place-hold", targetId: "audit-coverage", reason: "coverage" }],
    ["security", "owner", "POST", `${root}/hardening`, { action: "release-hold", targetId: "audit-coverage", reason: "coverage done" }],
    ["security", "owner", "POST", `${root}/retention`, { stream: "activity", days: 60, reason: "coverage policy" }],
    ["security", "owner", "POST", `${root}/budget`, { softThreshold: 1500, hardCap: 2500, reason: "coverage budget" }],
    ["security", "owner", "POST", `${root}/final-readiness`, { action: "plan-migration", migrationId: "migration-coverage", oldRoute: "/old-coverage", newRoute: "/new-coverage", compatibilityUntil: new Date(Date.now() + 86_400_000).toISOString() }],
    ["security", "admin", "POST", `${root}/infrastructure`, { action: "register-repository", repositoryId: "repo-coverage", name: "Coverage repo" }],
    ["security", "admin", "POST", `${root}/delivery`, { action: "create-release", releaseId: "release-coverage", testedCommit: "abc1234" }]
  ];
  let covered = 0; const uncovered = [];
  for (const [stream, who, method, route, body] of probes) {
    const before = await count(stream); const response = await call(who, method, route, body); const after = await count(stream);
    const ok = response.status < 400 && after > before; if (ok) covered += 1; else uncovered.push(`${method} ${route.replace(root, "")} ${body.action ?? ""} (${response.status}, ${stream} ${before}->${after})`);
  }
  recorder.check(`audit coverage: ${covered}/${probes.length} state-changing routes left an audit record in the right stream`, covered === probes.length, uncovered.join("; "));
  const deniedBefore = await count("security"); await call("viewer", "POST", `${root}/notifications`, { category: "health", severity: "info", title: "denied", deduplicationKey: "denied-note", correlationId: "corr-denied" });
  recorder.check("audit coverage: a refused write by a signed-in user is recorded as a denial in the security stream", await count("security") === deniedBefore + 1);
  for (let index = 0; index < 40; index += 1) await call("viewer", "POST", `${root}/notifications`, { category: "health", severity: "info", title: `flood ${index}`, deduplicationKey: `flood-${index}`, correlationId: "corr-flood" });
  recorder.check("audit coverage: a flood of refusals cannot flood the audit (rate-limited per principal and project)", await count("security") - deniedBefore <= 22, await count("security") - deniedBefore);
  const securityDump = JSON.stringify((await call("owner", "GET", `${root}/audit-log?limit=200&stream=security`)).body);
  recorder.check("audit coverage: audit records never contain the request body", !securityDump.includes("coverage policy") && !securityDump.includes("flood 3"));
  return { covered, total: probes.length, uncovered };
}
