import { RELEASE_COMMIT_PATTERN, RELEASE_VERSION_PATTERN } from "./release.mjs";

export const PRODUCT_ARTIFACT_SCHEMA = "hero.product-artifact/v1";
export const PRODUCT_ARTIFACT_CONTRACT_VERSION = "1.0";
export const PRODUCT_ARTIFACT_DIGEST_PATTERN = /^[a-z0-9][a-z0-9._/-]{2,254}@sha256:[a-f0-9]{64}$/;
export const PRODUCT_ARTIFACT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

const PROJECT_ID = /^[a-z][a-z0-9-]{2,62}$/;
const ENVIRONMENTS = Object.freeze(["test"]);

function nonEmpty(value) { return typeof value === "string" && value.trim().length > 0; }
function copy(value) { return Object.freeze(structuredClone(value)); }

export function validateProductArtifactManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return ["Product artifact manifest must be an object."];
  if (manifest.schema !== PRODUCT_ARTIFACT_SCHEMA) errors.push("Product artifact schema is invalid.");
  if (manifest.contractVersion !== PRODUCT_ARTIFACT_CONTRACT_VERSION) errors.push("Product artifact contract version is invalid.");
  if (!PROJECT_ID.test(manifest.projectId ?? "")) errors.push("projectId is invalid.");
  if (!RELEASE_VERSION_PATTERN.test(manifest.releaseVersion ?? "")) errors.push("releaseVersion must be a valid SemVer.");
  if (!RELEASE_COMMIT_PATTERN.test(manifest.sourceCommit ?? "")) errors.push("sourceCommit must be a valid Git SHA.");
  if (!PRODUCT_ARTIFACT_DIGEST_PATTERN.test(manifest.artifact ?? "")) errors.push("artifact must be an immutable OCI digest.");
  if (!PRODUCT_ARTIFACT_HASH_PATTERN.test(manifest.sbomDigest ?? "")) errors.push("sbomDigest must be a sha256 digest.");
  if (!PRODUCT_ARTIFACT_HASH_PATTERN.test(manifest.attestationDigest ?? "")) errors.push("attestationDigest must be a sha256 digest.");
  if (!PRODUCT_ARTIFACT_HASH_PATTERN.test(manifest.testEvidenceDigest ?? "")) errors.push("testEvidenceDigest must be a sha256 digest.");
  if (!ENVIRONMENTS.includes(manifest.environment)) errors.push("Only the Test environment is allowed by the product artifact contract.");
  if (!nonEmpty(manifest.createdAt) || Number.isNaN(Date.parse(manifest.createdAt))) errors.push("createdAt must be an ISO timestamp.");
  if (manifest.portability !== "oci-image-and-reproducible-bundle") errors.push("portability must describe an OCI image and reproducible bundle.");
  return errors;
}

export function createProductArtifactManifest({ projectId, releaseVersion, sourceCommit, artifact, sbomDigest, attestationDigest, testEvidenceDigest, portability = "oci-image-and-reproducible-bundle", environment = "test", createdAt = new Date().toISOString() } = {}) {
  const manifest = Object.freeze({ schema: PRODUCT_ARTIFACT_SCHEMA, contractVersion: PRODUCT_ARTIFACT_CONTRACT_VERSION, projectId, releaseVersion, sourceCommit, artifact, sbomDigest, attestationDigest, testEvidenceDigest, portability, environment, createdAt });
  const errors = validateProductArtifactManifest(manifest);
  if (errors.length) throw new Error(errors.join(" "));
  return manifest;
}

export function getProductArtifactContractSummary() {
  return copy({ schema: PRODUCT_ARTIFACT_SCHEMA, version: PRODUCT_ARTIFACT_CONTRACT_VERSION, environment: "test-only", immutable: true, requiredFields: ["projectId", "releaseVersion", "sourceCommit", "artifact", "sbomDigest", "attestationDigest", "testEvidenceDigest", "portability", "createdAt"], boundary: "artifact evidence does not authorize deployment or Product Test execution" });
}

export function validateProductArtifactContract() {
  const errors = [];
  if (PRODUCT_ARTIFACT_CONTRACT_VERSION !== "1.0") errors.push("Unexpected Product Artifact contract version.");
  if (!PRODUCT_ARTIFACT_DIGEST_PATTERN.test("ghcr.io/example/product@sha256:" + "a".repeat(64))) errors.push("OCI digest contract is invalid.");
  if (!PRODUCT_ARTIFACT_HASH_PATTERN.test("sha256:" + "a".repeat(64))) errors.push("Hash contract is invalid.");
  return errors;
}
