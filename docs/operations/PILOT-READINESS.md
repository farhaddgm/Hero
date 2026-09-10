# آمادگی اجرای HERO-021

این سند وضعیت واقعی پیش‌نیازهای پایلوت انتهابه‌انتها را ثبت می‌کند. نبود هر شرط یعنی پایلوت `blocked` است؛ هیچ mock یا فرضی جای شواهد واقعی را نمی‌گیرد.

تصمیم مالک در ۲۰۲۶-۰۹-۱۰: توسعه و تست معمولی روی Test فعلی ادامه دارد؛ Recovery Clean Linux فعلاً deferred است و تا زمان انجام آن، استفادهٔ عملیاتی نهایی یا Production مجاز نیست.

| شرط | وضعیت فعلی | شاهد/اقدام لازم |
| --- | --- | --- |
| قرارداد و Task Graph نسخه‌دار | آماده | Planner، training benchmark و تست‌های قراردادی موجودند |
| محیط Linux پاک و Compose مستقل | آمادهٔ test / انتقال مسدود | imageهای verify/runtime با Linux container ساخته و بررسی شده‌اند؛ اجرای مقصد واقعی هنوز مجوز و محیط مقصد می‌خواهد |
| PostgreSQL migration و command audit | آماده | Test جاری `persistence=postgresql` و `readiness=ready`؛ مسیرهای command/read-access audit با Owner session پاسخ `200` دادند |
| Snapshot و hydration رجیستری‌های اصلی | آماده | startup hydration از snapshotهای نسخه‌دار: ۱۱ registry، بدون مورد گمشده، integrity معتبر |
| projection پایدار همهٔ domain commandها | آماده در Test جاری | restart کنترل‌شدهٔ Control Plane انجام شد و projection digest ثابت ماند |
| session revocation پایدار مالک | آماده در قرارداد و persistence | احراز هویت fail-closed و snapshotهای PostgreSQL در Test جاری hydrate شدند؛ تست کامل revocation همچنان در suite پوشش دارد |
| Provider واقعی | برای VPN لازم نیست؛ برای AI جداگانه gated | VPN runtime با `runtimeProvider=none` به AI Provider، Model ID یا API key نیاز ندارد؛ Adapterها و verifier برای کارهای AI آماده‌اند اما credential و مجوز واقعی مالک فعال نیست |
| اجرای Pilot واقعی در Worktree/زیرساخت مستقل | مسدود | نیازمند HERO-020، مقصد VPS/VM مستقل، شبکه‌های آزمون و مجوز اجرای Pilot است؛ AI Provider فقط در صورت افزودن orchestration هوش مصنوعی لازم می‌شود |
| درخواست، پلتفرم و معیار پذیرش پایلوت | پیشنهاد نسخه‌دار؛ منتظر مالک | `HERO-PILOT-001/v1.0` برای VPN خصوصی با AmneziaWG و fallback XRay آماده است؛ مقصد VPS/VM، شبکه‌های آزمون و سقف زیرساخت باید تصویب شوند. چون runtime VPN به AI Provider نیاز ندارد، Model ID/سقف AI برای خود این Pilot لازم نیست. |
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
- verification کد جاری در Linux container با `250/250` تست و Build برابر ۱۴۹ ماژول و ۱۱ فایل JSON موفق شد؛ `pnpm check:docs` نیز با ۹۱ سند، ۱ Product و ۰ خطا موفق شد.

## فرمان بررسی

```text
pnpm check:pilot
```

این فرمان فقط وضعیت گیت‌ها را گزارش می‌کند و هیچ Provider، deploy، پیام بیرونی یا عملیات زیرساختی اجرا نمی‌کند. در وضعیت فعلی خروجی صحیح آن `blocked` است، چون Recovery روی مقصد Clean Linux و تصویب مالک/سقف هزینهٔ زیرساخت درخواست Pilot باز هستند؛ گیت Provider برای VPN اعمال نمی‌شود.

## تعریف عبور

HERO-021 فقط پس از ثبت Artifact، test evidence، review، handoff، گزارش محدودیت‌ها و مسیر rollback/recovery قابل قبول است. نتیجهٔ `ready` به‌تنهایی به معنی اجرای production نیست.
