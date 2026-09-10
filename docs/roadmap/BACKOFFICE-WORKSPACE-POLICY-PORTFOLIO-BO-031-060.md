# Evidence اجرای Project Workspace، Policy و Portfolio بک‌آفیس — BO-031 تا BO-060

> Document ID: `HERO-EVIDENCE-BACKOFFICE-WORKSPACE-POLICY-PORTFOLIO-BO-031-060`
> Canonical path: `docs/roadmap/BACKOFFICE-WORKSPACE-POLICY-PORTFOLIO-BO-031-060.md`
> Title: Evidence اجرای Project Workspace، Policy و Portfolio بک‌آفیس — BO-031 تا BO-060
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: none
> Supersedes: none
> Superseded by: none

## مجوز و مرز

این Evidence گام‌های `BO-031..BO-060` را در سه Snapshot محدود `BATCH-BACKOFFICE-20260910-004`، `005` و `006` ثبت می‌کند. Global Stop در همهٔ Snapshotها `false` است. Production، Pilot، تغییر/Reveal Secret، حذف داده، هزینه یا پیام بیرونی، Notion write، GitHub request، fetch URL و deploy خارج Scope هستند.

## خروجی‌ها

| بازه | خروجی قابل آزمون |
|---|---|
| BO-031..033 | Project lifecycle، Owner-only create/archive و deletion request بدون حذف تاریخچه |
| BO-034..040 | Intake، Private Input metadata/object key/checksum، signature/scanner/parser boundary، کنترل injection/ZIP/SSRF، Foundation Proposal و approval/revision |
| BO-041..042 | GitHub read-only adoption plan و Clone با exclusion اجباری Secret/data/memory/history |
| BO-043..047 | schema چهارلایهٔ Settings، resolver قطعی، version/diff/actor/reason/impact/rollback، query provenance و commandهای override/rollback |
| BO-048..050 | template/risk Policy Pack، پیشنهاد هنگام Intake و invariantهای غیرقابل‌تضعیف |
| BO-051..052 | API-backed Settings view و تست precedence، stale version، rollback و invariant bypass |
| BO-053..060 | Information Architecture، Desktop Portfolio Shell، project-aware navigation، Grant-filtered Portfolio، Card، Product Studio deep-link، Overview و KPI drill-down contract |

## مرزهای عمدی

- object bytes فقط در object-storage adapter آینده قرار می‌گیرند؛ این batch object key و metadata امن را پیاده می‌کند.
- scanner/parser واقعی و GitHub fetch عمداً injection point هستند، نه عملیات خودکار؛ نبود Adapter یعنی defer/reject، نه عبور بی‌صدا.
- Portfolio HTML فقط API-backed Read Model می‌خواند و برای mutation endpoint مستقل project-scoped دارد.
- persistence SQL/schema و metadata store افزوده شده است، اما این نسخه به Test یا Production deploy نشده است.

## نتیجهٔ آزمون

در `2026-09-10`، زنجیرهٔ کامل `check` در Linux container مرجع اجرا شد:

- Back Office baseline، foundation، identity و workspace checker: `PASS`؛
- Documentation: `114 documents`، `2 products` و `0 errors`؛
- Build: `197 modules` و `21 JSON files`؛
- Tests: `292 passed`، `0 failed` و `0 skipped`؛
- Clean-room scan: `362 files`؛
- هیچ Test deploy، Pilot، Production، Secret reveal/change، external spend/message، Notion write، GitHub fetch یا URL fetch اجرا نشد.

image مرجع باینری `pnpm` ندارد؛ بنابراین همان زنجیرهٔ تعریف‌شده در `package.json` با `npm run check` اجرا شده است. این Evidence صرفاً صحت source را ثبت می‌کند و مجوز هیچ محیط یا عملیات خارجی نیست.
