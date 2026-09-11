# Runbook همگام‌سازی کنترل‌شدهٔ Notion

> Document ID: `HERO-OPS-NOTION-SYNC-RUNBOOK`
> Canonical path: `docs/operations/NOTION-SYNC-RUNBOOK.md`
> Title: Runbook همگام‌سازی کنترل‌شدهٔ Notion
> Type: operation
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-operations
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## پیش‌بررسی بدون شبکه

1. `pnpm notion:plan` را اجرا کن.
2. اطمینان بده allowlist فقط اسناد مورد تأیید و classification مجاز دارد.
3. `pnpm check:notion` را اجرا کن.
4. برای سند جدید ابتدا dry-run و سپس approval مستقل ثبت کن.

## اجرای یک سند

دستور `pnpm notion:sync-first -- --document=HERO-PRODUCT-HERO-BRIEF` فقط برای allowlist فعلی معتبر است. ابزار برای projection جدید marker شناسهٔ سند را اضافه می‌کند، Page دارای marker یا Page legacy دارای checksum برابر را پیدا می‌کند، checksum را مقایسه می‌کند و در حالت برابر هیچ Page جدیدی نمی‌سازد.

## خرابی و بازیابی

- `conflict`: sync را متوقف کن، هیچ overwrite نکن و diff را بررسی کن؛
- `429/529`: اجرای دوباره را طبق Retry-After و سقف retry انجام بده؛
- marker گمشده در صفحهٔ legacy: فقط در صورت برابری checksum و عنوان، صفحه را شناسایی کن؛ سپس با اجرای مجاز بعدی marker را اضافه کن؛
- Page اشتباه: archive یا delete مستقیم انجام نده؛ ابتدا mapping و تصمیم مالک را بررسی کن؛
- قطع Notion: feature flag را خاموش کن؛ Git و Product Studio باید سالم بمانند.

## گسترش allowlist

افزودن سند، ارسال به workspace یا فعال‌کردن inbound edit برای همهٔ اسناد با این Runbook خودکار نیست و به classification review، مالک سند، reviewer، scope و مجوز بیرونی جدا نیاز دارد.
