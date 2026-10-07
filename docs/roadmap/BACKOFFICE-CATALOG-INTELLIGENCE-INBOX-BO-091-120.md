# Evidence اجرای Catalog، Intelligence و Inbox — BO-091 تا BO-120

> Document ID: `HERO-EVIDENCE-BACKOFFICE-CATALOG-INTELLIGENCE-INBOX-BO-091-120`
> Canonical path: `docs/roadmap/BACKOFFICE-CATALOG-INTELLIGENCE-INBOX-BO-091-120.md`
> Title: Evidence اجرای Catalog، Intelligence و Inbox — BO-091 تا BO-120
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.3.0
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

## به‌روزرسانی ۲۰۲۶-۱۰-۰۶ — BO-093 تا BO-112 (مجوز `BATCH-BACKOFFICE-20261006-024`)

مجوز مالک: گام‌های `BO-093..BO-112` طبق `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1@1.2.0` و `HERO-SPEC-022@1.0.0`؛ Production، Secret، هزینهٔ بیرونی، Provider زنده، فراخوانی زندهٔ GitHub و نوشتن در Notion خارج از مجوز. Global Stop خاموش بود. وضعیت ممیزی `partial` می‌ماند تا Candidate بعدی (`rc.38`) روی Test promote شود و آزمون پذیرش روی آن PASS شود.

| گام | شاهد source |
|---|---|
| BO-093 | ارجاع‌های تایپ‌دار owner/team/document/run/artifact/health (تیم باید در کاتالوگ Hero باشد، سند و artifact فقط داخلی یا digest)؛ `entityView` سلامت زنده را بر برچسب ذخیره‌شده مقدم می‌کند |
| BO-094 | کاتالوگ سند: `decision/research/evidence/roadmap/specification/runbook/note`، رابطه‌های `supersedes/implements/evidences/decides/depends-on/references`، رد چرخه، علامت‌گذاری سند جایگزین‌شده بدون حذف |
| BO-095 | جست‌وجوی permission-aware فقط درون پروژهٔ همان کاربر؛ متن سند `restricted` برای Viewer redact و غیرقابل‌جست‌وجو است |
| BO-096 | `impact`: فهرست موجودیت‌های تأثیرپذیر با مسیر وابستگی؛ کارت فرمان با `payload.entityIds` اثر را نشان می‌دهد |
| BO-097 | `projection` قطعی با hash؛ ویرایش Notion هرگز Git را بازنویسی نمی‌کند و به Proposal (یا `conflict` وقتی نسخهٔ canonical جابه‌جا شده) تبدیل می‌شود؛ تصمیم فقط مالک و تغییر واقعی از مسیر Git review |
| BO-098 | `tests/wp08-integration-bo093.test.mjs`: بازسازی مستقل از ترتیب، چرخه، Drift، مجوز و قرارداد conflict؛ جست‌وجو و گراف قطعی‌اند |
| BO-099 | یک Usage Event واحد (`input + cached + output = total`)، منبع `recorded/synthetic/imported` (بدون فراخوانی زنده) |
| BO-100 | snapshot تغییرناپذیر Invocation؛ Usage همهٔ Scopeها را از آن به ارث می‌برد و ناسازگاری رد می‌شود |
| BO-101 | Ledger بر اساس هشت Scope و بازهٔ زمانی؛ `reconcile` ثابت می‌کند هر گروه‌بندی به همان جمع پروژه می‌رسد |
| BO-102 | سقف نسخه‌دار، هشدار نرم، pause امن در سقف سخت، رزرو بدون race، افزایش سقف و resume فقط مالک؛ مصرف پس از سقف همچنان ثبت می‌شود |
| BO-103 | Dataset ارزیابی و ارزیابی deterministic/human/AI (AI باید مدل و نسخهٔ judge را نام ببرد) |
| BO-104 | Feedback اختیاری برای milestone/release/output که هرگز گیت نیست |
| BO-105 | Scorecard: Goal Fit، Token Efficiency، Error/Rework |
| BO-106 | نرمال‌سازی بر اساس نوع کار و ریسک (وزن کیفیت برای کار پرریسک و Operations بیشتر)؛ دادهٔ کم صریحاً `insufficient-data` است |
| BO-107 | Health نسخهٔ `1.1` با confidence و freshness، تکرارپذیر با `asOf`؛ بدون دادهٔ کافی `unknown` است نه `healthy` |
| BO-108 | override بحرانی (`outage/vulnerability/isolation/cap-breach/manual`)؛ برداشتن فقط مالک و تاریخچه بازنویسی نمی‌شود |
| BO-109 | drill-down هزینه و سلامت تا رویداد مصرف، Invocation، Run و Evidence |
| BO-110 | تست completeness، cap race، replay فرمول، دادهٔ کم و drift داوری AI (`tests/wp09-usage-health-bo099.test.mjs`) |
| BO-111 | taxonomy (۹ دسته)، شدت، SLA (`critical` ۱۵ دقیقه تأیید و ۴ ساعت رفع)، مالک اجباری برای critical، چرخهٔ عمر و snooze محدود؛ اقدام‌های approve/reject/chat/run-fix فقط مسیریابی می‌شوند |
| BO-112 | deduplication با افزایش شدت و بازشدن پس از رفع، گروه‌بندی Incident با آستانهٔ طوفان |

