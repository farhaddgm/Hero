# تغییرات رودمپ شرکت

## 2026-09-05 — ساخت و fingerprint artifact کاندیدای تمیز

- ساخته‌شده: image محلی `hero-control-plane:candidate-2b3d5b8` با digest `sha256:a63abdb1f5b04b847c95cfa4a598b2cead8d3f4a09bd3b6987c1a3ce122a0db1` از archive نسخهٔ commit‌شده، بدون ورود تغییرات خارج از commit؛
- تأییدشده: verify داخل build با `239/239` تست موفق؛
- تأییدشده: hash پنج فایل اصلی image با fingerprint source برابر است؛
- مرز: artifact هنوز به `hero-test` یا Production deploy نشده؛ deploy Test باید با همان Secret/env فعلی و ثبت rollback انجام شود.

## 2026-09-04 — تأیید محیط Test مستقل و دامنهٔ امن

- تأییدشده: پروژهٔ Compose مستقل `hero-test` با Control Plane و PostgreSQL سالم، volumeهای `hero-test_*`، network مستقل و پورت `127.0.0.1:43101`؛
- تأییدشده: preflight Test، اتصال PostgreSQL، migration نسخهٔ `1.0`، health/readiness و خاموش‌بودن Provider واقعی؛
- تأییدشده: پس از restart کنترل‌شدهٔ Control Plane، ۱۱ Projection، ۱۰ event و ۱ request در Read Model باقی ماند؛
- تأییدشده: دامنهٔ `test.hero.beeproject.ir` با TLS معتبر، پاسخ بدون احراز هویت `401`، پاسخ احراز‌شدهٔ Back Office `200`، noindex و robots؛
- مرز باقی‌مانده: wrapperهای محدود host، CI و artifact با SHA دقیق، rollback/recovery واقعی، Pilot و Production هنوز جداگانه نیازمند evidence یا مجوز هستند.
- نکتهٔ نسخه: hash سه فایل اصلی workspace با image فعلی `hero-test` متفاوت است؛ سلامت Test به‌تنهایی اثبات نمی‌کند آخرین workspace در آن deploy شده باشد.
- تأیید schema: migrationهای `001` تا `006` و ۱۷ جدول دارای trigger محافظ append-only در PostgreSQL Test مشاهده شد.
- تأیید شبکه: پورت‌های مستقیم Test (`43101` و `5432`) از بیرون قابل اتصال نیستند و دسترسی عمومی از HTTPS reverse proxy عبور می‌کند.
- افزوده‌شده: [CANDIDATE-EVIDENCE-20260904.md](./CANDIDATE-EVIDENCE-20260904.md) با commit پایه، fingerprint منبع، شواهد verification و گیت‌های parity قبل از promotion.
- ممیزی Git: source candidate `cdc44bc` و evidence commit `cce6aaa` ثبت شدند؛ remote branch قدیمی‌تر است و push/Production deploy انجام نشد.

## 2026-09-04 — اجرای بستهٔ کم‌ریسک اولویت‌دار از ممیزی ۵۰ گام

- تکمیل‌شده: پوشش مسیر Projection برای همهٔ Aggregate Eventها؛ رویدادهای عمومی در timeline امن کنترل‌داشبورد دیده می‌شوند و رویداد بدون مسیر Diagnostic را به `attention` می‌برد؛
- تکمیل‌شده: مدارشکن bounded برای Provider با threshold، reset timeout و probe نیمه‌باز؛ بازشدن و recovery به‌صورت event و snapshot امن ثبت می‌شود؛
- تکمیل‌شده: refresh شدن readiness Planner از وضعیت فعلی Team Registry پیش از تصمیم خروجی و dispatch؛
- تکمیل‌شده: تبدیل findingهای Performance/Evaluation به اقدام آموزشی advisory با owner review و evidence requirement؛
- تکمیل‌شده: تشخیص integrity مجموعه‌های Projection، freshness Snapshot و rebuild read model از Snapshot+Event بدون mutation بیرونی؛
- تکمیل‌شده: کاتالوگ و Binding مستقل Skill در رابط Back Office؛
- اصلاح‌شده: hydration Policyهای نقش AI دیگر Policy با Role نامعتبر اضافه نمی‌کند؛
- شواهد: `pnpm check` در کانتینر Linux با `239/239` تست، Build `138` و Governance `21` موفق شد؛ `git diff --check` نیز موفق است. Doctor فقط هشدار نبود Docker تو‌در‌تو را ثبت کرد؛
- مرز: Provider واقعی، Git/CI، rollback/recovery، Pilot و Production همچنان تغییر نکرده‌اند و طبق فهرست مالک/ادمین نیازمند اقدام بیرونی هستند؛ دامنه و Test مستقل در بخش بعدی تأیید شده‌اند.

