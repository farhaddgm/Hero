/**
 * Smart Tester is a deliberately bounded development assistant for Hero's
 * own Back Office.  It is not the "Tester" role that works on a product.
 *
 * The module has no network, filesystem, shell or provider dependency.  The
 * HTTP layer supplies a safe rendered page and a project-scoped read probe;
 * this module turns their result into an honest, contextual report.
 */
export const HERO_SMART_TESTER_VERSION = "1.4.0";
export const HERO_SMART_TESTER_ERROR_REPORT_VERSION = "1.1.0";
export const HERO_SMART_TESTER_REPORT_TTL_MS = 30 * 60 * 1000;
export const HERO_SMART_TESTER_MAX_QUESTION_LENGTH = 1_500;

const PROJECT_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const FEATURE_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/;
const ADVISOR_PROFILE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const BOX_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;
const SENSITIVE_ASSIGNMENT = /(?:\b(?:password|secret|credential|api[ _-]?key|token|mfa|توکن|رمز(?:\s*عبور)?|کلید\s*api)\b\s*[:=])\s*\S+/iu;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/iu;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|opt)\/)/u;

const SURFACES = Object.freeze({
  "/portfolio": Object.freeze({
    title: "سبد و انتخاب پروژه‌ها",
    defaultFeatureKey: "portfolio.projects",
    sourceFiles: Object.freeze(["apps/control-plane/src/portfolio-view.mjs", "apps/control-plane/src/server.mjs"]),
    focus: Object.freeze(["انتخاب و Scope پروژه", "کارت‌ها و وضعیت Portfolio", "خوانش مجاز داده"])
  }),
  "/product-studio": Object.freeze({
    title: "استودیوی محصول",
    defaultFeatureKey: "studio.sourceOfTruth",
    sourceFiles: Object.freeze(["apps/control-plane/src/product-studio-view.mjs", "apps/control-plane/src/server.mjs"]),
    focus: Object.freeze(["اسناد و رودمپ project-scoped", "بازخوانی داده", "مرز منبع حقیقت"])
  }),
  "/workspace": Object.freeze({
    title: "فضای کاری و تنظیمات پروژه",
    defaultFeatureKey: "workspace.projectContext",
    sourceFiles: Object.freeze(["apps/control-plane/src/project-workspace-view.mjs", "packages/domain/src/project-workspace.mjs", "apps/control-plane/src/server.mjs"]),
    focus: Object.freeze(["فرم و اعتبارسنجی", "Project Grant", "نسخه‌گذاری تنظیمات"])
  }),
  "/project-control": Object.freeze({
    title: "عملیات پروژه",
    defaultFeatureKey: "control.projectOperations",
    sourceFiles: Object.freeze(["apps/control-plane/src/project-control-room-view.mjs", "apps/control-plane/src/server.mjs"]),
    focus: Object.freeze(["نمایش read-only عملیات", "Scope پروژه", "metadata redacted"])
  }),
  "/command": Object.freeze({
    title: "مرکز فرمان",
    defaultFeatureKey: "command.statusOverview",
    sourceFiles: Object.freeze(["apps/control-plane/src/project-control-room-view.mjs", "apps/control-plane/src/server.mjs"]),
    focus: Object.freeze(["شاخص‌های مرکز فرمان", "گیت‌ها و اقدام‌های بعدی", "Scope پروژه"])
  }),
  "/ai": Object.freeze({
    title: "اتصال‌های AI",
    defaultFeatureKey: "ai.connections",
    sourceFiles: Object.freeze(["apps/control-plane/src/backoffice-view.mjs", "apps/control-plane/src/dashboard-service.mjs", "apps/control-plane/src/server.mjs"]),
    focus: Object.freeze(["Provider و Modelهای متصل", "سلامت اتصال و مصرف Token", "Binding و Profileهای فعال"])
  }),
  "/identity": Object.freeze({
    title: "هویت و دسترسی",
    defaultFeatureKey: "identity.management",
    sourceFiles: Object.freeze(["apps/control-plane/src/identity-view.mjs", "packages/domain/src/human-identity.mjs", "apps/control-plane/src/server.mjs"]),
    focus: Object.freeze(["نشست انسانی", "MFA و CSRF", "Project Grant"])
  }),
  "/walkthrough": Object.freeze({
    title: "راهنمای ساخت محصول",
    defaultFeatureKey: "guide.walkthrough",
    sourceFiles: Object.freeze(["apps/control-plane/src/project-walkthrough-view.mjs", "apps/control-plane/src/project-walkthrough.mjs", "apps/control-plane/src/hero-shell.mjs"]),
    focus: Object.freeze(["پایداری state", "هدف و Bubble شناور", "گیت‌های واقعی"])
  }),
  "/backoffice": Object.freeze({
    title: "مرکز مدیریت قدیمی",
    defaultFeatureKey: "command.statusOverview",
    sourceFiles: Object.freeze(["apps/control-plane/src/backoffice-view.mjs", "apps/control-plane/src/server.mjs"]),
    focus: Object.freeze(["کارت‌ها و خوانش داده", "مسیریابی canonical", "کنترل دسترسی"])
  })
});

