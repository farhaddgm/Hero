# Runbook بک‌آفیس Hero برای Owner، Admin و Viewer

> Document ID: `HERO-OPS-BACKOFFICE-RUNBOOK`
> Canonical path: `docs/operations/BACKOFFICE-RUNBOOK.md`
> Title: Runbook بک‌آفیس Hero برای Owner، Admin و Viewer
> Type: operation
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-operations
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## نقش‌ها

- **Owner:** ایجاد/Archive پروژه، مدیریت کاربران، Reveal با MFA و re-auth، پذیرش نهایی و Proposal پایلوت.
- **Project Admin:** فقط در پروژهٔ تخصیص‌یافته، همهٔ تغییرات پروژه شامل Team/Model/Budget/Server metadata/Policy را انجام می‌دهد؛ کاربر جدید اضافه نمی‌کند.
- **Viewer:** فقط مشاهدهٔ پروژهٔ تخصیص‌یافته.

## گردش کار امن

1. Project را در Portfolio انتخاب کن و Health/Inbox/Token را بررسی کن.
2. هر فرمان را از Command Card با اثر، هزینه، ریسک و Rollback مرور کن.
3. برای Server ابتدا connectivity plan و Node enrollment بساز؛ اتصال واقعی نیازمند مجوز جداست.
4. Secret را فقط به‌شکل `secret-ref` ثبت کن؛ مقدار آن را در گفتگو، سند، log یا API وارد نکن.
5. Delivery Bundle را secret-free نگه دار؛ portability و recovery evidence را قبل از acceptance ثبت کن.
6. Cleanup را ابتدا dry-run و hold اجرا کن. حذف واقعی عملیات حساس جداگانه است.
7. در Readiness Review، gap/risk/limitation/rollback را ثبت کن. Owner باید artifact identity را صریحاً بپذیرد.

## توقف و بازیابی

Global Stop هر Dispatch جدید را متوقف می‌کند. Node revoke و Secret revoke تاریخچه را حذف نمی‌کنند. در mismatch، outage یا نشانهٔ Secret، عملیات را متوقف کن، evidence redacted بساز و فقط از مسیر Approval ادامه بده.
