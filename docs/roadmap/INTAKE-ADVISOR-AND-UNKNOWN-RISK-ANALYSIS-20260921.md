# تحلیل و اجرای: Intake Advisor و پاسخ «نمی‌دانم» برای ریسک پروژه

> Document ID: `HERO-ROADMAP-INTAKE-ADVISOR-AND-UNKNOWN-RISK-20260921`
> Canonical path: `docs/roadmap/INTAKE-ADVISOR-AND-UNKNOWN-RISK-ANALYSIS-20260921.md`
> Title: تحلیل و اجرای Intake Advisor و پاسخ «نمی‌دانم» برای ریسک پروژه — ۲۰۲۶-۰۹-۲۱
> Type: roadmap
> Scope: hero
> Status: active
> Version: 0.2.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

## وضعیت و هدف این یادداشت

این سند، تحلیل و رکورد اجرای یک بازخورد واقعی در جریان ایجاد یک وب‌سایت شخصی دوصفحه‌ای است. نسخهٔ ۰.۲.۰ پیاده‌سازی محلیِ پاسخ سه‌حالته، InfoTip و Advisor مرحلهٔ ایجاد را ثبت می‌کند. این تغییر مجوز فراخوانی Provider زنده، هزینهٔ بیرونی، انتشار یا اجرای پروژه نیست.

بازخورد دو نیاز متصل را نشان می‌دهد:

1. شش پرسش علامت ریسک در فرم ایجاد پروژه برای کاربر عادی مبهم‌اند. ادمین باید برای هر مورد توضیح کوتاه در دسترس داشته باشد و بتواند پاسخ را خالی/«نمی‌دانم» بگذارد، بدون آن‌که سیستم آن را «خیر» ثبت کند.
2. پس از پرشدن پنج پرسش نخست ایجاد پروژه، ادمین باید بتواند از Advisor متصلِ مجاز بخواهد برای تمام پرسش‌های بعدی پیشنهادهای قابل بازبینی بسازد و بر اساس بازخورد ادمین گزینهٔ تازه دریافت کند.

## مشاهدهٔ وضع موجود

فرم `Portfolio › تعریف پروژهٔ جدید` اکنون این شش checkbox را دارد: `internetFacing`، `personalData`، `regulatedData`، `securitySensitive`، `externalIntegrations` و `requiresPrivilegedAccess`. هیچ راهنمای inline یا InfoTip اختصاصی ندارد.

مدل دامنه نیز فقط boolean می‌پذیرد: `normalizeRiskFlags` هر مقداری جز `true` را `false` می‌کند. بنابراین «checkbox انتخاب‌نشده» و «اطلاعات ندارم» هر دو به شکل `false` ذخیره می‌شوند. این یک نقص یکپارچگی داده است: Hero نمی‌تواند نتیجه بگیرد که ریسک واقعاً بررسی و رد شده است. در نمونهٔ وب‌سایت شخصی، تفاوت میان «هنوز نمی‌دانم سایت عمومی می‌شود یا نه» و «قطعاً عمومی نیست» در گیت اجرای واقعی معنی‌دار است.

سرویس Form Suggestions/Advisor از پیش وجود دارد و سه پیشنهاد قابل بازبینی، refinement محدود و کنترل Provider را پشتیبانی می‌کند. با این حال Portfolio create dialog هنوز دکمه و قرارداد اختصاصی آن را ندارد. مهم‌تر اینکه `prepareFormSuggestionRequest` عمداً مقدارهای موجود فیلدهای فرم را از context Provider حذف می‌کند. این محافظ فعلی صحیح است، اما نیاز تازه—خواندن صریح پنج پاسخ نخست پس از درخواست ادمین—را پوشش نمی‌دهد.

## تصمیم‌های محصولی پیشنهادی

### ۱. پاسخ ریسک سه‌حالته، نه checkbox دوحالته

برای هر یک از شش پرسش ریسک، کنترل اصلی باید یکی از سه حالت زیر را داشته باشد:

- `yes` / بله؛
- `no` / خیر؛
- `unknown` / نمی‌دانم یا فعلاً ارزیابی نشده است.

حالت پیش‌فرض باید `unknown` باشد. حذف‌کردن پاسخ یا ردکردن dialog نباید آن را به `no` تبدیل کند. برای جلوگیری از تکرار بی‌مورد، کنترل می‌تواند در ظاهر radio group، segmented control یا select باشد، اما باید با صفحه‌کلید و screen reader قابل استفاده باشد.

در domain، پیشنهاد می‌شود پاسخ خام و نتیجهٔ طبقه‌بندی از هم جدا بمانند:

```text
riskAnswers: {
  internetFacing: "unknown" | "yes" | "no",
  personalData: "unknown" | "yes" | "no",
  regulatedData: "unknown" | "yes" | "no",
  securitySensitive: "unknown" | "yes" | "no",
  externalIntegrations: "unknown" | "yes" | "no",
  requiresPrivilegedAccess: "unknown" | "yes" | "no"
}
```

`riskFlags` می‌تواند برای سازگاری کوتاه‌مدت فقط بازتاب پاسخ‌های `yes` باشد، اما نباید به‌تنهایی حقیقت تصمیم شود. `riskAssessment` باید `completeness: complete | needs-review` و فهرست پرسش‌های `unknown` را نیز نمایش دهد.

پاسخ ناشناخته در Draft و Foundation مجاز است؛ این همان اختیاری‌بودن مدنظر ادمین است. اما در اجرای Test، اتصال بیرونی، دریافت/ارسال دادهٔ واقعی، هزینهٔ بیرونی و Production، Gate باید بررسی کند که فقط پرسش‌های مرتبط با اثر پیشنهادی تعیین تکلیف شده‌اند. «ناشناخته» هرگز معادل مجوز یا «خیر» نیست.

### ۲. InfoTip دقیق برای شش پرسش

هر label باید یک دکمهٔ اطلاعاتی کوچک، دارای متن قابل‌خواندن و هدف مشخص داشته باشد. Tooltip صرفِ hover کافی نیست؛ متن باید با focus و لمس نیز در دسترس باشد. توضیح پیشنهادی:

| فیلد | تعریف برای ادمین | اثر تصمیم |
|---|---|---|
| دسترسی عمومی یا اینترنتی | آیا کاربر بیرون از شبکهٔ خصوصی Hero می‌تواند به محصول یا API آن دسترسی بگیرد؟ | نیازمند کنترل سطح مواجهه، احراز هویت و گیت انتشار است. |
| دادهٔ شخصی | آیا نام، ایمیل، شماره تماس، شناسهٔ فرد یا دادهٔ قابل انتساب به انسان ذخیره، نمایش یا پردازش می‌شود؟ | مرز داده، دسترسی و نگه‌داری باید روشن شود. |
| داده یا حوزهٔ مقرراتی | آیا محصول با سلامت، مالی، حقوقی، هویتی یا الزام قانونی خاص درگیر است؟ | ممکن است تأیید و کنترل اضافی لازم باشد. |
| امنیت یا زیرساخت حساس | آیا محصول به امنیت، سرور، شبکه، دسترسی، کلید یا تنظیمات زیرساخت مربوط است؟ | ریسک عملیاتی و بازبینی امنیتی افزایش می‌یابد. |
| اتصال به سرویس بیرونی | آیا محصول به API، پرداخت، ایمیل، شبکهٔ اجتماعی، Analytics یا سرویس خارجی وصل می‌شود؟ | اتصال و هزینه/دادهٔ خروجی مجوز جداگانه می‌خواهد. |
| دسترسی سطح‌بالا | آیا ساخت/اجرا ممکن است به sudo، Docker socket، Secret، شبکهٔ میزبان یا دسترسی مدیر نیاز داشته باشد؟ | اجرای واقعی تا تأیید صریح قفل می‌ماند. |

### ۳. Advisor برای پاسخ‌های ۶ تا ۱۶

پیش‌شرط دکمهٔ «پیشنهاد از Advisor» تکمیل پنج مقدار زیر است: `projectId`، `name`، `description`، `goal` و `users`. در نسخهٔ اجراشده، این پنج فیلد نیز در فرم ایجاد required هستند تا Advisor و ثبت نهایی یک تعریف ناقص را متفاوت تفسیر نکنند.

Advisor باید تنها برای این فیلدهای مقصد پیشنهاد بدهد: `projectType`، `riskLevel`، `autonomy`، `constraints`، `expectedOutputs` و شش `riskAnswers`. پیشنهاد باید دقیقاً با گزینه‌های معتبر فرم محدود شود. برای ریسک، Advisor مجاز است `unknown` پیشنهاد دهد و نباید برای پنهان‌کردن عدم قطعیت، خودکار `no` برگزیند.

جریان پیشنهادی UI:

1. ادمین پنج مقدار نخست را پر می‌کند و Advisor محلی Hero را انتخاب می‌کند؛ این حالت بدون هزینه و بدون فراخوانی بیرونی در دسترس است.
2. ادمین آگاهانه «ساخت پیشنهاد» را می‌زند. قرارداد محلی دقیقاً همان پنج مقدار allowlist‌شده را برای ساخت پیشنهاد مصرف می‌کند؛ مقدارها در پروژه یا audit ثبت نمی‌شوند.
3. Hero سه کارت متفاوت، rationale و decision support نشان می‌دهد. هیچ کارت به‌خودی‌خود پروژه را ثبت نمی‌کند.
4. «اعمال این پیشنهاد» فقط فیلدهای ۶ تا ۱۶ را در dialog پر می‌کند. ادمین می‌تواند همه را ویرایش یا به `unknown` برگرداند و سپس با دکمهٔ فعلی ثبت پروژه، تصمیم نهایی را جداگانه ثبت کند.
5. در Advisor محلی، ادمین می‌تواند feedback متنی امن بدهد و سه گزینهٔ تازهٔ قابل بازبینی دریافت کند؛ feedback خام در Audit/event یا فرم ذخیره نمی‌شود. Provider زنده در این نقطه عمداً غیرفعال است، زیرا هنوز Project و authorization snapshot پروژه‌محور وجود ندارد.

### ۴. مرز داده، مجوز و هزینه

قرارداد عمومی Form Suggestions باید تغییر داده نشود تا ناخواسته تمام فرم‌ها ارزش‌های موجود را به Provider نفرستند. برای Portfolio create dialog، یک contract جداگانه و allowlist‌شده—برای مثال `project-intake-advisor-v1`—باید دقیقاً پنج مقدار نخست را پس از validate و با رضایت ناشی از action ادمین وارد context کند.

این context باید طول، الگوی Secret، مسیر میزبان و دادهٔ حساس شناخته‌شده را مانند قرارداد فعلی رد کند. هیچ credential، فایل، URL خصوصی، Cookie، token یا متن feedback قبلی نباید وارد Provider شود. Audit فقط metadata ایمن مانند actor، advisor profile، شمار کارت، نتیجهٔ apply/reject و شناسهٔ invocation را ثبت می‌کند؛ متن پنج پاسخ، prompt و پاسخ خام Provider در event/timeline ذخیره نمی‌شود.

فراخوانی Advisor زنده همچنان باید تابع نقش Owner/Admin، profile dispatch-ready، External Spend Authorization با `projectId`/`stepId`/`documentVersion` منطبق و `Global Stop=false` باشد. چون این شروط پیش از ثبت Project قابل اثبات نیستند، UI profileهای زنده را فقط با برچسب «پس از ثبت پروژه» نشان می‌دهد و endpoint آن‌ها را fail-closed رد می‌کند. نبود اتصال یا مجوز، Local Advisor یا مسیر دستی را مختل نمی‌کند. Advisor هیچ‌گاه مجاز به ثبت پروژه، تغییر ریسک مصوب، فعال‌کردن integration یا اجرای Provider دیگر نیست.

## اثر فنی پیش‌بینی‌شده

دامنهٔ توسعهٔ بعدی به احتمال زیاد این لایه‌ها را دربر می‌گیرد:

- `apps/control-plane/src/portfolio-view.mjs`: کنترل‌های سه‌حالته، InfoTip، Advisor dialog، preview اعمال و نگه‌داری session در مرورگر؛
- `packages/domain/src/product-factory.mjs` و contractهای مربوط: model/validator پاسخ ناشناخته، completeness و رفتار Gate؛
- `apps/control-plane/src/server.mjs`: endpoint و authorization اختصاصی advisor برای Draft intake؛
- `packages/domain/src/form-suggestions.mjs`: contract opt-in برای context allowlist‌شده، schema و validation نتایج؛
- migration و adapter persistence: نگه‌داری پاسخ‌ها و migration دادهٔ boolean قدیمی با provenance روشن؛
- testهای domain، API، UI، authorization، Global Stop، redaction، cost authorization، keyboard accessibility و regression موجود.

این تغییر نباید مسیرهای Secret، provider credential، Deploy یا mutation محصول را به Portfolio dialog اضافه کند.

## نتیجهٔ اجرای نسخهٔ ۰.۲.۰