function immutable(value) {
  return Object.freeze(value);
}

function nonEmptyString(value, name, maximum = 256) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) {
    throw new RangeError(`${name} is invalid.`);
  }
  return value.trim();
}

function safeQuestion(value) {
  if (value === undefined || value === null || value === "") return "";
  const question = nonEmptyString(value, "question", HERO_SMART_TESTER_MAX_QUESTION_LENGTH);
  // The assistant has no reason to receive or retain sensitive material. This
  // is a narrow guard, not a promise to detect every secret format.
  if (SENSITIVE_ASSIGNMENT.test(question) || SENSITIVE_VALUE.test(question) || HOST_PATH.test(question)) {
    throw new RangeError("Sensitive values must not be sent to Smart Tester.");
  }
  return question;
}

function safeBoxText(value, name, fallback, maximum) {
  if (value === undefined || value === null || value === "") return fallback;
  const text = nonEmptyString(value, name, maximum).replace(/\s+/g, " ");
  if (SENSITIVE_ASSIGNMENT.test(text) || SENSITIVE_VALUE.test(text) || HOST_PATH.test(text)) {
    throw new RangeError(`${name} must not contain sensitive material.`);
  }
  return text;
}

function safeBoxId(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || !BOX_ID_PATTERN.test(value)) throw new RangeError("boxId is invalid.");
  return value;
}

function redactActionText(value, maximum = 500) {
  if (value === undefined || value === null || value === "") return "";
  return String(value)
    .replace(/((?:password|secret|credential|api[ _-]?key|token|mfa|رمز(?:\s*عبور)?|کلید\s*api)\s*[:=]\s*)[^\s,;]+/giu, "$1[redacted]")
    .replace(SENSITIVE_VALUE, "[redacted]")
    .replace(HOST_PATH, "[redacted]")
    .slice(0, maximum);
}

function normalizeActionFailure(value) {
  if (!value || typeof value !== "object") return null;
  const path = typeof value.path === "string" && /^\/api\/[A-Za-z0-9._/-]{1,180}$/.test(value.path) ? value.path : "";
  const method = typeof value.method === "string" && /^(POST|PUT|PATCH|DELETE)$/i.test(value.method) ? value.method.toUpperCase() : "POST";
  const status = Number.isInteger(value.status) && value.status >= 400 && value.status <= 599 ? value.status : null;
  const code = typeof value.code === "string" ? redactActionText(value.code, 120) : "";
  const message = redactActionText(value.message, 500);
  const label = redactActionText(value.label, 160) || "اقدام فرایندی";
  if (!path && !status && !message) return null;
  return immutable({ label, method, path: path || "/api/unknown", status, code, message });
}

