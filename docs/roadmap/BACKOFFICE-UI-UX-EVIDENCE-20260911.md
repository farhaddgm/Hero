# Evidence طراحی، پیاده‌سازی و استقرار Test رابط Back Office

> Document ID: `HERO-EVIDENCE-BACKOFFICE-UI-UX-20260911`  
> Version: `1.2.5`  
> Status: `active`  
> Owner: `hero-quality`  
> Date: `2026-09-11`  
> Authorization: `BATCH-BACKOFFICE-20260911-019`  
> Specifications: `HERO-SPEC-022@1.0.0` و `HERO-SPEC-023@1.0.0`

## ۱. دامنهٔ انجام‌شده

- ممیزی اسناد محصول و ثبت gapهای UI/UX؛
- تحقیق رسمی روی Primer، Atlassian، Grafana و Linear؛
- ثبت Design Contract و برنامهٔ توسعه؛
- ساخت Shell مشترک بدون asset یا dependency شبکه‌ای؛
- بازطراحی Portfolio با KPI واقعی، Search/Filter، Project card و owner-only create flow؛
- اتصال Command Center، Product Studio، Workspace، Operations، Identity و Safe Lab به Shell؛
- افزودن Command palette، Theme، projectId propagation، Skip link، focus و reduced motion؛
- اصلاح خطای syntax سه اسکریپت قدیمی؛
- یکسان‌سازی کلید نشست `hero.identity.session` میان Identity و Workspace؛
- ساخت تست قرارداد رابط و جلوگیری از script breakout؛
- build image و جایگزینی فقط Control Plane محیط Test.

## ۲. فایل‌های اصلی

| نوع | مسیر |
|---|---|
| Design Contract | `docs/specs/HERO-023-v1.0.md` |
| برنامه | `docs/roadmap/BACKOFFICE-UI-UX-IMPLEMENTATION-v1.0.md` |
| Shared Shell | `apps/control-plane/src/hero-shell.mjs` |
| Portfolio | `apps/control-plane/src/portfolio-view.mjs` |
| Workspace | `apps/control-plane/src/project-workspace-view.mjs` |
| تست UI | `tests/backoffice-ui.test.mjs` |

## ۳. نتایج آزمون

این جدول baseline تحویل اولیه است. کنترل جاریِ Scope پروژه و Test runtime در بخش ۵.۱ ثبت شده و در صورت اختلاف، آن بخش مقدم است.

| کنترل | نتیجهٔ واقعی |
|---|---|
| Targeted UI/integration suite | PASS — ۴۱ تست، صفر شکست |
| Documentation check | PASS — ۱۳۱ سند، ۲ محصول، صفر خطا |
| Full check در Linux source snapshot | PASS — ۳۳۲ تست، صفر شکست |
| Clean-room | PASS — ۴۵۶ فایل در full check |
| Build validation | PASS — ۲۴۵ ماژول و ۴۵ JSON |
| Docker build verification | PASS — ۳۳۲ تست، صفر شکست؛ ۴۵۵ فایل داخل build context |
| `git diff --check` | PASS |

هشدار Docker در Doctor داخل container فقط نبود Docker-in-Docker است و شکست build/test محسوب نمی‌شود.

## ۴. Artifact و محیط Test

- image محلی: `hero-control-plane:local`
- image ID ساخته‌شده: `sha256:931b8b4b81a0fc8846b1e1b10ca8f2b76160d4e498702d36b909829cf42458b6`
- image ID کانتینر `hero-test-control-plane-1`: دقیقاً همان digest؛
- PostgreSQL: healthy؛
- Control Plane: healthy؛
- Back Office proxy: healthy؛
- `/health`: `status=ok`؛
- `/ready`: `status=ready` و `persistence=postgresql`.

### ۴.۱ Smoke مرز احراز هویت

بدون Credential، routeهای `/portfolio`، `/backoffice`، `/product-studio`، `/identity`، `/workspace` و `/project-control` همگی HTTP 401 بازگرداندند.

با Credential موجود در خود container و بدون نمایش یا انتقال مقدار آن:

| Route | نتیجه |
|---|---|
| `/portfolio` | HTTP 200، `shell=v1` |
| `/backoffice` | HTTP 200، `shell=v1` |
| `/product-studio` | HTTP 200، `shell=v1` |
| `/identity` | HTTP 200، `shell=v1` |
| `/workspace` بدون `projectId` | HTTP 400، fail-closed |
| `/project-control` بدون `projectId` | HTTP 400، fail-closed |

`/portfolio-data` در Test در زمان بررسی صفر پروژه گزارش کرد. در نتیجه runtime smoke روی Workspace/Operations یک پروژهٔ واقعی انجام نشد. ایجاد دادهٔ مصنوعی یا شروع Pilot برای سبزکردن تست مجاز نبود. تست‌های integration project-scoped هر دو route موفق‌اند.

## ۵. وضعیت Production

Production تغییر نکرد. Source رابط برای Test و Production مشترک است، ولی promotion به Production باید دقیقاً همین artifact یا یک digest جدیدِ آزموده‌شده، Authorization مستقل، rollback و post-deploy observation داشته باشد.

## ۵.۱ اصلاح Scope پروژه و smoke واقعی Test — ۲۰۲۶-۰۹-۱۱

این الحاق، نتیجهٔ بازخورد مالک دربارهٔ آمیختن دادهٔ پروژه‌ها و routeهای بدون Scope را ثبت می‌کند. رکوردهای پیشین این Evidence تاریخچهٔ تحویل قبلی هستند؛ مقادیر زیر کنترل نهایی همین اصلاح‌اند.

- پس از ورود انسانی، صفحهٔ نخست `/portfolio?select=project` است. Portfolio تنها نمای چندپروژه‌ای است؛ انتخاب پروژه، Context را در Command، Studio، Workspace و Operations حفظ می‌کند.
- `/backoffice` در خود Control Plane به انتخاب‌گر Portfolio redirect می‌شود؛ هیچ پیوند داخلی به آن وجود ندارد. `/portfolio?surface=command`، `/product-studio`، `/workspace` و `/project-control` بدون `projectId` نیز به انتخاب‌گرِ دارای مقصد بازمی‌گردند.
- snapshot مرکز فرمان و Product Studio فقط از `projectId` انتخاب‌شده ساخته می‌شود. آزمون integration با VPN و CRM اثبات می‌کند هیچ دادهٔ CRM در response یا HTML VPN نمایش داده نمی‌شود.
- پروژهٔ موجود `project-vpn` در Test با endpoint Owner-only و append-only به `draft` بازگشت. تاریخچهٔ پیشین حذف نشد و Foundation پیشنهادی جدید ثبت شد. خروجی‌های UI آن را به‌عنوان `VPN · draft` نشان می‌دهند.
- image جاری Test برابر `hero-control-plane:local` با image ID `sha256:2ea2d53e2472b7b2df1cee46d05bb3be9a6fdd8916416491d58a8ad54780bdd6` است؛ Control Planeِ اجراشده دقیقاً همین image را دارد و healthy است.

| کنترل | نتیجهٔ واقعیِ اصلاح Scope |
|---|---|
| Linux Verify | PASS — clean-room: ۴۶۳ فایل؛ build: ۲۴۸ ماژول و ۴۶ JSON؛ ۳۵۰ تست موفق، صفر شکست |
| Documentation | PASS — ۱۳۲ سند، ۲ محصول، صفر خطا |
| Test health/readiness | PASS — Control Plane، PostgreSQL و Proxy healthy؛ `/health=ok` و `/ready=persistence:postgresql` |
| VPN Draft | PASS — `project-vpn` در Portfolio برابر `draft`؛ Studio data برابر یک پروژه و چهار گام Foundation |
| routeهای داخلی Test | PASS — selector، Command، Studio، Workspace، Operations و Identity همگی HTTP 200؛ Command بدون Scope و `/backoffice` redirect درست دارند |
| دامنهٔ عمومی Test | PASS — selector، Command، Studio، Workspace، Operations و Identity با Basic Auth صحیح HTTP 200 و VPN Draft را نمایش می‌دهند |

نشست انسانی smoke بعد از هر اجرا revoke شد و هیچ Credential، Token یا Secret در output ثبت نشده است. Production، Provider، هزینه، Pilot و Secret تغییری نکرده‌اند.

### مرز legacy

