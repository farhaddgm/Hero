# Evidence قرارداد و admission ایزولهٔ Product Runner — PF-2

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918.md`
> Title: Evidence قرارداد و admission ایزولهٔ Product Runner — PF-2
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.8.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## نتیجه

زیرگام «قرارداد، admission و adapter امن Product Runner» در commit `c22d556c2bb08d10e160dbdd1536a4eb1870965c` تکمیل و در commit `73a7b453306d2aa6a467766bfd6c34b99a68e216` با رزرو پایدار منابع تکمیل‌تر شد. runtime plan محصول مخصوص Test است و تنها پس از Foundation approval و authorization نسخه‌دار Product Test می‌تواند از حالت plan-only به isolated-test برسد. adapter واقعی Docker از workspace مستقل استفاده می‌کند، Compose config را قبل از هر action بررسی می‌کند، argv-only و shell-free است، image شروع را با digest تطبیق می‌دهد، network/host-mount/socket/privileged escape را رد می‌کند، quota و concurrency را enforce می‌کند و stdout/stderr یا خطای خام را برنمی‌گرداند. رزروها در runtime متصل به PostgreSQL با migration `018`، قفل تراکنشی advisory، replay همسان، تشخیص تعارض پورت/منبع و release نسخه‌دار قابل نگهداری و بازیابی‌اند؛ guard process-local همچنان fallback محدود همان Runner است. executor در Control Plane به‌صورت پیش‌فرض configure نیست؛ بنابراین این evidence اجرای کانتینر محصول یا آماده‌بودن Product Test را ادعا نمی‌کند و Exit Gate کامل PF-2 همچنان باز است.

## تغییرات

| مرز | رفتار تأییدشده |
|---|---|
| شبکه | وقتی plan شبکه را `disabled` اعلام می‌کند، فقط `networkMode=none` پذیرفته می‌شود؛ `bridge` و `host` رد می‌شوند. |
| مسیر میزبان | با `hostMounts=false` هر مسیر host رد می‌شود؛ مسیرهای absolute، traversal و `.hero` نیز رد می‌شوند. |
| منابع | CPU، حافظه، PID، timeout و هم‌زمانی نمی‌توانند از سقف همان plan عبور کنند. |
| منابع نام‌گذاری‌شده | فقط namespace `hero-product-*` پذیرفته می‌شود و collision پورت/منبع رد می‌شود؛ در PostgreSQL، reservation فعال بین processها نیز با advisory transaction lock بررسی می‌شود. |
| malformed input | plan یا limits ناقص/نامعتبر، بدون exception قابل‌مشاهده و بدون side effect، پاسخ `reject` می‌دهد. |
| side effect | خروجی admission همیشه `sideEffects: none` است؛ این مرحله کانتینر، repository، database، network یا volume نمی‌سازد. |
| اجرای کنترل‌شده | actionهای build/test/start/stop/cleanup فقط با executor صریح، plan تأییدشده، dispatch decision دقیق و authorization جداگانهٔ `product-test-*` پذیرفته می‌شوند؛ اجرای پیش‌فرض خاموش است. |
| Compose runtime | برای start، imageهای Compose باید digest immutable داشته باشند و با artifact درخواست‌شده یکی باشند؛ `network_mode: none`، non-root، read-only، no-new-privileges، `cap_drop: ALL` و CPU/RAM/PID زیر سقف plan اجباری است. |
| خروجی/timeout | خروجی متنی هرگز در نتیجه نیست؛ فقط exit code، duration، اندازهٔ byte، timeout و وضعیت redaction ثبت می‌شود. timeout یا executor failure به نتیجهٔ امن تبدیل می‌شود. |

## تست و شواهد

| بررسی | نتیجه |
|---|---:|
| تست هدفمند PF-2 (`product-runner-adapter`، reservation guard، PostgreSQL store و schema) | ۲۶ تست موفق، ۰ شکست |
| سناریوهای جدید | شبکهٔ ممنوع، host path/symlink/socket، image mutable، Compose security/quota، authorization، executor خاموش، redaction، failure، concurrency، replay، تعارض پایدار و release/reuse تراکنشی |
| اجرای کامل زنجیرهٔ `pnpm check` در Linux container | ۴۲۹ تست موفق، ۰ شکست؛ یک هشدار مورد انتظار دربارهٔ نبود Docker socket در clean-room |
| Build | ۲۷۲ module و ۴۹ JSON معتبر |
| Documentation check | ۱۴۱ سند، ۲ محصول، ۰ خطا |
| Roadmap/Back Office checks | PASS؛ ۱۷۰ گام، verified=۲۰، remaining=۱۵۰؛ implemented=۵، partial=۷۶، missing=۰ |

در اجرای containerized source، `HERO_SOURCE_SNAPSHOT=1` برای تست clean-room استفاده شد، چون checkout mount‌شده مسیر Git متفاوتی نسبت به `/workspace` دارد. تست‌های این برش عمداً executor جعلی را برای اثبات policy استفاده می‌کنند و هیچ کانتینر محصولی start نکردند. host ابزار Node/pnpm ندارد؛ CI و container مرجع برای زنجیرهٔ کامل استفاده می‌شوند.

## انتشار و تأیید Test

نسخهٔ فعال Hero Test اکنون `v1.1.4-rc.11` از run `35307457878` با commit `dd95723f6cbd5d4ec75aafb59e72941b185e2e2f` و digest `ghcr.io/farhaddgm/hero@sha256:7a42b5592e60ae5d8b61c10040ee20d56a22a276bae76e3258920e76ed51bba2` است. مالک روی host Test promotion را انجام داد؛ container شروع شد، `/health` و `/ready` موفق بودند و `Hero Test smoke check: PASS` ثبت شد. خطای موقت `curl: (56) Recv failure: Connection reset by peer` در زمان restart رخ داد و با بررسی‌های نهایی سلامت دنبال شد. rollback point metadata-only در `/etc/hero/hero-test.env.release-state.before-7a42b5592e60ae5d8b61c10040ee20d56a22a276bae76e3258920e76ed51bba2.json` ثبت شده است. این تأییدها مربوط به خود Hero Test هستند، نه اجرای محصول هدف.

candidate بعدی فقط برای Test با نسخهٔ `v1.1.4-rc.12`، run `35309418424`، commit `d1b4d0600c4a2d360ec4e94266b63efb439cc380` و digest `ghcr.io/farhaddgm/hero@sha256:a9caf69e2240ec0a211325b1269e8213924eba673b67d039857a3cb17606d39e` با workflow موفق ساخته و در GHCR منتشر شده است. Promotion روی host Test هنوز انجام نشده، چون اجرای `sudo` در محیط فعلی رمز عبور می‌خواهد؛ بنابراین rc.11 همچنان نسخهٔ فعال است.

## آنچه هنوز انجام نشده است

این زیرگام هیچ محصول هدفی را build یا start نکرده است. store پایدار رزرو منابع در runtime PostgreSQL و migration `018` اضافه شده، اما inventory ظرفیت host، TTL/reconciliation عملیاتی و اتصال آن به مسیر اجرای واقعی Product Runner هنوز گیت مستقل می‌خواهند؛ guard process-local فقط fallback همان process است. موارد زیر برای ادامهٔ PF-2 باقی هستند: configure کردن executor فقط در مسیر اجرای مجاز، ساخت workspace و Compose نمونه روی host Test، capacity inventory و reconciliation، build/test در sandbox، اجرای یک image نمونه در Product Test، health/readiness، rollback و آزمایش عدم‌اختلال Hero Test و یک سرویس کنترل‌شدهٔ دیگر. برای start واقعی باید authorization جداگانه با operationهای `product-test-*`، Step ID و نسخهٔ سند دقیق صادر شود؛ authorization انتشار Hero یا مجوز AI به‌تنهایی کافی نیست.

Production، Pilot، Secret Store، Secretهای Provider، فراخوانی زندهٔ Provider، external spend، سرور خارجی و اپلیکیشن‌های دیگر ParsPack در این گام لمس نشدند.
