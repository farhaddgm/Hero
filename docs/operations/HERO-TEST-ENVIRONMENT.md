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
- `HERO_IDENTITY_SESSION_SECRET` برای امضای نشست انسانی؛
- `HERO_OWNER_EMAIL` و `HERO_OWNER_PASSWORD` برای حساب انسانی مالک؛
- `HERO_OWNER_MFA_SECRET` با قالب پیشنهادی `base32:<RFC6238-secret>` و `HERO_OWNER_MFA_SECRET_REF` برای MFA مالک؛
- `HERO_BACKOFFICE_USER` و `HERO_BACKOFFICE_PASSWORD` برای Back Office؛
- `HERO_BACKOFFICE_PASSWORD_HASH` برای Caddy؛ این مقدار باید با خود Caddy ساخته شود و جایگزین password خام در Caddyfile شود؛
- `HERO_POSTGRES_PASSWORD` و `HERO_POSTGRES_URL` برای PostgreSQL؛
- API key Provider فقط اگر در آینده با مجوز مستقل فعال شود.

فایل [hero-test.env.example](../../deploy/test/hero-test.env.example) فقط نام تنظیمات را دارد. مقدار واقعی نباید در Git، Google Sheet، log، ticket یا چت قرار بگیرد. اگر Secret Manager سازمانی نداریم، حداقل باید یک runtime env file خارج از repository با دسترسی فقط برای اپراتور/کاربر سرویس ساخته شود؛ مسیر و مقدار آن در repository ثبت نمی‌شود.

رمز Basic Auth فقط مرز شبکهٔ legacy است و جایگزین حساب انسانی نیست. نشانی رسمی ورود Owner در Test، `/api/portal?surface=identity` است؛ در آن Email، رمز حساب انسانی و TOTP شش‌رقمی لازم است و نباید Username/Password مربوط به Basic در فرم انسانی وارد شود. پیشوند `base32:` روش canonical و سازگار با RFC 6238 است؛ verifier فقط برای جلوگیری از قطع دسترسی Secretهای قدیمی، قالب `legacy-utf8:` و مقادیر legacy بدون پیشوند را نیز می‌پذیرد.

پس از تکمیل MFA، Test یک cookie انسانی `Secure` و `HttpOnly` با اعتبار ۶ ساعت ایجاد می‌کند. این cookie در Refresh و تب دیگر همان مرورگر باقی می‌ماند و JavaScript به مقدارش دسترسی ندارد. خروج از حساب، cookie را پاک و نشست را revoke می‌کند. برای کارکرد cookie باید از دامنهٔ HTTPS رسمی Test استفاده شود؛ Basic Auth شبکه‌ای، نشست انسانی یا مجوز پروژه محسوب نمی‌شود.

## PostgreSQL جداگانه یعنی چه؟

Test نباید به database یا volume Production وصل شود. گزینهٔ مناسب برای شروع، سرویس `hero-postgres` همین Compose با project name `hero-test` است؛ Compose volume و network آن را جدا namespace می‌کند. `HERO_POSTGRES_URL` Test باید به همین سرویس Test اشاره کند و کاربر، password و database آن مستقل باشند.

در محیط Test مقدار `HERO_REQUIRE_POSTGRES=true` الزامی است؛ اگر URL یا password اتصال جا افتاده باشد، `/ready` باید fail-closed شود و سرویس آماده اعلام نشود. حالت in-memory فقط برای توسعهٔ محلی مجاز است.

قبل از استفاده، migration، ping، ثبت event و hydration باید در Test موفق شوند. backup/restore واقعی نیز باید برای Test به‌صورت جداگانه شواهد داشته باشد.

## کارهایی که مالک/اپراتور باید انجام دهد

۱. در DNS یک رکورد دقیق ایجاد کند:

```text
test.hero.beeproject.ir  A  <IP عمومی همین سرور>
```

رکورد باید به IP واقعی سرور اشاره کند؛ مقدار IP از پنل DNS یا اپراتور زیرساخت تعیین می‌شود. من از داخل repository امکان تغییر پنل DNS ندارم.

۲. یک محیط Secret امن برای Test آماده کند و مقدارهای واقعی را فقط آنجا قرار دهد.

۳. Caddy همان سرور را با نمونهٔ [Caddyfile.test.example](../../deploy/backoffice/Caddyfile.test.example) تنظیم کند. مقدار `HERO_BACKOFFICE_PASSWORD_HASH` باید در محیط امن خود Caddy قرار گیرد و با ابزار Caddy ساخته شود؛ password خام یا hash در Git نوشته نشود. گواهی TLS باید فقط برای همین نام صادر شود و پورت `43101` و PostgreSQL عمومی نشوند.

پس از انتشار هر صفحهٔ جدید Back Office، Caddy فعال نیز باید از همین allow-list به‌روز پیروی کند. در نسخهٔ فعلی مسیرهای `/identity`، `/workspace`، `/project-control` و `/project-control-data` باید مانند `/product-studio` پشت Basic Auth به `127.0.0.1:43101` proxy شوند؛ سپس پیش از reload، validate الزامی است.

### Caddy sidecar داخلی Test

Compose یک sidecar جدا با نام `hero-test-backoffice-proxy-1` دارد که فقط روی شبکهٔ خصوصی Hero اجرا می‌شود. الگوی آن در [Caddyfile.test-sidecar.example](../../deploy/backoffice/Caddyfile.test-sidecar.example) است؛ فایل rendered فقط در `/etc/hero/caddy-test/Caddyfile` قرار می‌گیرد و نباید به Git افزوده شود. این sidecar باید همان allow-list صفحه‌های Back Office و `Cache-Control: no-store` را داشته باشد.

