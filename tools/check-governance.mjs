import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REPO_ROOT } from "./fs-policy.mjs";

const governanceFile = path.join(REPO_ROOT, "config", "governance.json");
const snapshotFile = path.join(
  REPO_ROOT,
  "config",
  "authorizations",
  "roadmap-20260814-001.json"
);

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireValue(errors, condition, code, detail) {
  if (!condition) errors.push({ code, detail });
}

export function validateGovernance() {
  const errors = [];
  const governance = loadJson(governanceFile);
  const snapshot = loadJson(snapshotFile);

  requireValue(errors, governance.schema === "hero.governance/v1", "GOVERNANCE_SCHEMA", governance.schema);
  requireValue(errors, governance.version === "1.0.0", "GOVERNANCE_VERSION", governance.version);
  requireValue(errors, governance.ownerRole === "project-owner", "OWNER_ROLE", governance.ownerRole);
  requireValue(errors, governance.product?.name === "Hero", "PRODUCT_NAME", governance.product?.name);
  requireValue(
    errors,
    JSON.stringify(governance.product?.initialProviders) ===
      JSON.stringify(["codex-chatgpt", "claude", "cursor"]),
    "INITIAL_PROVIDERS",
    JSON.stringify(governance.product?.initialProviders)
  );
  requireValue(errors, governance.authority?.failClosed === true, "FAIL_CLOSED_REQUIRED", "authority.failClosed");
  requireValue(
    errors,
    governance.changeControl?.silentScopeExpansionAllowed === false,
    "SILENT_SCOPE_EXPANSION",
    "changeControl.silentScopeExpansionAllowed"
  );

  const requiredSensitiveOperations = [
    "production-deploy",
    "destructive-data-operation",
    "external-spend",
    "secret-change",
    "external-message",
    "irreversible-operation"
  ];
  const governanceExclusions = new Set(governance.scope?.excludedUntilSeparatelyApproved ?? []);
  const snapshotExclusions = new Set(snapshot.excludedOperations ?? []);
  for (const operation of requiredSensitiveOperations) {
    requireValue(errors, governanceExclusions.has(operation), "MISSING_GOVERNANCE_GATE", operation);
    requireValue(errors, snapshotExclusions.has(operation), "MISSING_SNAPSHOT_GATE", operation);
  }

  requireValue(
    errors,
    snapshot.schema === "hero.authorization-snapshot/v1",
    "SNAPSHOT_SCHEMA",
    snapshot.schema
  );
  requireValue(
    errors,
    snapshot.authorizationId === "BATCH-ROADMAP-20260814-001",
    "SNAPSHOT_ID",
    snapshot.authorizationId
  );
  requireValue(errors, snapshot.status === "active", "SNAPSHOT_STATUS", snapshot.status);
  requireValue(errors, snapshot.validUntil === "owner-revocation", "SNAPSHOT_EXPIRY", snapshot.validUntil);
  requireValue(errors, snapshot.steps?.length === 21, "SNAPSHOT_STEP_COUNT", snapshot.steps?.length);

  const ids = snapshot.steps?.map(step => step.stepId) ?? [];
  requireValue(errors, new Set(ids).size === ids.length, "DUPLICATE_STEP_ID", ids.join(","));
  for (let index = 0; index < 21; index += 1) {
    const expected = "HERO-" + String(index + 1).padStart(3, "0");
    const step = snapshot.steps?.[index];
    requireValue(errors, step?.stepId === expected, "STEP_SEQUENCE", step?.stepId + " != " + expected);
    requireValue(errors, step?.documentVersion === "v1.0", "STEP_VERSION", expected);
  }

  const enabledOperations = new Set(snapshot.operations ?? []);
  for (const operation of requiredSensitiveOperations) {
    requireValue(errors, !enabledOperations.has(operation), "SENSITIVE_OPERATION_ENABLED", operation);
  }

  const requiredDoneChecks = [
    "acceptance-criteria-met",
    "automated-tests-pass",
    "clean-room-check-passes",
    "documentation-updated",
    "change-evidence-recorded",
    "rollback-or-recovery-path-known",
    "no-blocking-security-finding"
  ];
  const doneChecks = new Set(governance.definitionOfDone ?? []);
  for (const item of requiredDoneChecks) {
    requireValue(errors, doneChecks.has(item), "MISSING_DONE_CHECK", item);
  }

  return {
    governance,
    snapshot,
    errors
  };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === invokedFile) {
  const result = validateGovernance();
  if (result.errors.length > 0) {
    console.error(JSON.stringify(result.errors, null, 2));
    process.exitCode = 1;
  } else {
    console.log(
      "GOVERNANCE PASS — " +
      result.snapshot.steps.length +
      " version-bound steps, sensitive actions separately gated"
    );
  }
}
