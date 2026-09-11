# Baseline و Gap Register بک‌آفیس — BO-001 تا BO-010

> Document ID: `HERO-EVIDENCE-BACKOFFICE-BASELINE-BO-001-010`
> Canonical path: `docs/roadmap/BACKOFFICE-BASELINE-BO-001-010.md`
> Title: Baseline و Gap Register بک‌آفیس — BO-001 تا BO-010
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.1
> Owner: hero-architecture
> Review cadence: none
> Supersedes: none
> Superseded by: none

> یادداشت تفسیر: این سند Evidence تاریخی همان Batch است. وضعیت جاری تحویل و تفاوت میان artifact coverage و verified delivery در `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911` ثبت شده و برای گزارش فعلی مقدم است.

## ۱. دامنه و نتیجه

این Evidence نتیجهٔ اجرای بستهٔ مبنای `BO-001..BO-010` از برنامهٔ `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1` نسخهٔ `1.0.0` است. این بسته هیچ پایلوت، اتصال بیرونی، تغییر Secret، هزینه، Production، عملیات مخرب یا Notion write انجام نداده است.

نتیجهٔ ممیزی:

- Specification فعال: `HERO-SPEC-022@1.0.0`؛
- برنامهٔ فعال: `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1@1.0.0`؛
- Authorization: `BATCH-BACKOFFICE-20260910-001`؛
- Global Stop ثبت‌شده برای این Batch: `false`؛
- تعداد الزام‌های ردیابی‌شده: `81`؛
- وضعیت baseline: `5 implemented`، `43 partial` و `33 missing`؛
- تعداد گام‌های برنامه: `170` در `15` Work Package؛
- نتیجهٔ کنترل اختصاصی baseline: `PASS`؛
- تست fail-closed اختصاصی: `2 passed / 0 failed`؛
- کنترل کامل پروژه: `PASS`؛ build موفق و `274 passed / 0 failed`.

نتیجهٔ تصمیم: شروع مستقیم پایلوت مناسب نیست. پایه‌های فعلی قابل استفاده‌اند، اما Portfolio چندپروژه‌ای، ProjectGrant، Intake، تنظیمات مؤثر، Conversation، Notification، Server Agent، Production privacy و Delivery Bundle هنوز کامل نیستند.

## ۲. BO-001 — تثبیت Baseline و Authorization

تصویب مالک در `HERO-SPEC-022` ثبت و وضعیت سند `active` شده است. سند تاریخی `HERO-ARCH-BACKOFFICE` به `superseded` تغییر کرده تا تعریف قدیمی «نمای مشاهده‌ای با کنترل محدود» با هدف جدید «Control Plane جامع» رقابت نکند.

Authorization جدید فقط این محدوده را مجاز می‌کند:

| فیلد | مقدار |
|---|---|
| Authorization ID | `BATCH-BACKOFFICE-20260910-001` |
| Stepها | `BO-001..BO-010` |
| نسخهٔ دو سند مرجع | `1.0.0` |
| عملیات | design، document، version، develop، test، review |
| Global Stop | false |
| عملیات خارج از اختیار | Production، destructive، external spend، Secret، external message، irreversible، pilot و Notion write |

کنترل ماشینی `tools/check-backoffice-baseline.mjs` تطبیق دقیق Scope، نسخه، وضعیت، Global Stop و ممنوعیت عملیات حساس را بررسی می‌کند.

## ۳. BO-002 — Capability Inventory وضع موجود

### ۳.۱ سطح ارائه و API

| قابلیت موجود | وضعیت واقعی | مسیر Evidence |
|---|---|---|
| Back Office | Projection نسخهٔ 1.1 با شش نمای کاری و mutationهای محدود | `apps/control-plane/src/backoffice-view.mjs` |
| Product Studio | نمایش Product/Document catalog، roadmap و completeness؛ بدون project context کامل | `apps/control-plane/src/product-studio-view.mjs` |
| HTTP Control Plane | یک Node HTTP server با routeهای عمومی، Back Office و API | `apps/control-plane/src/server.mjs` |
| Dashboard aggregate | سرویس نسبتاً بزرگ که Registryها و فرمان‌های موجود را یک‌جا می‌سازد | `apps/control-plane/src/dashboard-service.mjs` |
| Read-only route audit | 58 نمونهٔ route عمومی/محافظت‌شده/dynamic در تست جاری | `tests/read-only-route-audit.test.mjs` |
| Back Office tests | Projection، rate limit، redaction، AI catalog، memory و planner | `tests/backoffice.test.mjs` |

