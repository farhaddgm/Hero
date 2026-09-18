# Evidence تجربهٔ Owner، مشاهده‌پذیری و hardening — PF-6

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF6-UX-OBSERVABILITY-20260918`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF6-UX-OBSERVABILITY-HARDENING-20260918.md`
> Title: Evidence UX، مشاهده‌پذیری و hardening کارخانهٔ محصول — PF-6
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change

## نتیجهٔ صادقانه

قراردادهای source برای تجربهٔ Owner، correlation/audit، notification deduplication، SLI stale/recovery، retention/cleanup، دو project scope و hardening ثبت و با harness رسمی local/Test تأیید شدند. Browser E2E واقعی، axe/screen-reader، load/soak روی deployment واقعی و failure injection شبکه‌ای در این run اجرا نشدند؛ بنابراین Exit Gate کامل PF-6 هنوز `blocked-for-real-runtime-evidence` است.

## هویت اجرای harness

| فیلد | مقدار |
|---|---|
| Run | `pf6-simulation-20260918a` |
| Source commit | `2e905f3e1c2b980ff2503aafde0210fe0bf548dc` |
| Evidence path | `/tmp/hero-pf6-hardening-evidence-pf6-simulation-20260918a/` |
| Evidence digest | `sha256:fb5d1766f5dcc930c2682c19c3a42f351bb17cf2ff85aac4731d9c75cfee0962` |
| Project scopes | `product-alpha`, `product-beta` |
| Traces | `102` |
| Network calls | `0` |
| Browser runtime | `realBrowserExecuted=false` |

## کنترل‌های تأییدشده

| کنترل | نتیجه |
|---|---|
| correlation/trace preservation و redaction | PASS |
| deduplication اعلان‌های تکراری | PASS |
| stale SLI detection و recovery | PASS |
| project isolation بین دو محصول | PASS |
| retention minimum و cleanup dry-run hold | PASS؛ deletion=false |
| accessibility contract و fa/RTL metadata | PASS در source contract |
| security/adversarial isolation | PASS در source harness |
| load trace generation و counters | PASS؛ 102 trace |
| backup/restore، secret dependency، role regression audits | PASS در source harness |
| browser E2E، axe، screen reader و deployed load/soak | اجرا نشده؛ runtime واقعی در اختیار نبود |

تست هدفمند PF-6 برابر `1 pass / 0 fail` و همراه regression مرتبط `13 pass / 0 fail` شد. evidence فقط identifier، status، latency/counter و schema را نگه می‌دارد؛ prompt، Secret، raw response و دادهٔ حساس در آن نیست.

## فایل‌های مرجع

- harness: `packages/domain/src/pf6-hardening-harness.mjs`
- runner: `tools/run-pf6-hardening-simulation.mjs`
- test: `tests/pf6-hardening-simulation.test.mjs`
- notification/observability contracts: `packages/domain/src/notification-observability.mjs` و `packages/domain/src/operational-hardening.mjs`

## گیت باقی‌مانده

برای بستن PF-6 باید یک deployment Test محصول نمونه با browser runtime مجاز، اجرای واقعی دو مسیر Owner، RTL/LTR، keyboard/accessibility، failure injection، load/soak و جمع‌آوری evidence redacted فراهم شود. این گیت هیچ مجوزی برای Production، Pilot، Provider زنده، Secret یا external spend ایجاد نمی‌کند.
