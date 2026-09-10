import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateProjectIdentityContract } from "../packages/contracts/src/project-identity.mjs";
import { REPO_ROOT, isInsideRoot } from "./fs-policy.mjs";

const PATHS = Object.freeze({
  authorization: "config/authorizations/backoffice-20260910-003.json",
  roadmap: "docs/roadmap/BACKOFFICE-COMMAND-CENTER-IMPLEMENTATION-v1.0.md",
  registry: "docs/registry/document-registry.json",
  adr: "docs/decisions/ADR-0012-human-identity-and-project-grants.md",
  evidence: "docs/roadmap/BACKOFFICE-IDENTITY-BO-021-030.md",
  contract: "packages/contracts/src/project-identity.mjs",
  access: "packages/domain/src/project-access.mjs",
  middleware: "packages/domain/src/project-access-middleware.mjs",
  identity: "packages/domain/src/human-identity.mjs",
  migration: "packages/adapters/migrations/010_project_identity_and_grants.sql",
  store: "packages/adapters/src/postgresql-project-identity-store.mjs",
  tests: "tests/project-identity.test.mjs"
});
const EXPECTED_STEPS = Object.freeze(Array.from({ length: 10 }, (_, index) => `BO-${String(index + 21).padStart(3, "0")}`));
const REQUIRED_EXCLUSIONS = Object.freeze(["production-deploy", "destructive-data-operation", "external-spend", "secret-change", "external-message", "irreversible-operation", "pilot-execution", "notion-write"]);

function absolute(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (!isInsideRoot(resolved, root)) throw new Error(`Path is outside repository root: ${relativePath}`);
  return resolved;
}
function readText(root, relativePath) { return fs.readFileSync(absolute(root, relativePath), "utf8"); }
function readJson(root, relativePath) { return JSON.parse(readText(root, relativePath)); }
function same(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
function add(errors, code, detail) { errors.push(Object.freeze({ code, detail })); }

export function validateBackofficeIdentity(options = {}) {
  const root = path.resolve(options.root ?? REPO_ROOT);
  const authorization = options.authorization ?? readJson(root, PATHS.authorization);
  const registry = options.registry ?? readJson(root, PATHS.registry);
  const errors = [];
  for (const [name, relativePath] of Object.entries(PATHS)) if (!["authorization", "registry"].includes(name) && !fs.existsSync(absolute(root, relativePath))) add(errors, "FILE_MISSING", relativePath);
  for (const error of validateProjectIdentityContract()) add(errors, "CONTRACT_INVALID", error);
  if (authorization.schema !== "hero.authorization-snapshot/v1" || authorization.authorizationId !== "BATCH-BACKOFFICE-20260910-003") add(errors, "AUTH_INVALID", String(authorization.authorizationId));
  if (authorization.status !== "active" || authorization.grantedBy !== "project-owner" || authorization.globalStop !== false) add(errors, "AUTH_NOT_DISPATCHABLE", "Owner grant must be active and Global Stop false.");
  const steps = (authorization.steps ?? []).map(step => step?.stepId);
  if (!same(steps, EXPECTED_STEPS)) add(errors, "AUTH_STEP_SCOPE_INVALID", steps.join(", "));
  for (const step of authorization.steps ?? []) if (step.documentVersion !== "1.0.0") add(errors, "AUTH_VERSION_INVALID", `${step.stepId}:${step.documentVersion}`);
  for (const exclusion of REQUIRED_EXCLUSIONS) if (!authorization.excludedOperations?.includes(exclusion) || authorization.operations?.includes(exclusion)) add(errors, "SENSITIVE_OPERATION_INVALID", exclusion);
  const docs = new Map((authorization.documents ?? []).map(item => [item.documentId, item.documentVersion]));
  for (const id of ["HERO-SPEC-022", "HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1"]) if (docs.get(id) !== "1.0.0") add(errors, "AUTH_DOCUMENT_INVALID", id);
  const roadmap = readText(root, PATHS.roadmap);
  for (const step of EXPECTED_STEPS) if (!roadmap.includes(`| \`${step}\` |`)) add(errors, "ROADMAP_STEP_MISSING", step);
  const migration = readText(root, PATHS.migration);
  for (const marker of ["human_users", "project_grant_versions", "human_session_revocations", "human_identity_audit", "mfa_secret_ref", "append_only_guard"]) if (!migration.includes(marker)) add(errors, "MIGRATION_MARKER_MISSING", marker);
  const identity = readText(root, PATHS.identity);
  for (const marker of ["beginLogin", "completeLogin", "completeOwnerRecovery", "assertSensitiveActionAllowed"]) if (!identity.includes(marker)) add(errors, "IDENTITY_MARKER_MISSING", marker);
  const documents = new Map((registry.documents ?? []).map(document => [document.id, document]));
  if (documents.get("HERO-ADR-0012")?.status !== "active") add(errors, "ADR_NOT_REGISTERED", "HERO-ADR-0012");
  if (documents.get("HERO-EVIDENCE-BACKOFFICE-IDENTITY-BO-021-030")?.status !== "active") add(errors, "EVIDENCE_NOT_REGISTERED", "HERO-EVIDENCE-BACKOFFICE-IDENTITY-BO-021-030");
  return Object.freeze({ ok: errors.length === 0, authorizationId: authorization.authorizationId ?? null, stepCount: steps.length, errors: Object.freeze(errors) });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const result = validateBackofficeIdentity();
  if (result.ok) console.log(`Back Office identity: PASS — ${result.stepCount} steps, ${result.authorizationId}, Global Stop off`);
  else {
    result.errors.forEach(error => console.error(`FAIL ${error.code} — ${error.detail}`));
    process.exitCode = 1;
  }
}
