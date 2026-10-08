# Evidence محیط‌ها، سرورها و تحویل (سطح source) — BO-121 تا BO-146

> Document ID: `HERO-EVIDENCE-BACKOFFICE-ENVIRONMENTS-DELIVERY-SOURCE-BO-121-146`
> Canonical path: `docs/roadmap/BACKOFFICE-ENVIRONMENTS-DELIVERY-SOURCE-BO-121-146.md`
> Title: Evidence محیط‌ها، سرورها و تحویل (سطح source) — BO-121 تا BO-146
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: none
> Supersedes: none
> Superseded by: none

> یادداشت تفسیر: این سند فقط کار سطح source را ثبت می‌کند. هیچ اتصال زنده‌ای به GitHub، سرور، Node Agent، Secret Store، Provider، Production یا Notion انجام نشد؛ بنابراین `BO-121..BO-146` در وضعیت `gated` می‌مانند تا مالک اتصال زنده را جداگانه مجاز کند.

## دامنه و مجوز

Snapshot مجوز `BATCH-BACKOFFICE-20261008-028` گام‌های `BO-121..BO-146` را برای طراحی، توسعه، مستندسازی، تست و بازبینی مجاز کرد. Production، تغییر Secret، هزینهٔ بیرونی، Provider زنده، فراخوانی زندهٔ GitHub، اتصال زنده به سرور و نوشتن در Notion مجاز نبود و انجام نشد.

## یک نقص واقعی که پیدا و رفع شد

درخواست افشای Secret (`request-secret-reveal`) ادعای «MFA تازه» و «احراز مجدد» را از **بدنهٔ درخواست** می‌پذیرفت؛ یعنی کلاینت می‌توانست `mfaFresh: true` بفرستد و بررسی را دور بزند. اکنون سرور تازگی را فقط از نشست امضاشدهٔ کاربر (`assertSensitiveActionAllowed`) می‌خواند و پرچم‌های بدنه نادیده گرفته می‌شوند (آزمون: `tests/wp11-wp12-http.test.mjs`). همین سازوکار برای درخواست و تأیید break-glass هم اعمال شد.

## آنچه ساخته شد

| گام | کنترل | شاهد |
|---|---|---|
| BO-121 | دقیقاً سه محیط؛ محیط سفارشی رد می‌شود. | `tests/wp11-infrastructure-bo121-134.test.mjs` |
| BO-122 | آداپتر فقط‌خواندنی GitHub با پنج مسیر مجاز و کاهش پاسخ به فیلدهای ایمن (بدون توکن، ایمیل، یادداشت). بدون تابع `fetchJson` تزریق‌شده هیچ فراخوانی انجام نمی‌شود. | همان آزمون |
| BO-123 | پروتکل Node Agent: همیشه outbound؛ ثبت‌نام، heartbeat با توکن، اثر انگشت هویت و sequence صعودی؛ قابلیت‌ها فقط از فهرست مجاز. endpoint (`/api/node-agent/register` و `/heartbeat`) **پیش‌فرض خاموش** است (`HERO_NODE_AGENT_ENABLED=false`)، با حد نرخ جدا. | `tests/wp11-wp12-http.test.mjs` |
| BO-124 | مدل تهدید اجرایی (۱۰ تهدید، هرکدام با کنترل و آزمون) در contract؛ آزمون بررسی می‌کند هر تهدید به آزمونی که واقعاً در مجموعه هست اشاره کند. | `INFRASTRUCTURE_THREAT_MODEL` |
| BO-125 | ثبت سرور با نشانی ساده و ارجاع Secret؛ URL، رمز خام و ربودن شناسهٔ پروژهٔ دیگر رد می‌شود. | آزمون BO-125 |
| BO-126 | artifact bootstrap توسط خود Hero ساخته و با SHA-256 قفل می‌شود؛ digest دیگر رد می‌شود. هیچ چیزی اجرا نمی‌شود. | آزمون BO-126 |
| BO-127 | nonce یک‌بارمصرف با انقضای حداکثر ۲۴ ساعت؛ توکن نود فقط یک‌بار نشان داده می‌شود و فقط hash آن ذخیره می‌شود؛ چرخش توکن توکن قبلی را فوراً باطل می‌کند و کف sequence حفظ می‌شود. | آزمون BO-123/127 |
| BO-128 | desired/observed و reconcile که فقط پیشنهاد می‌دهد و اجرای خودکار را ممنوع می‌داند. | آزمون BO-128 |
| BO-129 | سیاست Runner به‌ازای پروژه و محیط، سقف همزمانی ۸، جداسازی `container-per-run`، یک اجرا در هر Node، lease با انقضا؛ ابطال Node، lease را آزاد می‌کند. | آزمون BO-129 |
| BO-130 | چرخهٔ ارجاع Secret (ثبت، جایگزینی، چرخش، ابطال پایانی)؛ مقدار هرگز ذخیره نمی‌شود. اتصال به Secret Store واقعی gated است. | آزمون BO-130/131 |
| BO-131 | افشا فقط برای Owner، با دلیل، با اثبات از نشست، محدودیت ۵ دقیقه، سقف ۳ در ساعت؛ مقدار برگردانده نمی‌شود. | همان |
| BO-132 | egress پیش‌فرض رد؛ ابزار و دامنهٔ دقیق (بدون wildcard و IP)؛ `checkEgress` برای هر درخواست. | آزمون BO-132 |
| BO-133 | صفحهٔ `surface=environments`: سرورها، Nodeها، Runnerها، ارجاع Secretها، egress، نسخه‌ها، Artifactها، Bundleها، شواهد، break-glass، تله‌متری و مدل تهدید؛ برای Viewer فقط‌خواندنی؛ فرم‌های Owner/Admin فقط متادیتا ثبت می‌کنند. | `tests/wp11-wp12-http.test.mjs`، ممیزی دسترس‌پذیری در پذیرش |
| BO-134 | تست impersonation، replay، offline، نشت credential، rotate و revoke. | `tests/wp11-infrastructure-bo121-134.test.mjs` |
| BO-135/136 | تله‌متری با schema دقیق برای هر نوع (health، metric، sanitized-log، trace-metadata)؛ کلید ناشناخته رد؛ متن لاگ قبل از ذخیره redact می‌شود (ایمیل، IP، توکن، شماره)؛ idempotent؛ سقف ۱۰۰۰ در ساعت. | `tests/wp12-delivery-bo135-146.test.mjs` |
| BO-137 | break-glass: Owner درخواست می‌دهد، **شخص دیگری** تصمیم می‌گیرد، حداکثر ۴ ساعت، قابل ابطال، نیازمند MFA تازه؛ Hero هرگز داده نمی‌دهد (`dataAccess: not-granted-by-hero`). | همان |
| BO-138 | یک guard واحد (`production-data-guard.mjs`) جلوی ورود payload Production به Memory، شواهد Evaluation و datasetها را می‌گیرد؛ تلاش تودرتو و با نام دیگر هم رد می‌شود. | همان |
| BO-139 | ماشین release: پرش از وضعیت ممنوع؛ `ready` نیازمند Artifact؛ `deployed` نیازمند evidence داخلی و فقط ثبت می‌شود (`record-only-separate-dispatch-required`)؛ rollback و blocked نیازمند دلیل. | همان |
| BO-140 | Artifact تغییرناپذیر: عوض کردن digest، تصاحب شناسه از پروژهٔ دیگر و ارجاع غیرداخلی رد می‌شود. | همان |
| BO-141/142 | ماتریس تحویل نسخه‌دار با Artifact ثبت‌شده؛ Bundle تغییرناپذیر با مانیفست و digest خودش؛ هرگز export نمی‌شود. | همان |
| BO-143 | قابلیت‌حمل با **مقایسهٔ digest** گزارش‌شدهٔ مقصد با digest مانیفست ارزیابی می‌شود؛ ادعای خالی «passed» شاهد نیست. | همان |
| BO-144 | تمرین بازیابی به ترتیب backup → restore → upgrade → rollback؛ شکست ثبت می‌شود و مرحلهٔ بعد را می‌بندد. | همان |
| BO-145 | پذیرش با هویت Artifact (digest مانیفست) و فهرست استثناها؛ هر تمرین باید پاس شده یا صراحتاً استثنا باشد؛ بازنویسی ممنوع. | همان |
| BO-146 | آزمون Artifact دستکاری‌شده، commit/identity اشتباه، rollback ناموفق، نشت داده و شکست قابلیت‌حمل. | همان |

