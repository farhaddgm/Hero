# راه‌اندازی Notion برای Hero

- Document ID: `HERO-OPS-NOTION-SETUP`
- Version: `1.0.0`
- Status: `active`
- Scope: `cross-project`
- Owner: `hero-operations`

## وضعیت فعلی

Product Studio و Catalog محلی فعال‌اند و بدون Notion کار می‌کنند. Adapter رسمی Notion در کد آماده است، اما اتصال بیرونی عمداً تا زمان تعیین Workspace، مجوزها و Secret فعال نشده است. هیچ محتوایی از مخزن هنوز به Notion ارسال نشده است.

## کارهای لازم مالک، به زبان ساده

1. در Notion یک Workspace مقصد انتخاب کن؛ برای شروع یک Workspace خصوصی و داخلی کافی است.
2. یک Internal Integration بساز و فقط دسترسی‌های read content، insert content و update content را بده. public sharing و guest را فعال نکن.
3. یک صفحهٔ ریشه با نام `Hero Product Development` بساز و آن را فقط با همان Integration به اشتراک بگذار.
4. شناسهٔ صفحهٔ ریشه را از URL کپی کن. شناسه معمولاً یک UUID است و نباید در مستندات یا پیام عمومی منتشر شود.
5. Token و Page ID را فقط در Secret Store یا فایل runtime با مجوز محدود قرار بده؛ مقدار Token هرگز وارد Git، Notion، Event یا log نشود.
6. مقدار `HERO_NOTION_ENABLED` را تا پایان تست `false` نگه دار. فعال‌سازی ارسال، یک مجوز جداگانه برای انتشار محتوای انتخاب‌شده به سرویس بیرونی است.
7. پس از آماده‌بودن موارد بالا، Hero ابتدا با dry-run و یک سند غیرحساس آزمایش می‌شود؛ بعد sync یک‌طرفه Git → Notion و در مرحلهٔ بعد Change Proposal برای ویرایش Notion فعال می‌شود.

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

### مرحلهٔ C — mirror محدود Git → Notion

- فقط اسناد allow-listed و classification `internal`؛
- هر Page دارای Document ID، version، source commit و checksum؛
- queue، backoff، idempotency و dead-letter؛
- قابلیت disable فوری connector.

### مرحلهٔ D — ویرایش کنترل‌شده Notion

- ویرایش در Notion به Change Proposal تبدیل می‌شود؛
- سندهای `mirror-only`، Evidence، Authorization و Release approval قابل بازنویسی نیستند؛
- Proposal باید diff، base checksum، reviewer و Pull Request داشته باشد؛
- فقط merge در Git نسخهٔ canonical را تغییر می‌دهد.

## قراردادهای ایمنی

- Notion منبع حقیقت نیست.
- قطع Notion نباید build، test، development یا بازیابی Git را متوقف کند.
- عملیات external write، webhook عمومی، Secret، هزینه و Production مجوز جداگانه دارند.
- قبل از هر mirror باید ACL Notion با classification و دسترسی repository تطبیق داده شود.
- تست اولیه نباید شامل credential، دادهٔ شخصی، دادهٔ مشتری یا سند Production حساس باشد.

## منابع فنی

Adapter از Markdown API نسخهٔ `2026-03-11` استفاده می‌کند: ایجاد Page با Markdown، دریافت Markdown و update محدود یا replace کنترل‌شده. پیش از فعال‌سازی production باید capabilityهای Integration و محدودیت‌های API در Test تأیید شوند.