مسیر دستیِ خارجی `/backoffice` هنوز پیش از رسیدن به Control Plane توسط gateway بیرونی Test با HTTP 401 متوقف می‌شود؛ این رفتار در configuration خارج از repository قرار دارد. چون تمام navigation و مسیر پس از ورود به `/portfolio?select=project` منتقل شده‌اند، کاربر در جریان عادی به این route نمی‌رود. اصلاح gateway legacy در صورت نیاز باید با مجوز و دسترسی جداگانه به همان gateway انجام شود؛ این مورد به‌عنوان «عدم استفاده از legacy» ثبت شده، نه «رفع gateway». 

## ۵.۲ نشست انسانی پایدار در مرورگر — ۲۰۲۶-۰۹-۱۳

- جایگزین‌شده: نگهداری token در `sessionStorage` با cookie امن و HttpOnly شش‌ساعته؛ بنابراین Refresh سخت و تب دیگر همان مرورگر، نشست انسانی معتبر را نگه می‌دارند.
- به‌روزشده: Identity، Portfolio، Workspace و Walk-Through از درخواست same-origin استفاده می‌کنند و وابستگی رابط به token قابل‌خواندن در JavaScript ندارند.
- افزوده‌شده: Origin check برای mutationهای cookie-backed، پاک‌شدن cookie در logout و تست سازگاری با Basic Auth شبکه‌ای Test.

| کنترل | نتیجهٔ واقعی |
|---|---|
| Full Linux check | PASS — ۳۵۴ تست، صفر شکست؛ clean-room ۴۶۷ فایل |
| Documentation | PASS — ۱۳۳ سند، صفر خطا |
| Build | PASS — ۲۵۰ module و ۴۶ JSON |
| Test runtime | PASS — health/readiness و PostgreSQL healthy |
| Test Human Identity | PASS — cookie `Secure`/`HttpOnly`/`SameSite=Strict` با TTL=۲۱٬۶۰۰، درخواست تکراری، logout و revoke |

image فعال Test: `sha256:c65354b7f29ced0d9720ecba7b19e62cadb6179cda83b9ed69889e20b470909f`. Production تغییر نکرد.

## ۵.۳ Walk-Through 1.4 — مشاورهٔ محلی و Bubble بدون تغییر layout — ۲۰۲۶-۰۹-۱۴

- افزوده‌شده: پنل شناور مستقل «مشاورهٔ AI» از coach هر گام، با عنوان گام، Scope پروژه و نام فیلدهای همان گام؛ پنل در ابتدا پنهان است، به‌صورت مستقل به لبهٔ چپ/راست جابه‌جا می‌شود و هیچ layout صفحه یا پنل اول را تغییر نمی‌دهد.
- افزوده‌شده: «پیشنهاد» فقط برای فرم‌های غیرحساس Draft، Intake، ورودی متن، Foundation و Settings، مقادیر template را در کنترل‌های موجود پیش‌پر می‌کند. هیچ Submit/Save/Approve/Dispatch/Provider/Deploy خودکار در مسیر پیشنهاد وجود ندارد.
- اصلاح‌شده: منطق قبلیِ reserve-margin روی target به‌طور کامل حذف شد. coach/advisor `position: fixed` و `contain: layout paint style` دارند و target فقط outline غیرهندسی می‌گیرد؛ بنابراین راهنما نباید کارت یا فیلد را جابه‌جا یا پرپر کند.
- افزوده‌شده: «کمینه‌سازی» coach را بدون توقف مسیر به نشان `H` در لبهٔ انتخاب‌شده تبدیل می‌کند؛ بازیابی، همان گام فعال را برمی‌گرداند.
- مرز صداقت: endpoint `/api/walkthrough/advice` با Human Identity و Project Grant read-scope محافظت می‌شود، پرسش را persist/echo نمی‌کند و در این نسخه `providerInvoked=false` است. بنابراین نه Provider خارجی فراخوانی می‌شود، نه Token/هزینه/فرمان بیرونی ایجاد می‌شود.

