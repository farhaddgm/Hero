# HERO-013 v1.0 — اتصال و بسته تحویل Cursor

وضعیت: مصوب برای توسعه و تست در 2026-08-14.

## هدف

Hero باید بتواند پس از evidence اجرای Codex و بازبینی Claude، یک بستهٔ تحویل ساختاریافته و قابل‌حمل برای محیط انسانی Cursor آماده کند. این بسته، Context گام، مسیرهای نسبی، مرجع artifact، نتیجهٔ تست، یافته‌های Claude و دستورهای پیشنهادیِ اجرا نشده را در یک قرارداد ثابت ارائه می‌دهد.

## طراحی این نسخه

1. نقش Cursor «اتاق کنترل انسانی» است. Hero فقط یک handoff قطعی تولید می‌کند و Cursor CLI/API را فراخوانی نمی‌کند.
2. ورود handoff به Task ID، Step ID و نسخهٔ سند دقیق bind است؛ evidence Codex و Claude با این سه مقدار سنجیده می‌شوند.
3. Codex evidence باید کامل، بدون خطای حل‌نشده، دارای تست passed و workspace ایزولهٔ غیرتغییردهنده باشد. مسیرهای absolute یا host-specific رد می‌شوند.
4. Claude approval، `HANDOFF_READY` و سه دستور پیشنهادیِ صرفاً قابل بازبینی تولید می‌کند. هر دستور `executed=false` و `requiresExplicitHumanConfirmation=true` است.
5. `changes-requested` از Claude، handoff را با `CLAUDE_CHANGES_REQUESTED` متوقف و ادامه در Cursor را غیرفعال می‌کند. اصلاح فقط با Task و مجوز مستقل ممکن است.
6. Adapter غیرفعال fail-closed است و `CURSOR_HANDOFF_DISABLED` می‌دهد. هیچ Cursor CLI، شبکه، credential، command execution یا تغییر repository در این گام رخ نمی‌دهد.

## مرز عملیات

Handoff به‌تنهایی مجوز merge، push، secret، هزینه، deployment یا تغییر کد نیست. این عملیات‌ها همچنان طبق قواعد پروژه به تأیید و Task جدا نیاز دارند. Harness نمونه، فقط مجوز نسخه‌دار operation=`review` را ارزیابی می‌کند و هیچ runner یا worktree واقعی نمی‌سازد.

## معیار پذیرش

1. بستهٔ آماده، Task/Version Context، مسیرهای نسبی، شواهد Codex و نتیجه Claude را با یک Artifact داخلی برمی‌گرداند.
2. همهٔ دستورهای Cursor فقط پیشنهاد هستند؛ اجرا نشده‌اند و تأیید صریح انسان می‌خواهند.
3. Claude changes-requested، داده را تحویل می‌دهد اما ادامه و پیشنهاد command را مسدود می‌کند.
4. secret، path مطلق و adapter غیرفعال fail-closed می‌مانند.
5. Harness، تطبیق دقیق Step/Version و نبود هرگونه runner یا mutation واقعی را اثبات می‌کند.
