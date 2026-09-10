# شواهد بررسی دسترسی و محیط Test — ۲۰۲۶-۰۹-۰۴

## محدودهٔ بررسی

این بررسی فقط روی repository خود Hero در `/opt/hero` و namespace مجزای Docker با نام `hero-test` انجام شد. هیچ فایل، کانتینر، volume، database یا پورت متعلق به پروژهٔ دیگری خوانده یا تغییر داده نشد.

## اصلاح وضعیت جاری — ۲۰۲۶-۰۹-۱۰

- Test شامل Control Plane، PostgreSQL و proxy احراز هویت است و هر سه سرویس healthy هستند؛ bind برنامه فقط `127.0.0.1:43101` است.
- `/health` و `/ready` داخلی و عمومی `200` هستند؛ دامنهٔ رسمی `test.hero.beeproject.ir` TLS معتبر و Back Office بدون auth برابر `401` دارد.
- persistence برابر `postgresql`، readiness برابر `ready` و hydration برابر `hydrated` است؛ هر ۱۱ registry بازیابی شدند و event/snapshot integrity معتبر است.
- مسیرهای dashboard، diagnostics و هر دو audit با نشست Owner به‌صورت read-only پاسخ `200` دادند.
- restart کنترل‌شده فقط برای Control Plane انجام شد؛ projection digest ثابت ماند و PostgreSQL، volume و سرویس‌های دیگر دست‌نخورده بودند.
- `compose.test.yaml` فعال نبود و پس از مقایسه با قرارداد جاری، بدون حذف در `var/quarantine/compose.test.yaml.legacy-20260904.disabled` کنار گذاشته شد. تنها مبنای Test فایل `compose.yaml` با project name برابر `hero-test` است.
- verification کامل جاری پس از آخرین اصلاحات `246/246` تست، Build برابر ۱۴۴ ماژول و ۹ JSON و auditهای اجباری موفق است؛ اعداد پایین‌تر فقط شواهد تاریخی‌اند.
- بخش‌های دارای تاریخ ۲۰۲۶-۰۹-۰۵ و قبل از آن در ادامه، شواهد تاریخی‌اند و بیانگر وضعیت فعلی PostgreSQL نیستند.

## وضعیت جاری — ۲۰۲۶-۰۹-۰۵

- artifact جاری `hero-control-plane:candidate-b7f0247` با digest `sha256:4f6f8f5766246e548ae46a736d8ea5dc8659ad9604be6d9c9131e051bf596e6d` فقط روی `hero-test` مستقر است؛
- `hero-test-control-plane-1` و `hero-test-hero-postgres-1` هر دو healthy هستند؛ فقط Control Plane recreate شد و bind همچنان `127.0.0.1:43101` است؛
- اتصال TCP داخلی از Control Plane به `hero-postgres:5432` قابل برقراری است؛ شبکه و سرویس PostgreSQL reachable هستند و blocker فعلی به Secret wiring/strict persistence محدود می‌شود؛
- smoke-test داخلی: `/health=200`، `/ready=200`، `/backoffice=200` و `/backoffice-data=200` با احراز هویت؛ payload شامل ۵۰ ردیف `OPEN-50` و وضعیت `runtime=in-memory`/`readiness=development-or-optional` است؛
- شمارش وضعیت دفتر جاری: `pending=39`، `blocked=9` و `evidence=2`؛ شواهد persistence قبلی عمداً از وضعیت candidate جاری جدا نگه داشته شده‌اند؛
- preflight سخت‌گیرانه فقط دو blocker واقعی دارد: `HERO_POSTGRES_URL` و `HERO_POSTGRES_PASSWORD` در env امن Control Plane خالی‌اند؛ PostgreSQL مستقل Secret runtime دارد اما این دو مقدار به Control Plane wiring نشده‌اند؛ تا رفع آن‌ها persistence و دو مسیر audit نهایی نیستند؛
- Production، PostgreSQL، volume، network و اپلیکیشن‌های دیگر تغییر نکرده‌اند.

## نتیجهٔ دسترسیِ baseline تاریخی

