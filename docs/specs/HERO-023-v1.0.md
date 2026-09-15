# HERO-023 v1.0 — Design Contract رابط Back Office و Product Studio

> Document ID: `HERO-SPEC-023`  
> Canonical path: `docs/specs/HERO-023-v1.0.md`  
> Version: `1.0.0`  
> Status: `active`  
> Owner: `hero-product`  
> Scope: `cross-project`  
> Parent specification: `HERO-SPEC-022@1.0.0`  
> Approved by: `project-owner` through the UI/UX completion request of `2026-09-11`

## ۱. هدف و جایگاه سند

این سند جزئیات تجربهٔ استفاده، معماری اطلاعات، زبان بصری، رفتار تعاملی و معیار پذیرش رابط جامع Hero را تعیین می‌کند. دامنهٔ قابلیت‌ها را `HERO-SPEC-022` تعیین کرده است؛ این سند آن دامنه را به قرارداد قابل‌پیاده‌سازی UI/UX تبدیل می‌کند و اجازه ندارد Policy، Authorization، Event/Audit، Secret boundary یا Release gate را دور بزند.

هدف رابط، «داشبورد زیبا» به‌تنهایی نیست. هدف یک **Private Mission Control** است که مالک بتواند با کمترین جست‌وجو پاسخ پنج پرسش را بگیرد:

1. اکنون کدام پروژه، مرحله یا سرویس به توجه نیاز دارد؟
2. چرا این وضعیت یا پیشنهاد ساخته شده و Evidence آن چیست؟
3. تصمیم بعدی چیست، اثر/ریسک/هزینهٔ آن چقدر است و چه کسی اختیار اجرا دارد؟
4. هر تیم، Role، Task و Run چه عملکرد و مصرفی داشته است؟
5. چگونه از Portfolio به یک پروژه و سپس به دقیق‌ترین Evidence قابل استناد برسیم؟

## ۲. نتیجهٔ ممیزی اسناد محصول

در شروع این بازنگری، رجیستری canonical شامل ۱۲۸ سند بود. مجموعهٔ اصلی بررسی‌شده برای تصمیم رابط شامل `HERO-SPEC-001..022`، ADRهای مرز Control/Execution/Data Plane، هویت و ProjectGrant، Workspace/Settings/Portfolio، Collaboration/Command/Catalog، Intelligence/Inbox، اسناد عملیات محیط و برنامهٔ ۱۷۰ گام Back Office بود.

### ۲.۱ مواردی که از قبل دقیق تعریف شده بودند

- Hero خصوصی، تک‌مالک و چندپروژه‌ای است؛
- نقش‌های Back Office فقط Owner، Admin و Viewer هستند؛
- Project ظرف کامل Product، سرویس‌ها، محیط‌ها، Repositoryها، تیم‌ها و تحویل است؛
- Back Office نمای Portfolio و کنترل سراسری است و Product Studio فضای انتخاب‌شدهٔ پروژه؛
- تغییرها باید نسخه‌دار، audit‌شده و project-scoped باشند؛
- گفت‌وگو در پنج Context و با قابلیت فرمان ساختاریافته انجام می‌شود؛
- Token Cost، Health، Performance، Inbox، Catalog، Infrastructure و Delivery مسیر drill-down دارند؛
- Secret، Production data و عملیات برگشت‌ناپذیر گیت مستقل دارند؛
- رابط Desktop-first، فارسی/انگلیسی و سازگار با RTL/LTR است.

### ۲.۲ شکاف‌هایی که این سند می‌بندد

