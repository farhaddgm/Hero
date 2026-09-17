# Evidence برش اول کارخانهٔ کنترل‌شدهٔ محصول — PF-1

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF1-20260917`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF1-IMPLEMENTATION-20260917.md`
> Title: Evidence برش اول کارخانهٔ کنترل‌شدهٔ محصول — PF-1
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## نتیجه

برش اول PF-1 در source پیاده و در تست محلی تأیید شد. این برش از یک درخواست Owner، Intake معتبر، طبقه‌بندی ریسک، Foundation Proposal نسخه‌دار و طرح اجرای Product Test ایزوله تولید می‌کند. هیچ repository، کانتینر، سرور، Secret، Provider زنده، هزینهٔ بیرونی، deploy یا پیام بیرونی ایجاد نشد.

وضعیت Exit Gate خود PF-1 هنوز `open` است؛ برای بستن آن دو Product Request مستقل با evidence persistence، version conflict و negative authorization لازم است. این سند فقط شواهد برش فعلی است و آن Exit Gate را به‌صورت زودهنگام Done اعلام نمی‌کند.

source evidence: branch `codex/test-release-reliability-20260916`، commit `56c45ab6266f475fc53fa2000849de0d7fef8d0a`.

## تغییرات قابل مشاهده

| بخش | نتیجه |
|---|---|
| Intake | `projectType`، سطح ریسک درخواستی، محدودیت‌ها، خروجی‌های مورد انتظار و flagهای ریسک معتبرسازی می‌شوند. |
| Risk classification | سطح `low/standard/high/critical` با حداقل‌سازی سطح ریسک و علت‌های قابل‌نمایش تولید می‌شود؛ نوع ابزار امنیتی یا ترکیب امنیت/اینترنت می‌تواند سطح را بالا ببرد. |
| Foundation | `riskAssessment` و `runtimePlan` در Proposal ذخیره و نسخه‌دار می‌شوند؛ Proposal همچنان قابل revise است. |
| Owner gate | Foundation با ریسک `high/critical` فقط با تأیید صریح Owner پذیرفته می‌شود؛ Admin به‌تنهایی نمی‌تواند این گیت را دور بزند. |
| Product Test plan | مقصد پیش‌فرض Test ایزوله، repository مستقل، Compose/database/volume/network نام‌گذاری‌شدهٔ محصول، network خاموش، پورت خالی، محدودیت منابع، non-root، read-only و no-new-privileges است. |
| Side effects | همهٔ اثرها در این مرحله `false` هستند: mutation مخزن، start کانتینر، ساخت DB، Secret write، deploy، external spend و پیام بیرونی. |
| UI | Portfolio فیلدهای ضروری Intake و flagهای ریسک را می‌گیرد؛ Product Studio علت ریسک، گیت‌ها، طرح runtime و اثرهای قفل‌شده را به زبان قابل‌فهم نشان می‌دهد. |

## تست و نتیجه

اجرای verify روی source جاری با `pnpm check`:

| بررسی | نتیجه |
|---|---:|
| تست‌های Node | ۳۹۷ pass / ۰ fail |
| Build | ۲۶۵ module / ۴۹ JSON |
| Documentation check | ۱۳۹ document / ۲ product / ۰ error |
| Roadmap audit | PASS؛ ۱۷۰ step، verified=۲۰، remaining=۱۵۰ |
| Back Office coverage | PASS؛ implemented=۵، partial=۷۶، missing=۰ |
| Docker داخل verify image | warning؛ socket در clean-room موجود نیست |

تست‌های افزودهٔ اختصاصی PF-1 شامل طبقه‌بندی محافظه‌کارانهٔ ریسک، رد flag ناشناخته، طرح runtime معتبر، قفل‌بودن همهٔ اثرها، عدم وجود پورت، و الزام تأیید صریح Owner برای ریسک بالا/بحرانی هستند. تست‌های UI نیز serialization امن Portfolio را تأیید کردند.

## مرز و گام بعدی

این evidence مجوز شروع Product Runner نیست. گام بعدی PF-1، اضافه‌کردن persistence/replay کامل Product Request و دو سناریوی مستقل project-scoped است؛ سپس negative testهای permission/version باید Exit Gate را پوشش دهند. پس از آن PF-2 فقط در Test و با authorization مستقل می‌تواند به طراحی/اجرای نمونهٔ بی‌خطر Product Runner برسد.

هیچ تغییر یا لمسی در Production، Pilot، Secret Store، Secretهای Provider، GitHub Actions، GHCR، ParsPack runtime یا اپلیکیشن دیگر انجام نشده است.
