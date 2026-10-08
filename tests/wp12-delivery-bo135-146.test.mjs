import assert from "node:assert/strict";
import test from "node:test";

import { validateDeliveryControlContract } from "../packages/contracts/src/delivery-control.mjs";
import { createDeliveryControl, redactTelemetryText } from "../packages/domain/src/delivery-control.mjs";
import { assertNoProductionPayload } from "../packages/domain/src/production-data-guard.mjs";
import { createProjectCollaboration } from "../packages/domain/src/project-collaboration.mjs";
import { createPerformanceIntelligence } from "../packages/domain/src/performance-intelligence.mjs";

const owner = { role: "project-owner", subject: "owner-one" }; const admin = { role: "admin", subject: "admin-one" }; const second = { role: "admin", subject: "admin-two" }; const viewer = { role: "viewer", subject: "viewer-one" };
const projectId = "project-one"; const other = "project-two";
let clock = Date.parse("2026-10-08T12:00:00.000Z"); const now = () => new Date(clock).toISOString();
const code = fn => { try { fn(); } catch (error) { return error.code; } return null; };
const digest = char => `sha256:${char.repeat(64)}`;
const art = (control, artifactId, char = "a", project = projectId) => control.registerArtifact({ actor: admin, projectId: project, artifactId, digest: digest(char), provenance: `hero://prov/${artifactId}`, attestationRef: `hero://att/${artifactId}`, sbomRef: `hero://sbom/${artifactId}` });
const bundleRefs = { sourceRef: "hero://source", configRef: "hero://config", migrationRef: "hero://migration", deployRef: "hero://deploy", docsRef: "hero://docs", reportsRef: "hero://reports" };

test("BO-135/136 telemetry: exact schema per kind, redaction before storage, rate limit and idempotence", () => {
  const delivery = createDeliveryControl({ now });
  assert.deepEqual(validateDeliveryControlContract(), []);
  const ok = delivery.ingestTelemetry({ actor: admin, projectId, telemetryId: "telemetry-one", kind: "metric", metadata: { name: "http.latency", value: 12.5, unit: "ms" } });
  assert.equal(ok.payload, "forbidden");
  assert.equal(delivery.ingestTelemetry({ actor: admin, projectId, telemetryId: "telemetry-one", kind: "metric", metadata: { name: "http.latency", value: 12.5, unit: "ms" } }).recordedAt, ok.recordedAt, "same content is idempotent");
  assert.equal(code(() => delivery.ingestTelemetry({ actor: admin, projectId, telemetryId: "telemetry-one", kind: "metric", metadata: { name: "http.latency", value: 99, unit: "ms" } })), "TELEMETRY_ID_CONFLICT");
  const bad = [
    ["metric", { name: "x", value: 1, unit: "ms" }], ["metric", { name: "http.latency", value: "12", unit: "ms" }], ["metric", { name: "http.latency", value: 1, unit: "furlongs" }], ["metric", { name: "http.latency", value: 1, unit: "ms", extra: "payload" }],
    ["health", { component: "api", status: "great" }], ["health", { component: "api" }], ["sanitized-log", { level: "info", code: "lowercase", message: "x" }], ["sanitized-log", { level: "info", code: "OK_CODE", message: "x", payload: "customer row" }],
    ["trace-metadata", { traceId: "xyz", spanCount: 1, durationMs: 1, status: "ok" }], ["trace-metadata", { traceId: "a".repeat(16), spanCount: -1, durationMs: 1, status: "ok" }], ["raw-dump", { a: 1 }], ["metric", null], ["metric", []]
  ];
  bad.forEach(([kind, metadata], index) => assert.equal(code(() => delivery.ingestTelemetry({ actor: admin, projectId, telemetryId: `telemetry-bad-${index}`, kind, metadata })), "TELEMETRY_REJECTED", JSON.stringify([kind, metadata])));
  assert.equal(code(() => delivery.ingestTelemetry({ actor: viewer, projectId, telemetryId: "telemetry-v", kind: "health", metadata: { component: "api", status: "healthy" } })), "PROJECT_WRITE_REQUIRED");
  const log = delivery.ingestTelemetry({ actor: admin, projectId, telemetryId: "telemetry-log", kind: "sanitized-log", metadata: { level: "error", code: "LOGIN_FAILED", message: "user jane.doe@example.com from 203.0.113.9 sent Bearer abcdefghijklmnop and key 0123456789abcdef0123456789abcdef call +98 912 345 6789" } });
  for (const leaked of ["jane.doe@example.com", "203.0.113.9", "abcdefghijklmnop", "0123456789abcdef0123456789abcdef", "912 345 6789"]) assert.equal(JSON.stringify(log).includes(leaked), false, leaked);
  assert.match(log.metadata.message, /\[email\]/);
  assert.equal(redactTelemetryText("x".repeat(500)).length <= 200, true);
  for (let i = 0; i < 998; i += 1) delivery.ingestTelemetry({ actor: admin, projectId, telemetryId: `telemetry-bulk-${i}`, kind: "health", metadata: { component: "api", status: "healthy" } });
  assert.equal(code(() => delivery.ingestTelemetry({ actor: admin, projectId, telemetryId: "telemetry-overflow", kind: "health", metadata: { component: "api", status: "healthy" } })), "TELEMETRY_RATE_LIMITED");
  assert.equal(delivery.view({ actor: viewer, projectId }).telemetry.length <= 200, true, "the page is bounded");
  assert.equal(delivery.view({ actor: viewer, projectId: other }).telemetry.length, 0);
});

