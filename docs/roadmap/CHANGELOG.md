# تغییرات رودمپ شرکت

# ۲۰۲۶-۰۹-۱۸ — یکسان‌سازی آمادگی انتخاب AI در همهٔ پنجره‌ها

- ریشهٔ غیرفعال‌بودن ChatGPT در پنجره‌های «مشاوره»، Smart Tester و «پیشنهاد فرم» اصلاح شد: هر سه سطح اکنون از یک ارزیاب مشترک و provider-agnostic استفاده می‌کنند و هفت گیت Provider، Model، Profile، Binding پروژه، Health، Scope و مجوز نسخه‌دار را با هم بررسی می‌کنند.
- گزینهٔ AI فقط وقتی قابل انتخاب است که همهٔ گیت‌ها موفق باشند؛ در غیر این صورت گزینه حذف نمی‌شود، اما غیرفعال می‌ماند و کد/علت امن و قابل تشخیص آن به UI و `title` گزینه می‌رسد. هیچ مسیر انتخابی با دورزدن Scope یا authorization فعال نشده است.
- پس از «تست آماده‌بودن»، Back Office علاوه بر سلامت اتصال، آماده‌بودن واقعی ChatGPT برای Smart Tester را گزارش می‌کند؛ بنابراین «کلید سالم» با «قابل انتخاب بودن» اشتباه نمی‌شود.
- تست‌های هدفمند `38/38` و `pnpm check` کامل `472/472` موفق شدند؛ build برابر `298` ماژول و `51` فایل JSON بود. هیچ Secret، Production، Pilot یا فراخوانی Provider زنده در این تغییر استفاده نشد.
- commit source: `932c9ac`؛ این commit تا promotion جداگانه، Runtime Test را تغییر نمی‌دهد. برای فعال‌شدن در Test باید Candidate همین commit ساخته و فقط روی Test promote شود.

# ۲۰۲۶-۰۹-۱۸ — اتصال امن API Provider به ماژول پیشنهاد فرم

- backend ماژول پیشنهاد فرم از حالت محلیِ اجباری خارج شد و با همان مسیر انتخاب Profile، Binding، Health، Scope، Role، Tool Policy، timeout، cost cap و external-spend authorization کار می‌کند؛ رابط کاربری به Provider خاصی وابسته نشده است.
- پاسخ زنده با قرارداد بیرونی `analysis-v1` و Schema داخلی `form-suggestions-v1` پذیرفته می‌شود؛ تعداد پیشنهادها یک تا سه، هر پیشنهاد دقیقاً یک مقدار برای هر field، گزینه‌های select/radio فقط از گزینه‌های فرم، و فیلد/مقدار حساس یا مسیر میزبان fail-closed رد می‌شود.
- در جدول «نقشهٔ تخصیص AI در پروژه» ردیف «پیشنهاد فرم» و در فرم Scope پروژه قابلیت `form-suggestions` اضافه شد. حالت local همچنان بدون هزینه و بدون Provider باقی می‌ماند.
- authorization مستقل و نسخه‌دار `config/authorizations/AUTH-AI-TEST-001-v1.1.json` برای Test ثبت شد؛ شامل همان سقف `50,000` و پایان `2027-02-23T23:59:59Z` و فقط capability افزودهٔ `form-suggestions` است. تا promotion و اعمال تنظیم غیرمحرمانهٔ v1.1 در Test، اجرای زنده عمداً blocked می‌ماند.

# ۲۰۲۶-۰۹-۱۸ — فعال‌شدن واقعی OpenAI برای Smart Tester و Walk-Through در Test

- ریشهٔ خطا مشخص و اصلاح شد: سقف محافظه‌کارانهٔ `100` واحد پیش از dispatch، برای Context محدودِ خواندنی و خروجی ساخت‌یافته کافی نبود و با `COST_POLICY_INSUFFICIENT` جلوی فراخوانی مجاز را می‌گرفت؛ سقف هر درخواست به `10,000` افزایش یافت و سقف تجمعی authorization بدون تغییر روی `50,000` باقی ماند.
- candidate `v1.1.5-rc.5` از workflow `35393885561`، commit `4527bd73c0b078313867be9d9a142b1bb189cde5` و digest `sha256:0860c09fbd815ef381690ff354e68dee185786279ed34499cf7a5a3bdf1e2bf3` فقط روی Test promote و verify شد؛ `/health`، `/ready` و smoke موفق و کانتینر healthy بود.
- Evidence زندهٔ redacted: Smart Tester با `200`، OpenAI / `gpt-5.6-luna` / `analyst`، Profile `hero-profile-v1`، `providerInvoked=true`، schema `analysis-v1`، latency `4291ms` و `57` cost units؛ Walk-Through با `200`، همان Provider/Model/Role/Profile، `providerInvoked=true`، schema `analysis-v1`، latency `4310ms` و `53` cost units. مجموع `110/50000` ثبت شد؛ prompt، response و Secret ثبت یا چاپ نشدند.
- فهرست Smart Tester در Test فقط یک Profile فعال و قابل‌انتخاب برای Hero برگرداند؛ گزینه‌های تکراری/غیرفعال ناشی از دادهٔ ناسازگار در این مسیر مشاهده نشدند. Provider-agnostic boundary، policy، role، scope، timeout، redaction و fail-closed حفظ شده‌اند.
- مرز: فقط Test تغییر کرد؛ Production، Pilot، Secret Store/Secret و Providerهای دیگر لمس نشدند. مستندات وضعیت و Catalog evidence با نتیجهٔ واقعی همگام شدند.

# ۲۰۲۶-۰۹-۱۸ — رفع گیت هزینهٔ اشتباه در مشاورهٔ زندهٔ Smart Tester

- بررسی runtime Test نشان داد Provider `openai`، مدل `gpt-5.6-luna`، Profile تحلیلگر، Binding پروژهٔ `hero`، Credential و authorization معتبر بودند و گزینهٔ Smart Tester با `selectable=true` برمی‌گشت؛ مشکل از اتصال یا کلید نبود.
- فراخوانی واقعی پیش از ارسال به Provider با `COST_POLICY_INSUFFICIENT` متوقف می‌شد، چون سقف محافظه‌کارانهٔ هر درخواست `100` واحد از برآورد متن Context خواندنی و خروجی ۵۱۲ توکن کمتر بود. سقف هر درخواست به `10,000` واحد افزایش یافت؛ سقف تجمعی authorization همان `50,000` واحد باقی ماند و این تغییر فقط Test است.
- regression مربوط به clamp سقف Profile به سقف نسخه‌دار به‌روزرسانی شد؛ هیچ Secret، Production، Pilot یا Provider دیگری تغییر نکرد.
- health check موجود عمداً `configured-no-network-health-check` است و جایگزین فراخوانی واقعی نیست؛ evidence زندهٔ نهایی فقط پس از promotion همین source به Test و اجرای سناریوی بی‌خطر ثبت می‌شود.

# ۲۰۲۶-۰۹-۱۸ — اختیاری‌شدن ورودی پروژه

- در صفحهٔ «فضای پروژه»، بخش «ورودی پروژه» اکنون با برچسب «اختیاری» و توضیح روشن نمایش داده می‌شود؛ نمونهٔ محصول، متن سند یا لینک عمومی فقط در صورت وجود اضافه می‌شود و نبود آن مانع ادامهٔ پروژه نیست.
- فیلدهای ورودی متن و لینک دیگر به‌صورت HTML اجباری نیستند؛ ارسال کاملاً خالی به‌عنوان «بدون نمونه» بی‌خطر نادیده گرفته می‌شود، اما لینک ناقص (فقط آدرس یا فقط عنوان) همچنان ثبت نمی‌شود.
- قرارداد Workspace صراحتاً `inputRequirement: optional` را اعلام می‌کند و رفتار domain قبلیِ ساخت پروژه بدون ورودی حفظ شده است. هیچ محتوای حساس، Secret، Provider زنده یا external spend به این تغییر اضافه نشد.
- تست‌های UI و Workspace برابر `40 pass / 0 fail` شدند؛ فایل‌های نامرتبط موجود در worktree وارد این تغییر نشدند.

# ۲۰۲۶-۰۹-۱۸ — دستیار پیشنهاد AI برای فرم‌های محتوایی

- دکمهٔ مشترک «پیشنهاد AI» برای فرم‌های امن محتوایی به همهٔ سطوح Back Office اضافه شد و با کلید هدر قابل خاموش/روشن‌کردن است؛ فرم‌های هویت، ورود، MFA، Grant، Credential، Secret و فیلدهای حساس از ابتدا مستثنا هستند.
- Popup شامل انتخاب AI/Model، هدف کوتاه نرم‌افزار، هدف باکس، «اعلام پیشنهاد» و حداکثر سه کارت پیشنهاد قابل اسکرول است. انتخاب ادمین فقط مقدارهای فرم واقعی را پر می‌کند و ثبت نهایی خودکار نیست.
- موتور `hero-local` بدون هزینه و بدون Provider call، با validation، redaction boundary، عدم خواندن مقدارهای فعلی فرم و رد فیلدهای حساس اضافه شد. مسیرهای API project-scoped و admin/owner-gated هستند و پیشنهادها persist نمی‌شوند.
- تست هدفمند UI/domain برابر `22 pass / 0 fail` و syntax هر سه ماژول موفق است؛ `docs/registry/document-registry.json` و `hero-release-manifest.json` عمداً در این تغییر وارد نشده‌اند.

# ۲۰۲۶-۰۹-۱۸ — انتخاب Target پروژه‌ای برای محیط Test

- commit `be9ee96` قرارداد infrastructure-control را به `1.1` رساند و انتخاب Target را فقط برای `test`، با project scope، نسخهٔ موردانتظار و conflict guard اضافه کرد؛ سرور revoked قابل انتخاب نیست.
- اتاق کنترل پروژه اکنون فهرست سرورهای Test را به‌صورت redacted نشان می‌دهد و Admin/Owner می‌تواند Target انتخاب‌شده را ثبت کند؛ وضعیت صریح `selected-not-dispatched` است و این مسیر build، start، stop، cleanup یا dispatch انجام نمی‌دهد.
- مسیر POST project-scoped برای `select-target` و regressionهای domain/UI اضافه شد؛ تست هدفمند `23/23` موفق است و هیچ Secret، Provider زنده، هزینهٔ خارجی، Pilot یا Production لمس نشد.
- preflight سرور Test `185.204.168.171` قبلاً با SSH بدون رمز و Docker `29.1.3`/Compose `2.40.3` موفق شده بود؛ تا تعیین شناسهٔ دقیق پروژه، Target/Agent واقعی در registry ثبت نشد و هیچ شناسه‌ای حدس زده نشد.

# ۲۰۲۶-۰۹-۱۸ — PF-5 portability/recovery و PF-6 hardening evidence

- قرارداد `hero.product-delivery-bundle/v1` برای artifact immutable، SBOM/attestation/test/quality digest، config schema بدون Secret، migration، backup/restore و compatibility matrix اضافه شد؛ منبع در `HERO-OPS-PRODUCT-DELIVERY-BUNDLE-AND-CLEAN-TARGET@1.0.0` ثبت است.
- harness `pf5-rehearsal-20260918a` با Clean Target و Recovery Proof در clean-room اجرا شد؛ `PORTABILITY_VERIFIED`، network calls صفر و evidence digest `sha256:30814f40287ed355b0988664a6c9384f5a8c02e765cddaa2cfa68b2c7960e87c` ثبت شد. انتقال واقعی به Target جدا عمداً انجام نشد.
- harness `pf6-simulation-20260918a` روی دو project scope با ۱۰۲ trace و auditهای correlation، deduplication، stale/recovery، retention، isolation، accessibility، security، load، backup/restore و role regression PASS شد؛ evidence digest `sha256:fb5d1766f5dcc930c2682c19c3a42f351bb17cf2ff85aac4731d9c75cfee0962` است.
- Browser E2E واقعی، screen-reader/axe و load/soak روی deployment واقعی هنوز گیت‌های باقی‌ماندهٔ PF-6 هستند؛ Production، Pilot، Secret، Provider زنده و external spend لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — PF-4 قرارداد Node Agent کم‌اختیار و شبیه‌سازی امن

- قرارداد versioned `remote-agent` و registry provider-agnostic اضافه شد: Test-only target inventory، outbound-only transport، Ed25519 signed dispatch، allowlist عملیات، immutable digest، expiry، replay guard، redaction، heartbeat و revoke.
- تست‌های PF-4 شامل enrollment، fingerprint، tamper، shell-field rejection، replay، expiry، scope، mutable artifact، sensitive input و revoke هستند؛ ترکیب آن با regression زیرگام infrastructure برابر `9 pass / 0 fail` شد.
- harness رسمی `tools/run-pf4-remote-agent-simulation.mjs` با run `pf4-simulation-20260918b` اجرا شد؛ evidence digest برابر `sha256:837c46fc39fafaea36d00ad561e6ac9651ff021203111c9494499ba315f27b4b` است؛ network calls صفر و side effect واقعی صفر ثبت شد.
- PF-4 واقعی هنوز blocked است: target owner، authorization مستقل، key/Secret channel و connector واقعی در اختیار اجرا نبود و عمداً هیچ remote server، Production، Pilot، Secret یا external spend لمس نشد.

# ۲۰۲۶-۰۹-۱۸ — PF-3 رسمی: executor، quality/security evidence و cleanup کامل

- commit جاری `2b4ec6ae389f059cc7eee7cd3b39529fe7f4874e` چرخهٔ `stop`/`cleanup` را اصلاح کرد؛ cleanup پس از stop idempotent است و فقط در project/run مجاز عمل می‌کند.
- harness رسمی `tools/run-product-test-official.mjs` با `createDockerProductRunner` و `createDockerProductExecutor` اجرا شد؛ run `official-pf3-20260918f` برای safe sample در Test، build/test/start/health/stop/cleanup/rollback و no-impact را PASS کرد.
- artifact immutable برابر `hero-product-official-sample@sha256:873bb0e4f49fb8d875232e6478e2a6847c02e3a645b85342c1407b6c858dc884` است؛ SBOM، attestation، test evidence و quality/security evidence در manifest validate شدند.
- quality/security sample gate شامل network `none`، non-root، read-only، no-new-privileges، cap-drop، نبود host escape/secret و redacted output PASS شد؛ browser E2E و dependency scan برای safe sample صادقانه not-applicable ثبت شدند.
- PF-3 sample اکنون `ready-for-owner-acceptance` است. Product واقعی، clean-target portability/recovery، ظرفیت پایدار/reconciliation host، Node Agent، Pilot و Production خارج از این batch باقی ماندند.

# ۲۰۲۶-۰۹-۱۸ — Product Test نمونهٔ بی‌خطر، evidence واقعی و گیت‌های Compose

- authorization جداگانهٔ `PRODUCT-TEST-20260918-001` فقط برای Test ثبت شد؛ Production، Pilot، Secret، Provider زنده و external spend در scope نیستند.
- Product Runner به `testCommand` اجراییِ بدون shell، build network=`none` و flagهای سازگار با نسخهٔ Compose میزبان مجهز شد؛ shell escape و Compose isolation قبل از executor رد می‌شوند.
- نمونهٔ `safe-sample` با run `20260918061633`، source commit `000389632db4644c9288afe69acea42b42383dc1` و artifact immutable `hero-product-safe-sample@sha256:5190827dfc642ffc4d97518de450083890eb3c50f6ac91e3eda18a772d921ef7` چرخهٔ build/test/start/health/stop/cleanup/rollback را با no-impact روی Hero Test و Production با موفقیت گذراند.
- SBOM SPDX، attestation in-toto/SLSA و test evidence redacted تولید و manifest با قرارداد `hero.product-artifact/v1` validate شد؛ evidence در `HERO-EVIDENCE-PRODUCT-FACTORY-PF3-20260918@1.1.0` است.
- گیت باقی‌مانده: official Control Plane executor، ظرفیت پایدار/reconciliation، security/quality gate کامل، promotion commit جدید به Hero Test و Owner acceptance؛ Pilot/Production همچنان جدا و خارج از scope هستند.

# ۲۰۲۶-۰۹-۱۸ — lease lifecycle، capacity probe، immutable artifact و candidate rc.14

