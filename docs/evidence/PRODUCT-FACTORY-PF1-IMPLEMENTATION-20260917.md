# Evidence برش اول کارخانهٔ کنترل‌شدهٔ محصول — PF-1

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF1-20260917`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF1-IMPLEMENTATION-20260917.md`
> Title: Evidence برش اول کارخانهٔ کنترل‌شدهٔ محصول — PF-1
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.4.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## نتیجه

برش PF-1 در source پیاده و در تست محلی و CI تأیید شد. این برش از یک درخواست Owner، Intake معتبر، طبقه‌بندی ریسک، Foundation Proposal نسخه‌دار و طرح اجرای Product Test ایزوله تولید می‌کند و Product Request را با idempotency/fingerprint پایدار ثبت می‌کند. چهار ایراد واقعی در audit مسیر قبلی اصلاح شد: دسترسی نادرست به هدر `Idempotency-Key` در Node، ردشدن policy flag امن `secretWrite`، حذف‌شدن `productRequest.projectId` از read model و ثبت جداگانهٔ Request/Project/Foundation. اکنون سه رکورد اصلی در یک تراکنش PostgreSQL ثبت می‌شوند و خطای میانی rollback می‌شود؛ replay دادهٔ قدیمی نیمه‌ثبت‌شده نیز Foundation گمشده را بدون درج دوبارهٔ Request/Project repair می‌کند. کاندیدای `v1.1.4-rc.8` با workflow موفق ساخته شده، اما به‌علت نیاز به رمز sudo هنوز روی Test promote نشده است. هیچ repository، کانتینر محصول، سرور خارجی، Secret، Provider زنده، هزینهٔ بیرونی، Pilot یا Production ایجاد نشد.

وضعیت Exit Gate خود PF-1 هنوز `open` است؛ قرارداد persistence/replay اکنون در source و mock/API integration test پوشش دارد و migration واقعی روی Test، وجود migration `017` و جدول `product_request_versions` نیز تأیید شده‌اند. rc.6 روی Test promote شد اما restart با خطای hydration مربوط به metadata پروژه وارد crash-loop شد؛ این failure با restore شدن `projectId` در read model و atomic persistence در rc.8 اصلاح شده است. در Test فعلی دو Product Request metadata-only از probe قبلی باقی مانده و Foundation آن‌ها باید با replay پس از promotion repair شود. برای بستن gate، promotion rc.8، smoke پایدار، دو Product Request مستقل با project isolation، replay واقعی، version conflict و negative authorization لازم است. این سند فقط شواهد برش فعلی است و آن Exit Gate را به‌صورت زودهنگام Done اعلام نمی‌کند.

source evidence کاندیدای Test: branch `codex/test-release-reliability-20260916`، commit `790bfe8097236e285fcf9cb8f6699dc62f5e07b4`.

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

## وضعیت candidate و promotion

| بررسی | نتیجه |
|---|---|
| API fix | دسترسی هدر در `apps/control-plane/src/server.mjs` به قرارداد Node HTTP اصلاح شد؛ تست header-only و invalid-body اضافه و targeted `16/16` موفق شد. |
| Full assurance | `pnpm check`: `404 pass / 0 fail`؛ build `265 module / 49 JSON`؛ documentation `140 / 0 error`. |
| Candidate | `v1.1.4-rc.8`، run `35287418094`، commit `790bfe8`، digest `sha256:e87e6063975fdea86d81682f19668a6458209afc3aeaff77cfeb896478d1d8ee`؛ workflow موفق، promotion pending sudo. |
| Existing Test | Test روی rc.6 promote شده اما healthy نیست و crash-loop دارد؛ migration `017` و جدول `product_request_versions` موجودند و دو Product Request metadata-only ثبت شده‌اند. |

## شواهد اجرای Test

| بررسی | نتیجه |
|---|---|
| Release candidate | `v1.1.4-rc.6` از GitHub Actions run `35285907556` با digest `sha256:14c31d1f2fb30bd0771af87459a217a63d1aaf95a1221f3d26b77e7b8fadf307` به Hero Test promote شد؛ rc.8 جایگزین اصلاحی آماده است. |
| Runtime | rc.6 پس از restart با `Product request metadata is invalid` crash-loop شد؛ `/health` و `/ready` تا promotion rc.8 دوباره قابل‌اعتماد نیستند. |
| PostgreSQL schema | migration `017` و جدول `product_request_versions` موجود؛ دو Product Request metadata-only از probe قبلی ثبت شده‌اند و Foundation آن‌ها هنوز باید با replay repair شود. |
| Scope | این evidence شامل فراخوانی زندهٔ OpenAI، external spend، Product Runner یا Product Test محصول نیست. |

## تست و نتیجه

اجرای verify روی source جاری با `pnpm check`:

| بررسی | نتیجه |
|---|---:|
| تست‌های Node | ۴۰۴ pass / ۰ fail |
| Build | ۲۶۵ module / ۴۹ JSON |
| Documentation check | ۱۴۰ document / ۲ product / ۰ error |
| Roadmap audit | PASS؛ ۱۷۰ step، verified=۲۰، remaining=۱۵۰ |
| Back Office coverage | PASS؛ implemented=۵، partial=۷۶، missing=۰ |
| Docker داخل verify image | warning؛ socket در clean-room موجود نیست |

تست‌های افزودهٔ اختصاصی PF-1 شامل طبقه‌بندی محافظه‌کارانهٔ ریسک، رد flag ناشناخته، طرح runtime معتبر، قفل‌بودن همهٔ اثرها، عدم وجود پورت، admission منفی برای host escape/collision/quota، الزام تأیید صریح Owner برای ریسک بالا/بحرانی، replay همسان، رد fingerprint متفاوت، hydration، repair Foundation، تراکنش سه‌مرحله‌ای با rollback، و استفادهٔ HTTP از مرز atomic persistence هستند. تست‌های UI نیز serialization امن Portfolio را تأیید کردند. اجرای targeted این برش `۲۴/۲۴` موفق بود.

## مرز و گام بعدی

این evidence مجوز شروع Product Runner نیست. migration schema در Test تأیید شده، اما restart سالم rc.8 و replay repair هنوز pending است. پس از promotion rc.8، گام بعدی PF-1 اجرای smoke، replay دو رکورد قدیمی برای repair، ثبت دو درخواست مستقل project-scoped، replay همان درخواست، رد fingerprint متفاوت و negative testهای permission/version است؛ سپس PF-2 فقط در Test و با authorization مستقل می‌تواند به طراحی/اجرای نمونهٔ بی‌خطر Product Runner برسد.

Production، Pilot، Secret Store، Secretهای Provider و اپلیکیشن‌های دیگر ParsPack لمس نشدند. GitHub Actions و GHCR فقط برای ساخت/انتقال artifact همین Test استفاده شدند؛ Product Runner، Product Test، external spend و Provider زنده فعال نشدند.
