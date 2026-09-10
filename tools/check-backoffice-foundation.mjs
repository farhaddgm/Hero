import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateBackofficeFoundationContract } from "../packages/contracts/src/backoffice-foundation.mjs";
import { REPO_ROOT, isInsideRoot } from "./fs-policy.mjs";

const PATHS = Object.freeze({
  authorization: "config/authorizations/backoffice-20260910-002.json",
  specification: "docs/specs/HERO-022-v1.0.md",
  roadmap: "docs/roadmap/BACKOFFICE-COMMAND-CENTER-IMPLEMENTATION-v1.0.md",
  adr: "docs/decisions/ADR-0011-backoffice-control-execution-data-planes.md",
  evidence: "docs/roadmap/BACKOFFICE-FOUNDATION-BO-011-020.md",
  registry: "docs/registry/document-registry.json",
  contract: "packages/contracts/src/backoffice-foundation.mjs",
  envelope: "packages/domain/src/backoffice-event-envelope.mjs",
  readModels: "packages/domain/src/backoffice-read-models.mjs",
  migration: "packages/adapters/migrations/009_backoffice_data_foundation.sql",
  adapter: "packages/adapters/src/postgresql-backoffice-foundation-store.mjs"
});

const EXPECTED_STEPS = Object.freeze(Array.from({ length: 10 }, (_, index) => `BO-${String(index + 11).padStart(3, "0")}`));
const REQUIRED_EXCLUSIONS = Object.freeze([
  "production-deploy",
  "destructive-data-operation",
  "external-spend",
  "secret-change",
  "external-message",
  "irreversible-operation",
  "pilot-execution",
  "notion-write"
]);
const ALLOWED_OPERATIONS = Object.freeze(["design", "document", "version", "develop", "test", "review"]);

function absolute(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (!isInsideRoot(resolved, root)) throw new Error(`Path is outside repository root: ${relativePath}`);
  return resolved;
}

function readText(root, relativePath) {
  return fs.readFileSync(absolute(root, relativePath), "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function add(errors, code, detail) {
  errors.push(Object.freeze({ code, detail }));
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validateBackofficeFoundation(options = {}) {
  const root = path.resolve(options.root ?? REPO_ROOT);
  const authorization = options.authorization ?? readJson(root, PATHS.authorization);
  const registry = options.registry ?? readJson(root, PATHS.registry);
  const errors = [];

  for (const [name, relativePath] of Object.entries(PATHS)) {
    if (name === "authorization" || name === "registry") continue;
    if (!fs.existsSync(absolute(root, relativePath))) add(errors, "FOUNDATION_FILE_MISSING", relativePath);
  }
  for (const error of validateBackofficeFoundationContract()) add(errors, "CONTRACT_INVALID", error);

  if (authorization.schema !== "hero.authorization-snapshot/v1") add(errors, "AUTH_SCHEMA_INVALID", String(authorization.schema));
  if (authorization.authorizationId !== "BATCH-BACKOFFICE-20260910-002") add(errors, "AUTH_ID_INVALID", String(authorization.authorizationId));
  if (authorization.status !== "active" || authorization.grantedBy !== "project-owner") add(errors, "AUTH_NOT_ACTIVE", "Batch 2 foundation authorization must be owner-granted and active.");
  if (authorization.globalStop !== false) add(errors, "GLOBAL_STOP_ACTIVE", "Global Stop must be explicitly false before dispatch.");
  const steps = (authorization.steps ?? []).map(step => step?.stepId);
  if (!sameValues(steps, EXPECTED_STEPS)) add(errors, "AUTH_STEP_SCOPE_INVALID", steps.join(", "));
  for (const step of authorization.steps ?? []) if (step.documentVersion !== "1.0.0") add(errors, "AUTH_DOCUMENT_VERSION_INVALID", `${step.stepId}:${step.documentVersion}`);
  for (const operation of authorization.operations ?? []) if (!ALLOWED_OPERATIONS.includes(operation)) add(errors, "AUTH_OPERATION_INVALID", operation);
  for (const exclusion of REQUIRED_EXCLUSIONS) {
    if (!authorization.excludedOperations?.includes(exclusion)) add(errors, "AUTH_EXCLUSION_MISSING", exclusion);
    if (authorization.operations?.includes(exclusion)) add(errors, "SENSITIVE_OPERATION_GRANTED", exclusion);
  }
  const documents = new Map((authorization.documents ?? []).map(document => [document.documentId, document.documentVersion]));
  for (const id of ["HERO-SPEC-022", "HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1"]) if (documents.get(id) !== "1.0.0") add(errors, "AUTH_DOCUMENT_MISSING", id);

  const roadmap = readText(root, PATHS.roadmap);
  for (const step of EXPECTED_STEPS) if (!roadmap.includes(`| \`${step}\` |`)) add(errors, "ROADMAP_STEP_MISSING", step);
  const migration = readText(root, PATHS.migration);
  for (const marker of ["backoffice_entity_versions", "backoffice_event_envelopes", "backoffice_inbox_receipts", "backoffice_outbox", "backoffice_read_model_snapshots", "append_only_guard"]) {
    if (!migration.includes(marker)) add(errors, "MIGRATION_MARKER_MISSING", marker);
  }
  const contract = readText(root, PATHS.contract);
  for (const marker of ["BACKOFFICE_CONTEXTS", "BACKOFFICE_PLANES", "BACKOFFICE_ID_KINDS", "BACKOFFICE_CORE_ENTITIES", "validateBackofficeEventEnvelope"]) if (!contract.includes(marker)) add(errors, "CONTRACT_MARKER_MISSING", marker);
  const envelope = readText(root, PATHS.envelope);
  for (const marker of ["createBackofficeEventEnvelope", "createIdempotentEventConsumer", "IdempotencyConflictError"]) if (!envelope.includes(marker)) add(errors, "ENVELOPE_MARKER_MISSING", marker);
  const readModels = readText(root, PATHS.readModels);
  for (const marker of ["rebuildPortfolioReadModel", "rebuildProjectReadModel", "digestBackofficeValue"]) if (!readModels.includes(marker)) add(errors, "READ_MODEL_MARKER_MISSING", marker);

  const registryDocuments = new Map((registry.documents ?? []).map(document => [document.id, document]));
  if (registryDocuments.get("HERO-ADR-0011")?.status !== "active") add(errors, "ADR_NOT_REGISTERED", "HERO-ADR-0011");
  if (registryDocuments.get("HERO-EVIDENCE-BACKOFFICE-FOUNDATION-BO-011-020")?.status !== "active") add(errors, "EVIDENCE_NOT_REGISTERED", "HERO-EVIDENCE-BACKOFFICE-FOUNDATION-BO-011-020");

  return Object.freeze({ ok: errors.length === 0, authorizationId: authorization.authorizationId ?? null, stepCount: steps.length, errors: Object.freeze(errors) });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const result = validateBackofficeFoundation();
  if (result.ok) console.log(`Back Office foundation: PASS — ${result.stepCount} steps, ${result.authorizationId}, Global Stop off`);
  else {
    result.errors.forEach(error => console.error(`FAIL ${error.code} — ${error.detail}`));
    console.error(`Back Office foundation: FAIL — ${result.errors.length} error(s)`);
    process.exitCode = 1;
  }
}