### ۳.۲ هویت و اختیار

| قابلیت موجود | وضعیت واقعی | شکاف هدف |
|---|---|---|
| Owner bearer session | امضاشده، انقضادار و قابل revoke | حساب email/password، MFA و recovery کامل نیست |
| Admin bearer session | جدا از Owner و fail-closed | ProjectGrant ندارد و عمداً به mutationهای محدود AI/Team محدود است |
| Basic Auth بک‌آفیس | اختیاری برای مرز سادهٔ same-host/reverse proxy | جایگزین Identity/MFA نیست و باید پس از migration بازنشسته شود |
| Authorization Engine | exact Step/version/operation، revoke و Global Stop | باید به همهٔ Commandهای Back Office و project scope تعمیم یابد |
| Viewer | وجود ندارد | باید Role و ProjectGrant فقط‌خواندنی ساخته شود |

### ۳.۳ دامنه و اجرای هوشمند

| قابلیت موجود | وضعیت واقعی | شکاف هدف |
|---|---|---|
| Team Registry | 11 تیم پایدار، قرارداد، training، research، assignment و history | بیشتر global است و باید project-aware/Policy-aware شود |
| AI Orchestration | Provider، Model، Profile، Role binding، invocation، cost unit و evaluation | Conversation context، project policy و Token Ledger کامل نیست |
| Project Memory | project/task scope، latest version، role filtering و supersede | Hero/Team/Role scope، disable و Knowledge Proposal ندارد |
| Planner | plan/task graph، readiness و capacity conflict | Project Foundation کامل و weighted scheduler ندارد |
| Workflow/Runner | state machine، pause/resume، retry، idempotency و checkpoint | هنوز موتور مشترک همهٔ Commandهای بک‌آفیس نیست |
| Quality/Assurance | gateهای deterministic و evidence-first | باید به Requirement Trace جدید وصل شود |
| Performance | score پنج‌بعدی برای هر 11 Team | Goal Fit و Token Efficiency و drill-down تا Run کامل نیست |
| Advisor | recommendation و roadmap پیشنهادی | بهبود مستمر Project و اجرای policy-controlled کامل نیست |

### ۳.۴ داده، سند، عملیات و تحویل

| قابلیت موجود | وضعیت واقعی | شکاف هدف |
|---|---|---|
| Event Log | append-only، version-aware و duplicate-safe | coverage موجودیت‌های آینده باید تکمیل شود |
| PostgreSQL | 8 migration و Storeهای operational OperationalLevel | برخی Registryها هنوز in-memory هستند |
| Product/Document Catalog | Git canonical، دو Product، Notion projection/proposal | Project Registry عملیاتی و System Catalog کامل نیست |
| Observability | correlation context، redacted event projection و diagnostics | trace سرتاسری Conversation تا Deployment ندارد |
| Release | exact tested candidate و Production gate | Artifact registry، attestation و Admin final acceptance کامل نیست |
| Portability | deterministic readiness gate برای source/runtime/backup/restore | انتقال واقعی project-scoped و Delivery Bundle کامل نیست |
| Notion | adapter، mapping، conflict و external-write gates | این دو سند هنوز مجوز sync بیرونی ندارند |
| Server management | وجود ندارد | Server Registry و Hero Node Agent باید ساخته شوند |
| Private file storage | وجود ندارد | upload امن، scan و object storage لازم است |
| Notification Inbox | وجود ندارد | aggregate، severity، deadline، dedupe و action لازم است |

## ۴. BO-003 — Requirement Trace Registry

منبع ماشینی Trace در `config/backoffice/requirement-trace-v1.0.json` قرار دارد. برای هر Requirement این موارد اجباری‌اند:

