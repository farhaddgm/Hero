# Evidence اجرای Environment تا Final Readiness — BO-121 تا BO-170

> Document ID: `HERO-EVIDENCE-BACKOFFICE-ENVIRONMENT-DELIVERY-HARDENING-FINAL-BO-121-170`
> Canonical path: `docs/roadmap/BACKOFFICE-ENVIRONMENT-DELIVERY-HARDENING-FINAL-BO-121-170.md`
> Title: Evidence اجرای Environment تا Final Readiness — BO-121 تا BO-170
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.1
> Owner: hero-architecture
> Review cadence: none
> Supersedes: none
> Superseded by: none

> یادداشت تفسیر: این سند وجود contract، control و تست داخلی Batch را ثبت می‌کند. عملیات واقعی Server/Secret/Production/clean-target و پذیرش نهایی انجام‌شده تلقی نمی‌شوند. وضعیت جاری در `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911` مقدم است.

## دامنه و مرز

Snapshotهای `BATCH-BACKOFFICE-20260910-013` تا `017` گام‌های `BO-121..BO-170` را پوشش می‌دهند و در زمان ساخت Global Stop خاموش بود. همهٔ عملیات حساس—Production deploy، اتصال Server/GitHub، secret mutation/reveal، حذف داده، هزینه و پیام بیرونی، Notion write و اجرای Pilot—خارج Scope و fail-closed هستند.

## خروجی‌های اجباری

| گام‌ها | پیاده‌سازی و شاهد |
|---|---|
| BO-121..134 | قرارداد سه‌محیطی، metadata-only GitHub/Server، Node enrollment/heartbeat/rotation/revoke، desired/observed/reconcile proposal، Secret reference-only، Owner-only reveal request، egress allowlist و آزمون impersonation/replay/revoke. |
| BO-135..146 | telemetry allowlist/redaction، break-glass request بدون data access، Release state machine record-only، Artifact digest/provenance/attestation/SBOM، Delivery Matrix/Bundle، portability/recovery evidence و acceptance بدون deploy. |
| BO-147..156 | retention minimum، dry-run cleanup/hold، `fa`/`en` و RTL/LTR، pagination/query budget، accessibility/security/load/backup/secret/dependency/role regression audit evidence. |
| BO-157..170 | compatibility migration plan، deterministic read-model digest comparison، multi-project/adversarial/crash-resume/transfer scenarios، traceability، help/glossary/runbook، Notion plan-only، readiness review، owner-acceptance gate و pilot proposal-only gate. |

## وضعیت گام‌های مالک

`BO-169` به‌صورت قابلیتِ owner-only پیاده‌سازی شده است، اما پذیرش واقعی این نسخه به ایجاد یک رکورد صریح Owner با `artifactIdentity` وابسته است؛ عامل توسعه به‌جای مالک آن را ثبت نمی‌کند. `BO-170` نیز فقط پس از همان رکورد، Proposal پایلوتِ بدون اجرا می‌سازد. بنابراین هیچ Pilot یا Production عملیاتی در این Evidence رخ نداده است.

## نتیجهٔ آزمون

در ۱۰ سپتامبر ۲۰۲۶، `npm run check` در Linux reference container با موفقیت اجرا شد: ۴۰۸ فایل Clean Room بررسی شد؛ ۱۲۲ سند بدون خطا اعتبارسنجی شد؛ Build شامل ۲۲۱ ماژول و ۳۲ فایل JSON بود؛ و ۳۰۳ آزمون با صفر خطا گذشت. هشدار Docker در Doctor فقط محدودیت اجرای Docker از درون خودِ کانتینر مرجع را بیان می‌کند و استقرار محسوب نمی‌شود. این سند مجوز هیچ محیط، اتصال خارجی، مصرف Provider، یا عملیات Production نیست.

## Attempt استقرار Test — ۱۰ سپتامبر ۲۰۲۶

با تأیید صریح Owner، image محلیِ کنترل‌شده پس از preflight موفق Test ساخته و فقط سرویس `hero-test/control-plane` جایگزین شد. PostgreSQL و Proxy موجود تغییر نکردند و Provider زنده خاموش ماند. سرویس جدید در شروع به `POSTGRES_CONNECTION_FAILED` رسید؛ log PostgreSQL علت واقعی را `password authentication failed for user "hero"` ثبت کرد. بنابراین استقرار Test **ناموفق و blocked** است و هیچ پذیرش نهایی Owner، Pilot یا Production ثبت/اجرا نشد. اصلاح نیازمند هماهنگ‌سازی یا Rotate کردن Secretهای PostgreSQL Test با یک مجوز جداگانهٔ Secret change است.

## بازیابی و پذیرش Owner — ۱۰ سپتامبر ۲۰۲۶

پس از مجوز صریح Owner برای همهٔ مجوزهای لازم، Secret PostgreSQL Test بدون نمایش مقدار همگام شد و migrationهای نسخه‌بند‌شده تا `014` با موفقیت اجرا شدند. سپس فقط `hero-test/control-plane` restart شد؛ PostgreSQL و Proxy تغییر نکردند. image مستقر `hero-control-plane:local@sha256:ae190c819389165d94d162c70da436e90d66f4658a909007dffcb56128025199` است.

smoke-test واقعی محیط Test: `/health=200`، `/ready=200`، `/backoffice=401` بدون احراز هویت، و endpointهای `infrastructure-control-contract`، `delivery-control-contract`، `operational-hardening-contract` و `final-readiness-contract` همگی `200` هستند. Owner این نسخهٔ Test را با دستور صریح در همین Task پذیرفت. Pilot همچنان اجرا نشده و به Proposal و مجوز جداگانه نیاز دارد؛ Production نیز کاملاً خارج از Scope است.
