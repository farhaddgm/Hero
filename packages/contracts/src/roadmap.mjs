/**
 * Versioned, safe projection of the current Hero priority ledger.
 *
 * This is intentionally metadata only: it contains no credentials, request
 * text, prompts, model output, or authorization material.
 */
export const HERO_OPEN_ROADMAP_VERSION = "2026-09-05";

export const HERO_OPEN_ROADMAP = Object.freeze([
  [1, 2, "یکسان‌سازی دامنهٔ Test", "تأیید Test؛ نیازمند ثبت تصمیم مالک", "تصمیم رسمی دامنه را ثبت کن"],
  [2, 3, "تصمیم هم‌سرور یا VM جدا", "نیازمند تصمیم مالک", "تصمیم و دلیل را ثبت کن"],
  [3, 6, "معیار استفادهٔ عملیاتی Test", "نیازمند تصمیم مالک", "health، auth، persistence و rollback را تأیید کن"],
  [4, 7, "مالک و جانشین عملیاتی", "نیازمند تصمیم مالک", "نام نقش و مسیر escalation را بده"],
  [5, 8, "سیاست نگهداری Log/Evidence", "نیازمند تصمیم مالک", "مدت نگهداری و محل امن را تعیین کن"],
  [6, 11, "اتصال اجرای واقعی host", "blocker خارجی", "ادمین Runner محدود Hero را وصل کند"],
  [7, 12, "کاربر محدود hero-ops", "blocker خارجی", "بدون Docker عمومی و sudo عمومی ایجاد شود"],
  [8, 13, "بررسی wrapperهای Test", "blocker خارجی", "hero-test-* با sudo -n بررسی شود"],
  [9, 14, "تعیین تکلیف compose.test.yaml", "blocker خارجی", "مالکیت و محتوای فایل بررسی و تصمیم‌گیری شود"],
  [10, 18, "Secret runtime Test", "تأیید Test؛ نیازمند audit محل نگهداری", "فقط در Secret Store یا فایل 600 ساخته شود"],
  [11, 19, "preflight کانفیگ Test", "blocker خارجی؛ preflight جاری به‌علت Secretهای PostgreSQL متوقف است", "Secretهای Test را ثبت و preflight را دوباره اجرا کن"],
  [12, 20, "Evidence ایزولاسیون", "تکمیل Test", "project/volume/network و bind localhost ثبت شد"],
  [13, 21, "migrationهای 001 تا 006 در Test", "تأیید قبلی؛ نیازمند تکرار با candidate جاری", "پس از اتصال PostgreSQL مستقل، migrationها را دوباره ثبت کن"],
  [14, 22, "readiness PostgreSQL و Hero", "تأیید health قبلی؛ نیازمند تکرار readiness پایدار", "pg_isready و /ready سخت‌گیرانه را پس از اتصال DB تأیید کن"],
  [15, 23, "append-only Event Store", "تأیید قبلی؛ نیازمند تکرار با candidate جاری", "guardهای append-only را با persistence جاری تأیید کن"],
  [16, 27, "Snapshot یازده Registry و Dashboard", "تأیید قبلی؛ نیازمند تکرار با candidate جاری", "۱۱ Projection را پس از اتصال DB در Test ذخیره کن"],
  [17, 28, "hydration بعد از restart", "تأیید قبلی؛ نیازمند تکرار با candidate جاری", "قبل/بعد restart را با persistence جاری مقایسه کن"],
  [18, 29, "تشخیص Snapshot ناقص/قدیمی", "تأیید Test؛ نیازمند سناریوی خرابی", "در Test با دادهٔ واقعی اجرا شود"],
  [19, 30, "Backup/Restore با checksum", "synthetic موفق؛ Clean Linux مقصد blocker خارجی", "restore واقعی روی مقصد Clean Linux ثبت شود"],
  [20, 32, "mapping همهٔ Domain Eventها", "تکمیل محلی/نیازمند Test", "پوشش mapping در Test تأیید شود"],
  [21, 33, "replay کامل Registryها", "تکمیل محلی/نیازمند Test", "rebuild واقعی read model در Test اجرا شود"],
  [22, 34, "rebuild dry-run و digest", "تکمیل محلی/نیازمند Test", "digest در Test بازتولید شود"],
  [23, 37, "projection پایدار commandهای باقی‌مانده", "تکمیل محلی/نیازمند Test", "state از Eventهای append-only در Test تأیید شود"],
  [24, 38, "pagination و cursor همهٔ read modelها", "تکمیل محلی/نیازمند Test", "روی حجم واقعی Test بررسی شود"],
  [25, 40, "redaction جامع Projection/Diagnostic", "تکمیل محلی/نیازمند Test", "با دادهٔ Secret-shaped در Test آزمون شود"],
  [26, 41, "Provider/Model پیش‌فرض نقش‌های اصلی", "نیازمند تصمیم مالک", "یک انتخاب نسخه‌دار ثبت کن"],
  [27, 43, "Binding مستقل AI برای Skill", "تکمیل محلی/نیازمند Test", "مسیر مستقل Skill در Test تأیید شود"],
  [28, 45, "فهرست Model مجاز/deprecated", "نیازمند تصمیم مالک", "allow-list رسمی بده"],
  [29, 47, "readiness واقعی Adapterها", "blocker مجوزی", "verifier و مجوز مستقل لازم است"],
  [30, 48, "سقف هزینهٔ Provider/Task", "نیازمند تصمیم مالک", "cap عددی و رفتار توقف را تعیین کن"],
  [31, 49, "timeout، retry و circuit breaker", "تکمیل محلی/نیازمند Test", "رفتار bounded و recovery در Test تأیید شود"],
  [32, 52, "AI پیش‌فرض و override تیم‌ها", "نیازمند تصمیم مالک", "برای هر تیم Binding روشن کن"],
  [33, 54, "دورهٔ freshness دانش", "نیازمند تصمیم مالک", "validUntil و stale policy را تعیین کن"],
  [34, 55, "approval دانش جمع‌آوری‌شده", "تکمیل محلی/نیازمند Test", "فقط دانش تأییدشده در Test وارد Team شود"],
  [35, 56, "Golden Dataset یازده تیم", "blocker مالک", "ورودی، خروجی مطلوب و خطاها را بده"],
  [36, 58, "Performance Review دوره‌ای", "تکمیل محلی/نیازمند Test", "scoreهای پنج‌گانه با evidence ثبت شود"],
  [37, 60, "چرخهٔ Evaluation به Training", "تکمیل محلی/نیازمند Test", "هر finding در Test به اقدام آموزشی وصل شود"],
  [38, 67, "اتصال Planner به readiness تیم", "تکمیل محلی/نیازمند Test", "تخصیص تیم ناآماده در Test مسدود شود"],
  [39, 68, "اتصال Advisor به Evidence واقعی", "تکمیل محلی/نیازمند Test", "توصیهٔ مبتنی بر Evidence در Test تأیید شود"],
  [40, 72, "آزمون keyboard، focus و RTL", "تکمیل automated/نیازمند مرورگر Test", "مسیرهای اصلی با مرورگر بدون mouse بررسی شود"],
  [41, 73, "آزمون responsive موبایل/دسکتاپ", "تکمیل automated/نیازمند مرورگر Test", "اندازه‌های واقعی مرورگر بررسی شود"],
  [42, 79, "access audit قابل مشاهده برای مالک", "تأیید قبلی؛ نیازمند اجرای audit با persistence جاری", "خروجی audit را پس از اتصال DB روی Test تأیید کن"],
  [43, 81, "install دقیق با lockfile", "تأیید محلی؛ نیازمند اجرای CI", "workflow CI اجرا شود"],
  [44, 83, "Environment تست GitHub", "نیازمند ادمین GitHub", "reviewer اجباری فعال شود"],
  [45, 85, "استقرار Candidate در Test", "انجام شد؛ parity و health/auth/restart تأیید شد", "برای promotion فقط rollback/recovery و مجوزهای جدا باقی است"],
  [46, 86, "smoke و security روی Test", "smoke خودکار انجام شد؛ ۱۷ مسیر read-only تأیید شد؛ مرور دستی کامل باقی است", "review دستی Caddy/شبکه/دسترسی ثبت شود"],
  [47, 87, "Test Evidence و review مالک", "نیازمند تصمیم مالک", "Evidence کامل را تأیید کن"],
  [48, 88, "rollback نسخهٔ Test", "انجام شد؛ recovery عملیاتی باقی است", "recovery از backup/checksum روی Clean Linux انجام شود"],
  [49, 89, "recovery روی Clean Linux", "blocker خارجی", "restore واقعی و checksum ثبت شود"],
  [50, 91, "انتخاب درخواست کوچک Pilot", "نیازمند تصمیم مالک", "یک feature کوچک و قابل rollback معرفی کن"]
].map(([order, reference, title, status, next]) => Object.freeze({ order, reference, title, status, next })));

