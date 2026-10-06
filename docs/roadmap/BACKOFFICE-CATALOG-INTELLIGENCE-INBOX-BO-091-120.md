# Evidence اجرای Catalog، Intelligence و Inbox — BO-091 تا BO-120

> Document ID: `HERO-EVIDENCE-BACKOFFICE-CATALOG-INTELLIGENCE-INBOX-BO-091-120`
> Canonical path: `docs/roadmap/BACKOFFICE-CATALOG-INTELLIGENCE-INBOX-BO-091-120.md`
> Title: Evidence اجرای Catalog، Intelligence و Inbox — BO-091 تا BO-120
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.1.0
> Owner: hero-architecture
> Review cadence: none
> Supersedes: none
> Superseded by: none

> یادداشت تفسیر: این سند وجود پیاده‌سازی و تست داخلی Batch را ثبت می‌کند، نه عملیاتی‌شدن کامل Catalog acquisition، Ledger و Inbox UI. وضعیت جاری در `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911` مقدم است.

## دامنه و مرز

Snapshotهای `BATCH-BACKOFFICE-20260910-010` تا `012`، گام‌های `BO-091..BO-120` را پوشش می‌دهند. Global Stop خاموش بود. GitHub fetch، Provider call، هزینه/پیام بیرونی، Test/Production deploy، Pilot، Secret operation و Notion write خارج Scope هستند.

## خروجی‌ها

| گام‌ها | خروجی |
|---|---|
| BO-091..098 | inventory محلی، desired/observed drift proposal، referenceهای Catalog، Knowledge/Document search، dependency/blast-radius و قرارداد Git canonical/Notion projection |
| BO-099..110 | immutable Usage Event، Token Ledger، soft/hard cap، evaluation/feedback، scorecard، Health formula/confidence/freshness، critical override و drill-down API |
| BO-111..120 | taxonomy Inbox، dedup/incident grouping، view/action داخلی، correlation/trace، audit redaction، query/retention hook و SLI/SLO freshness |

## نتیجهٔ آزمون

در ۱۰ سپتامبر ۲۰۲۶، `npm run check` در Linux reference container با نتیجهٔ موفق اجرا شد: ۳۸۸ فایل Clean Room بررسی شد؛ ۱۱۸ سند بدون خطا اعتبارسنجی شد؛ Build شامل ۲۱۱ ماژول و ۲۷ فایل JSON بود؛ و ۲۹۹ آزمون با صفر خطا گذشت. هشدار Docker در خروجی Doctor فقط بیانگر آن است که خودِ کانتینر نمی‌تواند Docker میزبان را اجرا کند و به معنی استقرار نیست. این سند مجوز هیچ محیط، اتصال خارجی، مصرف Provider، یا عملیات Production نیست.

## به‌روزرسانی ۲۰۲۶-۱۰-۰۶ — BO-091 و BO-092 (مجوز `BATCH-BACKOFFICE-20261006-023`)

- BO-091: snapshot آفلاین و GitHub-شکل یک مخزن (`normalizeGithubSnapshot`) به metadata مشاهده‌شده تبدیل، با Catalog مطلوب مقایسه و به‌صورت inventory با وضعیت `recorded-no-external-fetch` ثبت می‌شود. snapshot مخزن دیگر رد می‌شود. منبع زندهٔ GitHub عمداً با `GITHUB_LIVE_CALL_NOT_AUTHORIZED` fail-closed است.
- BO-092: Drift در سطح فیلد (`changed`، `missing-observed`، `unexpected-observed`) به Proposal تبدیل می‌شود؛ Proposal تکراری ساخته نمی‌شود، Proposal قدیمی `superseded` و Proposal روی نسخهٔ قدیمی entity `stale` می‌شود. فقط انسان تصمیم می‌گیرد: `adopt-observed` نسخهٔ تازهٔ desired می‌سازد، `fix-source` فقط اصلاح منبع را ثبت می‌کند و `reject` می‌بندد. هیچ overwrite خودکاری وجود ندارد.
- شواهد: `tests/system-catalog-wp08.test.mjs` (واحد، HTTP و replay) و رفت‌وبرگشت واقعی PostgreSQL با migration `022` و رد `DELETE`. هیچ فراخوانی زندهٔ GitHub انجام نشد.
