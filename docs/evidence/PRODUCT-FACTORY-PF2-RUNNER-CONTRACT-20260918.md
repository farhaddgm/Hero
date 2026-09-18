# Evidence قرارداد و admission ایزولهٔ Product Runner — PF-2

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918.md`
> Title: Evidence قرارداد و admission ایزولهٔ Product Runner — PF-2
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.2.0
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
| تست regression `tests/project-workspace-and-settings.test.mjs` و `tests/health.test.mjs` | ۴۴ تست موفق، ۰ شکست |
| سناریوهای جدید | شبکهٔ ممنوع، host path/symlink/socket، image mutable، Compose security/quota، authorization، executor خاموش، redaction، failure و concurrency |
| اجرای کامل زنجیرهٔ `pnpm check` در Linux container | ۴۱۸ تست موفق، ۰ شکست؛ یک هشدار مورد انتظار دربارهٔ نبود Docker socket در clean-room |
| Build | ۲۶۸ module و ۴۹ JSON معتبر |
| Documentation check | ۱۴۱ سند، ۲ محصول، ۰ خطا |
| Roadmap/Back Office checks | PASS؛ ۱۷۰ گام، verified=۲۰، remaining=۱۵۰؛ implemented=۵، partial=۷۶، missing=۰ |

در اجرای containerized source، `HERO_SOURCE_SNAPSHOT=1` برای تست clean-room استفاده شد، چون checkout mount‌شده مسیر Git متفاوتی نسبت به `/workspace` دارد. تست‌های این برش عمداً executor جعلی را برای اثبات policy استفاده می‌کنند و هیچ کانتینر محصولی start نکردند. host ابزار Node/pnpm ندارد؛ CI و container مرجع برای زنجیرهٔ کامل استفاده می‌شوند.

## انتشار و تأیید Test

پس از تأیید source، candidate `v1.1.4-rc.9` از run `35289669314` با commit `e8de500e4278b1f4cf805e87c02d62ce05847709` و digest `ghcr.io/farhaddgm/hero@sha256:499d00f88ac705f2b47d221d4396887291f7293c4d8c6ca7b67dff764b7c0b12` فقط روی Hero Test promote شد. container `running/healthy`، restart count صفر، `/health` و `/ready` هر دو ۲۰۰ و rollback point metadata-only ثبت شده است. این تأیید مربوط به خود Hero Test است، نه اجرای محصول هدف.

## آنچه هنوز انجام نشده است

این زیرگام هیچ محصول هدفی را build یا start نکرده است. موارد زیر برای ادامهٔ PF-2 باقی هستند: configure کردن executor فقط در مسیر اجرای مجاز، ساخت workspace و Compose نمونه روی host Test، رزرو سراسری منابع، build/test در sandbox، اجرای یک image نمونه در Product Test، health/readiness، rollback و آزمایش عدم‌اختلال Hero Test و یک سرویس کنترل‌شدهٔ دیگر. برای start واقعی باید authorization جداگانه با operationهای `product-test-*`، Step ID و نسخهٔ سند دقیق صادر شود؛ authorization انتشار Hero یا مجوز AI به‌تنهایی کافی نیست.

Production، Pilot، Secret Store، Secretهای Provider، فراخوانی زندهٔ Provider، external spend، سرور خارجی و اپلیکیشن‌های دیگر ParsPack در این گام لمس نشدند.
