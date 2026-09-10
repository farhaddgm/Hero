# راهنمای Provider واقعی و مجوز هزینه

Provider زنده در Hero اکنون از نظر کد آماده و به‌صورت پیش‌فرض خاموش است. فعال‌شدن آن به‌تنهایی کافی نیست: credential، Pricing Catalog معتبر، سقف، Provider، Model، Role، Step/Version، زمان انقضا و Global Stop همگی باید دقیق باشند؛ در غیر این صورت dispatch قبل از تماس شبکه رد می‌شود.

## مدل کنترل هزینه

یک `Hero Cost Unit` برابر `0.0001` واحد ارز Catalog است. نرخ‌های ورودی، خروجی و cached باید در Pricing Catalog نسخه‌دار از منبع رسمی Provider ذخیره شوند؛ نرخ هر درخواست از Environment خوانده نمی‌شود. Hero قبل از تماس، بدترین هزینهٔ محافظه‌کارانه را با سقف output محاسبه می‌کند و پس از پاسخ نیز usage واقعی را دوباره با cap می‌سنجد. جزئیات قرارداد در [Pricing Catalog](../roadmap/FUTURE-REQUIRED-PRICING-CATALOG.md) آمده است.

## متغیرهای لازم در Secret Store محیط Test

```text
HERO_ENABLE_REAL_PROVIDERS=true
HERO_OPENAI_API_KEY=<secret>
HERO_EXTERNAL_SPEND_AUTHORIZATION_ACTIVE=true
HERO_EXTERNAL_SPEND_AUTHORIZATION_ID=AUTH-PILOT-001
HERO_EXTERNAL_SPEND_PROJECT_ID=hero
HERO_EXTERNAL_SPEND_STEP_ID=HERO-021
HERO_EXTERNAL_SPEND_DOCUMENT_VERSION=v1.0
HERO_EXTERNAL_SPEND_PROVIDER_ID=openai
HERO_EXTERNAL_SPEND_MODEL_IDS=<comma-separated-exact-model-ids>
HERO_EXTERNAL_SPEND_ROLE_IDS=analyst,evaluator,decision-maker,planner,researcher,executor,verifier,code-reviewer
HERO_EXTERNAL_SPEND_MAX_COST_UNITS=50000
HERO_EXTERNAL_SPEND_EXPIRES_AT=<short-lived-UTC-timestamp>
HERO_EXTERNAL_SPEND_GLOBAL_STOP=false
```

API key فقط در Secret Store قرار می‌گیرد و نباید در Git، Sheet، ticket، log یا چت فرستاده شود. متغیرهای قدیمی نرخ هزینه نباید تنظیم شوند؛ Catalog معتبر باید پیش از فعال‌سازی Provider در runtime بارگذاری شده باشد.

## کار مالک

مالک باید Model IDهای در دسترس حساب و سقف دلاری را انتخاب کند. متن پیشنهادی تأیید:

```text
پایلوت HERO-PILOT-001 v1.0 را برای محیط Test تأیید می‌کنم. فقط OpenAI، فقط Model IDهای ثبت‌شده، فقط Roleهای ثبت‌شده، تا سقف کل ۵ دلار، تا زمان انقضای ثبت‌شده و بدون Production، پیام بیرونی، تغییر Secret اضافی یا عملیات مخرب مجاز است.
```

ثبت API key در Secret Store یک `secret-change` جداست و باید صریحاً به ادمین مجاز شود. پس از اجرای یک invocation کنترل‌شده، Global Stop یا `HERO_EXTERNAL_SPEND_AUTHORIZATION_ACTIVE=false` باید مجوز را ببندد.
