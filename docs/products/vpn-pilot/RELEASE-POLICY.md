# VPN Pilot Release Policy

- Document ID: `HERO-PRODUCT-VPN-PILOT-RELEASE`
- Version: `1.0.0`
- Status: `proposed`
- Owner: `hero-operations`
- Scope: `product`

## مسیر انتشار

```text
Git commit/tag
  → VPN Test artifact
  → protocol/network acceptance evidence
  → owner review
  → explicit production authorization
  → same artifact in VPN Production
```

VPN Production از نو build نمی‌شود. version، commit SHA، Artifact ID/digest و نسخهٔ protocol configuration باید در Test و Production یکسان باشند. Secret و client key عمداً بین دو محیط یکسان نیستند.

## گیت‌های قبل از Test

- Product registry و owner ثبت شده باشد؛
- مقصد مستقل و firewall تأیید شده باشد؛
- configuration بدون Secret validate شده باشد؛
- کلید per-device در Secret Store Test باشد؛
- راه rollback و health check آماده باشد؛
- هیچ پورت، volume، network یا دامنهٔ پروژهٔ دیگر تغییر نکرده باشد.

## گیت‌های قبل از Production

- تمام معیارهای [Product Brief](PRODUCT-BRIEF.md) با Evidence واقعی پاس شده باشند؛
- تست حداقل دو شبکه و سه بازهٔ زمانی کامل باشد؛
- Verifier و Code Reviewer تأیید کرده باشند؛
- owner صریحاً Product را تأیید کرده باشد؛
- مجوز مستقل `production-deploy` و سقف هزینهٔ زیرساخت وجود داشته باشد؛
- recovery/backup و rollback واقعی ثبت شده باشد.

این سند مجوز خرید، ساخت، تغییر Secret یا deploy نیست. VPN runtime برای کارکرد خود به Provider AI نیاز ندارد؛ Provider AI فقط در صورت انتخاب برای توسعهٔ Hero و با گیت external-spend فعال می‌شود.
