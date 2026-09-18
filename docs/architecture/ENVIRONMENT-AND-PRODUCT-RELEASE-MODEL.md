# مدل محیط و انتشار Hero و محصولات

- Document ID: `HERO-ARCH-ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL`
- Version: `1.1.0`
- Status: `active`
- Owner: `hero-architecture`
- Scope: `cross-project`

## هدف

این سند مرجع canonical جداسازی محیط‌ها و مسیر انتشار خود Hero و محصولاتی است که Hero تعریف یا مدیریت می‌کند. قواعد عمومی Artifact و promotion از [فلو انتشار](RELEASE_FLOW.md) و اصول blocking از [اصول حیاتی](CRITICAL_PRINCIPLES.md) می‌آیند؛ سند محصول باید به این شناسه‌ها ارجاع دهد و متن آن‌ها را کپی نکند.

## چهار محیط مستقل

```text
Hero Test ──promote exact artifact──> Hero Production
                                          │
                                          ├── controls Product Test
                                          └── controls Product Production

Product Test ──promote exact artifact──> Product Production
```

Hero Test، Hero Production، Product Test و Product Production چهار boundary اجرایی مستقل هستند. اشتراک سرور فیزیکی این boundaryها را یکی نمی‌کند.

| محیط | کاربرد | داده و Secret | مجوز انتشار |
|---|---|---|---|
| Hero Test | آزمون قابلیت جدید Control Plane | مستقل از Hero Production | توسعه/Test مصوب |
| Hero Production | Control Plane پایدار سازمان | مستقل از Hero Test و همهٔ محصولات | فرمان صریح و `production-deploy` مستقل |
| Product Test | آزمون Artifact محصول | مستقل از Hero و Product Production | سیاست Test همان محصول |
| Product Production | استفادهٔ واقعی از محصول | مستقل از تمام محیط‌های دیگر | تأیید مالک محصول و مجوز Production مستقل |

هر محیط باید database، data، Secret، volume، network، domain، session، credential، backup و rollback point خودش را داشته باشد. نام منابع runtime نیز باید به پروژه و محیط scope شود.

## Control Plane در برابر runtime محصول

Hero Production محل نگهداری تعریف پروژه، گیت‌ها، تصمیم‌ها، Evidence و Audit است. این نقش «Control Plane» است. runtime محصول محل اجرای کد و دادهٔ همان محصول است.

مدیریت Product Test از Hero Production مجاز است، اما به معنی اجرای Product Test داخل container، database، network، volume یا Secretهای Hero Production نیست. Hero فقط درخواست و Evidence را هماهنگ می‌کند و adapter اجرایی باید boundary محصول و محیط را حفظ کند.

## اجرای Product Test روی host مشترک

اشتراک یک سرور فیزیکی، اشتراک محیط یا مجوز دسترسی متقابل نیست. Product Test می‌تواند در آینده روی همان host Hero Test قرار گیرد، فقط اگر هر محصول و محیط resource namespace مستقل زیر را داشته باشد:

```text
hero-test-*                         → فقط Hero Test
hero-product-<slug>-test-*          → فقط Product Test همان محصول
hero-product-<slug>-production-*    → فقط Product Production همان محصول
```

برای هر Product Runtime، repository/worktree، Compose project، database، volume، network، port/domain، Secret reference، backup و rollback point باید یکتا و مختص همان `product_id + environment` باشند. Product Runtime نباید هیچ volume، network، database، session، secret یا port متعلق به Hero یا محصول دیگر را reuse کند.

این کنترل‌ها پیش از هر start اجباری‌اند:

- container با user غیرroot و اصل least privilege اجرا شود؛
- privileged mode، `network_mode: host`، Docker socket، broad host mount، مسیر parent و `container_name` عمومی ممنوع باشند؛
- در حد سازگاری محصول `read_only`، `no-new-privileges`، capability drop، CPU/RAM/PID/timeout، healthcheck و restart policy محدود فعال باشند؛
- egress به allowlist محدود و logها redacted باشند؛
- capacity و port collision پیش از dispatch بررسی و در ابهام fail-closed شوند؛
- build/test workspace محصول از repository Hero جدا باشد و هیچ local-path dependency به Hero نداشته باشد.

این بخش قرارداد معماری است. Hero اکنون قرارداد و adapter امن Product Runner را در source دارد، اما Control Plane executor را پیش‌فرض configure نمی‌کند و اجرای خودکار Compose محصول هنوز operational نیست؛ تا زمانی که runbook و Exit Gate مربوط evidence واقعی ندارند، هیچ container محصولی نباید از UI Hero ساخته یا start شود.

## Target خارجی و انتقال‌پذیری محصول

