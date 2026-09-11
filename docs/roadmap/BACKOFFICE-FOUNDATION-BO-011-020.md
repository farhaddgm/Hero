# Evidence اجرای زیرساخت داده و رویداد بک‌آفیس — BO-011 تا BO-020

> Document ID: `HERO-EVIDENCE-BACKOFFICE-FOUNDATION-BO-011-020`
> Canonical path: `docs/roadmap/BACKOFFICE-FOUNDATION-BO-011-020.md`
> Title: Evidence اجرای زیرساخت داده و رویداد بک‌آفیس — BO-011 تا BO-020
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.1
> Owner: hero-architecture
> Review cadence: none

> یادداشت تفسیر: این سند Evidence تاریخی همان Batch است. وضعیت جاری تحویل و تفاوت میان artifact coverage و verified delivery در `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911` ثبت شده و برای گزارش فعلی مقدم است.

## دامنه و مجوز

این Evidence فقط گام‌های `BO-011` تا `BO-020` از `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1@1.0.0` را پوشش می‌دهد. مجوز متناظر `BATCH-BACKOFFICE-20260910-002` است؛ Global Stop خاموش بوده و Production، Pilot، Secret، عملیات مخرب، هزینهٔ بیرونی، پیام بیرونی و Notion write خارج از اختیارند.

## خروجی‌های ثبت‌شده

| گام | خروجی | مسیر/مرجع |
|---|---|---|
| BO-011 | ده Context پایدار Back Office | `packages/contracts/src/backoffice-foundation.mjs` |
| BO-012 | ADR مرز سه Plane | `docs/decisions/ADR-0011-backoffice-control-execution-data-planes.md` |
| BO-013 | قرارداد IDهای پایدار | `packages/contracts/src/backoffice-foundation.mjs` |
| BO-014 | فهرست موجودیت‌های مدل بخش ۲۶ با version/lifecycle | `packages/contracts/src/backoffice-foundation.mjs` |
| BO-015 | validatorهای Entity و Event Envelope | `packages/contracts/src/backoffice-foundation.mjs` |
| BO-016 | migration شمارهٔ 009 با guardهای append-only | `packages/adapters/migrations/009_backoffice_data_foundation.sql` |
| BO-017 | Event Envelope شامل actor/project/correlation/idempotency | `packages/domain/src/backoffice-event-envelope.mjs` |
| BO-018 | Outbox/Inbox deduplication و PostgreSQL receipt/delivery store | `packages/domain/src/backoffice-event-envelope.mjs` و `packages/adapters/src/postgresql-backoffice-foundation-store.mjs` |
| BO-019 | Portfolio و Project Overview rebuildable | `packages/domain/src/backoffice-read-models.mjs` |
| BO-020 | تست contract، secret safety، duplicate/replay، conflict و digest | `tests/backoffice-data-foundation.test.mjs` و `tests/postgresql-backoffice-foundation.test.mjs` |

## وضعیت آزمون

در `2026-09-10`، full check در Linux container مرجع با فرمان `npm check` (همان زنجیرهٔ `package.json`؛ image فاقد باینری pnpm بود و Corepack نیز به‌دلیل key verification نتوانست pnpm را فعال کند) با نتیجهٔ واقعی زیر اجرا شد:

- Governance، deployment، parity، roadmap، owner handoff، Notion preflight و هر دو checker بک‌آفیس: `PASS`؛
- Documentation: `110 documents`, `2 products`, `0 errors`؛
- Build: `180 modules` و `17 JSON files`؛
- Tests: `281 pass`, `0 fail`, `0 skipped`؛
- Clean-room scan: `335 files`؛
- هیچ Production، Pilot، Secret، external spend، external message یا Notion write اجرا نشد.

## محدودیت این Evidence

این بسته foundation قرارداد و persistence boundary را می‌سازد؛ API مدیریتی، IAM کامل، UI، Scheduler، اتصال Server، Deploy و Pilot در گام‌های بعدی‌اند و از این Evidence قابل برداشت نیستند.
