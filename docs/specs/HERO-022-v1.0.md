# HERO-022 v1.0 — Back Office Command Center و Control Plane جامع Hero

> Document ID: `HERO-SPEC-022`
> Canonical path: `docs/specs/HERO-022-v1.0.md`
> Title: Back Office Command Center و Control Plane جامع Hero — v1.0
> Type: specification
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: `HERO-ARCH-BACKOFFICE`
> Superseded by: none

## ۱. خلاصهٔ اجرایی

بک‌آفیس هدف Hero یک پنل مدیریت سنتی نیست؛ **Control Plane خصوصی یک کارخانهٔ هوشمند توسعهٔ محصول** است. مالک باید بتواند چند محصول مستقل—برای مثال VPN، CRM یا هر اپلیکیشن دیگر—را هم‌زمان از لحظهٔ تعریف مسئله تا تحقیق، برنامه‌ریزی، ساخت، تست، استقرار، تحویل، بهره‌برداری و بهبود مستمر اداره کند. هر پروژه تنظیمات، حافظه، تیم‌ها، مدل‌های AI، بودجه، سرورها، مخازن، محیط‌ها و سیاست‌های مستقل خود را دارد، اما همه زیر قواعد تغییرناپذیر امنیت و حاکمیت Hero کار می‌کنند.

Back Office نمای سراسری و مرکز فرمان است؛ `Product Studio` فضای کاری عمیق هر پروژه است. این دو محصول جدا یا دو منبع حقیقت نیستند. Back Office پروژه‌ها را پایش و هماهنگ می‌کند و با ورود به هر پروژه، Product Studio همان داده را برای مدیریت جزئیات محصول، رودمپ، اسناد، تصمیم‌ها، تیم‌ها و اجرا عرضه می‌کند.

طراحی هدف بر شش اصل بنا می‌شود:

1. **یک منبع حقیقت Hero-native:** Git، پایگاه دادهٔ عملیاتی، Object Storage و Event Log رسمی‌اند؛ ابزار بیرونی منبع حقیقت موازی نمی‌سازد.
2. **مدیریت بر اساس Intent:** مالک مسئله و نتیجهٔ مطلوب را بیان می‌کند؛ Hero بستهٔ سیاست، رودمپ و برنامهٔ اجرا پیشنهاد می‌دهد و پس از مجوز، کار را پیش می‌برد.
3. **تفکیک پروژه‌ها با تنظیمات کامل:** دانش و تنظیم پروژه‌ای به پروژهٔ دیگر نشت نمی‌کند؛ انتقال دانش فقط با `Knowledge Proposal` رخ می‌دهد.
4. **خودکارسازی سیاست‌محور و قابل توقف:** هر اقدام یکی از حالت‌های خودکار، نیازمند تأیید یا ممنوع را دارد؛ `Global Stop` و توقف پروژه همواره مقدم‌اند.
5. **قابلیت توضیح و حسابرسی:** هر وضعیت باید به Task، Run، Evidence، تصمیم، هزینه، Artifact و عامل انسانی/هوش مصنوعی سازندهٔ آن قابل ردیابی باشد.
6. **خروجی قابل‌انتقال:** محصول نباید به سرور، Provider یا خود Hero قفل شود؛ بستهٔ تحویل باید امکان استقرار مجدد روی سرور دیگر را فراهم کند.

این سند مشخصات محصول و معماری هدف است و مجوز اجرای پایلوت، Production، خرید، اتصال Secret یا استقرار واقعی محسوب نمی‌شود.

## ۲. مسئله و شکاف وضع موجود

بک‌آفیس فعلی Hero عمدتاً یک **Projection خواندنی از وضعیت داخلی Hero** و مجموعه‌ای محدود از فرمان‌هاست. این پایه ارزشمند است، اما برای مدیریت یک کارخانهٔ چندپروژه‌ای کافی نیست. شکاف اصلی، نبودن رابط گرافیکی زیباتر نیست؛ نبودن مدل فرماندهی یکپارچه است.

شکاف‌های هدف عبارت‌اند از:

- Portfolio واقعی برای چند پروژه، اولویت، ظرفیت، سلامت و تصمیم‌های منتظر وجود ندارد؛
- تعریف پروژه هنوز به یک فرایند راه‌اندازی سرتاسری و قابل‌پیگیری تبدیل نشده است؛
- اجزای پروژه، تیم، Role، AI، زیرساخت، سند و Artifact در یک کاتالوگ رابطه‌مند دیده نمی‌شوند؛
- تنظیمات مؤثر پراکنده‌اند و منشأ هر مقدار، نسخه، اثر و امکان Rollback آن یک‌جا روشن نیست؛
- گفت‌وگو هنوز مرکز فرمان دارای حافظه، Scope و Command Card کامل نیست؛
- ارزیابی عملکرد تیم و Role به هدف، Evidence، هزینه و بازکاری متصل نشده است؛
- استقرار، سرور، محیط و تحویل قابل‌انتقال در همان حلقهٔ مدیریت محصول ادغام نشده‌اند؛
- Alert، Approval، پیشنهاد هوشمند و اقدام اصلاحی یک Inbox عملیاتی مشترک ندارند؛
- قابلیت‌های AI بدون Evaluation و سیاست انتخاب/تعویض مدل، ممکن است فقط «فعال» به نظر برسند نه «قابل اعتماد».

بنابراین مسیر درست، افزودن صفحه‌های منفرد به بک‌آفیس فعلی نیست؛ تبدیل تدریجی آن به Control Plane زیر است.

## ۳. نتایج تحقیق و بنچ‌مارک

هیچ محصول مرجع به‌تنهایی مسئلهٔ Hero را حل نمی‌کند. الگوی مناسب ترکیبی است:

| مرجع | الگویی که Hero می‌گیرد | چیزی که عیناً کپی نمی‌شود |
|---|---|---|
| Linear | Initiative/Project، نمای Portfolio، Health Update و هشدار کهنه‌شدن وضعیت[^1] | محدودشدن به Issue tracking انسانی |
| Productboard و Jira Product Discovery | اتصال Objective، Initiative، Feature، Insight و Evidence؛ امتیازدهی و Viewهای متنوع[^2] | تبدیل Product Studio به ابزار عمومی PM |
| Backstage | کاتالوگ مرکزی Component، مالکیت، وابستگی و اسناد نزدیک به کد[^3] | وابستگی هستهٔ Hero به افزونه‌های Backstage |
| GitHub Environments | گیت محیط، Approval، Secret محیطی، Deployment history و Artifact provenance[^4] | واگذاری کل موتور اختیار Hero به GitHub |
| Kubernetes و Nomad | Desired/Observed State، Reconciliation، Agent heartbeat، صف و Scheduling منصفانه[^5] | پیچیدگی عمومی orchestrator زیرساخت |
| Temporal | Workflow بادوام که پس از خطا یا قطعی از همان وضعیت ادامه می‌یابد[^6] | استفاده از Temporal به‌عنوان مدل دامنهٔ محصول |
| Portainer Edge Agent | اتصال outbound و رمزگذاری‌شدهٔ سرور دوردست، بدون بازکردن Agent عمومی[^7] | تبدیل Hero به پنل عمومی Container |
| OpenTelemetry | Trace/Metric/Log همبسته و SLI/SLO برای توضیح علت وضعیت[^8] | ذخیرهٔ بی‌هدف همهٔ Telemetry |
| LangSmith و OpenAI Agents | Trace درختی Runها، Evaluation آنلاین/آفلاین، feedback انسانی، Session و HITL قابل ادامه[^9] | قفل‌شدن ارزیابی یا حافظه به یک Provider AI |

نتیجهٔ معماری این بنچ‌مارک چنین است: **Back Office پوستهٔ Portfolio و فرماندهی، Product Studio فضای پروژه، Catalog نقشهٔ دارایی‌ها، Workflow Engine موتور اجرا، Event/Evidence Store حافظهٔ قابل حسابرسی و Observability/Evaluation حلقهٔ یادگیری است.**

## ۴. واژگان و مرزهای اصلی

### ۴.۱ Hero Instance

یک نصب خصوصی و تک‌سازمانی که مالک نهایی واحد دارد. معماری SaaS چندسازمانی، Billing مشتریان و Tenant عمومی در دامنهٔ این نسخه نیست.

### ۴.۲ Project / Product

در این سند «پروژه» پروندهٔ کامل یک محصول قابل‌تحویل است. یک پروژه می‌تواند همهٔ موارد زیر را در خود داشته باشد:

- وب‌اپ، اپ موبایل، Backend و پنل مدیریت؛
- سرویس‌ها، Database، Queue و Integration؛
- مخزن یا چند مخزن GitHub؛
- محیط‌های Development، Test و Production؛
- سرورها و منابع اجرایی؛
- رودمپ، سند، تصمیم، تحقیق، Evidence و Release؛
- تیم‌ها، Roleها، Agent Assignmentها و حافظهٔ پروژه.

این اجزا پروژهٔ جدا محسوب نمی‌شوند، مگر آنکه بعداً یک تصمیم معماری نسخه‌دار مرز پروژه را تغییر دهد.

### ۴.۳ Back Office و Product Studio

- **Back Office:** صفحهٔ ورود، Portfolio، مرکز اعلان و تأیید، مدیریت پروژه‌ها و کاربران، سلامت کل Hero، ظرفیت و سیاست‌های سراسری.
- **Product Studio:** فضای کاری انتخاب‌شدهٔ یک پروژه برای Overview، رودمپ، Catalog، اسناد، تیم، گفتگو، اجرا، کیفیت، محیط‌ها، تحویل و تنظیمات.
- **مرز مهم:** هر دو از API، شناسه‌ها، Policy Resolver و Event Log مشترک استفاده می‌کنند. هیچ داده‌ای با Copy/Paste میان آن‌ها همگام نمی‌شود.

