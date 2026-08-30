# تغییرات رودمپ شرکت

## 2026-08-30 — بازنگری مدل عملیاتی تیم‌ها

- منبع نیاز: شیت «مدل عملیاتی شرکت چندایجنتی نرم‌افزاری» با ۱۱ تیم، فلو اجرایی و مالکیت ابزارها.
- تغییر: Hero از مدل صرفاً Task/Provider به مدل «Team به‌عنوان واحد عملیاتیِ قابل‌کنترل» گسترش یافت.
- افزوده‌شده: قرارداد ماشینی ۱۱ تیم، وضعیت آموزش، گیت آمادگی، کنترل ورودی/خروجی، بازکاری، تخصیص پروژه، خودکارسازی مرحله‌ای و ادغام/تفکیک با سابقهٔ retired.
- افزوده‌شده: `TeamRegistry` deterministic، Eventهای تیم، API مشاهده/بررسی و نمایش اولیه در اتاق کنترل.
- افزوده‌شده: ADR-0007، مدل دادهٔ تیم، سند معماری عملیاتی و رودمپ ۲.۰.
- تکمیل بعدی: Planner اکنون برای همهٔ Taskها مالک تیم، همکاران، مرحله و approval mode را به‌صورت نسخه‌دار پیشنهاد می‌کند و پوشش ۱۱ تیم را کنترل می‌کند.
- وضعیت شواهد: تست قرارداد و Registry اضافه شد؛ آخرین `pnpm check` با 143/143 تست موفق، Doctor بدون هشدار، Governance موفق و Build موفق اجرا شد.
- مرز: این تغییر اتصال Provider زنده، PostgreSQL، Deploy، Secret، هزینه، پیام خارجی یا عملیات برگشت‌ناپذیر ایجاد نمی‌کند.
- گام بعد: تکمیل آموزش/benchmark، اتصال تیم به Planner و Task Graph، سپس اجرای واقعی فقط بعد از HERO-020 و گیت‌های HERO-021.

## 2026-08-30 — اصول حیاتی و فلو test تا production

- افزوده‌شده: `CriticalPrinciplesRegistry` برای اصول پایهٔ Hero و اصول اختصاصی محصولات؛
- افزوده‌شده: تأیید/رد/بازکاری owner-gated و ارزیابی blocking در control pointهای فلو؛
- افزوده‌شده: `ReleasePromotion` برای اتصال دقیق Git commit/tag، Artifact، نسخه و دو محیط test/production؛
- افزوده‌شده: گیت تست واقعی، تأیید مالک، فرمان صریح production و مجوز مستقل `production-deploy`؛
- مستندشده: نقش مکمل GitHub، Notion و Hero در [RELEASE_FLOW.md](../architecture/RELEASE_FLOW.md)؛
- مرز: Deployment Adapter زنده، PostgreSQL عملیاتی، GitHub Environment واقعی و عملیات production در این تغییر فعال نشده‌اند.

## 2026-08-30 — مرز persistence، احراز هویت مالک و محیط test

- افزوده‌شده: قرارداد و تست احراز هویت مالک با signed bearer session، secret زمان اجرا و رفتار fail-closed؛
- افزوده‌شده: migration اولیهٔ PostgreSQL برای Project، Event، Principle، Release، Evidence و Outbox با guardهای append-only؛
- افزوده‌شده: Runner migration تزریق‌پذیر با تراکنش `BEGIN`/`COMMIT` و rollback؛
- افزوده‌شده: Event Store PostgreSQL برای append/read، قفل aggregate و درج Outbox در همان تراکنش؛
- افزوده‌شده: Runtime اختیاری PostgreSQL با pool محدود، migration در startup، ping/readiness و profile جداگانهٔ Compose برای `hero-postgres`؛
- افزوده‌شده: workflow دستی محیط test برای `pnpm check`، ساخت image و ثبت شناسهٔ version/commit/Artifact؛
- مرز: PostgreSQL واقعی، session revocation، Deployment Adapter و Environment production هنوز فعال نشده‌اند.
