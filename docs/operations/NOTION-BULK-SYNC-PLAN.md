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

Catalog فعلی ۱۰۵ سند دارد. بر اساس default امن `internal`، هر ۱۰۵ سند از نظر فنی قابلیت mirror دارند؛ یک سند هم‌اکنون در Notion همگام است و ۱۰۴ سند باقی مانده‌اند. classification review مالک انجام شد و ممیزی خودکار هیچ مورد Secret، PII یا endpoint زنده پیدا نکرد؛ این review به checksum همین snapshot مقید است. Blueprint شش‌بخشی و ۱۱ Database نیز در Notion ساخته و verify شده‌اند. بررسی زندهٔ PostgreSQL Test نشان داد فقط migrationهای `001` تا `004` ثبت شده‌اند؛ `005` تا `008`، از جمله mapping Notion، هنوز به‌دلیل خطای احراز هویت PostgreSQL اجرا نشده‌اند.

## ترتیب اجرا

1. ثبت صریح classification برای هر سند کاندید و تأیید نبودن `restricted`؛
2. ساخت و بررسی Workspace Blueprint؛
3. ثبت mapping پایدار در PostgreSQL؛
4. اجرای batch شمارهٔ ۱ با ۱۰ سند کم‌ریسک؛
5. بررسی checksum، duplicate، rate-limit و conflict؛
6. ادامهٔ batchها فقط پس از موفقیت batch قبلی؛
7. ثبت Evidence و owner review پس از batch یازدهم.

## زمان‌بندی واقعی

ارسال فنی همهٔ اسناد یک عملیات ۱۱ batch است، اما تاریخ اجرا تا قبل از سه گیت تعیین نمی‌شود: تأیید طبقه‌بندی داخلی، تأیید ساختار Workspace، و فعال‌سازی جداگانهٔ bulk external-write در Test. با تکمیل این گیت‌ها، اجرا می‌تواند در همان نوبت عملیاتی به‌صورت مرحله‌ای انجام شود؛ زمان دقیق به rate limit و نتیجهٔ هر batch وابسته است.

## مرز ویرایش

قرارگرفتن همهٔ اسناد در Notion به معنی قابل‌ویرایش‌بودن همهٔ آن‌ها نیست. شمارش دقیق edit class باید با `pnpm notion:plan:batch` خوانده شود؛ وضعیت رسمی، Evidence و Authorization فقط خواندنی باقی می‌مانند.
