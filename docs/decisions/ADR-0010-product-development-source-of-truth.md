# ADR-0010 — مرز منبع حقیقت در سیستم توسعهٔ محصول

> Document ID: `HERO-ADR-0010`
> Canonical path: `docs/decisions/ADR-0010-product-development-source-of-truth.md`
> Title: ADR-0010 — مرز منبع حقیقت در سیستم توسعهٔ محصول
> Type: decision
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: quarterly
> Supersedes: none
> Superseded by: none

## تصمیم

Git منبع حقیقت محتوای canonical سند، نسخه، commit و تاریخچه است. Event Store/PostgreSQL منبع حقیقت وضعیت عملیاتی، proposal، mapping و audit است. Notion، Product Studio، Search و cache فقط projection یا proposal surface قابل بازسازی‌اند.

Notion حق تغییر مستقیم فایل canonical، Evidence، Authorization، Release approval یا وضعیت محاسبه‌شده را ندارد. هر ویرایش مجاز Notion باید با `Document ID`، base checksum و actor به Change Proposal تبدیل شود و فقط پس از review و merge وارد Git شود.

## قواعد اجرایی

1. Upsert خروجی Git به Notion با `Document ID` انجام می‌شود، نه عنوان یا مسیر.
2. هر Page باید canonical commit، checksum، edit policy و sync state را نشان دهد.
3. تعارض checksum، نبود mapping، classification نامعلوم یا دسترسی نامشخص، sync را متوقف می‌کند.
4. ارسال بیرونی فقط برای allowlist نسخه‌دار و با مجوز runtime جدا مجاز است.
5. خاموش‌کردن Notion نباید Product Studio یا دسترسی به اسناد Git را مختل کند.

## پیامدها

این تصمیم از دو منبع حقیقت متناقض جلوگیری می‌کند و امکان جایگزینی Notion را حفظ می‌کند. در عوض، inbound editing به mapping، diff، review، PR و outbox نیاز دارد و ویرایش Notion فوراً canonical نمی‌شود.

## شواهد و Review

قراردادهای اجرایی در `packages/contracts/src/product-roadmap.mjs` و `packages/contracts/src/notion-product-development.mjs`، و اولین sync idempotent در Evidence عملیاتی Notion ثبت شده است.
