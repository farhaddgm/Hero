# برنامهٔ جامع توسعهٔ Back Office Command Center — v1.2

> Document ID: `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1`
> Canonical path: `docs/roadmap/BACKOFFICE-COMMAND-CENTER-IMPLEMENTATION-v1.0.md`
> Title: برنامهٔ جامع توسعهٔ Back Office Command Center — v1.2
> Type: roadmap
> Scope: hero
> Status: active
> Version: 1.2.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## ۱. هدف و مرجع الزام

این سند ترتیب توسعهٔ Back Office جامع Hero را از وضع موجود تا آمادگی تحویل مشخص می‌کند. مرجع هنجاری همهٔ نیازمندی‌ها `HERO-SPEC-022` نسخهٔ `1.0.0` است. این برنامه نباید معنای آن سند را تغییر دهد؛ در تعارض، Specification مقدم و اجرای گام متوقف می‌شود.

این سند **برنامه است، نه مجوز اجرا**. پیش از Dispatch هر Batch باید Step IDهای دقیق، نسخهٔ `HERO-SPEC-022`، نسخهٔ همین برنامه، محیط، سقف Token/هزینه و Authorization Snapshot معتبر بررسی شوند. Global Stop باید خاموش باشد. Production، Secret، عملیات مخرب، هزینهٔ بیرونی، پیام بیرونی و Notion write هرکدام مجوز جدا دارند.

### جهت‌دهی نسخهٔ ۱.۲: کارخانهٔ محصول کنترل‌شده

گام‌های `BO-001..170` بدون حذف یا تغییر معنایی حفظ شده‌اند. sequencing جاری و تفصیل مسیر «مسئلهٔ Owner → Proposal → اجرای محصول ایزوله → Product Test → انتقال» در `HERO-ROADMAP-CONTROLLED-PRODUCT-FACTORY-20260917@1.0.0` آمده است. آن سند اجرای بیرونی را مجاز نمی‌کند و فقط Workstreamهای جدید را به همین BO stepها نگاشت می‌کند. Product Runtime روی همان host Hero، اگر روزی فعال شود، باید repository، Compose project، network، volume، database، port، Secret reference و rollback مستقل داشته باشد؛ هیچ Step از این سند اجازهٔ reuse منابع Hero یا app دیگر را نمی‌دهد.

## ۲. راهبرد اجرا

توسعه با رویکرد «vertical slice کنترل‌شده» انجام می‌شود: هر Work Package باید Domain، persistence، API، authorization، event/audit، UI واقعی، تست و مستندات مرتبط را با هم تکمیل کند. ساختن صفحهٔ نمایشی بدون Command/Query واقعی یا ساختن Backend بدون مسیر مدیریتی قابل استفاده، خروجی کامل محسوب نمی‌شود.

ترتیب کلان:

```text
Baseline & contracts
  → Project/IAM foundation
    → Policy & settings
      → Portfolio/Product Studio
        → Conversation/Memory/Teams
          → Command/Workflow/Scheduler
            → Catalog/Knowledge
              → Health/Cost/Evaluation/Inbox
                → Server/Environment/Secret
                  → Product execution isolation (cross-cutting; Test-only)
                    → Production/Release/Delivery
                    → Hardening/Migration/Final acceptance
```

قواعد ترتیب:

- Work Package بعدی فقط پس از Exit Gate بستهٔ پیشین آغاز می‌شود؛
- گام‌های دارای برچسب `[P]` پس از پیش‌نیاز مشترک می‌توانند موازی اجرا شوند؛
- Schema و authorization contract همیشه پیش از UI mutation ساخته می‌شوند؛
- هیچ اتصال واقعی Production یا Notion در جریان تست محلی انجام نمی‌شود؛
- پایلوت محصول فقط پس از `BO-169`، Exit Gateهای delivery/portability و یک مجوز جداگانه قابل طرح است.

## ۳. نقش تیم‌ها در برنامه