## ۵. معماری مفهومی هدف

```text
Owner / Project Admin / Viewer
              │
              ▼
 Back Office Shell ───── Project Product Studio
              │              │
              └──── Command & Query API ────┐
                                             │
 ┌──────────────── Control Plane ────────────┴───────────────┐
 │ Portfolio  Catalog  Policy  Identity  Conversation       │
 │ Workflow   Approval Scheduling Notification Evaluation   │
 │ Artifact   Knowledge Retention Observability Health      │
 └──────────────────────┬────────────────────────────────────┘
                        │ desired state / commands
                        ▼
 ┌──────────────── Execution Plane ──────────────────────────┐
 │ AI Providers  Isolated Runners  GitHub  Hero Node Agents │
 │ Development        Test              Production          │
 └──────────────────────┬────────────────────────────────────┘
                        │ events / evidence / telemetry
                        ▼
 ┌──────────────── Data Plane ───────────────────────────────┐
 │ Operational DB  Append-only Event Log  Private Storage   │
 │ Document Store  Metrics/Traces  Secret Store             │
 └───────────────────────────────────────────────────────────┘
```

### ۵.۱ Control Plane و Execution Plane

Control Plane تصمیم می‌گیرد **چه کاری، برای کدام پروژه، با کدام نسخهٔ تنظیمات، چه بودجه و چه مجوزی** انجام شود. Execution Plane فقط دستور امضاشده و دارای `project_id`، `step_id`، `authorization_snapshot_id` و `policy_version` را اجرا می‌کند. Runner یا Node Agent حق ساختن Intent جدید یا دورزدن Policy ندارد.

### ۵.۲ Desired State و Reconciliation

تنظیمات پروژه، رودمپ مصوب، محیط مطلوب و Deployment هدف، Desired State هستند. وضعیت GitHub، Runner، سرور، Test و Deployment، Observed State است. Reconciler اختلاف را تشخیص می‌دهد و یکی از این خروجی‌ها را می‌سازد:

- اقدام کم‌ریسک مجاز و خودکار؛
- پیشنهاد اصلاح با اثر، هزینه، ریسک و Rollback؛
- درخواست تأیید؛
- Block همراه علت و Runbook.

این الگو از کنترل‌لوپ‌های Kubernetes الهام می‌گیرد که وضعیت جاری را به وضعیت مطلوب نزدیک می‌کنند، بدون آنکه Hero یک Kubernetes سفارشی شود.[^5]

## ۶. نقشهٔ بخش‌های Back Office

### ۶.۱ سطح سراسری Hero

1. **Portfolio Home** — فهرست و نقشهٔ تمام پروژه‌های مجاز، Health، فاز جاری، هزینهٔ Token، آخرین/بعدی Task، تصمیم منتظر، Alert و خروجی تازه.
2. **Decision & Approval Inbox** — همهٔ تأییدها، پیشنهادها، استثناها و موارد منقضی‌شونده.
3. **Hero Assistant** — پرسش و فرمان دربارهٔ کل Hero با رعایت Scope دسترسی.
4. **Global Operations** — سلامت سرویس‌های Hero، Queue، Runner، Provider، Storage، Backup و Global Stop.
5. **Users & Access** — فقط برای مالک؛ دعوت، حذف، Role و تخصیص پروژه.
6. **Project Registry** — ایجاد، Import، Clone، Archive و حذف فقط برای مالک.
7. **Global Catalog** — کاتالوگ قابلیت‌های Hero، Team template، Role template، Provider، مدل AI، Policy template و Project template.
8. **Knowledge Proposals** — پیشنهادهای انتقال دانش میان پروژه‌ها با مبدأ، مقصد، Sanitization و Approval.
9. **Audit & Compliance** — جست‌وجوی تغییرات، دسترسی، Reveal Secret، فرمان، Approval، Deploy و Export.
10. **System Settings** — قواعد تغییرناپذیر، زبان، Retention پیش‌فرض، سیاست مدل، سقف‌های سراسری و وضعیت Integrationها.

### ۶.۲ سطح هر پروژه در Product Studio

1. **Overview** — خلاصهٔ مدیریتی و دستیار مسلط بر پروژه.
2. **Roadmap & Delivery Graph** — هدف، Initiative، Capability، Milestone، Release، Task، وابستگی، Critical Path و Forecast.
3. **Work** — Backlog، Task، Run، Retry، Blocker، Handoff و Evidence.
4. **Teams & Roles** — اصول تیم، اعضای منطقی، مدل AI، حافظه، عملکرد و Assignmentها.
5. **Conversations** — گفتگوهای پروژه، تیم، Role و Contextهای متصل.
6. **Knowledge & Documents** — اسناد، تصمیم‌ها، Research، Requirement، Upload و Provenance.
7. **System Catalog** — Component، Service، Repository، API، Database، Environment، Server، Dependency و Owner.
8. **Quality & Evaluation** — Test، Security، AI eval، Completeness، Rework و Acceptance.
9. **Environments & Deployments** — Development، Test، Production، Release train، Change و Rollback.
10. **Artifacts & Delivery** — Build، Package، Image، SBOM، Attestation، Manual و Delivery Bundle.
11. **Cost & Models** — Token مصرفی، Cap، Forecast، Provider/Model و تفکیک Team/Role/Task/Run.
12. **Notifications & Activity** — Inbox فیلترشدهٔ همان پروژه و Timeline.
13. **Project Settings** — Effective configuration، Approval policy، Automation، Retention، Language، Integrations و Secrets.

## ۷. Portfolio Home و مدل Drill-down

صفحهٔ اول باید پاسخ پنج سؤال را بدون ورود به جزئیات بدهد:

1. چه پروژه‌هایی داریم و هرکدام کجای مسیر است؟
2. کدام پروژه یا بخش نیازمند اقدام من است؟
3. سلامت و ریسک واقعی چیست و چرا؟
4. چه مقدار Token مصرف شده و در برابر چه خروجی‌ای؟
5. آخرین تغییر قابل‌تحویل چیست و گام بعدی کدام است؟

کارت هر پروژه حداقل این موارد را دارد:

- فاز و Milestone جاری، درصد پیشرفت مبتنی بر گراف و Confidence؛
- Health کلی و زیرامتیازهای Delivery، Quality، Operations، Security و AI؛
- مصرف Token دوره/کل، سقف و Forecast؛
- آخرین Task تکمیل‌شده و Taskهای بعدی؛
- تعداد Blocker، تصمیم منتظر، Alert بحرانی و Approval نزدیک انقضا؛
- آخرین Artifact/Release/گزارش؛
- وضعیت Development/Test/Production و آخرین Deploy؛
- یک ورودی مستقیم به Project Assistant.

هر عدد قابل Drill-down است. برای مثال کلیک روی Token از Portfolio به Project، سپس Team، Role، Task، Run، Provider و Model می‌رود. هیچ KPI نباید به یک عدد بدون Source تبدیل شود.

### ۷.۱ Health هوشمند

Health یک حدس زبانی AI نیست. موتور آن ابتدا سیگنال‌های قطعی را نرمال می‌کند و سپس AI فقط علت و پیشنهاد را توضیح می‌دهد:

```text
Project Health =
  30% Delivery confidence
+ 25% Quality and goal-fit
+ 15% Operational reliability
+ 15% Security and compliance
+ 10% Cost efficiency
+  5% Knowledge and documentation freshness
```

قواعد حیاتی وزن را Override می‌کنند: Production outage، Critical vulnerability، Global Stop، نقض جداسازی پروژه، Artifact نامعتبر یا عبور از Hard Cap، وضعیت را قرمز می‌کند. وزن‌ها در نسخهٔ آینده قابل تنظیم‌اند، اما تاریخچه باید با نسخهٔ فرمول محاسبه شود.

Health در چهار سطح `healthy / attention / at-risk / critical` نشان داده می‌شود و همیشه شامل `drivers`، `confidence`، `freshness` و `recommended_actions` است. مفهوم Health Update و کهنه‌شدن آن از الگوی Linear گرفته می‌شود.[^1]

## ۸. هویت، دسترسی و مالکیت

### ۸.۱ Roleهای انسانی نسخهٔ اول

فقط سه Role انسانی وجود دارد؛ Role سفارشی فعلاً تعریف نمی‌شود:

| قابلیت | Owner | Project Admin | Viewer |
|---|---:|---:|---:|
| مشاهدهٔ همهٔ پروژه‌ها | بله | فقط تخصیص‌یافته | فقط تخصیص‌یافته |
| ایجاد یا Import پروژه | بله | خیر | خیر |
| Clone پروژه | بله | خیر | خیر |
| Archive/حذف پروژه | بله | خیر | خیر |
| افزودن/حذف کاربر و تخصیص دسترسی | بله | خیر | خیر |
| تغییر هر تنظیم در پروژهٔ تخصیص‌یافته | بله | بله | خیر |
| فرمان، اجرا، Retry و توقف پروژه | بله | بله | خیر |
| تأیید مرحله، Deploy و خروجی نهایی | بله | بله | خیر |
| ثبت/تعویض/Rotate/Revoke Secret پروژه | بله | بله | خیر |
| Reveal مقدار فعلی Secret | بله، با Step-up | خیر | خیر |
| تغییر قواعد تغییرناپذیر Hero | فقط در محدودهٔ مجاز | خیر | خیر |

