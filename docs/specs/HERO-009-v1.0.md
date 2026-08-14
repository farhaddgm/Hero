# HERO-009 v1.0 — Fake Agent و آزمایش قطعی

وضعیت: مصوب برای توسعه و تست در 2026-08-14.

## هدف

برای اعتبارسنجی Orchestrator پیش از اتصال هر Provider واقعی، یک Fake Agent قطعی ایجاد می‌شود. این Agent هیچ درخواست شبکه، اعتبارنامه، CLI مدل، تغییر Repository یا هزینه‌ای ایجاد نمی‌کند و تنها خروجی نسخه‌دار و قابل‌تکرار تولید می‌کند.

## مرز قطعی بودن

ورودی هر اجرای Fake Agent شامل `runId`، `taskId`، `stepId`، نسخهٔ سند، سناریو، شمارهٔ تلاش و idempotency key است. ورودی یکسان همان نتیجهٔ اسکریپت‌شده را بازپخش می‌کند؛ استفادهٔ دوباره از همان کلید با ورودی متفاوت متوقف می‌شود. زمان نیز در آزمون‌ها تزریقی است تا نتیجه قابل بازتولید بماند.

## سناریوهای پوشش‌داده‌شده

| سناریو | تلاش نخست | ادامهٔ کنترل‌پلین | پایان |
| --- | --- | --- | --- |
| `success` | تحلیل، پیاده‌سازی و تست موفق | checkpoint امن، Review و Approval مالک | تکمیل |
| `review-changes` | بازخورد تغییر ثبت می‌شود | checkpoint، Review، درخواست تغییر، تلاش دوم ایزوله | Approval و تکمیل |
| `failure-then-retry` | شکست قطعی Agent | runner failed/cleanup، workflow fail/retry و تلاش دوم | Approval و تکمیل |
| `pause-resume` | checkpoint امن برای Pause | Pause و Resume مالک، سپس تلاش دوم ایزوله | Approval و تکمیل |

## اتصال به هستهٔ موجود

Harness آزمایشی از Authorization Engine برای مجوز دقیق `HERO-009` و `v1.0` استفاده می‌کند؛ سپس Workflow Engine و Isolated Runner Engine را با Event Log مشترک راه می‌اندازد. هر تلاش Runner مستقل، worktree نسبی و شبکهٔ پیش‌فرض بسته دارد. پایان هر تلاش فقط پس از checkpoint یا failure به cleanup می‌رسد.

## خارج از محدوده

این گام هیچ Codex، Claude، Cursor، API key، صف، Git CLI، Docker، شبکه یا Provider زنده‌ای را اجرا نمی‌کند. اجرای واقعی Provider و سیاست انتخاب مدل گام‌های بعدی است؛ Fake Agent فقط قرارداد و مسیرهای خطا را بدون هزینه اثبات می‌کند.

## معیار پذیرش

1. موفقیت، Review/Changes، failure/retry، Pause/Resume و Approval با خروجی تکرارپذیر پوشش داده شوند.
2. هر Run فقط با مجوز دقیق Step ID و نسخهٔ سند شروع شود و Global Stop/مجوز نامعتبر fail-closed باقی بماند.
3. هر Runner پیش از cleanup به وضعیت امن برسد و تلاش‌های retry یا resume در Runner جدا انجام شوند.
4. قرارداد Fake Agent، Harness، Endpoint قرارداد و آزمون‌ها هیچ اتصال واقعی Provider یا شبکه‌ای ایجاد نکنند.