| نقش اجرایی | مسئولیت غالب |
|---|---|
| راهبرو | ترتیب، Dependency، Authorization، گزارش و Exit Gate |
| محصولو | Requirement، Acceptance، Product Studio و جریان مدیریتی |
| تحلیلگرو | Gap analysis، KPI، Health و ارزیابی تصمیم |
| معمارو | Boundaries، ADR، Data/API/Event و portability |
| دیزاینرو | معماری اطلاعات، فارسی/انگلیسی، accessibility و usability |
| دولوپرو | پیاده‌سازی Domain، API، UI، migration و integration |
| تسترو | تست قطعی، integration، E2E، regression و Evidence |
| امینتو | Threat model، authorization، Secret، Production data و abuse test |
| عملیاتو | Runtime، Node Agent، environment، deploy، backup و recovery |
| داده‌و | Metric، trace، token ledger، scorecard و Health Engine |
| ایده‌پردازو | فقط برای Proposalهای تجربه/قابلیت؛ بدون تغییر خودکار Scope |

هر گام یک مالک اصلی دارد؛ همکاری تیم دیگر مسئولیت مالک اصلی را مبهم نمی‌کند.

## ۴. WP-00 — تثبیت مبنا و کنترل تغییر

**هدف:** تبدیل Specification تصویب‌شده به قرارداد قابل‌ردیابی و جلوگیری از توسعه بر اساس اسناد قدیمی.

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-001` | راهبرو | ثبت `HERO-SPEC-022 v1.0.0` به‌عنوان baseline فعال و ثبت تصویب مالک. |
| `BO-002` | معمارو | تهیهٔ Inventory از route، service، domain، registry، projection، schema و UI فعلی Back Office. |
| `BO-003` | محصولو | ساخت Requirement Trace Registry برای تمام شناسه‌های `BO-*` سند مرجع. |
| `BO-004` | معمارو | نگاشت Back Office موجود به `keep / extend / migrate / retire` و ثبت دلیل هر مورد. |
| `BO-005` | امینتو | تهیهٔ Threat Model اولیه برای multi-project، AI command، file upload، Secret و Production access. |
| `BO-006` | داده‌و | ثبت baseline واقعی performance، response size، event volume، test count و storage. |
| `BO-007` | معمارو | تعیین Strategy مهاجرت سازگار با backward compatibility و بدون Big Bang. |
| `BO-008` | تسترو | ساخت ماتریس Test Level در برابر Requirement IDها و شناسایی coverage gap. |
| `BO-009` | راهبرو | شکستن برنامه به Authorization Batchهای کوچک با Step range و خروجی قابل بازگشت. |
| `BO-010` | راهبرو | ثبت Exit Report شامل gapها، ریسک‌ها، dependencyها و پیشنهاد ادامه. |

**Exit Gate:** هیچ سند فعال رقیب، Requirement بدون owner، یا قابلیت فعلی بدون تصمیم migration باقی نماند.

## ۵. WP-01 — مرز ماژول‌ها، قرارداد داده و Event Backbone

**پیش‌نیاز:** `BO-010`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-011` | معمارو | تعریف Contextهای Portfolio، Project، Identity، Policy، Conversation، Workflow، Catalog، Evaluation، Infrastructure و Delivery. |
| `BO-012` | معمارو | ثبت ADR مرز Control Plane، Execution Plane و Data Plane. |
| `BO-013` | معمارو | تعریف شناسه‌های پایدار `project_id`، `user_id`، `command_id`، `run_id`، `artifact_id` و `correlation_id`. |
| `BO-014` | معمارو | طراحی schema موجودیت‌های بخش ۲۶ Specification با version و lifecycle. |
| `BO-015` | دولوپرو | افزودن contractهای ماشینی و validatorهای schema بدون mutation بیرونی. |
| `BO-016` | دولوپرو | طراحی migrationهای append-only و rollback-safe برای PostgreSQL. |
| `BO-017` | دولوپرو | تکمیل Event Envelope شامل schema version، actor، project، correlation و idempotency. |
| `BO-018` | دولوپرو | تکمیل Outbox/Inbox و الگوی مصرف idempotent eventها. |
| `BO-019` | داده‌و | طراحی Read Modelهای Portfolio و Project Overview با rebuild قطعی. |
| `BO-020` | تسترو | تست schema compatibility، replay، duplicate event، stale write و rebuild digest. |

**Exit Gate:** Data model و Event backbone بتوانند دو پروژهٔ مستقل را بدون UI و بدون تداخل بازسازی کنند.

## ۶. WP-02 — Identity، MFA و Project-scoped Authorization

