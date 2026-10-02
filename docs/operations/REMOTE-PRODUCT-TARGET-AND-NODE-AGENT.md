# Hero — Target خارجی محصول و Node Agent کم‌اختیار

> Document ID: `HERO-OPS-REMOTE-PRODUCT-TARGET-AND-NODE-AGENT`
> Canonical path: `docs/operations/REMOTE-PRODUCT-TARGET-AND-NODE-AGENT.md`
> Title: قرارداد عملیاتی Target خارجی محصول و Node Agent کم‌اختیار
> Type: operation
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-operations
> Review cadence: per-change

## هدف و مرز

این runbook قرارداد ایمنِ اضافه‌کردن یک سرور Test برای اجرای Product Runtime را توضیح می‌دهد. Target خارجی، محیط Hero نیست و به‌تنهایی مجوز اجرای محصول، اتصال SSH، ساخت Secret یا Deploy ایجاد نمی‌کند. هر Target باید inventory و authorization مستقل داشته باشد.

پیاده‌سازی PF-4 در source این قراردادها را فراهم می‌کند: inventory نسخه‌دار، enrollment با کلید عمومی، transport خروجی `outbound-https`، heartbeat هویت‌محور، dispatch امضاشدهٔ Ed25519، allowlist عملیات، digest immutable، جلوگیری از replay، expiry/timeout، redaction و revoke. اجرای واقعی شبکه در این runbook وجود ندارد؛ adapter واقعی باید بعداً با مجوز Target مشخص و جدا اضافه شود.

## قوانین غیرقابل‌مذاکره

- فقط `environment=test` در این قرارداد پذیرفته می‌شود؛ Production و Pilot مسیر و authorization جدا دارند.
- Agent از Target به Control Plane وصل می‌شود؛ listener عمومی برای کنترل یا shell ساخته نمی‌شود.
- dispatch فقط یکی از عملیات `preflight`, `health-check`, `start-test`, `stop-test`, `cleanup-test` را حمل می‌کند.
- dispatch باید `projectId`, `targetId`, `agentId`, `operation`, `authorizationId`, `artifactDigest`, `issuedAt`, `expiresAt`, `nonce` و `dispatchId` را داشته باشد.
- `artifactDigest` فقط `sha256:<64 hex>` است؛ tag mutable، `latest`، shell آزاد، command دلخواه، Docker socket، host mount و credential دائمی رد می‌شوند.
- public key در registry نگهداری نمی‌شود؛ فقط fingerprint آن در خروجی و evidence ثبت می‌شود. private key هرگز وارد repository، log یا evidence نیست.
- dispatch یک‌بارمصرف است؛ `dispatchId` و `nonce` تکراری fail-closed رد می‌شوند.
- heartbeat فقط capabilityهای allowlist‌شده، health محدود و digest immutable را می‌پذیرد؛ هویت اشتباه یا Agent revoke‌شده رد می‌شود.
- revoke باید هم برای Agent و هم برای Target ممکن باشد و پس از آن dispatch جدید پذیرفته نمی‌شود.

## جریان مجاز

1. Owner/Admin یک inventory Test با owner، project، ظرفیت CPU/RAM/concurrency، egress allowlist و endpoint reference غیرمحرمانه ثبت می‌کند.
2. Owner برای همان `projectId` و `targetId` authorization نسخه‌دار و فعال صادر می‌کند؛ `globalStop=false` باید صریح باشد.
3. Control Plane Target را approve می‌کند و Agent با public key و capabilityهای محدود enroll می‌شود. این مرحله metadata-only است تا connector واقعی جداگانه مجاز شود.
4. Agent heartbeat سالم و digest runtime را گزارش می‌کند.
5. Control Plane dispatch را با Ed25519 امضا می‌کند؛ Target فقط پس از بررسی scope، signature، expiry، replay، artifact digest و state آن را می‌پذیرد.
6. نتیجه فقط structured و redacted ثبت می‌شود: status، operation، digest، latency/health، failure code و correlation identifiers.
7. در timeout، expiry، mismatch، revoke یا Global Stop، اجرا متوقف و checkpoint امن ثبت می‌شود؛ retry خودکار با تغییر scope مجاز نیست.

## چیزهایی که این سند انجام نمی‌دهد

- به سرور واقعی وصل نمی‌شود و SSH، mTLS، DNS، firewall یا Secret Store را تغییر نمی‌دهد.
- Product image، volume، database یا `.env` را از Hero host کپی نمی‌کند.
- هیچ command آزاد یا remote shell فراهم نمی‌کند.
- اجرای واقعی `start-test` یا `cleanup-test` روی Target خارجی را بدون authorization جداگانه ادعا نمی‌کند.

## تست و evidence

`packages/contracts/src/remote-agent.mjs` قرارداد ماشین‌خوان، `packages/domain/src/remote-agent.mjs` registry و امضای dispatch، `tests/remote-agent.test.mjs` تست‌های مثبت/منفی، و `tools/run-pf4-remote-agent-simulation.mjs` harness رسمی شبیه‌سازی هستند. اجرای رسمی فقط در Test clean-room انجام شده و باید در evidence PF-4 با run، commit، digest evidence و علت نبود اتصال واقعی ثبت شود.

پیش از اتصال واقعی، این evidenceها لازم‌اند: مالک Target، inventory نسخه‌دار، authorization با Step/document version دقیق، کانال Secret مقصد، policy شبکه خروجی، key rotation، heartbeat/timeout، health و runtime digest، revoke، rollback و عدم‌اختلال Hero. نبود هر مورد وضعیت را `blocked` نگه می‌دارد.