## 2026-09-04 — تکمیل ممیزی فرمان‌های Control Plane و سخت‌سازی Read Model

- افزوده‌شده: رویدادهای امن و append-only برای ایجاد، تأیید، رد، توقف و اجرای درخواست‌ها و تغییرات اختیار/توقف اضطراری؛
- افزوده‌شده: نگهداری رویدادهای Control Dashboard در Snapshot و Hydration و نمایش آن‌ها در Projection یازده‌گانه؛
- اصلاح‌شده: cursor Timeline محلی اکنون از شمارهٔ صفحهٔ یکتا استفاده می‌کند و به sequenceهای داخلی Registryها وابسته نیست؛
- افزوده‌شده: سقف پاسخ و rate limit در حافظه برای مسیرهای read-only بک‌آفیس؛
- افزوده‌شده: دریافت گزارش JSON امن از دادهٔ حاضر پنل، بدون متن درخواست یا اطلاعات حساس؛
- تثبیت‌شده: نام فرمان در projection مشاهده‌ای با allow-list امن نمایش داده می‌شود و متن درخواست، Secret، Token، Prompt و Output خام همچنان حذف‌اند؛
- شواهد: تست‌های هدفمند Back Office، Dashboard، Diagnostics و Hydration با `25/25` و `pnpm check` لینوکس با `233/233` تست، Build `138` و Governance `21` موفق شدند؛ Doctor فقط نبود Docker تو‌در‌تو را هشدار داد.

## 2026-09-04 — تکمیل read model بازیابی Context

- افزوده‌شده: ثبت metadata امن Contextهای assembled شامل Role، Task/Step، نسخه و memory IDهای انتخاب‌شده؛
- افزوده‌شده: نگهداری Context retrieval در Snapshot/Hydration بدون محتوای حافظه، prompt، output یا Secret؛
- افزوده‌شده: نمایش تاریخچهٔ بازیابی Context در Back Office؛
- شواهد: `pnpm check` در Linux/Node 22 با `231/231` تست، Build `138`، Governance `21` و clean-room با `235` فایل موفق شد.

## 2026-09-04 — فعال‌شدن کنترل‌های محدود و محافظت‌شدهٔ Back Office

- افزوده‌شده: فرم مدیریت نسخه‌دار Provider، Model، Profile، Binding و Default Role Policy؛
- افزوده‌شده: ویرایش اصول Team و rollback نسخه‌دار از UI با Bearer Session؛
- تثبیت‌شده: Projection و دادهٔ Back Office فقط‌خواندنی و بدون Secret، Token، Prompt یا Output خام باقی می‌مانند؛
- تثبیت‌شده: Admin فقط scope محدود دارد؛ تأیید نهایی Team و عملیات حساس همچنان owner-only است؛
- تثبیت‌شده: live Provider، external spend، Secret، Deploy و Production از UI قابل فعال‌سازی نیستند.

## 2026-09-04 — تکمیل مشاهدهٔ Projection، حافظه و ظرفیت عملیاتی

- افزوده‌شده: فهرست metadata امن Project Memory فعلی در Back Office؛ محتوای حافظه، prompt، output و credential نمایش داده نمی‌شوند؛
- افزوده‌شده: جزئیات ۱۱ Projection شامل event type، آخرین event، تعداد collectionها و وضعیت Snapshot/Hydration؛
- افزوده‌شده: اتصال read-only ظرفیت Planner به Diagnostic برای نمایش سقف تیم و تعارض resource claim؛
- اصلاح‌شده: مسیرهای Back Office فقط GET را می‌پذیرند و روش‌های دیگر را با `405` رد می‌کنند؛
- مرز: projection کامل همهٔ commandها و retrieval کامل Context هنوز باز است؛ Provider زنده، Secret، Test عملیاتی با اعتبارنامهٔ واقعی، Pilot و Production همچنان جداگانه gated هستند.
- شواهد: verification نهایی در Linux container با `230/230` تست، Build `138`، clean-room با `234` فایل و `git diff --check` موفق انجام شد؛ Compose config و smoke-test Test نیز موفق‌اند.

