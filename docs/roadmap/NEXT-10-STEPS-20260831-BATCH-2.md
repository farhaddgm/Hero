# بستهٔ ۱۰ گام بعدی Hero — Batch 2

مبنا: `2026-08-31`
دامنه: دسترسی و operational readiness در local/test، بدون فعال‌سازی Provider واقعی
وضعیت: پیاده‌سازی و verification کامل‌شده در `2026-08-31`

## تصمیم اجرایی

بعد از بستهٔ اول، ریسک اصلی دیگر کمبود Role یا Provider Adapter نیست؛ مشکل اصلی این است که مالک بتواند وضعیت را درست ببیند، eventها را دنبال کند، خطاها را بفهمد و مسیر Pilot را بدون ایجاد external side effect تمرین کند. بنابراین این بسته به‌جای افزودن پنل مدیریتی تغییردهنده، read model و کنترل‌های قابل‌آزمایش را کامل می‌کند.

## تحقیق و بنچ‌مارک

| الگوی مرجع | نتیجهٔ بررسی | تصمیم Hero |
| --- | --- | --- |
| [OpenTelemetry Context Propagation](https://opentelemetry.io/docs/concepts/context-propagation/) | correlation باید بین مرزهای سرویس و child operation حفظ شود | event projection دارای cursor و correlation باقی ماند؛ telemetry بیرونی اجباری نشد |
| [PostgreSQL SELECT و row locking](https://www.postgresql.org/docs/current/sql-select.html) | خواندن صفحه‌ای و claim باید cursor/lock روشن داشته باشد | timeline با `after`/`limit` و Outbox worker با claim/ack/fail جدا شد |
| [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) | Govern و Measure باید از اجرای واقعی و اختیار تصمیم جدا باشند | benchmark و Pilot فقط evidence/advisory هستند و authority آن‌ها false است |

## ۱۰ گام اجراشده

| گام | خروجی | معیار پذیرش | وضعیت |
| --- | --- | --- | --- |
| ۱ | تشخیص مشکل لینک Back Office | سرویس از میزبان `200` بدهد و محدودیت loopback روشن باشد | انجام‌شده |
| ۲ | access metadata | projection مسیر، data path و same-host requirement را اعلام کند | انجام‌شده |
| ۳ | تجربهٔ خطای اتصال | UI به‌جای خطای مبهم، علت محتمل و اقدام بعدی را نشان دهد | انجام‌شده |
| ۴ | فیلتر Team | جست‌وجو و فیلتر آمادگی بدون mutation کار کند | انجام‌شده |
| ۵ | Timeline cursor | endpoint امن با `after`/`limit` و `hasMore` درست ارائه شود | انجام‌شده |
| ۶ | rejected command audit | شکست فرمان با metadata حداقلی ثبت شود، نه input خام | انجام‌شده |
| ۷ | Outbox worker primitive | handler تزریق‌شده بتواند publish/retry/fail را bounded اجرا کند | انجام‌شده |
| ۸ | Pilot contract | state و acceptance checkها نسخه‌دار و public باشند | انجام‌شده |
| ۹ | Synthetic benchmark surface | benchmark مالک‌گیت‌شده اجرا و در Back Office نمایش داده شود | انجام‌شده |
| ۱۰ | verification و handoff | Build، Governance، تست و runtime smoke موفق باشند | انجام‌شده؛ `pnpm check` و `۲۰۱/۲۰۱` تست |

## مرزهای ایمنی

- bind پیش‌فرض همچنان `127.0.0.1` است؛ `0.0.0.0`، firewall و reverse proxy بدون مجوز تغییر نکرده‌اند.
- benchmark synthetic هیچ Provider، Secret، external spend، mutation یا release را authorize نمی‌کند.
- Outbox worker هنگام start خودکار اجرا نمی‌شود؛ handler و فراخوانی `drain()` باید صریح تزریق شوند.
- Back Office read-only است و دادهٔ آن متن درخواست، prompt، output، credential و Secret ندارد.
- audit ردشده فقط command، project و outcome را نگه می‌دارد؛ اگر audit unavailable باشد، خطای اصلی فرمان حفظ می‌شود.

## شواهد نهایی

- `pnpm check` در Linux verify image: Doctor موفق با یک هشدار مورد انتظارِ نبود Docker تو‌در‌تو، Governance موفق، Build با ۱۱۶ ماژول و `۲۰۲/۲۰۲` تست موفق؛
- Compose runtime: سرویس `hero-control-plane` و PostgreSQL healthy؛
- smoke-test واقعی: `/health`، `/ready`، `/backoffice`، `/backoffice-data`، `/backoffice-events?after=0&limit=2` و `/pilot-contract` همگی HTTP 200؛ projection شامل ۱۱ Team و Pilot contract نسخهٔ ۱.۰؛
- `git diff --check`: موفق.
- لایهٔ Basic Auth: بدون credential پاسخ `401`، با credential معتبر پاسخ `200`؛ `robots.txt` و `X-Robots-Tag` نیز بررسی شدند.

## گام‌های بعد از این بسته

۱. persistence benchmarkها و مقایسهٔ نسخه‌ها در PostgreSQL؛ ۲. audit دسترسی به read model؛ ۳. یک مقصد Linux پاک برای recovery؛ ۴. انتخاب Provider/Model و سقف هزینه؛ ۵. Pilot واقعی فقط پس از مجوزهای مستقل.
