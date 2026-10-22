# شواهد اجرای ۱۲ گام آفلاین موج ۱ برنامهٔ NX — ۲۰۲۶-۱۰-۲۱

> Document ID: `HERO-EVIDENCE-NX-WAVE1-OFFLINE-20261021`
> Canonical path: `docs/evidence/NX-WAVE1-OFFLINE-20261021.md`
> Title: شواهد اجرای ۱۲ گام آفلاین موج ۱ برنامهٔ NX — ۲۰۲۶-۱۰-۲۱
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: none
> Supersedes: none
> Superseded by: none

## ۱. مجوز و مرز

- Snapshot مجوز: `config/authorizations/nx-20261021-001.json` (`BATCH-NX-20261021-001`)، ثبت‌شده بر پایهٔ دستور مالک در گفتگو: «هر کاری که بازه و قابل انجامه و وابسته به من نیست رو انجام بده با دقت و کامل».
- عامل این دستور را فقط برای گام‌های `offline` موج ۱ که ورودی مالک نمی‌خواهند تفسیر کرد: `NX-002`، `NX-003`، `NX-007`، `NX-009`، `NX-011`، `NX-016`، `NX-021`، `NX-025`، `NX-030`، `NX-037`، `NX-043`، `NX-049`. `NX-006` و `NX-018` ورودی مالک می‌خواهند و خارج ماندند.
- عملیات مجاز: طراحی، توسعه، مستندسازی، تست و بازبینی. Production، Secret، هزینهٔ بیرونی، Provider زنده، GitHub/سرور زنده، Notion، پیام بیرونی، استقرار Test و عملیات برگشت‌ناپذیر مجاز نشدند و انجام نشدند.
- نسخهٔ سندهای مرجع در Snapshot `1.1.0` است (نسخهٔ پیشین `1.0.0` بود و هیچ مجوزی نداشت).

## ۲. وضعیت گام‌ها و اندازه‌گیری واقعی

همهٔ ۱۲ گام `in_progress` ثبت شدند، نه `source_complete`: تعریف `source_complete` سبز بودن کل `pnpm check` همان commit را می‌خواهد و آن به‌خاطر دو شکست غیرمرتبط (بخش ۳) سبز نیست. مجموعه‌آزمون هر گام جداگانه سبز است:

| گام | آزمون | نتیجه | فایل‌های اصلی |
|---|---|---|---|
| NX-021 تازگی قیمت | ۸ | ۸ pass | `packages/domain/src/price-freshness.mjs`، `run-estimate.mjs`، `golden-path.mjs` |
| NX-049 ایزولاسیون پروژه‌ها | ۶ | ۶ pass | `tools/isolation-property.mjs`، `tests/fixtures/project-scoped-routes.json` |
| NX-011 کامپایلر معیار پذیرش | ۱۳ | ۱۳ pass | `packages/domain/src/acceptance-compiler.mjs`، `config/product-templates/acceptance-v1.json` |
| NX-003 پیکرهٔ تزریق غیرمستقیم | ۱۱ | ۱۱ pass | `config/bench/hero-bench-indirect-injection-v1.json` |
| NX-002 زنجیرهٔ Audit | ۷ | ۷ pass | `packages/domain/src/audit-chain-verifier.mjs`، `tools/audit-chain.mjs` |
| NX-007 پروفایل منبع Runner | ۹ | ۹ pass | `packages/domain/src/runner-resource-profiles.mjs`، `config/runner-profiles/` |
| NX-009 Checkpoint امضاشده | ۹ | ۹ pass | `packages/domain/src/checkpoint-integrity.mjs` |
| NX-016 محلی‌سازی فارسی | ۱۰ | ۱۰ pass | `packages/contracts/src/persian-locale.mjs` |
| NX-025 بودجهٔ توکن context | ۱۱ | ۱۱ pass | `packages/domain/src/context-budget.mjs`، `project-memory.mjs` |
| NX-030 ماتریس قابلیت مدل‌ها | ۱۰ | ۱۰ pass | `packages/domain/src/model-capability-matrix.mjs`، `config/model-capabilities/` |
| NX-037 ماتریس WCAG 2.2 AA | ۱۲ | ۱۲ pass | `tools/a11y-conformance.mjs`، `config/accessibility/wcag-22-aa-matrix-v1.json` |
| NX-043 لینتر Migration | ۱۰ | ۱۰ pass | `tools/migration-lint.mjs` |

جمع: ۱۱۶ آزمون جدید در ۱۲ فایل و ۳ آزمون تازه برای کنترل مجوز در `tests/next-steps.test.mjs`. آزمون‌های موجود تغییرکرده: `tests/golden-path.test.mjs` (شرط تازهٔ تازگی قیمت) و `tests/ui-static-audit.test.mjs` (ممیزی به `tools/ui-static-audit.mjs` منتقل شد؛ همان ادعاها).

