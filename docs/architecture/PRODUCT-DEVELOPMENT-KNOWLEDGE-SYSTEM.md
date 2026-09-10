# معماری سامانه یکپارچه توسعه محصول و دانش Hero

- Document ID: `HERO-ARCH-PRODUCT-DEVELOPMENT-KNOWLEDGE-SYSTEM`
- Version: `1.0.0`
- Status: `active`
- Owner: `hero-architecture`
- Scope: `cross-project`
- Review cadence: `quarterly`

## ۱. تصمیم معماری

Hero باید یک «سیستم‌عامل توسعه محصول» داشته باشد که هم توسعهٔ خود Hero و هم توسعهٔ هر محصول ساخته‌شده با Hero را پوشش دهد. راه‌حل انتخاب‌شده یک معماری سه‌لایه است:

```text
Git repositories
  منبع حقیقت اسناد، نسخه‌ها، کد و شواهد فایل‌محور
          |
          v
Hero Product Development & Knowledge Core
  Product Catalog + Roadmap Graph + Document Catalog
  Change Proposals + Completeness Gates + Search + Audit
          |
          +-------------------------+
          |                         |
          v                         v
Hero Product Studio           Notion Workspace
نمای اصلی و پایدار داخل Hero   نمای انسانی و ویرایش کنترل‌شده
```

Notion در این معماری «جای Git» یا «پایگاه دادهٔ عملیاتی Hero» نیست. Notion یک Experience Adapter قابل‌تعویض است: اسناد و وضعیت‌های مجاز را نمایش می‌دهد و برای محتوای مجاز امکان ویرایش دارد، اما هر ویرایش ابتدا یک `Document Change Proposal` می‌سازد. فقط تغییر پذیرفته‌شده، بررسی‌شده و mergeشده در Git به نسخهٔ رسمی تبدیل می‌شود.

این تصمیم نیاز «همهٔ اسناد در مخزن باشند و در Notion قابل مشاهده و ویرایش باشند» را بدون ایجاد دو منبع حقیقت برآورده می‌کند:

1. مشاهده در Notion می‌تواند کامل و مرتب باشد؛
2. ویرایش در Notion ممکن است، اما تا عبور از جریان بررسی فقط پیش‌نویس است؛
3. Git تاریخچه، نسخه، review و قابلیت بازیابی رسمی را نگه می‌دارد؛
4. Hero روابط میان محصول، رودمپ، سند، تصمیم، Evidence، Release و Task را می‌فهمد؛
5. نبود یا قطع Notion، توسعه و دسترسی به اسناد canonical را متوقف نمی‌کند؛
6. هیچ ویرایش Notion به‌تنهایی مجوز Dispatch، هزینه، Secret، انتشار یا عملیات برگشت‌ناپذیر ایجاد نمی‌کند.

پیاده‌سازی اتصال زنده، ایجاد حساب یا Workspace، خرید پلن، ثبت Secret، انتشار webhook و ارسال محتوای مخزن به سرویس بیرونی در دامنهٔ این سند نیست و هرکدام مجوز جداگانه می‌خواهند.

## ۲. مسئله و نتیجهٔ مورد انتظار

### ۲.۱. مسئله

Hero اکنون اسناد معماری، حاکمیت، عملیات، مشخصات، محصول و رودمپ را در Git نگه می‌دارد و رجیستری نسخه‌دار دارد. این پایه از نظر مرجعیت قوی است، اما برای استفادهٔ روزمرهٔ مالک و مدیریت توسعه محصول چند خلأ دارد:

- رودمپ در چند سند و projection پخش است و هنوز یک مدل واحد Strategy-to-Execution ندارد؛
- فهرست اسناد وجود دارد، اما تجربهٔ مرور، فیلتر، ارتباط و وضعیت کامل‌بودن هر محصول یکپارچه نیست؛
- Hero هنوز خودش را به‌عنوان یک Product درجه‌اول در Product Catalog مدیریت نمی‌کند؛
- Product Registry فعلی برای یک پایلوت مناسب است، اما قرارداد چندمخزنی، lifecycle، sensitivity، sync و completeness ندارد؛
- Back Office فعلی roadmap را نشان می‌دهد، ولی ویرایش مستقیم roadmap را عمداً ندارد؛
- Project Memory برای Context حداقلی Agent است، نه کتابخانهٔ کامل اسناد؛
- اتصال Notion، نگاشت Pageها، تشخیص تعارض و جریان بازگشت ویرایش به Git وجود ندارد؛
- تشخیص خودکار سند مفقود، سند stale، تصمیم بدون Evidence، Task یتیم و roadmap بدون معیار موفقیت وجود ندارد.

### ۲.۲. نتیجهٔ نهایی

مالک باید بتواند با زبان و نمای ساده این پرسش‌ها را پاسخ دهد:

- Hero و هر محصول دقیقاً چرا ساخته می‌شود و هدف فعلی چیست؟
- اکنون در کدام مرحله هستیم، چه چیزی انجام شده و Evidence آن کجاست؟
- چه چیزهایی باقی مانده، اولویت و وابستگی آن‌ها چیست و چه چیزی مانع ادامه است؟
- برای عبور به مرحلهٔ بعد چه سند، تصمیم، تست یا مجوزی کم است؟
- آخرین نسخهٔ معتبر هر سند کدام است و چه کسی مسئول آن است؟
- کدام تصمیم‌ها هنوز پیشنهادی‌اند و کدام تصمیم‌ها رسمی شده‌اند؟
- تغییر Notion با کدام commit یا PR به Git رسیده است؟
- هر Agent بر اساس کدام نسخه از اسناد کار کرده است؟
- هر محصول چه اسناد اختصاصی دارد و کدام قواعد را از Hero به ارث می‌برد؟
- آیا اطلاعات نمایش‌داده‌شده تازه، کامل، قابل استناد و مجاز برای همان مخاطب است؟

## ۳. دامنهٔ سامانه

سامانه چهار مسئلهٔ مرتبط را حل می‌کند:

1. **مدیریت توسعهٔ خود Hero:** Hero به‌عنوان یک Product دارای Strategy، Roadmap، Specs، Architecture، Releases، Operations و Learning است.
2. **مدیریت Portfolio محصولات:** تمام محصولاتی که Hero می‌سازد یا مدیریت می‌کند، در Product Catalog ثبت می‌شوند.
3. **کتابخانهٔ اسناد هر محصول:** هر Product اسناد اختصاصی خود را در مخزن خودش نگه می‌دارد و قواعد مشترک را با شناسه و نسخه از Hero به ارث می‌برد.
4. **تجربهٔ یکپارچه:** Hero Product Studio نمای معتبر داخل اپلیکیشن و Notion نمای مشارکتی و قابل‌ویرایشِ کنترل‌شده است.

سامانه ابزار مدیریت فایل ساده نیست. باید Strategy، Discovery، Planning، Delivery، Quality، Release، Operation و Learning را به یک زنجیرهٔ قابل ممیزی متصل کند.

## ۴. مبانی موجود در Hero

این معماری بر قابلیت‌های موجود بنا می‌شود و آن‌ها را تکرار نمی‌کند:

| قابلیت موجود | مرجع فعلی | نحوهٔ استفاده در معماری جدید |
|---|---|---|
| مرجعیت Git و Document Registry | [DOCUMENTATION-GOVERNANCE.md](../governance/DOCUMENTATION-GOVERNANCE.md) | منبع حقیقت اسناد باقی می‌ماند |
| فهرست انسانی اسناد | [INDEX.md](../INDEX.md) | ورودی اولیهٔ Document Catalog و navigation |
| Product Registry | [product-registry.json](../registry/product-registry.json) | به Product Manifest و Catalog چندمخزنی ارتقا می‌یابد |
| Event Log و projection | [DATA_MODEL.md](DATA_MODEL.md) | وضعیت‌های عملیاتی و sync به‌صورت append-only ثبت می‌شوند |
| Project Memory | [HERO-014-v1.0.md](../specs/HERO-014-v1.0.md) | فقط Context حداقلی و نسخه‌دار Agentها؛ نه مخزن کامل سند |
| Planner و Task Graph | [HERO-015-v1.0.md](../specs/HERO-015-v1.0.md) | Initiative و requirement را به اجرای قابل توضیح وصل می‌کند |
| Back Office | [BACKOFFICE.md](BACKOFFICE.md) | به Product Studio و نماهای محصول/دانش گسترش می‌یابد |
| Release و Evidence | [RELEASE_FLOW.md](RELEASE_FLOW.md) | roadmap progress و readiness فقط از Evidence معتبر مشتق می‌شود |
| محیط Hero و Product | [ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL.md](ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL.md) | self-development و Productها همچنان محیط‌های مستقل دارند |

در زمان تدوین baseline، کنترل مستندات ۹۱ سند و صفر خطا را گزارش کرده بود؛ اکنون Catalog همین مجموعه را به‌همراه اسناد Product Studio و Notion Setup، در مجموع ۹۶ سند، index می‌کند. این مجموعه باید از Git وارد Catalog شود، نه اینکه در Notion از نو ساخته شود. [STATUS-20260910.md](../roadmap/STATUS-20260910.md)

