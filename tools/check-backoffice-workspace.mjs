import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateProjectSettingsContract } from "../packages/contracts/src/project-settings.mjs";
import { validateProjectWorkspaceContract } from "../packages/contracts/src/project-workspace.mjs";
import { REPO_ROOT, isInsideRoot } from "./fs-policy.mjs";

const BATCHES = Object.freeze([
  ["config/authorizations/backoffice-20260910-004.json", "BATCH-BACKOFFICE-20260910-004", 31, 40],
  ["config/authorizations/backoffice-20260910-005.json", "BATCH-BACKOFFICE-20260910-005", 41, 50],
  ["config/authorizations/backoffice-20260910-006.json", "BATCH-BACKOFFICE-20260910-006", 51, 60]
]);
const EXCLUDED = Object.freeze(["production-deploy", "destructive-data-operation", "external-spend", "secret-change", "external-message", "irreversible-operation", "pilot-execution", "notion-write"]);
const FILES = Object.freeze([
  "docs/roadmap/BACKOFFICE-COMMAND-CENTER-IMPLEMENTATION-v1.0.md",
  "docs/roadmap/BACKOFFICE-WORKSPACE-POLICY-PORTFOLIO-BO-031-060.md",
  "docs/decisions/ADR-0013-project-workspace-settings-and-portfolio.md",
  "packages/contracts/src/project-workspace.mjs",
  "packages/contracts/src/project-settings.mjs",
  "packages/domain/src/project-workspace.mjs",
  "packages/domain/src/project-settings.mjs",
  "packages/adapters/migrations/011_project_workspace_and_settings.sql",
  "packages/adapters/src/postgresql-project-workspace-store.mjs",
  "apps/control-plane/src/portfolio-view.mjs",
  "apps/control-plane/src/product-studio-view.mjs",
  "apps/control-plane/src/project-control-room-view.mjs",
  "apps/control-plane/src/server.mjs",
  "tests/project-workspace-and-settings.test.mjs"
]);
function absolute(root, candidate) { const resolved = path.resolve(root, candidate); if (!isInsideRoot(resolved, root)) throw new Error(`Path outside root: ${candidate}`); return resolved; }
function text(root, candidate) { return fs.readFileSync(absolute(root, candidate), "utf8"); }
function step(id) { return `BO-${String(id).padStart(3, "0")}`; }

export function validateBackofficeWorkspace(options = {}) {
  const root = path.resolve(options.root ?? REPO_ROOT); const errors = [];
  for (const error of [...validateProjectWorkspaceContract(), ...validateProjectSettingsContract()]) errors.push({ code: "CONTRACT_INVALID", detail: error });
  for (const file of FILES) if (!fs.existsSync(absolute(root, file))) errors.push({ code: "FILE_MISSING", detail: file });
  const allSteps = [];
  for (const [file, authorizationId, from, to] of BATCHES) {
    const auth = JSON.parse(text(root, file)); const expected = Array.from({ length: to - from + 1 }, (_, index) => step(from + index)); const actual = (auth.steps ?? []).map(item => item.stepId);
    allSteps.push(...actual);
    if (auth.schema !== "hero.authorization-snapshot/v1" || auth.authorizationId !== authorizationId || auth.status !== "active" || auth.grantedBy !== "project-owner" || auth.globalStop !== false) errors.push({ code: "AUTH_INVALID", detail: authorizationId });
    if (actual.join(",") !== expected.join(",") || auth.steps.some(item => item.documentVersion !== "1.0.0")) errors.push({ code: "AUTH_STEP_SCOPE_INVALID", detail: authorizationId });
    for (const value of EXCLUDED) if (!auth.excludedOperations?.includes(value) || auth.operations?.includes(value)) errors.push({ code: "SENSITIVE_OPERATION_INVALID", detail: `${authorizationId}:${value}` });
  }
  const roadmap = text(root, FILES[0]); for (const id of Array.from({ length: 30 }, (_, index) => step(index + 31))) if (!roadmap.includes(`| \`${id}\` |`)) errors.push({ code: "ROADMAP_STEP_MISSING", detail: id });
  const migration = text(root, "packages/adapters/migrations/011_project_workspace_and_settings.sql"); for (const marker of ["project_registry_versions", "project_input_metadata", "foundation_proposal_versions", "project_setting_versions", "project_import_plans", "append_only_guard"]) if (!migration.includes(marker)) errors.push({ code: "MIGRATION_MARKER_MISSING", detail: marker });
  const workspace = text(root, "packages/domain/src/project-workspace.mjs"); for (const marker of ["hydrateProject", "hydrateInput", "hydrateFoundation", "hydrateImport", "listImportPlans"]) if (!workspace.includes(marker)) errors.push({ code: "WORKSPACE_HYDRATION_MARKER_MISSING", detail: marker });
  const settings = text(root, "packages/domain/src/project-settings.mjs"); for (const marker of ["hydrateRecord", "listRecords", "recordedAt"]) if (!settings.includes(marker)) errors.push({ code: "SETTINGS_HYDRATION_MARKER_MISSING", detail: marker });
  const server = text(root, "apps/control-plane/src/server.mjs"); for (const marker of ["persistWorkspaceProject", "persistWorkspaceInput", "persistWorkspaceProposal", "persistWorkspaceSettings", "listSettings", "listProjects"]) if (!server.includes(marker)) errors.push({ code: "WORKSPACE_PERSISTENCE_MARKER_MISSING", detail: marker });
  const studio = text(root, "apps/control-plane/src/product-studio-view.mjs"); for (const marker of ["workspace-panel", "Foundation", "inputCount", "settings", "surface=control"]) if (!studio.includes(marker)) errors.push({ code: "WORKSPACE_UI_MARKER_MISSING", detail: marker });
  const controlRoom = text(root, "apps/control-plane/src/project-control-room-view.mjs"); for (const marker of ["اتاق کنترل پروژه", "metadata امن", "Provider زنده"]) if (!controlRoom.includes(marker)) errors.push({ code: "PROJECT_CONTROL_ROOM_MARKER_MISSING", detail: marker });
  const registry = JSON.parse(text(root, "docs/registry/document-registry.json")); const ids = new Map(registry.documents.map(document => [document.id, document.status]));
  for (const id of ["HERO-ADR-0013", "HERO-EVIDENCE-BACKOFFICE-WORKSPACE-POLICY-PORTFOLIO-BO-031-060"]) if (ids.get(id) !== "active") errors.push({ code: "DOCUMENT_NOT_ACTIVE", detail: id });
  return Object.freeze({ ok: errors.length === 0, stepCount: allSteps.length, errors: Object.freeze(errors) });
}

const current = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === current) {
  const result = validateBackofficeWorkspace();
  if (result.ok) console.log(`Back Office workspace: PASS — ${result.stepCount} steps, 3 snapshots, Global Stop off`);
  else { result.errors.forEach(error => console.error(`FAIL ${error.code} — ${error.detail}`)); process.exitCode = 1; }
}
