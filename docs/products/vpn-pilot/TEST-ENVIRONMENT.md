# VPN Pilot Test Environment

- Document ID: `HERO-PRODUCT-VPN-PILOT-TEST`
- Version: `1.0.0`
- Status: `proposed`
- Owner: `hero-operations`
- Scope: `product`

## Boundary

این محیط فقط برای `HERO-PRODUCT-VPN-PILOT-001` است. مقصد باید VPS یا VM مستقل Linux باشد و منابع آن با Hero، `ai-assistant` یا هر پروژهٔ دیگر shared نباشد. استفاده از سرور مشترک فعلی برای VPN Pilot ممنوع است تا پورت، route، firewall، volume و availability سرویس‌های موجود درگیر نشوند.

منابع با این الگوی منطقی نام‌گذاری می‌شوند:

```text
hero-vpn-test-runtime
hero-vpn-test-network
hero-vpn-test-data
hero-vpn-test-secrets
```

نام واقعی host، IP، دامنه و credential در این سند ثبت نمی‌شود.

## Protocol matrix

| مسیر | انتقال | کاربرد | شرط آزمون |
|---|---|---|---|
| Primary | AmneziaWG/UDP | سرعت و masking در صورت عبور UDP | حداقل یک پورت آزاد، بدون reuse config |
| Fallback | XRay VLESS Reality/TCP 443 | مسیر جایگزین در شبکه‌ای که UDP یا signature مسیر اصلی را محدود می‌کند | پورت 443 آزاد و SNI/config معتبر |

اگر یک مسیر در شبکه‌ای شکست خورد، آن شکست Evidence است؛ نباید بدون ثبت علت، تنظیمات تصادفی یا credential مشترک تولید شود.

## Secret boundary

Private key سرور، کلید هر device، client configuration، Reality key و هر credential فقط در Secret Store همان محیط قرار می‌گیرند. در repository فقط template بدون مقدار واقعی مجاز است. برای هر device فایل جدا بسازید و فایل یک device را روی دستگاه دیگر reuse نکنید.

## Test matrix

برای هر شبکهٔ آزمون این موارد ثبت می‌شود:

- نام غیرحساس شبکه یا operator؛
- تاریخ و بازهٔ زمانی؛
- protocol و artifact version؛
- تعداد تلاش، زمان اتصال و reconnect؛
- throughput و baseline؛
- DNS leak و kill-switch؛
- نتیجهٔ fallback؛
- علت failure، بدون IP خصوصی، credential یا محتوای ترافیک.

حداقل دو شبکهٔ مستقل و سه بازهٔ زمانی لازم است. اگر فقط یک شبکه در دسترس باشد، نتیجه برای تصمیم‌گیری `partial` است و Product accepted نمی‌شود.

## عملیات مجاز و غیرمجاز

مجاز: ساخت Test artifact، اجرای health check، اتصال آزمایشی مالک، جمع‌آوری metadata غیرمحرمانه، rollback و rotation کلیدهای Test.

غیرمجاز بدون مجوز جدا: خرید VPS، بازکردن پورت روی سرور مشترک، تغییر DNS عمومی، Production، فروش/اشتراک عمومی، خواندن ترافیک کاربران یا ارسال داده به Provider بیرونی.