## ۵. یافته‌های بنچ‌مارک

### ۵.۱. Notion

Notion برای تجربهٔ انسانی، wiki، database، table، board، timeline، dashboard، task، sprint و dependency مناسب است. این قابلیت‌ها آن را برای نمای مالک و همکاری روی Strategy، Roadmap، Initiative و اسناد قابل‌فهم می‌کند.[^1]

اتصال داخلی GitHub در Notion عمدتاً PR، Issue، code preview و ارتباط Task با PR را پوشش می‌دهد؛ Synced Databaseهای رسمی نیز داده را یک‌طرفه از ابزار مبدأ می‌آورند و برای GitHub روی PR و Issue تمرکز دارند، نه mirror کامل پوشهٔ Markdown.[^2] بنابراین الزام Hero با import دستی یا اتصال داخلی GitHub به‌تنهایی حل نمی‌شود.

Notion API اکنون ایجاد، دریافت و به‌روزرسانی Page با Markdown را پشتیبانی می‌کند و webhook تغییر Page/Database نیز دارد؛ این دو قابلیت ساخت Adapter اختصاصی Hero را ممکن می‌کنند.[^3] webhook به HTTPS عمومی نیاز دارد و localhost قابل‌دسترسی نیست، پس استفاده از آن سطح حمله و گیت عملیاتی جدیدی ایجاد می‌کند.[^4]

Import معمول Markdown anchor link و extensionهای غیرمعمول را کامل حفظ نمی‌کند و بازکردن Markdown یک read-only copy می‌سازد؛ در نتیجه import دستی، round-trip قابل اتکا نیست.[^5] API نیز rate limit و خطاهای `429/529` دارد و integration باید queue، `Retry-After`، backoff، idempotency و سقف retry داشته باشد.[^6]

### ۵.۲. GitBook

GitBook برای docs-as-code و ویرایش بصری اسناد Markdown بسیار قوی است. Git Sync آن دوطرفه است، تغییرات Git و ویرایش visual را همگام می‌کند و branch/review/merge را وارد جریان مستندات می‌کند.[^7] ضعف آن برای Hero این است که Product Discovery، Portfolio Roadmap، Authorization و مدل عملیاتی چندتیمی را به جامعیت مورد نیاز پوشش نمی‌دهد. GitBook می‌تواند بعداً Presentation Adapter تخصصی مستندات باشد، اما هستهٔ Product Development نیست.

### ۵.۳. Linear، Jira Product Discovery و Productboard

Linear از hierarchy مبتنی بر Initiative، Project، Issue، health update و اتصال قوی GitHub استفاده می‌کند؛ الگوی مهم آن تفکیک objective/initiative از delivery item و گزارش دوره‌ای سلامت است.[^8]

Jira Product Discovery ایده، insight، scoring، view و delivery link را جدا می‌کند. این تفکیک نشان می‌دهد feedback و discovery evidence نباید مستقیماً به backlog اجرایی تبدیل شوند.[^9]

Productboard feedback را به insight و feature متصل می‌کند و roadmap را روی Objective، Initiative، Product، Feature و Release می‌سازد؛ الگوی مهم آن «roadmap به‌عنوان view روی یک مدل واحد»، نه فایل یا جدول موازی است.[^10]

این ابزارها برای سازمان محصول بالغ مفیدند، اما اضافه‌کردن آن‌ها در وضعیت فعلی Hero یک منبع وضعیت دیگر، هزینه، integration و پیچیدگی حاکمیتی ایجاد می‌کند. الگوهای داده‌ای آن‌ها باید جذب Hero شوند؛ خرید یا اتصال خود ابزارها فقط زمانی بررسی شود که نیاز واقعی تیم از ظرفیت Hero و Notion عبور کند.

### ۵.۴. GitHub Projects

GitHub Projects می‌تواند Issue، PR و idea را در table، board و roadmap نمایش دهد و با GitHub data تازه بماند.[^11] برای اجرای مهندسی مناسب است، اما تجربهٔ اسناد، Product Discovery، راهنمای فارسی مالک و کنترل چندمحصولی مورد نیاز Hero را به‌تنهایی پوشش نمی‌دهد.

### ۵.۵. Backstage و TechDocs

Backstage Software Catalog الگوی مهمی برای Hero دارد: metadata هر نرم‌افزار کنار کد در source control می‌ماند و یک Catalog مرکزی آن را جمع‌آوری و نمایش می‌دهد.[^12] TechDocs نیز Markdown کنار کد را به portal مستندات تبدیل می‌کند.[^13] این دقیقاً الگوی مناسب multi-product ingestion است، ولی استقرار کامل Backstage برای مرحلهٔ فعلی Hero سنگین و موازی با Control Plane موجود است. Hero باید این pattern را با مدل کوچک‌تر و بومی خود پیاده کند.

### ۵.۶. ماتریس تصمیم

امتیازها قضاوت معماری بر اساس نیاز Hero هستند، نه امتیاز رسمی فروشندگان. `A` بهترین تناسب و `D` ضعیف‌ترین تناسب است.

| گزینه | تجربهٔ مالک غیرمتخصص | Product/Roadmap | اسناد Git-native | ویرایش بصری | Portfolio چندمحصولی | حاکمیت اختصاصی Hero | نقش پیشنهادی |
|---|---:|---:|---:|---:|---:|---:|---|
| Notion | A | A- | C بدون Adapter | A | B | B با Adapter | Experience و authoring کنترل‌شده |
| GitBook | A- | C | A | A | B | C | portal تخصصی اسناد در آینده |
| Linear | B | A | C | B | B | C | delivery tracking در مقیاس تیمی بزرگ‌تر |
| Jira Product Discovery | B | A | D | B | A- | C | discovery و prioritization سازمانی |
| Productboard | B | A | D | B | A | C | research/portfolio محصول بالغ |
| GitHub Projects | C | B | A برای work item | D برای docs | B | B | اجرای مهندسی و PR/Issue |
| Backstage + TechDocs | C | C | A | D | A | A- | الگوی مرجع portal چندمحصولی |
| Hero-native core | B در ابتدا، A در هدف | A در هدف | A | B | A | A | هستهٔ نهایی و منبع projection |

### ۵.۷. نتیجهٔ بنچ‌مارک

انتخاب مناسب یک محصول منفرد نیست؛ ترکیب زیر است:

```text
Hero-native Product Development Core  = مدل، قواعد، گیت‌ها و تجمیع
Git repositories                       = حقیقت اسناد و تغییرات
Notion                                = تجربهٔ مالک و ویرایش پیشنهادی
GitHub PR/Issues                       = review و delivery integration
```

Notion انتخاب پیشنهادی برای رابط بیرونی است، اما Adapter آن باید قابل‌حذف و قابل‌جایگزینی با GitBook، Confluence یا portal داخلی باشد.

## ۶. اصول غیرقابل‌مذاکره

1. **دو نوع منبع حقیقت، با مرز روشن:** Git منبع حقیقت محتوای سند و کد است؛ Event Log/PostgreSQL منبع حقیقت وضعیت عملیاتی است.
2. **Projection منبع حقیقت نیست:** Notion، Search Index، dashboard و cache قابل بازسازی‌اند.
3. **Notion قابل‌ویرایش، اما غیرمستقیم:** ویرایش به Proposal تبدیل می‌شود؛ direct canonical write ممنوع است.
4. **هر Product مالک اسناد خودش است:** Product-specific docs در repository همان Product می‌مانند.
5. **قواعد مشترک کپی نمی‌شوند:** Product به Document ID، version و commit مرجع Hero ارجاع می‌دهد.
6. **هر وضعیت باید provenance داشته باشد:** وضعیت بدون Event، Evidence یا commit معتبر `unknown` است، نه سبز.
7. **AI تصمیم‌گیر نهایی نیست:** AI تشخیص، خلاصه، پیشنهاد و diff می‌سازد؛ Approval و Authorization جدا می‌ماند.
8. **دسترسی کمینه:** هیچ projection نباید سطح دسترسی وسیع‌تری از منبع داشته باشد.
9. **حذف نرم و تاریخچه‌دار:** حذف Notion یا Git ابتدا archive/supersede proposal است؛ پاک‌کردن مستقیم سابقه ممنوع است.
10. **عدم وابستگی به مسیر میزبان:** ingestion محصول از remote repository adapter و شناسهٔ repository استفاده می‌کند، نه sibling path، symlink یا submodule.
11. **Fail-closed:** تعارض نسخه، نبود registry، stale base، checksum mismatch، permission ambiguity یا sync ناقص، انتشار تغییر را متوقف می‌کند.
12. **قابلیت خروج:** تمام محتوای canonical بدون Notion، در Git قابل خواندن، build و بازیابی است.

## ۷. معماری کلان هدف

### ۷.۱. لایهٔ Canonical Knowledge

