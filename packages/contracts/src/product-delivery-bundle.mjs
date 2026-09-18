export const PRODUCT_DELIVERY_BUNDLE_SCHEMA = "hero.product-delivery-bundle/v1";
export const PRODUCT_DELIVERY_BUNDLE_CONTRACT_VERSION = "1.0";
export const PRODUCT_DELIVERY_BUNDLE_ENVIRONMENTS = Object.freeze(["test"]);
export const PRODUCT_DELIVERY_BUNDLE_COMPATIBILITY_FIELDS = Object.freeze([
  "appVersion",
  "schemaVersion",
  "configSchemaVersion",
  "agentContractVersion"
]);

const PROJECT_ID = /^[a-z][a-z0-9-]{2,62}$/;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const OCI_DIGEST = /^[a-z0-9][a-z0-9._/-]{2,254}@sha256:[a-f0-9]{64}$/;
const REF = /^hero:\/[A-Za-z0-9._:/-]{2,255}$/;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/;
const SENSITIVE_INPUT = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential|private.?key|secret\s*[:=]|Bearer\s+)/i;
const HOST_PATH = /(?:[A-Za-z]:[\\/](?![\\/])|\/(?:Users|home)\/|\\\\)/;

function validString(value) { return typeof value === "string" && value.trim().length > 0; }
function validRef(value) { return REF.test(value ?? ""); }
function copy(value) { return Object.freeze(structuredClone(value)); }

export function validateProductDeliveryBundle(bundle) {
  const errors = [];
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) return ["Delivery Bundle must be an object."];
  const serialized = JSON.stringify(bundle);
  if (SENSITIVE_INPUT.test(serialized)) errors.push("Delivery Bundle cannot contain secret-shaped values.");
  if (HOST_PATH.test(serialized)) errors.push("Delivery Bundle cannot contain host-specific paths.");
  if (bundle.schema !== PRODUCT_DELIVERY_BUNDLE_SCHEMA) errors.push("Delivery Bundle schema is invalid.");
  if (bundle.contractVersion !== PRODUCT_DELIVERY_BUNDLE_CONTRACT_VERSION) errors.push("Delivery Bundle contract version is invalid.");
  if (!PROJECT_ID.test(bundle.projectId ?? "")) errors.push("Delivery Bundle projectId is invalid.");
  if (!IDENTIFIER.test(bundle.bundleId ?? "")) errors.push("Delivery Bundle bundleId is invalid.");
  if (!PRODUCT_DELIVERY_BUNDLE_ENVIRONMENTS.includes(bundle.environment)) errors.push("Delivery Bundle must be Test-only.");
  if (!bundle.artifact || !OCI_DIGEST.test(bundle.artifact.reference ?? "")) errors.push("Delivery Bundle artifact must be an immutable OCI digest.");
  if (!SHA256.test(bundle.artifact.sbomDigest ?? "") || !SHA256.test(bundle.artifact.attestationDigest ?? "") || !SHA256.test(bundle.artifact.testEvidenceDigest ?? "") || !SHA256.test(bundle.artifact.qualityEvidenceDigest ?? "")) errors.push("Delivery Bundle artifact evidence must use SHA-256 digests.");
  if (!/^[a-f0-9]{40}$/.test(bundle.artifact.sourceCommit ?? "")) errors.push("Delivery Bundle sourceCommit must be a Git SHA.");
  if (!SEMVER.test(bundle.artifact.releaseVersion ?? "")) errors.push("Delivery Bundle releaseVersion is invalid.");
  if (!validRef(bundle.config?.schemaRef) || bundle.config?.requiredEnvironmentPrefix !== "HERO_" || bundle.config?.containsValues !== false) errors.push("Delivery Bundle config must be a secret-free schema reference.");
  if (!validRef(bundle.migration?.planRef) || !validString(bundle.migration?.fromSchema) || !validString(bundle.migration?.toSchema) || bundle.migration?.backwardCompatible !== true) errors.push("Delivery Bundle migration plan is incomplete or incompatible.");
  if (!validRef(bundle.backup?.reference) || !SHA256.test(bundle.backup?.digest ?? "") || bundle.backup?.projectScoped !== true || bundle.backup?.containsSecrets !== false) errors.push("Delivery Bundle backup reference must be scoped, checksummed and secret-free.");
  if (!validRef(bundle.restoreRunbookRef)) errors.push("Delivery Bundle restore runbook reference is invalid.");
  for (const field of PRODUCT_DELIVERY_BUNDLE_COMPATIBILITY_FIELDS) if (!validString(bundle.compatibility?.[field])) errors.push(`Delivery Bundle compatibility field is missing: ${field}.`);
  if (bundle.target?.environment !== "test" || bundle.target?.sourceVolumesCopied !== false || bundle.target?.sourceEnvCopied !== false || bundle.target?.publicExposure !== false) errors.push("Delivery Bundle target must be a clean, non-public Test target without source runtime copies.");
  if (!validString(bundle.createdAt) || Number.isNaN(Date.parse(bundle.createdAt))) errors.push("Delivery Bundle createdAt must be an ISO timestamp.");
  return errors;
}

export function createProductDeliveryBundle({ bundleId, projectId, artifact, config, migration, backup, restoreRunbookRef, compatibility, target, environment = "test", createdAt = new Date().toISOString() } = {}) {
  const bundle = {
    schema: PRODUCT_DELIVERY_BUNDLE_SCHEMA,
    contractVersion: PRODUCT_DELIVERY_BUNDLE_CONTRACT_VERSION,
    bundleId,
    projectId,
    environment,
    artifact,
    config,
    migration,
    backup,
    restoreRunbookRef,
    compatibility,
    target,
    createdAt
  };
  const errors = validateProductDeliveryBundle(bundle);
  if (errors.length) throw new Error(errors.join(" "));
  return copy(bundle);
}

export function getProductDeliveryBundleContractSummary() {
  return copy({
    schema: PRODUCT_DELIVERY_BUNDLE_SCHEMA,
    version: PRODUCT_DELIVERY_BUNDLE_CONTRACT_VERSION,
    environment: "test-only",
    requiredCompatibility: PRODUCT_DELIVERY_BUNDLE_COMPATIBILITY_FIELDS,
    boundary: "metadata-only bundle; no source volume, .env, Secret, host path or deployment is copied"
  });
}

export function validateProductDeliveryBundleContract() {
  const errors = [];
  if (PRODUCT_DELIVERY_BUNDLE_CONTRACT_VERSION !== "1.0") errors.push("Unexpected Delivery Bundle contract version.");
  if (!SHA256.test(`sha256:${"a".repeat(64)}`)) errors.push("SHA-256 contract is invalid.");
  if (!OCI_DIGEST.test(`hero/example@sha256:${"a".repeat(64)}`)) errors.push("OCI digest contract is invalid.");
  if (!validRef("hero://runbooks/restore")) errors.push("Hero reference contract is invalid.");
  return errors;
}
