# آمادگی اجرای HERO-021

این سند وضعیت واقعی پیش‌نیازهای پایلوت انتهابه‌انتها را ثبت می‌کند. نبود هر شرط یعنی پایلوت `blocked` است؛ هیچ mock یا فرضی جای شواهد واقعی را نمی‌گیرد.

| شرط | وضعیت فعلی | شاهد/اقدام لازم |
| --- | --- | --- |
| قرارداد و Task Graph نسخه‌دار | آماده | Planner، training benchmark و تست‌های قراردادی موجودند |
| محیط Linux پاک و Compose مستقل | آمادهٔ test / انتقال مسدود | imageهای verify/runtime با Linux container ساخته و بررسی شده‌اند؛ اجرای مقصد واقعی هنوز مجوز و محیط مقصد می‌خواهد |
| PostgreSQL migration و command audit | آمادهٔ Test | migrationهای `001` تا `006`، readiness، `pg_isready` و command audit در Test تأیید شده‌اند |
| Snapshot و hydration رجیستری‌های اصلی | تأیید Test | ۱۱ Projection، snapshot/hydration و حفظ Read Model بعد از restart در `hero-test` تأیید شده‌اند |
| projection پایدار همهٔ domain commandها | آمادهٔ Test / انتقال عملیاتی جدا | projection و replay محلی/ Test قابل بررسی است؛ انتقال به مقصد عملیاتی و backup recovery هنوز گیت مستقل دارد |
| session revocation پایدار مالک | آمادهٔ test | revocation در authenticate fail-closed است و migration/store PostgreSQL برای بازسازی بعد از restart اضافه شده؛ اجرای مقصد عملیاتی هنوز جداست |
| Provider واقعی | مسدود | Adapterهای OpenAI/Anthropic/Google/Compatible آماده‌اند؛ credential، cost policy و verifier مجوز فعال عمداً متصل/اجرا نشده‌اند |
| اجرای Task واقعی در Worktree | مسدود | نیازمند HERO-020 و مجوز/دسترسی Provider مستقل است |
| درخواست، پلتفرم و معیار پذیرش پایلوت | مسدود | باید برای محصول کوچک مشخص و نسخه‌دار شود؛ بدون mock جایگزین اجرای واقعی نمی‌شود |
| production، deploy، spend و secret change | مسدود تا مجوز جدا | این عملیات هرگز از مجوز توسعه استنتاج نمی‌شوند |

## شواهد عملیاتی ثبت‌شده در ۲۰۲۶-۰۸-۳۰ و ۲۰۲۶-۰۹-۰۵

- `docker build --target verify`: موفق؛ build، Doctor و تست‌های کامل داخل Linux container اجرا شدند.
- Backup/Restore ایزولهٔ PostgreSQL با artifact موقت `hero-recovery-check`: موفق؛ checksum و sentinel پس از restore تطبیق داشتند.
- آخرین backup/restore disposable در ۲۰۲۶-۰۹-۰۵ با artifact `hero-recovery-check-20260905` و checksum `sha256:1ce262c482e6096d7c315d62c3483ba012a9f1e813e57f2d0fcfe5c29ccffb04` نیز موفق شد؛ منابع موقت خودکار حذف شدند.
- این شواهد، آزمون portability را تقویت می‌کنند اما جایگزین restore روی مقصد پاکِ مصوب، volume عملیاتی `hero-data` و مجوز انتقال نیستند.
- artifact `hero-control-plane:candidate-985ab8c` با digest `sha256:590efbccac4d7b20df03d4ad14d230003ff646821bef91df9712063648225135` از Commit `985ab8c` فقط روی stack مستقل `hero-test` مستقر است؛ Control Plane و PostgreSQL healthy، پورت مستقیم فقط روی localhost و Provider واقعی خاموش است؛ recovery عملیاتی، Provider واقعی و Pilot هنوز گیت دارند.
- Back Office Test شامل ۱۱ تیم، ۸ Role، تنظیمات کل پروژه، راهنمای Role/مفهوم و دفتر `OPEN-50` با ۵۰ ردیف است؛ این projection read-only هیچ authorization یا dispatch ایجاد نمی‌کند.

## فرمان بررسی

```text
pnpm check:pilot
```

این فرمان فقط وضعیت گیت‌ها را گزارش می‌کند و هیچ Provider، deploy، پیام بیرونی یا عملیات زیرساختی اجرا نمی‌کند. در وضعیت فعلی خروجی صحیح آن `blocked` است، چون سه گیت recovery عملیاتی، مجوز Provider و درخواست/معیار پذیرش Pilot باز هستند.

## تعریف عبور

HERO-021 فقط پس از ثبت Artifact، test evidence، review، handoff، گزارش محدودیت‌ها و مسیر rollback/recovery قابل قبول است. نتیجهٔ `ready` به‌تنهایی به معنی اجرای production نیست.
