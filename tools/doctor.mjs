import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { runIsolationChecks } from "./check-isolation.mjs";
import { REPO_ROOT } from "./fs-policy.mjs";

const checks = [];
const warnings = [];

function check(name, passed, detail) {
  checks.push({ name, passed, detail });
}

const requiredFiles = [
  ".env.example",
  "AGENTS.md",
  "Dockerfile",
  "compose.yaml",
  "package.json",
  "pnpm-workspace.yaml"
];
for (const file of requiredFiles) {
  check("required:" + file, fs.existsSync(path.join(REPO_ROOT, file)), file);
}

const major = Number(process.versions.node.split(".")[0]);
check("node", major >= 22 && major < 25, "Node " + process.versions.node);

const isolation = runIsolationChecks();
check(
  "clean-room",
  isolation.errors.length === 0,
  isolation.errors.length === 0
    ? isolation.filesScanned + " files scanned"
    : JSON.stringify(isolation.errors)
);

const docker = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  timeout: 5000
});
if (docker.status === 0) {
  check("docker", true, "Docker " + docker.stdout.trim());
} else {
  warnings.push("Docker در این محیط در دسترس نیست؛ تست کانتینر فعلاً اجرا نمی‌شود.");
}

for (const item of checks) {
  console.log((item.passed ? "PASS" : "FAIL") + " " + item.name + " — " + item.detail);
}
for (const warning of warnings) console.log("WARN " + warning);

const failed = checks.filter(item => !item.passed);
console.log(
  "RESULT " + (failed.length === 0 ? "PASS" : "FAIL") +
  " — " + checks.length + " checks, " + warnings.length + " warning(s)"
);
if (failed.length > 0) process.exitCode = 1;
