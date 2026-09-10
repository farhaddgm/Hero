# کارهای باقی‌ماندهٔ مالک — نسخهٔ خیلی ساده

وضعیت مرجع: ۲۰۲۶-۰۹-۱۰

Test آماده است: سه سرویس healthy، PostgreSQL واقعی، readiness آماده، hydration هر ۱۱ registry، دامنه/TLS و احراز هویت تأیید شده‌اند. Secretهای Test را دوباره نسازید و Compose را دوباره راه‌اندازی نکنید. فایل قدیمی `compose.test.yaml` نیز فعال نیست و به‌صورت بازیافت‌پذیر کنار گذاشته شده است.

تصمیم فعلی مالک: خرید سرور دوم و Recovery فعلاً انجام نمی‌شود. این مورد در مرحلهٔ توسعه و Test مانع نیست؛ اما قبل از استفادهٔ عملیاتی نهایی یا Production باید انجام شود.

یادآوری ضروری آینده: Pricing Catalog نسخه‌دار باید قبل از فعال‌سازی Provider پولی
پیاده‌سازی شود. نرخ‌ها نباید دستی از Environment خوانده شوند؛ جزئیات، تست‌ها، migration
و شرط تأیید در [FUTURE-REQUIRED-PRICING-CATALOG.md](../roadmap/FUTURE-REQUIRED-PRICING-CATALOG.md)
ثبت شده است. فعلاً شما هیچ کاری برای این مورد انجام ندهید و API Key واقعی را فعال نکنید.

فعلاً فقط دو اقدام بیرونی لازم است:

## ۱. Provider و سقف هزینه را تأیید کنید

پیشنهاد پایلوت اول: فقط OpenAI؛ نقش‌های خواندنی از خانوادهٔ ChatGPT، Executor از خانوادهٔ Codex، سقف کل ۵ دلار و انقضای کوتاه. شما باید Model IDهای موجود در حساب و سقف را تأیید کنید و به ادمین اجازه دهید API key را فقط در Secret Store محیط Test قرار دهد. جزئیات در [EXTERNAL-SPEND-AUTHORIZATION.md](EXTERNAL-SPEND-AUTHORIZATION.md) است.

API key را هرگز برای من، در Git، Sheet یا ticket ارسال نکنید.

## ۲. پایلوت VPN پیشنهادی را تأیید یا اصلاح کنید

پیشنهاد آماده: «VPN خصوصی با مسیر اصلی AmneziaWG و fallback XRay VLESS Reality روی VPS/VM مستقل، فقط برای Test». معیارهای دقیق در [PILOT-REQUEST-20260910.md](PILOT-REQUEST-20260910.md) و اسناد Product-specific آمده است.

اگر موافقید، همین جمله کافی است:

```text
HERO-PILOT-001 v1.0 برای VPN خصوصی را تأیید می‌کنم؛ فقط Test، مقصد مستقل، AmneziaWG با fallback XRay VLESS Reality، شبکه‌های آزمون و سقف زیرساخت مشخص، بدون Production، پیام بیرونی یا عملیات مخرب. هزینهٔ AI فقط با تأیید جداگانه مجاز است.
```

پس از انجام این دو اقدام، توسعه و تست‌های مجاز را ادامه می‌دهم. اجرای واقعی پایلوت تا ثبت Recovery Clean Linux همچنان قفل است؛ Production نیز مجوز مستقل می‌خواهد.