یک server جدید «محیط Hero» محسوب نمی‌شود، مگر Hero خودش آنجا جداگانه مستقر شده باشد. برای Product Target خارجی، inventory نسخه‌دار، مالک، محیط، resource policy، هویت Agent، heartbeat، revoke، کانال Secret مستقل، TLS/egress policy و command محدود لازم است. Agent باید به‌صورت outbound به Control Plane متصل شود؛ listener عمومی برای shell یا credential دائمی پذیرفته نیست.

انتقال فقط با immutable artifact و contract صورت می‌گیرد: `commit + version + digest`، SBOM/attestation reference، schema/config version، migration plan، backup checksum و runbook restore. `.env`، Docker volume، network یا Secret از host مبدا کپی نمی‌شود. تمرین انتقال به مقصد Clean همراه با health/readiness، restore و rollback evidence، شرط portability است.

## تمامیت Artifact

در هر دو مسیر Hero و Product، Artifact آزموده‌شده باید بدون rebuild به Production promote شود:

```text
version + commit SHA + artifact ID/digest
```

این سه شناسه در Test و Production باید تطبیق دقیق داشته باشند. build مجدد، tag متحرک مانند `latest`، تغییر configuration ناسازگار، commit متفاوت یا Artifact بدون digest یک Release جدید محسوب می‌شود و باید دوباره از Test عبور کند.

یکسان‌بودن Artifact به معنی یکسان‌بودن داده یا Secret نیست. configuration هر محیط مستقل است و فقط باید با قرارداد همان Artifact سازگار باشد.

## گیت‌های promotion

Promotion فقط پس از این مراحل مجاز است:

1. commit و version دقیق ثبت شده باشد؛
2. Artifact دارای شناسه یا digest تغییرناپذیر ساخته شده باشد؛
3. همان Artifact در Test مستقر شده باشد؛
4. health، readiness، migration، تست پذیرش، امنیت و rollback Evidence واقعی داشته باشند؛
5. اصول حیاتی مربوط در وضعیت مصوب باشند؛
6. مالک نتیجهٔ Test را صریحاً تأیید کرده باشد؛
7. مجوز مستقل `production-deploy` و فرمان صریح promotion وجود داشته باشد؛
8. پس از استقرار، Production Evidence و rollback point ثبت شود.

نبود هر مورد، promotion را fail-closed می‌کند. CI یا Hero نباید تأیید مالک یا مجوز عملیات حساس را از موفقیت تست استنباط کند.

## وابستگی Product به قابلیت آزمایشی Hero

اگر Product Test به قابلیتی نیاز دارد که فقط در Hero Test وجود دارد، یک integration test ایزوله بین همین دو محیط اجرا می‌شود. Product Production و Hero Production در این آزمون تغییر نمی‌کنند.

ترتیب انتشار الزام‌آور است:

```text
Hero Test → تأیید → Hero Production
سپس Product Test → تأیید → Product Production
```

تا زمانی که قابلیت Hero به Hero Production promote نشده است، محصول وابسته نباید به Product Production برود.

## مثال معماری CRM

CRM در این سند فقط مثال است و ثبت Product واقعی محسوب نمی‌شود.

```text
Hero Production
  ├── تعریف و رصد CRM Test
  │     ├── crm-test runtime
  │     ├── crm-test database
  │     ├── crm-test secrets
  │     └── crm-test domain/backup
  └── تعریف و رصد CRM Production
        ├── crm-production runtime
        ├── crm-production database
        ├── crm-production secrets
        └── crm-production domain/backup
```

نسخهٔ CRM ابتدا با commit، version و Artifact ID ثابت در CRM Test آزموده می‌شود. بعد از Evidence و تأیید مالک، همان Artifact به CRM Production می‌رود. ساخت دوبارهٔ CRM در Production یا استفاده از منابع Hero ممنوع است.

## اسناد اختصاصی Product

Product فقط acceptance criteria، configuration غیرمحرمانه، Evidence، runbook و تصمیم اختصاصی خودش را نگه می‌دارد. اصول عمومی، release flow و environment model را با Document ID و version از کتابخانهٔ مرکزی ارجاع می‌دهد. Product واقعی فقط پس از ثبت مالک و Evidence در `docs/registry/product-registry.json` معتبر است.

## مرز عملیاتی فعلی

این سند قرارداد معماری است و هیچ deployment، DNS، TLS، Secret یا Production change اجرا نمی‌کند. وضعیت و Evidence واقعی هر محیط در اسناد operation/evidence مربوط ثبت می‌شود. معیار پذیرش اجرای محصول و انتقال در `HERO-OPS-PRODUCT-RUNTIME-ISOLATION-AND-TRANSFER@1.0.0` و sequencing آن در `HERO-ROADMAP-CONTROLLED-PRODUCT-FACTORY-20260917@1.0.0` آمده است.
