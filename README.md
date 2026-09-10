# Hero

Hero پایه‌ی مستقل و قابل‌انتقال یک ارکستریتور توسعه با هوش مصنوعی است. این مخزن از صفر ساخته شده و به هیچ پروژه‌ی دیگری روی میزبان وابسته نیست.

فهرست مرجع اسناد در [docs/INDEX.md](docs/INDEX.md) قرار دارد. [حاکمیت مستندات](docs/governance/DOCUMENTATION-GOVERNANCE.md) Git را منبع حقیقت و رجیستری را مرز canonical می‌داند؛ [مدل محیط و انتشار](docs/architecture/ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL.md) نیز جداسازی Hero و Product در Test/Production را تعریف می‌کند.

## وضعیت فعلی

گام‌های HERO-001 تا HERO-019، پیاده‌سازی محلی HERO-022/HERO-023 و قراردادهای HERO-020/HERO-021 این موارد را فراهم می‌کنند؛ HERO-024 تا HERO-026 همچنان گیت‌های عملیاتیِ بازنشده دارند:

- قرارداد تجربه کاربر فارسی و ساده، با وضعیت‌های قابل‌فهم، حالت راهنما و اختیار کامل Snapshot نسخه‌دار

- معماری کلان «هستهٔ یکپارچهٔ ماژولار با Runnerهای ایزوله» و نقش‌های جدا برای Codex/ChatGPT، Claude و Cursor

- قرارداد دادهٔ عملیاتی، Event Log append-only، کنترل تکرار/هم‌زمانی و مدل Outbox برای Dispatch پایدار

- موتور گردش‌کار صریح برای Runها: Draft، Planned، Queued، Running، Review، Pause/Resume، Failure/Retry، Completed و Cancelled؛ با idempotency key و تاریخچهٔ Event

- موتور تأیید fail-closed: مجوز مستقیم یا Snapshot نسخه‌دار، تطبیق دقیق Step ID/نسخه/Operation، لغو append-only، Audit Trail و توقف اضطراری برای Dispatch جدید

- مرز Runner ایزوله: یک Worktree نسبی برای هر Task، شبکهٔ پیش‌فرضِ بسته، timeout، checkpoint پیش از cancel/cleanup و محدودیت هم‌زمانی بدون اجرای Agent یا Git زنده

- monorepo مستقل با pnpm
- سرویس کنترل حداقلی با مسیرهای /health و /ready
- تست و بررسی ساخت بدون وابستگی خارجی
- Hero Doctor برای کنترل مرز مخزن و انتقال‌پذیری
- Docker و Compose با volume و network اختصاصی
- CI مستقل
- مدل عملیاتی شرکت با ۱۱ تیم مرحلهٔ اول، قرارداد مسئولیت/اختیار/ورودی/خروجی/اصول، آموزش، تخصیص پروژه و کنترل بازکاری
- اصول حیاتی نسخه‌دار برای خود Hero و هر محصول، با گیت blocking و تأیید/رد/بازکاری مالک
- orchestration چندنقشی AI با Role/Profile/Provider/Model مستقل، route نقش‌ها در Planner و پیش‌فرض executor/Codex برای implementation
- Quality Gate متصل به Evaluation، timeout/retry/health/cost policy، ارزیابی دوره‌ای هر ۱۱ تیم و benchmark مصنوعی Provider/Profile
- فلو انتشار دو محیطی: Git commit/tag → test → Evidence → تأیید مالک → فرمان مستقل production؛ بدون promote خودکار

Adapterهای واقعی OpenAI Responses، Anthropic Messages، Google Gemini و OpenAI-compatible در مرز adapter پیاده‌سازی شده‌اند؛ اما اجرای زنده همچنان به credential زمان اجرا، حساب هزینه و بررسی active authorization snapshot نیاز دارد و بدون آن fail-closed می‌ماند. Codex/Claude/Cursor داخل محصول به‌صورت پیش‌فرض فعال نیستند.

## اجرای ساده

