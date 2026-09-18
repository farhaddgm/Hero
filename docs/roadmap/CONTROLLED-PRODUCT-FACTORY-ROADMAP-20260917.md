# رودمپ کنترل‌شدهٔ کارخانهٔ محصول Hero — ۲۰۲۶-۰۹-۱۷

> Document ID: `HERO-ROADMAP-CONTROLLED-PRODUCT-FACTORY-20260917`
> Canonical path: `docs/roadmap/CONTROLLED-PRODUCT-FACTORY-ROADMAP-20260917.md`
> Title: رودمپ کنترل‌شدهٔ کارخانهٔ محصول Hero — ۲۰۲۶-۰۹-۱۷
> Type: roadmap
> Scope: hero
> Status: active
> Version: 3.2.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: `HERO-ROADMAP-NEXT-100-STEPS-20260904`, `HERO-ROADMAP-NEXT-20-STEPS-20260904`, `HERO-ROADMAP-NEXT-20-STEPS-20260911-WORKSPACE-PERSISTENCE`, `HERO-ROADMAP-NEXT-100-STEPS-20260911-PROJECT-CONTROL`
> Superseded by: none

## ۱. تصمیم این بازنگری

این سند ترتیب اجرایی آیندهٔ Hero را یکپارچه می‌کند. برنامهٔ جامع ۱۷۰ گامی Back Office (`HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1@1.2.0`) همچنان مرجع الزام نیازمندی‌هاست؛ این سند آن گام‌ها را حذف، Done یا جایگزین نمی‌کند. تفاوت این است که ترتیب کار را حول نتیجهٔ موردنظر Owner روشن می‌کند: تبدیل یک مسئله به **برنامهٔ محصولِ بازبینی‌شده** و سپس، فقط با گیت‌های جداگانه، تولید و اجرای ایزولهٔ آن محصول.

هیچ عبارت این سند مجوز deploy، ایجاد سرور، ساخت Secret، خرج‌کرد بیرونی، فراخوانی Provider زنده، ارسال پیام بیرونی، Pilot یا Production نیست. برای هر Dispatch، Step ID، نسخهٔ سند، محیط، authorization snapshot و خاموش‌بودن Global Stop جداگانه کنترل می‌شود.

## ۲. وضعیت مبنای تأییدشده

| موضوع | واقعیت تأییدشده | مرز صریح |
|---|---|---|
| source Hero | branch `codex/test-release-reliability-20260916`، commit `2b4ec6ae389f059cc7eee7cd3b39529fe7f4874e`؛ شامل قرارداد/admission، adapter رسمی گیت‌دار، stop/cleanup idempotent، capacity/lease lifecycle، probe ظرفیت، artifact contract و harness رسمی PF-3 است | کاندیدای `v1.1.4-rc.15` از run `35314609142` با workflow کامل ساخته و فقط روی Hero Test promote/verify شده است؛ Product Test نمونهٔ رسمی روی commit جاری نیز در Test اجرا و evidence شد. |
| Test Hero | فعال: `v1.1.4-rc.15`، digest `ghcr.io/farhaddgm/hero@sha256:bec56ba76d8b70e3a704bfc05d5d349abe1abe1a60bd35674f63bea4f94221b0` | فقط Hero Test است؛ `/health`، `/ready` و `build-info` با release/commit/digest منطبق موفق‌اند؛ rollback point metadata-only ثبت شده است. |
| آخرین promotion Test | `v1.1.4-rc.15`، run `35314609142`، runtime commit `5c7291e069cddef935d269690fcd37e8891d0121` | manifest و digest immutable روی host Test promote و verify شدند؛ خطای موقت connection reset هنگام restart با health/readiness و smoke موفق نهایی شد. |
| شواهد rollback | قبل از promotion، rc.14 با digest `sha256:6fba080967039dde9e884e5c8ca86e8343b6512577061bde55cfdd5dcb006228` pull شد | rollback point metadata-only در `/etc/hero/hero-test.env.release-state.before-bec56ba76d8b70e3a704bfc05d5d349abe1abe1a60bd35674f63bea4f94221b0.json` ثبت شد. |
| رخداد اصلاح‌شده | rc.6 بعد از restart با `Product request metadata is invalid` crash-loop شد | علت و اصلاح در source ثبت شده؛ rc.8 همان مسیر را سالم کرده است. |
| کیفیت source | اجرای معادل `pnpm check` در Linux container: ۴۴۷ pass، ۰ fail؛ build: ۲۸۰ module و ۴۹ JSON | به‌علت نبودن Node/pnpm روی host و نبودن Docker socket داخل check container، check در Docker مرجع با snapshot source اجرا شد؛ این نتیجه جای acceptance محصول هدف را نمی‌گیرد. |
| AI | مسیر provider-agnostic، policy، redaction و result ساخت‌یافته در source/Test حاضر است | evidence تازه‌ای از فراخوانی زندهٔ OpenAI در این baseline ثبت نشده است؛ provider و هزینه fail-closed هستند. |
| Back Office | ممیزی مرجع: ۲۰/۱۷۰ گام verified، ۱۵۰ گام نیازمند evidence کامل؛ ۵/۸۱ requirement implemented، ۷۶ partial | UI یا قرارداد موجود به معنی کارخانهٔ خودکار محصول نیست. |
| اجرای محصول | قراردادهای Web Factory، Provider Agent، Infrastructure Plan و Product Runner وجود دارند؛ safe sample با executor رسمی در Test اجرا شده است | اجرای خودکار محصول واقعی، target خارجی، Node Agent و deploy Product Production عملیاتی نشده‌اند. |

