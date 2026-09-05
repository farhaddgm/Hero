# شناسنامهٔ Candidate Hero — ۲۰۲۶-۰۹-۰۴

این سند شناسنامهٔ قابل‌بازبینیِ source و candidate فعلی است؛ به‌معنی tag یا انتشار نیست و هیچ Secretی در آن وجود ندارد.

## ممیزی آخرین اصلاح — ۲۰۲۶-۰۹-۰۵

Commit `c804a5a` وضعیت واقعی persistence را به projection امن Back Office اضافه کرد و guard اجباری PostgreSQL، اصلاح empty-state Benchmark و تست جامع ۵۸ مسیر را حفظ کرد. artifact `hero-control-plane:candidate-c804a5a` با digest `sha256:2d25ca11293a2f017bc8d62553da7ac7dbfb3037d664b2e24161e8356604994b` فقط روی `hero-test` مستقر است؛ هر دو کانتینر healthy و bind روی `127.0.0.1:43101` هستند. smoke-test فعلی `/health=200`، `/ready=200` و Back Office احراز‌شده=`200` است؛ پنل صریحاً `runtime=in-memory` و `readiness=development-or-optional` را نشان می‌دهد. preflight سخت‌گیرانهٔ Test هنوز دو مقدار `HERO_POSTGRES_URL` و `HERO_POSTGRES_PASSWORD` را خالی تشخیص می‌دهد؛ تا ورود آن‌ها از Secret Store، persistence و مسیرهای audit runtime تأییدشده محسوب نمی‌شوند.

## سابقهٔ candidate قبلی و ممیزی UI — ۲۰۲۶-۰۹-۰۵

پس از candidate پایهٔ `c1a1430`، چهار برچسب وضعیت roadmap، راهنمای ۳۹ مفهوم، assertionهای UI و کنترل parity در Commit نهایی `985ab8c` ثبت شدند. image runtime جاری `hero-test-control-plane:latest` با artifact tag `hero-control-plane:candidate-985ab8c` و digest `sha256:590efbccac4d7b20df03d4ad14d230003ff646821bef91df9712063648225135` فقط در `hero-test` مستقر است؛ Production تغییری نکرده است.

## منبع

| مورد | مقدار |
|---|---|
| branch | `codex/hero-001-project-charter` |
| source snapshot | Commit کاربردی `c804a5a` شامل وضعیت runtime persistence، guard persistence، اصلاح empty-state Benchmark و تست جامع route؛ `compose.test.yaml` خارج از artifact و untracked باقی مانده است |
| roadmap validator commit | `923a0f3` — `chore: validate roadmap audit ledgers` |
| deployment-contract commit | `2b3d5b8` — `chore: enforce deployment contract` |
| implementation commit | `cdc44bc` — `feat: harden Hero backoffice and audit projections` |
| evidence chain | `cce6aaa`، `0aaeaa3`، `de4b4c5`، `79b0977` و `e865e5b` — ثبت verification، baseline، artifact و runtime audit |
| commit پایه | `26cfe549924b0db63eef71db25aeb8dfb5beb4d7` |
| remote branch pointer | `c445609b301807df1bb50124a92afa31c500a145`؛ از candidate محلی عقب‌تر است |
| وضعیت | candidate جاری از Commit `c804a5a` ساخته شد؛ همان artifact فقط به Test مستقل deploy شده؛ push انجام نشده و Production تغییری نکرده است |
| Git در workspace | سه اصلاح source/test و هشت سند ثبت شده‌اند؛ فقط `compose.test.yaml` ناشناخته و untracked است و stage/commit نشده |
| مرز | فقط repository Hero؛ بدون تغییر اپلیکیشن‌های دیگر |

## artifact کاندیدای تمیز

