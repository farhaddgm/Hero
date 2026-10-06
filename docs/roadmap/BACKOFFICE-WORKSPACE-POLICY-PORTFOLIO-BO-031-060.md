# Evidence اجرای Project Workspace، Policy و Portfolio بک‌آفیس — BO-031 تا BO-060

> Document ID: `HERO-EVIDENCE-BACKOFFICE-WORKSPACE-POLICY-PORTFOLIO-BO-031-060`
> Canonical path: `docs/roadmap/BACKOFFICE-WORKSPACE-POLICY-PORTFOLIO-BO-031-060.md`
> Title: Evidence اجرای Project Workspace، Policy و Portfolio بک‌آفیس — BO-031 تا BO-060
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.1.0
> Owner: hero-architecture
> Review cadence: none
> Supersedes: none
> Superseded by: none

> یادداشت تفسیر: این سند وجود پیاده‌سازی و تست داخلی Batch را ثبت می‌کند، نه بسته‌شدن کامل UI، storage و runtime Exit Gate. وضعیت جاری در `HERO-EVIDENCE-BACKOFFICE-DELIVERY-AUDIT-20260911` مقدم است.

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

## الحاق ۲۰۲۶-۰۹-۱۱ — بازگشت نسخه‌دار به Draft

ایجاد Project اکنون با `lifecycle/status=draft` انجام می‌شود. Owner می‌تواند فقط یک Project `active`، `intake` یا `foundation-review` را با `expectedVersion` و دلیل ثبت‌شده به Draft برگرداند. این mutation overwrite نیست: نسخهٔ جدید Project و Foundation پیشنهادی جدید append می‌شوند و Foundation قبلی باقی می‌ماند. endpoint آن `/api/projects/:projectId/return-to-draft` است و به authorization پروژه و Owner-only domain check متکی است. آزمون HTTP و domain این مسیر را پوشش می‌دهد.

## الحاق ۲۰۲۶-۱۰-۰۵ — تکمیل source بستهٔ WP-04 (BO-043..BO-052)

مجوز: `BATCH-BACKOFFICE-20261005-021` با نقل مستقیم دستور مالک، برای `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1@1.2.0` و `HERO-SPEC-022@1.0.0`. Snapshotهای `005/006` به نسخهٔ `1.0.0` رودمپ pin شده بودند و طبق قانون ۱۱ برای dispatch معتبر نبودند. Global Stop خاموش است. Production، Secret، هزینهٔ بیرونی، Provider زنده و نوشتن در Notion خارج Scope هستند.

| گام | خروجی source |
|---|---|
| BO-043 | schema تایپ‌دار فیلدها در contract `1.1` (مدل، `ai.roleModels.<role>`، حالت خودکارسازی، سقف Token، نوع و ریسک پروژه)؛ مسیر آزاد همچنان JSON امن است |
| BO-044 | resolver قطعی با `SETTING_SCHEMA_CONFLICT` و `POLICY_CONFLICT` به‌جای سرو کردن مقدار نامعتبر؛ hydration ردیف معیوب را crash نمی‌کند و فقط همان فیلد fail-closed می‌شود |
| BO-045 | هر نسخه diff (`added/changed/removed/unchanged`)، `supersedesVersion`، عامل، دلیل، اثر و مرجع rollback دارد؛ diff پس از restart از تاریخچه بازسازی می‌شود |
| BO-046 | query زنجیرهٔ منشأ هر فیلد (`winner/shadowed/removed/conflict/absent`) و API `GET .../settings/explain` و `GET .../settings/changes` |
| BO-047 | API `POST .../settings/remove-override`؛ حذف فقط روی لایهٔ override؛ rollback به رکورد حذف رد می‌شود و همهٔ گیت‌های نوشتن را دوباره اجرا می‌کند |
| BO-048 | الگوهای قطعی Policy Pack برای ۷ نوع × ۳ سطح ریسک با کف‌های قفل (`guardedPaths`)؛ تنظیم نوع پروژه هرگز مقدار سخت‌تر ریسک را شل نمی‌کند |
| BO-049 | پیشنهاد Intake همان الگو را با `templateId` و کف‌ها می‌سازد و پیش از تأیید در نمای Workspace نمایش داده می‌شود |
| BO-050 | کف الگو از contract خوانده می‌شود، نه از ردیف ذخیره‌شده؛ نوشتن مستقیم لایهٔ `policy-template` با `TEMPLATE_WRITE_FORBIDDEN` رد می‌شود؛ `readiness` و `assertDispatchable` نبود یا تعارض Policy را با `POLICY_INCOMPLETE` می‌بندند |
| BO-051 | بخش Settings در Workspace: مقدار مؤثر، منشأ، زنجیره، کف، آمادگی Policy، Policy Pack پیشنهادی/اعمال‌شده، تاریخچهٔ diff و دکمهٔ حذف override با دلیل اجباری؛ همه از API واقعی |
| BO-052 | `tests/project-settings-policy.test.mjs`: property test با PRNG بذرگذاری‌شده (۵ بذر × ۲۵۰ فرمان) برای precedence، inheritance، rollback، stale version، invariant bypass و برابری پس از restart؛ mutation test نشان داد حذف هر گیت دست‌کم دو تست را می‌شکند |

### دو نقص واقعی که در این batch پیدا و اصلاح شد

1. **احیای override حذف‌شده پس از restart:** store هنگام خواندن همهٔ ردیف‌ها را `active` برمی‌گرداند. اکنون وضعیت ردیف حذف از `source=override-removal` در domain مشتق می‌شود؛ بدون تغییر schema.
2. **شکست ذخیرهٔ تنظیمات متنی در PostgreSQL:** ستون `setting_value` از نوع `jsonb` است و node-postgres رشته را به‌صورت متن خام و آرایه را به‌صورت آرایهٔ PostgreSQL می‌فرستاد؛ مثلاً `project.type="application"` با `invalid input syntax for type json` رد می‌شد. اکنون مقدار همیشه با `JSON.stringify` ذخیره می‌شود؛ دادهٔ عددی/بولی/شیء موجود تغییری نمی‌کند. این نقص فقط با آزمون رفت‌وبرگشت روی PostgreSQL واقعی دیده شد، چون client جعلیِ تست هر مقداری را می‌پذیرفت.

### مرز باقی‌مانده

- `dispatch-next` در Command Center صف را بدون توجه به Project مسیر برمی‌دارد؛ اتصال گیت Policy پروژه به آن تغییر WP-07 است و در این مجوز نیست. گیت در domain و API آماده است.
- وضعیت ممیزی WP-04 همچنان `partial` است تا Candidate شامل این تغییر روی Runtime Test promote و با شواهد واقعی بررسی شود.

### نتیجهٔ آزمون — ۲۰۲۶-۱۰-۰۵

- `pnpm check` کامل: `505` تست PASS، `0` شکست، `0` skipped؛ Documentation `149` سند و `0` خطا؛ build `301` ماژول و `60` فایل JSON.
- `pnpm check:postgres` روی PostgreSQL 16 محلی PASS؛ رفت‌وبرگشت واقعی ذخیره/بازخوانی تنظیمات پس از restart: override حذف‌شده زنده نشد و readiness درست بود.
- تست `Product Studio requires a project selection` به متغیرهای Notion میزبان وابسته بود و در نشستی که این متغیرها را داشت می‌شکست؛ adapter غیرفعال صریحاً به آن تزریق شد تا مستقل از محیط باشد. هیچ تستی skip یا حذف نشد.
- هیچ Test deploy، Production، Secret، Provider زنده، هزینهٔ بیرونی یا نوشتن در Notion انجام نشد.