مرجع جزئی شواهد جاری: `HERO-ROADMAP-STATUS-20260917@3.0.0` و `HERO-OPS-HERO-TEST-RELEASE-RELIABILITY@1.5.1`.

## ۳. هدف نهایی و معیار موفقیت

هدف، یک «گفت‌وگوی آزاد که خودکار deploy می‌کند» نیست. هدف یک مسیر قابل‌اعتماد است که در آن Owner بتواند مسئله‌اش را ثبت کند، Hero آن را به proposal و برنامهٔ قابل‌بررسی تبدیل کند، تیم‌ها فقط در Scope تأییدشده کار کنند و خروجی در runtime کاملاً جدا ساخته و آزموده شود.

```text
مسئلهٔ Owner
  → Intake و طبقه‌بندی ریسک
  → Foundation Proposal و تأیید انسانی
  → برنامه/تیم/Taskهای نسخه‌دار
  → اجرای کد فقط در Product Runner ایزوله
  → تست، بازبینی امنیت و Evidence
  → image و Delivery Bundle تغییرناپذیر
  → Product Test مستقل
  → تمرین انتقال و بازیابی
  → پذیرش Owner
  → Pilot یا Production فقط با مجوز مستقل
```

**تعریف موفقیت برای نخستین محصول هدف:** یک محصول وب کم‌ریسک و مشخص، با مخزن مستقل، image دارای digest، تست‌های واقعی، Product Test مستقل، health/readiness، محدودیت منابع، لاگ redacted، rollback ثبت‌شده و تمرین انتقال به مقصد Clean. خروجی باید بدون تغییر در container، database، network، volume، Secret یا پورت Hero و دیگر اپ‌های host باشد.

## ۴. اصول غیرقابل‌مذاکره

1. Hero Control Plane، Hero Test، Product Test و Product Production چهار محیط مجزا هستند؛ هم‌سروربودن آن‌ها مجوز اشتراک داده یا منابع نیست.
2. هر محصول هدف repository، Compose project، database، data volume، network، Secret reference، پورت/دامنه، backup و rollback مخصوص خود دارد.
3. هیچ محصولی به Docker socket، `network_mode: host`، privileged mode، bind mount حساس host، root filesystem قابل‌نوشتن یا volume/network Hero دسترسی ندارد.
4. Artifact فقط با digest immutable منتقل می‌شود؛ `latest`، rebuild در مقصد و copy کردن `.env` مبنای release نیست.
5. AI فقط پیشنهاد/تحلیل می‌دهد؛ تغییر Scope، کد، زیرساخت یا اجرای side effect بدون command نسخه‌دار، policy، test و authorization جدا ممنوع است.
6. Secret هرگز وارد Prompt، Log، Evidence، Git، bundle یا UI نمی‌شود؛ فقط reference امن و environment-specific نگهداری می‌شود.
7. Product Test و Product Production هیچ‌گاه با Hero Test و Hero Production یکی نامیده یا به‌جای هم promotion نمی‌شوند.
8. خطا و ابهام fail-closed است: درخواست متوقف می‌شود و دلیل امن/قابل‌اقدام ثبت می‌شود، نه اینکه با حدس ادامه پیدا کند.

