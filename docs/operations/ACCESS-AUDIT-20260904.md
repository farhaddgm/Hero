# شواهد بررسی دسترسی و محیط Test — ۲۰۲۶-۰۹-۰۴

## محدودهٔ بررسی

این بررسی فقط روی repository خود Hero در `/opt/hero` و namespace مجزای Docker با نام `hero-test` انجام شد. هیچ فایل، کانتینر، volume، database یا پورت متعلق به پروژهٔ دیگری خوانده یا تغییر داده نشد.

## نتیجهٔ دسترسی

- repository قابل دسترسی است؛ تغییر قبلی کاربر در `.dockerignore` حفظ شده و به آن دست زده نشد.
- baseline بررسی قبلی commit `f48dda6` بود؛ تغییرات این بسته پس از verification در commitهای `8d18bd4` و `4118cce` ثبت شده‌اند.
- Docker برای کاربر عادی مجاز نیست؛ بررسی محدود namespace `hero-test` با دسترسی elevated انجام شد.
- `hero-test` فعلاً هیچ کانتینری ندارد؛ بنابراین Test هنوز deploy نشده است.
- پیکربندی Compose داخل repository معتبر است و تغییری ایجاد نمی‌کند.

## شواهد تست

- `pnpm check`: موفق؛ `228/228` تست، Build با `138` ماژول و `7` فایل JSON، Governance با `21` گام و Doctor با `10/10` check.
- `pnpm check:pilot`: مسدود با سه گیت واقعی:
  - `linux-recovery-evidence`: شواهد Clean Linux و restore روی artifact عملیاتی وجود ندارد؛
  - `provider-authorization`: Provider واقعی و مجوز مستقل فعال نیست؛
  - `pilot-request`: درخواست و معیار پذیرش پایلوت ثبت نشده است.
- `127.0.0.1:43101/health` و `/ready`: پاسخی ندارند، چون سرویس Test اجرا نشده است.
- route محلی `test.hero.beeproject.ir` روی HTTPS: از این محیط قابل اتصال نیست.
- DNS دامنهٔ Test از همین نقطه در زمان بررسی resolve نشد؛ پس وضعیت انتشار عمومی از این نقطه تأیید نشده است.

## خروجی تکمیلی همین بسته

- Benchmark synthetic اکنون در PostgreSQL قابل ذخیره، بازیابی، مقایسه و hydrate است؛
- access audit فقط metadata مسیرهای read-model را نگه می‌دارد و outcomeهای accepted/rejected را ثبت می‌کند؛
- تست HTTP و adapter این مسیر موفق است؛ این قابلیت تا زمان تنظیم `HERO_POSTGRES_URL` در محیط واقعی فعال نمی‌شود.
- Diagnostic read model با قرارداد نسخه‌دار، پوشش ۱۱ Projection، بررسی Snapshot/Event، replay dry-run، digest، تاریخچهٔ امن AI، freshness دانش و تعارض تخصیص اضافه شد؛
- احراز هویت امضاشدهٔ Admin فقط برای کاتالوگ AI فعال است و به Team، Release، Dispatch، Secret یا Production اختیار نمی‌دهد؛
- شواهد این بسته: `228/228` تست، Build `138`، Governance `21` و `git diff --check` موفق.

## کارهایی که عمداً انجام نشد

- Secret خوانده، ساخته یا تغییر داده نشد؛
- Caddy، DNS یا WCDN تغییر داده نشد؛
- Provider زنده، هزینهٔ خارجی و Production فعال نشد؛
- فایل یا سرویس خارج از مرز repository Hero خوانده نشد.

## گام لازم بعدی

اپراتور باید Secretهای Test را در کانال امن runtime قرار دهد و با همان Secret، `check-test-config` و Compose را اجرا کند. پس از بالا آمدن موفق Test، Caddy/WCDN باید فقط route دامنهٔ Test را به `127.0.0.1:43101` وصل کند و validate/reload شود. سپس health، readiness، migration، hydration، احراز هویت و smoke-test ثبت می‌شوند. تا آن زمان Test و Production عملیاتی محسوب نمی‌شوند.
