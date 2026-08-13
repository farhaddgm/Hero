import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { REPO_ROOT, relativeName, walk } from "./fs-policy.mjs";

const { files } = walk();
const modules = files.filter(file => path.extname(file) === ".mjs");
const jsonFiles = files.filter(file => path.extname(file) === ".json");
const failures = [];

for (const file of modules) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  if (result.status !== 0) failures.push(relativeName(file) + ": " + result.stderr.trim());
}

for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    failures.push(relativeName(file) + ": " + error.message);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "BUILD PASS — " + modules.length + " modules and " + jsonFiles.length + " JSON files validated"
  );
}