هر repository شامل اسناد Markdown، رجیستری JSON و manifest نسخه‌دار است. Git commit شناسهٔ snapshot محتواست. CI وجود فایل، metadata، لینک، secret pattern، supersession و روابط را بررسی می‌کند.

### ۷.۲. لایهٔ Operational Product Model

Hero مدل زیر را نگه می‌دارد:

```text
Portfolio
  └─ Product
      ├─ Outcome / Objective
      │   └─ Initiative
      │       └─ Capability / Feature
      │           └─ Work Item / Task / Run
      ├─ Release
      ├─ Document
      ├─ Decision
      ├─ Evidence
      ├─ Risk / Dependency
      └─ Feedback / Insight
```

Roadmap یک view از این graph است. Document Catalog نیز view از repository snapshotهاست. هیچ جدول Notion نباید مدل مستقل و رقیب بسازد.

### ۷.۳. لایهٔ Hero Product Studio

داخل اپلیکیشن Hero یک بخش جدید با نام کاری `Product Studio` ایجاد می‌شود. این بخش مرجع مشاهدهٔ معتبر و کنترل است و حتی بدون Notion کار می‌کند.

نماهای اصلی:

- `Portfolio`: همهٔ Productها، lifecycle، health و blockerها؛
- `Product Home`: هدف، کاربران، وضعیت، آخرین Release و تصمیم بعدی؛
- `Roadmap`: Strategy، Now/Next/Later، Timeline، Dependency، Release و Blocker؛
- `Documents`: فهرست، جست‌وجو، lineage، version، owner و freshness؛
- `Completeness`: اسناد و گیت‌های مفقود بر اساس مرحله و نوع محصول؛
- `Decisions`: proposed، in-review، active، superseded و impact؛
- `Evidence`: اتصال تست، تحقیق، release و operation به ادعاها؛
- `Changes`: Proposal، diff، conflict، review و PR؛
- `Sync`: آخرین commit، Notion status، lag، failure و retry؛
- `Intelligence`: پاسخ مستند، finding و توصیهٔ advisory؛
- `Administration`: connector، mapping، policy و access، بدون نمایش Secret.

### ۷.۴. لایهٔ Notion Experience

Notion یک Workspace خصوصی با databaseهای مرتبط است. Pageهای سند از Git materialize می‌شوند؛ roadmap و product views از Hero projection تغذیه می‌شوند؛ ویرایش‌های مجاز از Notion به Proposal برمی‌گردند.

### ۷.۵. لایهٔ Integration

Adapterها:

- `RepositoryReadPort`: خواندن manifest، tree، registry و content در commit مشخص؛
- `RepositoryProposalPort`: ساخت branch/commit/PR بدون merge خودکار؛
- `NotionReadPort`: خواندن Page و properties؛
- `NotionWritePort`: create/update/archive projection؛
- `NotionChangeSignalPort`: polling یا webhook؛
- `SearchIndexPort`: index و retrieval با ACL؛
- `ProductKnowledgeProjectionPort`: projection قابل بازسازی برای UI؛
- `DocumentRendererPort`: تبدیل canonical Markdown به presentation-safe Markdown؛
- `DocumentRoundTripPort`: تبدیل ویرایش Notion به patch محدود و deterministic.

Portها در Domain قرار نمی‌گیرند و Provider-specific ID یا payload نباید وارد قواعد محصول شود.

## ۸. Hero به‌عنوان اولین Product

Hero در Catalog با Product ID پایدار `HERO-PRODUCT-HERO-001` ثبت شده است. این ثبت، self-management را صریح می‌کند:

- repository فعلی، منبع اسناد خود Hero است؛
- Product Studio همین repository را index می‌کند؛
- roadmap Hero از مدل جدید نمایش داده می‌شود؛
- تغییر قابلیت Product Studio خودش از همان PR، CI، test evidence و release flow عبور می‌کند؛
- Hero Test محل آزمایش sync و UI جدید است؛
- Hero Production فقط Artifact تأییدشدهٔ Test را دریافت می‌کند.

برای جلوگیری از حلقهٔ خودتأییدی، Hero نمی‌تواند تغییر سیاست اختیار، connector scope، critical principle یا production gate خودش را خودکار approve کند. این تغییرها owner-gated باقی می‌مانند.

## ۹. زیرساخت اسناد برای هر Product ساخته‌شده با Hero

### ۹.۱. مالکیت مخزن

هر Product یک repository مستقل دارد. ساختار هدف:

```text
<product-repository>/
  hero-product.json
  docs/
    INDEX.md
    registry/
      document-registry.json
    strategy/
    discovery/
    requirements/
    experience/
    architecture/
    decisions/
    security/
    quality/
    releases/
    operations/
    evidence/
    learning/
    templates/
```

این ساختار الزام نمی‌کند که همهٔ پوشه‌ها از روز اول فایل داشته باشند. Completeness Engine بر اساس lifecycle و risk profile تعیین می‌کند کدام سند در کدام مرحله required است.

### ۹.۲. Product Manifest

فایل `hero-product.json` حداقل این metadata را دارد:

| فیلد | معنا |
|---|---|
| `schema_version` | نسخه قرارداد manifest |
| `product_id` | شناسه پایدار و جهانی داخل Hero |
| `name` | نام انسانی |
| `owner_role` | نقش پاسخ‌گو |
| `lifecycle_state` | وضعیت چرخه عمر |
| `repository_id` | شناسه remote، نه مسیر محلی |
| `default_branch` | شاخه canonical |
| `docs_root` | مسیر نسبی اسناد |
| `document_registry` | مسیر نسبی رجیستری |
| `product_type` | web، mobile، service، platform یا ترکیبی |
| `risk_profile` | ویژگی‌هایی مانند PII، payment، AI، external integration |
| `inherited_documents` | Document ID + version + source commit مشترک |
| `notion_policy` | disabled، mirror-only یا proposal-editable |
| `classification_default` | internal یا restricted؛ public باید صریح باشد |
| `test_environment_ref` | Document ID محیط Test |
| `production_environment_ref` | Document ID محیط Production |
| `release_policy_ref` | Document ID سیاست Release |

Secret، token، host path، connection string یا credential reference خام در این manifest ممنوع است.

### ۹.۳. Ingestion چندمخزنی

Hero هیچ sibling repository را روی host enumerate نمی‌کند. onboarding از این مسیر انجام می‌شود:

1. مالک Product، repository و branch مجاز را ثبت می‌کند؛
2. Read-only repository credential در Secret Store همان محیط قرار می‌گیرد؛
3. Hero manifest و registry را در commit مشخص می‌خواند؛
4. schema، path، link، classification و inherited reference بررسی می‌شوند؛
5. snapshot معتبر به Product Catalog projection می‌رود؛
6. search index و Notion projection از همان snapshot ساخته می‌شوند؛
7. برای ویرایش، credential نوشتن جدا و محدود به branch/PR استفاده می‌شود؛
8. نبود یا خرابی Product repository، محصول را `stale/blocked` می‌کند ولی محتوای قبلی را canonical تازه جلوه نمی‌دهد.

### ۹.۴. قواعد مشترک و اسناد اختصاصی

Shared policyهای Hero در repository مرکزی یک‌بار نگه داشته می‌شوند. Product فقط reference نسخه‌دار دارد. Product-specific docs شامل requirement، architecture decision، environment، Evidence، runbook و release همان Product است.

اگر Product نیازمند استثنا یا تغییر قاعدهٔ مشترک باشد، باید ADR یا تغییر canonical در Hero ایجاد شود؛ کپی‌کردن متن و ویرایش محلی راه‌حل نیست.

## ۱۰. کتابخانهٔ کامل اسناد توسعه محصول

### ۱۰.۱. Strategy و جهت محصول

| سند | زمان الزام | هدف |
|---|---|---|
| Product Charter | ثبت Product | مالکیت، دامنه، اختیار و مرزها |
| Product Vision | پیش از برنامه‌ریزی | آیندهٔ مطلوب و ارزش محصول |
| Problem Statement | پیش از Discovery | مسئله، مخاطب و پیامد |
| Outcome/Objectives | پیش از Roadmap commitment | نتیجهٔ قابل‌اندازه‌گیری، نه فهرست Feature |
| Product Principles | پیش از طراحی | قواعد تصمیم محصول |
| Product Strategy | پیش از چند Initiative | بازار/کاربر، مزیت، انتخاب‌ها و non-goal |
| Portfolio Fit | برای Product دوم به بعد | رابطه با Hero و دیگر Productها |

### ۱۰.۲. Discovery و Evidence

| سند یا رکورد | زمان الزام | هدف |
|---|---|---|
| Research Plan | آغاز Discovery | سؤال، روش، نمونه و معیار توقف |
| User/Stakeholder Evidence | قبل از تأیید فرصت | داده و منبع قابل ردیابی |
| Persona یا JTBD | در صورت تصمیم کاربرمحور | نیاز و زمینه، بدون شخصیت‌سازی ساختگی |
| Opportunity Brief | قبل از Initiative | فرصت، شواهد، گزینه‌ها و عدم قطعیت |
| Market/Competitor Benchmark | هنگام تصمیم بازار/ابزار | مقایسهٔ منبع‌دار و تاریخ‌دار |
| Assumption Register | همیشه | فرض، ریسک، آزمون و نتیجه |
| Experiment Plan/Result | برای تصمیم نامطمئن | فرضیه، metric، stop condition و نتیجه |
| Feedback/Insight Log | پس از دسترسی به کاربر | اتصال feedback به Product/Feature/Decision |

