# Evidence اجرای Environment تا Final Readiness — BO-121 تا BO-170

> Document ID: `HERO-EVIDENCE-BACKOFFICE-ENVIRONMENT-DELIVERY-HARDENING-FINAL-BO-121-170`
> Canonical path: `docs/roadmap/BACKOFFICE-ENVIRONMENT-DELIVERY-HARDENING-FINAL-BO-121-170.md`
> Title: Evidence اجرای Environment تا Final Readiness — BO-121 تا BO-170
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.1.0
> Owner: hero-architecture
> Review cadence: none
> Supersedes: none
> Superseded by: none

> یادداشت تفسیر: این سند وجود contract، control و تست داخلی Batch را ثبت می‌کند. عملیات واقعی Server/Secret/Production/clean-target و پذیرش نهایی انجام‌شده تلقی نمی‌شوند. وضعیت جاری در `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911` مقدم است.

## دامنه و مرز

Snapshotهای `BATCH-BACKOFFICE-20260910-013` تا `017` گام‌های `BO-121..BO-170` را پوشش می‌دهند و در زمان ساخت Global Stop خاموش بود. همهٔ عملیات حساس—Production deploy، اتصال Server/GitHub، secret mutation/reveal، حذف داده، هزینه و پیام بیرونی، Notion write و اجرای Pilot—خارج Scope و fail-closed هستند.

## خروجی‌های اجباری

| گام‌ها | پیاده‌سازی و شاهد |
|---|---|
| BO-121..134 | قرارداد سه‌محیطی، metadata-only GitHub/Server، Node enrollment/heartbeat/rotation/revoke، desired/observed/reconcile proposal، Secret reference-only، Owner-only reveal request، egress allowlist و آزمون impersonation/replay/revoke. |
| BO-135..146 | telemetry allowlist/redaction، break-glass request بدون data access، Release state machine record-only، Artifact digest/provenance/attestation/SBOM، Delivery Matrix/Bundle، portability/recovery evidence و acceptance بدون deploy. |
| BO-147..156 | retention minimum، dry-run cleanup/hold، `fa`/`en` و RTL/LTR، pagination/query budget، accessibility/security/load/backup/secret/dependency/role regression audit evidence. |
| BO-157..170 | compatibility migration plan، deterministic read-model digest comparison، multi-project/adversarial/crash-resume/transfer scenarios، traceability، help/glossary/runbook، Notion plan-only، readiness review، owner-acceptance gate و pilot proposal-only gate. |

## وضعیت گام‌های مالک

`BO-169` به‌صورت قابلیتِ owner-only پیاده‌سازی شده است، اما پذیرش واقعی این نسخه به ایجاد یک رکورد صریح Owner با `artifactIdentity` وابسته است؛ عامل توسعه به‌جای مالک آن را ثبت نمی‌کند. `BO-170` نیز فقط پس از همان رکورد، Proposal پایلوتِ بدون اجرا می‌سازد. بنابراین هیچ Pilot یا Production عملیاتی در این Evidence رخ نداده است.

## نتیجهٔ آزمون

در ۱۰ سپتامبر ۲۰۲۶، `npm run check` در Linux reference container با موفقیت اجرا شد: ۴۰۸ فایل Clean Room بررسی شد؛ ۱۲۲ سند بدون خطا اعتبارسنجی شد؛ Build شامل ۲۲۱ ماژول و ۳۲ فایل JSON بود؛ و ۳۰۳ آزمون با صفر خطا گذشت. هشدار Docker در Doctor فقط محدودیت اجرای Docker از درون خودِ کانتینر مرجع را بیان می‌کند و استقرار محسوب نمی‌شود. این سند مجوز هیچ محیط، اتصال خارجی، مصرف Provider، یا عملیات Production نیست.

## Attempt استقرار Test — ۱۰ سپتامبر ۲۰۲۶

با تأیید صریح Owner، image محلیِ کنترل‌شده پس از preflight موفق Test ساخته و فقط سرویس `hero-test/control-plane` جایگزین شد. PostgreSQL و Proxy موجود تغییر نکردند و Provider زنده خاموش ماند. سرویس جدید در شروع به `POSTGRES_CONNECTION_FAILED` رسید؛ log PostgreSQL علت واقعی را `password authentication failed for user "hero"` ثبت کرد. بنابراین استقرار Test **ناموفق و blocked** است و هیچ پذیرش نهایی Owner، Pilot یا Production ثبت/اجرا نشد. اصلاح نیازمند هماهنگ‌سازی یا Rotate کردن Secretهای PostgreSQL Test با یک مجوز جداگانهٔ Secret change است.

