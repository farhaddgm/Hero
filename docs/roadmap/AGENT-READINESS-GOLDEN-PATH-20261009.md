# آمادگی عامل‌ها و مسیر طلایی — ۲۰۲۶-۱۰-۰۹

> Document ID: `HERO-ROADMAP-AGENT-READINESS-20261009`
> Canonical path: `docs/roadmap/AGENT-READINESS-GOLDEN-PATH-20261009.md`
> Title: آمادگی عامل‌ها و مسیر طلایی — ۲۰۲۶-۱۰-۰۹
> Type: roadmap
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## ۱. هدف و مرز

این سند نتیجهٔ بررسی ماموریت Hero و توسعهٔ آن‌چه آفلاین قابل اثبات بود را ثبت می‌کند. هیچ بخش آن مجوز فراخوانی Provider زنده، هزینهٔ بیرونی، انتشار، تغییر Secret یا تغییر Global Stop نیست. تصمیم معماری در `HERO-ADR-0017` است.

## ۲. آنچه ساخته شد

| قابلیت | فایل‌های اصلی | آزمون | کنترل در `pnpm check` |
|---|---|---|---|
| Agent Tool Gateway (نقطهٔ تصمیم ابزار) | `packages/domain/src/agent-tool-gateway.mjs`، `packages/contracts/src/agent-tool-gateway.mjs` | `tests/agent-tool-gateway.test.mjs` | `check-agentic-security` |
| Red-Team + نگاشت OWASP Agentic | `tests/agent-redteam.test.mjs`، `tools/check-agentic-security.mjs` | ۱۴ آزمون با نام ASI01..ASI10 | `check-agentic-security` |
| Hero-Bench (۳۰ تکلیف فارسی، ۷ دسته) | `config/bench/hero-bench-v1.json`، `packages/domain/src/hero-bench.mjs`، `tools/run-hero-bench.mjs` | `tests/hero-bench.test.mjs` | `check-hero-bench` |
| Delivery Truth | `packages/domain/src/delivery-truth.mjs`، `GET /api/delivery-truth` | `tests/delivery-truth.test.mjs` | آزمون‌های route sweep موجود |
| Run Estimate | `packages/domain/src/run-estimate.mjs` | `tests/run-estimate.test.mjs` | `node --test` |
| قالب‌های محصول (۵ قالب) | `config/product-templates/templates-v1.json`، `packages/domain/src/product-templates.mjs` | `tests/product-templates.test.mjs` | `check-product-templates` |
| Golden Path (تمرین آفلاین + آمادگی اجرای زنده) | `packages/domain/src/golden-path.mjs`، `tools/run-golden-path-rehearsal.mjs` | `tests/golden-path.test.mjs` | `run-golden-path-rehearsal --check` |
| OTLP exporter (پیش‌فرض خاموش) | `packages/adapters/src/otlp-exporter.mjs` | `tests/otlp-exporter.test.mjs` | `node --test` |
| ممیزی ایستای RTL و دسترس‌پذیری | `tests/ui-static-audit.test.mjs` | ۱۰ آزمون روی ۸ صفحه | `node --test` |
| جداسازی کمک‌های HTTP از `server.mjs` | `apps/control-plane/src/http-helpers.mjs` | همهٔ آزمون‌های موجود | `node --test` |

## ۳. یافته‌های واقعی در حین کار

1. **باگ در `content-safety`:** متن فارسی عادی با سه نیم‌فاصله یا بیشتر (مثل «می‌خواهیم نرم‌افزار را به‌روزرسانی کنیم») `risk: high` و «کاراکتر پنهان» علامت می‌خورد، چون ZWNJ در فهرست کاراکترهای پنهان بود. اصلاح شد: ZWNJ/ZWJ بین دو حرف عربی‌خط املای عادی است؛ کاراکترهای پنهان واقعی و جهت‌نماهای bidi همچنان علامت می‌خورند و جلوگیری از دورزدن قاعده‌های فارسی با درج نیم‌فاصله حفظ شد. آزمون بازگشتی در `tests/wp03-content-safety.test.mjs`.
2. **اصلاح گزارش قبلی:** در بررسی اولیه گفته شد در `hero-shell.mjs` نشانی از `lang`/`dir` نیست. این درست نبود: آن فایل تکه‌ای از صفحه است و هر صفحهٔ کامل `lang="fa" dir="rtl"` دارد. ممیزی ایستای جدید این را برای ۸ صفحه ثابت می‌کند.
3. **نسبت گام به نیازمندی:** ۱۴۲ از ۱۷۰ گام تأییدشده است، اما فقط ۱۰ از ۸۱ نیازمندی کاملاً پیاده‌سازی شده. Delivery Truth این شکاف را در یک مدل ماشینی نشان می‌دهد.