## ماندگاری

هر دو دامنه به الگوی outbox → جدول append-only `backoffice_domain_records` → hydrate مستقل از ترتیب منتقل شدند (دامنه‌های `infrastructure` و `delivery`). پیش‌تر هر دو فقط در حافظه بودند و با restart از بین می‌رفتند. نام کلیدهای شبیه credential در رکورد ذخیره‌شده تغییر می‌کند (`accessRef`، `entryId`) و توکن فقط به‌صورت hash ذخیره می‌شود. heartbeat هر ۱۰مین پیام و هر تغییر وضعیت ذخیره می‌شود؛ بنابراین پس از restart کف sequence حداکثر تا ۹ پیام عقب‌تر است (پنجرهٔ replay کوتاه و مستند).

## اجرای محلی با PostgreSQL

تمرین seed → SIGKILL → verify با سرور واقعی و PostgreSQL تازه: همهٔ بررسی‌های `BO-021..BO-170` پاس شد، از جمله ماندگاری سرور، Node، سیاست Runner، lease فعال، egress، درخواست افشا، نسخه، Artifact، Bundle، پذیرش و تله‌متری پس از restart، و پذیرش توکن Node و رد replay پس از restart.

## محدودیت‌های شناخته‌شده

- هیچ GitHub، سرور، Node Agent یا Secret Store واقعی وصل نشد؛ شواهد adversarial روی سیستم واقعی انجام نشده است.
- قابلیت‌حمل فقط مقایسهٔ digest گزارش‌شدهٔ مقصد است؛ Hero خودش مقصد را نمی‌بیند. تا وجود Agent واقعی، گزارش مقصد باید از منبع مورد اعتماد بیاید.
- تله‌متری Production امروز با نشست انسانی ثبت می‌شود؛ ورود احراز‌شده با توکن سرویس مربوط به اتصال زنده است.
- حد egress روی Runner واقعی اجرا نمی‌شود؛ فقط سیاست و بررسی‌اش موجود است.
- برای فعال‌کردن endpoint Node Agent باید مالک `HERO_NODE_AGENT_ENABLED=true` را صراحتاً بگذارد؛ پیش‌فرض خاموش است.

## Rollback

تغییر پایگاه‌داده ندارد (فقط دو مقدار تازه در ستون متنی `domain`)؛ بازگشت به build قبلی ایمن است و رکوردهای جدید نادیده گرفته می‌شوند. endpoint Node Agent با خاموش‌کردن پرچم بسته می‌شود.
