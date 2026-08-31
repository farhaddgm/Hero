# بک‌آفیس توسعهٔ Hero

- نسخهٔ قرارداد: 1.0
- وضعیت: نسخهٔ اول read-only پیاده‌سازی شده
- مسیر مشاهده: `/backoffice`

## هدف

بک‌آفیس ابزار فهم و پایش توسعه است، نه جایگزین Control Plane و نه محل اجرای مستقیم Provider. این صفحه باید به مالک کمک کند بفهمد سازمان در چه مرحله‌ای است، هر Team چه وضعیتی دارد، Roleهای AI چگونه به سیستم وصل‌اند و گیت بعدی چیست.

## دامنهٔ نسخهٔ اول

- خلاصهٔ ۱۱ Team و وضعیت قرارداد/آموزش؛
- شش Role اصلی `Analyst`، `Evaluator`، `Decision Maker`، `Planner`، `Researcher` و `Executor`، به‌علاوهٔ `Verifier` و `Code Reviewer` برای کنترل کیفیت؛
- شمارندهٔ Provider، Profile، Invocation، Evaluation و Decision؛
- وضعیت Global Stop، اختیار کامل و hydration؛
- وضعیت گام‌های Multi-AI، Provider واقعی، Recovery و Pilot؛
- راهنمای دسترسی same-host و diagnostic قابل فهم هنگام قطع اتصال؛
- Basic Auth اختیاریِ fail-closed برای زمانی که Back Office پشت HTTPS/زیردامنه قرار می‌گیرد؛
- سیاست ضدایندکس روی همهٔ پاسخ‌ها (`X-Robots-Tag`، meta robots و `robots.txt`) و نبود sitemap عمومی؛ این کنترل‌ها مرز امنیتی نیستند؛
- Timeline امن eventهای اخیر، بدون prompt، متن درخواست، خروجی مدل یا Secret؛
- خلاصهٔ metadata ارزیابی سازمان و مرز تصمیم آن؛
- خلاصهٔ activityهای Invocation، Evaluation و Decision و وضعیت benchmark synthetic؛
- قرارداد correlation سازگار با trace/span برای آماده‌سازی مشاهده‌پذیری آینده؛
- مسیر بعدی و واژه‌نامهٔ کوتاه برای تسلط مالک.

Projection بک‌آفیس فقط فیلدهای مشاهده‌ای و بدون متن درخواست، Credential، Secret، Token یا مسیر میزبان را برمی‌گرداند. عملیات تغییردهنده و APIهای `/api/*` همچنان owner-authenticated هستند.

## چیزهایی که فعلاً عمداً ندارد

- اجرای Provider، مصرف اعتبار، Deploy یا تغییر Secret؛
- اجرای Outbox یا dispatch پیام خارجی؛
- ویرایش مستقیم Roadmap یا Authorization؛
- جایگزینی Google Sheets به‌عنوان مرجع رسمی تصمیم؛
- داشبورد تحلیلی سنگین، نمودارهای ساختگی یا KPI بدون منبع.

## قابلیت‌های افزوده‌شده در بستهٔ فعلی

- metadata دسترسی same-host و پیام diagnostic برای خطای اتصال؛
- جست‌وجو و فیلتر محلی Team بر اساس نام/مسئولیت و آمادگی؛
- timeline امن با cursor `after` و `limit`؛
- benchmark synthetic از مسیر owner-authenticated با خروجی advisory؛
- ثبت audit برای نتیجهٔ `accepted` یا `rejected` فرمان.

## مسیر رشد

1. افزودن لینک دقیق به Evidence و Sheetهای مرجع؛
2. افزودن persistence و مقایسهٔ benchmarkها در PostgreSQL؛
3. افزودن audit دسترسی و policy مشاهده‌ای در محیط Production؛
4. افزودن کنترل‌های تغییردهنده فقط پس از تکمیل worker، Session Revocation و Audit عملیاتی.

## مسیرهای این نسخه

- `/backoffice` صفحهٔ HTML مشاهده‌ای را ارائه می‌کند؛
- `/backoffice-data` projection JSON امن و read-only را ارائه می‌کند؛
- `/backoffice-events?after=0&limit=24` timeline امن و page-based را ارائه می‌کند؛
- `/observability-contract` قرارداد correlation و redaction را ارائه می‌کند؛
- `/pilot-contract` state و acceptance checkهای پایلوت را ارائه می‌کند؛
- `POST /api/auth/revoke-session` session مالک را با مرز owner-authenticated قابل‌ابطال می‌کند؛
- `POST /api/pilots/dry-run` فقط pilot deterministic و بدون شبکه را اجرا می‌کند؛
- endpointهای `/api/*` فعلی همچنان مسیرهای mutation هستند و owner authentication می‌خواهند.

دادهٔ بک‌آفیس برای توسعهٔ local/test است. قبل از Production باید Secretهای Basic Auth در Secret Store، TLS/reverse proxy، احراز هویت مشاهده‌ای، audit دسترسی، session revocation پایدار، worker Outbox و policy نگهداری داده تکمیل شوند. اجرای worker فقط با فراخوانی صریح و handler تزریق‌شده ممکن است.

## سیاست پیدا نشدن در جست‌وجو

سرویس برای کشف عمومی طراحی نشده است: binding پیش‌فرض Compose روی `127.0.0.1` است، مسیر ناشناخته و sitemap با `404` رد می‌شوند، `robots.txt` کل سایت را ممنوع می‌کند و تمام پاسخ‌ها—including خطای احراز هویت—هدر `X-Robots-Tag` با `noindex` و `nofollow` دارند. هر دو صفحهٔ HTML نیز meta robots برای crawlerهای عمومی و Googlebot دارند.

این سیاست باعث می‌شود موتورهای جست‌وجوی متعارف سرویس را در نتایج خود ثبت نکنند، اما هیچ هدر یا `robots.txt` تضمین ریاضی برای مخفی‌ماندن یک URL عمومی نیست. اگر سرویس روی اینترنت منتشر شد، برای شرط «فقط کسی که آدرس را دارد» باید همچنان HTTPS، احراز هویت و firewall یا IP allow-list در reverse proxy فعال باشد؛ آدرس عمومی نیز نباید در لینک، sitemap، DNS عمومی غیرضروری یا پیام بیرونی منتشر شود.
