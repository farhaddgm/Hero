# راه‌اندازی Notion برای Hero

- Document ID: `HERO-OPS-NOTION-SETUP`
- Version: `1.0.0`
- Status: `active`
- Scope: `cross-project`
- Owner: `hero-operations`

## وضعیت فعلی

Product Studio و Catalog محلی فعال‌اند. اتصال رسمی Notion در Test برقرار است و صفحهٔ ریشهٔ `Hero Product Development` قابل‌خواندن است. Blueprint شش‌بخشی و ۱۴ Database ساخته و verify شده‌اند؛ سه Database تکمیلی برای مدیریت اجرا شامل `Work Items`، `Tasks` و `Iterations` است. یک صفحهٔ `Hero Product System — Control Center` نیز برای دسترسی سریع به برنامه و اجرا ساخته شده است. اتصال PostgreSQL Test، migrationهای `001` تا `014` و mapping پایدار آماده‌اند؛ ۱۲۶ سند canonical در Database `Documents` projection می‌شوند و mapping نهایی آن‌ها `in-sync` و بدون `conflict` است. Database `Products` نیز دو محصول canonical و `Sync Health` آخرین وضعیت چرخه را نشان می‌دهند؛ Databaseهای Decisions، Evidence، Risks، Releases و Change Proposals تا زمان وجود رکورد canonical واقعی عمداً خالی می‌مانند. رودمپ canonical شامل ۵۰ آیتم، یک Objective، دو Initiative، ۵۰ Work Item، ۵۰ Task و یک Iteration backlog در Notion projection شده است. روابط traceability بین Objective→Initiative، Roadmap→Work Item و Roadmap/Work Item/Iteration→Task نیز در خود Notion برقرار و verify شده‌اند. همگام‌سازی خودکار داخلی فعال است و هر چرخه فقط محتوای مجاز `internal` را از Git به Notion به‌روزرسانی می‌کند؛ Notion همچنان منبع حقیقت نیست.

## کارهای لازم مالک، به زبان ساده

1. در Notion یک Workspace مقصد انتخاب کن؛ برای شروع یک Workspace خصوصی و داخلی کافی است.
2. یک Internal Integration بساز و فقط دسترسی‌های read content، insert content و update content را بده. public sharing و guest را فعال نکن.
3. یک صفحهٔ ریشه با نام `Hero Product Development` بساز و آن را فقط با همان Integration به اشتراک بگذار.
4. شناسهٔ صفحهٔ ریشه را از URL کپی کن. شناسه معمولاً یک UUID است و نباید در مستندات یا پیام عمومی منتشر شود.
5. Token و Page ID را فقط در Secret Store یا فایل runtime با مجوز محدود قرار بده؛ مقدار Token هرگز وارد Git، Notion، Event یا log نشود.
6. برای دیدن برنامهٔ محصول به بخش `10 — Hero Product` برو و Databaseهای `Objectives`، `Initiatives` و `Roadmap Items` را باز کن.
7. برای مدیریت اجرا به بخش `15 — Execution and Task Management` برو؛ `Work Items` خروجی‌های قابل‌تحویل و `Tasks` کارهای ریزتر هستند. `Iterations` فعلاً یک backlog رسمی دارد تا بعداً بازه‌های زمانی واقعی به آن اضافه شوند.
8. برای تغییرات آینده ابتدا snapshot و classification review جدید بگیر؛ سپس فقط batch مورد تأیید را اجرا کن. Change Proposal همچنان تنها مسیر ویرایش canonical از سمت Notion است.

## ترتیب فعال‌سازی فنی

### مرحلهٔ A — بدون ارسال خارجی

- اجرای Product Studio در مسیر `/product-studio`؛
- بررسی Catalog، checksum، completeness و roadmap؛
- اجرای fake adapter و contract tests؛
- بررسی اینکه همهٔ اسناد حساس در allow-list نیستند.

### مرحلهٔ B — اتصال خواندنی/آماده

- ثبت Secret در runtime؛
- ثبت parent page و mapping خالی؛
- health check بدون mirror محتوا؛
- تأیید owner برای اولین ارسال.

### مرحلهٔ C — mirror محدود Git → Notion — انجام‌شده در Test

- فقط اسناد allow-listed و classification `internal`؛
- هر Page دارای Document ID، version، source commit و checksum؛
- queue، backoff، idempotency و dead-letter؛
- قابلیت disable فوری connector.

وضعیت اجرای Test: ۱۲۶ سند واجد شرایط، ۱۳ batch اولیه به‌علاوهٔ دو عملیات محدود تکمیلی، ۱۲۶ mapping در وضعیت `in-sync`، صفر `conflict` و gate عمومی bulk بسته. Pageهای legacy قبلی حذف یا archive نمی‌شوند؛ mapping جدید به Pageهای Database `Documents` منتقل می‌شود تا دادهٔ ساختاریافته و قابل‌فیلتر باشد. سرویس `notion-auto-sync` با فاصلهٔ پیش‌فرض ۵ دقیقه‌ای، فقط projection داخلی Git را refresh می‌کند.

### مرحلهٔ D — ویرایش کنترل‌شده Notion

- ویرایش در Notion به Change Proposal تبدیل می‌شود؛
- سندهای `mirror-only`، Evidence، Authorization و Release approval قابل بازنویسی نیستند؛
- Proposal باید diff، base checksum، reviewer و Pull Request داشته باشد؛
- فقط merge در Git نسخهٔ canonical را تغییر می‌دهد.

## قراردادهای ایمنی

- Notion منبع حقیقت نیست.
- Git و قراردادهای versioned منبع حقیقت رودمپ، تسک و اسناد هستند؛ Notion projection قابل‌مشاهده و محیط ویرایش کنترل‌شده است.
- همگام‌سازی خودکار به معنی overwrite کردن ویرایش دستی نیست: اگر checksum نشان دهد صفحه در Notion جداگانه تغییر کرده، وضعیت `conflict` ثبت می‌شود و Git بر آن غلبه نمی‌کند.
- قطع Notion نباید build، test، development یا بازیابی Git را متوقف کند.
- عملیات external write، webhook عمومی، Secret، هزینه و Production مجوز جداگانه دارند.
- قبل از هر mirror باید ACL Notion با classification و دسترسی repository تطبیق داده شود.
- تست اولیه نباید شامل credential، دادهٔ شخصی، دادهٔ مشتری یا سند Production حساس باشد.

## منابع فنی

Adapter از Markdown API، Data Source API و Views API نسخهٔ `2026-03-11` استفاده می‌کند: ایجاد Page با Markdown، دریافت Markdown، update محدود یا replace کنترل‌شده، query/upsert رکوردهای Database و ساخت/به‌روزرسانی Viewهای managed. Viewهای `Board`، `Calendar`، `Timeline`، `Chart`، `Gallery` و Dashboardهای چندمنبعی با `pnpm notion:setup:views` ساخته می‌شوند. Viewهایی که با نام دیگری قبلاً ساخته شده‌اند حذف یا overwrite نمی‌شوند؛ فقط Viewهای دارای پیشوند `Hero —` توسط plan نسخه‌دار مدیریت می‌شوند.