**پیش‌نیاز:** `BO-020`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-021` | امینتو | تعریف permission matrix ماشینی برای Owner، Project Admin و Viewer. |
| `BO-022` | دولوپرو | پیاده‌سازی User، Role و ProjectGrant با deny-by-default. |
| `BO-023` | دولوپرو | افزودن middleware مشترک authorization برای Query و Command. |
| `BO-024` | دولوپرو | enforceکردن `project_id` در database query، cache key، storage، queue و event. |
| `BO-025` | دولوپرو | پیاده‌سازی ورود email/password و MFA برای Owner/Admin. |
| `BO-026` | امینتو | پیاده‌سازی session lifecycle، revocation، expiry، device metadata و rate limit. |
| `BO-027` | دولوپرو | ساخت مسیر Owner-only برای دعوت/حذف کاربر و تغییر ProjectGrant. |
| `BO-028` | دولوپرو | ساخت recovery flow مالک از ایمیل اصلی + recovery code/console fallback. |
| `BO-029` | امینتو | افزودن step-up authentication و cooldown برای Reveal/Production پس از recovery. |
| `BO-030` | تسترو | تست exhaustive سه Role، IDOR، cross-project access، revoked session و recovery abuse. |

**Exit Gate:** هیچ API یا Projection پروژه‌ای بدون ProjectGrant صحیح قابل دسترسی نباشد و تست منفی سه Role کامل باشد.

## ۷. WP-03 — Project Registry، Intake، Import و Clone

**پیش‌نیاز:** `BO-030`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-031` | محصولو | نهایی‌سازی lifecycle پروژه و Definition of Project aggregate. |
| `BO-032` | دولوپرو | پیاده‌سازی Project Registry و فرمان Owner-only ایجاد پروژه. |
| `BO-033` | دولوپرو | پیاده‌سازی Archive و deletion request دو مرحله‌ای بدون حذف فوری تاریخچه. |
| `BO-034` | محصولو | تعریف Intake schema برای intent، هدف، کاربر، محدودیت، خروجی و autonomy. |
| `BO-035` | دولوپرو | ساخت Private Upload API با quota، checksum و project-scoped object key. |
| `BO-036` | امینتو | افزودن allowlist، MIME/signature validation، malware scan و sandbox extraction. |
| `BO-037` | دولوپرو | parserهای PDF/Word/Excel/image/text/ZIP/link را پشت adapterهای محدود اضافه کند. |
| `BO-038` | امینتو | محافظت content ingestion در برابر prompt injection، ZIP bomb و SSRF. |
| `BO-039` | محصولو | ساخت Project Foundation Proposal شامل brief، roadmap، team، model، budget، environment و gates. |
| `BO-040` | دولوپرو | پیاده‌سازی approve/revise/version flow برای Foundation Proposal. |
| `BO-041` | دولوپرو | ساخت Import read-only برای GitHub موجود و تولید Inventory/Adoption Plan. |
| `BO-042` | دولوپرو | ساخت Clone از Template/Project با exclusion اجباری Secret/data/memory/history. |

**Exit Gate:** Owner بتواند دو پروژهٔ متفاوت را ایجاد یا Import کند و isolation فایل، Proposal و history با تست ثابت شود.

## ۸. WP-04 — Effective Settings و Project Policy Pack

