# شواهد انتشار رابط Hero

Document ID: `HERO-UI-RELEASE-20261007-EVIDENCE`  
Version: `1.0.0`  
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
