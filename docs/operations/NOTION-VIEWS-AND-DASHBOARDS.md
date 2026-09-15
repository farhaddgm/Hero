# Notion Views و Dashboardهای Hero

## هدف

این لایهٔ Notion برای دیدن و مدیریت سریع Product، Roadmap و Execution ساخته شده است. رکوردها و محتوای اسناد از Git و وضعیت عملیاتی Hero می‌آیند؛ Viewها فقط projection قابل‌بازسازی هستند.

## آنچه ساخته می‌شود

سه Dashboard چندمنبعی در صفحات اصلی Notion وجود دارد:

1. `Hero — Executive Dashboard` در `00 — Control Center`: کاتالوگ محصولات، وضعیت رودمپ، Taskهای فعال و سلامت sync.
2. `Hero — Roadmap Dashboard` در `10 — Hero Product`: Board، Calendar، Timeline و نمودار وضعیت رودمپ.
3. `Hero — Delivery Dashboard` در `15 — Execution and Task Management`: Board، Calendar، Timeline و نمودار وضعیت Taskها.

همچنین روی Databaseهای اصلی Viewهای managed ساخته می‌شوند:

- Products: Gallery و نمودار Product Completeness؛
- Initiatives: Board؛
- Roadmap Items: Board، Calendar، Timeline و نمودار وضعیت؛
- Work Items: Board، Calendar و Timeline؛
- Tasks: Board، Calendar، Timeline و نمودار وضعیت؛
- Documents: نمودار تعداد اسناد به تفکیک Type؛
- Sync Health: شمارندهٔ Conflict و تعداد Documents in Sync.

فهرست لینک‌های واقعی Viewها در صفحهٔ `Hero — Views & Dashboards Guide` قرار می‌گیرد.

## تاریخ‌ها

فیلدهای `Start`، `End` و `Due Date` برای برنامه‌ریزی در Work Items و Tasks اضافه شده‌اند. در حال حاضر تاریخ canonical برای رودمپ ثبت نشده است؛ بنابراین تقویم و Timeline ساخته شده‌اند ولی تا تعیین تاریخ معتبر خالی می‌مانند. هیچ تاریخ ساختگی وارد نمی‌شود.

## رفتار sync

- اجرای اولیه: `pnpm notion:setup:views` با approval runtime مربوط به Viewها؛
- اجرای dry-run: `pnpm notion:setup:views:dry-run`؛
- Auto-sync پنج‌دقیقه‌ای رکوردها را refresh می‌کند. Viewها به همان Data Source متصل‌اند و با ورود رکورد جدید خودکار آن را نشان می‌دهند؛ نیازی به ساخت View جدید برای هر سند یا Task نیست؛
- Viewهای دارای پیشوند `Hero —` managed هستند و اجرای بعدی آن‌ها را با `config/product-development/notion-view-plan.json` هم‌راستا می‌کند؛
- Viewهای دیگر حذف، archive یا overwrite نمی‌شوند؛
- تغییرات محتوای canonical از Notion مستقیماً به Git نمی‌رود و همچنان از Change Proposal عبور می‌کند.

## انتخاب View مناسب

| نیاز | View |
| --- | --- |
| وضعیت مرحله‌ای کار | Board |
| برنامهٔ روزانه/ماهانه | Calendar |
| بازه و وابستگی زمانی | Timeline |
| تعداد و توزیع وضعیت‌ها | Chart / Donut |
| مقایسهٔ امتیاز محصولات | Chart / Bar |
| مرور کارت‌محور محصولات | Gallery |
| بررسی فهرست و جزئیات | Table / List |

منبع plan قابل بررسی در `config/product-development/notion-view-plan.json` و مجوز bounded در `config/authorizations/notion-20260911-009.json` است.