**پیش‌نیاز:** `BO-042`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-043` | معمارو | تعریف schema تنظیمات و لایه‌های inheritance از invariant تا Run override. |
| `BO-044` | دولوپرو | پیاده‌سازی Policy Resolver قطعی با precedence و conflict error. |
| `BO-045` | دولوپرو | ذخیرهٔ نسخه، diff، actor، reason، impact و rollback reference هر تغییر. |
| `BO-046` | دولوپرو | ساخت Query برای effective value و source provenance هر field. |
| `BO-047` | دولوپرو | ساخت Command برای override، remove override، supersede و rollback. |
| `BO-048` | محصولو | تعریف Templateهای Policy Pack بر اساس نوع/risk پروژه. |
| `BO-049` | دولوپرو | تولید خودکار Policy Pack پیشنهادی هنگام Intake. |
| `BO-050` | امینتو | enforceکردن non-weakenable invariant و fail-closed در conflict/missing policy. |
| `BO-051` | دولوپرو | ساخت بخش Settings با نمایش effective/source/diff/impact، مبتنی بر API واقعی. |
| `BO-052` | تسترو | property test برای precedence، inheritance، rollback، stale version و invariant bypass. |

**Exit Gate:** یک Role بتواند در پروژهٔ A از Model متفاوت با پروژهٔ B استفاده کند و منشأ هر مقدار دقیقاً قابل توضیح باشد.

## ۹. WP-05 — Portfolio Shell و Project Product Studio

**پیش‌نیاز:** `BO-052`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-053` | دیزاینرو | تثبیت Information Architecture سطح Portfolio و Project بدون طراحی تزئینی. |
| `BO-054` | دولوپرو | ساخت Back Office Shell و project-aware navigation. |
| `BO-055` | دولوپرو | ساخت Portfolio read model با فیلتر Role/Grant و pagination. |
| `BO-056` | دولوپرو | نمایش Project card شامل roadmap، health، token، task، decision و output. |
| `BO-057` | دولوپرو | اتصال انتخاب پروژه به Product Studio همان `project_id`. |
| `BO-058` | محصولو | ساخت Project Overview و بخش‌های استاندارد تعریف‌شده در Specification. |
| `BO-059` | دولوپرو | ایجاد deep-link و breadcrumb پایدار برای Project/Entity/Context. |
| `BO-060` | داده‌و | ساخت drill-down قرارداددار برای KPIها، بدون aggregate مجهول. |
| `BO-061` | دولوپرو | افزودن global/project search با permission filtering. |
| `BO-062` | تسترو | تست Role-aware rendering، navigation isolation، pagination و empty/error/stale states. |

**Exit Gate:** Owner، Admin و Viewer هرکدام Portfolio/Project مناسب خود را با دادهٔ واقعی و بدون نشت ببینند.

## ۱۰. WP-06 — Team، Role، Agent Identity، Conversation و Memory

**پیش‌نیاز:** `BO-062`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-063` | محصولو | تطبیق ۱۱ Team موجود با مدل پایدار Team/Role/Assignment پروژه‌ای. |
| `BO-064` | دولوپرو | project-scopeکردن اصول، policy، KPI، memory و assignment تیم‌ها. |
| `BO-065` | دولوپرو | پیاده‌سازی Role Profile نسخه‌دار و Persistent Specialist Profile اختیاری. |
| `BO-066` | دولوپرو | ساخت پنج Context Conversation و ContextBinding ماشینی. |
| `BO-067` | دولوپرو | ساخت thread/session history قابل ادامه با scope و retention. |
| `BO-068` | دولوپرو | افزودن Model/Provider selection برای Project/Team/Role/Conversation. |
| `BO-069` | دولوپرو | پیاده‌سازی Memory چهارسطحی با provenance/confidence/sensitivity/expiry. |
| `BO-070` | دولوپرو | ساخت correction/disable/supersede بدون حذف تاریخچه. |
| `BO-071` | امینتو | enforceکردن retrieval isolation و redaction در Conversation/Memory. |
| `BO-072` | دولوپرو | ساخت Knowledge Proposal میان پروژه‌ای با sanitize و target acceptance. |
| `BO-073` | تسترو | تست cross-project prompt، memory poisoning، stale memory و unauthorized context. |
| `BO-074` | محصولو | ساخت صفحات Team/Role/Conversation/Memory با citation به منبع داخلی. |

**Exit Gate:** گفتگو با Hero، Project، Team، Role و Entity مستقل کار کند و حافظهٔ پروژهٔ دیگر هرگز بازیابی نشود.

## ۱۱. WP-07 — Command Center، Approval، Workflow و Scheduler

**پیش‌نیاز:** `BO-074`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-075` | معمارو | تعریف Command Intent schema و Risk/Action taxonomy. |
| `BO-076` | دولوپرو | تبدیل فرمان گفتگو/UI به Intent ساختاریافته و قابل نمایش. |
| `BO-077` | امینتو | پیاده‌سازی authorization decision با snapshot نسخه‌دار و immutable. |
| `BO-078` | دولوپرو | ساخت direct execution برای low-risk فقط در Policy صریح. |
| `BO-079` | دولوپرو | ساخت Command Card و Preview/Approval برای high-risk. |
| `BO-080` | دولوپرو | تکمیل Workflow state machine durable، resumable و idempotent. |
| `BO-081` | دولوپرو | افزودن checkpoint، retry bounded، timeout، compensation و manual recovery. |
| `BO-082` | دولوپرو | ساخت Approval Template پیشنهادی و ویرایش Owner/Admin. |
| `BO-083` | دولوپرو | ساخت Production preauthorization با project/time/change/artifact/test limits. |
| `BO-084` | دولوپرو | enforceکردن expiry، revocation، Global Stop و version mismatch پیش از Dispatch. |
| `BO-085` | دولوپرو | ساخت Weighted Fair Scheduler، aging، resource claim و exclusive lock. |
| `BO-086` | دولوپرو | اعمال default دو Run سنگین و کنترل priority توسط Owner. |
| `BO-087` | تسترو | تست replay، duplicate command، crash/resume، revoked approval، starvation و lock. |
| `BO-088` | راهبرو | ساخت Operations view برای queue، run، pause/resume، blocker و recovery. |

