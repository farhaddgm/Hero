# فهرست مرکزی مستندات Hero

- Document ID: `HERO-DOC-INDEX`
- Version: `1.1.0`
- Status: `active`
- Owner: `hero-documentation`
- Scope: `hero`

## مراجع اصلی

1. [مدل محیط و انتشار Hero و محصولات](architecture/ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL.md) — `HERO-ARCH-ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL`، `active`
2. [حاکمیت کتابخانهٔ مستندات](governance/DOCUMENTATION-GOVERNANCE.md) — `HERO-GOV-DOCUMENTATION-GOVERNANCE`، `active`
3. [Document registry](registry/document-registry.json) — رجیستری یکتای مسیر، شناسه، نسخه و وضعیت
4. [Product registry](registry/product-registry.json) — رجیستری ارجاعی Hero و Productهای ساخته‌شده با آن

Git repository منبع حقیقت است. Notion و Confluence فقط mirror خواندنی اختیاری‌اند. سندی که در Document registry ثبت نشده باشد canonical نیست.

قراردادهای جدید سیستم توسعهٔ محصول در [ADR-0010](decisions/ADR-0010-product-development-source-of-truth.md)، [Roadmap Graph و Completeness](specs/ROADMAP-GRAPH-COMPLETENESS-v1.0.md)، [Notion Workspace Schema](specs/NOTION-WORKSPACE-SCHEMA-v1.0.md) و [Notion Sync Contract](specs/NOTION-SYNC-CONTRACT-v1.0.md) ثبت شده‌اند.

## مسیر استفاده

### مسیر خود Hero

از مدل محیط، اصول حیاتی، معماری، ADRها و مشخصات Hero شروع کنید؛ سپس Runbook و Evidence همان محیط را بخوانید. Hero Test و Hero Production چرخهٔ مستقل دارند و Production فقط همان Artifact تأییدشدهٔ Test را دریافت می‌کند.

### مسیر Product

Product ابتدا با owner و Evidence در Product registry ثبت می‌شود. سند Product فقط acceptance criteria، configuration غیرمحرمانه، Evidence و تصمیم اختصاصی را نگه می‌دارد و برای قواعد مشترک به Document ID و version کتابخانه ارجاع می‌دهد. CRM موجود در مدل محیط صرفاً مثال معماری است.

## Product Pilot فعلی

| Product ID | وضعیت | اسناد اختصاصی |
|---|---|---|
| `HERO-PRODUCT-VPN-PILOT-001` | `proposed` | [Product Brief](products/vpn-pilot/PRODUCT-BRIEF.md)، [Test Environment](products/vpn-pilot/TEST-ENVIRONMENT.md)، [Release Policy](products/vpn-pilot/RELEASE-POLICY.md) |
| `HERO-PRODUCT-HERO-001` | `active` | [Product Brief](products/hero/PRODUCT-BRIEF.md)، [Test Environment](products/hero/TEST-ENVIRONMENT.md)، [Release Policy](products/hero/RELEASE-POLICY.md) |

این Product هنوز به Production نرفته است. مقصد Test، شبکه‌های آزمون، سقف هزینهٔ زیرساخت و تأیید مالک باید جداگانه ثبت شوند.

## معماری و مدل محیط

