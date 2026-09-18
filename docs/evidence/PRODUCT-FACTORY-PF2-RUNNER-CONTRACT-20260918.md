# Evidence قرارداد و admission ایزولهٔ Product Runner — PF-2

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918.md`
> Title: Evidence قرارداد و admission ایزولهٔ Product Runner — PF-2
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.5.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## نتیجه

زیرگام «قرارداد، admission و adapter امن Product Runner» در commit `c22d556c2bb08d10e160dbdd1536a4eb1870965c` تکمیل شد. runtime plan محصول مخصوص Test است و تنها پس از Foundation approval و authorization نسخه‌دار Product Test می‌تواند از حالت plan-only به isolated-test برسد. adapter واقعی Docker از workspace مستقل استفاده می‌کند، Compose config را قبل از هر action بررسی می‌کند، argv-only و shell-free است، image شروع را با digest تطبیق می‌دهد، network/host-mount/socket/privileged escape را رد می‌کند، quota و concurrency را enforce می‌کند و stdout/stderr یا خطای خام را برنمی‌گرداند. executor در Control Plane به‌صورت پیش‌فرض configure نیست؛ بنابراین این evidence اجرای کانتینر محصول یا آماده‌بودن Product Test را ادعا نمی‌کند و Exit Gate کامل PF-2 همچنان باز است.

## تغییرات

| مرز | رفتار تأییدشده |
|---|---|
| شبکه | وقتی plan شبکه را `disabled` اعلام می‌کند، فقط `networkMode=none` پذیرفته می‌شود؛ `bridge` و `host` رد می‌شوند. |
| مسیر میزبان | با `hostMounts=false` هر مسیر host رد می‌شود؛ مسیرهای absolute، traversal و `.hero` نیز رد می‌شوند. |
| منابع | CPU، حافظه، PID، timeout و هم‌زمانی نمی‌توانند از سقف همان plan عبور کنند. |
| منابع نام‌گذاری‌شده | فقط namespace `hero-product-*` پذیرفته می‌شود و collision پورت/منبع رد می‌شود. |
| malformed input | plan یا limits ناقص/نامعتبر، بدون exception قابل‌مشاهده و بدون side effect، پاسخ `reject` می‌دهد. |
| side effect | خروجی admission همیشه `sideEffects: none` است؛ این مرحله کانتینر، repository، database، network یا volume نمی‌سازد. |
| اجرای کنترل‌شده | actionهای build/test/start/stop/cleanup فقط با executor صریح، plan تأییدشده، dispatch decision دقیق و authorization جداگانهٔ `product-test-*` پذیرفته می‌شوند؛ اجرای پیش‌فرض خاموش است. |
| Compose runtime | برای start، imageهای Compose باید digest immutable داشته باشند و با artifact درخواست‌شده یکی باشند؛ `network_mode: none`، non-root، read-only، no-new-privileges، `cap_drop: ALL` و CPU/RAM/PID زیر سقف plan اجباری است. |
| خروجی/timeout | خروجی متنی هرگز در نتیجه نیست؛ فقط exit code، duration، اندازهٔ byte، timeout و وضعیت redaction ثبت می‌شود. timeout یا executor failure به نتیجهٔ امن تبدیل می‌شود. |

## تست و شواهد

| بررسی | نتیجه |
|---|---:|
| تست هدفمند `tests/product-runner-adapter.test.mjs` | ۱۲ تست موفق، ۰ شکست |
| تست هدفمند reservation guard (`product-runner-adapter` + `product-runtime-reservations`) | ۱۸ تست موفق، ۰ شکست |
| تست regression `tests/project-workspace-and-settings.test.mjs` و `tests/health.test.mjs` | ۴۴ تست موفق، ۰ شکست |
| سناریوهای جدید | شبکهٔ ممنوع، host path/symlink/socket، image mutable، Compose security/quota، authorization، executor خاموش، redaction، failure و concurrency |
| اجرای کامل زنجیرهٔ `pnpm check` در Linux container | ۴۲۴ تست موفق، ۰ شکست؛ یک هشدار مورد انتظار دربارهٔ نبود Docker socket در clean-room |
| Build | ۲۷۰ module و ۴۹ JSON معتبر |
| Documentation check | ۱۴۱ سند، ۲ محصول، ۰ خطا |
| Roadmap/Back Office checks | PASS؛ ۱۷۰ گام، verified=۲۰، remaining=۱۵۰؛ implemented=۵، partial=۷۶، missing=۰ |

در اجرای containerized source، `HERO_SOURCE_SNAPSHOT=1` برای تست clean-room استفاده شد، چون checkout mount‌شده مسیر Git متفاوتی نسبت به `/workspace` دارد. تست‌های این برش عمداً executor جعلی را برای اثبات policy استفاده می‌کنند و هیچ کانتینر محصولی start نکردند. host ابزار Node/pnpm ندارد؛ CI و container مرجع برای زنجیرهٔ کامل استفاده می‌شوند.

## انتشار و تأیید Test

نسخهٔ فعال Hero Test همچنان `v1.1.4-rc.10` از run `35292057200` با commit `3fabefe15ff10926d60b804c2deace63fc936397` و digest `ghcr.io/farhaddgm/hero@sha256:496d740ce2d650c1a02d1fb3f22e2f67f1f8373ec47e6fa528cd2b8a1f6b2257` است. candidate بعدی `v1.1.4-rc.11` از run `35307457878` با commit `dd95723f6cbd5d4ec75aafb59e72941b185e2e2f` و digest `ghcr.io/farhaddgm/hero@sha256:7a42b5592e60ae5d8b61c10040ee20d56a22a276bae76e3258920e76ed51bba2` ساخته و منتشر شد؛ verification، build، GHCR publish، tag، prerelease، manifest و artifact upload موفق‌اند و promotion روی host Test هنوز pending است. این تأییدها مربوط به خود Hero Test هستند، نه اجرای محصول هدف.

## آنچه هنوز انجام نشده است

این زیرگام هیچ محصول هدفی را build یا start نکرده است. guard رزرو منابع اکنون در سطح process برای جلوگیری از تعارض concurrent run فعال است، اما جایگزین inventory پایدار host یا رزرو cross-process پس از restart نیست. موارد زیر برای ادامهٔ PF-2 باقی هستند: configure کردن executor فقط در مسیر اجرای مجاز، ساخت workspace و Compose نمونه روی host Test، رزرو پایدار منابع، build/test در sandbox، اجرای یک image نمونه در Product Test، health/readiness، rollback و آزمایش عدم‌اختلال Hero Test و یک سرویس کنترل‌شدهٔ دیگر. برای start واقعی باید authorization جداگانه با operationهای `product-test-*`، Step ID و نسخهٔ سند دقیق صادر شود؛ authorization انتشار Hero یا مجوز AI به‌تنهایی کافی نیست.

Production، Pilot، Secret Store، Secretهای Provider، فراخوانی زندهٔ Provider، external spend، سرور خارجی و اپلیکیشن‌های دیگر ParsPack در این گام لمس نشدند.