پیش‌نیاز: Node.js 22 و pnpm 11.

    pnpm install --frozen-lockfile
    pnpm check
    pnpm start

سپس سرویس روی http://127.0.0.1:3100/health در دسترس است. برای تغییر تنظیمات، .env.example را به .env کپی کنید؛ فایل .env هرگز وارد Git نمی‌شود.

خلاصهٔ معماری تأییدشده نیز از http://127.0.0.1:3100/architecture قابل مشاهده است. این endpoint هیچ Secret یا اتصال زندهٔ Provider را نمایش نمی‌دهد.

قرارداد معماری Multi-AI قابل‌تعویض نیز از http://127.0.0.1:3100/ai-orchestration-contract قابل مشاهده است. این قرارداد Role، Agent Profile، Provider، Model، Invocation، Evaluation و Decision Proposal را جدا نگه می‌دارد؛ transport Provider زنده آماده است اما بدون credential، cost policy و active authorization verifier هیچ تماس live انجام نمی‌شود.

مرز عملیاتی Multi-AI از `/api/ai-orchestration` قابل مشاهده است. در محیط deterministic، مالک می‌تواند به‌ترتیب از `/api/memory`، `/api/ai/providers`، `/api/ai/models`، `/api/ai/profiles`، `/api/ai/bindings`، `/api/ai/context` و `/api/ai/invocations` استفاده کند؛ `/api/ai/evaluations/from-invocation` خروجی Evaluator را به Evidence تبدیل می‌کند و `/api/ai/decisions` و `/resolve` تصمیم مالک‌محور را ثبت می‌کنند. همهٔ این مسیرها owner-authenticated هستند و Provider زنده را فعال نمی‌کنند.

برای مشاهدهٔ eventهای AI از `GET /api/ai/events?after=0` و برای ارزیابی کل سازمان از `POST /api/ai/organization-evaluations` استفاده می‌شود؛ بدنهٔ ارزیابی باید برای هر ۱۱ تیم یک `hero://` evidence و scoreهای delivery/quality/evidence/rework/reliability داشته باشد. قرارداد benchmark مصنوعی از `/ai-benchmark-contract` و قرارداد Performance Review از `/organization-performance-contract` قابل مشاهده است. هیچ‌کدام مجوز اجرا یا انتشار ایجاد نمی‌کنند.

خلاصهٔ قرارداد داده نیز از http://127.0.0.1:3100/data-contract قابل مشاهده است؛ این endpoint فقط schema و اصول ایمن را نشان می‌دهد، نه داده یا Secret عملیاتی.

خلاصهٔ چرخهٔ عمر Run نیز از http://127.0.0.1:3100/workflow-contract قابل مشاهده است؛ این endpoint فقط قرارداد حالت‌ها و گذارها را نمایش می‌دهد.

خلاصهٔ مجوز و توقف اضطراری نیز از http://127.0.0.1:3100/authorization-contract قابل مشاهده است؛ این endpoint فقط قرارداد حاکمیت را نشان می‌دهد، نه مجوز یا اجرای زنده.

برنامه‌ریزی درخواست از طریق `POST /api/plans` و مشاهدهٔ برنامهٔ ثبت‌شده از `GET /api/plans/:planningId` انجام می‌شود. Planner علاوه بر Task Graph و دلیل route، آمادگی تیم‌های مالک و مشاورهٔ چندگزینه‌ای خروجی محصول را گزارش می‌کند؛ تصمیم خروجی با `POST /api/plans/:planningId/output-decision` ثبت می‌شود و تیم ناآماده یا خروجی تأییدنشده هرگز به‌صورت ضمنی قابل dispatch نیست.

