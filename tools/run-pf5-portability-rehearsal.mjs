import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createProductDeliveryBundle } from "../packages/contracts/src/product-delivery-bundle.mjs";
import { createCleanTargetRehearsal, createRecoveryProof } from "../packages/domain/src/product-delivery-bundle.mjs";
import { createPortabilityGate } from "../packages/domain/src/portability-gate.mjs";

const runId = process.env.HERO_PF5_RUN_ID ?? `pf5-rehearsal-${Date.now()}`;
const sourceCommit = process.env.HERO_SOURCE_COMMIT ?? "workspace-uncommitted";
const evidenceDir = path.resolve(process.env.HERO_PF5_EVIDENCE_DIR ?? `/tmp/hero-pf5-portability-evidence-${runId}`);
const digest = `sha256:${"a".repeat(64)}`;
const artifact = `hero/example@${digest}`;
const bundle = createProductDeliveryBundle({
  bundleId: "bundle-safe-one",
  projectId: "project-safe",
  artifact: { reference: artifact, releaseVersion: "1.0.0", sourceCommit, sbomDigest: digest, attestationDigest: digest, testEvidenceDigest: digest, qualityEvidenceDigest: digest },
  config: { schemaRef: "hero://config/product-v1", requiredEnvironmentPrefix: "HERO_", containsValues: false },
  migration: { planRef: "hero://migration/product-v1", fromSchema: "0", toSchema: "1", backwardCompatible: true },
  backup: { reference: "hero://backup/project-safe/bundle-safe-one", digest, projectScoped: true, containsSecrets: false },
  restoreRunbookRef: "hero://runbooks/restore/product-safe",
  compatibility: { appVersion: "1.0.0", schemaVersion: "1", configSchemaVersion: "1", agentContractVersion: "1.0" },
  target: { environment: "test", sourceVolumesCopied: false, sourceEnvCopied: false, publicExposure: false },
  createdAt: "2026-09-18T12:00:00.000Z"
});
const transferDecision = { authorized: true, code: "AUTHORIZED", globalStop: false, operation: "test", stepId: "PF5-TRANSFER-001", documentVersion: "1.0.0", scope: { environment: "test", targetId: "clean-target-test" } };
const rehearsal = createCleanTargetRehearsal({ bundle, decision: transferDecision, stepId: "PF5-TRANSFER-001", documentVersion: "1.0.0", targetId: "clean-target-test", rollbackDigest: digest });
const recovery = createRecoveryProof({ bundle, backupDigest: digest, restoredDigest: digest });
const gate = createPortabilityGate({ now: () => "2026-09-18T12:00:00.000Z" }).assess({
  assessmentId: "PORTABLE-PF5-SAFE-001",
  stepId: "HERO-020",
  documentVersion: "v1.0",
  actor: { kind: "orchestrator", id: "hero-control-plane" },
  testDecision: { authorized: true, code: "AUTHORIZED", globalStop: false, safeCheckpointRequired: false, stepId: "HERO-020", documentVersion: "v1.0", operation: "test" },
  idempotencyKey: "pf5-portability-assessment-one",
  evidence: {
    source: { status: "passed", independentRepository: true, externalProjectReferenceDetected: false, hostSpecificPathDetected: false, files: [".env.example", "compose.yaml", "Dockerfile", "pnpm-lock.yaml"] },
    runtime: { status: "passed", linuxContainerReference: true, environmentPrefix: "HERO_", composeResources: ["hero-data", "hero-private"] },
    backup: { status: "passed", artifactId: "hero-state-manifest", digest, projectScoped: true, containsSecrets: false },
    restore: { status: "passed", digest, checksumMatched: true, migrationState: "verified", cleanLinuxVerified: true }
  }
});
const evidence = { schema: "hero.product-factory-pf5-simulation/v1", runId, sourceCommit, bundle: { bundleId: bundle.bundleId, projectId: bundle.projectId, artifact: bundle.artifact.reference, backupDigest: bundle.backup.digest, secretFree: bundle.config.containsValues === false }, portabilityGate: { state: gate.gate.state, code: gate.gate.code, transferRequiresSeparateAuthorization: gate.gate.transfer.code === "TRANSFER_REQUIRES_SEPARATE_AUTHORIZATION" }, rehearsal, recovery, boundary: { networkCalls: 0, sourceRuntimeCopied: false, sourceEnvCopied: false, secretsTouched: false, publicExposure: false, actualServerTransfer: false, production: false, pilot: false, externalSpend: false } };
mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
const body = `${JSON.stringify(evidence, null, 2)}\n`;
const file = path.join(evidenceDir, "pf5-portability-rehearsal.json");
writeFileSync(file, body, { mode: 0o444 });
chmodSync(file, 0o444);
const evidenceDigest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
console.log(JSON.stringify({ runId, evidenceDir, evidenceDigest, status: gate.gate.code === "PORTABILITY_VERIFIED" && rehearsal.phases.every(phase => phase.status === "passed") && recovery.checksumMatched ? "passed" : "blocked", portabilityCode: gate.gate.code, networkCalls: 0 }));