## ۵. معماری هدف و مرزهای اجرایی

### ۵.۱. Control Plane در برابر Execution Plane

| لایه | مسئولیت | ممنوعیت |
|---|---|---|
| Hero Control Plane | intake، policy، task graph، approval، audit، evidence و نمایش وضعیت | نگهداری Secret خام یا اجرای کد محصول در container خود Hero |
| Product Runner | checkout/image build/test محدود برای یک Product/Run | دسترسی به Docker socket، شبکه/volume Hero، Secret دیگر محصولات یا privileged host |
| Product Test Runtime | اجرای image محصول با منابع و دادهٔ Test مستقل | تماس با Product Production یا reuse منابع Hero |
| Remote Target Agent | اجرای command امضاشدهٔ محدود، health و evidence | listener عمومی کنترل، shell دلخواه، credential دائمی یا اجرای command خارج از Scope |

### ۵.۲. اجرای هم‌سرور روی ParsPack

این گزینه **طراحی هدف** است، نه قابلیت عملیاتی کنونی. وقتی PF-2 Exit Gate بسته شد، یک محصول روی همان host فقط با این الگو مجاز است:

```text
Hero Test:          hero-test-*            (منابع موجود Hero)
Product Test:       hero-product-<slug>-test-*
  - repo/worktree:  مستقل از /opt/hero
  - compose project: hero-product-<slug>-test
  - network:        hero-product-<slug>-test-net
  - volumes:        hero-product-<slug>-test-*
  - database:       فقط همان محصول و محیط
  - ports:          رزرو و bind صریح؛ بدون تعارض
```

برای هر product runtime، non-root user، `read_only` در صورت امکان، `cap_drop`، `no-new-privileges`، CPU/memory/PID limits، healthcheck، restart policy محدود، egress allowlist و logging redacted اجباری است. هیچ `container_name` ثابت/عمومی، network مشترک یا dependency مسیرمحلی به Hero مجاز نیست. هر release پیش از اجرا با compose config و اسکن isolation بررسی می‌شود.

### ۵.۳. انتقال به سرور دیگر

قابل‌انتقال‌بودن با کپی runtime زنده اثبات نمی‌شود. محصول باید release bundle بدون Secret داشته باشد: digest image، SBOM/attestation، migration contract، schema/config version، checksum backup رمزگذاری‌شده و runbook restore. مقصد جدید فقط با secret channel مستقل، host identity، agent enrollment و authorization همان Target شروع می‌شود. clone کردن `.env`، volume یا network از host مبدا ممنوع است.

## ۶. Workstreamها و خروجی‌های گیت‌دار

### PF-0 — منبع حقیقت و baseline عملیاتی

**هدف:** جلوگیری از تصمیم‌گیری بر اساس release یا سند منقضی.

| خروجی | معیار پذیرش | نگاشت Back Office |
|---|---|---|
| status/evidence جاری | source، digest، workflow، smoke، test count و non-claimها تفکیک شده باشند | BO-001..010 |
| registry و supersession | فقط یک roadmap فعال برای sequencing جاری؛ اسناد تاریخی حفظ و برچسب‌خورده باشند | BO-003، BO-010 |
| release evidence | Test Hero با immutable manifest و rollback point قابل ردگیری باشد | BO-135..146 |

**Exit Gate:** سند/رجیستری با واقعیت Test تناقض نداشته باشد و هیچ قابلیت برنامه‌ای به‌عنوان عملیاتی معرفی نشود.

### PF-1 — مسئله تا Foundation Proposal و تیم کنترل‌شده

**هدف:** تبدیل درخواست Owner به محصول قابل‌بررسی، نه اجرای فوری.

