# Evidence قرارداد و admission ایزولهٔ Product Runner — PF-2

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918.md`
> Title: Evidence قرارداد و admission ایزولهٔ Product Runner — PF-2
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## نتیجه

زیرگام «قرارداد و admission پیش از اجرای Product Runner» در commit `788746c` پیاده‌سازی و در source تأیید شد. runtime plan محصول همچنان مخصوص Test، plan-only، بدون side effect، بدون Docker socket و بدون host mount است. admission پیش از هر start اکنون سیاست شبکه، مسیر میزبان، namespace منابع و quotaهای plan را fail-closed کنترل می‌کند. این evidence به‌معنی اجرای Product Runner یا آماده‌بودن Product Test نیست؛ Exit Gate کامل PF-2 همچنان باز است.

## تغییرات

| مرز | رفتار تأییدشده |
|---|---|
| شبکه | وقتی plan شبکه را `disabled` اعلام می‌کند، فقط `networkMode=none` پذیرفته می‌شود؛ `bridge` و `host` رد می‌شوند. |
| مسیر میزبان | با `hostMounts=false` هر مسیر host رد می‌شود؛ مسیرهای absolute، traversal و `.hero` نیز رد می‌شوند. |
| منابع | CPU، حافظه، PID، timeout و هم‌زمانی نمی‌توانند از سقف همان plan عبور کنند. |
| منابع نام‌گذاری‌شده | فقط namespace `hero-product-*` پذیرفته می‌شود و collision پورت/منبع رد می‌شود. |
| malformed input | plan یا limits ناقص/نامعتبر، بدون exception قابل‌مشاهده و بدون side effect، پاسخ `reject` می‌دهد. |
| side effect | خروجی admission همیشه `sideEffects: none` است؛ این مرحله کانتینر، repository، database، network یا volume نمی‌سازد. |

## تست و شواهد

| بررسی | نتیجه |
|---|---:|
| تست هدفمند `tests/project-workspace-and-settings.test.mjs` | ۲۰ تست موفق، ۰ شکست |
| سناریوهای جدید | شبکهٔ ممنوع، host path، host mount، PID، timeout، هم‌زمانی و plan دست‌کاری‌شده |
| اجرای معادل `pnpm check` در Linux container | ۴۰۶ تست موفق، ۰ شکست |
| Build | ۲۶۵ module و ۴۹ JSON معتبر |
| Documentation check | ۱۴۱ سند، ۲ محصول، ۰ خطا |
| Roadmap/Back Office checks | PASS؛ ۱۷۰ گام، verified=۲۰، remaining=۱۵۰؛ implemented=۵، partial=۷۶، missing=۰ |

در اجرای containerized source، `HERO_SOURCE_SNAPSHOT=1` برای تست clean-room استفاده شد، چون checkout mount‌شده مسیر Git متفاوتی نسبت به `/workspace` دارد. تنها هشدار check، نبودن Docker socket در clean-room بود و شکست محسوب نمی‌شود. host ابزار Node/pnpm ندارد؛ CI و container مرجع برای زنجیرهٔ کامل استفاده شدند.

## آنچه هنوز انجام نشده است

این زیرگام هیچ محصول هدفی را build یا start نکرده است. موارد زیر برای ادامهٔ PF-2 باقی هستند: ایجاد runner واقعی با workspace محصول مستقل، build/test در sandbox، رزرو واقعی منابع، اجرای یک image نمونه در Product Test، health/readiness، rollback و آزمایش عدم‌اختلال Hero Test و یک سرویس کنترل‌شدهٔ دیگر. هرکدام authorization و evidence جدا می‌خواهند.

Production، Pilot، Secret Store، Secretهای Provider، فراخوانی زندهٔ Provider، external spend، سرور خارجی و اپلیکیشن‌های دیگر ParsPack در این گام لمس نشدند.
