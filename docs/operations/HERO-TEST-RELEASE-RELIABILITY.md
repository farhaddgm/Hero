# پایایی انتشار Hero در محیط Test

- Document ID: `HERO-OPS-HERO-TEST-RELEASE-RELIABILITY`
- Version: `1.6.0`
- Status: `active`
- Owner: `hero-operations`
- Scope: `hero`
- Review: بعد از هر انتشار Test و هر رخداد شکست انتشار

## هدف

این runbook مسیر انتشار را از یک «فرمان دستی با چند مقدار مبهم» به یک زنجیرهٔ قابل‌ردیابی تبدیل می‌کند: نسخه و commit از ابتدا مشخص‌اند، image فقط با digest غیرقابل‌تغییر جابه‌جا می‌شود، manifest مرجع واحد است، backup هیچ Secretی ندارد و در شکست پس از تغییر، rollback خودکار انجام می‌شود.

## Snapshot جاری source و Test — ۲۰۲۶-۰۹-۱۹

- source مرجع branch `codex/test-release-reliability-20260916`، commit `e52e437ddc33395afbf177b345c6e9e3d2cc6654` است.
- Runtime Test طبق آخرین promotion ثبت‌شده روی `v1.1.5-rc.10` و artifact immutable `ghcr.io/farhaddgm/hero@sha256:e808aedc95075a3af4270aaaf971281de14a5a05c40570511ecd3948c6efb225` اجرا می‌شود؛ `/health`، `/ready` و smoke موفق‌اند.
- GitHub Actions run `35287418094` موفق بود؛ promotion مالک، rollback point metadata-only، `/health` و `/ready` هر دو ۲۰۰ و persistence PostgreSQL تأیید شدند.
- rc.6 رخداد crash-loop ناشی از hydration داشت؛ rc.8 با read model اصلاح‌شده و persistence atomic جایگزین و smoke شد.
- Candidate `v1.1.5-rc.10` در CI برابر ۴۷۴ pass، ۰ fail و ۰ skipped بود؛ build برابر ۲۹۸ module و ۵۰ JSON و Documentation check برابر ۱۴۸ سند، ۲ محصول و ۰ خطا بود. این runbook دربارهٔ انتشار Hero است؛ scenario زندهٔ Provider evidence جداگانه می‌خواهد.

## رخداد و اصلاح ۲۰۲۶-۰۹-۱۸

- علت crash-loop: `listProjects()` فیلد `productRequest.projectId` را در read model برنمی‌گرداند و hydration fail-closed با `Product request metadata is invalid` متوقف می‌شد.
- اصلاح‌های هم‌زمان: read model اکنون scope درخواست را کامل برمی‌گرداند؛ ثبت اولیهٔ Product Request، Project و Foundation در یک تراکنش انجام می‌شود؛ replay رکورد قدیمی نیمه‌ثبت‌شده Foundation گمشده را بدون درج دوباره repair می‌کند.
- candidate `v1.1.5-rc.10` همهٔ checkهای منبع، build و workflow انتشار را گذرانده و روی Test promote و verify شده است. این candidate علاوه بر اصلاح Advisor، promotion را در برابر duplicate keyهای فایل env نیز fail-closed می‌کند. این runbook دربارهٔ انتشار Hero است؛ سناریوی زندهٔ Provider evidence جداگانه می‌خواهد.

## اجرای پیشین — ۲۰۲۶-۰۹-۱۷

