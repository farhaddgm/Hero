# Evidence هویت و ورودی امن — BO-021 تا BO-042

> Document ID: `HERO-EVIDENCE-BACKOFFICE-IDENTITY-CONTENT-SAFETY-BO-021-042`
> Canonical path: `docs/roadmap/BACKOFFICE-IDENTITY-CONTENT-SAFETY-BO-021-042.md`
> Title: Evidence هویت و ورودی امن — BO-021 تا BO-042
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: none
> Supersedes: none
> Superseded by: none

> یادداشت تفسیر: این سند آنچه ساخته و آزمایش شده را ثبت می‌کند. آزمون پذیرش روی host Test با `v1.1.5-rc.44` در ۲۰۲۶-۱۰-۰۸ PASS شد (run `20261008T131038Z-163016`، seed `241/241`، verify `61/61`)؛ بنابراین `BO-021..BO-042` در وضعیت `verified` هستند. محدودیت‌های شناخته‌شده در پایان سند معتبر می‌مانند.

## دامنه و مجوز

Snapshot مجوز `BATCH-BACKOFFICE-20261008-027` گام‌های `BO-021..BO-042` و `BO-167..BO-168` را پوشش می‌دهد. تنها تغییر Secret مجاز: ماندگار کردن رمز MFA کاربران در پایگاه‌دادهٔ Hero به‌صورت رمزنگاری‌شده با کلید از متغیر محیطی. Production، هزینهٔ بیرونی، Provider زنده، فراخوانی زندهٔ GitHub و نوشتن در Notion انجام نشد.

## WP-02 — هویت (BO-021 تا BO-030)

| گام | آنچه اضافه یا ثابت شد | شاهد |
|---|---|---|
| BO-025 | رمز MFA با AES-256-GCM (قالب `mfa1.<kid>.<iv>.<tag>.<ct>`)، کلید فقط از `HERO_MFA_ENCRYPTION_KEY`، شناسهٔ کاربر به‌عنوان AAD، چرخش با `HERO_MFA_ENCRYPTION_KEY_PREVIOUS`. بدون کلید هیچ رازی ذخیره نمی‌شود و ورود MFA با `MFA_UNAVAILABLE` (۵۰۳) رد می‌شود، نه عبور. migration `024` ستون `mfa_secret_cipher` را با CHECK شکل و جدول append-only `human_identity_lifecycle_events` (رویدادهای enroll، غیرفعال‌سازی و ابطال گروهی؛ هرگز راز یا کد) اضافه می‌کند و CHECK قدیمی `human_identity_audit` را عمداً دست‌نخورده می‌گذارد تا rollback ایمن بماند. ثبت‌نام (enroll) تازهٔ MFA فقط توسط Owner، راز یک‌بار در پاسخ، و نشست‌های قبلی کاربر باطل می‌شوند. | `tests/project-identity.test.mjs`، `tests/wp02-identity-http-hardening.test.mjs`، `tests/wp02-mfa-persistence-postgres.test.mjs` (PostgreSQL واقعی: ستون فقط متن رمز شده دارد؛ با همان کلید ورود پس از restart موفق است؛ بدون کلید ۵۰۳) |
| BO-026 | نشست‌ها با متادیتای دستگاه (برچسب کوتاه و منبع هش‌شده، نه IP خام)، فهرست و ابطال همه (`/api/identity/sessions`, `/sessions/revoke-all`). سقف ۱۰ نشست برای هر کاربر. محدودیت نرخ: چالش (۵ تلاش)، حساب (۸ شکست ⇒ قفل ۱۵ دقیقه، ۴۲۳)، ایمیل و منبع. TOTP پس‌ازاستفاده در همان گام زمانی دوباره پذیرفته نمی‌شود (replay). | همان آزمون‌ها |
| BO-027 | غیرفعال‌سازی کاربر توسط Owner با پایان فوری نشست‌ها؛ حساب Owner قابل غیرفعال‌سازی نیست (۴۰۹). | `tests/wp02-identity-http-hardening.test.mjs` |
| BO-028 | کدهای بازیابی یک‌بارمصرف (فقط SHA-256 ذخیره می‌شود) و محدودیت نرخ بازیابی. تحویل ایمیل واقعی هنوز پیکربندی نشده است (`recoveryDelivery: not-configured`). | `tests/project-identity.test.mjs` |
| BO-029 | step-up و cooldown پس از بازیابی (از قبل) با آزمون سوءاستفاده. | `tests/project-identity.test.mjs` |
| BO-030 | جاروی مجوز مسیرها: جدول مسیر مستقیماً از `server.mjs` استخراج می‌شود (مسیرهای آینده خودکار پوشش می‌یابند). هر مسیر `/api` بدون نشست رد می‌شود و Viewer با هیچ متد تغییردهنده‌ای موفق نمی‌شود؛ هیچ مسیری خطای ۵۰۰ غیرمنتظره نمی‌دهد. کاربر ناشناس نمی‌تواند وجود کاربر را بفهمد و پاسخ «ایمیل ناشناخته» با «رمز اشتباه» یکسان است. | `tests/wp02-route-authorization-sweep.test.mjs` |

BO-021..BO-024 (ماتریس مجوز، User/Role/ProjectGrant، middleware مشترک، `project_id` اجباری) از قبل با آزمون‌های `tests/project-identity.test.mjs` و `tests/read-model-access-*.test.mjs` پوشش داشتند و جاروی بالا آنها را در سطح HTTP دوباره می‌سنجد.

## WP-03 — ورودی خصوصی و امن (BO-031 تا BO-042)

