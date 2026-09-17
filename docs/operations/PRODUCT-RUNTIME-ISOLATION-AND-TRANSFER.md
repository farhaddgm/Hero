# Runbook ایزولاسیون و انتقال runtime محصول

> Document ID: `HERO-OPS-PRODUCT-RUNTIME-ISOLATION-AND-TRANSFER`
> Canonical path: `docs/operations/PRODUCT-RUNTIME-ISOLATION-AND-TRANSFER.md`
> Title: Runbook ایزولاسیون و انتقال runtime محصول
> Type: operation
> Scope: cross-project
> Status: proposed
> Version: 1.0.0
> Owner: hero-operations
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## هدف و وضعیت

این runbook معیار پذیرش برای اجرای محصولی است که Hero مدیریت می‌کند، چه روی همان host ParsPack و چه روی سرور Test دیگر. این سند **دستور اجرای خودکار نیست** و در وضعیت `proposed` قرار دارد: Hero فعلی هنوز container محصول، target خارجی یا انتقال را خودکار اجرا نمی‌کند. شروع هر دستور واقعی به authorization جدا، Step ID معتبر، Global Stop خاموش و مالک target نیاز دارد.

Hero Test با Product Test یکی نیست. هیچ‌یک از مراحل این سند نباید runtime، volume، database، network، Secret، پورت، Caddy یا container Hero و اپلیکیشن دیگری را تغییر دهد مگر اینکه همان target به‌طور صریح در authorization آمده باشد.

## اطلاعات اجباری پیش از پذیرش یک Product Runtime

| موضوع | مقدار لازم | رد فوری اگر |
|---|---|---|
| هویت محصول | `product_id`، slug یکتا، Owner، environment و `run_id` | slug با Hero/محصول دیگر collision دارد. |
| کد/Artifact | repository مستقل، commit، version و digest immutable | `latest`، مسیر محلی `/opt/hero` یا Artifact بدون digest استفاده شود. |
| Compose | `hero-product-<slug>-<environment>` به‌عنوان project name | `container_name` عمومی، نام resource مشترک یا path dependency به Hero وجود دارد. |
| داده | database، volume و backup reference مختص product/environment | volume/database Hero یا محصول دیگر reuse شود. |
| شبکه | network اختصاصی، port reservation و egress allowlist | `network_mode: host`، network مشترک یا bind عمومی بدون مجوز وجود دارد. |
| امنیت runtime | non-root، `no-new-privileges`، capability drop، filesystem read-only در حد امکان، CPU/RAM/PID/timeout | privileged، Docker socket، host root/broad mount یا credential خام در config باشد. |
| عملیات | health/readiness، logging redacted، restart/rollback و cleanup plan | health/rollback/owner/on-call نامشخص باشد. |
| Secret | فقط reference/environment channel مجاز | Secret خام در Git، UI، log، evidence، bundle یا command line وارد شود. |

## پذیرش هم‌سرور روی ParsPack

1. ظرفیت آزاد host، پورت، disk، CPU و memory را فقط به‌صورت read-only بررسی کنید و conflict را ثبت کنید.
2. policy محصول، Compose plan، resource names و artifact digest را بدون start کردن بررسی کنید.
3. runner باید workspace مستقل از repository Hero داشته باشد؛ از `/opt/hero` برای checkout/build محصول استفاده نمی‌شود.
4. `docker compose config` و ruleهای isolation باید پیش از start، موارد ناامن/متعارض را reject کنند.
5. فقط پس از authorization همان Product Test، Compose project اختصاصی شروع می‌شود.
6. health/readiness، consumption quota، network boundary و عدم‌تغییر Hero Test/سرویس کنترل‌شدهٔ دیگر ثبت می‌شود.
7. در شکست، فقط Compose project/volumeهای دقیق همان محصول و همان محیط طبق rollback plan هدف گرفته می‌شوند؛ عملیات broad یا حدسی ممنوع است.

## بستهٔ قابل‌انتقال

هر Release محصول باید بدون Secret شامل موارد زیر باشد:

```text
product_id + environment + owner
commit + version + immutable image digest
SBOM / provenance or attestation reference
config schema version and migration contract
test/security/isolation evidence
encrypted-backup reference + checksum (not the secret/key)
health/readiness/rollback/restore runbook
```

مقصد باید configuration و Secretهای خودش را فقط از کانال تأییدشده بسازد. کپی `.env`، bind-mount، Docker volume، network، database یا credential از مبدا، portability محسوب نمی‌شود و ممنوع است.

## پذیرش Target خارجی

Target خارجی پیش از هر Deploy این پیش‌نیازها را دارد:

1. inventory نسخه‌دار: owner، نوع محیط، ظرفیت، domain/egress policy، data classification و revoke owner؛
2. Docker/Compose یا runtime معادل مورد تأیید، با resource namespace مخصوص product؛
3. Agent کم‌اختیار با enrollment، هویت چرخشی، heartbeat و revoke؛ ارتباط کنترل باید از target به Control Plane برقرار شود، نه listener عمومی برای shell؛
4. dispatch امضاشده و محدود به operation/artifact/target ازپیش‌تأییدشده؛ command آزاد، token دائمی و SSH عمومی خارج از Scope هستند؛
5. کانال Secret مقصد، TLS و observability/redaction مستقل؛
6. آزمایش harmless برای enroll، timeout و revoke پیش از هر artifact واقعی.

## شواهد لازم برای Exit Gate

- نام‌های resource، scope و digest runtime بدون Secret؛
- نتیجهٔ تست‌های unit/integration/browser یا معادل Product؛
- نتیجهٔ policy/Compose isolation و negative tests؛
- health/readiness و latency/usage محدود؛
- backup/restore checksum و migration evidence؛
- rollback point و نتیجهٔ تمرین restore روی target پاک؛
- پذیرش Owner برای همان Product Test؛
- Known gapها و وضعیت Pilot/Production به‌صورت صریح.

نداشتن هر مورد یعنی وضعیت `blocked` یا `verification`، نه `completed`. Product Production به این runbook بسنده نمی‌کند و authorization `production-deploy` و review امنیتی مستقل دارد.
