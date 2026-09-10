# Product Catalog و Document Catalog — v1.0

> Document ID: `HERO-SPEC-PRODUCT-DOCUMENT-CATALOG`
> Canonical path: `docs/specs/PRODUCT-CATALOG-DOCUMENT-CATALOG-v1.0.md`
> Title: Product Catalog و Document Catalog — v1.0
> Type: specification
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## هدف

Catalog باید از snapshot مخزن به‌شکل deterministic ساخته شود و Product، سند، مالکیت، lifecycle، checksum، edit policy و ارتباط‌های آن‌ها را بدون نیاز به Notion نمایش دهد.

## قرارداد Product

`product_id`، نام، owner، status، repository contract، `docs_root`، اسناد inherited، اسناد اختصاصی، risk profile و سیاست Notion شناسه‌های اصلی‌اند. Secret، token، host path، connection string و credential reference خام ممنوع است.

## قرارداد Document

هر سند باید `id`، مسیر نسبی امن، title، type، scope، status، SemVer، owner، canonical flag، supersession و review cadence داشته باشد. checksum و source commit هنگام index ساخته می‌شوند و metadata محاسبه‌شدهٔ snapshot هستند.

## رفتار rebuild

1. رجیستری‌ها از Git خوانده می‌شوند.
2. وجود فایل، یکتایی ID و path، روابط Product و policy ویرایش بررسی می‌شوند.
3. digest از snapshot ساخته می‌شود.
4. projectionهای Product Studio و Notion فقط از snapshot معتبر ساخته می‌شوند.
5. خرابی یک Product نباید محتوای Product دیگر را تغییر دهد.

## معیار پذیرش

- snapshot تکراری برای ورودی یکسان digest یکسان دارد؛
- سند گمشده، رابطهٔ شکسته، duplicate ID و path خارج از مخزن fail-closed هستند؛
- Catalog بدون Notion قابل خواندن است؛
- Document ID با rename مسیر تغییر نمی‌کند.
