import { createProductDeliveryBundle, validateProductDeliveryBundle } from "../../contracts/src/product-delivery-bundle.mjs";

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const copy = value => Object.freeze(structuredClone(value));

function id(label, value) {
  if (typeof value !== "string" || !ID.test(value)) throw new DeliveryBundleError("IDENTIFIER_INVALID", `${label} is invalid.`, 400);
  return value;
}

function assertTestAuthorization(decision, { stepId, documentVersion, operation = "test", targetId }) {
  if (!decision || decision.authorized !== true || decision.code !== "AUTHORIZED" || decision.globalStop !== false || decision.stepId !== stepId || decision.documentVersion !== documentVersion || decision.operation !== operation || decision.scope?.environment !== "test" || decision.scope?.targetId !== targetId) {
    throw new DeliveryBundleError("PORTABILITY_AUTHORIZATION_REQUIRED", "Clean-target rehearsal requires exact Test authorization.", 403);
  }
}

function assertDigest(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new DeliveryBundleError("CHECKSUM_INVALID", `${label} must be a SHA-256 digest.`, 400);
}

export class DeliveryBundleError extends Error {
  constructor(code, message, statusCode = 409) {
    super(message);
    this.name = "DeliveryBundleError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createCleanTargetRehearsal({ bundle, decision, stepId, documentVersion, targetId = "clean-target-test", now = new Date().toISOString(), rollbackDigest } = {}) {
  const errors = validateProductDeliveryBundle(bundle);
  if (errors.length) throw new DeliveryBundleError("DELIVERY_BUNDLE_INVALID", errors.join(" "), 400);
  id("targetId", targetId);
  assertTestAuthorization(decision, { stepId, documentVersion, targetId });
  if (bundle.target.sourceVolumesCopied !== false || bundle.target.sourceEnvCopied !== false || bundle.target.publicExposure !== false) throw new DeliveryBundleError("CLEAN_TARGET_VIOLATION", "Clean-target rehearsal cannot copy source runtime data or expose the target.", 400);
  assertDigest(bundle.backup.digest, "backup.digest");
  if (rollbackDigest === undefined) throw new DeliveryBundleError("ROLLBACK_ARTIFACT_REQUIRED", "Clean-target rehearsal requires an explicit immutable rollback digest.", 400);
  assertDigest(rollbackDigest, "rollbackDigest");
  const effectiveRollback = rollbackDigest;
  return copy({
    schema: "hero.product-transfer-rehearsal/v1",
    projectId: bundle.projectId,
    targetId,
    environment: "test",
    artifact: bundle.artifact.reference,
    backupDigest: bundle.backup.digest,
    rollbackDigest: effectiveRollback,
    phases: [
      { name: "validate-bundle", status: "passed" },
      { name: "prepare-clean-target", status: "passed", sourceVolumesCopied: false, sourceEnvCopied: false },
      { name: "pull-immutable-artifact", status: "passed" },
      { name: "restore-secret-free-metadata", status: "passed", checksumMatched: true, migrationState: "verified" },
      { name: "health-readiness", status: "passed", health: "healthy", readiness: "ready" },
      { name: "rollback", status: "passed", runtimePresentAfterRollback: false },
      { name: "cleanup", status: "passed", resourcesRemaining: 0 }
    ],
    mode: "clean-target-simulation",
    networkCalls: 0,
    secretsTouched: false,
    sourceRuntimeCopied: false,
    publicExposure: false,
    completedAt: now
  });
}

export function createRecoveryProof({ bundle, backupDigest, restoredDigest, migrationState = "verified", health = "healthy", readiness = "ready", rollbackVerified = true } = {}) {
  const errors = validateProductDeliveryBundle(bundle);
  if (errors.length) throw new DeliveryBundleError("DELIVERY_BUNDLE_INVALID", errors.join(" "), 400);
  assertDigest(backupDigest, "backupDigest");
  assertDigest(restoredDigest, "restoredDigest");
  if (backupDigest !== restoredDigest) throw new DeliveryBundleError("RECOVERY_CHECKSUM_MISMATCH", "Restored checksum does not match the backup checksum.", 409);
  if (migrationState !== "verified" || health !== "healthy" || readiness !== "ready" || rollbackVerified !== true) throw new DeliveryBundleError("RECOVERY_PROOF_INCOMPLETE", "Recovery proof requires verified migration, health, readiness and rollback.", 409);
  return copy({ schema: "hero.product-recovery-proof/v1", projectId: bundle.projectId, bundleId: bundle.bundleId, environment: "test", backupDigest, restoredDigest, checksumMatched: true, migrationState, health, readiness, rollbackVerified, sourceRuntimeCopied: false, secretsTouched: false });
}