| کنترل | نتیجهٔ واقعی |
|---|---|
| Full Linux source check | PASS — ۳۵۵ تست، صفر شکست؛ clean-room ۴۶۷ فایل |
| Documentation | PASS — ۱۳۳ سند، صفر خطا |
| Build | PASS — ۲۵۰ module و ۴۶ JSON |
| Test preflight | PASS — محیط ایزوله و Provider زنده خاموش |
| Test health/readiness | PASS — `hero-test-control-plane-1` healthy؛ `/health=ok` و `/ready=persistence:postgresql` |
| Test Human Identity smoke | PASS — login/MFA/cookie/revoke؛ Secret در output ثبت نشد |
| Test Walk-Through advisor smoke | PASS — `project-vpn` scoped، `providerInvoked=false` و پیشنهاد Intake موجود؛ نشست آزمون revoke شد |

image فعال Test: `sha256:43d8f11fb782ba2054e08e2d98d333affd46fd94304b364c5e4ee394d03069d3`. Production، Secret، Provider، هزینه، Pilot و عملیات برگشت‌ناپذیر تغییر نکردند.

## ۵.۴ Walk-Through 1.6.1 و canonical AI Connections — ۲۰۲۶-۰۹-۱۴

- اصلاح‌شده: وقتی صفحهٔ پویا کارت‌های هدف را بازسازی می‌کند یا نشست انسانی یک بخش پنهان را نمایش می‌دهد، coach فعال به گرهٔ جداشده متکی نمی‌ماند. تغییر `hidden`، `class` و جایگزینی محتوا با یک retry همگام‌شده تشخیص داده می‌شود؛ اتصال فقط وقتی هدفِ همان گام واقعاً قابل‌دیدن باشد برقرار می‌شود.
- اصلاح‌شده: انتخاب Project موجود، گام اختیاری ساخت Draft را رد می‌کند. ساخت Draft توسط Owner، state فعال را با همان Project تازه به گام Intake منتقل می‌کند؛ مسیر راهنما گم یا reset نمی‌شود.
- اصلاح‌شده: پیوند داخلی «اتصال‌های AI» اکنون `/api/portal?surface=ai#ai` است. مسیرهای legacy `/portfolio?surface=ai` و `/backoffice?surface=ai` دیگر مسیر ورود انسانی نیستند؛ هیچ لینک داخلی آن‌ها را صادر نمی‌کند. در صفحهٔ AI، دکمهٔ `رفتن به ثبت امن کلید` مستقیماً فرم Owner-only را قابل‌دسترسی می‌کند.

| کنترل | نتیجهٔ واقعی |
|---|---|
| Full Linux source check | PASS — clean-room ۴۶۷ فایل؛ Documentation ۱۳۳/۰؛ build ۲۵۰ module و ۴۶ JSON؛ ۳۵۸ تست موفق، صفر شکست |
| Test Control Plane | PASS — image `hero-control-plane:local` با image ID کوتاه `3625700f1bab` بازسازی و فقط همین service recreate شد؛ Control Plane، PostgreSQL و proxy healthy هستند |
| Test Human Identity | PASS — login/MFA/cookie شش‌ساعته/revoke؛ هیچ Secret یا Token در output ثبت نشد |
| Test canonical AI route | PASS — `/portfolio?surface=ai` HTTP 200 و نمای Provider Health/Token را می‌دهد؛ `/backoffice?surface=ai` HTTP 302 به `/portfolio?surface=ai` |

Production، gateway بیرونی legacy، Secret، Provider زنده، هزینه، GitHub/Server، Pilot و عملیات برگشت‌ناپذیر در این استقرار تغییر نکرده‌اند.

## ۵.۵ Walk-Through 1.6.2 و Browser Portal نشست انسانی — ۲۰۲۶-۰۹-۱۴

- اصلاح‌شده: همهٔ ناوبری‌های داخلیِ کاربر انسانی—از جمله «اتصال‌های AI»، Portfolio، Studio، Workspace، Operations و Guide—به `/api/portal?surface=…` منتقل شدند. این مسیر فقط cookie نشست Human Identity را به‌عنوان Principal می‌پذیرد؛ Basic Auth نمی‌تواند نشست یا Project Grant را دور بزند.
- اصلاح‌شده: پیوندهایی که Workspace پس از refresh از روی دادهٔ پروژه می‌سازد نیز Portal هستند؛ بنابراین بازسازی صفحه کاربر را به مسیر legacy و درخواست دوبارهٔ Basic برنمی‌گرداند.
- اصلاح‌شده: نشان `H` راهنمای کمینه‌شده state کمینه را در حافظهٔ صفحه و local storage هم‌زمان مدیریت می‌کند. با کلیک، coach فعال دوباره نصب می‌شود؛ اگر target پویا در همان لحظه جایگزین شود، retry دو فریمی انجام و fallback امن تا آماده‌شدن target حفظ می‌شود.

