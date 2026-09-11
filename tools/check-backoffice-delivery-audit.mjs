import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REPO_ROOT, isInsideRoot } from "./fs-policy.mjs";

const AUDIT_PATH = "config/backoffice/delivery-audit-v1.0.json";
const REQUIREMENT_PATH = "config/backoffice/requirement-trace-v1.0.json";
const AUDIT_DOCUMENT_ID = "HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911";
const ALLOWED_STATUSES = new Set(["verified", "partial", "gated", "owner_pending", "deferred"]);
const ALLOWED_REQUIREMENT_STATUSES = new Set(["implemented", "partial", "missing"]);

function add(errors, code, detail) {
  errors.push({ code, detail });
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function stepNumber(value) {
  const match = /^BO-(\d{3})$/.exec(value ?? "");
  return match ? Number(match[1]) : null;
}

export function validateBackofficeDeliveryAudit({ root = REPO_ROOT, audit: suppliedAudit } = {}) {
  const errors = [];
  const audit = suppliedAudit ?? readJson(root, AUDIT_PATH);
  const requirementTrace = readJson(root, REQUIREMENT_PATH);

  if (!/^\d+\.\d+\.\d+$/.test(audit?.schema_version ?? "")) add(errors, "INVALID_SCHEMA_VERSION", String(audit?.schema_version));
  if (!/^BACKOFFICE-DELIVERY-AUDIT-\d{8}$/.test(audit?.audit_id ?? "")) add(errors, "INVALID_AUDIT_ID", String(audit?.audit_id));
  if (!/^[0-9a-f]{40}$/.test(audit?.source?.branch_head ?? "")) add(errors, "INVALID_SOURCE_HEAD", String(audit?.source?.branch_head));
  if (!Array.isArray(audit?.ranges)) add(errors, "RANGES_REQUIRED", "ranges must be an array");

  const covered = new Map();
  const calculated = Object.fromEntries([...ALLOWED_STATUSES].map(status => [status, 0]));
  for (const range of audit?.ranges ?? []) {
    const from = stepNumber(range.from);
    const to = stepNumber(range.to);
    if (from === null || to === null || from > to || from < 1 || to > 170) {
      add(errors, "INVALID_RANGE", `${range.from}..${range.to}`);
      continue;
    }
    const expectedCount = to - from + 1;
    if (range.count !== expectedCount) add(errors, "RANGE_COUNT_MISMATCH", `${range.from}..${range.to}`);
    if (!ALLOWED_STATUSES.has(range.status)) add(errors, "INVALID_STATUS", String(range.status));
    else calculated[range.status] += expectedCount;
    for (let number = from; number <= to; number += 1) {
      const stepId = `BO-${String(number).padStart(3, "0")}`;
      if (covered.has(stepId)) add(errors, "DUPLICATE_STEP", stepId);
      else covered.set(stepId, range.status);
    }
    for (const evidence of range.evidence ?? []) {
      const absolute = path.resolve(root, evidence);
      if (!isInsideRoot(absolute, root) || !fs.existsSync(absolute)) add(errors, "INVALID_EVIDENCE", String(evidence));
    }
  }

  for (let number = 1; number <= 170; number += 1) {
    const stepId = `BO-${String(number).padStart(3, "0")}`;
    if (!covered.has(stepId)) add(errors, "MISSING_STEP", stepId);
  }

  if (audit?.summary?.total !== 170) add(errors, "INVALID_TOTAL", String(audit?.summary?.total));
  for (const status of ALLOWED_STATUSES) {
    if (audit?.summary?.[status] !== calculated[status]) add(errors, "SUMMARY_MISMATCH", `${status}:${audit?.summary?.[status]}!=${calculated[status]}`);
  }
  if (audit?.summary?.remaining_to_verified !== 170 - calculated.verified) {
    add(errors, "REMAINING_COUNT_MISMATCH", String(audit?.summary?.remaining_to_verified));
  }

  const requirementCounts = Object.fromEntries([...ALLOWED_REQUIREMENT_STATUSES].map(status => [status, 0]));
  const requirementIds = new Set();
  if (requirementTrace?.snapshot_kind !== "current_requirement_audit") {
    add(errors, "REQUIREMENT_AUDIT_NOT_CURRENT", String(requirementTrace?.snapshot_kind));
  }
  if (!Array.isArray(requirementTrace?.requirements) || requirementTrace.requirements.length !== 81) {
    add(errors, "REQUIREMENT_COUNT_INVALID", String(requirementTrace?.requirements?.length));
  }
  for (const requirement of requirementTrace?.requirements ?? []) {
    if (!/^BO-[A-Z]{2,4}-\d{3}$/.test(requirement?.id ?? "")) add(errors, "REQUIREMENT_ID_INVALID", String(requirement?.id));
    if (requirementIds.has(requirement?.id)) add(errors, "REQUIREMENT_DUPLICATE", String(requirement?.id));
    requirementIds.add(requirement?.id);
    if (!ALLOWED_REQUIREMENT_STATUSES.has(requirement?.status)) add(errors, "REQUIREMENT_STATUS_INVALID", `${requirement?.id}:${requirement?.status}`);
    else requirementCounts[requirement.status] += 1;
    if (requirement?.status !== "missing" && (!Array.isArray(requirement?.evidence) || requirement.evidence.length === 0)) {
      add(errors, "REQUIREMENT_EVIDENCE_REQUIRED", String(requirement?.id));
    }
    for (const evidence of requirement?.evidence ?? []) {
      const absolute = path.resolve(root, evidence);
      if (!isInsideRoot(absolute, root) || !fs.existsSync(absolute)) add(errors, "REQUIREMENT_EVIDENCE_INVALID", `${requirement?.id}:${evidence}`);
    }
  }
  if (audit?.requirement_current?.registry !== REQUIREMENT_PATH) {
    add(errors, "REQUIREMENT_REGISTRY_MISMATCH", String(audit?.requirement_current?.registry));
  }
  for (const status of ALLOWED_REQUIREMENT_STATUSES) {
    if (audit?.requirement_current?.[status] !== requirementCounts[status]) {
      add(errors, "REQUIREMENT_SUMMARY_MISMATCH", `${status}:${audit?.requirement_current?.[status]}!=${requirementCounts[status]}`);
    }
  }

  const registry = readJson(root, "docs/registry/document-registry.json");
  const auditDocument = registry.documents?.find(document => document.id === AUDIT_DOCUMENT_ID);
  if (auditDocument?.status !== "active") add(errors, "AUDIT_DOCUMENT_NOT_ACTIVE", AUDIT_DOCUMENT_ID);
  if (auditDocument && !fs.existsSync(path.join(root, auditDocument.path))) add(errors, "AUDIT_DOCUMENT_MISSING", auditDocument.path);

  return Object.freeze({
    ok: errors.length === 0,
    stepCount: covered.size,
    counts: Object.freeze(calculated),
    requirementCount: requirementIds.size,
    requirementCounts: Object.freeze(requirementCounts),
    errors: Object.freeze(errors)
  });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const result = validateBackofficeDeliveryAudit();
  if (result.ok) {
    console.log(`Back Office delivery audit: PASS — ${result.stepCount} steps, verified=${result.counts.verified}, remaining=${170 - result.counts.verified}; ${result.requirementCount} requirements, implemented=${result.requirementCounts.implemented}, partial=${result.requirementCounts.partial}, missing=${result.requirementCounts.missing}`);
  } else {
    for (const error of result.errors) console.error(`FAIL ${error.code} — ${error.detail}`);
    process.exitCode = 1;
  }
}
