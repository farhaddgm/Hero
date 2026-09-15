# برنامهٔ همگام‌سازی انبوه Notion

> Document ID: `HERO-OPS-NOTION-BULK-SYNC-PLAN`
> Canonical path: `docs/operations/NOTION-BULK-SYNC-PLAN.md`
> Title: برنامهٔ همگام‌سازی انبوه Notion
> Type: operation
> Scope: cross-project
> Status: proposed
> Version: 1.0.0
> Owner: project-owner
> Review cadence: event-driven
> Supersedes: none
> Superseded by: none

## وضعیت فعلی

Catalog فعلی ۱۲۶ سند دارد. بر اساس default امن `internal`، هر ۱۲۶ سند از نظر فنی قابلیت mirror دارند و برای همهٔ آن‌ها Page و mapping پایدار ثبت شده است. پس از حل اختلاف کنترل‌شدهٔ ۲۰ مورد و sync تأییدشدهٔ دو سند جدید، شمارش نهایی PostgreSQL برابر ۱۲۶ `in-sync` و صفر `conflict` است. classification review روی همین snapshot انجام شد و ممیزی خودکار هیچ مورد Secret، PII یا endpoint زنده پیدا نکرد؛ این review به checksum همین snapshot مقید است. Blueprint شش‌بخشی و ۱۴ Database نیز در Notion ساخته و verify شده‌اند. علاوه بر اسناد و رجیستری‌های قبلی، بخش `15 — Execution and Task Management` شامل `Work Items`، `Tasks` و `Iterations` است. رودمپ ۵۰تایی، Objectiveها، Initiativeها، Work Itemها و Taskهای آن نیز projection شده‌اند. PostgreSQL Test اکنون migrationهای `001` تا `014` و جدول mapping را دارد. gate عمومی bulk نوشتن بسته است و مسیر auto-sync داخلی با authorization محدود فعال شده است.

## ترتیب اجرا

1. ثبت نتیجهٔ classification review برای snapshot جاری؛ انجام شد؛
2. ساخت و بررسی Workspace Blueprint؛ انجام شد؛
3. ثبت mapping پایدار در PostgreSQL؛ انجام شد؛
4. اجرای batch شمارهٔ ۱ با ۱۰ سند کم‌ریسک؛ انجام شد: ۹ synced، یک مورد already-in-sync؛
5. بررسی checksum، duplicate، rate-limit و conflict؛ انجام شد؛
6. اجرای batchهای ۲ تا ۱۳ با approval جدا؛ انجام شد و برای ۱۱۴ سند باقی‌ماندهٔ snapshot اولیه Page و mapping ساخته شد؛
7. راستی‌آزمایی مستقل GET Markdown و ثبت وضعیت mapping؛ انجام شد: snapshot اولیه ۱۰۴ `in-sync` و ۲۰ `conflict` داشت؛
8. حل اختلاف با authorization محدود و Git به‌عنوان canonical؛ انجام شد: هر ۲۰ مورد بازنویسی و بعد از GET مستقل تأیید شدند؛
9. sync دو سند جدید با authorization محدود؛ انجام شد: یک مورد `already-in-sync` و یک Page جدید ایجاد و verify شد؛
10. بررسی نهایی mappingها و بستن gate عمومی نوشتن؛ انجام شد: ۱۲۶ `in-sync` و صفر `conflict`.

## زمان‌بندی واقعی

پوشش snapshot اولیه در ۱۳ batch انجام شد: batch اول ۱۰ سند و batchهای ۲ تا ۱۳ مجموعاً ۱۱۴ سند را پوشش دادند. سپس ۲۰ conflict با authorization جداگانه حل شد و دو سندی که بعداً به Catalog اضافه شدند با sync محدود ثبت شدند. وضعیت نهایی mappingها ۱۲۶ `in-sync` و صفر `conflict` است؛ تغییرات آینده فقط با snapshot جدید، classification review و approval محدود جدید مجاز است.

## گزارش batchها