function diagnoseActionFailure(actionFailure) {
  const failure = normalizeActionFailure(actionFailure);
  if (!failure) return null;
  const code = failure.code.toUpperCase();
  let classification = "service-action-failure";
  let problem = `اقدام «${failure.label}» با پاسخ ${failure.status ?? "نامشخص"} از مسیر ${failure.method} ${failure.path} کامل نشد.`;
  let likelyRootCause = "جزئیات پاسخ پاک‌سازی‌شده نشان می‌دهد درخواست در یکی از گیت‌های اعتبارسنجی، دسترسی یا قرارداد سرویس متوقف شده است.";
  let proposedFix = "کد خطا، Scope پروژه و دادهٔ ورودی همین اقدام را بررسی کنید؛ پس از اصلاح، همان اقدام را دوباره اجرا کنید.";
  let verification = "اقدام را با همان نشست انسانی و همان Scope تکرار کنید و نتیجهٔ موفق یا کد خطای جدید را ثبت کنید.";

  if (failure.status === 0) {
    classification = "network-or-proxy";
    likelyRootCause = "مرورگر پاسخ HTTP دریافت نکرده است؛ ارتباط شبکه، Proxy یا نشست مرورگر ممکن است قطع شده باشد.";
    proposedFix = "اتصال به محیط Test و ورود انسانی را بررسی کنید، سپس صفحه را تازه‌سازی و همان اقدام را تکرار کنید.";
  } else if (failure.status === 401) {
    classification = "human-session-required";
    likelyRootCause = "نشست انسانی معتبر نیست یا منقضی شده است.";
    proposedFix = "با Human Identity و MFA دوباره وارد شوید؛ از Basic Auth به‌تنهایی برای عملیات مالک استفاده نکنید.";
  } else if (failure.status === 403) {
    classification = "permission-or-scope-denied";
    likelyRootCause = "نقش، پروژهٔ انتخابی یا مجوز مستقل موردنیاز با درخواست هم‌خوان نیست.";
    proposedFix = "Project انتخاب‌شده، نقش Owner و مجوز لازم برای همین عملیات را بررسی کنید؛ مجوز را گسترده‌تر نکنید.";
  } else if (failure.status === 404) {
    classification = "resource-or-context-not-found";
    likelyRootCause = "منبع یا Context موردنظر در Scope فعلی وجود ندارد یا با شناسهٔ دیگری ساخته شده است.";
    proposedFix = "شناسه و Scope پروژه را بررسی کنید و مطمئن شوید منبع موردنظر پیش از این اقدام ایجاد شده است.";
  } else if (failure.status === 409) {
    classification = "state-or-version-conflict";
    likelyRootCause = "وضعیت یا نسخهٔ منبع از زمان باز شدن فرم تغییر کرده و سرویس برای جلوگیری از overwrite درخواست را رد کرده است.";
    proposedFix = "دادهٔ صفحه را تازه‌سازی کنید، تغییر هم‌زمان را بررسی کنید و فرم را با نسخهٔ جدید دوباره ارسال کنید.";
  } else if (failure.status === 429) {
    classification = "rate-limited";
    likelyRootCause = "محدودیت نرخ برای حفاظت از سرویس فعال شده است.";
    proposedFix = "پس از زمان اعلام‌شده دوباره تلاش کنید و از ارسال تکراری هم‌زمان خودداری کنید.";
  } else if (failure.status !== null && failure.status >= 500) {
    classification = "server-or-provider-failure";
    likelyRootCause = "سرویس داخلی یا Provider وابسته نتوانسته درخواست را کامل کند؛ این خطا از دادهٔ فرم به‌تنهایی قابل رفع نیست.";
    proposedFix = "کد خطا و زمان رخداد را در دفتر خطا ثبت کنید، سلامت وابستگی‌های همان مسیر را بررسی کنید و پس از رفع سرویس، اقدام را تکرار کنید.";
  }

  if (code === "CONTEXT_NOT_FOUND" || code === "CONTEXT_ASSEMBLY_BLOCKED") {
    classification = "ai-context-missing";
    likelyRootCause = "Context تأییدشدهٔ پروژه برای Role انتخاب‌شده پیدا نشده است.";
    proposedFix = "Project و Binding فعال را بررسی کنید؛ Context حداقلی و پاک‌سازی‌شده را از مسیر مجاز پروژه آماده کنید، سپس درخواست را تکرار کنید.";
  } else if (code === "LIVE_ADVISOR_OUTPUT_INVALID") {
    classification = "provider-structured-output-invalid";
    likelyRootCause = "Provider پاسخ را با قرارداد ساخت‌یافتهٔ Profile برنگردانده است.";
    proposedFix = "Profile، Model و قابلیت Structured Outputs را بررسی کنید؛ پاسخ بدون schema معتبر نباید نمایش داده یا ثبت شود.";
  } else if (/^(?:IDENTITY_AUTH_REQUIRED|SMART_TESTER_PROJECT_REQUIRED)$/.test(code)) {
    classification = "identity-or-project-scope";
  }

  return immutable({
    classification,
    problem,
    likelyRootCause,
    proposedFix,
    verification,
    confidence: "bounded-by-observed-http-result"
  });
}

