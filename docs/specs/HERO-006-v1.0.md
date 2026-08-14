# HERO-006 v1.0 — موتور گردش کار و State Machine

وضعیت: مصوب برای توسعه و تست در 2026-08-14.

## هدف

Hero باید چرخهٔ عمر هر Run را به‌شکل قطعی، قابل‌توقف و قابل‌آزمون نگه دارد. هیچ Agent، Runner یا رابط کاربری نباید بتواند وضعیت Run را با نوشتن مستقیم تغییر دهد؛ هر تغییر فقط از یک فرمان معتبر و Event append-only عبور می‌کند.

## حالت‌ها و گذارهای مجاز

```text
Draft → Planned → Queued → Running → Awaiting review → Completed
                         ↘ Failed → Retry → Queued
Running / Queued / Planned / Awaiting review → Paused → Resume → حالت امن قبلی
هر حالت غیرنهاییِ مجاز → Cancelled
Completed و Cancelled نهایی هستند.
```

حالت‌های ماشین عبارت‌اند از `draft`، `planned`، `queued`، `running`، `awaiting-review`، `paused`، `failed`، `completed` و `cancelled`.

## فرمان‌ها و مرزها

- `plan` فقط Draft را به Planned می‌برد.
- `queue` فقط Planned را به Queued می‌برد.
- `start` فقط Queued را به Running می‌برد؛ این گام هنوز Runner واقعی را اجرا نمی‌کند.
- `request-review` فقط Running را به Awaiting review می‌برد. `approve-review` آن را Completed می‌کند و `request-changes` آن را به Running بازمی‌گرداند.
- `pause` حالت امن قبلی را ثبت می‌کند؛ `resume` دقیقاً همان حالت را بازمی‌گرداند.
- `fail` Run را Failed می‌کند. تنها `retry` آن را دوباره Queued می‌کند و شمار Retry را افزایش می‌دهد.
- `cancel` فقط Run غیرنهایی را Cancelled می‌کند. Completed و Cancelled هیچ گذار دیگری ندارند.

## Idempotency و هم‌زمانی

هر فرمان تغییر وضعیت یک `idempotencyKey` اجباری دارد. ارسال دوبارهٔ همان فرمان با همان کلید و همان payload همان Event و همان وضعیت را برمی‌گرداند و Event جدیدی ثبت نمی‌کند. استفادهٔ دوباره از کلید با payload متفاوت خطا است.

هر فرمان می‌تواند `expectedVersion` داشته باشد. اگر نسخهٔ درخواستی با نسخهٔ Run برابر نباشد، فرمان قبل از ثبت Event متوقف می‌شود. Event Log نیز همان optimistic concurrency را هنگام append اجرا می‌کند.

## Event و ایمنی

ایجاد Run با `run.drafted` و هر گذار با Event نوع‌دار مانند `run.planned`، `run.paused`، `run.resumed`، `run.retry-requested` یا `run.cancelled` ثبت می‌شود. Event شامل from/to state، شمار retry/review و دلیل ایمن است؛ Secret، Token و Password از مسیر قرارداد داده رد می‌شوند.

## محدودهٔ این گام

پیاده‌سازی فعلی Domain در حافظه و قطعی است تا تست‌ها بدون Provider، DB، Queue یا Runner واقعی اجرا شوند. Adapter آیندهٔ PostgreSQL باید همین قواعد idempotency، optimistic concurrency و append-only را حفظ کند. Runner ایزوله در HERO-008 و اتصال Agentها در گام‌های بعدی می‌آید.

## معیار پذیرش

1. State Machine صریح و تمام گذارهای Pause، Resume، Review، Failure، Retry و Cancel را کنترل کند.
2. تکرار همان فرمان Event جدید نسازد و reuse ناسازگار کلید خطا دهد.
3. تغییر هم‌زمانِ کهنه fail-closed شود.
4. Eventهای lifecycle با Event Log ایمن و append-only هم‌راستا باشند.
5. قرارداد، مستندات، endpoint نمای قرارداد و `pnpm check` موفق باشند.
