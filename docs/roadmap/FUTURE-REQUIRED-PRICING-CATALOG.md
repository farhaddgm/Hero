# قابلیت ضروری آینده: Pricing Catalog نسخه‌دار Hero

وضعیت: `planned-awaiting-owner-confirmation`

این قابلیت باید پیش از فعال‌سازی Provider پولی و پیش از هر استفادهٔ عملیاتی واقعی از
محاسبهٔ هزینه تکمیل شود. مالک صریحاً خواسته است فعلاً فقط آن را ثبت و طراحی کنیم؛
پیاده‌سازی، migration و فعال‌سازی Provider تا دریافت تأیید جداگانه انجام نمی‌شود.

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

## Migration، تست و Rollback موردنیاز

پس از تأیید مالک، کار در این ترتیب انجام می‌شود:

1. بررسی کد فعلی و تبدیل محاسبهٔ دستی نرخ به interface عمومی Catalog/Adapter؛
2. افزودن migration و projection append-only برای Catalog، رکورد مدل و audit metadata؛
3. افزودن Catalog مصنوعی و نسخه‌گذاری‌شده برای تست؛ بدون API Key و بدون شبکه؛
4. افزودن sync validator با منبع جعلیِ کنترل‌شده در تست و تست rejection منبع نامعتبر؛
5. افزودن تست مدل ناشناخته، Catalog ناقص، Catalog منقضی، ارز ناسازگار و نرخ نامعتبر؛
6. افزودن تست cap برای input/output/cached و بدترین‌حالت پیش از dispatch؛
7. افزودن تست Provider توکنی و Provider غیرتوکنی با Adapter جدا؛
8. افزودن تست audit redaction برای اطمینان از نبود Secret، API Key، prompt و output خام؛
9. مستندسازی نمونهٔ تنظیمات، migration، rollback و عملیات sync؛
10. اجرای `pnpm check`، تست امنیتی، تست عدم تماس شبکه در حالت synthetic و بررسی عدم تداخل با Compose/volume/network پروژه‌های دیگر؛
11. ساخت artifact نسخه‌دار و ثبت evidence؛
12. فعال‌سازی Provider واقعی فقط با مجوز مستقل external-spend و تأیید جداگانهٔ مالک.

Rollback باید بتواند نسخهٔ Catalog و کد مصرف‌کننده را به آخرین زوج معتبر برگرداند؛ در
صورت نامعتبر بودن هر دو، سیستم باید dispatch را متوقف نگه دارد، نه اینکه به نرخ دستی یا
حدس‌زده برگردد.

## شرط شروع پیاده‌سازی

برای شروع، مالک باید این عبارت یا معادل روشن آن را ارسال کند:

```text
پیاده‌سازی Pricing Catalog طبق FUTURE-REQUIRED-PRICING-CATALOG.md را تأیید می‌کنم؛
فقط با Catalog مصنوعی و تست بدون API Key، بدون شبکهٔ واقعی و بدون هزینهٔ واقعی.
```

تا قبل از این تأیید، این سند فقط یک آیتم ضروریِ ثبت‌شده در رودمپ است. یادآوری آن در
بررسی‌های بعدی رودمپ انجام می‌شود؛ یادآوری تقویمی خودکار بدون تاریخ/زمان مشخص ایجاد
نشده است.
