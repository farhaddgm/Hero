# Evidence اجرای Collaboration، Command Center و System Catalog — BO-061 تا BO-090

> Document ID: `HERO-EVIDENCE-BACKOFFICE-COLLABORATION-COMMAND-CATALOG-BO-061-090`
> Canonical path: `docs/roadmap/BACKOFFICE-COLLABORATION-COMMAND-CATALOG-BO-061-090.md`
> Title: Evidence اجرای Collaboration، Command Center و System Catalog — BO-061 تا BO-090
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.2.0
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

## به‌روزرسانی ۲۰۲۶-۱۰-۰۶ — BO-073 تا BO-090 (مجوز `BATCH-BACKOFFICE-20261006-023`)

مجوز مالک: گام‌های `BO-073..BO-092` طبق `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1@1.2.0` و `HERO-SPEC-022@1.0.0`؛ Production، Secret، هزینهٔ بیرونی، Provider زنده، فراخوانی زندهٔ GitHub و نوشتن در Notion خارج از مجوز. Global Stop خاموش بود. وضعیت ممیزی تا شواهد Runtime Test همچنان `partial` است.

| گام | شاهد source |
|---|---|
| BO-073 | `tests/collaboration-adversarial-bo073.test.mjs`: prompt میان‌پروژه‌ای، memory poisoning، memory کهنه/منقضی و context غیرمجاز؛ memory دستورمانند علامت می‌خورد، از بازیابی پیش‌فرض و Context هوش مصنوعی کنار می‌رود و فقط ویرایشگر می‌تواند آن را بازبینی کند |
| BO-074 | صفحهٔ `surface=collaboration` (`project-collaboration-view.mjs`): تیم، نقش/متخصص، گفتگو و memory همان پروژه با citation داخلی؛ citation به پیام همین پروژه به همان پیام لینک می‌شود؛ redaction بر اساس نقش همان پروژه |
| BO-075 | taxonomy عمل با کف ریسک (`COMMAND_RISK_UNDERSTATED`)؛ عمل ناشناخته حداقل medium و هرگز مستقیم |
| BO-076 | تبدیل پیام گفتگو به intent با `sourceRef` به همان پیام؛ سرور وجود پیام در همان پروژه را بررسی می‌کند |
| BO-077 | کارت فرمان: دسته، کف ریسک، side effect، جبران، منبع، پیش‌نمایش payload و گیت‌های لازم |
| BO-078 | تصمیم‌های تغییرناپذیر و نسخه‌دار با `supersedesDecisionId` و snapshot سیاست پروژه |
| BO-079 | اجرای مستقیم فقط برای عمل directEligible با ریسک low و `automation.mode` مجاز پروژه |
| BO-080 | تأیید با انقضا و لغو؛ قالب تأیید نسخه‌دار با ویرایش خوش‌بینانه و پیشنهاد قالب؛ قالب critical فقط مالک |
| BO-081 | زمان‌بندی منصفانهٔ وزن‌دار (اولویت + سن − اجرای جاری پروژه)، اولویت و سقف اجرای سنگین فقط مالک |
| BO-082 | قفل منبع و سقف اجرای سنگین پایدار |
| BO-083 | retry محدود (۳) با backoff، sweep زمان‌سنج (۳۰ دقیقه)، ثبت جبران |
| BO-084 | بازبینی همهٔ گیت‌ها هنگام dispatch: Global Stop، انقضا/لغو تأیید، تغییر سیاست پس از تصمیم، آمادگی سیاست؛ فرمان گیرکرده `blocked` با علت |
| BO-085 | Production همیشه پشت گیت جدا؛ preauthorization فقط رکورد، حداکثر هفت روز، قابل لغو و منطبق با digest |
| BO-086 | تابلوی عملیاتی قابل اقدام در Project Operations با آزمون Chromium واقعی (`tests/browser/command-board.browser.mjs`) |
| BO-087 | پایداری append-only در `command_decision_records` و replay مستقل از ترتیب؛ اجرای نیمه‌کاره پس از restart `interrupted` می‌شود |
| BO-088 | بازیابی دستی (retry/abandon/compensate)، پایان idempotent و عدم اجرای دوباره بدون تصمیم |
| BO-089 | System Catalog v1.1: چرخهٔ عمر `planned → active → deprecated → retired` با انتقال مجاز، metadata لازم برای هر نوع |
| BO-090 | ثبت هر نُه نوع، رابطه‌های تایپ‌دار و بدون چرخه، تاریخچهٔ نسخه، منع بازنشستگی با وابستهٔ زنده؛ پایداری با migration `022` |

### نقص‌های واقعی که پیدا و اصلاح شد

1. **IDOR فرمان:** مسیرهای فرمان شناسهٔ فرمان را بدون بررسی پروژهٔ URL می‌پذیرفتند و `dispatch-next` یک پروژه می‌توانست فرمان پروژهٔ دیگر را اجرا کند. اکنون هر مسیر `assertInProject` و dispatch محدود به پروژه دارد؛ mutation test هر دو را می‌گیرد.
2. **نقش سراسری در فرمان‌ها:** مسیرهای فرمان با نقش مالک اجرا می‌شدند؛ اکنون نقش Grant همان پروژه اعمال می‌شود و Viewer نمی‌تواند بنویسد.
3. **اسکریپت اتاق کنترل هرگز اجرا نمی‌شد:** `$` به‌جای id، نام تگ را جست‌وجو می‌کرد و render سمت کلاینت خطا می‌داد. با آزمون مرورگر پیدا و اصلاح شد.
4. **حلقهٔ وابستگی پنهان:** تشخیص چرخه فقط رابطهٔ `depends-on` را دنبال می‌کرد؛ اکنون همهٔ رابطه‌های بدون‌چرخه یک گراف مشترک‌اند.

### نتیجهٔ آزمون — ۲۰۲۶-۱۰-۰۶

- `pnpm check` کامل: `538` تست PASS، `0` شکست؛ Documentation `0` خطا.
- `pnpm test:browser`: `2/2` PASS (Portfolio سه‌نقشی و تابلوی فرمان با کلیک واقعی).
- PostgreSQL 16 واقعی: ۱۲ رکورد فرمان و ۶ رکورد Catalog ذخیره و بازخوانی شد؛ اجرای نیمه‌کاره پس از replay `interrupted` بود؛ `UPDATE`/`DELETE` روی هر دو جدول رد شد؛ migration `022` اعمال شد.
- هیچ Production، Secret، Provider زنده، هزینهٔ بیرونی، فراخوانی زندهٔ GitHub یا نوشتن در Notion انجام نشد.
