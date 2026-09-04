# شناسنامهٔ Candidate Hero — ۲۰۲۶-۰۹-۰۴

این سند شناسنامهٔ قابل‌بازبینیِ source و candidate فعلی است؛ به‌معنی tag یا انتشار نیست و هیچ Secretی در آن وجود ندارد.

## منبع

| مورد | مقدار |
|---|---|
| branch | `codex/hero-001-project-charter` |
| source snapshot | base commit `34940cb` + owner-handoff contract و build-context hardening در worktree؛ به‌علت read-only بودن Git index، Commit جدید ثبت نشد |
| roadmap validator commit | `923a0f3` — `chore: validate roadmap audit ledgers` |
| deployment-contract commit | `2b3d5b8` — `chore: enforce deployment contract` |
| implementation commit | `cdc44bc` — `feat: harden Hero backoffice and audit projections` |
| evidence chain | `cce6aaa`، `0aaeaa3`، `de4b4c5`، `79b0977` و `e865e5b` — ثبت verification، baseline، artifact و runtime audit |
| commit پایه | `26cfe549924b0db63eef71db25aeb8dfb5beb4d7` |
| remote branch pointer | `c445609b301807df1bb50124a92afa31c500a145`؛ از candidate محلی عقب‌تر است |
| وضعیت | candidate از snapshot کنترل‌شدهٔ worktree ساخته و بررسی شد؛ فقط به Test مستقل deploy شده؛ Commit جدید و push انجام نشده و Production تغییری نکرده است |
| Git در workspace | commit محلی موفق؛ push هنوز انجام نشده |
| مرز | فقط repository Hero؛ بدون تغییر اپلیکیشن‌های دیگر |

## artifact کاندیدای تمیز

| مورد | مقدار |
|---|---|
| image tag محلی | `hero-control-plane:candidate-52c53f07cf41` |
| image digest | `sha256:f846ca3da45b0984af8243704681278484670720e4381ef28cda06a0931d88e7` |
| مبنای build | build استاندارد Docker از snapshot فعلی worktree؛ `.dockerignore` فایل‌های Secret و `compose.test.yaml` را از context حذف کرد |
| نتیجهٔ verify داخل build | `pnpm check`: ۲۳۹/۲۳۹ تست موفق؛ Build: ۱۴۱ ماژول و ۷ فایل JSON |
| parity با source | hash هر پنج فایل fingerprint‌شده برابر است |
| کنترل roadmap | `OPEN-50=50` و `NEXT-100=100`؛ ستون‌های الزامی و cross-referenceها معتبرند |
| runtime smoke مستقل | `candidate-52c53f07cf41` در کانتینر موقت با پورت loopback `43102`؛ `/health` و `/backoffice` برابر ۲۰۰، HTML فارسی/IRANSans/noindex و بخش‌های تنظیمات/راهنما حاضر؛ `compose.test.yaml` داخل image نبود؛ پس از تست حذف شد |
| وضعیت انتشار | همان digest فقط به stack ایزولهٔ `hero-test` deploy شده؛ به Production deploy نشده است |

## شواهد verification

- `pnpm check`: ۲۳۹/۲۳۹ تست موفق؛
- Build: ۱۴۱ ماژول و ۷ فایل JSON موفق؛
- Governance: ۲۱ گام نسخه‌مند موفق؛
- clean-room: ۲۴۱ فایل، بدون خطا؛
- `git diff --check`: موفق؛
- Test مستقل: health/readiness، PostgreSQL/migration، preflight، احراز هویت، hydration بعد از restart و isolation موفق؛ fingerprint پنج فایل اصلی با candidate برابر است.

## fingerprint منبع فعلی

```text
a45a8c1d908af1af3b6736569e77974540da27ccbcb9c7dbdc0849bbd090e9c1  apps/control-plane/src/backoffice-view.mjs
ab452ebf24317d019015ebb3982a43a0313461adad2f7021fd1e8e8173bc5ccc  apps/control-plane/src/dashboard-service.mjs
81b565f44f9d7fa17b042e803c2c22134adc2f4fe141ecd4ca991fdafeb2b575  apps/control-plane/src/server.mjs
073e0d4a5031d98f55533db359fe6ab685d1b4dfed5276eb1b5a505cdb86a1ba  packages/domain/src/operational-diagnostics.mjs
fa16ce5ef898670bb138d17554290626d4f6005753ccfa3b38f104a6ccb21f15  packages/domain/src/planner.mjs
```

## وضعیت image فعلی Test

محیط `hero-test` سالم است و اکنون digest `candidate-52c53f07cf41` با همان Secret/env فعلی روی آن deploy شده است؛ fingerprint هر پنج فایل اصلی با candidate برابر است و preflight، health، readiness، احراز هویت و restart دوباره موفق شدند. این artifact فقط در Test است و نباید بدون گیت‌های بعدی به Production promotion شود.

## ممیزی runtime آخر — ۲۰۲۶-۰۹-۰۵

- Local Hero: `/health=200`، `/ready=200` و `/backoffice` بدون احراز هویت `401`؛
- Test داخلی: `/health=200`، `/ready=200`، Back Office بدون احراز هویت `401` و با credential runtime `200`؛
- دامنهٔ Test: TLS معتبر (`verify=0`) و Back Office بدون احراز هویت `401`؛
- Production: HTTP `/backoffice=308` به HTTPS و HTTPS بدون احراز هویت `401`؛
- هیچ stack موجودی در این ممیزی restart یا جایگزین نشد؛ فقط کانتینر موقت candidate smoke شد و حذف شد.

## گیت‌های قبل از promotion

۱. snapshot candidate ساخته و بررسی شد؛ برای CI ابتدا باید همین تغییرات در یک Commit قابل‌ارجاع ثبت شود و سپس tag/digest دقیق بالا به آن bind شود؛

۲. اجرای `pnpm check` روی همان commit و ثبت SHA، image digest و artifact؛

۳. deploy همان artifact به `hero-test` و تأیید hash/health/auth/persistence انجام شد؛

۴. ثبت rollback و recovery؛

۵. برای Production، مجوز مستقل `production-deploy` و تأیید Basic Auth/Caddy لازم است؛ candidate فعلاً فقط در Test است.
