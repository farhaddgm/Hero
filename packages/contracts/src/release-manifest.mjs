import { RELEASE_COMMIT_PATTERN, RELEASE_VERSION_PATTERN } from "./release.mjs";

export const RELEASE_MANIFEST_SCHEMA = "hero.release-manifest/v1";
export const RELEASE_MANIFEST_CONTRACT_VERSION = "1.0";
export const RELEASE_ARTIFACT_PATTERN = /^ghcr\.io\/farhaddgm\/hero@sha256:[a-f0-9]{64}$/;
export const RELEASE_URL_PATTERN = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases\/tag\/v[^\s]+$/;

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateReleaseManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return ["Manifest must be an object."];
  if (manifest.schema !== RELEASE_MANIFEST_SCHEMA) errors.push("Manifest schema is invalid.");
  if (manifest.contractVersion !== RELEASE_MANIFEST_CONTRACT_VERSION) errors.push("Manifest contract version is invalid.");
  if (!RELEASE_VERSION_PATTERN.test(manifest.releaseVersion ?? "")) errors.push("releaseVersion must be a valid SemVer.");
  if (!RELEASE_COMMIT_PATTERN.test(manifest.commitSha ?? "")) errors.push("commitSha must be a valid Git SHA.");
  if (!RELEASE_ARTIFACT_PATTERN.test(manifest.artifact ?? "")) errors.push("artifact must be the exact Hero GHCR sha256 reference.");
  if (manifest.environment !== "test") errors.push("Only the Test environment is allowed by this manifest contract.");
  if (!nonEmpty(manifest.createdAt) || Number.isNaN(Date.parse(manifest.createdAt))) errors.push("createdAt must be an ISO timestamp.");
  if (manifest.releaseUrl !== null && manifest.releaseUrl !== undefined && !RELEASE_URL_PATTERN.test(manifest.releaseUrl)) errors.push("releaseUrl must be a GitHub release URL or null.");
  if (manifest.workflowRunId !== null && manifest.workflowRunId !== undefined && !/^\d+$/.test(String(manifest.workflowRunId))) errors.push("workflowRunId must be numeric or null.");
  return errors;
}

export function createReleaseManifest({ releaseVersion, commitSha, artifact, releaseUrl = null, workflowRunId = null, environment = "test", createdAt = new Date().toISOString() }) {
  const manifest = Object.freeze({
    schema: RELEASE_MANIFEST_SCHEMA,
    contractVersion: RELEASE_MANIFEST_CONTRACT_VERSION,
    environment,
    releaseVersion,
    commitSha,
    artifact,
    releaseUrl,
    workflowRunId: workflowRunId === null || workflowRunId === undefined ? null : String(workflowRunId),
    createdAt
  });
  const errors = validateReleaseManifest(manifest);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return manifest;
}

export function getReleaseManifestContractSummary() {
  return Object.freeze({
    schema: RELEASE_MANIFEST_SCHEMA,
    version: RELEASE_MANIFEST_CONTRACT_VERSION,
    environment: "test-only",
    artifact: "immutable GHCR digest",
    secretSafe: true,
    requiredFields: ["releaseVersion", "commitSha", "artifact", "environment", "createdAt"]
  });
}
