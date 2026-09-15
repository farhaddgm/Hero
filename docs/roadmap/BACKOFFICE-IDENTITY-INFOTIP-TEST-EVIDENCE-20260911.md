# Evidence رفع ورود انسانی و راهنمای قابلیت‌های Back Office در Test

> Document ID: `HERO-EVIDENCE-BACKOFFICE-IDENTITY-INFOTIP-TEST-20260911`  
> Version: `1.2.0`  
> Status: `active`  
> Owner: `hero-quality`  
> Date: `2026-09-11`  
> Authorization: `BATCH-BACKOFFICE-20260911-020`  
> Scope: `development-and-test / hero-control-plane`  
> Specifications: `HERO-SPEC-022@1.0.0` و `HERO-SPEC-023@1.0.0`

## ۱. مسئله و علت ریشه‌ای

مشکل «رمز عبور کار نمی‌کند» از دو لایهٔ مستقل احراز هویت ناشی می‌شد:

1. Basic Auth شبکه‌ای از قبل فعال و دارای Credential مستقل بود؛
2. هویت انسانیِ Owner (ایمیل، رمز و MFA) اصلاً در Test provision نشده بود؛ در نتیجه فرم `/identity` به endpointی می‌رسید که با `IDENTITY_NOT_CONFIGURED` و HTTP 503 متوقف می‌شد.

این رفع، Basic Auth موجود را rotate نکرد و فقط bootstrap هویت انسانی Test را اضافه کرد. Production، Caddy، PostgreSQL data volume، Provider زنده، هزینه و Pilot خارج از Scope باقی ماندند.

## ۲. تغییرهای تحویل‌شده

- Compose اکنون هفت مقدار لازم Human Identity را فقط از محیط runtime به Control Plane منتقل می‌کند؛
- endpoint امن `/api/identity/status` فقط آمادگی هویت را گزارش می‌کند و هیچ ایمیل، Secret یا Credentialی بازنمی‌گرداند؛
- صفحهٔ Identity تفاوت Basic Auth شبکه‌ای و حساب انسانی را روشن می‌کند، تا آماده‌بودن backend فرم ورود را غیرفعال نگه می‌دارد و مسیر واقعی ورود را در سه کارتِ شماره‌دار توضیح می‌دهد؛
- MFA استاندارد RFC 6238 با Base32 پیاده‌سازی شد؛ مقدارهای legacy به‌صورت سازگار خوانده می‌شوند اما bootstrap تازه از Base32 استاندارد استفاده می‌کند؛
- Provision Test فقط پس از اثبات دقیق محیط Test انجام می‌شود، Symlink را رد می‌کند، فایل‌ها را اتمیک و با مجوز محدود می‌نویسد و از نسخه‌برداری کل `.env` خودداری می‌کند؛
- Smoke Test فقط به originهای مشخص Test متصل می‌شود، redirect را دنبال نمی‌کند، برای تلاش نامعتبر از شناسهٔ تصادفی استفاده می‌کند و Session آزمایشی را در پایان revoke می‌کند؛
- راهنمای کوچک `i` برای تمام surfaceهای اصلی Back Office، Portfolio، Product Studio، Workspace، Operations، Safe Lab و Identity از یک registry مشترک ساخته شد. Tooltip با hover، focus صفحه‌کلید و click قابل استفاده است، با Escape بسته می‌شود، در RTL/viewport جابه‌جا می‌شود و متن راهنما را فقط با `textContent` وارد می‌کند؛
- آزمون رابط تضمین می‌کند markerهای لازم resolve شوند و دکمهٔ راهنما داخل link قرار نگیرد.

## ۳. حفاظت اطلاعات دسترسی

- Credentialهای جدید فقط در `.env` خصوصی Test و یک access bundle خصوصی با مجوز `0600` قرار دارند؛
- access bundle و manifest در مسیر Git-ignored با directory mode `0700` نگهداری می‌شوند؛
- در Git، خروجی ابزارها، Evidence و logهای ثبت‌شده هیچ Secret، رمز، TOTP code یا Session token وجود ندارد؛
- access bundle باید در password manager مورد تأیید مالک ثبت و سپس از storage محلی حذف شود.