| تحویل | معیار پذیرش |
|---|---|
| Product Request | مسئله، کاربر، outcome، محدوده، حساسیت، محدودیت قانونی/امنیتی، بودجه و معیار پذیرش دارد. |
| Risk classification | درخواست پرریسک، غیرقانونی، دورزنندهٔ کنترل یا نامشخص به review انسانی ارجاع می‌شود؛ از prompt به command تبدیل نمی‌شود. |
| Foundation Proposal | نوع محصول، repo، محیط‌ها، policy pack، مدل‌های AI، تیم، task graph، budget و target پیشنهادی نسخه‌دار و قابل revise است. |
| Owner decision | approve/revise/reject صریح با version و evidence دارد. |
| UI قابل‌فهم | Owner فقط انتخاب‌های ضروری را می‌بیند؛ جزئیات پیش‌فرض و علت پیشنهاد قابل مشاهده‌اند. |

**نگاشت:** BO-031..042، BO-043..052، BO-063..074، BO-075..088.
**Exit Gate:** PASS در ۲۰۲۶-۰۹-۱۸؛ دو Product Request مستقل project-scoped با persistence، replay، version conflict و negative authorization واقعی تأیید شدند؛ چهار رکورد قدیمی/جدید دارای Foundation هستند. هیچ repo/container در این مرحله ایجاد نمی‌شود.

**Evidence برش PF-1 (2026-09-18):** Intake، risk classification، runtime plan نسخه‌دار، owner risk gate، admission policy پیش از start، UI قابل‌فهم و Product Request idempotent در source پیاده و با `pnpm check` تأیید شده‌اند. Product Request fingerprint-bound است، replay همسان می‌دهد، تغییر داده با همان کلید را رد می‌کند و metadata درخواست، پروژه و Foundation در PostgreSQL با migration `017` در یک تراکنش ثبت می‌شود؛ کلید خام، فرم خام و Secret ذخیره نمی‌شوند. چهار ایراد واقعی در این مسیر ریشه‌یابی و اصلاح شده‌اند: خواندن نادرست هدر `Idempotency-Key` در Node، ردشدن policy flag امن `secretWrite`، حذف‌شدن `productRequest.projectId` از read model و ثبت سه رکورد در تراکنش‌های جدا. برای دادهٔ قدیمی نیمه‌ثبت‌شده، replay امن Foundation گمشده را repair می‌کند. rc.8 با commit `790bfe8` و digest immutable در Test promote شد؛ container healthy است و `/health`، `/ready` و PostgreSQL persistence موفق‌اند. دو درخواست جدید C/D هرکدام ۲۰۱، replay هرکدام ۲۰۰، تعارض کلید ۴۰۹، درخواست بدون مجوز ۴۰۱ و replay/repair دو رکورد قدیمی A/B هرکدام ۲۰۰ ثبت شد؛ شمارش نهایی ۴ Product Request، ۴ Project و ۴ Foundation است. PF-1 اکنون `verified` است و جزئیات در `HERO-EVIDENCE-PRODUCT-FACTORY-PF1-20260917@1.5.0` ثبت شده است.

### PF-2 — Product Runner ایزوله روی host مشترک

**هدف:** اجرای توسعه و test محصول نخست روی همان ParsPack، بدون اختلال در Hero یا appهای دیگر.

| تحویل | معیار پذیرش |
|---|---|
| runner contract | هر Run به `project_id`، `run_id`، repo/artifact، resource policy و target محدود است. |
| workspace isolation | worktree/repo محصول جدا، مالکیت فایل محدود، cleanup قابل‌ردگیری و عدم دسترسی به `/opt/hero` در Runtime. |
| build/test sandbox | network و ابزار allowlist، timeout، quota، no privileged Docker/socket، خروجی redacted. |
| runtime plan | Compose project name، port reservation، network/volume/db، health/rollback و capacity check قبل از start. |
| guardrails | reject تست‌شده برای name collision، host network، host mount، privileged، secret leak، quota/port conflict و cross-product access. |

**نگاشت:** BO-075..088، BO-121..134.
**Exit Gate:** یک image نمونهٔ بی‌خطر در Product Test با container جدا اجرا، healthcheck و rollback شود؛ آزمایش نشان دهد Hero Test و یک سرویس کنترل‌شدهٔ دیگر دست‌نخورده‌اند. این gate مجوز Product Production نیست.

