# محیط Test برای خود Hero

## تصمیم

محیط Test خود Hero روی همان سرور اجرا می‌شود، اما با منابع کاملاً جدا:

| منبع | Test | قاعده |
|---|---|---|
| Compose project | `hero-test` | با Production یکی نباشد |
| پورت میزبان | `43101` | فقط روی `127.0.0.1` |
| volume برنامه | `hero-test_hero-data` | volume مستقل |
| PostgreSQL | `hero-test_hero-postgres-data` | database و password مستقل |
| شبکه | `hero-test_hero-private` | شبکه مستقل Compose |
| دامنه | `test.hero.beeproject.ir` | فقط برای Test |
| Provider زنده | خاموش | در گام اول فعال نشود |

این جداسازی با `--project-name hero-test` انجام می‌شود. از `container_name`، volume خارجی یا port مشترک استفاده نشود.

## معنای «دسترسی به سرور»

یعنی یک اپراتور مجاز بتواند از طریق SSH یا کنسول مدیریت سرور، در پروژهٔ مستقل Hero این کارها را انجام دهد:

- اجرای Docker Compose؛
- مشاهدهٔ وضعیت و log سرویس Hero؛
- خواندن health و readiness از همان سرور؛
- تنظیم DNS و Caddy در محدودهٔ مجاز؛
- بدون دست‌زدن به کانتینر، volume، database یا پورت پروژه‌های دیگر.

این دسترسی به معنی ارسال password یا SSH key در چت نیست. Codex در این مرحله فقط repository و الگوی اجرایی را آماده می‌کند؛ اجرای سرور باید از محیطی انجام شود که Docker و مجوز عملیاتی مقصد را دارد.

## Secret Store چیست؟

Secret Store یعنی محل امنی که مقدارهای حساس را فقط هنگام اجرای سرویس در اختیار آن می‌گذارد. برای Test این مقدارها لازم‌اند:

- `HERO_OWNER_AUTH_SECRET` برای نشست‌های API؛
- `HERO_BACKOFFICE_USER` و `HERO_BACKOFFICE_PASSWORD` برای Back Office؛
- `HERO_POSTGRES_PASSWORD` و `HERO_POSTGRES_URL` برای PostgreSQL؛
- API key Provider فقط اگر در آینده با مجوز مستقل فعال شود.

فایل [hero-test.env.example](../../deploy/test/hero-test.env.example) فقط نام تنظیمات را دارد. مقدار واقعی نباید در Git، Google Sheet، log، ticket یا چت قرار بگیرد. اگر Secret Manager سازمانی نداریم، حداقل باید یک runtime env file خارج از repository با دسترسی فقط برای اپراتور/کاربر سرویس ساخته شود؛ مسیر و مقدار آن در repository ثبت نمی‌شود.

## PostgreSQL جداگانه یعنی چه؟

Test نباید به database یا volume Production وصل شود. گزینهٔ مناسب برای شروع، سرویس `hero-postgres` همین Compose با project name `hero-test` است؛ Compose volume و network آن را جدا namespace می‌کند. `HERO_POSTGRES_URL` Test باید به همین سرویس Test اشاره کند و کاربر، password و database آن مستقل باشند.

قبل از استفاده، migration، ping، ثبت event و hydration باید در Test موفق شوند. backup/restore واقعی نیز باید برای Test به‌صورت جداگانه شواهد داشته باشد.

## کارهایی که مالک/اپراتور باید انجام دهد

۱. در DNS یک رکورد دقیق ایجاد کند:

```text
test.hero.beeproject.ir  A  <IP عمومی همین سرور>
```

رکورد باید به IP واقعی سرور اشاره کند؛ مقدار IP از پنل DNS یا اپراتور زیرساخت تعیین می‌شود. من از داخل repository امکان تغییر پنل DNS ندارم.

۲. یک محیط Secret امن برای Test آماده کند و مقدارهای واقعی را فقط آنجا قرار دهد.

۳. Caddy همان سرور را با نمونهٔ [Caddyfile.test.example](../../deploy/backoffice/Caddyfile.test.example) تنظیم کند. گواهی TLS باید فقط برای همین نام صادر شود و پورت `43101` و PostgreSQL عمومی نشوند.

۴. دسترسی اپراتوری Docker/Compose را در همان سرور فراهم کند؛ بدون ارسال credential در چت.

## کارهایی که Hero/Codex انجام می‌دهد

- بررسی repository و تولید Artifact از commit تأییدشده؛
- اجرای `pnpm check` در محیط Linux/CI؛
- بررسی تنظیمات Compose با محیط Test؛
- آماده‌سازی smoke-test برای `/health`، `/ready`، Back Office، persistence و hydration؛
- ثبت test evidence با commit SHA، نسخه و Artifact ID؛
- گزارش هر خطا و جلوگیری از ادامه در صورت نبود جداسازی یا evidence.

## ترتیب اجرای Test

اپراتور پس از آماده‌کردن secretها، از ریشهٔ repository و با فایل env محافظت‌شده اجرا می‌کند:

```bash
docker compose --project-name hero-test --env-file <protected-test-env-file> --profile postgres config --quiet
docker compose --project-name hero-test --env-file <protected-test-env-file> --profile postgres up -d --build
docker compose --project-name hero-test --env-file <protected-test-env-file> --profile postgres ps
```

خروجی دستور `config` یا logها نباید در چت یا ticket عمومی قرار گیرد؛ ممکن است تنظیمات runtime را نمایش دهد.

سپس باید این موارد ثبت شوند:

```text
commit SHA
release version / candidate version
Artifact ID یا image digest
health و readiness
PostgreSQL migration/ping
hydration و persistence
نتیجهٔ smoke-test Back Office
TLS و احراز هویت
rollback point
```

تا قبل از این evidence، Test «راه‌اندازی‌شده و تأییدشده» محسوب نمی‌شود و Production نباید فعال شود.

## دامنه و قابل‌جست‌وجو نبودن

`test.hero.beeproject.ir` باید پشت TLS، احراز هویت و در صورت امکان VPN یا IP allow-list باشد. `robots.txt` و `X-Robots-Tag` فقط جلوی index شدن معمول crawlerها را می‌گیرند و امنیت محسوب نمی‌شوند. نمونهٔ Caddy مسیرهای ناشناخته را `404` می‌کند و پورت داخلی را عمومی نمی‌کند.

این runbook فقط Test خود Hero را پوشش می‌دهد. هر محصولی که Hero بعداً بسازد باید Compose project، دامنه، database، volume، secret و release flow مستقل خودش را داشته باشد.
