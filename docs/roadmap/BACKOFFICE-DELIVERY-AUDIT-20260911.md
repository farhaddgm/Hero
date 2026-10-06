# ممیزی واقعی تحویل Back Office — ۲۰۲۶-۰۹-۱۱

> Document ID: `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911`
> Canonical path: `docs/roadmap/BACKOFFICE-DELIVERY-AUDIT-20260911.md`
> Title: ممیزی واقعی تحویل Back Office — ۲۰۲۶-۰۹-۱۱
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.5.0
> Owner: hero-architecture
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## ۱. نتیجهٔ قطعی

عبارت قبلی «۱۷۰ گام انجام شد» به معنی «۱۷۰ قابلیت کامل و قابل‌استفاده در Back Office» نبود. Evidenceهای Batch ثابت می‌کنند برای همهٔ بازه‌ها کد، قرارداد، تست یا سندی ساخته شده است؛ اما بسیاری از خروجی‌ها `record-only`، درون‌حافظه‌ای، API-only، بدون UI کامل یا نیازمند مجوز عملیاتی جدا هستند. طبق Definition of Done برنامه، این سطح از پوشش برای `completed` دانستن قابلیت نهایی کافی نیست.

وضعیت ممیزی‌شدهٔ ۱۷۰ گام:

| وضعیت | تعداد | معنی |
|---|---:|---|
| `verified` | ۲۰ | خروجی و Exit Gate بسته دارای پیاده‌سازی، تست و Evidence قابل اتکا است |
| `partial` | ۱۲۲ | بخشی ساخته شده، ولی حداقل یکی از Domain، persistence، API، authorization، audit، UI، integration test یا runtime evidence ناقص است |
| `gated` | ۲۶ | قرارداد یا اجرای امن داخلی موجود است، اما آزمون عملیاتی به مجوز جداگانه نیاز دارد |
| `owner_pending` | ۱ | پذیرش نهایی فقط باید توسط Owner ثبت شود |
| `deferred` | ۱ | Proposal پایلوت تا پذیرش نهایی عمداً متوقف است |
| **جمع** | **۱۷۰** | پوشش کامل شماره‌ها، نه تکمیل کامل محصول |

بنابراین **۱۵۰ گام هنوز برای رسیدن به وضعیت verified باز هستند**. این عدد از رجیستری ماشینی [delivery-audit-v1.0.json](../../config/backoffice/delivery-audit-v1.0.json) محاسبه و با checker fail-closed کنترل می‌شود.

## ۲. روش ممیزی

هر گام در برابر این شواهد بررسی شد:

1. الزام متناظر در `HERO-SPEC-022@1.0.0`؛
2. خروجی اجباری و Exit Gate در برنامهٔ `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1@1.1.0`؛
3. وجود Contract، Domain، Adapter/Persistence، API، Authorization/Audit، UI و Test؛
4. نتیجهٔ ثبت‌شدهٔ Test runtime؛
5. مرزهای مجوز برای Secret، عملیات بیرونی، Production، هزینه و عملیات مخرب.

وجود فایل یا عبور یک unit test به‌تنهایی `verified` محسوب نشده است. قابلیت دارای UI در صورتی کامل است که UI به API واقعی وصل باشد، مجوز و scope را رعایت کند و در Test قابل استفاده باشد. قابلیت عملیاتی نیز بدون runtime evidence واقعی کامل محسوب نمی‌شود.

## ۳. وضعیت Work Packageها

