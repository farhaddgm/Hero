# پیام کامل برای مالک و ادمین سرور Hero

این نسخه جایگزین دستورهای قدیمی آماده‌سازی PostgreSQL است. Test اکنون آماده و PostgreSQL متصل است؛ آن مراحل را تکرار نکنید.

## وضعیت تأییدشده

- Compose Test فقط: `/opt/hero/compose.yaml` با project name برابر `hero-test`؛
- `compose.test.yaml` قدیمی استفاده نمی‌شود و در quarantine بازیافت‌پذیر قرار دارد؛
- Control Plane، PostgreSQL و proxy احراز هویت healthy؛
- bind برنامه فقط `127.0.0.1:43101` و PostgreSQL بدون پورت عمومی؛
- `test.hero.beeproject.ir`: TLS فعال، health/ready برابر `200` و Back Office بدون auth برابر `401`؛
- persistence برابر PostgreSQL و hydration هر ۱۱ registry پس از restart موفق؛
- Production و سرویس‌های دیگر نباید تغییر کنند.

## اقدام اول — ادمین زیرساخت: مقصد Recovery

1. یک VM پاک Linux فقط برای Hero بسازید؛ روی آن پروژه یا database دیگری نباشد.
2. Docker Engine و Compose plugin را نصب و firewall را بسته نگه دارید؛ در این مرحله پورت عمومی برنامه باز نشود.
3. یک کاربر محدود Hero و پل wrapper ثابت بسازید؛ دسترسی Docker/Sudo عمومی ندهید.
4. wrapper فقط باید backup پروژه `hero-test`، انتقال رمزنگاری‌شده به VM مقصد، restore در resourceهای دارای پیشوند `hero-recovery`، اجرای migration/health، تولید SHA-256 و خروجی evidence غیرمحرمانه را اجازه دهد.
5. نتیجه را در `/opt/hero/var/evidence/clean-linux-recovery.json` مطابق `deploy/recovery/clean-linux-evidence.example.json` بنویسید؛ فایل نباید Secret، IP خصوصی، credential یا host path داشته باشد.
6. هیچ volume موجود، Production یا پروژهٔ دیگری حذف/restart/recreate نشود.

خروجی لازم: نام غیرحساس VM، نسخهٔ Linux/Docker/Compose، checksum backup/restore، migration verified، health/ready و تأیید اینکه مقصد clean و Hero-only بوده است. جزئیات قرارداد در [CLEAN-LINUX-RECOVERY.md](CLEAN-LINUX-RECOVERY.md) است.

## اقدام دوم — مالک و ادمین Secret: Provider واقعی

مالک:

1. در حساب OpenAI یک API key اختصاصی Test با محدودیت بودجه بسازد؛ اشتراک ChatGPT/Codex جای billing مستقل API را تضمین نمی‌کند.
2. Model IDهای قابل‌دسترسی حساب را برای خانوادهٔ ChatGPT و Codex مشخص کند.
3. سقف پیشنهادی ۵ دلار و زمان انقضای کوتاه را با متن موجود در [EXTERNAL-SPEND-AUTHORIZATION.md](EXTERNAL-SPEND-AUTHORIZATION.md) تصویب کند.

ادمین Secret:

1. API key را فقط در Secret Store یا `/etc/hero/hero-test.env` با mode `600` قرار دهد؛ مقدار را نمایش یا ارسال نکند.
2. متغیرهای Provider، نرخ ورودی/خروجی، allow-list Model/Role، سقف، Step/Version، انقضا و Global Stop را دقیقاً طبق همان راهنما تنظیم کند.
3. فقط محیط `hero-test` را با wrapperهای محدود validate و recreate کند؛ Production و سرویس‌های دیگر دست‌نخورده بمانند.
4. این کنترل‌ها را اجرا کند: `hero-test-test`، `hero-test-ps`، `hero-test-health`. سپس فقط نتیجهٔ pass/fail و کدهای HTTP را بدهد؛ نه env و نه Secret.

## اقدام سوم — مالک: تصویب پایلوت

مالک فایل [PILOT-REQUEST-20260910.md](PILOT-REQUEST-20260910.md) را بخواند و این جمله را تأیید کند یا اصلاحاتش را بگوید:

```text
HERO-PILOT-001 v1.0 و سقف کل ۵ دلار را تأیید می‌کنم؛ فقط Test، فقط OpenAI، Model IDهای ثبت‌شده، بدون Production، پیام بیرونی یا عملیات مخرب.
```

بعد از دریافت این سه خروجی، Agent Hero باید `pnpm check:pilot`، Provider smoke محدود، اجرای پایلوت در worktree مستقل، Evaluator/Verifier/Code Review، rollback و گزارش را انجام دهد. Production فقط با مجوز مستقل `production-deploy` مجاز است.
