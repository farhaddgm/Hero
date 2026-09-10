# سند تحویل: کتابخانهٔ مرجع اسناد و اصول توسعهٔ Hero

- وضعیت: تصمیم مورد توافق مالک و آمادهٔ ادامهٔ پیاده‌سازی
- نسخهٔ handoff: 1.0.0
- تاریخ: 2026-09-10
- مقصد: پروژهٔ بعدی Codex با دسترسی کامل به سرور و مخزن
- مخزن: /opt/hero

## ۱. هدف این سند

این سند نقطهٔ تحویل کار است. Agent بعدی باید از همین وضعیت ادامه دهد و کتابخانهٔ اسناد پروژه را در خود مخزن بسازد؛ به‌گونه‌ای که:

1. مخزن منبع حقیقت اسناد و اصول توسعه باشد؛
2. اسناد مشترک برای هر پروژه کپی نشوند؛
3. هر سند مرجع، شناسه، مالک، وضعیت و نسخهٔ مشخص داشته باشد؛
4. اسناد قدیمی، تصمیم‌ها و اصول رقیب یا متناقض ایجاد نشوند؛
5. CI سند ثبت‌نشده، شناسهٔ تکراری، لینک شکسته و مرجع رقیب را پیدا کند؛
6. Notion یا Confluence در صورت نیاز فقط نمای خواندنی/همگام‌شده باشند، نه منبع اصلی.

این سند، «قرارداد ادامهٔ کار» است؛ آن را به‌عنوان درخواست جدید یا ایدهٔ اختیاری تلقی نکنید.

## ۲. تصمیم اصلی معماری محیط‌ها

### ۲.۱. خود پلتفرم Hero

خود Hero دو استقرار مستقل دارد:

    Hero Test → Hero Production

قابلیت جدید Hero ابتدا در Hero Test مستقر، تست و مستندسازی می‌شود. بعد از Evidence واقعی، تأیید مالک، مجوز مستقل Production و فرمان صریح، همان Artifact به Hero Production promote می‌شود.

Hero Production نباید از نو build شود. نسخه، commit SHA و Artifact ID باید در هر دو مرحله یکسان باشند. دیتابیس، داده، Secret، volume، network، دامنه، session و credential آن‌ها باید مستقل بمانند.

### ۲.۲. محصولات ساخته‌شده یا مدیریت‌شده با Hero

هر محصول، مانند CRM، چرخهٔ مستقل خود را دارد:

    CRM Test → CRM Production

CRM Test می‌تواند از طریق Hero Production تعریف و مدیریت شود، زیرا Hero Production کنترل‌پلین پایدار سازمان است. اما این به معنای اجرای CRM Test در دیتابیس، volume، network، Secret یا runtime مشترک با Hero Production نیست.

مدل صحیح:

    Hero Production
      ├── CRM Test
      └── CRM Production

CRM Test و CRM Production هرکدام محیط اجرایی، داده، Secret، دامنه، backup و rollback مستقل دارند. بعد از تأیید، همان Artifact تست‌شده به CRM Production منتقل می‌شود؛ نباید Production از صفر و با build متفاوت ساخته شود.

### ۲.۳. وقتی محصول به قابلیت آزمایشی Hero نیاز دارد

اگر CRM به قابلیت جدیدی نیاز داشته باشد که فقط در Hero Test وجود دارد، باید integration test ایزوله بین CRM Test و Hero Test اجرا شود. Hero Production نباید برای آزمایش محصول به نسخهٔ آزمایشی تبدیل شود.

ترتیب لازم:

    Hero Test → Hero Production
    سپس CRM Test → CRM Production

## ۳. اصل کتابخانهٔ اسناد

    Git repository = Source of Truth
    Notion/Confluence = Mirror یا رابط خواندنی اختیاری

اسناد مشترک مانند اصول توسعه، معماری، امنیت، release flow، authorization و environment model فقط یک نسخهٔ canonical دارند. سند پروژه فقط باید به canonical document ID و version ارجاع دهد؛ متن آن را کپی نکند.

تغییر در سند canonical باید با commit، review، افزایش نسخه و ثبت پیامد انجام شود. ویرایش متن کپی‌شده در پروژه‌ها مجاز نیست.

## ۴. ساختار هدف کتابخانه

ساختار هدف را بدون جابه‌جایی غیرضروری اسناد موجود بسازید:

    docs/
      INDEX.md
      architecture/
        ... اسناد معماری موجود ...
        ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL.md
      decisions/
        ... ADRهای موجود ...
      governance/
        ... اسناد حاکمیت موجود ...
        DOCUMENTATION-GOVERNANCE.md
      operations/
        ... runbookها و evidenceهای موجود ...
      specs/
        ... مشخصات نسخه‌دار موجود ...
      registry/
        document-registry.json
        product-registry.json
      templates/
        CANONICAL-DOCUMENT.md
        PRODUCT-REFERENCE.md
        ADR.md
        RUNBOOK.md

    tools/
      check-documentation.mjs

    tests/
      documentation.test.mjs