## 2026-09-04 — تکمیل نمای فقط‌خواندنی Back Office

- افزوده‌شده: projection نسخهٔ `1.1` برای هویت سرویس، runtime، persistence/hydration، امنیت، حاکمیت، مسیرها و کاتالوگ قراردادهای کل Hero؛
- افزوده‌شده: جزئیات امن هر Team شامل تأییدها، آموزش، تخصیص، بازبینی، بازکاری، پژوهش و provenance دانش؛
- اصلاح‌شده: Back Office کاملاً read-only شد؛ فرم‌ها، توکن ورودی و دکمه‌های edit/approve/rollback از UI حذف شدند و APIهای مدیریتی خارج از آن باقی ماندند؛
- اصلاح‌شده: تست UI و redaction برای جلوگیری از mutation و افشای Secret/متن خصوصی گسترش یافت.

## 2026-09-04 — بستهٔ تشخیص و کنترل عملیاتی

- افزوده‌شده: قرارداد `operational-diagnostics-v1` برای پایش فقط‌خواندنی ۱۱ Projection؛
- افزوده‌شده: بررسی سلامت Snapshot/Event، Aggregate Version، replay dry-run و SHA-256 projection digest؛
- افزوده‌شده: تاریخچهٔ امن تغییرات AI، بدون Credential، Prompt یا Output خام؛
- افزوده‌شده: گزارش provenance/freshness دانش تیم و کشف تعارض Task فعال بین چند تیم؛
- تکمیل‌شده: احراز هویت امضاشدهٔ Admin با scope محدود به کاتالوگ AI؛ Owner برای Team، Release، Dispatch، Secret و Production باقی می‌ماند؛
- افزوده‌شده: endpoint owner/admin-authenticated `GET /api/operations/diagnostics` و قرارداد `/admin-auth-contract`؛
- تکمیل‌شده: rollback نسخه‌دار Policy نقش‌های AI در Back Office و امکان draft/rollback اصول Team برای Admin با تأیید نهایی Owner؛ شمارش Projection پنل با قرارداد ۱۱ Registry هم‌راستا شد؛
- تکمیل‌شده: rollback نسخه‌دار Policy نقش‌های AI در Back Office با scope Owner/Admin و idempotency؛ شمارش Projection پنل با قرارداد ۱۱ Registry هم‌راستا شد؛
- شواهد: `pnpm check` با `228/228` تست، Build `138`، Governance `21` و `git diff --check` موفق؛
- مرز: full domain projection و retrieval کامل همچنان بازند؛ مدل ظرفیت عددی در Planner تکمیل محلی است اما Diagnostic read model آن را گزارش نمی‌کند؛ Test عملیاتی، Provider زنده، recovery مقصد، Pilot و Production همچنان جداگانه باز/مسدود هستند.

## 2026-09-04 — ثبت ممیزی دسترسی و وضعیت Test

- شواهد بررسی دسترسی در `docs/operations/ACCESS-AUDIT-20260904.md` ثبت شد؛
- دسترسی repository و بررسی محدود namespace `hero-test` تأیید شد؛ namespace خالی است و Test deploy نشده؛
- `pnpm check` با `214/214` تست موفق شد و `check:pilot` سه گیت عملیاتی را مسدود گزارش کرد؛
- هیچ Secret، Caddy، DNS/WCDN، Provider زنده یا Production تغییر نکرد.

## 2026-09-04 — ممیزی وضعیت و مدیریت پایهٔ کاتالوگ AI در Back Office

- افزوده‌شده: projection امن Provider/Model/Profile/Role Binding در `/backoffice-data`، بدون `credentialRef` و دادهٔ حساس؛
- افزوده‌شده: فرم owner-authenticated برای ثبت نسخهٔ جدید Provider deterministic/disabled، Model، Profile، Binding و Default Role Policy؛ live Provider و external spend از UI قابل فعال‌سازی نیست؛
- افزوده‌شده: تست پوشش UI و اطمینان از حذف ارجاع Credential از projection؛
- اصلاح‌شده: شواهد roadmap و Google Sheet با آخرین وضعیت `214/214` تست، Build `124` و Governance `21` هم‌تراز شد؛
- مرز: Test stack، WCDN/Caddy/HTTPS، PostgreSQL مقصد، Secret واقعی، Provider live، recovery مقصد و Pilot واقعی همچنان به اپراتور/مجوز مستقل نیاز دارند.

