# ADR-0012 — هویت انسانی و ProjectGrant با deny-by-default

> Document ID: `HERO-ADR-0012`
> Canonical path: `docs/decisions/ADR-0012-human-identity-and-project-grants.md`
> Title: ADR-0012 — هویت انسانی و ProjectGrant با deny-by-default
> Type: decision
> Scope: cross-project
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## تصمیم

Hero سه نقش انسانی ثابت دارد: `project-owner`، `admin` و `viewer`. Owner به همهٔ پروژه‌ها دسترسی کامل دارد، اما تنها Owner می‌تواند کاربر دعوت/حذف کند، ProjectGrant بدهد یا بگیرد، پروژه بسازد/Archive کند و Secret را Reveal کند. Admin فقط در Projectهای دارای Grant فعال می‌تواند تغییر بدهد؛ Viewer فقط همان Projectها را می‌خواند.

هیچ API انسانی بدون `project_id` برای خواندن یا تغییر دادهٔ Project-scoped مجاز نیست. Middleware مشترک همان `project_id` را برای authorization، cache، storage، queue و event key تولید می‌کند تا scope در یکی از لایه‌ها فراموش نشود.

## Authentication و Recovery

Identity جدید با email/password کار می‌کند. MFA برای Owner و Admin اجباری و برای Viewer اختیاری است. نشست MFA timestamp دارد؛ Reveal Secret و درخواست Production به step-up MFA تازه نیاز دارند. پس از recovery، این عملیات تا پایان cooldown مسدود است.

بازیابی Owner به ایمیل تأییدشده متکی است ولی تنها با ایمیل کامل نمی‌شود: email code به‌علاوهٔ recovery code آفلاین یا تأیید Console خصوصی لازم است. recovery تمام نشست‌های فعال همان Owner را revoke می‌کند و در Audit ثبت می‌شود. Secret، password، TOTP secret و recovery code هرگز در Event، Audit، response یا export ذخیره نمی‌شوند؛ در PostgreSQL فقط `mfa_secret_ref` مجاز است.

## پیامدها

مسیرهای Bearer قدیمی Owner/Admin تا migration کامل سازگار می‌مانند. APIهای Project-scoped جدید فقط در صورت پیکربندی Identity فعال‌اند و در نبود آن fail-closed هستند. این تصمیم هیچ مجوز Production، Reveal Secret یا پیام بیرونی ایجاد نمی‌کند.