- صفحه‌ها زبان بصری و ناوبری یکسان نداشتند؛
- Portfolio قدیمی اطلاعات کم، چیدمان انگلیسی و مسیر تصمیم‌گیری ضعیف داشت؛
- مرز میان «فرمان سراسری»، «فضای محصول»، «تنظیمات پروژه» و «عملیات» در UI واضح نبود؛
- Design token، الگوی component، حالت‌های loading/empty/error/stale/forbidden و قواعد محتوا سند مستقل نداشت؛
- جست‌وجوی سریع، میان‌بر صفحه‌ها، Skip link، reduced motion و Theme contract مشترک نبود؛
- معیارهای پذیرش UI در حد چند Requirement کلی بود و احتمال پیاده‌سازی ظاهری بدون دادهٔ واقعی وجود داشت؛
- سطح «پیاده‌سازی رابط» با «کامل‌شدن backend قابلیت» مخلوط می‌شد. از این پس UI می‌تواند مسیر قابلیت را کامل کند، ولی تا زمانی که Query/Command واقعی و Evidence موجود نیست، آن قابلیت حق برچسب `complete` ندارد.

## ۳. تحقیق و بنچ‌مارک

هیچ محصولی به‌تنهایی الگوی Hero نیست. تصمیم طراحی از ترکیب الگوهای زیر گرفته شده است:

