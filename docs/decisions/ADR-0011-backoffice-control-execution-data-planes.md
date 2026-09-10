# ADR-0011 — مرز Control Plane، Execution Plane و Data Plane در Back Office

> Document ID: `HERO-ADR-0011`
> Canonical path: `docs/decisions/ADR-0011-backoffice-control-execution-data-planes.md`
> Title: ADR-0011 — مرز Control Plane، Execution Plane و Data Plane در Back Office
> Type: decision
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## زمینه

Back Office باید چند پروژه، چند نقش و چند محیط را هم‌زمان مدیریت کند، بدون آن‌که وضعیت مدیریتی با اجرای واقعی یا دادهٔ محصول قاطی شود. Specification `HERO-SPEC-022@1.0.0` همچنین Event، Command/Query، project scope، version و rebuild read model را الزام می‌کند.

## تصمیم

Hero سه صفحهٔ معماری دارد:

1. **Control Plane:** هویت، Project Grant، Policy، Command Intent، Approval، Workflow metadata، Catalog، Conversation، Evaluation و Delivery metadata را مدیریت می‌کند. این صفحه تصمیم می‌گیرد چه چیزی مجاز است؛ خودش به‌تنهایی به Secret یا دادهٔ واقعی Production دسترسی ندارد.
2. **Execution Plane:** Runner، Node Agent، Provider invocation، build/test، migration و deployment را در محیط scopeشده اجرا می‌کند. اجرای Production و عملیات حساس gate مستقل دارند.
3. **Data Plane:** دادهٔ پروژه، database، file storage، telemetry و runtime state را نگه می‌دارد. دادهٔ Production پیش‌فرض به Control/AI منتقل نمی‌شود و دسترسی محتوایی break-glass جدا لازم دارد.

Contextهای Control Plane عبارت‌اند از Portfolio، Project، Identity، Policy، Conversation، Workflow، Catalog، Evaluation، Infrastructure و Delivery. همهٔ ارتباطات بین صفحه‌ها با Command/Event قرارداددار، `project_id`، `correlation_id` و `idempotency_key` انجام می‌شود.

## قواعد غیرقابل‌تضعیف

- Event Envelope نسخه‌دار و append-only است؛ mutation تاریخچه با نسخهٔ جدید یا supersede انجام می‌شود.
- شناسه‌های `project_id`، `user_id`، `command_id`، `run_id`، `artifact_id` و `correlation_id` پایدار و مستقل از UI هستند.
- Outbox پس از commit و Inbox با digest/idempotency از ارسال یا مصرف دوباره جلوگیری می‌کند.
- Read Modelهای Portfolio و Project Overview از Event/Canonical input به‌صورت قطعی rebuild می‌شوند؛ digest خروجی باید در بازسازی یکسان بماند.
- Secret فقط reference است؛ payload، log، Event، Read Model و export محل Secret نیستند.
- هر جدول جدید migration شماره‌دار، append-only guard و مسیر rollback عملیاتی دارد؛ migration داده را حذف نمی‌کند.

## گزینه‌های ردشده

- **یک دیتابیس و مدل واحد بدون مرز:** به cross-project leakage و coupling اجرای واقعی با مدیریت منجر می‌شود.
- **UI به‌عنوان منبع حقیقت:** امکان بازسازی، API مستقل و audit قابل اتکا را از بین می‌برد.
- **Read Model غیرقابل‌بازسازی:** پس از خرابی projection یا تغییر نسخه، وضعیت Portfolio قابل اعتماد نمی‌ماند.

## پیامد و مسیر بازگشت

این مرزبندی اجازه می‌دهد UI، API، Worker و Adapter مستقل تکامل پیدا کنند و دو پروژه بدون تداخل replay شوند. هزینهٔ آن نگهداری قرارداد، migration و projection است. بازگشت فقط با ثبت ADR نسخهٔ جدید، توقف consumer مربوط و rebuild از Event Store انجام می‌شود؛ حذف تاریخچه یا تغییر بی‌ردپای schema مجاز نیست.

## شواهد و بازبینی

قرارداد ماشینی در `packages/contracts/src/backoffice-foundation.mjs`، Event/Inbox در `packages/domain/src/backoffice-event-envelope.mjs`، read model در `packages/domain/src/backoffice-read-models.mjs` و migration `009_backoffice_data_foundation.sql` این تصمیم را اجرا می‌کنند. این ADR هیچ مجوز Production، Pilot، Secret یا Notion write ایجاد نمی‌کند.
