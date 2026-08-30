# Hero

Hero پایه‌ی مستقل و قابل‌انتقال یک ارکستریتور توسعه با هوش مصنوعی است. این مخزن از صفر ساخته شده و به هیچ پروژه‌ی دیگری روی میزبان وابسته نیست.

## وضعیت فعلی

گام‌های HERO-001 تا HERO-019 و قراردادهای طراحی HERO-020/HERO-021 این موارد را فراهم می‌کنند:

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
- فلو انتشار دو محیطی: Git commit/tag → test → Evidence → تأیید مالک → فرمان مستقل production؛ بدون promote خودکار

اتصال واقعی Codex، Claude و Cursor عمداً در این گام انجام نشده و در گام‌های بعدی، پس از مجوز مستقل، اضافه می‌شود.

## اجرای ساده

پیش‌نیاز: Node.js 22 و pnpm 11.

    pnpm install --frozen-lockfile
    pnpm check
    pnpm start

سپس سرویس روی http://127.0.0.1:3100/health در دسترس است. برای تغییر تنظیمات، .env.example را به .env کپی کنید؛ فایل .env هرگز وارد Git نمی‌شود.

خلاصهٔ معماری تأییدشده نیز از http://127.0.0.1:3100/architecture قابل مشاهده است. این endpoint هیچ Secret یا اتصال زندهٔ Provider را نمایش نمی‌دهد.

خلاصهٔ قرارداد داده نیز از http://127.0.0.1:3100/data-contract قابل مشاهده است؛ این endpoint فقط schema و اصول ایمن را نشان می‌دهد، نه داده یا Secret عملیاتی.

خلاصهٔ چرخهٔ عمر Run نیز از http://127.0.0.1:3100/workflow-contract قابل مشاهده است؛ این endpoint فقط قرارداد حالت‌ها و گذارها را نمایش می‌دهد.

خلاصهٔ مجوز و توقف اضطراری نیز از http://127.0.0.1:3100/authorization-contract قابل مشاهده است؛ این endpoint فقط قرارداد حاکمیت را نشان می‌دهد، نه مجوز یا اجرای زنده.

APIهای `/api/*` فقط با نشست امضاشدهٔ مالک پروژه قابل استفاده‌اند و هدر `Authorization: Bearer hero-session...` می‌خواهند. مقدار `HERO_OWNER_AUTH_SECRET` باید فقط در secret store زمان اجرا تنظیم شود؛ اگر تنظیم نشده باشد API به‌صورت fail-closed در دسترس عملیاتی قرار نمی‌گیرد. قرارداد عمومی احراز هویت از http://127.0.0.1:3100/owner-auth-contract قابل مشاهده است. در این مرحله endpoint ورود یا session revocation پایدار ساخته نشده و این مرز باید در اتصال PostgreSQL تکمیل شود.

فهرست و قرارداد تیم‌ها نیز از http://127.0.0.1:3100/api/teams و http://127.0.0.1:3100/team-contract قابل مشاهده است. مالک پروژه می‌تواند با مسیرهای `POST /api/teams/:teamId/review`، `POST /api/teams/:teamId/rework`، `POST /api/teams/:teamId/deliverable-review`، `POST /api/teams/:teamId/autonomy`، `POST /api/teams/:teamId/training` و `POST /api/teams/:teamId/assign` قرارداد، خروجی، آموزش، تخصیص و سطح خودکارسازی را کنترل کند. مسیرهای `POST /api/team-assignments/:assignmentId/update`، `POST /api/projects/:projectId/team-workflow` و `POST /api/teams/merge` نیز برای رصد اجرا، تغییر فلو و تغییر ساختار سازمانی هستند.

