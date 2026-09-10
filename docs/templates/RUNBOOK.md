# Template: Runbook عملیاتی

## Metadata رجیستری

```text
Document ID: <RUNBOOK-ID>
Version: <SEMVER>
Status: <proposed|active|superseded|archived>
Owner: <OPERATIONS-OWNER>
Scope: <hero|product>
Review cadence: <per-release|quarterly|event-driven>
```

## هدف و محیط

سرویس، محیط مجاز، boundary منابع و نتیجهٔ مورد انتظار را مشخص کنید. Test و Production را در یک اجرا مخلوط نکنید.

## پیش‌نیاز و گیت‌ها

authorization snapshot، Global Stop، version، commit SHA، Artifact ID، backup و rollback point لازم را فهرست کنید.

## اجرای مرحله‌ای

هر فرمان باید scope محدود و نتیجهٔ قابل بررسی داشته باشد. از placeholder برای مسیر runtime و نام Secret استفاده کنید؛ مقدار واقعی را ننویسید.

## Validation

health، readiness، persistence، authentication، logs و تطبیق Artifact را بدون نمایش credential بررسی کنید.

## Rollback

شرط توقف، نقطهٔ بازگشت، مسئول تصمیم و تست پس از rollback را مشخص کنید.

## Evidence

زمان، actor، environment، version، commit SHA، Artifact ID/digest و نتیجهٔ واقعی را ثبت کنید. Secret، token، password و connection string ممنوع است.