**Exit Gate:** Command از گفتگو تا Run و Evidence با یک correlation قابل ردیابی باشد و هیچ high-risk action بدون Gate اجرا نشود.

## ۱۲. WP-08 — System Catalog، Documents و Knowledge

**پیش‌نیاز:** `BO-088`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-089` | معمارو | نهایی‌سازی SystemEntity/Dependency schema و lifecycle. |
| `BO-090` | دولوپرو | ثبت Project/Application/Component/Service/Repository/API/Data/Environment/Server. |
| `BO-091` | دولوپرو | کشف metadata از GitHub و مقایسه با desired catalog. |
| `BO-092` | دولوپرو | ساخت Drift detection و Proposal اصلاح بدون overwrite خودکار. |
| `BO-093` | دولوپرو | اتصال Catalog به owner، team، document، run، artifact و health. |
| `BO-094` | محصولو | یکپارچه‌سازی Document Catalog، Decision، Research، Evidence و Roadmap Graph. |
| `BO-095` | دولوپرو | تکمیل جست‌وجوی permission-aware روی Catalog/Document/Knowledge. |
| `BO-096` | دولوپرو | نمایش dependency graph و blast radius برای Proposal/Command. |
| `BO-097` | دولوپرو | نگهداشت Git به‌عنوان canonical و Notion به‌عنوان projection/proposal surface. |
| `BO-098` | تسترو | تست catalog rebuild، dependency cycle، drift، permission و Notion conflict contract. |

**Exit Gate:** Admin بتواند همهٔ اجزای پروژه و ارتباط آن‌ها را ببیند و هر Drift به Proposal قابل رسیدگی تبدیل شود.

## ۱۳. WP-09 — Token Ledger، Evaluation، Performance و Health

**پیش‌نیاز:** `BO-088` و `BO-098`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-099` | داده‌و | تعریف Usage Event واحد برای input/cached/output/total token. |
| `BO-100` | دولوپرو | ثبت immutable invocation snapshot و انتساب مصرف به همهٔ Scopeها. |
| `BO-101` | داده‌و | ساخت Token Ledger و aggregateهای Project/Team/Role/Task/Run/Model. |
| `BO-102` | دولوپرو | پیاده‌سازی Soft threshold، Hard cap، pause امن و ویرایش سقف. |
| `BO-103` | داده‌و | تعریف Evaluation dataset و evaluatorهای deterministic/human/AI. |
| `BO-104` | محصولو | ساخت Feedback اختیاری Owner برای Milestone/Release/Output. |
| `BO-105` | داده‌و | تعریف Scorecard Goal Fit، Token Efficiency و Error/Rework. |
| `BO-106` | داده‌و | افزودن شاخص‌های مکمل و normalization بر اساس نوع/ریسک کار. |
| `BO-107` | داده‌و | پیاده‌سازی Health Engine با formula version، confidence و freshness. |
| `BO-108` | امینتو | افزودن critical override برای outage، vulnerability، isolation و cap breach. |
| `BO-109` | دولوپرو | ساخت drill-down cost/performance/health تا Evidence و Run. |
| `BO-110` | تسترو | تست accounting completeness، cap race، formula replay، sparse data و AI judge drift. |

**Exit Gate:** هر Health/Cost/Performance عدد قابل توضیح، نسخه‌دار و متصل به Evidence باشد؛ عدد ساختگی ممنوع است.

## ۱۴. WP-10 — Notification Inbox، Audit و Observability

