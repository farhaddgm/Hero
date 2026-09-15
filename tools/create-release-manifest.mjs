import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createReleaseManifest } from "../packages/contracts/src/release-manifest.mjs";

function parseArgs(argv) {
  const result = { output: "hero-release-manifest.json" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--version") result.releaseVersion = argv[++index];
    else if (arg === "--commit") result.commitSha = argv[++index];
    else if (arg === "--artifact") result.artifact = argv[++index];
    else if (arg === "--release-url") result.releaseUrl = argv[++index];
    else if (arg === "--workflow-run-id") result.workflowRunId = argv[++index];
    else if (arg === "--environment") result.environment = argv[++index];
    else if (arg === "--created-at") result.createdAt = argv[++index];
    else if (arg === "--output") result.output = argv[++index];
    else if (arg === "--help") result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

export function writeReleaseManifest(options) {
  const manifest = createReleaseManifest(options);
  const root = options.repositoryRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const output = path.resolve(root, options.output ?? "hero-release-manifest.json");
  const relative = path.relative(root, output);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Manifest output must stay inside the repository root.");
  const parent = path.dirname(output);
  if (!fs.existsSync(parent)) throw new Error("Manifest output directory is missing.");
  for (let cursor = parent; cursor !== path.parse(cursor).root; cursor = path.dirname(cursor)) {
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error("Manifest output path contains a symlink.");
  }
  if (fs.existsSync(output) || fs.lstatSync(output, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("Manifest output already exists; remove the stale file before retrying.");
  const temporary = `${output}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const handle = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(handle, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    fs.fsyncSync(handle);
  } catch (error) {
    try { fs.closeSync(handle); } catch {}
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
  fs.closeSync(handle);
  fs.renameSync(temporary, output);
  try { fs.chmodSync(output, 0o600); } catch {}
  return { manifest, output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help || !options.releaseVersion || !options.commitSha || !options.artifact) {
      console.log("Usage: node tools/create-release-manifest.mjs --version X.Y.Z --commit SHA --artifact ghcr.io/farhaddgm/hero@sha256:... [--release-url URL] [--output FILE]");
      process.exit(options.help ? 0 : 2);
    }
    const result = writeReleaseManifest(options);
    console.log(`RELEASE MANIFEST: PASS — ${result.output}`);
  } catch (error) {
    console.error(`RELEASE MANIFEST: ERROR — ${error.message}`);
    process.exitCode = 1;
  }
}
