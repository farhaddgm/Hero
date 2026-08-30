# Hero — Remote Project Handoff

این سند مرجع انتقال Hero از محیط محلی به یک Project مستقل روی سرور `farhaad-ai` است. هدف آن انتقال دانش پایدار پروژه است؛ تاریخچهٔ گفت‌وگوی Codex به‌صورت خودکار منتقل نمی‌شود.

## وضعیت فعلی

- Repository اصلی: `https://github.com/farhaddgm/Hero` (خصوصی)
- شاخهٔ منتشرشده: `codex/hero-001-project-charter`
- آخرین commit منتشرشده پیش از این سند: `e3d338b` (`docs: define end-to-end pilot protocol`)
- محیط فعلی: Windows (مسیر محلی در تنظیمات میزبان نگهداری می‌شود و بخشی از قرارداد پروژه نیست)
- وضعیت source: مخزن Git مستقل و clean-room؛ هیچ فایل یا runtime پروژهٔ دیگری نباید وارد Hero شود.
- پوشه‌های محلی `.artifact-work/` و `outputs/` خروجی‌های غیرمرتبط‌اند و عمداً به GitHub ارسال نشده‌اند.

## مقصد remote

برای Hero یک Project جداگانه روی اتصال `farhaad-ai` ایجاد شود:

```text
/opt/hero
```

مسیر موجود پروژهٔ `ai-assistant` و مسیر خانهٔ سرور متعلق به پروژه‌ها/محیط‌های دیگرند و نباید برای Hero استفاده شوند. منابع runtime Hero باید نام‌گذاری project-scoped داشته باشند (`hero-*`).

## دانش و تصمیم‌های قطعی

1. Hero یک Orchestrator مستقل برای توسعهٔ وب و موبایل است.
2. Providerهای فعلی فقط Codex/ChatGPT، Claude و Cursor هستند؛ اتصال واقعی Providerها تا زمان آماده‌شدن adapter و مجوز مربوطه انجام نمی‌شود.
3. معماری فعلی modular monolith با port/adapter است؛ PostgreSQL منبع حقیقت عملیاتی آینده است، اما Domain فعلی برای تست deterministic و in-memory نگه داشته شده است.
4. اجرای Agent در working directory اصلی ممنوع است؛ Runner باید workspace/worktree ایزوله، base ref فقط‌خواندنی، checkpoint و cleanup امن داشته باشد.
5. مجوزها fail-closed، نسخه‌محور و قابل لغو هستند. Global Stop و عملیات حساس (production، حذف داده، secrets، external spend و پیام بیرونی) گیت جداگانه دارند.
6. اسناد معماری، تصمیم‌ها، حاکمیت و مشخصات نسخه‌دار در `docs/` و قرارداد ماشینی در `config/` مرجع اصلی‌اند.
7. Linux/ Docker/Compose runtime مرجع انتقال است؛ تست محلی Windows فقط ابزار کمکی است.
8. رازها، Tokenها و Passwordها نباید در repository، Sheet یا این سند نوشته شوند؛ فقط نام secret/env مجاز است.

## نقشهٔ دانش

- منشور و قواعد: `docs/governance/PROJECT_CHARTER.md`, `AUTHORITY.md`, `CHANGE_CONTROL.md`
- معماری کلان: `docs/architecture/OVERVIEW.md`
- حاکمیت اجرا: `docs/architecture/AUTHORIZATION_ENGINE.md`, `ISOLATED_RUNNER.md`, `QUALITY_GATE.md`, `ASSURANCE_GATE.md`
- حافظه و برنامه‌ریزی: `docs/specs/HERO-014-v1.0.md`, `HERO-015-v1.0.md`
- کارخانه‌ها: `docs/architecture/WEB_FACTORY.md`, `MOBILE_FACTORY.md`
- انتقال و بازیابی: `docs/operations/MOVE-TO-ANOTHER-SERVER.md`, `docs/specs/HERO-020-v1.0.md`
- پایلوت انتهابه‌انتها: `docs/specs/HERO-021-v1.0.md`

تمام specهای `HERO-001` تا `HERO-021` نسخهٔ `v1.0` دارند و قرارداد/تست مربوط به آن‌ها در repository موجود است. وجود قرارداد به‌معنای اتصال live به Provider یا اجرای production نیست.

## کارهای لازم برای راه‌اندازی remote

1. Project مستقل Hero را روی `farhaad-ai` با مسیر `/opt/hero` ثبت کن.
2. Repository خصوصی را در همان مسیر clone کن و شاخهٔ منتشرشده را checkout کن.
3. `.env` را فقط از روی `.env.example` و secret store سرور بساز؛ فایل `.env` هرگز commit نشود.
4. `pnpm check` را در محیط remote اجرا کن و نتیجهٔ واقعی را ثبت کن.
5. Docker/Compose و restore واقعی Linux را فقط با مجوز عملیاتی مربوطه اجرا کن؛ نبود evidence باید block بماند.
6. بعد از تأیید سلامت remote، توسعه از همان Project ادامه پیدا کند و لپ‌تاپ فقط نقش کنترل/مشاهده داشته باشد.

## قاعدهٔ ادامهٔ کار

هر Agent جدید باید پیش از اقدام این سند، `README.md`، منشور، قواعد حاکمیت، معماری مرتبط با Step و authorization فعال را بخواند. اگر Step ID، نسخهٔ سند، dependency یا Global Stop معتبر نیست، dispatch متوقف می‌شود. هیچ Agentی از پروژهٔ `ai-assistant`، مسیر خانهٔ سرور یا هر پروژهٔ دیگر داده یا کد وارد Hero نمی‌کند.