**پیش‌نیاز:** `BO-088` و `BO-110`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-111` | محصولو | تعریف taxonomy اعلان، severity، SLA، owner و lifecycle. |
| `BO-112` | دولوپرو | ساخت Notification aggregate و deduplication/incident grouping. |
| `BO-113` | دولوپرو | ساخت Viewهای Needs my decision، Critical، Upcoming، Automation و Resolved. |
| `BO-114` | دولوپرو | افزودن actionهای approve/reject/snooze/assign/chat/run-fix. |
| `BO-115` | داده‌و | propagation سرتاسری correlation/trace context. |
| `BO-116` | داده‌و | جداسازی Activity Timeline، Execution Trace و Security Audit. |
| `BO-117` | امینتو | redaction و data classification برای log/trace/audit. |
| `BO-118` | دولوپرو | ساخت query، filter، export policy و retention hook برای Audit. |
| `BO-119` | داده‌و | تعریف SLI/SLO خود Hero و freshness/lag برای Projectionها. |
| `BO-120` | تسترو | تست alert storm، duplicate، missing trace، sensitive log و permission filtering. |

**Exit Gate:** Owner/Admin بتواند از Inbox اقدام کند و کل زنجیرهٔ تصمیم تا اجرا با correlation واحد دیده شود.

## ۱۵. WP-11 — Environment، GitHub، Server و Secret

**پیش‌نیاز:** `BO-088`، `BO-098` و `BO-120`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-121` | عملیاتو | تعریف contract دقیق Development/Test/Production و منع Environment سفارشی نسخهٔ اول. |
| `BO-122` | دولوپرو | تکمیل GitHub adapter برای repository، branch، workflow، release و deployment metadata. |
| `BO-123` | عملیاتو | طراحی Hero Node Agent protocol، identity، heartbeat و capability report. |
| `BO-124` | امینتو | Threat model اتصال outbound، bootstrap، command signing و agent compromise. |
| `BO-125` | دولوپرو | ساخت Server Registry و onboarding با IP/domain/credential reference. |
| `BO-126` | عملیاتو | ساخت prerequisite/connectivity plan و bootstrap artifact checksum‌شده. |
| `BO-127` | دولوپرو | پیاده‌سازی registration یک‌بارمصرف و mTLS/token rotation برای Agent. |
| `BO-128` | دولوپرو | ساخت desired/observed state و Reconciler برای Server/Environment. |
| `BO-129` | عملیاتو | enforceکردن resource isolation، concurrency و environment-specific runner. |
| `BO-130` | امینتو | اتصال Secret Store و API register/replace/rotate/revoke برای Owner/Admin. |
| `BO-131` | امینتو | ساخت Owner-only Reveal با MFA/re-auth/reason/time limit/audit. |
| `BO-132` | امینتو | enforceکردن egress/internet policy و allowlist ابزار/دامنه. |
| `BO-133` | دولوپرو | ساخت صفحات Environments/Servers/Secrets metadata و عملیات مجاز. |
| `BO-134` | تسترو | تست agent impersonation، replay، offline node، credential leak، rotate و revoke. |

**Exit Gate:** Development و Test روی Node جدا قابل مدیریت باشند؛ هیچ اتصال Production واقعی در این Package لازم یا مجاز نیست.

## ۱۶. WP-12 — Production Privacy، Release و Delivery Bundle

