# Roadmap Graph و Completeness Engine — v1.0

> Document ID: `HERO-SPEC-ROADMAP-GRAPH-COMPLETENESS`
> Canonical path: `docs/specs/ROADMAP-GRAPH-COMPLETENESS-v1.0.md`
> Title: Roadmap Graph و Completeness Engine — v1.0
> Type: specification
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## مدل

Roadmap از `objective`، `initiative`، `capability`، `milestone`، `release`، `decision`، `risk` و `task` ساخته می‌شود. ارتباط‌ها شامل `contains`، `depends-on`، `enables`، `conflicts-with`، `validated-by` و `delivered-by` هستند.

Roadmap intent قابل پیشنهاد است؛ progress، evidence coverage، artifact identity، approval و authorization محاسبه‌شده یا محافظت‌شده‌اند.

## Completeness

گیت‌ها از stageهای `proposed` تا `retiring` و risk profile ساخته می‌شوند. سند مفقود یا Evidence غیرقابل‌راستی‌آزمایی هرگز سبز تلقی نمی‌شود. خروجی شامل check، severity، score، required score، missing items و وضعیت `ready/blocked` است.

قواعد پویا:

- `pii` به سیاست privacy، classification و access نیاز دارد؛
- `payment` به کنترل و reconciliation نیاز دارد؛
- `ai` به مدل، evaluation، safety و cost evidence نیاز دارد؛
- `external_integration` به retry، rate limit و outage policy نیاز دارد.

## کنترل گراف

شناسهٔ گره و یکتایی آن، وجود دو سر هر edge، self-loop و cycle در dependency بررسی می‌شود. گراف دارای cycle برای تصمیم اجرایی معتبر نیست و در Product Studio به‌عنوان gap نشان داده می‌شود.

## معیار پذیرش

گراف از `config/product-development/hero-roadmap-graph.json` rebuild می‌شود؛ Product Studio هم roadmap legacy را برای سازگاری و هم graph را برای رابطه و dependency نمایش می‌دهد.
