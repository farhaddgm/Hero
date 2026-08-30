# فلو نسخه‌گذاری و انتشار Hero

## تصمیم معماری

هر محصول دو محیط دارد:

1. **test:** محل استقرار نسخهٔ نامزد، اجرای تست، امنیت، بازبینی و جمع‌آوری Evidence.
2. **production:** محل استفادهٔ واقعی؛ فقط همان Artifact و commitی را می‌گیرد که در test پذیرفته شده است.

نسخهٔ production از نو build نمی‌شود و از branch دلخواه هم ساخته نمی‌شود. Artifact تست‌شده promote می‌شود.

## فلو الزام‌آور

```text
Git commit / tag
      ↓
ثبت Release با version + commit SHA + Artifact ID
      ↓
درخواست استقرار در test
      ↓
Evidence واقعی تست و بازبینی
      ↓
درخواست تأیید production
      ↓
تأیید صریح مالک
      ↓
فرمان مستقل production + مجوز production-deploy
      ↓
استقرار همان Artifact در production
      ↓
Evidence استقرار و مسیر rollback
```

## قواعد نسخه‌گذاری Git

- هر تغییر قابل تحویل از یک commit قابل ردیابی می‌آید.
- نسخهٔ نامزد test با SemVer مانند `1.2.0-rc.1` و commit SHA ثبت می‌شود.
- پس از عبور test و تأیید مالک، همان version و همان commit/Artifact promote می‌شود؛ اگر نسخه از `1.2.0-rc.1` به `1.2.0` تغییر کند، این یک Release جدید است و باید دوباره test شود.
- تغییر کد بعد از test، Release جدید است و باید دوباره test شود.
- production هرگز با `latest`، فایل محلی یا rebuild ناشناس به‌روزرسانی نمی‌شود.

## قرارداد ماشینی

`ReleasePromotion` در `packages/domain/src/release-promotion.mjs` این مراحل را enforce می‌کند:

```text
draft
  -> test-deployment-requested
  -> test-deployed
  -> test-passed
  -> awaiting-production-approval
  -> production-approved
  -> production-promotion-requested
  -> production
```

Artifact ID، version و commit SHA در تمام مراحل با تطبیق دقیق بررسی می‌شوند. تست ناموفق، Evidence ناقص، اصول حیاتی ناقص یا نبود rollback مسیر را می‌بندد. `production` فقط با سه شرط ممکن است: تست موفق، تأیید مالک و مجوز مستقل `production-deploy` به‌همراه فرمان صریح مالک.

در API، `/test-deployment` درخواست استقرار آزمایشی را ثبت می‌کند و `/test-deployment-record` فقط Evidence تکمیل استقرار test را می‌پذیرد؛ این دو عمداً جدا هستند. `/test-evidence` نتیجهٔ تست را ثبت می‌کند و `/production-promote` فرمان مالک را به گیت مجوز مستقل می‌سپارد.

در پیاده‌سازی فعلی، Release Registry و گیت‌ها واقعی و قابل تست‌اند، اما Deployment Adapter زنده عمداً غیرفعال است. بنابراین ثبت `production-promotion-requested` به‌معنای اجرای واقعی روی سرور نیست؛ اجرای واقعی فقط بعد از HERO-020، زیرساخت Linux و مجوز عملیاتی ثبت می‌شود.

## GitHub و محیط‌ها

GitHub منبع کد، commit، branch، tag و CI است. تنظیم پیشنهادی Repository:

- Environment `test`: اجرای check، ساخت Artifact و استقرار نامزد؛
- Environment `production`: branch/tag محدود، required reviewer و مجوز جداگانه؛
- concurrency برای جلوگیری از دو استقرار هم‌زمان؛
- ثبت URL اجرا، Artifact digest، commit SHA و نتیجهٔ rollback در Evidence Hero.

GitHub فقط اجرای pipeline را فراهم می‌کند؛ تصمیم مالک، اصول حیاتی و Release Gate باید در Hero باقی بمانند.

Workflow دستی `.github/workflows/release-test.yml` محیط `test` را با `pnpm check` و ساخت image بررسی می‌کند و شناسهٔ نسخه، commit و Artifact را به‌صورت Evidence خروجی می‌دهد. این workflow استقرار واقعی انجام نمی‌دهد. Environment `production` باید بعداً در GitHub با branch/tag محدود و required reviewer پیکربندی شود و فقط پس از ثبت مجوز مستقل در Hero به Deployment Adapter متصل شود.

## ابزار مدیریت و بک‌آفیس

Notion برای Product Brief، PRD، تصمیم‌های قابل خواندن، آموزش تیم‌ها و Viewهای مدیریتی مناسب است. GitHub برای کد، نسخه، PR، CI و Artifact منبع حقیقت است. Hero باید وضعیت، گیت، approval، Evidence و Audit را نگه دارد؛ Notion نباید جایگزین Event Log یا مجوز production شود.

در گام PostgreSQL، Notion از طریق Adapter فقط برای نمایش یا همگام‌سازی کنترل‌شده استفاده می‌شود و هیچ Secret یا تصمیم تأییدنشده‌ای به آن ارسال نمی‌شود.
