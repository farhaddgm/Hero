# بازبینی نهایی آمادگی و اجرای مرجع — BO-167 و BO-168

> Document ID: `HERO-EVIDENCE-BACKOFFICE-FINAL-READINESS-REVIEW-BO-167-168`
> Canonical path: `docs/roadmap/BACKOFFICE-FINAL-READINESS-REVIEW-BO-167-168.md`
> Title: بازبینی نهایی آمادگی و اجرای مرجع — BO-167 و BO-168
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

> یادداشت تفسیر: این سند نتیجهٔ واقعی را ثبت می‌کند، شکست‌ها و محدودیت‌ها را پنهان نمی‌کند و پذیرش نهایی (`BO-169`) را به جای مالک ثبت نمی‌کند. وضعیت `BO-170` فقط پیشنهاد است.

## ۱. BO-167 — اجرای `pnpm check` و همهٔ suiteها

مجوز: `BATCH-BACKOFFICE-20261008-027`. commit اجرا: `aabfde136d974a12c362cd391696fa04958fc5d4` (و commitهای بعدی همین شاخه؛ نتیجهٔ نهایی CI در PR ثبت می‌شود).

| اجرا | محیط | نتیجهٔ واقعی |
|---|---|---|
| `pnpm check` کامل | host توسعه (Linux, Node 22.22.2, pnpm 11.19.0) | exit 0؛ ۶۱۲ آزمون: ۶۱۱ pass، ۰ fail، ۱ skipped (آزمون PostgreSQL که به `HERO_POSTGRES_URL` نیاز دارد). |
| زنجیرهٔ `pnpm check` بدون `doctor` | reference container `node:22.13.1-alpine` (Linux، بدون شبکه) | (اجرای پیشین، ۶۱۰ آزمون) ۶۰۸ pass، **۱ fail**، ۱ skipped. شکست: `repository passes the clean-room scan`؛ علت محیطی است: image حداقلی `git` ندارد و بررسی مرز مخزن (`tools/check-isolation.mjs`) به `git rev-parse` نیاز دارد. همان آزمون و `tools/doctor.mjs` روی host (که git دارد) PASS شدند. این شکست پنهان یا «رفع‌شده» ثبت نمی‌شود. |
| آزمون‌های وابسته به PostgreSQL | همان container، `--network host`، PostgreSQL 16.13 محلی | ۹ از ۹ pass (از جمله ماندگاری و رمزنگاری MFA، migrationهای ۰۱۶ و ۰۲۴ و تطابق رویدادهای ممیزی). |
| تمرین پذیرش seed → SIGKILL → verify | سرور واقعی + PostgreSQL محلی تازه (`tools/acceptance/run-test-acceptance.mjs`) | seed: ۱۹۴/۱۹۴ بررسی در حکم (`BO-021..BO-170`)؛ verify: ۴۷/۴۷؛ ۰ شکست؛ روی PostgreSQL تازه با SIGKILL میانی. |

اجرای مرجع با git: CI ریپو (Ubuntu با git و Node 22) روی PR #16 (run `37726817574`، commit `f5ebe09`) و گام «Run Hero verification» ساخت rc.42 (run `37726985253`، commit `b622745`) هر دو **موفق** بودند؛ یعنی شکست محیطی بالا (نبود git در container حداقلی) در محیط دارای git تکرار نشد. آزمون Test environment همان candidate هم موفق بود (run `37727170163`). آزمون پذیرش مالک روی host Test نیز در ۲۰۲۶-۱۰-۰۸ با `v1.1.5-rc.44` PASS شد (run `20261008T131038Z-163016`، seed `241/241`، verify `61/61`، `BO-021..BO-170`)؛ بنابراین `BO-167` و `BO-168` در وضعیت `verified` هستند.

## ۲. BO-168 — Final Readiness Review

### ۲.۱ وضعیت کلی (پس از مجوز ۰۲۷)

- `verified`: ۱۱۸ از ۱۷۰ گام (پذیرش مالک روی rc.41).
- در source کامل ولی منتظر پذیرش روی candidate بعدی: `BO-021..042` و `BO-167..168`.
- `gated`: `BO-121..146` (اتصال زندهٔ GitHub/Server/Secret/Release) — نیاز به مجوز جدا.
- `owner_pending`: `BO-169`. `deferred`: `BO-170`.

### ۲.۲ Gap (فاصله‌ها)

| # | فاصله | اثر | اقدام لازم |
|---|---|---|---|
| G1 | گام‌های `BO-121..146` فقط قرارداد و ابزار محلی‌اند؛ اتصال زنده به GitHub، Server، Node و Secret Store انجام نشده. | قابلیت‌های Environment/Delivery در عمل «metadata-only‌اند». | مجوز جداگانهٔ مالک برای هر اتصال زنده. |
| G2 | اسکن بدافزار فقط امضایی داخلی است (`externalAntivirus: not-connected`). | فایل «clean» به معنای اسکن کامل آنتی‌ویروس نیست. | مجوز اتصال موتور خارجی یا ClamAV داخل شبکهٔ خصوصی. |
| G3 | متن PDF فقط برای PDFهای ساده خوانده می‌شود (استخراج محدود درون‌فرایندی)؛ فونت‌های CID/ToUnicode و PDF اسکن‌شده متن نمی‌دهند. | بخشی از PDFها در context مدل‌ها نیست. | parser جداگانهٔ sandbox یا OCR با مجوز. |
| G4 | تحویل ایمیل بازیابی مالک پیکربندی نشده (`recoveryDelivery: not-configured`). | بازیابی فقط با کدهای آفلاین. | مجوز سرویس ایمیل (پیام بیرونی). |
| G5 | فقط Inbox و راهنما دوزبانه‌اند. | سایر صفحات فارسی‌اند. | بسته‌ای جداگانه برای ترجمه. |
| G6 | حذف داده عمداً خاموش است (فقط dry-run). | نگهداری بیش از لازم تا مجوز حذف. | مجوز جداگانهٔ عملیات مخرب. |
| G7 | انتقال به مقصد پاک (clean-target) فقط محلی تمرین شد. | بازیابی در مقصد واقعی دیده نشده. | تمرین روی host جدا با مجوز. |