| کنترل | نتیجهٔ واقعی |
|---|---|
| Full Linux source check | PASS — `pnpm check`؛ clean-room ۴۶۹ فایل، Documentation ۱۳۴/۰، build ۲۵۲ module و ۴۶ JSON، ۳۶۳ تست موفق و صفر شکست |
| Test Control Plane | PASS — فقط `hero-test-control-plane-1` با image `sha256:b6ab731a1db2850d7e40ca7343b51a4b19e1b1f539825beacbe7d79df7ef22e5` recreate شد؛ `/health` و `/ready` هر دو `200` و PostgreSQL/proxy healthy هستند |
| Test Browser Portal smoke | PASS — ورود انسانی/MFA، cookie میزبان‌محور، `AI Connections`، `Workspace(project-vpn)` و `Guide(project-vpn)` از دامنهٔ عمومی Test هرکدام `200`؛ نشست موقت در پایان revoke شد و هیچ Secret/Token چاپ نشد |
| بازگردانی coach | PASS در source contract — مسیر `H` state کمینه را پاک، coach را دوباره نصب و fallback target پویا را اعمال می‌کند؛ مرورگر E2E مستقل هنوز در این Evidence اجرا نشده است |

Production، Secret، Provider زنده، هزینه، GitHub/Server، Pilot و عملیات برگشت‌ناپذیر در این استقرار تغییر نکرده‌اند.

## ۵.۶ Identity Entry 1.6.3 — رفع مسیر ورود Test — ۲۰۲۶-۰۹-۱۴

- علت تأییدشده: Human Identity در Control Plane سالم بود، اما مسیرهای legacy که با Basic Auth شبکه‌ای محافظت شده‌اند با فرم Human Identity یکی نبودند. ورود Username/Password Basic در فرم Email/Password انسانی، همواره نامعتبر است. Portal canonical این دو Gate را از ابتدا جدا می‌کند.
- اصلاح‌شده: `/api/portal?surface=identity` به‌عنوان ورود رسمی Test، راهنمای Gate 2 و Gate 3 را قبل از فرم نشان می‌دهد و کاربر را از پنجرهٔ Basic ناشی از URL قدیمی برمی‌گرداند. Access bundle Test نیز URL canonical و برچسب legacy مناسب دارد.
- کنترل امنیتی: اعتبار Basic و Secretهای انسانی rotate یا نمایش داده نشدند. bundle محلی با owner میزبان و mode `0600` ساخته شد؛ smoke از یک حساب ناشناس برای خطای ورود استفاده کرد و نشست موفق آزمایشی پس از بررسی revoke شد.

| کنترل | نتیجهٔ واقعی |
|---|---|
| Full Linux source check | PASS — `pnpm check`؛ clean-room ۴۶۹ فایل، Documentation ۱۳۴/۰، build ۲۵۲ module و ۴۶ JSON، ۳۶۴ تست موفق و صفر شکست |
| Targeted Identity/UI | PASS — ۳۵ تست متمرکز ورود، UI Portal و ابزار access bundle؛ صفر شکست |
| Test Control Plane | PASS — فقط `hero-test-control-plane-1` با image `sha256:1ec5c37017466277bf33e19a2d8368f8efe5df447e826573fee6271671177842` recreate شد؛ `/health=ok` و `/ready=persistence:postgresql` |
| Public Test login | PASS — Portal HTTP 200، login انسانی، MFA، cookie شش‌ساعته و `/api/identity/me` موفق؛ نشست smoke در پایان revoke شد |
| Private access bundle | PASS — bundle و manifest جدید با owner `1000:1000` و مجوز `0600`؛ URL فقط Portal canonical |

Production، gateway بیرونی legacy، Secret، Provider زنده، هزینه، GitHub/Server، Pilot و عملیات برگشت‌ناپذیر تغییر نکرده‌اند.

## ۵.۷ Walk-Through 1.6.3 — بازگشت H پس از انتخاب پروژه — ۲۰۲۶-۰۹-۱۴