- migration `020` و قرارداد lease اضافه شد؛ reservation پایدار و process-local اکنون TTL، heartbeat و reconciliation report-only دارند و expiry بدون تأیید صریح mutation نمی‌کند.
- probe ظرفیت Docker با argv ثابت اضافه شد؛ فقط CPU/RAM metadata امن را مشاهده می‌کند و در خطای Docker یا خروجی نامعتبر fail-closed است.
- قرارداد immutable product artifact برای Test شامل source commit، OCI digest، SBOM، attestation و test-evidence digest اضافه شد و Runner تطبیق digest را enforce می‌کند.
- تست هدفمند برابر `44 pass / 0 fail` و معادل کامل `pnpm check` برابر `447 pass / 0 fail` است؛ build برابر `280 module / 49 JSON` است.
- candidate `v1.1.4-rc.14` با run `35311782701`، commit `c3d1334c03a291baf804ccc190fb75a8f719fd76` و digest `sha256:6fba080967039dde9e884e5c8ca86e8343b6512577061bde55cfdd5dcb006228` با workflow کامل موفق ساخته و منتشر شد؛ promotion آن pending است و rc.12 روی Test فعال است.
- PF-3 از نظر قرارداد source آمادهٔ ورود است، اما Product Test واقعی، artifact واقعی محصول، health/rollback و Owner acceptance هنوز اجرا نشده‌اند؛ Production/Pilot/Secrets و external spend لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — capacity enforcement و candidate rc.13

- قرارداد Capacity snapshot و migration `019` اضافه شد؛ reservation پایدار اکنون CPU، RAM، PID و تعداد اجرای هم‌زمان را با ظرفیت مشاهده‌شده مقایسه می‌کند و ظرفیت ناشناخته یا lease قدیمی ناقص را fail-closed رد می‌کند.
- تست هدفمند PF-2 برابر `32 pass / 0 fail` و معادل کامل `pnpm check` برابر `435 pass / 0 fail` است؛ build برابر `274 module / 49 JSON` است.
- candidate `v1.1.4-rc.13` با run `35310489330` و digest `sha256:1a3b7727c2b969bf80e21f9a41351a05eaeb0e7e27fd06aaacab1e72e0800ebe` ساخته و منتشر شد؛ promotion آن pending است و rc.12 روی Test فعال است.
- Product Test، Production، Pilot، Secret Store/Secret، Provider زنده و external spend لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — promotion موفق rc.12 روی Hero Test

- `v1.1.4-rc.12` با run `35309418424`، commit runtime `d1b4d0600c4a2d360ec4e94266b63efb439cc380` و digest immutable `sha256:a9caf69e2240ec0a211325b1269e8213924eba673b67d039857a3cb17606d39e` فقط روی Hero Test promote و verify شد.
- rc.11 پیش از تغییر pull و به‌عنوان rollback point metadata-only ثبت شد؛ پس از restart، `/health`، `/ready` و `Hero Test smoke check: PASS` ثبت شدند. خطای موقت connection reset در restart با شواهد نهایی سلامت دنبال شد.
- این promotion فقط Hero Test است؛ Product Test، Production، Pilot، Secret Store/Secret، Provider زنده و external spend لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — candidate rc.12 آمادهٔ promotion روی Test

- workflow `35309418424` برای `v1.1.4-rc.12` با commit `d1b4d0600c4a2d360ec4e94266b63efb439cc380` موفق شد؛ artifact immutable برابر `ghcr.io/farhaddgm/hero@sha256:a9caf69e2240ec0a211325b1269e8213924eba673b67d039857a3cb17606d39e` است.
- push branch توسعه موفق بود. Promotion روی host Test هنوز انجام نشده، چون اجرای `sudo` رمز عبور می‌خواهد؛ تا آن زمان rc.11 نسخهٔ فعال Test است.
- Production، Pilot، Secret Store/Secret، Provider زنده، Product Test و external spend لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — رزرو پایدار منابع Product Test در PF-2

- migration `018_product_runtime_reservations` و store PostgreSQL اضافه شد؛ رزروها فقط metadata امن دارند، با advisory transaction lock سریال می‌شوند و replay، تعارض پورت/منبع، release و reuse رکورد را کنترل می‌کنند.
- Runner اکنون storeهای async را پشتیبانی می‌کند و stop/cleanup فقط reservation فعال را می‌پذیرد؛ guard process-local نیز برای fallback وضعیت `active` صریح دارد.
- تست هدفمند PF-2 برابر `26 pass / 0 fail` و معادل کامل `pnpm check` برابر `429 pass / 0 fail` است؛ build برابر `272 module / 49 JSON` و documentation برابر `141 document / 0 error` است.
- commit کد: `73a7b453306d2aa6a467766bfd6c34b99a68e216`. این تغییر هنوز candidate جدیدی روی Test نیست؛ Product Test، Production، Pilot، Secret Store/Secret، Provider زنده و external spend لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — promotion موفق rc.11 روی Hero Test

- `v1.1.4-rc.11` با digest immutable `sha256:7a42b5592e60ae5d8b61c10040ee20d56a22a276bae76e3258920e76ed51bba2`، run `35307457878` و runtime commit `dd95723f6cbd5d4ec75aafb59e72941b185e2e2f` فقط روی Hero Test promote و verify شد.
- پس از restart، `/health` و `/ready` موفق و `Hero Test smoke check: PASS` ثبت شد؛ rollback point metadata-only در `/etc/hero/hero-test.env.release-state.before-7a42b5592e60ae5d8b61c10040ee20d56a22a276bae76e3258920e76ed51bba2.json` ثبت است. خطای موقت connection reset در لحظهٔ restart با شواهد نهایی سلامت دنبال شد.
- این release اجرای Product Test یا محصول هدف نیست؛ Production، Pilot، Secret Store/Secret، Provider زنده و external spend لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — guard رزرو منابع Product Test و candidate rc.11

- افزوده‌شده: reservation guard process-local برای Product Runner؛ تعارض namespace، port و resource پیش از executor fail-closed می‌شود، replay/release کنترل‌شده است و stop/cleanup رزرو held را آزاد می‌کند. این guard جایگزین inventory پایدار host یا رزرو cross-process نیست.
- تست‌شده: تست هدفمند برابر `18/18` و اجرای معادل `pnpm check` برابر `424 pass / 0 fail`؛ build برابر `270 module / 49 JSON` است. یک هشدار مورد انتظار دربارهٔ نبود Docker socket در clean-room باقی است.
- ساخته و منتشر شد: `v1.1.4-rc.11` از commit `dd95723f6cbd5d4ec75aafb59e72941b185e2e2f` با run `35307457878` و digest immutable `sha256:7a42b5592e60ae5d8b61c10040ee20d56a22a276bae76e3258920e76ed51bba2`؛ verification، build، GHCR publish، tag، prerelease، manifest و artifact upload موفق شدند.
- وضعیت هنگام ساخت candidate: Hero Test روی rc.10 بود؛ promotion rc.11 بعداً در entry بالاتر ثبت شد. Product Test، Production، Pilot، Secret Store/Secret، Provider زنده و external spend لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — promotion موفق rc.10 روی Hero Test

- `v1.1.4-rc.10` با digest immutable `sha256:496d740ce2d650c1a02d1fb3f22e2f67f1f8373ec47e6fa528cd2b8a1f6b2257`، run `35292057200` و runtime commit `3fabefe15ff10926d60b804c2deace63fc936397` فقط روی Hero Test promote و verify شد.
- پس از restart، `/health` و `/ready` موفق و `Hero Test smoke check: PASS` ثبت شد؛ rollback point metadata-only در `/etc/hero/hero-test.env.release-state.before-496d740ce2d650c1a02d1fb3f22e2f67f1f8373ec47e6fa528cd2b8a1f6b2257.json` ثبت است. خطای موقت connection reset در لحظهٔ restart با شواهد نهایی سلامت دنبال شد.
- این release اجرای Product Test یا محصول هدف نیست؛ Production، Pilot، Secret Store/Secret، Provider زنده و external spend لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — candidate rc.10 برای بررسی PF-2

- ساخته و منتشر شد: `v1.1.4-rc.10` از commit `3fabefe15ff10926d60b804c2deace63fc936397` با run `35292057200` و digest immutable `sha256:496d740ce2d650c1a02d1fb3f22e2f67f1f8373ec47e6fa528cd2b8a1f6b2257`؛ workflow verification، build، GHCR publish، tag و manifest همگی موفق شدند.
- وضعیت: Hero Test فعلاً روی rc.9 است؛ promotion rc.10 به‌علت نبود دسترسی SSH از محیط Codex انجام نشد و باید با همان manifest روی host Test اجرا شود.
- مرز: این candidate فقط برای Test است؛ Product container/Product Test، Production، Pilot، Secret، Provider live، external spend و سرویس‌های دیگر host لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — adapter گیت‌دار Product Runner در PF-2

- افزوده‌شده: قرارداد نسخه‌دار Product Runner و endpoint metadata-only برای actions، authorization operationهای جدا و decision codeهای قابل‌ردگیری.
- افزوده‌شده: adapter Docker برای workspace مستقل محصول با Compose preflight، argv-only/shell-free، digest immutable، network `none`، non-root، read-only، no-new-privileges، cap-drop، quotaهای CPU/RAM/PID، timeout، concurrency و redaction خروجی.
- اصلاح‌شده: approval Foundation اکنون وضعیت `runtimePlan` را نیز از `proposed` به `approved` می‌برد؛ مسیر معتبر دیگر به‌اشتباه برای Runner غیرقابل‌اجرا نمی‌ماند. بررسی زنجیرهٔ workspace و Compose security نیز fail-closed شد.
- تست: `tests/product-runner-adapter.test.mjs` برابر ۱۲/۱۲ و regression ترکیبی برابر ۴۴/۴۴ موفق شد؛ full check معادل `pnpm check` برابر ۴۱۸/۴۱۸، build برابر ۲۶۸ module و ۴۹ JSON، و documentation برابر ۱۴۱ سند و ۰ خطا ثبت شد.
- مرز: executor در Control Plane پیش‌فرض خاموش است؛ هیچ Product container، Product Test، host reservation، Secret، Provider live، external spend، Pilot، Production یا سرویس دیگر host لمس نشد.
- commit کد: `c22d556c2bb08d10e160dbdd1536a4eb1870965c`؛ این تغییر هنوز به‌عنوان Product Test اجرا نشده است.

# ۲۰۲۶-۰۹-۱۸ — سخت‌گیری قرارداد و admission در PF-2

- افزوده‌شده: اعتبارسنجی نسخه‌دار برای timeout، هم‌زمانی، CPU، حافظه، PID، پورت و host-mount در runtime plan محصول؛ سقف‌ها به‌صورت fail-closed به Test محدود هستند.
- اصلاح‌شده: admission دیگر `bridge` را برای طرح network-disabled، مسیر میزبان با host-mount خاموش یا quota بالاتر از plan نمی‌پذیرد؛ malformed plan نیز بدون exception و بدون side effect رد می‌شود.
- Evidence: targeted PF-2 برابر `20/20` و اجرای معادل `pnpm check` در Linux container برابر `406 pass / 0 fail`، build برابر `265 module / 49 JSON`؛ زیرگام contract/admission ثبت شد، اما Product Runner واقعی، Product Test و start کانتینر هنوز باز هستند.
- commit کد: `788746c`. این تغییر فقط روی source/تست اعمال شد؛ Production، Pilot، Secret، Provider زنده، external spend و اپ‌های دیگر host لمس نشدند.
- candidate Test `v1.1.4-rc.9` از run `35289669314` با commit `e8de500e4278b1f4cf805e87c02d62ce05847709` و digest `sha256:499d00f88ac705f2b47d221d4396887291f7293c4d8c6ca7b67dff764b7c0b12` promote و verify شد؛ container healthy، restart count صفر، `/health` و `/ready` هر دو ۲۰۰ و rc.9 نسخهٔ فعال Test است.

# ۲۰۲۶-۰۹-۱۸ — تأیید نهایی PF-1 روی Test

- `v1.1.4-rc.8` با digest `sha256:e87e6063975fdea86d81682f19668a6458209afc3aeaff77cfeb896478d1d8ee` از run `35287418094` روی Hero Test promote و smoke شد؛ container `healthy`، restart count صفر، `/health` و `/ready` هر دو ۲۰۰ و PostgreSQL آماده است.
- سناریوهای واقعی PF-1 ثبت شدند: ایجاد C و D هرکدام ۲۰۱، replay هرکدام ۲۰۰، تغییر داده با همان idempotency key برابر ۴۰۹، درخواست بدون مجوز برابر ۴۰۱ و replay/repair رکوردهای قدیمی A و B هرکدام ۲۰۰.
- شمارش امن Test برای PF-1: ۴ Product Request، ۴ Project و ۴ Foundation؛ Exit Gate PF-1 تا Foundation Proposal `verified` شد.
- PF-2، ساخت repository/container محصول، Product Runner، deploy محصول، انتقال به سرور دیگر، Pilot و Production همچنان خارج از این گام هستند.

# ۲۰۲۶-۰۹-۱۸ — audit ریشه‌ای persistence و candidate rc.8

- ریشه‌یابی شد: rc.6 بعد از restart به‌علت حذف `productRequest.projectId` از read model با `Product request metadata is invalid` crash-loop می‌شد؛ read model اصلاح شد و regression test اضافه شد.
- اصلاح شد: ثبت Product Request، Project و Foundation اکنون در یک تراکنش PostgreSQL انجام می‌شود و خطای مرحلهٔ Foundation هر دو metadata قبلی را rollback می‌کند؛ replay امن برای رکوردهای نیمه‌ثبت‌شده فقط Foundation گمشده را repair می‌کند.
- تأیید شد: targeted persistence/API برابر `24/24` و full assurance برابر `404 pass / 0 fail`، build برابر `265 module / 49 JSON` و documentation برابر `140 document / 0 error` است.
- ساخته شد: candidate تست `v1.1.4-rc.8` از run `35287418094`، commit `790bfe8097236e285fcf9cb8f6699dc62f5e07b4` و digest `sha256:e87e6063975fdea86d81682f19668a6458209afc3aeaff77cfeb896478d1d8ee`؛ promotion به Test به‌علت نیاز به sudo هنوز pending است.
- وضعیت صریح: Test فعلاً روی rc.6 crash-loop است؛ پس از promotion rc.8 باید smoke، replay repair و دو درخواست مستقل PF-1 اجرا و ثبت شود. Production، Pilot، Secret و Provider زنده لمس نشدند.

# ۲۰۲۶-۰۹-۱۸ — اصلاح مسیر Idempotency-Key و آماده‌سازی rc.5

- اصلاح‌شده: route ساخت Product Request اکنون هدر `Idempotency-Key` را مطابق API Node HTTP از object هدر می‌خواند؛ خطای قبلی `request.headers.get is not a function` و پاسخ 500 رفع شد.
- تست‌شده: تست header-only و بدنهٔ نامعتبر اضافه شد؛ targeted `16/16` و `pnpm check` برابر `400 pass / 0 fail` است.
- ساخته‌شده: کاندیدای Test `v1.1.4-rc.5` از run `35283381777` با digest `sha256:4e8bb963f6036d3663b7173613a1f47a122de78b77b5dd08d26441125e7c13a8`؛ promotion به Test به‌علت نیاز به رمز sudo باقی مانده است.
- تا زمان promotion، Runtime Test روی rc.4 است؛ هیچ Production، Pilot، Secret یا Provider زنده لمس نشد.

# ۲۰۲۶-۰۹-۱۸ — Promotion کاندیدای PF-1 و تأیید migration در Test

- کاندیدای `v1.1.4-rc.4` از GitHub Actions run `35280773195` با digest immutable `sha256:3b3685cb448ee18c1c7e635c70722f5c138cd0d3b4abfe8bb3c234a0e6ac3677` فقط روی Hero Test promote شد.
- شواهد واقعی بعد از restart: container در وضعیت running، `/health` و `/ready` موفق، و `Hero Test smoke check: PASS`.
- migration `017` و جدول `product_request_versions` در PostgreSQL Test تأیید شدند؛ تعداد رکورد Product Request هنگام بررسی `0` بود، پس Exit Gate PF-1 هنوز باز است.
- Production، Pilot، Secret Store، Secretهای Provider، Product Runner، Product Test و Provider زنده لمس نشدند؛ GHCR/Actions فقط در scope انتشار Test استفاده شدند.

# ۲۰۲۶-۰۹-۱۸ — Product Request پایدار و idempotent در PF-1

