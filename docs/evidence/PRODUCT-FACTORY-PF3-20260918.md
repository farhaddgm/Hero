# Evidence اجرای Product Test نمونهٔ بی‌خطر — PF-3

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF3-20260918`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF3-20260918.md`
> Title: Evidence اجرای Product Test نمونهٔ بی‌خطر — PF-3
> Type: evidence
> Scope: hero
> Status: `ready-for-owner-acceptance`
> Version: 1.2.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: `1.1.0`
> Superseded by: none

## نتیجه

گیت اجرایی PF-3 برای یک محصول نمونهٔ بی‌خطر در محیط Test بسته شد. اجرای نهایی از executor رسمی adapter یعنی `createDockerProductRunner` و `createDockerProductExecutor` استفاده کرد؛ executor با shell آزاد کار نمی‌کند، خروجی خام را برنمی‌گرداند و lifecycle را به Compose project یکتا و authorization همان run محدود می‌کند.

پذیرش Owner برای این artifact هنوز به‌صورت جداگانه ثبت نشده است؛ بنابراین وضعیت سند `ready-for-owner-acceptance` است، نه `owner-accepted`. این سند هیچ مجوزی برای Pilot، Production، Secret، Provider زنده یا external spend ایجاد نمی‌کند.

## اجرای نهایی و هویت artifact

| فیلد | مقدار |
|---|---|
| Authorization | `PRODUCT-TEST-20260918-001` |
| Step/document | `PF3-PRODUCT-TEST-002` / `1.0.0` |
| Run | `official-pf3-20260918e` |
| Source commit | `5c7291e069cddef935d269690fcd37e8891d0121` |
| Compose project | `hero-product-safe-sample-official-pf3-20260918e` |
| Artifact | `hero-product-official-sample@sha256:873bb0e4f49fb8d875232e6478e2a6847c02e3a645b85342c1407b6c858dc884` |
| Retained Test image tag | `hero-product-official-sample:official-pf3-20260918e` |
| Environment | `test` |
| Network | `none` |
| Health | `healthy` |

Image با digest بالا در Docker host Test retained است و tagهای mutable قدیمی cleanup شده‌اند. Digest artifact هویت release است؛ tag فقط reference محلی retention است.

## نتیجهٔ lifecycle

| بررسی | نتیجه |
|---|---|
| authorization، scope و Global Stop | PASS؛ Test-only و بدون Secret/Provider/spend |
| runtime preflight | PASS؛ plan approved، isolated-test و resource namespace یکتا |
| build با `build.network=none` | PASS |
| test با argv محدود `/opt/product/test` | PASS |
| start با image digest immutable | PASS |
| health check | PASS؛ `healthy` |
| stop | PASS |
| cleanup و rollback به نبودن runtime نمونه | PASS |
| workspace cleanup | PASS |
| حذف tagهای mutable قدیمی | PASS؛ image نهایی retained است |
| عدم‌اختلال Hero Test و Hero Production | PASS؛ state قبل/بعد برابر |

## Evidence و کنترل کیفیت/امنیت

Evidence redacted نهایی در Test host در مسیر زیر نگهداری شد:

`/tmp/hero-product-official-evidence-parent-official-pf3-20260918e/run/`

این bundle شامل `hero-product-artifact-manifest.json`، SBOM، attestation، test evidence، quality/security evidence و state قبل/بعد Hero است. مقادیر ثبت‌شده:

- SBOM: `sha256:15aef942bc7b427ebbc26bd815dce358d1f85a52a65d24b8e4af36b3c63c43c2`
- in-toto/SLSA attestation: `sha256:4765ed2261263a3d63442847410002d9c1b6f34592e494674cc5bb7bb2c20d49`
- redacted test evidence: `sha256:f8f8f59d1ba0cb68a0d8d9c1c3954af441a09a6c298b02c6deabb70021c1090e`
- quality/security evidence: `sha256:95b86c852925497ed652d8e692dca5bf0ab6bf2d87a6a9bc8a8de6b791be3a0c`

Quality/security gate واقعیِ نمونه این موارد را PASS کرد: artifact immutable، test bounded، health، network isolation، read-only، non-root، no-new-privileges، `cap_drop: ALL`، نبود host escape، نبود مقدار حساس و redaction خروجی. Browser E2E و dependency scan برای این safe sample که یک image حداقلی Alpine و بدون web surface/package manifest است `not-applicable-safe-sample` ثبت شده‌اند؛ این به معنی عبور اسکن یک محصول واقعی وب نیست.

Manifest با قرارداد `hero.product-artifact/v1` validate شد و شامل source commit، artifact digest، SBOM digest، attestation digest، test-evidence digest و quality/security evidence digest است. هیچ prompt، Provider response، Secret یا raw stdout/stderr در bundle نیست.

## وضعیت پس از اجرا

- Hero Test پس از پایان run همچنان روی `v1.1.4-rc.15`، commit `5c7291e` و digest `ghcr.io/farhaddgm/hero@sha256:bec56ba76d8b70e3a704bfc05d5d349abe1abe1a60bd35674f63bea4f94221b0` healthy و ready است.
- Hero Production healthy باقی ماند و هیچ command این run آن را هدف نگرفت.
- Product Test sample container، network و workspace موقت پس از cleanup باقی نماندند؛ فقط image immutable نهایی و evidence retained هستند.
- Production، Pilot، Secret Store/Secret، Provider زنده، external spend، DNS/Caddy و target خارجی لمس نشدند.

## گیت باقی‌مانده

PF-3 از نظر اجرای نمونه، artifact/evidence و quality/security sample gate آمادهٔ پذیرش Owner است. موارد زیر عمداً خارج از این گیت باقی می‌مانند: Owner acceptance صریح، محصول واقعی با browser E2E، clean-target portability/recovery rehearsal، Node Agent/remote target و Pilot/Production. این موارد برای PF-5، PF-6 و Pilot/Production authorization مستقل هستند.