## 2026-08-31 — تفکیک verification از runtime image

- اصلاح‌شده: target `verify` فایل‌های workflow را تا پایان تست نگه می‌دارد تا اجرای مستقل `pnpm check` ناقص نشود؛
- اصلاح‌شده: فایل‌های CI فقط هنگام ساخت image نهایی runtime حذف می‌شوند و image عملیاتی حداقل سطح لازم را حفظ می‌کند؛
- شواهد: build لینوکس، `pnpm check` با `۲۰۳/۲۰۳` تست موفق، Compose healthy و smoke-test مسیرهای سلامت، احراز هویت و عدم کشف عمومی موفق شد.

## 2026-08-31 — خودکارسازی release candidate و نسخه‌گذاری test

- افزوده‌شده: اجرای خودکار Release Candidate پس از push به شاخهٔ عملیاتی و تولید نسخهٔ `0.1.0-rc.<run_number>`؛ اجرای دستی برای نسخهٔ انتخابی همچنان فعال است؛
- افزوده‌شده: workflow دستی و Environment-gated برای اعتبارسنجی SemVer، اجرای `pnpm check`، ساخت image، tag دقیق و GitHub pre-release؛
- افزوده‌شده: artifact شواهد شامل نسخه، commit SHA، image ID و URL release؛
- تثبیت‌شده: `GITHUB_TOKEN` فقط برای tag و pre-release همین repository استفاده می‌شود و production deploy همچنان خارج از workflow است؛
- شواهد: `pnpm check` پس از تغییرات با Doctor/Governance/Build موفق و `۲۰۳/۲۰۳` تست پاس شد؛ Compose config و `git diff --check` نیز موفق‌اند.

## 2026-08-31 — سیاست عدم کشف عمومی سرویس

- افزوده‌شده: سیاست یکنواخت `X-Robots-Tag` با `noindex`، `nofollow`، `nosnippet` و `noimageindex` برای همهٔ پاسخ‌ها؛
- افزوده‌شده: meta robots برای صفحهٔ اتاق کنترل و Back Office؛
- تثبیت‌شده: `robots.txt` با `Disallow: /`، نبود sitemap عمومی و رد مسیرهای ناشناخته؛
- تثبیت‌شده: binding پیش‌فرض Compose روی `127.0.0.1` و الزام احراز هویت/TLS/firewall برای انتشار عمومی؛
- مرز: این کنترل‌ها جلوی ایندکس معمول را می‌گیرند، اما جایگزین احراز هویت و کنترل شبکه نیستند.

## 2026-08-31 — بستهٔ ۱۰ گام بعدی: مشاهده‌پذیری، revocation، outbox و pilot rehearsal

- افزوده‌شده: قرارداد `observability-v1` برای correlation مبتنی بر trace/span و projection امن event؛
- افزوده‌شده: Timeline و Performance Review خلاصه‌شده در `/backoffice`؛
- افزوده‌شده: revocation session مالک در حافظه و PostgreSQL، به‌همراه `POST /api/auth/revoke-session`؛
- افزوده‌شده: migration `005` برای revocation و lease/retry state در Outbox؛
- افزوده‌شده: `claimOutbox`، `acknowledgeOutbox` و `failOutbox` با claim محدود و `SKIP LOCKED`؛
- افزوده‌شده: `POST /api/pilots/dry-run` و evidence bundle deterministic بدون شبکه؛
- بهبود‌یافته: benchmark با latency تزریق‌پذیر، dataset version و digest قابل‌تکرار؛
- افزوده‌شده: تست‌های امنیتی، HTTP، PostgreSQL adapter، pilot و benchmark در `tests/next-ten-steps.test.mjs`؛
- شواهد: `pnpm check` در Linux container با Doctor/Governance/Build موفق و ۱۹۷/۱۹۷ تست پاس؛ smoke-test runtime برای چهار route با HTTP 200 و Compose healthy؛
- مرز: Provider زنده، external spend، Secret، deploy، worker خارجی و Production همچنان جداگانه gated هستند.

## 2026-08-30 — بک‌آفیس توسعهٔ مشاهده‌ای

