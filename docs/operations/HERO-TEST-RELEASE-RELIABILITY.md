# پایایی انتشار Hero در محیط Test

- Document ID: `HERO-OPS-HERO-TEST-RELEASE-RELIABILITY`
- Version: `1.0.0`
- Status: `active`
- Owner: `hero-operations`
- Scope: `hero`
- Review: بعد از هر انتشار Test و هر رخداد شکست انتشار

## هدف

این runbook مسیر انتشار را از یک «فرمان دستی با چند مقدار مبهم» به یک زنجیرهٔ قابل‌ردیابی تبدیل می‌کند: نسخه و commit از ابتدا مشخص‌اند، image فقط با digest غیرقابل‌تغییر جابه‌جا می‌شود، manifest مرجع واحد است، backup هیچ Secretی ندارد و در شکست پس از تغییر، rollback خودکار انجام می‌شود.

## آخرین اجرای واقعی — ۲۰۲۶-۰۹-۱۷

- ممیزی source روی branch `codex/test-release-reliability-20260916` انجام شد و commit مرتبط `9b0b45836dd47d650907923cbfe1a33b5ae42d9c` با `pnpm check` برابر `389 pass / 0 fail` تأیید شد؛ build محلی Docker نیز verification را با ۳۸۹ تست موفق گذراند، اما چون publish آن به GHCR مجاز نشد، release artifact محسوب نمی‌شود.
- محیط Test عمداً روی release قبلی `1.1.2`، commit `0caa40b49b74aad13e2a0c78545f6c0eb28262ea` و digest `ghcr.io/farhaddgm/hero@sha256:641e6c75b5f871e87053cf2d959fe250a20067b8ecc7fe0571e15345f31c0d10` باقی ماند؛ `/health`، `/ready` و `/build-info` سالم و منطبق بودند.
- GHCR preflight برای artifact فعلی PASS شد، اما publish candidate جدید با خطای `permission_denied` و نبود scope لازم token متوقف شد. در نتیجه برای candidate جدید هیچ tag، manifest یا promotion ساخته/اعمال نشد.
- authorization Test فعال و منطبق است (`AUTH-AI-TEST-001`، Project `hero`، OpenAI، مدل `gpt-5.6-luna`، Role `analyst`، Global Stop خاموش، expiry `2027-02-23T23:59:59Z`). Secret Store reference در Test فقط به‌صورت metadata با state `configured` و version `6` مشاهده شد و مقدار Secret خوانده یا چاپ نشد.
- snapshot AI در PostgreSQL Test Provider زندهٔ OpenAI را دارد، اما برای Project `hero` هیچ Profile فعال و هیچ Role Binding ندارد؛ بنابراین هر دو live scenario قبل از dispatch fail-closed متوقف شدند و هیچ تماس OpenAI یا هزینه‌ای رخ نداد.

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

`/health` و `/ready` باید ۲۰۰ باشند، image container باید همان digest باشد، `/build-info` باید digest یکسان گزارش کند و routeهای Back Office بدون Basic Auth باید ۴۰۱ بمانند.

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
  "serviceVersion": "0.1.0"
}
```

این endpoint جایگزین احراز هویت انسانی نیست و نباید هیچ Secretی در آن افزوده شود.

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