**وضعیت اجرای PF-2/PF-3 در ۲۰۲۶-۰۹-۱۸:** قرارداد و admission اولیه در commit `788746c` بود و در commit `c22d556` به adapter واقعیِ گیت‌دار ارتقا یافت؛ commit‌های `dd95723`، `73a7b45`، `71d26fe` و `c3d1334` guard رزرو، store پایدار، capacity enforcement، lease heartbeat/reconciliation، probe ظرفیت و immutable artifact contract را تکمیل کردند. commit `0003896` گیت `testCommand` بدون shell، build network=`none`، سازگاری با Compose و evidence bundle را اضافه کرد و commit جاری `2b4ec6a` چرخهٔ stop/cleanup idempotent و harness executor رسمی PF-3 را ثبت کرد. adapter اکنون workspace مستقل، Compose preflight، argv-only، digest immutable، network `none`، non-root، read-only، no-new-privileges، cap drop، quota، reservation/lease، timeout و redaction را کنترل می‌کند؛ ورودی ناامن، path/symlink، host mount/socket، image mutable، plan ناقص، authorization نامنطبق، تعارض resource و lease منقضی fail-closed هستند. Hero Test روی rc.15 با run `35314609142` و digest `sha256:bec56ba76d8b70e3a704bfc05d5d349abe1abe1a60bd35674f63bea4f94221b0` فعال و verify شده است. اجرای رسمی safe sample با run `official-pf3-20260918f`، Compose project یکتا، artifact `hero-product-official-sample@sha256:873bb0e4f49fb8d875232e6478e2a6847c02e3a645b85342c1407b6c858dc884`، lifecycle کامل، quality/security evidence، health، rollback و no-impact موفق شد. PF-3 sample اکنون `ready-for-owner-acceptance` است؛ اجرای محصول واقعی، capacity snapshot پایدار/زمان‌بندی reconciliation، clean-target portability/recovery و Product Production همچنان گیت‌های بعدی‌اند. Evidence جاری در `HERO-EVIDENCE-PRODUCT-FACTORY-PF2-RUNNER-CONTRACT-20260918@1.11.0` و `HERO-EVIDENCE-PRODUCT-FACTORY-PF3-20260918@1.2.0` ثبت می‌شود.

### PF-3 — Artifact محصول، Product Test و پذیرش کیفیت

**هدف:** خروجی قابل‌حمل، آزموده و قابل‌ردگیری بسازیم.

| تحویل | معیار پذیرش |
|---|---|
| immutable release | commit، version، digest، SBOM/attestation و test evidence دقیقاً یک release را معرفی کنند. |
| Product Test deploy | همان digest، configuration سازگار Test، migration safe، health/readiness و rollback point. |
| quality/security gates | unit/integration/browser E2E متناسب، SAST/dependency/secret scan، least privilege و no-sensitive-log evidence. |
| Owner acceptance | معیارهای Product Request و known gaps قابل مشاهده و accept/revise هستند. |

**نگاشت:** BO-135..146، BO-147..156.
**Exit Gate:** Test product از مسیر immutable artifact با evidence واقعی قابل استفاده باشد و شکاف‌ها صریح باشند.

### PF-4 — Target خارجی و Node Agent کم‌اختیار

**هدف:** افزودن سرور دیگر بدون دادن دسترسی دائمی یا کنترل فراگیر به Hero.

| تحویل | معیار پذیرش |
|---|---|
| target inventory | مالک، محیط، ظرفیت، شبکه، domain، policy و وضعیت revoke برای هر server ثبت شود. |
| enrollment | Agent با هویت چرخشی و کانال خروجی به Control Plane ثبت شود؛ inbound public control port ندارد. |
| signed dispatch | command محدود به artifact/target/operation ازپیش‌تأییدشده است؛ shell آزاد پذیرفته نمی‌شود. |
| health/evidence | heartbeat، health، digest runtime، failure/timeout و revoke امن ثبت می‌شوند. |

**نگاشت:** BO-121..134، BO-163.
**Exit Gate:** یک Target Test پاک با command harmless و revoke/timeout test؛ Secret یا Production در scope نیست.

