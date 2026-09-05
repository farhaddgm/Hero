# شناسنامهٔ Candidate Hero — ۲۰۲۶-۰۹-۰۴

این سند شناسنامهٔ قابل‌بازبینیِ source و candidate فعلی است؛ به‌معنی tag یا انتشار نیست و هیچ Secretی در آن وجود ندارد.

## ممیزی جاری — ۲۰۲۶-۰۹-۰۵

پس از candidate پایهٔ `c1a1430`، چهار برچسب وضعیت roadmap، راهنمای ۳۹ مفهوم و assertionهای مربوط به آن‌ها در Commit نهایی `031ef18` ثبت شدند. image runtime جاری `hero-test-control-plane:latest` با artifact tag `hero-control-plane:candidate-031ef18` و digest `sha256:a94252111f793331e3511c528a57224aa9a0fec1669392d6a0a2284e9462033e` فقط در `hero-test` مستقر است؛ Production تغییری نکرده است.

## منبع

| مورد | مقدار |
|---|---|
| branch | `codex/hero-001-project-charter` |
| source snapshot | Commit نهایی `031ef18` شامل سه اصلاح source/test و هشت سند roadmap/operations؛ `compose.test.yaml` خارج از artifact و untracked باقی مانده است |
| roadmap validator commit | `923a0f3` — `chore: validate roadmap audit ledgers` |
| deployment-contract commit | `2b3d5b8` — `chore: enforce deployment contract` |
| implementation commit | `cdc44bc` — `feat: harden Hero backoffice and audit projections` |
| evidence chain | `cce6aaa`، `0aaeaa3`، `de4b4c5`، `79b0977` و `e865e5b` — ثبت verification، baseline، artifact و runtime audit |
| commit پایه | `26cfe549924b0db63eef71db25aeb8dfb5beb4d7` |
| remote branch pointer | `c445609b301807df1bb50124a92afa31c500a145`؛ از candidate محلی عقب‌تر است |
| وضعیت | candidate نهایی از Commit `031ef18` ساخته شد؛ همان artifact فقط به Test مستقل deploy شده؛ push انجام نشده و Production تغییری نکرده است |
| Git در workspace | سه اصلاح source/test و هشت سند ثبت شده‌اند؛ فقط `compose.test.yaml` ناشناخته و untracked است و stage/commit نشده |
| مرز | فقط repository Hero؛ بدون تغییر اپلیکیشن‌های دیگر |

## artifact کاندیدای تمیز

| مورد | مقدار |
|---|---|
| image tag پایه | `hero-control-plane:candidate-c1a1430` |
| image digest پایه | `sha256:e662f73725db07e7a1080922ac549940a417f4dba97418c5e6bd12e61fbbd4c2` |
| image runtime جاری Test | `hero-control-plane:candidate-031ef18` (alias: `hero-test-control-plane:latest`) — `sha256:a94252111f793331e3511c528a57224aa9a0fec1669392d6a0a2284e9462033e` |
| مبنای build | build استاندارد Docker از Commit `c1a1430`؛ `.dockerignore` فایل‌های Secret و `compose.test.yaml` را از context حذف کرد |
| نتیجهٔ verify داخل build | `pnpm check`: ۲۳۹/۲۳۹ تست موفق؛ Build: ۱۴۲ ماژول و ۷ فایل JSON |
| parity با source | hash هر پنج فایل fingerprint‌شده برابر است |
| کنترل roadmap | `OPEN-50=50` و `NEXT-100=100`؛ ستون‌های الزامی و cross-referenceها معتبرند |
| runtime smoke مستقل | artifact `candidate-031ef18` در Test با پورت loopback `43101`؛ `/health=200`، `/ready=200`، Back Office بدون auth=`401` و با auth=`200`، payload شامل `OPEN-50` با ۵۰ ردیف و گیت‌های مالک؛ HTML فارسی/IRANSans/noindex و راهنمای ۳۹ مفهوم حاضر؛ `compose.test.yaml` داخل image نبود |
| وضعیت انتشار | همان digest فقط به stack ایزولهٔ `hero-test` deploy شده؛ به Production deploy نشده است |

