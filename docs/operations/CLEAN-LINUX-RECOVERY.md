# بازیابی Hero روی Clean Linux

کد، قرارداد و تست disposable آماده‌اند؛ اما بستن این گیت فقط با یک VM یا سرور Linux مستقل و خالی انجام می‌شود. کانتینر موقت روی همین host شاهد مقصد مستقل محسوب نمی‌شود.

## کاری که ادمین باید انجام دهد

1. یک VM خالی با Ubuntu 24.04 LTS یا Debian 12 بسازد که هیچ پروژهٔ دیگری روی آن نباشد.
2. فقط Docker Engine و Docker Compose v2 را نصب کند؛ هیچ پورت عمومی برای PostgreSQL یا `43101` باز نکند.
3. یک شناسهٔ غیرحساس مقصد، نسخهٔ OS، نسخهٔ Docker و تأیید خالی‌بودن مقصد را اعلام کند؛ password، SSH key یا IP خصوصی لازم نیست در چت فرستاده شود.
4. یک پل محدود بسازد که فقط سه عملیات ثابت Hero را مجاز کند: `hero-recovery-backup-test`، `hero-recovery-restore-clean` و `hero-recovery-status`. کلید اتصال مقصد باید root-only و پشت wrapper بماند؛ `hero-ops` نباید shell، Docker socket یا Secretهای پروژه‌های دیگر بگیرد.
5. مسیر artifact را خارج از Git و فقط برای Hero بسازد. backup باید رمزنگاری‌شده باشد؛ SHA-256 نسخهٔ رمزنگاری‌شده و شناسهٔ artifact در خروجی ثبت شود، نه محتوای آن.
6. restore را فقط در Compose project و volumeهای تازه با پیشوند `hero-recovery-` انجام دهد؛ هرگز `hero`, `hero-test` یا volume موجود را overwrite نکند.
7. migration، `/health`، `/ready`، hydration هر ۱۱ registry و تطابق checksum را روی مقصد بررسی کند.
8. فقط evidence غیرحساس را مطابق [clean-linux-evidence.example.json](../../deploy/recovery/clean-linux-evidence.example.json) در `/opt/hero/var/evidence/clean-linux-recovery.json` قرار دهد و mode را `600` کند.

## خروجی لازم

- مقصد واقعاً Linux پاک و مستقل است؛
- backup و restore digest مشترک دارند؛
- restore در منابع `hero-recovery-*` انجام شده است؛
- migration و readiness موفق‌اند؛
- هیچ سرویس دیگری تغییر نکرده است.

این فرایند دسترسی یا مجوز Production نمی‌دهد. انتقال داده، ساخت backup عملیاتی و استفاده از مقصد باید با مجوز جداگانهٔ همان عملیات انجام شود.