- افزوده‌شده: مسیر `/backoffice` برای مشاهدهٔ وضعیت ۱۱ Team، Roleهای Multi-AI، گیت‌ها، شواهد و گام‌های بعدی؛
- افزوده‌شده: projection امن `/backoffice-data` بدون متن درخواست، Credential، Secret، Token یا عملیات تغییردهنده؛
- مرز: عملیات تغییر، اجرای Provider، مصرف هزینه، Deploy و Authorization همچنان در Control Plane و APIهای مالک‌محور باقی می‌مانند؛
- شواهد: تست route، تعداد ۱۱ Team، شش Role AI و ردشدن دادهٔ حساس اضافه شد.

## 2026-08-30 — یکپارچه‌سازی معماری Multi-AI با Hero

- افزوده‌شده: ADR-0009 و سند معماری Multi-AI برای نگاشت `ai-assistant/Wepod` به Project تحت مدیریت Hero؛
- افزوده‌شده: تفکیک قراردادی Team، AI Role، Agent Profile، Provider، Model، Invocation، Evaluation و Decision Proposal؛
- افزوده‌شده: هستهٔ deterministic Provider Gateway و کنترل‌های امنیتی Credential Reference، read-only Evaluator و owner-resolved decision؛
- افزوده‌شده: Context Assembly نسخه‌دار و Role-filtered بین AI Invocation و Project Memory؛
- افزوده‌شده: migration `002_ai_orchestration_projections.sql` برای Projectionهای امن AI بدون ذخیرهٔ Secret؛
- افزوده‌شده: قرارداد workflowهای چندنقشی و ثبت AI Role/schema/policy در route هر Task؛ implementation به‌صورت policy-default از executor/Codex استفاده می‌کند؛
- افزوده‌شده: Quality Gate async و adapter ارزیاب که Evaluation لینک‌شده را به revision loop evidence-first تبدیل می‌کند؛
- افزوده‌شده: ارزیابی دوره‌ای با پوشش اجباری ۱۱ تیم، پنج metric نرمال‌شده و verdict advisory؛
- افزوده‌شده: migration `003_ai_reliability_and_team_performance.sql`، AI projection adapter، timeout/retry/health/cost evidence و benchmark مصنوعی نسخه‌دار؛
- افزوده‌شده: APIهای owner-gated برای organization evaluation و AI event pagination و قراردادهای عمومی benchmark/performance؛
- افزوده‌شده: مرحلهٔ ۴.۵ برای معماری Multi-AI قابل‌تعویض و endpoint قرارداد عمومی؛
- افزوده‌شده: Adapterهای واقعی OpenAI Responses، Anthropic Messages، Google Gemini و OpenAI-compatible با credential resolver زمان اجرا، structured JSON و حساب هزینه؛
- افزوده‌شده: migration `004_domain_registry_snapshots.sql` و hydration نسخه‌دار Registryهای Domain و Control Dashboard در startup؛ Snapshotها append-only و بدون Secret خام هستند؛
- افزوده‌شده: شواهد Recovery عملیاتیِ disposable با `pg_dump`/`pg_restore`، checksum و sentinel در `docs/operations/RECOVERY-EVIDENCE-20260830.md`؛
- مرز: ارسال Provider زنده، External Spend، Secret Store، Connector خارجی، انتقال به مقصد عملیاتی، Deploy و Event projection کامل هنوز جداگانه gated هستند؛
- شواهد: `pnpm check` در Linux container با Node 22 و pnpm 11؛ Governance، Build و 188/188 تست موفق‌اند. Doctor فقط نبود Docker تو‌در‌تو در container را هشدار داد؛ Backup/Restore disposable نیز با موفقیت بازبینی شد.

## 2026-08-30 — اصول تیمی، تحقیق benchmark و مشاورهٔ خروجی

- افزوده‌شده: پنج مقدار پیش‌فرض قابل بررسی برای اصول هر یک از ۱۱ تیم؛
- افزوده‌شده: چرخهٔ درخواست تحقیق، benchmark، گزارش، بازکاری، رد و تأیید مالک؛
- افزوده‌شده: اعمال دانش و اصول پیشنهادی گزارش فقط پس از `approved` مالک؛
- افزوده‌شده: مشاورهٔ چندگزینه‌ای Planner برای prototype، web، mobile، API، اتوماسیون، داده و خروجی‌های تصمیم؛
- افزوده‌شده: گیت `output-decision` که تصمیم مالک را پیش از dispatch ثبت می‌کند؛
- شواهد: اجرای نهایی محلی و image تستی Docker با 170/170 تست موفق؛
- مرز: Provider واقعی، جست‌وجوی بیرونی، persistence کامل گزارش‌ها و تولید/استقرار واقعی همچنان جداگانه gated هستند.

