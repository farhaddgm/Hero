import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { RELEASE_COMMIT_PATTERN, RELEASE_VERSION_PATTERN } from "../packages/contracts/src/release.mjs";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: result.status === 0, stdout: result.stdout?.trim() ?? "", stderr: result.stderr?.trim() ?? "" };
}

function findConflictMarkers(root) {
  const listed = git(["ls-files", "-z"], root);
  if (!listed.ok) return { files: [], error: listed.stderr || "git ls-files failed" };
  const files = listed.stdout.split("\0").filter(Boolean);
  const markers = [];
  for (const relative of files) {
    const absolute = path.join(root, relative);
    let source;
    try { source = fs.readFileSync(absolute, "utf8"); } catch { markers.push(relative); continue; }
    if (/^(<<<<<<<|=======|>>>>>>>)(?: .*)?$/m.test(source)) markers.push(relative);
  }
  return { files: markers, error: null };
}

export function runReleasePreflight({
  version,
  commit = null,
  branch = null,
  environment = "test",
  repositoryRoot = DEFAULT_ROOT,
  checkClean = true,
  checkTagFree = true,
  checkRemote = true
} = {}) {
  const errors = [];
  const warnings = [];
  const facts = {};
  if (!RELEASE_VERSION_PATTERN.test(version ?? "")) errors.push("release version must be a valid SemVer");
  if (environment !== "test") errors.push("release preflight only permits environment=test");
  if (commit && !RELEASE_COMMIT_PATTERN.test(commit)) errors.push("expected commit must be a valid Git SHA");

  const head = git(["rev-parse", "HEAD"], repositoryRoot);
  if (!head.ok || !RELEASE_COMMIT_PATTERN.test(head.stdout)) errors.push("unable to resolve a valid HEAD commit");
  else facts.head = head.stdout;
  if (commit && commit !== facts.head) errors.push(`HEAD ${facts.head || "unknown"} does not match expected commit ${commit}`);

  if (checkClean) {
    const status = git(["status", "--porcelain", "--untracked-files=all"], repositoryRoot);
    if (!status.ok) errors.push("unable to inspect Git worktree");
    else if (status.stdout) errors.push("Git worktree is not clean; commit or remove all changes before release");
  }

  const conflicts = findConflictMarkers(repositoryRoot);
  if (conflicts.error) errors.push(conflicts.error);
  else if (conflicts.files.length > 0) errors.push(`conflict markers remain in: ${conflicts.files.slice(0, 8).join(", ")}${conflicts.files.length > 8 ? "…" : ""}`);

  if (branch) {
    const current = git(["branch", "--show-current"], repositoryRoot);
    if (current.ok && current.stdout && current.stdout !== branch) errors.push(`current branch ${current.stdout} does not match ${branch}`);
    if (checkRemote) {
      const remote = git(["rev-parse", `origin/${branch}`], repositoryRoot);
      if (!remote.ok) errors.push(`origin/${branch} is not available; fetch before release`);
      else if (facts.head && remote.stdout !== facts.head) errors.push(`HEAD ${facts.head} is not equal to origin/${branch} ${remote.stdout}`);
    }
  }

  if (checkTagFree && version) {
    const tag = git(["rev-parse", "--verify", "--quiet", `refs/tags/v${version}`], repositoryRoot);
    if (tag.ok) errors.push(`tag v${version} already exists; choose a new version`);
  }
  if (errors.length === 0) warnings.push("Release is Test-only; Production, secrets and external spend are outside this preflight.");
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), warnings: Object.freeze(warnings), facts: Object.freeze(facts) });
}

function parseArgs(argv) {
  const result = { environment: "test", checkClean: true, checkTagFree: true, checkRemote: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--version") result.version = argv[++index];
    else if (arg === "--commit") result.commit = argv[++index];
    else if (arg === "--branch") result.branch = argv[++index];
    else if (arg === "--environment") result.environment = argv[++index];
    else if (arg === "--root") result.repositoryRoot = path.resolve(argv[++index]);
    else if (arg === "--allow-dirty") result.checkClean = false;
    else if (arg === "--allow-existing-tag") result.checkTagFree = false;
    else if (arg === "--skip-remote") result.checkRemote = false;
    else if (arg === "--help") result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help || !options.version) {
      console.log("Usage: node tools/release-preflight.mjs --version X.Y.Z [--commit SHA] [--branch BRANCH] [--environment test]");
      process.exit(options.help ? 0 : 2);
    }
    const result = runReleasePreflight(options);
    if (!result.ok) {
      console.error("RELEASE PREFLIGHT: BLOCKED");
      for (const error of result.errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(`RELEASE PREFLIGHT: PASS — ${options.version} / ${result.facts.head}`);
      for (const warning of result.warnings) console.log(`- ${warning}`);
    }
  } catch (error) {
    console.error(`RELEASE PREFLIGHT: ERROR — ${error.message}`);
    process.exitCode = 2;
  }
}
