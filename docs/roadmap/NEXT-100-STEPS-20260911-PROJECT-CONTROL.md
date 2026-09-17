# بستهٔ ۱۰۰ گام بعدی Hero — Project Control Room

> Document ID: `HERO-ROADMAP-NEXT-100-STEPS-20260911-PROJECT-CONTROL`
> Version: `1.0.0`
> Status: `superseded`
> Scope: `hero`
> Owner: `hero-architecture`
> Review cadence: `per-change`

## محدوده

این بسته ادامهٔ مستقیم BO-031..050 است و BO-051..150 را به یک برش کاربردیِ قابل‌مشاهده تبدیل می‌کند. Domain، Contract و APIهای این بازه پیش‌تر در source وجود داشته‌اند؛ خروجی این بسته یک نمای پروژه‌ای واحد است که دادهٔ واقعی همان ماژول‌ها را بدون نمایش Secret، متن Conversation/Memory، payload فرمان، credential یا اجرای بیرونی نشان می‌دهد.

Production deploy، Provider واقعی، Secret mutation/reveal، هزینه، پیام بیرونی، GitHub fetch/write، Notion write، حذف داده، recovery روی مقصد خارجی و اجرای Pilot خارج Scope هستند. هر کدام گیت و مجوز مستقل خود را حفظ می‌کند.

> وضعیت تاریخی: این سند evidence برش Project Control Room است؛ sequencing جاری در `HERO-ROADMAP-CONTROLLED-PRODUCT-FACTORY-20260917@1.0.0` و مرجع الزام در `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1@1.2.0` قرار دارد.

## صد گام اجرایی

| بازه | گام‌ها | خروجی source در این بسته | گیت نهایی باقی‌مانده |
|---|---:|---|---|
| Portfolio و Settings | BO-051..060 | Settings/Portfolio/Project Studio به Control Room پروژه deep-link می‌شوند | browser acceptance و persistence کامل stateهای پایین‌دست |
| Collaboration | BO-061..070 | Team assignment، Context/Memory metadata و isolation در نمای واحد دیده می‌شود | persistence Conversation/Memory و مرور role-filter در Test |
| Command Center | BO-071..080 | صف، approval، lock، checkpoint و وضعیت workflow به‌صورت read-only نمایش داده می‌شود | durable execution و crash-recovery واقعی |
| Catalog | BO-081..090 | موجودیت‌های project-scoped Catalog و وضعیت ثبت‌شده نمایش داده می‌شود | acquisition مجاز و rebuild evidence |
| Intelligence | BO-091..100 | Ledger، Budget و Health با metadata امن نمایش داده می‌شود | ingestion واقعی و drill-down Run/Evidence |
| Inbox و Observability | BO-101..110 | Inbox، SLI، audit و trace count بدون محتوای حساس نمایش داده می‌شود | action UI و runtime storm/security evidence |
| Infrastructure | BO-111..120 | repository/server/node/egress و Secret reference-only metadata دیده می‌شود | credential، اتصال واقعی و آزمون امنیتی مجوزدار |
| Delivery | BO-121..130 | release، artifact، bundle، portability و acceptance record-only دیده می‌شود | deploy یا recovery واقعی با مجوز جدا |
| Hardening | BO-131..140 | retention، cleanup dry-run و audit coverage در صفحه دیده می‌شود | load/accessibility/backup evidence runtime |
| Final readiness | BO-141..150 | migration، read-model compare، scenario و readiness/acceptance gate دیده می‌شود | سناریوهای E2E و پذیرش رسمی Owner |

## مسیرهای افزوده‌شده

- `/project-control?projectId=<project-id>` — صفحهٔ read-only و Basic-Auth-protected؛
- `/project-control-data?projectId=<project-id>` — JSON محدود و redacted برای همان پروژه؛
- Product Studio برای هر پروژه لینک مستقیم به همین صفحه دارد.

## کنترل‌های امنیتی

1. صفحه و JSON فقط با Basic Auth Back Office در دسترس هستند؛
2. فقط `GET` مجاز است؛ mutation روی این مسیرها `405` می‌گیرد؛
3. متن private input، متن Conversation/Memory، payload command، مقدار Secret و credential هرگز وارد response نمی‌شوند؛
4. داده‌ها project-scoped هستند؛
5. این صفحه هیچ dispatch، deploy، fetch، Provider call یا Pilot execution انجام نمی‌دهد.

## شواهد source

- `apps/control-plane/src/project-control-room-view.mjs`
- `apps/control-plane/src/server.mjs`
- `apps/control-plane/src/product-studio-view.mjs`
- `tests/project-workspace-and-settings.test.mjs`
- `tools/check-backoffice-workspace.mjs`
- `tools/check-backoffice-collaboration-command.mjs`
- `tools/check-backoffice-final-delivery.mjs`

## تعریف Done

این بسته در source زمانی قابل‌تحویل است که page/data در Test با Basic Auth قابل خواندن باشند، `GET` بدون auth برابر `401` و mutation برابر `405` باشد، و regression test تضمین کند دادهٔ حساس در HTML یا JSON برنمی‌گردد. بستهٔ کامل BO-051..150 فقط زمانی `verified` می‌شود که گیت‌های عملیاتیِ هر ردیف جدول نیز با Evidence واقعی بسته شوند.
