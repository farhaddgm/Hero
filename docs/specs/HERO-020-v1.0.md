# HERO-020 v1.0 — انتقال‌پذیری، Backup و بازیابی

وضعیت: مصوب برای توسعه و تست قرارداد. انتقال واقعی به سرور، خواندن یا نوشتن Backup، کار با Secret، شروع Container و Production همگی مجوز مستقل می‌خواهند.

## هدف

Hero باید پیش از هر انتقال آینده، یک Gate نسخه‌دار و fail-closed داشته باشد که استقلال مخزن، قرارداد Linux/Compose، شواهد Backup مبتنی بر checksum، شواهد Restore مبتنی بر همان checksum و تأیید محیط Linux تمیز را بررسی کند. این گام فقط این ارزیابی قطعی و مستندات عملیاتی را اضافه می‌کند؛ هیچ Backup یا Restore واقعی اجرا نمی‌کند.

## طراحی

1. `Portability Gate` فقط با مجوز دقیق `test`، Step ID و نسخهٔ سند منطبق شروع می‌شود. Global Stop پیش از ثبت رخداد جدید، خروجی را با `GLOBAL_STOP_ACTIVE` متوقف می‌کند.
2. شاهد Source باید ثابت کند مخزن مستقل است، ارجاع به پروژهٔ خارجی و path مخصوص میزبان ندارد، و `.env.example`، `compose.yaml`، `Dockerfile` و `pnpm-lock.yaml` وجود دارند.
3. شاهد Runtime باید Linux container reference، prefix محیطی `HERO_` و منابع کاملاً مجزای `hero-data` و `hero-private` را ثبت کند.
4. شاهد Backup باید شناسهٔ artifact، checksum از نوع SHA-256، project scope و نبود Secret را ثبت کند. Gate هر checksum نامعتبر یا دادهٔ Secret-shaped را رد می‌کند.
5. شاهد Restore باید همان checksum، تطابق checksum، migration state تأییدشده و تأیید clean Linux را ثبت کند. نبود آخرین شرط با `LINUX_CLEANROOM_VERIFICATION_REQUIRED` fail-closed می‌شود.
6. خروجی موفق `PORTABILITY_VERIFIED` فقط یک رکورد آمادگی است. `TRANSFER_REQUIRES_SEPARATE_AUTHORIZATION` برای clone، انتقال artifact، provision، Container start، Secret و هر عملیات واقعی پابرجاست.

## معیار پذیرش

- قرارداد Domain و endpoint عمومی، Source/Runtime/Backup/Restore/Linux را قابل تست و idempotent ارزیابی کنند.
- ورودی Secret-shaped و host path رد شوند و همهٔ شکست‌ها پیش از هر عملیات فایل، شبکه، host یا container رخ دهند.
- مستندات انتقال، checksum، restore، rollback و گیت مجوز مستقل را روشن کنند.
- `pnpm check` موفق باشد.
- تأیید واقعی Restore روی Linux تمیز فقط با شواهد محیط مقصد انجام می‌شود؛ تا آن زمان این گام Prototype است و نباید در رودمپ «تکمیل» شود.
