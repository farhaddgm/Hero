# سیاست اختیار و توقف

## تأیید موردی

در حالت عادی هر گام به سند مصوب، نسخه‌ی منطبق، پیش‌نیاز آماده و Auth فعال نیاز دارد. نبود هرکدام یعنی توقف.

## اختیار کامل Snapshot‌شده

Snapshot به‌جای کلید باز، فهرست ثابتی از گام‌ها و نسخه‌هاست. اضافه‌شدن گام یا نسخه‌ی خارج Snapshot به‌طور خودکار مجاز نمی‌شود.

Snapshot جاری:

- شناسه: BATCH-ROADMAP-20260814-001
- دامنه: HERO-001 تا HERO-021
- نسخه هدف: v1.0
- عملیات: طراحی تا commit و تست
- اعتبار: تا دستور لغو مالک

Snapshot بستهٔ مبنای Back Office:

- شناسه: `BATCH-BACKOFFICE-20260910-001`
- دامنه: `BO-001` تا `BO-010`
- اسناد هدف: `HERO-SPEC-022` و `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1` نسخهٔ `1.0.0`
- عملیات: طراحی، سند، نسخه، توسعه، تست و بازبینی
- Global Stop در زمان Grant: خاموش
- اعتبار: تا دستور لغو مالک
- خارج از اختیار: پایلوت، Production، حذف داده، هزینهٔ بیرونی، Secret، پیام بیرونی، Notion write و عملیات برگشت‌ناپذیر

Snapshot اجرای زیرساخت داده و رویداد Back Office:

- شناسه: `BATCH-BACKOFFICE-20260910-002`
- دامنه: `BO-011` تا `BO-020`
- اسناد هدف: `HERO-SPEC-022` و `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1` نسخهٔ `1.0.0`
- عملیات: طراحی، سند، نسخه، توسعه، تست و بازبینی
- Global Stop در زمان Grant: خاموش
- اعتبار: تا دستور لغو مالک
- خارج از اختیار: پایلوت، Production، حذف داده، هزینهٔ بیرونی، Secret، پیام بیرونی، Notion write و عملیات برگشت‌ناپذیر

Snapshot اجرای Identity و ProjectGrant بک‌آفیس:

- شناسه: `BATCH-BACKOFFICE-20260910-003`
- دامنه: `BO-021` تا `BO-030`
- اسناد هدف: `HERO-SPEC-022` و `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1` نسخهٔ `1.0.0`
- عملیات: طراحی، سند، نسخه، توسعه، تست و بازبینی
- Global Stop در زمان Grant: خاموش
- اعتبار: تا دستور لغو مالک
- خارج از اختیار: پایلوت، Production، حذف داده، هزینهٔ بیرونی، Secret، پیام بیرونی، Notion write و عملیات برگشت‌ناپذیر

Snapshotهای Project Workspace، Settings و Portfolio بک‌آفیس:

- شناسه‌ها: `BATCH-BACKOFFICE-20260910-004`، `BATCH-BACKOFFICE-20260910-005` و `BATCH-BACKOFFICE-20260910-006`
- دامنه: `BO-031` تا `BO-060`، در سه بستهٔ ده‌گامی
- اسناد هدف: `HERO-SPEC-022` و `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1` نسخهٔ `1.0.0`
- عملیات: طراحی، سند، نسخه، توسعه، تست و بازبینی
- Global Stop در زمان Grant: خاموش
- خارج از اختیار: پایلوت، Production، حذف داده، هزینهٔ بیرونی، Secret، پیام بیرونی، Notion write، fetch خارجی/GitHub و عملیات برگشت‌ناپذیر

Snapshotهای Collaboration، Command Center و System Catalog بک‌آفیس:

- شناسه‌ها: `BATCH-BACKOFFICE-20260910-007`، `008` و `009`
- دامنه: `BO-061` تا `BO-090`
- عملیات: طراحی، سند، نسخه، توسعه، تست و بازبینی؛ Global Stop خاموش
- خارج از اختیار: Provider/dispatch بیرونی، پایلوت، Production، حذف، Secret، هزینه، پیام بیرونی، Notion write و عملیات برگشت‌ناپذیر

Snapshotهای Catalog، Intelligence و Inbox بک‌آفیس:

- شناسه‌ها: `BATCH-BACKOFFICE-20260910-010`، `011` و `012`
- دامنه: `BO-091` تا `BO-120`؛ Global Stop خاموش
- عملیات: طراحی، سند، نسخه، توسعه، تست و بازبینی
- خارج از اختیار: GitHub/Provider call، هزینه یا پیام بیرونی، Pilot، Test/Production deploy، Secret، حذف و Notion write

Snapshotهای Environment، Delivery، Hardening و Final Readiness بک‌آفیس:

- شناسه‌ها: `BATCH-BACKOFFICE-20260910-013` تا `017`
- دامنه: `BO-121` تا `BO-170`؛ Global Stop خاموش
- عملیات: طراحی، سند، نسخه، توسعه، تست و بازبینی
- خارج از اختیار: اتصال یا write خارجی/GitHub، Server bootstrap، Production deploy، Pilot execution، Secret mutation/reveal، حذف داده، هزینه و پیام بیرونی، Notion write و عملیات برگشت‌ناپذیر

## عملیات حساس

Production، هزینه‌کرد، حذف داده، تغییر Secret، پیام خارجی و عملیات برگشت‌ناپذیر هیچ‌گاه از اختیار توسعه ارث نمی‌برند.

## لغو و توقف

با دستور توقف مالک، Dispatch جدید فوراً ممنوع می‌شود. Run جاری فقط تا نخستین Checkpoint امن ادامه می‌یابد و سپس Pause می‌شود. عملیات اتمیک نیمه‌کاره رها نمی‌شود.

## پیاده‌سازی HERO-007

موتور Authorization فقط با تطبیق دقیق شناسهٔ مجوز، Step ID، نسخهٔ سند و Operation توسعه Dispatch را مجاز می‌کند. مجوز direct یک زوج Step/نسخه و Snapshot یک فهرست ثابت از همان زوج‌ها را نگه می‌دارد؛ تغییر سند یا افزودن گام هرگز مجوز قبلی را گسترش نمی‌دهد.

Grant، revoke، Global Stop و تصمیم Dispatch در Event Log append-only ثبت می‌شوند. فقط `project-owner` می‌تواند مجوز یا Global Stop را تغییر دهد. Global Stop Dispatch جدید را رد و نیاز به checkpoint امن را اعلام می‌کند؛ اتصال آن به Runner در گام اجرای ایزوله می‌آید.