- شناسهٔ دقیق موجود در `HERO-SPEC-022`؛
- وضعیت یکی از `implemented / partial / missing`؛
- Work Package مقصد؛
- Evidence موجود؛
- Gap صریح.

نتیجهٔ baseline:

| وضعیت | تعداد | معنی |
|---|---:|---|
| implemented | 5 | قرارداد اصلی وجود دارد؛ در Work Package مقصد فقط یکپارچگی/عدم regression بررسی می‌شود |
| partial | 43 | پایه وجود دارد ولی Requirement کامل را اثبات نمی‌کند |
| missing | 33 | قابلیت هدف هنوز پیاده‌سازی نشده است |
| جمع | 81 | پوشش دقیق تمام الزام‌های Specification |

`tools/check-backoffice-baseline.mjs` هر Requirement حذف‌شده، تکراری یا ناشناخته را fail می‌کند. Evidence path ناموجود، وضعیت نامعتبر و Work Package خارج از `WP-00..WP-14` نیز رد می‌شوند.

## ۵. BO-004 — تصمیم Keep / Extend / Migrate / Retire

| تصمیم | اجزا | قاعده |
|---|---|---|
| Keep | Event Log، Authorization Engine، Workflow/Runner، Team Registry، AI Orchestration، redaction، Release و Portability gates | قراردادهای آزموده‌شده حفظ و به‌جای بازنویسی کور توسعه داده شوند |
| Extend | Product Development Catalog، Project Memory، Planner capacity، diagnostics، PostgreSQL stores | project scope، persistence و requirement trace اضافه شود |
| Migrate | Dashboard service/view، Owner/Admin auth، static roadmap projection و global configuration | به ماژول‌های Portfolio/Project/IAM/Policy با compatibility window منتقل شوند |
| Retire after replacement | Basic Auth به‌عنوان auth اصلی، Admin mutation allowlist قدیمی، hero-only route assumptions و Back Office projection 1.1 | حذف فقط پس از migration، regression test و ثبت replacement انجام شود |
| Never reuse as target | Pilot dry-run و Product Pilot UI برای اثبات Back Office | پایلوت نباید جای تست چندپروژه‌ای Control Plane را بگیرد |

## ۶. BO-005 — Threat Model اولیه

| Threat | اثر | کنترل اجباری | تست مقصد |
|---|---|---|---|
| IDOR و نشت cross-project | افشای سند، Memory، Run یا Secret پروژهٔ دیگر | ProjectGrant روی API/DB/cache/storage/queue/runner | negative matrix سه Role در WP-02 و WP-14 |
| privilege escalation ادمین | مدیریت کاربر، Project دیگر یا Reveal Secret | Owner-only system operations و step-up | admin/viewer abuse test |
| command/prompt injection | تبدیل محتوای فایل/وب به فرمان | تفکیک data از instruction، tool policy و approval | adversarial intake/conversation tests |
| command smuggling | اجرای high-risk به‌عنوان low-risk | Risk taxonomy و Intent ساختاریافته | policy and preview bypass tests |
| stale/replayed authorization | اجرای فرمان منقضی یا دوباره | exact version، expiry، revocation و idempotency | replay/crash/resume tests |
| Secret exposure | افشا در UI، log، prompt یا export | Secret reference، redaction، Owner step-up | secret scan و response audit |
| فایل مخرب | malware، ZIP bomb، parser exploit یا SSRF | type/signature/size، scan، sandbox و egress deny | malicious corpus tests |
| Node Agent compromise | اجرای فرمان یا دسترسی سرور دیگر | outbound identity، mTLS/rotation، signed command و project scope | impersonation/replay/offline tests |
| Production data leakage | ورود PII به AI/Memory | telemetry allowlist و break-glass جدا | payload-to-AI bypass test |
| Event/Audit tampering | حذف مسئولیت‌پذیری | append-only store، digest و restricted retention | mutation/rebuild mismatch tests |
| Artifact substitution | استقرار کد آزمون‌نشده | commit/tag/digest/provenance binding | tampered artifact/wrong commit tests |
| denial by alert/task storm | اشباع Queue، UI یا Token | quota، rate limit، dedupe و weighted fairness | load/alert-storm tests |
| model degradation | پاسخ نادرست یا پرهزینه | evaluation، circuit، Proposal تعویض و Owner approval | regression/judge-drift tests |
| Notion/export exfiltration | خروج سند محدودشده | classification، allowlist و external gate | restricted sync/export tests |
| retention failure | حذف زودهنگام Evidence یا نگهداری بیش‌ازحد PII | minimum policy، hold، dry-run cleanup و audit | time/hold/deletion tests |