**وضعیت اجرای PF-4 در ۲۰۲۶-۰۹-۱۸:** قرارداد `HERO-OPS-REMOTE-PRODUCT-TARGET-AND-NODE-AGENT@1.0.0` و evidence `HERO-EVIDENCE-PRODUCT-FACTORY-PF4-REMOTE-AGENT-20260918@1.0.0` در source اضافه شد. inventory، enrollment، fingerprint، heartbeat، امضای Ed25519، allowlist، digest immutable، replay/expiry/scope rejection، redaction و revoke در شبیه‌سازی local/Test PASS شدند. Target خارجی واقعی، connector شبکه و credential/Secret عمداً اجرا نشده‌اند؛ بنابراین Exit Gate PF-4 هنوز `blocked-for-real-target` است، نه completed.

**وضعیت اجرای PF-5 در ۲۰۲۶-۰۹-۱۸:** قرارداد `HERO-OPS-PRODUCT-DELIVERY-BUNDLE-AND-CLEAN-TARGET@1.0.0`، Delivery Bundle immutable، schema پیکربندی بدون Secret، migration/backup/restore و compatibility matrix در source اضافه شد. تمرین رسمی `pf5-rehearsal-20260918a` با digest evidence `sha256:30814f40287ed355b0988664a6c9384f5a8c02e765cddaa2cfa68b2c7960e87c`، `networkCalls=0`، clean-target phases، recovery proof و `PORTABILITY_VERIFIED` PASS شد. انتقال واقعی به مقصد Test جدا، backup/restore واقعی و Owner acceptance هنوز اجرا نشده‌اند؛ Exit Gate PF-5 بنابراین `blocked-for-real-target` است.

### PF-5 — portability، recovery و تمرین انتقال

**هدف:** محصول از روز اول قابل جابه‌جایی باشد، نه اینکه بعداً به host وابسته شود.

| تحویل | معیار پذیرش |
|---|---|
| delivery bundle | digest، SBOM، checksum، config schema، migration plan، backup reference و restore runbook؛ بدون Secret. |
| clean-target rehearsal | همان digest روی مقصد Clean، با secret/config مقصد و بدون copy volume/.env از مبدا اجرا شود. |
| recovery proof | backup/restore checksum، migration، health/readiness و rollback واقعی ثبت شود. |
| compatibility matrix | نسخهٔ app/schema/config/agent قابل قبول و migration incompatibility fail-closed باشد. |

**نگاشت:** BO-142..146، BO-157..169.
**Exit Gate:** انتقال Product Test به یک مقصد Test جدا با evidence کامل؛ سپس Owner acceptance. Pilot/Production همچنان جداست.

### PF-6 — تجربهٔ Owner، مشاهده‌پذیری و hardening

**هدف:** مسیر برای کاربر غیرمتخصص قابل‌فهم و برای عملیات قابل‌اعتماد باشد.

تحویل‌های لازم: صفحهٔ «درخواست ساخت محصول»، توضیح علت پیشنهاد مدل/تیم/target، preview تغییر، approval واضح، inbox actionable، trace/correlation، دفتر خطا، E2E دو محصول، RTL/LTR/accessibility، load/soak، failure injection و security/adversarial isolation tests.

**نگاشت:** BO-053..062، BO-099..120، BO-147..168.
**Exit Gate:** هر تصمیم مهم به evidence، owner، policy و rollback مرتبط باشد و در حالت failure یک پیام فارسی ساده و غیرحساس نمایش داده شود.

**وضعیت اجرای PF-6 در ۲۰۲۶-۰۹-۱۸:** harness رسمی `pf6-simulation-20260918a` روی دو project scope با `102` trace، deduplication، correlation، stale/recovery SLI، retention/cleanup hold، isolation و auditهای accessibility/security/load/backup-restore/secret-dependency/role-regression PASS شد؛ evidence digest برابر `sha256:fb5d1766f5dcc930c2682c19c3a42f351bb17cf2ff85aac4731d9c75cfee0962` است. Browser E2E واقعی، axe/screen-reader و load/soak روی deployment واقعی در این محیط اجرا نشده‌اند؛ Exit Gate PF-6 هنوز `blocked-for-real-runtime-evidence` است.

### PF-7 — Pilot و Production (عمداً خارج از batchهای بعدی)

Pilot فقط پس از BO-169، exercise انتقال، پذیرش Owner و authorization مخصوص Pilot مطرح می‌شود. Product Production نیز علاوه بر آن، به مجوز `production-deploy`، target مستقل، security review، backup/rollback و فرمان صریح نیاز دارد. هیچ موفقیت Test یا AI recommendation جای این مجوزها را نمی‌گیرد.

