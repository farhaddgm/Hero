# ممیزی مرورگر رابط Hero

Document ID: `HERO-OPS-UI-BROWSER-AUDIT`  
Version: `1.0.0`

ممیزی اختیاری `pnpm check:ui` یک سرور محلی با پورت آزاد، حساب‌های موقت و دادهٔ ساختگی ایجاد می‌کند. متغیرهای عملیاتی `HERO_*` را در پردازش خودش کنار می‌گذارد؛ هیچ PostgreSQL، Provider یا محیط واقعی را تغییر نمی‌دهد. مرورگر فقط اجازهٔ درخواست به همان origin محلی دارد. `pnpm check` همچنان بررسی اصلی پروژه است.

ابزارهای ممیزی جدا از وابستگی‌های runtime، داخل پوشهٔ نادیده‌گرفته‌شده نصب می‌شوند:

```sh
npm install --prefix .hero-ui --cache .hero-ui/npm-cache --no-save --package-lock=false --ignore-scripts playwright@1.63.0 @axe-core/playwright@4.13.0
PLAYWRIGHT_BROWSERS_PATH=.hero-ui/browsers node .hero-ui/node_modules/playwright/cli.js install chromium
pnpm check:ui
```

روی Windows، `PLAYWRIGHT_BROWSERS_PATH` را با دستور مناسب shell در environment تنظیم کنید. ابزار مسیر خروجی را نسبت به ریشهٔ مخزن می‌سازد و به مسیر میزبان وابسته نیست. Linux مرجع اجرای مرورگر است؛ کتابخانه‌های استاندارد Chromium و یک فونت fallback باید در runtime موجود باشند. اگر runtime فاقد این کتابخانه‌هاست، می‌توان بسته‌ها را فقط در `.hero-ui` استخراج و مسیر کتابخانه/Fontconfig را با environment همان پردازش تنظیم کرد؛ نصب یا تغییر سرویس زنده لازم نیست.

خروجی در `.hero-ui/results/report.json` شامل موارد اجراشده، خطاهای JavaScript، سرریز افقی و یافته‌های axe است. تصویر هر نمای دسکتاپ و موبایل در همان پوشه ذخیره می‌شود. فایل‌ها وارد Git نمی‌شوند و فقط دادهٔ ساختگی دارند.

پوشش: صفحهٔ ورود ناشناس، خطای ورود و تلاش دوباره، رمز/MFA با focus و ارقام فارسی، پاک‌شدن رمز پس از مرحلهٔ اول، جست‌وجو/فیلتر/بدون‌نتیجه، palette صفحه‌کلید، پنجرهٔ ساخت پروژه، ۹ نما و ۵ زیرنمای مدیریت در چهار عرض ۱۴۴۰/۷۶۸/۳۹۰/۳۲۰ و دو پوسته، کشوی موبایل، محصورکردن و بازگرداندن focus، شروع جمع‌شدهٔ راهنما، حفظ بسته‌بودن آن میان صفحه‌ها و مرورگر بدون localStorage. axe برای تمام نماها، ورود و پنجرهٔ ساخت پروژه در عرض دسکتاپ و موبایل و هر دو پوسته اجرا می‌شود. خطای JavaScript، سرریز افقی یا یافتهٔ serious/critical موجب شکست ممیزی است؛ همهٔ یافته‌های دیگر هم در گزارش باقی می‌مانند.

این ممیزی جای بررسی authenticated محیط Test/Production، آزمون screen reader یا تأیید انتشار را نمی‌گیرد. متغیر `HERO_UI_ENVIRONMENT` در نمونهٔ تنظیمات توسعه/Test/Production به‌ترتیب `development`/`test`/`production` است. در نبود مقدار معتبر، رابط «محیط خصوصی» نمایش می‌دهد؛ نشان محیط ادعای سلامت سرویس نیست.