## ۷. BO-006 — Baseline فنی

Baseline پیش از افزودن کنترل اختصاصی این بسته:

| شاخص | مقدار واقعی |
|---|---:|
| test case | 272 |
| test file | 54 |
| PostgreSQL migration | 8 |
| خطوط فایل‌های `.mjs` و `.sql` در apps/packages/tools/tests | 30,756 |
| فایل‌های UI اصلی Control Plane | 3 view + server + dashboard service |
| سند ثبت‌شده پس از تصویب Specification/Plan | 107 |
| Product ثبت‌شده | 2 |

Baseline کارکردی از تست‌های موجود و کنترل کامل موفق turn قبل گرفته شده است. پس از این Batch، دو تست اختصاصی baseline و یک checker به suite افزوده شده‌اند؛ نتیجهٔ کامل جدید در بخش ۱۲ ثبت می‌شود.

## ۸. BO-007 — راهبرد مهاجرت

مهاجرت Strangler و افزایشی است:

1. contract/schema جدید کنار مسیر قدیمی ساخته می‌شود؛
2. eventهای جدید با project/correlation/version کامل ثبت می‌شوند؛
3. read model جدید از event canonical بازسازی می‌شود؛
4. UI جدید ابتدا read-only و سپس از Command API واقعی فعال می‌شود؛
5. برای دورهٔ محدود، route قدیمی به adapter سازگاری متصل می‌ماند؛
6. digest، authorization و regression دو مسیر مقایسه می‌شوند؛
7. فقط پس از Evidence و replacement map، مسیر قدیمی retired می‌شود.

ممنوعیت‌ها:

- Big Bang rewrite؛
- database mutation مستقیم از UI؛
- dual source of truth؛
- Copy داده میان Back Office و Product Studio؛
- حذف route/schema پیش از compatibility evidence؛
- migration همراه با پایلوت یا Production deployment.

## ۹. BO-008 — Test Matrix

| سطح تست | پوشش اجباری | Requirementهای غالب |
|---|---|---|
| contract/unit | validator، state transition، precedence، formula و redaction | GOV، CFG، CMD، WF، HLT |
| persistence | migration، append-only، outbox، rebuild و optimistic concurrency | GOV، DAT، OUT |
| authorization | سه Role، ProjectGrant، step-up، revoke، stop و IDOR | IAM، SEC |
| integration | API تا domain/store/event/audit و UI تا API واقعی | همهٔ گروه‌ها |
| isolation | دو Project با داده/حافظه/تنظیم/runner متفاوت | PRJ، IAM، MEM، INF |
| failure/recovery | crash، retry، timeout، duplicate، offline agent و rollback | WF، INF، OUT |
| AI safety/eval | prompt injection، model drift، token cap و judge calibration | AI، CMD، COST، PERF |
| file security | MIME mismatch، malware، ZIP bomb، traversal و SSRF | PRJ، SEC، DAT |
| observability | correlation completeness، sensitive log و stale projection | GOV، HLT، NTF |
| performance | Portfolio pagination، queue fairness، trace volume و rate limit | PRJ، WF، UX |
| UX/accessibility | فارسی/انگلیسی، RTL/LTR، keyboard، focus و status | UX |
| portability | exact artifact، clean target، backup/restore و server move | OUT، INF |

تست جدید `tests/backoffice-baseline.test.mjs` دو رفتار را ثابت می‌کند:

1. پوشش دقیق 81 Requirement، ترتیب 170 Step و وجود 15 Work Package؛
2. fail-closed شدن در حذف Trace، گسترش Step و افزودن Production operation به Authorization.

## ۱۰. BO-009 — Authorization Batchهای پیشنهادی آینده