| Document ID | وضعیت | سند |
|---|---|---|
| `HERO-ARCH-AI-ORCHESTRATION` | `active` | [معماری یکپارچهٔ Multi-AI در Hero](architecture/AI_ORCHESTRATION.md) |
| `HERO-ARCH-ASSURANCE-GATE` | `active` | [Assurance Gate](architecture/ASSURANCE_GATE.md) |
| `HERO-ARCH-AUTHORIZATION-ENGINE` | `active` | [Hero authorization engine](architecture/AUTHORIZATION_ENGINE.md) |
| `HERO-ARCH-BACKOFFICE` | `active` | [بک‌آفیس توسعهٔ Hero](architecture/BACKOFFICE.md) |
| `HERO-ARCH-CRITICAL-PRINCIPLES` | `active` | [اصول حیاتی Hero و محصولات](architecture/CRITICAL_PRINCIPLES.md) |
| `HERO-ARCH-DATA-MODEL` | `active` | [Hero operational data model](architecture/DATA_MODEL.md) |
| `HERO-ARCH-ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL` | `active` | [مدل محیط و انتشار Hero و محصولات](architecture/ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL.md) |
| `HERO-ARCH-ISOLATED-RUNNER` | `active` | [Isolated runner boundary](architecture/ISOLATED_RUNNER.md) |
| `HERO-ARCH-MOBILE-FACTORY` | `active` | [Mobile Factory](architecture/MOBILE_FACTORY.md) |
| `HERO-ARCH-OVERVIEW` | `active` | [Hero architecture overview](architecture/OVERVIEW.md) |
| `HERO-ARCH-PORTABILITY` | `active` | [Portability architecture](architecture/PORTABILITY.md) |
| `HERO-ARCH-PRODUCT-DEVELOPMENT-KNOWLEDGE-SYSTEM` | `active` | [معماری سامانه یکپارچه توسعه محصول و دانش Hero](architecture/PRODUCT-DEVELOPMENT-KNOWLEDGE-SYSTEM.md) |
| `HERO-ARCH-QUALITY-GATE` | `active` | [Quality Gate](architecture/QUALITY_GATE.md) |
| `HERO-ARCH-RELEASE-FLOW` | `active` | [فلو نسخه‌گذاری و انتشار Hero](architecture/RELEASE_FLOW.md) |
| `HERO-ARCH-TEAM-OPERATING-MODEL` | `active` | [مدل عملیاتی تیم‌های Hero](architecture/TEAM_OPERATING_MODEL.md) |
| `HERO-ARCH-TEAM-PRINCIPLES-DEFAULTS` | `active` | [اصول پیش‌فرض تیم‌ها](architecture/TEAM_PRINCIPLES_DEFAULTS.md) |
| `HERO-ARCH-TEAM-RESEARCH-AND-OUTPUT-DECISION` | `active` | [تحقیق تیمی و تصمیم خروجی محصول](architecture/TEAM_RESEARCH_AND_OUTPUT_DECISION.md) |
| `HERO-ARCH-WEB-FACTORY` | `active` | [Web Factory](architecture/WEB_FACTORY.md) |
| `HERO-ARCH-WORKFLOW-ENGINE` | `active` | [Hero workflow engine](architecture/WORKFLOW_ENGINE.md) |

## حاکمیت و تصمیم‌ها

| Document ID | وضعیت | سند |
|---|---|---|
| `HERO-ADR-0001` | `active` | [ADR-0001 — Clean-room repository boundary](decisions/ADR-0001-clean-room-boundary.md) |
| `HERO-ADR-0002` | `active` | [ADR-0002 — Modular monolith and adapter ports](decisions/ADR-0002-modular-monolith-and-adapter-ports.md) |
| `HERO-ADR-0003` | `active` | [ADR-0003 — Append-only Event Log and PostgreSQL Outbox](decisions/ADR-0003-append-only-event-log-and-postgresql.md) |
| `HERO-ADR-0004` | `active` | [ADR-0004 — explicit Run State Machine over append-only events](decisions/ADR-0004-explicit-run-state-machine.md) |
| `HERO-ADR-0005` | `active` | [ADR-0005 — version-bound authorization and Global Stop](decisions/ADR-0005-version-bound-authorization-and-global-stop.md) |
| `HERO-ADR-0006` | `active` | [ADR-0006 — Isolated Runner and checkpoint-before-cleanup](decisions/ADR-0006-isolated-runner-checkpoint-before-cleanup.md) |
| `HERO-ADR-0007` | `active` | [ADR-0007 — تیم به‌عنوان واحد عملیاتیِ قابل‌کنترل](decisions/ADR-0007-team-as-governed-operating-unit.md) |
| `HERO-ADR-0008` | `proposed` | [ADR-0008 — اصول حیاتی و Promotion از test به production](decisions/ADR-0008-critical-principles-and-test-production-promotion.md) |
| `HERO-ADR-0009` | `active` | [ADR-0009 — Multi-AI orchestration inside Hero](decisions/ADR-0009-multi-ai-orchestration-in-hero.md) |
| `HERO-GOV-AUTHORITY` | `active` | [سیاست اختیار و توقف](governance/AUTHORITY.md) |
| `HERO-GOV-CHANGE-CONTROL` | `active` | [کنترل تغییر](governance/CHANGE_CONTROL.md) |
| `HERO-GOV-DEFINITION-OF-DONE` | `active` | [تعریف Done](governance/DEFINITION_OF_DONE.md) |
| `HERO-GOV-DOCUMENTATION-GOVERNANCE` | `active` | [حاکمیت کتابخانهٔ مستندات Hero](governance/DOCUMENTATION-GOVERNANCE.md) |
| `HERO-GOV-PROJECT-CHARTER` | `active` | [منشور پروژه Hero](governance/PROJECT_CHARTER.md) |

