# Evidence برش اول کارخانهٔ کنترل‌شدهٔ محصول — PF-1

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF1-20260917`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF1-IMPLEMENTATION-20260917.md`
> Title: Evidence برش اول کارخانهٔ کنترل‌شدهٔ محصول — PF-1
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.1.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## نتیجه

برش PF-1 در source پیاده و در تست محلی تأیید شد. این برش از یک درخواست Owner، Intake معتبر، طبقه‌بندی ریسک، Foundation Proposal نسخه‌دار و طرح اجرای Product Test ایزوله تولید می‌کند و Product Request را با idempotency/fingerprint پایدار ثبت می‌کند. هیچ repository، کانتینر، سرور، Secret، Provider زنده، هزینهٔ بیرونی، deploy یا پیام بیرونی ایجاد نشد.

وضعیت Exit Gate خود PF-1 هنوز `open` است؛ قرارداد persistence/replay اکنون در source و mock integration test پوشش دارد، اما برای بستن آن migration/restart واقعی روی Test و دو Product Request مستقل با project isolation، version conflict و negative authorization لازم است. این سند فقط شواهد برش فعلی است و آن Exit Gate را به‌صورت زودهنگام Done اعلام نمی‌کند.

source evidence: branch `codex/test-release-reliability-20260916`، commit `e17b9f79bfec10620067531a62c4bc2a16ee8d31`.

## تغییرات قابل مشاهده

| بخش | نتیجه |
|---|---|
| Intake | `projectType`، سطح ریسک درخواستی، محدودیت‌ها، خروجی‌های مورد انتظار و flagهای ریسک معتبرسازی می‌شوند. |
| Risk classification | سطح `low/standard/high/critical` با حداقل‌سازی سطح ریسک و علت‌های قابل‌نمایش تولید می‌شود؛ نوع ابزار امنیتی یا ترکیب امنیت/اینترنت می‌تواند سطح را بالا ببرد. |
| Foundation | `riskAssessment` و `runtimePlan` در Proposal ذخیره و نسخه‌دار می‌شوند؛ Proposal همچنان قابل revise است. |
| Owner gate | Foundation با ریسک `high/critical` فقط با تأیید صریح Owner پذیرفته می‌شود؛ Admin به‌تنهایی نمی‌تواند این گیت را دور بزند. |
| Product Test plan | مقصد پیش‌فرض Test ایزوله، repository مستقل، Compose/database/volume/network نام‌گذاری‌شدهٔ محصول، network خاموش، پورت خالی، محدودیت منابع، non-root، read-only و no-new-privileges است. |
| Admission policy | پیش از start، host network/host path، resource collision، port collision و عبور از quota رد می‌شود؛ تصمیم admission بدون side effect است. |
| Side effects | همهٔ اثرها در این مرحله `false` هستند: mutation مخزن، start کانتینر، ساخت DB، Secret write، deploy، external spend و پیام بیرونی. |
| UI | Portfolio فیلدهای ضروری Intake و flagهای ریسک را می‌گیرد؛ Product Studio علت ریسک، گیت‌ها، طرح runtime و اثرهای قفل‌شده را به زبان قابل‌فهم نشان می‌دهد. |
| Product Request durability | کلید idempotency از بدنه یا هدر `Idempotency-Key` پذیرفته می‌شود؛ replay همسان پاسخ ۲۰۰، درخواست تازه پاسخ ۲۰۱ و fingerprint متفاوت پاسخ ۴۰۹ می‌گیرد. metadata درخواست و پروژه در PostgreSQL با migration `017` و تراکنش مشترک ثبت می‌شود؛ فرم خام و Secret ذخیره نمی‌شوند. |

## تست و نتیجه

اجرای verify روی source جاری با `pnpm check`:

| بررسی | نتیجه |
|---|---:|
| تست‌های Node | ۴۰۰ pass / ۰ fail |
| Build | ۲۶۵ module / ۴۹ JSON |
| Documentation check | ۱۴۰ document / ۲ product / ۰ error |
| Roadmap audit | PASS؛ ۱۷۰ step، verified=۲۰، remaining=۱۵۰ |
| Back Office coverage | PASS؛ implemented=۵، partial=۷۶، missing=۰ |
| Docker داخل verify image | warning؛ socket در clean-room موجود نیست |

تست‌های افزودهٔ اختصاصی PF-1 شامل طبقه‌بندی محافظه‌کارانهٔ ریسک، رد flag ناشناخته، طرح runtime معتبر، قفل‌بودن همهٔ اثرها، عدم وجود پورت، admission منفی برای host escape/collision/quota، الزام تأیید صریح Owner برای ریسک بالا/بحرانی، replay همسان، رد fingerprint متفاوت، hydration و rollback تراکنش Product Request هستند. تست‌های UI نیز serialization امن Portfolio را تأیید کردند. اجرای targeted این برش `۲۰/۲۰` موفق بود.

## مرز و گام بعدی

این evidence مجوز شروع Product Runner نیست. گام بعدی PF-1 اجرای migration و restart واقعی در Test، ثبت دو درخواست مستقل project-scoped و پوشش نهایی negative testهای permission/version است؛ سپس PF-2 فقط در Test و با authorization مستقل می‌تواند به طراحی/اجرای نمونهٔ بی‌خطر Product Runner برسد.

هیچ تغییر یا لمسی در Production، Pilot، Secret Store، Secretهای Provider، GitHub Actions، GHCR، ParsPack runtime یا اپلیکیشن دیگر انجام نشده است.
