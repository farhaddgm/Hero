# راهنمای خیلی سادهٔ مالک برای آماده‌سازی Test

این صفحه فقط کارهایی را می‌گوید که خارج از repository هستند. مقدار واقعی password یا API key را در چت، Google Sheet، Git یا ticket عمومی ننویسید.

## وضعیت فعلی

کارهای داخل پروژه انجام شده و محیط مستقل Test نیز اکنون آماده و بررسی شده است:

- تست Linux: `239/239` موفق؛ Roadmap audit برابر `OPEN-50=50` و `NEXT-100=100`؛
- Build برنامه: موفق؛
- محیط Test مستقل: project name=`hero-test`، پورت `43101` فقط روی localhost، PostgreSQL، volume و network جدا؛
- preflight، migration نسخهٔ `1.0`، `pg_isready`، `/health` و `/ready` موفق؛
- دامنهٔ Test: TLS، احراز هویت، noindex و robots بررسی شده؛
- hydration: بعد از restart کنترل‌پلیس، Read Model سالم و هم‌ارز باقی مانده؛
- Provider زنده: عمداً خاموش است؛
- Production: عمداً فعال نشده است.

Test واقعی سالم است. artifact تمیز `hero-control-plane:candidate-c1a1430` از Commit `c1a1430` ساخته شده و با همان env/Secret فعلی فقط روی Test نصب شده است؛ preflight، health، احراز هویت، payload دفتر `OPEN-50` و restart موفق‌اند. پنل اکنون دفتر کامل ۵۰ گام و ۱۴ اقدام مالک/ادمین را read-only نشان می‌دهد. rollback کنترل‌پلیس هم آزموده شده؛ فقط recovery واقعی از backup/checksum و سپس Pilot باقی است.

نکتهٔ production: خود سرویس با credential runtime سالم است، اما دامنهٔ عمومی production همان credential را قبول نمی‌کند و `401` می‌دهد. ادمین باید Basic Auth/Caddy production را اصلاح و validate کند؛ password یا hash نباید در چت ارسال شود.

## کاری که شما یا اپراتور سرور باید انجام دهید

### ۱. Secretهای Test را در محل امن بسازید

اگر Secret Manager سازمانی دارید، از همان استفاده کنید. اگر ندارید، اپراتور سرور یک فایل خارج از repository بسازد؛ نمونهٔ مسیر:

```text
/etc/hero/hero-test.env
```

این فایل باید فقط برای root یا کاربر سرویس قابل خواندن باشد. این نام‌ها لازم‌اند:

```text
HERO_HTTP_HOST=0.0.0.0
HERO_HTTP_PORT=3100
HERO_BIND_ADDRESS=127.0.0.1
HERO_EXPOSE_PORT=43101
HERO_DATA_DIR=/var/lib/hero
HERO_LOG_LEVEL=info
HERO_OWNER_AUTH_SECRET=<یک مقدار تصادفی حداقل ۳۲ نویسه>
HERO_ADMIN_AUTH_SECRET=<یک مقدار تصادفی حداقل ۳۲ نویسه برای نشست Admin>
HERO_BACKOFFICE_USER=<نام کاربری انتخابی>
HERO_BACKOFFICE_PASSWORD=<password تصادفی حداقل ۱۶ نویسه>
HERO_POSTGRES_URL=postgresql://hero:<همان password دیتابیس>@hero-postgres:5432/hero
HERO_POSTGRES_PASSWORD=<password تصادفی حداقل ۱۶ نویسه>
HERO_ENABLE_REAL_PROVIDERS=false
```

مقدارهای داخل `< >` فقط جایگزین هستند و نباید عیناً وارد شوند. password دیتابیس در `HERO_POSTGRES_URL` باید با `HERO_POSTGRES_PASSWORD` یکی باشد. password پنل و password دیتابیس بهتر است متفاوت باشند.

دستورهای امن برای ساخت پوشه و محدودکردن دسترسی فایل:

```bash
sudo install -d -m 700 /etc/hero
sudo touch /etc/hero/hero-test.env
sudo chmod 600 /etc/hero/hero-test.env
```

Secretها را با password manager یا Secret Manager تولید و در همین محل وارد کنید؛ آن‌ها را برای من ارسال نکنید.

### ۲. DNS تست را تنظیم کنید

در پنل DNS، فقط این رکورد را بسازید:

```text
Name: test.hero.beeproject.ir
Type: A
Value: IP عمومی همان سرور
```

