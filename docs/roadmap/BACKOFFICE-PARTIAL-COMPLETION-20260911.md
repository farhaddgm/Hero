# بستهٔ تکمیل محلی الزامات Partial بک‌آفیس — ۲۰۲۶-۰۹-۱۱

> Document ID: `HERO-EVIDENCE-BACKOFFICE-PARTIAL-COMPLETION-20260911`  
> Version: `1.0.0` · Status: `active` · Owner: `hero-architecture`  
> Canonical scope: `hero` · Review cadence: `per-change`

## هدف و مرز

این بسته، بخش‌های قابل‌تکمیل درون خود Hero از ۷۶ الزام `partial` را در یک لایهٔ واحد به هم متصل می‌کند. این تغییر به‌تنهایی ادعا نمی‌کند که ۷۶ الزام در معیار سخت‌گیرانهٔ تحویل `verified` شده‌اند؛ معیار verified هنوز به UI واقعی، persistence/runtime و شواهد محیطی نیاز دارد.

مجوز عملیاتی محدود این دور در `config/authorizations/backoffice-20260911-018.json` ثبت شده است: فقط توسعه/آزمون و همگام‌سازی credential PostgreSQL محیط Test؛ Production، Provider، Pilot و عملیات مخرب خارج از scope هستند.

## آنچه در source تکمیل شد

- قرارداد واحد سه نقش پایه (`project-owner`، `admin`، `viewer`) با capability matrix و shell project-scoped؛ Viewer فقط خواندنی است.
- صفحه‌بندی bounded با query budget و جست‌وجوی محدود برای جلوگیری از پاسخ‌های نامحدود.
- تنظیمات لایه‌ای Hero/Project/Team/Role/Model/Task/Conversation با version، reason، prior value و history append-only.
- زنجیرهٔ `traceId`/`correlationId` با parent link و تشخیص parent مفقود.
- Evidence coverage برای accessibility، security، load، backup/restore، role isolation، traceability، portability و retention.
- policy نگهداری با حداقل‌های تغییرناپذیر، cleanup preview به‌صورت dry-run/hold و عدم حذف خودکار.
- انتخاب زبان فارسی/انگلیسی با جهت RTL/LTR و حفظ identifierهای ASCII.
- API project-scoped در `GET/POST /api/projects/:projectId/completion`؛ actionهای mutation فقط از همان actor احراز‌شده عبور می‌کنند.

## کنترل و آزمون

- تست جدید: `tests/backoffice-completion.test.mjs` — ۴ سناریو موفق.
- Build مرجع Linux: **PASS — ۲۴۳ ماژول و ۴۴ فایل JSON**.
- `npm run check` در کانتینر source snapshot: **PASS — clean-room با ۴۵۱ فایل، build با ۲۴۳ ماژول و ۴۴ JSON، و ۳۲۸ تست با صفر شکست**؛ یک warning صرفاً به‌دلیل نبود Docker تو‌در‌تو در خود check است.
- هیچ Provider call، مصرف، GitHub/server operation، Production deploy یا Pilot اجرا نشده است. برای بازیابی persistence محیط Test، Secret همان محیط با نقش PostgreSQL همگام شد؛ مقدار Secret در شواهد یا خروجی ثبت نشده است.

## مواردی که عمداً باز می‌مانند

موارد زیر به‌علت نیاز به تصمیم Owner، credential جداگانه یا اجرای واقعی Test/Production در این بسته بسته نمی‌شوند: provisioning واقعی سرور و GitHub، MFA delivery/recovery end-to-end، scanner/parser عملیاتی، telemetry و ingest واقعی Production، backup/restore روی مقصد پاک، portability transfer، browser E2E و پذیرش Owner برای Pilot. وضعیت canonical آن‌ها فقط در `config/backoffice/delivery-audit-v1.0.json` و `docs/roadmap/BACKOFFICE-DELIVERY-AUDIT-20260911.md` معتبر است.