### ۱۰.۳. Requirements و Experience

| سند | زمان الزام | هدف |
|---|---|---|
| Product Brief / PRD | قبل از Plan Ready | scope، outcome، user need و acceptance |
| Functional Requirements | قبل از implementation | رفتارهای لازم و edge case |
| Non-functional Requirements | قبل از architecture approval | امنیت، performance، availability، privacy و portability |
| Acceptance Criteria | قبل از Task Graph | معیار binary و قابل‌آزمون |
| Information Architecture | برای UI چندبخشی | navigation و hierarchy |
| User Flows | برای interactionهای اصلی | مسیر عادی، خطا، empty و recovery |
| UX/UI Specification | قبل از پیاده‌سازی رابط | states، copy، accessibility و responsive |
| Content/Localization Policy | برای محصول چندزبانه | زبان اصلی، ترجمه و review |

### ۱۰.۴. Architecture و Engineering

| سند | زمان الزام | هدف |
|---|---|---|
| Architecture Overview | قبل از build | context، component، data و trust boundary |
| ADR | برای تصمیم دارای trade-off | تصمیم، گزینه‌ها و پیامد |
| Data Model | قبل از persistence | entity، lifecycle، retention و integrity |
| API/Contract | قبل از integration | schema، errors، versioning و idempotency |
| Integration Contract | برای سرویس بیرونی | scope، retry، rate limit و failure policy |
| Dependency Inventory | قبل از release | dependency، license، version و owner |
| Migration/Compatibility Plan | هنگام تغییر ناسازگار | upgrade، rollback و backward compatibility |
| AI Model/Profile Contract | برای قابلیت AI | provider independence، prompt version، eval و cost |

### ۱۰.۵. Security، Privacy و Compliance

| سند | زمان الزام | هدف |
|---|---|---|
| Data Classification | ثبت Product | public/internal/restricted و PII |
| Threat Model | پیش از Test حساس | asset، threat، control و residual risk |
| Permission Model | پیش از اشتراک | role، resource، action و least privilege |
| Privacy/Retention Policy | هنگام داده کاربر | purpose، retention، deletion و export |
| Secret Management | قبل از runtime | reference-only و rotation boundary |
| External Spend Policy | قبل از سرویس پولی | cap، approval و cutoff |
| Compliance Record | در صورت الزام | jurisdiction، requirement و Evidence |

### ۱۰.۶. Quality، Release و Operation

| سند یا Evidence | زمان الزام | هدف |
|---|---|---|
| Test Strategy | قبل از implementation | unit/integration/e2e/security/accessibility |
| Quality Evidence | قبل از Release | نتیجهٔ واقعی و قابل بازتولید |
| Release Plan | قبل از Test deployment | artifact، rollout، gate و owner |
| Environment Contract | قبل از deploy | Test/Production boundary |
| Rollback Plan | قبل از Production | trigger، procedure و verification |
| Runbook | قبل از operation | start، monitor، diagnose و recover |
| Observability/SLO | قبل از operation | signal، threshold، alert و owner |
| Backup/Recovery | قبل از Production داده‌دار | RPO/RTO، checksum و restore evidence |
| Release Notes/Changelog | هر Release | تغییر قابل‌فهم و migration |
| Incident/Postmortem | پس از رخداد | timeline، cause، action و learning |

### ۱۰.۷. Learning و Lifecycle

| سند یا رکورد | زمان الزام | هدف |
|---|---|---|
| Measurement Plan | پیش از Release | KPI، event، baseline و window |
| Post-release Review | پس از Release | outcome در برابر انتظار |
| Support/Feedback Review | دوره‌ای | الگوهای مشکل و opportunity |
| Cost Review | دوره‌ای | هزینه واقعی، forecast و anomaly |
| Technical Debt Register | دوره‌ای | debt، impact، trigger و owner |
| Deprecation/Retirement Plan | پایان عمر | migration، notice، retention و shutdown |

## ۱۱. Completeness Engine

وجود تعداد زیادی فایل به معنی کامل‌بودن مستندات نیست. Hero باید requirement اسناد را از stage و risk profile بسازد.

### ۱۱.۱. گیت‌های مرحله‌ای

| مرحله Product | حداقل خروجی لازم |
|---|---|
| `proposed` | Product ID، owner، Problem، scope، risk classification |
| `discovery` | Research Plan، Evidence، Assumptions، Opportunity Decision |
| `planned` | Outcome، PRD، acceptance، roadmap item، architecture و risk |
| `in-development` | Task Graph، UX/contract، test strategy، assignment و authorization |
| `in-test` | Artifact identity، quality/security evidence، release و rollback plan |
| `production-ready` | owner approval، recovery readiness، runbook، monitoring و production authorization جدا |
| `operating` | KPI، support/incident process، periodic review و cost evidence |
| `retiring` | deprecation، migration، retention، communication authorization و shutdown evidence |

### ۱۱.۲. شرط‌های پویا

- اگر `PII=true` باشد، Privacy، Retention، Access Model و Threat Model الزامی‌اند؛
- اگر `payment=true` باشد، Financial/Compliance و failure reconciliation الزامی‌اند؛
- اگر `ai=true` باشد، Model/Profile، Evaluation، Safety، Cost و data-use policy الزامی‌اند؛
- اگر `mobile=true` باشد، platform build، store release، permission و device test الزامی‌اند؛
- اگر `external_integration=true` باشد، connector scope، retry، rate limit و outage behavior الزامی‌اند؛
- اگر Product به Production می‌رود، backup/recovery یا دلیل نسخه‌دار عدم نیاز الزامی است؛
- اگر سند normative تغییر کند، version bump و impact analysis الزامی است.

### ۱۱.۳. خروجی Completeness

Engine باید موارد مفقود را با severity و دلیل نشان دهد. درصد تنها از کنترل‌های معلوم محاسبه می‌شود. اگر داده یا Evidence کافی نیست، وضعیت `unknown` یا `blocked` است؛ سیستم نباید عدد خوش‌بینانه بسازد.

## ۱۲. مدل Roadmap

### ۱۲.۱. Roadmap به‌عنوان Graph

Roadmap یک جدول دستی یا متن آزاد نیست. مدل آن شامل این entityهاست:

- `Objective`: outcome و metric؛
- `Initiative`: سرمایه‌گذاری برای رسیدن به Objective؛
- `Capability/Feature`: خروجی محصول؛
- `Milestone`: نقطهٔ کنترل؛
- `Dependency`: blocked-by، enables، conflicts-with؛
- `Release`: بستهٔ artifact و rollout؛
- `Decision`: انتخابی که مسیر را عوض می‌کند؛
- `Evidence`: اثبات پیشرفت یا نتیجه؛
- `Risk`: احتمال، اثر، mitigation و owner؛
- `Work Item/Task/Run`: اجرای واقعی.

### ۱۲.۲. نماهای لازم

- Strategy Map: Objective → Initiative → Outcome؛
- Now / Next / Later: برای عدم قطعیت و جلوگیری از تاریخ‌های جعلی؛
- Timeline: فقط برای موارد دارای بازهٔ معتبر؛
- Dependency Graph: blocker و critical path؛
- Release View: Featureها و Evidence هر Release؛
- Team View: بار و مالکیت تیم‌ها؛
- Decision Queue: تصمیم‌های لازم از مالک؛
- Risk View: ریسک‌های باز و overdue؛
- Evidence Coverage: ادعاهای بدون Evidence؛
- Documentation Readiness: اسناد مفقود برای هر milestone؛
- Portfolio View: مقایسهٔ Productها بدون ادغام داده یا مجوز آن‌ها.

### ۱۲.۳. مرز ویرایش Roadmap

| نوع فیلد | رفتار در Notion |
|---|---|
| Problem، desired outcome، توضیح، فرض و پیشنهاد اولویت | قابل‌ویرایش به‌عنوان Proposal |
| target window و owner پیشنهادی | قابل‌ویرایش؛ نیازمند review policy |
| progress، completed، test passed، evidence coverage | فقط‌خواندنی و محاسبه‌شده |
| blocker و dependency | proposal؛ اعتبارسنجی cycle و scope لازم |
| owner approval و lifecycle transition | فقط command محافظت‌شده در Hero |
| Authorization، Global Stop، production approval | هرگز قابل‌ویرایش از Notion نیست |
| actual cost، audit، Evidence و Artifact identity | immutable/read-only |

## ۱۳. معماری اطلاعات Notion

### ۱۳.۱. ساختار Workspace

```text
Hero Product OS
  00 — Control Center
  10 — Hero Product
  20 — Product Portfolio
  30 — Shared Knowledge
  40 — Decisions and Evidence
  90 — Integration and Sync Health
```

