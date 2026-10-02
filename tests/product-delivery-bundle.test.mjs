import assert from "node:assert/strict";
import test from "node:test";

import {
  createProductDeliveryBundle,
  validateProductDeliveryBundleContract
} from "../packages/contracts/src/product-delivery-bundle.mjs";
import {
  createCleanTargetRehearsal,
  createRecoveryProof,
  DeliveryBundleError
} from "../packages/domain/src/product-delivery-bundle.mjs";

const digest = `sha256:${"a".repeat(64)}`;
const artifact = `hero/example@${digest}`;
const bundle = createProductDeliveryBundle({
  bundleId: "bundle-safe-one",
  projectId: "project-safe",
  artifact: {
    reference: artifact,
    releaseVersion: "1.0.0",
    sourceCommit: "a".repeat(40),
    sbomDigest: digest,
    attestationDigest: digest,
    testEvidenceDigest: digest,
    qualityEvidenceDigest: digest
  },
  config: { schemaRef: "hero://config/product-v1", requiredEnvironmentPrefix: "HERO_", containsValues: false },
  migration: { planRef: "hero://migration/product-v1", fromSchema: "0", toSchema: "1", backwardCompatible: true },
  backup: { reference: "hero://backup/project-safe/bundle-safe-one", digest, projectScoped: true, containsSecrets: false },
  restoreRunbookRef: "hero://runbooks/restore/product-safe",
  compatibility: { appVersion: "1.0.0", schemaVersion: "1", configSchemaVersion: "1", agentContractVersion: "1.0" },
  target: { environment: "test", sourceVolumesCopied: false, sourceEnvCopied: false, publicExposure: false },
  createdAt: "2026-09-18T12:00:00.000Z"
});
const decision = { authorized: true, code: "AUTHORIZED", globalStop: false, operation: "test", stepId: "PF5-TRANSFER-001", documentVersion: "1.0.0", scope: { environment: "test", targetId: "clean-target-test" } };

test("Delivery Bundle contract is immutable, portable and secret-free", () => {
  assert.deepEqual(validateProductDeliveryBundleContract(), []);
  assert.equal(bundle.environment, "test");
  assert.equal(bundle.config.containsValues, false);
  assert.equal(bundle.target.sourceVolumesCopied, false);
});

test("clean-target rehearsal proves metadata-only transfer, health, rollback and cleanup", () => {
  const result = createCleanTargetRehearsal({ bundle, decision, stepId: "PF5-TRANSFER-001", documentVersion: "1.0.0", rollbackDigest: digest });
  assert.equal(result.mode, "clean-target-simulation");
  assert.equal(result.networkCalls, 0);
  assert.equal(result.secretsTouched, false);
  assert.equal(result.sourceRuntimeCopied, false);
  assert.deepEqual(result.phases.map(phase => phase.status), Array(7).fill("passed"));
  const proof = createRecoveryProof({ bundle, backupDigest: digest, restoredDigest: digest });
  assert.equal(proof.checksumMatched, true);
  assert.equal(proof.rollbackVerified, true);
});

test("portability fails closed for wrong target scope, copied runtime and checksum mismatch", () => {
  assert.throws(
    () => createCleanTargetRehearsal({ bundle, decision: { ...decision, globalStop: true }, stepId: "PF5-TRANSFER-001", documentVersion: "1.0.0" }),
    error => error instanceof DeliveryBundleError && error.code === "PORTABILITY_AUTHORIZATION_REQUIRED"
  );
  assert.throws(
    () => createCleanTargetRehearsal({ bundle: { ...bundle, target: { ...bundle.target, sourceVolumesCopied: true } }, decision, stepId: "PF5-TRANSFER-001", documentVersion: "1.0.0" }),
    error => error instanceof DeliveryBundleError && error.code === "DELIVERY_BUNDLE_INVALID"
  );
  assert.throws(
    () => createRecoveryProof({ bundle, backupDigest: digest, restoredDigest: `sha256:${"b".repeat(64)}` }),
    error => error instanceof DeliveryBundleError && error.code === "RECOVERY_CHECKSUM_MISMATCH"
  );
  assert.throws(
    () => createCleanTargetRehearsal({ bundle, decision, stepId: "PF5-TRANSFER-001", documentVersion: "1.0.0" }),
    error => error instanceof DeliveryBundleError && error.code === "ROLLBACK_ARTIFACT_REQUIRED"
  );
  assert.throws(
    () => createProductDeliveryBundle({ ...bundle, config: { ...bundle.config, note: "api_key=must-not-enter" } }),
    /secret-shaped/
  );
});