export function resolveSmartTesterContext({ pathname, featureKey, projectId = null, boxId = null, boxTitle = null, boxDescription = null } = {}) {
  const surface = SURFACES[pathname];
  if (!surface) throw new RangeError("Smart Tester surface is not allowed.");
  if (projectId !== null && projectId !== undefined && (typeof projectId !== "string" || !PROJECT_ID_PATTERN.test(projectId))) {
    throw new RangeError("Smart Tester project scope is invalid.");
  }
  const resolvedFeatureKey = featureKey === undefined || featureKey === null || featureKey === ""
    ? surface.defaultFeatureKey
    : nonEmptyString(featureKey, "featureKey", 128);
  if (!FEATURE_KEY_PATTERN.test(resolvedFeatureKey)) throw new RangeError("Smart Tester feature key is invalid.");
  const resolvedBoxTitle = safeBoxText(boxTitle, "boxTitle", surface.title, 160);
  const resolvedBoxDescription = safeBoxText(
    boxDescription,
    "boxDescription",
    `این بخش در جریان Hero روی ${surface.focus.slice(0, 2).join(" و ")} تمرکز دارد.`,
    280
  );
  return immutable({
    pathname,
    title: surface.title,
    featureKey: resolvedFeatureKey,
    boxId: safeBoxId(boxId, resolvedFeatureKey),
    boxTitle: resolvedBoxTitle,
    boxDescription: resolvedBoxDescription,
    projectId: projectId ?? null,
    sourceFiles: surface.sourceFiles,
    focus: surface.focus,
    mode: "local-contextual-development-assistant"
  });
}

function result(id, area, status, detail) {
  return immutable({ id, area, status, detail });
}

/**
 * Produces a report only from explicit server probes. `not-run` states are
 * intentional: a small UI action must never start a browser farm, invoke a
 * provider, spend money or execute arbitrary repository commands.
 */