- repository قابل دسترسی است؛ تغییر قبلی کاربر در `.dockerignore` حفظ شده و به آن دست زده نشد.
- baseline بررسی قبلی commit `f48dda6` بود؛ تغییرات این بسته پس از verification در commitهای `8d18bd4` و `4118cce` ثبت شده‌اند.
- Docker برای کاربر عادی مجاز نیست؛ بررسی محدود namespace `hero-test` با دسترسی elevated انجام شد.
- `hero-test` فعلاً هیچ کانتینری ندارد؛ بنابراین Test هنوز deploy نشده است.
- پیکربندی Compose داخل repository معتبر است و تغییری ایجاد نمی‌کند.

## شواهد تستِ baseline تاریخی

- `pnpm check`: موفق؛ `228/228` تست، Build با `138` ماژول و `7` فایل JSON، Governance با `21` گام و Doctor با `10/10` check.
- `pnpm check:pilot`: مسدود با سه گیت واقعی:
  - `linux-recovery-evidence`: شواهد Clean Linux و restore روی artifact عملیاتی وجود ندارد؛
  - `provider-authorization`: Provider واقعی و مجوز مستقل فعال نیست؛
  - `pilot-request`: درخواست و معیار پذیرش پایلوت ثبت نشده است.
- `127.0.0.1:43101/health` و `/ready`: پاسخی ندارند، چون سرویس Test اجرا نشده است.
- route محلی `test.hero.beeproject.ir` روی HTTPS: از این محیط قابل اتصال نیست.
- DNS دامنهٔ Test از همین نقطه در زمان بررسی resolve نشد؛ پس وضعیت انتشار عمومی از این نقطه تأیید نشده است.

## خروجی تکمیلی همین بسته

- Benchmark synthetic اکنون در PostgreSQL قابل ذخیره، بازیابی، مقایسه و hydrate است؛
- access audit فقط metadata مسیرهای read-model را نگه می‌دارد و outcomeهای accepted/rejected را ثبت می‌کند؛
- تست HTTP و adapter این مسیر موفق است؛ این قابلیت تا زمان تنظیم `HERO_POSTGRES_URL` در محیط واقعی فعال نمی‌شود.
- Diagnostic read model با قرارداد نسخه‌دار، پوشش ۱۱ Projection، بررسی Snapshot/Event، replay dry-run، digest، تاریخچهٔ امن AI، freshness دانش و تعارض تخصیص اضافه شد؛
- در بستهٔ بعدی، مشاهدهٔ metadata حافظهٔ فعلی، ظرفیت Planner در Diagnostic و رد روش‌های غیر GET در Back Office اضافه و با verification Linux `230/230` تست دوباره بررسی شد؛
- احراز هویت امضاشدهٔ Admin فقط برای کاتالوگ AI فعال است و به Team، Release، Dispatch، Secret یا Production اختیار نمی‌دهد؛
- شواهد این بسته: `228/228` تست، Build `138`، Governance `21` و `git diff --check` موفق.

## کارهایی که عمداً انجام نشد

- Secret خوانده، ساخته یا تغییر داده نشد؛
- Caddy، DNS یا WCDN تغییر داده نشد؛
- Provider زنده، هزینهٔ خارجی و Production فعال نشد؛
- فایل یا سرویس خارج از مرز repository Hero خوانده نشد.

## گام لازم بعدی

اپراتور باید Secretهای Test را در کانال امن runtime قرار دهد و با همان Secret، `check-test-config` و Compose را اجرا کند. پس از بالا آمدن موفق Test، Caddy/WCDN باید فقط route دامنهٔ Test را به `127.0.0.1:43101` وصل کند و validate/reload شود. سپس health، readiness، migration، hydration، احراز هویت و smoke-test ثبت می‌شوند. تا آن زمان Test و Production عملیاتی محسوب نمی‌شوند.

## ممیزی تکمیلی وضعیت جاری — ۲۰۲۶-۰۹-۰۵

### سابقهٔ ممیزی UI و candidate قبلی — ۲۰۲۶-۰۹-۰۵ (تاریخی)

