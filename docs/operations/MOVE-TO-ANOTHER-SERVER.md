# انتقال Hero به سرور دیگر

## پیش‌نیاز مقصد

- Linux با Docker Engine و Compose
- دسترسی به مخزن مستقل Hero
- فایل .env و Secretها از مسیر امن، جدا از Git
- فضای دیسک جدا برای volumeهای Hero

## روند انتقال

1. مخزن Hero را روی مقصد clone کنید.
2. نسخه‌ی موردنظر را checkout کنید.
3. .env.example را به .env تبدیل و مقادیر محیط مقصد را وارد کنید.
4. docker compose --env-file .env build را اجرا کنید.
5. تست‌ها و pnpm doctor را در محیط build اجرا کنید.
6. volume داده را restore کنید؛ در نسخه فعلی داده‌ی کاربردی وجود ندارد.
7. docker compose --env-file .env up -d را اجرا کنید.
8. /health و /ready را کنترل کنید.

هیچ فایل یا سرویس پروژه‌ی دیگری برای این روند لازم نیست. هنگام اضافه‌شدن دیتابیس، صف یا object storage، روش backup/restore آن‌ها به همین سند افزوده می‌شود.
