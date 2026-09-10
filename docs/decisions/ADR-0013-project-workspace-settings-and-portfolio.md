# ADR-0013 — Project Workspace، Settings و Portfolio API-backed

> Document ID: `HERO-ADR-0013`
> Canonical path: `docs/decisions/ADR-0013-project-workspace-settings-and-portfolio.md`
> Title: ADR-0013 — Project Workspace، Settings و Portfolio API-backed
> Type: decision
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## تصمیم

هر محصول Hero یک Project با `project_id` پایدار و lifecycle نسخه‌دار است. ساخت، Archive و درخواست حذف فقط در اختیار Owner هستند؛ حذف در این مرحله هرگز داده یا تاریخچه را پاک نمی‌کند و تنها `deletion-request` ایجاد می‌شود. Admin دارای Grant می‌تواند Intake، ورودی، Foundation Proposal، Import plan و Setting همان Project را مدیریت کند؛ Viewer فقط می‌خواند.

ورودی‌ها در object key خصوصیِ project-scoped ثبت می‌شوند و metadata شامل checksum، حجم، signature/type، scan و parser state دارد. بایت فایل، Secret و credential در Event، read model، PostgreSQL JSON یا response عمومی قرار نمی‌گیرد. کنترل ورودی fail-closed است: signature نامعتبر، scanner غیرپاک، ZIP bomb، URL داخلی/credentialدار و متن دارای الگوی instruction غیرقابل‌اعتماد رد یا برای review ایزوله می‌شود.

Import GitHub در این نسخه یک Plan read-only است: هیچ fetch خارجی، commit، refactor، تغییر Secret یا deploy انجام نمی‌دهد. Clone فقط ساختار و Intake/Policy قابل‌انتقال را می‌گیرد؛ Secret، دادهٔ Production، Memory، Session، uploads و private history صریحاً حذف می‌شوند.

Settings با چهار لایهٔ `hero-invariant`، `policy-template`، `project-override` و `run-override` resolve می‌شوند. provenance، version، actor، reason، impact و rollback reference ثبت می‌شوند. invariantهای جداسازی Project، retention Audit و Secret-reference-only تضعیف‌پذیر نیستند و conflict/missing policy fail-closed است.

Portfolio و Project Studio تنها از Read Model/API-backed data استفاده می‌کنند. Card دارای roadmap، health، token، task و output است؛ دادهٔ ناموجود صریحاً `unknown`/`not recorded` نشان داده می‌شود، نه aggregate ساختگی.

## پیامدها

این تصمیم زیرساخت object storage، malware engine، parser، GitHub client یا deployment واقعی را فعال نمی‌کند؛ آن‌ها Adapterهای جدا و مجوزهای جدا می‌خواهند. PostgreSQL migration و metadata store مرز durable را آماده می‌کنند، ولی deploy/runtime persistence و migration واقعی محیط Test خارج از این batch است.
