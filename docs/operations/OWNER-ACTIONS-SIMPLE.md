# کارهای باقی‌ماندهٔ مالک — نسخهٔ خیلی ساده

وضعیت مرجع: ۲۰۲۶-۰۹-۱۰

Test آماده است: سه سرویس healthy، PostgreSQL واقعی، readiness آماده، hydration هر ۱۱ registry، دامنه/TLS و احراز هویت تأیید شده‌اند. Secretهای Test را دوباره نسازید و Compose را دوباره راه‌اندازی نکنید. فایل قدیمی `compose.test.yaml` نیز فعال نیست و به‌صورت بازیافت‌پذیر کنار گذاشته شده است.

فقط سه تصمیم/دسترسی بیرونی باقی مانده است:

## ۱. یک مقصد Clean Linux بدهید

ادمین باید یک VM پاک و اختصاصی Hero با Linux و Docker/Compose آماده کند؛ هیچ پروژهٔ دیگری روی آن نباشد. سپس پل محدود recovery را طبق [CLEAN-LINUX-RECOVERY.md](CLEAN-LINUX-RECOVERY.md) بسازد. password، private key یا Secret را در چت نفرستید.

## ۲. Provider و سقف هزینه را تأیید کنید

پیشنهاد پایلوت اول: فقط OpenAI؛ نقش‌های خواندنی از خانوادهٔ ChatGPT، Executor از خانوادهٔ Codex، سقف کل ۵ دلار و انقضای کوتاه. شما باید Model IDهای موجود در حساب و سقف را تأیید کنید و به ادمین اجازه دهید API key را فقط در Secret Store محیط Test قرار دهد. جزئیات در [EXTERNAL-SPEND-AUTHORIZATION.md](EXTERNAL-SPEND-AUTHORIZATION.md) است.

API key را هرگز برای من، در Git، Sheet یا ticket ارسال نکنید.

## ۳. پایلوت پیشنهادی را تأیید یا اصلاح کنید

پیشنهاد آماده: «وب‌اپ فارسی و RTL برای ثبت و پیگیری کارها، با ذخیره محلی و بدون API بیرونی یا Production». معیارهای دقیق در [PILOT-REQUEST-20260910.md](PILOT-REQUEST-20260910.md) آمده است.

اگر موافقید، همین جمله کافی است:

```text
HERO-PILOT-001 v1.0 و سقف کل ۵ دلار را تأیید می‌کنم؛ فقط Test، فقط OpenAI، Model IDهای ثبت‌شده، بدون Production، پیام بیرونی یا عملیات مخرب.
```

پس از این سه مورد، بقیهٔ بررسی، Provider smoke test، اجرای پایلوت، ارزیابی و گزارش با من است. Production همچنان مجوز مستقل می‌خواهد.
