# انتشار امن Back Office روی زیردامنه

این سند فقط الگوی آماده‌سازی است؛ DNS، firewall، TLS، Secret Store و production deploy باید جداگانه مجاز شوند. نمونهٔ Caddy در `deploy/backoffice/Caddyfile.example` قرار دارد؛ این فایل را باید در Caddy واقعیِ سرور load کرد، نه اینکه خودکار روی سرویس دیگری اعمال شود.

## الگوی پیشنهادی

```text
Internet
  -> HTTPS reverse proxy: hero.beeproject.ir
       -> Basic Auth / SSO و در صورت امکان IP allow-list
       -> 127.0.0.1:43100/backoffice
```

Compose همچنان باید با `HERO_BIND_ADDRESS=127.0.0.1` بماند تا پورت 43100 مستقیماً روی شبکه منتشر نشود. Reverse proxy تنها نقطهٔ عمومی است و باید TLS را terminate کند، headerهای `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate` را حفظ کند و مسیرهای ناشناخته، sitemap و فایل‌های کشف عمومی را رد کند.

## DNS و HTTPS

۱. در DNS فقط یک رکورد `A` یا `AAAA` برای `hero.beeproject.ir` به IP مقصد ثبت شود.
۲. در reverse proxy گواهی معتبر TLS برای همین نام صادر و تمدید خودکار شود.
۳. upstream فقط `http://127.0.0.1:43100` باشد؛ PostgreSQL و پورت داخلی 3100 عمومی نشوند.
۴. `HERO_BACKOFFICE_USER` و `HERO_BACKOFFICE_PASSWORD` فقط در Secret Store مقصد قرار گیرند؛ password حداقل ۱۶ نویسه باشد.
۵. برای Caddy مقدار `HERO_BACKOFFICE_PASSWORD_HASH` را با ابزار خود Caddy روی همان سرور بسازید؛ hash یا password وارد Git و چت نشود.

## قابل‌جست‌وجو نبودن

`robots.txt`، meta robots و `X-Robots-Tag` به crawlerهای معمول می‌گویند صفحه را index یا دنبال نکنند؛ این‌ها امنیت ایجاد نمی‌کنند و تضمین نمی‌کنند کسی URL را پیدا نکند. مرز واقعی، HTTPS + احراز هویت + firewall/IP allow-list است. بنابراین «کسی که URL را بداند» نیز بدون مجوز نباید پاسخ Back Office بگیرد.

## تست پذیرش قبل از اعلام آدرس

- `curl -I https://hero.beeproject.ir/backoffice` بدون credential باید `401` بگیرد؛
- با credential مجاز باید `200` بگیرد و `X-Robots-Tag` را داشته باشد؛
- `https://hero.beeproject.ir/robots.txt` باید `Disallow: /` بدهد؛
- `https://hero.beeproject.ir/sitemap.xml` و مسیرهای ناشناخته باید `404` بدهند؛
- پاسخ HTML باید meta `robots` با `noindex, nofollow` داشته باشد؛
- اسکن پورت مقصد نباید 43100 یا PostgreSQL را عمومی نشان دهد؛
- `pnpm check` و smoke-test مسیرهای `/backoffice`، `/backoffice-data` و `/backoffice-events` باید قبل از انتشار موفق باشند.

تا زمان ثبت این شواهد، آدرس زیردامنه «منتشرشده و امن» تلقی نمی‌شود.

## وضعیت فعلی این سرور

در بررسی `2026-08-31`، DNS به `82.115.8.115` resolve شد و HTTP توسط Caddy به HTTPS redirect می‌کرد، اما TLS با `internal error` شکست خورد و route به Hero نداشت. چون Caddy فعلی خارج از ریشهٔ Git پروژه است، اصلاح آن از داخل این task انجام نمی‌شود؛ باید operator مجاز فایل نمونه را در همان Caddy فعال، certificate را صادر و firewall را بررسی کند.
