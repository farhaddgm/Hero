# HERO-007 v1.0 — موتور تأیید، Snapshot اختیار کامل و توقف اضطراری

وضعیت: مصوب برای توسعه و تست در 2026-08-14.

## هدف

Hero باید قبل از هر Dispatch جدید دقیقاً بداند آیا همان Step ID، همان نسخهٔ سند و همان Operation مجاز است یا نه. نبود، ابهام، لغو، تغییر نسخه یا توقف اضطراری همگی fail-closed هستند؛ یعنی نتیجه «اجرا نکن» است.

## شکل مجوز

مجوز `direct` دقیقاً یک Step ID و یک document version را می‌بندد. مجوز `batch-snapshot` فهرست صریح و تغییرناپذیری از زوج‌های Step ID/document version دارد. Snapshot کلید باز یا عبارت «همهٔ گام‌های بعدی» نیست؛ Step یا نسخه‌ای که هنگام ساخت Snapshot وجود نداشته، خارج از آن است.

Operationهای توسعه شامل `design`، `document`، `version`، `develop`، `test`، `review` و `commit` هستند. Production deploy، حذف داده، هزینهٔ خارجی، تغییر Secret، پیام خارجی و عملیات برگشت‌ناپذیر هرگز از این مجوز ارث نمی‌برند.

## تصمیم Dispatch

```text
Global Stop فعال؟             → رد و درخواست checkpoint امن
Operation حساس؟               → رد؛ مجوز مستقل لازم است
مجوز یافت نشد یا لغو شد؟      → رد
Step ID یا نسخه سند نامنطبق؟  → رد
Operation خارج از دامنه؟      → رد
همهٔ تطبیق‌ها درست است؟       → مجاز
```

هر تصمیم یک code ساختاریافته دارد، از جمله `GLOBAL_STOP_ACTIVE`، `SNAPSHOT_ENTRY_NOT_FOUND`، `AUTHORIZATION_NOT_ACTIVE` و `SENSITIVE_OPERATION_REQUIRES_SEPARATE_APPROVAL`.

## لغو، Global Stop و Audit Trail

فقط `project-owner` می‌تواند مجوز بسازد، لغو کند، Global Stop را فعال یا آن را با فرمان صریح پاک کند. لغو append-only است و مجوز پاک یا ویرایش درجا نمی‌شود.

Global Stop تمام Dispatchهای جدید را فوراً رد می‌کند و `safeCheckpointRequired` را برای Runهای جاری اعلام می‌کند. خود Runner در HERO-008 باید در checkpoint امن Pause شود؛ این گام هیچ پردازش میزبان یا Agent واقعی را متوقف نمی‌کند.

Grant، revoke، Global Stop و نتیجهٔ هر بررسی Dispatch به Event Log وارد می‌شوند و Audit Trail قابل‌خواندن می‌سازند. هر فرمان دارای idempotency key است؛ تکرار همسان Event جدید نمی‌سازد و reuse ناسازگار کلید خطا می‌دهد.

## محدودهٔ این گام

پیاده‌سازی Domain در حافظه و قطعی است و هیچ API کلید، Provider، DB، Queue یا عمل خارجی ندارد. Adapter پایدار آینده باید دقیقاً همین تطبیق نسخه، fail-closed، append-only و idempotency را نگه دارد.

## معیار پذیرش

1. مجوز direct و batch Snapshot فقط Step ID و نسخهٔ ثبت‌شده را مجاز کنند.
2. Operation حساس هرگز مجاز نشود و فقط project-owner بتواند وضعیت حاکمیت را تغییر دهد.
3. revoke، Global Stop و پاک‌سازی صریح آن append-only و قابل‌آزمون باشند.
4. Dispatch در هر وضعیت ناشناخته یا ناسازگار fail-closed شود و Audit Trail داشته باشد.
5. قرارداد، ADR، endpoint نمای قرارداد و `pnpm check` موفق باشند.
