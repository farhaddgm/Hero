# برنامهٔ توسعهٔ UI/UX جامع Back Office — v1.0

> Document ID: `HERO-ROADMAP-BACKOFFICE-UI-UX-V1`  
> Version: `1.0.0`  
> Status: `active`  
> Owner: `hero-product`  
> Parent: `HERO-SPEC-023@1.0.0` و `HERO-SPEC-022@1.0.0`  
> Date: `2026-09-11`

## اصل تحویل

این برنامه ظاهر را از قابلیت جدا نمی‌کند. هر گام UI باید route واقعی، data source واقعی، authorization و تست داشته باشد. عبارت «رابط کامل» یعنی همهٔ قابلیت‌ها جای مشخص، status و مسیر بررسی دارند؛ به معنی complete بودن backend تمام قابلیت‌های `partial/gated` نیست.

## ترتیب توسعه و وضعیت

| Gate | گام‌ها | خروجی | وضعیت ۲۰۲۶-۰۹-۱۱ |
|---|---|---|---|
| `UX-G01` | ممیزی Registry و اسناد 001..022، ADR و Roadmap | gap register و مرز Scope | `completed` |
| `UX-G02` | تحقیق Primer، Atlassian، Grafana و Linear | benchmark و design thesis | `completed` |
| `UX-G03` | IA، journeys، token، component/state/security contract | `HERO-SPEC-023` | `completed` |
| `UX-G04` | ساخت Global Shell | Navigation، project propagation، Command palette، Theme، Skip link | `completed; navigation is selection-gated` |
| `UX-G05` | بازطراحی Portfolio | KPI واقعی، کارت پروژه، Search/Filter و drill-down | `completed; Portfolio is the only multi-project surface` |
| `UX-G06` | همگراکردن Surfaceها | Command Center، Studio، Workspace، Operations، Identity و Safe Lab | `completed in source; all work surfaces require a selected project` |
| `UX-G07` | quality automation | syntax، route smoke، project link، a11y contract و secret regression | `completed; browser audit remains partial` |
| `UX-G08` | build و full check | build artifact و suite کامل | `completed: 355/355 tests; Walk-Through 1.4 advisor/layout regression covered` |
| `UX-G09` | Test promotion | immutable image، health/readiness و authenticated smoke | `completed: Test healthy; VPN Draft and every selected-project route smoke-tested` |
| `UX-G10` | Production promotion | همان digest آزموده‌شده با rollback | `gated: separate production authorization` |

## Journeyهای اجباری برای تست

1. پس از ورود انسانی، Owner ابتدا Portfolio را می‌بیند، VPN را انتخاب می‌کند و Project context در Command/Studio/Workspace/Operations حفظ می‌شود.
2. Viewer فقط پروژه‌های Grant‌شده و هیچ mutation control مجازنشده‌ای دریافت نمی‌کند.
3. Admin تنظیم project-scoped را ثبت می‌کند و version/audit نمایش داده می‌شود.
4. Search و lifecycle filter Portfolio empty و populated state را درست نمایش می‌دهند؛ یک پروژهٔ تازه، `Draft` است و تا تأیید Foundation فعال نمی‌شود.
5. Command palette با صفحه‌کلید و pointer کار می‌کند.
6. Light/Dark theme و reduced-motion layout را نمی‌شکنند.
7. Routeهای Back Office پشت Basic Auth و APIها پشت human/project authorization می‌مانند؛ هیچ route کاریِ بدون `projectId` دادهٔ global نمایش نمی‌دهد و به انتخاب‌گر بازمی‌گردد.
8. هیچ Credential، Secret، Token یا محتوای خصوصی در HTML/Report نشت نمی‌کند.

## Definition of Done

- معیارهای `UX-AC-001..013` Evidence دارند؛
- `pnpm check` در محیط مرجع موفق است؛
- Test با image digest ثابت بالا آمده و `/health` و `/ready` موفق‌اند؛
- smoke احراز‌شدهٔ `/portfolio?select=project`، انتخاب VPN، `/portfolio?surface=command&projectId=…`، `/product-studio?projectId=…`، `/workspace?projectId=…`، `/project-control?projectId=…` و `/identity` موفق است؛
- Production بدون مجوز و digest تطبیق‌یافته تغییر نمی‌کند؛
- موارد باقیمانده در Evidence/Status ثبت می‌شوند.

## قرارداد «پروژهٔ فعال»

این قرارداد برای جلوگیری از آمیختن دادهٔ پروژه‌ها، بخشی از تعریف صحیح Back Office است؛ نه صرفاً یک تصمیم رابط.

- `Portfolio` تنها نمای مجاز چندپروژه‌ای است. پس از ورود انسانی، مسیر پیش‌فرض `/portfolio?select=project` است.
- منبع حقیقت Scope در route، پارامتر معتبر `projectId` است. `localStorage` فقط پیوستگی ناوبری مرورگر را فراهم می‌کند و مجوز یا منبع داده نیست.
- `مرکز فرمان`، `استودیوی محصول`، `فضای پروژه` و `عملیات پروژه` بدون `projectId` به Portfolio با مقصد موردنظر redirect می‌شوند؛ صفحهٔ global یا خطای مبهم نمایش نمی‌دهند.
- در Command و Product Studio، snapshot صرفاً از همان Project ساخته می‌شود: Command از کنترل‌های پروژه و Studio از Intake، Foundation، metadata ورودی‌ها و Roadmap همان پروژه. catalog یا roadmap سراسری Hero در این routeها render نمی‌شود.
- هر پروژه در زمان ایجاد `Draft` است. Foundation پیشنهادی ساخته می‌شود، اما تغییر به `active` فقط با تأیید Foundation رخ می‌دهد.
- Owner می‌تواند یک پروژهٔ `active` یا درحال‌بررسی را با دلیلِ ثبت‌شده به `Draft` بازگرداند. این عمل overwrite نیست: نسخهٔ جدید Project و Foundation پیشنهادی جدید ثبت می‌شوند و Foundation تأییدشدهٔ قبلی در تاریخچه باقی می‌ماند.
- آزمون یکپارچه حداقل دو پروژه (VPN و CRM) می‌سازد و اثبات می‌کند response/HTML مربوط به VPN هیچ نام، KPI، roadmap یا داده‌ای از CRM ندارد.

## Backlog محافظت‌شده

این موارد در این تحویل نباید گم یا به‌اشتباه complete اعلام شوند:

- message catalog و ترجمهٔ کامل تمام متن‌های dynamic؛
- browser E2E واقعی روی Desktopهای هدف؛
- axe/Accessibility Insights و آزمون screen reader؛
- role-aware server rendering کامل در همهٔ Surfaceهای قدیمی؛
- server-side pagination و saved viewهای Portfolio در مقیاس بزرگ؛
- Conversation UI کامل، Command Preview و Inbox action drawer؛
- Provider-backed AI conversation برای Walk-Through؛ مشاورهٔ 1.4 عمداً local/deterministic و بدون Provider/Token است تا authorization، budget و Evidence مستقل آن آماده شود؛
- visual regression baseline پس از پایدارشدن دادهٔ Test؛
- Production promotion و post-deploy observation.
