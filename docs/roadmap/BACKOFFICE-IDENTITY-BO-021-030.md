# Evidence اجرای Identity و ProjectGrant بک‌آفیس — BO-021 تا BO-030

> Document ID: `HERO-EVIDENCE-BACKOFFICE-IDENTITY-BO-021-030`
> Canonical path: `docs/roadmap/BACKOFFICE-IDENTITY-BO-021-030.md`
> Title: Evidence اجرای Identity و ProjectGrant بک‌آفیس — BO-021 تا BO-030
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.4
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
- افزوده‌شده: صفحهٔ محافظت‌شدهٔ `/identity` با login، MFA، فهرست کاربران، ایجاد Viewer، ثبت/مشاهده/ابطال ProjectGrant و logout؛
- افزوده‌شده: checkerهای marker-based و تست‌های route، hydration، redaction و Store؛
- محدودیت آگاهانه: enrollment/rotation واقعی MFA برای Member/Admin، تحویل ایمیل recovery و آزمون browser/runtime سه‌نقشی هنوز جداگانه باز هستند.

## نشست مرورگر شش‌ساعته — ۲۰۲۶-۰۹-۱۳

- بعد از تکمیل MFA، Control Plane نشست انسانی را در cookie میزبان‌محور `__Host-hero-human-session` با `Max-Age=21600`، `Path=/`، `Secure`، `HttpOnly` و `SameSite=Strict` ثبت می‌کند. مقدار نشست دیگر در `sessionStorage` یا `localStorage` رابط نگهداری نمی‌شود.
- این cookie در Refresh سخت و همهٔ تب‌های همان مرورگر و همان دامنهٔ HTTPS Test در دسترس است؛ رابط Identity، Portfolio، Workspace و Walk-Through با `credentials: same-origin` آن را استفاده می‌کنند.
- Basic Auth شبکه‌ای همچنان فقط Gate شبکه است و اگر proxy آن را به API forward کند، cookie انسانی معتبر را مسدود نمی‌کند؛ Basic هرگز نقش یا مجوز پروژه ایجاد نمی‌کند.
- همهٔ mutationهایی که با cookie انسانی انجام می‌شوند علاوه بر `SameSite=Strict`، Origin دقیقاً هم‌میزبان را الزام می‌کنند. logout/revoke، رکورد revoke را ثبت و cookie را با `Max-Age=0` پاک می‌کند.
- Bearer token پاسخ API صرفاً برای ابزارهای کنترل‌شده/سازگار باقی مانده است؛ رابط مرورگر آن را ذخیره یا دوباره ارسال نمی‌کند.

### آزمون این تغییر

- ۲۴ تست متمرکز Identity/UI: `PASS`؛ شامل TTL دقیق ۲۱٬۶۰۰ ثانیه، flags cookie، Refresh، تب دیگر، سازگاری Basic proxy، CSRF origin و logout/revoke؛
- `check-backoffice-identity`: `PASS`؛
- هیچ Secret، Provider، Pilot، Production یا هزینهٔ بیرونی در این آزمون تغییر نکرد.

### Evidence واقعی محیط Test

در `2026-09-13`، پس از preflight موفق Test، فقط `hero-test-control-plane` با image آزموده‌شدهٔ `sha256:c65354b7f29ced0d9720ecba7b19e62cadb6179cda83b9ed69889e20b470909f` بازسازی شد.

- `/health=ok` و `/ready` با `persistence=postgresql`؛
- `/api/identity/status` برابر `configured=true` و `sessionTtlSeconds=21600`؛
- یک ورود واقعی Owner در خود Test، صدور cookie، دو درخواست مستقل با همان cookie، logout/revoke و ردشدن نشست revokeشده را تأیید کرد؛
- `/identity` بدون Basic Auth در local و دامنهٔ عمومی Test هر دو HTTP 401 دادند؛
- `npm run check`: ۳۵۴ تست موفق، صفر شکست؛ Documentation: ۱۳۳ سند و صفر خطا؛ Build: ۲۵۰ module و ۴۶ JSON؛
- Production، Provider، Pilot، هزینهٔ بیرونی، Secret و gateway خارجی تغییر نکردند.

## وضعیت آزمون

در `2026-09-11`، زنجیرهٔ کامل `check` در Linux container مرجع اجرا شد:

- Back Office baseline، foundation و identity checker: `PASS`؛
- Documentation: `124 documents`، `2 products` و `0 errors`؛
- Build: `225 modules` و `33 JSON files`؛
- Tests: `311 passed`، `0 failed` و `0 skipped`؛
- Clean-room scan: `414 files`؛
- هیچ Pilot، Production، Secret reveal/change، external spend/message یا Notion write اجرا نشد.

image مرجع باینری `pnpm` ندارد؛ بنابراین همان زنجیرهٔ تعریف‌شده در `package.json` با `npm check` اجرا شده است.
