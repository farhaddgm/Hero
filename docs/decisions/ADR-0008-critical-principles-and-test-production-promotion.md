# ADR-0008 — اصول حیاتی و Promotion از test به production

- وضعیت: پیشنهادی برای تصویب مالک
- تاریخ: 2026-08-30

## مسئله

منشور Hero اصول مهمی داشت اما اصول Hero و اصول اختصاصی هر محصول به‌عنوان موجودیت نسخه‌دار، قابل بررسی و blocking در فلو اجرا نمی‌شدند. همچنین Workflow فعلی چرخهٔ Run را پوشش می‌داد، نه زنجیرهٔ دقیق Git → test → approval → production.

## تصمیم

1. `CriticalPrinciplesRegistry` منبع کنترل اصول پایهٔ Hero و اصول محصول است.
2. اصول حیاتی با enforcement `block` در control pointهای مشخص اجرا می‌شوند.
3. محصول اصول پایهٔ Hero را به‌صورت inherited دریافت می‌کند و می‌تواند اصول اختصاصی تأییدشده داشته باشد.
4. `ReleasePromotion` Artifact را با version و commit SHA از test تا production همراه می‌کند.
5. production فقط بعد از test evidence، تأیید مالک، فرمان صریح و مجوز مستقل `production-deploy` قابل درخواست است.
6. Deployment Adapter، PostgreSQL و GitHub Environment در لایهٔ Adapter می‌مانند و Domain به سرویس بیرونی وابسته نمی‌شود.

## پیامدها

- تست‌شده و منتشرشده از هم قابل تمایز و حسابرسی می‌شوند.
- اضافه‌شدن اصل جدید ممکن است پروژه را تا زمان تأیید متوقف کند؛ این رفتار عمدی است.
- اجرای زنده، Secret، هزینه و deploy همچنان خارج از پیاده‌سازی deterministic فعلی باقی می‌مانند.
- Notion برای دانش و مدیریت دیداری استفاده می‌شود، اما GitHub منبع نسخهٔ کد و Hero منبع گیت و Evidence باقی می‌ماند.