- افزوده‌شده: جدول append-only `product_request_versions` و migration `017` برای نگهداری metadata امن Product Request، fingerprint و کلید idempotency یکتا؛ فرم خام، Secret و credential ذخیره نمی‌شوند.
- افزوده‌شده: ایجاد Product Request و Project در PostgreSQL با تراکنش مشترک؛ خطای میانی با rollback کامل متوقف می‌شود.
- اصلاح‌شده: API ساخت پروژه کلید idempotency را از body یا هدر `Idempotency-Key` می‌پذیرد؛ replay همان داده پاسخ ۲۰۰ می‌دهد و تغییر داده با همان کلید fail-closed با ۴۰۹ رد می‌شود.
- شواهد: targeted برش `۲۰/۲۰` و `pnpm check` برابر `۴۰۰ pass / ۰ fail`، build برابر `۲۶۵ module / ۴۹ JSON` و documentation برابر `۱۴۰ document / ۰ error`.
- commit کد: `e17b9f79bfec10620067531a62c4bc2a16ee8d31`. PF-1 هنوز تا migration/restart واقعی Test و دو درخواست مستقل project-scoped در وضعیت `in_progress` است؛ هیچ Product Runner، deployment، Secret، Provider زنده، external spend، Pilot یا Production لمس نشد.

# ۲۰۲۶-۰۹-۱۷ — پیاده‌سازی برش اول PF-1 کارخانهٔ کنترل‌شدهٔ محصول

- افزوده‌شده: قرارداد و منطق provider-agnostic برای Intake محصول، طبقه‌بندی محافظه‌کارانهٔ ریسک (`low/standard/high/critical`)، علت‌های قابل‌فهم و گیت تأیید صریح Owner برای ریسک بالا/بحرانی.
- افزوده‌شده: Foundation Proposal اکنون runtime plan نسخه‌دار برای Product Test ایزوله دارد: repository/Compose/database/volume/network مستقل، network و port پیش‌فرض بسته، resource quota، non-root/read-only/no-new-privileges و همهٔ side effectها خاموش تا authorization بعدی.
- اصلاح‌شده: Portfolio فیلدهای نوع محصول، سطح ریسک، محدودیت، خروجی و flagهای ریسک را می‌گیرد؛ Product Studio ارزیابی ریسک، گیت‌ها، طرح runtime و اثرهای قفل‌شده را نمایش می‌دهد.
- Evidence source: `pnpm check` برابر `398 pass / 0 fail`، build برابر `265 module / 49 JSON`، documentation برابر `140 document / 0 error`. Exit Gate PF-1 هنوز به‌دلیل نبود دو Product Request مستقل و persistence/replay کامل `open` است.
- commit کد این برش: `56c45ab6266f475fc53fa2000849de0d7fef8d0a`؛ commit مستندات پس از ثبت آن در همین شاخه درج می‌شود.
- برش PF-2 طراحی: admission policy پیش از اجرای runtime افزوده شد تا host network/path، collision پورت/منبع و quota ناامن را fail-closed رد کند؛ بدون start یا side effect. commit کد: `ac26f49cbf28f68e776653969e6c6cd6d2d4dee6`.
- هیچ Product Runner، container، server خارجی، deploy، Secret، Provider زنده، external spend، Pilot یا Production در این برش لمس نشد.

# ۲۰۲۶-۰۹-۱۷ — رودمپ کنترل‌شدهٔ کارخانهٔ محصول و تصحیح وضعیت Test

- وضعیت canonical به `HERO-ROADMAP-STATUS-20260917@1.1.0` تصحیح شد: Hero Test اکنون `v1.1.4-rc.3` با digest `sha256:996da1112d0c30ec419fb7ace035f2cb2106191a41cb4eb1d08c1e09a37f4896` است؛ GitHub run `35266951191`، promotion Owner و smoke واقعی موفق‌اند. نتیجهٔ source همان candidate `394 pass / 0 fail` و build `263 module / 49 JSON` است.
- `HERO-ROADMAP-CONTROLLED-PRODUCT-FACTORY-20260917@1.0.0` به‌عنوان sequencing فعال اضافه شد. مسیر مسئله تا Proposal، runner ایزوله، Product Test، artifact immutable، انتقال/recovery و Target خارجی را با Exit Gateهای جدا تعریف می‌کند.
- امکان آیندهٔ اجرای محصول روی همان host ParsPack فقط با namespace و resourceهای مستقل Product (repo/worktree، Compose project، network، volume، database، port، Secret reference، quota و rollback) پذیرفته است؛ Docker socket، privileged، host network/mount و reuse منابع Hero ممنوع‌اند.
- چهار roadmap تاریخی Next برای sequencing superseded شدند، اما جدول‌ها و evidence آن‌ها حذف نشد. برنامهٔ ۱۷۰ گام Back Office `active` و هنجاری باقی ماند؛ Pilot اکنون صریحاً بعد از BO-169 و مجوز مستقل است.
- هیچ Product Runner، server خارجی، deploy محصول، Secret، Provider واقعی، هزینهٔ بیرونی، Pilot یا Production در این تغییر ایجاد یا فعال نشد. evidence تازهٔ live OpenAI نیز ادعا نشده است.

# ۲۰۲۶-۰۹-۱۷ — snapshot تاریخی پیش از rc.3 (superseded by entry above)

- سند مرجع وضعیت جاری به `HERO-ROADMAP-STATUS-20260917@1.0.0` ارتقا یافت و وضعیت source، Runtime Test، Release، AI live و تمام گیت‌های باز را یکجا ثبت کرد.
- source فعلی `cd4df73aa72341b0596ad3fbe117c9fc36742017` است؛ Runtime Test هنوز روی `v1.1.2` با digest `sha256:641e6c75b5f871e87053cf2d959fe250a20067b8ecc7fe0571e15345f31c0d10` اجرا می‌شود.
- Smoke Test مالک برای artifact فعلی `PASS` است؛ مسیر عمومی `/build-info` به‌دلیل allowlist فعلی Caddy هنوز `404` است و به‌عنوان گیت observability باز ثبت شد.
- ممیزی جاری همچنان `20 verified / 150 remaining` برای ۱۷۰ گام و `5 implemented / 76 partial / 0 missing` برای ۸۱ نیازمندی است؛ این اعداد بدون Evidence جدید ارتقا داده نمی‌شوند.

# ۲۰۲۶-۰۹-۱۷ — Smart Tester 1.5 و تشخیص قابل‌اقدام (source snapshot تاریخی)

- نسخهٔ Smart Tester در source به `1.5.0` رسید؛ گزارش خطا اکنون نتیجهٔ کوتاه و قابل‌اقدام («چه اتفاقی افتاد؟»، «چرا؟»، «چه‌کار کنم؟»، «بعد از اصلاح») می‌دهد و جزئیات حساس یا غیرقابل‌اثبات را نمایش نمی‌دهد.
- ثبت تشخیص پس از تأیید Owner در سند project-scoped خطا به‌صورت append-only باقی می‌ماند؛ مسیر live Provider فقط با Profile/Binding فعال، Health، Cost Catalog و authorization دقیق مجاز است.
- این اصلاحات روی source جاری هستند و تا انتشار artifact جدید، در Runtime Test نسخهٔ `v1.1.2` فعال نشده‌اند.

# ۲۰۲۶-۰۹-۱۷ — Walk-Through و Smart Tester: orchestration ایمن و release gate (source snapshot تاریخی)

- تکمیل‌شده در source: هر دو capability از Back Office به AI Orchestration، context/role/policy، Profile/Binding و Provider adapter می‌رسند؛ UI به Provider خاص وابسته نیست و نتیجهٔ live با schema `analysis-v1`، evidence متادیتایی امن و usage/cost/latency قابل‌ردیابی برمی‌گردد.
- اصلاح‌شده: timeout با abort در HTTP adapter، retry محدود، provider/network/invalid-output failure، redaction credential و fail-closed برای Role/Tool Policy/authorization/Binding اعمال شد. Smart Tester برای ثبت durable خطا به `project.write` نیاز دارد و اجرای live همچنان side-effect مستقل ندارد.
- تأیید source: branch `codex/test-release-reliability-20260916`، implementation commit جاری `cd4df73aa72341b0596ad3fbe117c9fc36742017` و اجرای source-snapshot برابر ۳۹۰ pass و ۰ fail؛ build مرجع نیز verification را گذراند، اما artifact این commit به GHCR publish نشده و release محسوب نمی‌شود.
- وضعیت release: Test روی artifact قبلی `1.1.2` و digest قبلی باقی ماند؛ GHCR publish candidate به‌دلیل `permission_denied` و scope ناکافی token انجام نشد، پس tag/manifest/promotion جدید وجود ندارد.
- وضعیت live: authorization و Test Secret Store metadata حاضر است، ولی Profile/Binding فعال برای Project `hero` در snapshot AI وجود ندارد؛ Walk-Through و Smart Tester واقعی اجرا نشدند و هیچ Provider، Secret، هزینه یا prompt/response حساسی لمس/ذخیره نشد.

# ۲۰۲۶-۰۹-۱۵ — AI Connections 1.1.1 و مسیر دسترسی روشن

- اصلاح‌شده: سرصفحهٔ صفحهٔ «اتصال‌های AI» اکنون دکمهٔ مستقیم `رفتن به ثبت امن کلید` دارد که فرم Owner-only `ثبت امن کلید Provider` را در همان صفحه باز می‌کند.
- اصلاح‌شده: راهنمای عملیاتی و راهنمای Walk-Through به مسیر canonical نشست انسانی `/api/portal?surface=ai#ai` اشاره می‌کنند؛ مسیرهای legacy `/backoffice` و `/portfolio` برای این کار توصیه نمی‌شوند.
- build تأییدشده: image محلی `hero-control-plane:test-1.1.1` با digest `sha256:4e3262837bbc264d16dfad3e05cf6271c8de61e205cbb28f00a3d2c3fd2ae804` ساخته شد؛ این artifact هنوز به Runtime عمومی Test promotion نشده است.
- مرز: این تغییر فقط کشف‌پذیری UI و مستندات است؛ هیچ Secret، Provider زنده، هزینه، استقرار بیرونی یا Production تغییر نکرد.

## ۲۰۲۶-۰۹-۱۵ — Test Secret Store و ثبت امن کلیدهای AI 1.1.0

- افزوده‌شده: Secret Store داخلیِ رمزنگاری‌شدهٔ AES-256-GCM برای محیط Test، با volume خصوصی، master key تصادفی ۳۲ بایتی، فایل‌های `0600`/دایرکتوری‌های `0700`، نوشتن atomic و جلوگیری از symlink/path escape.
- افزوده‌شده: فرم Owner-only در «اتصال‌های AI» برای ثبت یا جایگزینی کلید OpenAI/ChatGPT، Claude، Gemini، Cursor و OpenAI-compatible. مقدار خام پس از ارسال پاک می‌شود و فقط وضعیت، نسخه و مرجع `vault:hero/test/...` قابل مشاهده است.
- افزوده‌شده: APIهای `GET/POST /api/ai/credentials` و `GET/POST /api/ai/credentials/:provider/status|health` با نشست انسانی، MFA/step-up، CSRF same-origin و پاسخ‌های بدون Secret. Resolver سرویس‌ها اکنون مرجع Vault را در زمان اجرا می‌خواند و health check بدون شبکه/Token انجام می‌شود.
- اصلاح‌شده: resolverهای Provider هم قرارداد synchronous و هم asynchronous را به‌درستی پشتیبانی می‌کنند؛ خطای health قبلی برای Providerهای OpenAI/Claude/Gemini در مسیر محلی رفع شد.
- قرارداد محیط: `HERO_SECRET_STORE_ENABLED=true` فقط برای Test و `false` برای Production؛ مسیر و master key در مثال‌ها secret-free هستند. راهنمای کاربر در `docs/operations/HERO-TEST-AI-SECRET-STORE.md` ثبت شد.
- تأیید source: تست‌های رمزنگاری/نسخه‌گذاری/ضد symlink، API Owner و parity محیط اضافه شدند؛ استقرار یا تغییر کلید واقعی انجام نشده است.

## ۲۰۲۶-۰۹-۱۴ — Walk-Through 1.8.0 و انتخاب مشترک AI

- افزوده‌شده: انتخاب‌گر «AI و نسخه» دوباره به پنجرهٔ مشاورهٔ Walk-Through افزوده شد؛ گزینه‌ها از API پروژه‌محور کاتالوگ اتصال‌های AI خوانده می‌شوند، فقط Profileهای Active و آماده قابل انتخاب‌اند و انتخاب معتبر برای همان پروژه در مرورگر حفظ می‌شود.
- اصلاح‌شده: درخواست مشاوره، Profile انتخاب‌شده را با همان مرز Project Scope به API می‌فرستد. راهنمای محلی Hero همچنان fallback بدون هزینه است؛ انتخاب Profile زنده به‌تنهایی Provider را dispatch نمی‌کند و همچنان نیازمند Health، سقف هزینه و مجوز External Spend مستقل است.
- تأییدشده: `pnpm check` با ۳۷۱ تست موفق، بررسی اسناد و build موفق؛ image تازه فقط در Test مستقر شد و `/health` و `/ready` هر دو پاسخ ۲۰۰ دادند. هیچ Secret، Provider زنده، هزینه یا Production تغییر نکرد.

## ۲۰۲۶-۰۹-۱۴ — Walk-Through 1.7.1 و ناوبری کناری

- اصلاح‌شده: همهٔ گزینه‌های ناوبری سراسری از هدر به نوار کناری ثابت منتقل شدند. خود نوار مستقل از محتوای صفحه اسکرول عمودی دارد و در viewport کوچک به بلوک بالای محتوا با ارتفاع محدود تبدیل می‌شود؛ بنابراین تعداد گزینه‌ها هرگز چیدمان هدر یا صفحه را به‌هم نمی‌زند.
- اصلاح‌شده: مسیر شماره‌دار توسعهٔ محصول اکنون ۱۳ گام دارد و از «انتخاب یا ایجاد پروژه» آغاز می‌شود. ورود انسانی و مدیریت اعضا/Grant قابلیت‌های پشتیبان‌اند، در راهنمای کامل دیده می‌شوند، اما در شمارش و Bubble فرایند اصلی قرار نمی‌گیرند.
- اصلاح‌شده: پس از هر ورود انسانی Owner، Walk-Through از گام نخست فعال می‌شود. بستن کامل فقط تا خروج یا ورود بعدی همان Owner معتبر است و در tabهای همان مرورگر همگام می‌شود. Refresh، رندر پویا و بازگشت از نشان کمینهٔ H، state فعال را از بین نمی‌برند.
- ساده‌سازی: Bubble راهنما فقط «گام x از y»، نام، شرح کوتاه و کنترل‌های عملیاتی را نمایش می‌دهد؛ پیام‌های وضعیت داخلی فقط برای دسترس‌پذیری نگهداری می‌شوند و روی پنجره دیده نمی‌شوند. پنجرهٔ مشاوره هنگام بازشدن خالی است؛ بعد از پرسش، تحلیل محلی با Scope، گام، کنترل‌های مرتبط و گیت واقعی همان نقطه پاسخ می‌دهد. متن آماده و پیشنهاد/پیش‌پرکردن فرم حذف شدند؛ انتخاب‌گر Profile در نسخهٔ 1.8.0 با کاتالوگ مشترک بازگشت.
- ایمنی: هیچ‌یک از تغییرها اتصال Provider، Secret، هزینه، Dispatch، GitHub، سرور یا Production را فعال نمی‌کند.

## ۲۰۲۶-۰۹-۱۴ — Action Feedback 1.3: نتیجهٔ پایدار و قابل‌انتقال

- اصلاح‌شده: پنجرهٔ نتیجهٔ هر اقدام فرایندی، دو کنترل صریح «انتقال به لبهٔ چپ» و «انتقال به لبهٔ راست» دارد. انتخاب لبه فقط در مرورگر همان ادمین نگهداری می‌شود و در محتوای پروژه یا Audit تغییری ایجاد نمی‌کند.
- اصلاح‌شده: نتیجهٔ پاک‌سازی‌شدهٔ آخرین اقدام در `sessionStorage` همان tab نگهداری می‌شود؛ پس با redirect، رفتن به صفحهٔ بعد یا refresh عادی حذف نمی‌شود. فقط «ادامه» در نتیجهٔ موفق یا «بستن» در نتیجهٔ ناموفق آن را پاک می‌کند.
- رفتار: این پنجره کاملاً اطلاع‌رسان است؛ fetch، ثبت، تأیید، رد یا هر فرایند دیگر را متوقف یا منتظر کلیک نمی‌گذارد. در خطا، بازکردن Smart Tester پنجرهٔ نتیجه را نیز نمی‌بندد تا مسیر و گزارش خطا هم‌زمان قابل مشاهده بمانند.
- امنیت: متن ماندگار طول‌محدود و redacted است؛ Secret، رمز، Token و Credential در آن ذخیره نمی‌شود.

