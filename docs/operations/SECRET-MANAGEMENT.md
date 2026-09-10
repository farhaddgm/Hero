# مدیریت امن Secretها

## تصمیم

مدیریت Secretها می‌تواند متمرکز باشد، اما مقدار Secret همهٔ پروژه‌ها نباید در یک فایل مشترک قرار بگیرد. واحد جداسازی الزامی «پروژه + محیط» است. هر runtime فقط باید Secretهای موردنیاز خودش را دریافت کند.

برای Hero دو مجموعهٔ مستقل لازم است:

- `hero / test`؛
- `hero / production`.

فایل‌های داخل repository فقط example هستند و مقدار محرمانه ندارند. فایل واقعی باید خارج از repository، در runtime secret store نگهداری شود. مسیر واقعی، password، hash، token و connection string نباید وارد Git، مستندات، Sheet، ticket، log یا چت شود.

## ساختار منطقی روی یک سرور

ساختار زیر قراردادی است و مسیر واقعی آن را اپراتور زیرساخت تعیین می‌کند:

```text
<runtime-secret-root>/
  hero/
    test.env
    production.env
  <another-project>/
    test.env
    production.env
```

این یک پوشهٔ مدیریتی مشترک است، نه یک فایل Secret مشترک. هر فایل باید مالک و permission مستقل داشته باشد. دسترسی پیشنهادی `0600` برای کاربر اختصاصی سرویس یا `0640` برای `root:<service-group>` است. هیچ پروژه‌ای نباید فایل پروژهٔ دیگر را mount یا source کند.

یک inventory مرکزی مجاز است، به شرط آنکه فقط نام Secret، پروژه، محیط، مالک، مصرف‌کننده، تاریخ آخرین rotation و موعد rotation بعدی را ثبت کند؛ مقدار Secret یا hash در inventory ممنوع است.

## قرارداد Hero

الگوی Test در `deploy/test/hero-test.env.example` و الگوی Production در `deploy/production/hero-production.env.example` قرار دارد. مقدارهای Test و Production باید متفاوت باشند. اتصال PostgreSQL هر محیط فقط باید به database همان محیط اشاره کند.

Compose باید فایل runtime همان محیط را صریح دریافت کند. اتکا به یک `.env` عمومی یا source کردن فایل پروژهٔ دیگر ممنوع است. Secretهای Provider زنده نیز تا ثبت مجوز مستقل external-spend و Provider باید غیرفعال بمانند.

## مهاجرت بدون آسیب به سرویس‌ها

مهاجرت سراسری باید برای هر پروژه جداگانه و به ترتیب زیر انجام شود:

1. وضعیت، health check و روش rollback همان پروژه ثبت شود؛ مقدار Secret ثبت نشود.
2. فایل جدید همان «پروژه + محیط» با permission محدود ساخته شود؛ فایل قبلی هنوز حذف یا تغییر نکند.
3. نام متغیرهای لازم با example پروژه مقایسه شود؛ مقدارها چاپ نشوند.
4. پیکربندی Compose یا systemd با فایل جدید فقط validate شود.
5. فقط همان سرویس و همان محیط در پنجرهٔ نگهداری کنترل‌شده recreate یا restart شود؛ سرویس‌های پروژه‌های دیگر دست‌نخورده بمانند.
6. health، readiness، احراز هویت و اتصال persistence همان سرویس آزموده شود.
7. در صورت شکست، فوراً پیکربندی قبلی بازگردانده و همان سرویس دوباره آزموده شود.
8. پس از موفقیت و یک دورهٔ پایش، نسخهٔ قدیمی با مجوز جداگانهٔ حذف داده کنار گذاشته شود.
9. Secretهایی که قبلاً در چت، history، log یا فایل مشترک دیده شده‌اند rotation شوند.
10. backup فقط به‌شکل رمزنگاری‌شده و همراه با تست restore نگهداری شود.

در Compose تک‌نمونه‌ای، تغییر environment معمولاً به recreate همان container نیاز دارد و ممکن است وقفهٔ کوتاهی برای همان سرویس ایجاد کند. حذف کامل وقفه فقط با حداقل دو replica، health check و reverse proxy/load balancer ممکن است. این قرارداد از اختلال پروژه‌های دیگر جلوگیری می‌کند، اما ادعای zero-downtime برای سرویس تک‌نمونه‌ای نمی‌کند.

## کنترل خودکار repository

`pnpm check` از طریق clean-room scan این موارد را رد می‌کند:

- track شدن فایل runtime با نام‌هایی مانند `.env`، `.env.production` یا `service.env`؛
- مقدار غیرخالی برای کلیدهای حساس در فایل‌های `*.env.example`؛
- متغیر environment بدون پیشوند `HERO_` در exampleهای Hero.

این کنترل جای secret scanning سمت Git host و rotation دوره‌ای را نمی‌گیرد، اما جلوی خطاهای رایج repository را می‌گیرد.

## مرز اجرا

این repository فقط مجاز است Secretهای Hero را تعریف و اعتبارسنجی کند. inventory و مهاجرت پروژه‌های دیگر باید در یک کار مستقل زیرساخت، با scope صریح همان پروژه و بدون خواندن آن‌ها از داخل Hero انجام شود.
