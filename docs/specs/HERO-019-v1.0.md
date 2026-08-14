# HERO-019 v1.0 — امنیت، CI، مشاهده‌پذیری و کنترل هزینه

وضعیت: مصوب برای توسعه و تست؛ اجرای CI خارجی، انتشار telemetry، release، deploy و هر هزینهٔ واقعی به مجوزهای مستقل نیاز دارند.

## هدف

Hero باید پیش از هر تحویل یا انتشارِ آینده، چهار شاهد قابل‌فهم و نسخه‌دار را در یک مرز fail-closed جمع کند: نتیجهٔ CI محلی، امنیت بدون Secret و شبکهٔ بسته، سیگنال‌های مشاهده‌پذیری محلی و سقف هزینه. این گام فقط قرارداد و ارزیابی قطعیِ داخل مخزن را ایجاد می‌کند؛ اتصال به سرویس CI یا Provider واقعی نیست.

## طراحی

1. `Assurance Gate` فقط با مجوز دقیق `test`، Step ID و نسخهٔ سند منطبق شروع می‌شود. Global Stop قبل از ثبت Dispatch جدید، خروجی را با `GLOBAL_STOP_ACTIVE` مسدود می‌کند.
2. شاهد CI باید محلی، موفق و ساختاریافته باشد؛ نمونهٔ مرجع آن `pnpm check` است. نبود یا نامعتبر بودن آن با `CI_EVIDENCE_REQUIRED` مسدود می‌شود.
3. شاهد امنیت باید نبود دادهٔ حساس و شبکهٔ بسته را صریحاً ثابت کند؛ ورودی Secret-shaped یا مسیر میزبان پیش از ثبت رد می‌شود و شکست سیاست با `SECURITY_POLICY_FAILED` ثبت می‌گردد.
4. مشاهده‌پذیری محلی باید حداقل رخدادهای `authorization.dispatch-blocked`، `quality-gate.approved` و `run.completed` را اعلام کند. export خارجی فعال نیست و نبود این قرارداد با `OBSERVABILITY_CONTRACT_REQUIRED` مسدود می‌شود.
5. هزینه فقط با واحدهای صحیح، محدود و بدون هزینهٔ خارجی ثبت می‌شود. عبور از سقف `BUDGET_CAP_REACHED` و هر هزینهٔ خارجی `EXTERNAL_SPEND_REQUIRES_SEPARATE_AUTHORIZATION` است.
6. خروجی موفق `ASSURANCE_APPROVED` است. حتی در این وضعیت، release با `RELEASE_REQUIRES_SEPARATE_AUTHORIZATION` گیت می‌ماند و هیچ CI خارجی، Provider، telemetry export، merge، release، deploy، credential یا spend واقعی اجرا نمی‌شود.

## معیار پذیرش

- قرارداد و Domain قابل‌تست، ایمن در برابر Secret و host path، idempotent و append-only باشد.
- مسیر موفق چهار شاهد را به `ASSURANCE_APPROVED` تبدیل کند و مسیرهای CI، امنیت، مشاهده‌پذیری، بودجه و Global Stop fail-closed باشند.
- endpoint عمومی فقط خلاصهٔ قرارداد را بازگرداند و هیچ دادهٔ عملیاتی یا Secret را افشا نکند.
- `pnpm check` موفق باشد؛ اجرای Docker/CI خارجی یا عملیات حساس در این گام انجام نشود.