## ۲۰۲۶-۰۹-۱۴ — Smart Tester 1.3: زمینهٔ دقیق Box و گفت‌وگوی پایدار

- اصلاح‌شده: با هر نشان `✦`، عنوان واقعی همان Box و یک توضیح کوتاه از نقش آن در جریان Hero به Smart Tester فرستاده می‌شود. پاسخ، گزارش و دفتر خطا نیز به همان `boxId` محدود می‌مانند؛ بنابراین دو Box هم‌سطح دیگر context یا گزارش یکدیگر را نمی‌گیرند.
- اصلاح‌شده: بالای پنل فقط عنوان Box و توضیح یک‌خطی آن نمایش داده می‌شود. پیام عمومیِ «زمینه/featureKey» و پیام آغازین اضافی حذف شده‌اند؛ محتوای ناحیهٔ اسکرول فقط گفت‌وگو و گزارش‌های صریح کاربر است.
- اصلاح‌شده: پنل اکنون پنج ردیف صریح دارد و ناحیهٔ پیام‌ها تنها بخش انعطاف‌پذیر و اسکرول‌پذیر آن است. شکستن کلمه، حد عرض و `min-width: 0` برای پیام‌ها، گزارش‌ها و کنترل‌ها اعمال شده تا پاسخ بلند یا متن بدون فاصله از کادر خارج نشود.
- امنیت: عنوان/توضیح Box طول‌محدود و پاک‌سازی می‌شوند و الگوی Secret یا Credential در آن‌ها پذیرفته نمی‌شود. متن گفت‌وگو همچنان persist نمی‌شود.
- تأیید source: تست‌های Smart Tester، UI و مسیر نشست انسانی برای context دقیق Box، گزارش، advice و خطایاب افزوده/به‌روزرسانی شدند؛ استقرار Test فقط پس از عبور `pnpm check` انجام می‌شود.

## ۲۰۲۶-۰۹-۱۴ — AI Connections 1.0: اتصال کنترل‌شده و نقشهٔ تخصیص پروژه

- افزوده‌شده: صفحهٔ «اتصال‌های AI» اکنون کارت راه‌اندازی برای OpenAI/ChatGPT، Anthropic/Claude، Google/Gemini و Cursor Cloud Agent دارد. هر کارت وضعیت ثبت، حالت اجرا، آخرین تست آماده‌بودن، تعداد Model/Profile و مصرف ثبت‌شده را روشن نشان می‌دهد.
- افزوده‌شده: `POST /api/ai/providers/:providerId/health` با نشست انسانی Owner، یک Health check بدون افشای Secret و بدون فراخوانی Model/مصرف Token ثبت می‌کند. اگر Profile وجود داشته باشد، فقط شناسهٔ آن ارسال می‌شود و credential reference داخل سرور resolve می‌شود.
- افزوده‌شده: «نقشهٔ تخصیص AI در پروژه» Roleهای هر Project، Provider/Model، Profile version، وضعیت اتصال و Bindingهای Team/Skill را جداگانه نشان می‌دهد و دکمهٔ «تغییر نسخه» فرم Binding جایگزین را با `supersedesBindingId` آماده می‌کند.
- یکپارچه‌سازی: Walk-Through فقط Profileهای Active و project-bound با Provider آماده را در مشاوره نشان می‌دهد؛ Smart Tester فقط Profileهای Active و متصل Hero را نشان می‌دهد. Cursor در این نسخه Coding Agent مخزن‌محور است و عمداً در انتخاب‌گر گفت‌وگوی مستقیم ظاهر نمی‌شود.
- امنیت و مرز: UI هرگز API key را دریافت، نمایش یا در Event ذخیره نمی‌کند. تست کارت فقط readiness محلیِ credential/policy است؛ Provider زنده، Agent Cursor، هزینه، Dispatch، GitHub، Server، Pilot و Production همچنان گیت و مجوز مستقل دارند.
- تأیید نهایی در source: `pnpm check` با ۳۷۰ تست موفق، build ۲۵۳ module/۴۶ JSON و بررسی مستندات ۱۳۴ سند/صفر خطا گذشت. تست اختصاصی Cursor ثبت Provider و Health بدون شبکه/Secret را نیز تأیید می‌کند.

## ۲۰۲۶-۰۹-۱۴ — Smart Tester 1.2: نتیجهٔ اقدام و تحلیل خطای زمینه‌مند

- افزوده‌شده: تمام دکمه‌ها و فرم‌های فرایندیِ mutation پس از پاسخ سرویس، یک پنجرهٔ شناور مشترک با وضعیت موفق/ناموفق، متن نتیجه و کنترل ادامه یا بستن نشان می‌دهند؛ دکمه‌های ناوبری و خواندنی عمداً مستثنا هستند.
- افزوده‌شده: در خطای اقدام، «تحلیل با اسمارت تستر» همان Box، Scope، مسیر API و خطای پاک‌سازی‌شده را به Smart Tester منتقل می‌کند؛ «خطایاب» و «ثبت در دفتر خطا» گزارش دقیق و project-scoped می‌سازند.
- اصلاح‌شده: مشاهده‌گر نتیجه، فقط mutationهای same-origin را که با submit/action واقعی مسلح شده‌اند دنبال می‌کند؛ درخواست‌های Smart Tester، مشاوره و مسیرهای خواندنی popup کاذب ایجاد نمی‌کنند.
- تأیید نهایی در Test: build با ۳۶۸ تست موفق، health/readiness هر دو `200`؛ advice خطای اقدام را دریافت و diagnose یافتهٔ `smart-tester.action-failure` تولید کرد؛ نشست آزمایشی Owner با موفقیت revoke شد.
- مرز: فقط Control Plane محیط Test پس از عبور تست‌ها بازسازی می‌شود؛ Production، Provider زنده، Secret، هزینه و عملیات بیرونی تغییری نمی‌کنند.

## ۲۰۲۶-۰۹-۱۴ — Smart Tester 1.1: context canonical، انتخاب AI و دفتر خطا

- اصلاح‌شده: Smart Tester در Portal canonical اکنون surface واقعی (`/command`، `/ai`، `/workspace` و دیگر سطوح) را به‌جای مسیر عمومی `/api/portal` به backend می‌فرستد؛ پیام نادرست «زمینه در دسترس نیست» برای این صفحات رفع شد.
- افزوده‌شده: پنجرهٔ Smart Tester فهرست امن Provider، Model و Profile/نسخه‌های فعال را نشان می‌دهد و انتخاب Owner را به مشاورهٔ همان Scope منتقل می‌کند؛ Provider زنده یا هزینه بدون گیت مستقل فراخوانی نمی‌شود.
- افزوده‌شده: دکمهٔ «خطایاب» Probe تازه و مستقل اجرا می‌کند و گزارش دقیق شامل یافته، شدت، شاهد، انتظار، پیشنهاد، فایل مسئول، گام بازتولید و محدودیت‌ها می‌سازد؛ متن خام گفتگو و Secret هرگز وارد گزارش نیست.
- افزوده‌شده: پس از تأیید Owner، گزارش در سند append-only project-scoped با شناسهٔ `smart-tester-errors:<projectId>` ثبت می‌شود و در PostgreSQL جدول `smart_tester_error_documents` دارد.
- تأیید نهایی در Test: image نهایی با ۳۶۷ تست موفق ساخته شد؛ health/readiness هر دو `200`، ورود Owner و MFA و نشست cookie موفق؛ context برای Workspace/مرکز فرمان/اتصال‌های AI، run، advice و diagnose همگی `200`؛ ثبت دفتر خطا `201` و یک رکورد واقعی برای `project-vpn` در PostgreSQL؛ revoke نشست نیز `200`.
- مرز: فقط Control Plane محیط Test پس از عبور تست‌ها بازسازی می‌شود؛ Production، Provider زنده، Secret، هزینه و عملیات بیرونی تغییری نمی‌کنند.

## ۲۰۲۶-۰۹-۱۴ — Walk-Through 1.6.4: بازیابی مقاوم H در رندر پویا

- اصلاح‌شده: restore هنگام کلیک روی H، state را دوباره با surface واقعی صفحه تطبیق می‌دهد؛ state قدیمی دیگر به هدفی از پروژهٔ قبلی اشاره نمی‌کند.
- اصلاح‌شده: در فاصلهٔ بارگذاری یا جایگزینی کارت هدف، H حفظ می‌شود و observer/retry پس از آماده‌شدن هدف coach را نصب می‌کند؛ پنجره دیگر به launcher بی‌اثر تبدیل نمی‌شود.
- مرز: فقط Control Plane محیط Test بازسازی می‌شود؛ Production، Secret، Provider، هزینه، gateway و عملیات بیرونی تغییر نمی‌کنند.

## ۲۰۲۶-۰۹-۱۴ — Walk-Through 1.6.3: بازگشت مطمئن نشان H میان صفحه‌های پروژه

- اصلاح‌شده: پس از انتخاب یک پروژه از Portfolio، state راهنما دیگر روی گام «انتخاب پروژه» باقی نمی‌ماند وقتی مرورگر به Studio، Workspace، Command یا Operations رفته است؛ state با surface واقعی مقصد همگام می‌شود.
- اصلاح‌شده: کلیک روی کارت پروژه هنگام فعال‌بودن راهنما، گام مناسب مقصد را در همان لحظه ثبت می‌کند. بنابراین coach هدف همان صفحه را پیدا می‌کند و نشان کمینهٔ `H` با کلیک دوباره قابل بازکردن است.
- افزوده‌شده: نسخهٔ سرویس به `1.6.3` ارتقا یافت؛ وضعیت، Project ID و ترجیح لبه همچنان فقط در localStorage همان مرورگر می‌مانند و هیچ دادهٔ پروژه‌ای تغییر نمی‌کند.
- مرز: فقط Control Plane محیط Test بازسازی می‌شود؛ Production، Secret، Provider، هزینه، gateway و عملیات بیرونی تغییر نمی‌کنند.

## ۲۰۲۶-۰۹-۱۴ — Identity Entry 1.6.3: رفع قطعی مسیر ورود Test

- اصلاح‌شده: نشانی رسمی ورود Test اکنون `https://test.hero.beeproject.ir/api/portal?surface=identity` است. این Portal مستقیماً فرم Human Identity را نمایش می‌دهد و به کاربر روشن می‌گوید که Username/Password مربوط به پنجرهٔ قدیمی Basic را در فرم Email/Password وارد نکند.
- اصلاح‌شده: فایل دسترسی خصوصی Test با همین نشانی canonical بازتولید می‌شود، Gate 1 قدیمی را صریحاً legacy می‌نامد و Gate 2 (Email/Password انسانی) و Gate 3 (کد شش‌رقمی Authenticator) را جدا می‌کند. bundle با مالک کاربر میزبان و مجوز `0600` ساخته می‌شود.
- تأییدشده در Test: health/readiness، نمایش Portal و متن تفکیک Gateها، ورود واقعی انسانی، MFA، cookie شش‌ساعته، دسترسی نشست و revoke نشست آزمایشی از دامنهٔ عمومی Test موفق بودند. Basic Auth و Secretهای موجود rotate نشدند.
- مرز: Production و gateway بیرونیِ legacy تغییر نکردند. مسیرهای legacy که پنجرهٔ Basic نشان می‌دهند، ورودی رسمی حساب انسانی نیستند و نباید برای ورود به Portal استفاده شوند.

## ۲۰۲۶-۰۹-۱۴ — Walk-Through 1.6.2 و Browser Portal نشست انسانی

- اصلاح‌شده: ناوبری داخلی Back Office، Portfolio، Studio، Workspace، Operations، Guide و «اتصال‌های AI» اکنون از مسیر canonical `/api/portal?surface=…` استفاده می‌کند. این مسیر فقط نشست Human Identity شش‌ساعتهٔ cookie-based را می‌پذیرد و Basic Auth هرگز به Principal یا مجوز پروژه تبدیل نمی‌شود؛ بنابراین ناسازگاری یک رمز قدیمی در لایهٔ Basic، کاربرِ واردشده را دوباره به فرم ورود برنمی‌گرداند.
- اصلاح‌شده: لینک‌های پویای Workspace پس از بازخوانی داده نیز به Portal هدایت می‌شوند؛ دیگر بازسازی UI نمی‌تواند کاربر را به مسیر legacy و درخواست دوبارهٔ Basic ببرد.
- اصلاح‌شده: بازگرداندن راهنمای کمینه‌شده با نشان `H` از state درون‌صفحه‌ای هم پشتیبانی می‌کند، state کمینه را پیش از نصب coach پاک می‌کند و در برابر جایگزینی هم‌زمان targetهای پویا با retry دو فریمی و fallback امن مقاوم است.
- تأییدشده در source: `pnpm check` با ۳۶۳ تست موفق، ۱۳۴ سند/صفر خطا، clean-room برابر ۴۶۹ فایل و build برابر ۲۵۲ ماژول/۴۶ JSON گذشت. استقرار و smoke محیط Test در Evidence جداگانه ثبت می‌شود.
- مرز: Production، Secret، Provider زنده، هزینه، GitHub/Server، Pilot و عملیات بیرونی تغییر نمی‌کنند.

## ۲۰۲۶-۰۹-۱۴ — Smart Tester 1.0 برای توسعهٔ خود Hero در Test

- افزوده‌شده: یک ابزار مستقل از نقش محصولی `Tester`، با سوئیچ browser-local و پیش‌فرض خاموش. با فعال‌سازی، نشان `✦` به Boxهای قابل‌شناسایی در تمام surfaceهای مشترک Back Office افزوده می‌شود و هر نشان یک پنل شناور، قابل‌بستن و قابل‌انتقال میان دو لبهٔ viewport باز می‌کند؛ پنل در layout صفحه دخالت نمی‌کند.
- افزوده‌شده: گفت‌وگوی تحلیلگر محلی Hero با context allowlistشدهٔ route، Project Scope، metadata امن پروژه/حافظه و source map curated همان surface. متن سؤال/پاسخ persist نمی‌شود و Provider خارجی، Token یا هزینه‌ای ندارد.
- افزوده‌شده: «تست این بخش» به‌صورت in-process و بدون side effect، render/UI، نشانهٔ UX، read model/backend و مرز امنیتی را گزارش می‌کند. E2E مرورگر، viewportهای واقعی، Provider، shell، GitHub، سرور و deploy عمداً `not-run` ثبت می‌شوند و از یک کلیک UI اجرا نمی‌گردند.
- امنیت: endpointهای Smart Tester فقط با نشست انسانی Owner، Origin same-origin و Project Grant خواندنی برای Scope پروژه کار می‌کنند. گزارش transient با شناسهٔ تصادفی، فقط برای همان Owner/Context و حداکثر ۳۰ دقیقه در حافظه نگهداری می‌شود؛ Admin و Viewer دسترسی ندارند.
- تأییدشده: `npm run check` با ۳۶۲ تست موفق، ۱۳۴ سند/صفر خطا، clean-room برابر ۴۷۰ فایل و build برابر ۲۵۲ ماژول/۴۶ JSON گذشت. Control Plane محیط Test بازسازی شد؛ health، ورود انسانی/MFA، cookie، context، run، گزارش، گفت‌وگو و revoke نشست Smart Tester با موفقیت smoke شدند.
- مرز: فقط محیط Test تغییر کرد. Production، Secret، Provider زنده، هزینه، GitHub، سرور، Pilot و عملیات بیرونی تغییری نکردند.

## ۲۰۲۶-۰۹-۱۴ — Walk-Through 1.6.1: اتصال مجدد هدف پویا و مسیر canonical اتصال‌های AI

- اصلاح‌شده: coach فعال، بعد از بارگذاری نشست انسانی، تغییر `hidden`/`class` یا بازسازی کارت‌های پویا، فقط وقتی هدف همان گام قابل‌دیدن شد به آن دوباره متصل می‌شود. اتصال قبلیِ جداشده پاک می‌شود و Bubble ثابت در چیدمان صفحه دخالت نمی‌کند.
- اصلاح‌شده: پس از انتخاب پروژهٔ موجود، گام اختیاری ساخت Draft رد می‌شود؛ اگر Owner پروژهٔ تازه بسازد، state فعال به Intake همان Project منتقل می‌شود.
- اصلاح‌شده: «اتصال‌های AI» از مسیر canonical `/portfolio?surface=ai#ai` باز می‌شود و `/backoffice?surface=ai` در Control Plane به آن redirect می‌شود. هیچ ناوبری داخلی به مسیر legacy صادر نمی‌شود.
- مرز: این اصلاح فقط UI/route در Test است؛ Production، Secret، Provider زنده، هزینه، GitHub/Server، Pilot و اجرای بیرونی تغییر نمی‌کنند.