APIهای `/api/*` فقط با نشست امضاشدهٔ مالک پروژه قابل استفاده‌اند و هدر `Authorization: Bearer hero-session...` می‌خواهند. مقدار `HERO_OWNER_AUTH_SECRET` باید فقط در secret store زمان اجرا تنظیم شود؛ اگر تنظیم نشده باشد API به‌صورت fail-closed در دسترس عملیاتی قرار نمی‌گیرد. قرارداد عمومی احراز هویت از http://127.0.0.1:3100/owner-auth-contract قابل مشاهده است. ساخت نشست در مرز عملیاتی مالک انجام می‌شود و `POST /api/auth/revoke-session` برای لغو نشستِ owner-gated وجود دارد؛ revocation در هر احراز هویت بررسی می‌شود و با PostgreSQL قابل بازسازی است.

فهرست و قرارداد تیم‌ها نیز از http://127.0.0.1:3100/api/teams و http://127.0.0.1:3100/team-contract قابل مشاهده است. پیش‌نویس اصول همهٔ تیم‌ها و دانش افزوده‌شده از http://127.0.0.1:3100/team-principles قابل مشاهده است. مالک پروژه می‌تواند با مسیرهای `POST /api/teams/:teamId/review`، `POST /api/teams/:teamId/rework`، `POST /api/teams/:teamId/deliverable-review`، `POST /api/teams/:teamId/autonomy`، `POST /api/teams/:teamId/training` و `POST /api/teams/:teamId/assign` قرارداد، اصول، خروجی، آموزش، تخصیص و سطح خودکارسازی را کنترل کند. مسیرهای `POST /api/team-assignments/:assignmentId/update`، `POST /api/projects/:projectId/team-workflow` و `POST /api/teams/merge` نیز برای رصد اجرا، تغییر فلو و تغییر ساختار سازمانی هستند.

برنامهٔ آموزش و benchmark هر تیم از `GET /training-contract` و `GET /api/teams/:teamId/training-plan` قابل مشاهده است. آمادگی تیم فقط پس از تأیید هفت بخش قرارداد و قبولی هر پنج module با امتیاز حداقل ۸۰ صادر می‌شود.

آمادگی پایلوت HERO-021 با `pnpm check:pilot` بررسی می‌شود؛ این فرمان در نبود شواهد مقصد پاک، Provider واقعیِ دارای مجوز مستقل و درخواست/معیار پذیرش پایلوت عمداً `blocked` برمی‌گرداند. یک Backup/Restore disposable با checksum ثبت شده، اما جایگزین مقصد عملیاتی نیست.

تحقیق و benchmark هر تیم از طریق `POST /api/teams/:teamId/research-requests` سفارش داده می‌شود. چرخهٔ `start`، ثبت گزارش، مشاهده و `review` در مسیرهای `/api/research/:researchId/...` قرار دارد. گزارش معتبر باید منبع، یافته، مقایسه، توصیه و پیشنهاد دانش/اصول داشته باشد؛ فقط تأیید مالک آن را به تیم اضافه می‌کند. قرارداد این چرخه از http://127.0.0.1:3100/team-research-contract و قرارداد گزینه‌های خروجی از http://127.0.0.1:3100/output-advisory-contract قابل مشاهده است.

اصول حیاتی از http://127.0.0.1:3100/principles-contract و وضعیت آن‌ها از `/api/dashboard` یا `/api/projects/:projectId/principles` قابل مشاهده است. مسیرهای `POST /api/projects/:projectId/principles`، `/review`، `/rework` و `/check` برای تعریف، تأیید/رد، بازکاری و ارزیابی اصول هستند. قرارداد انتشار از http://127.0.0.1:3100/release-contract قابل مشاهده است؛ ثبت Release و گیت‌های test/production در `POST /api/releases` و `/api/releases/:releaseId/test-deployment`، `/test-deployment-record`، `/test-evidence`، `/production-approval`، `/production-approve` و `/production-promote` قرار دارند. Deployment زنده عمداً غیرفعال است.

## اجرای کانتینری

    docker compose --env-file .env up --build

