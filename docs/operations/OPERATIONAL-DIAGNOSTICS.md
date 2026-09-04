# تشخیص سلامت عملیاتی Hero

## هدف

این قابلیت یک گزارش فقط‌خواندنی برای وضعیت Projectionهای Hero می‌سازد. گزارش به‌منظور پیدا کردن خرابی قبل از Test یا Pilot است؛ خودش هیچ Provider، Runner، تخصیص تیم، مجوز، Secret، DNS، Caddy یا Production را تغییر نمی‌دهد.

## خروجی‌های گزارش

1. پوشش ۱۱ Projection: ده Registry دامنه به‌همراه `control-dashboard`؛
2. سلامت Snapshot و schema نسخه‌دار؛
3. سلامت Eventها: شناسهٔ تکراری، نوع ناشناخته، نسخهٔ ناقص و خطای ترتیب هر Aggregate؛
4. `replay-check`: بارگذاری آزمایشی Eventها در Event Log حافظه، بدون نوشتن بیرونی؛
5. Digest `sha256` برای مقایسهٔ قابل‌تکرار Snapshot و Event؛
6. تاریخچهٔ امن تغییرات Provider/Model/Profile/Binding/Policy، بدون Credential و خروجی خام؛
7. تازگی دانش تیم: منبع، نسخهٔ منبع و محدودهٔ اعتبار به‌صورت metadata؛
8. تعارض تخصیص: یک Task فعال که هم‌زمان به چند تیم داده شده باشد؛
9. بررسی ظرفیت و resource claimهای ثبت‌شده در Planner، شامل سقف هم‌زمانی تیم و هم‌پوشانی زمانی منابع؛ این بخش فقط read-only است.
10. پوشش مسیر Projection هر Domain Event؛ رویدادهای state به Registry مربوط می‌روند و رویدادهای عمومی حداقل در timeline امن `control-dashboard` ثبت می‌شوند؛
11. مقایسهٔ event-driven متادیتای Control Dashboard با Snapshot و تشخیص ناسازگاری Hydration قبل از پذیرش وضعیت.

## استفاده

پس از احراز هویت مالک، مسیر زیر را بخوانید:

```text
GET /api/operations/diagnostics
```

مقدار `status=healthy` فقط سلامت ساختاری Projection را نشان می‌دهد و به معنی آماده‌بودن Provider واقعی، Test عملیاتی، Pilot یا Production نیست. اگر `assignmentConflicts.capacityModel` برابر `not-configured` باشد، یعنی Diagnostic برای این read model ظرفیت عددی را محاسبه نمی‌کند؛ مدل ظرفیت عددی و تعارض resource claim در Planner به‌صورت جداگانه ارزیابی می‌شود. این گزارش فقط تعارض قطعی Task را می‌گیرد.

## تصمیم طراحی و معیار بنچ‌مارک

- تشخیص داخل Domain و مستقل از PostgreSQL است تا در CI و محیط Test تکرارپذیر بماند؛
- بررسی replay با Event Log موجود انجام می‌شود و منبع حقیقت دوم نمی‌سازد؛
- ظرفیت از `Planner.capacitySnapshot()` به‌صورت metadata محدود خوانده می‌شود و هیچ تخصیص جدیدی انجام نمی‌دهد؛
- خروجی API metadata-only است و از الگوی observability امن موجود استفاده می‌کند؛
- هیچ اصلاح خودکاری انجام نمی‌شود، چون تشخیص خطا نباید اختیار mutation یا authorization بگیرد.
- `controlCommandProjection` فقط وضعیت امن request، اختیار کامل و Global Stop را از فرمان‌های append-only بازسازی می‌کند؛ متن درخواست و payload خصوصی عمداً وارد آن نمی‌شود.

این قابلیت جایگزین `check:pilot` نیست. گیت‌های Provider زنده، Secret، recovery مقصد، درخواست واقعی Pilot و Production همچنان جداگانه مسدود/مجوزدار هستند.