اگر فایل bind-mounted Caddy با ابزاری مانند `sed -i` جایگزین شد، ممکن است container در حال اجرا inode قدیمی را نگه دارد. در این حالت، بدون recreate کردن سرویس، فایل جدید را ابتدا در یک مسیر موقت داخل همان container کپی کنید، با `caddy validate --adapter caddyfile` بررسی کنید و فقط در صورت موفقیت با `caddy reload --adapter caddyfile` load کنید. برای Test، Caddy بیرونی و sidecar داخلی هر دو باید این بررسی را جداگانه بگذرانند.

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
TEST_ENV_FILE=/etc/hero/hero-test.env
test -f "$TEST_ENV_FILE"
chmod 600 "$TEST_ENV_FILE"
docker compose --project-name hero-test --env-file "$TEST_ENV_FILE" --profile postgres config --quiet
docker compose --project-name hero-test --env-file "$TEST_ENV_FILE" --profile postgres run --rm --build -e HERO_BIND_ADDRESS=127.0.0.1 -e HERO_EXPOSE_PORT=43101 control-plane node tools/check-test-config.mjs
docker compose --project-name hero-test --env-file "$TEST_ENV_FILE" --profile postgres ps
docker compose --project-name hero-test --env-file "$TEST_ENV_FILE" up -d --build control-plane
docker compose --project-name hero-test --env-file "$TEST_ENV_FILE" --profile postgres ps
```

در این مثال `/etc/hero/hero-test.env` یک مسیر نمونه برای فایل محافظت‌شده است؛ باید همان مسیر واقعی فایل Secret خودتان را جایگزین کنید. عبارت‌های داخل علامت `< >` را نباید عیناً وارد کنید. اگر `check-test-config` خطا داد، `up` را اجرا نکنید.
دستور `up` عمداً فقط `control-plane` را هدف می‌گیرد؛ PostgreSQL و volume آن را در این مرحله recreate یا migrate نکنید.

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

## کنترل برابری با Production

Test و Production باید از همین `compose.yaml` و همین قرارداد application استفاده کنند؛ اختلاف محیطی فقط باید در project name، Secret/data runtime و پورت محلی باشد. در repository این شرط با فرمان زیر بررسی می‌شود:

```bash
pnpm check:environment-parity
```

این فرمان runtime یا Secret را نمی‌خواند و جایگزین Evidence استقرار نیست. پس از ساخت candidate، باید digest همان Artifact در Test ثبت و فقط همان digest با مجوز مستقل به Production promote شود.

برای جلوگیری از rebuild ناخواسته، `HERO_IMAGE` در فایل runtime باید به digest کامل image candidate اشاره کند، مانند `ghcr.io/<owner>/<repo>@sha256:<digest>`. در Production از `docker compose pull` و سپس `docker compose up -d --no-build` استفاده شود؛ اجرای `up --build` در Production ممنوع است.

## Promotion کنترل‌شدهٔ Test

برای تغییر Test از artifact قدیمی به artifact immutable جدید، فقط ابزار زیر مجاز است. ابزار قبل از تغییر، یک rollback point متادیتاییِ بدون Secret می‌سازد، فقط `hero-test/control-plane` را recreate می‌کند، dependencyها را تغییر نمی‌دهد، build نمی‌کند و health/readiness/هویت build/routeهای جدید را بررسی می‌کند. در شکست بعد از تغییر، rollback خودکار تلاش می‌شود. جزئیات علت رخدادهای قبلی و بازیابی در [Runbook پایایی انتشار Test](HERO-TEST-RELEASE-RELIABILITY.md) است:

```bash
sudo bash /opt/hero/tools/promote-test-immutable.sh \
  ghcr.io/farhaddgm/hero@sha256:<immutable-digest>
```

مسیر ترجیحی، استفاده از manifest خروجی GitHub Actions است تا نسخه، commit و digest با هم تطبیق داده شوند:

```bash
sudo HERO_TEST_ENV_FILE=/etc/hero/hero-test.env \
  HERO_TEST_RELEASE_STATE_FILE=/etc/hero/hero-test.release-state \
  bash /opt/hero/tools/promote-test-immutable.sh \
  --manifest /opt/hero/hero-release-manifest.json
```

برای بررسی read-only بعد از promotion:

```bash
sudo bash /opt/hero/tools/verify-test-release.sh \
  ghcr.io/farhaddgm/hero@sha256:<immutable-digest>
```

برای rollback آخرین promotion موفق:

```bash
sudo HERO_TEST_ENV_FILE=/etc/hero/hero-test.env \
  HERO_TEST_RELEASE_STATE_FILE=/etc/hero/hero-test.release-state \
  bash /opt/hero/tools/rollback-test-immutable.sh
```

فایل state و rollback point فقط شامل image digest، نسخه، commit، URL release و زمان است؛ فایل کامل env یا هیچ Secretی کپی نمی‌شود. پس از promotion، endpoint عمومیِ بدون Secret `/build-info` باید همان digest را گزارش کند.

این ابزار هرگز environment یا container با نام Production را نمی‌خواند یا تغییر نمی‌دهد؛ فقط rollback point متادیتایی و بدون Secret را نگه می‌دارد.