## ۷. ترتیب توسعهٔ پیشنهادی بعد از مرور Owner

### Batch A — طراحی قابل‌اجرا، بدون dispatch خارجی

PF-1 را با مدل Product Request، classification، Foundation Proposal، approval/revise، acceptance و UI ساده پیاده‌سازی می‌کنیم. همزمان policy/schema برای PF-2 (identity، resource policy، repository/artifact contract و port/volume/network plan) ساخته می‌شود، اما container یا host دیگری ساخته/تغییر داده نمی‌شود.

### Batch B — runner و runtime نمونهٔ ایزوله

PF-2 با یک محصول وب بی‌خطر/نمونه آغاز می‌شود. هدف فقط اثبات isolation و rollback در Product Test است، نه ساخت محصول تجاری یا اتصال Provider زنده.

### Batch C — artifact، Product Test و انتقال

PF-3 و PF-5 برای همان نمونه کامل می‌شود: digest، evidence، delivery bundle، clean-host rehearsal و owner acceptance.

### Batch D — Target خارجی و نخستین محصول واقعی

پس از اثبات Batch C و authorization جدید، PF-4 و نخستین Product Request واقعی با scope محدود اجرا می‌شوند.

## ۸. تصمیم‌هایی که Owner در مرور بعدی تأیید می‌کند

این‌ها امروز تغییر عملیاتی نمی‌دهند و نباید پنهانی فرض شوند:

1. نخستین محصول فقط Web کم‌ریسک باشد یا نوع دیگری؟
2. نخستین Product Test در همان ParsPack شروع شود یا یک host Test جدا مقدم باشد؟
3. سقف CPU/RAM/disk/egress/زمان هر Product Run چقدر باشد؟
4. registry/container runtime چه provider یا registry را مجاز بداند؟
5. اولین target خارجی چه محیطی است و چه کسی مالک عملیاتی آن است؟
6. چه نوع درخواست‌ها بدون بررسی حقوقی/امنیتی هرگز وارد Proposal نشوند؟

تا تأیید، پیش‌فرض امن: محصول وب نمونه، Test-only، بدون Provider پولی، بدون server خارجی، بدون Secret جدید و بدون public exposure.

## ۹. وضعیت اسناد پیشین

| سند | وضعیت در این برنامه |
|---|---|
| `HERO-ROADMAP-BACKOFFICE-COMMAND-CENTER-V1` | active و هنجاری؛ تمام BO-001..170 حفظ شده‌اند. |
| `HERO-ROADMAP-STATUS-20260917` | active؛ منبع وضعیت/evidence جاری، نه ترتیب اجرای آینده. |
| `HERO-ROADMAP-NEXT-100-STEPS-20260904` و سه سند Next ذکرشده در metadata | superseded برای sequencing؛ به‌عنوان تاریخچه/evidence حفظ می‌شوند. |
| `HERO-ROADMAP-OPEN-50-PRIORITY-20260904` و batchهای کوتاه‌تر | reference تاریخی/audit؛ منبع برنامه‌ریزی جاری نیستند. |
| `HERO-ARCH-ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL` | مرجع معماری محیط، isolation و promotion. |
| `HERO-OPS-PRODUCT-RUNTIME-ISOLATION-AND-TRANSFER` | runbook پیشنهادیِ پذیرش target و انتقال؛ اجرای خودکار نیست. |

## ۱۰. معیار گزارش پیشرفت

هر گزارش باید سه وضعیت را جدا نمایش دهد:

| سطح | معنی |
|---|---|
| `planned` | تصمیم/سند/قرارداد حاضر است، اما runtime ندارد. |
| `implemented` | کد و تست محلی/CI وجود دارد، اما evidence محیط هدف هنوز کامل نیست. |
| `verified` | artifact، محیط، تست واقعی، security/isolation، rollback و acceptance همان scope ثبت شده‌اند. |

گفتن «Hero می‌تواند نرم‌افزار بسازد» فقط هنگامی درست است که PF-1 تا PF-5 برای همان نوع محصول و target در سطح `verified` باشند. تا آن زمان عبارت درست این است: «Hero برنامه و کنترل توسعه را آماده می‌کند؛ اجرای محصول هنوز گیت‌دار/در حال توسعه است.»