**پیش‌نیاز:** `BO-134`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-135` | امینتو | تعریف Production telemetry allowlist و redaction policy. |
| `BO-136` | دولوپرو | ingest فقط health/metric/sanitized-log/trace metadata با schema کنترل‌شده. |
| `BO-137` | امینتو | ساخت Break-glass Production Data Access با scope/time/reason/approval/audit. |
| `BO-138` | امینتو | منع پیش‌فرض Production payload در AI/Memory/Eval و تست bypass. |
| `BO-139` | عملیاتو | تکمیل Release state machine از tested commit تا deploy/rollback. |
| `BO-140` | دولوپرو | ساخت Artifact registry با digest، provenance، attestation و SBOM reference. |
| `BO-141` | عملیاتو | ساخت Delivery Matrix برای web، backend، mobile، data و multi-service. |
| `BO-142` | دولوپرو | تولید Delivery Bundle شامل source/artifact/config/migration/deploy/docs/reports. |
| `BO-143` | عملیاتو | ساخت portability verification روی target تمیز در Test. |
| `BO-144` | عملیاتو | ساخت backup/restore/upgrade/rollback rehearsal و Evidence. |
| `BO-145` | محصولو | ساخت Owner/Admin final acceptance با Artifact identity و exception list. |
| `BO-146` | تسترو | تست tampered artifact، wrong commit، failed rollback، data leak و portability failure. |

**Exit Gate:** یک Artifact آزموده‌شده بتواند بدون Secret در Delivery Bundle قرار گیرد و روی target تمیز Test بازیابی شود.

## ۱۷. WP-13 — Retention، زبان، Accessibility و Operational Hardening

**پیش‌نیاز:** `BO-120` و `BO-146`

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-147` | معمارو | پیاده‌سازی Retention Policy per-project با minimumهای غیرقابل‌تضعیف. |
| `BO-148` | دولوپرو | ساخت cleanup job، dry-run، hold، digest preservation و deletion audit. |
| `BO-149` | دیزاینرو | تکمیل فارسی/انگلیسی، RTL/LTR، locale و identifier stability. |
| `BO-150` | دیزاینرو | اجرای accessibility audit برای keyboard، focus، contrast و non-color status. |
| `BO-151` | دولوپرو | بهینه‌سازی read model، pagination، lazy trace و query budget. |
| `BO-152` | امینتو | اجرای security review روی auth، authorization، upload، AI tool و Node Agent. |
| `BO-153` | تسترو | اجرای load/soak/failure injection برای Portfolio، Queue، Event و Storage. |
| `BO-154` | عملیاتو | تست backup/restore خود Control Plane و disaster recovery metadata. |
| `BO-155` | امینتو | اجرای secret scan، dependency scan و audit coverage report. |
| `BO-156` | تسترو | regression کامل فارسی/انگلیسی و سه Role روی Desktopهای هدف. |

**Exit Gate:** NFRها، Retention، bilingual UX، accessibility، backup و security evidence کامل باشند.

## ۱۸. WP-14 — مهاجرت Back Office فعلی و پذیرش نهایی

**پیش‌نیاز:** تمام Exit Gateهای قبل

| Step ID | مالک | اقدام و خروجی اجباری |
|---|---|---|
| `BO-157` | معمارو | اجرای migration plan برای route/projection/schemaهای قدیمی با compatibility window. |
| `BO-158` | دولوپرو | انتقال UI قدیمی به Shell جدید و حذف فقط مسیرهای واقعاً جایگزین‌شده. |
| `BO-159` | داده‌و | rebuild همهٔ Read Modelها و مقایسهٔ digest/state پیش و پس از migration. |
| `BO-160` | تسترو | اجرای E2E پروژهٔ A و B با تنظیم مدل، بودجه، تیم، حافظه و سرور متفاوت. |
| `BO-161` | امینتو | اجرای آزمون adversarial cross-project، privilege escalation و prompt injection. |
| `BO-162` | تسترو | اجرای سناریوی crash/restart/resume و عدم تکرار side effect. |
| `BO-163` | عملیاتو | اجرای سناریوی انتقال Project Test از یک target تمیز به target تمیز دیگر. |
| `BO-164` | محصولو | ممیزی هر Requirement ID و تکمیل Traceability به PR/Test/Evidence. |
| `BO-165` | محصولو | تکمیل Help، glossary، runbook و راهنمای Owner/Admin/Viewer. |
| `BO-166` | راهبرو | آماده‌سازی اسناد canonical برای Projection در Notion و plan بدون write. |
| `BO-167` | تسترو | اجرای `pnpm check` و همهٔ test suiteها در محیط مرجع و ثبت نتیجهٔ واقعی. |
| `BO-168` | راهبرو | تشکیل Final Readiness Review شامل gap، risk، known limitation و rollback. |
| `BO-169` | مالک | پذیرش یا درخواست بازکاری نسخهٔ کامل Back Office. |
| `BO-170` | راهبرو | فقط پس از پذیرش، تهیهٔ Proposal پایلوت جداگانه؛ بدون شروع خودکار پایلوت. |

**Exit Gate نهایی:** همهٔ Requirementها `verified`، همهٔ Evidenceها معتبر، هیچ Blocker باز و پذیرش مالک ثبت شده باشد.

