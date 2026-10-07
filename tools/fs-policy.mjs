import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ignoredDirectories = new Set([
  ".git",
  ".pnpm-store",
  ".hero-ui",
  "playwright-report",
  "test-results",
  "coverage",
  "dist",
  "node_modules",
  "var"
]);

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function isInsideRoot(candidate, root = REPO_ROOT) {
  const relative = path.relative(root, path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function walk(root = REPO_ROOT) {
  const files = [];
  const links = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignoredDirectories.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      const stat = fs.lstatSync(absolute);

      if (stat.isSymbolicLink()) {
        links.push(path.relative(root, absolute));
        continue;
      }

      if (stat.isDirectory()) stack.push(absolute);
      else if (stat.isFile()) files.push(absolute);
    }
  }

  return { files, links };
}

export function relativeName(file, root = REPO_ROOT) {
  return path.relative(root, file).split(path.sep).join("/");
}