مکان دقیق می‌تواند با ساختار فعلی تطبیق داده شود، اما اصل «یک فهرست مرکزی + رجیستری یکتا + validator» نباید حذف شود.

## ۵. اجزای الزامی برای پیاده‌سازی

### ۵.۱. فهرست مرکزی

فایل docs/INDEX.md باید:

- لینک canonical به همهٔ دسته‌ها بدهد؛
- سندهای اصولی و الزام‌آور را از evidence و roadmap جدا کند؛
- مسیر Hero و مسیر Product را جدا توضیح دهد؛
- برای هر سند به document ID و وضعیت آن اشاره کند؛
- لینک سند environment model و documentation governance را در ابتدای فهرست قرار دهد.

### ۵.۲. سند حاکمیت مستندات

فایل docs/governance/DOCUMENTATION-GOVERNANCE.md باید حداقل این قواعد را الزام کند:

- هر سند normative فقط یک canonical path دارد؛
- هر سند یک document ID یکتا، owner، status، version، scope و review cadence دارد؛
- اصل مشترک نباید در پروژه‌ها copy شود؛ فقط reference شود؛
- سند project-specific فقط برای acceptance criteria، configuration، evidence و تصمیم اختصاصی مجاز است؛
- سندهای obsolete باید superseded-by داشته باشند، نه اینکه حذف بی‌تاریخچه شوند؛
- تغییر سند الزام‌آور نیازمند commit و review است؛
- Notion و Confluence منبع حقیقت نیستند؛
- Secret، password، token و connection string در اسناد ممنوع است؛
- سندی که در registry نیست، canonical محسوب نمی‌شود؛
- لینک شکسته و document ID تکراری خطای CI است.

### ۵.۳. رجیستری اسناد

فایل docs/registry/document-registry.json باید برای هر سند حداقل این داده‌ها را ثبت کند:

    id
    path
    title
    type
    scope
    status
    version
    owner
    canonical
    supersedes
    review_cadence

مقادیر پیشنهادی type:

- architecture
- decision
- governance
- operation
- specification
- evidence
- roadmap
- template
- index

مقادیر پیشنهادی scope:

- hero
- product
- cross-project

مقادیر پیشنهادی status:

- active
- proposed
- superseded
- archived

برای اسناد فعلی، registry را با مسیر واقعی موجود پر کنید. اسناد موجود را فقط برای رجیسترکردن جابه‌جا یا بازنویسی نکنید.

### ۵.۴. رجیستری محصولات

فایل docs/registry/product-registry.json باید محصولات را به اسناد canonical ارجاع دهد، نه اینکه اصول را دوباره بنویسد. برای هر Product حداقل این موارد را ثبت کنید:

    product_id
    name
    owner
    status
    hero_control_plane
    test_environment_reference
    production_environment_reference
    inherited_document_ids
    product_specific_document_ids
    release_policy

در حال حاضر اگر محصولی ثبت نشده است، registry خالی ولی معتبر با schema مشخص بسازید. CRM فقط مثال معماری است و نباید به‌عنوان محصول واقعی ادعا شود مگر evidence یا ثبت مالک وجود داشته باشد.

### ۵.۵. Templateها

Templateها باید metadata و ارجاع را استاندارد کنند. حداقل templateهای canonical، Product Reference، ADR و Runbook را بسازید. هیچ templateای نباید Secret یا مقدار runtime واقعی داشته باشد.

### ۵.۶. کنترل خودکار

فایل tools/check-documentation.mjs و تست مرتبط باید:

1. معتبر بودن JSONهای registry را بررسی کند؛
2. یکتا بودن document ID و product_id را بررسی کند؛
3. وجود pathهای ثبت‌شده را بررسی کند؛
4. ثبت‌بودن همهٔ فایل‌های markdown داخل docs را enforce کند، با استثنای صریح فایل‌های legacy که در migration manifest ثبت شده‌اند؛
5. canonical بودن بیش از یک مسیر برای یک ID را رد کند؛
6. لینک‌های داخلی relative به فایل‌های موجود را بررسی کند؛
7. وجود Secret الگوهای رایج را رد کند؛
8. اسناد superseded را به سند جایگزین وصل کند؛
9. type، scope، status و version معتبر را enforce کند؛
10. خروجی خطا را شامل path و document ID دقیق کند.

اسکریپت را به package.json با نام check:docs اضافه کنید و آن را داخل check اصلی قبل از build و test اجرا کنید.

## ۶. فایل‌های مرتبطی که باید بررسی و به فهرست وصل شوند

اسناد فعلی مهم:

- docs/architecture/OVERVIEW.md
- docs/architecture/RELEASE_FLOW.md
- docs/architecture/CRITICAL_PRINCIPLES.md
- docs/operations/HERO-TEST-ENVIRONMENT.md
- docs/operations/SECRET-MANAGEMENT.md
- docs/decisions/ADR-0008-critical-principles-and-test-production-promotion.md
- README.md