رکورد باید به IP سرور Test اشاره کند. اگر پنل DNS گزینهٔ Proxy/CDN دارد، تنظیم فعلی آن را بدون بررسی تغییر ندهید؛ ابتدا باید اپراتور زیرساخت آن را با Caddy هماهنگ کند.

### ۳. Caddy را فقط برای همین دامنه تنظیم کنید

اپراتور باید محتوای نمونهٔ [Caddyfile.test.example](../../deploy/backoffice/Caddyfile.test.example) را به Caddy فعال اضافه کند؛ فایل فعلی Caddy نباید جایگزین یا پاک شود. اگر از قبل block برای همین دامنه وجود دارد، block دوم نسازید و همان block را اصلاح کنید.

نتیجهٔ مورد انتظار:

- `https://test.hero.beeproject.ir` به `127.0.0.1:43101` وصل شود؛
- TLS فعال باشد؛
- مسیرهای Back Office احراز هویت داشته باشند؛
- پورت `43101` از اینترنت قابل دسترسی نباشد؛
- PostgreSQL از اینترنت قابل دسترسی نباشد؛
- سایر دامنه‌ها و سرویس‌ها دست‌نخورده بمانند.

قبل از reload، اپراتور باید Caddy را با همان محیط واقعی خودش validate کند. اگر validate موفق نبود، reload انجام نشود.

### ۴. Test را اجرا کنید

از ریشهٔ repository و پس از قرارگرفتن فایل secret، این دستورها را اجرا کنید:

```bash
TEST_ENV_FILE=/etc/hero/hero-test.env
test -f "$TEST_ENV_FILE"
chmod 600 "$TEST_ENV_FILE"
docker compose --project-name hero-test --env-file "$TEST_ENV_FILE" --profile postgres config --quiet
docker compose --project-name hero-test --env-file "$TEST_ENV_FILE" --profile postgres run --rm --build control-plane node tools/check-test-config.mjs
docker compose --project-name hero-test --env-file "$TEST_ENV_FILE" --profile postgres up -d --build
docker compose --project-name hero-test --env-file "$TEST_ENV_FILE" --profile postgres ps
```

اگر یکی از دو دستور `config` یا `check-test-config` خطا داد، دستور `up` را اجرا نکنید و فقط متن خطا را بدون secret ارسال کنید.

### ۵. نتیجه را برای من بفرستید

برای بررسی من، فقط این موارد غیرحساس کافی است:

```text
خروجی docker compose ... ps
نتیجهٔ health و ready
کد HTTP دامنهٔ Test
اینکه TLS و صفحهٔ ورود باز می‌شود یا نه
```

محتوای فایل env، password، hash، token و خروجی‌ای که secret دارد ارسال نشود.

## بعد از آماده‌شدن Test

من این کارها را انجام می‌دهم:

1. سلامت سرویس، migration، persistence، hydration و Back Office را بررسی می‌کنم.
2. جداسازی Test از سرویس‌های دیگر را دوباره کنترل می‌کنم.
3. نتیجه را در مستندات و Google Sheet ثبت می‌کنم.
4. برای یک pilot کوچک، سناریو و معیار پذیرش را با شما نهایی می‌کنم.

برای Pilot شما فقط باید یک feature یا درخواست واقعی کوچک را مشخص کنید و بگویید «موفقیت» دقیقاً یعنی چه؛ مثلاً خروجی درست، زمان قابل‌قبول، سقف هزینه و امکان rollback. بدون این تعریف، اجرای واقعی قابل ارزیابی نیست.

## چیزهایی که هنوز عمداً انجام نمی‌شوند

- API key و Provider واقعی، تا وقتی Provider، مدل، سقف هزینه و مجوز جداگانه مشخص نشده است؛
- Production، تا وقتی Test و Pilot شواهد موفق نداشته باشند و مجوز مستقل صادر نشود؛
- حذف volumeهای تست قبلی؛ برای جلوگیری از حذف ناخواسته، این کار نیازمند اجازهٔ جداگانه است؛
- تغییر DNS، firewall یا Caddy از داخل repository؛ این‌ها خارج از مرز پروژه‌اند و ممکن است روی سرویس‌های دیگر اثر بگذارند.

جزئیات فنی کامل‌تر در [HERO-TEST-ENVIRONMENT.md](HERO-TEST-ENVIRONMENT.md) و [PILOT-READINESS.md](PILOT-READINESS.md) است.
