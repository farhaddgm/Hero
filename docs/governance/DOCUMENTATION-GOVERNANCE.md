# حاکمیت کتابخانهٔ مستندات Hero

- Document ID: `HERO-GOV-DOCUMENTATION-GOVERNANCE`
- Version: `1.0.0`
- Status: `active`
- Owner: `hero-governance`
- Scope: `cross-project`

## مرجعیت

Git repository منبع حقیقت مستندات Hero است. Notion و Confluence فقط می‌توانند mirror خواندنی یا رابط همگام‌شده باشند و هیچ تصمیم، نسخه یا تأییدی صرفاً با تغییر آن‌ها معتبر نمی‌شود.

`docs/registry/document-registry.json` رجیستری یکتای سندها و `docs/INDEX.md` نقطهٔ ورود انسانی کتابخانه است. سندی که در رجیستری نیست canonical محسوب نمی‌شود.

## قرارداد هر سند

هر سند ثبت‌شده باید این metadata را در رجیستری داشته باشد:

- `id`: شناسهٔ پایدار و یکتا؛
- `path`: تنها مسیر canonical؛
- `title`: عنوان انسانی؛
- `type`: نوع مجاز سند؛
- `scope`: `hero`، `product` یا `cross-project`؛
- `status`: `active`، `proposed`، `superseded` یا `archived`؛
- `version`: SemVer؛
- `owner`: نقش پاسخ‌گو؛
- `canonical`: مقدار boolean؛
- `supersedes`: شناسه‌های نسخه/اسناد جایگزین‌شده؛
- `superseded_by`: شناسهٔ جایگزین برای سند superseded؛
- `review_cadence`: تناوب بازبینی.

Document ID با rename فایل تغییر نمی‌کند. تغییر معنایی سند normative نیازمند افزایش version، commit، review و ثبت پیامد است. اصلاح نگارشی بدون تغییر معنا می‌تواند patch version باشد؛ تغییر الزام یا boundary حداقل minor version می‌خواهد و تغییر ناسازگار major version است.

## یک مرجع، بدون کپی

هر اصل، سیاست، مدل معماری یا release rule فقط یک canonical path دارد. سند Product یا Runbook نباید متن اصل مشترک را کپی کند؛ باید Document ID، version و لینک canonical را ثبت کند.

سند project-specific فقط برای این موارد مجاز است:

- acceptance criteria همان Product؛
- configuration غیرمحرمانهٔ همان محیط؛
- Evidence واقعی و شناسهٔ Artifact؛
- تصمیم اختصاصی ثبت‌شده؛
- runbook، backup و rollback همان Product.

اگر Product به تغییر اصل عمومی نیاز دارد، canonical document تغییر و versioned review می‌شود؛ copy محلی راه اصلاح نیست.

## چرخهٔ وضعیت

- `proposed`: هنوز الزام‌آور نیست و نیازمند review مالک است؛
- `active`: مرجع جاری و قابل استناد است؛
- `superseded`: مرجع جاری نیست و باید `superseded_by` معتبر داشته باشد؛
- `archived`: سابقه یا Evidence تاریخی است و نباید به‌عنوان سیاست جاری استفاده شود.

سند obsolete بدون تاریخچه حذف نمی‌شود. ابتدا جایگزین canonical ثبت می‌شود، سند قدیمی `superseded` و `superseded_by` آن مشخص می‌شود، سپس لینک‌ها و Product referenceها migration می‌شوند.

## تغییر و Review

تغییر سند normative باید در یک commit قابل ردیابی انجام شود و review آن scope، نسخه، لینک‌ها، سازگاری با اسناد canonical و پیامد Productها را بررسی کند. تغییر هم‌زمان کد و سند باید Evidence واقعی همان commit را ارجاع دهد.

هیچ Sheet، ticket یا mirror بیرونی جای commit و review را نمی‌گیرد. roadmap و Evidence نمی‌توانند قاعده‌ای رقیب با architecture/governance active ایجاد کنند؛ در صورت تعارض، کار متوقف و سند canonical اصلاح یا ADR جدید ثبت می‌شود.

## امنیت محتوا

Secret، password، token، API key، private key، connection string دارای credential و مقدار runtime واقعی در تمام اسناد، templateها، registryها و Evidence ممنوع است. فقط نام متغیر، placeholder صریح و reference امن مجاز است.

## Registry محصول

`docs/registry/product-registry.json` فقط Productهای دارای owner و Evidence را ثبت می‌کند. هر Product به Document IDهای inherited و product-specific ارجاع می‌دهد. مثال معماری، از جمله CRM، Product ثبت‌شده نیست.

## کنترل CI

`pnpm check:docs` حداقل این خطاها را fail می‌کند:

- JSON نامعتبر یا schema ناقص؛
- Document ID یا Product ID تکراری؛
- path ثبت‌شدهٔ مفقود یا تکراری؛
- Markdown ثبت‌نشده؛
- بیش از یک canonical path برای یک ID؛
- لینک داخلی شکسته یا خارج از repository؛
- الگوی high-confidence Secret؛
- status/type/scope/version نامعتبر؛
- سند superseded بدون جایگزین معتبر؛
- reference محصول به Document ID ناشناخته.

استثنای legacy فقط با migration manifest نسخه‌دار، owner، دلیل و مهلت رفع مجاز است. وضعیت فعلی کتابخانه استثنای legacy ندارد و تمام فایل‌های Markdown باید رجیستر باشند.

## تناوب بازبینی

مقادیر مجاز `review_cadence` عبارت‌اند از `per-change`، `per-release`، `monthly`، `quarterly`، `annual`، `event-driven` و `none`. مقدار `none` فقط برای Evidence تاریخی یا template بدون الزام زمانی مناسب است.
