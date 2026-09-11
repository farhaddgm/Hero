# بستهٔ ۲۰ گام بعدی Hero — Project Workspace و Settings

> Document ID: `HERO-ROADMAP-NEXT-20-STEPS-20260911-WORKSPACE-PERSISTENCE`
> Version: `1.0.0`
> Status: `active`
> Scope: `hero`
> Owner: `hero-architecture`
> Review cadence: `per-change`

این بسته، گام‌های BO-031 تا BO-050 را در یک برش ایزولهٔ قابل‌آزمون توسعه می‌دهد. Provider واقعی، Secret، هزینه، Production، DNS، Notion write و اجرای پایلوت در این بسته وجود ندارد.

## خروجی مورد انتظار

Project Workspace باید پس از restart از PostgreSQL بازسازی شود؛ هیچ محتوای فایل، credential یا Secret در JSONهای PostgreSQL ذخیره نمی‌شود. Product Studio باید وضعیت project-scoped را از API واقعی نمایش دهد و هر mutation با نسخه، actor و reason ثبت شود.

## بیست گام اجرایی

| گام | خروجی | وضعیت فعلی |
|---:|---|---|
| BO-031 | قرارداد lifecycle و شناسهٔ پایدار پروژه | پیاده‌سازی محلی |
| BO-032 | ثبت append-only نسخه‌های Project Registry | پیاده‌سازی محلی |
| BO-033 | خواندن آخرین نسخهٔ پروژه از PostgreSQL | پیاده‌سازی محلی |
| BO-034 | hydration پروژه در startup | پیاده‌سازی محلی |
| BO-035 | ثبت امن intake و حذف فیلدهای حساس | پیاده‌سازی محلی |
| BO-036 | ثبت metadata ورودی بدون محتوای فایل | پیاده‌سازی محلی |
| BO-037 | بازسازی metadata ورودی پس از restart | پیاده‌سازی محلی |
| BO-038 | ثبت append-only نسخه‌های Foundation Proposal | پیاده‌سازی محلی |
| BO-039 | revise و approve نسخه‌دار Foundation | پیاده‌سازی محلی |
| BO-040 | اعمال Policy Pack پس از تأیید Foundation | پیاده‌سازی محلی |
| BO-041 | ثبت versioned settings با provenance | پیاده‌سازی محلی |
| BO-042 | hydration تنظیمات و حفظ version تاریخی | پیاده‌سازی محلی |
| BO-043 | ثبت actor، reason، impact و rollback reference | پیاده‌سازی محلی |
| BO-044 | persistence تنظیمات project override | پیاده‌سازی محلی |
| BO-045 | persistence تنظیمات run override با scope اجباری | پیاده‌سازی محلی |
| BO-046 | persistence نسخه‌های rollback بدون حذف تاریخچه | پیاده‌سازی محلی |
| BO-047 | ثبت read-only GitHub import plan | پیاده‌سازی محلی |
| BO-048 | persistence برنامهٔ import با ممنوعیت commit/deploy | پیاده‌سازی محلی |
| BO-049 | نمایش intake، Foundation، input و settings در Product Studio | پیاده‌سازی محلی |
| BO-050 | تست startup hydration، API و حذف محتوای حساس از read model | پیاده‌سازی محلی؛ runtime Test باز است |

## شواهد محلی

- `packages/domain/src/project-workspace.mjs`
- `packages/domain/src/project-settings.mjs`
- `packages/adapters/src/postgresql-project-workspace-store.mjs`
- `apps/control-plane/src/server.mjs`
- `apps/control-plane/src/product-studio-view.mjs`
- `tests/project-workspace-and-settings.test.mjs`
- `tests/postgresql-project-workspace-store.test.mjs`

## تعریف وضعیت

«پیاده‌سازی محلی» یعنی قرارداد، کد و تست در Linux reference container موفق است. این عبارت هنوز به معنی تأیید runtime Test، private object storage واقعی، parser sandbox، malware scanner واقعی یا browser acceptance نیست. برای بستن گیت نهایی، همین Artifact باید در Test اجرا و با PostgreSQL واقعی smoke شود.
