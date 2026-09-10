# مدل دسترسی توسعهٔ محصول Hero

> Document ID: `HERO-GOV-PRODUCT-DEVELOPMENT-ACCESS`
> Canonical path: `docs/governance/PRODUCT-DEVELOPMENT-ACCESS-MODEL.md`
> Title: مدل دسترسی توسعهٔ محصول Hero
> Type: governance
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-governance
> Review cadence: quarterly
> Supersedes: none
> Superseded by: none

## اصل کمینه

دسترسی projection نباید از canonical بیشتر باشد. owner می‌تواند تصمیم و approval بدهد؛ admin عملیات فنی محدود دارد؛ Product team فقط محتوای Product مجاز را پیشنهاد می‌کند؛ Notion Integration فقط صفحات allow-listed و scope لازم را می‌بیند.

## مرزها

`mirror-only` برای Evidence، audit، Release، Authorization و وضعیت محاسبه‌شده است. `protected-proposal` برای governance، architecture، security و decision است. `proposal-editable` برای brief، PRD، research و روایت roadmap است. هیچ Notion edit مجوز dispatch، هزینه، Secret، deploy یا حذف تاریخچه نیست.

## طبقه‌بندی

مقدار پیش‌فرض `internal` است. `restricted`، PII، credential، raw prompt، access token و دادهٔ کاربر وارد Notion نمی‌شوند. تغییر classification یا allowlist نیازمند review مالک و ثبت Evidence است.

## fail-closed

عدم تطابق actor، mapping، checksum، repository، role یا classification باید درخواست را رد یا به comment/change request تبدیل کند؛ سیستم نباید با fallback مبهم ادامه دهد.
