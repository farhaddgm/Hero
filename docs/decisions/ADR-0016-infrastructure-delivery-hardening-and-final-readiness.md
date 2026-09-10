# ADR-0016 — Infrastructure، Delivery، Hardening و Final Readiness

> Document ID: `HERO-ADR-0016`
> Canonical path: `docs/decisions/ADR-0016-infrastructure-delivery-hardening-and-final-readiness.md`
> Title: ADR-0016 — Infrastructure، Delivery، Hardening و Final Readiness
> Type: decision
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-architecture
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## تصمیم

نسخهٔ اول Hero دقیقاً سه محیط `development`، `test` و `production` دارد. ثبت Server و Repository فقط metadata و `secret-ref` نگه می‌دارد؛ هیچ اتصال شبکه‌ای، fetch از GitHub، bootstrap، یا تغییر Secret از این مسیر رخ نمی‌دهد. Node Agent از enrollment یک‌بارمصرفِ هش‌شده، fingerprint، heartbeat و rotation/revoke استفاده می‌کند؛ اختلاف desired/observed تنها Proposal می‌سازد و اجرای Reconciler به Dispatch جدا نیاز دارد.

دادهٔ Production فقط telemetry allowlisted و redacted است. payload واقعی کاربر به AI، Memory، Evaluation و Control Plane وارد نمی‌شود. Break-glass تنها یک درخواستِ scope/time/reason/audit است، نه دسترسی به داده. Release، Artifact و Delivery Bundle metadata نسخه‌دار و secret-free هستند؛ `deploy` و export هیچ‌کدام توسط این مدل انجام نمی‌شوند.

Retention حداقل‌های Hero را ضعیف نمی‌کند. Cleanup فقط dry-run/hold/digest-preserving plan است و حذف واقعی مجوز جدا می‌خواهد. فارسی و انگلیسی با شناسه‌های ASCII پایدار پشتیبانی می‌شوند؛ read-modelها صفحه‌بندی و Query budget دارند.

Readiness نهایی تنها پس از سناریوهای ایزوله، review و **رکورد صریح Owner** به `accepted` می‌رسد. پس از آن نیز Pilot فقط به `proposal-only` تبدیل می‌شود و اجرای آن یک Authorization مستقل لازم دارد.