test("BO-137 break-glass: owner asks, a different person decides, time-boxed, never grants data from Hero", () => {
  const delivery = createDeliveryControl({ now });
  const soon = new Date(clock + 3600_000).toISOString();
  assert.equal(code(() => delivery.requestBreakGlass({ actor: admin, projectId, requestId: "bg-one", scope: "orders table", reason: "Investigating failed orders", expiresAt: soon })), "OWNER_REQUIRED");
  assert.equal(code(() => delivery.requestBreakGlass({ actor: owner, projectId, requestId: "bg-one", scope: "orders table", reason: "short", expiresAt: soon })), "BREAK_GLASS_INVALID");
  assert.equal(code(() => delivery.requestBreakGlass({ actor: owner, projectId, requestId: "bg-one", scope: "orders table", reason: "Investigating failed orders", expiresAt: new Date(clock + 9 * 3600_000).toISOString() })), "BREAK_GLASS_INVALID", "longer than four hours");
  const request = delivery.requestBreakGlass({ actor: owner, projectId, requestId: "bg-one", scope: "orders table", reason: "Investigating failed orders", expiresAt: soon });
  assert.equal(request.state, "approval-required"); assert.equal(request.dataAccess, "not-granted-by-hero");
  assert.equal(code(() => delivery.decideBreakGlass({ actor: owner, projectId, requestId: "bg-one", decision: "approve" })), "BREAK_GLASS_SELF_APPROVAL");
  assert.equal(code(() => delivery.decideBreakGlass({ actor: viewer, projectId, requestId: "bg-one", decision: "approve" })), "PROJECT_WRITE_REQUIRED");
  assert.equal(code(() => delivery.decideBreakGlass({ actor: second, projectId: other, requestId: "bg-one", decision: "approve" })), "BREAK_GLASS_NOT_FOUND");
  assert.equal(code(() => delivery.decideBreakGlass({ actor: second, projectId, requestId: "bg-one", decision: "approve", durationSeconds: 9 * 3600 })), "BREAK_GLASS_DURATION_INVALID");
  const approved = delivery.decideBreakGlass({ actor: second, projectId, requestId: "bg-one", decision: "approve", durationSeconds: 600 });
  assert.equal(approved.state, "approved"); assert.equal(approved.dataAccess, "not-granted-by-hero"); assert.equal(Date.parse(approved.grantedUntil) - clock, 600_000);
  assert.equal(code(() => delivery.decideBreakGlass({ actor: second, projectId, requestId: "bg-one", decision: "approve" })), "BREAK_GLASS_NOT_PENDING");
  assert.equal(delivery.view({ actor: viewer, projectId }).breakGlass[0].liveState, "approved");
  clock += 601_000;
  assert.equal(delivery.view({ actor: viewer, projectId }).breakGlass[0].liveState, "expired");
  clock -= 601_000;
  delivery.requestBreakGlass({ actor: owner, projectId, requestId: "bg-two", scope: "logs", reason: "Checking an outage window", expiresAt: soon });
  assert.equal(delivery.decideBreakGlass({ actor: second, projectId, requestId: "bg-two", decision: "deny" }).state, "denied");
  delivery.requestBreakGlass({ actor: owner, projectId, requestId: "bg-three", scope: "logs", reason: "Checking an outage window", expiresAt: soon });
  assert.equal(delivery.revokeBreakGlass({ actor: owner, projectId, requestId: "bg-three", reason: "no longer needed" }).state, "revoked");
  assert.equal(code(() => delivery.revokeBreakGlass({ actor: admin, projectId, requestId: "bg-three" })), "OWNER_REQUIRED");
  const expiring = delivery.requestBreakGlass({ actor: owner, projectId, requestId: "bg-four", scope: "logs", reason: "Checking an outage window", expiresAt: new Date(clock + 120_000).toISOString() });
  clock += 121_000;
  assert.equal(code(() => delivery.decideBreakGlass({ actor: second, projectId, requestId: expiring.requestId, decision: "approve" })), "BREAK_GLASS_EXPIRED");
  clock -= 121_000;
});

