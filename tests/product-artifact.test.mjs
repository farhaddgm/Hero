import assert from "node:assert/strict";
import test from "node:test";

import {
  createProductArtifactManifest,
  getProductArtifactContractSummary,
  validateProductArtifactContract,
  validateProductArtifactManifest
} from "../packages/contracts/src/product-artifact.mjs";

const digest = "sha256:" + "a".repeat(64);

function manifest(overrides = {}) {
  return createProductArtifactManifest({
    projectId: "project-safe",
    releaseVersion: "1.0.0-test.1",
    sourceCommit: "a".repeat(40),
    artifact: "ghcr.io/example/product@" + digest,
    sbomDigest: digest,
    attestationDigest: digest,
    testEvidenceDigest: digest,
    createdAt: "2026-09-18T00:00:00.000Z",
    ...overrides
  });
}

test("Product Artifact contract is immutable, Test-scoped and secret-safe", () => {
  assert.deepEqual(validateProductArtifactContract(), []);
  const summary = getProductArtifactContractSummary();
  assert.equal(summary.immutable, true);
  assert.equal(summary.environment, "test-only");
  assert.equal(validateProductArtifactManifest(manifest()).length, 0);
});

test("artifact manifest rejects mutable, mismatched and non-Test evidence", () => {
  const value = manifest();
  assert.ok(validateProductArtifactManifest({ ...value, artifact: "latest" }).length > 0);
  assert.ok(validateProductArtifactManifest({ ...value, environment: "production" }).length > 0);
  assert.ok(validateProductArtifactManifest({ ...value, testEvidenceDigest: "latest" }).length > 0);
});
