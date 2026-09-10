# قابلیت ضروری آینده: Pricing Catalog نسخه‌دار Hero

وضعیت: `implemented-synthetic-awaiting-live-authorized-rollout`

این قابلیت باید پیش از فعال‌سازی Provider پولی و پیش از هر استفادهٔ عملیاتی واقعی از
محاسبهٔ هزینه تکمیل شود. مالک پیاده‌سازی synthetic آن را تأیید کرده است؛ بنابراین
قرارداد، migration، Adapterها و تست‌های بدون شبکه اجرا شده‌اند. فعال‌سازی Provider
واقعی، همگام‌سازی از منبع رسمی و هرگونه هزینه همچنان جداگانه gated است.

## تصمیم و مرز فعلی

- Provider Test فعلاً خاموش است و در این مرحله هیچ API Key، درخواست Provider یا هزینهٔ واقعی استفاده نمی‌شود.
- تنظیم پیشنهادی فعلی برای تست، OpenAI با Model IDهای اعلام‌شدهٔ `gpt-5.6-luna` برای تحلیل و اجرا، سقف کل `5 USD` و هشدار `4 USD` است؛ این مقادیر مجوز اجرایی نیستند.
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

## شرط شروع فعال‌سازی واقعی

برای شروع، مالک باید این عبارت یا معادل روشن آن را ارسال کند:

```text
پیاده‌سازی Pricing Catalog طبق FUTURE-REQUIRED-PRICING-CATALOG.md را تأیید می‌کنم؛
فقط با Catalog مصنوعی و تست بدون API Key، بدون شبکهٔ واقعی و بدون هزینهٔ واقعی.
```

تأیید synthetic ثبت و اجرا شده است. برای فعال‌سازی واقعی هنوز مجوز مستقل Provider،
Secret و external-spend لازم است. یادآوری آن در بررسی‌های بعدی رودمپ انجام می‌شود؛
یادآوری تقویمی خودکار بدون تاریخ/زمان مشخص ایجاد نشده است.