## Runbookها و عملیات

| Document ID | وضعیت | سند |
|---|---|---|
| `HERO-OPS-DOCUMENTATION-LIBRARY-HANDOFF` | `active` | [سند تحویل: کتابخانهٔ مرجع اسناد و اصول توسعهٔ Hero](architecture/DOCUMENTATION-LIBRARY-HANDOFF.md) |
| `HERO-OPS-BACKOFFICE-SUBDOMAIN` | `active` | [انتشار امن Back Office روی زیردامنه](operations/BACKOFFICE-SUBDOMAIN.md) |
| `HERO-OPS-CLEAN-LINUX-RECOVERY` | `active` | [بازیابی Hero روی Clean Linux](operations/CLEAN-LINUX-RECOVERY.md) |
| `HERO-OPS-EXTERNAL-SPEND-AUTHORIZATION` | `active` | [راهنمای Provider واقعی و مجوز هزینه](operations/EXTERNAL-SPEND-AUTHORIZATION.md) |
| `HERO-OPS-GITHUB-RELEASE-AUTOMATION` | `active` | [خودکارسازی نسخه و تحویل Hero در GitHub](operations/GITHUB-RELEASE-AUTOMATION.md) |
| `HERO-OPS-HERO-TEST-ENVIRONMENT` | `active` | [محیط Test برای خود Hero](operations/HERO-TEST-ENVIRONMENT.md) |
| `HERO-OPS-MOVE-TO-ANOTHER-SERVER` | `active` | [Moving Hero to another server](operations/MOVE-TO-ANOTHER-SERVER.md) |
| `HERO-OPS-NOTION-SETUP` | `active` | [راهنمای راه‌اندازی Notion برای Hero](operations/NOTION-SETUP.md) |
| `HERO-OPS-NOTION-SYNC-RUNBOOK` | `active` | [Runbook همگام‌سازی کنترل‌شدهٔ Notion](operations/NOTION-SYNC-RUNBOOK.md) |
| `HERO-OPS-NOTION-BULK-SYNC-PLAN` | `proposed` | [برنامهٔ همگام‌سازی انبوه Notion](operations/NOTION-BULK-SYNC-PLAN.md) |
| `HERO-OPS-PRODUCT-DEVELOPMENT-PILOT` | `proposed` | [برنامهٔ پایلوت سیستم توسعهٔ محصول Hero](operations/PRODUCT-DEVELOPMENT-PILOT.md) |
| `HERO-OPS-OPERATIONAL-DIAGNOSTICS` | `active` | [تشخیص سلامت عملیاتی Hero](operations/OPERATIONAL-DIAGNOSTICS.md) |
| `HERO-OPS-OWNER-ACTIONS-NEXT-20260909` | `active` | [پیام کامل برای مالک و ادمین سرور Hero](operations/OWNER-ACTIONS-NEXT-20260909.md) |
| `HERO-OPS-OWNER-ACTIONS-PENDING-20260904` | `active` | [کارهای لازم از طرف مالک و ادمین — وضعیت ۲۰۲۶-۰۹-۰۵](operations/OWNER-ACTIONS-PENDING-20260904.md) |
| `HERO-OPS-OWNER-ACTIONS-SIMPLE` | `active` | [کارهای باقی‌ماندهٔ مالک — نسخهٔ خیلی ساده](operations/OWNER-ACTIONS-SIMPLE.md) |
| `HERO-OPS-PILOT-READINESS` | `active` | [آمادگی اجرای HERO-021](operations/PILOT-READINESS.md) |
| `HERO-OPS-PILOT-REQUEST-20260910` | `active` | [درخواست پیشنهادی پایلوت Hero — HERO-PILOT-001](operations/PILOT-REQUEST-20260910.md) |
| `HERO-OPS-REMOTE-HANDOFF` | `active` | [Hero — Remote Project Handoff](operations/REMOTE-HANDOFF.md) |
| `HERO-OPS-SECRET-MANAGEMENT` | `active` | [مدیریت امن Secretها](operations/SECRET-MANAGEMENT.md) |

