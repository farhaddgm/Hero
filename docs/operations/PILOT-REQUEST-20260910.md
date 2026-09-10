# درخواست پیشنهادی پایلوت Hero — HERO-PILOT-001

وضعیت: `awaiting-owner-approval`

برای حذف ابهام، یک پایلوت کوچک، کم‌ریسک و قابل‌اندازه‌گیری تعریف شده است: ساخت و آزمون یک VPN خصوصی که از ایران قابل استفاده باشد. این Pilot روی VPS/VM مستقل اجرا می‌شود و به سرور مشترک فعلی Hero، سرویس‌های دیگر، دادهٔ ترافیک یا Production دست نمی‌زند. «قابل استفاده در ایران» فقط با آزمون واقعی روی شبکه‌های مشخص پذیرفته می‌شود و تضمین دائمی برای همهٔ ISPها نیست.

قرارداد ماشینی کامل در [HERO-PILOT-001-v1.0.json](../../config/pilot/HERO-PILOT-001-v1.0.json) است. موفقیت نیازمند پاس‌شدن همهٔ معیارهای اجباری، `pnpm check`، نبود finding بحرانی/بالا، امتیاز Evaluator حداقل ۸۵، تأیید Verifier و Code Reviewer و rollback آزموده‌شده است.

## شکل پیشنهادی محصول

- مسیر اصلی: AmneziaWG؛
- مسیر fallback: XRay VLESS Reality روی TCP/443، در صورت آزاد بودن پورت؛
- کلاینت اولیه: Android و Windows؛ iOS/macOS در مرحلهٔ بعد؛
- هر device فایل configuration و کلید مستقل دارد؛ یک فایل بین چند دستگاه استفاده نمی‌شود؛
- logging فقط به metadata عملیاتی محدود است و محتوای ترافیک، DNS query و browsing history ثبت نمی‌شود.

مستندات رسمی Amnezia می‌گوید AmneziaWG برای کاهش signature قابل‌شناسایی WireGuard طراحی شده و AmneziaVPN هر دو AmneziaWG و XRay VLESS Reality را پشتیبانی می‌کند. این منابع جایگزین آزمون از ISP واقعی ایران نیستند.

## تصمیم پیشنهادی Provider توسعهٔ Hero (برای مسیر AI، نه VPN runtime)

- فقط Provider برابر OpenAI برای پایلوت اول؛
- نقش‌های خواندنی از خانوادهٔ ChatGPT و Executor از خانوادهٔ Codex؛
- Model ID دقیق فقط اگر خود فرآیند توسعهٔ این Pilot از AI orchestration استفاده کند، پس از بررسی دسترسی حساب مالک ثبت می‌شود؛ VPN runtime به Model ID نیاز ندارد؛
- سقف پیشنهادی هزینهٔ اجرای AI در Hero برابر ۵ دلار است؛ این سقف برای مسیر AI است و به‌خودی‌خود مجوز اجرای Pilot VPN نیست؛
- هزینهٔ VPS، دامنه و شبکهٔ VPN جداست و باید پیش از شروع توسط مالک تعیین و تصویب شود؛
- یک مجوز زمان‌دار، محدود به `HERO-021/v1.0` و role/modelهای صریح لازم است.

این سند مجوز هزینه یا اجرا نیست. برای تصویب، مالک باید محصول، مقصد Test، شبکه‌های آزمایش و سقف هزینهٔ زیرساخت را جداگانه تأیید کند؛ فقط اگر مسیر AI فعال شود، Model ID، API key و سقف AI نیز گیت‌های مستقل خواهند بود. VPN runtime برای کارکرد خود به API key یا AI Provider نیاز ندارد. قواعد مجوز در [EXTERNAL-SPEND-AUTHORIZATION.md](./EXTERNAL-SPEND-AUTHORIZATION.md) و محیط‌ها در [HERO-TEST-ENVIRONMENT.md](./HERO-TEST-ENVIRONMENT.md) هستند.