## ۲۰۲۶-۰۹-۱۴ — Walk-Through 1.6: گیت واقعی خروجی و ثبت کاتالوگ AI با نشست انسانی

- اصلاح‌شده: Owner پس از ورود انسانی می‌تواند بدون واردکردن Token قابل‌کپی، metadata نسخه‌دار Provider/Model/Profile/Skill/Policy را ثبت کند؛ Admin فقط Binding یک Profile موجود را در Scope Project Grant خود ثبت می‌کند. مسیر invocation یا Provider زنده از این مجوز عبور نمی‌کند.
- اصلاح‌شده: راهنما در گام‌های تحقیق تیمی، اجرای زنده، Test/Delivery و Production دیگر «گام بعد» یا «پایان» را به شکل ساختگی فعال نمی‌کند. تا قابلیت اجرایی و Evidence واقعی فراهم نشود، state فعال می‌ماند و blocker با متن روشن نمایش داده می‌شود.
- تأییدشده در Test: ورود انسانی، MFA، session شش‌ساعته، دریافت گزینه‌های Advisor و پاسخ محلیِ contextual برای `project-vpn` از دامنهٔ عمومی Test در یک session موقت آزموده و revoke شد.

## ۲۰۲۶-۰۹-۱۴ — Walk-Through 1.5: گفت‌وگوی قابل‌مشاهده، انتخاب Profile و کاتالوگ اتصال AI

- اصلاح‌شده: sidecar Test اکنون `/api/*` را به Control Plane proxy می‌کند؛ بنابراین درخواست same-origin مشاورهٔ Walk-Through مانند صفحه‌های Workspace و Identity به پاسخ داخلی می‌رسد و 404 در لایهٔ پراکسی رخ نمی‌دهد.
- افزوده‌شده: Bubble مشاوره، رشتهٔ گفت‌وگو را نمایش می‌دهد و برای هر Project فقط Profileهای active و Bound شده به همان Project را کنار «راهنمای محلی Hero» فهرست می‌کند. متن گفتگو transient است و هیچ Secret، Prompt یا پاسخ خام در Audit ذخیره نمی‌شود.
- افزوده‌شده: نمای «اتصال‌های AI» در Back Office، Provider/Model/Profile/Binding، Health ثبت‌شده و مصرف Token/Cost Unit را به تفکیک Provider نشان می‌دهد؛ `not-verified` صریحاً وضعیت سالم تلقی نمی‌شود.
- مرز: در Test هیچ API Key یا Provider زنده تنظیم نشده و `HERO_ENABLE_REAL_PROVIDERS=false` و External Spend inactive است؛ بنابراین Profile زنده انتخاب‌شده بدون Health، Binding، بودجه و مجوز جداگانه dispatch نمی‌شود.

## ۲۰۲۶-۰۹-۱۴ — Walk-Through 1.4: مشاورهٔ گام‌محور و Bubble بدون تغییر layout

- افزوده‌شده: پنل مستقل «مشاورهٔ AI» از داخل هر گام Walk-Through، با زمینهٔ دقیق گام/فیلدهای راهنما، جابه‌جایی مستقل میان لبهٔ چپ و راست، پاسخ transient و دکمهٔ «پیشنهاد» برای پیش‌پرکردن محدود فیلدهای امن.
- مرز صداقت: مشاورهٔ این نسخه محلی و deterministic است؛ هیچ Provider خارجی، Model زنده، Token، هزینه، فرمان یا دادهٔ مکالمه‌ای persist نمی‌شود. «پیشنهاد» هرگز Save/Submit/Approve/Deploy انجام نمی‌دهد و فقط Owner/Admin می‌تواند بعد از بازبینی با دکمهٔ خود فرم ثبت کند.
- اصلاح‌شده: coach دیگر `margin`، اندازه یا جایگاه کارت و فیلد هدف را دستکاری نمی‌کند؛ حذف کامل رزرو margin و observer/handler مربوط به تغییر layout، علت جابه‌جایی یا پرپرزدن کارت‌ها را از ریشه برمی‌دارد. Bubbleها overlay ثابت و isolated هستند و تنها outline غیرهندسی روی بخش هدف می‌گذارند.
- افزوده‌شده: کمینه‌سازی coach به نشان `H` در لبهٔ انتخاب‌شده و بازگردانی همان گام با کلیک؛ این وضعیت، راهنمای فعال را متوقف یا دادهٔ پروژه را تغییر نمی‌دهد.
- تأییدشده در source: `npm run check` با ۳۵۵ تست موفق، ۱۳۳ سند/صفر خطا، clean-room ۴۶۷ فایل و build ۲۵۰ module/۴۶ JSON گذشت. Test deployment و smoke در Evidence جداگانه ثبت می‌شود.
- مرز: Production، Provider زنده، هزینه، Secret، GitHub/Server، Pilot و هر عملیات برگشت‌ناپذیر تغییر نکرده‌اند.

## ۲۰۲۶-۰۹-۱۳ — نشست انسانی پایدار شش‌ساعته در Test

- اصلاح‌شده: پس از MFA، نشست انسانی در cookie میزبان‌محور `Secure`، `HttpOnly` و `SameSite=Strict` با عمر ۶ ساعت ثبت می‌شود؛ Refresh و تب دیگر همان مرورگر بدون ورود دوباره کار می‌کنند.
- اصلاح‌شده: رابط Identity، Portfolio، Workspace و Walk-Through دیگر token انسانی را در `sessionStorage` نگه نمی‌دارند؛ logout/revoke هم state سرور و cookie را هم‌زمان باطل می‌کند.
- افزوده‌شده: کنترل Origin برای mutationهای cookie-backed و تست صریح صدور cookie، درخواست تکراری، Basic network boundary و CSRF.
- تأییدشده: `npm run check` با ۳۵۴ تست موفق، ۱۳۳ سند/صفر خطا، build ۲۵۰ module/۴۶ JSON؛ Test healthy و smoke واقعی cookie/login/revoke موفق بود.
- مرز: فقط Control Plane Test با digest `sha256:c65354b7f29ced0d9720ecba7b19e62cadb6179cda83b9ed69889e20b470909f` تغییر کرد. Production، Secret، Provider، هزینه و Pilot تغییر نکردند.

## ۲۰۲۶-۰۹-۱۱ — انتخاب اجباری پروژه و VPN Draft در Test

- اصلاح‌شده: پس از ورود انسانی، Portfolio انتخاب‌گر پروژه است و تنها نمای چندپروژه‌ای Hero محسوب می‌شود. مرکز فرمان، Product Studio، Workspace و Operations بدون `projectId` به انتخاب‌گر مقصددار بازمی‌گردند و دادهٔ global یا مخلوط از چند پروژه نمایش نمی‌دهند.
- اصلاح‌شده: مرکز فرمان از `/portfolio?surface=command&projectId=…` دادهٔ یک Project را می‌خواند؛ Product Studio نیز roadmap، Foundation و metadata امن همان Project را نشان می‌دهد. آزمون integration با VPN و CRM عدم نشت متقابل را کنترل می‌کند.
- افزوده‌شده: Owner می‌تواند با `expectedVersion` و دلیل ثبت‌شده، Project فعال یا درحال‌بررسی را append-only به Draft بازگرداند؛ Foundation پیشنهادی تازه ایجاد و تاریخچهٔ قبلی حفظ می‌شود.
- Test: پروژهٔ موجود `project-vpn` با همین مسیر رسمی به `draft` بازگشت و selector، Command، Studio، Workspace، Operations و Identity از دامنهٔ عمومی Test موفق probe شدند.
- مرز: مسیر دستی legacy خارجی `/backoffice` همچنان پیش از Control Plane توسط gateway خارج از repository با 401 متوقف می‌شود؛ هیچ navigation داخلی از آن استفاده نمی‌کند. Production، Secret، Provider، هزینه و Pilot تغییری نکردند.

## ۲۰۲۶-۰۹-۱۱ — رفع مسیرهای معیوب Test و یکپارچه‌سازی Vazirmatn

- اصلاح‌شده: ناوبری مرکز فرمان از `/backoffice` به alias canonicalِ `/portfolio?surface=command` منتقل شد، زیرا gateway خارجی Test فقط برای مسیر legacy پاسخ Basic Auth ناسازگار می‌داد؛ رمز حساب انسانی و Secretها تغییری نکردند.
- اصلاح‌شده: Workspace و Operations بدون Scope پروژه اکنون به انتخاب‌گر Portfolio redirect می‌شوند و دیگر `400 PROJECT_ID_REQUIRED` نشان نمی‌دهند.
- افزوده‌شده: Vazirmatn رسمی با مجوز OFL-1.1 به‌صورت self-hosted برای فارسی و انگلیسی در همهٔ surfaceهای Back Office سرو می‌شود؛ code و شناسه‌های فنی monospace باقی می‌مانند.
- تأییدشده: build جدید Test با clean-room برابر ۴۶۳ فایل، build برابر ۲۴۸ ماژول/۴۶ JSON و ۳۵۰ تست موفق ساخته و فقط در Test مستقر شد؛ کنترل نهایی source با clean-room ۴۶۴ فایل و probe عمومی مسیر canonical، redirectها و font نیز موفق بود.
- مرز: Production، credentialها، gateway خارجی، Provider، هزینه و Pilot تغییری نکردند.

## ۲۰۲۶-۰۹-۱۱ — شفاف‌سازی عملی ورود Test پس از بازخورد مالک

- اصلاح‌شده: صفحهٔ منتشرشدهٔ `/identity` اکنون سه Gate مستقل را به‌ترتیب Basic Auth مرورگر، Email/Password حساب انسانی و کد درحال‌تغییر Authenticator توضیح می‌دهد؛ Secret MFA به‌صراحت کد ورود محسوب نمی‌شود.
- تأییدشده: Control Plane فقط در Test با نسخهٔ تازه بازراه‌اندازی شد؛ مسیر عمومی هر سه Gate، session Owner و revoke نشست تشخیصی بدون افشای رازها موفق بود.
- مرز: Production، Caddy، Provider، هزینه، Pilot و تغییر Secret جدیدی انجام نشد.

## ۲۰۲۶-۰۹-۱۱ — رفع ورود انسانی Test و راهنمای قابلیت‌ها

- اصلاح‌شده: Human Identity که در Test provision نشده بود، اکنون با Email/Password/MFA RFC 6238 Base32، endpoint امن status و bootstrap پایدار Test فعال است؛ Basic Auth شبکه‌ای موجود rotate نشد.
- افزوده‌شده: Provision و Smoke سخت‌گیرانهٔ Test با guard محیط، منع Symlink، نوشتن اتمیک، جلوگیری از backup کامل Secret، allowlist origin و revoke Session آزمایشی.
- افزوده‌شده: راهنمای قابل‌دسترسی `i` برای surfaceهای اصلی Back Office، Portfolio، Product Studio، Workspace، Operations، Safe Lab و Identity، با keyboard/RTL/viewport safety و تست عدم nested interactive control.
- تأییدشده: `pnpm check` با ۳۴۷ تست موفق، Control Plane/PostgreSQL/Proxy محیط Test healthy، login/MFA پیش و پس از restart موفق و auditهای PostgreSQL ثبت شد.
- مرز: فقط Test تغییر کرد؛ Production، Caddy، Provider زنده، هزینه، Pilot و recovery delivery تغییر نکردند.

## ۲۰۲۶-۰۹-۱۱ — Promotion ایمن Artifact به Hero Test

- افزوده‌شده: اسکریپت promotion برای فقط `hero-test/control-plane` با digest immutable، backup محیط Test، preflight، بدون build/dependency و smoke test خودکار.
- افزوده‌شده: اسکریپت read-only برای تطبیق image و `/health`، `/ready`، Workspace و Project Control پس از promotion.
- مرز: Production، Secret، Provider و Pilot در این ابزارها نام‌برده یا تغییر داده نمی‌شوند.

## ۲۰۲۶-۰۹-۱۱ — Private Object Store و Workspace Console

- افزوده‌شده: Workspace Console با مسیر `/workspace?projectId=…` برای Intake، Foundation، ورودی‌های خصوصی، تنظیمات نسخه‌دار، Policy Pack و rollback؛ همهٔ mutationها همچنان از API هویت انسانی و ProjectGrant می‌گذرند.
- افزوده‌شده: private object-store متعلق به Hero با کلید مجاز، رد مسیرگریزی، دسترسی‌ندادن به listing و نوشتن اتمی در volume خصوصی Hero.
- ممیزی: `BO-DAT-001` از `missing` به `partial` ارتقا یافت؛ scanner و parser عملیاتی هنوز گیت باز هستند و این مورد `implemented` اعلام نشده است.

## ۲۰۲۶-۰۹-۱۱ — Project Control Room برای BO-051..150

- مسیرهای read-only و project-scoped `project-control` و `project-control-data` افزوده شدند.
- Product Studio اکنون برای هر پروژه به نمای واحد Collaboration، Command، Catalog، Intelligence، Inbox، Infrastructure، Delivery، Hardening و Final Readiness deep-link می‌دهد.
- این تغییر فقط metadata امن را نمایش می‌دهد و هیچ Provider، Secret، هزینه، Production، Pilot یا عملیات بیرونی را فعال نمی‌کند.

## 2026-09-11 — شروع توسعهٔ عمودی Identity و ProjectGrant

- افزوده‌شده: hydration امن User، Grant و Revocation از PostgreSQL؛
- افزوده‌شده: persistence و audit boundary برای lifecycle هویت بدون ذخیرهٔ Secret خام؛
- افزوده‌شده: صفحهٔ عملیاتی `/identity` با login/MFA، ایجاد Viewer، Grant، مشاهده/ابطال Grant و logout؛
- افزوده‌شده: تست‌های hydration، redaction، route protection و Store؛
- تأییدشده: `pnpm check:docs` با ۱۲۴ سند/۲ محصول/صفر خطا و `pnpm check` با Build برابر ۲۲۵ ماژول/۳۳ JSON و ۳۱۱ تست موفق؛
- مرز: MFA enrollment/rotation اعضا، recovery delivery، آزمون runtime سه‌نقشی و Production همچنان جداگانه gated هستند.

## 2026-09-11 — اصلاح معنای «تکمیل ۱۷۰ گام» و ایجاد ممیزی جاری

- روشن‌شده: Evidenceهای Batch وجود artifact و نتیجهٔ تست داخلی را نشان می‌دهند و به‌تنهایی معادل قابلیت کامل و قابل‌استفاده نیستند؛
- ثبت‌شده: رجیستری ماشینی همهٔ `BO-001..BO-170` با پوشش بدون شکاف و وضعیت‌های `verified / partial / gated / owner_pending / deferred`؛
- نتیجهٔ ممیزی: ۲۰ verified، ۱۲۲ partial، ۲۶ gated، یک owner-pending و یک deferred؛ در نتیجه ۱۵۰ گام تا verifiedشدن کامل باز است؛
- تکمیل‌شده: ممیزی جاری تک‌تک ۸۱ Requirement با نتیجهٔ ۵ implemented، ۷۵ partial و ۱ missing؛ baseline قبلی ۵/۴۳/۳۳ برای تاریخچه حفظ شد؛
- روشن‌شده: تنها الزام کاملاً missing، private object storage واقعی است؛ ۷۵ مورد partial همچنان تحویل کامل یا verified محسوب نمی‌شوند؛
- اصلاح‌شده: وضعیت آغاز قدیمی برنامه و Snapshot وضعیت ۲۰۲۶-۰۹-۱۰؛
- افزوده‌شده: checker و تست fail-closed برای جلوگیری از حذف، تکرار یا بزرگ‌نمایی شمارش گام‌ها و نیازمندی‌ها؛
- تأییدشده: `pnpm check:docs` با ۱۲۴ سند/۲ محصول/صفر خطا و `pnpm check` با Build برابر ۲۲۳ ماژول/۳۳ JSON و ۳۰۶ تست موفق؛
- مرز: بدون Secret، Production، Provider، هزینه، پیام بیرونی، عملیات مخرب یا اجرای Pilot.

## 2026-09-10 — پیاده‌سازی synthetic Pricing Catalog نسخه‌دار