## 2026-08-30 — آموزش تیم‌ها، readiness و audit کنترل

- افزوده‌شده: curriculum پنج‌گانه و benchmark نسخه‌دار برای هر ۱۱ تیم با حدنصاب ۸۰؛
- افزوده‌شده: APIهای `training-contract` و `training-plan` برای مشاهدهٔ مسیر آموزش و آمادگی؛
- افزوده‌شده: APIهای `plans` برای ثبت intake فارسی، Task Graph و گزارش readiness تیم مالک؛
- افزوده‌شده: `control.command-recorded` و audit sink تراکنشی PostgreSQL با timeline صفحه‌بندی‌شده؛
- افزوده‌شده: CI با سرویس PostgreSQL آزمایشی و اجرای واقعی `check:postgres`؛
- افزوده‌شده: `PILOT-READINESS.md` و `check:pilot` برای اعلام شفاف blockerهای HERO-021 بدون جعل آمادگی؛
- مرز: projection کامل domain، session revocation پایدار، Provider زنده، deploy و production همچنان فعال نشده‌اند.

## 2026-08-30 — بازنگری مدل عملیاتی تیم‌ها

- منبع نیاز: شیت «مدل عملیاتی شرکت چندایجنتی نرم‌افزاری» با ۱۱ تیم، فلو اجرایی و مالکیت ابزارها.
- تغییر: Hero از مدل صرفاً Task/Provider به مدل «Team به‌عنوان واحد عملیاتیِ قابل‌کنترل» گسترش یافت.
- افزوده‌شده: قرارداد ماشینی ۱۱ تیم، وضعیت آموزش، گیت آمادگی، کنترل ورودی/خروجی، بازکاری، تخصیص پروژه، خودکارسازی مرحله‌ای و ادغام/تفکیک با سابقهٔ retired.
- افزوده‌شده: `TeamRegistry` deterministic، Eventهای تیم، API مشاهده/بررسی و نمایش اولیه در اتاق کنترل.
- افزوده‌شده: ADR-0007، مدل دادهٔ تیم، سند معماری عملیاتی و رودمپ ۲.۰.
- تکمیل بعدی: Planner اکنون برای همهٔ Taskها مالک تیم، همکاران، مرحله و approval mode را به‌صورت نسخه‌دار پیشنهاد می‌کند و پوشش ۱۱ تیم را کنترل می‌کند.
- وضعیت شواهد: تست قرارداد و Registry اضافه شد؛ آخرین `pnpm check` با 143/143 تست موفق، Doctor بدون هشدار، Governance موفق و Build موفق اجرا شد.
- مرز: این تغییر اتصال Provider زنده، PostgreSQL، Deploy، Secret، هزینه، پیام خارجی یا عملیات برگشت‌ناپذیر ایجاد نمی‌کند.
- گام بعد: تکمیل آموزش/benchmark، اتصال تیم به Planner و Task Graph، سپس اجرای واقعی فقط بعد از HERO-020 و گیت‌های HERO-021.

## 2026-08-30 — اصول حیاتی و فلو test تا production

- افزوده‌شده: `CriticalPrinciplesRegistry` برای اصول پایهٔ Hero و اصول اختصاصی محصولات؛
- افزوده‌شده: تأیید/رد/بازکاری owner-gated و ارزیابی blocking در control pointهای فلو؛
- افزوده‌شده: `ReleasePromotion` برای اتصال دقیق Git commit/tag، Artifact، نسخه و دو محیط test/production؛
- افزوده‌شده: گیت تست واقعی، تأیید مالک، فرمان صریح production و مجوز مستقل `production-deploy`؛
- مستندشده: نقش مکمل GitHub، Notion و Hero در [RELEASE_FLOW.md](../architecture/RELEASE_FLOW.md)؛
- مرز: Deployment Adapter زنده، PostgreSQL عملیاتی، GitHub Environment واقعی و عملیات production در این تغییر فعال نشده‌اند.

## 2026-08-30 — مرز persistence، احراز هویت مالک و محیط test