«Admin کامل پروژه» به معنی اختیار همهٔ تغییرات در همان پروژه است، جز عملیات ذاتاً سراسری: مدیریت کاربران، ایجاد/حذف پروژه، قواعد تغییرناپذیر Hero و Reveal Secret موجود. هر درخواست API علاوه بر Role باید رابطهٔ دسترسی کاربر به `project_id` را بررسی کند؛ deny-by-default و بررسی روی هر درخواست الزامی است.[^10]

### ۸.۲ قواعد تغییرناپذیر Hero

حتی Owner نمی‌تواند این قواعد را با یک ویرایش عادی خاموش کند؛ تغییرشان نیازمند Change نسخه‌دار و مسیر جداگانه است:

- جداسازی داده، Storage، Memory، Secret و Execution پروژه‌ها؛
- ممنوعیت ثبت یا نمایش Secret در Log، Prompt، Artifact و گفتگو؛
- Event/Audit append-only و منع پاک‌کردن بی‌ردپای تاریخ؛
- اعتبارسنجی Authorization Snapshot، Step ID و نسخهٔ سند پیش از Dispatch؛
- تقدم Global Stop و Project Stop؛
- گیت مستقل برای Production، تخریب، هزینهٔ بیرونی، Secret، پیام بیرونی و عملیات برگشت‌ناپذیر؛
- الزام Evidence، Artifact identity و قابلیت Rollback برای Release؛
- Fail-closed در نبود Policy، Scope یا Approval معتبر.

## ۹. تعریف، Import و Clone پروژه

### ۹.۱ Project Intake

مالک یک پروژه را با این ورودی‌ها آغاز می‌کند:

- توضیح آزاد مسئله، هدف، کاربران و نتیجهٔ مطلوب؛
- PDF، Word، Excel، تصویر، متن، ZIP، لینک وب یا Repository GitHub؛
- انتخاب یا اتصال سرور؛
- محدودیت زمان، Token، فناوری، امنیت یا خروجی؛
- حالت همکاری: تأیید مرحله‌ای یا حرکت خودکار تا خروجی نهایی.

فایل‌ها در Private Storage خود Hero نگهداری می‌شوند. Pipeline دریافت فایل باید allowlist پسوند و MIME/signature، محدودیت اندازه، نام تصادفی، ذخیره خارج از web root، اسکن بدافزار، استخراج Sandbox و محافظت در برابر ZIP bomb داشته باشد.[^11] محتوای وب، سند و Repository «دادهٔ نامطمئن» است و هر دستور درون آن باید در برابر prompt injection بی‌اثر باشد.[^12]

### ۹.۲ خروجی Discovery و پیشنهاد اولیه

Hero پیش از Dispatch اجرایی یک `Project Foundation Proposal` نسخه‌دار می‌سازد:

- Product brief و تعریف Done؛
- فرضیه‌ها، سؤال‌های باز، ریسک‌ها و تحقیق لازم؛
- ساختار اجزای محصول و Architecture hypothesis؛
- Team/Role plan؛
- Model/Provider routing؛
- Roadmap و Approval template؛
- Token budget و Capacity profile؛
- Environment/Repository/Server plan؛
- Security، privacy، retention و delivery requirements؛
- Deliverable matrix.

مالک Foundation را تأیید می‌کند؛ پس از آن Owner یا Admin می‌تواند نسخه‌های بعدی آن را تغییر دهد. تغییر مؤثر همیشه `diff + impact + migration + rollback` دارد.

### ۹.۳ Import پروژهٔ موجود

Import با دسترسی read-only و Inventory آغاز می‌شود. Hero Repository، branch، dependency، test، CI، schema، environment، deployment و اسناد را شناسایی می‌کند و `Adoption Plan` می‌سازد. تا تأیید، هیچ Refactor، Commit، Secret change یا Deploy رخ نمی‌دهد.

### ۹.۴ Clone و Template

مالک می‌تواند پروژه‌ای را از Template یا پیکربندی پروژهٔ قبلی بسازد. Clone فقط ساختار، سیاست قابل‌انتقال، Team/Role template، roadmap template و انتخاب‌های فنی عمومی را می‌برد و **Secret، داده، فایل خصوصی، Memory، Conversation، Run، Audit و تاریخچه را منتقل نمی‌کند**.

## ۱۰. تنظیمات پروژه و Policy Pack

### ۱۰.۱ سلسله‌مراتب تنظیمات

هر مقدار Effective از این زنجیره حل می‌شود:

```text
Global invariant
  → Hero default
    → Project template
      → Project override
        → Environment override
          → Team override
            → Role override
              → Task/Run override (اگر Policy اجازه دهد)
```

صفحهٔ تنظیمات برای هر مقدار باید `effective value`، `source layer`، `version`، `changed by`، `changed at`، `reason` و `impact` را نشان دهد. Admin باید بتواند Override را حذف کند تا مقدار به ارث‌رسیده فعال شود.

### ۱۰.۲ Project Policy Pack

Hero در شروع پروژه یک بستهٔ پیشنهادی می‌سازد و Owner/Admin آن را اصلاح می‌کند:

- Automation و Approval؛
- مدل AI برای Team/Role/Task type و fallback؛
- Token cap؛
- Internet/tool allowlist؛
- Retention و data classification؛
- Quality/Evaluation gates؛
- Branch/merge/release/deployment؛
- Production access؛
- Notification severity؛
- Scheduling priority و concurrency؛
- Artifact/delivery requirements.

### ۱۰.۳ پیشنهاد بهبود در طول پروژه

Advisor وضعیت را پیوسته تحلیل می‌کند و Proposal می‌سازد: تغییر رودمپ، Role/Model، Budget allocation، Test، Architecture، Retention یا زیرساخت. هر Proposal دارای دلیل، Evidence، اثر مورد انتظار، هزینه، ریسک، تغییر دقیق، گیت لازم، Rollback و تاریخ انقضاست. Policy تعیین می‌کند Proposal فقط نمایش داده شود، پس از تأیید اجرا شود یا در ردهٔ کم‌ریسک خودکار اعمال شود.

## ۱۱. Team، Role و Agent Identity

مدل پیشنهادی میان سادگی و توسعه‌پذیری تعادل ایجاد می‌کند:

1. **Team** هویت پایدار، مأموریت، اصول، حافظه و KPI دارد؛
2. **Role Profile** تخصص، مسئولیت، ابزار، Model policy و معیار کیفیت پایدار دارد؛
3. **Agent Assignment** اجرای موقت یک Role روی Task/Run مشخص است؛
4. **Persistent Specialist Profile** فقط زمانی ساخته می‌شود که نیاز واقعی به تخصص و سابقهٔ جداگانه وجود داشته باشد.

بنابراین از ابتدا برای هر عنوان شغلی ده‌ها Agent دائمی ساخته نمی‌شود، ولی معماری در آینده چند متخصص مستقل در یک Team را محدود نمی‌کند. ارزیابی در سطح Team، Role، Specialist و Run قابل جمع‌بندی است؛ اما امتیاز یک اجرای ضعیف، هویت پایدار تیم را بی‌دلیل بازنویسی نمی‌کند.

### ۱۱.۱ ثبات و تکامل

هویت پایدار شامل Mission، principles، working agreements، known strengths، known failure modes، approved lessons و memory policy است. بهبود با Proposal و Evaluation رخ می‌دهد. تغییر Prompt یا Model هر Role یک نسخهٔ جدید می‌سازد و قبل از فعال‌شدن با مجموعهٔ ارزیابی همان Role سنجیده می‌شود.

## ۱۲. گفتگو، فرمان و حافظه

### ۱۲.۱ پنج Context گفتگو

1. دستیار کل Hero؛
2. دستیار اختصاصی پروژه؛
3. گفت‌وگو با Team؛
4. گفت‌وگو با Role یا Agent Profile؛
5. گفت‌وگوی متصل به Task، Run، خروجی، Alert، Approval یا Artifact.

هر Thread دارای `scope`، شرکت‌کننده، Project، Context entity، Model version، memory sources، citations، permissions و retention policy است. جابه‌جایی Context باید آشکار باشد؛ دستیار پروژه اجازهٔ استناد به دادهٔ پروژهٔ دیگر را ندارد.

### ۱۲.۲ انتخاب مدل گفتگو

Owner/Admin در تنظیمات پروژه و هر Context می‌تواند Provider/Model، سقف Token، سبک پاسخ و Tool policy را تعیین کند. پاسخ باید نسخهٔ مدل و منابع درون Hero را ثبت کند. اگر Model خطا، کندی یا افت Evaluation داشت، Hero جایگزین پیشنهاد می‌کند؛ تعویض خودکار Model در این نسخه فقط پس از **تأیید Owner** رخ می‌دهد. تغییر دستی مدل پروژه همچنان در اختیار Admin است.

### ۱۲.۳ فرمان از گفتگو

گفتگو می‌تواند Query یا Command باشد. فرمان به یک `Command Intent` ساختاریافته تبدیل می‌شود:

- فعل و Target دقیق؛
- Scope پروژه و محیط؛
- diff یا خروجی مورد انتظار؛
- اثر، ریسک و برآورد Token؛
- فایل/سرویس/دادهٔ درگیر؛
- تست، Evidence و Rollback؛
- Authorization و Approval لازم.