راهنمای اجرای محیط Test جداگانهٔ خود Hero در [docs/operations/HERO-TEST-ENVIRONMENT.md](docs/operations/HERO-TEST-ENVIRONMENT.md) است. محیط Test روی همان سرور با Compose project `hero-test`، پورت `43101`، volume و PostgreSQL مستقل اجرا می‌شود؛ این راهنما هیچ DNS، Secret یا Production را خودکار تغییر نمی‌دهد.

پورت پیش‌فرض میزبان 43100 است تا احتمال برخورد با سرویس‌های موجود کم شود. Compose نام volume و network را با نام پروژه namespace می‌کند.

### مشاهدهٔ Back Office

بعد از بالا آمدن Compose، در مرورگری که روی همان ماشینِ اجرای Docker باز است، مسیر زیر را باز کنید:

    http://localhost:43100/backoffice

برای بررسی سریع از همان میزبان:

    docker compose ps
    curl -i http://127.0.0.1:43100/backoffice

`127.0.0.1` عمداً فقط loopback است؛ بنابراین لینکی که از یک کامپیوتر دیگر، یک VM دیگر یا محیط مرورگر جدا باز شود، به این سرویس نمی‌رسد. برای دسترسی شبکه‌ای باید جداگانه bind address، firewall، احراز هویت مشاهده‌ای و ترجیحاً reverse proxy امن طراحی و مجاز شوند؛ تغییر پیش‌فرض به `0.0.0.0` انجام نشده است.

اگر Back Office قرار است پشت HTTPS و یک زیردامنهٔ عمومی قرار بگیرد، `HERO_BACKOFFICE_USER` و `HERO_BACKOFFICE_PASSWORD` را فقط در Secret Store محیط اجرا تنظیم کنید؛ password حداقل ۱۶ نویسه باشد. اپلیکیشن در این حالت مسیرهای `/backoffice`، `/backoffice-data` و `/backoffice-events` را با Basic Auth محافظت می‌کند. همهٔ پاسخ‌های Hero سیاست `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate` دارند و صفحه‌های HTML همین سیاست را با meta tag نیز اعلام می‌کنند؛ `robots.txt` کل مسیر را `Disallow` می‌کند و sitemap عمومی وجود ندارد. این‌ها از ایندکس‌شدن معمول جلوگیری می‌کنند، اما جایگزین احراز هویت، TLS، firewall یا reverse proxy نیستند.

قرارداد جداسازی Secretهای Test و Production، الگوی مهاجرت پروژه‌به‌پروژه و کنترل جلوگیری از ورود فایل runtime به Git در [docs/operations/SECRET-MANAGEMENT.md](docs/operations/SECRET-MANAGEMENT.md) ثبت شده است. مقدار Secret چند پروژه نباید در یک فایل `.env` مشترک قرار بگیرد.

## کنترل استقلال

    pnpm doctor

Doctor در صورت مشاهده‌ی symlink، Git submodule، وابستگی محلی، import خارج از ریشه، مسیر مطلق میزبان یا remote محلی شکست می‌خورد. نبود Docker در محیط توسعه فقط هشدار است؛ در CI یا سرور مرجع باید Docker جداگانه آزمایش شود.

راهنمای انتقال در docs/operations/MOVE-TO-ANOTHER-SERVER.md و تصمیم مرزی در docs/decisions/ADR-0001-clean-room-boundary.md ثبت شده است.

اصول حیاتی در [docs/architecture/CRITICAL_PRINCIPLES.md](docs/architecture/CRITICAL_PRINCIPLES.md)، فلو انتشار در [docs/architecture/RELEASE_FLOW.md](docs/architecture/RELEASE_FLOW.md) و مدل کامل تیم‌ها در [docs/architecture/TEAM_OPERATING_MODEL.md](docs/architecture/TEAM_OPERATING_MODEL.md) ثبت شده‌اند.

