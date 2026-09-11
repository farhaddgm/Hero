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

## وضعیت عملیاتی فعلی

آخرین snapshot شامل ۱۲۶ سند واجد شرایط است و mappingهای PostgreSQL برای همهٔ آن‌ها `in-sync` هستند. صف conflict خالی است. حل اختلاف فقط با `pnpm notion:resolve-conflicts` و authorization نسخه‌دار انجام می‌شود. علاوه بر اسناد، `pnpm notion:sync:product-system --execute` projection رودمپ، Work Item، Task و Iteration را به‌روز می‌کند. سرویس `notion-auto-sync` همین عملیات را در حالت watch و با فاصلهٔ پیش‌فرض ۵ دقیقه اجرا می‌کند. gate عمومی bulk و batch عمداً بسته باقی می‌ماند.

## اجرای یک سند

دستور `pnpm notion:sync-first -- --document=HERO-PRODUCT-HERO-BRIEF` فقط برای allowlist فعلی معتبر است. ابزار برای projection جدید marker شناسهٔ سند را اضافه می‌کند، Page دارای marker یا Page legacy دارای checksum برابر را پیدا می‌کند، checksum را مقایسه می‌کند و در حالت برابر هیچ Page جدیدی نمی‌سازد.

## خرابی و بازیابی

- `conflict`: sync را متوقف کن، هیچ overwrite نکن و diff را بررسی کن؛
- اگر authorization حل اختلاف فعال و دقیقاً منطبق با snapshot جاری بود، فقط ابزار حل اختلاف محدود را اجرا کن؛ هر Page بعد از write باید با GET و checksum تأیید شود؛
- `429/529`: اجرای دوباره را طبق Retry-After و سقف retry انجام بده؛
- marker گمشده در صفحهٔ legacy: فقط در صورت برابری checksum و عنوان، صفحه را شناسایی کن؛ سپس با اجرای مجاز بعدی marker را اضافه کن؛
- Page اشتباه: archive یا delete مستقیم انجام نده؛ ابتدا mapping و تصمیم مالک را بررسی کن؛
- قطع Notion: feature flag را خاموش کن؛ Git و Product Studio باید سالم بمانند.

## همگام‌سازی خودکار داخلی

- منبع تغییرات Git است؛ اضافه‌شدن سند یا تغییر رودمپ پس از قرارگرفتن در workspace در چرخهٔ بعدی به Notion projection می‌رسد.
- فقط اسناد `internal` و رکوردهای canonical تعریف‌شده در Catalog/contract ارسال می‌شوند.
- صفحهٔ `Hero Product System — Control Center` و روابط traceability بین Objective، Initiative، Roadmap Item، Work Item، Task و Iteration نیز توسط projection قابل‌بازسازی نگه‌داری می‌شوند.
- اگر صفحه در Notion به‌صورت دستی تغییر کرده باشد، checksum اختلاف را به‌عنوان `conflict` ثبت می‌کند و overwrite خودکار انجام نمی‌دهد.
- خاموش‌کردن فوری: مقدار runtime `HERO_NOTION_PRODUCT_SYSTEM_WRITE_APPROVED` را `false` کن یا سرویس `notion-auto-sync` را متوقف کن؛ Git و Product Studio مستقل باقی می‌مانند.
- این سرویس Viewهای Notion را نمی‌سازد؛ برای دید بهتر، در Databaseهای `Roadmap Items` و `Tasks` از UI خود Notion Viewهای Timeline و Board بساز. فیلدهای اختیاری `Start` و `End` برای Roadmap آماده‌اند، اما تا زمانی که تاریخ canonical در Git ثبت نشود، Timeline عمداً خالی می‌ماند.

## گسترش allowlist

افزودن سند خارج از طبقه‌بندی `internal`، ارسال به workspace یا فعال‌کردن inbound edit برای همهٔ اسناد با این Runbook خودکار نیست و به classification review، مالک سند، reviewer، scope و مجوز بیرونی جدا نیاز دارد.