- فرم Portfolio اکنون برای هر شش علامت ریسک select سه‌حالته با پیش‌فرض `unknown` و InfoTip قابل‌دسترسی دارد. `riskFlags` از UI ارسال نمی‌شود.
- Domain پاسخ‌های `riskAnswers`، `unknownRiskFlags` و `completeness: needs-review` را نگه می‌دارد؛ booleanهای تاریخیِ `false` در hydration به `unknown` تبدیل می‌شوند و فقط `true` تاریخی به `yes` نگاشت می‌شود.
- دکمهٔ Advisor تا تکمیل پنج فیلد نخست غیرفعال است. endpointهای `/api/project-intake-advisor` و `/refine` فقط پیشنهادهای local/review-only برمی‌گردانند؛ نه Project ثبت می‌کنند، نه event/audit می‌نویسند و نه Provider را فراخوانی می‌کنند.
- کارت «اعمال در فرم» فقط فیلدهای مقصد را پر می‌کند. ثبت پروژه همچنان تنها با submit مستقل فرم ایجاد ممکن است.
- profileهای زنده در dialog صرفاً به‌عنوان گزینهٔ بعد از ثبت Project نشان داده می‌شوند و endpoint، هر انتخاب زنده را fail-closed رد می‌کند. این یک مرز عمدی برای جلوگیری از هزینه یا binding بی‌scope است.
- اجرا شامل انتشار یا deploy نیست. Provider زنده، External Spend Authorization و Global Stop تغییر نکرده‌اند.

## تصمیم تأییدشدهٔ مرتبط — حذف Intake تکراری

در بازبینی جریان واقعی، Owner تأیید کرد که پرسیدن دوبارهٔ `goal`، `users` و `autonomy` پس از ثبت همان سه مقدار در فرم ایجاد پروژه سود تصمیمی ندارد. این مرحله از Walk-Through و Workspace حذف می‌شود؛ فرم ایجاد پروژه تنها محل ثبت اولیه است و پس از آن lifecycle مستقیم به `foundation-review` می‌رود. برای اصلاح‌های بعدی، UI آیندهٔ «ویرایش تعریف پروژه» باید همان مدل پاسخ ریسک و Advisor این سند را به‌کار گیرد؛ بازگرداندن یک مرحلهٔ Intake تکراری راه‌حل مجاز نیست.

## معیار پذیرش پیشنهادی

1. یک ادمین بتواند هر شش مورد را واقعاً `unknown` ثبت کند و API/DB آن را از `no` تشخیص دهد.
2. هر InfoTip معنی، اثر و مرز تصمیم همان فیلد را بدون hover توضیح دهد.
3. Advisor تا تکمیل پنج مقدار نخست غیرفعال و علت آن روشن باشد.
4. سه پیشنهاد فقط گزینه‌ها و مقدارهای معتبر فیلدهای ۶ تا ۱۶ داشته باشند؛ apply هیچ ثبت خودکاری انجام ندهد.
5. refinement محلی بدون هزینه و فقط در حافظهٔ گذرای dialog ممکن باشد؛ Provider زنده پیش از ثبت Project fail-closed بماند و پس از آن تنها با مجوز هزینه معتبر، Step/Document version منطبق و Global Stop خاموش بررسی شود.
6. هیچ مقدار حساس، پاسخ پنج‌گانه، feedback خام یا output خام Provider در event/audit/read model افشا یا ذخیره نشود.
7. Projectهای قدیمی با booleanهای موجود قابل خواندن بمانند و migration آن‌ها «عدم‌قطعیتِ تاریخی» را به‌دروغ «خیرِ تأییدشده» نسازد.
8. `pnpm check` پس از توسعهٔ واقعی pass شود و Evidence فقط با نتیجهٔ واقعی آن اجرا به‌روز شود.

## ترتیب توسعهٔ پیشنهادی

ابتدا مدل و migration پاسخ‌های ریسک، سپس testهای domain و Gate، بعد endpoint/contract Advisor، سپس UI و accessibility، و در پایان تست‌های end-to-end انجام شود. قبل از هر dispatch زنده، authorization snapshot باید Step ID و Document Version فعال را تأیید کند و Global Stop خاموش باشد. این ترتیب مانع می‌شود UI زیبا اما منطق ریسک یا مرز هزینه نادرست ساخته شود.

## تصمیم‌های باز برای دستور بعدی مالک

- تعیین متن نهایی فارسی و انگلیسی InfoTipها و اینکه InfoTip در موبایل dialog باشد یا popover؛
- تعیین اینکه پاسخ‌های `unknown` تا Foundation کافی‌اند یا برای شروع Test نیز باید همگی resolve شوند؛
- تعیین Provider/profile پیش‌فرض Advisor و بودجهٔ مجاز آن؛
- تعیین اینکه پیشنهادهای Advisor صرفاً موقتی‌اند یا metadata غیرحساس آن‌ها برای مقایسهٔ کیفیت نگه‌داری می‌شود.
