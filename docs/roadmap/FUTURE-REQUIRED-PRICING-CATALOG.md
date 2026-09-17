# قابلیت ضروری آینده: Pricing Catalog نسخه‌دار Hero

وضعیت: `implemented-test-authorized-rollout-blocked`

- Document ID: `HERO-ROADMAP-FUTURE-REQUIRED-PRICING-CATALOG`
- Version: `1.1.0`

این قابلیت پیش از فعال‌سازی Provider پولی و هر استفادهٔ عملیاتی واقعی از محاسبهٔ
هزینه تکمیل شده است. قرارداد، migration، Adapterها و تست‌های بدون شبکه اجرا شده‌اند.
برای rollout محدود Test، یک authorization مستقل و نسخه‌دار ثبت شده است؛ با این حال
فراخوانی واقعی تا وقتی artifact جدید، پیکربندی runtime منطبق و Project/Binding فعال در
Test وجود نداشته باشد، fail-closed می‌ماند.

## تصمیم و مرز فعلی

- مسیر Provider-agnostic برای Smart Tester و Walk-Through Guide فقط در صورت انتخاب یک Profile فعالِ bound به همان Project می‌تواند Provider را فراخوانی کند؛ در نبود آن، پاسخ محلی و بدون dispatch ارائه می‌شود.
- authorization `AUTH-AI-TEST-001` فقط برای `test`، Project `hero`، OpenAI Model `gpt-5.6-luna`، Role `analyst`، دو capability `smart-tester` و `walkthrough-guide`، سقف تجمعی `50,000` Hero cost units و پایان `2027-02-23T23:59:59Z` است. این record هیچ Secretی ندارد و Production/Pilot را در scope نمی‌آورد.
- نرخ Test از منبع رسمی OpenAI با Catalog نسخه‌دار `openai-gpt-5.6-luna-20260916-v1` می‌آید: input `0.20 USD/1M`، cached input `0.02 USD/1M` و output `1.20 USD/1M`. Catalog در `2026-10-16T00:00:00Z` منقضی می‌شود تا review نرخ الزامی و fail-closed باشد.
- پیکربندی runtime، Project، Provider، Model، Profile و Binding باید جداگانه و در محیط Test برقرار باشند. هیچ API Key، مقدار خام credential، محتوای درخواست/پاسخ یا مسیر host در Git، Catalog یا Evidence ثبت نمی‌شود.
- شناسهٔ مدل، Provider، سقف هزینه و زمان انقضای مجوز باید بعداً توسط Admin در پیکربندی نسخه‌دار تغییرپذیر باشند.
- نرخ قیمت قابل ویرایش دستی در Environment نیست؛ نرخ فقط از Catalog معتبر و منبع رسمی Provider پذیرفته می‌شود.
- Secret، API Key، مقدار خام credential و محتوای درخواست/پاسخ در Git، Google Sheet، Catalog یا Audit Log ثبت نمی‌شود.

## هدف معماری

محاسبهٔ هزینه باید از مسیر زیر انجام شود:

`Provider + Model → Pricing Catalog معتبر → Cost Adapter → Hero Cost Units → Cap Check → Provider Dispatch`

درخواست باید قبل از تماس با Provider، Catalog و سقف هزینه را بررسی کند. اگر مدل ناشناخته
باشد، نرخ منقضی یا ناقص باشد، ارز/واحد ناسازگار باشد، یا بدترین هزینهٔ قابل انتظار از
سقف عبور کند، درخواست باید fail-closed متوقف شود و هیچ هزینه‌ای ایجاد نکند.

## ساختار Catalog

Catalog دارای نسخه و رکوردهای immutable یا append-only خواهد بود. هر رکورد مدل حداقل
این فیلدها را دارد:

| فیلد | قاعده |
|---|---|
| `provider_id` | شناسهٔ نرمال‌شدهٔ Provider |
| `model_id` | شناسهٔ دقیق مدل نزد Provider |
| `input_price_per_1m_tokens` | نرخ ورودی؛ عدد غیرمنفی یا `null` برای مدل غیرتوکنی |
| `output_price_per_1m_tokens` | نرخ خروجی؛ عدد غیرمنفی یا `null` برای مدل غیرتوکنی |
| `cached_input_price` | نرخ ورودی cached در صورت ارائهٔ رسمی؛ در غیر این صورت `null` |
| `currency` | ارز رسمی نرخ، با واحد صریح مثل `USD` |
| `source_url` | لینک رسمی Provider، نه وبلاگ یا منبع واسطه |
| `fetched_at` | زمان دریافت Catalog |
| `valid_until` | پایان اعتبار رکورد؛ رکورد بدون اعتبار معتبر نیست |
| `catalog_version` | نسخهٔ یکتای Catalog |

برای جلوگیری از ابهام، نوع قیمت، precision، rounding policy و fingerprint کل Catalog
نیز در مدل داخلی ثبت می‌شود. نرخ‌های OpenAI باید از مستندات رسمی قیمت/مدل خوانده شوند؛
در هر درخواست Provider هیچ درخواست اینترنتی برای قیمت انجام نمی‌شود. مستندات رسمی
OpenAI، هم فهرست Model IDها و قیمت‌ها را ارائه می‌کند و هم امکان محدودکردن سقف هزینهٔ
در سطح Project را توضیح می‌دهد: [OpenAI Models](https://developers.openai.com/api/docs/models)
و [Project API keys and spend limit](https://developers.openai.com/api/reference/typescript/resources/admin/subresources/organization/subresources/projects).

## Adapterهای هزینه

این قرارداد باید Provider-neutral باشد:

1. `TokenPricingAdapter`: هزینه را از input، output و cached token محاسبه می‌کند.
2. `RequestUnitPricingAdapter`: برای Providerی که نرخ توکنی ندارد، هزینه را از واحد رسمی همان Provider، مانند request، image، minute یا compute unit، محاسبه می‌کند.
3. هر Adapter باید ورودی، واحد، precision، rounding و خطای خود را validate کند و در صورت دادهٔ ناکافی متوقف شود.

Environment فقط محل Secret و تنظیمات runtime مانند Provider، Model، cap و authorization
expiry می‌ماند. متغیرهایی مانند `HERO_OPENAI_INPUT_COST_UNITS_PER_1K_TOKENS` و
`HERO_OPENAI_OUTPUT_COST_UNITS_PER_1K_TOKENS` پس از migration نباید منبع نرخ باشند و
باید از قرارداد runtime حذف یا به‌صورت fail-closed رد شوند.

## Audit و کنترل Admin

برای هر تصمیم هزینه، بدون Secret، این metadata ثبت می‌شود:

- Provider و Model ID؛
- سقف مجاز و مصرف درخواست/مجوز؛
- واحد و مقدار هزینهٔ داخلی Hero؛
- نسخه و fingerprint Catalog؛
- نرخ snapshot‌شدهٔ مورد استفاده، بدون credential؛
- نتیجهٔ cap check و علت توقف در صورت رد؛
- زمان و شناسهٔ امن Invocation.

Admin می‌تواند Provider، Model ID، cap و تاریخ انقضای مجوز را در سطح کنترل‌شده تغییر دهد؛
اما نمی‌تواند با Environment یا فرم آزاد، نرخ جعلی وارد کند. تغییر قیمت فقط از sync
نسخه‌دار و منبع رسمی می‌آید و هر تغییر نیازمند validation و rollback است.

## همگام‌سازی و fail-closed

- Sync Catalog یک عملیات مدیریتی/انتشار نسخه است، نه بخشی از مسیر درخواست.
- Sync فقط از URLهای allow-listed رسمی Provider انجام می‌شود و نسخهٔ جدید تا عبور از schema، منطق عددی، currency، زمان اعتبار و duplicate checks فعال نمی‌شود.
- آخرین Catalog معتبر در runtime cache/DB نگهداری می‌شود؛ درخواست‌ها به cache معتبر و همان نسخه متکی‌اند.
- نبودن Catalog، مدل ناشناخته، `valid_until` گذشته، نرخ ناقص، نرخ منفی/غیرعددی یا ناسازگاری واحد، قبل از dispatch خطای قابل مشاهده و بدون spend ایجاد می‌کند.
- انتشار نسخهٔ جدید باید atomic باشد و امکان بازگشت به آخرین Catalog معتبر وجود داشته باشد.

## نتیجهٔ اجرای تأییدشده — ۲۰۲۶-۰۹-۱۰

- قرارداد versioned و fail-closed برای Catalog و دو mode توکنی/واحدی پیاده‌سازی شد؛
- Registry حافظه‌ای، sync مدیریتیِ خارج از مسیر درخواست و store append-only PostgreSQL افزوده شد؛
- محاسبهٔ cached input، rounding محافظه‌کارانه، cap پیش از dispatch و metadata امنِ audit متصل شد؛
- نرخ‌های دستی Environment از مسیر runtime حذف و استفادهٔ صریح از آن‌ها رد می‌شود؛
- تست‌های synthetic برای مدل ناشناخته، Catalog منقضی/ناقص، منبع نامعتبر، cap، عدم تماس شبکه، Adapter غیرتوکنی، persistence و redaction اضافه شد؛
- API Key، Provider واقعی، sync اینترنتی و هزینهٔ واقعی در این مرحله استفاده نشده است.

## آمادگی rollout محدود Test — ۲۰۲۶-۰۹-۱۷

- مسیر live برای هر Provider انتخاب‌شده، از Policy/Role/Profile/Binding همان Project عبور می‌کند؛ UI فقط نتیجهٔ ساخت‌یافته و مصرف حسابداری‌شده را نمایش می‌دهد و به OpenAI وابستگی مستقیم ندارد.
- پیش از dispatch، authorization runtime باید active، خارج از انقضا، با Global Stop خاموش و دقیقاً منطبق با Project، Provider، Model، Role، Step ID و Document Version باشد. mismatch یا خطای configuration با پاسخ JSON امن متوقف می‌شود و Provider را صدا نمی‌زند.
- Prompt و پاسخ مدل persist نمی‌شوند؛ ledger فقط invocation identifier امن، Provider/Model/Role/context identifiers، latency/usage/cost و وضعیت redacted را نگه می‌دارد. متن قابل‌نمایش نیز redaction و سقف طول دارد.
- Test یکپارچهٔ هر دو capability با Provider fake تأیید می‌کند که Walk-Through و Smart Tester در مسیر live نتیجهٔ `analysis-v1` می‌گیرند؛ آزمون دوم، mismatch Role را با `403` و بدون هرگونه dispatch تأیید می‌کند. تست‌های کامل repository نیز این تغییر را پوشش می‌دهند.
- وضعیت rollout پس از ممیزی ۲۰۲۶-۰۹-۱۷: source تغییر مرتبط روی commit `9b0b458e0c59366f9f3cc835e7e6b70f15a7b7a9` است و `pnpm check` برابر `389 pass / 0 fail` است؛ Test هنوز روی artifact قبلی `1.1.2` از commit `0caa40b49b74aad13e2a0c78545f6c0eb28262ea` و digest `ghcr.io/farhaddgm/hero@sha256:641e6c75b5f871e87053cf2d959fe250a20067b8ecc7fe0571e15345f31c0d10` اجرا می‌شود. Runtime authorization اکنون کامل و active است: `AUTH-AI-TEST-001`، Project `hero`، OpenAI، `gpt-5.6-luna`، Role `analyst`، cap `50000`، expiry `2027-02-23T23:59:59Z` و Global Stop خاموش. Secret Store reference در Test configured با version `6` است، اما snapshot AI برای Project `hero` هیچ Profile فعال و هیچ Binding ندارد؛ بنابراین dispatch هر دو capability بدون Provider call fail-closed می‌ماند. Publish candidate به GHCR نیز به‌دلیل `permission_denied` و scope ناکافی token انجام نشد؛ tag، manifest و promotion جدید عمداً ساخته نشدند و هیچ تماس OpenAI یا هزینه‌ای ایجاد نشده است.

### Requirement trace

| الزام | پیاده‌سازی و Evidence |
|---|---|
| انتخاب Provider بدون وابستگی مستقیم UI | `apps/control-plane/src/server.mjs`، `apps/control-plane/src/hero-shell.mjs`، `tests/project-identity.test.mjs` |
| authorization/permission/cost fail-closed | `packages/adapters/src/external-spend-authorization.mjs`، `packages/domain/src/ai-orchestration.mjs`، `tests/real-provider-and-hydration.test.mjs` |
| Secret redaction و Test-only vault reference | `packages/adapters/src/ai-provider-http.mjs`، `packages/adapters/src/hero-secret-store.mjs`، `tests/hero-secret-store.test.mjs` |
| structured result و evidence امن برای دو capability | `apps/control-plane/src/server.mjs`، `tests/project-identity.test.mjs`؛ result با schema `analysis-v1` و evidence فقط شامل metadata، usage/cost، latency و binding است |
| timeout، retry محدود، provider failure، invalid output و unavailable binding | `packages/adapters/src/ai-provider-http.mjs`، `packages/domain/src/ai-orchestration.mjs`، `tests/ai-governance-v2.test.mjs`، `tests/real-provider-and-hydration.test.mjs` |
| نرخ رسمی و Catalog محدود به Test | `apps/control-plane/src/server.mjs`، `config/authorizations/AUTH-AI-TEST-001-v1.0.json`، [مدل رسمی GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) |

## Migration، تست و Rollback موردنیاز

بخش synthetic این کارها انجام شده است. برای rollout واقعی، موارد باقی‌مانده در این ترتیب
انجام می‌شوند:

1. اجرای migration `007_pricing_catalog.sql` در محیط Test از مسیر عملیاتی کنترل‌شده؛
2. ساخت Catalog رسمی با نرخ‌های دریافت‌شده از منبع رسمی و اعتبار زمانی مشخص؛
3. اعتبارسنجی و انتشار Catalog بدون فعال‌سازی خودکار؛
4. فعال‌سازی Provider واقعی فقط با مجوز مستقل external-spend و تأیید جداگانهٔ مالک؛
5. پایلوت محدود، ارزیابی، Code Review و rollback کنترل‌شده.

Rollback باید بتواند نسخهٔ Catalog و کد مصرف‌کننده را به آخرین زوج معتبر برگرداند؛ در
صورت نامعتبر بودن هر دو، سیستم باید dispatch را متوقف نگه دارد، نه اینکه به نرخ دستی یا
حدس‌زده برگردد.

## شرط اجرای live Test

مالک authorization مستقل را ثبت کرده است. اجرای واقعی فقط پس از promotion immutable
artifact به Test و verify آن، و فقط با environment configuration منطبق با همان record
انجام می‌شود. سپس Human Owner باید در همان Test، Project `hero`، Provider/Model، Profile
`analyst` با Test vault reference و Role Binding را بسازد، health check را بگذراند و یک
Walk-Through و یک Smart Tester را اجرا کند. هر گیت نامنطبق باید بدون dispatch متوقف شود.
این مسیر نه Production را تغییر می‌دهد، نه Pilot را، و نه Secret را ایجاد/چاپ می‌کند.

## Evidence اجرای live — ۲۰۲۶-۰۹-۱۷

| Scenario | Capability | Provider/Model/Role | Status | Evidence امن |
|---|---|---|---|---|
| Walk-Through واقعی | `walkthrough-guide` | OpenAI / `gpt-5.6-luna` / `analyst` | `not-executed` | قبل از dispatch به‌دلیل نبود Profile/Binding فعال برای Project `hero` متوقف شد؛ invocation id، prompt و پاسخ ایجاد/ذخیره نشد |
| Smart Tester واقعی | `smart-tester` | OpenAI / `gpt-5.6-luna` / `analyst` | `not-executed` | همان گیت fail-closed؛ هیچ side-effect، Provider call یا هزینه‌ای ایجاد نشد |

برای تکمیل این دو evidence، Human Owner باید در Test و فقط در Project `hero` Profile و Binding منطبق با authorization بسازد/تأیید کند؛ سپس health check و هر دو سناریو با ثبت امنِ scenario id، provider/model/role، binding، status، latency، usage/cost metadata، schema و timestamp اجرا شوند. مجوز یا Secret جدید در این سند یا چت درخواست نمی‌شود.