این جدول Proposal است و هیچ Batch زیر هنوز مجاز نیست:

| Batch پیشنهادی | Step range | شرط آغاز |
|---|---|---|
| `BACKOFFICE-DATA-001` | BO-011..BO-020 | پذیرش Exit این سند |
| `BACKOFFICE-IAM-001` | BO-021..BO-030 | قرارداد Data/Event موفق |
| `BACKOFFICE-PROJECT-001` | BO-031..BO-042 | ProjectGrant و auth tests موفق |
| `BACKOFFICE-POLICY-001` | BO-043..BO-052 | Project Registry پایدار |
| `BACKOFFICE-PORTFOLIO-001` | BO-053..BO-062 | Effective Settings موفق |
| `BACKOFFICE-CONTEXT-001` | BO-063..BO-074 | Project-aware UI foundation موفق |
| `BACKOFFICE-COMMAND-001` | BO-075..BO-088 | Conversation/Memory isolation موفق |
| `BACKOFFICE-CATALOG-001` | BO-089..BO-098 | Command/Workflow gate موفق |
| `BACKOFFICE-INTELLIGENCE-001` | BO-099..BO-120 | Catalog و Workflow شواهد کافی دارند |
| `BACKOFFICE-INFRA-001` | BO-121..BO-134 | Threat model به‌روزشده و مجوز جدا |
| `BACKOFFICE-DELIVERY-001` | BO-135..BO-146 | Test infrastructure آماده؛ Production واقعی خارج Scope |
| `BACKOFFICE-HARDENING-001` | BO-147..BO-156 | Delivery روی target تمیز Test موفق |
| `BACKOFFICE-FINAL-001` | BO-157..BO-170 | همهٔ Exit Gateها و regression موفق |

هر Snapshot باید فقط Step range همان ردیف و نسخهٔ فعال دو سند مرجع را بگیرد. مجوز Batch قبلی به Batch بعدی سرایت نمی‌کند.

## ۱۱. BO-010 — Exit Report

| Step | وضعیت | Evidence |
|---|---|---|
| BO-001 | completed | Specification/Plan فعال، supersession و Authorization جدید |
| BO-002 | completed | Capability Inventory بخش ۳ |
| BO-003 | completed | `config/backoffice/requirement-trace-v1.0.json` و checker |
| BO-004 | completed | ماتریس Keep/Extend/Migrate/Retire بخش ۵ |
| BO-005 | completed | Threat Model بخش ۶ |
| BO-006 | completed | Baseline فنی بخش ۷ |
| BO-007 | completed | Migration Strategy بخش ۸ |
| BO-008 | completed | Test Matrix و تست fail-closed بخش ۹ |
| BO-009 | completed | Batch proposal بخش ۱۰؛ هیچ مجوز آینده‌ای ایجاد نشده |
| BO-010 | completed | کنترل کامل، build و 274 تست موفق؛ نتیجهٔ واقعی در بخش ۱۲ |

Exit Gate بستهٔ WP-00 با موفقیت کنترل کامل و نبود خطای مستندات بسته شد.

## ۱۲. شواهد کنترل

نتیجهٔ هدفمند ثبت‌شده در `2026-09-10`:

```text
Back Office baseline: PASS — 81 requirements, 170 steps, 15 work packages
Coverage baseline — implemented=5, partial=43, missing=33
Authorization — BATCH-BACKOFFICE-20260910-001, BO-001..BO-010,
Global Stop off, sensitive operations excluded
Tests — 2 passed, 0 failed
```

نتیجهٔ کنترل کامل ثبت‌شده در `2026-09-10`:

```text
Clean-room: PASS — 324 files scanned
Governance: PASS — sensitive actions separately gated
Back Office baseline: PASS
Documentation: PASS — 108 documents, 2 products, 0 errors
Build: PASS — 173 modules and 16 JSON files validated
Tests: 274 passed, 0 failed, 0 skipped
```

هشدار غیرمسدودکننده: Docker CLI داخل کانتینر آزمون در دسترس نبود؛ خود suite در کانتینر مرجع Hero اجرا شد و هیچ اتصال بیرونی یا عملیات محیطی انجام نداد.