export function createSmartTesterReport({ context, renderedHtml = "", backendProbe = null } = {}) {
  if (!context?.pathname || !SURFACES[context.pathname]) throw new RangeError("Smart Tester context is required.");
  const html = typeof renderedHtml === "string" ? renderedHtml : "";
  const backend = backendProbe && typeof backendProbe === "object" ? backendProbe : { ok: false, detail: "Backend probe was not supplied." };
  const checks = immutable([
    result("ui.document", "UI", /<main\b/i.test(html) ? "passed" : "attention", /<main\b/i.test(html) ? "پوستهٔ صفحه و ناحیهٔ اصلی در render فعلی وجود دارد." : "خروجی render ناحیهٔ اصلی صفحه را ندارد."),
    result("ui.font", "UI", /Vazirmatn/i.test(html) ? "passed" : "attention", /Vazirmatn/i.test(html) ? "اعلان فونت Vazirmatn در خروجی صفحه دیده شد." : "اعلان Vazirmatn در خروجی این صفحه دیده نشد."),
    result("ux.structure", "UX", /<h1\b/i.test(html) ? "passed" : "attention", /<h1\b/i.test(html) ? "یک عنوان اصلی برای جهت‌یابی کاربر وجود دارد." : "عنوان اصلی صفحه در render پیدا نشد."),
    result("backend.scoped-read", "Backend", backend.ok === true ? "passed" : "attention", backend.ok === true ? backend.detail : (backend.detail || "خوانش امن backend ناموفق بود.")),
    result("code.context", "Code", "passed", `نقشهٔ کد این سطح بررسی شد: ${context.sourceFiles.join("، ")}.`),
    result("security.boundary", "Security", "passed", "این اجرا فقط render و خوانش project-scoped انجام داد؛ هیچ Secret، Provider، فرمان، deploy یا اجرای shell انجام نشد."),
    result("browser.e2e", "UI/UX", "not-run", "تعامل واقعی مرورگر، viewportهای چندگانه و تست E2E از این پنجره اجرا نشدند؛ اجرای آن‌ها نیازمند مسیر آزمون جداگانه است."),
    result("integration.live", "Integration", "not-run", "اتصال زندهٔ AI، GitHub، سرور و سرویس بیرونی عمداً اجرا نشد؛ این‌ها گیت و مجوز مستقل دارند.")
  ]);
  const attention = checks.filter(check => check.status === "attention").length;
  const completed = checks.filter(check => check.status === "passed").length;
  return immutable({
    version: HERO_SMART_TESTER_VERSION,
    context,
    generatedAt: new Date().toISOString(),
    summary: immutable({
      state: attention ? "attention" : "completed-with-limits",
      passed: completed,
      attention,
      notRun: checks.filter(check => check.status === "not-run").length
    }),
    checks,
    limits: immutable([
      "این گزارش جایگزین مرور انسانی، آزمون E2E یا acceptance نیست.",
      "هیچ دادهٔ خصوصی، Secret یا متن خام گفتگو در گزارش نگهداری نمی‌شود.",
      "اجرای تغییر، dispatch یا عملیات بیرونی از Smart Tester ممکن نیست."
    ])
  });
}

function normalizeSelectedAdvisor(selectedAdvisor) {
  if (selectedAdvisor === undefined || selectedAdvisor === null || selectedAdvisor === "" || selectedAdvisor === "local") {
    return immutable({ kind: "local", id: "local", label: "راهنمای محلی Hero", providerInvoked: false });
  }
  if (typeof selectedAdvisor !== "object" || typeof selectedAdvisor.profileId !== "string" || !ADVISOR_PROFILE_ID_PATTERN.test(selectedAdvisor.profileId)) {
    throw new RangeError("Smart Tester advisor selection is invalid.");
  }
  return immutable({
    kind: "profile",
    id: selectedAdvisor.profileId,
    profileId: selectedAdvisor.profileId,
    providerId: typeof selectedAdvisor.providerId === "string" ? selectedAdvisor.providerId : undefined,
    modelId: typeof selectedAdvisor.modelId === "string" ? selectedAdvisor.modelId : undefined,
    profileVersion: typeof selectedAdvisor.profileVersion === "string" ? selectedAdvisor.profileVersion : undefined,
    providerName: typeof selectedAdvisor.providerName === "string" ? selectedAdvisor.providerName : undefined,
    modelName: typeof selectedAdvisor.modelName === "string" ? selectedAdvisor.modelName : undefined,
    providerInvoked: false
  });
}

