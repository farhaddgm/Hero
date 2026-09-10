# ADR-0014 — Collaboration، Command Center و System Catalog

> Document ID: `HERO-ADR-0014`
> Canonical path: `docs/decisions/ADR-0014-collaboration-command-center-and-system-catalog.md`
> Title: ADR-0014 — Collaboration، Command Center و System Catalog
> Type: decision
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## تصمیم

گفت‌وگو در پنج Context ثابت `hero`، `project`، `team`، `role` و `entity` ایجاد می‌شود و هر Thread تنها یک `project_id` دارد. Team assignment، Role/Specialist profile، model binding و retention نیز project-scoped هستند. هیچ Provider واقعی با این قابلیت فعال نمی‌شود.

حافظه چهارسطحی `project`، `team`، `role` و `specialist` است و برای هر رکورد provenance داخلی، confidence، sensitivity، expiry و lifecycle دارد. تغییر حافظه تنها با supersede/correction/disable انجام می‌شود؛ Viewer محتوای restricted را نمی‌بیند. انتقال دانش بین پروژه‌ها فقط با Knowledge Proposal sanitizeشده و پذیرش صریح مقصد ممکن است.

هر فرمان به Command Intent ساختاریافته با risk، correlation و idempotency تبدیل می‌شود. high/critical همیشه Approval می‌خواهند؛ direct execution تنها برای low-risk و Policy صریح امکان queue دارد. Dispatch در این نسخه Run محلی/بدون side effect می‌سازد؛ Global Stop، expiry و lock پیش از Dispatch بررسی می‌شوند. Production preauthorization تنها یک record محدود است و هرگز deploy grant نیست.

System Catalog شامل Project/Application/Component/Service/Repository/API/Data/Environment/Server و dependency project-scoped است. Git canonical باقی می‌ماند و Notion فقط projection/proposal است.
