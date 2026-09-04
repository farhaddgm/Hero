# بک‌آفیس توسعهٔ Hero

- نسخهٔ projection: 1.1
- وضعیت: نمای کاملاً فقط‌خواندنی برای مشاهده، ممیزی و فهم ساختار Hero
- مسیر مشاهده: `/backoffice`

## هدف

بک‌آفیس ابزار فهم و پایش توسعه است، نه جایگزین Control Plane و نه محل اجرای مستقیم Provider. این صفحه باید به مالک کمک کند بفهمد سازمان در چه مرحله‌ای است، هر Team چه وضعیتی دارد، Roleهای AI چگونه به سیستم وصل‌اند و گیت بعدی چیست.

## دامنهٔ نسخهٔ اول

- جزئیات کامل قرارداد ۱۱ Team شامل مسئولیت، اختیار تصمیم، ورودی، خروجی، اصول، همکاران، مراحل و سطح خودکارسازی؛
- جزئیات عملیاتی هر Team شامل تأییدها، آموزش و آخرین ارزیابی، تخصیص‌ها، بازبینی قرارداد/Deliverable، بازکاری، پژوهش‌ها، provenance دانش و تاریخچهٔ نسخه‌ها؛
- تنظیمات امن کل پروژه شامل هویت سرویس، runtime، persistence/hydration، امنیت، حاکمیت، مسیرهای خواندنی و کاتالوگ همهٔ قراردادهای Hero؛
- شش Role اصلی `Analyst`، `Evaluator`، `Decision Maker`، `Planner`، `Researcher` و `Executor`، به‌علاوهٔ `Verifier` و `Code Reviewer` برای کنترل کیفیت؛
- شمارندهٔ Provider، Profile، Invocation، Evaluation و Decision؛
- وضعیت Global Stop، اختیار کامل و hydration؛
- وضعیت گام‌های Multi-AI، Provider واقعی، Recovery و Pilot؛
- راهنمای دسترسی same-host و diagnostic قابل فهم هنگام قطع اتصال؛
- Basic Auth اختیاریِ fail-closed برای زمانی که Back Office پشت HTTPS/زیردامنه قرار می‌گیرد؛
- سیاست ضدایندکس روی همهٔ پاسخ‌ها (`X-Robots-Tag`، meta robots و `robots.txt`) و نبود sitemap عمومی؛ این کنترل‌ها مرز امنیتی نیستند؛
- Timeline امن eventهای اخیر، بدون prompt، متن درخواست، خروجی مدل یا Secret؛
- خلاصهٔ metadata ارزیابی سازمان و مرز تصمیم آن؛
- نمایش Policy پیش‌فرض هر Role شامل Provider، Model، Tool Policy و نسخه؛
- نمایش Skillهای ثبت‌شده و bindingهای scoped بدون افشای دادهٔ حساس؛
- نمایش آخرین Organization Advisor شامل state، recommendation و مرز advisory-only؛
- خلاصهٔ activityهای Invocation، Evaluation و Decision و وضعیت benchmark synthetic؛
- قرارداد correlation سازگار با trace/span برای آماده‌سازی مشاهده‌پذیری آینده؛
- مسیر بعدی و واژه‌نامهٔ کامل نقش‌ها و مفهوم‌های اصلی پنل؛
- تاریخچهٔ نسخه‌های Team و Default Role Policy در همان پنل فقط برای مشاهده نمایش داده می‌شود؛ هیچ rollback، تأیید یا ویرایشی از UI صادر نمی‌شود.
- کاتالوگ Provider/Model/Profile/Role Binding و Policy در همان پنل به‌صورت read-only دیده می‌شود؛ credential فقط با وضعیت امن و بدون مقدار واقعی بازتاب می‌یابد.