## ۴. آنچه ادعا نمی‌شود

- هیچ Provider واقعی با Hero-Bench سنجیده نشده است؛ نتایج فعلی فقط اعتبار خود بنچ‌مارک را نشان می‌دهد.
- Golden Path زنده اجرا نشده است. وضعیت آن `not-run` است و مراحل `execution`، `quality-review`، `assurance`، `product-test` و `owner-acceptance` `requires-live` هستند.
- Gateway، OTLP exporter و Run Estimate به Runtime Control Plane وصل نشده‌اند و ابزار واقعی Agent از آن‌ها عبور نمی‌کند.
- نام ۱۰ دستهٔ OWASP از منابع ثانویه است و باید با متن رسمی تطبیق داده شود.
- بنچ‌مارک بازار (Devin، OpenHands، Claude Code، Codex، Cursor و ابزارهای prompt-to-app) از وبلاگ‌ها و تحلیل‌های ثانویه است و عددهای SWE-bench بین منابع ناسازگارند.

## ۵. اجرای محلی

    pnpm check:agentic-security
    pnpm check:hero-bench
    pnpm bench -- --runner reference --compare capable-unsafe
    pnpm check:product-templates
    pnpm golden-path:rehearse -- --template static-site

اجرای `pnpm bench -- --runner live` عمداً با خطای `LIVE_BENCH_REQUIRES_EXTERNAL_SPEND_AUTHORIZATION` رد می‌شود.

## ۶. دستورالعمل اجرای زندهٔ مسیر طلایی (فقط پس از مجوز جدا)

اجرای زنده یک گام جدا با Step ID و نسخهٔ سند خودش است و تا ثبت این موارد شروع نمی‌شود. `golden.readiness()` همین فهرست را ماشینی می‌سنجد:

1. Global Stop خاموش و محیط هدف فقط `test`.
2. مجوز هزینهٔ بیرونی نسخه‌دار با Provider، مدل‌های مجاز، سقف هزینه، انقضا و `stepId`/`documentVersion` منطبق؛ سقف از بدترین برآورد `estimateRun` کمتر نباشد.
3. مرجع امن کلید Provider در Secret Store ثبت شده باشد (مقدار کلید هرگز وارد Git، Prompt یا گزارش نمی‌شود).
4. خط پایهٔ Hero-Bench با digest ثبت شده باشد.
5. معیارهای پذیرش قالب را مالک تأیید کرده باشد.
6. تمرین توقف اضطراری انجام و تاریخش ثبت شده باشد.
7. اجرا فقط در Product Runner ایزوله و با خروجی redacted؛ پایان کار با پذیرش مالک و پرونده‌ی `config/golden-path/live-evidence.json` (فقط پس از اجرای واقعی).

## ۷. کارهای باقی‌مانده

- اتصال Gateway به مسیر Dispatch و Provider Adapterها، همراه با آزمون پذیرش روی Test.
- نمایش Delivery Truth در Back Office (فعلاً فقط API است).
- endpoint برآورد پیش از اجرا و نگه‌داری تاریخچهٔ مصرف برای دقیق‌ترشدن برآورد.
- تقسیم بیشتر `server.mjs` (بدنهٔ `createHeroServer` هنوز یک closure بزرگ است).
- تحویل واقعی ایمیل بازیابی، آنتی‌ویروس بیرونی و import زندهٔ GitHub (هنوز `gated`).

## ۸. نتیجهٔ راستی‌آزمایی

اجرای `pnpm check` روی همین source در ۲۰۲۶-۱۰-۰۹: exit 0؛ `node --test` شامل ۷۱۹ آزمون با ۷۱۸ موفق، ۰ شکست و ۱ آزمون skip‌شدهٔ قبلی؛ `BUILD PASS` با ۳۹۳ ماژول و ۸۳ فایل JSON؛ `Agentic security: PASS` (۱۰ دسته، ۱۵ کنترل)؛ `Hero-Bench: PASS` (مرجع ۱، پاسخ خالی ۰، عامل ناایمن با امتیاز وزنی ۰٫۶۶۶۷ در برابر نرخ خام ۰٫۸)؛ `Product templates: PASS`؛ تمرین Golden Path برای هر پنج قالب PASS با ۵ مرحلهٔ `requires-live`؛ `Documentation check: PASS` با ۱۵۹ سند. این اجرا فقط محلی است؛ CI و Runtime Test با Candidate بعدی جداگانه اثبات می‌شوند.
