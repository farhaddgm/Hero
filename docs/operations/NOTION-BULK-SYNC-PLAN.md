# برنامهٔ همگام‌سازی انبوه Notion

> Document ID: `HERO-OPS-NOTION-BULK-SYNC-PLAN`
> Canonical path: `docs/operations/NOTION-BULK-SYNC-PLAN.md`
> Title: برنامهٔ همگام‌سازی انبوه Notion
> Type: operation
> Scope: cross-project
> Status: proposed
> Version: 1.0.0
> Owner: project-owner
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## وضعیت فعلی

Catalog فعلی ۱۲۴ سند دارد. بر اساس default امن `internal`، هر ۱۲۴ سند از نظر فنی قابلیت mirror دارند؛ برای هر ۱۲۴ سند Page و mapping پایدار وجود دارد. راستی‌آزمایی مستقل Markdown API نشان داد ۱۰۴ مورد با checksum معنایی فعلی `in-sync` هستند و ۲۰ مورد به‌دلیل اختلاف source/Notion در وضعیت `conflict` نگه داشته شده‌اند؛ هیچ‌کدام overwrite نشده‌اند. classification review روی snapshot فعلی انجام شد و ممیزی خودکار هیچ مورد Secret، PII یا endpoint زنده پیدا نکرد؛ این review به checksum همین snapshot مقید است. Blueprint شش‌بخشی و ۱۱ Database نیز در Notion ساخته و verify شده‌اند. PostgreSQL Test اکنون migrationهای `001` تا `014` و جدول mapping را دارد. gate نوشتن بسته است.

## ترتیب اجرا

1. ثبت نتیجهٔ classification review برای snapshot جاری؛ انجام شد؛
2. ساخت و بررسی Workspace Blueprint؛ انجام شد؛
3. ثبت mapping پایدار در PostgreSQL؛ انجام شد؛
4. اجرای batch شمارهٔ ۱ با ۱۰ سند کم‌ریسک؛ انجام شد: ۹ synced، یک مورد already-in-sync؛
5. بررسی checksum، duplicate، rate-limit و conflict؛ انجام شد؛
6. اجرای batchهای ۲ تا ۱۳ با approval جدا؛ انجام شد و برای هر ۱۱۴ سند Page و mapping ساخته شد؛
7. راستی‌آزمایی مستقل GET Markdown و ثبت وضعیت mapping؛ انجام شد: ۱۰۴ `in-sync` و ۲۰ `conflict`؛
8. بستن gate نوشتن و ثبت Evidence نهایی؛ انجام شد؛ هیچ conflictی overwrite نشد.

## زمان‌بندی واقعی

پوشش Page و mapping همهٔ اسناد در یک عملیات ۱۳ batch انجام شد: batch اول ۱۰ سند و batchهای ۲ تا ۱۳ مجموعاً ۱۱۴ سند را پوشش دادند. پس از GET مستقل و canonicalization سازگار با Notion، وضعیت نهایی ۱۰۴ `in-sync` و ۲۰ `conflict` است. gate در پایان بسته شد؛ تغییرات آینده فقط با snapshot جدید، classification review و approval batch جدید مجاز است.

## گزارش batchها

| بازهٔ batch | تعداد سند | نتیجه |
|---|---:|---|
| ۱ | ۱۰ | Page/mapping ایجاد شد؛ نتیجهٔ اولیه ۹ `synced` و ۱ `already-in-sync` |
| ۲ تا ۱۲ | ۱۱۰ | Page/mapping ایجاد شد؛ نتیجهٔ اولیه ۱۱۰ `synced` |
| ۱۳ | ۴ | Page/mapping ایجاد شد؛ نتیجهٔ اولیه ۴ `synced` |
| جمع | ۱۲۴ | پوشش Page/mapping: ۱۲۴؛ راستی‌آزمایی نهایی: ۱۰۴ `in-sync`، ۲۰ `conflict` |

## وضعیت نهایی و محدودیت

- منبع canonical همچنان Git است و Notion فقط projection کنترل‌شده است.
- هیچ سندی در snapshot فعلی به‌دلیل Secret، PII یا endpoint زنده از sync خارج نشد؛ شمارش heuristic هر سه مورد صفر بود.
- هیچ مجوز bulk دائمی فعال نشد؛ `bulk_write_approved=false` و `batch_write_approved=false` باقی مانده‌اند.
- ۱۲۴ سند در allowlist ثبت شده‌اند، اما allowlist به‌تنهایی مجوز اجرای آینده نیست؛ هر اجرای جدید باید دوباره gate شود.
- طبقه‌بندی edit class حفظ شده است؛ `mirror-only` و `protected-proposal` در Notion به معنی ویرایش آزاد نیستند.
- راستی‌آزمایی خواندن ۱۲۴ Page موفق بود، ۰ خطای خواندن و ۰ Page truncated ثبت شد؛ ۱۱۷ Page marker شناسهٔ سند دارند و ۷ Page legacy بدون marker با mapping شناخته می‌شوند.

## صف conflict برای تصمیم بعدی مالک

این موارد در Git منبع canonical دارند، اما به‌دلیل اختلاف checksum فعلی با projection قبلی بدون overwrite متوقف شده‌اند: `HERO-ARCH-PRODUCT-DEVELOPMENT-KNOWLEDGE-SYSTEM`، `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911`، `HERO-EVIDENCE-BACKOFFICE-FOUNDATION-BO-011-020`، `HERO-EVIDENCE-BACKOFFICE-IDENTITY-BO-021-030`، `HERO-OPS-ACCESS-AUDIT-20260904`، `HERO-OPS-BACKOFFICE-SUBDOMAIN`، `HERO-OPS-DOCUMENTATION-LIBRARY-HANDOFF`، `HERO-OPS-HERO-TEST-ENVIRONMENT`، `HERO-OPS-NOTION-SETUP`، `HERO-OPS-OPERATIONAL-DIAGNOSTICS`، `HERO-OPS-OWNER-ACTIONS-NEXT-20260909`، `HERO-OPS-OWNER-ACTIONS-PENDING-20260904`، `HERO-OPS-OWNER-ACTIONS-SIMPLE`، `HERO-ROADMAP-BASELINE-20260904`، `HERO-ROADMAP-EXECUTION-20260909-100-STEPS`، `HERO-ROADMAP-NEXT-100-STEPS-20260904`، `HERO-ROADMAP-OPEN-50-PRIORITY-20260904`، `HERO-ROADMAP-STATUS-20260911`، `HERO-SPEC-015` و `HERO-SPEC-022`.

## مرز ویرایش

قرارگرفتن همهٔ اسناد در Notion به معنی قابل‌ویرایش‌بودن همهٔ آن‌ها نیست. شمارش دقیق edit class باید با `pnpm notion:plan:batch` خوانده شود؛ وضعیت رسمی، Evidence و Authorization فقط خواندنی باقی می‌مانند.
