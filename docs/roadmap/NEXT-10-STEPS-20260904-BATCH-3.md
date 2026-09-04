# ده گام بعدی Hero — بستهٔ تشخیص و کنترل عملیاتی

مبنا: `2026-09-04` — این بسته فقط تغییرات داخل `/opt/hero` را پوشش می‌دهد و هیچ سرویس یا زیرساخت دیگری را لمس نمی‌کند.

## گام‌ها و وضعیت

| # | گام | وضعیت | خروجی/معیار پذیرش |
|---:|---|---|---|
| ۱ | تعریف قرارداد Diagnostic | انجام‌شده | قرارداد `operational-diagnostics-v1` با ۱۱ Projection و مرز read-only |
| ۲ | شمارش و کنترل پوشش Registryها | انجام‌شده | نبودن/تکراری‌بودن Registry به‌صورت fail-closed گزارش می‌شود |
| ۳ | اعتبارسنجی Snapshotها | انجام‌شده | schema و منبع Snapshot بررسی می‌شوند |
| ۴ | اعتبارسنجی Eventها | انجام‌شده | Event ID، نوع، Aggregate Version و gap بررسی می‌شوند |
| ۵ | replay-check بدون نوشتن بیرونی | انجام‌شده | Eventها در Event Log موجود به‌صورت dry-run load می‌شوند |
| ۶ | Digest تکرارپذیر Projection | انجام‌شده | SHA-256 از Snapshot + Event برای مقایسهٔ نسخه‌ها |
| ۷ | تاریخچهٔ امن تغییرات AI | انجام‌شده | تغییرات Provider/Model/Profile/Binding/Policy؛ بدون Secret/Prompt/Output |
| ۸ | گزارش provenance و freshness دانش | انجام‌شده | وضعیت ۱۱ تیم و اعتبار metadata نمایش داده می‌شود |
| ۹ | کشف تعارض تخصیص | انجام‌شده | Task فعالِ مشترک بین چند تیم گزارش می‌شود؛ ظرفیت عددی عمداً هنوز تعریف نشده |
| ۱۰ | API، تست و مستندات | انجام‌شده | `/api/operations/diagnostics`، تست مالک، امنیت و مستندات |

## نتیجهٔ بنچ‌مارک راه‌حل

سه مسیر بررسی شد: تشخیص مستقیم داخل هر Registry، خواندن مستقیم PostgreSQL، و یک Diagnostic read model در Control Plane. مسیر سوم انتخاب شد چون یک خروجی واحد برای Back Office/CI می‌دهد، به PostgreSQL یا شبکه وابسته نیست، از Event Log فعلی replay می‌گیرد و اختیار تغییر ایجاد نمی‌کند. اتصال مستقیم به PostgreSQL در این گام عمداً انجام نشد تا تشخیص محلی با وضعیت مقصد اشتباه نشود.

## گیت‌های خارج از این بسته

این بسته عمداً این موارد را فعال نمی‌کند: Provider زنده و external spend، Secret واقعی، Test عملیاتی/DNS/TLS/Caddy، recovery روی مقصد پاک، Pilot واقعی و Production. این‌ها به محیط یا مجوز مستقل نیاز دارند.
