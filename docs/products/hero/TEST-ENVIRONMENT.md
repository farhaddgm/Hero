# Hero — Test Environment

- Document ID: `HERO-PRODUCT-HERO-TEST`
- Version: `1.0.0`
- Status: `active`
- Scope: `product`
- Owner: `hero-operations`

## دامنه

این سند محیط Test مربوط به Product خود Hero است. محیط باید با قراردادهای Clean Room، persistence، authentication، health/readiness و recovery موجود در اسناد canonical اجرا شود.

## کنترل‌های لازم

- اجرای `pnpm check` پیش از handoff؛
- عدم استفاده از Secret واقعی در Git، Notion، Event یا log؛
- جداسازی منابع runtime با پیشوند `hero`؛
- ثبت Evidence برای health، auth، persistence، sync و rollback؛
- عدم promotion به Production بدون مجوز مستقل.