اجرای کامل `pnpm check` روی همین working tree: ۸۴۸ آزمون، ۸۴۵ pass، ۲ fail، ۱ skip. همهٔ کنترل‌های `check:*` (از جمله `check:next-steps`، `check:hero-bench`، `check:product-templates`، `check:deployment-contract`، `check:a11y-matrix` و `check:migrations`) PASS شدند.

## ۳. شکست‌های غیرمرتبط (روی HEAD دست‌نخورده هم رخ می‌دهند)

دو آزمون `tests/ai-connections.test.mjs` («AI Connections lets only the Human Identity Owner store an encrypted Test credential» و «AI credential writes return a readable JSON error…») با `CATALOG_EXPIRED` می‌شکنند. علت: کاتالوگ قیمت آزمایشی داخل `apps/control-plane/src/server.mjs` (`OPENAI_TEST_ADVISOR.catalogValidUntil`) تا `2026-10-16T00:00:00.000Z` اعتبار داشت و عمداً fail-closed است. این را در یک checkout تمیز از commit `901a2b6` (پیش از همهٔ تغییرات این دسته) نیز بازتولید کردم.

اثر روی ساخت: `Dockerfile` مرحلهٔ `verify` را با `node --test` اجرا می‌کند، پس تا تمدید کاتالوگ هیچ Candidate تازه‌ای (rc.46 به بعد) ساخته نمی‌شود و CI هم قرمز می‌ماند.

اثر عملیاتی: هر بار بالا آمدن `createHeroServer` با Secret Store فعال Test (پیکربندی نمونهٔ Test چنین است) پس از این تاریخ با همین خطا متوقف می‌شود. تمدید فقط با بازبینی قیمت از منبع رسمی و تغییر کد ممکن است؛ آن یک گام gated جداست و در این دسته انجام نشد.

## ۴. یافته‌های جانبی (ثبت‌شده، اصلاح‌نشده)

- **۵۰۰ به‌جای ۴۰۴:** مسیرهای `/api/teams/:teamId/...` برای تیم ناموجود حتی برای مالک `500 INTERNAL_ERROR` می‌دهند (دیده‌شده روی `research-requests` و `contract-history`). آزمون NX-049 آن را فقط به‌صورت استثنای مستند و محدود به همین نوع خطا نگه می‌دارد؛ هیچ نشت ایزولاسیون پیدا نشد (۲۵ seed اضافه نیز آزموده شد).
- **کنتراست حاشیهٔ کنترل‌ها (WCAG 1.4.11):** `--hero-line-strong` روی زمینه حدود ۱٫۶۸:۱ (روشن) و ۲٫۸۸:۱ (تیره) است و زیر ۳:۱ است. همهٔ جفت‌رنگ‌های متن ≥ ۴٫۵:۱ هستند. به‌صورت `knownFindings` در ماتریس ثبت شد.
- **شکاف‌های تشخیص تزریق (NX-003):** از ۲۰ حمله، `content-safety` ۱۴ مورد را می‌بیند و ۶ مورد (خروجی ابزار جعلی، homoglyph، ادعای تأیید جعلی، خواندن پروژهٔ دیگر، خاموش‌کردن Global Stop، درخواست مؤدبانهٔ ارسال ایمیل) امضای واژگانی ندارند؛ علامت راست‌به‌چپ (U+200F) در متن فارسی یک false positive است. جدول انتظار در آزمون ثبت است تا هر تغییر آگاهانه باشد.
- **پوشش WCAG:** از ۵۵ معیار A/AA، ۲۰ معیار شواهد خودکار دارند (فقط ۶ تا با شواهد اساسی)، ۱ معیار فقط با مرورگر، ۲۸ معیار نیازمند بررسی انسانی و ۶ معیار غیرقابل‌اجرا (بدون رسانه) هستند. این نقشهٔ پوشش است نه گواهی.
- **NX-011:** از ۲۲ معیار ساخت‌یافتهٔ پنج قالب، ۲۱ مورد خودکار است و «کنتراست متن کافی باشد» (static-site) به‌درستی `needs-clarification` ماند چون آستانه‌ای ندارد.

## ۵. محدودیت‌ها و ادعاهایی که نمی‌شود

- هیچ گامی `verified` نشد و هیچ گامی روی Test مستقر یا اجرا نشد.
- Resume امضاشدهٔ NX-009 به ماشین حالت Runner وصل نشد، چون Runner فعلی عمل `resume` ندارد؛ فقط دروازهٔ تصمیم (`guardResume`) و امضا ساخته شد.
- NX-007 سقف‌ها را به گزینه‌های container نگاشت می‌کند ولی cgroup واقعی اعمال نمی‌کند؛ ظرفیت میزبان از اسنپ‌شات موجود `product-runtime-capacity` خوانده می‌شود و ظرفیت دیسک را باید ناظر جدا بدهد (ناشناخته = رد).
- NX-030 هیچ مقدار قابلیت واقعی ندارد؛ همهٔ مقدارها `unknown` است تا انسان از مستندات رسمی راستی‌آزمایی کند.
- NX-025 فقط وقتی `tokenBudget` داده شود فعال است؛ بدون آن رفتار پیشین Project Memory دست‌نخورده است.