test("BO-138 Production payload never reaches AI context, Memory or Evaluation, including nested and renamed attempts", () => {
  assert.throws(() => assertNoProductionPayload({ reference: "hero://production/orders/1" }), error => error.code === "PRODUCTION_PAYLOAD_FORBIDDEN");
  assert.throws(() => assertNoProductionPayload({ reference: "hero://evidence/x", kind: "production-data" }), error => error.code === "PRODUCTION_PAYLOAD_FORBIDDEN");
  assert.throws(() => assertNoProductionPayload({ rows: [{ a: { productionPayload: "x" } }] }), error => error.code === "PRODUCTION_PAYLOAD_FORBIDDEN");
  assert.throws(() => assertNoProductionPayload([{ customerData: [1] }]), error => error.code === "PRODUCTION_PAYLOAD_FORBIDDEN");
  assert.doesNotThrow(() => assertNoProductionPayload({ reference: "hero://evidence/brief", kind: "evidence", note: "production readiness checklist" }));
  const collaboration = createProjectCollaboration({ now });
  const note = { actor: admin, projectId, memoryId: "memory-prod", level: "project", key: "orders", content: "Order volume pattern", provenance: { reference: "hero://production/orders/2026-10", kind: "evidence" } };
  assert.throws(() => collaboration.recordMemory(note), error => error.code === "PRODUCTION_PAYLOAD_FORBIDDEN");
  assert.throws(() => collaboration.recordMemory({ ...note, memoryId: "memory-prod2", provenance: { reference: "hero://evidence/ok", kind: "production-dump" } }), error => error.code === "PRODUCTION_PAYLOAD_FORBIDDEN");
  const performance = createPerformanceIntelligence({ now });
  assert.throws(() => performance.recordEvaluation({ actor: admin, projectId, evaluationId: "evaluation-prod", subjectType: "output", subjectId: "output-one", method: "human", goalFit: 0.9, evidenceRefs: ["hero://production/orders/1"] }), error => error.code === "PRODUCTION_PAYLOAD_FORBIDDEN");
  assert.throws(() => performance.registerDataset({ actor: admin, projectId, datasetId: "dataset-prod", cases: [{ caseId: "case-one", input: { productionPayload: "row" }, expected: "x" }] }), error => error.code === "PRODUCTION_PAYLOAD_FORBIDDEN");
});