- علت: انتخاب کارت پروژه می‌توانست مرورگر را به surface دیگری ببرد اما `stepId` ذخیره‌شده را روی `project-selection` نگه دارد؛ در آن surface هدف `portfolio.project-selection` وجود نداشت و restore فقط launcher را نگه می‌داشت.
- اصلاح‌شده: state پس از انتخاب کارت و هنگام بارگذاری هر Portal با surface واقعی تطبیق داده می‌شود. برای Workspace، Studio، Command و Operations گام متناظر انتخاب می‌شود؛ گام اختیاری ساخت Draft برای پروژهٔ موجود تکرار نمی‌شود.
- رفتار حفظ‌شده: `H` همچنان کمینه، غیرمدخل در layout، قابل‌کلیک و متصل به همان گام است. اگر target داده‌ای لحظه‌ای دیر آماده شود، observer و retry قبلی آن را دوباره متصل می‌کنند.

| کنترل | نتیجهٔ واقعی |
|---|---|
| Targeted Walk-Through/UI | PASS — suite متمرکز قرارداد UI/state و routeهای پروژه، ۳۱ تست موفق و صفر شکست |
| Full Linux source check | PASS — `pnpm check`؛ clean-room ۴۶۹ فایل، Documentation ۱۳۴/۰، build ۲۵۲ module و ۴۶ JSON، ۳۶۴ تست موفق و صفر شکست |
| Test Control Plane | PASS — فقط `hero-test-control-plane-1` با image جدید recreate شد؛ `/health=ok` و `/ready=persistence:postgresql` |
| Production boundary | PASS — Production، Secret، Provider، هزینه، gateway و Pilot تغییر نکرده‌اند |

## ۵.۸ Walk-Through 1.6.4 — بازیابی H در رندر پویا — ۲۰۲۶-۰۹-۱۴

- hardening: restore در لحظهٔ کلیک، state را با surface مقصد دوباره reconcile می‌کند؛ install نیز پیش از بررسی آماده‌بودن target، وضعیت کمینه را حفظ می‌کند تا H هنگام رندر پویا باقی بماند.
- نتیجه: H روی صفحه‌های پروژه قابل‌کلیک می‌ماند و پس از آماده‌شدن باکس هدف، coach همان گام را نصب می‌کند؛ هیچ margin، اندازه یا جای کارت تغییر نمی‌کند.

| کنترل | نتیجهٔ واقعی |
|---|---|
| Targeted Walk-Through/UI | PASS — suite متمرکز state و route، ۳۱ تست موفق و صفر شکست |
| Full Linux source check | PASS — `pnpm check`؛ clean-room ۴۷۰ فایل، Documentation ۱۳۴/۰، build ۲۵۲ module و ۴۶ JSON، ۳۶۴ تست موفق و صفر شکست |
| Test runtime | PASS — فقط `hero-test-control-plane-1` با image `sha256:59ca59c7bd783e15bdf670d3c716ccd6ba28d4b7bb7f1839cd9901acd2cd8c41` recreate شد؛ `/health=200` و `/ready=200` |
| Production boundary | PASS — Production و عملیات بیرونی تغییر نکردند |

## ۶. موارد باقیماندهٔ محافظت‌شده

موارد زیر عمداً `complete` اعلام نمی‌شوند:

1. ترجمهٔ کامل همهٔ متن‌های dynamic با message catalog؛ Shell و orientation فعلاً دوزبانه‌اند؛
2. browser E2E روی Desktop واقعی؛
3. axe/Accessibility Insights، screen reader و آزمون contrast ابزارمحور؛
4. baseline visual-regression روی دادهٔ پایدار VPN Draft؛
5. Conversation UI کامل، پاسخ Agent، Command Preview و action drawer مشترک Inbox؛
6. saved views و server pagination Portfolio در مقیاس بالا؛
7. Production promotion و مشاهدهٔ پس از انتشار؛
8. ۷۶ الزام backend که ممیزی سراسری آن‌ها را هنوز `partial` گزارش می‌کند.

## ۷. نتیجه

رابط جدید از نظر source، تست خودکار، build و استقرار Test تحویل شده است. ادعای تکمیل به Shell، Portfolio و همگرایی Surfaceهای موجود محدود است؛ کامل‌شدن کل Control Plane یا قابلیت‌های backend از این Evidence استنتاج نمی‌شود.