- artifact `hero-control-plane:candidate-985ab8c` با digest `sha256:590efbccac4d7b20df03d4ad14d230003ff646821bef91df9712063648225135` از Commit `985ab8c` فقط روی `hero-test` مستقر شد؛
- Back Office اکنون Projection نسخه‌دار `OPEN-50` را با ۵۰ ردیف، وضعیت، اقدام بعدی، راهنمای ۳۹ مفهوم و ۱۴ اقدام مالک/ادمین نشان می‌دهد؛ ۳ blocker Pilot جداگانه مشخص‌اند؛
- payload احراز‌شدهٔ `/backoffice-data` شامل `ledger=OPEN-50` و `total=50` است؛ HTML شامل عنوان دفتر و فهرست گیت‌هاست؛
- ۱۷ مسیر read-only Test احراز شد: ۳ مسیر Back Office با Basic Auth و ۱۴ مسیر API با نشست Owner؛ همه `۲۰۰` و بدون mutation بودند؛
- بعد از restart کنترل‌شده، `/ready=200` و Back Office با auth=`200` باقی ماند؛ PostgreSQL و namespace `hero-test` تغییر نکردند؛ ۱۷ مسیر read-only نیز `200` شدند؛
- `compose.test.yaml` همچنان untracked و خارج از image/فرآیند deploy است و خوانده یا استفاده نشد.

### وضعیت عمومی جاری — ۲۰۲۶-۰۹-۰۵

در بررسی جاری، stack مستقل `hero-test` با Control Plane و PostgreSQL هر دو `healthy` مشاهده شد؛ `/health=200`، `/ready=200` و `/backoffice` بدون احراز هویت `401` بودند. دامنهٔ `test.hero.beeproject.ir` نیز TLS معتبر و پاسخ بدون احراز هویت `401` دارد. artifact جاری `hero-control-plane:candidate-b7f0247` با digest `sha256:4f6f8f5766246e548ae46a736d8ea5dc8659ad9604be6d9c9131e051bf596e6d` از Commit `b7f0247` فقط روی Test deploy شد؛ preflight سخت‌گیرانه دو Secret PostgreSQL را missing گزارش می‌کند و persistence candidate جاری هنوز نهایی نیست. Production تغییری نکرده است.

همچنین Local Hero سالم است (`/health=200`، `/ready=200`، Back Office بدون احراز هویت `401`). در Production، HTTP به HTTPS با `308` redirect می‌شود و HTTPS Back Office بدون احراز هویت `401` می‌دهد؛ رفع اختلاف Basic Auth/Caddy همچنان اقدام ادمین و خارج از این workspace است. هیچ سرویس یا resource متعلق به پروژهٔ دیگری تغییر نکرد.

### ممیزی جامع مسیرهای GET — ۲۰۲۶-۰۹-۰۵

- در Test با نشست موقت Owner و Basic Auth runtime، ۵۸ مسیر GET شامل contractها، health/readiness، سه مسیر Back Office، APIهای dashboard/diagnostics/AI/team/audit و مسیرهای جزئیات سه Team بررسی شد؛ همهٔ پاسخ‌ها در بازهٔ `2xx` بودند؛
- سه مسیر Back Office با Basic Auth و مسیرهای `/api/*` با Bearer Session بررسی شدند؛ هیچ mutation، Provider واقعی یا تغییر داده‌ای در این ممیزی انجام نشد؛
- نشست ممیزی فقط برای همین بررسی بود و Secret یا token در خروجی یا مستندات ثبت نشد.

### ممیزی پس از اصلاح persistence — ۲۰۲۶-۰۹-۰۵

- اصلاح empty-state Benchmark در Commit `d854966`، guard اجباری PostgreSQL در Commit `b379109`، نمایش وضعیت persistence در Commit `c804a5a` و هم‌راستاسازی ledger در Commit `b7f0247` با artifact `hero-control-plane:candidate-b7f0247` و digest `sha256:4f6f8f5766246e548ae46a736d8ea5dc8659ad9604be6d9c9131e051bf596e6d` ساخته و فقط روی Control Plane محیط `hero-test` نصب شد؛
- هر دو کانتینر Test `healthy` هستند و bind سرویس همچنان `127.0.0.1:43101` است؛ PostgreSQL، volume، network و Production تغییر نکرده‌اند؛
- preflight سخت‌گیرانه با bind/port صحیح فقط دو blocker گزارش کرد: `HERO_POSTGRES_URL` و `HERO_POSTGRES_PASSWORD` در env امن runtime حاضر نیستند؛ بنابراین Test فعلی از نظر persistence هنوز تأیید نهایی نشده است؛
- ممیزی ۵۸ مسیر در تست تکرارپذیرِ in-process با persistence تزریقی کامل پاس شد؛ در runtime جاری مسیرهای اصلی سالم‌اند و دو مسیر audit تا زمان اتصال Secretهای PostgreSQL عمداً `503` می‌مانند و باید پس از تنظیم env دوباره اجرا شوند.