test("BO-139 release machine: no skipping, a ready release needs an artifact, deploy is recorded with evidence and never executed, rollback needs a reason", () => {
  const delivery = createDeliveryControl({ now });
  art(delivery, "artifact-one");
  delivery.createRelease({ actor: admin, projectId, releaseId: "release-one", testedCommit: "ABC1234" });
  assert.equal(code(() => delivery.createRelease({ actor: admin, projectId, releaseId: "release-one", testedCommit: "abc1234" })), "RELEASE_EXISTS");
  assert.equal(code(() => delivery.createRelease({ actor: admin, projectId, releaseId: "release-x", testedCommit: "not-a-sha" })), "COMMIT_INVALID");
  assert.equal(code(() => delivery.createRelease({ actor: admin, projectId: other, releaseId: "release-y", testedCommit: "abc1234", artifactId: "artifact-one" })), "ARTIFACT_NOT_FOUND", "an artifact of another project cannot be attached");
  const step = (state, extra = {}) => delivery.transitionRelease({ actor: admin, projectId, releaseId: "release-one", state, ...extra });
  assert.equal(code(() => step("deployed")), "RELEASE_TRANSITION_INVALID");
  assert.equal(code(() => step("rolled-back", { reason: "because reasons" })), "RELEASE_TRANSITION_INVALID");
  step("approved");
  assert.equal(code(() => step("ready")), "RELEASE_ARTIFACT_REQUIRED");
  assert.equal(code(() => step("ready", { artifactId: "artifact-ghost" })), "ARTIFACT_NOT_FOUND");
  step("ready", { artifactId: "artifact-one" });
  assert.equal(code(() => step("deployed")), "INTERNAL_REFERENCE_REQUIRED");
  assert.equal(code(() => step("deployed", { evidenceRef: "https://example.com/proof" })), "INTERNAL_REFERENCE_REQUIRED");
  const deployed = step("deployed", { evidenceRef: "hero://evidence/deploy-one" });
  assert.equal(deployed.deploy, "record-only-separate-dispatch-required");
  assert.equal(code(() => step("approved")), "RELEASE_TRANSITION_INVALID");
  assert.equal(code(() => step("rolled-back", { reason: "x" })), "RELEASE_REASON_REQUIRED");
  assert.equal(step("rolled-back", { reason: "Error rate doubled after deploy" }).state, "rolled-back");
  assert.equal(code(() => step("deployed", { evidenceRef: "hero://evidence/again" })), "RELEASE_TRANSITION_INVALID");
  assert.deepEqual(delivery.view({ actor: viewer, projectId }).releases[0].history.map(item => item.state), ["tested", "approved", "ready", "deployed", "rolled-back"]);
  delivery.createRelease({ actor: admin, projectId, releaseId: "release-two", testedCommit: "def5678" });
  assert.equal(code(() => delivery.transitionRelease({ actor: admin, projectId, releaseId: "release-two", state: "blocked" })), "RELEASE_REASON_REQUIRED");
  assert.equal(code(() => delivery.transitionRelease({ actor: viewer, projectId, releaseId: "release-two", state: "approved" })), "PROJECT_WRITE_REQUIRED");
  assert.equal(code(() => delivery.transitionRelease({ actor: admin, projectId: other, releaseId: "release-two", state: "approved" })), "RELEASE_NOT_FOUND");
});

test("BO-140 artifacts are immutable: a digest cannot be swapped, other projects cannot take the id, references must be internal", () => {
  const delivery = createDeliveryControl({ now });
  const first = art(delivery, "artifact-one", "a");
  assert.equal(art(delivery, "artifact-one", "a").registeredAt, first.registeredAt, "re-registering the same digest is a no-op");
  assert.equal(code(() => art(delivery, "artifact-one", "b")), "ARTIFACT_IMMUTABLE");
  assert.equal(code(() => art(delivery, "artifact-one", "a", other)), "ARTIFACT_CROSS_PROJECT");
  assert.equal(code(() => delivery.registerArtifact({ actor: admin, projectId, artifactId: "artifact-two", digest: "sha256:short", provenance: "hero://p", attestationRef: "hero://a", sbomRef: "hero://s" })), "ARTIFACT_INVALID");
  assert.equal(code(() => delivery.registerArtifact({ actor: admin, projectId, artifactId: "artifact-two", digest: digest("c"), provenance: "https://evil.example/p", attestationRef: "hero://a", sbomRef: "hero://s" })), "ARTIFACT_INVALID");
});

