import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REPO_ROOT, isInsideRoot } from "./fs-policy.mjs";

const PATHS = Object.freeze({
  specification: "docs/specs/HERO-022-v1.0.md",
  plan: "docs/roadmap/BACKOFFICE-COMMAND-CENTER-IMPLEMENTATION-v1.0.md",
  oldArchitecture: "docs/architecture/BACKOFFICE.md",
  trace: "config/backoffice/requirement-trace-v1.0.json",
  authorization: "config/authorizations/backoffice-20260910-001.json",
  registry: "docs/registry/document-registry.json"
});

const DEVELOPMENT_OPERATIONS = Object.freeze(["design", "document", "version", "develop", "test", "review", "commit"]);
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
const TRACE_STATUSES = Object.freeze(["implemented", "partial", "missing"]);

function add(errors, code, detail) {
  errors.push(Object.freeze({ code, detail }));
}

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

function matches(text, pattern) {
  return [...text.matchAll(pattern)].map(match => match[1]);
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  values.forEach(value => seen.has(value) ? repeated.add(value) : seen.add(value));
  return [...repeated].sort();
}

function expectedSteps(first, last) {
  return Array.from({ length: last - first + 1 }, (_, index) => `BO-${String(first + index).padStart(3, "0")}`);
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function statusCounts(requirements) {
  return Object.freeze(Object.fromEntries(TRACE_STATUSES.map(status => [
    status,
    requirements.filter(requirement => requirement.status === status).length
  ])));
}

export function validateBackofficeBaseline(options = {}) {
  const root = path.resolve(options.root ?? REPO_ROOT);
  const specification = options.specification ?? readText(root, PATHS.specification);
  const plan = options.plan ?? readText(root, PATHS.plan);
  const oldArchitecture = options.oldArchitecture ?? readText(root, PATHS.oldArchitecture);
  const trace = options.trace ?? readJson(root, PATHS.trace);
  const authorization = options.authorization ?? readJson(root, PATHS.authorization);
  const registry = options.registry ?? readJson(root, PATHS.registry);
  const errors = [];

  const requirementIds = matches(specification, /^\| `(BO-[A-Z]+-\d{3})`/gm);
  const duplicateRequirements = duplicates(requirementIds);
  if (duplicateRequirements.length > 0) add(errors, "DUPLICATE_SPEC_REQUIREMENT", duplicateRequirements.join(", "));
  if (requirementIds.length !== 81) add(errors, "SPEC_REQUIREMENT_COUNT", `expected 81, received ${requirementIds.length}`);
  if (!/> Status: active/.test(specification) || !/> Version: 1\.0\.0/.test(specification)) {
    add(errors, "SPEC_NOT_ACTIVE", "HERO-SPEC-022 must be active at version 1.0.0");
  }
  if (!/تصویب‌کننده: `project-owner`/.test(specification)) add(errors, "OWNER_APPROVAL_MISSING", "Specification owner approval is missing");

  const planStepIds = matches(plan, /^\| `(BO-\d{3})`/gm);
  const expectedPlanSteps = expectedSteps(1, 170);
  if (!sameValues(planStepIds, expectedPlanSteps)) {
    add(errors, "PLAN_STEP_SEQUENCE", `expected BO-001..BO-170 exactly once in order, received ${planStepIds.length} rows`);
  }
  const workPackages = new Set(matches(plan, /^## [^\n]*\b(WP-\d{2})\b/gm));
  const expectedPackages = Array.from({ length: 15 }, (_, index) => `WP-${String(index).padStart(2, "0")}`);
  for (const workPackage of expectedPackages) {
    if (!workPackages.has(workPackage)) add(errors, "WORK_PACKAGE_MISSING", workPackage);
  }
  if (!/مجوز Notion write برای این دو سند: `not-granted`/.test(plan)) add(errors, "NOTION_GATE_MISSING", "Notion write must remain separately gated");
  if (!/مجوز پایلوت: `not-granted`/.test(plan)) add(errors, "PILOT_GATE_MISSING", "Pilot execution must remain separately gated");

  if (trace.schema_version !== "1.0.0" || trace.specification?.document_id !== "HERO-SPEC-022" || trace.specification?.version !== "1.0.0") {
    add(errors, "TRACE_VERSION_MISMATCH", "Trace registry must bind HERO-SPEC-022 version 1.0.0");
  }
  const traceRequirements = Array.isArray(trace.requirements) ? trace.requirements : [];
  const traceIds = traceRequirements.map(requirement => requirement?.id);
  const duplicateTraceIds = duplicates(traceIds);
  if (duplicateTraceIds.length > 0) add(errors, "DUPLICATE_TRACE_REQUIREMENT", duplicateTraceIds.join(", "));
  const missingTrace = requirementIds.filter(id => !traceIds.includes(id));
  const extraTrace = traceIds.filter(id => !requirementIds.includes(id));
  if (missingTrace.length > 0) add(errors, "TRACE_REQUIREMENT_MISSING", missingTrace.join(", "));
  if (extraTrace.length > 0) add(errors, "TRACE_REQUIREMENT_UNKNOWN", extraTrace.join(", "));
  for (const requirement of traceRequirements) {
    if (!TRACE_STATUSES.includes(requirement?.status)) add(errors, "TRACE_STATUS_INVALID", String(requirement?.id));
    if (!/^WP-(?:0\d|1[0-4])$/.test(requirement?.work_package ?? "")) add(errors, "TRACE_WORK_PACKAGE_INVALID", String(requirement?.id));
    if (!Array.isArray(requirement?.evidence)) {
      add(errors, "TRACE_EVIDENCE_INVALID", String(requirement?.id));
      continue;
    }
    if (requirement.status !== "missing" && requirement.evidence.length === 0) add(errors, "TRACE_EVIDENCE_REQUIRED", requirement.id);
    for (const evidencePath of requirement.evidence) {
      if (typeof evidencePath !== "string" || !fs.existsSync(absolute(root, evidencePath))) add(errors, "TRACE_EVIDENCE_NOT_FOUND", `${requirement.id}:${evidencePath}`);
    }
    if (typeof requirement?.gap !== "string" || requirement.gap.trim().length < 3) add(errors, "TRACE_GAP_REQUIRED", String(requirement?.id));
  }

  const authorizedSteps = Array.isArray(authorization.steps) ? authorization.steps.map(step => step?.stepId) : [];
  if (authorization.schema !== "hero.authorization-snapshot/v1") add(errors, "AUTH_SCHEMA_INVALID", String(authorization.schema));
  if (authorization.authorizationId !== "BATCH-BACKOFFICE-20260910-001") add(errors, "AUTH_ID_INVALID", String(authorization.authorizationId));
  if (authorization.status !== "active" || authorization.grantedBy !== "project-owner") add(errors, "AUTH_NOT_ACTIVE", "Foundation authorization must be owner-granted and active");
  if (authorization.globalStop !== false) add(errors, "GLOBAL_STOP_ACTIVE", "Global Stop must be explicitly false before this batch");
  if (!sameValues(authorizedSteps, expectedSteps(1, 10))) add(errors, "AUTH_STEP_SCOPE_INVALID", authorizedSteps.join(", "));
  for (const step of authorization.steps ?? []) {
    if (step.documentVersion !== "1.0.0") add(errors, "AUTH_DOCUMENT_VERSION_INVALID", `${step.stepId}:${step.documentVersion}`);
  }
  for (const operation of authorization.operations ?? []) {
    if (!DEVELOPMENT_OPERATIONS.includes(operation)) add(errors, "AUTH_OPERATION_INVALID", operation);
  }
  for (const exclusion of REQUIRED_EXCLUSIONS) {
    if (!authorization.excludedOperations?.includes(exclusion)) add(errors, "AUTH_EXCLUSION_MISSING", exclusion);
    if (authorization.operations?.includes(exclusion)) add(errors, "SENSITIVE_OPERATION_GRANTED", exclusion);
  }
  const authorizationDocuments = new Map((authorization.documents ?? []).map(document => [document.documentId, document.documentVersion]));
  for (const documentId of ["HERO-SPEC-022", "HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1"]) {
    if (authorizationDocuments.get(documentId) !== "1.0.0") add(errors, "AUTH_DOCUMENT_MISSING", documentId);
  }

  const documents = new Map((registry.documents ?? []).map(document => [document.id, document]));
  const specDocument = documents.get("HERO-SPEC-022");
  const planDocument = documents.get("HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1");
  const oldDocument = documents.get("HERO-ARCH-BACKOFFICE");
  if (specDocument?.status !== "active" || !specDocument?.supersedes?.includes("HERO-ARCH-BACKOFFICE")) add(errors, "SPEC_REGISTRY_INVALID", "HERO-SPEC-022 active supersession is required");
  if (planDocument?.status !== "active") add(errors, "PLAN_REGISTRY_INVALID", "Back Office implementation plan must be active");
  if (oldDocument?.status !== "superseded" || oldDocument?.superseded_by !== "HERO-SPEC-022") add(errors, "OLD_ARCHITECTURE_STILL_ACTIVE", "Historical Back Office architecture must be superseded");
  if (!/Status: `superseded`/.test(oldArchitecture) || !/Superseded by: `HERO-SPEC-022`/.test(oldArchitecture)) {
    add(errors, "OLD_ARCHITECTURE_MARKER_MISSING", "Historical document must name its active replacement");
  }

  return Object.freeze({
    ok: errors.length === 0,
    specification: "HERO-SPEC-022@1.0.0",
    authorizationId: authorization.authorizationId ?? null,
    requirementCount: requirementIds.length,
    traceCount: traceRequirements.length,
    planStepCount: planStepIds.length,
    workPackageCount: workPackages.size,
    statusCounts: statusCounts(traceRequirements),
    errors: Object.freeze(errors)
  });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const result = validateBackofficeBaseline();
  if (result.ok) {
    console.log(`Back Office baseline: PASS — ${result.requirementCount} requirements, ${result.planStepCount} steps, ${result.workPackageCount} work packages`);
    console.log(`Coverage baseline — implemented=${result.statusCounts.implemented}, partial=${result.statusCounts.partial}, missing=${result.statusCounts.missing}`);
    console.log(`Authorization — ${result.authorizationId}, BO-001..BO-010, Global Stop off, sensitive operations excluded`);
  } else {
    result.errors.forEach(error => console.error(`FAIL ${error.code} — ${error.detail}`));
    console.error(`Back Office baseline: FAIL — ${result.errors.length} error(s)`);
    process.exitCode = 1;
  }
}