به‌جای ساخت Teamspace مستقل برای هر Product کوچک، یک Product database مرکزی و Page home برای هر Product ساخته می‌شود. Teamspace جدا فقط برای مرز دسترسی واقعاً متفاوت ایجاد می‌شود.

### ۱۳.۲. Databaseهای اصلی

| Database | منبع | قابلیت ویرایش |
|---|---|---|
| Products | Hero Product Catalog | مشخصات پیشنهادی؛ lifecycle رسمی فقط Hero |
| Objectives | Hero Roadmap | proposal-editable |
| Initiatives | Hero Roadmap | proposal-editable |
| Roadmap Items | Hero Roadmap/Planner | intent قابل‌ویرایش، state محاسبه‌شده |
| Documents | Git Document Catalog | content طبق edit policy؛ metadata canonical فقط‌خواندنی |
| Decisions | Hero/Git | draft proposal؛ تصمیم active فقط‌خواندنی |
| Evidence | Hero Event Log/Git | فقط‌خواندنی |
| Risks | Hero Risk Register | proposal-editable با owner review |
| Releases | Hero Release Projection | فقط‌خواندنی |
| Change Proposals | Hero Change Workflow | comment/review محدود؛ state توسط Hero |
| Sync Health | Hero Integration Projection | فقط‌خواندنی |

### ۱۳.۳. properties مشترک

هر Page سند باید این اطلاعات را نشان دهد:

- `Document ID`؛
- `Title`؛
- `Product ID`؛
- `Type`؛
- `Scope`؛
- `Status`؛
- `Version`؛
- `Owner`؛
- `Classification`؛
- `Canonical Repository`؛
- `Canonical Relative Path`؛
- `Canonical Commit`؛
- `Canonical URL`؛
- `Content Checksum`؛
- `Last Canonical Update`؛
- `Review Cadence` و `Next Review`؛
- `Edit Policy`؛
- `Sync State`؛
- `Last Successful Sync`؛
- relation به Product، Initiative، Decision، Evidence و Release.

### ۱۳.۴. banner هر سند

بالای Page باید یکی از این bannerها باشد:

- `Canonical mirror — in sync`؛
- `Draft edit — not canonical`؛
- `Git ahead — refresh pending`؛
- `Notion change proposal pending`؛
- `Conflict — editing frozen`؛
- `Stale — source not verified`؛
- `Superseded — use replacement`.

هیچ Page بدون اعلام canonicality نباید به کاربر نمایش داده شود.

## ۱۴. سیاست ویرایش اسناد

### ۱۴.۱. کلاس‌های ویرایش

| کلاس | نمونه | رفتار |
|---|---|---|
| `mirror-only` | Evidence، audit، release approval، authorization، generated status | فقط Git/Hero → Notion |
| `protected-proposal` | governance، architecture، critical principles، security | ویرایش Notion فقط Proposal با review اجباری مالک/نقش مسئول |
| `proposal-editable` | Product Brief، PRD، research، roadmap narrative، UX copy | Proposal و PR استاندارد |
| `notion-working-note` | یادداشت جلسه و brainstorm | غیرcanonical؛ برای اثرگذاری باید Promote شود |

درخواست «همهٔ اسناد در Notion قابل ویرایش باشند» برای محتوای `mirror-only` به‌صورت comment یا change request برآورده می‌شود، نه دستکاری مستقیم واقعیت تاریخی. Evidence و Authorization اگر قابل بازنویسی باشند دیگر Evidence و Authorization قابل اعتماد نیستند.

### ۱۴.۲. جریان Git به Notion

```text
Merge to canonical branch
  -> CI/document checks pass
  -> repository event/outbox
  -> read exact commit
  -> validate registry and classification
  -> render presentation Markdown
  -> upsert by stable Document ID
  -> store page mapping + checksum
  -> mark in-sync
```

قواعد:

- upsert با Document ID انجام می‌شود، نه title یا path؛
- rename با ID ثابت Page جدید نمی‌سازد؛
- supersede، Page را حذف نمی‌کند و replacement را نشان می‌دهد؛
- archive در Git به archive projection در Notion تبدیل می‌شود؛
- update فقط از commit عبورکرده از CI materialize می‌شود؛
- Page Notion همیشه commit و checksum آخر را نشان می‌دهد؛
- linkهای نسبی به canonical URL یا Page ID مقصد بازنویسی می‌شوند؛
- block unsupported به هشدار fidelity تبدیل می‌شود و sync موفق کاذب نیست.

### ۱۴.۳. جریان Notion به Git

```text
User edits an allowed Notion page
  -> change signal (poll or verified webhook)
  -> fetch full page Markdown and properties
  -> verify page mapping and author permission
  -> compare base commit/version/checksum
  -> deterministic normalization and validation
  -> create Document Change Proposal
  -> show semantic diff in Hero
  -> approved proposal creates branch + PR
  -> CI + required review
  -> merge
  -> outbound sync confirms canonical version
```

ویرایش Notion مستقیماً branch اصلی را تغییر نمی‌دهد. حتی برای اصلاح نگارشی، حداقل یک PR و کنترل خودکار ایجاد می‌شود؛ policy می‌تواند reviewer مورد نیاز را بر اساس type و scope تعیین کند.

### ۱۴.۴. جلوگیری از loop و تکرار

- هر outbound update یک `sync_origin=hero` و `sync_run_id` دارد؛
- webhook ناشی از همان update با mapping و checksum ignore می‌شود؛
- idempotency key از `workspace + page + last_edited_time + checksum` ساخته می‌شود؛
- Event تکراری نتیجهٔ قبلی را برمی‌گرداند؛
- retry فقط برای عملیات idempotent یا دارای idempotency protection مجاز است؛
- queue به ازای workspace و connector budget محدود می‌شود.

### ۱۴.۵. تعارض

Conflict زمانی است که Git و Notion هر دو نسبت به `base_commit` تغییر کرده باشند. رفتار:

1. Page به `conflict` می‌رود؛
2. outbound overwrite متوقف می‌شود؛
3. diff سه‌طرفهٔ Base/Git/Notion ساخته می‌شود؛
4. AI فقط پیشنهاد merge می‌دهد؛
5. انسان نسخهٔ پیشنهادی را review می‌کند؛
6. resolution از PR عبور می‌کند؛
7. هیچ‌یک از دو نسخه silently حذف نمی‌شود.

### ۱۴.۶. polling یا webhook

پیش‌فرض پایلوت `outbound polling` از Hero به Notion است، چون Back Office فعلی same-host است و webhook Notion به endpoint عمومی HTTPS نیاز دارد.[^4]

ترتیب رشد:

1. sync دستی deterministic بدون شبکه؛
2. Git → Notion در Hero Test؛
3. polling محدود برای change detection؛
4. webhook امضاشده برای near-real-time فقط پس از hardening؛
5. Production پس از audit، recovery و authorization مستقل.

## ۱۵. مدل داده و projection

### ۱۵.۱. استفادهٔ مجدد از مدل موجود

این سامانه از `projects`، `tasks`، `events`، `evidence`، `artifacts`، `memory_records`، `planning_records`، `principles`، `releases`، `outbox` و Domain Registry Snapshot استفاده می‌کند.

### ۱۵.۲. entityهای جدید پیشنهادی

| Entity | هدف | منبع حقیقت |
|---|---|---|
| `product_catalog_entries` | manifest و snapshot هر Product | Git manifest + Event registration |
| `document_catalog_entries` | metadata و canonical snapshot | Git registry/commit |
| `document_relations` | رابطه سند با Product/Initiative/Decision/Evidence | Git metadata یا Event |
| `document_change_proposals` | تغییر پیشنهادشده و base identity | Event Log |
| `external_document_mappings` | Document ID ↔ Notion Page ID | Event Log/Projection |
| `document_sync_runs` | نتیجه، lag، count و failure | Event Log |
| `product_objectives` | outcome و metric | Event Log + canonical spec reference |
| `product_initiatives` | سرمایه‌گذاری و lifecycle | Event Log |
| `roadmap_dependencies` | graph versioned | Event Log |
| `product_risks` | risk، mitigation و owner | Event Log |
| `product_insights` | feedback/research evidence reference | Event Log |

Raw Notion payload، raw webhook body، document content تکراری، credential و Secret در Event Log ذخیره نمی‌شوند. برای audit، ID، type، actor، checksum، source timestamp و outcome کافی است.

### ۱۵.۳. وضعیت sync

```text
unmapped
  -> queued
  -> syncing
  -> in-sync
  -> git-ahead | notion-ahead
  -> conflict | blocked | failed
  -> queued (retry/reconcile)
```

`failed` پایان تاریخچه نیست؛ retry یک Event جدید می‌سازد. `conflict` فقط با resolution صریح خارج می‌شود.

### ۱۵.۴. Eventهای اصلی

