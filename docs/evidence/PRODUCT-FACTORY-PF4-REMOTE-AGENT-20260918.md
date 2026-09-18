# Evidence قرارداد و شبیه‌سازی Target خارجی — PF-4

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF4-REMOTE-AGENT-20260918`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF4-REMOTE-AGENT-20260918.md`
> Title: Evidence قرارداد و شبیه‌سازی Target خارجی و Node Agent کم‌اختیار — PF-4
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change

## نتیجهٔ صادقانه

قرارداد و مسیر fail-closed PF-4 در source پیاده و در یک شبیه‌سازی local/Test بدون شبکه تأیید شد. Exit Gate کامل PF-4 هنوز بسته نشده است، چون هیچ سرور خارجی واقعی، Agent واقعی، کانال Secret، owner target و authorization مستقل برای اتصال خارجی در اختیار این اجرا نبود. این سند اجرای remote واقعی را ادعا نمی‌کند.

## هویت اجرای شبیه‌سازی

| فیلد | مقدار |
|---|---|
| Run | `pf4-simulation-20260918b` |
| Source commit | `a4dbeff9b4c96a9cf9049fa523070d2cdc7f73e1` |
| Evidence path | `/tmp/hero-pf4-remote-agent-evidence-pf4-simulation-20260918b/` |
| Evidence digest | `sha256:837c46fc39fafaea36d00ad561e6ac9651ff021203111c9494499ba315f27b4b` |
| Project/Target | `project-safe` / `target-test-one` |
| Agent | `agent-test-one` |
| Environment | `test` |
| Transport | `outbound-https` metadata-only; network calls: `0` |
| Artifact input | immutable `sha256` digest only |

## شواهد مثبت و منفی

| کنترل | نتیجه |
|---|---|
| قرارداد نسخه‌دار و allowlist عملیات | PASS |
| Target inventory با ظرفیت، egress allowlist و public listener خاموش | PASS |
| enrollment با Ed25519 و ثبت fingerprint به‌جای کلید خام | PASS |
| heartbeat با identity fingerprint و runtime digest immutable | PASS |
| dispatch harmless با signature معتبر | PASS؛ `health-check`، حالت `simulation-only` و `sideEffect=false` |
| tampered signature | PASS؛ رد با `DISPATCH_SIGNATURE_INVALID` |
| replay برای dispatch/nonce | PASS؛ رد با `DISPATCH_REPLAY` |
| expiry/timeout | PASS؛ رد با `DISPATCH_EXPIRED` |
| mutable artifact | PASS؛ رد با `ARTIFACT_NOT_IMMUTABLE` |
| revoke Agent و رد dispatch بعدی | PASS؛ `AGENT_REVOKED` |
| secret/private key/raw public key در evidence | PASS؛ صفر مقدار محرمانه و فقط fingerprint |

تعداد تست‌های harness: `1` مسیر مثبت، `4` negative check، `1` revoke verification. تست واحد `tests/remote-agent.test.mjs` به‌همراه regression زیرگام‌های infrastructure برابر `9 pass / 0 fail` در Linux container بود.

## فایل‌های مرجع

- قرارداد: `packages/contracts/src/remote-agent.mjs`
- registry و signature verification: `packages/domain/src/remote-agent.mjs`
- تست‌های unit/security: `tests/remote-agent.test.mjs`
- harness: `tools/run-pf4-remote-agent-simulation.mjs`
- runbook: `docs/operations/REMOTE-PRODUCT-TARGET-AND-NODE-AGENT.md`

## وضعیت گیت PF-4

| گیت | وضعیت |
|---|---|
| target inventory contract | `implemented; simulation verified` |
| enrollment/rotation boundary | `implemented; simulation verified; real key channel pending` |
| signed bounded dispatch | `implemented; simulation verified` |
| heartbeat/health/revoke/redaction | `implemented; simulation verified` |
| real clean Test target | `blocked — no target owner/authorization/connector` |
| real remote build/start/stop/cleanup | `blocked — intentionally not executed` |
| Production/Pilot/Secret/Provider/spend | `untouched and out of scope` |

برای بستن PF-4 باید Owner یک Target Test مشخص با مالک عملیاتی، authorization شامل Step/document version و scope دقیق، policy شبکه و کانال امن identity/Secret ارائه کند؛ سپس فقط یک Product Test harmless با health، timeout، revoke، rollback و no-impact واقعی اجرا و ثبت می‌شود. هیچ Secret نباید در چت یا evidence ارسال شود.