test("BO-141/142/143/144/145/146 bundle, portability from a compared digest, ordered rehearsals, identity-bound acceptance, and tampering is caught", () => {
  const delivery = createDeliveryControl({ now });
  art(delivery, "artifact-web", "a"); art(delivery, "artifact-api", "b");
  assert.equal(code(() => delivery.deliveryMatrix({ actor: admin, projectId, targets: { desktop: "artifact-web" } })), "DELIVERY_MATRIX_INVALID");
  assert.equal(code(() => delivery.deliveryMatrix({ actor: admin, projectId, targets: { web: "artifact-ghost" } })), "DELIVERY_MATRIX_INVALID");
  assert.equal(delivery.deliveryMatrix({ actor: admin, projectId, targets: { web: "artifact-web", backend: "artifact-api" } }).version, 1);
  assert.equal(delivery.deliveryMatrix({ actor: admin, projectId, targets: { web: "artifact-web" } }).version, 2);
  assert.equal(code(() => delivery.createBundle({ actor: admin, projectId, bundleId: "bundle-bad", artifactIds: ["artifact-web"], ...bundleRefs, sourceRef: "file:///etc/passwd" })), "BUNDLE_INVALID");
  assert.equal(code(() => delivery.createBundle({ actor: admin, projectId, bundleId: "bundle-bad", artifactIds: ["artifact-ghost"], ...bundleRefs })), "BUNDLE_INVALID");
  const bundle = delivery.createBundle({ actor: admin, projectId, bundleId: "bundle-one", artifactIds: ["artifact-web", "artifact-api"], ...bundleRefs });
  assert.equal(bundle.state, "manifest-only-no-export"); assert.match(bundle.manifestDigest, /^sha256:[a-f0-9]{64}$/);
  const reordered = delivery.createBundle({ actor: admin, projectId, bundleId: "bundle-one-b", artifactIds: ["artifact-api", "artifact-web"], ...bundleRefs });
  assert.notEqual(reordered.manifestDigest, bundle.manifestDigest, "the bundle id is part of the manifest");
  assert.equal(code(() => delivery.createBundle({ actor: admin, projectId, bundleId: "bundle-one", artifactIds: ["artifact-web"], ...bundleRefs })), "BUNDLE_EXISTS");
  // BO-143 portability compares a digest; a bare "passed" is not evidence
  assert.equal(code(() => delivery.verifyPortability({ actor: admin, projectId, bundleId: "bundle-one", targetId: "target-one", result: "passed" })), "PORTABILITY_EVIDENCE_REQUIRED");
  const tampered = delivery.verifyPortability({ actor: admin, projectId, bundleId: "bundle-one", targetId: "target-one", observedManifestDigest: digest("f"), result: "passed" });
  assert.equal(tampered.result, "failed", "a caller cannot claim success against a different digest");
  // BO-146 acceptance is blocked while only a failing portability exists
  assert.equal(code(() => delivery.accept({ actor: admin, projectId, acceptanceId: "accept-one", bundleId: "bundle-one", artifactIdentity: bundle.manifestDigest })), "PORTABILITY_REQUIRED");
  assert.equal(delivery.verifyPortability({ actor: admin, projectId, bundleId: "bundle-one", targetId: "target-two", observedManifestDigest: bundle.manifestDigest.toUpperCase().replace("SHA256:", "sha256:") }).result, "passed");
  // BO-144 order: backup -> restore -> upgrade -> rollback
  const rehearse = (kind, result = "passed") => delivery.rehearseRecovery({ actor: admin, projectId, bundleId: "bundle-one", kind, result, evidenceRef: `hero://evidence/${kind}` });
  assert.equal(code(() => rehearse("restore")), "REHEARSAL_ORDER");
  assert.equal(code(() => rehearse("upgrade")), "REHEARSAL_ORDER");
  rehearse("backup"); rehearse("restore", "failed");
  assert.equal(code(() => rehearse("upgrade")), "REHEARSAL_ORDER", "a failed restore blocks the upgrade rehearsal");
  rehearse("restore");
  // BO-145 acceptance needs the artifact identity, and every rehearsal passed or listed
  assert.equal(code(() => delivery.accept({ actor: admin, projectId, acceptanceId: "accept-one", bundleId: "bundle-one", artifactIdentity: digest("0") })), "ARTIFACT_IDENTITY_MISMATCH", "wrong identity (wrong commit or artifact)");
  assert.equal(code(() => delivery.accept({ actor: admin, projectId, acceptanceId: "accept-one", bundleId: "bundle-one", artifactIdentity: bundle.manifestDigest })), "REHEARSAL_REQUIRED");
  assert.equal(code(() => delivery.accept({ actor: admin, projectId, acceptanceId: "accept-one", bundleId: "bundle-one", artifactIdentity: bundle.manifestDigest, exceptions: ["rehearsal:upgrade"] })), "REHEARSAL_REQUIRED", "rollback is still missing");
  assert.equal(code(() => delivery.accept({ actor: viewer, projectId, acceptanceId: "accept-one", bundleId: "bundle-one", artifactIdentity: bundle.manifestDigest })), "PROJECT_WRITE_REQUIRED");
  assert.equal(code(() => delivery.accept({ actor: admin, projectId: other, acceptanceId: "accept-one", bundleId: "bundle-one", artifactIdentity: bundle.manifestDigest })), "BUNDLE_NOT_FOUND");
  const accepted = delivery.accept({ actor: admin, projectId, acceptanceId: "accept-one", bundleId: "bundle-one", artifactIdentity: bundle.manifestDigest, exceptions: ["rehearsal:upgrade", "rehearsal:rollback"] });
  assert.equal(accepted.delivery, "accepted-not-deployed"); assert.deepEqual(accepted.exceptions, ["rehearsal:upgrade", "rehearsal:rollback"]);
  assert.equal(code(() => delivery.accept({ actor: admin, projectId, acceptanceId: "accept-one", bundleId: "bundle-one", artifactIdentity: bundle.manifestDigest, exceptions: ["rehearsal:upgrade", "rehearsal:rollback"] })), "ACCEPTANCE_IMMUTABLE");
  // BO-146 failed rollback is recorded as failed evidence, not hidden
  assert.equal(delivery.rehearseRecovery({ actor: admin, projectId, bundleId: "bundle-one", kind: "backup", result: "failed", evidenceRef: "hero://evidence/backup-2" }).result, "failed");
  assert.equal(code(() => delivery.rehearseRecovery({ actor: admin, projectId, bundleId: "bundle-one", kind: "backup", result: "passed", evidenceRef: "s3://bucket/key" })), "REHEARSAL_INVALID");
});

