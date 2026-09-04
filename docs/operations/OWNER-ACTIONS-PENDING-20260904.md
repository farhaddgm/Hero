# کارهای لازم از طرف مالک و ادمین — وضعیت ۲۰۲۶-۰۹-۰۵

این صفحه فهرست کوتاه اقداماتی است که از داخل Codex قابل انجام نیستند. مقدار Secret نباید برای Codex ارسال شود.

## آخرین ممیزی واقعی

- `check:isolation`: موفق؛ ۲۴۵ فایل در مرز `/opt/hero` بررسی شد و خطایی نداشت؛
- `check:test-config`: موفق داخل `hero-test`؛ شش مقدار host-only با bind واقعی پورت و هر پنج Secret لازم حاضر و معتبر هستند؛
- `check:pilot`: مسدود؛ شاهد recovery لینوکس، مجوز مستقل Provider واقعی و درخواست/معیار پذیرش Pilot ثبت نشده است؛
- recovery disposable: backup/restore synthetic با checksum `sha256:1ce262c482e6096d7c315d62c3483ba012a9f1e813e57f2d0fcfe5c29ccffb04` و sentinel موفق شد؛ این جایگزین restore روی Clean Linux و backup عملیاتی نیست.
- `pnpm check`: موفق؛ ۲۳۹ تست، Build با ۱۴۱ ماژول و Governance با ۲۱ گام؛ Owner handoff audit موفق؛ Roadmap audit برابر `50/50` و `100/100`.
- smoke Test مستقل: هر دو سرویس healthy؛ `/health` و `/ready` با کد ۲۰۰؛ Back Office بدون احراز هویت `۴۰۱` و با credential runtime `۲۰۰`؛ DNS/TLS، robots و noindex موفق؛
- persistence Test: بعد از restart فقط Control Plane، migration، readiness و Read Model سالم ماندند و ۱۱ Projection/۱۰ event/۱ request حفظ شد؛
- schema Test: migrationهای `001` تا `006` و ۱۷ جدول دارای guard append-only در PostgreSQL تأیید شد؛
- شبکهٔ Test: دسترسی بیرونی به پورت‌های `43101` و `5432` مسدود و مسیر عمومی فقط از HTTPS reverse proxy در دسترس است؛
- جداسازی: project=`hero-test`، volumeهای `hero-test_*` و network=`hero-test_hero-private` تأیید شد.
- parity نسخه: artifact تمیز `hero-control-plane:candidate-c1a1430` از Commit `c1a1430` با digest `sha256:e662f73725db07e7a1080922ac549940a417f4dba97418c5e6bd12e61fbbd4c2` فقط به `hero-test` deploy شده؛ preflight، hash پنج فایل اصلی، health، readiness، احراز هویت و restart دوباره تأیید شده‌اند.
- پوشش UI Test: Back Office احراز‌شدهٔ page/data/events را `۲۰۰` برگرداند؛ ۱۱ تیم با جزئیات کامل، ۸ Role، تنظیمات کل Hero، راهنمای خواندن پنل، فونت فارسی، دفتر `OPEN-50` با ۵۰ ردیف و ۱۴ اقدام مالک/ادمین بررسی شدند.
- کنترل امنیتی HTTP: auth boundary، read-only method guard، CSP، noindex، route ناشناخته و API بدون auth موفق‌اند؛ مرور دستی Caddy، firewall و access policy هنوز برای مالک/ادمین باقی است.
- APIهای read-only Test: ۱۷ مسیر احراز‌شده (۳ مسیر Back Office با Basic Auth و ۱۴ مسیر API با نشست Owner) همگی `۲۰۰` و ۱۱ تیم/diagnostics حاضر؛ این شاهد جایگزین Pilot واقعی یا Provider زنده نیست.
- مالکیت Compose: Control Plane candidate اکنون با `compose.yaml` و labelهای `hero-test/control-plane` مدیریت می‌شود؛ volume/network مستقل حفظ شده و rollback container قبلی متوقف است.
- rollback Test: هنگام مشاهدهٔ env ناقص، candidate حذف و کانتینر قبلی با همان volume/network restore شد؛ health سالم و Back Office بدون احراز هویت دوباره `۴۰۱` شد. این شاهد rollback کنترل‌پلیس است؛ recovery واقعی از backup/checksum هنوز باقی است.
- آدرس production موجود نیز پاسخ می‌دهد: HTTP با `۳۰۸` به HTTPS می‌رود و `/backoffice` بدون احراز هویت `۴۰۱` می‌دهد؛ این به‌معنی انتشار نسخهٔ فعلی workspace نیست.
- تشخیص دقیق production: credential runtime خود سرویس روی localhost `۲۰۰` می‌گیرد، اما همان credential از دامنهٔ عمومی `۴۰۱` می‌گیرد؛ ادمین باید فقط Basic Auth/Caddy production را با Secret Store همان محیط تطبیق دهد و قبل از reload، config را validate کند.
- نکتهٔ verification: اجرای تشخیصی `node --test` داخل image runtime معیار acceptance نیست؛ به‌دلیل مرز عمدی image (`.git/.github`) و env واقعی Test، ۱۶ تست محیط‌وابسته شکست خوردند. شمارنده‌های Read Model قبل/بعد تغییری نکردند و مرجع معتبر همچنان `pnpm check` در image verification با `۲۳۹/۲۳۹` است.