- `product.catalog-registered`؛
- `product.catalog-refreshed`؛
- `document.discovered`؛
- `document.canonical-version-observed`؛
- `document.change-proposed`؛
- `document.change-reviewed`؛
- `document.change-rework-requested`؛
- `document.pull-request-created`؛
- `document.change-merged`؛
- `document.sync-queued`؛
- `document.sync-completed`؛
- `document.sync-failed`؛
- `document.sync-conflict-detected`؛
- `document.sync-conflict-resolved`؛
- `roadmap.objective-created`؛
- `roadmap.initiative-proposed`؛
- `roadmap.dependency-recorded`؛
- `roadmap.status-derived`؛
- `product.completeness-evaluated`؛
- `product.readiness-blocked`.

## ۱۶. API و Command Boundary پیشنهادی

### ۱۶.۱. Queryها

- `GET /api/products`؛
- `GET /api/products/:productId`؛
- `GET /api/products/:productId/roadmap`؛
- `GET /api/products/:productId/documents`؛
- `GET /api/products/:productId/completeness`؛
- `GET /api/products/:productId/risks`؛
- `GET /api/documents/:documentId`؛
- `GET /api/documents/:documentId/history`؛
- `GET /api/document-change-proposals`؛
- `GET /api/document-sync/status`؛
- `GET /api/product-knowledge/search`.

### ۱۶.۲. Commandها

- `POST /api/products/register`؛
- `POST /api/products/:productId/refresh-catalog`؛
- `POST /api/document-change-proposals`؛
- `POST /api/document-change-proposals/:proposalId/review`؛
- `POST /api/document-change-proposals/:proposalId/rework`؛
- `POST /api/document-change-proposals/:proposalId/create-pr`؛
- `POST /api/document-sync/run`؛
- `POST /api/document-sync/reconcile`؛
- `POST /api/roadmap/objectives`؛
- `POST /api/roadmap/initiatives`؛
- `POST /api/roadmap/dependencies`.

هر Command باید owner/admin policy، idempotency key، expected version، Product scope، audit metadata و Global Stop را رعایت کند. command ساخت PR یا update Notion external write است و علاوه بر session، مجوز عملیات بیرونی و connector policy می‌خواهد.

### ۱۶.۳. Webhook

endpoint پیشنهادی `POST /integrations/notion/webhook` فقط signal دریافت می‌کند. الزامات:

- HTTPS عمومی پس از مجوز؛
- HMAC signature verification با raw body؛
- verification token در Secret Store؛
- محدودیت اندازه و نرخ؛
- پاسخ سریع و queue کردن کار؛
- عدم اعتماد به properties یا actor بدون fetch مجدد؛
- عدم وجود mutation مستقیم Domain از payload؛
- replay protection و event id deduplication؛
- audit بدون ذخیرهٔ محتوای حساس.

Notion برای webhook امضای HMAC ارائه می‌کند و دریافت‌کننده باید آن را اعتبارسنجی کند.[^4]

## ۱۷. جست‌وجو و هوشمندی

### ۱۷.۱. Search Index

Index از snapshot canonical ساخته می‌شود و این metadata را روی هر chunk نگه می‌دارد:

- Product ID؛
- Document ID، version و commit؛
- section anchor؛
- type، scope، status و classification؛
- owner و review state؛
- related objective/initiative/decision؛
- allowed roles؛
- content checksum.

مرحلهٔ اول با PostgreSQL full-text و metadata filtering قابل اجراست. semantic/vector retrieval فقط پس از نیاز اثبات‌شده و با همان ACL اضافه می‌شود.

### ۱۷.۲. پاسخ هوشمند

پاسخ AI باید:

- فقط از آخرین سند `active` و مجاز استفاده کند؛
- Document ID، version، commit و section را cite کند؛
- proposed و superseded را واضح جدا کند؛
- تعارض منابع را پنهان نکند؛
- در نبود Evidence بگوید `unknown`؛
- content خارج از Product scope را وارد نکند؛
- پیشنهاد را از تصمیم رسمی جدا نشان دهد؛
- هیچ Authorization یا roadmap completion نسازد.

### ۱۷.۳. قابلیت‌های هوشمند پیشنهادی

- تشخیص سند لازم ولی مفقود؛
- تشخیص review overdue و reference stale؛
- خلاصهٔ تغییر میان دو version؛
- impact analysis روی Productهای ارث‌برنده؛
- تشخیص roadmap item بدون outcome، owner، acceptance یا Evidence؛
- تشخیص dependency cycle و milestone غیرقابل عبور؛
- تشخیص ادعای Done بدون test/release Evidence؛
- پیشنهاد دسته‌بندی و link، بدون mutation خودکار؛
- ساخت owner briefing روزانه/هفتگی از دادهٔ معتبر؛
- پاسخ فارسی ساده و امکان drill-down فنی.

## ۱۸. امنیت، محرمانگی و دسترسی

### ۱۸.۱. Classification

هر سند یکی از این سطح‌ها را دارد:

- `public`: انتشار عمومی جداگانه مجاز شده؛
- `internal`: اعضای مجاز Workspace/Product؛
- `restricted`: فقط role/group مشخص؛
- `secret-prohibited`: مقدار Secret اصلاً نباید سند شود؛ فقط reference امن.

پیش‌فرض `internal` است؛ public هرگز از نام پوشه یا اشتراک parent استنباط نمی‌شود.

### ۱۸.۲. قانون عدم گسترش دسترسی

```text
Notion access <= Hero access <= source repository access
```

اگر mapping دسترسی قابل اثبات نباشد، Page sync نمی‌شود. Notion در permissionهای هم‌پوشان گسترده‌ترین سطح دسترسی را اعمال می‌کند؛ بنابراین inherited permission، relation و parent page باید در audit لحاظ شوند.[^14]

### ۱۸.۳. Workspace policy

- انتشار عمومی و `Anyone with link` پیش‌فرض خاموش؛
- guest access پیش‌فرض خاموش؛
- Workspace owner محدود و ثبت‌شده؛
- mirrored docs برای عموم `Can view`؛
- editor فقط روی کلاس‌های proposal-editable؛
- integration فقط به Page/Database لازم share می‌شود؛
- read و write connector در صورت امکان credential جدا دارند؛
- Notion AI روی restricted content تا تصمیم Data Processing و retention فعال نمی‌شود؛
- export و recovery policy جداگانه ثبت می‌شود؛
- permission audit دوره‌ای و بعد از هر تغییر ساختار انجام می‌شود.

### ۱۸.۴. Secret و connector

`NOTION_API_TOKEN`، webhook verification token و repository credential فقط در Secret Store runtime هستند. نام متغیر می‌تواند در config example باشد؛ مقدار هرگز در Git، Event، Notion Page یا log ثبت نمی‌شود.

### ۱۸.۵. عملیات حساس

این موارد جداگانه gated هستند:

- خرید یا ارتقای پلن Notion؛
- اتصال Workspace یا GitHub Organization؛
- ارسال اسناد فعلی به Notion؛
- فعال‌کردن Notion AI؛
- ایجاد webhook عمومی؛
- ثبت یا چرخش Secret؛
- دسترسی نوشتن به repository؛
- ساخت PR یا پیام بیرونی خودکار؛
- Production deployment.

## ۱۹. قابلیت اطمینان و بازیابی

### ۱۹.۱. مدل خرابی

| خرابی | رفتار مورد انتظار |
|---|---|
| Notion unavailable | Git و Hero ادامه می‌دهند؛ sync در queue می‌ماند |
| Git provider unavailable | snapshot قبلی با stale banner؛ ویرایش/تأیید متوقف |
| Notion rate limit | `Retry-After`، backoff و bounded retry |
| webhook تکراری | idempotent no-op |
| Page حذف‌شده | recreate یا archive decision؛ حذف canonical ممنوع |
| mapping گمشده | reconcile با Document ID؛ no blind duplicate |
| checksum mismatch | conflict و توقف overwrite |
| converter fidelity failure | sync failed با report؛ canonical دست‌نخورده |
| permission mismatch | block و security finding |
| worker restart | resume از durable outbox/lease |

### ۱۹.۲. Backup

Git و Event Store منابع قابل بازیابی‌اند؛ Notion projection باید از آن‌ها rebuild شود. Draftهایی که فقط در Notion هستند canonical نیستند، اما Change Detector باید قبل از acknowledge محتوای proposal و checksum را به‌صورت امن ثبت کند تا قطع اتصال موجب ناپدیدشدن درخواست تغییر نشود.

Notion export می‌تواند نسخهٔ HTML/Markdown/CSV بدهد، اما بازگردانی کامل Workspace از همان export فوری و تضمین‌شده نیست؛ بنابراین export Notion جای backup Git یا Event Store را نمی‌گیرد.[^15]

### ۱۹.۳. هدف‌های غیرعملکردی پیشنهادی

این اعداد معیار طراحی‌اند و بعد از benchmark واقعی تنظیم می‌شوند:

- نمایش Product home از projection محلی: `p95 < 2s`؛
- نمایش جست‌وجوی metadata/full-text: `p95 < 2s` در baseline؛
- کشف تغییر Git پس از event سالم: کمتر از ۵ دقیقه؛
- sync Notion در حالت عادی: کمتر از ۱۵ دقیقه؛
- هیچ overwrite در conflict: صفر؛
- هیچ سند بدون Product/Document ID در Catalog: صفر؛
- هیچ وضعیت Done بدون Evidence policy: صفر؛
- RPO اسناد canonical: Git commit؛ Notion projection قابل بازسازی؛
- retry محدود و dead-letter قابل مشاهده؛
- تمام syncها دارای correlation ID و نتیجهٔ audit.

## ۲۰. مشاهده‌پذیری و شاخص‌ها

شاخص‌های لازم:

- تعداد Product و Document indexشده؛
- درصد Documentهای `in-sync`؛
- sync lag بر حسب Product/connector؛
- conflict و failure باز؛
- proposalهای بدون owner یا overdue؛
- reviewهای overdue؛
- roadmap itemهای بدون Evidence/acceptance/dependency owner؛
- completeness gap به تفکیک stage؛
- سندهای superseded که هنوز reference می‌شوند؛
- orphan Document/Task/Evidence؛
- Notion API `429/529` و retry/dead-letter؛
- permission mismatch finding؛
- آخرین commit indexشده و آخرین successful rebuild.

شاخص‌هایی مانند «درصد پیشرفت» فقط وقتی نمایش داده می‌شوند که denominator و منبع آن تعریف شده باشد. تعداد Page یا کلمه معیار موفقیت محصول نیست.

## ۲۱. مهاجرت وضعیت فعلی Hero

### ۲۱.۱. gapهای فعلی که باید اصلاح شوند

1. Hero خودش باید به‌عنوان Product در Product Catalog ثبت شود؛
2. Document Registry باید classification، source repository، edit policy، relations و sync policy را در نسخهٔ بعدی مدل کند؛
3. Product Registry باید repository contract، lifecycle، risk profile و completeness policy بگیرد؛
4. roadmapهای تاریخ‌دار باید lineage روشن داشته باشند؛ current، historical، superseded و evidence نباید همگی به‌عنوان مرجع جاری تعبیر شوند؛
5. `HERO_OPEN_ROADMAP` کدنویسی‌شده باید در نهایت projection مدل Roadmap باشد، نه دفتر موازی؛
6. INDEX و registry باید از یک projection تولید یا cross-check شوند تا توضیح stale باقی نماند؛
7. Back Office باید Product Studio navigation بگیرد، ولی API و projection قبلی حفظ سازگاری شوند؛
8. Project Memory فقط summary/reference تأییدشده از Catalog می‌گیرد و full-document store نمی‌شود؛
9. اسناد فعلی بدون تغییر ID به Catalog وارد می‌شوند؛ rename یا migration با supersession/history انجام می‌شود؛
10. Product VPN پایلوت تا زمان repository مستقل می‌تواند legacy-in-place باشد، اما مسیر مهاجرت نسخه‌دار لازم دارد.

### ۲۱.۲. Migration بدون شکستن تاریخچه

- ابتدا Catalog v1 از registry فعلی build می‌شود؛
- سپس metadata جدید با defaultهای امن افزوده می‌شود؛
- هیچ فایل موجود فقط برای زیبایی جابه‌جا نمی‌شود؛
- Notion Pageها بر اساس ID فعلی ساخته می‌شوند؛
- roadmap current/historical با تصمیم جدا طبقه‌بندی می‌شود؛
- بعد از صحت rebuild، Product Studio به projection جدید سوییچ می‌کند؛
- projection قدیمی تا پایان compatibility window خواندنی می‌ماند؛
- حذف legacy فقط پس از Evidence و migration manifest انجام می‌شود.

## ۲۲. برنامهٔ اجرای مرحله‌ای

هر فاز باید ابتدا deterministic و بدون connector زنده ساخته شود. نام فازها authorization یا Step ID اجرایی نیستند.

### فاز ۰ — تثبیت قرارداد و ADR

خروجی:

- ADR برای Git-canonical + Hero-core + Notion-adapter؛
- قرارداد canonicality و field authority؛
- schema Product Manifest و Document Catalog v2؛
- glossary یکسان Product/Project/Initiative/Task/Document/Evidence؛
- تصمیم مالک دربارهٔ editable classes و first pilot.

معیار عبور:

- تعارضی با Documentation Governance، Authorization و Release Flow وجود نداشته باشد؛
- هیچ اتصال، هزینه یا Secret فعال نشده باشد؛
- schema و نمونه‌ها در CI معتبر باشند.

### فاز ۱ — Product Catalog و Document Catalog محلی

خروجی:

- ثبت Hero به‌عنوان Product؛
- parser و validator رجیستری فعلی؛
- entity/contractهای Product و Document؛
- projection قابل rebuild از Git snapshot؛
- API فقط‌خواندنی Catalog؛
- تست duplicate ID، stale commit، broken relation و classification.

معیار عبور:

- تمام اسناد فعلی بدون تغییر دستی content index شوند؛
- هر سند ID/version/path/owner/status/commit داشته باشد؛
- rebuild deterministic digest یکسان بدهد.

### فاز ۲ — Product Studio فقط‌خواندنی برای خود Hero

خروجی:

- Product Home، Documents، Roadmap و Completeness؛
- search فارسی/انگلیسی؛
- lineage و canonical banner؛
- owner action و blocker view؛
- لینک Evidence و Release.

معیار عبور:

- مالک بتواند وضعیت و سند رسمی را بدون خواندن tree مخزن پیدا کند؛
- UI متن Secret، raw prompt یا data خارج از policy نشان ندهد؛
- وضعیت بدون Evidence به‌عنوان Done نمایش داده نشود.

### فاز ۳ — Roadmap Graph و Completeness Engine

خروجی:

- Objective/Initiative/Capability/Dependency/Risk contracts؛
- migration projection از roadmap فعلی؛
- Now/Next/Later، timeline، dependency و release views؛
- rule engine اسناد لازم؛
- cycle/orphan/stale detection.

معیار عبور:

- تمام آیتم‌ها outcome، owner، status provenance و dependency state داشته باشند یا صریحاً gap گزارش شود؛
- status محاسبه‌شده با Event/Evidence قابل توضیح باشد؛
- تغییر roadmap به‌تنهایی Authorization نسازد.

### فاز ۴ — زیرساخت چندProduct و Repository Adapter

خروجی:

- `hero-product.json`؛
- remote read-only adapter و fake adapter؛
- onboarding و refresh؛
- Product isolation و inherited references؛
- یک repository آزمایشی کوچک و غیرحساس.

معیار عبور:

- Hero بدون sibling path یا submodule یک Product را index کند؛
- خرابی یک Product، دیگری را آلوده نکند؛
- ACL، commit و source provenance حفظ شوند.

### فاز ۵ — Notion Schema و sync یک‌طرفه در Test

پیش‌شرط مجوزی:

- تأیید ارسال محتوای انتخاب‌شده به Notion؛
- Workspace و plan decision؛
- Secret Store و connector scope؛
- classification review.

خروجی:

- Workspace/database schema؛
- fake Notion adapter و contract tests؛
- Git/Hero → Notion upsert؛
- mapping، checksum، rate-limit handling و sync health؛
- rebuild و disaster test.

معیار عبور:

- مجموعهٔ allow-listed در Hero Test بدون duplicate و بدون محتوای restricted ناخواسته mirror شود؛
- قطع Notion روی Hero اثر عملیاتی نگذارد؛
- rebuild از source، همان mapping و محتوا را ایجاد کند.

### فاز ۶ — ویرایش کنترل‌شده Notion

پیش‌شرط مجوزی:

- write connector جدا؛
- repository PR permission؛
- owner/reviewer mapping؛
- polling یا webhook security decision.

خروجی:

- Change Detector؛
- normalized Markdown round-trip؛
- semantic diff؛
- Change Proposal lifecycle؛
- branch/PR creation؛
- conflict، loop prevention و rework.

معیار عبور:

- ویرایش مجاز یک PR قابل review بسازد؛
- ویرایش protected/evidence/authorization رد یا به comment تبدیل شود؛
- concurrent Git/Notion edit overwrite نشود؛
- merge موفق Page را دوباره `in-sync` کند.

### فاز ۷ — Intelligence و گزارش مالک

خروجی:

- cited search/answer؛
- completeness و stale advisor؛
- roadmap impact analysis؛
- briefing روزانه/هفتگی داخل Hero؛
- AI evaluation dataset برای hallucination، ACL و stale source.

معیار عبور:

- هر پاسخ claim مهم را به Document ID/version/commit وصل کند؛
- پاسخ بدون منبع یا خارج از ACL fail-closed باشد؛
- توصیه هیچ mutation یا Authorization خودکار ایجاد نکند.

### فاز ۸ — Hardening و پایلوت عملیاتی

خروجی:

- durable outbox worker؛
- audit، alert، retention و dead-letter procedure؛
- backup/rebuild runbook؛
- browser/accessibility/security review؛
- load/rate-limit/recovery test؛
- پایلوت ابتدا روی Hero و سپس یک Product غیرحساس.

