# Notion Workspace Schema — v1.0

> Document ID: `HERO-SPEC-NOTION-WORKSPACE-SCHEMA`
> Canonical path: `docs/specs/NOTION-WORKSPACE-SCHEMA-v1.0.md`
> Title: Notion Workspace Schema — v1.0
> Type: specification
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-operations
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## ساختار

Workspace با شش بخش `Control Center`، `Hero Product`، `Product Portfolio`، `Shared Knowledge`، `Decisions and Evidence` و `Integration and Sync Health` ساخته می‌شود. به‌صورت پیش‌فرض برای هر Product کوچک Teamspace جدا ساخته نمی‌شود؛ مرز دسترسی باید دلیل مستقل داشته باشد.

## Databaseها

Blueprint machine-readable در `packages/contracts/src/notion-product-development.mjs` شامل Products، Objectives، Initiatives، Roadmap Items، Documents، Decisions، Evidence، Risks، Releases، Change Proposals و Sync Health است.

## Properties اجباری Document

`Document ID`، Product ID، Type، Scope، Status، Version، Owner، Classification، canonical repository/path/commit، checksum، edit policy، sync state و زمان آخرین sync باید وجود داشته باشند. Page بدون اعلام canonicality معتبر نیست.

## وضعیت‌های نمایشی

Page باید یکی از bannerهای `in-sync`، `source-ahead`، `notion-ahead`، `conflict`، `blocked` یا `superseded` را نشان دهد. Evidence، Release و Authorization در Notion فقط mirror هستند.

## معیار پذیرش

اجرای `pnpm notion:plan` هیچ درخواست شبکه‌ای ارسال نمی‌کند و Blueprint، allowlist فعلی و گیت بعدی را بدون Secret چاپ می‌کند.