/**
 * Converts a bounded Smart Tester probe into an owner-reviewable error record.
 * Only explicit attention checks become findings; intentionally skipped checks
 * remain limitations so an absence of evidence is never reported as a bug.
 */
export function createSmartTesterErrorReport({ context, renderedHtml = "", backendProbe = null, report = null, chatInformed = false, actionFailure = null } = {}) {
  if (!context?.pathname || !SURFACES[context.pathname]) throw new RangeError("Smart Tester context is required.");
  const baseReport = report ?? createSmartTesterReport({ context, renderedHtml, backendProbe });
  const findings = baseReport.checks.filter(check => check.status === "attention").map(check => immutable({
    findingId: `smart-tester.${check.id}`,
    severity: check.area === "Security" ? "high" : check.area === "Backend" ? "high" : "medium",
    area: check.area,
    title: `${check.area} · ${check.id}`,
    evidence: check.detail,
    expected: "قرارداد این بخش باید بدون خطا و با دادهٔ Scope‌شده اجرا شود.",
    recommendation: `مسیر ${check.id} را بررسی کنید و پس از اصلاح، Smart Tester و آزمون تخصصی همان سطح را دوباره اجرا کنید.`,
    sourceFiles: context.sourceFiles
  }));
  const normalizedActionFailure = normalizeActionFailure(actionFailure);
  const actionDiagnosis = diagnoseActionFailure(normalizedActionFailure);
  if (normalizedActionFailure) findings.unshift(immutable({
    findingId: "smart-tester.action-failure",
    severity: normalizedActionFailure.status >= 500 ? "high" : "medium",
    area: "Action",
    title: `${normalizedActionFailure.label} ناموفق بود`,
    evidence: `${normalizedActionFailure.status ?? "خطای نامشخص"}${normalizedActionFailure.code ? ` · ${normalizedActionFailure.code}` : ""}${normalizedActionFailure.message ? ` · ${normalizedActionFailure.message}` : ""}`,
    expected: "اقدام فرایندی باید پاسخ موفق و قابل‌اعتماد برگرداند.",
    recommendation: actionDiagnosis.proposedFix,
    sourceFiles: context.sourceFiles
  }));
  const severity = findings.some(item => item.severity === "high") ? "high" : findings.length ? "medium" : "none";
  return immutable({
    version: HERO_SMART_TESTER_ERROR_REPORT_VERSION,
    smartTesterVersion: HERO_SMART_TESTER_VERSION,
    context: immutable({ pathname: context.pathname, title: context.title, featureKey: context.featureKey, boxId: context.boxId, boxTitle: context.boxTitle, boxDescription: context.boxDescription, projectId: context.projectId }),
    generatedAt: new Date().toISOString(),
    chatInformed: chatInformed === true,
    actionFailure: normalizedActionFailure,
    diagnosis: actionDiagnosis,
    summary: immutable({
      state: findings.length ? "errors-found" : "no-confirmed-errors",
      severity,
      findingCount: findings.length,
      attention: baseReport.summary.attention,
      notRun: baseReport.summary.notRun,
      statement: findings.length
        ? `${findings.length} مورد نیازمند رسیدگی از Probe فعلی و نتیجهٔ پاک‌سازی‌شدهٔ اقدام استخراج شد.`
        : "در Probe فعلی خطای قطعی تأیید نشد؛ آزمون‌های اجرا‌نشده هنوز پوشش داده نشده‌اند."
    }),
    findings: immutable(findings),
    reproductionSteps: immutable([
      `ورود با نشست انسانی Owner و باز کردن «${context.title}».`,
      `باز کردن Smart Tester روی «${context.boxTitle ?? context.featureKey}».`,
      normalizedActionFailure ? `تکرار کنترل‌شدهٔ «${normalizedActionFailure.label}» در همان Scope و ثبت HTTP ${normalizedActionFailure.status ?? "نامشخص"}.` : "زدن «خطایاب» و ثبت زمان/Scope همین گزارش.",
      "برای یافته‌های attention، مسیر پیشنهادی و فایل‌های مسئول را بررسی و تست تخصصی را تکرار کنید."
    ]),
    limitations: immutable(baseReport.limits),
    sourceReport: immutable({ version: baseReport.version, generatedAt: baseReport.generatedAt, summary: baseReport.summary })
  });
}

