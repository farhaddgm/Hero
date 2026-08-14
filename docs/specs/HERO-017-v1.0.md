# HERO-017 v1.0 — کارخانه توسعه اپلیکیشن وب

وضعیت: مصوب برای توسعه و تست؛ Preview به مجوز جداگانه نیاز دارد.

## هدف

Hero باید بتواند یک درخواست سادهٔ فارسی و یک برنامهٔ آماده را به یک Blueprint و Feature Recipe نسخه‌دار برای اپلیکیشن وب تبدیل کند. خروجی باید Golden Stack وب، API، مرز داده، مرز احراز هویت، تست و مسیر تحویل به Cursor را روشن کند و فقط پس از Quality Gate موفق «تست‌شده» باشد.

## طراحی

1. ورودی فقط با Planning آماده، شناسه و نسخهٔ معتبر، درخواست فارسی، نام برنامهٔ قابل‌حمل و مجوز دقیق `develop` پذیرفته می‌شود. توقف سراسری، ساخت خروجی تازه را fail-closed متوقف می‌کند.
2. Blueprint استاندارد `Next.js + React + TypeScript`، Route Handlerهای REST، مرز Adapter برای PostgreSQL، مرز مستقل پیکربندی Auth، Quality Gate و مسیر نسبی Cursor را می‌سازد. هیچ dependency یا زیرساخت واقعی نصب یا provision نمی‌شود.
3. Feature Recipe نسخهٔ سند، Planning، درخواست، مسیرهای `/`، `/api/health` و `/auth`، مسئولیت Codex/Claude/Cursor و معیارهای پذیرش را ثبت می‌کند.
4. تأیید کیفیت از Quality Gate گام HERO-016 استفاده می‌کند: شواهد تست ایزولهٔ Codex، سپس بازبینی مستقل Claude. فقط نتیجهٔ `QUALITY_APPROVED` وضعیت کارخانه را به `WEB_FACTORY_TESTED` می‌رساند.
5. Preview فقط به شکل نامزدِ آماده ثبت می‌شود. در مجوز فعال این گام، تنها توسعه و تست وجود دارد؛ بنابراین کارخانه همیشه `PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION` ثبت می‌کند و هیچ Preview، انتشار، deploy، اتصال Provider، هزینه، Secret یا تغییر Repository انجام نمی‌دهد.

## معیار پذیرش

- یک درخواست نمونهٔ فارسی به Blueprint و Feature Recipe قابل‌حمل، نسخه‌دار و قابل‌فهم تبدیل شود.
- Stack وب/API/داده/Auth، معیارهای کیفیت و handoff Cursor صریح و قابل تست باشند.
- Quality Gate موفق، خروجی را با `WEB_FACTORY_TESTED` ثبت کند و شواهد خارجی یا mutation مستقیم Repository نداشته باشد.
- درخواست Preview بدون مجوز جداگانه، به جای اجرا، با `PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION` متوقف شود.
- هیچ Provider واقعی، Preview عمومی، دیتابیس، Auth، Secret، هزینه یا deploy در این گام رخ ندهد.