| مورد | مقدار |
|---|---|
| image tag پایه | `hero-control-plane:candidate-c1a1430` |
| image digest پایه | `sha256:e662f73725db07e7a1080922ac549940a417f4dba97418c5e6bd12e61fbbd4c2` |
| image runtime جاری Test | `hero-control-plane:candidate-c804a5a` (alias: `hero-test-control-plane:latest`) — `sha256:2d25ca11293a2f017bc8d62553da7ac7dbfb3037d664b2e24161e8356604994b` |
| مبنای build | build استاندارد Docker از Commit `c804a5a`؛ `.dockerignore` فایل‌های Secret و `compose.test.yaml` را از context حذف کرد |
| نتیجهٔ verify داخل build | `pnpm check`: ۲۴۱/۲۴۱ تست موفق؛ Build: ۱۴۳ ماژول و ۷ فایل JSON |
| parity با source | hash پنج فایل fingerprint‌شده با source Commit `c804a5a` برابر است |
| کنترل roadmap | `OPEN-50=50` و `NEXT-100=100`؛ ستون‌های الزامی و cross-referenceها معتبرند |
| وضعیت دفتر جاری | نسخهٔ `2026-09-05`؛ `pending=39`، `blocked=9`، `evidence=2`؛ ردیف‌های persistence که فقط شاهد قبلی دارند برای candidate جاری نیازمند تکرار علامت‌گذاری شده‌اند |
| runtime smoke مستقل | artifact `candidate-c804a5a` در Test با پورت loopback `43101`؛ `/health=200`، `/ready=200` و Back Office با auth=`200`؛ `/backoffice-data` شامل `OPEN-50` با ۵۰ ردیف، `runtime=in-memory` و `readiness=development-or-optional`؛ HTML فارسی/IRANSans/noindex و راهنمای ۳۹ مفهوم حاضر؛ strict preflight دو مقدار PostgreSQL را missing تشخیص داد و persistence runtime هنوز تأیید نشده است |
| وضعیت انتشار | همان digest فقط به stack ایزولهٔ `hero-test` deploy شده؛ به Production deploy نشده است |

## شواهد verification

- `pnpm check`: ۲۴۱/۲۴۱ تست موفق؛
- Build: ۱۴۳ ماژول و ۷ فایل JSON موفق؛
- Governance: ۲۱ گام نسخه‌مند موفق؛
- clean-room داخل build: ۲۴۵ فایل؛ `check:isolation` روی workspace جاری: ۲۴۵ فایل، هر دو بدون خطا؛
- `git diff --check`: موفق؛
- شواهد persistence/migration/hydration کامل مربوط به candidate قبلی و env کامل Test است؛ candidate جاری تا ورود دو Secret PostgreSQL فقط health و UI را تأیید کرده و persistence نهایی ندارد.
- Back Office Test با احراز هویت: page/data/events همگی `۲۰۰`؛ ۱۱ تیم با جزئیات قرارداد/اصول/ورودی/خروجی، ۸ Role، ۶ route، ۵ دستهٔ تنظیمات، دفتر `OPEN-50` با ۵۰ ردیف و ۱۴ اقدام مالک/ادمین؛ markerهای `تنظیمات کل Hero`، `چطور این پنل را بخوانیم`، `IRANSans` و `lang="fa"` حاضرند.
- کنترل امنیتی HTTP Test: Back Office بدون auth=`۴۰۱`، با auth=`۲۰۰`، POST روی مسیر read-only=`۴۰۵` با `Allow: GET`، CSP و `X-Robots-Tag` حاضر، route ناشناخته=`۴۰۴` و API بدون auth=`۴۰۱`؛ مرور دستی Caddy/شبکه هنوز جداست.
- پوشش read-only Test: ۱۷ مسیر احراز‌شده (۳ مسیر Back Office با Basic Auth و ۱۴ مسیر API با نشست Owner) همگی `۲۰۰`؛ ۱۱ تیم و diagnostics کامل حاضرند؛ هیچ mutation یا Provider واقعی اجرا نشد.
- ممیزی جامع GET قبلی در تست تکرارپذیرِ in-process با persistence تزریقی: ۵۸ مسیر شامل contractها، health/readiness، Back Office، APIهای read-model و مسیرهای جزئیات Team با احراز هویت مناسب بررسی شدند؛ همه `2xx` بودند. در runtime فعلی، smoke مسیرهای اصلی موفق است اما دو مسیر audit تا تنظیم PostgreSQL عمداً `503` می‌مانند؛ هیچ mutation یا Provider واقعی اجرا نشد و Secret/token ثبت نشد.

