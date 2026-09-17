# Evidence برش اول کارخانهٔ کنترل‌شدهٔ محصول — PF-1

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF1-20260917`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF1-IMPLEMENTATION-20260917.md`
> Title: Evidence برش اول کارخانهٔ کنترل‌شدهٔ محصول — PF-1
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.3.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## نتیجه

برش PF-1 در source پیاده و در تست محلی تأیید شد. این برش از یک درخواست Owner، Intake معتبر، طبقه‌بندی ریسک، Foundation Proposal نسخه‌دار و طرح اجرای Product Test ایزوله تولید می‌کند و Product Request را با idempotency/fingerprint پایدار ثبت می‌کند. باگ واقعی خواندن `Idempotency-Key` از هدر Node HTTP نیز اصلاح و regression test آن اضافه شد. کاندیدای `v1.1.4-rc.5` با workflow موفق ساخته شده، اما به‌علت نیاز به رمز sudo هنوز روی Test promote نشده است. هیچ repository، کانتینر محصول، سرور خارجی، Secret، Provider زنده، هزینهٔ بیرونی، Pilot یا Production ایجاد نشد.

وضعیت Exit Gate خود PF-1 هنوز `open` است؛ قرارداد persistence/replay اکنون در source و mock integration test پوشش دارد و migration/restart واقعی روی Test، وجود migration `017` و جدول `product_request_versions` نیز تأیید شده‌اند. candidate اصلاحی هنوز promote نشده و در زمان ثبت این evidence هیچ رکورد Product Request واقعی در Test وجود ندارد؛ برای بستن آن promotion rc.5، دو Product Request مستقل با project isolation، replay واقعی، version conflict و negative authorization لازم است. این سند فقط شواهد برش فعلی است و آن Exit Gate را به‌صورت زودهنگام Done اعلام نمی‌کند.

source evidence کاندیدای Test: branch `codex/test-release-reliability-20260916`، commit `b7243a018b4145143c2492e494f04597e31a5423`.

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
| Full assurance | `pnpm check`: `400 pass / 0 fail`؛ build `265 module / 49 JSON`؛ documentation `140 / 0 error`. |
| Candidate | `v1.1.4-rc.5`، run `35283381777`، digest `sha256:4e8bb963f6036d3663b7173613a1f47a122de78b77b5dd08d26441125e7c13a8`؛ workflow موفق، promotion pending sudo. |
| Existing Test | Test هنوز روی rc.4 است؛ migration `017` و جدول `product_request_versions` قبلاً تأیید شده‌اند و رکورد Product Request `0` است. |

## شواهد اجرای Test

| بررسی | نتیجه |
|---|---|
| Release candidate | `v1.1.4-rc.4` از GitHub Actions run `35280773195` با digest `sha256:3b3685cb448ee18c1c7e635c70722f5c138cd0d3b4abfe8bb3c234a0e6ac3677` فقط به Hero Test promote شد. |
| Runtime | container کنترل‌پلین `running`؛ `/health` و `/ready` هر دو موفق؛ `Hero Test smoke check: PASS`. |
| PostgreSQL schema | migration `017` و جدول `product_request_versions` موجود؛ این query فقط metadata schema را بررسی کرد و رکوردهای واقعی Product Request `0` بود. |
| Scope | این evidence شامل فراخوانی زندهٔ OpenAI، external spend، Product Runner یا Product Test محصول نیست. |

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

این evidence مجوز شروع Product Runner نیست. migration و restart schema در Test انجام و تأیید شده است. پس از promotion rc.5، گام بعدی PF-1 ثبت دو درخواست مستقل project-scoped از مسیر مجاز Owner، replay همان درخواست، رد fingerprint متفاوت و negative testهای permission/version است؛ سپس PF-2 فقط در Test و با authorization مستقل می‌تواند به طراحی/اجرای نمونهٔ بی‌خطر Product Runner برسد.

Production، Pilot، Secret Store، Secretهای Provider و اپلیکیشن‌های دیگر ParsPack لمس نشدند. GitHub Actions و GHCR فقط برای ساخت/انتقال artifact همین Test استفاده شدند؛ Product Runner، Product Test، external spend و Provider زنده فعال نشدند.
