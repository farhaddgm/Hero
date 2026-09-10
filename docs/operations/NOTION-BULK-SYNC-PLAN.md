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

Catalog فعلی ۱۰۵ سند دارد. بر اساس policy فعلی و classification پیش‌فرض امن `internal`، هر ۱۰۵ سند از نظر نمایش قابلیت mirror دارند؛ یک سند هم‌اکنون در Notion همگام است و ۱۰۴ سند باقی مانده‌اند.

## ترتیب اجرا

1. ساخت و بررسی Workspace Blueprint؛
2. ثبت mapping پایدار در PostgreSQL؛
3. اجرای batch شمارهٔ ۱ با ۱۰ سند کم‌ریسک؛
4. بررسی checksum، duplicate، rate-limit و conflict؛
5. ادامهٔ batchها فقط پس از موفقیت batch قبلی؛
6. ثبت Evidence و owner review پس از batch یازدهم.

## زمان‌بندی واقعی

ارسال فنی همهٔ اسناد یک عملیات ۱۱ batch است، اما تاریخ اجرا تا قبل از سه گیت تعیین نمی‌شود: تأیید طبقه‌بندی داخلی، تأیید ساختار Workspace، و فعال‌سازی جداگانهٔ bulk external-write در Test. با تکمیل این گیت‌ها، اجرا می‌تواند در همان نوبت عملیاتی به‌صورت مرحله‌ای انجام شود؛ زمان دقیق به rate limit و نتیجهٔ هر batch وابسته است.

## مرز ویرایش

قرارگرفتن همهٔ اسناد در Notion به معنی قابل‌ویرایش‌بودن همهٔ آن‌ها نیست. شمارش دقیق edit class باید با `pnpm notion:plan:batch` خوانده شود؛ وضعیت رسمی، Evidence و Authorization فقط خواندنی باقی می‌مانند.
