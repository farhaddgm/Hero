# Evidence اجرای Identity و ProjectGrant بک‌آفیس — BO-021 تا BO-030

> Document ID: `HERO-EVIDENCE-BACKOFFICE-IDENTITY-BO-021-030`
> Canonical path: `docs/roadmap/BACKOFFICE-IDENTITY-BO-021-030.md`
> Title: Evidence اجرای Identity و ProjectGrant بک‌آفیس — BO-021 تا BO-030
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.2
> Owner: hero-architecture
> Review cadence: none

> یادداشت تفسیر: این سند وجود پیاده‌سازی و تست داخلی Batch را ثبت می‌کند، نه بسته‌شدن کامل UI و runtime Exit Gate. وضعیت جاری در `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911` مقدم است.

## دامنه

این سند گام‌های `BO-021..BO-030` را با مجوز `BATCH-BACKOFFICE-20260910-003` ثبت می‌کند. Global Stop در زمان اجرا `false` بوده است. Pilot، Production، Secret operation، هزینهٔ بیرونی، حذف داده، پیام بیرونی و Notion write در Scope این بسته نیستند.

## خروجی‌ها

| گام | خروجی |
|---|---|
| BO-021 | Permission Matrix سه نقش ثابت و deny-by-default |
| BO-022 | User و ProjectGrant در Domain و migration append-only |
| BO-023 | middleware مشترک Query/Command برای project scope |
| BO-024 | keyهای scopeشده برای cache/storage/queue/event و persistence project grant |
| BO-025 | email/password و MFA برای Owner/Admin |
| BO-026 | session expiry، revoke، login rate limit و Audit persistence boundary |
| BO-027 | API Owner-only برای user و grant |
| BO-028 | Owner recovery با email code + offline code/console fallback |
| BO-029 | step-up MFA و cooldown پس از recovery برای عملیات حساس |
| BO-030 | تست سه Role، IDOR/cross-project، MFA، recovery و stale persistence |

## تکمیل توسعهٔ WP-02 در ۲۰۲۶-۰۹-۱۱

- افزوده‌شده: hydration امن User، ProjectGrant و session revocation از PostgreSQL در startup؛ کاربر Admin بدون Secret خام MFA هرگز با مقدار حدسی فعال نمی‌شود و fail-closed باقی می‌ماند؛
- افزوده‌شده: persistence و audit boundary برای user، grant و revocation؛ password hash/salt فقط در مسیر داخلی persistence می‌ماند و Secret MFA فقط به‌صورت reference ثبت می‌شود؛
- افزوده‌شده: صفحهٔ محافظت‌شدهٔ `/identity` با login، MFA، فهرست کاربران، ایجاد Viewer، ثبت/مشاهده/ابطال ProjectGrant و logout؛ نشست مرورگر فقط در `sessionStorage` نگهداری می‌شود؛
- افزوده‌شده: checkerهای marker-based و تست‌های route، hydration، redaction و Store؛
- محدودیت آگاهانه: enrollment/rotation واقعی MFA برای Member/Admin، تحویل ایمیل recovery و آزمون browser/runtime سه‌نقشی هنوز جداگانه باز هستند.

## وضعیت آزمون

در `2026-09-11`، زنجیرهٔ کامل `check` در Linux container مرجع اجرا شد:

- Back Office baseline، foundation و identity checker: `PASS`؛
- Documentation: `124 documents`، `2 products` و `0 errors`؛
- Build: `225 modules` و `33 JSON files`؛
- Tests: `311 passed`، `0 failed` و `0 skipped`؛
- Clean-room scan: `414 files`؛
- هیچ Pilot، Production، Secret reveal/change، external spend/message یا Notion write اجرا نشد.

image مرجع باینری `pnpm` ندارد؛ بنابراین همان زنجیرهٔ تعریف‌شده در `package.json` با `npm check` اجرا شده است.