- Release Candidate `1.1.3-rc.1` برای commit `07c0ca591973a9b679a51c379e9d9cc259f10163` با workflow run `35208122251` موفق شد. `pnpm check` در GitHub گذشت، tag و Test prerelease ساخته شد و artifact immutable زیر ایجاد شد: `ghcr.io/farhaddgm/hero@sha256:f97ad06b60cac7717fcea8513b9bc05b9b5265a1fba58d800129cc3f6901249d`.
- نخستین Test verification یک ایراد syntax fail-closed در regex workflow را آشکار کرد. اصلاح workflow در commit `7be8f0139b18560fcc2c7a85b0ae3bf9106d2615` با `389 pass / 0 fail` تأیید و push شد؛ سپس workflow Test run `35208713807` همان artifact و commit را pull و labelهای version/revision را با موفقیت تطبیق داد.
- محیط Test هنوز عمداً روی release قبلی `1.1.2`، commit `0caa40b49b74aad13e2a0c78545f6c0eb28262ea` و digest `ghcr.io/farhaddgm/hero@sha256:641e6c75b5f871e87053cf2d959fe250a20067b8ecc7fe0571e15345f31c0d10` باقی مانده است؛ `/health`، `/ready` و `/build-info` سالم‌اند. promotion به فایل runtime خارج از repository نیاز دارد و تا زمان تکمیل تنظیمات، انجام نشده است.
- در runtime Test فقط `HERO_ENABLE_REAL_PROVIDERS=true`، authorization active، شناسهٔ `AUTH-AI-TEST-001` و Global Stop خاموش قابل مشاهده بود؛ فیلدهای scope اجباریِ Project/Step/Version/Provider/Model/Role/cap/expiry غایب‌اند. بنابراین runtime policy قابل‌خواندن نیست و dispatch به‌درستی fail-closed می‌ماند.
- شمارش PostgreSQL Test برای `projects`، `ai_providers`، `ai_models`، `ai_credentials` و `ai_invocations` همگی صفر بود. Secret Store و مقدار API key نه خوانده، نه چاپ و نه تغییر داده شد. تا ایجاد Project/Profile/Binding توسط Human Owner، هر دو سناریوی زنده قبل از dispatch متوقف می‌شوند و هیچ هزینه‌ای رخ نمی‌دهد.

## علت‌های رخداد قبلی و کنترل دائمی

| علت | کنترل جدید |
|---|---|
| `git push` روی شاخهٔ عقب‌افتاده و non-fast-forward | پیش‌پرواز نسخه قبل از build، بررسی worktree/commit/tag و توقف صریح؛ هرگز force push نکنید |
| ورود ناموفق GHCR و پیام `denied` | `check-ghcr-access.sh` قبل از promotion؛ PAT classic فقط با `read:packages` برای pull و `packages:write` در GitHub Actions |
| اجرای verify بدون digest (`IMAGE_REF` خالی) | تمام ابزارها digest کامل را اجباری می‌کنند؛ tag یا مقدار خالی رد می‌شود |
| اشتباه گرفتن Basic Auth با حساب انسانی | health/readiness و `/build-info` جدا از login انسانی بررسی می‌شوند؛ credential چاپ یا ذخیره نمی‌شود |
| تغییر env بدون نقطهٔ بازگشت امن | فقط metadata غیرحساس ذخیره می‌شود؛ env با فایل موقت mode `0600` و rename اتمیک عوض می‌شود |
| خراب ماندن Test بعد از recreate | readiness، image identity، `/build-info` و route smoke اجرا می‌شود؛ شکست بعد از swap، rollback خودکار را فعال می‌کند |

## قرارداد انتشار

هر candidate باید یک `hero-release-manifest.json` داشته باشد. فیلدهای اجباری آن `releaseVersion`، `commitSha`، `artifact`، `environment=test` و `createdAt` هستند. `artifact` دقیقاً باید به شکل زیر باشد:

```text
ghcr.io/farhaddgm/hero@sha256:<64 حرف hex کوچک>
```

manifest فقط metadata انتشار دارد و نباید Secret، password، token یا API key داشته باشد. GitHub Actions آن را کنار `hero-release-evidence.txt` به‌عنوان artifact نگه می‌دارد.

## مسیر استاندارد از تغییر تا Test

۱. تغییرات را روی شاخهٔ مجاز commit کنید و قبل از release مطمئن شوید worktree تمیز است.