### ۲.۳ ریسک‌ها

| ریسک | احتمال | شدت | کنترل کنونی |
|---|---|---|---|
| گم شدن `HERO_MFA_ENCRYPTION_KEY` ⇒ کاربران MFA وارد نمی‌شوند | متوسط | متوسط (Owner با Secret خودش وارد می‌شود و دوباره enroll می‌کند) | شکست ایمن (`MFA_UNAVAILABLE`/`key-unavailable`)، چرخش با `…_PREVIOUS`، کلید فقط در env. |
| فشار brute-force روی ورود | متوسط | بالا | سقف چالش/حساب/ایمیل/منبع، قفل ۱۵ دقیقه‌ای، پاسخ یکسان برای ایمیل ناشناخته، ممیزی امنیتی. |
| فایل آلوده یا ZIP bomb | متوسط | بالا | allowlist، امضا، بازرسی ZIP از ساختار واقعی، سقف استخراج، SSRF/DNS، فایل هرگز اجرا نمی‌شود. |
| Prompt injection از فایل/لینک | بالا | بالا | `reviewRequired`، حذف از context، پوشش `untrusted-content`؛ این تشخیص heuristic است، نه تضمین. |
| دستکاری مسیر جدید بدون مجوز | پایین | بالا | جاروی مسیرها مسیرهای جدید `server.mjs` را خودکار می‌آزماید. |
| اجرای نسخهٔ کهنهٔ runner پذیرش روی host | متوسط | پایین | `git fetch` و بررسی محتوا در دستور مالک. |

### ۲.۴ محدودیت‌های شناخته‌شده

همهٔ موارد G1..G7؛ به‌علاوه: نتیجهٔ container مرجع محلی یک شکست محیطی (نبود git) دارد؛ تمرین پذیرش محلی جایگزین پذیرش host Test نیست؛ هیچ Production، Provider زنده، GitHub زنده یا Notion نوشتنی لمس نشد.

### ۲.۵ Rollback

1. **Candidate**: `tools/promote-test-immutable.sh` با ref قبلی (`v1.1.5-rc.41`، `ghcr.io/farhaddgm/hero@sha256:6df22aa1919c14497470100ae4ec33214ee0feb90e20831d2fc1b30c75563b29`) برمی‌گردد؛ state release پیش از promote ذخیره می‌شود.
2. **Migration `024`**: افزایشی است (ستون‌های nullable/با پیش‌فرض و جدول append-only جدید `human_identity_lifecycle_events`). CHECK قدیمی ممیزی هویت عمداً بدون تغییر ماند، چون migration `016` آن را در هر راه‌اندازی دوباره می‌سازد و گسترش آن rollback را می‌شکست (در یک اجرای میانی همین خطا دیده و رفع شد). اثبات: build پایهٔ `origin/codex/hero-001-project-charter` (rc.41) روی پایگاه‌دادهٔ دارای migration ۰۲۴ و رویدادهای lifecycle بدون خطا بالا آمد (`tools/check-postgres.mjs` ⇒ `POSTGRES CHECK PASS`). حذف ستون‌ها لازم نیست و عمداً انجام نمی‌شود.
3. **کلید MFA**: بازگشت به نسخهٔ قبلی رمز MFA کاربران را نمی‌خواند (آن نسخه ذخیره‌شان نمی‌کرد)؛ کاربران MFA باید پس از rollback دوباره enroll شوند. Owner از env وارد می‌شود و تحت تأثیر نیست.
4. **Global Stop**: اگر Global Stop روشن شد، dispatch جدید متوقف می‌شود و سند مجوز نسخه‌دار می‌شود، نه ویرایش تاریخچه.

### ۲.۶ نتیجهٔ بازبینی

بازبینی source و آزمون‌ها انجام شد: هیچ مورد مسدودکنندهٔ شناخته‌شده‌ای در دامنهٔ ۰۲۷ باقی نمانده، به‌جز موارد ثبت‌شده بالا. این بازبینی به‌منزلهٔ پذیرش مالک نیست.

## ۳. BO-169 و BO-170

`BO-169` فقط با رکورد صریح Owner ثبت می‌شود؛ عامل توسعه آن را ثبت نمی‌کند. `BO-170` (pilot) تا پس از پذیرش، فقط پیشنهاد مکتوب است و هیچ اجرایی ندارد.

## ۴. نحوهٔ ثبت پذیرش توسط مالک (BO-169)

پس از اینکه candidate بعدی روی host Test پذیرش شد و یک `readiness-review` در وضعیت `ready-for-owner-acceptance` وجود داشت، مالک با نشست خودش `POST /api/projects/<projectId>/final-readiness` را با بدنهٔ `{ "action": "accept", "reviewId": "<شناسه>", "artifactIdentity": "ghcr.io/farhaddgm/hero@sha256:<digest>", "decision": "accepted", "reason": "..." }` صدا می‌زند. رکورد تغییرناپذیر است و فقط Owner می‌تواند آن را ثبت کند؛ عامل توسعه آن را ثبت نمی‌کند.