فرمان کم‌ریسک می‌تواند بدون Preview اجرا شود، اگر Policy فعال و محدودیت‌های آن منطبق باشند؛ با این حال Command و نتیجه در Timeline ثبت می‌شود. فرمان پرریسک به کارت Preview/Approval تبدیل می‌شود. اجراهای متوقف‌شده باید قابل resume باشند؛ الگوی HITL رسمی OpenAI نیز توقف Run، نگهداری state و ادامه پس از تصمیم را توصیه می‌کند.[^9]

### ۱۲.۴ Memory

Memory چهار سطح دارد: Hero عمومی، Project، Team و Role/Profile. اقلام حافظه دارای provenance، confidence، sensitivity، expiry و links به Evidence هستند. Owner/Admin می‌تواند Memory غلط را:

- اصلاح کند؛
- غیرفعال کند؛
- با نسخهٔ جدید `supersede` کند؛
- از Context retrieval خارج کند.

حذف بی‌ردپا ممنوع است. نسخهٔ اصلاح‌شده فعال و تاریخچه برای Audit باقی می‌ماند.

### ۱۲.۵ Knowledge Proposal بین پروژه‌ای

هیچ Memory پروژه‌ای مستقیم به پروژهٔ دیگر منتقل نمی‌شود. Hero یک Proposal شامل درس عمومی، شواهد، مبدأ، طبقه‌بندی، بخش‌های حذف‌شده، مقصد و تعارض‌های احتمالی می‌سازد. Owner یا Admin دارای دسترسی مقصد می‌تواند آن را برای همان پروژه بپذیرد. Secret، دادهٔ کاربر، جزئیات تجاری خصوصی و متن بدون Sanitization قابل انتقال نیست.

## ۱۳. Workflow، Approval و خودکارسازی

### ۱۳.۱ حالت‌های عمل

هر Action type در هر Scope یکی از این حالت‌ها را دارد:

- `observe` — فقط مشاهده و گزارش؛
- `suggest` — ساخت Proposal؛
- `approve-once` — تأیید هر اجرا؛
- `preauthorized` — اجرا در محدودهٔ مجوز از پیش تعریف‌شده؛
- `automatic` — اجرای مستقیم عملیات کم‌ریسک؛
- `prohibited` — ممنوع.

### ۱۳.۲ Approval Template

Hero بر اساس ریسک پروژه، محیط و نوع خروجی الگوی پیش‌فرض پیشنهاد می‌دهد. Owner/Admin آن را ویرایش می‌کند. مجوز Production می‌تواند برای بازه، پروژه یا نوع تغییر از پیش تعریف شود و باید حداقل این حدود را داشته باشد:

- Project و Environment؛
- Change class و paths/services مجاز؛
- شروع/پایان زمانی و deployment window؛
- حداکثر تعداد Deploy؛
- branch/tag و Artifact digest؛
- Test/Security gates؛
- max token و منع spend بیرونی؛
- rollback plan و health threshold؛
- approver و revocation condition.

Approval مبهم، منقضی، مربوط به نسخهٔ دیگر یا خارج از Scope معتبر نیست. GitHub Environments نیز نشان می‌دهد که protection rule و approval محیط باید پیش از دسترسی job به Secret محیط اعمال شود.[^4]

### ۱۳.۳ State Machine سرتاسری پروژه

```text
idea → intake → discovery → foundation-proposed → authorized
→ planned → building → verifying → release-ready
→ deploying → operating → improving → retiring
```

هر transition دارای precondition، actor، authorization، evidence، timeout و compensation است. Workflow بادوام باید پس از crash، restart یا قطعی Provider از checkpoint معتبر ادامه دهد، نه آنکه کار دو بار اجرا شود.[^6]

## ۱۴. Scheduler و اجرای هم‌زمان

سیاست اولیه برای چند پروژه:

- Weighted Fair Queue با Priority قابل تنظیم توسط Owner؛
- اولویت پیش‌فرض `normal`؛
- حداکثر دو Run سنگین هم‌زمان برای هر پروژه؛
- Aging برای جلوگیری از گرسنگی پروژهٔ کم‌اولویت؛
- reservation جدا برای کارهای کوتاه/بحرانی؛
- lock انحصاری برای Deploy، migration و تغییر shared resource؛
- محدودیت Provider، Model، Runner، Token و Server؛
- قابلیت Pause پروژه بدون از دست‌رفتن state.

Scheduler ابتدا feasibility را با Policy، ظرفیت و Lock می‌سنجد، سپس Run را رتبه‌بندی می‌کند؛ این تفکیک از الگوی Schedulerهای Nomad و Kubernetes می‌آید.[^5] Owner می‌تواند اولویت را تغییر دهد؛ Hero باید اثر احتمالی آن بر زمان سایر پروژه‌ها را قبل از اعمال نشان دهد.

## ۱۵. Catalog همهٔ اجزای سیستم

System Catalog باید پاسخ دهد «چه چیزی داریم، مالک آن کیست، کجا اجرا می‌شود، به چه چیز وابسته است و اکنون چه وضعی دارد؟» موجودیت‌های اصلی:

- Product/Project، Objective، Initiative، Capability و Release؛
- Application، Component، Service، Worker و Library؛
- Repository، Branch policy و Workflow؛
- API، Event، Database، Schema، Queue و Storage؛
- Environment، Server، Node، Runtime و Deployment؛
- Team، Role، Specialist Profile و Assignment؛
- Provider، AI Model، Tool، Prompt/Policy version و Eval suite؛
- Document، Decision، Knowledge، Evidence و Artifact؛
- Dependency، owner، lifecycle و criticality.

Backstage نشان می‌دهد کاتالوگ مرکزی زمانی ارزشمند است که metadata نزدیک به کد و رابطهٔ مالکیت/وابستگی روشن باشد.[^3] در Hero، بخشی از metadata از Repository کشف می‌شود و بخشی در Control Plane مدیریت می‌گردد؛ اختلاف آن‌ها یک Drift قابل رسیدگی است.

## ۱۶. مدیریت سرور و محیط

### ۱۶.۱ مدل محیط

نسخهٔ اول فقط سه Environment استاندارد دارد: `development`، `test` و `production`. Staging/Demo/QA سفارشی فعلاً افزوده نمی‌شود؛ QA می‌تواند Gate در Test باشد.

### ۱۶.۲ اتصال سرور

Owner/Admin برای پروژه IP یا domain، نوع دسترسی و Credential را ثبت می‌کند. Hero پس از مجوز:

1. connectivity و prerequisites را بررسی می‌کند؛
2. یک bootstrap plan با checksum می‌سازد؛
3. `Hero Node Agent` پروژه‌ای را نصب/ثبت می‌کند؛
4. Agent با TLS و token کوتاه‌عمر **از سرور به Control Plane اتصال outbound** برقرار می‌کند؛
5. capability، capacity، heartbeat و observed state را گزارش می‌دهد؛
6. فقط command امضاشده و scopeشده را اجرا می‌کند.

الگوی outbound Edge Agent سطح حمله را نسبت به بازکردن عمومی endpoint روی هر سرور کاهش می‌دهد.[^7] Agentهای Development/Test/Production هویت و Policy جدا دارند؛ Production credential هرگز در Runner توسعه قرار نمی‌گیرد.

### ۱۶.۳ Secret

Secretها در Secret Store رمزگذاری‌شده نگهداری می‌شوند. Admin می‌تواند Secret پروژه را ثبت، جایگزین، Rotate یا Revoke کند، اما مقدار موجود را Reveal نمی‌کند. Owner می‌تواند Reveal کند، مشروط به:

- MFA و re-authentication همان لحظه؛
- دلیل و Scope؛
- نمایش کوتاه‌مدت و عدم cache؛
- watermark/session binding در صورت امکان؛
- Audit و Notification؛
- منع نمایش در export، گفتگو و log.

چرخهٔ عمر Secret باید ایجاد، توزیع کم‌دامنه، rotation، revocation و expiration را پوشش دهد.[^13]

## ۱۷. Production، داده و حریم خصوصی

در زمان توسعه نباید دادهٔ واقعی حساس لازم باشد. پس از بهره‌برداری، Hero به‌صورت پیش‌فرض فقط این موارد را می‌بیند:

- health check و availability؛
- metricهای aggregate؛
- trace metadata با شناسه‌های pseudonymous؛
- log پاک‌سازی‌شده؛
- deployment/release metadata؛
- error fingerprint بدون payload حساس.

مشاهدهٔ payload، row، فایل یا محتوای واقعی کاربر یک `Production Data Access` جداگانه است: زمان‌دار، least-privilege، read-only پیش‌فرض، دارای دلیل، Approval و Audit. این داده به‌طور پیش‌فرض در Prompt، Conversation، Memory، Evaluation dataset یا Export وارد نمی‌شود. اگر استفادهٔ AI واقعاً لازم شد، Proposal جدا شامل minimization/redaction، مدل مجاز، محل پردازش و حذف پس از کار لازم است. اصول Privacy و کنترل انسانی برای Agentهای قابل اعتماد نیز در پژوهش Anthropic و NIST محور اصلی‌اند.[^14]

## ۱۸. GitHub، Release و خروجی قابل‌انتقال

GitHub تنها Git provider نسخهٔ اول است. هر Release باید از Commit/Tag مشخص، نتیجهٔ Test، Security evidence و Artifact digest ساخته شود. Artifact attestation و provenance امکان بررسی منشأ، workflow و commit سازنده را فراهم می‌کند.[^4][^15]

### ۱۸.۱ Delivery Bundle

«دریافت خروجی» فقط دانلود source code نیست. ماتریس تحویل بسته به نوع پروژه تعیین می‌شود و بستهٔ نهایی حداقل شامل این موارد است:

- Source repository و tag/commit؛
- build artifact یا container image؛
- checksum، provenance/attestation و در صورت امکان SBOM؛
- environment-variable contract بدون Secret؛
- migration و seed امن؛
- deployment manifest/script؛
- راهنمای نصب، upgrade، rollback، backup و restore؛
- architecture، operations و troubleshooting docs؛
- test/security/evaluation report؛
- فهرست dependency و license؛
- release notes و known limitations؛
- portability verification روی یک target تمیز.

Owner یا Project Admin هر دو می‌توانند خروجی نهایی را `accepted` اعلام کنند. Acceptance هویت فرد، نسخهٔ Artifact، معیارها و استثناهای پذیرفته‌شده را ثبت می‌کند و جایگزین Evidence فنی نمی‌شود.

### ۱۸.۲ انتقال سرور

قابلیت انتقال باید در طول توسعه حفظ شود، نه در پایان اضافه گردد:

- configuration بیرون از image و بدون path میزبان؛
- Secretها خارج از Repository/Bundle؛
- داده دارای export/restore نسخه‌دار؛
- dependencyهای زیرساختی در manifest؛
- stateful componentها دارای migration plan؛
- restore rehearsal دوره‌ای در Test؛
- هیچ license یا سرویس مخفی مانع استقرار روی سرور دیگر نباشد.

## ۱۹. ارزیابی عملکرد Team و Role

عملکرد نباید به تعداد Task یا سرعت خام تقلیل یابد. سه محور اصلی نسخهٔ اول:

1. **Goal Fit & Accuracy:** تطابق خروجی با هدف، Requirement، Acceptance و Evaluation؛
2. **Token Efficiency:** Token مصرفی در برابر خروجی پذیرفته‌شده و کیفیت؛
3. **Error & Rework:** خطا، reopen، retry، rollback، defect escape و میزان دوباره‌کاری.

شاخص‌های مکمل: cycle time، predictability، blocked time، evidence completeness، test pass stability، security findings، release success، استقلال، کیفیت Handoff و freshness دانش.

### ۱۹.۱ Scorecard چندسطحی

هر Score قابل مشاهده در سطح Portfolio → Project → Team → Role/Profile → Task → Run است. هر عدد دارای بازه، حجم نمونه، Confidence، benchmark داخلی و لینک Evidence است. مقایسهٔ دو Team با نوع کار متفاوت بدون normalization ممنوع است.

### ۱۹.۲ Feedback و Evaluation

پس از Milestone، Release یا خروجی مهم، Hero امکان Feedback کوتاه مالک را عرضه می‌کند؛ پاسخ اختیاری است. Feedback مستقیماً حقیقت مطلق یا مجازات نیست؛ به‌عنوان signal برچسب‌خورده وارد Evaluation می‌شود. ارزیابی ترکیبی از test قطعی، rule، human review و AI judge است. AI judge باید با نمونه‌های انسانی کالیبره شود؛ الگوی Evaluation آنلاین و آفلاین و هم‌ترازی judge با بازخورد انسان در LangSmith نیز بر همین حلقه تأکید دارد.[^9]

## ۲۰. Token Cost و بودجه

در این نسخه فقط Token و مصرف AI حسابداری می‌شود؛ هزینهٔ سرور، Cloud و ابزار پولی هنوز در Scope نیست. Ledger هر invocation حداقل این ابعاد را ثبت می‌کند:

- Project، Team، Role/Profile، Task، Run؛
- Provider، Model و operation type؛
- input، cached input، output و total tokens؛
- timestamp، policy version و success/failure؛
- allocation به Artifact یا Outcome.

Soft threshold هشدار و Proposal می‌سازد. Hard cap از **شروع invocation جدید** جلوگیری می‌کند، مگر Owner/Admin سقف پروژه را تغییر دهد؛ Run در نقطهٔ امن Pause می‌شود. Cap در سطح Project، Team، Role و Provider قابل تعریف است و مقدار مصرف‌شده و Forecast همیشه دیده می‌شود. اگر چند سقف منطبق باشند، محدودترین سقف مؤثر است.

## ۲۱. Notification & Decision Inbox

اعلان نسخهٔ اول فقط داخل Back Office است، اما باید یک Work Queue مدیریتی واقعی باشد، نه زنگ ساده. هر item شامل:

- severity، category، project، environment و owner؛
- summary، evidence، impact و recommended action؛
- deadline/SLA، freshness و escalation state؛
- دکمه‌های approve/reject/snooze/assign/open conversation/run fix؛
- ارتباط با Task، Run، Deployment، Budget یا Health driver؛
- deduplication key و incident grouping.

Viewهای اصلی: `Needs my decision`، `Critical now`، `Upcoming`، `Automation performed`، `Budget`، `Delivery` و `Resolved`. Notification تکراری گروه‌بندی می‌شود؛ Alert حل‌شده خودکار بسته می‌شود ولی Event آن باقی می‌ماند. Owner/Admin می‌تواند threshold و digest داخل سامانه را برای هر پروژه تنظیم کند.

## ۲۲. Observability، Audit و Explainability

هر Command یک `correlation_id` دارد که Conversation → Command Intent → Approval → Workflow → Task → Run → Tool call → Artifact → Deployment را متصل می‌کند. OpenTelemetry سه سیگنال Trace، Metric و Log را با context مشترک مرتبط می‌کند و مبنای مناسبی برای توضیح «چرا این وضعیت رخ داد» است.[^8]

### ۲۲.۱ تفکیک سه تاریخچه

- **Activity Timeline:** روایت قابل فهم برای مدیر؛
- **Execution Trace:** جزئیات فنی Run و وابستگی‌ها؛
- **Audit Log:** رویداد امنیتی و حاکمیتی append-only.

Audit حداقل ورود/MFA/recovery، تغییر دسترسی، Secret operation، Policy change، Approval، Production access، command، deploy، export و deletion request را ثبت می‌کند. Secret و محتوای حساس در log ممنوع‌اند.[^16]

## ۲۳. Retention پیشنهادی

Retention برای هر پروژه قابل تنظیم است، اما کاهش آن نباید الزام Audit یا Release evidence را نقض کند. پیش‌فرض نسخهٔ اول:

| داده | نگهداری پیش‌فرض |
|---|---:|
| سند canonical، تصمیم، Release و Artifact metadata | عمر پروژه + دورهٔ archive |
| Audit امنیتی و Authorization metadata | ۲ سال |
| Conversation نهایی | ۱۸۰ روز |
| Prompt/Response خام AI | ۹۰ روز |
| Run log و trace جزئی | ۹۰ روز |
| metric خام | ۹۰ روز |
| metric تجمیعی و KPI | عمر پروژه |
| فایل موقت و Artifact ناموفق | ۳۰ روز |
| فایل استخراج‌شدهٔ موقت از Upload | ۷ روز |
| دادهٔ خام Production در Break-glass | بدون نگهداری، مگر مجوز صریح |

پیش از حذف، Hero در صورت نیاز digest غیرحساس، شناسه، هزینه، نتیجه و provenance را حفظ می‌کند. صفحهٔ Retention وضعیت Policy، حجم، موعد حذف، hold و آخرین cleanup را نشان می‌دهد. تغییر Policy نسخه‌دار و قابل Audit است؛ Legal hold یا Incident hold حذف را متوقف می‌کند.

## ۲۴. احراز هویت و بازیابی مالک

ورود با ایمیل و رمز عبور و MFA برای Owner/Admin الزامی و برای Viewer قابل‌فعال‌سازی است. عملیات پرخطر به step-up authentication نیاز دارد.[^13]

بازیابی Owner از **ایمیل اصلی تأییدشده** آغاز می‌شود، اما ایمیل به‌تنهایی نباید معادل تصاحب کامل Control Plane باشد:

1. لینک/کد یک‌بارمصرف کوتاه‌عمر با rate limit؛
2. Recovery code آفلاین یا تأیید از کنسول خصوصی سرور برای از‌دست‌رفتن MFA؛
3. ابطال sessionهای قبلی و rotation tokenهای بازیابی؛
4. اعلان آشکار در ورودهای موجود و Audit؛
5. cooldown برای Reveal Secret و عملیات Production پس از بازیابی؛
6. عدم افشای وجود حساب برای درخواست ناشناس.

NIST برای حساب‌های سطح AAL2 داشتن چند روش بازیابی یا ترکیب recovery code با عامل دیگر را توصیه می‌کند؛ ازاین‌رو ایمیل مسیر اصلی و قابل استفاده است، ولی تنها عامل اعتماد نهایی نیست.[^17]

## ۲۵. زبان و دستگاه هدف

- رابط از ابتدا فارسی و انگلیسی دارد؛
- locale کاربر، locale پیش‌فرض پروژه و زبان هر خروجی جدا تنظیم می‌شوند؛
- شناسه‌های فنی، API، code symbol و enum به انگلیسی پایدار می‌مانند؛
- جست‌وجو فارسی/انگلیسی و نمایش RTL/LTR ترکیبی را پشتیبانی می‌کند؛
- نسخهٔ اول Desktop-first است؛
- Responsive پس از تثبیت تجربهٔ دسکتاپ افزوده می‌شود؛
- اپلیکیشن موبایل مستقل Hero در Scope نیست.

## ۲۶. مدل دادهٔ هسته

موجودیت‌های جدید/تکمیل‌شونده:

```text
HeroInstance
User ── ProjectGrant ── Project
Project ── ProjectPolicyVersion ── EffectiveSetting
Project ── RoadmapNode ── WorkItem ── Run ── Evidence
Project ── SystemEntity ── Dependency
Project ── Team ── RoleProfile ── AgentAssignment
Conversation ── ContextBinding ── CommandIntent
CommandIntent ── AuthorizationSnapshot ── Approval ── WorkflowExecution
Project ── Environment ── Server ── NodeAgent ── Deployment
Release ── Artifact ── Provenance ── DeliveryBundle ── Acceptance
Notification ── RelatedEntity
Evaluation ── ScorecardMetric
KnowledgeItem ── KnowledgeProposal
SecretReference
AuditEvent / DomainEvent / TelemetryLink
```

قواعد داده:

- همهٔ موجودیت‌های project-scoped دارای `project_id` اجباری‌اند؛
- تغییرات معنایی دارای version و optimistic concurrency هستند؛
- تاریخچهٔ حساس append-only یا superseded است؛
- Secret فقط reference است، نه field معمولی؛
- calculated field از canonical input بازسازی‌پذیر است؛
- Event contract دارای schema version و idempotency key است؛
- command و event از query projection جدا می‌مانند.

## ۲۷. قرارداد API و فرمان

API باید Command/Query را تفکیک کند:

- Queryها read model سریع و فیلترشده بر اساس ProjectGrant را می‌خوانند؛
- Commandها `actor`، `scope`، `expected_version`، `reason` و `idempotency_key` دارند؛
- عملیات پرخطر `authorization_snapshot_id` و `approval_id` معتبر می‌خواهند؛
- پاسخ Command شناسه و وضعیت Workflow را می‌دهد، نه موفقیت جعلی synchronous؛
- export، reveal، deploy، delete و production-access endpoint مستقل دارند؛
- همهٔ پاسخ‌های AI citation به Entity/Evidence داخلی دارند، یا صریحاً uncertainty را اعلام می‌کنند.

## ۲۸. الزامات غیرعملکردی

### ۲۸.۱ امنیت و جداسازی

- Project scope در API، query، cache، vector index، storage path، queue و runner enforce شود؛
- Runner و Node Agent حداقل دسترسی و credential کوتاه‌عمر داشته باشند؛
- ورودی بیرونی نامطمئن و Tool output غیرقابل اعتماد تلقی شود؛
- deny-by-default، egress policy و audit پوشش داده شوند.

### ۲۸.۲ قابلیت اتکا

- Command idempotent، Workflow resumable و retry policy bounded باشد؛
- هر عملیات تغییر state timeout، compensation یا manual recovery path داشته باشد؛
- Backup/restore خود Back Office و Project metadata آزموده شود؛
- loss of Provider یا Node Agent باعث گم‌شدن state نشود.

### ۲۸.۳ عملکرد

- Portfolio برای ۱۰۰ پروژه بدون query زنجیره‌ای طراحی شود؛
- Overview و Inbox از read model/aggregation استفاده کنند؛
- trace/log سنگین lazy-load و time-bound شود؛
- جست‌وجو entity-aware و permission-aware باشد.

### ۲۸.۴ دسترس‌پذیری و بومی‌سازی

- keyboard navigation، focus، contrast و status غیرمتکی به رنگ؛
- پشتیبانی درست از RTL/LTR و تاریخ/عدد locale؛
- متن فنی قابل کپی بدون تغییر شناسه.

## ۲۹. مرزبندی MVP، نسخهٔ کامل و خارج از Scope

### ۲۹.۱ Foundation ضروری پیش از هر پایلوت

1. Project boundary و سه Role انسانی؛
2. Portfolio Home و Product Studio routing؛
3. Project Registry، Intake و Foundation Proposal؛
4. Effective Settings و Policy Pack؛
5. Command/Approval/Workflow durable؛
6. Event/Audit/Notification backbone؛
7. Token ledger و Hard cap؛
8. Team/Role identity و Conversation contexts؛
9. Catalog اولیهٔ component/repository/environment/server؛
10. Development/Test connection و Artifact delivery پایه.

### ۲۹.۲ مرحلهٔ Operational

1. Hero Node Agent و server onboarding؛
2. Production preauthorization و deployment/rollback؛
3. Health Engine و Observability correlation؛
4. Evaluation و Team/Role scorecard؛
5. Delivery Bundle و portability verification؛
6. Retention و production data break-glass؛
7. Knowledge Proposal بین پروژه‌ای.

### ۲۹.۳ خارج از Scope نسخهٔ اول

- SaaS چندسازمانی؛
- Role انسانی سفارشی؛
- GitLab/Bitbucket؛
- Environment سفارشی؛
- کانال اعلان بیرونی؛
- حسابداری Cloud/server/tool؛
- اپ موبایل Hero؛
- استفادهٔ پیش‌فرض از دادهٔ واقعی Production برای AI.

## ۳۰. برنامهٔ گذار از Back Office فعلی

### فاز صفر — Contract و Inventory

- این سند پس از بازبینی به baseline فعال تبدیل شود؛
- API و UI فعلی با capability matrix نگاشت شوند؛
- موجودیت‌ها و eventهای تکراری حذف مفهومی شوند؛
- gap register و migration ADRها ساخته شوند.

### فاز یک — Portfolio Shell

- Project Registry، ProjectGrant و Portfolio read model؛
- صفحهٔ ورود Portfolio و اتصال به Product Studio؛
- Inbox یکپارچه و Audit query؛
- Effective Settings read-only با provenance.

### فاز دو — Command Center

- Command Intent، Policy Resolver، Approval و durable execution؛
- Project Assistant و Context conversation؛
- تنظیمات قابل‌ویرایش نسخه‌دار؛
- token ledger/cap و scheduler.

### فاز سه — Execution & Delivery

- server onboarding، Node Agent و سه محیط؛
- GitHub integration، build/release/deploy؛
- artifact provenance، delivery bundle و acceptance؛
- import پروژهٔ موجود.

### فاز چهار — Intelligence & Learning

- Health Engine، forecasting و recommendation؛
- Evaluation، performance scorecard و feedback؛
- Knowledge Proposal، retention و production privacy controls؛
- clone/template و advisor optimization loop.

هیچ فاز نباید Source of Truth موازی، فرمان UI-only یا bypass مستقیم Policy بسازد.

## ۳۱. معیارهای پذیرش طراحی

طراحی زمانی برای تبدیل به برنامهٔ پیاده‌سازی آماده است که:

- تمام قابلیت‌های هر سه Role در یک authorization matrix قابل‌تست ثبت شده باشد؛
- هر صفحه به entity، query و commandهای مشخص نگاشت شود؛
- lifecycle پروژه و command state machine دارای transition/error/compensation باشد؛
- Policy inheritance و conflict resolution بدون ابهام باشد؛
- Production، Secret، destructive، spend و external-message gates جدا بمانند؛
- Health، cost و performance formula نسخه‌دار و traceable باشد؛
- retention، backup، deletion و archive contract تعریف شده باشد؛
- server agent threat model و bootstrap/rotation/revocation طراحی شده باشد؛
- Delivery Bundle برای حداقل وب‌اپ، Backend و موبایل matrix داشته باشد؛
- migration از endpointها و projections فعلی بدون شکستن داده برنامه‌ریزی شود؛
- test strategy شامل authorization، isolation، replay، idempotency، recovery، prompt injection و portability باشد.

## ۳۲. تصمیم‌های بازِ غیرمسدودکننده

این موارد مانع تصویب معماری نیستند و باید هنگام طراحی تفصیلی هر ماژول با ADR حل شوند:

- فناوری دقیق durable workflow؛
- فناوری Secret Store و کلیدگذاری؛
- موتور Search/Vector و isolation index؛
- فرمول و benchmark نهایی Health/Performance پس از دادهٔ واقعی؛
- حداکثر Portfolio scale در استقرار خصوصی؛
- فرمت استاندارد Delivery Bundle برای هر stack؛
- مدت archive پس از پایان پروژه؛
- روش دقیق server-console fallback بازیابی Owner.

## ۳۳. منابع