## fingerprint منبع فعلی

```text
0d1302b049f4eab802b3247766b29ff40725561bd240dbb6b3d5c651ab4f0732  apps/control-plane/src/backoffice-view.mjs
85331fc2e07a1fbbadd6a5e16e4b606b2062cd8d2903cad2be2e5023998dabe2  apps/control-plane/src/dashboard-service.mjs
9b5793c3c6ac8ede50a505430a61009dafba2469fd61079264992d2202c097ac  apps/control-plane/src/server.mjs
073e0d4a5031d98f55533db359fe6ab685d1b4dfed5276eb1b5a505cdb86a1ba  packages/domain/src/operational-diagnostics.mjs
fa16ce5ef898670bb138d17554290626d4f6005753ccfa3b38f104a6ccb21f15  packages/domain/src/planner.mjs
```

## وضعیت image فعلی Test

artifact جاری `hero-control-plane:candidate-c804a5a` با digest `sha256:2d25ca11293a2f017bc8d62553da7ac7dbfb3037d664b2e24161e8356604994b` فقط روی Control Plane محیط `hero-test` deploy شده است؛ کانتینرها healthy و bind روی `127.0.0.1:43101` است، اما پنل و preflight سخت‌گیرانه به‌ترتیب runtime را `in-memory`/اختیاری و دو Secret PostgreSQL را missing گزارش می‌کنند. این artifact فقط در Test است و تا تکمیل گیت‌های recovery، Pilot و production-deploy نباید promotion شود.

## ممیزی runtime آخر — ۲۰۲۶-۰۹-۰۵

- Local Hero: `/health=200`، `/ready=200` و `/backoffice` بدون احراز هویت `401`؛
- Test داخلی: `/health=200`، `/ready=200`، Back Office بدون احراز هویت `401` و با credential runtime `200`؛
- دامنهٔ Test: TLS معتبر (`verify=0`)، Back Office بدون احراز هویت `401` و با credential runtime `200`؛
- Production: HTTP `/backoffice=308` به HTTPS و HTTPS بدون احراز هویت `401`؛
- stack مستقل Test با همین candidate جایگزین و سپس restart شد؛ PostgreSQL و volume حفظ شدند؛ کانتینر rollback قبلی متوقف و محفوظ است؛ کانتینر موقت smoke پس از تست حذف شد.
- مالکیت runtime: `hero-test-control-plane-1` با `compose.yaml` مدیریت می‌شود؛ project/service label برابر `hero-test/control-plane`، volume `hero-test_hero-data` و network `hero-test_hero-private` تأیید شد.

## گیت‌های قبل از promotion

۱. Commit candidate ثبت و بررسی شد؛ برای CI باید tag/digest دقیق بالا به همین Commit bind شود؛

۲. اجرای `pnpm check` روی همان commit و ثبت SHA، image digest و artifact؛

۳. deploy همان artifact به `hero-test` و تأیید hash/health/auth/UI انجام شد؛ تأیید persistence پس از تنظیم دو Secret PostgreSQL باقی است؛

۴. rollback کنترل‌پلیس در Test آزموده شد؛ recovery واقعی از backup/checksum هنوز باید ثبت و آزموده شود؛

۵. برای Production، مجوز مستقل `production-deploy` و تأیید Basic Auth/Caddy لازم است؛ candidate فعلاً فقط در Test است.
