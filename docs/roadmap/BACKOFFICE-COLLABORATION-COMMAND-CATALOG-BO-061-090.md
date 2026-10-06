# Evidence اجرای Collaboration، Command Center و System Catalog — BO-061 تا BO-090

> Document ID: `HERO-EVIDENCE-BACKOFFICE-COLLABORATION-COMMAND-CATALOG-BO-061-090`
> Canonical path: `docs/roadmap/BACKOFFICE-COLLABORATION-COMMAND-CATALOG-BO-061-090.md`
> Title: Evidence اجرای Collaboration، Command Center و System Catalog — BO-061 تا BO-090
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.1.0
> Owner: hero-architecture
> Review cadence: none
> Supersedes: none
> Superseded by: none

> یادداشت تفسیر: این سند وجود پیاده‌سازی و تست داخلی Batch را ثبت می‌کند، نه عملیاتی‌شدن کامل Conversation، Command execution و UI. وضعیت جاری در `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911` مقدم است.

## دامنه

این بسته شامل Snapshotهای `BATCH-BACKOFFICE-20260910-007` تا `009` و گام‌های `BO-061..BO-090` است. Global Stop خاموش بود. Provider واقعی، dispatch بیرونی، Pilot، Production، Secret، هزینه/پیام بیرونی، عملیات مخرب و Notion write خارج Scope هستند.

## خروجی

| گام‌ها | خروجی |
|---|---|
| BO-061..062 | global/project search با filtering Grant و deep-link API-backed |
| BO-063..074 | Team/Role assignment، profile نسخه‌دار، پنج Conversation Context، retention، model binding، memory چهارسطحی، correction/disable/supersede، isolation/redaction، Knowledge Proposal و read API |
| BO-075..088 | Command intent/risk، immutable decision، low-risk queue، approval/card contract، workflow local/resumable، preauthorization record-only، scheduler fair/aging/lock/two-heavy-run، عملیات queue/checkpoint/recovery |
| BO-089..090 | schema و registry اولیهٔ System Entity و dependency برای همهٔ نوع‌های پایه |

## مرز عمدی

Command dispatch هیچ side effect یا Provider call انجام نمی‌دهد. Production preauthorization deploy را مجاز نمی‌کند. Catalog هنوز metadata GitHub را fetch نمی‌کند و migration schema تنها برای persistence آینده آماده است. تمام Queryها باید همچنان از ProjectGrant middleware عبور کنند.

## نتیجهٔ آزمون

در `2026-09-10`، زنجیرهٔ کامل `check` در Linux reference container اجرا شد:

- checkerهای baseline، foundation، identity، workspace و collaboration/command: `PASS`؛
- Documentation: `116 documents`، `2 products` و `0 errors`؛
- Build: `205 modules` و `24 JSON files`؛
- Tests: `296 passed`، `0 failed` و `0 skipped`؛
- Clean-room scan: `376 files`؛
- هیچ Test deploy، Pilot، Production، Provider call، dispatch بیرونی، Secret reveal/change، external spend/message یا Notion write انجام نشد.

image مرجع باینری `pnpm` ندارد؛ بنابراین همان زنجیرهٔ `package.json` با `npm run check` اجرا شده است. این Evidence مجوز هیچ عملیات خارجی یا محیطی نیست.

## الحاق ۲۰۲۶-۱۰-۰۶ — تکمیل source گام‌های BO-061..BO-072

مجوز: `BATCH-BACKOFFICE-20261006-022` برای `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1@1.2.0` و `HERO-SPEC-022@1.0.0`. گام‌های `BO-073` (آزمون‌های خصمانه) و `BO-074` (صفحه‌های Team/Role/Conversation/Memory) در این مجوز نیستند و انجام نشده‌اند.

| گام | خروجی source |
|---|---|
| BO-061 | جست‌وجوی سراسری/پروژه‌ای فقط در Grant، حداکثر ۵۰ نتیجه، پیوند صفحهٔ انسانی برای هر نتیجه |
| BO-062 | `tests/backoffice-portfolio-wp05.test.mjs` (نقش، صفحه‌بندی، برابری KPI و drill-down، empty/error/stale، ایزولهٔ ناوبری) و `tests/browser/portfolio-roles.browser.mjs` با Chromium واقعی (`pnpm test:browser`) |
| BO-063 | تخصیص نسخه‌دار تیم به پروژه با نقش‌های Hero (`AI_ROLES`)، `expectedVersion`، لغو تخصیص با دلیل |
| BO-064 | اصول، KPI و policy هر تخصیص و memory با `scopeId` تیم/نقش/specialist، همه project-scoped |
| BO-065 | Role Profile و Specialist Profile نسخه‌دار با تاریخچهٔ کامل |
| BO-066 | پنج context با ContextBinding؛ entity فقط از catalog همان پروژه |
| BO-067 | thread قابل ادامه، فهرست گفتگوها، retention زمانی، بستن گفتگو |
| BO-068 | مدل گفتگو: conversation › `ai.roleModels.<role>` › `ai.teamModels.<team>` › `ai.defaultModel` از لایه‌های WP-04 با منشأ |
| BO-069 | memory چهارسطحی با provenance/confidence/sensitivity/expiry و پایداری append-only |
| BO-070 | correction، supersede و disable با تاریخچهٔ کامل و بدون حذف |
| BO-071 | منبع و citation فقط سراسری یا همان پروژه (`CROSS_PROJECT_SOURCE_REJECTED`)؛ redaction بر اساس نقش **در همان پروژه** |
| BO-072 | Knowledge Proposal با حذف شناسه و پیوند پروژهٔ مبدأ، نمایش بدون منبع به مقصد، و ساخت memory مقصد فقط پس از پذیرش |

### نقص‌های واقعی که پیدا و اصلاح شد

1. **عدم پایداری:** گفتگو، memory و تخصیص‌ها فقط در حافظه بودند و با هر restart از بین می‌رفتند. اکنون در `collaboration_records` (append-only) ذخیره و با replay مستقل از ترتیب بازسازی می‌شوند.
2. **نشت محتوای محرمانه میان پروژه‌ها:** redaction از نقش سراسری کاربر استفاده می‌کرد؛ کاربری که در پروژهٔ A ادمین و در B مشاهده‌گر بود، memory محرمانهٔ B را می‌دید. اکنون نقش Grant همان پروژه به domain داده می‌شود؛ mutation test نشان داد آزمون این نشت را می‌گیرد.

### نتیجهٔ آزمون — ۲۰۲۶-۱۰-۰۶

- `pnpm check` کامل: `516` تست PASS، `0` شکست؛ Documentation `149` سند و `0` خطا؛ build `306` ماژول و `62` فایل JSON.
- `pnpm test:browser`: Owner، Admin و Viewer در Chromium واقعی فقط پروژه‌ها، KPIها و کنترل‌های مجاز خود را دیدند؛ آزمون پیش از اصلاح CSS شکست خورد و پس از آن PASS شد.
- PostgreSQL 16 واقعی: ۷ رکورد همکاری ذخیره و بازخوانی شد، متن فارسی سالم ماند، memory محرمانه برای Viewer پنهان بود و `UPDATE` روی جدول با خطای append-only رد شد.
- هیچ Production، Secret، Provider زنده، هزینهٔ بیرونی یا نوشتن در Notion انجام نشد.
