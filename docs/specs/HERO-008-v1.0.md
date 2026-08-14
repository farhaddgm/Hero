# HERO-008 v1.0 — Runner ایزوله و Git Worktree

وضعیت: مصوب برای توسعه و تست در 2026-08-14.

## هدف

هر Task باید تنها در یک محیط کاری مستقل اجرا شود تا تغییرات Agentها با پروژهٔ اصلی یا Task دیگر تداخل نداشته باشد. Runner پیش از شروع، تصمیم مجوزِ دقیق HERO-007 را می‌گیرد؛ سپس برای Run یک Git Worktree با مسیر نسبی امن، branch محدود و base ref فقط‌خواندنی آماده می‌کند.

## مرز ایزولاسیون

- `workspaceKey` فقط زیر `.hero/worktrees/` و بدون مسیر مطلق، `..` یا جداکنندهٔ ویندوزی معتبر است.
- branch هر Runner فقط با الگوی `hero/task/<id>` پذیرفته می‌شود و base ref تغییرپذیر نیست.
- شبکه به‌صورت پیش‌فرض `disabled` است؛ Runner در این گام هیچ Provider، Secret، پایگاه‌داده، Queue یا سرویس بیرونی را دریافت نمی‌کند.
- در تنظیم پیش‌فرض فقط یک Runner فعال و فقط یک Runner برای هر Task وجود دارد. Runner تا پایان cleanup سهم خود را نگه می‌دارد.

## پیش‌شرط مجوز

`prepare` و `start` باید یک تصمیم ساختاریافته با `authorized=true` و کد `AUTHORIZED` بگیرند. Step ID، نسخهٔ سند، Operation=`develop` و شناسهٔ مجوز باید دقیقاً با Runner یکسان باشند. Global Stop یا درخواست checkpoint خروجی fail-closed دارد و هیچ Workspace یا اجرای جدیدی شروع نمی‌شود.

## چرخهٔ عمر Runner

```text
Prepared → Running → Checkpoint requested → Checkpointed → Cancelled → Cleaned
                   └────────────────────────────→ Failed → Cleaned
```

Runner در حال اجرا مستقیم Cancel یا Clean نمی‌شود. ابتدا checkpoint امن درخواست و ثبت می‌شود؛ سپس Cancel و cleanup انجام می‌گیرد. Timeout از حالت Running یک رویداد `runner.failed` می‌سازد و cleanup فقط در حالت امنِ Checkpointed، Cancelled یا Failed مجاز است.

## رویداد و قابلیت بازیابی

`runner.prepared`، `runner.started`، `runner.checkpoint-requested`، `runner.checkpointed`، `runner.cancelled`، `runner.failed` و `runner.cleaned` همگی append-only هستند. هر فرمان idempotency key و expected version دارد؛ تکرار همسان پاسخ قبلی را می‌دهد و فرمان کهنه یا کلیدِ تکراری با payload متفاوت متوقف می‌شود.

## محدودهٔ این گام

موتور Runner و Worktree Port به‌صورت قطعی ساخته شده‌اند. Port در حافظه برای تست، isolation و cleanup را اثبات می‌کند و Git Worktree Port عملی، فقط با executor تزریق‌شده، فرمان‌های بدون `--force` را می‌سازد و قبل از حذف، پاک‌بودن Workspace را کنترل می‌کند. Control Plane هنوز هیچ executor، Git CLI، Container یا Agent زنده‌ای را instantiate نمی‌کند؛ اجرای واقعی Provider در گام اتصال Provider فعال می‌شود.

## معیار پذیرش

1. مسیر Worktree، branch، base ref، محدودیت هم‌زمانی و شبکهٔ بسته fail-closed کنترل شوند.
2. Prepare و Start بدون مجوز دقیق یا هنگام Global Stop ناممکن باشند.
3. checkpoint، cancellation، timeout، failure و cleanup با Event append-only و idempotency قابل‌آزمون باشند.
4. Endpoint نمای قرارداد Runner هیچ Run، مسیر میزبان یا اتصال زنده‌ای را افشا نکند.
5. قرارداد، مستندات و `pnpm check` با 48 تست موفق هم‌راستا باشند.
