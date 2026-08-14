# HERO-005 v1.0 — مدل داده، قراردادها و Event Log

وضعیت: مصوب برای توسعه و تست در 2026-08-14.

## هدف

Hero باید بتواند بدون از دست‌دادن تاریخچه یا مخلوط‌کردن پروژه‌ها، بداند چه درخواست، تصمیم، مجوز، اجرا، آزمون و خروجی‌ای در هر لحظه وجود دارد. این گام قرارداد داده و Event Log append-only را تعریف و قابل‌آزمون می‌کند؛ اتصال واقعی PostgreSQL در گام Adapter مربوط به داده ادامه می‌یابد.

## حقیقت داده

Event Log حقیقت تغییرات عملیاتی است و هر رویداد پس از ثبت تغییر نمی‌کند. Viewهای سریع مانند وضعیت یک Run یا فهرست تصمیم‌ها از Eventها و جدول‌های عملیاتی ساخته می‌شوند، اما جای Event اصلی را نمی‌گیرند.

هر رویداد این اطلاعات را دارد: شناسهٔ یکتا، نوع Aggregate، شناسهٔ Aggregate، نوع رویداد، زمان ثابت، Actor، Correlation ID، Causation ID، دادهٔ ایمن و نسخهٔ قرارداد. Event بدون زمان یا شناسه، با نوع ناشناخته، با version نامنطبق یا شامل Secret رد می‌شود.

## موجودیت‌ها و رابطه‌ها

```text
Project → Work Item → Task
                    ↘ Authorization
                    ↘ Run → Evidence / Artifact
                    ↘ Decision

هر تغییر مهم → Event Log (append-only)
هر Dispatch معتبر → Outbox در همان تراکنش
```

- Project: محصول یا درخواست مستقل.
- Work Item: خواستهٔ قابل‌تحویل کاربر.
- Task: واحد اجرای وابسته در Task Graph.
- Authorization: Snapshot نسخه‌دار و قابل‌ابطال.
- Run: اجرای ایزوله با worktree/container و checkpoint.
- Evidence و Artifact: نتیجهٔ تست/review و خروجی تحویلی.
- Outbox: درخواست Dispatch پایدار، ثبت‌شده فقط پس از commit داده.

## قواعد ثبت رویداد

1. Log فقط append-only است؛ اصلاح یک خطا با Event جدید انجام می‌شود، نه ویرایش رویداد قبلی.
2. هر Aggregate نسخهٔ ترتیبی دارد. ثبت با نسخهٔ مورد انتظار نامنطبق باید با خطا متوقف شود تا تغییر هم‌زمان گم نشود.
3. Event ID تکراری رد می‌شود؛ sequence سراسری و aggregateVersion فقط پس از ثبت موفق ساخته می‌شوند.
4. کلید یا مقدار Secret، Token، Password و کلید خصوصی در Event و Evidence ممنوع است.
5. Event حساس صرفاً ثبت اقدام نیست؛ اجرای آن همچنان پیش از Dispatch به مجوز مستقل نیاز دارد.
6. Outbox و Event نهایی در یک تراکنش PostgreSQL ثبت می‌شوند تا هیچ Run بدون Evidence اولیه Dispatch نشود.

## جدول‌های هدف PostgreSQL

| جدول | نقش |
| --- | --- |
| projects, work_items, tasks | وضعیت و ارتباط‌های عملیاتی |
| authorizations | Snapshotهای مجوز نسخه‌دار |
| runs | اجرای ایزوله و checkpoint |
| events | Event Log append-only با unique event_id و version Aggregate |
| evidence, artifacts | شواهد تست/review و خروجی‌ها |
| outbox | Dispatch پایدار پس از commit |

در این گام DB، queue خارجی یا Secret واقعی ساخته یا متصل نمی‌شود. قرارداد و Domain Event Log در حافظه، برای آزمون قطعی و آماده‌سازی Adapter PostgreSQL، پیاده‌سازی شده‌اند.

## معیار پذیرش

1. مدل موجودیت‌ها، رابطه‌ها و جدول‌های هدف روشن باشد.
2. Event schema نسخه‌دار، validate‌شونده و بدون Secret باشد.
3. Log append-only، duplicate-safe و دارای optimistic concurrency قابل‌آزمون باشد.
4. مسیر Outbox با PostgreSQL مشخص باشد، بدون افزودن زیرساخت مستقل زودهنگام.
5. قرارداد، ADR، اسناد و `pnpm check` موفق باشند.
