# برنامهٔ پایلوت سیستم توسعهٔ محصول Hero

> Document ID: `HERO-OPS-PRODUCT-DEVELOPMENT-PILOT`
> Canonical path: `docs/operations/PRODUCT-DEVELOPMENT-PILOT.md`
> Title: برنامهٔ پایلوت سیستم توسعهٔ محصول Hero
> Type: operation
> Scope: cross-project
> Status: proposed
> Version: 1.0.0
> Owner: project-owner
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## دامنهٔ پایلوت

پایلوت فعلی فقط Hero، یک سند `proposal-editable` و محیط Test را پوشش می‌دهد. هدف، اثبات catalog، graph، completeness، Notion mirror، idempotency، conflict detection و بازیابی بدون تأثیر بر Production است.

## معیار پذیرش

1. Catalog و graph بدون Notion deterministic rebuild شوند.
2. allowlist خارج از دامنهٔ خود Page جدید نسازد.
3. اجرای تکراری checksum برابر بدهد و duplicate نسازد.
4. خطای checksum به conflict تبدیل شود و overwrite رخ ندهد.
5. Notion خاموش، Product Studio و Git را متوقف نکند.
6. سند restricted یا mirror-only از مسیر ویرایش proposal عبور نکند.
7. نتیجهٔ `pnpm check` و شواهد owner review ثبت شود.

## خارج از دامنه

Production، webhook عمومی، inbound PR خودکار، اسناد restricted، sync همهٔ اسناد، خرید plan، Provider پولی و تغییر Secret در این پایلوت نیستند.

## Promotion

پس از موفقیت Test، owner باید دامنهٔ پایلوت بعدی، سندهای allow-listed، reviewer و مجوز ارسال بیرونی را جداگانه تعیین کند. موفقیت این پایلوت به‌تنهایی مجوز Production نیست.
