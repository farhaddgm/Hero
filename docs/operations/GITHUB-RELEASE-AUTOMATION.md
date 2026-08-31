# خودکارسازی نسخه و تحویل Hero در GitHub

## وضعیت

Workflow `Hero Release Candidate` در `.github/workflows/release-candidate.yml` قرار دارد. این workflow بعد از push به شاخهٔ عملیاتی فعلی `codex/hero-001-project-charter` به‌صورت خودکار روی Environment به نام `test` اجرا می‌شود. اجرای دستی با `workflow_dispatch` نیز برای بازتولید یا انتخاب نسخهٔ مشخص باقی مانده است.

## خروجی workflow

پس از تأیید Environment `test`، workflow این زنجیره را اجرا می‌کند:

```text
checkout revision
  -> validate SemVer
  -> pnpm install --frozen-lockfile
  -> pnpm check
  -> Docker image با SHA مشخص
  -> tag دقیق v<version>
  -> GitHub pre-release
  -> artifact شواهد
```

Tag و pre-release دقیقاً به commit انتخاب‌شده متصل‌اند. خروجی workflow شامل نسخه، commit SHA، شناسهٔ image، URL release و artifact شواهد است. هیچ production deploy، مصرف Provider، تغییر Secret یا پیام بیرونی انجام نمی‌شود.

## یک‌بار تنظیم در GitHub

۱. در Repository Settings → Environments یک Environment با نام `test` بسازید.
۲. برای `test` در صورت نیاز Required Reviewer تعیین کنید تا قبل از tag و release تأیید انجام شود.
۳. در Settings → Actions → General، اجازهٔ اجرای workflow و در صورت سیاست سازمانی، Workflow permissions مناسب برای `contents: write` را فعال کنید.
۴. برای این workflow Secret جدید لازم نیست؛ از `GITHUB_TOKEN` داخلی همان اجرا استفاده می‌کند.
۵. Environment `production` را جدا نگه دارید و به این workflow وصل نکنید.

## اجرای دستی

با هر push، نسخهٔ candidate به‌صورت deterministic از نسخهٔ پایه و شمارهٔ اجرای workflow ساخته می‌شود؛ مانند `0.1.0-rc.12`. بعد از موفقیت، artifact شواهد و لینک pre-release برای بررسی مالک آماده است. برای نسخهٔ مشخص، در GitHub به Actions → Hero Release Candidate → Run workflow بروید و نسخه‌ای مانند `0.1.0-rc.1` را انتخاب کنید. نسخهٔ نهایی مانند `0.1.0` باید پس از عبور test و تأیید مالک، در یک release جدید تولید شود.

## Push مستقیم توسط Codex

این workflow tag و release candidate را خودکار می‌کند، اما commit‌کردن تغییرات workspace و push کد همچنان باید از یک محیط دارای credential امن انجام شود. پس از آن، Codex فقط commit و push می‌کند و بقیهٔ نسخه‌گذاری خودکار انجام می‌شود. Token یا کلید نباید در چت، Git یا فایل `.env` قرار گیرد. برای push مستقیم Codex یکی از این دو مسیر لازم است:

- credential helper امن روی همان محیط اجرای Codex؛ یا
- SSH key محدود به repository Hero و remote از نوع SSH.

Fine-grained token باید فقط به `farhaddgm/Hero` محدود و حداقل `Contents: read/write` و برای تغییر workflowها `Workflows: read/write` داشته باشد. Token برای استفادهٔ HTTPS جایگزین password است، نه مقدار password واقعی.

## مرز production

این automation عمداً فقط test candidate می‌سازد. انتقال به production همچنان از فلو `Git → test → evidence → تأیید مالک → مجوز مستقل production-deploy → فرمان صریح` پیروی می‌کند و بدون شواهد HERO-020 و HERO-021 فعال نمی‌شود.