test("persistence: every delivery record survives a restart in any order, and history is not rewritten", () => {
  const first = createDeliveryControl({ now });
  art(first, "artifact-one", "a");
  first.createRelease({ actor: admin, projectId, releaseId: "release-one", testedCommit: "abc1234", artifactId: "artifact-one" });
  first.transitionRelease({ actor: admin, projectId, releaseId: "release-one", state: "approved" });
  first.transitionRelease({ actor: admin, projectId, releaseId: "release-one", state: "ready" });
  const bundle = first.createBundle({ actor: admin, projectId, bundleId: "bundle-one", artifactIds: ["artifact-one"], ...bundleRefs });
  first.verifyPortability({ actor: admin, projectId, bundleId: "bundle-one", targetId: "target-one", observedManifestDigest: bundle.manifestDigest });
  first.verifyPortability({ actor: admin, projectId, bundleId: "bundle-one", targetId: "target-one", observedManifestDigest: digest("e") });
  first.deliveryMatrix({ actor: admin, projectId, targets: { web: "artifact-one" } });
  first.ingestTelemetry({ actor: admin, projectId, telemetryId: "telemetry-one", kind: "health", metadata: { component: "api", status: "healthy" } });
  first.requestBreakGlass({ actor: owner, projectId, requestId: "bg-one", scope: "logs", reason: "Checking an outage window", expiresAt: new Date(clock + 3600_000).toISOString() });
  first.decideBreakGlass({ actor: second, projectId, requestId: "bg-one", decision: "approve", durationSeconds: 600 });
  const records = [...first.drainRecords()];
  for (const record of records) for (const key of JSON.stringify(record.payload).match(/"[A-Za-z]+":/g) ?? []) assert.equal(/credential|secret|password|api[_-]?key/i.test(key), false, `${record.kind} ${key}`);
  for (const order of [records, [...records].reverse()]) {
    const second2 = createDeliveryControl({ now });
    for (const record of order) second2.hydrate(record);
    const view = second2.view({ actor: viewer, projectId });
    assert.equal(view.releases[0].state, "ready"); assert.equal(view.releases[0].history.length, 3);
    assert.equal(view.bundles[0].manifestDigest, bundle.manifestDigest); assert.equal(view.matrix.version, 1);
    assert.equal(view.portability[0].result, "failed", "the latest verification wins");
    assert.equal(view.telemetry.length, 1); assert.equal(view.breakGlass[0].state, "approved"); assert.equal(view.artifacts[0].digest, digest("a"));
    assert.equal(code(() => second2.registerArtifact({ actor: admin, projectId, artifactId: "artifact-one", digest: digest("z".replace("z", "d")), provenance: "hero://prov", attestationRef: "hero://att", sbomRef: "hero://sbom" })), "ARTIFACT_IMMUTABLE", "immutability survives a restart");
  }
});
