# آمادگی اجرای HERO-021

این سند وضعیت واقعی پیش‌نیازهای پایلوت انتهابه‌انتها را ثبت می‌کند. نبود هر شرط یعنی پایلوت `blocked` است؛ هیچ mock یا فرضی جای شواهد واقعی را نمی‌گیرد.

| شرط | وضعیت فعلی | شاهد/اقدام لازم |
| --- | --- | --- |
| قرارداد و Task Graph نسخه‌دار | آماده | Planner، training benchmark و تست‌های قراردادی موجودند |
| محیط Linux پاک و Compose مستقل | آمادهٔ test | Compose با منابع `hero-*` و health/readiness فعال است |
| PostgreSQL migration و command audit | آمادهٔ test | migration `001` و `check:postgres` با محیط موقت موفق شده‌اند |
| projection پایدار همهٔ domain commandها | مسدود | هنوز projection کامل از in-memory به PostgreSQL منتقل نشده است |
| session revocation پایدار مالک | مسدود | مرز signed-session موجود است؛ revocation durable باقی است |
| Provider واقعی | مسدود | Codex/ChatGPT، Claude و Cursor عمداً disabled هستند |
| اجرای Task واقعی در Worktree | مسدود | نیازمند HERO-020 و مجوز/دسترسی Provider مستقل است |
| درخواست، پلتفرم و معیار پذیرش پایلوت | آمادهٔ تعریف | باید برای محصول کوچک مشخص و نسخه‌دار شود |
| production، deploy، spend و secret change | مسدود تا مجوز جدا | این عملیات هرگز از مجوز توسعه استنتاج نمی‌شوند |

## فرمان بررسی

```text
pnpm check:pilot
```

این فرمان فقط وضعیت گیت‌ها را گزارش می‌کند و هیچ Provider، deploy، پیام بیرونی یا عملیات زیرساختی اجرا نمی‌کند. تا زمانی که شروط مسدود رفع نشده‌اند، خروجی صحیح آن `blocked` است.

## تعریف عبور

HERO-021 فقط پس از ثبت Artifact، test evidence، review، handoff، گزارش محدودیت‌ها و مسیر rollback/recovery قابل قبول است. نتیجهٔ `ready` به‌تنهایی به معنی اجرای production نیست.
