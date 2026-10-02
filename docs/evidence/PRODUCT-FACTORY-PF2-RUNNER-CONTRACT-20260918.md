# Evidence قرارداد و admission ایزولهٔ Product Runner — PF-2

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918.md`
> Title: Evidence قرارداد و admission ایزولهٔ Product Runner — PF-2
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.11.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## نتیجه

زیرگام «قرارداد، admission و adapter امن Product Runner» در commit `c22d556c2bb08d10e160dbdd1536a4eb1870965c` تکمیل و در commit‌های `73a7b45` و `71d26fe` با رزرو پایدار و ظرفیت‌سنجی تکمیل‌تر شد. commit `c3d1334` چرخهٔ عمر lease، heartbeat/reconciliation گزارش‌محور، probe امن ظرفیت Docker و قرارداد immutable artifact محصول را اضافه کرد. runtime plan محصول مخصوص Test است و تنها پس از Foundation approval و authorization نسخه‌دار Product Test می‌تواند از حالت plan-only به isolated-test برسد. adapter واقعی Docker از workspace مستقل استفاده می‌کند، Compose config را قبل از هر action بررسی می‌کند، argv-only و shell-free است، image شروع را با digest تطبیق می‌دهد، network/host-mount/socket/privileged escape را رد می‌کند، quota و concurrency را enforce می‌کند و stdout/stderr یا خطای خام را برنمی‌گرداند. رزروها در runtime متصل به PostgreSQL با migration‌های `018`، `019` و `020`، قفل تراکنشی advisory، replay همسان، heartbeat، reconciliation صریح، تشخیص تعارض پورت/منبع و release نسخه‌دار قابل نگهداری و بازیابی‌اند؛ guard process-local همچنان fallback محدود همان Runner است. قرارداد artifact، SBOM/attestation/test evidence digest و تطبیق digest با Runner را الزام می‌کند. executor در Control Plane به‌صورت پیش‌فرض configure نیست؛ بنابراین این evidence اجرای کانتینر محصول یا آماده‌بودن Product Test را ادعا نمی‌کند و Exit Gate کامل PF-2 همچنان باز است.

## تغییرات

| مرز | رفتار تأییدشده |
|---|---|
| شبکه | وقتی plan شبکه را `disabled` اعلام می‌کند، فقط `networkMode=none` پذیرفته می‌شود؛ `bridge` و `host` رد می‌شوند. |
| مسیر میزبان | با `hostMounts=false` هر مسیر host رد می‌شود؛ مسیرهای absolute، traversal و `.hero` نیز رد می‌شوند. |
| منابع | CPU، حافظه، PID، timeout و هم‌زمانی نمی‌توانند از سقف همان plan عبور کنند. |
| منابع نام‌گذاری‌شده | فقط namespace `hero-product-*` پذیرفته می‌شود و collision پورت/منبع رد می‌شود؛ در PostgreSQL، reservation فعال بین processها نیز با advisory transaction lock بررسی می‌شود. |
| ظرفیت host | migration `019` و قرارداد Capacity snapshot، CPU/RAM/PID و تعداد اجرای هم‌زمان را قبل از reservation پایدار بررسی می‌کنند؛ ظرفیت مشاهده‌نشده یا lease قدیمی با quota نامعلوم fail-closed است. |
| چرخهٔ عمر reservation | migration `020`، TTL، heartbeat و reconciliation report-only اضافه شده‌اند؛ expiry بدون تأیید صریح mutation نمی‌کند و lease ناقص fail-closed گزارش می‌شود. |
| inventory ظرفیت | probe Docker فقط با argv ثابت `docker info --format` metadata امن CPU/RAM را مشاهده می‌کند؛ خروجی خام، credential و مجوز اجرا برنمی‌گرداند. |
| artifact محصول | manifest immutable برای Test شامل source commit، OCI digest، SBOM، attestation و test-evidence digest است؛ Runner در صورت وجود manifest، تطبیق digest را اجباری می‌کند. |
| malformed input | plan یا limits ناقص/نامعتبر، بدون exception قابل‌مشاهده و بدون side effect، پاسخ `reject` می‌دهد. |
| side effect | خروجی admission همیشه `sideEffects: none` است؛ این مرحله کانتینر، repository، database، network یا volume نمی‌سازد. |
| اجرای کنترل‌شده | actionهای build/test/start/stop/cleanup فقط با executor صریح، plan تأییدشده، dispatch decision دقیق و authorization جداگانهٔ `product-test-*` پذیرفته می‌شوند؛ اجرای پیش‌فرض خاموش است. |
| Compose runtime | برای start، imageهای Compose باید digest immutable داشته باشند و با artifact درخواست‌شده یکی باشند؛ `network_mode: none`، non-root، read-only، no-new-privileges، `cap_drop: ALL` و CPU/RAM/PID زیر سقف plan اجباری است. |
| خروجی/timeout | خروجی متنی هرگز در نتیجه نیست؛ فقط exit code، duration، اندازهٔ byte، timeout و وضعیت redaction ثبت می‌شود. timeout یا executor failure به نتیجهٔ امن تبدیل می‌شود. |

## تست و شواهد

| بررسی | نتیجه |
|---|---:|
| تست هدفمند PF-2 (`product-runner-adapter`، reservation guard، Capacity/Lease/Artifact contract، probe، PostgreSQL store و schema) | ۴۴ تست موفق، ۰ شکست |
| سناریوهای جدید | شبکهٔ ممنوع، host path/symlink/socket، image mutable، Compose security/quota، authorization، executor خاموش، redaction، failure، concurrency، replay، تعارض پایدار، release/reuse، lease expiry/heartbeat/reconciliation، probe failure و artifact mismatch |
| اجرای کامل زنجیرهٔ `pnpm check` در Linux container | ۴۴۷ تست موفق، ۰ شکست؛ یک هشدار مورد انتظار دربارهٔ نبود Docker socket در clean-room |
| Build | ۲۸۰ module و ۴۹ JSON معتبر |
| Documentation check | ۱۴۱ سند، ۲ محصول، ۰ خطا |
| Roadmap/Back Office checks | PASS؛ ۱۷۰ گام، verified=۲۰، remaining=۱۵۰؛ implemented=۵، partial=۷۶، missing=۰ |

در اجرای containerized source، `HERO_SOURCE_SNAPSHOT=1` برای تست clean-room استفاده شد، چون checkout mount‌شده مسیر Git متفاوتی نسبت به `/workspace` دارد. تست‌های این برش عمداً executor جعلی را برای اثبات policy استفاده می‌کنند و هیچ کانتینر محصولی start نکردند. host ابزار Node/pnpm ندارد؛ CI و container مرجع برای زنجیرهٔ کامل استفاده می‌شوند.

## انتشار و تأیید Test

نسخهٔ فعال Hero Test اکنون `v1.1.4-rc.12` از run `35309418424` با commit runtime `d1b4d0600c4a2d360ec4e94266b63efb439cc380` و digest `ghcr.io/farhaddgm/hero@sha256:a9caf69e2240ec0a211325b1269e8213924eba673b67d039857a3cb17606d39e` است. مالک روی host Test promotion را انجام داد؛ container شروع شد، `/health` و `/ready` موفق بودند و `Hero Test smoke check: PASS` ثبت شد. خطای موقت `curl: (56) Recv failure: Connection reset by peer` در زمان restart رخ داد و با بررسی‌های نهایی سلامت دنبال شد. rollback point metadata-only برای rc.11 در `/etc/hero/hero-test.env.release-state.before-a9caf69e2240ec0a211325b1269e8213924eba673b67d039857a3cb17606d39e.json` ثبت شده است. این تأییدها مربوط به خود Hero Test هستند، نه اجرای محصول هدف.

rc.11 با digest `sha256:7a42b5592e60ae5d8b61c10040ee20d56a22a276bae76e3258920e76ed51bba2` به‌عنوان rollback قبلی pull و قابل‌بازگشت بودن آن تأیید شد. promotion rc.12 شامل migration `018` و store پایدار reservation است؛ با این حال این شواهد هنوز اجرای محصول هدف، Product Test یا اثبات عدم‌اختلال یک محصول جدا را نشان نمی‌دهد.

candidate `v1.1.4-rc.14` با run `35311782701`، commit `c3d1334c03a291baf804ccc190fb75a8f719fd76` و digest `ghcr.io/farhaddgm/hero@sha256:6fba080967039dde9e884e5c8ca86e8343b6512577061bde55cfdd5dcb006228` با workflow کامل موفق ساخته و منتشر شده است، اما هنوز روی Test promote نشده؛ rc.12 همچنان runtime فعال است.

## آنچه هنوز انجام نشده است

این زیرگام هنوز هیچ محصول هدفی را build یا start نکرده است. store پایدار رزرو منابع، migration‌های `018`، `019` و `020`، lease lifecycle، probe ظرفیت و قرارداد immutable artifact در source حاضرند؛ rc.12 روی Hero Test فعال است و rc.14 شامل این تغییرات ساخته شده، اما هنوز promote نشده است. برای بستن Exit Gate PF-2 هنوز باید probe روی host Test اجرا و snapshot ظرفیت ثبت شود، reconciliation زمان‌بندی‌شده در مسیر مجاز configure شود، executor صریح به workspace و Compose نمونه متصل شود، و Product Test واقعی با health/readiness، rollback و آزمایش عدم‌اختلال Hero Test و یک سرویس کنترل‌شده انجام شود. این‌ها به authorization جداگانه با operationهای `product-test-*` و دسترسی sudo/host نیاز دارند؛ authorization انتشار Hero یا مجوز AI به‌تنهایی کافی نیست. قرارداد PF-3 اکنون در source آماده است، اما artifact واقعی محصول، SBOM/attestation واقعی، test evidence واقعی و Owner acceptance هنوز ثبت نشده‌اند.

Production، Pilot، Secret Store، Secretهای Provider، فراخوانی زندهٔ Provider، external spend، سرور خارجی و اپلیکیشن‌های دیگر ParsPack در این گام لمس نشدند.
