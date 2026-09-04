import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = Object.freeze({
  pending: path.join(root, "docs", "operations", "OWNER-ACTIONS-PENDING-20260904.md"),
  simple: path.join(root, "docs", "operations", "OWNER-ACTIONS-SIMPLE.md"),
  candidate: path.join(root, "docs", "roadmap", "CANDIDATE-EVIDENCE-20260904.md"),
  open50: path.join(root, "docs", "roadmap", "OPEN-50-PRIORITY-20260904.md")
});

const requiredPendingTerms = Object.freeze([
  "test.hero.beeproject.ir",
  "hero-test",
  "HERO_OWNER_AUTH_SECRET",
  "HERO_ADMIN_AUTH_SECRET",
  "HERO_BACKOFFICE_USER",
  "HERO_BACKOFFICE_PASSWORD",
  "HERO_BACKOFFICE_PASSWORD_HASH",
  "HERO_POSTGRES_URL",
  "HERO_POSTGRES_PASSWORD",
  "production-deploy",
  "compose.test.yaml",
  "rollback",
  "recovery",
  "Pilot"
]);

function read(name, file) {
  if (!fs.existsSync(file)) throw new Error(`${name} is missing: ${path.relative(root, file)}`);
  return fs.readFileSync(file, "utf8");
}

const pending = read("Owner pending actions", files.pending);
const simple = read("Simple owner runbook", files.simple);
const candidate = read("Candidate evidence", files.candidate);
const open50 = read("OPEN-50 ledger", files.open50);
const errors = [];

for (const term of requiredPendingTerms) {
  if (!pending.includes(term)) errors.push(`Owner pending actions must mention ${term}.`);
}
if (!/Test واقعی سالم است|محیط مستقل Test/.test(simple)) errors.push("Simple owner runbook must state the current Test status.");
if (!/artifact تمیز/.test(simple) || !/env\/Secret فعلی/.test(simple)) errors.push("Simple owner runbook must identify the exact artifact and preserve the current runtime Secret/env.");
if (!/candidate-[0-9a-f]{7,40}/.test(candidate) || !/sha256:[0-9a-f]{64}/.test(candidate)) errors.push("Candidate evidence must identify a versioned tag and SHA-256 digest.");
const candidateDeploymentIsBounded = /به Test یا Production deploy نشده|هنوز به Test deploy نشده/.test(candidate) || (/به Test(?: مستقل)? deploy شده/.test(candidate) && /به Production deploy نشده/.test(candidate));
if (!candidateDeploymentIsBounded) errors.push("Candidate evidence must state that deployment is either pending or limited to Test and not Production.");
if (!/OPEN-50=50|پنجاه گام/.test(open50)) errors.push("OPEN-50 ledger must identify the fifty-step audit.");

if (errors.length > 0) {
  console.error("Owner handoff audit: FAILED");
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("Owner handoff audit: PASS — sensitive prerequisites, artifact identity and pending gates are documented.");
}
