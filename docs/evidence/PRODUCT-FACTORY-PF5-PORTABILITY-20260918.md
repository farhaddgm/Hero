# Evidence قابل‌حمل‌بودن و بازیابی محصول — PF-5

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF5-PORTABILITY-20260918`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF5-PORTABILITY-20260918.md`
> Title: Evidence قرارداد Delivery Bundle، Clean Target و Recovery — PF-5
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change

## نتیجهٔ صادقانه

قرارداد Delivery Bundle، validation، تمرین Clean Target، recovery proof و portability gate در source پیاده و با یک نمونهٔ synthetic در clean-room بدون شبکه تأیید شدند. انتقال واقعی به یک سرور Test جدا هنوز اجرا نشده است؛ بنابراین Exit Gate عملیاتی PF-5 همچنان `blocked-for-real-target` است و این سند انتقال واقعی را ادعا نمی‌کند.

## هویت اجرای شبیه‌سازی

| فیلد | مقدار |
|---|---|
| Run | `pf5-rehearsal-20260918a` |
| Source commit | `2e905f3e1c2b980ff2503aafde0210fe0bf548dc` |
| Evidence path | `/tmp/hero-pf5-portability-evidence-pf5-rehearsal-20260918a/` |
| Evidence digest | `sha256:30814f40287ed355b0988664a6c9384f5a8c02e765cddaa2cfa68b2c7960e87c` |
| Environment | `test`؛ synthetic clean-room |
| Artifact | `hero/example@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| Network calls | `0` |

## کنترل‌های مثبت

| کنترل | نتیجه |
|---|---|
| artifact immutable و digest validation | PASS |
| SBOM/attestation/test/quality evidence digest | PASS |
| schema پیکربندی بدون value و Secret | PASS |
| migration plan و backward compatibility | PASS |
| backup reference پروژه‌محور و checksum | PASS |
| Clean Target phases با rollback digest | PASS |
| recovery proof: backup/restored digest برابر | PASS |
| migration، health، readiness و rollback | PASS |
| source volume/.env copy و public exposure | PASS؛ هر سه false |
| portability gate | PASS؛ `PORTABILITY_VERIFIED` |
| real server transfer و external network | اجرا نشد؛ عمداً `0` |

تست هدفمند PF-5 و regression مرتبط برابر `13 pass / 0 fail` بود. هیچ Secret، Provider زنده، external spend، Pilot یا Production در این اجرا لمس نشد.

## فایل‌های مرجع

- contract: `packages/contracts/src/product-delivery-bundle.mjs`
- domain rehearsal/recovery: `packages/domain/src/product-delivery-bundle.mjs`
- test: `tests/product-delivery-bundle.test.mjs`
- harness: `tools/run-pf5-portability-rehearsal.mjs`
- runbook: `docs/operations/PRODUCT-DELIVERY-BUNDLE-AND-CLEAN-TARGET-REHEARSAL.md`

## گیت باقی‌مانده

برای بسته‌شدن واقعی PF-5 باید Owner یک مقصد Test پاک و جدا، مالک عملیاتی، authorization با Step/Document version و target دقیق، کانال امن Secret مقصد و روش backup/restore واقعی فراهم کند. سپس همان digest روی مقصد اجرا، health/readiness/rollback و no-impact ثبت، و Owner acceptance ثبت می‌شود. Secret نباید در چت یا evidence ارسال شود.
