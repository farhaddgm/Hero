# خودکارسازی نسخه و تحویل Hero در GitHub

## وضعیت

Workflow `Hero Release Candidate` در `.github/workflows/release-candidate.yml` قرار دارد. این workflow عمداً فقط با `workflow_dispatch` اجرا می‌شود تا هر انتشار Test یک تصمیم آگاهانه، نسخهٔ مشخص و evidence مستقل داشته باشد. اجرای خودکار push حذف شده است؛ این کار از انتشار ناخواسته و candidateهای تکراری جلوگیری می‌کند.

## خروجی workflow

پس از تأیید Environment `test`، workflow این زنجیره را اجرا می‌کند:

```text
  checkout revision
  -> validate SemVer و release preflight
  -> pnpm install --frozen-lockfile
  -> pnpm check
  -> Docker image با SHA مشخص
  -> tag دقیق v<version>
  -> GitHub pre-release
  -> release manifest غیرقابل‌ابهام + artifact شواهد
```

Tag و pre-release دقیقاً به commit انتخاب‌شده متصل‌اند. خروجی workflow شامل نسخه، commit SHA، شناسهٔ image، URL release و artifact شواهد است. هیچ production deploy، مصرف Provider، تغییر Secret یا پیام بیرونی انجام نمی‌شود.

## یک‌بار تنظیم در GitHub

۱. در Repository Settings → Environments یک Environment با نام `test` بسازید.
۲. برای `test` در صورت نیاز Required Reviewer تعیین کنید تا قبل از tag و release تأیید انجام شود.
۳. در Settings → Actions → General، اجازهٔ اجرای workflow و در صورت سیاست سازمانی، Workflow permissions مناسب برای `contents: write` را فعال کنید.
۴. برای این workflow Secret جدید لازم نیست؛ از `GITHUB_TOKEN` داخلی همان اجرا استفاده می‌کند.
۵. Environment `production` را جدا نگه دارید و به این workflow وصل نکنید.

این workflow روی runner رسمی GitHub (`ubuntu-latest`) اجرا می‌شود؛ برای مسیر استاندارد انتشار Test، نصب یا مدیریت Self-hosted Runner لازم نیست. Runner اختصاصی فقط یک گزینهٔ آینده برای شبکهٔ خصوصی است و نباید پیش‌نیاز انتشار فعلی تلقی شود.

## اجرای دستی

برای انتشار، در GitHub به Actions → Hero Release Candidate → Run workflow بروید و نسخه‌ای مانند `0.1.0-rc.1` را صریحاً انتخاب کنید. workflow فقط در صورت تمیزی worktree، آزادبودن tag، معتبر بودن commit و موفقیت `pnpm check` ادامه می‌دهد. پس از موفقیت، `hero-release-manifest.json` را همراه evidence دریافت کنید؛ promotion Test باید با digest همان manifest انجام شود، نه tag یا SHA خام. نسخهٔ نهایی مانند `0.1.0` نیز همین مسیر را با تأییدهای لازم طی می‌کند.

## Push مستقیم توسط Codex

این workflow tag و release candidate را پس از اجرای دستی خودکار می‌کند، اما commit‌کردن تغییرات workspace و push کد همچنان باید از یک محیط دارای credential امن انجام شود. Token یا کلید نباید در چت، Git یا فایل `.env` قرار گیرد. برای push مستقیم Codex یکی از این دو مسیر لازم است:

- credential helper امن روی همان محیط اجرای Codex؛ یا
- SSH key محدود به repository Hero و remote از نوع SSH.

Fine-grained token باید فقط به `farhaddgm/Hero` محدود و حداقل `Contents: read/write` و برای تغییر workflowها `Workflows: read/write` داشته باشد. Token برای استفادهٔ HTTPS جایگزین password است، نه مقدار password واقعی.

## مرز production

این automation عمداً فقط test candidate می‌سازد. انتقال به production همچنان از فلو `Git → test → evidence → تأیید مالک → مجوز مستقل production-deploy → فرمان صریح` پیروی می‌کند و بدون شواهد HERO-020 و HERO-021 فعال نمی‌شود.