- افزوده‌شده: قرارداد Catalog برای Provider/Model، نرخ token و request-unit، ارز، منبع رسمی، اعتبار و نسخه؛
- افزوده‌شده: Registry، sync مدیریتی خارج از مسیر درخواست و persistence append-only PostgreSQL در migration `007`؛
- افزوده‌شده: محاسبهٔ cached input، تبدیل به Hero Cost Units، cap پیش از dispatch و metadata امن برای audit؛
- حذف‌شده: نرخ‌های دستی هزینه از Environment و مسیر runtime؛ استفادهٔ صریح از آن‌ها fail-closed رد می‌شود؛
- تأییدشده: تست synthetic مدل ناشناخته/منقضی، cap، منبع نامعتبر، Adapter غیرتوکنی، persistence، redaction و عدم تماس شبکه؛
- مرز: بدون API Key، Provider واقعی، sync اینترنتی، external spend یا تغییر Production؛
- مرجع: `docs/roadmap/FUTURE-REQUIRED-PRICING-CATALOG.md`.

## 2026-09-10 — ثبت قابلیت ضروری Pricing Catalog نسخه‌دار

- ثبت‌شده: ساختار عمومی Catalog برای Provider/Model، نرخ ورودی/خروجی/cached، ارز، منبع رسمی، زمان اعتبار و نسخه؛
- ثبت‌شده: fail-closed پیش از dispatch، همگام‌سازی خارج از مسیر درخواست، تبدیل خودکار به Hero Cost Units و Adapterهای توکنی/غیرتوکنی؛
- ثبت‌شده: کنترل Admin برای Provider، Model، cap و expiry، همراه با Audit metadata و redaction؛
- ثبت‌شده: migration، تست خطا/مدل ناشناخته/سقف هزینه، security check، مستندات و rollback به‌عنوان دامنهٔ اجرای بعدی؛
- تصمیم: فعلاً هیچ کد runtime، Secret، API Key، Provider واقعی، شبکه یا هزینه‌ای تغییر نکرد؛ شروع پیاده‌سازی نیازمند تأیید صریح مالک است؛
- مرجع: `docs/roadmap/FUTURE-REQUIRED-PRICING-CATALOG.md`.

## 2026-09-10 — تأیید PostgreSQL واقعی Test و پاک‌سازی قرارداد استقرار

- تأییدشده: هر سه سرویس Test healthy، health/readiness داخلی و عمومی `200`، persistence برابر `postgresql` و hydration برابر `hydrated`؛
- تأییدشده: هر ۱۱ registry بدون مورد گمشده hydrate شدند و event/snapshot integrity معتبر است؛ restart کنترل‌شدهٔ فقط Control Plane projection digest را تغییر نداد؛
- تأییدشده: dashboard، diagnostics و دو مسیر audit با Owner session پاسخ `200` دادند؛
- کنارگذاشته‌شده: `compose.test.yaml` قدیمی و خارج از قرارداد، بدون حذف و به‌صورت بازیافت‌پذیر در `var/quarantine/compose.test.yaml.legacy-20260904.disabled`؛
- مستندشده: وضعیت واقعی جاری در `docs/roadmap/STATUS-20260910.md` و اصلاح اسناد تاریخی که PostgreSQL را متصل‌نشده نشان می‌دادند؛
- افزوده‌شده: مجوز runtime برای external-spend با تطابق دقیق Step/Version/Provider/Model/Role، انقضا، Global Stop و cap هزینه؛
- افزوده‌شده: محاسبهٔ نرخ جداگانهٔ input/output، سقف output token و رد هزینهٔ بدترین‌حالت پیش از تماس Provider؛
- افزوده‌شده: درخواست نسخه‌دار `HERO-PILOT-001/v1.0`، قرارداد evidence بازیابی Clean Linux و check پویای سه گیت پایلوت؛
- تأییدشده: `246/246` تست، Build برابر ۱۴۴ ماژول و ۹ JSON، Governance/Deployment/Roadmap/Owner Handoff همگی موفق؛
- مرز: Production، Provider پولی، Secretها و سرویس پروژه‌های دیگر تغییر نکردند.

## 2026-09-10 — تعویق آگاهانهٔ Recovery سرور دوم

- تصمیم مالک: خرید سرور/VM دوم و Recovery فعلاً انجام نمی‌شود؛ توسعه، verification و تست معمولی روی Test فعلی ادامه دارد؛
- مرز ایمنی: Recovery واقعی همچنان پیش‌شرط پایلوت عملیاتی نهایی و هرگونه Production است و `check:pilot` تا ثبت آن blocked می‌ماند؛
- اقدام‌های فوری مالک/ادمین: انتخاب Model ID و سقف هزینه، ثبت API key فقط در Secret Store Test، و تصویب `HERO-PILOT-001/v1.0`؛
- مرجع: `docs/roadmap/STATUS-20260910.md` و `docs/operations/OWNER-ACTIONS-SIMPLE.md`.

## 2026-09-09 — اجرای verification صد گام

- تأییدشده: image Linux verification با Build برابر ۱۴۳ ماژول، Governance برابر ۲۱ گام، Roadmap/Owner handoff audit موفق و `243/243` تست موفق؛
- تأییدشده: smoke image عملیاتی با `/health=200`، `/ready=200`، Back Office بدون احراز هویت=`401`، با احراز هویت=`200`، `robots.txt=200` و مسیر ناشناخته=`404`؛
- ثبت‌شده: وضعیت هر ۱۰۰ گام و شواهد دقیق در `docs/roadmap/EXECUTION-20260909-100-STEPS.md`؛
- ثبت‌شده: Pilot readiness عمداً با سه blocker واقعی متوقف است: recovery مقصد Linux، مجوز Provider و درخواست/معیار پذیرش Pilot؛
- مرز: هیچ Secret، Provider واقعی، هزینهٔ خارجی، Production، DNS/Caddy یا سرویس پروژهٔ دیگر تغییر نکرد.

## 2026-09-05 — اجباری‌شدن PostgreSQL strict در قرارداد Test

- اصلاح‌شده: deployment contract اکنون نمونهٔ Test را ملزم به `HERO_REQUIRE_POSTGRES=true` می‌کند؛
- تأییدشده: verification workspace با `243/243` تست موفق، Build با `143` ماژول و Roadmap/Owner handoff audit موفق؛
- مرز: فقط contract و شواهد repository تغییر کرد؛ هیچ runtime، Secret، دادهٔ PostgreSQL، Production یا اپلیکیشن دیگری تغییر نکرد.

## 2026-09-05 — جلوگیری از mismatch اتصال PostgreSQL در preflight

- افزوده‌شده: بررسی برابر بودن password داخل `HERO_POSTGRES_URL` با `HERO_POSTGRES_PASSWORD` بدون افشای مقدار Secret؛
- تأییدشده: verification workspace با `243/243` تست موفق، Roadmap audit و Owner handoff audit موفق؛
- مرز: فقط preflight، تست و شواهد workspace تغییر کرد؛ Secret، دادهٔ PostgreSQL، Production و اپلیکیشن‌های دیگر تغییری نکردند.

## 2026-09-05 — پوشش شاخهٔ readiness PostgreSQL در Back Office

- افزوده‌شده: تست ایزولهٔ گزارش `runtime=postgresql` و `readiness=ready` هنگام اتصال persistence runtime؛
- تأییدشده: verification workspace با `242/242` تست موفق، Roadmap audit و Owner handoff audit موفق؛
- مرز: فقط تست و شواهد workspace تغییر کرد؛ artifact قبلی، Secretها، دادهٔ PostgreSQL، Production و اپلیکیشن‌های دیگر تغییری نکردند.

## 2026-09-05 — استقرار ledger هم‌راستا با evidence جاری Test

- اصلاح‌شده: statusهای persistence که فقط شاهد قبلی داشتند برای candidate جاری pending شدند و preflight متوقف‌شده به‌عنوان blocker خارجی ثبت شد؛
- تأییدشده: Commit `b7f0247`، artifact `hero-control-plane:candidate-b7f0247` با digest `sha256:4f6f8f5766246e548ae46a736d8ea5dc8659ad9604be6d9c9131e051bf596e6d`، شمارش دفتر `pending=39`، `blocked=9`، `evidence=2`؛
- مرز: فقط Control Plane Test با حفظ PostgreSQL/volume/network جایگزین شد؛ Production، Provider واقعی و اپلیکیشن‌های دیگر تغییری نکردند.

## 2026-09-05 — اصلاح وضعیت جاری دفتر OPEN-50 پس از ممیزی persistence

- اصلاح‌شده: ردیف‌های migration، readiness، Event Store، Snapshot، hydration، access audit و CI که فقط شاهد قبلی داشتند، دیگر به‌عنوان تکمیل Test نمایش داده نمی‌شوند؛
- اصلاح‌شده: preflight فعلی که به‌علت دو Secret PostgreSQL متوقف است، در دفتر به‌عنوان blocker خارجی ثبت شد؛
- تأییدشده: دفتر نسخهٔ `2026-09-05` دارای ۵۰ ردیف با شمارش `pending=39`، `blocked=9` و `evidence=2` است و `OPEN-50`/`NEXT-100` parity دارد؛
- مرز: فقط ledger، تست و مستندات اصلاح شدند؛ هیچ Secret، دادهٔ PostgreSQL، Production یا اپلیکیشن دیگری تغییر نکرد.

## 2026-09-05 — نمایش صریح وضعیت persistence در Back Office

- افزوده‌شده: metadata امن `runtime` و `readiness` در snapshot صفحه و دادهٔ Back Office؛ پنل تفاوت `in-memory` و PostgreSQL را روشن نشان می‌دهد؛
- تأییدشده: Commit `c804a5a`، `pnpm check` با `241/241` تست، Build با `143` ماژول و Roadmap audit برابر `OPEN-50=50` و `NEXT-100=100`؛
- ساخته‌شده: artifact `hero-control-plane:candidate-c804a5a` با digest `sha256:2d25ca11293a2f017bc8d62553da7ac7dbfb3037d664b2e24161e8356604994b`؛ فقط Control Plane در `hero-test` جایگزین شد؛
- وضعیت: `/health`، `/ready` و Back Office احراز‌شده موفق‌اند؛ PostgreSQL و دو مسیر audit تا تنظیم Secretهای اتصال، persistence-ready نیستند؛ Production و اپلیکیشن‌های دیگر تغییری نکردند.

## 2026-09-05 — تکمیل راهنمای مفاهیم و هم‌راستاسازی با runtime Test

- اصلاح‌شده: چهار status در Projection `OPEN-50` و مستندات با آخرین شواهد Test یکسان شدند؛ راهنمای ۳۹ مفهوم با مدخل‌های Project، Task، Evidence، Authorization، Dispatch، Gate، Projection، Release، Pilot و CI تکمیل و assertionهای Back Office اضافه شد؛
- ساخته‌شده: artifact `hero-control-plane:candidate-985ab8c` با digest `sha256:590efbccac4d7b20df03d4ad14d230003ff646821bef91df9712063648225135` از Commit `985ab8c`؛
- تأییدشده: فقط `hero-test-control-plane-1` با حفظ volume/network جایگزین شد؛ PostgreSQL سالم ماند، preflight/health/readiness/auth و ۱۷ مسیر read-only موفق شدند؛
- مرز: Commit ثبت شده و فقط Test با artifact آن به‌روزرسانی شده است؛ Production، Provider واقعی و Pilot تغییر نکرده‌اند.

## 2026-09-05 — نمایش دفتر OPEN-50 و گیت‌های مالک در Back Office

- افزوده‌شده: Projection نسخه‌دار `OPEN-50` با ۵۰ ردیف وضعیت و اقدام بعدی؛
- افزوده‌شده: ۱۴ اقدام امن و غیرمحرمانهٔ مالک/ادمین و ۳ blocker فعلی Pilot در پنل؛
- افزوده‌شده: نمای responsive برای مرور دفتر roadmap، بدون اعطای authorization، dispatch، secret change یا deployment؛
- تأییدشده: Commit `c1a1430`، image digest `sha256:e662f73725db07e7a1080922ac549940a417f4dba97418c5e6bd12e61fbbd4c2`، Build `142` و `239/239` تست؛
- تأییدشده: فقط Control Plane در `hero-test` با همان env/volume/network جایگزین شد؛ PostgreSQL سالم ماند، `/health=200`، `/ready=200`، Back Office بدون auth=`401` و با auth=`200`؛
- مرز: Production، Provider واقعی، Secret change، recovery عملیاتی و Pilot همچنان جداگانه gated هستند.

## 2026-09-05 — candidate متصل به Commit و Test نهایی

- ساخته‌شده: image محلی `hero-control-plane:candidate-b590d6e` از Commit `b590d6e` با digest `sha256:f42d32e9816d8113c817b06782322c8b5cc9e07e2ef83c45c844f8ce8c52d5d4`؛
- تأییدشده: build با `239/239` تست موفق، Build `141` ماژول، fingerprint پنج فایل اصلی برابر source و حذف `compose.test.yaml` از image؛
- انجام‌شده: deploy فقط به `hero-test` با env موجود؛ preflight، `health=200`، `ready=200`، Back Office بدون auth=`401`، با auth=`200` و دامنهٔ Test با auth=`200`؛
- تأییدشده: Back Office احراز‌شدهٔ Test، page/data/events را `۲۰۰` برگرداند؛ ۱۱ تیم، ۸ Role، ۶ route، ۵ دستهٔ تنظیمات، ۲۴ event و markerهای فارسی/IRANSans حاضرند؛
- تأییدشده: کنترل امنیتی HTTP Test؛ unauth=`۴۰۱`، auth=`۲۰۰`، POST read-only=`۴۰۵` با `Allow: GET`، CSP/noindex حاضر، unknown route=`۴۰۴` و API unauth=`۴۰۱`؛ review دستی Caddy/شبکه باز است؛
- تأییدشده: ۱۵ endpoint read-only احراز‌شدهٔ Test همگی `۲۰۰`؛ dashboard، diagnostics، audit، teams، training، principles، roles، skills، advisor، benchmark و history بررسی شدند؛ mutation و Provider واقعی اجرا نشد.
- تأییدشده: restart Control Plane سالم ماند و candidate قبلی به‌عنوان کانتینر rollback متوقف و محفوظ است؛ PostgreSQL و volume حفظ شدند؛
- آزموده‌شده: rollback کنترل‌پلیس در یک خطای preflight انجام و با health/auth موفق restore شد؛ recovery از backup/checksum هنوز باز است؛
- مرز: Candidate به Production deploy نشده؛ push هنوز انجام نشده و recovery واقعی از backup/checksum و Pilot گیت‌های جداگانه‌اند.
- آزموده‌شده: backup/restore PostgreSQL synthetic با checksum `sha256:1ce262c482e6096d7c315d62c3483ba012a9f1e813e57f2d0fcfe5c29ccffb04` و sentinel `source-ok` موفق؛ Clean Linux عملیاتی هنوز باز است.
- اصلاح‌شده: Control Plane Test از حالت unmanaged خارج و با `compose.yaml` و labelهای درست `hero-test/control-plane` بازسازی شد؛ image، auth، restart، volume و network تأیید شدند.

## 2026-09-05 — candidate نهایی Test پس از اصلاح env handoff

- ساخته‌شده: image محلی `hero-control-plane:candidate-52c53f07cf41` با digest `sha256:f846ca3da45b0984af8243704681278484670720e4381ef28cda06a0931d88e7`؛
- تأییدشده: build با `239/239` تست موفق، Build `141` ماژول، fingerprint پنج فایل اصلی برابر source و حذف `compose.test.yaml` از image؛
- انجام‌شده: deploy فقط به `hero-test` با انتقال امن env موجود؛ preflight، `health=200`، `ready=200`، Back Office بدون auth=`401`، با auth=`200` و دامنهٔ Test با auth=`200`؛
- تأییدشده: restart Control Plane سالم ماند و rollback candidate قبلی به‌عنوان کانتینر متوقف‌شده حفظ شد؛ PostgreSQL و volume دست‌نخورده ماندند؛
- مرز: Candidate به Production deploy نشده؛ Commit جدید به‌علت read-only بودن Git index ثبت نشده و recovery واقعی از backup/checksum هنوز گیت بیرونی است.

## 2026-09-05 — کنترل تحویل مالک و candidate نهایی worktree