- افزوده‌شده: قرارداد و تست احراز هویت مالک با signed bearer session، secret زمان اجرا و رفتار fail-closed؛
- افزوده‌شده: migration اولیهٔ PostgreSQL برای Project، Event، Principle، Release، Evidence و Outbox با guardهای append-only؛
- افزوده‌شده: Runner migration تزریق‌پذیر با تراکنش `BEGIN`/`COMMIT` و rollback؛
- افزوده‌شده: Event Store PostgreSQL برای append/read، قفل aggregate و درج Outbox در همان تراکنش؛
- افزوده‌شده: Runtime اختیاری PostgreSQL با pool محدود، migration در startup، ping/readiness و profile جداگانهٔ Compose برای `hero-postgres`؛
- افزوده‌شده: workflow دستی محیط test برای `pnpm check`، ساخت image و ثبت شناسهٔ version/commit/Artifact؛
- مرز: PostgreSQL واقعی، session revocation، Deployment Adapter و Environment production هنوز فعال نشده‌اند.
# 2026-09-04 — persistence benchmark و ممیزی خروجی

- افزوده‌شده: `PostgresBenchmarkStore` برای ذخیره، بازیابی و مقایسهٔ benchmarkهای synthetic با digest ثابت، idempotency و مرز advisory-only؛
- افزوده‌شده: اتصال Control Plane به history و comparison پایدار benchmark در صورت تنظیم `HERO_POSTGRES_URL`؛
- افزوده‌شده: اعتبارسنجی مجدد رکوردهای خوانده‌شده از PostgreSQL پیش از ورود به projection پنل؛
- افزوده‌شده: audit دسترسی به read model با metadata allowlist و endpoint owner-gated جدا از audit فرمان‌ها؛
- شواهد: `pnpm check` در Linux با Build `130` ماژول و `220/220` تست موفق است؛ `check:pilot` همچنان همان سه گیت عملیاتی را مسدود می‌کند؛ اجرای production persistence همچنان به مجوز جداگانه و Secret Store نیاز دارد.

# 2026-08-31 — Back Office access and operational readiness batch 2

- افزوده‌شده: access metadata و راهنمای same-host برای رفع ابهام لینک `127.0.0.1:43100`؛
- افزوده‌شده: جست‌وجو/فیلتر Team، خطایابی اتصال UI و endpoint امن `/backoffice-events`؛
- افزوده‌شده: ثبت outcome ردشدهٔ فرمان، Outbox worker تزریق‌پذیر، قرارداد Pilot و synthetic benchmark endpoint؛
- شواهد: build لینوکس با Doctor/Governance/Build و ۲۰۲/۲۰۲ تست موفق؛ runtime smoke برای `/backoffice`، `/backoffice-data`، `/backoffice-events` و `/pilot-contract` با HTTP 200.
- امنیت انتشار: Basic Auth اختیاریِ fail-closed، `robots.txt` و `X-Robots-Tag` اضافه شد؛ راهنمای DNS/TLS/reverse-proxy در `docs/operations/BACKOFFICE-SUBDOMAIN.md` ثبت شد.

# 2026-09-04 — بازطراحی حرفه‌ای Back Office

- تغییر UI: صفحهٔ تجمیعی به شش نمای مستقل و task-based شامل نمای کلی، تیم‌ها، Multi-AI، پروژه و قراردادها، عملیات و شواهد، و راهنما تقسیم شد؛ همهٔ قابلیت‌ها و شناسه‌های قبلی حفظ شدند.
- افزوده‌شده: ناوبری کناری با وضعیت فعال، عنوان نمای جاری، hash URL برای لینک مستقیم، و چیدمان responsive برای دسکتاپ و موبایل.
- مبنای طراحی: progressive disclosure، یک سطح تصمیم در هر نما، حفظ وضعیت/دسترسی در سطح بالا و نمایش جزئیات داخل کارت‌ها؛ هیچ وابستگی یا endpoint جدیدی اضافه نشد.
- شواهد: `pnpm check` با Doctor/Governance/Build موفق و ۲۳۱/۲۳۱ تست سبز؛ Syntax اسکریپت نهایی HTML و وجود شش route/view نیز در کانتینر Node بررسی شد.
- مرز: این تغییر فقط کد UI، تست و مستندات است و Deploy production، Secret، PostgreSQL و سرویس‌های دیگر را تغییر نمی‌دهد.