سقف مصرف به اعلان تبدیل شد: عبور از آستانهٔ نرم هشدار و رسیدن به سقف سخت اعلان `critical` با مالک می‌سازد و پروژه را pause می‌کند. هیچ چیزی از Hero خارج نمی‌شود.

### نقص‌های واقعی که پیدا و اصلاح شد

1. **ترتیب گراف وابسته به ترتیب replay بود:** یال‌های گراف کاتالوگ و گراف اسناد اکنون مرتب‌اند تا بازسازی همیشه همان نتیجه را بدهد.
2. **store رکوردهای redactشده را رد می‌کرد:** کلید شبیه اعتبارنامه حتی با مقدار `[redacted]` رد می‌شد و ثبت پایدار audit یا action اعلان در سرور خطا می‌داد؛ اکنون فقط مقدار redactنشده رد می‌شود.
3. **مقدار نمایش اعلان‌های تکراری:** نمایش دوباره‌باز شدن بدون ردیف جدید و حفظ occurrence در `deduplication` آزموده و اصلاح شد.

### نتیجهٔ آزمون — ۲۰۲۶-۱۰-۰۶

- `pnpm check` کامل: `557` تست PASS، `0` شکست.
- mutation test: حذف سهم رزرو در cap، حذف override بحرانی، حذف ارتقای شدت و حذف redaction جست‌وجو هر کدام دست‌کم یک تست را شکست دادند.
- PostgreSQL 16 واقعی: رکوردهای مصرف، ارزیابی، override، اعلان، سند و گراف ذخیره و بازخوانی شدند؛ `DELETE` روی جدول با خطای append-only رد شد؛ migration `023` اعمال شد.
- آزمون پذیرش محلی با پایگاه دادهٔ واقعی و `SIGKILL`: `103/103` پیش از crash و `27/27` پس از آن.
- هیچ Production، Secret، Provider زنده، هزینهٔ بیرونی، فراخوانی زندهٔ GitHub یا نوشتن در Notion انجام نشد.

### تأیید روی Runtime Test — ۲۰۲۶-۱۰-۰۶

آزمون پذیرش نقش‌محور (run `20261006T201133Z-7321df`) روی `v1.1.5-rc.38` در host Test `PASS` شد. گام‌های `BO-093..095`، `BO-097..103` و `BO-105..112` `verified` شدند. `BO-096` (نمایش گراف وابستگی و blast radius) و `BO-104` (Feedback مالک) فقط API دارند و تا ساخت رابط کاربری `partial` می‌مانند.

## به‌روزرسانی ۲۰۲۶-۱۰-۰۷ — BO-113 تا BO-120 (مجوز `BATCH-BACKOFFICE-20261007-025`)

| گام | کار انجام‌شده در source | شواهد |
| --- | --- | --- |
| BO-113 | Inbox با پنج نما؛ شمارنده برابر فهرست؛ نمای «نیازمند تصمیم» فقط برای مالک/ادمین؛ مبدأ `person`/`automation` | `tests/wp10-inbox-bo113-120.test.mjs`، `tests/browser/inbox.browser.mjs` |
| BO-114 | approve/reject روی فرمان واقعی؛ run-fix فقط پیش‌نویس؛ chat پیوند internal؛ اقدام ناموجود ۴۰۹ و فرمان جعلی ۴۰۴ | همان آزمون HTTP |
| BO-115 | Correlation بین فرمان، اعلان، Trace و Audit؛ `gaps` برای Trace گمشده/ناشناخته | `GET /api/projects/:id/correlations/:correlationId` |
| BO-116 | جریان Activity جدا از Security؛ Timeline بدون رکورد امنیتی؛ Execution trace به ترتیب علّی | آزمون دامنه |
| BO-117 | طبقه‌بندی داده و فیلتر نقش؛ redaction مقدار شامل کلید، Bearer و توکن | آزمون «مقدار حساس» |
| BO-118 | کوئری با فیلتر/صفحه‌بندی؛ Export مالک‌-فقط با دلیل و ثبت در Security و خنثی‌سازی فرمول CSV؛ Retention با حداقل و dry-run | آزمون BO-118 |
| BO-119 | گزارش SLO پنج پروژکشن؛ `no-data` و `measurement-stale` هرگز سالم نیستند | آزمون BO-119 |
| BO-120 | آزمون حمله: طوفان ۳۰۰ هشدار، تکراری، Trace گمشده، مقدار حساس، فیلتر نقش؛ بازیابی بعد از restart | آزمون BO-120 و ۳۰ چک پذیرش |

وضعیت: هر هشت گام `partial` است تا Candidate `rc.39` روی Test آزمون پذیرش را PASS کند.
