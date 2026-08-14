# HERO-015 v1.0 — Planner، Task Graph و Router هوشمند

وضعیت: مصوب

## هدف

Hero یک درخواست سادهٔ فارسی را به Spec نسخه‌دار، فرض‌های روشن، معیارهای پذیرش و Task Graph معتبر تبدیل می‌کند؛ سپس برای هر Task دلیل انتخاب Agent را ثبت می‌کند.

## طراحی این نسخه

1. Planner بدون فراخوانی provider زنده، متن درخواست را تحلیل می‌کند و پلتفرم وب/موبایل را از متن تشخیص می‌دهد. اگر پلتفرم روشن نباشد، فرض «وب برای مسیر سریع» را صریح ثبت می‌کند.
2. Spec شامل نیت کاربر، فرض‌ها، معیارهای پذیرش و ارجاع Context فقط‌خواندنی است. Context غیرآماده یا نامنطبق با `CONTEXT_NOT_READY` fail-closed می‌شود.
3. Task Graph شامل analysis، architecture، implementation، testing، review و handoff است. وابستگی‌ها یکتا و بدون چرخه‌اند و هر گره پیش از Dispatch قابل توقف است.
4. Router فقط میان ابزارهای فعلی انتخاب می‌کند: ChatGPT برای تحلیل/طراحی، Codex برای توسعه/تست، Claude برای review مستقل و Cursor فقط برای handoff انسانی.
5. خروجی موفق `PLAN_READY` است. Plan هیچ Runner نمی‌سازد و مجوز، merge، deploy، secret، هزینه یا عملیات حساس را دور نمی‌زند.

## معیار پذیرش

- درخواست فارسی به Spec و DAG قابل‌فهم و معتبر تبدیل شود.
- انتخاب Agent و دلیل آن برای هر Task ثبت شود.
- Graph بتواند پیش از Dispatch به‌صورت امن متوقف شود.
- Router خارج از ChatGPT/Codex، Claude و Cursor مسیری انتخاب نکند.