| مرجع رسمی | الگوی پذیرفته‌شده در Hero | محدودیت استفاده |
|---|---|---|
| [Primer Navigation](https://primer.style/product/ui-patterns/navigation/) | جهت‌یابی روشن، انتخاب‌های محدود، Skip link، ترتیب منطقی Tab و headingهای قابل اسکن | Tree view جایگزین navigation نیست و عمق ناوبری کنترل می‌شود |
| [Primer NavList](https://primer.style/product/components/nav-list/) | گروه‌بندی ناوبری Context و مشخص‌کردن صفحهٔ فعال | حداکثر سه سطح قابل مشاهده در Hero |
| [Atlassian Color](https://atlassian.design/foundations/color) | token معنایی به‌جای رنگ خام و حالت‌های focus/hover/selected | Accent حامل معنای success/warning/danger نیست |
| [Atlassian Accessibility](https://atlassian.design/foundations/accessibility) | HTML معنایی، کنترل کاربر، contrast، متن ساده و عدم اتکا به رنگ | WCAG AA حداقل است، نه سقف کیفیت |
| [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/) | حرکت از کل به جزء، کاهش cognitive load، dashboard سلسله‌مراتبی و drill-down هدایت‌شده | نمایش همهٔ metricها در صفحهٔ اول ممنوع است |
| [Grafana Alerting Best Practices](https://grafana.com/docs/grafana/latest/alerting/guides/best-practices/) | Alert باید اقدام‌پذیر، دارای Owner/Scope و مسیر بررسی باشد | رویداد informational به Inbox بحرانی تبدیل نمی‌شود |
| [Linear Project Overview](https://linear.app/docs/project-overview) | Overview پروژه، milestone، سند و منبع در یک Context | Hero به issue tracker محدود نمی‌شود |
| [Linear Display Options](https://linear.app/docs/display-options) | فیلتر، گروه‌بندی، ترتیب و ترجیح نمای شخصی | تغییر نما، Source of Truth را تغییر نمی‌دهد |
| [Linear Custom Views](https://linear.app/docs/custom-views) | نمای ذخیره‌شده برای at-risk، release و مسئول | اشتراک view مجوز ProjectGrant ایجاد نمی‌کند |

نتیجه: رابط Hero باید آرام، متراکم، سلسله‌مراتبی و Evidence-first باشد؛ جلوهٔ بصری هیچ‌گاه جای status، reason، confidence، freshness یا action را نمی‌گیرد.

## ۴. تز طراحی

نام داخلی رویکرد: **Calm Mission Control**.

- Canvas خنثی و Surface روشن برای ساعت‌های طولانی کار؛
- Indigo برای اقدام اصلی و Context فعال؛
- Emerald، Amber و Rose فقط برای معنای وضعیت و همراه با متن/نماد؛
- تراکم متوسط رو به بالا، بدون card sprawl؛
- انیمیشن کوتاه فقط برای orientation و احترام به `prefers-reduced-motion`؛
- بدون تصویر تزئینی: داده و مسیر تصمیم عناصر اصلی‌اند؛
- هر صفحه یک سؤال اصلی دارد و summary آن پیش از جزئیات می‌آید.

## ۵. معماری اطلاعات

```text
Hero Global Shell
├── Portfolio — وضعیت همه پروژه‌ها و ورود به Context
├── Command Center — تیم، AI، گیت، شواهد و کنترل سراسری
├── Identity & Access — ورود، MFA، کاربر و ProjectGrant
└── Project Context
    ├── Product Studio — اسناد، محصولات، Roadmap و Knowledge
    ├── Workspace — Intake، Foundation، Inputs و Settings
    └── Operations — Command، Inbox، Health، Infrastructure و Delivery
```

### ۵.۱ Global Shell ثابت

همهٔ صفحه‌ها باید اجزای زیر را از یک ماژول مشترک دریافت کنند:

- نام Hero و Private Control Plane؛
- لینک Portfolio، Command Center، Product Studio، Workspace، Operations و Access؛
- `aria-current` برای مکان فعلی؛
- حفظ `projectId` در تمام لینک‌های project-scoped؛
- جست‌وجو/Command palette با `Cmd/Ctrl+K`؛
- Theme روشن/تیره با ترجیح ذخیره‌شده در مرورگر؛
- Skip link و ناوبری صفحه‌کلید؛
- نمایش صریح محیط؛ محیط بصری هرگز جای host/authorization واقعی را نمی‌گیرد.

### ۵.۲ Portfolio

صفحهٔ ورود Owner/Admin/Viewer است و باید به‌ترتیب نشان دهد:

1. تعداد پروژه‌های قابل مشاهده؛
2. تعداد سالم و نیازمند توجه؛
3. تعداد گام‌های پیش رو؛
4. کارت پروژه شامل Health، Lifecycle، Token، Next Tasks و Latest Output؛
5. مسیر مستقیم Studio، Operations و Settings؛
6. Search و Lifecycle filter روی دادهٔ scope‌شده.

هیچ عددی hard-coded نیست. `unknown` وضعیت مجاز و صریح است و نباید ظاهراً Healthy نمایش داده شود.

### ۵.۳ Command Center

اطلاعات در شش فضای کاری دسته‌بندی می‌شود:

- Overview: وضعیت، Health، گیت‌ها و ساختار؛
- Teams: قرارداد، اصول، ورودی/خروجی، آموزش و عملکرد؛
- Multi-AI: Role، Provider، Model، Profile، Binding، Benchmark و Policy؛
- Project & Contracts: تنظیمات سراسری، Read Model، Memory و Context؛
- Operations & Evidence: Timeline، Review، Roadmap، Owner Action و Boundary؛
- Guide: تعریف نقش‌ها و قراردادهای محصول.

### ۵.۴ Project Studio

مرجع محصول و دانش است، نه صفحهٔ تنظیمات زیرساخت. شامل:

- Project context و completeness؛
- اسناد canonical با Search/Filter و مشاهدهٔ متن؛
- Roadmap، Dependency/Blocker و Evidence؛
- محصولات/اجزای پروژه؛
- وضعیت Notion به‌عنوان projection؛
- Gapها و conflictهای مستندات.

### ۵.۵ Workspace

محل تغییر نسخه‌دار project configuration است:

- Intake؛
- Foundation Proposal و Approval/Revision؛
- Upload/Link input؛
- Effective settings با layer/provenance/version؛
- Policy Pack و Rollback؛
- role-aware mutation controls.

### ۵.۶ Operations

نمای عملیاتی و redacted هر پروژه است:

- Collaboration/Memory؛
- Command/Workflow/Approval؛
- Catalog/Drift؛
- Performance/Health/Token؛
- Inbox/Observability/Audit؛
- Development/Test/Production/Node/Secret reference؛
- Release/Artifact/Delivery؛
- Retention/Hardening/Readiness.

## ۶. پوشش قابلیت‌ها و محل دسترسی

| قابلیت | Global | Project | مسیر اصلی |
|---|---:|---:|---|
| سبد پروژه و Health | ✓ | — | `/portfolio` |
| تیم‌ها و اصول | ✓ | ✓ | `/portfolio?surface=command&projectId=…` و Operations |
| Role/Model/Provider | ✓ | ✓ | `/api/portal?surface=ai#ai` و Settings |
| اسناد/دانش/Roadmap | — | ✓ | `/product-studio?projectId=…` |
| Intake/Foundation/Input | — | ✓ | `/workspace?projectId=…` |
| گفتگو و Memory | — | ✓ | Operations؛ متن فقط در Context مجاز |
| فرمان/Approval/Run | ✓ | ✓ | Command Center و Operations |
| KPI/Performance/Token | ✓ | ✓ | Portfolio → Project → Evidence |
| Inbox/Alert | ✓ | ✓ | Operations؛ فقط اقدام‌پذیر در Inbox |
| Catalog/Dependency/Drift | ✓ | ✓ | Product Studio و Operations |
| Server/Environment/Secret | — | ✓ | Workspace/Operations با boundary |
| Release/Artifact/Output | ✓ | ✓ | Operations → Delivery |
| User/ProjectGrant/MFA | ✓ | — | `/identity` |
| Retention/Audit/Recovery | ✓ | ✓ | Operations/Command Center |

وجود مسیر UI به معنی آمادگی اجرای خارجی نیست. حالت واقعی باید یکی از `ready`، `partial`، `gated`، `blocked` یا `unknown` باشد.

## ۷. سلسله‌مراتب و الگوی صفحه

هر صفحه به‌ترتیب زیر ساخته می‌شود:

1. Global Shell؛
2. eyebrow انگلیسی پایدار برای orientation؛
3. عنوان و یک توضیح تصمیم‌محور؛
4. حداکثر ۴ تا ۶ KPI اصلی؛
5. گیت/تصمیم منتظر پیش از گزارش تفصیلی؛
6. محتوای اصلی با Filter و Drill-down؛
7. provenance، freshness و status پیام‌ها.

در جدول‌ها و لیست‌های بزرگ، Search، Filter، count و empty state الزامی است. Pagination باید server-side شود وقتی Query از سقف قرارداد عبور می‌کند.

## ۸. Design Token

| Token | کاربرد |
|---|---|
| `--hero-canvas` | پس‌زمینهٔ کل برنامه |
| `--hero-surface` | Surface پایه |
| `--hero-surface-raised` | Dialog و Overlay |
| `--hero-ink` / `--hero-muted` | متن اصلی/ثانویه |
| `--hero-line` / `--hero-line-strong` | Border و separation |
| `--hero-brand` / `--hero-brand-soft` | اقدام اصلی و context فعال |
| `--hero-success` / `warning` / `danger` | وضعیت معنایی همراه label |
| `--hero-shadow-sm` / `lg` | elevation کنترل‌شده |

Spacing از مضرب‌های ۴px، شعاع‌ها ۸ تا ۲۰px و حداقل هدف تعاملی Desktop برابر ۳۶px است. متن بدنه کمتر از ۱۲px فقط برای metadata غیرحیاتی مجاز است.

## ۹. قرارداد کامپوننت‌ها

- `AppBar`: یک نمونه در صفحه، sticky در Desktop؛
- `GlobalNav`: لینک معنایی با `aria-current`؛
- `CommandPalette`: dialog واقعی، Search و ESC؛
- `MetricCard`: value، label، description، status و drill-down؛
- `ProjectCard`: context، health، token، next و سه action؛
- `StatusPill`: متن + marker؛ رنگ تنها نشانه نیست؛
- `Section`: heading یکتا و توضیح scope؛
- `DataList/DataTable`: count، filter، empty، error و pagination؛
- `ApprovalCard`: actor، scope، expiry، impact، risk و approve/reject؛
- `CommandPreview`: effect، cost، risk، affected resources، rollback و authorization؛
- `EvidenceLink`: نوع، timestamp، checksum/correlation و target؛
- `Toast/InlineStatus`: نتیجهٔ mutation با `role=status` یا `role=alert`؛
- `DangerDialog`: target دقیق، اثر برگشت‌ناپذیر، step-up و confirmation.

## ۱۰. قرارداد وضعیت‌های رابط

هر Query/Mutation باید وضعیت‌های زیر را صریح داشته باشد:

- Initial/Loading: عنوان و layout پایدار، بدون عدد جعلی؛
- Empty: دلیل نبود داده و اقدام مجاز بعدی؛
- Error: پیام قابل‌فهم، correlation و Retry امن؛
- Forbidden: توضیح Role/ProjectGrant لازم بدون افشای داده؛
- Stale: زمان آخرین داده و دکمهٔ refresh؛
- Success: آنچه تغییر کرد و نسخهٔ جدید؛
- Conflict: نسخهٔ مورد انتظار/فعلی و مسیر refresh؛
- Gated: Gate، Owner، expiry و شرط رفع؛
- Offline/Degraded: دادهٔ cache‌شده با برچسب صریح، نه Healthy.

## ۱۱. زبان و جهت

- زبان پایهٔ مالک فارسی و `dir=rtl` است؛
- نام فنی، ID، Path، Commit، Hash و عدد metric با `dir=ltr` یا isolation نمایش داده می‌شود؛
- Global navigation در هر دو زبان به‌صورت هم‌زمان قابل تشخیص است؛
- ترجمهٔ کامل محتوا باید از message catalog بیاید، نه رشتهٔ تکراری داخل component؛
- تغییر زبان نباید شناسه، داده یا URL context را عوض کند؛
- نبود ترجمه با fallback انگلیسی و label `translation unavailable` نمایش داده می‌شود؛
- تا تکمیل catalog همهٔ Surfaceها، bilingual content یک gap ثبت‌شده است و نباید به‌عنوان Done گزارش شود.

## ۱۲. Accessibility

حداقل هدف WCAG 2.2 AA است:

- landmarks معنایی `header/nav/main/aside/footer`؛
- Skip link؛
- ترتیب Heading بدون پرش ناموجه؛
- همهٔ عملیات با صفحه‌کلید؛
- focus واضح و بازگرداندن focus پس از Dialog؛
- contrast حداقل 4.5:1 متن معمول و 3:1 متن بزرگ/UI؛
- status غیرمتکی به رنگ؛
- label واقعی برای Input و Icon button؛
- پشتیبانی zoom 200% و reflow پایه؛
- احترام به reduced motion؛
- جدول با header و توضیح scope؛
- اعلان با live region مناسب، بدون تکرار آزاردهنده.

## ۱۳. Security UX و Role-aware rendering

- Viewer کنترل mutation را از response و DOM دریافت نمی‌کند؛ disabled کردن ظاهری کافی نیست؛
- Owner تنها نقش ایجاد/حذف/Archive پروژه، مدیریت کاربران و Reveal Secret است؛
- Admin در پروژه‌های مجاز همهٔ تغییرهای project-scoped را انجام می‌دهد، ولی کاربر اضافه/کم نمی‌کند؛
- Reveal Secret فقط برای Owner، پس از step-up و با Audit است؛
- Password، MFA، Token و Secret هرگز در URL، log، report، analytics یا error echo نمی‌شوند؛
- هر فرمان پرریسک ابتدا Preview ساختاریافته دارد؛
- Production indicator به‌تنهایی مجوز Deploy نیست و Promotion مستقل باقی می‌ماند؛
- `projectId` در Client convenience است؛ authorization در Server روی هر Request اجرا می‌شود.

## ۱۴. Performance و پایداری

- Shell بدون asset شبکه‌ای و بدون dependency رابط اجرا می‌شود؛
- HTML اولیه باید heading/navigation/empty state قابل‌استفاده داشته باشد؛
- تعداد refreshها با freshness داده متناسب است و polling بی‌هدف ممنوع؛
- listهای بزرگ pagination/lazy details دارند؛
- Dialog و Filter از re-render کامل صفحه جلوگیری می‌کنند؛
- theme و preference فقط دادهٔ غیرحساس را در local storage نگه می‌دارند؛
- session/token فقط طبق قرارداد هویت موجود نگهداری می‌شود.

## ۱۵. معیار پذیرش این نسخه

| ID | معیار |
|---|---|
| `UX-AC-001` | همهٔ Surfaceهای مدیریتی از Shell مشترک و `aria-current` استفاده کنند. |
| `UX-AC-002` | projectId در لینک‌های project-scoped حفظ شود. |
| `UX-AC-003` | Portfolio فقط KPI واقعی و unknown صریح نمایش دهد. |
| `UX-AC-004` | Search/Filter پروژه بدون دستکاری Source of Truth کار کند. |
| `UX-AC-005` | Command palette با click و Cmd/Ctrl+K باز، با ESC بسته و قابل Filter باشد. |
| `UX-AC-006` | Light/Dark token theme و reduced-motion فعال باشد. |
| `UX-AC-007` | Skip link، landmark، label، focus و status text وجود داشته باشد. |
| `UX-AC-008` | هیچ Secret/Token خام در HTML server-rendered قرار نگیرد. |
| `UX-AC-009` | Scriptهای inline از نظر syntax و HTMLهای routeها از طریق server test شوند. |
| `UX-AC-010` | همان source artifact در Development/Test/Production استفاده شود. |
| `UX-AC-011` | Test deployment با health/readiness/smoke ثبت شود. |
| `UX-AC-012` | Production فقط از digest آزموده‌شده و مجوز مستقل Promotion انجام شود. |
| `UX-AC-013` | Full bilingual content و browser accessibility scan تا زمان Evidence واقعی partial بماند. |

## ۱۶. خارج از Scope این تحویل

- اپلیکیشن موبایل مستقل Hero؛
- طراحی Figma موازی به‌عنوان Source of Truth؛
- تغییر backend صرفاً برای پرکردن نمای ظاهری؛
- فعال‌سازی Provider، Server، GitHub، Production data یا Secret؛
- Deploy به Production بدون Authorization مستقل؛
- ادعای WCAG کامل بدون آزمون مرورگر و ابزار کمکی.

## ۱۷. تصمیم‌های اجرایی

1. UI به‌صورت server-rendered و dependency-free فعلی ادامه می‌یابد تا سطح حمله و پیچیدگی build افزایش نیابد.
2. Shared Shell در `apps/control-plane/src/hero-shell.mjs` منبع یکتای navigation/token/theme/command palette است.
3. Portfolio به‌عنوان صفحهٔ شروع بازطراحی می‌شود.
4. Surfaceهای قدیمی تدریجی به Shell مشترک متصل می‌شوند؛ Route یا API سازگار حذف نمی‌شود.
5. Production و Test کد رابط جدا ندارند؛ فقط config/environment و release gate متفاوت است.
6. هر قابلیت backend ناقص در UI با status واقعی نشان داده می‌شود و با mock پر نمی‌شود.

## ۱۸. کنترل تغییر

این سند مکمل `HERO-SPEC-022@1.0.0` است و آن را supersede نمی‌کند. تغییر معماری اطلاعات، Role behavior، Security UX، status taxonomy یا Acceptance Criteria نیازمند Proposal و نسخهٔ جدید همین سند است. تغییر style جزئی که معنای interaction را تغییر نمی‌دهد می‌تواند در Patch version ثبت شود.
