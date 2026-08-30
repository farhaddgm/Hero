import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getCriticalPrinciplesContractSummary,
  validateCriticalPrinciplesContract
} from "../packages/contracts/src/principles.mjs";
import {
  CriticalPrinciplesBlockedError,
  PrincipleCommandError,
  createPrinciplesRegistry
} from "../packages/domain/src/principles-registry.mjs";
import {
  ReleaseCommandError,
  createReleasePromotion
} from "../packages/domain/src/release-promotion.mjs";
import { getReleaseContractSummary, validateReleaseContract } from "../packages/contracts/src/release.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

const owner = Object.freeze({ kind: "project-owner", id: "hero-owner" });
const system = Object.freeze({ kind: "system", id: "deploy-adapter" });

function principles() {
  return createPrinciplesRegistry({ now: () => "2026-08-30T12:00:00.000Z" });
}

test("critical principles are versioned, blocking and inherited by products", () => {
  assert.deepEqual(validateCriticalPrinciplesContract(), []);
  const summary = getCriticalPrinciplesContractSummary();
  assert.equal(summary.catalogSize, 8);
  const registry = principles();
  assert.equal(registry.evaluate({ projectId: "product-alpha", controlPoint: "release-production" }).ready, true);

  registry.define({
    projectId: "product-alpha",
    principleId: "product.no-unsafe-defaults",
    title: "پیش‌فرض‌های امن",
    statement: "قابلیت‌های خطرناک باید به‌صورت پیش‌فرض غیرفعال باشند.",
    rationale: "محصول نباید کاربر را ناخواسته در معرض ریسک قرار دهد.",
    controlPoints: ["development", "test", "release-production"],
    actor: owner,
    idempotencyKey: "principle-define-alpha"
  });
  assert.throws(
    () => registry.assertSatisfied({ projectId: "product-alpha", controlPoint: "release-production" }),
    error => error instanceof CriticalPrinciplesBlockedError && error.code === "PRINCIPLES_NOT_SATISFIED"
  );
  registry.review({
    projectId: "product-alpha",
    principleId: "product.no-unsafe-defaults",
    decision: "approved",
    actor: owner,
    idempotencyKey: "principle-review-alpha"
  });
  assert.equal(registry.evaluate({ projectId: "product-alpha", controlPoint: "release-production" }).ready, true);
  registry.requestRework({
    projectId: "product-alpha",
    principleId: "product.no-unsafe-defaults",
    feedback: "معیار پذیرش باید دقیق‌تر شود.",
    actor: owner,
    idempotencyKey: "principle-rework-alpha"
  });
  assert.equal(registry.evaluate({ projectId: "product-alpha", controlPoint: "release-production" }).ready, false);
  assert.throws(() => registry.define({
    projectId: "product-alpha",
    principleId: "product.secret-rule",
    title: "اصل Secret",
    statement: "این اصل نباید دادهٔ حساس داشته باشد.",
    rationale: "مرز امنیتی.",
    controlPoints: ["test"],
    api_key: "forbidden",
    actor: owner,
    idempotencyKey: "principle-secret"
  }), PrincipleCommandError);
});

test("release flow keeps the exact tested commit and requires explicit production authorization", () => {
  assert.deepEqual(validateReleaseContract(), []);
  const registry = principles();
  const release = createReleasePromotion({
    now: () => "2026-08-30T12:00:00.000Z",
    principlesRegistry: registry,
    authorizeProduction: input => ({ authorized: input.sensitiveApprovalReference === "prod-grant-1", code: "AUTHORIZED" })
  });
  const base = {
    releaseId: "REL-ALPHA-1",
    projectId: "product-alpha",
    artifactId: "artifact-alpha",
    version: "1.2.0",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    actor: owner
  };
  assert.equal(release.register({ ...base, idempotencyKey: "release-register" }).release.state, "draft");
  assert.equal(release.requestTestDeployment({ releaseId: base.releaseId, actor: owner, idempotencyKey: "release-test-request" }).release.state, "test-deployment-requested");
  assert.equal(release.recordTestDeployment({ ...base, deploymentId: "dep-test-1", completed: true, actor: owner, idempotencyKey: "release-test-deploy" }).release.state, "test-deployed");
  assert.equal(release.recordTestEvidence({ ...base, evidenceId: "evidence-test-1", runId: "RUN-TEST-1", command: "pnpm check", exitCode: 0, result: "passed", completed: true, actor: owner, idempotencyKey: "release-test-evidence" }).release.state, "test-passed");
  assert.equal(release.requestProductionApproval({ releaseId: base.releaseId, actor: owner, idempotencyKey: "release-prod-request" }).release.state, "awaiting-production-approval");
  assert.equal(release.approveProduction({ releaseId: base.releaseId, reason: "نسخهٔ test بررسی شد.", actor: owner, idempotencyKey: "release-prod-approve" }).release.state, "production-approved");
  assert.throws(() => release.requestProductionPromotion({ releaseId: base.releaseId, commandId: "owner-command-1", sensitiveApprovalReference: "wrong-grant", actor: owner, idempotencyKey: "release-prod-promote-wrong" }), error => error instanceof ReleaseCommandError && error.code === "PRODUCTION_AUTHORIZATION_REQUIRED");
  assert.equal(release.requestProductionPromotion({ releaseId: base.releaseId, commandId: "owner-command-1", sensitiveApprovalReference: "prod-grant-1", actor: owner, idempotencyKey: "release-prod-promote" }).release.state, "production-promotion-requested");
  assert.throws(() => release.recordProductionDeployment({ ...base, version: "1.2.1", deploymentId: "dep-prod-wrong", environment: "production", completed: true, actor: system, idempotencyKey: "release-prod-mismatch" }), error => error.code === "ARTIFACT_MISMATCH");
  const deployed = release.recordProductionDeployment({ ...base, deploymentId: "dep-prod-1", environment: "production", completed: true, actor: system, idempotencyKey: "release-prod-deployed" });
  assert.equal(deployed.release.state, "production");
  assert.equal(deployed.release.aggregateVersion, 8);
  assert.equal(release.rollback({ releaseId: base.releaseId, reason: "بازگشت آزمایشی کنترل‌شده.", actor: owner, idempotencyKey: "release-rollback" }).release.state, "rolled-back");
});

test("principles and release documentation define the human-controlled flow", () => {
  const principlesDoc = fs.readFileSync(path.join(REPO_ROOT, "docs", "architecture", "CRITICAL_PRINCIPLES.md"), "utf8");
  const releaseDoc = fs.readFileSync(path.join(REPO_ROOT, "docs", "architecture", "RELEASE_FLOW.md"), "utf8");
  assert.match(principlesDoc, /اصول حیاتی/);
  assert.match(principlesDoc, /بازکاری/);
  assert.match(releaseDoc, /test/);
  assert.match(releaseDoc, /production/);
  assert.match(releaseDoc, /تأیید مالک/);
  assert.match(getReleaseContractSummary().promotionRule, /explicit production command/);
});