[^1]: Linear، [Initiatives](https://linear.app/docs/initiatives)، [Initiative and project updates](https://linear.app/docs/initiative-and-project-updates) و [Projects](https://linear.app/docs/projects).
[^2]: Productboard، [Developer API introduction and entity model](https://developer.productboard.com/reference/introduction) و [Initiative glossary](https://developer.productboard.com/reference/glossary-initiative)؛ Atlassian، [Jira Product Discovery spaces](https://support.atlassian.com/jira-product-discovery/docs/create-a-jira-product-discovery-space/).
[^3]: Backstage، [Software Catalog](https://backstage.io/docs/features/software-catalog/) و [TechDocs](https://backstage.io/docs/next/features/techdocs/).
[^4]: GitHub، [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)، [Control deployments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments) و [Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations).
[^5]: Kubernetes، [Controllers](https://kubernetes.io/docs/concepts/architecture/controller/)، [Control plane to node communication](https://kubernetes.io/docs/concepts/architecture/control-plane-node-communication/)، [Scheduling Framework](https://kubernetes.io/docs/concepts/scheduling-eviction/scheduling-framework/) و [API Priority and Fairness](https://kubernetes.io/docs/concepts/cluster-administration/flow-control/)؛ HashiCorp، [How Nomad scheduling works](https://developer.hashicorp.com/nomad/docs/concepts/scheduling/how-scheduling-works).
[^6]: Temporal، [Durable execution documentation](https://docs.temporal.io/)؛ OpenAI Agents SDK، [Long-running agents](https://openai.github.io/openai-agents-python/running_agents/).
[^7]: Portainer، [Architecture and Edge Agent](https://docs.portainer.io/start/architecture) و [Environment management](https://docs.portainer.io/admin/environments).
[^8]: OpenTelemetry، [Observability primer](https://opentelemetry.io/docs/concepts/observability-primer/)، [Signals](https://opentelemetry.io/docs/concepts/signals/) و [Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/).
[^9]: LangSmith، [Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)، [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts) و [Improve LLM-as-judge evaluators](https://docs.langchain.com/langsmith/improve-judge-evaluator-feedback)؛ OpenAI Agents SDK، [Human in the loop](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/)، [Sessions](https://openai.github.io/openai-agents-js/guides/sessions/) و [Tracing](https://openai.github.io/openai-agents-python/tracing/).
[^10]: OWASP، [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)؛ GitHub، [Repository roles](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization).
[^11]: OWASP، [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
[^12]: OWASP، [LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).
[^13]: OWASP، [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) و [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
[^14]: Anthropic، [Building and evaluating trustworthy agents](https://www.anthropic.com/research/trustworthy-agents)؛ NIST، [Artificial Intelligence Risk Management Framework: Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf).
[^15]: SLSA، [Provenance](https://slsa.dev/spec/v1.2/provenance)، [Build track basics](https://slsa.dev/spec/v1.2/build-track-basics) و [Verifying artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts).
[^16]: OWASP، [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
[^17]: NIST SP 800-63B-4، [Authenticator recovery events](https://pages.nist.gov/800-63-4/sp800-63b/events/).

## ۳۴. قواعد تفسیر هنجاری

برای جلوگیری از برداشت سلیقه‌ای در توسعه، واژه‌های این سند معنای ثابت دارند:

- **باید / MUST:** الزام مسدودکننده؛ نبود آن مانع Done و Release است.
- **نباید / MUST NOT:** ممنوعیت مسدودکننده؛ پیاده‌سازی خلاف آن قابل پذیرش نیست.
- **بهتر است / SHOULD:** پیش‌فرض لازم؛ انحراف فقط با ADR، دلیل و تأیید مالک مجاز است.
- **می‌تواند / MAY:** قابلیت اختیاری که نبود آن مانع Done نسخهٔ مشخص‌شده نیست.

در صورت تعارض، ترتیب تقدم زیر اعمال می‌شود و سیستم باید fail-closed شود:

1. قواعد تغییرناپذیر امنیت، جداسازی و Global Stop؛
2. Authorization Snapshot فعال و دقیق؛
3. این سند با شناسه و نسخهٔ ثبت‌شده؛
4. ADR فعال و سند تخصصی فعال؛
5. برنامهٔ توسعه و Acceptance همان Work Package؛
6. Project Policy Version فعال؛
7. تنظیم مؤثر پایین‌تر در سلسله‌مراتب؛
8. متن گفتگو، Prompt یا پیشنهاد AI.

هیچ Prompt، تنظیم UI، مقدار Database یا فرمان گفتگو اجازه ندارد الزام سطح بالاتر را ضعیف کند. اگر دو سند فعال هم‌سطح تعارض داشتند، Dispatch متوقف و `Specification Conflict` ساخته می‌شود؛ Agent حق انتخاب دلخواه ندارد.

## ۳۵. کاتالوگ الزامات اجباری

شناسه‌های زیر قرارداد ردیابی توسعه، تست و پذیرش هستند. هر Pull Request مربوط به Back Office باید شناسه‌های پوشش‌داده‌شده را اعلام کند و Evidence تست به همان شناسه‌ها متصل شود.

### ۳۵.۱ حاکمیت و مرز محصول

| Requirement ID | الزام |
|---|---|
| `BO-GOV-001` | Hero باید یک نصب خصوصی تک‌سازمانی با یک Owner نهایی باشد؛ قابلیت SaaS چندسازمانی در Scope نیست. |
| `BO-GOV-002` | Back Office باید Control Plane سراسری و Product Studio باید Workspace پروژه‌ای روی همان منبع حقیقت باشد. |
| `BO-GOV-003` | Git باید منبع حقیقت محتوای canonical و Notion فقط Projection/Proposal قابل بازسازی باشد. |
| `BO-GOV-004` | Global Stop و Project Stop باید پیش از هر Dispatch جدید بررسی شوند. |
| `BO-GOV-005` | Production، تخریب، هزینهٔ بیرونی، Secret، پیام بیرونی و عملیات برگشت‌ناپذیر باید Gate مستقل داشته باشند. |
| `BO-GOV-006` | هر تغییر معنایی باید نسخه، actor، reason، diff، timestamp و مسیر rollback/supersede داشته باشد. |
| `BO-GOV-007` | تاریخچهٔ Audit، Authorization، Decision، Acceptance و Memory correction نباید بی‌ردپا ویرایش یا حذف شود. |
| `BO-GOV-008` | هر وضعیت مدیریتی باید تا Event، Evidence، Task، Run، Artifact و actor قابل ردیابی باشد. |

### ۳۵.۲ پروژه و Portfolio

| Requirement ID | الزام |
|---|---|
| `BO-PRJ-001` | Hero باید چند پروژهٔ مستقل را هم‌زمان مدیریت کند. |
| `BO-PRJ-002` | یک Project باید تمام web/mobile/backend/admin/data/infrastructure/documentation همان محصول را دربر گیرد. |
| `BO-PRJ-003` | فقط Owner باید بتواند Project را ایجاد، Import، Clone، Archive یا حذف کند. |
| `BO-PRJ-004` | Intake باید توضیح آزاد، PDF، Word، Excel، تصویر، متن، ZIP، لینک وب و GitHub Repository را بپذیرد. |
| `BO-PRJ-005` | Hero باید پیش از اجرا Project Foundation Proposal کامل و نسخه‌دار پیشنهاد دهد. |
| `BO-PRJ-006` | Owner/Admin باید بتواند حالت تأیید مرحله‌ای یا حرکت خودکار تا خروجی را در Policy تعیین کند. |
| `BO-PRJ-007` | Import پروژهٔ موجود باید ابتدا read-only inventory و Adoption Plan تولید کند. |
| `BO-PRJ-008` | Clone نباید Secret، داده، فایل خصوصی، Memory، Conversation، Run یا Audit مبدأ را منتقل کند. |
| `BO-PRJ-009` | Portfolio Home باید پروژه، رودمپ، Health، Token، Task اخیر/بعدی، تصمیم منتظر و خروجی تازه را نمایش دهد. |
| `BO-PRJ-010` | انتخاب Project از Portfolio باید Product Studio همان Project را باز کند. |

### ۳۵.۳ هویت و دسترسی

| Requirement ID | الزام |
|---|---|
| `BO-IAM-001` | Roleهای انسانی نسخهٔ اول باید دقیقاً Owner، Project Admin و Viewer باشند. |
| `BO-IAM-002` | فقط Owner باید بتواند کاربر و ProjectGrant را اضافه، حذف یا تغییر دهد. |
| `BO-IAM-003` | Project Admin باید در Projectهای تخصیص‌یافته اختیار کامل تغییر و اجرا داشته باشد، جز عملیات سراسری و Reveal Secret موجود. |
| `BO-IAM-004` | Viewer باید فقط دادهٔ Projectهای تخصیص‌یافته را بدون mutation ببیند. |
| `BO-IAM-005` | Owner باید همهٔ Projectها را ببیند و کنترل کند. |
| `BO-IAM-006` | Owner/Admin باید بتوانند خروجی نهایی Project را Accepted اعلام کنند. |
| `BO-IAM-007` | ایمیل و رمز عبور همراه MFA باید برای Owner/Admin اجباری باشد. |
| `BO-IAM-008` | بازیابی Owner باید از ایمیل اصلی تأییدشده آغاز و با عامل بازیابی دوم، ابطال Session و cooldown عملیات حساس تکمیل شود. |
| `BO-IAM-009` | Authorization باید deny-by-default و در API، Query، Command، Storage، Queue و Runner اعمال شود. |

### ۳۵.۴ تنظیمات، AI، Team و Memory

| Requirement ID | الزام |
|---|---|
| `BO-CFG-001` | هر Project باید تنظیمات Hero مستقل و کامل داشته باشد. |
| `BO-CFG-002` | UI/API باید effective value، source layer، version، actor، time، reason و impact هر تنظیم را نمایش دهد. |
| `BO-CFG-003` | قواعد Global invariant نباید با Project/Team/Role/Run override ضعیف شوند. |
| `BO-CFG-004` | Hero باید در شروع Project یک Policy Pack پیشنهادی بسازد و Owner/Admin بتواند آن را اصلاح کند. |
| `BO-CFG-005` | Hero باید در طول توسعه بهبودهای مفید را پیشنهاد و مطابق Policy خودکار اجرا یا برای تأیید نگه دارد. |
| `BO-AI-001` | Provider/Model باید حداقل در سطح Project، Team، Role، task type و Conversation قابل انتخاب باشد. |
| `BO-AI-002` | افت مدل باید Proposal تعویض بسازد؛ تعویض خودکار مدل فقط پس از تأیید Owner مجاز است. |
| `BO-AI-003` | Team باید هویت، مأموریت، اصول، حافظه و KPI پایدار داشته باشد. |
| `BO-AI-004` | Role Profile باید پایدار و Agent Assignment باید اجرای scopeشدهٔ همان Role روی Task/Run باشد. |
| `BO-MEM-001` | Memory باید در چهار Scope عمومی Hero، Project، Team و Role/Profile جداسازی شود. |
| `BO-MEM-002` | Owner/Admin باید بتواند Memory را اصلاح، غیرفعال یا Supersede کند و تاریخچه باقی بماند. |
| `BO-MEM-003` | انتقال دانش بین Projectها فقط با Knowledge Proposal پاک‌سازی‌شده و پذیرش در مقصد مجاز است. |

### ۳۵.۵ گفتگو، فرمان و اجرا

| Requirement ID | الزام |
|---|---|
| `BO-CMD-001` | پنج Context گفتگو باید شامل Hero، Project، Team، Role/Profile و Entity-bound conversation باشد. |
| `BO-CMD-002` | گفتگو باید هم Query و هم Command را پشتیبانی کند. |
| `BO-CMD-003` | هر Command باید به Intent ساختاریافته با target، scope، risk، cost، impact، evidence و rollback تبدیل شود. |
| `BO-CMD-004` | عملیات کم‌ریسک فقط در صورت Policy صریح می‌تواند بدون Preview اجرا شود و باید Audit شود. |
| `BO-CMD-005` | عملیات پرریسک باید Preview/Approval معتبر و version-bound داشته باشد. |
| `BO-WF-001` | Workflow باید durable، resumable، idempotent و checkpoint-based باشد. |
| `BO-WF-002` | Owner/Admin باید بتواند Project/Run را در safe checkpoint متوقف و ادامه دهد. |
| `BO-WF-003` | Approval Production باید بتواند بر اساس Project، بازهٔ زمانی یا نوع تغییر preauthorize شود. |
| `BO-WF-004` | Scheduler باید weighted-fair، anti-starvation و دارای lock برای Deploy/Migration باشد. |
| `BO-WF-005` | هر Project به‌طور پیش‌فرض نباید بیش از دو Run سنگین هم‌زمان داشته باشد، مگر Policy نسخه‌دار آن را تغییر دهد. |

### ۳۵.۶ زیرساخت، Secret و Production

| Requirement ID | الزام |
|---|---|
| `BO-INF-001` | Environmentهای نسخهٔ اول باید فقط Development، Test و Production باشند. |
| `BO-INF-002` | Git provider نسخهٔ اول باید GitHub باشد. |
| `BO-INF-003` | Owner/Admin باید بتواند سرور را با IP/domain و Credential به Project متصل کند و Hero آماده‌سازی را انجام دهد. |
| `BO-INF-004` | Node Agent باید اتصال outbound امن، هویت scopeشده، heartbeat و Command امضاشده داشته باشد. |
| `BO-SEC-001` | Secret باید فقط در Secret Store باشد؛ در Log، Prompt، Artifact، Conversation یا Export ممنوع است. |
| `BO-SEC-002` | Admin باید بتواند Secret Project را ثبت/تعویض/Rotate/Revoke کند ولی Reveal نکند. |
| `BO-SEC-003` | Owner فقط با MFA، re-authentication، دلیل و Audit باید بتواند Secret را Reveal کند. |
| `BO-SEC-004` | فایل ورودی باید type/signature/size validation، malware scan و sandbox extraction داشته باشد. |
| `BO-SEC-005` | دسترسی اینترنت Team/Agent باید ضروری ولی policy-controlled، scopeشده و auditپذیر باشد. |
| `BO-PRD-001` | Hero به‌طور پیش‌فرض فقط telemetry پاک‌سازی‌شدهٔ Production را دریافت کند. |
| `BO-PRD-002` | دادهٔ واقعی Production فقط با دسترسی جدا، موقت، کم‌دامنه و auditشده قابل مشاهده باشد. |
| `BO-PRD-003` | دادهٔ واقعی Production نباید پیش‌فرض وارد AI Prompt، Memory یا Evaluation شود. |

### ۳۵.۷ سلامت، عملکرد، هزینه، اعلان و تحویل

| Requirement ID | الزام |
|---|---|
| `BO-HLT-001` | Health باید از signalهای قطعی و فرمول نسخه‌دار ساخته شود؛ AI فقط توضیح و پیشنهاد بدهد. |
| `BO-HLT-002` | KPI و Health باید drivers، confidence، freshness و لینک Evidence داشته باشند. |
| `BO-PERF-001` | عملکرد باید حداقل Goal Fit/Accuracy، Token Efficiency و Error/Rework را اندازه‌گیری کند. |
| `BO-PERF-002` | Drill-down عملکرد باید Portfolio تا Run را پوشش و نوع کار را normalize کند. |
| `BO-PERF-003` | Feedback مالک باید اختیاری و فقط یک signal برچسب‌خورده در Evaluation باشد. |
| `BO-COST-001` | نسخهٔ اول حسابداری باید Token را به Project/Team/Role/Task/Run/Provider/Model منتسب کند. |
| `BO-COST-002` | Soft threshold باید هشدار دهد و Hard cap باید invocation جدید را متوقف کند. |
| `BO-COST-003` | سقف و مصرف Token باید قابل مشاهده و ویرایش باشد و محدودترین سقف منطبق اعمال شود. |
| `BO-NTF-001` | اعلان نسخهٔ اول فقط داخل Back Office باشد. |
| `BO-NTF-002` | Inbox باید severity، context، evidence، deadline و اقدام مستقیم داشته و deduplicate شود. |
| `BO-OUT-001` | Delivery Bundle باید source، artifact، digest/provenance، config contract، migration، deploy/rollback، docs و reports را شامل شود. |
| `BO-OUT-002` | Project باید در هر زمان بدون وابستگی مخفی به سرور فعلی قابل انتقال باشد. |
| `BO-OUT-003` | Release باید به commit/tag، test/security evidence و artifact digest دقیق متصل باشد. |

### ۳۵.۸ داده، Retention و تجربهٔ استفاده

| Requirement ID | الزام |
|---|---|
| `BO-DAT-001` | فایل‌های ورودی باید داخل Private Storage خود Hero نگهداری شوند. |
| `BO-DAT-002` | Retention باید برای هر Project قابل تنظیم و وضعیت cleanup/hold آن قابل مشاهده باشد. |
| `BO-DAT-003` | Retention نباید الزام Audit، Authorization و Release evidence را تضعیف کند. |
| `BO-UX-001` | رابط باید فارسی و انگلیسی و سازگار با RTL/LTR باشد. |
| `BO-UX-002` | نسخهٔ اول باید Desktop-first باشد؛ Responsive بعداً و اپ موبایل مستقل خارج از Scope است. |
| `BO-UX-003` | هر Metric، Status، Proposal و Alert باید مسیر Drill-down و توضیح «چرا» داشته باشد. |
| `BO-UX-004` | Viewer نباید هیچ Control تغییردهنده یا دادهٔ خارج از ProjectGrant خود دریافت کند. |

## ۳۶. قواعد جلوگیری از میان‌بُر اجرایی

پیاده‌سازی در شرایط زیر ناقص و غیرقابل پذیرش است، حتی اگر صفحهٔ UI ظاهراً کار کند:

- دادهٔ نمایشی hard-coded، KPI ساختگی یا وضعیت محاسبه‌نشده؛
- mutation مستقیم Database از UI یا دورزدن Command/Policy/Audit؛
- نگهداری تنظیم فقط در Frontend یا cache؛
- اشتراک index، memory، storage path یا runner بدون enforceکردن `project_id`؛
- تغییر تاریخچه به‌جای ساخت version/supersede/correction؛
- اجرای AI یا Tool بدون immutable invocation snapshot و Token accounting؛
- نمایش Secret موجود به Admin یا ثبت Secret در payloadهای عمومی؛
- قبول Release بدون Artifact identity و Evidence؛
- استفاده از Notion به‌عنوان منبع حقیقت یا نوشتن مستقیم Notion در Git؛
- ساخت قابلیت فقط برای پروژهٔ Hero به‌گونه‌ای که Project دوم نتواند تنظیم مستقل داشته باشد؛
- ادعای Done بدون تست authorization، isolation، replay، idempotency، failure و recovery.

## ۳۷. Definition of Done سراسری Back Office

هر Work Package فقط زمانی Done است که همهٔ شرایط مرتبط برقرار باشند:

1. Requirement IDها و Acceptance Criteria از قبل ثبت شده باشند؛
2. Domain contract و schema نسخه‌دار باشند؛
3. migration و backward compatibility تعیین شده باشد؛
4. Query و Command API با authorization واقعی کار کنند؛
5. UI از همان API و دادهٔ واقعی استفاده کند؛
6. Event، Audit و correlation کامل باشند؛
7. unit، integration، authorization، isolation و failure tests موفق باشند؛
8. هیچ Secret، host path یا دادهٔ پروژهٔ دیگر نشت نکند؛
9. accessibility و فارسی/انگلیسی بررسی شده باشد؛
10. runbook، rollback و Evidence به‌روز شده باشند؛
11. `pnpm check` در محیط مرجع موفق باشد؛
12. برای عملیات حساس، مجوز جداگانهٔ همان Step و نسخه موجود باشد.

## ۳۸. تصویب و کنترل تغییر

- تصویب‌کننده: `project-owner`
- تاریخ تصویب: `2026-09-10`
- وضعیت: `active`
- مبنای توسعه: همین نسخه با شناسهٔ `HERO-SPEC-022` و نسخهٔ `1.0.0`
- برنامهٔ اجرای وابسته: `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1`

هر تغییر معنایی پس از این تصویب باید Proposal، impact analysis و نسخهٔ جدید سند ایجاد کند. ویرایش خام این نسخه بدون افزایش نسخه و ثبت تاریخچه مجاز نیست. تصویب این سند به‌تنهایی مجوز اجرای Production، عملیات مخرب، Secret change، هزینهٔ بیرونی، پیام بیرونی یا شروع خودکار تمام گام‌های توسعه نیست.
