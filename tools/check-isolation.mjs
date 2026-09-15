import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { REPO_ROOT, isInsideRoot, relativeName, walk } from "./fs-policy.mjs";

const textExtensions = new Set([
  "", ".json", ".md", ".mjs", ".yaml", ".yml", ".example", ".txt"
]);

function addError(errors, code, detail) {
  errors.push({ code, detail });
}

function inspectPackage(file, errors) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const dependencyGroups = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

  for (const group of dependencyGroups) {
    for (const [name, value] of Object.entries(json[group] ?? {})) {
      if (typeof value !== "string") continue;
      if (/^(file:|link:)/i.test(value) || path.isAbsolute(value)) {
        addError(errors, "LOCAL_DEPENDENCY", relativeName(file) + ": " + name + "=" + value);
      }
    }
  }
}

function inspectText(file, errors) {
  const name = relativeName(file);
  const extension = path.extname(file);
  const specialTextFiles = ["Dockerfile", ".gitignore", ".gitattributes", ".editorconfig"];
  if (!textExtensions.has(extension) && !specialTextFiles.includes(path.basename(file))) return;

  const content = fs.readFileSync(file, "utf8");
  const importPattern = /(?:from\s+|import\s*\()\s*["']([^"']+)["']/g;
  let match;

  while ((match = importPattern.exec(content)) !== null) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const resolved = path.resolve(path.dirname(file), specifier);
    if (!isInsideRoot(resolved)) addError(errors, "IMPORT_OUTSIDE_ROOT", name + ": " + specifier);
  }

  const allowsContainerPaths = name === "Dockerfile" || name === "compose.yaml";
  if (!allowsContainerPaths) {
    const hostPathPatterns = [
      /\b[A-Za-z]:[\\/][^\s"']+/,
      /\/(?:home|Users|mnt)\/[^\s"']+/
    ];
    if (hostPathPatterns.some(pattern => pattern.test(content))) {
      addError(errors, "HOST_ABSOLUTE_PATH", name);
    }
  }
}

function inspectEnvironment(errors) {
  const rootEnvFile = path.join(REPO_ROOT, ".env.example");
  if (!fs.existsSync(rootEnvFile)) {
    addError(errors, "MISSING_ENV_EXAMPLE", ".env.example");
    return;
  }

  const { files } = walk();
  const examples = files.filter(file => relativeName(file).endsWith(".env.example"));
  const sensitiveKey = /(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|CREDENTIAL)/i;
  // These two names contain SECRET for clarity but are non-sensitive switches
  // and paths. The master key itself remains sensitive and must stay empty.
  const safeSecretStoreExampleKeys = new Set(["HERO_SECRET_STORE_ENABLED", "HERO_SECRET_STORE_DIR"]);

  for (const envFile of examples) {
    const name = relativeName(envFile);
    for (const [index, line] of fs.readFileSync(envFile, "utf8").split(/\r?\n/).entries()) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      const key = (separator === -1 ? trimmed : trimmed.slice(0, separator)).trim();
      const value = separator === -1 ? "" : trimmed.slice(separator + 1).trim();
      if (!key.startsWith("HERO_")) addError(errors, "UNSCOPED_ENV_KEY", name + ":" + (index + 1) + ":" + key);
      if (sensitiveKey.test(key) && !safeSecretStoreExampleKeys.has(key) && value !== "") {
        addError(errors, "SECRET_VALUE_IN_ENV_EXAMPLE", name + ":" + (index + 1) + ":" + key);
      }
    }
  }
}

function inspectGit(errors) {
  if (fs.existsSync(path.join(REPO_ROOT, ".gitmodules"))) {
    addError(errors, "GIT_SUBMODULE", ".gitmodules is forbidden");
  }

  const sourceSnapshot = process.env.HERO_SOURCE_SNAPSHOT === "1";
  const hasGitMetadata = fs.existsSync(path.join(REPO_ROOT, ".git"));
  // A source snapshot is intentionally built without .git and without a Git
  // binary. Do not let a host-mounted .git directory change that contract.
  if (sourceSnapshot) return;
  if (!hasGitMetadata) {
    addError(errors, "MISSING_GIT_BOUNDARY", ".git metadata is missing");
    return;
  }

  const topLevel = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  if (topLevel.status !== 0 || path.resolve(topLevel.stdout.trim()) !== REPO_ROOT) {
    addError(errors, "GIT_ROOT_MISMATCH", String(topLevel.stderr ?? topLevel.stdout ?? "").trim());
  }

  const trackedFiles = spawnSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  if (trackedFiles.status === 0) {
    const runtimeEnvFile = /(?:^|\/)(?:\.env(?:\.[^/]+)?|[^/]+\.env)$/;
    for (const name of trackedFiles.stdout.split("\0").filter(Boolean)) {
      if (runtimeEnvFile.test(name) && !name.endsWith(".env.example")) {
        addError(errors, "TRACKED_RUNTIME_ENV_FILE", name);
      }
    }
  }

  const remotes = spawnSync("git", ["remote", "-v"], { cwd: REPO_ROOT, encoding: "utf8" });
  if (remotes.status === 0) {
    for (const line of remotes.stdout.split(/\r?\n/).filter(Boolean)) {
      const url = line.split(/\s+/)[1] ?? "";
      if (/^(file:|[A-Za-z]:[\\/]|\.\.?[\\/])/i.test(url)) {
        addError(errors, "LOCAL_GIT_REMOTE", url);
      }
    }
  }
}

export function runIsolationChecks() {
  const errors = [];
  const { files, links } = walk();

  for (const link of links) addError(errors, "SYMLINK_OR_JUNCTION", link);
  for (const file of files) {
    if (path.basename(file) === "package.json") inspectPackage(file, errors);
    inspectText(file, errors);
  }
  inspectEnvironment(errors);
  inspectGit(errors);

  return {
    root: REPO_ROOT,
    filesScanned: files.length,
    errors
  };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === invokedFile) {
  const report = runIsolationChecks();
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length > 0) process.exitCode = 1;
}
