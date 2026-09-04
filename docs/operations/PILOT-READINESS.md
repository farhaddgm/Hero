# آمادگی اجرای HERO-021

این سند وضعیت واقعی پیش‌نیازهای پایلوت انتهابه‌انتها را ثبت می‌کند. نبود هر شرط یعنی پایلوت `blocked` است؛ هیچ mock یا فرضی جای شواهد واقعی را نمی‌گیرد.

| شرط | وضعیت فعلی | شاهد/اقدام لازم |
| --- | --- | --- |
| قرارداد و Task Graph نسخه‌دار | آماده | Planner، training benchmark و تست‌های قراردادی موجودند |
| محیط Linux پاک و Compose مستقل | آمادهٔ test / انتقال مسدود | imageهای verify/runtime با Linux container ساخته و بررسی شده‌اند؛ اجرای مقصد واقعی هنوز مجوز و محیط مقصد می‌خواهد |
| PostgreSQL migration و command audit | آمادهٔ test | migrationهای `001` تا `005` و `check:postgres` موفق‌اند |
| Snapshot و hydration رجیستری‌های اصلی | آمادهٔ test | Snapshot Store نسخه‌دار برای ۱۰ Registry دامنه و Dashboard فعال است؛ دیتابیس فعلی هنوز Snapshot ثبت‌شده ندارد |
| projection پایدار همهٔ domain commandها | مسدود | projection کامل همهٔ commandها از in-memory به PostgreSQL منتقل نشده است |
| session revocation پایدار مالک | آمادهٔ test | revocation در authenticate fail-closed است و migration/store PostgreSQL برای بازسازی بعد از restart اضافه شده؛ اجرای مقصد عملیاتی هنوز جداست |
| Provider واقعی | مسدود | Adapterهای OpenAI/Anthropic/Google/Compatible آماده‌اند؛ credential، cost policy و verifier مجوز فعال عمداً متصل/اجرا نشده‌اند |
| اجرای Task واقعی در Worktree | مسدود | نیازمند HERO-020 و مجوز/دسترسی Provider مستقل است |
| درخواست، پلتفرم و معیار پذیرش پایلوت | مسدود | باید برای محصول کوچک مشخص و نسخه‌دار شود؛ بدون mock جایگزین اجرای واقعی نمی‌شود |
| production، deploy، spend و secret change | مسدود تا مجوز جدا | این عملیات هرگز از مجوز توسعه استنتاج نمی‌شوند |

## شواهد عملیاتی ثبت‌شده در ۲۰۲۶-۰۸-۳۰

- `docker build --target verify`: موفق؛ build، Doctor و تست‌های کامل داخل Linux container اجرا شدند.
- Backup/Restore ایزولهٔ PostgreSQL با artifact موقت `hero-recovery-check`: موفق؛ checksum و sentinel پس از restore تطبیق داشتند.
- آخرین backup/restore disposable در ۲۰۲۶-۰۹-۰۵ با artifact `hero-recovery-check-20260905` و checksum `sha256:1ce262c482e6096d7c315d62c3483ba012a9f1e813e57f2d0fcfe5c29ccffb04` نیز موفق شد؛ منابع موقت خودکار حذف شدند.
- این شواهد، آزمون portability را تقویت می‌کنند اما جایگزین restore روی مقصد پاکِ مصوب، volume عملیاتی `hero-data` و مجوز انتقال نیستند.

## فرمان بررسی

```text
pnpm check:pilot
```

این فرمان فقط وضعیت گیت‌ها را گزارش می‌کند و هیچ Provider، deploy، پیام بیرونی یا عملیات زیرساختی اجرا نمی‌کند. تا زمانی که شروط مسدود رفع نشده‌اند، خروجی صحیح آن `blocked` است.

## تعریف عبور

HERO-021 فقط پس از ثبت Artifact، test evidence، review، handoff، گزارش محدودیت‌ها و مسیر rollback/recovery قابل قبول است. نتیجهٔ `ready` به‌تنهایی به معنی اجرای production نیست.