export const HERO_OWNER_ACTIONS = Object.freeze([
  Object.freeze({ id: "OWNER-01", title: "تصمیم محیط و دامنهٔ رسمی Test", status: "نیازمند تصمیم مالک", action: "دامنهٔ test.hero.beeproject.ir و هم‌سرور یا VM جدا را رسمی ثبت کن.", references: Object.freeze([2, 3, 6]) }),
  Object.freeze({ id: "OWNER-02", title: "مالک عملیات و مسیر escalation", status: "نیازمند تصمیم مالک", action: "مالک، جانشین و مسیر تماس اضطراری را مشخص کن.", references: Object.freeze([7, 8]) }),
  Object.freeze({ id: "ADMIN-01", title: "Runner محدود Hero روی host", status: "نیازمند ادمین سرور", action: "hero-ops و wrapperهای hero-test-* را بدون Docker یا sudo عمومی آماده کن.", references: Object.freeze([11, 12, 13]) }),
  Object.freeze({ id: "ADMIN-02", title: "تعیین تکلیف compose.test.yaml", status: "نیازمند بررسی ادمین", action: "مالکیت و محتوای فایل را بررسی کن؛ تا آن زمان فقط compose.yaml تأییدشده را اجرا کن.", references: Object.freeze([14]) }),
  Object.freeze({ id: "ADMIN-03", title: "Secret Store و محل نگهداری Test", status: "نیازمند اقدام ادمین", action: "Secretها را فقط در Secret Store یا فایل 600 قرار بده؛ مقدارها را نمایش نده.", references: Object.freeze([18, 19]) }),
  Object.freeze({ id: "OWNER-03", title: "Provider، Model، allow-list و سقف هزینه", status: "نیازمند تصمیم مالک", action: "Provider/Model مجاز، مدل‌های deprecated، cap عددی و رفتار توقف را نسخه‌دار تعیین کن.", references: Object.freeze([41, 45, 48]) }),
  Object.freeze({ id: "OWNER-04", title: "Binding و freshness دانش تیم‌ها", status: "نیازمند تصمیم مالک", action: "override هر تیم، دورهٔ اعتبار و سیاست stale را مشخص کن.", references: Object.freeze([52, 54]) }),
  Object.freeze({ id: "OWNER-05", title: "Golden Dataset یازده تیم", status: "blocker مالک", action: "برای هر تیم ورودی، خروجی مطلوب و خطاهای قابل‌قبول را بده.", references: Object.freeze([56]) }),
  Object.freeze({ id: "ADMIN-04", title: "Recovery واقعی روی Clean Linux", status: "blocker خارجی", action: "backup عملیاتی را به مقصد پاک restore کن و checksum/sentinel را ثبت کن.", references: Object.freeze([30, 89]) }),
  Object.freeze({ id: "OWNER-06", title: "Evidence و review نهایی Test", status: "نیازمند تصمیم مالک", action: "شواهد health، auth، persistence، rollback و مرور دستی را تأیید کن.", references: Object.freeze([72, 73, 79, 87, 88]) }),
  Object.freeze({ id: "ADMIN-05", title: "GitHub Environment و reviewer", status: "نیازمند ادمین GitHub", action: "Environment تست و reviewer اجباری را برای همین repository فعال کن.", references: Object.freeze([81, 83]) }),
  Object.freeze({ id: "OWNER-07", title: "Pilot کوچک و معیار پذیرش", status: "blocker Pilot", action: "یک feature کوچک، پلتفرم، acceptance criteria و سقف هزینه را اعلام کن.", references: Object.freeze([91]) }),
  Object.freeze({ id: "ADMIN-06", title: "Provider واقعی و مجوز مستقل", status: "blocker مجوزی", action: "پس از تصمیم مالک، credential و authorization مستقل را در Secret Store/گیت مجزا ثبت کن.", references: Object.freeze([47]) }),
  Object.freeze({ id: "ADMIN-07", title: "Production Caddy/Basic Auth", status: "خارج از اختیار فعلی", action: "فقط پس از مجوز production-deploy، config Caddy و Secret همان محیط را validate و reload کن.", references: Object.freeze([85, 86]) })
]);