## ۱۹. نگاشت Requirementها به Work Package

| گروه Requirement | Work Package مسئول |
|---|---|
| `BO-GOV-*` | WP-00، WP-01، WP-07، WP-14 |
| `BO-PRJ-*` | WP-03، WP-05، WP-14 |
| `BO-IAM-*` | WP-02، WP-14 |
| `BO-CFG-*` | WP-04 |
| `BO-AI-*` و `BO-MEM-*` | WP-06، WP-09 |
| `BO-CMD-*` و `BO-WF-*` | WP-07 |
| `BO-INF-*`، `BO-SEC-*` و `BO-PRD-*` | WP-11، WP-12، WP-13 |
| `BO-HLT-*`، `BO-PERF-*` و `BO-COST-*` | WP-09 |
| `BO-NTF-*` | WP-10 |
| `BO-OUT-*` | WP-12 |
| `BO-DAT-*` | WP-03، WP-13 |
| `BO-UX-*` | WP-05، WP-13 |

هیچ Requirement نباید فقط با وجود یک صفحه یا یک unit test `verified` شود. Traceability باید حداقل Contract، Implementation، Test و Evidence را نشان دهد.

## ۲۰. قالب Evidence هر گام

هر Step تکمیل‌شده باید این رکورد را تولید کند:

```text
step_id
specification_id_and_version
plan_id_and_version
authorization_snapshot_id
requirement_ids
commit_or_artifact_identity
changed_components
tests_executed_and_real_results
security_and_isolation_result
known_gaps
rollback_or_recovery_path
completed_by
completed_at
```

وضعیت‌های مجاز هر Step: `proposed`، `authorized`، `in-progress`، `blocked`، `verification`، `completed`، `rework` یا `superseded`. درصد پیشرفت دستی منبع حقیقت نیست و باید از وضعیت Stepها و Evidence محاسبه شود.

## ۲۱. کنترل Scope و تغییرات آینده

هر درخواست جدید ابتدا یکی از این حالت‌ها را می‌گیرد:

- clarification بدون تغییر Scope؛
- correction برای رفع تناقض؛
- enhancement سازگار با نسخه؛
- semantic change نیازمند نسخهٔ جدید `HERO-SPEC-022`؛
- خارج از Scope و منتقل‌شده به Future Proposal.

افزودن Role انسانی جدید، Environment سفارشی، Git provider دیگر، کانال اعلان بیرونی، حسابداری Cloud/server، اپ موبایل Hero یا SaaS چندسازمانی تغییر Scope است و نباید پنهانی داخل یکی از گام‌های این برنامه قرار گیرد.

## ۲۲. وضعیت جاری و معیار گزارش

- Specification مرجع: `active`؛
- برنامهٔ توسعه: `active`؛
- WP-00 و WP-01: `verified`؛
- WP-02 تا WP-14: دارای پیاده‌سازی‌های داخلی، اما Exit Gateهای کامل آن‌ها هنوز بسته نشده‌اند؛
- مجوز پایلوت: `not-granted` و BO-170 تا پذیرش BO-169 متوقف است.

وضعیت جاری هر ۱۷۰ گام فقط از رجیستری `config/backoffice/delivery-audit-v1.0.json` و سند `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911` خوانده می‌شود. Evidenceهای Batch قدیمی وجود artifact و نتیجهٔ تست زمان خود را ثابت می‌کنند؛ آن‌ها به‌تنهایی اثبات نمی‌کنند که vertical slice نهایی، UI قابل‌استفاده یا عملیات runtime واقعی تکمیل شده است.

هر گزارش پیشرفت باید دو عدد را جدا نشان دهد:

1. `artifact coverage`: وجود کد/قرارداد/تست یا سند برای گام؛
2. `verified delivery`: بسته‌شدن همهٔ تعهدهای همان گام و Exit Gate بسته.

عبارت کلی «۱۷۰ گام انجام شد» بدون این تفکیک ممنوع است.
- مجوز Production: `not-granted`
- مجوز Notion write برای این دو سند: `not-granted`

گام مجاز بعدی پس از درخواست صریح مالک، `BO-001` تا `BO-010` به‌عنوان بستهٔ ممیزی و baseline است؛ دامنهٔ دقیق Authorization باید پیش از Dispatch ثبت شود.