در README و OVERVIEW فقط لینک و خلاصهٔ کوتاه اضافه کنید. متن کامل را در سند canonical نگه دارید تا دوباره‌نویسی ایجاد نشود.

سند environment model مورد نیاز:

    docs/architecture/ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL.md

این سند باید توضیح دهد:

- تفاوت Hero Test و Hero Production؛
- تفاوت Product Test و Product Production؛
- مدیریت Product Test از طریق Hero Production؛
- تفاوت Control Plane با runtime؛
- یکسان‌بودن Artifact و مستقل‌بودن داده و Secret؛
- شرایط وابستگی Product به Hero Test؛
- گیت‌های promotion و ممنوعیت build متفاوت؛
- مثال کامل CRM.

## ۷. وضعیت فعلی مخزن و ملاحظات مهم

مخزن /opt/hero تغییرهای درحال‌کار زیادی دارد. آن‌ها متعلق به کاربر هستند و نباید reset، checkout، پاک یا overwrite شوند.

پیش از هر تغییر:

    git -c safe.directory=/opt/hero status --short

تغییرهای جدید باید فقط در فایل‌های مربوط به این کار انجام شوند. از تغییر دادن فایل‌های نامرتبط خودداری کنید.

در handoff قبلی، سند environment model و کتابخانهٔ کامل هنوز ایجاد نشده بودند. اگر فایل هم‌نامی پیدا شد، ابتدا آن را بخوانید و فقط تکمیل versioned انجام دهید؛ overwrite کورکورانه ممنوع است.

## ۸. ترتیب اجرای کار در اتصال دارای دسترسی کامل

1. به /opt/hero بروید و وضعیت Git را ثبت کنید.
2. دسترسی نوشتن واقعی کاربر فعلی و وجود pnpm/node را بررسی کنید.
3. ساختار docs فعلی و package.json را بخوانید.
4. سند environment model را ایجاد یا تکمیل کنید.
5. docs/INDEX.md و documentation governance را ایجاد کنید.
6. document registry را برای همهٔ اسناد فعلی بسازید.
7. product registry را با schema خالی و توضیح روشن ایجاد کنید.
8. templateهای canonical را اضافه کنید.
9. validator و test آن را بنویسید.
10. package.json را با check:docs به‌روزرسانی کنید.
11. README، OVERVIEW و RELEASE_FLOW را فقط با لینک canonical به‌روزرسانی کنید.
12. ابتدا pnpm check:docs را اجرا کنید.
13. سپس pnpm check را اجرا کنید.
14. نتیجهٔ واقعی را در پاسخ handoff ثبت کنید؛ موفقیت را بدون خروجی واقعی ادعا نکنید.

ویرایش فایل‌ها باید با apply_patch انجام شود. فایل runtime، Secret، .env واقعی و deployment Production را تغییر ندهید.

## ۹. معیارهای پذیرش

کار زمانی کامل است که:

- یک فهرست مرکزی قابل‌خواندن در docs/INDEX.md وجود داشته باشد؛
- governance سند واحد و مرجعیت Git را الزام کند؛
- همهٔ اسناد فعلی در registry باشند یا در migration manifest استثنای ثبت‌شده داشته باشند؛
- document ID تکراری ممکن نباشد؛
- لینک‌های داخلی خراب باعث شکست check:docs شوند؛
- سند رقیب یا copy شده برای اصول مشترک در مسیر Product ایجاد نشود؛
- Product registry به canonical document IDها ارجاع دهد؛
- check:docs در check اصلی اجرا شود؛
- pnpm check با نتیجهٔ واقعی اجرا شده باشد؛
- هیچ Secret یا credential در تغییرها وجود نداشته باشد؛
- وضعیت Git و فایل‌های نامرتبط حفظ شده باشند.

## ۱۰. کارهایی که انجام نشود

- اسناد موجود را برای زیبایی به مسیر جدید منتقل نکنید؛
- متن اصول را برای هر Product کپی نکنید؛
- Notion یا Confluence را منبع حقیقت نکنید؛
- CRM یا Product واقعی را بدون ثبت مالک و evidence در registry ادعا نکنید؛
- Hero Production را برای تست قابلیت منتشرنشده تغییر ندهید؛
- deployment واقعی، DNS، TLS، firewall، Secret یا external spend را فعال نکنید؛
- pnpm check را با تغییر نتیجه یا حذف تست‌ها سبز نکنید؛
- git reset --hard، git checkout -- یا حذف تغییرهای موجود اجرا نکنید.

## ۱۱. خروجی مورد انتظار از Agent بعدی

در پایان، پاسخ باید شامل این موارد باشد:

1. فهرست فایل‌های ایجاد یا اصلاح‌شده با مسیر مطلق؛
2. خلاصهٔ قواعد مرجعیت و عدم کپی‌سازی؛
3. نتیجهٔ check:docs؛
4. نتیجهٔ pnpm check؛
5. هر blocker واقعی، بدون ادعای تکمیل صوری؛
6. اعلام اینکه هیچ Production deploy یا Secret change انجام نشده است.