ماژول `packages/domain/src/content-safety.mjs` فقط روی بایت و رشته کار می‌کند؛ اتصال شبکه، نوشتن روی دیسک و اجرای محتوا ندارد.

| گام | کنترل | شاهد |
|---|---|---|
| BO-035 | سهمیهٔ هر فایل و کل سهمیهٔ پروژه (۱۰۰ مگابایت، ۵۰۰ فایل)؛ بایت دودویی از مسیر HTTP با `encoding: "base64"` (رمزگشایی سخت‌گیرانه) می‌رسد تا هیچ بایتی با UTF-8 تغییر نکند. | `tests/wp03-upload-http.test.mjs` |
| BO-036 | allowlist نوع/پسوند/MIME، امضای فایل، نام فایل (مسیر، کاراکتر جهت‌دهنده، پسوند اجرایی یا دوگانه)، اسکن امضایی داخلی (امضای آزمایشی EICAR، اجرایی بومی، Office قدیمی، محتوای فعال PDF، polyglot تصویر). نتیجه همیشه `externalAntivirus: "not-connected"` می‌گوید؛ «clean» به‌معنای پاک بودن از نظر آنتی‌ویروس کامل نیست. | `tests/wp03-content-safety.test.mjs` |
| BO-037 | parser محدود و درون‌فرایندی: متن (UTF-8 سخت‌گیر)، Word/Excel (استخراج با سقف خروجی)، تصویر (ابعاد و سقف پیکسل)، PDF (متن ساده از content streamهای Flate با سقف خروجی؛ رمزدار، فقط‌تصویر یا فونت‌های سفارشی متن نمی‌دهند و حدس زده نمی‌شود)، ZIP (فهرست). لینک فقط ثبت می‌شود، هرگز fetch نمی‌شود (`pending-separate-authorization`). | همان آزمون و `tests/wp03-upload-http.test.mjs` |
| BO-038 | ZIP: بازرسی فقط از central directory (traversal، symlink، رمزدار، آرشیو تودرتو، اجرایی، macro، عمق، تعداد، نسبت و مجموع انبساط)؛ ادعای اندازهٔ کلاینت دیگر پذیرفته نمی‌شود؛ استخراج با سقف سخت `maxOutputLength` حتی اگر header دروغ بگوید. SSRF: فقط HTTPS و پورت پیش‌فرض، بدون credential، شکل‌های اعشاری/هگز/اکتال IP، IPv6 (از جمله mapped)، `169.254.169.254`، نام‌های داخلی؛ بررسی DNS با resolver تزریقی (rebinding رد می‌شود؛ بدون resolver ثابت نمی‌شود که host عمومی است). Prompt injection: الگوهای انگلیسی و فارسی، نویسهٔ نامرئی، blob رمزشده؛ متن مشکوک نگه‌داشته می‌شود اما `reviewRequired` است و هرگز به‌عنوان context بازخوانی نمی‌شود؛ پوشش `untrusted-content` محتوا را داده می‌داند. | `tests/wp03-content-safety.test.mjs` |
| BO-039..BO-042 | پیشنهاد بنیان، نسخه‌دهی، Import فقط‌خواندنی و Clone با حذف اجباری Secret (از قبل) بدون تغییر. | `tests/project-workspace-and-settings.test.mjs` |

## پوشش پذیرش روی host Test

`tools/acceptance/run-test-acceptance.mjs` اکنون `BO-021..BO-170` را در حکم می‌شمارد. بررسی‌های تازه (دو اجرای محلی با PostgreSQL واقعی و SIGKILL میانی): MFA رمزنگاری‌شده فعال است؛ enroll؛ ورود با راز تازه؛ فهرست نشست؛ قفل پس از شکست‌های پیاپی؛ پاسخ یکسان برای ایمیل ناشناخته؛ غیرفعال‌سازی؛ سند Word، EICAR، ZIP traversal، ZIP bomb، متن دستورالعمل‌نما، SSRF؛ و پس از restart ورود MFA هم برای کاربر قدیمی (`admin`) و هم برای کاربر تازه‌ثبت‌شده. نتیجهٔ اجرای محلی: seed ۱۹۴/۱۹۴ و verify ۴۷/۴۷ در حکم، بدون شکست. نتیجهٔ مرجع، اجرای مالک روی host Test است.

## محدودیت‌های شناخته‌شده

- اسکن داخلی آنتی‌ویروس واقعی نیست؛ اتصال به موتور خارجی جداگانه مجوز می‌خواهد.
- متن PDF فقط برای PDFهای ساده خوانده می‌شود (فونت‌های CID/ToUnicode و اسکن تصویری متن نمی‌دهند). تحویل ایمیل بازیابی پیکربندی نشده است.
- بدون `HERO_MFA_ENCRYPTION_KEY` کاربران MFA پس از restart نمی‌توانند وارد شوند (به‌صورت ایمن شکست می‌خورد). مالک باید کلید را در `/etc/hero/hero-test.env` بگذارد.
- بررسی DNS برای لینک آماده است اما تا مجوز fetch جداگانه، هیچ لینکی fetch نمی‌شود.
- چرخش کلید MFA: کلید جدید را در `HERO_MFA_ENCRYPTION_KEY` و کلید قبلی را در `HERO_MFA_ENCRYPTION_KEY_PREVIOUS` بگذارید؛ در راه‌اندازی بعدی سرور، مقدارهای قدیمی با کلید جدید دوباره رمز می‌شوند (آزمون: `tests/wp02-mfa-key-rotation.test.mjs`); پس از آن کلید قبلی را بردارید.