| بازهٔ batch | تعداد سند | نتیجه |
|---|---:|---|
| ۱ | ۱۰ | Page/mapping ایجاد شد؛ نتیجهٔ اولیه ۹ `synced` و ۱ `already-in-sync` |
| ۲ تا ۱۲ | ۱۱۰ | Page/mapping ایجاد شد؛ نتیجهٔ اولیه ۱۱۰ `synced` |
| ۱۳ | ۴ | Page/mapping ایجاد شد؛ نتیجهٔ اولیه ۴ `synced` |
| جمع snapshot اولیه | ۱۲۴ | پوشش Page/mapping: ۱۲۴؛ وضعیت قبل از حل اختلاف: ۱۰۴ `in-sync`، ۲۰ `conflict` |
| حل اختلاف کنترل‌شده | ۲۰ | overwrite فقط روی Pageهای موجود؛ نتیجه: ۲۰ `in-sync` |
| sync اسناد جدید | ۲ | یک `already-in-sync` و یک `created-and-verified` |
| وضعیت نهایی | ۱۲۶ | ۱۲۶ `in-sync`، صفر `conflict` |

## وضعیت نهایی و محدودیت

- منبع canonical همچنان Git است و Notion فقط projection کنترل‌شده است.
- در projection فعلی Notion، تعداد رکوردهای دارای منبع canonical این است: ۲ Product، ۱ Objective، ۲ Initiative، ۵۰ Roadmap Item، ۵۰ Work Item، ۵۰ Task، ۱ Iteration backlog و ۱۲۶ Document. `Sync Health` آخرین چرخه را ثبت می‌کند؛ Decisions، Evidence، Risks، Releases و Change Proposals تا زمان وجود state canonical واقعی رکورد حدسی دریافت نمی‌کنند.
- سرویس `notion-auto-sync` تغییرات جدید Git را در چرخهٔ حداکثر ۵ دقیقه‌ای بررسی و به Notion projection می‌کند. این مسیر فقط طبقه‌بندی `internal` را ارسال می‌کند و در conflict از overwrite خودکار صرف‌نظر می‌کند.
- هیچ سندی در snapshot فعلی به‌دلیل Secret، PII یا endpoint زنده از sync خارج نشد؛ شمارش heuristic هر سه مورد صفر بود.
- هیچ مجوز bulk دائمی فعال نشد؛ `bulk_write_approved=false` و `batch_write_approved=false` باقی مانده‌اند.
- ۱۲۶ سند در allowlist ثبت شده‌اند، اما allowlist به‌تنهایی مجوز اجرای آینده نیست؛ هر اجرای جدید باید دوباره gate شود.
- طبقه‌بندی edit class حفظ شده است؛ `mirror-only` و `protected-proposal` در Notion به معنی ویرایش آزاد نیستند.
- راستی‌آزمایی خواندن snapshot اولیه بدون خطای خواندن و بدون Page truncated انجام شد؛ همهٔ ۲۰ overwrite و هر دو sync جدید نیز با GET بعد از نوشتن verify شدند.
- Viewهای Notion (مثل Board برای Tasks یا Timeline برای Roadmap) از API قابل‌ساخت و مدیریت نیستند؛ Databaseها و داده‌ها آماده‌اند و Viewهای تصویری باید در UI Notion ساخته شوند.

## صف conflict

صف conflict فعلی خالی است. ۲۰ مورد قبلی با authorization `NOTION-CONFLICT-RESOLUTION-20260911-001` و با حفظ Git به‌عنوان canonical حل شدند؛ این authorization فقط روی Pageهای موجود اعمال شد و create/delete/archive نداشت.

## مرز ویرایش

قرارگرفتن همهٔ اسناد در Notion به معنی قابل‌ویرایش‌بودن همهٔ آن‌ها نیست. شمارش دقیق edit class باید با `pnpm notion:plan:batch` خوانده شود؛ وضعیت رسمی، Evidence و Authorization فقط خواندنی باقی می‌مانند.