- افزوده‌شده: `check:owner-handoff` برای الزام مستندکردن Secretهای لازم، Test، artifact، `production-deploy`، `rollback` و `recovery`؛
- اصلاح‌شده: `.dockerignore` اکنون `compose.test.yaml` را هم از build context خارج می‌کند تا فایل خارج از قرارداد وارد image نشود؛
- ساخته‌شده: image محلی `hero-control-plane:candidate-dd2618847bf8` با digest `sha256:02a1a8ef114800af211f64f102846339f43a64dfe1db3da51c4792ef43a2df8e`؛
- تأییدشده: `pnpm check` با `239/239` تست، Build `141` ماژول، Governance `21` گام، Roadmap `50/50` و `100/100`؛
- تأییدشده: fingerprint پنج فایل اصلی برابر source، فایل `compose.test.yaml` خارج از image، و smoke موقت با `/health=200` و `/backoffice=200` و markerهای UI فارسی/IRANSans/noindex؛ resource موقت حذف شد؛
- مرز: Commit جدید به‌علت read-only بودن Git index ثبت نشد؛ candidate فقط به Test deploy شده و Production، recovery از backup و promotion همچنان گیت جدا دارند.

## 2026-09-05 — cross-reference fail-closed در ممیزی roadmap

- اصلاح‌شده: validator علاوه بر تعداد/پیوستگی، ارجاع هر ردیف `OPEN-50` به `NEXT-100` را نیز کنترل می‌کند؛
- ساخته‌شده: candidate `hero-control-plane:candidate-98bf0c6` با digest versioned؛
- تأییدشده: smoke همین candidate با health و Back Office برابر ۲۰۰ و markerهای UI فارسی/IRANSans/noindex؛ resource موقت حذف شد؛
- مرز: candidate هنوز به Test یا Production deploy نشده است.

## 2026-09-05 — machine-checkable roadmap audit و candidate جدید

- افزوده‌شده: validator داخلی برای پیوستگی و کامل‌بودن دفترهای `OPEN-50` و `NEXT-100`؛ نتیجهٔ واقعی `50/50` و `100/100`؛
- ساخته‌شده: image تمیز `hero-control-plane:candidate-923a0f3` با digest ثبت‌شده از commit versioned؛
- تأییدشده: `pnpm check` با `239/239` تست و Build `140` ماژول موفق؛
- تأییدشده: runtime smoke خود `candidate-923a0f3` با health و Back Office برابر ۲۰۰ و markerهای UI فارسی/IRANSans/noindex؛ resource موقت حذف شد؛
- مرز: candidate هنوز به `hero-test` یا Production deploy نشده و rollback/recovery واقعی همچنان باز است.

## 2026-09-05 — ساخت و fingerprint artifact کاندیدای تمیز

- ساخته‌شده: image محلی `hero-control-plane:candidate-2b3d5b8` با digest `sha256:a63abdb1f5b04b847c95cfa4a598b2cead8d3f4a09bd3b6987c1a3ce122a0db1` از archive نسخهٔ commit‌شده، بدون ورود تغییرات خارج از commit؛
- تأییدشده: verify داخل build با `239/239` تست موفق؛
- تأییدشده: hash پنج فایل اصلی image با fingerprint source برابر است؛
- تأییدشده: runtime smoke مستقل با پورت loopback؛ `/health` و `/backoffice` برابر ۲۰۰ و UI فارسی/IRANSans/noindex؛ کانتینر موقت پس از تست حذف شد؛
- تأییدشده: ممیزی runtime نهایی Local/Test و دامنه‌ها؛ health/readiness موفق، احراز هویت Test موفق، TLS دامنهٔ Test معتبر و Production همچنان نیازمند اصلاح Basic Auth/Caddy؛
- مرز: artifact هنوز به `hero-test` یا Production deploy نشده؛ deploy Test باید با همان Secret/env فعلی و ثبت rollback انجام شود.

## 2026-09-04 — تأیید محیط Test مستقل و دامنهٔ امن

- تأییدشده: پروژهٔ Compose مستقل `hero-test` با Control Plane و PostgreSQL سالم، volumeهای `hero-test_*`، network مستقل و پورت `127.0.0.1:43101`؛
- تأییدشده: preflight Test، اتصال PostgreSQL، migration نسخهٔ `1.0`، health/readiness و خاموش‌بودن Provider واقعی؛
- تأییدشده: پس از restart کنترل‌شدهٔ Control Plane، ۱۱ Projection، ۱۰ event و ۱ request در Read Model باقی ماند؛
- تأییدشده: دامنهٔ `test.hero.beeproject.ir` با TLS معتبر، پاسخ بدون احراز هویت `401`، پاسخ احراز‌شدهٔ Back Office `200`، noindex و robots؛
- مرز باقی‌مانده: wrapperهای محدود host، CI و artifact با SHA دقیق، rollback/recovery واقعی، Pilot و Production هنوز جداگانه نیازمند evidence یا مجوز هستند.
- نکتهٔ نسخه: hash سه فایل اصلی workspace با image فعلی `hero-test` متفاوت است؛ سلامت Test به‌تنهایی اثبات نمی‌کند آخرین workspace در آن deploy شده باشد.
- تأیید schema: migrationهای `001` تا `006` و ۱۷ جدول دارای trigger محافظ append-only در PostgreSQL Test مشاهده شد.
- تأیید شبکه: پورت‌های مستقیم Test (`43101` و `5432`) از بیرون قابل اتصال نیستند و دسترسی عمومی از HTTPS reverse proxy عبور می‌کند.
- افزوده‌شده: [CANDIDATE-EVIDENCE-20260904.md](./CANDIDATE-EVIDENCE-20260904.md) با commit پایه، fingerprint منبع، شواهد verification و گیت‌های parity قبل از promotion.
- ممیزی Git: source candidate `cdc44bc` و evidence commit `cce6aaa` ثبت شدند؛ remote branch قدیمی‌تر است و push/Production deploy انجام نشد.

## 2026-09-04 — اجرای بستهٔ کم‌ریسک اولویت‌دار از ممیزی ۵۰ گام

- تکمیل‌شده: پوشش مسیر Projection برای همهٔ Aggregate Eventها؛ رویدادهای عمومی در timeline امن کنترل‌داشبورد دیده می‌شوند و رویداد بدون مسیر Diagnostic را به `attention` می‌برد؛
- تکمیل‌شده: مدارشکن bounded برای Provider با threshold، reset timeout و probe نیمه‌باز؛ بازشدن و recovery به‌صورت event و snapshot امن ثبت می‌شود؛
- تکمیل‌شده: refresh شدن readiness Planner از وضعیت فعلی Team Registry پیش از تصمیم خروجی و dispatch؛
- تکمیل‌شده: تبدیل findingهای Performance/Evaluation به اقدام آموزشی advisory با owner review و evidence requirement؛
- تکمیل‌شده: تشخیص integrity مجموعه‌های Projection، freshness Snapshot و rebuild read model از Snapshot+Event بدون mutation بیرونی؛
- تکمیل‌شده: کاتالوگ و Binding مستقل Skill در رابط Back Office؛
- اصلاح‌شده: hydration Policyهای نقش AI دیگر Policy با Role نامعتبر اضافه نمی‌کند؛
- شواهد: `pnpm check` در کانتینر Linux با `239/239` تست، Build `138` و Governance `21` موفق شد؛ `git diff --check` نیز موفق است. Doctor فقط هشدار نبود Docker تو‌در‌تو را ثبت کرد؛
- مرز: Provider واقعی، Git/CI، rollback/recovery، Pilot و Production همچنان تغییر نکرده‌اند و طبق فهرست مالک/ادمین نیازمند اقدام بیرونی هستند؛ دامنه و Test مستقل در بخش بعدی تأیید شده‌اند.

## 2026-09-04 — تکمیل ممیزی فرمان‌های Control Plane و سخت‌سازی Read Model

- افزوده‌شده: رویدادهای امن و append-only برای ایجاد، تأیید، رد، توقف و اجرای درخواست‌ها و تغییرات اختیار/توقف اضطراری؛
- افزوده‌شده: نگهداری رویدادهای Control Dashboard در Snapshot و Hydration و نمایش آن‌ها در Projection یازده‌گانه؛
- اصلاح‌شده: cursor Timeline محلی اکنون از شمارهٔ صفحهٔ یکتا استفاده می‌کند و به sequenceهای داخلی Registryها وابسته نیست؛
- افزوده‌شده: سقف پاسخ و rate limit در حافظه برای مسیرهای read-only بک‌آفیس؛
- افزوده‌شده: دریافت گزارش JSON امن از دادهٔ حاضر پنل، بدون متن درخواست یا اطلاعات حساس؛
- تثبیت‌شده: نام فرمان در projection مشاهده‌ای با allow-list امن نمایش داده می‌شود و متن درخواست، Secret، Token، Prompt و Output خام همچنان حذف‌اند؛
- شواهد: تست‌های هدفمند Back Office، Dashboard، Diagnostics و Hydration با `25/25` و `pnpm check` لینوکس با `233/233` تست، Build `138` و Governance `21` موفق شدند؛ Doctor فقط نبود Docker تو‌در‌تو را هشدار داد.

## 2026-09-04 — تکمیل read model بازیابی Context

- افزوده‌شده: ثبت metadata امن Contextهای assembled شامل Role، Task/Step، نسخه و memory IDهای انتخاب‌شده؛
- افزوده‌شده: نگهداری Context retrieval در Snapshot/Hydration بدون محتوای حافظه، prompt، output یا Secret؛
- افزوده‌شده: نمایش تاریخچهٔ بازیابی Context در Back Office؛
- شواهد: `pnpm check` در Linux/Node 22 با `231/231` تست، Build `138`، Governance `21` و clean-room با `235` فایل موفق شد.

## 2026-09-04 — فعال‌شدن کنترل‌های محدود و محافظت‌شدهٔ Back Office

- افزوده‌شده: فرم مدیریت نسخه‌دار Provider، Model، Profile، Binding و Default Role Policy؛
- افزوده‌شده: ویرایش اصول Team و rollback نسخه‌دار از UI با Bearer Session؛
- تثبیت‌شده: Projection و دادهٔ Back Office فقط‌خواندنی و بدون Secret، Token، Prompt یا Output خام باقی می‌مانند؛
- تثبیت‌شده: Admin فقط scope محدود دارد؛ تأیید نهایی Team و عملیات حساس همچنان owner-only است؛
- تثبیت‌شده: live Provider، external spend، Secret، Deploy و Production از UI قابل فعال‌سازی نیستند.

## 2026-09-04 — تکمیل مشاهدهٔ Projection، حافظه و ظرفیت عملیاتی

- افزوده‌شده: فهرست metadata امن Project Memory فعلی در Back Office؛ محتوای حافظه، prompt، output و credential نمایش داده نمی‌شوند؛
- افزوده‌شده: جزئیات ۱۱ Projection شامل event type، آخرین event، تعداد collectionها و وضعیت Snapshot/Hydration؛
- افزوده‌شده: اتصال read-only ظرفیت Planner به Diagnostic برای نمایش سقف تیم و تعارض resource claim؛
- اصلاح‌شده: مسیرهای Back Office فقط GET را می‌پذیرند و روش‌های دیگر را با `405` رد می‌کنند؛
- مرز: projection کامل همهٔ commandها و retrieval کامل Context هنوز باز است؛ Provider زنده، Secret، Test عملیاتی با اعتبارنامهٔ واقعی، Pilot و Production همچنان جداگانه gated هستند.
- شواهد: verification نهایی در Linux container با `230/230` تست، Build `138`، clean-room با `234` فایل و `git diff --check` موفق انجام شد؛ Compose config و smoke-test Test نیز موفق‌اند.

## 2026-09-04 — تکمیل نمای فقط‌خواندنی Back Office

- افزوده‌شده: projection نسخهٔ `1.1` برای هویت سرویس، runtime، persistence/hydration، امنیت، حاکمیت، مسیرها و کاتالوگ قراردادهای کل Hero؛
- افزوده‌شده: جزئیات امن هر Team شامل تأییدها، آموزش، تخصیص، بازبینی، بازکاری، پژوهش و provenance دانش؛
- اصلاح‌شده: Back Office کاملاً read-only شد؛ فرم‌ها، توکن ورودی و دکمه‌های edit/approve/rollback از UI حذف شدند و APIهای مدیریتی خارج از آن باقی ماندند؛
- اصلاح‌شده: تست UI و redaction برای جلوگیری از mutation و افشای Secret/متن خصوصی گسترش یافت.

## 2026-09-04 — بستهٔ تشخیص و کنترل عملیاتی

- افزوده‌شده: قرارداد `operational-diagnostics-v1` برای پایش فقط‌خواندنی ۱۱ Projection؛
- افزوده‌شده: بررسی سلامت Snapshot/Event، Aggregate Version، replay dry-run و SHA-256 projection digest؛
- افزوده‌شده: تاریخچهٔ امن تغییرات AI، بدون Credential، Prompt یا Output خام؛
- افزوده‌شده: گزارش provenance/freshness دانش تیم و کشف تعارض Task فعال بین چند تیم؛
- تکمیل‌شده: احراز هویت امضاشدهٔ Admin با scope محدود به کاتالوگ AI؛ Owner برای Team، Release، Dispatch، Secret و Production باقی می‌ماند؛
- افزوده‌شده: endpoint owner/admin-authenticated `GET /api/operations/diagnostics` و قرارداد `/admin-auth-contract`؛
- تکمیل‌شده: rollback نسخه‌دار Policy نقش‌های AI در Back Office و امکان draft/rollback اصول Team برای Admin با تأیید نهایی Owner؛ شمارش Projection پنل با قرارداد ۱۱ Registry هم‌راستا شد؛
- تکمیل‌شده: rollback نسخه‌دار Policy نقش‌های AI در Back Office با scope Owner/Admin و idempotency؛ شمارش Projection پنل با قرارداد ۱۱ Registry هم‌راستا شد؛
- شواهد: `pnpm check` با `228/228` تست، Build `138`، Governance `21` و `git diff --check` موفق؛
- مرز: full domain projection و retrieval کامل همچنان بازند؛ مدل ظرفیت عددی در Planner تکمیل محلی است اما Diagnostic read model آن را گزارش نمی‌کند؛ Test عملیاتی، Provider زنده، recovery مقصد، Pilot و Production همچنان جداگانه باز/مسدود هستند.

## 2026-09-04 — ثبت ممیزی دسترسی و وضعیت Test

- شواهد بررسی دسترسی در `docs/operations/ACCESS-AUDIT-20260904.md` ثبت شد؛
- دسترسی repository و بررسی محدود namespace `hero-test` تأیید شد؛ namespace خالی است و Test deploy نشده؛
- `pnpm check` با `214/214` تست موفق شد و `check:pilot` سه گیت عملیاتی را مسدود گزارش کرد؛
- هیچ Secret، Caddy، DNS/WCDN، Provider زنده یا Production تغییر نکرد.

## 2026-09-04 — ممیزی وضعیت و مدیریت پایهٔ کاتالوگ AI در Back Office

- افزوده‌شده: projection امن Provider/Model/Profile/Role Binding در `/backoffice-data`، بدون `credentialRef` و دادهٔ حساس؛
- افزوده‌شده: فرم owner-authenticated برای ثبت نسخهٔ جدید Provider deterministic/disabled، Model، Profile، Binding و Default Role Policy؛ live Provider و external spend از UI قابل فعال‌سازی نیست؛
- افزوده‌شده: تست پوشش UI و اطمینان از حذف ارجاع Credential از projection؛
- اصلاح‌شده: شواهد roadmap و Google Sheet با آخرین وضعیت `214/214` تست، Build `124` و Governance `21` هم‌تراز شد؛
- مرز: Test stack، WCDN/Caddy/HTTPS، PostgreSQL مقصد، Secret واقعی، Provider live، recovery مقصد و Pilot واقعی همچنان به اپراتور/مجوز مستقل نیاز دارند.

## 2026-08-31 — تفکیک verification از runtime image

- اصلاح‌شده: target `verify` فایل‌های workflow را تا پایان تست نگه می‌دارد تا اجرای مستقل `pnpm check` ناقص نشود؛
- اصلاح‌شده: فایل‌های CI فقط هنگام ساخت image نهایی runtime حذف می‌شوند و image عملیاتی حداقل سطح لازم را حفظ می‌کند؛
- شواهد: build لینوکس، `pnpm check` با `۲۰۳/۲۰۳` تست موفق، Compose healthy و smoke-test مسیرهای سلامت، احراز هویت و عدم کشف عمومی موفق شد.

## 2026-08-31 — خودکارسازی release candidate و نسخه‌گذاری test

