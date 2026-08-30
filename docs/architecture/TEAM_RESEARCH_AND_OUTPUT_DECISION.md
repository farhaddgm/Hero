# تحقیق تیمی و تصمیم خروجی محصول

## هدف

Hero باید بتواند برای هر تیم یک تحقیق شواهد‌محور و benchmark قابل مقایسه سفارش دهد و پیش از شروع تولید، به مالک دربارهٔ بهترین شکل خروجی محصول مشاوره بدهد.

## فلو تحقیق تیم

```text
درخواست مالک
  -> requested
  -> researching
  -> گزارش ساختاریافته و benchmark
  -> report-ready
  -> بررسی مالک
       approved -> افزودن دانش و اصول به تیم -> applied
       rejected -> rejected، بدون تغییر تیم
       rework-requested -> گزارش جدید
```

هر گزارش معتبر باید حداقل سه منبع مستقل، سه یافته، دو مقایسهٔ benchmark و یک توصیه داشته باشد. گزارش، روش، منابع، یافته‌ها، امتیازها، trade-off، دانش پیشنهادی، اصول پیشنهادی و تغییرات آموزشی را جدا نگه می‌دارد.

قرارداد و benchmark اختصاصی هر ۱۱ تیم در `packages/contracts/src/team-research.mjs` و چرخهٔ دامنه در `packages/domain/src/team-research-registry.mjs` قرار دارد.

## فلو تصمیم خروجی محصول

بعد از ساخت Plan و پیش از dispatch، Planner چند شکل خروجی را بر اساس ارزش، سرعت تحویل، هزینه، ریسک، نگهداری، مقیاس‌پذیری و تناسب با کاربر مقایسه می‌کند. گزینه‌ها شامل prototype، web-app، mobile-app، web-and-mobile، api-service، workflow-automation، data-product، research-report و decision-brief هستند.

Planner یک توصیهٔ توضیح‌داده‌شده می‌دهد، اما توصیه تصمیم نهایی نیست:

```text
Plan + output advisory (pending-owner)
  -> approved با گزینهٔ انتخابی -> آماده برای dispatch مشروط به readiness تیم
  -> rejected -> تولید متوقف و نیازمند تصمیم جدید
  -> rework-requested -> مشاورهٔ جدید
```

`POST /api/plans/:planningId/output-decision` تصمیم مالک را ثبت می‌کند. حتی پس از تأیید گزینه، تا آماده‌بودن تیم‌های مالک و مجوز مستقل اجرا، dispatch انجام نمی‌شود.

## API کنترل

- `GET /team-principles`: اصول پیش‌فرض و دانش فعلی همهٔ تیم‌ها؛ مناسب مرور اولیه.
- `POST /api/teams/:teamId/research-requests`: ثبت درخواست تحقیق و benchmark.
- `GET /api/teams/:teamId/research-requests`: فهرست درخواست‌های همان تیم.
- `POST /api/research/:researchId/start`: شروع مرحلهٔ تحقیق بدون فعال‌سازی خودکار Provider بیرونی.
- `POST /api/research/:researchId/report`: ثبت گزارش ساختاریافته.
- `GET /api/research/:researchId`: مشاهدهٔ درخواست و گزارش.
- `POST /api/research/:researchId/review`: تأیید، رد یا درخواست بازکاری توسط مالک.
- `GET /team-research-contract`: قرارداد، benchmarkها و حداقل evidence لازم.
- `GET /output-advisory-contract`: گزینه‌ها، ابعاد ارزیابی و گیت تصمیم مالک.

## مرز فعلی

این گام قرارداد و چرخهٔ کنترل را فعال می‌کند، اما Provider واقعی، جست‌وجوی بیرونی و هزینهٔ تحقیق را خودکار نمی‌کند. گزارش و projection دانش در نسخهٔ فعلی deterministic و در حافظهٔ Control Plane هستند؛ audit فرمان‌ها، در صورت تنظیم PostgreSQL، پایدار ثبت می‌شود. اتصال durable کامل تحقیق، Provider مجاز و خروجی واقعی باید در گیت مستقل بعدی اجرا شود.
