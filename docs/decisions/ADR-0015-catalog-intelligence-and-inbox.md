# ADR-0015 — Catalog Intelligence، Token Ledger و Notification Inbox

> Document ID: `HERO-ADR-0015`
> Canonical path: `docs/decisions/ADR-0015-catalog-intelligence-and-inbox.md`
> Title: ADR-0015 — Catalog Intelligence، Token Ledger و Notification Inbox
> Type: decision
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## تصمیم

Catalog، desired و observed metadata را جدا نگه می‌دارد. اختلاف فقط Drift Proposal با overwrite ممنوع تولید می‌کند. GitHub fetch در این مرحله فعال نیست. Catalog به owner/team/document/run/artifact/health با internal reference متصل می‌شود و dependency graph برای blast radius قابل پرسش است.

هر Usage Event دارای input/cached/output/total token و scopeهای Project/Team/Role/Task/Run/Model است. Token Ledger فقط مصرف Token را حساب می‌کند؛ هزینهٔ بیرونی Provider یا Cloud وارد این بخش نمی‌شود. Soft threshold هشدار و Hard cap `pause-required` تولید می‌کند. Health و Scorecard فرمول نسخه‌دار، evidence، confidence و freshness دارند؛ دادهٔ ناکافی unknown است و Critical Override وضعیت را critical می‌کند.

Notification فقط در Back Office نگهداری می‌شود. deduplication، severity، lifecycle، action و correlation دارد. Audit و Trace project-scoped، classified و redacted هستند و Secret-shaped fieldها ذخیره نمی‌شوند. Export یا کانال خارجی نیازمند Policy و مجوز جداست.
