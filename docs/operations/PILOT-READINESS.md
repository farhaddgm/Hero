# آمادگی اجرای HERO-021

این سند وضعیت واقعی پیش‌نیازهای پایلوت انتهابه‌انتها را ثبت می‌کند. نبود هر شرط یعنی پایلوت `blocked` است؛ هیچ mock یا فرضی جای شواهد واقعی را نمی‌گیرد.

| شرط | وضعیت فعلی | شاهد/اقدام لازم |
| --- | --- | --- |
| قرارداد و Task Graph نسخه‌دار | آماده | Planner، training benchmark و تست‌های قراردادی موجودند |
| محیط Linux پاک و Compose مستقل | آمادهٔ test / انتقال مسدود | imageهای verify/runtime با Linux container ساخته و بررسی شده‌اند؛ اجرای مقصد واقعی هنوز مجوز و محیط مقصد می‌خواهد |
| PostgreSQL migration و command audit | آماده | Test جاری `persistence=postgresql` و `readiness=ready`؛ مسیرهای command/read-access audit با Owner session پاسخ `200` دادند |
| Snapshot و hydration رجیستری‌های اصلی | آماده | startup hydration از snapshotهای نسخه‌دار: ۱۱ registry، بدون مورد گمشده، integrity معتبر |
| projection پایدار همهٔ domain commandها | آماده در Test جاری | restart کنترل‌شدهٔ Control Plane انجام شد و projection digest ثابت ماند |
| session revocation پایدار مالک | آماده در قرارداد و persistence | احراز هویت fail-closed و snapshotهای PostgreSQL در Test جاری hydrate شدند؛ تست کامل revocation همچنان در suite پوشش دارد |
| Provider واقعی | پیاده‌سازی آماده؛ runtime مسدود | Adapterها و verifier مجوز زمان‌دار/role-model-cost-bound آماده و تست‌شده‌اند؛ credential و مجوز واقعی مالک هنوز فعال نیست |
| اجرای Task واقعی در Worktree | مسدود | نیازمند HERO-020 و مجوز/دسترسی Provider مستقل است |
| درخواست، پلتفرم و معیار پذیرش پایلوت | پیشنهاد نسخه‌دار؛ منتظر مالک | `HERO-PILOT-001/v1.0` برای Web فارسی RTL با معیار عددی آماده است؛ Model ID و سقف پیشنهادی ۵ دلار باید تصویب شوند |
| production، deploy، spend و secret change | مسدود تا مجوز جدا | این عملیات هرگز از مجوز توسعه استنتاج نمی‌شوند |

## شواهد عملیاتی ثبت‌شده تا ۲۰۲۶-۰۹-۱۰

- `docker build --target verify`: موفق؛ build، Doctor و تست‌های کامل داخل Linux container اجرا شدند.
- Backup/Restore ایزولهٔ PostgreSQL با artifact موقت `hero-recovery-check`: موفق؛ checksum و sentinel پس از restore تطبیق داشتند.
- آخرین backup/restore disposable در ۲۰۲۶-۰۹-۰۵ با artifact `hero-recovery-check-20260905` و checksum `sha256:1ce262c482e6096d7c315d62c3483ba012a9f1e813e57f2d0fcfe5c29ccffb04` نیز موفق شد؛ منابع موقت خودکار حذف شدند.
- این شواهد، آزمون portability را تقویت می‌کنند اما جایگزین restore روی مقصد پاکِ مصوب، volume عملیاتی `hero-data` و مجوز انتقال نیستند.
- artifact قبلی `hero-control-plane:candidate-985ab8c` با digest `sha256:590efbccac4d7b20df03d4ad14d230003ff646821bef91df9712063648225135` فقط سابقهٔ ممیزی است و مبنای وضعیت جاری نیست؛ recovery عملیاتی، Provider واقعی و Pilot همچنان گیت دارند.
- Back Office Test شامل ۱۱ تیم، ۸ Role، تنظیمات کل پروژه، راهنمای Role/مفهوم و دفتر `OPEN-50` با ۵۰ ردیف است؛ این projection read-only هیچ authorization یا dispatch ایجاد نمی‌کند.
- در ۲۰۲۶-۰۹-۱۰، Test جاری `runtime=postgresql` و `readiness=ready` گزارش کرد؛ hydration برابر `hydrated`، شمار registry برابر ۱۱، شمار missing برابر صفر و event/snapshot integrity برابر `valid` بود.
- پس از restart کنترل‌شدهٔ فقط Control Plane، health/readiness و metadata hydration دوباره موفق و projection digest بدون تغییر بود. PostgreSQL، volume و سرویس‌های دیگر restart یا recreate نشدند.
- verification کد جاری در Linux container با `246/246` تست و Build برابر ۱۴۴ ماژول و ۹ فایل JSON موفق شد.

## فرمان بررسی

```text
pnpm check:pilot
```

این فرمان فقط وضعیت گیت‌ها را گزارش می‌کند و هیچ Provider، deploy، پیام بیرونی یا عملیات زیرساختی اجرا نمی‌کند. در وضعیت فعلی خروجی صحیح آن `blocked` است، چون سه گیت recovery عملیاتی، مجوز Provider و درخواست/معیار پذیرش Pilot باز هستند.

## تعریف عبور

HERO-021 فقط پس از ثبت Artifact، test evidence، review، handoff، گزارش محدودیت‌ها و مسیر rollback/recovery قابل قبول است. نتیجهٔ `ready` به‌تنهایی به معنی اجرای production نیست.