۲. در GitHub، workflow دستی `Hero Release Candidate` را اجرا کنید و `release_version` معتبر SemVer وارد کنید. workflow با `pnpm check`، preflight، build و push image اجرا می‌شود؛ trigger خودکار push عمداً حذف شده است.

۳. پس از موفقیت، از artifact workflow فایل `hero-release-manifest.json` را دانلود کنید. digest داخل آن را کپی کنید؛ از tag یا `$GITHUB_SHA` به‌عنوان image استفاده نکنید.

برای workflow اختیاری `Hero Test Environment`، سه مقدار همان manifest را وارد کنید: `release_version`، `artifact_digest` و `commit_sha`. workflow با همان commit checkout می‌کند، digest را pull می‌کند، label نسخه و revision داخل image را با دو مقدار ورودی تطبیق می‌دهد و artifact مستقلِ Test evidence می‌سازد؛ هیچ rebuild یا tag متغیری انجام نمی‌دهد.

۴. روی سرور Test، ابتدا دسترسی GHCR را بدون تغییر سرویس بررسی کنید:

```bash
cd /opt/hero
sudo bash tools/check-ghcr-access.sh ghcr.io/farhaddgm/hero@sha256:<digest>
```

اگر `denied` دیدید، از GitHub یک PAT classic با دسترسی `read:packages` بسازید، فقط روی همان سرور با `docker login ghcr.io -u <github-username>` وارد کنید و token را در prompt وارد کنید. token را در چت، فایل پروژه یا command history قرار ندهید. برای build/push، GitHub Actions از `GITHUB_TOKEN` با `packages: write` استفاده می‌کند و نیاز به token سرور ندارد.

۵. قبل از هر تغییر، Compose Test را validate کنید:

```bash
sudo docker compose --project-name hero-test --env-file /etc/hero/hero-test.env --profile postgres config --quiet
```

اگر `HERO_IMAGE` فعلی هنوز tag یا SHA خام است، promotion عمداً متوقف می‌شود؛ ابتدا همان نسخهٔ فعلی را به digest کامل و قابل‌بررسی تبدیل کنید. این شرط باعث می‌شود rollback واقعاً به یک artifact ثابت برگردد.

۶. promotion را با manifest اجرا کنید تا نسخه، commit و digest با هم کنترل شوند:

```bash
sudo HERO_TEST_ENV_FILE=/etc/hero/hero-test.env \
  HERO_TEST_RELEASE_STATE_FILE=/etc/hero/hero-test.release-state \
  bash tools/promote-test-immutable.sh --manifest /opt/hero/hero-release-manifest.json
```

در صورت نیاز می‌توان digest را مستقیم داد، ولی استفاده از manifest توصیه می‌شود:

```bash
sudo bash tools/promote-test-immutable.sh \
  ghcr.io/farhaddgm/hero@sha256:<digest>
```

۷. ابزار ابتدا image قبلی را نیز pull و قابل‌بازیابی بودن آن را بررسی می‌کند، سپس فقط `control-plane` پروژهٔ `hero-test` را با `--no-deps --no-build --force-recreate` بازسازی می‌کند. PostgreSQL، volume، Secret و Production لمس نمی‌شوند. اگر readiness، image یا `/build-info` ناسازگار باشد، env metadata قبلی برمی‌گردد و recreate قبلی به‌صورت خودکار تلاش می‌شود.

۸. بعد از موفقیت، smoke read-only را اجرا کنید:

```bash
sudo bash tools/verify-test-release.sh --manifest /opt/hero/hero-release-manifest.json
```

`/health` و `/ready` باید ۲۰۰ باشند، image container باید همان digest باشد، `/build-info` باید digest یکسان و قابلیت‌های `smartTesterRepositoryContext=read-only/1.0.0` و `walkthroughGuideRepositoryContext=read-only/1.0.0` را گزارش کند و routeهای Back Office بدون Basic Auth باید ۴۰۱ بمانند. این دو marker تضمین می‌کنند candidate منتشرشده شامل اتصال read-only هر دو مشاور است، نه فقط source workspace.