Projection بک‌آفیس فقط فیلدهای مشاهده‌ای و بدون متن درخواست، مقدار Credential، Secret، Token، prompt، output خام، feedback خصوصی یا مسیر میزبان را برمی‌گرداند. خود رابط فقط `GET` می‌فرستد و هیچ فرم یا کنترل mutation ندارد. APIهای `/api/*` و فرمان‌های Owner/Admin خارج از این UI باقی می‌مانند و با احراز هویت و scope مستقل کنترل می‌شوند؛ تأیید نهایی Team، پروژه، release، revocation و عملیات حساس همچنان owner-only هستند. تاریخچهٔ Benchmark synthetic در صورت اتصال PostgreSQL پس از restart hydrate می‌شود و مقایسهٔ آن advisory-only است.

Diagnostic read model در `/api/operations/diagnostics` پوشش ۱۱ Projection، صحت Snapshot/Event، replay dry-run، digest، freshness دانش و تعارض تخصیص را فقط‌خواندنی گزارش می‌کند.

## چیزهایی که فعلاً عمداً ندارد

- اجرای Provider، مصرف اعتبار، Deploy یا تغییر Secret؛
- اجرای Outbox یا dispatch پیام خارجی؛
- ویرایش مستقیم Roadmap یا Authorization؛
- جایگزینی Google Sheets به‌عنوان مرجع رسمی تصمیم؛
- داشبورد تحلیلی سنگین، نمودارهای ساختگی یا KPI بدون منبع.

## قابلیت‌های افزوده‌شده در بستهٔ فعلی

- metadata دسترسی same-host و پیام diagnostic برای خطای اتصال؛
- جست‌وجو و فیلتر محلی Team بر اساس نام/مسئولیت و آمادگی؛
- کارت‌های responsive برای مرور قرارداد کامل هر Team و وضعیت آمادگی آن؛
- نمایش read-only تأییدهای Team، عملیات، تاریخچهٔ نسخه و provenance دانش؛
- حذف کامل کنترل‌های mutation از UI؛ تغییرات مدیریتی فقط از APIهای محافظت‌شدهٔ خارج از Back Office؛
- timeline امن با cursor `after` و `limit`؛
- benchmark synthetic از مسیر owner-authenticated با خروجی advisory؛
- کاتالوگ read-only Provider/Model/Profile/Binding/Policy با نمایش جزئیات امن؛
- ثبت Skill و Skill Binding و تغییر Role Policy از API owner-authenticated؛
- ساخت Organization Advisor از آخرین Performance Review کاملِ ۱۱ تیم؛
- ثبت audit برای نتیجهٔ `accepted` یا `rejected` فرمان.
- ذخیره، بازیابی، idempotency و مقایسهٔ Benchmark synthetic در PostgreSQL؛
- نمایش تاریخچهٔ امن Benchmark در پنل، بدون prompt، output، credential یا token.
- audit دسترسی به read model با actor، مسیر، outcome و زمان؛ query string، payload و token ذخیره نمی‌شود.

## مسیر رشد

1. افزودن لینک دقیق به Evidence و Sheetهای مرجع؛
2. افزودن audit دسترسی و policy مشاهده‌ای در محیط Production؛
3. تکمیل نمایش UI برای diff/rollback قراردادها و نمایش کامل Diagnostic؛ بخش diff/rollback محلی تکمیل شده و Diagnostic API آماده است؛
4. تکمیل کنترل‌های تغییردهندهٔ بیشتر فقط پس از worker، Session Revocation و Audit عملیاتی.

## مسیرهای این نسخه

