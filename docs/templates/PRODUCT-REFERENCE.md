# Template: ارجاع Product به کتابخانهٔ مرکزی

> این template محصول واقعی ثبت نمی‌کند. Product فقط پس از ثبت owner و Evidence در Product registry معتبر است.

## Product metadata

```text
Product ID: <PRODUCT-ID>
Name: <PRODUCT-NAME>
Owner: <OWNER-ROLE>
Status: <PRODUCT-STATUS>
Hero control plane: <HERO-DEPLOYMENT-IDENTITY>
Test environment document ID: <PRODUCT-TEST-DOCUMENT-ID>
Production environment document ID: <PRODUCT-PRODUCTION-DOCUMENT-ID>
Release policy document ID: <CANONICAL-RELEASE-DOCUMENT-ID>
```

## اسناد inherited

فقط Document ID و version اصول، environment model، امنیت و release flow مشترک را فهرست کنید. متن آن‌ها را کپی نکنید.

## اسناد اختصاصی

Document IDهای acceptance criteria، configuration غیرمحرمانه، Evidence، ADR و Runbook همان Product را فهرست کنید.

## محیط‌ها و Artifact

هویت Test و Production، boundary داده و شناسهٔ Artifact مورد انتظار را بدون Secret ثبت کنید. Artifact Production باید همان Artifact تأییدشدهٔ Test باشد.

## Review

وضعیت بررسی مالک، gapها و درخواست بازکاری را با reference ثبت کنید؛ تأیید از متن آزاد استنباط نمی‌شود.