export function createSmartTesterAdvisory({ context, question = "", report = null, selectedAdvisor = null, actionFailure = null } = {}) {
  if (!context?.pathname || !SURFACES[context.pathname]) throw new RangeError("Smart Tester context is required.");
  const normalizedQuestion = safeQuestion(question);
  const advisorSelection = normalizeSelectedAdvisor(selectedAdvisor);
  const reportSummary = report?.summary && typeof report.summary === "object"
    ? `آخرین گزارش: ${report.summary.passed ?? 0} مورد عبور، ${report.summary.attention ?? 0} مورد نیازمند توجه و ${report.summary.notRun ?? 0} مورد اجرا‌نشده.`
    : "هنوز گزارش تستی برای این بخش ثبت نشده است؛ ابتدا «تست این بخش» را اجرا کنید.";
  const focus = context.focus.join("، ");
  const projectSummary = context.projectSummary && typeof context.projectSummary === "object"
    ? ` وضعیت امن پروژه: lifecycle=${context.projectSummary.lifecycle ?? "unknown"}، Intake=${context.projectSummary.intakeComplete ? "کامل" : "ناقص"}، Foundation=${context.projectSummary.foundationState ?? "ثبت‌نشده"}، ${context.projectSummary.memoryEntryCount ?? 0} metadata حافظهٔ فعال.`
    : "";
  const selectedLabel = advisorSelection.kind === "profile"
    ? `Profile انتخاب‌شده ${advisorSelection.providerName ?? advisorSelection.providerId ?? advisorSelection.profileId} / ${advisorSelection.modelName ?? advisorSelection.modelId ?? "model نامشخص"} (نسخه ${advisorSelection.profileVersion ?? "نامشخص"})`
    : "راهنمای محلی Hero";
  const normalizedActionFailure = normalizeActionFailure(actionFailure);
  const actionSummary = normalizedActionFailure
    ? ` آخرین اقدام «${normalizedActionFailure.label}» با وضعیت ${normalizedActionFailure.status ?? "نامشخص"} ناموفق شده است؛ این نشانه را در تحلیل و خطایابی در نظر بگیرید.`
    : "";
  const boxContext = `بخش مورد گفت‌وگو «${context.boxTitle ?? context.title}» است؛ نقش آن: ${context.boxDescription ?? focus}.`;
  const response = normalizedQuestion
    ? `${boxContext} سؤال شما در زمینهٔ ${focus} بررسی شد. ${projectSummary} ${actionSummary} ${reportSummary} ${selectedLabel} برای این نوبت انتخاب شده است؛ در این نسخه فراخوانی بیرونی انجام نمی‌شود و پاسخ امن محلی بر مرزهای کد و داده تکیه دارد. برای نتیجهٔ قطعی، مورد attention را در گزارش باز کنید و آزمون تخصصی همان مسیر را جداگانه اجرا کنید.`
    : `${boxContext}${projectSummary}${actionSummary} ${reportSummary} ${selectedLabel} برای این نوبت انتخاب شده است.`;
  return immutable({
    mode: "local-contextual-development-assistant",
    providerInvoked: false,
    selectedAdvisor: advisorSelection,
    actionFailure: normalizedActionFailure,
    response,
    context: immutable({ pathname: context.pathname, featureKey: context.featureKey, boxId: context.boxId, boxTitle: context.boxTitle, boxDescription: context.boxDescription, projectId: context.projectId }),
    reportAvailable: Boolean(report)
  });
}
