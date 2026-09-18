/**
 * Shared, provider-agnostic readiness evaluation for the human-facing AI
 * advisor surfaces.  It intentionally evaluates metadata only: credentials,
 * prompts and provider output never enter this result.
 */

export const AI_ADVISOR_PURPOSES = Object.freeze([
  "walkthrough-guide",
  "smart-tester",
  "form-suggestions"
]);

const PURPOSE_LABELS = Object.freeze({
  "walkthrough-guide": "مشاورهٔ Walk-Through",
  "smart-tester": "Smart Tester",
  "form-suggestions": "پیشنهاد فرم"
});

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function check(id, label, passed, code, detail) {
  return Object.freeze({ id, label, passed: passed === true, code: passed === true ? null : code, detail });
}

/**
 * Evaluate whether one active advisor Profile can be selected for a specific
 * project and surface.  The caller supplies the already-redacted latest
 * health result and authorization status; this function never reads env or a
 * credential and never changes state.
 */
export function evaluateAiAdvisorReadiness({
  purpose,
  projectId,
  provider,
  model,
  profile,
  binding,
  projectScope,
  health,
  authorization,
  now = Date.now()
} = {}) {
  if (!AI_ADVISOR_PURPOSES.includes(purpose)) throw new TypeError("Unsupported AI advisor purpose.");
  const purposeLabel = PURPOSE_LABELS[purpose];
  const checks = [
    check("provider", "Provider", Boolean(provider) && provider.mode !== "disabled" && provider.advisorCompatible !== false, "PROVIDER_NOT_READY", provider ? (provider.mode === "disabled" ? "Provider غیرفعال است." : provider.advisorCompatible === false ? "این Provider برای گفت‌وگوی مستقیم Advisor مجاز نیست." : "Provider ثبت شده است.") : "Provider در کاتالوگ ثبت نشده است."),
    check("model", "Model", Boolean(model) && Boolean(provider) && model.providerId === provider.providerId, "MODEL_NOT_REGISTERED", model ? "Model ثبت شده است." : "Model متناظر در کاتالوگ ثبت نشده است."),
    check("profile", "Profile", Boolean(profile) && profile.status === "active" && profile.role === "analyst" && profile.outputSchema === "analysis-v1" && profile.toolPolicy === "read-only", "PROFILE_CONTRACT_MISMATCH", profile ? "Profile باید Active، تحلیل‌گر، read-only و دارای analysis-v1 باشد." : "Profile سازگار پیدا نشد."),
    check("binding", "Binding پروژه", Boolean(binding) && binding.projectId === projectId && binding.role === "analyst" && binding.profileId === profile?.profileId, "PROJECT_BINDING_MISSING", binding ? "Binding پروژه ثبت شده است." : "Profile برای این پروژه به نقش تحلیل‌گر متصل نیست."),
    check("health", "Health اتصال", Boolean(health) && health.status === "healthy", "PROVIDER_HEALTH_REQUIRED", health ? (health.status === "healthy" ? "آخرین Health check موفق است." : "آخرین Health check موفق نیست.") : "برای این Provider Health check موفق ثبت نشده است."),
    check("scope", "Scope پروژه", !projectScope || (projectScope.mode === "enabled" && (projectScope.capabilities ?? []).includes(purpose)), "AI_PROJECT_SCOPE_DISABLED", !projectScope ? "Scope اختصاصی ثبت نشده؛ مرز پیش‌فرض پروژه اعمال می‌شود." : projectScope.mode !== "enabled" ? "Scope پروژه فقط محلی یا غیرفعال است." : (projectScope.capabilities ?? []).includes(purpose) ? "این قابلیت در Scope پروژه فعال است." : `قابلیت ${purposeLabel} در Scope پروژه فعال نیست.`),
    check("authorization", "مجوز نسخه‌دار", authorization?.authorized === true && (authorization.expiresAtMs === Number.POSITIVE_INFINITY || (Number.isFinite(authorization.expiresAtMs) && now < authorization.expiresAtMs)), authorization?.code ?? "LIVE_ADVISOR_AUTHORIZATION_UNAVAILABLE", authorization?.authorized === true ? "مجوز همین Project/Provider/Model/Role و قابلیت معتبر است." : "مجوز هزینهٔ همین Project/Provider/Model/Role و قابلیت معتبر نیست.")
  ];
  const failed = checks.filter(item => !item.passed);
  const selectable = failed.length === 0;
  const first = failed[0] ?? null;
  return copy({
    purpose,
    projectId: projectId ?? null,
    selectable,
    status: selectable ? "ready" : "blocked",
    code: selectable ? "ADVISOR_READY" : first.code,
    selectionNotice: selectable
      ? `${purposeLabel} با این AI آمادهٔ انتخاب است.`
      : first.detail,
    blockingReasons: failed.map(item => Object.freeze({ code: item.code, detail: item.detail })),
    checks
  });
}