## شواهد verification

- `pnpm check`: ۲۳۹/۲۳۹ تست موفق؛
- Build: ۱۴۲ ماژول و ۷ فایل JSON موفق؛
- Governance: ۲۱ گام نسخه‌مند موفق؛
- clean-room داخل build: ۲۴۴ فایل؛ `check:isolation` روی workspace جاری: ۲۴۵ فایل، هر دو بدون خطا؛
- `git diff --check`: موفق؛
- Test مستقل: health/readiness، PostgreSQL/migration، preflight، احراز هویت، hydration بعد از restart و isolation موفق؛ fingerprint پنج فایل اصلی با candidate برابر است.
- Back Office Test با احراز هویت: page/data/events همگی `۲۰۰`؛ ۱۱ تیم با جزئیات قرارداد/اصول/ورودی/خروجی، ۸ Role، ۶ route، ۵ دستهٔ تنظیمات، دفتر `OPEN-50` با ۵۰ ردیف و ۱۴ اقدام مالک/ادمین؛ markerهای `تنظیمات کل Hero`، `چطور این پنل را بخوانیم`، `IRANSans` و `lang="fa"` حاضرند.
- کنترل امنیتی HTTP Test: Back Office بدون auth=`۴۰۱`، با auth=`۲۰۰`، POST روی مسیر read-only=`۴۰۵` با `Allow: GET`، CSP و `X-Robots-Tag` حاضر، route ناشناخته=`۴۰۴` و API بدون auth=`۴۰۱`؛ مرور دستی Caddy/شبکه هنوز جداست.
- پوشش read-only Test: ۱۷ مسیر احراز‌شده (۳ مسیر Back Office با Basic Auth و ۱۴ مسیر API با نشست Owner) همگی `۲۰۰`؛ ۱۱ تیم و diagnostics کامل حاضرند؛ هیچ mutation یا Provider واقعی اجرا نشد.

## fingerprint منبع فعلی

```text
0d1302b049f4eab802b3247766b29ff40725561bd240dbb6b3d5c651ab4f0732  apps/control-plane/src/backoffice-view.mjs
d470213f2e00e5a0330653c68c062c860fc8344dc94025e87338a5ede382d927  apps/control-plane/src/dashboard-service.mjs
81b565f44f9d7fa17b042e803c2c22134adc2f4fe141ecd4ca991fdafeb2b575  apps/control-plane/src/server.mjs
073e0d4a5031d98f55533db359fe6ab685d1b4dfed5276eb1b5a505cdb86a1ba  packages/domain/src/operational-diagnostics.mjs
fa16ce5ef898670bb138d17554290626d4f6005753ccfa3b38f104a6ccb21f15  packages/domain/src/planner.mjs
```

## وضعیت image فعلی Test

محیط `hero-test` سالم است و اکنون artifact `hero-control-plane:candidate-031ef18` با digest `sha256:a94252111f793331e3511c528a57224aa9a0fec1669392d6a0a2284e9462033e` و همان Secret/env فعلی روی آن deploy شده است؛ fingerprint فایل‌های اصلی با Commit `031ef18` برابر است و preflight، health، readiness، احراز هویت و restart دوباره موفق شدند. این artifact فقط در Test است و تا تکمیل گیت‌های recovery، Pilot و production-deploy نباید promotion شود.

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

۳. deploy همان artifact به `hero-test` و تأیید hash/health/auth/persistence انجام شد؛

۴. rollback کنترل‌پلیس در Test آزموده شد؛ recovery واقعی از backup/checksum هنوز باید ثبت و آزموده شود؛

۵. برای Production، مجوز مستقل `production-deploy` و تأیید Basic Auth/Caddy لازم است؛ candidate فعلاً فقط در Test است.
