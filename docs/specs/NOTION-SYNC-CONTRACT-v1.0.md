# Notion Sync Contract — v1.0

> Document ID: `HERO-SPEC-NOTION-SYNC-CONTRACT`
> Canonical path: `docs/specs/NOTION-SYNC-CONTRACT-v1.0.md`
> Title: Notion Sync Contract — v1.0
> Type: specification
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-operations
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## Outbound

Merge موفق در canonical branch، snapshot دقیق commit، validation، render، upsert بر اساس Document ID، ثبت mapping/checksum و health را فعال می‌کند. title یا path کلید idempotency نیست.

## Inbound

ویرایش Page مجاز پس از دریافت کامل Markdown، احراز mapping و actor، مقایسهٔ base checksum، normalization و validation به Change Proposal تبدیل می‌شود. Proposal پس از review یک branch/PR می‌سازد؛ merge تنها راه تغییر canonical است.

## Conflict

اگر source و Notion هر دو نسبت به base تغییر کرده باشند، state برابر `conflict` است و overwrite ممنوع است. `source-ahead` و `notion-ahead` نیز باید به‌صورت صریح نمایش داده شوند.

## گیت‌های ایمنی

- allowlist پیش‌فرض deny است؛
- classification داخلی و پایین‌تر فقط با تصمیم ثبت‌شده مجاز است؛
- external write runtime جدا از adapter configuration است؛
- retry، rate limit، outbox durable و dead-letter قبل از پایلوت چندسندی لازم‌اند؛
- sync failure نباید Product Studio را از کار بیندازد.

## وضعیت پیاده‌سازی

اولین sync در محیط فعلی ایجاد و با checksum دوباره‌اجرا شده است. mapping durable، webhook و inbound PR عمداً در این گام فعال نشده‌اند.