مرز migration PostgreSQL در [packages/adapters/migrations/001_principles_release_audit.sql](packages/adapters/migrations/001_principles_release_audit.sql)، migrationهای AI در `002_ai_orchestration_projections.sql`، reliability/performance در `003_ai_reliability_and_team_performance.sql` و Snapshotهای versioned Registryهای Domain در `004_domain_registry_snapshots.sql` ثبت شده‌اند. Runner تزریق‌پذیر آن در `packages/adapters/src/postgresql-schema.mjs`، Event Store تراکنشی در `packages/adapters/src/postgresql-operational-store.mjs`، AI projection adapter در `packages/adapters/src/ai-projection-store.mjs` و hydration adapter در `packages/adapters/src/domain-registry-snapshot-store.mjs` قرار دارند. Control Plane هنگام start آخرین Snapshot معتبر ده Registry دامنه و وضعیت dashboard را hydrate می‌کند و پس از هر فرمان موفق Snapshot append-only جدید ثبت می‌شود؛ Event Store همچنان منبع حقیقت و Snapshot فقط projection قابل‌بازسازی است.

برای اجرای اتصال واقعی test، `HERO_POSTGRES_URL` و `HERO_POSTGRES_PASSWORD` را فقط در secret store تنظیم کنید و سپس `pnpm check:postgres` را اجرا کنید. Compose سرویس جداگانهٔ `hero-postgres` را فقط با profile `postgres` ارائه می‌کند؛ مقدار خالی یا نبود Secret عمداً باید متوقف بماند. وقتی URL تنظیم باشد، Control Plane هنگام start migration را اجرا می‌کند و `/ready` فقط پس از ping موفق، `persistence: postgresql` گزارش می‌دهد.

وقتی PostgreSQL تنظیم باشد، فرمان‌های موفق Control Plane به‌صورت audit event ایمن ثبت می‌شوند و مالک می‌تواند timeline را با `GET /api/audit?after=0&limit=50` بخواند؛ ممیزی دسترسی read model از `GET /api/audit/read-access?after=0&limit=50` جداست. این مسیرها pagination بر اساس sequence دارند و ورودی خام، query string، header احراز هویت، token یا Secret را ذخیره نمی‌کنند؛ خرابی best-effort audit دسترسی، خواندن پنل را متوقف نمی‌کند. برای ساخت transport adapterهای واقعی بدون برقراری اتصال در زمان start، `HERO_ENABLE_REAL_PROVIDERS=true` را تنظیم کنید؛ این پرچم به‌تنهایی مجوز external-spend نیست. مقدار cost policy باید در گزینهٔ runtime adapter یا resolver برنامه تنظیم شود و active authorization verifier نیز لازم است. Session revocation پایدار و deployment زنده هنوز مرزهای جداگانه‌اند.

Back Office، timeline امن و قرارداد Pilot از مسیرهای read-only زیر در دسترس‌اند: `/backoffice`، `/backoffice-data`، `/backoffice-events?after=0&limit=24` و `/pilot-contract`. اجرای benchmark synthetic فقط از `POST /api/ai/benchmarks/synthetic` با نشست مالک ممکن است و نتیجهٔ آن صرفاً advisory است؛ هرگز مجوز Provider، هزینه، mutation یا release محسوب نمی‌شود.

## حاکمیت پروژه

منشور مصوب در docs/governance/PROJECT_CHARTER.md قرار دارد. قرارداد ماشینی حاکمیت در config/governance.json و Snapshot اختیار توسعه‌ی فعلی در config/authorizations/roadmap-20260814-001.json نگهداری می‌شود.

    pnpm check:governance

این کنترل تضمین می‌کند که ۲۱ گام فعلی نسخه‌دار باشند، اختیار توسعه به عملیات حساس گسترش پیدا نکند و Definition of Done ناقص نشود.

رودمپ بازطراحی شرکت در [docs/roadmap/ROADMAP-2.0-TEAM-OPERATING-MODEL.md](docs/roadmap/ROADMAP-2.0-TEAM-OPERATING-MODEL.md) و قرارداد تیم‌ها در [docs/architecture/TEAM_OPERATING_MODEL.md](docs/architecture/TEAM_OPERATING_MODEL.md) ثبت شده است.
