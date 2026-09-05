# پنجاه گام باز و اولویت‌دار Hero

مبنای این فهرست: ۲۰۲۶-۰۹-۰۴. این ۵۰ گام از دفتر کامل [NEXT-100-STEPS-20260904.md](./NEXT-100-STEPS-20260904.md) انتخاب شده‌اند و به‌ترتیب ریسک و وابستگی مرتب شده‌اند. وضعیت «نیازمند Test» یعنی پیاده‌سازی محلی انجام شده اما هنوز روی محیط عملیاتی Test شاهد واقعی ندارد.

| # | مرجع | گام | وضعیت فعلی | اقدام بعدی |
|---:|---:|---|---|---|
| ۱ | ۲ | یکسان‌سازی دامنهٔ Test | تأیید Test؛ نیازمند ثبت تصمیم مالک | تصمیم رسمی دامنه را ثبت کن |
| ۲ | ۳ | تصمیم هم‌سرور یا VM جدا | نیازمند تصمیم مالک | تصمیم و دلیل را ثبت کن |
| ۳ | ۶ | معیار استفادهٔ عملیاتی Test | نیازمند تصمیم مالک | health، auth، persistence و rollback را تأیید کن |
| ۴ | ۷ | مالک و جانشین عملیاتی | نیازمند تصمیم مالک | نام نقش و مسیر escalation را بده |
| ۵ | ۸ | سیاست نگهداری Log/Evidence | نیازمند تصمیم مالک | مدت نگهداری و محل امن را تعیین کن |
| ۶ | ۱۱ | اتصال اجرای واقعی host | blocker خارجی | ادمین Runner محدود Hero را وصل کند |
| ۷ | ۱۲ | کاربر محدود `hero-ops` | blocker خارجی | بدون Docker عمومی و sudo عمومی ایجاد شود |
| ۸ | ۱۳ | بررسی wrapperهای Test | blocker خارجی | `hero-test-*` با `sudo -n` بررسی شود |
| ۹ | ۱۴ | تعیین تکلیف `compose.test.yaml` | blocker خارجی | مالکیت و محتوای فایل بررسی و تصمیم‌گیری شود |
| ۱۰ | ۱۸ | Secret runtime Test | تأیید Test؛ نیازمند audit محل نگهداری | فقط در Secret Store یا فایل `600` ساخته شود |
| ۱۱ | ۱۹ | preflight کانفیگ Test | تکمیل Test؛ preflight واقعی دوباره موفق شد | `check-test-config` روی مقصد اجرا شود |
| ۱۲ | ۲۰ | Evidence ایزولاسیون | تکمیل Test | project/volume/network، bind localhost و بسته‌بودن بیرونی پورت‌های `43101`/`5432` ثبت شد |
| ۱۳ | ۲۱ | migrationهای ۰۰۱ تا ۰۰۶ در Test | تکمیل Test | روی PostgreSQL مستقل اجرا شود |
| ۱۴ | ۲۲ | readiness PostgreSQL و Hero | تکمیل Test | `pg_isready` و `/ready` هر دو موفق شوند |
| ۱۵ | ۲۳ | append-only Event Store | تکمیل Test | migrationهای `001` تا `006` و guardهای append-only تأیید شد؛ دادهٔ عملیاتی بیشتر جداست |
| ۱۶ | ۲۷ | Snapshot یازده Registry و Dashboard | تکمیل Test؛ ۱۱ Projection در runtime تأیید شد | Snapshot در Test ذخیره شود |
| ۱۷ | ۲۸ | hydration بعد از restart | تکمیل Test | قبل/بعد restart مقایسه شود |
| ۱۸ | ۲۹ | تشخیص Snapshot ناقص/قدیمی | تأیید Test؛ نیازمند سناریوی خرابی | در Test با دادهٔ واقعی اجرا شود |
| ۱۹ | ۳۰ | Backup/Restore با checksum | synthetic موفق؛ Clean Linux مقصد blocker خارجی | restore واقعی روی مقصد Clean Linux و backup عملیاتی ثبت شود |
| ۲۰ | ۳۲ | mapping همهٔ Domain Eventها | تکمیل محلی/نیازمند Test | پوشش mapping در Test با دادهٔ واقعی تأیید شود |
| ۲۱ | ۳۳ | replay کامل Registryها | تکمیل محلی/نیازمند Test | rebuild واقعی read model در Test اجرا شود |
| ۲۲ | ۳۴ | rebuild dry-run و digest | تکمیل محلی/نیازمند Test | digest در Test بازتولید شود |
| ۲۳ | ۳۷ | projection پایدار commandهای باقی‌مانده | تکمیل محلی/نیازمند Test | درخواست و state از Eventهای append-only بازسازی و در Test تأیید شود |
| ۲۴ | ۳۸ | pagination و cursor همهٔ read modelها | تکمیل محلی/نیازمند Test | روی حجم واقعی Test بررسی شود |
| ۲۵ | ۴۰ | redaction جامع Projection/Diagnostic | تکمیل محلی/نیازمند Test | با Secret-shaped داده در Test آزمون شود |
| ۲۶ | ۴۱ | Provider/Model پیش‌فرض نقش‌های اصلی | نیازمند تصمیم مالک | یک انتخاب نسخه‌دار ثبت کن |
| ۲۷ | ۴۳ | Binding مستقل AI برای Skill | تکمیل محلی/نیازمند Test | مسیر مستقل Skill در Test تأیید شود |
| ۲۸ | ۴۵ | فهرست Model مجاز/deprecated | نیازمند تصمیم مالک | allow-list رسمی بده |
| ۲۹ | ۴۷ | readiness واقعی Adapterها | blocker مجوزی | verifier و مجوز مستقل لازم است |
| ۳۰ | ۴۸ | سقف هزینهٔ Provider/Task | نیازمند تصمیم مالک | cap عددی و رفتار توقف را تعیین کن |
| ۳۱ | ۴۹ | timeout، retry و circuit breaker | تکمیل محلی/نیازمند Test | رفتار bounded و recovery در Test تأیید شود |
| ۳۲ | ۵۲ | AI پیش‌فرض و override تیم‌ها | نیازمند تصمیم مالک | برای هر تیم Binding روشن کن |
| ۳۳ | ۵۴ | دورهٔ freshness دانش | نیازمند تصمیم مالک | `validUntil` و stale policy را تعیین کن |
| ۳۴ | ۵۵ | approval دانش جمع‌آوری‌شده | تکمیل محلی/نیازمند Test | فقط دانش تأییدشده در Test وارد Team شود |
| ۳۵ | ۵۶ | Golden Dataset یازده تیم | blocker مالک | ورودی، خروجی مطلوب و خطاها را بده |
| ۳۶ | ۵۸ | Performance Review دوره‌ای | تکمیل محلی/نیازمند Test | scoreهای پنج‌گانه با evidence واقعی Test ثبت شود |
| ۳۷ | ۶۰ | چرخهٔ Evaluation به Training | تکمیل محلی/نیازمند Test | هر finding در Test به اقدام آموزشی وصل شود |
| ۳۸ | ۶۷ | اتصال Planner به readiness تیم | تکمیل محلی/نیازمند Test | تخصیص تیم ناآماده در Test مسدود شود |
| ۳۹ | ۶۸ | اتصال Advisor به Evidence واقعی | تکمیل محلی/نیازمند Test | توصیهٔ مبتنی بر Evidence تأییدشده در Test تأیید شود |
| ۴۰ | ۷۲ | آزمون keyboard، focus و RTL | تکمیل automated/نیازمند مرورگر Test | مسیرهای اصلی با مرورگر Test بدون mouse بررسی شود |
| ۴۱ | ۷۳ | آزمون responsive موبایل/دسکتاپ | تکمیل automated/نیازمند مرورگر Test | اندازه‌های واقعی مرورگر Test بررسی شود |
| ۴۲ | ۷۹ | access audit قابل مشاهده برای مالک | تأیید Test؛ ۱۷ مسیر read-only احراز شد | خروجی audit روی Test تأیید شود؛ ممیزی جامع ۵۸ مسیر GET نیز موفق شد |
| ۴۳ | ۸۱ | install دقیق با lockfile | اکنون/CI | workflow CI اجرا شود |
| ۴۴ | ۸۳ | Environment تست GitHub | نیازمند ادمین GitHub | reviewer اجباری فعال شود |
| ۴۵ | ۸۵ | استقرار Candidate در Test | انجام شد؛ parity و health/auth/restart تأیید شد | برای promotion بعدی فقط rollback/recovery و مجوزهای جدا باقی است |
| ۴۶ | ۸۶ | smoke و security روی Test | smoke خودکار انجام شد؛ ۱۷ مسیر read-only تأیید شد؛ مرور دستی کامل باقی است | review دستی Caddy/شبکه/دسترسی‌ها و ثبت owner evidence انجام شود؛ ممیزی جامع ۵۸ مسیر GET نیز موفق شد |
| ۴۷ | ۸۷ | Test Evidence و review مالک | نیازمند تصمیم مالک | Evidence کامل را تأیید کن |
| ۴۸ | ۸۸ | rollback نسخهٔ Test | انجام شد؛ recovery عملیاتی باقی است | recovery از backup/checksum روی Clean Linux هنوز انجام شود |
| ۴۹ | ۸۹ | recovery روی Clean Linux | blocker خارجی | restore واقعی و checksum ثبت شود |
| ۵۰ | ۹۱ | انتخاب درخواست کوچک Pilot | نیازمند تصمیم مالک | یک feature کوچک و قابل rollback معرفی کن |

## کارهای مالک/ادمین

این موارد را از داخل کد یا sandbox نمی‌توانم به‌جای مالک انجام بدهم: تصمیم دامنه و محیط، تعیین مالک عملیاتی، اتصال host-level Runner، تعیین تکلیف `compose.test.yaml`، ساخت Secret بدون افشا، اجرای Test/PG واقعی، DNS/TLS/Caddy، GitHub Environment و صدور مجوزهای مستقل. دستور سادهٔ مرحله‌ای در [OWNER-ACTIONS-PENDING-20260904.md](../operations/OWNER-ACTIONS-PENDING-20260904.md) ثبت شده است.

پس از انجام هر دسته، فقط نتیجهٔ غیرحساس را اعلام کن؛ مقدار Secret، Token، کلید SSH یا فایل env را ارسال نکن.

شناسنامهٔ نسخهٔ قابل‌انتشار و hashهای بدون Secret در [CANDIDATE-EVIDENCE-20260904.md](./CANDIDATE-EVIDENCE-20260904.md) نگهداری می‌شود.
