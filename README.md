# Hero

Hero پایه‌ی مستقل و قابل‌انتقال یک ارکستریتور توسعه با هوش مصنوعی است. این مخزن از صفر ساخته شده و به هیچ پروژه‌ی دیگری روی میزبان وابسته نیست.

## وضعیت فعلی

گام‌های HERO-002 و HERO-004 این موارد را فراهم می‌کنند:

- قرارداد تجربه کاربر فارسی و ساده، با وضعیت‌های قابل‌فهم، حالت راهنما و اختیار کامل Snapshot نسخه‌دار

- monorepo مستقل با pnpm
- سرویس کنترل حداقلی با مسیرهای /health و /ready
- تست و بررسی ساخت بدون وابستگی خارجی
- Hero Doctor برای کنترل مرز مخزن و انتقال‌پذیری
- Docker و Compose با volume و network اختصاصی
- CI مستقل

اتصال واقعی Codex، Claude و Cursor عمداً در این گام انجام نشده و در گام‌های بعدی، پس از مجوز مستقل، اضافه می‌شود.

## اجرای ساده

پیش‌نیاز: Node.js 22 و pnpm 11.

    pnpm install --frozen-lockfile
    pnpm check
    pnpm start

سپس سرویس روی http://127.0.0.1:3100/health در دسترس است. برای تغییر تنظیمات، .env.example را به .env کپی کنید؛ فایل .env هرگز وارد Git نمی‌شود.

## اجرای کانتینری

    docker compose --env-file .env up --build

پورت پیش‌فرض میزبان 43100 است تا احتمال برخورد با سرویس‌های موجود کم شود. Compose نام volume و network را با نام پروژه namespace می‌کند.

## کنترل استقلال

    pnpm doctor

Doctor در صورت مشاهده‌ی symlink، Git submodule، وابستگی محلی، import خارج از ریشه، مسیر مطلق میزبان یا remote محلی شکست می‌خورد. نبود Docker در محیط توسعه فقط هشدار است؛ در CI یا سرور مرجع باید Docker جداگانه آزمایش شود.

راهنمای انتقال در docs/operations/MOVE-TO-ANOTHER-SERVER.md و تصمیم مرزی در docs/decisions/ADR-0001-clean-room-boundary.md ثبت شده است.

## حاکمیت پروژه

منشور مصوب در docs/governance/PROJECT_CHARTER.md قرار دارد. قرارداد ماشینی حاکمیت در config/governance.json و Snapshot اختیار توسعه‌ی فعلی در config/authorizations/roadmap-20260814-001.json نگهداری می‌شود.

    pnpm check:governance

این کنترل تضمین می‌کند که ۲۱ گام فعلی نسخه‌دار باشند، اختیار توسعه به عملیات حساس گسترش پیدا نکند و Definition of Done ناقص نشود.