- `/backoffice` صفحهٔ HTML مشاهده‌ای را ارائه می‌کند؛
- `/backoffice-data` projection JSON امن و read-only را ارائه می‌کند؛
- `/backoffice-events?after=0&limit=24` timeline امن و page-based را ارائه می‌کند؛
- `GET /api/ai/benchmarks` تاریخچهٔ Benchmark synthetic را با منبع `in-memory` یا `postgresql` می‌دهد؛
- `GET /api/ai/benchmarks/compare?ids=...&limit=...` مقایسهٔ advisory-only و قابل‌ممیزی را می‌دهد؛
- `GET /api/audit?after=0&limit=50` timeline فرمان‌های ثبت‌شده را برمی‌گرداند؛ `GET /api/audit/read-access?after=0&limit=50` audit دسترسی read model را فقط برای owner برمی‌گرداند؛
- `GET /api/operations/diagnostics` گزارش owner/admin-authenticated و فقط‌خواندنی سلامت Projectionها، replay، digest، AI catalog، freshness و تعارض تخصیص را برمی‌گرداند؛
- `/admin-auth-contract` قرارداد احراز هویت و دامنهٔ محدود Admin را ارائه می‌کند؛ ویرایش/rollback اصول تیم نیز به‌صورت صریح در همین دامنه ثبت شده است؛
- `GET /api/teams/:teamId/contract-history` diff امن نسخه‌های قرارداد تیم را می‌دهد؛ مسیر rollback در API باقی است اما Back Office آن را مصرف نمی‌کند؛
- `GET /api/ai/role-policies/:role/history` تاریخچهٔ Policy را می‌دهد؛ rollback در API باقی است اما از UI صادر نمی‌شود؛
- `/admin-auth-contract` مرز احراز هویت و اختیارهای محدود admin را اعلام می‌کند؛
- `/observability-contract` قرارداد correlation و redaction را ارائه می‌کند؛
- `/pilot-contract` state و acceptance checkهای پایلوت را ارائه می‌کند؛
- `POST /api/auth/revoke-session` session مالک را با مرز owner-authenticated قابل‌ابطال می‌کند؛
- `POST /api/teams/:teamId/principles` اصول تیم را با `expectedVersion` و event نسخه‌دار ویرایش می‌کند؛ این مسیر مدیریتی خارج از Back Office read-only است؛
- `GET /api/ai/skills` و `GET /api/ai/organization-advisor` projectionهای امن Skill و Advisor را می‌دهند؛
- `POST /api/ai/skills`، `POST /api/ai/skill-bindings` و `POST /api/ai/role-policies` تغییرات owner-authenticated و نسخه‌دار را ثبت می‌کنند؛
- `POST /api/ai/organization-advisor` از Performance Review ثبت‌شده خروجی advisory و roadmap می‌سازد؛
- `/skill-contract` و `/organization-advisor-contract` قراردادهای اجرایی این دو لایه را ارائه می‌کنند؛
- `POST /api/pilots/dry-run` فقط pilot deterministic و بدون شبکه را اجرا می‌کند؛
- endpointهای `/api/*` فعلی همچنان مسیرهای mutation هستند و owner authentication می‌خواهند.

دادهٔ بک‌آفیس برای توسعهٔ local/test است. قبل از Production باید Secretهای Basic/Auth در Secret Store، TLS/reverse proxy، policy مشاهده‌ای، audit دسترسی، session revocation پایدار، worker Outbox و policy نگهداری داده تکمیل و جداگانه تأیید شوند. اجرای worker فقط با فراخوانی صریح و handler تزریق‌شده ممکن است.

## سیاست پیدا نشدن در جست‌وجو

سرویس برای کشف عمومی طراحی نشده است: binding پیش‌فرض Compose روی `127.0.0.1` است، مسیر ناشناخته و sitemap با `404` رد می‌شوند، `robots.txt` کل سایت را ممنوع می‌کند و تمام پاسخ‌ها—including خطای احراز هویت—هدر `X-Robots-Tag` با `noindex` و `nofollow` دارند. هر دو صفحهٔ HTML نیز meta robots برای crawlerهای عمومی و Googlebot دارند.

این سیاست باعث می‌شود موتورهای جست‌وجوی متعارف سرویس را در نتایج خود ثبت نکنند، اما هیچ هدر یا `robots.txt` تضمین ریاضی برای مخفی‌ماندن یک URL عمومی نیست. اگر سرویس روی اینترنت منتشر شد، برای شرط «فقط کسی که آدرس را دارد» باید همچنان HTTPS، احراز هویت و firewall یا IP allow-list در reverse proxy فعال باشد؛ آدرس عمومی نیز نباید در لینک، sitemap، DNS عمومی غیرضروری یا پیام بیرونی منتشر شود.
