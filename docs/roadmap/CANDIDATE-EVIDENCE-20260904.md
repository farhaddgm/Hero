# شناسنامهٔ Candidate Hero — ۲۰۲۶-۰۹-۰۴

این سند شناسنامهٔ قابل‌بازبینیِ source و candidate فعلی است؛ به‌معنی tag یا انتشار نیست و هیچ Secretی در آن وجود ندارد.

## منبع

| مورد | مقدار |
|---|---|
| branch | `codex/hero-001-project-charter` |
| candidate commit محلی | `cdc44bc` — `feat: harden Hero backoffice and audit projections` |
| evidence commit | `cce6aaa` — `docs: record candidate verification evidence` |
| commit پایه | `26cfe549924b0db63eef71db25aeb8dfb5beb4d7` |
| remote branch pointer | `c445609b301807df1bb50124a92afa31c500a145`؛ از candidate محلی عقب‌تر است |
| وضعیت | candidate محلی commit شده؛ push و انتشار انجام نشده |
| Git در workspace | commit محلی موفق؛ push هنوز انجام نشده |
| مرز | فقط repository Hero؛ بدون تغییر اپلیکیشن‌های دیگر |

## شواهد verification

- `pnpm check`: ۲۳۹/۲۳۹ تست موفق؛
- Build: ۱۳۸ ماژول و ۷ فایل JSON موفق؛
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

محیط `hero-test` سالم است، اما fingerprint سه فایل اصلی آن با fingerprint بالا متفاوت است؛ بنابراین باید candidate جدید از همین source ساخته و hash آن بعد از deploy دوباره مقایسه شود. image فعلی نباید به‌عنوان آخرین workspace معرفی یا به Production promotion شود.

## گیت‌های قبل از promotion

۱. commit candidate انجام شد؛ برای CI باید همین commit/منبع دقیق استفاده شود؛

۲. اجرای `pnpm check` روی همان commit و ثبت SHA، image digest و artifact؛

۳. deploy همان artifact به `hero-test` و تأیید hash/health/auth/persistence؛

۴. ثبت rollback و recovery؛

۵. برای Production، مجوز مستقل `production-deploy` و تأیید Basic Auth/Caddy لازم است.