معیار عبور:

- Test Evidence کامل و owner review؛
- restore/rebuild واقعی؛
- permission audit بدون finding بحرانی؛
- rollback connector و disable switch آزموده‌شده؛
- Production همچنان نیازمند مجوز مستقل است.

### فاز ۹ — Production و رشد Portfolio

فقط پس از promotion مستقل:

- rollout محدود؛
- health/SLO monitoring؛
- onboarding تدریجی Productها؛
- ارزیابی نیاز واقعی به GitBook، Linear، Productboard یا JPD؛
- عدم افزودن ابزار دوم بدون gap و owner decision مستند.

## ۲۳. ترتیب اسناد بعدی

پس از تأیید این baseline، اسناد اجرایی باید به این ترتیب ساخته شوند:

1. ADR معماری Source of Truth و Notion Authoring؛
2. Specification قرارداد Product Catalog و Document Catalog؛
3. schema نسخهٔ بعدی Document Registry و Product Manifest؛
4. Specification Roadmap Graph و Completeness Engine؛
5. Architecture/Data Model update؛
6. Specification Product Studio UX؛
7. Notion Workspace Schema؛
8. Notion Sync Contract؛
9. Security/Permission Model؛
10. Sync Runbook و Recovery؛
11. Pilot Plan و Acceptance Criteria؛
12. Production Promotion Evidence.

هر سند باید Step ID و document version مجاز خود را پیش از Dispatch داشته باشد. این فهرست مجوز خودکار پیاده‌سازی نیست.

## ۲۴. ریسک‌ها و راه‌حل‌ها

| ریسک | اثر | کنترل |
|---|---|---|
| دو منبع حقیقت | تصمیم و وضعیت متناقض | Proposal-only inbound و canonical banner |
| خراب‌شدن round-trip Markdown | از دست‌رفتن ساختار | fidelity tests، unsupported block report، no silent overwrite |
| permission leak در Notion | افشای سند | classification، access mapping، private default و audit |
| vendor lock-in | اختلال یا هزینه مهاجرت | Port/Adapter و rebuild از Git |
| roadmap دستی و stale | تصمیم اشتباه | Event-derived status و freshness indicator |
| AI hallucination | پاسخ نادرست | citation، active-only retrieval و `unknown` |
| خودتأییدی Hero | دورزدن مالک | owner gate برای policy/authorization/production |
| connector credential compromise | دسترسی بیرونی | scoped token، secret store، rotation و disable switch |
| API rate limit/outage | backlog sync | durable queue، backoff و dead-letter |
| انفجار تعداد Page/Database | UX پیچیده | Product home template، views محدود و archive policy |
| سند زیاد ولی بی‌کیفیت | حس کاذب آمادگی | completeness بر اساس Evidence و review، نه file count |
| وابستگی به GitHub خاص | کاهش portability | RepositoryPort و provider-neutral IDs |
| هزینهٔ ابزار | external spend | PoC کوچک، budget cap و procurement gate |

## ۲۵. تصمیم‌های پیش‌فرض و تصمیم‌های لازم مالک

### پیش‌فرض‌های معماری

- Notion انتخاب Experience Adapter اولیه است؛
- Git و Event Log منابع حقیقت باقی می‌مانند؛
- Hero Product Studio حتی بدون Notion ساخته می‌شود؛
- sync ابتدا یک‌طرفه و در Test است؛
- polling پیش از webhook؛
- Hero اولین Product و پایلوت self-management است؛
- public sharing، guest و Notion AI پیش‌فرض خاموش‌اند؛
- اسناد Evidence/Authorization/Audit mirror-only هستند؛
- multi-product ingestion فقط از remote adapter مجاز است.

### تصمیم‌هایی که پیش از اتصال زنده لازم‌اند

- Workspace مالک چه حساب/سازمانی است؛
- پلن Notion و سقف هزینه؛
- Git provider و repository access model؛
- فهرست سندهای مجاز برای خروج از زیرساخت؛
- نقش‌های viewer/editor/reviewer؛
- polling یا webhook و محل endpoint؛
- retention، export و offboarding؛
- first non-sensitive Product pilot؛
- SLA و sync freshness قابل قبول؛
- فعال یا غیرفعال بودن Notion AI روی هر classification.

## ۲۶. Definition of Done این قابلیت

سامانه فقط وقتی Done است که:

1. Hero و حداقل یک Product مستقل با manifest معتبر در Catalog باشند؛
2. اسناد هر دو از Git و commit مشخص بدون مسیر محلی index شوند؛
3. Product Studio بدون Notion همهٔ اسناد، roadmap، gap و provenance را نشان دهد؛
4. Notion projection از source قابل rebuild باشد؛
5. ویرایش مجاز Notion Change Proposal و PR بسازد؛
6. protected content و operational truth از Notion قابل بازنویسی نباشند؛
7. تعارض هم‌زمان بدون data loss شناسایی و حل شود؛
8. ACL و classification در Hero، repository و Notion سازگار باشند؛
9. جست‌وجو و AI پاسخ را به ID/version/commit cite کنند؛
10. roadmap status از Event/Evidence مشتق و قابل توضیح باشد؛
11. completeness rule برای lifecycle و risk profile تست شده باشد؛
12. queue، retry، dead-letter، audit، backup و rebuild Evidence واقعی داشته باشند؛
13. `pnpm check` و کنترل‌های جدید موفق باشند؛
14. Test deployment و owner review ثبت شده باشند؛
15. Production با Artifact یکسان و مجوز مستقل promote شده باشد.

## ۲۷. Non-goals

- انتقال منبع حقیقت به Notion؛
- کپی همهٔ قواعد مشترک در هر Product؛
- تبدیل Project Memory به full document database؛
- اتصال مستقیم Notion edit به Production یا Runner؛
- ساخت درصد پیشرفت یا KPI بدون مدل و Evidence؛
- فعال‌کردن چند ابزار محصول هم‌زمان؛
- انتشار عمومی اسناد داخلی؛
- ذخیره Secret یا credential در سند؛
- خواندن sibling repository از filesystem؛
- خودکارسازی Approval مالک یا عملیات حساس.

## ۲۸. جمع‌بندی

راه درست این نیست که Notion به محل جدید نگهداری همه‌چیز تبدیل شود. راه درست این است که Hero مالک مدل توسعه محصول باشد، Git مالک محتوای canonical بماند و Notion یک رابط انسانی، منظم و قابل‌ویرایش در یک جریان کنترل‌شده باشد.

این معماری سه مزیت هم‌زمان می‌دهد:

- برای مالک، یک محیط ساده، جامع، هوشمند و قابل فهم؛
- برای توسعه، نسخه، PR، CI، Evidence و قابلیت بازیابی؛
- برای آینده، زیرساخت چندProduct که اسناد هر اپلیکیشن را بدون کپی، تداخل یا وابستگی به یک Vendor جمع می‌کند.

## منابع

[^1]: Notion. “[Timeline view](https://www.notion.com/help/timelines),” و “[Sub-items & dependencies](https://www.notion.com/help/tasks-and-dependencies).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^2]: Notion. “[Synced databases](https://www.notion.com/help/synced-databases),” و “[Connect GitHub](https://www.notion.com/help/github).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^3]: Notion Developers. “[Working with markdown content](https://developers.notion.com/guides/data-apis/working-with-markdown-content).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^4]: Notion Developers. “[Webhooks](https://developers.notion.com/reference/webhooks).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^5]: Notion. “[Import data into Notion](https://www.notion.com/help/import-data-into-notion).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^6]: Notion Developers. “[Request limits](https://developers.notion.com/reference/request-limits).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^7]: GitBook. “[GitHub & GitLab Sync](https://gitbook.com/docs/integrations/git-sync),” و “[Git Sync](https://www.gitbook.com/features/git-sync).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^8]: Linear. “[Initiatives](https://linear.app/docs/initiatives),” “[Projects](https://linear.app/docs/projects),” و “[Initiative and Project updates](https://linear.app/docs/initiative-and-project-updates).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^9]: Atlassian. “[Create a Jira Product Discovery space](https://support.atlassian.com/jira-product-discovery/docs/create-a-jira-product-discovery-space/).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^10]: Productboard. “[What is Productboard?](https://support.productboard.com/hc/en-us/articles/360058147693-What-is-Productboard)” و “[Roadmaps quick start](https://support.productboard.com/hc/en-us/articles/29983922254739-Quick-start-guide-Roadmaps).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^11]: GitHub. “[Planning and tracking with Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^12]: Backstage. “[Software Catalog](https://backstage.io/docs/features/software-catalog/).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^13]: Backstage. “[TechDocs](https://backstage.io/docs/features/techdocs/).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^14]: Notion. “[Sharing & permissions](https://www.notion.com/help/sharing-and-permissions).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
[^15]: Notion. “[Back up your data](https://www.notion.com/help/back-up-your-data).” مشاهده‌شده در ۲۰۲۶-۰۹-۱۰.