## کاری که مالک انجام می‌دهد

۱. به ادمین می‌گوید دامنهٔ رسمی Test فعلاً `test.hero.beeproject.ir` است.

۲. هیچ password، کلید SSH، API key، token یا فایل env را در چت نمی‌فرستد.

۳. وقتی ادمین اتصال واقعی را برقرار کرد، فقط می‌نویسد: «اتصال host-level Hero آماده است».

۴. برای Pilot بعداً یک درخواست کوچک، پلتفرم، معیار پذیرش و سقف هزینه را مشخص می‌کند.

## کاری که ادمین سرور انجام می‌دهد

۱. پروژهٔ Remote Hero را به اجرای واقعی host یا Runner متصل می‌کند؛ اجرای محدود داخل sandbox کافی نیست.

۲. اتصال را با `hero-ops` یا Runner محدود انجام می‌دهد؛ کاربر را عضو گروه `docker` یا `sudo` عمومی نمی‌کند.

۳. wrapperهای Test را روی host بررسی می‌کند و مطمئن می‌شود `hero-test-ps` و `hero-test-health` با `sudo -n` اجرا می‌شوند.

۴. فایل `/opt/hero/compose.test.yaml` را قبل از استفاده بررسی می‌کند. این فایل فعلاً untracked و با مالک `nobody:nogroup` است؛ تا تعیین تکلیف، wrapperها باید از `/opt/hero/compose.yaml` استفاده کنند.

۵. Secretهای Test را در Secret Store یا `/etc/hero/hero-test.env` با مجوز `600` قرار می‌دهد؛ مقدار آن‌ها را نمایش نمی‌دهد.

۶. محیط Test را با project name `hero-test`، پورت `127.0.0.1:43101`، volume و network مستقل اجرا می‌کند.

۷. فقط DNS/Caddy دامنهٔ `test.hero.beeproject.ir` را تنظیم می‌کند و پیش از reload، Caddy را validate می‌کند. تنظیمات سایر پروژه‌ها نباید تغییر کند.

۸. فقط خروجی‌های غیرحساس `ps`، `health`، `ready` و وضعیت TLS را گزارش می‌کند.

## تنظیمات لازم Test

ادمین این شش مقدار غیرمحرمانه را دقیقاً برای محیط Test تنظیم می‌کند:

```text
HERO_HTTP_HOST=0.0.0.0
HERO_HTTP_PORT=3100
HERO_BIND_ADDRESS=127.0.0.1
HERO_EXPOSE_PORT=43101
HERO_DATA_DIR=/var/lib/hero
HERO_ENABLE_REAL_PROVIDERS=false
```

و این پنج مقدار را فقط در Secret Store می‌گذارد؛ مقدار واقعی نباید نمایش داده یا ارسال شود:

```text
HERO_OWNER_AUTH_SECRET
HERO_BACKOFFICE_USER
HERO_BACKOFFICE_PASSWORD
HERO_POSTGRES_URL
HERO_POSTGRES_PASSWORD
```

دو مقدار زیر برای preflight حداقلی بالا لازم نیستند، اما برای فعال‌شدن کامل مسیرهای Admin و Caddy باید جداگانه در محل امن مقصد تنظیم شوند:

```text
HERO_ADMIN_AUTH_SECRET
HERO_BACKOFFICE_PASSWORD_HASH
```

`HERO_BACKOFFICE_PASSWORD_HASH` را فقط با ابزار Caddy روی همان سرور بسازید؛ password خام یا hash را در چت، Git یا گزارش عمومی ننویسید.

پس از آن، از ریشهٔ `/opt/hero` ابتدا `pnpm check:test-config` یا `node tools/check-test-config.mjs` را اجرا کند؛ اگر نتیجهٔ `PASS` نبود، سرویس را بالا نیاورد. سپس با project name `hero-test` و فقط فایل Compose تأییدشدهٔ Hero اجرا کند.

## کاری که Codex پس از فراهم‌شدن دسترسی انجام داد

۱. دسترسی و جداسازی را با فرمان‌های read-only بررسی کرد.

۲. config و Test را اجرا و صحت PostgreSQL، migration، hydration و persistence را تأیید کرد.

۳. Back Office، auth، redaction، isolation، DNS/TLS و smoke test را تأیید کرد.

۴. خطاهای داخل کد را اصلاح کرد، تست گرفت و Evidence را به‌روزرسانی کرد.

۵. برای Pilot هنوز درخواست، پلتفرم، معیار پذیرش و سقف هزینهٔ مالک لازم است.

## ممنوعیت‌های ثابت

- Production بدون مجوز مستقل `production-deploy` و فرمان صریح اجرا نمی‌شود.
- Provider واقعی و external spend بدون Provider، Model، سقف هزینه و authorization مستقل اجرا نمی‌شود.
- `git reset --hard`، `git clean`، حذف volume یا تغییر سرویس‌های دیگر انجام نمی‌شود.
- Secret در Git، Google Sheet، Log یا گزارش قرار نمی‌گیرد.

پیش از هر استقرار Test یا Production باید روش `rollback` به artifact قبلی و روش `recovery` از backup/checksum به‌صورت قابل‌اجرا ثبت و یک‌بار آزموده شود. این دو اقدام باید فقط در محیط Hero انجام شوند و نباید به سرویس‌های دیگر سرور دست بزنند.