## بازیابی ساده

آخرین promotion موفق در state غیرحساس ثبت می‌شود. برای بازگشت به image قبلی:

```bash
sudo HERO_TEST_ENV_FILE=/etc/hero/hero-test.env \
  HERO_TEST_RELEASE_STATE_FILE=/etc/hero/hero-test.release-state \
  bash tools/rollback-test-immutable.sh
```

Rollback فقط وقتی انجام می‌شود که state وضعیت `promoted` داشته باشد، env با همان image ثبت‌شده برابر باشد و image قبلی digest کامل داشته باشد. پس از rollback، state به `rolled-back` می‌رود تا اجرای تصادفی دوبارهٔ همان عملیات ممکن نباشد. اگر state یا env دستی تغییر کرده باشد، ابتدا تشخیص انسانی لازم است؛ ابزار در این حالت fail-closed متوقف می‌شود.

## بررسی سلامت و هویت build

`/health` قرارداد قدیمی و پایدار سرویس است و فقط سلامت را می‌گوید. `/build-info` metadata غیرحساس release را می‌دهد:

```json
{
  "service": "hero-control-plane",
  "releaseVersion": "1.2.3",
  "sourceCommit": "0123456",
  "imageDigest": "ghcr.io/farhaddgm/hero@sha256:…",
  "serviceVersion": "0.1.0",
  "smartTesterRepositoryContext": "read-only/1.0.0",
  "walkthroughGuideRepositoryContext": "read-only/1.0.0"
}
```

این endpoint جایگزین احراز هویت انسانی نیست و نباید هیچ Secretی در آن افزوده شود.

## آزمون پذیرش نقش‌محور روی Test

`tools/run-test-acceptance.sh` همان image immutable Candidate را به‌صورت یک نمونهٔ یک‌بارمصرف با PostgreSQL موقت و شبکهٔ Docker داخلیِ بدون اینترنت اجرا می‌کند. این ابزار به containerها، volumeها، پورت‌ها و فایل env سرویس زندهٔ `hero-test` دست نمی‌زند، رمزی نمی‌پرسد و اعتبارنامه‌ای چاپ نمی‌کند. همهٔ اعتبارنامه‌ها موقت‌اند و پس از اجرا همراه همهٔ منابع پاک می‌شوند.

```bash
cd /opt/hero && git pull --ff-only
sudo bash tools/run-test-acceptance.sh ghcr.io/farhaddgm/hero@sha256:<64-hex>
```

اجرا دو مرحله دارد: `seed` با سه نقش Owner، Admin و Viewer همهٔ بسته‌های WP-04..WP-08 را می‌آزماید؛ سپس نمونه با `SIGKILL` کشته و دوباره راه‌اندازی می‌شود و `verify` پایداری و replay را بررسی می‌کند (از جمله `interrupted` شدن اجرای نیمه‌کاره). حکم نهایی فقط بر چک‌های `BO-043..BO-092` است؛ چک‌های گام‌های دیگر به‌صورت `FINDING` گزارش می‌شوند. نتیجهٔ redacted در `/var/lib/hero-acceptance/acceptance-<run>.json` می‌ماند.

## شواهد اجباری هر release

- نسخهٔ SemVer و commit دقیق؛
- manifest و digest کامل؛
- نتیجهٔ `pnpm check` در workflow؛
- نتیجهٔ `check-ghcr-access.sh`؛
- نام Compose project و محیط (`hero-test`/`test`)؛
- health، readiness، `/build-info` و smoke routeها؛
- state promotion یا rollback و timestamp؛
- اعلام صریح اینکه Production، Pilot، Provider زنده و Secret تغییر نکرده‌اند.

## مرزهای ممنوع

این runbook هیچ مسیر production، تغییر Secret، مصرف Provider زنده، هزینهٔ خارجی، force push، rebuild در Production یا حذف volume/database ارائه نمی‌کند. هرکدام مجوز و سند مستقل لازم دارند.
