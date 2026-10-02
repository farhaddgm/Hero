# Hero — Delivery Bundle و تمرین Clean Target برای Product Test

> Document ID: `HERO-OPS-PRODUCT-DELIVERY-BUNDLE-AND-CLEAN-TARGET`
> Canonical path: `docs/operations/PRODUCT-DELIVERY-BUNDLE-AND-CLEAN-TARGET-REHEARSAL.md`
> Title: قرارداد عملیاتی Delivery Bundle و تمرین Clean Target برای Product Test
> Type: operation
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change

## هدف

این سند قرارداد قابل‌حمل‌بودن محصول را تعریف می‌کند. Delivery Bundle باید یک artifact immutable، evidence قابل‌راستی‌آزمایی، schema پیکربندی بدون مقدار محرمانه، migration plan، backup reference و restore runbook داشته باشد تا محصول به مقصد دیگری منتقل شود بدون اینکه به host مبدأ، volume مبدأ یا `.env` مبدأ وابسته باشد.

این قرارداد فقط برای Product Test است. اجرای واقعی روی سرور دوم، انتقال شبکه‌ای، Secret مقصد و backup واقعی، authorization و Target جداگانه می‌خواهند.

## محتوای اجباری Bundle

- reference artifact فقط با digest `sha256:<64 hex>`؛
- source commit، release version، SBOM، attestation، test و quality evidence با digest؛
- config schema با prefix `HERO_` و بدون value، token، key یا password؛
- migration plan با سازگاری backward؛
- backup reference پروژه‌محور با digest و بدون Secret؛
- restore runbook و compatibility matrix برای app/schema/config/agent؛
- مشخص‌بودن environment Test، عدم کپی source volume و `.env` و عدم public exposure.

## تمرین Clean Target

تمرین رسمی باید با authorization نسخه‌دار Test، target پاک، artifact همان digest، config schema مقصد و rollback digest انجام شود. مراحل machine-readable عبارت‌اند از: validate bundle، آماده‌سازی مقصد، pull با digest، restore metadata، migration check، health/readiness، rollback verification و cleanup.

هیچ مرحله‌ای در این قرارداد shell آزاد، copy کردن volume یا `.env`، public exposure، Secret در evidence، یا اتصال واقعی را پنهانی انجام نمی‌دهد. نبود هرکدام از authorization، rollback digest، checksum، migration، health یا readiness باید fail-closed باشد.

## Recovery Proof

Recovery زمانی معتبر است که digest backup و restored برابر باشند، migration تأیید شده باشد، health و readiness موفق باشند و rollback نیز verify شده باشد. نتیجه باید redacted و شامل status، digest، run/correlation identifiers و failure code باشد؛ prompt، raw output و Secret ثبت نمی‌شود.

## اجرای مرجع Test

`tools/run-pf5-portability-rehearsal.mjs` فقط یک نمونهٔ synthetic و بدون شبکه اجرا می‌کند. این ابزار انتقال واقعی نیست و برای اثبات contract، clean-target phases، recovery proof و portability gate استفاده می‌شود. اجرای واقعی به Target Test پاک، مالک Target، authorization مستقل و کانال امن Secret مقصد نیاز دارد.

مرجع کد قرارداد: `packages/contracts/src/product-delivery-bundle.mjs` و `packages/domain/src/product-delivery-bundle.mjs`. تست‌ها در `tests/product-delivery-bundle.test.mjs` هستند.

## گیت و مرزها

| گیت | وضعیت مجاز |
|---|---|
| Bundle contract و validation | source/test verified |
| Clean-target rehearsal در local clean-room | simulation verified |
| Recovery proof | simulation verified |
| انتقال واقعی به مقصد Test جدا | blocked تا Target/authorization/connector فراهم شود |
| Pilot/Production/Provider زنده/External spend | خارج از scope و untouched |