- افزوده‌شده: اجرای خودکار Release Candidate پس از push به شاخهٔ عملیاتی و تولید نسخهٔ `0.1.0-rc.<run_number>`؛ اجرای دستی برای نسخهٔ انتخابی همچنان فعال است؛
- افزوده‌شده: workflow دستی و Environment-gated برای اعتبارسنجی SemVer، اجرای `pnpm check`، ساخت image، tag دقیق و GitHub pre-release؛
- افزوده‌شده: artifact شواهد شامل نسخه، commit SHA، image ID و URL release؛
- تثبیت‌شده: `GITHUB_TOKEN` فقط برای tag و pre-release همین repository استفاده می‌شود و production deploy همچنان خارج از workflow است؛
- شواهد: `pnpm check` پس از تغییرات با Doctor/Governance/Build موفق و `۲۰۳/۲۰۳` تست پاس شد؛ Compose config و `git diff --check` نیز موفق‌اند.

## 2026-08-31 — سیاست عدم کشف عمومی سرویس

- افزوده‌شده: سیاست یکنواخت `X-Robots-Tag` با `noindex`، `nofollow`، `nosnippet` و `noimageindex` برای همهٔ پاسخ‌ها؛
- افزوده‌شده: meta robots برای صفحهٔ اتاق کنترل و Back Office؛
- تثبیت‌شده: `robots.txt` با `Disallow: /`، نبود sitemap عمومی و رد مسیرهای ناشناخته؛
- تثبیت‌شده: binding پیش‌فرض Compose روی `127.0.0.1` و الزام احراز هویت/TLS/firewall برای انتشار عمومی؛
- مرز: این کنترل‌ها جلوی ایندکس معمول را می‌گیرند، اما جایگزین احراز هویت و کنترل شبکه نیستند.

## 2026-08-31 — بستهٔ ۱۰ گام بعدی: مشاهده‌پذیری، revocation، outbox و pilot rehearsal

- افزوده‌شده: قرارداد `observability-v1` برای correlation مبتنی بر trace/span و projection امن event؛
- افزوده‌شده: Timeline و Performance Review خلاصه‌شده در `/backoffice`؛
- افزوده‌شده: revocation session مالک در حافظه و PostgreSQL، به‌همراه `POST /api/auth/revoke-session`؛
- افزوده‌شده: migration `005` برای revocation و lease/retry state در Outbox؛
- افزوده‌شده: `claimOutbox`، `acknowledgeOutbox` و `failOutbox` با claim محدود و `SKIP LOCKED`؛
- افزوده‌شده: `POST /api/pilots/dry-run` و evidence bundle deterministic بدون شبکه؛
- بهبود‌یافته: benchmark با latency تزریق‌پذیر، dataset version و digest قابل‌تکرار؛
- افزوده‌شده: تست‌های امنیتی، HTTP، PostgreSQL adapter، pilot و benchmark در `tests/next-ten-steps.test.mjs`؛
- شواهد: `pnpm check` در Linux container با Doctor/Governance/Build موفق و ۱۹۷/۱۹۷ تست پاس؛ smoke-test runtime برای چهار route با HTTP 200 و Compose healthy؛
- مرز: Provider زنده، external spend، Secret، deploy، worker خارجی و Production همچنان جداگانه gated هستند.

## 2026-08-30 — بک‌آفیس توسعهٔ مشاهده‌ای

- افزوده‌شده: مسیر `/backoffice` برای مشاهدهٔ وضعیت ۱۱ Team، Roleهای Multi-AI، گیت‌ها، شواهد و گام‌های بعدی؛
- افزوده‌شده: projection امن `/backoffice-data` بدون متن درخواست، Credential، Secret، Token یا عملیات تغییردهنده؛
- مرز: عملیات تغییر، اجرای Provider، مصرف هزینه، Deploy و Authorization همچنان در Control Plane و APIهای مالک‌محور باقی می‌مانند؛
- شواهد: تست route، تعداد ۱۱ Team، شش Role AI و ردشدن دادهٔ حساس اضافه شد.

## 2026-08-30 — یکپارچه‌سازی معماری Multi-AI با Hero

- افزوده‌شده: ADR-0009 و سند معماری Multi-AI برای نگاشت `ai-assistant/Wepod` به Project تحت مدیریت Hero؛
- افزوده‌شده: تفکیک قراردادی Team، AI Role، Agent Profile، Provider، Model، Invocation، Evaluation و Decision Proposal؛
- افزوده‌شده: هستهٔ deterministic Provider Gateway و کنترل‌های امنیتی Credential Reference، read-only Evaluator و owner-resolved decision؛
- افزوده‌شده: Context Assembly نسخه‌دار و Role-filtered بین AI Invocation و Project Memory؛
- افزوده‌شده: migration `002_ai_orchestration_projections.sql` برای Projectionهای امن AI بدون ذخیرهٔ Secret؛
- افزوده‌شده: قرارداد workflowهای چندنقشی و ثبت AI Role/schema/policy در route هر Task؛ implementation به‌صورت policy-default از executor/Codex استفاده می‌کند؛
- افزوده‌شده: Quality Gate async و adapter ارزیاب که Evaluation لینک‌شده را به revision loop evidence-first تبدیل می‌کند؛
- افزوده‌شده: ارزیابی دوره‌ای با پوشش اجباری ۱۱ تیم، پنج metric نرمال‌شده و verdict advisory؛
- افزوده‌شده: migration `003_ai_reliability_and_team_performance.sql`، AI projection adapter، timeout/retry/health/cost evidence و benchmark مصنوعی نسخه‌دار؛
- افزوده‌شده: APIهای owner-gated برای organization evaluation و AI event pagination و قراردادهای عمومی benchmark/performance؛
- افزوده‌شده: مرحلهٔ ۴.۵ برای معماری Multi-AI قابل‌تعویض و endpoint قرارداد عمومی؛
- افزوده‌شده: Adapterهای واقعی OpenAI Responses، Anthropic Messages، Google Gemini و OpenAI-compatible با credential resolver زمان اجرا، structured JSON و حساب هزینه؛
- افزوده‌شده: migration `004_domain_registry_snapshots.sql` و hydration نسخه‌دار Registryهای Domain و Control Dashboard در startup؛ Snapshotها append-only و بدون Secret خام هستند؛
- افزوده‌شده: شواهد Recovery عملیاتیِ disposable با `pg_dump`/`pg_restore`، checksum و sentinel در `docs/operations/RECOVERY-EVIDENCE-20260830.md`؛
- مرز: ارسال Provider زنده، External Spend، Secret Store، Connector خارجی، انتقال به مقصد عملیاتی، Deploy و Event projection کامل هنوز جداگانه gated هستند؛
- شواهد: `pnpm check` در Linux container با Node 22 و pnpm 11؛ Governance، Build و 188/188 تست موفق‌اند. Doctor فقط نبود Docker تو‌در‌تو در container را هشدار داد؛ Backup/Restore disposable نیز با موفقیت بازبینی شد.

## 2026-08-30 — اصول تیمی، تحقیق benchmark و مشاورهٔ خروجی

- افزوده‌شده: پنج مقدار پیش‌فرض قابل بررسی برای اصول هر یک از ۱۱ تیم؛
- افزوده‌شده: چرخهٔ درخواست تحقیق، benchmark، گزارش، بازکاری، رد و تأیید مالک؛
- افزوده‌شده: اعمال دانش و اصول پیشنهادی گزارش فقط پس از `approved` مالک؛
- افزوده‌شده: مشاورهٔ چندگزینه‌ای Planner برای prototype، web، mobile، API، اتوماسیون، داده و خروجی‌های تصمیم؛
- افزوده‌شده: گیت `output-decision` که تصمیم مالک را پیش از dispatch ثبت می‌کند؛
- شواهد: اجرای نهایی محلی و image تستی Docker با 170/170 تست موفق؛
- مرز: Provider واقعی، جست‌وجوی بیرونی، persistence کامل گزارش‌ها و تولید/استقرار واقعی همچنان جداگانه gated هستند.

## 2026-08-30 — آموزش تیم‌ها، readiness و audit کنترل

- افزوده‌شده: curriculum پنج‌گانه و benchmark نسخه‌دار برای هر ۱۱ تیم با حدنصاب ۸۰؛
- افزوده‌شده: APIهای `training-contract` و `training-plan` برای مشاهدهٔ مسیر آموزش و آمادگی؛
- افزوده‌شده: APIهای `plans` برای ثبت intake فارسی، Task Graph و گزارش readiness تیم مالک؛
- افزوده‌شده: `control.command-recorded` و audit sink تراکنشی PostgreSQL با timeline صفحه‌بندی‌شده؛
- افزوده‌شده: CI با سرویس PostgreSQL آزمایشی و اجرای واقعی `check:postgres`؛
- افزوده‌شده: `PILOT-READINESS.md` و `check:pilot` برای اعلام شفاف blockerهای HERO-021 بدون جعل آمادگی؛
- مرز: projection کامل domain، session revocation پایدار، Provider زنده، deploy و production همچنان فعال نشده‌اند.

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
# 2026-09-04 — persistence benchmark و ممیزی خروجی

- افزوده‌شده: `PostgresBenchmarkStore` برای ذخیره، بازیابی و مقایسهٔ benchmarkهای synthetic با digest ثابت، idempotency و مرز advisory-only؛
- افزوده‌شده: اتصال Control Plane به history و comparison پایدار benchmark در صورت تنظیم `HERO_POSTGRES_URL`؛
- افزوده‌شده: اعتبارسنجی مجدد رکوردهای خوانده‌شده از PostgreSQL پیش از ورود به projection پنل؛
- افزوده‌شده: audit دسترسی به read model با metadata allowlist و endpoint owner-gated جدا از audit فرمان‌ها؛
- شواهد: `pnpm check` در Linux با Build `130` ماژول و `220/220` تست موفق است؛ `check:pilot` همچنان همان سه گیت عملیاتی را مسدود می‌کند؛ اجرای production persistence همچنان به مجوز جداگانه و Secret Store نیاز دارد.

# 2026-08-31 — Back Office access and operational readiness batch 2

- افزوده‌شده: access metadata و راهنمای same-host برای رفع ابهام لینک `127.0.0.1:43100`؛
- افزوده‌شده: جست‌وجو/فیلتر Team، خطایابی اتصال UI و endpoint امن `/backoffice-events`؛
- افزوده‌شده: ثبت outcome ردشدهٔ فرمان، Outbox worker تزریق‌پذیر، قرارداد Pilot و synthetic benchmark endpoint؛
- شواهد: build لینوکس با Doctor/Governance/Build و ۲۰۲/۲۰۲ تست موفق؛ runtime smoke برای `/backoffice`، `/backoffice-data`، `/backoffice-events` و `/pilot-contract` با HTTP 200.
- امنیت انتشار: Basic Auth اختیاریِ fail-closed، `robots.txt` و `X-Robots-Tag` اضافه شد؛ راهنمای DNS/TLS/reverse-proxy در `docs/operations/BACKOFFICE-SUBDOMAIN.md` ثبت شد.

# 2026-09-04 — بازطراحی حرفه‌ای Back Office

- تغییر UI: صفحهٔ تجمیعی به شش نمای مستقل و task-based شامل نمای کلی، تیم‌ها، Multi-AI، پروژه و قراردادها، عملیات و شواهد، و راهنما تقسیم شد؛ همهٔ قابلیت‌ها و شناسه‌های قبلی حفظ شدند.
- افزوده‌شده: ناوبری کناری با وضعیت فعال، عنوان نمای جاری، hash URL برای لینک مستقیم، و چیدمان responsive برای دسکتاپ و موبایل.
- مبنای طراحی: progressive disclosure، یک سطح تصمیم در هر نما، حفظ وضعیت/دسترسی در سطح بالا و نمایش جزئیات داخل کارت‌ها؛ هیچ وابستگی یا endpoint جدیدی اضافه نشد.
- شواهد: `pnpm check` با Doctor/Governance/Build موفق و ۲۳۱/۲۳۱ تست سبز؛ Syntax اسکریپت نهایی HTML و وجود شش route/view نیز در کانتینر Node بررسی شد.
- مرز: این تغییر فقط کد UI، تست و مستندات است و Deploy production، Secret، PostgreSQL و سرویس‌های دیگر را تغییر نمی‌دهد.
# ۲۰۲۶-۰۹-۰۵ — guard persistence و ممیزی مسیرها

- اصلاح‌شده: مقایسهٔ Benchmark بدون داده اکنون پاسخ advisory خالی و `200` می‌دهد؛
- افزوده‌شده: guard `HERO_REQUIRE_POSTGRES=true` تا Test بدون PostgreSQL آماده اعلام نشود؛
- افزوده‌شده: تست تکرارپذیر ممیزی ۵۸ مسیر GET؛
- artifact ساخته‌شده: `hero-control-plane:candidate-b379109` با digest `sha256:f3105572fed55c3df981bd9016b833d6a0ff1c900228e2bab8e05ba532574520`؛ فقط Test، بدون Production.

# ۲۰۲۶-۰۹-۱۱ — بستهٔ ۲۰ گام Project Workspace و Settings

- افزوده‌شده: خواندن و hydration نسخه‌های append-only پروژه، input metadata، Foundation Proposal، تنظیمات و read-only import plan از PostgreSQL؛
- افزوده‌شده: اتصال mutationهای Project Workspace و Settings به persistence با actor، reason، impact و rollback reference؛
- افزوده‌شده: نمای project-scoped در Product Studio برای intake، Foundation، input metadata، settings و import plan بدون نمایش محتوای فایل یا Secret؛
- افزوده‌شده: تست‌های hydration، store read، HTTP snapshot و حذف محتوای حساس از read model؛
- شواهد: build لینوکس با ۲۲۵ ماژول و ۳۱۶ تست موفق؛ `check:docs` و `pnpm check` باید روی commit تحویلی دوباره اجرا شوند؛
- مرز: private object storage، malware scanner/parser واقعی، browser acceptance، Provider، Secret، هزینه، Production و Pilot در این بسته فعال نشده‌اند.

# ۲۰۲۶-۰۹-۱۸ — Scope نسخه‌دار AI برای پروژه‌های متعدد

- افزوده‌شده: مدل provider-agnostic برای تنظیم Scope هر Project در Back Office با حالت‌های `enabled`، `local-only` و `disabled`؛
- افزوده‌شده: capabilityهای نسخه‌دار `walkthrough-guide`، `smart-tester` و `invocation` با کنترل optimistic-concurrency و event append-only؛
- افزوده‌شده: انتخاب Project و ثبت Scope از فرم «ثبت تغییر نسخه‌دار»، نمایش Scopeهای موجود و اعلام صریح اینکه Scope به‌تنهایی مجوز هزینهٔ خارجی نیست؛
- اصلاح‌شده: مسیر انتخاب Advisor و اجرای live اکنون Scope پروژه را قبل از authorization هزینه و Provider call بررسی می‌کند و برای پروژهٔ نامجاز fail-closed است؛
- شواهد: تست‌های هدفمند AI و Back Office برابر ۳۰/۳۰ موفق و full check برابر ۴۶۲/۴۶۲ تست موفق؛
- مرز: Provider، Secret، هزینهٔ خارجی، Pilot و Production تغییر نکردند. برای اجرای زنده روی پروژهٔ جدید، authorization مستقل و دقیق همان پروژه همچنان الزامی است.

# ۲۰۲۶-۰۹-۱۸ — Preflight سرور Test جدا

- شواهد: اتصال SSH بدون رمز به `185.204.168.171` با `id -u=0` موفق شد؛ سیستم Ubuntu 24.04.4، دو CPU، حدود ۴ GiB RAM و حدود ۲۵ GiB فضای آزاد دارد؛
- آماده‌سازی: Docker `29.1.3` و Docker Compose `2.40.3` فقط روی همین Target Test نصب و سرویس Docker فعال شد؛
- preflight: تعداد container و image برابر صفر بود؛ فقط شبکه‌های پیش‌فرض Docker و سرویس‌های پایهٔ SSH/DNS/containerd مشاهده شدند؛
- مرز: هیچ محصول، image، Secret، Provider زنده، Port اختصاصی Hero، Production یا Pilot روی Target اجرا نشد؛
- گیت بعدی: ثبت Target/Agent و heartbeat واقعی فقط پس از تعیین `projectId`، `targetId` و authorization نسخه‌دار مخصوص همان Target مجاز است؛ هیچ شناسه‌ای حدس زده نمی‌شود.
