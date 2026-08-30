export const CRITICAL_PRINCIPLES_CONTRACT_VERSION = "1.0";

export const PRINCIPLE_SCOPES = Object.freeze(["hero", "product"]);
export const PRINCIPLE_STATUSES = Object.freeze(["proposed", "approved", "rejected", "retired"]);
export const PRINCIPLE_DECISIONS = Object.freeze(["approved", "rejected"]);
export const PRINCIPLE_CONTROL_POINTS = Object.freeze([
  "project-intake",
  "planning",
  "team-assignment",
  "development",
  "test",
  "release-test",
  "release-production"
]);

export const HERO_CRITICAL_PRINCIPLES = Object.freeze([
  Object.freeze({
    principleId: "hero.clean-room",
    scope: "hero",
    title: "استقلال و Clean-room",
    statement: "هیچ کد، داده، Secret، runtime یا سرویس پروژهٔ دیگری وارد Hero نمی‌شود.",
    rationale: "مرز پروژه باید قابل انتقال، قابل حسابرسی و بدون وابستگی پنهان بماند.",
    enforcement: "block",
    controlPoints: Object.freeze(["project-intake", "planning", "development", "release-test"])
  }),
  Object.freeze({
    principleId: "hero.fail-closed",
    scope: "hero",
    title: "توقف در ابهام و خطا",
    statement: "نبود نسخه، مجوز، پیش‌نیاز، شاهد یا وضعیت معتبر، ادامهٔ کار را متوقف می‌کند.",
    rationale: "سیستم نباید موفقیت یا اختیار را حدس بزند.",
    enforcement: "block",
    controlPoints: Object.freeze(PRINCIPLE_CONTROL_POINTS)
  }),
  Object.freeze({
    principleId: "hero.evidence-first",
    scope: "hero",
    title: "هر ادعا با شاهد",
    statement: "هیچ خروجی Done، تست‌شده یا منتشرشده بدون Evidence واقعی، نسخه‌دار و قابل بازتولید اعلام نمی‌شود.",
    rationale: "گزارش قابل اعتماد باید از نتیجهٔ قابل بررسی جدا نباشد.",
    enforcement: "block",
    controlPoints: Object.freeze(["development", "test", "release-test", "release-production"])
  }),
  Object.freeze({
    principleId: "hero.version-integrity",
    scope: "hero",
    title: "تمامیت نسخه و Artifact",
    statement: "نسخهٔ تست و production باید به همان Artifact، commit و قرارداد نسخه‌دار متصل باشند؛ تغییر خاموش مجاز نیست.",
    rationale: "آنچه تست شده باید دقیقاً همان چیزی باشد که برای انتشار تأیید می‌شود.",
    enforcement: "block",
    controlPoints: Object.freeze(["planning", "development", "test", "release-test", "release-production"])
  }),
  Object.freeze({
    principleId: "hero.test-before-production",
    scope: "hero",
    title: "تست پیش از production",
    statement: "هیچ Artifactی پیش از استقرار در محیط test و عبور از تست و بازبینی معتبر، نامزد production نمی‌شود.",
    rationale: "production محل آزمایش نیست.",
    enforcement: "block",
    controlPoints: Object.freeze(["release-production"])
  }),
  Object.freeze({
    principleId: "hero.owner-controls-production",
    scope: "hero",
    title: "کنترل انسانی production",
    statement: "انتقال به production همیشه به تأیید صریح مالک و مجوز مستقل عملیات حساس نیاز دارد.",
    rationale: "اختیار توسعه یا خودکارسازی هرگز مجوز انتشار عملیاتی نیست.",
    enforcement: "block",
    controlPoints: Object.freeze(["release-production"])
  }),
  Object.freeze({
    principleId: "hero.secret-free-evidence",
    scope: "hero",
    title: "شاهد بدون Secret",
    statement: "Secret، token، password، مسیر میزبان و دادهٔ حساس در کد، لاگ، Artifact یا Sheet ثبت نمی‌شود.",
    rationale: "قابلیت مشاهده نباید به نشت اطلاعات تبدیل شود.",
    enforcement: "block",
    controlPoints: Object.freeze(["project-intake", "planning", "development", "test", "release-test", "release-production"])
  }),
  Object.freeze({
    principleId: "hero.recovery-ready",
    scope: "hero",
    title: "بازگشت و بازیابی روشن",
    statement: "هر تغییر مهم باید مسیر rollback یا recovery شناخته‌شده و شاهدِ قابل بررسی داشته باشد.",
    rationale: "تحویل بدون راه بازگشت، ریسک عملیاتی کنترل‌نشده است.",
    enforcement: "block",
    controlPoints: Object.freeze(["development", "test", "release-production"])
  })
]);

export function getCriticalPrinciplesContractSummary() {
  return Object.freeze({
    version: CRITICAL_PRINCIPLES_CONTRACT_VERSION,
    scopes: PRINCIPLE_SCOPES,
    statuses: PRINCIPLE_STATUSES,
    decisions: PRINCIPLE_DECISIONS,
    controlPoints: PRINCIPLE_CONTROL_POINTS,
    enforcement: "block",
    sourceOfTruth: "versioned-principle-registry",
    inheritedByProducts: true,
    ownerReview: "project-owner",
    catalogSize: HERO_CRITICAL_PRINCIPLES.length
  });
}

export function validateCriticalPrinciplesContract() {
  const errors = [];
  if (CRITICAL_PRINCIPLES_CONTRACT_VERSION !== "1.0") errors.push("Unexpected critical principles contract version.");
  const ids = new Set();
  for (const principle of HERO_CRITICAL_PRINCIPLES) {
    if (!principle.principleId || ids.has(principle.principleId)) errors.push(`Principle ID is missing or duplicated: ${principle.principleId}.`);
    ids.add(principle.principleId);
    if (principle.scope !== "hero") errors.push(`Hero baseline principle has an invalid scope: ${principle.principleId}.`);
    if (principle.enforcement !== "block") errors.push(`Critical principle must block on failure: ${principle.principleId}.`);
    if (!principle.controlPoints.every(point => PRINCIPLE_CONTROL_POINTS.includes(point))) {
      errors.push(`Principle has an invalid control point: ${principle.principleId}.`);
    }
  }
  for (const required of ["hero.clean-room", "hero.fail-closed", "hero.evidence-first", "hero.version-integrity", "hero.test-before-production", "hero.owner-controls-production", "hero.secret-free-evidence", "hero.recovery-ready"]) {
    if (!ids.has(required)) errors.push(`Required baseline principle is missing: ${required}.`);
  }
  return errors;
}
