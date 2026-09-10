import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./fs-policy.mjs";
import { validatePlannerContract } from "../packages/contracts/src/planner.mjs";
import { validateTrainingContract } from "../packages/contracts/src/training.mjs";
import { readRuntimeExternalSpendPolicy } from "../packages/adapters/src/external-spend-authorization.mjs";
import { createPortabilityGate } from "../packages/domain/src/portability-gate.mjs";

const spec = path.join(REPO_ROOT, "docs", "specs", "HERO-021-v1.0.md");
const readinessDoc = path.join(REPO_ROOT, "docs", "operations", "PILOT-READINESS.md");
const pilotRequestFile = path.join(REPO_ROOT, "config", "pilot", "HERO-PILOT-001-v1.0.json");
const recoveryEvidenceFile = path.join(REPO_ROOT, "var", "evidence", "clean-linux-recovery.json");

function jsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function recoveryReadiness() {
  const evidence = jsonFile(recoveryEvidenceFile);
  if (!evidence) return { ready: false, reason: "شاهد واقعی var/evidence/clean-linux-recovery.json هنوز ثبت نشده است." };
  try {
    const result = createPortabilityGate().assess({
      assessmentId: "PILOT-RECOVERY-001",
      stepId: "HERO-020",
      documentVersion: "v1.0",
      actor: { kind: "project-owner", id: "hero-owner" },
      idempotencyKey: "pilot-recovery-check-001",
      testDecision: { authorized: true, code: "AUTHORIZED", operation: "test", stepId: "HERO-020", documentVersion: "v1.0", globalStop: false, safeCheckpointRequired: false },
      evidence
    });
    return result.gate.code === "PORTABILITY_VERIFIED"
      ? { ready: true, reason: "شاهد Clean Linux و restore معتبر است." }
      : { ready: false, reason: result.gate.reason };
  } catch (error) {
    return { ready: false, reason: `شاهد recovery معتبر نیست: ${error.message}` };
  }
}

function providerReadiness(env = process.env) {
  if (env.HERO_ENABLE_REAL_PROVIDERS !== "true") return { ready: false, reason: "Provider واقعی در runtime فعال نشده است." };
  try {
    const policy = readRuntimeExternalSpendPolicy({ env });
    if (!policy.active || policy.globalStop) return { ready: false, reason: "مجوز external-spend فعال نیست یا Global Stop روشن است." };
    if (policy.expiresAtMs <= Date.now()) return { ready: false, reason: "مجوز external-spend منقضی شده است." };
    const credentialNames = { openai: "HERO_OPENAI_API_KEY", anthropic: "HERO_ANTHROPIC_API_KEY", google: "HERO_GOOGLE_API_KEY", "openai-compatible": "HERO_OPENAI_COMPATIBLE_API_KEY" };
    const credentialName = credentialNames[policy.providerId];
    if (!credentialName || typeof env[credentialName] !== "string" || env[credentialName].trim() === "") return { ready: false, reason: "Credential Provider در Secret Store runtime حاضر نیست." };
    const prefix = policy.providerId === "openai-compatible" ? "HERO_OPENAI_COMPATIBLE" : `HERO_${policy.providerId.toUpperCase()}`;
    const legacy = env[`${prefix}_COST_UNITS_PER_1K_TOKENS`];
    const input = env[`${prefix}_INPUT_COST_UNITS_PER_1K_TOKENS`];
    const output = env[`${prefix}_OUTPUT_COST_UNITS_PER_1K_TOKENS`];
    const legacyConfigured = typeof legacy === "string" && legacy.trim() !== "";
    const splitConfigured = typeof input === "string" && input.trim() !== "" && typeof output === "string" && output.trim() !== "";
    if (legacyConfigured === splitConfigured) return { ready: false, reason: "دقیقاً یک روش نرخ هزینه، legacy یا input/output، باید تنظیم شود." };
    return { ready: true, reason: "Provider، Credential، نرخ و مجوز زمان‌دار تنظیم شده‌اند؛ تماس کنترل‌شده هنوز باید اجرا شود." };
  } catch (error) {
    return { ready: false, reason: `پیکربندی Provider معتبر نیست: ${error.message}` };
  }
}

function pilotRequestReadiness() {
  const request = jsonFile(pilotRequestFile);
  if (!request) return { ready: false, reason: "قرارداد ماشینی درخواست پایلوت وجود ندارد یا JSON معتبر نیست." };
  const valid = request.pilotRequestId === "HERO-PILOT-001"
    && request.stepId === "HERO-021"
    && request.documentVersion === "v1.0"
    && request.status === "approved"
    && request.ownerApproval?.approved === true
    && Array.isArray(request.acceptance?.mandatoryChecks)
    && request.acceptance.mandatoryChecks.length >= 6
    && Array.isArray(request.provider?.modelIds)
    && request.provider.modelIds.length > 0
    && request.budget?.approved === true;
  return valid
    ? { ready: true, reason: "درخواست، معیار پذیرش، Model و بودجهٔ پایلوت توسط مالک تصویب شده‌اند." }
    : { ready: false, reason: "پیشنهاد HERO-PILOT-001 آماده است؛ تصویب مالک، Model ID و سقف هزینه هنوز ثبت نشده‌اند." };
}

const recovery = recoveryReadiness();
const provider = providerReadiness();
const pilotRequest = pilotRequestReadiness();
const checks = [
  { id: "hero-021-spec", ready: fs.existsSync(spec), reason: "قرارداد HERO-021 موجود نیست." },
  { id: "readiness-document", ready: fs.existsSync(readinessDoc), reason: "سند آمادگی پایلوت موجود نیست." },
  { id: "planner-contract", ready: validatePlannerContract().length === 0, reason: "قرارداد Planner معتبر نیست." },
  { id: "training-contract", ready: validateTrainingContract().length === 0, reason: "قرارداد آموزش معتبر نیست." },
  { id: "linux-recovery-evidence", ...recovery },
  { id: "provider-authorization", ...provider },
  { id: "pilot-request", ...pilotRequest }
];

const blockers = checks.filter(check => !check.ready);
if (blockers.length > 0) {
  console.log(`PILOT CHECK BLOCKED — ${blockers.length} blocker(s)`);
  for (const blocker of blockers) console.log(`BLOCKED ${blocker.id} — ${blocker.reason}`);
  process.exitCode = 1;
} else {
  console.log("PILOT CHECK READY — all local design gates are present; execution still needs separate authorization");
}
