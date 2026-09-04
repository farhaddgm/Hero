# شناسنامهٔ Candidate Hero — ۲۰۲۶-۰۹-۰۴

این سند شناسنامهٔ قابل‌بازبینیِ source و candidate فعلی است؛ به‌معنی tag یا انتشار نیست و هیچ Secretی در آن وجود ندارد.

## منبع

| مورد | مقدار |
|---|---|
| branch | `codex/hero-001-project-charter` |
| candidate commit محلی | `2b3d5b8` — `chore: enforce deployment contract` |
| implementation commit | `cdc44bc` — `feat: harden Hero backoffice and audit projections` |
| evidence chain | `cce6aaa`، `0aaeaa3`، `de4b4c5` و `79b0977` — ثبت verification، baseline و artifact |
| commit پایه | `26cfe549924b0db63eef71db25aeb8dfb5beb4d7` |
| remote branch pointer | `c445609b301807df1bb50124a92afa31c500a145`؛ از candidate محلی عقب‌تر است |
| وضعیت | candidate محلی commit شده؛ push و انتشار انجام نشده |
| Git در workspace | commit محلی موفق؛ push هنوز انجام نشده |
| مرز | فقط repository Hero؛ بدون تغییر اپلیکیشن‌های دیگر |

## artifact کاندیدای تمیز

| مورد | مقدار |
|---|---|
| image tag محلی | `hero-control-plane:candidate-2b3d5b8` |
| image digest | `sha256:a63abdb1f5b04b847c95cfa4a598b2cead8d3f4a09bd3b6987c1a3ce122a0db1` |
| مبنای build | archive از HEAD commit‌شدهٔ `2b3d5b8`؛ فایل‌های خارج از commit وارد build نشدند |
| نتیجهٔ verify داخل build | `pnpm check`: ۲۳۹/۲۳۹ تست موفق؛ Build: ۱۳۹ ماژول و ۷ فایل JSON |
| parity با source | hash هر پنج فایل fingerprint‌شده برابر است |
| runtime smoke مستقل | کانتینر موقت با پورت loopback `43102`؛ `/health` و `/backoffice` برابر ۲۰۰، HTML فارسی/IRANSans/noindex؛ پس از تست حذف شد. احراز هویت runtime جداگانه روی Test تأیید شده است |
| وضعیت انتشار | فقط image محلی ساخته و بررسی شده؛ به Test یا Production deploy نشده است |

## شواهد verification

- `pnpm check`: ۲۳۹/۲۳۹ تست موفق؛
- Build: ۱۳۹ ماژول و ۷ فایل JSON موفق؛
- Governance: ۲۱ گام نسخه‌مند موفق؛
- clean-room: ۲۴۱ فایل، بدون خطا؛
- `git diff --check`: موفق؛
- Test مستقل: health/readiness، PostgreSQL/migration، احراز هویت، hydration بعد از restart و isolation موفق.

## fingerprint منبع فعلی

```text
a45a8c1d908af1af3b6736569e77974540da27ccbcb9c7dbdc0849bbd090e9c1  apps/control-plane/src/backoffice-view.mjs
ab452ebf24317d019015ebb3982a43a0313461adad2f7021fd1e8e8173bc5ccc  apps/control-plane/src/dashboard-service.mjs
81b565f44f9d7fa17b042e803c2c22134adc2f4fe141ecd4ca991fdafeb2b575  apps/control-plane/src/server.mjs
073e0d4a5031d98f55533db359fe6ab685d1b4dfed5276eb1b5a505cdb86a1ba  packages/domain/src/operational-diagnostics.mjs
fa16ce5ef898670bb138d17554290626d4f6005753ccfa3b38f104a6ccb21f15  packages/domain/src/planner.mjs
```

## وضعیت image فعلی Test

محیط `hero-test` سالم است، اما fingerprint هر پنج فایل اصلی آن با fingerprint بالا متفاوت است؛ candidate تمیز از source ساخته شده و parity آن با source تأیید شده است. برای تکمیل parity باید همین digest در محیط Test با همان Secret/env فعلی deploy شود و hash بعد از deploy دوباره مقایسه شود. image فعلی Test نباید به‌عنوان آخرین workspace معرفی یا به Production promotion شود.

## ممیزی runtime آخر — ۲۰۲۶-۰۹-۰۵

- Local Hero: `/health=200`، `/ready=200` و `/backoffice` بدون احراز هویت `401`؛
- Test داخلی: `/health=200`، `/ready=200`، Back Office بدون احراز هویت `401` و با credential runtime `200`؛
- دامنهٔ Test: TLS معتبر (`verify=0`) و Back Office بدون احراز هویت `401`؛
- Production: HTTP `/backoffice=308` به HTTPS و HTTPS بدون احراز هویت `401`؛
- هیچ stack موجودی در این ممیزی restart یا جایگزین نشد؛ فقط کانتینر موقت candidate smoke شد و حذف شد.

## گیت‌های قبل از promotion

۱. commit candidate انجام شد؛ برای CI باید commit `2b3d5b8` و image digest دقیق بالا استفاده شود؛

۲. اجرای `pnpm check` روی همان commit و ثبت SHA، image digest و artifact؛

۳. deploy همان artifact به `hero-test` و تأیید hash/health/auth/persistence؛

۴. ثبت rollback و recovery؛

۵. برای Production، مجوز مستقل `production-deploy` و تأیید Basic Auth/Caddy لازم است.