## بازیابی و پذیرش Owner — ۱۰ سپتامبر ۲۰۲۶

پس از مجوز صریح Owner برای همهٔ مجوزهای لازم، Secret PostgreSQL Test بدون نمایش مقدار همگام شد و migrationهای نسخه‌بند‌شده تا `014` با موفقیت اجرا شدند. سپس فقط `hero-test/control-plane` restart شد؛ PostgreSQL و Proxy تغییر نکردند. image مستقر `hero-control-plane:local@sha256:ae190c819389165d94d162c70da436e90d66f4658a909007dffcb56128025199` است.

smoke-test واقعی محیط Test: `/health=200`، `/ready=200`، `/backoffice=401` بدون احراز هویت، و endpointهای `infrastructure-control-contract`، `delivery-control-contract`، `operational-hardening-contract` و `final-readiness-contract` همگی `200` هستند. Owner این نسخهٔ Test را با دستور صریح در همین Task پذیرفت. Pilot همچنان اجرا نشده و به Proposal و مجوز جداگانه نیاز دارد؛ Production نیز کاملاً خارج از Scope است.

## به‌روزرسانی ۲۰۲۶-۱۰-۰۷ — BO-147 تا BO-166 (مجوز `BATCH-BACKOFFICE-20261007-026`)

این بخش فقط `BO-147..BO-166` را پوشش می‌دهد. هیچ اتصال زندهٔ GitHub، سرور، Secret Store، Provider، Production یا نوشتن در Notion انجام نشد. همهٔ ابزارها داخل مخزن و روی نمونه‌های محلی اجرا می‌شوند و خروجی‌شان **شمارش‌شده** است، نه ادعای دستی.

### آنچه ساخته شد

| گام | کار انجام‌شده | شاهد اجرایی |
| --- | --- | --- |
| BO-147 | نگهداری per-project با حداقل غیرقابل‌تضعیف (۳۶۵/۳۶۵/۷۳۰ روز)، نسخه‌دار و پایدار | `tests/wp13-hardening-bo147-156.test.mjs` |
| BO-148 | پاک‌سازی فقط dry-run: رکورد جوان یا دارای Hold هرگز واجد شرایط نیست؛ هر رکورد digest دارد؛ حذف همیشه رد و تلاش آن ثبت می‌شود | همان آزمون و آزمون HTTP |
| BO-149 | فارسی/انگلیسی برای Inbox و راهنما با RTL/LTR و شناسه‌های پایدار | `tests/browser/locale-a11y.browser.mjs` |
| BO-150 | ممیزی دسترس‌پذیری اجرایی روی هر صفحه، نقش و زبان؛ چهار نقض کنتراست پیدا و رفع شد | `tools/acceptance/audit-lib.mjs` |
| BO-151 | همهٔ فهرست‌ها با یک بودجهٔ پرس‌وجو (حداکثر ۱۰۰) و cursor؛ Trace به‌صورت lazy | `tests/wp13-audits-bo150-156.test.mjs` |
| BO-152 | بازبینی امنیتی اجرایی: احراز هویت، مجوز، دسترسی سطح-شیء، آپلود، ابزار AI و Node Agent | `tools/acceptance/security-review.mjs` |
| BO-153 | بار، soak و تزریق خطا؛ یک **از دست رفتن داده هنگام قطع پایگاه داده** پیدا و رفع شد | `tools/audit/load-soak.mjs` |
| BO-154 | پشتیبان منطقی با digest، بازیابی فقط در مقصد خالی، رد بستهٔ دست‌کاری‌شده | `tools/audit/backup-restore.mjs` |
| BO-155 | اسکن Secret و وابستگی آفلاین و گزارش پوشش Audit | `tools/audit/secret-dependency-scan.mjs` |
| BO-156 | رگرسیون سه نقش × دو زبان × دو اندازهٔ Desktop در مرورگر واقعی | `tests/browser/locale-a11y.browser.mjs` |
| BO-157/158 | مسیرهای قدیمی تا ۲۰۲۷-۰۴-۰۵ با Deprecation/Sunset/Link کار می‌کنند و پس از آن ۴۱۰ می‌دهند | `tests/wp14-final-readiness-bo157-166.test.mjs` |
| BO-159 | مقایسهٔ digest کانونی Read Modelها پیش و پس از restart و انتقال | `tools/audit/read-models.mjs` |
| BO-160..163 | سناریوهای دو پروژه، adversarial، crash/resume و انتقال روی Server واقعی | `tools/audit/scenarios.mjs` |
| BO-164 | ممیزی ردیابی: مسیر هر شاهد وجود دارد و هر نیازمندیِ implemented آزمون دارد | `tools/audit/traceability-audit.mjs` |
| BO-165 | راهنما، واژه‌نامه و runbook برای سه نقش | صفحهٔ `surface=help` |
| BO-166 | plan فقط‌خواندنی Notion با checksum، صفر نوشتن و صفر تماس شبکه | `tools/audit/notion-plan.mjs` |