| Work Package | گام‌ها | وضعیت ممیزی | خروجی موجود | شرط بسته‌شدن |
|---|---:|---|---|---|
| WP-00 | BO-001..010 | verified | baseline، trace اولیه، threat model و batch control | بسته است |
| WP-01 | BO-011..020 | verified | مرزها، contract، event envelope، read model و migration foundation | بسته است |
| WP-02 | BO-021..030 | partial | Human Identity، Role، ProjectGrant، login/MFA/recovery API، persistence hydration و صفحهٔ `/identity` برای user/grant | enrollment/rotation واقعی MFA، recovery delivery، rate-limit runtime و ماتریس کامل Test |
| WP-03 | BO-031..042 | partial | Project workspace، create/archive/clone/intake/foundation و storage metadata | object storage خصوصی، scan/parser sandbox، import واقعی و UI |
| WP-04 | BO-043..052 | partial | source کامل ۲۰۲۶-۱۰-۰۵: schema تایپ‌دار، کف Policy، explain/changes/readiness، UI منشأ/diff، حذف پایدار پس از restart، property test | شواهد Runtime Test روی Candidate promote‌شده و اتصال گیت Policy به dispatch در WP-07 |
| WP-05 | BO-053..062 | partial | source کامل ۲۰۲۶-۱۰-۰۶: IA نقش‌محور، Portfolio صفحه‌بندی‌شده با نقش/تصمیم، KPI تعریف‌شده با drill-down دقیق، breadcrumb، آزمون HTTP و مرورگر سه‌نقشی | شواهد Runtime Test و shell واحد برای همهٔ surfaceها |
| WP-06 | BO-063..074 | partial | source کامل BO-063..072 در ۲۰۲۶-۱۰-۰۶: تیم/نقش/پروفایل نسخه‌دار، پنج context، thread پایدار، انتخاب مدل از تنظیمات، memory پایدار، redaction بر اساس نقش همان پروژه، Knowledge Proposal پاک‌سازی‌شده | BO-073 و BO-074 (خارج مجوز) و شواهد Runtime Test |
| WP-07 | BO-075..088 | partial | command intent، approval، workflow، scheduler و operations read model | Conversation-to-command، durable execution، Operations UI و crash evidence |
| WP-08 | BO-089..098 | partial | system catalog، drift و knowledge/document integration | acquisition مجاز واقعی، UI graph/search و rebuild evidence |
| WP-09 | BO-099..110 | partial | usage، ledger، budget، evaluation و health domain | ingestion واقعی، UI و drill-down تا Run/Evidence |
| WP-10 | BO-111..120 | partial | notification/audit/observability domain | Inbox قابل اقدام، trace سرتاسری و runtime storm/security evidence |
| WP-11 | BO-121..134 | gated | metadata-only GitHub/Server/Node/Secret contracts | اتصال واقعی و آزمون امنیتی با credential و مجوز جدا |
| WP-12 | BO-135..146 | gated | privacy/release/artifact/delivery record-only controls | clean-target recovery، telemetry/break-glass و acceptance عملیاتی |
| WP-13 | BO-147..156 | partial | retention/hardening contracts و تست‌های داخلی | bilingual/accessibility/load/cleanup/security runtime evidence |
| WP-14 | BO-157..168 | partial | migration/readiness contracts و سناریوهای داخلی | E2E دو پروژه، transfer، adversarial audit و traceability نهایی |
| WP-14 | BO-169 | owner_pending | فرمان پذیرش Owner طراحی شده است | پذیرش Artifact کامل پس از بسته‌شدن تمام Gateها |
| WP-14 | BO-170 | deferred | فقط Proposal پایلوت تعریف شده است | فقط پس از BO-169؛ بدون اجرای خودکار پایلوت |

## ۴. آنچه واقعاً ساخته شده است

این خروجی‌ها صرفاً سند نیستند و در source فعلی پیاده‌سازی دارند:

- Control Plane، Back Office، Portfolio و Product Studio؛
- APIهای Project create/archive/deletion request/intake/clone/foundation/settings؛
- Human Identity، Owner/Admin/Viewer و ProjectGrant در Domain/API؛
- تیم‌ها، Role/Profile، training، research، assignment و principles؛
- Conversation، Memory، Command، Workflow، Scheduler و Catalog در سطح Domain/API؛
- Token/Cost/Health/Evaluation/Notification/Observability read modelهای داخلی؛
- PostgreSQL migration/store، release gate، artifact metadata و final-readiness control؛
- CI، Release Candidate و Artifact immutable.

اما بخش مهمی از این قابلیت‌ها هنوز صفحهٔ مدیریتی کامل، integration عملیاتی یا Evidence محیط واقعی ندارند. بنابراین «وجود در source» با «تحویل کامل به کاربر» یکسان نیست.

## ۵. وضعیت منبع و محیط‌ها

| موضوع | وضعیت ممیزی |
|---|---|
| شاخهٔ منتشرشده | `codex/hero-001-project-charter` |
| HEAD اپلیکیشنِ ممیزی‌شده | `b23fbfe46f15e3ec0a630c5a4e6a54c1721d53a8` |
| Release Candidate | `v0.1.0-rc.21` |
| قابلیت جدید | Portfolio به Product Studio دارای project context و deep-link متصل شده است |
| Test | Control Plane با image محلی digest `sha256:d5ed264cb514f3205bef9c8953b20cb0ecc838c3b99dc5882b0dae81928a0510`، Proxy و PostgreSQL همگی healthy؛ `/health` و `/ready` موفق و API completion با Owner smoke شد |
| Production | در این ممیزی هیچ تغییر، deploy یا Secret mutation انجام نشده است |
| Test/Production parity | قرارداد source/config موجود است؛ برابری runtime فقط با digest یکسان و smoke test جدا اثبات می‌شود |

## ۶. ممیزی جاری ۸۱ Requirement

تک‌تک ۸۱ نیازمندی فایل [requirement-trace-v1.0.json](../../config/backoffice/requirement-trace-v1.0.json) دوباره در برابر source و تست فعلی بررسی شدند. نتیجهٔ سخت‌گیرانهٔ جاری:

| وضعیت | تعداد | معنی |
|---|---:|---|
| `implemented` | ۵ | الزام پایه با شواهد کافی در سطح تعریف‌شده پیاده‌سازی شده است |
| `partial` | ۷۶ | پیاده‌سازی داخلی یا شواهدی دارد، اما vertical slice کامل UI/persistence/runtime هنوز اثبات نشده است |
| `missing` | ۰ | هیچ الزام کاملاً بدون پیاده‌سازی باقی نمانده است |
| **جمع** | **۸۱** | همهٔ نیازمندی‌ها دقیقاً یک بار ممیزی شده‌اند |

`BO-DAT-001` اکنون یک private object-store متعلق به Hero دارد: فقط کلیدهای پروژه‌ای Hero را می‌پذیرد، در volume خصوصی ذخیره می‌کند، مسیرگریزی را رد می‌کند و API فهرست‌کردن یا افشای بایت‌ها ندارد. با وجود این، به دلیل بازبودن scanner و parser عملیاتی، وضعیت آن `partial` است نه `implemented`. baseline قبلی `5 implemented / 43 partial / 33 missing` در فیلد `previous_baseline` حفظ شده تا تاریخچه بازنویسی نشود.

دو شمارش نقش متفاوت دارند: Requirement Trace وضعیت ۸۱ الزام محصول را نشان می‌دهد؛ Delivery Audit وضعیت ۱۷۰ گام اجرایی را. Checker هر دو را هم‌زمان کنترل می‌کند و ارتقای شمارش بدون Evidence را fail-closed رد می‌کند.

## ۷. ترتیب اجرای باقی‌مانده پیش از Pilot

ترتیب معتبر همچنان dependency-based است:

1. بستن WP-02؛ Identity و ProjectGrant واقعی در UI و runtime؛
2. بستن WP-03؛ Project Registry، Intake امن و Foundation UI؛
3. بستن WP-04 و WP-05؛ Settings، Portfolio و Product Studio کامل؛
4. بستن WP-06 و WP-07؛ Conversation/Memory و Command/Workflow عملیاتی؛
5. بستن WP-08 تا WP-10؛ Catalog، Health/Cost و Inbox؛
6. اجرای مجوزدار WP-11 و WP-12 بدون فعال‌کردن Production زودهنگام؛
7. Hardening و Final E2E در WP-13 و WP-14؛
8. Owner acceptance در BO-169؛
9. پس از آن فقط Proposal مستقل BO-170 برای Pilot.

شروع قابلیت‌های پایین‌دست قبل از بسته‌شدن Gate بالادست می‌تواند برای کاهش ریسک به‌صورت prototype انجام شود، اما نباید `completed` ثبت شود.

## ۸. اقدامات مالک

برای پایان این بسته، اقدام دیگری از طرف مالک لازم نیست. Secret فقط در PostgreSQL محیط Test برای رفع password mismatch همگام شد؛ Production، Provider، هزینه، DNS و Pilot تغییر نکرده‌اند. اقدام بعدی مالک فقط زمانی لازم است که یک بستهٔ واقعی برای review در Test آماده شود یا عملیات gated جداگانه درخواست شود.

## ۹. بستهٔ تکمیل محلی این ممیزی

در این دور، قرارداد و read-model جدید `packages/contracts/src/backoffice-completion.mjs` و `packages/domain/src/backoffice-completion.mjs` اضافه شد و API project-scoped آن در `/api/projects/:projectId/completion` در دسترس است. این بسته capability matrix سه نقش، settings لایه‌ای، correlation chain، evidence coverage، retention dry-run و fa/en locale را یکپارچه می‌کند. طبق تعریف سخت‌گیرانهٔ این ممیزی، این کار شواهد داخلی را تقویت می‌کند اما به‌تنهایی وضعیت ۷۶ الزام `partial` یا ۱۵۰ گام remaining را به `verified` ارتقا نمی‌دهد.

## ۱۰. نتیجهٔ کنترل

کنترل با image مرجع Linux و Node `22.13.1` اجرا شد. اسکریپت‌های `npm run check` و `npm run check:docs` استفاده شدند چون pnpm روی image موجود نبود:

| کنترل | نتیجهٔ واقعی |
|---|---|
| `npm run check:docs` | PASS؛ ۱۲۸ سند، ۲ محصول و صفر خطا |
| audit checker | PASS؛ ۱۷۰ گام با ۲۰ verified/۱۵۰ remaining و ۸۱ نیازمندی با ۵ implemented/۷۶ partial/۰ missing |
| clean-room | PASS؛ ۴۵۱ فایل بررسی‌شده |
| build | PASS؛ ۲۴۳ ماژول و ۴۴ فایل JSON |
| tests | PASS؛ ۳۲۸ موفق، صفر ناموفق، صفر skipped |
| `npm run check` | PASS |

هشدار نبود Docker داخل خود container فقط محدودیت Docker-in-Docker است؛ verification از روی میزبان با image مرجع اجرا شد. پس از آن، image محلی فقط روی Test مستقر شد و `/health`/`/ready` موفق تأیید شدند؛ Production تغییر نکرد.