## مشخصات نسخه‌دار

| Document ID | وضعیت | سند |
|---|---|---|
| `HERO-SPEC-001` | `active` | [HERO-001 v1.0 — منشور پروژه و حاکمیت](specs/HERO-001-v1.0.md) |
| `HERO-SPEC-002` | `active` | [HERO-002 v1.0 — طراحی تجربه کاربر ساده](specs/HERO-002-v1.0.md) |
| `HERO-SPEC-003` | `active` | [HERO-003 v1.0 — معماری کلان و انتخاب فناوری](specs/HERO-003-v1.0.md) |
| `HERO-SPEC-004` | `active` | [HERO-004 v1.0 — پایه مستقل و قابل‌انتقال](specs/HERO-004-v1.0.md) |
| `HERO-SPEC-005` | `active` | [HERO-005 v1.0 — مدل داده، قراردادها و Event Log](specs/HERO-005-v1.0.md) |
| `HERO-SPEC-006` | `active` | [HERO-006 v1.0 — موتور گردش کار و State Machine](specs/HERO-006-v1.0.md) |
| `HERO-SPEC-007` | `active` | [HERO-007 v1.0 — موتور تأیید، Snapshot اختیار کامل و توقف اضطراری](specs/HERO-007-v1.0.md) |
| `HERO-SPEC-008` | `active` | [HERO-008 v1.0 — Runner ایزوله و Git Worktree](specs/HERO-008-v1.0.md) |
| `HERO-SPEC-009` | `active` | [HERO-009 v1.0 — Fake Agent و آزمایش قطعی](specs/HERO-009-v1.0.md) |
| `HERO-SPEC-010` | `active` | [HERO-010 v1.0 — داشبورد کنترل اولیه](specs/HERO-010-v1.0.md) |
| `HERO-SPEC-011` | `active` | [HERO-011 v1.0 — اتصال Codex و ChatGPT](specs/HERO-011-v1.0.md) |
| `HERO-SPEC-012` | `active` | [HERO-012 v1.0 — اتصال Claude](specs/HERO-012-v1.0.md) |
| `HERO-SPEC-013` | `active` | [HERO-013 v1.0 — اتصال و بسته تحویل Cursor](specs/HERO-013-v1.0.md) |
| `HERO-SPEC-014` | `active` | [HERO-014 v1.0 — حافظه و Context مشترک پروژه](specs/HERO-014-v1.0.md) |
| `HERO-SPEC-015` | `active` | [HERO-015 v1.0 — Planner، Task Graph و Router هوشمند](specs/HERO-015-v1.0.md) |
| `HERO-SPEC-016` | `active` | [HERO-016 v1.0 — حلقه تست، بازبینی و اصلاح](specs/HERO-016-v1.0.md) |
| `HERO-SPEC-017` | `active` | [HERO-017 v1.0 — کارخانه توسعه اپلیکیشن وب](specs/HERO-017-v1.0.md) |
| `HERO-SPEC-018` | `active` | [HERO-018 v1.0 — کارخانه توسعه اپلیکیشن موبایل](specs/HERO-018-v1.0.md) |
| `HERO-SPEC-019` | `active` | [HERO-019 v1.0 — امنیت، CI، مشاهده‌پذیری و کنترل هزینه](specs/HERO-019-v1.0.md) |
| `HERO-SPEC-020` | `active` | [HERO-020 v1.0 — انتقال‌پذیری، Backup و بازیابی](specs/HERO-020-v1.0.md) |
| `HERO-SPEC-021` | `active` | [HERO-021 v1.0 — پایلوت انتهابه‌انتها](specs/HERO-021-v1.0.md) |

## Evidence

