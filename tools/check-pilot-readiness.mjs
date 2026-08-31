import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./fs-policy.mjs";
import { validatePlannerContract } from "../packages/contracts/src/planner.mjs";
import { validateTrainingContract } from "../packages/contracts/src/training.mjs";

const spec = path.join(REPO_ROOT, "docs", "specs", "HERO-021-v1.0.md");
const readinessDoc = path.join(REPO_ROOT, "docs", "operations", "PILOT-READINESS.md");
const checks = [
  { id: "hero-021-spec", ready: fs.existsSync(spec), reason: "قرارداد HERO-021 موجود نیست." },
  { id: "readiness-document", ready: fs.existsSync(readinessDoc), reason: "سند آمادگی پایلوت موجود نیست." },
  { id: "planner-contract", ready: validatePlannerContract().length === 0, reason: "قرارداد Planner معتبر نیست." },
  { id: "training-contract", ready: validateTrainingContract().length === 0, reason: "قرارداد آموزش معتبر نیست." },
  { id: "linux-recovery-evidence", ready: false, reason: "شاهد مقصد Clean Linux و restore روی artifact عملیاتی هنوز ثبت نشده است؛ آزمون disposable به‌تنهایی کافی نیست." },
  { id: "provider-authorization", ready: false, reason: "Provider واقعی و مجوز مستقل آن هنوز فعال نشده است." },
  { id: "pilot-request", ready: false, reason: "درخواست و معیار پذیرش محصول پایلوت هنوز ثبت نشده است." }
];

const blockers = checks.filter(check => !check.ready);
if (blockers.length > 0) {
  console.log(`PILOT CHECK BLOCKED — ${blockers.length} blocker(s)`);
  for (const blocker of blockers) console.log(`BLOCKED ${blocker.id} — ${blocker.reason}`);
  process.exitCode = 1;
} else {
  console.log("PILOT CHECK READY — all local design gates are present; execution still needs separate authorization");
}