### خطاهای واقعی که این بازبینی پیدا و رفع کرد

1. **ماژول‌های hardening و final-readiness فقط در حافظه بودند** و با هر restart همه‌چیز را از دست می‌دادند؛ اکنون append-only و replay‌پذیرند.
2. **قطع پایگاه داده رکوردها را از بین می‌برد** (outbox پیش از ذخیره خالی می‌شد)؛ اکنون صف تکرار‌پذیر است، پاسخ `503` می‌دهد و پس از بازگشت دقیقاً یک‌بار ذخیره می‌کند.
3. **ممیزی HTTP نداشت:** بیشتر مسیرهای نوشتن هیچ Audit نمی‌گذاشتند؛ اکنون هر نوشتن و هر ردِ مجوز ثبت می‌شود (ردها rate-limit شده‌اند).
4. **Digestها کانونی نبودند** و ترتیب کلیدهای `jsonb` باعث اختلاف کاذب می‌شد.
5. **عنوان اعلان redact نمی‌شد** (فقط action)؛ اکنون مقدار شبیه Secret حذف می‌شود.
6. **Admin می‌توانست وجود کاربر و MFA او را حدس بزند** (پاسخ ۴۰۹ پیش از بررسی مجوز)؛ اکنون ابتدا ۴۰۳.
7. **چهار جفت رنگ کنتراست ناکافی** (`#087f70`، `#a36208` و دو مورد دیگر) اصلاح شد.
8. بدنهٔ بیش‌ازحد بزرگ ۴۰۹ می‌داد؛ اکنون ۴۱۳.
9. مسیرهای hardening/readiness/infrastructure/delivery نقش اصلی کاربر را می‌خواندند؛ اکنون نقش همان پروژه.
10. نیازمندی‌های `BO-GOV-001/003/005` و `BO-AI-003` بدون آزمون «implemented» بودند؛ آزمون واقعی به شاهدشان افزوده شد.

### محدودیت‌های شناخته‌شده (پنهان نشده)

- فقط Inbox و راهنما کاملاً دوزبانه‌اند؛ بقیهٔ صفحه‌ها هنوز فارسی ثابت هستند.
- حذف واقعی داده عمداً فعال نیست.
- جست‌وجوی آسیب‌پذیری آنلاین (`pnpm audit`) اجرا نشد؛ نیاز به تماس شبکه دارد.
- اعداد بار از اجرای محلی‌اند، نه Host Test.
- پشتیبان، نسخهٔ منطقی رکوردهای Back Office است، نه dump کامل پایگاه داده؛ اعتبارنامه‌ها، مقدار Secret و فایل‌های آپلودی خارج از آن‌اند.
- `BO-163` بین دو پایگاه محلی تمرین شد، نه بین دو target تمیز Test.
- `BO-158` هیچ مسیری را حذف نکرد؛ حذف پس از پایان پنجره و پس از تأیید جانشین انجام می‌شود.
- بازبینی طبقه‌بندی Notion نسبت به digest جدید کاتالوگ کهنه است و پیش از هر Projection به بازبینی مالک نیاز دارد.

وضعیت: هر ده گام `BO-147..156` و هر ده گام `BO-157..166` `partial` است تا Candidate `rc.40` آزمون پذیرش گسترش‌یافته را روی Test PASS کند.
