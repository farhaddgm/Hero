# شواهد انتشار رابط Hero

Document ID: `HERO-UI-RELEASE-20261007-EVIDENCE`  
Version: `1.1.0`  
Date: `2026-10-07`  
Authorization: `BATCH-UI-RELEASE-20261007-001`

## بررسی کد نهایی قبل از انتشار

- مبنا: آخرین source منتشرشده، `8ee4f92dc42283c369198c624c04d99a253748f7`، با حفظ WP-05..WP-10، نقش‌ها، KPI واقعی، صفحه‌بندی و مرکز فرمان.
- `pnpm --config.verify-deps-before-run=false check`: PASS، ۵۷۰ تست، صفر fail/skip/cancel. کل زنجیرهٔ `pnpm check` اجرا شد؛ flag فقط بررسی مجدد store محلی pnpm را غیرفعال می‌کند.
- ممیزی مرورگر نهایی: PASS؛ ۱۶۴ مورد، ۸۰ ممیزی axe/WCAG، صفر violation و خطای JavaScript/سرریز افقی. ۱۸ سطح/زیرصفحه در عرض‌های ۱۴۴۰، ۷۶۸، ۳۹۰ و ۳۲۰ و دو پوسته؛ فرم ورود و تعاملات کلیدی نیز بررسی شدند.
- زمان پایان ممیزی: `2026-10-07T09:13:10.322Z`؛ SHA-256 گزارش `2d19085953bfead4a757c8b497a5a42c1e4b91b6cd68a7c54bdb15323637bfc3`. گزارش و screenshotها در `.hero-ui/results/` محلی و خارج از artifact تولیدی‌اند.
- دور نخست ادغام چهار خطای `scrollable-region-focusable` در صفحات inbox/insights یافت؛ focus‌پذیری جدول‌ها اصلاح شد و اجرای کامل نهایی بدون violation گذشت.
- Migrationهای 022/023 بررسی شدند: جدول‌ها و indexهای جدید با `IF NOT EXISTS` و guard فقط برای جدول‌های جدید؛ هیچ دادهٔ موجود حذف نمی‌شود.

## وضعیت انتشار

در این checkpoint فقط بررسی source نهایی تکمیل شده است. نتیجهٔ GitHub CI، artifact پذیرش‌شده و ارتقای زنده پس از اجرای واقعی به این سند افزوده می‌شوند. فایل بررسی امنیتی موجود کاربر جزو تغییرات انتشار نیست.

## نتیجهٔ واقعی انتشار در Test