| Document ID | وضعیت | سند |
|---|---|---|
| `HERO-OPS-ACCESS-AUDIT-20260904` | `active` | [شواهد بررسی دسترسی و محیط Test — ۲۰۲۶-۰۹-۰۴](operations/ACCESS-AUDIT-20260904.md) |
| `HERO-OPS-RECOVERY-EVIDENCE-20260830` | `active` | [Recovery evidence — 2026-08-30](operations/RECOVERY-EVIDENCE-20260830.md) |
| `HERO-ROADMAP-BASELINE-20260904` | `active` | [Baseline ممیزی Hero — ۲۰۲۶-۰۹-۰۴](roadmap/BASELINE-20260904.md) |
| `HERO-ROADMAP-CANDIDATE-EVIDENCE-20260904` | `active` | [شناسنامهٔ Candidate Hero — ۲۰۲۶-۰۹-۰۴](roadmap/CANDIDATE-EVIDENCE-20260904.md) |
| `HERO-ROADMAP-EXECUTION-20260909-100-STEPS` | `active` | [گزارش اجرای ۱۰۰ گام Hero — ۲۰۲۶-۰۹-۰۹](roadmap/EXECUTION-20260909-100-STEPS.md) |
| `HERO-ROADMAP-STATUS-20260910` | `active` | [وضعیت جاری Hero — ۲۰۲۶-۰۹-۱۰](roadmap/STATUS-20260910.md) |

## Roadmap

| Document ID | وضعیت | سند |
|---|---|---|
| `HERO-ROADMAP-CHANGELOG` | `active` | [تغییرات رودمپ شرکت](roadmap/CHANGELOG.md) |
| `HERO-ROADMAP-NEXT-10-STEPS-20260831-BATCH-2` | `active` | [بستهٔ ۱۰ گام بعدی Hero — Batch 2](roadmap/NEXT-10-STEPS-20260831-BATCH-2.md) |
| `HERO-ROADMAP-NEXT-10-STEPS-20260831` | `active` | [بستهٔ ۱۰ گام بعدی Hero](roadmap/NEXT-10-STEPS-20260831.md) |
| `HERO-ROADMAP-NEXT-10-STEPS-20260904-BATCH-3` | `active` | [ده گام بعدی Hero — بستهٔ تشخیص و کنترل عملیاتی](roadmap/NEXT-10-STEPS-20260904-BATCH-3.md) |
| `HERO-ROADMAP-NEXT-100-STEPS-20260904` | `active` | [صد گام بعدی Hero — فهرست اجرایی و وضعیت واقعی](roadmap/NEXT-100-STEPS-20260904.md) |
| `HERO-ROADMAP-NEXT-20-STEPS-20260904` | `active` | [بیست گام بعدی Hero — وضعیت اجرایی](roadmap/NEXT-20-STEPS-20260904.md) |
| `HERO-ROADMAP-OPEN-50-PRIORITY-20260904` | `active` | [پنجاه گام باز و اولویت‌دار Hero](roadmap/OPEN-50-PRIORITY-20260904.md) |
| `HERO-ROADMAP-ROADMAP-2-0-TEAM-OPERATING-MODEL` | `active` | [رودمپ ۲.۰ Hero — شرکت نرم‌افزاری چندتیمی](roadmap/ROADMAP-2.0-TEAM-OPERATING-MODEL.md) |
| `HERO-ROADMAP-FUTURE-REQUIRED-PRICING-CATALOG` | `active` | [قابلیت ضروری آینده: Pricing Catalog نسخه‌دار Hero](roadmap/FUTURE-REQUIRED-PRICING-CATALOG.md) |

## Templateها

| Document ID | وضعیت | سند |
|---|---|---|
| `HERO-TEMPLATE-ADR` | `active` | [Template: Architecture Decision Record](templates/ADR.md) |
| `HERO-TEMPLATE-CANONICAL-DOCUMENT` | `active` | [Template: سند canonical](templates/CANONICAL-DOCUMENT.md) |
| `HERO-TEMPLATE-PRODUCT-REFERENCE` | `active` | [Template: ارجاع Product به کتابخانهٔ مرکزی](templates/PRODUCT-REFERENCE.md) |
| `HERO-TEMPLATE-RUNBOOK` | `active` | [Template: Runbook عملیاتی](templates/RUNBOOK.md) |

## کنترل خودکار

`pnpm check:docs` رجیستری‌ها، یکتایی شناسه‌ها، وجود مسیرها، ثبت همهٔ Markdownها، لینک‌های داخلی، نسخه‌ها، supersession و الگوهای high-confidence Secret را بررسی می‌کند. این کنترل قبل از build و test در `pnpm check` اجرا می‌شود.