اصول حیاتی از http://127.0.0.1:3100/principles-contract و وضعیت آن‌ها از `/api/dashboard` یا `/api/projects/:projectId/principles` قابل مشاهده است. مسیرهای `POST /api/projects/:projectId/principles`، `/review`، `/rework` و `/check` برای تعریف، تأیید/رد، بازکاری و ارزیابی اصول هستند. قرارداد انتشار از http://127.0.0.1:3100/release-contract قابل مشاهده است؛ ثبت Release و گیت‌های test/production در `POST /api/releases` و `/api/releases/:releaseId/test-deployment`، `/test-deployment-record`، `/test-evidence`، `/production-approval`، `/production-approve` و `/production-promote` قرار دارند. Deployment زنده عمداً غیرفعال است.

## اجرای کانتینری

    docker compose --env-file .env up --build

پورت پیش‌فرض میزبان 43100 است تا احتمال برخورد با سرویس‌های موجود کم شود. Compose نام volume و network را با نام پروژه namespace می‌کند.

## کنترل استقلال

    pnpm doctor

Doctor در صورت مشاهده‌ی symlink، Git submodule، وابستگی محلی، import خارج از ریشه، مسیر مطلق میزبان یا remote محلی شکست می‌خورد. نبود Docker در محیط توسعه فقط هشدار است؛ در CI یا سرور مرجع باید Docker جداگانه آزمایش شود.

راهنمای انتقال در docs/operations/MOVE-TO-ANOTHER-SERVER.md و تصمیم مرزی در docs/decisions/ADR-0001-clean-room-boundary.md ثبت شده است.

اصول حیاتی در [docs/architecture/CRITICAL_PRINCIPLES.md](docs/architecture/CRITICAL_PRINCIPLES.md)، فلو انتشار در [docs/architecture/RELEASE_FLOW.md](docs/architecture/RELEASE_FLOW.md) و مدل کامل تیم‌ها در [docs/architecture/TEAM_OPERATING_MODEL.md](docs/architecture/TEAM_OPERATING_MODEL.md) ثبت شده‌اند.

مرز migration PostgreSQL در [packages/adapters/migrations/001_principles_release_audit.sql](packages/adapters/migrations/001_principles_release_audit.sql)، Runner تزریق‌پذیر آن در `packages/adapters/src/postgresql-schema.mjs` و Event Store تراکنشی در `packages/adapters/src/postgresql-operational-store.mjs` ثبت شده است. runtime این adapterها در زمان راه‌اندازی به‌صورت اختیاری migration و health check را به Control Plane وصل می‌کند؛ projection فرمان‌های دامنه هنوز عمداً در حافظه است و اتصال پایدار آن گام بعدی است.

برای اجرای اتصال واقعی test، `HERO_POSTGRES_URL` و `HERO_POSTGRES_PASSWORD` را فقط در secret store تنظیم کنید و سپس `pnpm check:postgres` را اجرا کنید. Compose سرویس جداگانهٔ `hero-postgres` را فقط با profile `postgres` ارائه می‌کند؛ مقدار خالی یا نبود Secret عمداً باید متوقف بماند. وقتی URL تنظیم باشد، Control Plane هنگام start migration را اجرا می‌کند و `/ready` فقط پس از ping موفق، `persistence: postgresql` گزارش می‌دهد.

## حاکمیت پروژه

منشور مصوب در docs/governance/PROJECT_CHARTER.md قرار دارد. قرارداد ماشینی حاکمیت در config/governance.json و Snapshot اختیار توسعه‌ی فعلی در config/authorizations/roadmap-20260814-001.json نگهداری می‌شود.

    pnpm check:governance

این کنترل تضمین می‌کند که ۲۱ گام فعلی نسخه‌دار باشند، اختیار توسعه به عملیات حساس گسترش پیدا نکند و Definition of Done ناقص نشود.

رودمپ بازطراحی شرکت در [docs/roadmap/ROADMAP-2.0-TEAM-OPERATING-MODEL.md](docs/roadmap/ROADMAP-2.0-TEAM-OPERATING-MODEL.md) و قرارداد تیم‌ها در [docs/architecture/TEAM_OPERATING_MODEL.md](docs/architecture/TEAM_OPERATING_MODEL.md) ثبت شده است.