- نسخه: `1.1.5-rc.40`؛ source: `127006a9ad9c1763a6ac6e327f8cc00a32d1b554`.
- GitHub CI: [37599448736](https://github.com/farhaddgm/Hero/actions/runs/37599448736) و [37599456593](https://github.com/farhaddgm/Hero/actions/runs/37599456593) هر دو PASS؛ شامل pnpm check، PostgreSQL و docker build.
- ساخت/انتشار artifact: [37599731429](https://github.com/farhaddgm/Hero/actions/runs/37599731429)، PASS؛ [Release](https://github.com/farhaddgm/Hero/releases/tag/v1.1.5-rc.40).
- artifact: `ghcr.io/farhaddgm/hero@sha256:04a7070ffea8fbc515c2d70591c3fd7a87fcf0f23f0fab44726a447ac435e8f6`.
- Image ID: `sha256:b84cf11d412f1c35dbd0f9aec6852c987166b859795b0be7a3a4af6beb6f91ea`. OCI version/revision و RepoDigest پیش از rollout تطبیق داده شدند.
- پذیرش همان image با PostgreSQL موقت و شبکهٔ internal: run `20261007T092042Z-9f1d3b`. Seed: `135/135` درون‌دامنه و `7/7` پشتیبان. پس از SIGKILL/restart: `36/36` درون‌دامنه و `1/2` پشتیبان. جمع: `171/171` درون‌دامنه؛ `179/180` کل. هیچ درخواست provider یا Notion از fixture ممکن نبود؛ fixture پاک شد.
- یافتهٔ باز قبلی و مستند: `WP-02 / BO-IAM-001`؛ MFA کاربر غیرمالک پس از restart ماندگار نیست. این نتیجه PASS کامل Identity نیست؛ در سندهای نسخه‌های پیشین هم باز بوده و در این انتشار پنهان یا رفع‌شده اعلام نمی‌شود.
- ارتقای زندهٔ Test: PASS در `2026-10-07T09:24:03.994319+00:00`؛ health=healthy، `/ready`=ready با persistence=postgresql، و `/build-info` دقیقاً مطابق نسخه/source/digest بالا.
- volume `hero-test_hero-data` و همهٔ credentialها/متغیرهای قبلی بدون تغییر حفظ شدند؛ فقط image و metadata نسخه/محیط تغییر کردند. فایل پیکربندی خارج از project boundary خوانده یا نوشته نشد. هیچ volume یا دادهٔ واقعی حذف نشد.
- rollback محفوظ: container متوقف `hero-test-control-plane-1-rollback-20261007T092357Z` و image قبلی `ghcr.io/farhaddgm/hero@sha256:882578b78427f8eeb44723a7b11091f321de4de24dd61a09e0033517d8bb4f31`. متادیتای محیط قدیمی rc.33 بود، اما OCI image قبلی rc.39 را نشان می‌داد؛ متادیتای جدید تصحیح و از artifact تطبیق داده شد.
- آزمایش public Test با Chromium و احراز هویت عادی مالک: entry=200، badge محیط Test، عرض ۱۴۴۰ و ۳۹۰ بدون سرریز، login/MFA و Portfolio موفق، کشوی موبایل/Escape موفق، صفر خطای JavaScript. نشست آزمون در پایان revoke شد.
- ابزار محلی rollout در ۷ سناریوی mock بررسی شد: dry-run بدون mutation، حفظ credential/volume و نسخهٔ قبلی، و rollback در شکست create/start/readiness یا تغییر volume/credential. هیچ پاسخ حاوی secret ثبت نشد.

## Production: انجام نشده، نیازمند مجوز جداگانهٔ Secret

Production روی OCI `0.1.0-rc.17` / `3dd54e5baf67e889d12e939e82875b7a785af3c8` است؛ image `ghcr.io/farhaddgm/hero@sha256:3b347fdb0f541e3d6e8fe0ac84afdf81535abfa525add2f534fe4b5942a6be7e`. سرویس healthy و دادهٔ آن دست‌نخورده است. ورود قدیمی Basic در `/backoffice` پاسخ 200 می‌دهد؛ مسیر جدید `/api/portal?surface=identity` حتی با Basic پاسخ 401 می‌دهد.

چهار متغیر bootstrap ورود انسانی (`HERO_IDENTITY_SESSION_SECRET`، `HERO_OWNER_EMAIL`، `HERO_OWNER_PASSWORD`، `HERO_OWNER_MFA_SECRET`) در Production پیکربندی نشده‌اند. artifact جدید برای ناوبری پروژه به Human Identity نیاز دارد. rollout بدون آماده‌سازی آن، مسیر ورود قابل استفادهٔ جدیدی نمی‌سازد. نقص ماندگاری MFA غیرمالک نیز در پذیرش واقعاً باز است.

مجوز مالک برای انتشار دریافت شده، اما مطابق AGENTS.md بندهای ۸ و ۱۲، تغییر Secrets مجوز مستقل می‌خواهد و در authorization این انتشار صریحاً مستثناست. درخواست جداگانه برای تنظیم امن ورود Production و اصلاح ماندگاری MFA به مالک ارائه شد. تا دریافت آن، Production ارتقا نمی‌یابد؛ هیچ تغییر Secret یا کاهش کنترل احراز هویت انجام نشده است.

گزارش‌های بدون secret (manifest، پذیرش، rollout و مرورگر زنده) در assetهای Release نگهداری می‌شوند. گزارش‌ها وضعیت Test را اثبات می‌کنند و ادعای انتشار Production ندارند.