## ۴. نتیجهٔ واقعی کنترل‌ها

| کنترل | نتیجه |
|---|---|
| Test configuration preflight | PASS — PostgreSQL مستقل، bind/port Test، هویت انسانی کامل و Provider زنده خاموش |
| Compose config | PASS — بدون نمایش مقدار Secret |
| Provision security tests | PASS — Test-target guard، symlink denial، permission و absence of full-secret backup |
| Build verification | PASS — ۳۵۰ تست، صفر شکست |
| `pnpm check` در Linux Verify image | PASS — ۳۵۰ تست، صفر شکست؛ documentation، governance، contract و build همگی موفق |
| Clean-room در full check | PASS — ۴۶۴ فایل |
| Build validation در full check | PASS — ۲۴۸ ماژول و ۴۶ JSON |
| `git diff --check` | PASS |
| Control Plane Test | healthy؛ `/health=200` و `/ready=200` |
| Identity readiness | `/api/identity/status=200` و `configured=true` |
| Basic Auth داخلی | بدون Credential=`401`؛ با Credential موجود=`200` |
| Human login + MFA | password نامعتبر=`401`؛ password معتبر + MFA=`200`؛ Owner session معتبر |
| Session cleanup | Session هر Smoke پس از بررسی revoke و سپس غیرقابل‌استفاده شد |
| Restart persistence | Control Plane Test restart شد و Smoke کامل دوباره PASS شد |
| PostgreSQL evidence | Owner row=`1`؛ session-issued audit=`2`؛ session-revoked audit=`2`؛ revocation row=`2` |

هشدار Docker-in-Docker در Doctor داخل verify image فقط به‌دلیل نبود Docker socket در همان container است؛ Docker build، deploy و runtime smoke بیرون از آن با موفقیت اجرا شدند.

## ۵. Artifact و محیط

- image محلی Test: `hero-control-plane:local`؛
- image digest Control Plane Test: `sha256:45325e82f3106ec20d1cb2a242e615b89950b0f133a3da02c470f5bace120878`؛
- Control Plane، PostgreSQL و Back Office proxy در Test همگی `healthy` هستند؛
- Production هیچ mutation یا deployی نداشت.

## ۶. راستی‌آزمایی انتشار و راهنمای عملی ورود

پس از گزارش مالک دربارهٔ ابهام ورود، Control Plane Test دوباره با همان اصلاحات build و فقط در Test بازراه‌اندازی شد. بررسی مستقیم روی `https://test.hero.beeproject.ir/identity`—بدون ثبت یا نمایش هیچ مقدار محرمانه—نتیجهٔ زیر را اثبات کرد:

- درخواست بدون Basic Auth با `401` رد می‌شود و همان درخواست با Credential صحیح Test با `200` پذیرفته می‌شود؛
- صفحهٔ منتشرشده هر سه راهنمای «Gate 1»، «Gate 2» و «Gate 3» را دارد؛
- Email/Password حساب انسانی challenge دارای MFA می‌سازد؛ کد TOTP معتبر session مالک می‌دهد؛
- session تشخیصی بلافاصله revoke شده است.

بنابراین سه مقدار در bundle سه کاربرد مستقل دارند: Gate 1 فقط برای پنجرهٔ native مرورگر، Gate 2 فقط برای فرم حساب انسانی، و Secretِ Gate 3 فقط برای افزودن به Authenticator است؛ خود Secret هرگز در فرم سایت وارد نمی‌شود.

## ۷. رفع ناوبری، مسیرهای بدون Scope و فونت رابط

بازخورد مالک روی نسخهٔ منتشرشدهٔ Test به دو علت مستقل رسیدگی شد:

1. مسیر legacyِ `/backoffice` و داده‌های هم‌نام آن، در gateway خارجی Test پاسخ Basic Auth ناسازگار می‌دادند؛ در حالی که همان credential برای مسیرهای دیگر Test معتبر بود. این رخداد در لایهٔ gateway خارجی بود، نه در رمز حساب انسانی و نه در session آن. هیچ credential یا تنظیم gateway بیرون از repository تغییر نکرد.
2. `Workspace` و `Project Operations` ذاتاً project-scoped هستند، اما ناوبری سراسری پیش از انتخاب Project به آن‌ها بدون `projectId` می‌رفت و backend درست با `400 PROJECT_ID_REQUIRED` رد می‌کرد.

رفع منتشرشده:

- مسیر canonical مرکز فرمان اکنون `/portfolio?surface=command` است و دادهٔ همان نما از `/portfolio-data?surface=command` خوانده می‌شود؛ تمام پیوندهای داخلی و command palette به این alias امن منتقل شده‌اند. این مسیر از همان gate معتبر Portfolio عبور می‌کند و دیگر به مسیر legacyِ gateway وابسته نیست.
- بازکردن مستقیم `/workspace` یا `/project-control` بدون Project دیگر `400` نیست و با `302` به انتخاب‌گر Portfolio (`?open=workspace` یا `?open=control`) می‌رود؛ پس از انتخاب کارت پروژه، `projectId` درست به مقصد اضافه می‌شود. وقتی Scope از ابتدا موجود است، لینک مستقیم project-scoped بدون تغییر کار می‌کند.
- Vazirmatn رسمی و متغیر، با مجوز OFL-1.1، داخل source خود Hero نگهداری و از `/api/ui-assets/vazirmatn.woff2` با `font/woff2` و cache immutable سرو می‌شود؛ رابط فارسی و انگلیسی همهٔ surfaceها از `Vazirmatn, sans-serif` استفاده می‌کنند. برای متن‌های فنی مانند code و شناسه‌ها، monospace حفظ شده است. منبع و checksum در `apps/control-plane/src/assets/fonts/README.md` ثبت شده‌اند؛ در runtime هیچ فونت ثالثی از اینترنت بارگیری نمی‌شود.

راستی‌آزمایی دامنهٔ عمومی Test پس از deploy:

| مسیر | نتیجه |
|---|---|
| `/portfolio?surface=command` با Basic Auth صحیح Test | `200`، شامل endpoint جدید و Vazirmatn |
| `/portfolio-data?surface=command` | `200 application/json` |
| `/workspace` بدون Project | `302 → /portfolio?open=workspace` |
| `/project-control` بدون Project | `302 → /portfolio?open=control` |
| `/api/ui-assets/vazirmatn.woff2` | `200 font/woff2` با cache immutable |

bookmark قدیمی `/backoffice` نباید به‌عنوان مسیر ورود استفاده شود؛ URL صحیح مرکز فرمان در Test، `/portfolio?surface=command` است. Production در این اصلاح تغییری نکرد.

## ۸. مرزها و کارهای باز

این Evidence فقط رفع دسترسی Owner در Test و راهنمای قابلیت‌ها را تأیید می‌کند. موارد زیر عمداً کامل اعلام نمی‌شوند:

1. بازیابی خودکار از ایمیل اصلی مالک و delivery واقعی recovery code؛
2. MFA enrollment/rotation خودسرویس برای Owner/Admin/Viewer، همراه migration پایدار stateهای recovery/cooldown؛
3. browser E2E و visual/accessibility acceptance روی Desktop واقعی؛
4. promotion به Production که نیازمند Authorization، rollback و مشاهدهٔ مستقل است؛
5. قابلیت‌های backend ثبت‌شده به‌عنوان `partial` در ممیزی ۱۷۰ گام.

## ۹. نتیجه

Back Office Test اکنون دارای مسیر ورود واقعی Owner با رمز و MFA استاندارد است، مرکز فرمان آن از مسیر canonical پایدار باز می‌شود، مسیرهای نیازمند Project ابتدا Scope لازم را می‌گیرند و رابط آن Vazirmatn self-hosted دارد. قابلیت‌های اصلی نیز با راهنمای قابل‌دسترسی کنار نام ویژگی‌ها توضیح داده می‌شوند. این نتیجه فقط برای Test معتبر است و هیچ ادعایی دربارهٔ انتشار Production یا تکمیل موارد gated ندارد.
