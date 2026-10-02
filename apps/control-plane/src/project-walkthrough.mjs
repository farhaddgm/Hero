/**
 * The Walk-Through is deliberately a navigation and decision aid, not an
 * execution engine.  It contains no credentials, project content, or hidden
 * actions.  The project view evaluates the completion checks against the
 * project-scoped read model before it marks a setup step complete.
 */
export const HERO_PROJECT_WALKTHROUGH_VERSION = "1.9.0";
export const HERO_PROJECT_WALKTHROUGH_STATE_VERSION = 1;
export const HERO_PROJECT_WALKTHROUGH_ENABLED_SETTING = "backoffice.walkthrough.enabled";

const SENSITIVE_ASSIGNMENT = /(?:\b(?:password|secret|credential|api[ _-]?key|token|mfa|توکن|رمز(?:\s*عبور)?|کلید\s*api)\b\s*[:=])\s*\S+/iu;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/iu;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|opt)\/)/u;

export const HERO_PROJECT_WALKTHROUGH_STEPS = Object.freeze([
  Object.freeze({
    id: "identity",
    nextId: null,
    phase: "امکانات خارج از فرایند اصلی",
    flow: "outside-main",
    title: "ورود به حساب انسانی",
    summary: "ابتدا از مرز شبکه عبور کنید و سپس با حساب انسانی و MFA وارد Hero شوید.",
    route: "/identity",
    target: "identity.human-login",
    actionLabel: "باز کردن هویت و دسترسی",
    completion: "human-session",
    availability: "available",
    instructions: Object.freeze([
      "اگر مرورگر پنجرهٔ Basic Auth نشان داد، فقط اطلاعات Gate 1 را وارد کنید.",
      "در فرم «ورود انسانی»، Email و Password مربوط به Gate 2 را وارد کنید؛ این رمز با رمز Basic یکی نیست.",
      "کد شش‌رقمیِ در حال تغییر Authenticator را در مرحلهٔ MFA وارد کنید؛ Secret را وارد نکنید."
    ])
  }),
  Object.freeze({
    id: "project-selection",
    nextId: "create-project",
    phase: "تعریف Scope",
    flow: "main",
    title: "انتخاب یا ایجاد پروژه",
    summary: "Portfolio تنها نمای چندپروژه‌ای Hero است. پیش از هر اقدام، یک پروژه انتخاب کنید.",
    route: "/portfolio?select=project&next=walkthrough",
    target: "portfolio.project-selection",
    actionLabel: "باز کردن Portfolio",
    completion: "selected-project",
    availability: "available",
    instructions: Object.freeze([
      "برای ادامهٔ یک پروژهٔ موجود، کارت همان پروژه را انتخاب کنید.",
      "اگر پروژه هنوز وجود ندارد و نقش شما Owner است، «پروژهٔ جدید» را انتخاب کنید.",
      "Admin و Viewer نمی‌توانند پروژه بسازند؛ Owner باید پروژه را ایجاد و Project Grant را اختصاص دهد."
    ])
  }),
  Object.freeze({
    id: "create-project",
    nextId: "inputs",
    phase: "تعریف Scope",
    flow: "main",
    title: "تعریف پروژهٔ جدید",
    summary: "ثبت تعریف اولیه، پروژه را مستقیم وارد بازبینی Foundation می‌کند؛ هنوز اجرای Provider، سرور یا Production رخ نمی‌دهد.",
    route: "/portfolio?select=project&next=walkthrough",
    target: "portfolio.create-project",
    actionLabel: "باز کردن فرم پروژهٔ جدید",
    completion: "selected-project",
    availability: "owner-only",
    optional: true,
    instructions: Object.freeze([
      "Project ID را یکتا، کوچک و با خط تیره وارد کنید؛ نمونه: project-vpn. این شناسه بعداً در URL و API استفاده می‌شود.",
      "نام و توضیح کوتاه را برای تشخیص انسانی پروژه ثبت کنید.",
      "در همان فرم، هدف، کاربران هدف و سطح خودکارسازی اولیه را وارد کنید. پیش‌فرض امن «تأیید در هر مرحله» است.",
      "پس از ثبت، Hero مستقیم وارد بازبینی Foundation می‌شود و شما وارد Scope همان پروژه می‌شوید."
    ])
  }),
  Object.freeze({
    id: "inputs",
    nextId: "foundation",
    phase: "پایهٔ محصول",
    flow: "main",
    title: "ثبت ورودی‌های پروژه",
    summary: "اگر نمونه، Brief، متن نیازمندی یا لینک عمومی دارید، آن را اختیاری ثبت کنید؛ نداشتن ورودی مانع ادامهٔ ساخت محصول نیست.",
    route: "/workspace",
    target: "workspace.project-inputs",
    actionLabel: "باز کردن ورودی‌های پروژه",
    completion: "optional-input",
    availability: "available-with-limits",
    optional: true,
    instructions: Object.freeze([
      "برای متن، نام فایل معنادار مانند brief.txt انتخاب و متن نیازمندی را وارد کنید؛ سپس «ثبت ورودی متن» را بزنید.",
      "برای یک مرجع وب، فقط URL عمومی HTTPS و عنوان را ثبت کنید؛ این ثبت، به معنی fetch یا اجرای خودکار لینک نیست.",
      "Secret، رمز، کلید API، دادهٔ شخصی یا فایل اجرایی را وارد نکنید.",
      "آپلود همهٔ قالب‌ها، اسکن بدافزار و parser ایزوله هنوز گیت کامل نشده‌اند؛ فقط وضعیت واقعی ثبت‌شده را مبنای تصمیم قرار دهید."
    ])
  }),
  Object.freeze({
    id: "foundation",
    nextId: "settings",
    phase: "پایهٔ محصول",
    flow: "main",
    title: "بازبینی و تأیید Foundation",
    summary: "Foundation یک پیشنهاد نسخه‌دار از تیم‌ها، رودمپ، سیاست و پایهٔ معماری است؛ تأیید آن پروژه را فعال می‌کند.",
    route: "/workspace",
    target: "workspace.foundation",
    actionLabel: "باز کردن Foundation",
    completion: "foundation-approved",
    availability: "available",
    instructions: Object.freeze([
      "در کارت Foundation Proposal، وضعیت و تعداد گام‌های پیشنهادی را بررسی کنید.",
      "اگر نیاز به اصلاح دارید، دلیل مشخص بنویسید و «درخواست بازنگری» را انتخاب کنید؛ تاریخچه حذف نمی‌شود.",
      "اگر پایه با هدف پروژه منطبق است، «تأیید Foundation» را بزنید. فقط Owner یا Admin مجاز می‌تواند این تصمیم را ثبت کند.",
      "تأیید Foundation مجوز اجرای Provider، اتصال سرور، هزینه‌کردن یا Production نیست."
    ])
  }),
  Object.freeze({
    id: "settings",
    nextId: "studio-review",
    phase: "پایهٔ محصول",
    flow: "main",
    title: "تنظیمات و Policy پروژه",
    summary: "تفاوت یک پروژه با پروژهٔ دیگر باید در تنظیمات نسخه‌دار و قابل‌ردیابی ثبت شود.",
    route: "/workspace",
    target: "workspace.versioned-settings",
    actionLabel: "باز کردن تنظیمات پروژه",
    completion: "setting-registered",
    availability: "available-with-limits",
    instructions: Object.freeze([
      "مسیر تنظیم را دقیق وارد کنید؛ برای نمونه ai.defaultModel.",
      "مقدار را به صورت JSON معتبر وارد کنید؛ برای نمونه \"luna\". مقدار مدل را فقط به‌معنای تنظیم ثبت‌شده بدانید، نه اتصال Provider زنده.",
      "برای هر تغییر، دلیل و اثر تغییر را بنویسید تا تصمیم قابل بازبینی باشد.",
      "Policy Pack تأییدشده را فقط پس از خواندن اثر آن اعمال کنید. برای بازگردانی، مسیر، نسخهٔ مقصد و دلیل لازم است."
    ])
  }),
  Object.freeze({
    id: "studio-review",
    nextId: "command-center",
    phase: "بازبینی محصول",
    flow: "main",
    title: "مرور اسناد و رودمپ",
    summary: "در Product Studio، منبع حقیقت، اسناد canonical، رودمپ، گیت‌ها و شکاف‌های همان پروژه را بررسی کنید.",
    route: "/product-studio",
    target: "studio.project-workspace",
    actionLabel: "باز کردن Product Studio",
    completion: "review-only",
    availability: "available-read-only",
    instructions: Object.freeze([
      "در «اسناد canonical»، نسخه، مالک و checksum را بررسی کنید؛ Git و Document Registry مرجع‌اند.",
      "در «رودمپ و گیت‌های توسعه»، هیچ موردی را بدون Evidence، Done تلقی نکنید.",
      "«خطاها و gapها» را بخوانید؛ پیش از شروع اجرای واقعی، مورد باز را رفع یا صریحاً تصمیم‌گیری کنید.",
      "Notion فقط Projection است و تا اتصال و مجوز جداگانه، منبع حقیقت یا محل ویرایش Hero نیست."
    ])
  }),
  Object.freeze({
    id: "command-center",
    nextId: "operations-review",
    phase: "بازبینی محصول",
    flow: "main",
    title: "مرکز فرمان پروژه",
    summary: "مرکز فرمان نمای فشردهٔ Command از وضعیت، گیت‌ها و اقدام‌های بعدی همان پروژه است؛ Portfolio یا صفحهٔ جهانی نیست.",
    route: "/portfolio?surface=command",
    target: "control.command-center",
    actionLabel: "باز کردن مرکز فرمان",
    completion: "review-only",
    availability: "available-read-only",
    instructions: Object.freeze([
      "از Portfolio یا ناوبری «مرکز فرمان» را باز کنید؛ Hero پروژهٔ فعال را در URL نگه می‌دارد.",
      "شاخص‌ها، گیت‌های جاری و اقدام‌های بعدی را مرور کنید و مورد مسدود یا نیازمند تصمیم را پیدا کنید.",
      "این صفحه وضعیت را توضیح می‌دهد؛ هیچ عدد، Health یا کارت آن به‌تنهایی مجوز اجرا یا تغییر تنظیمات نیست."
    ])
  }),
  Object.freeze({
    id: "operations-review",
    nextId: "team-research",
    phase: "بازبینی محصول",
    flow: "main",
    title: "پایش عملیات و آمادگی",
    summary: "مرکز فرمان و Operations، metadata امنِ تیم، فرمان، سلامت، اعلان، زیرساخت و تحویل را در Scope همان پروژه نشان می‌دهند.",
    route: "/project-control",
    target: "control.project-operations",
    actionLabel: "باز کردن Operations",
    completion: "review-only",
    availability: "available-read-only",
    instructions: Object.freeze([
      "از شاخص‌های بالای صفحه برای تشخیص وضعیت استفاده کنید، اما آن‌ها را به‌تنهایی مجوز اجرا ندانید.",
      "بخش‌های Collaboration، Command، Health، Inbox، Infrastructure، Delivery و Final Readiness را بررسی کنید.",
      "unknown یعنی Evidence کافی وجود ندارد، نه اینکه وضعیت سالم است.",
      "این صفحه اکنون read-only است؛ از آن Provider، Secret، Dispatch بیرونی، Pilot یا Production اجرا نمی‌شود."
    ])
  }),
  Object.freeze({
    id: "access-review",
    nextId: null,
    phase: "امکانات خارج از فرایند اصلی",
    flow: "outside-main",
    title: "بازبینی اعضا و Project Grant",
    summary: "Owner می‌تواند Viewer بسازد و فقط خودش Grant Admin یا Viewer هر پروژه را تغییر دهد.",
    route: "/identity",
    target: "identity.project-grant",
    actionLabel: "باز کردن مدیریت دسترسی",
    completion: "review-only",
    availability: "owner-only",
    optional: true,
    instructions: Object.freeze([
      "در بخش «ایجاد Viewer»، شناسه، ایمیل، نام و رمز اولیهٔ کاربر مشاهده‌گر را وارد کنید.",
      "در «اعطای Project Grant»، شناسهٔ پروژه، کاربر و نقش Admin یا Viewer را انتخاب و ثبت کنید.",
      "Admin می‌تواند هر تنظیم و تغییر در پروژه‌های Grant‌شده را انجام دهد، اما فقط Owner می‌تواند کاربر یا Grant اضافه و حذف کند.",
      "Secret فعلی فقط برای Owner قابل Reveal است؛ هیچ Secret را در راهنما یا فرم‌های عمومی وارد نکنید."
    ])
  }),
  Object.freeze({
    id: "team-research",
    nextId: "live-execution",
    phase: "اجرای محصول",
    flow: "main",
    title: "تحقیق و تحلیل واقعی توسط تیم‌ها",
    summary: "قرارداد Team/Role و حافظهٔ پروژه وجود دارد، اما UI گفت‌وگوی پایدار و اجرای تحقیق واقعی هنوز کامل نشده است.",
    route: "/project-control",
    target: "control.collaboration-memory",
    actionLabel: "مشاهدهٔ وضعیت Collaboration",
    completion: "not-available",
    availability: "partial",
    instructions: Object.freeze([
      "فعلاً از این بخش برای دیدن وضعیت و gap استفاده کنید، نه برای فرض‌کردن اینکه یک تیم AI واقعاً تحقیق را انجام داده است.",
      "وقتی Conversation UI، assignment و Evidence کامل شوند، این گام به مسیر اجرایی تبدیل خواهد شد.",
      "هر دانش مشترک بین پروژه‌ها باید ابتدا Knowledge Proposal شود و هرگز خودکار منتقل نمی‌شود."
    ])
  }),
  Object.freeze({
    id: "live-execution",
    nextId: "test-delivery",
    phase: "اجرای محصول",
    flow: "main",
    title: "اجرای واقعی AI، GitHub و سرور",
    summary: "این گام عمداً گیت‌شده است: اتصال Provider، GitHub، Node Agent، Server و Secret Store نیازمند مجوز و Credential جداگانه است.",
    route: "/project-control",
    target: "control.infrastructure",
    actionLabel: "مشاهدهٔ گیت زیرساخت",
    completion: "gated",
    availability: "gated",
    instructions: Object.freeze([
      "اول تنظیمات، بودجه، Policy و Approval را بازبینی کنید.",
      "برای هر اتصال یا Provider واقعی، مجوز مستقل و Credential reference امن لازم است.",
      "ثبت Model، Server یا Repository در Hero به معنی اتصال، هزینه‌کردن یا Deploy خودکار نیست.",
      "تا بسته‌شدن گیت، فقط metadata و برنامهٔ اجرا قابل مشاهده است."
    ])
  }),
  Object.freeze({
    id: "test-delivery",
    nextId: "production",
    phase: "تحویل",
    flow: "main",
    title: "Test، Release و بستهٔ تحویل",
    summary: "Hero باید پیش از تحویل، Evidence، Artifact و قابلیت بازیابی روی مقصد پاک را ثابت کند؛ این مسیر هنوز عملیاتی نشده است.",
    route: "/project-control",
    target: "control.delivery-artifacts",
    actionLabel: "مشاهدهٔ وضعیت Delivery",
    completion: "gated",
    availability: "gated",
    instructions: Object.freeze([
      "در Operations، وضعیت Delivery و Final Readiness را بخوانید.",
      "Artifact باید بدون Secret باشد و restore روی مقصد Test پاک با Evidence ثبت شود.",
      "پذیرش فنی داخلی می‌تواند توسط Owner یا Admin ثبت شود؛ پذیرش فقط جایگزین Evidence آزمون نیست."
    ])
  }),
  Object.freeze({
    id: "production",
    nextId: null,
    phase: "تحویل",
    flow: "main",
    title: "Production و پایش بهره‌برداری",
    summary: "Production آخرین گام است و هر Release یا بازهٔ مجاز، Approval مستقل و قابل‌ردیابی می‌خواهد.",
    route: "/project-control",
    target: "control.final-readiness",
    actionLabel: "بازبینی Final Readiness",
    completion: "gated",
    availability: "gated",
    instructions: Object.freeze([
      "فقط پس از Test، Evidence، portability، backup/restore و گیت‌های امنیتی کامل، درخواست Promotion مطرح کنید.",
      "Production، Secret، دادهٔ واقعی کاربران، هزینه و عملیات برگشت‌ناپذیر خارج از راهنمای محلی و نیازمند مجوز جداگانه‌اند.",
      "تا آن زمان، Final Readiness را گزارش وضعیت بدانید، نه دستور Deploy."
    ])
  })
]);

/**
 * Field-level coaching stays separate from the route metadata so that the
 * lightweight, persisted state never contains user input.  A field may be a
 * form control or a concrete read-only control that the user must inspect.
 * Both deserve an unambiguous explanation in a guided flow.
 */
export const HERO_PROJECT_WALKTHROUGH_FIELD_GUIDANCE = Object.freeze({
  identity: Object.freeze([
    Object.freeze({ label: "Gate 1 — پنجرهٔ مرورگر", instruction: "اگر مرورگر پیش از Hero نام کاربری و رمز خواست، این مرز شبکه است. فقط اطلاعات شبکه را همان‌جا وارد کنید؛ آن‌ها را در فرم Hero وارد نکنید." }),
    Object.freeze({ label: "Email حساب انسانی", instruction: "ایمیل حساب Hero خود را وارد کنید. این همان حسابی است که Owner برای شما ساخته یا به پروژه دسترسی داده است." }),
    Object.freeze({ label: "Password حساب انسانی", instruction: "رمز حساب Hero را وارد کنید. این رمز با رمز پنجرهٔ مرورگر متفاوت است و نباید در URL، گفت‌وگو یا فایل پروژه نوشته شود." }),
    Object.freeze({ label: "کد MFA", instruction: "کد شش‌رقمیِ فعلی Authenticator را وارد کنید. Secret یا کلید راه‌انداز Authenticator هیچ‌وقت در این فیلد وارد نمی‌شود." })
  ]),
  "project-selection": Object.freeze([
    Object.freeze({ label: "جست‌وجو یا فیلتر پروژه", instruction: "اگر پروژه‌های زیادی دارید، نام یا شناسهٔ پروژه را جست‌وجو کنید تا فقط کارت درست را پیدا کنید." }),
    Object.freeze({ label: "کارت پروژه", instruction: "نام، شناسه، lifecycle و وضعیت کارت را بررسی کنید. فقط کارتی را انتخاب کنید که قرار است اکنون روی همان پروژه کار شود." }),
    Object.freeze({ label: "انتخاب پروژه", instruction: "دکمهٔ انتخاب همان کارت را بزنید. پس از آن Studio، Workspace، Command و Operations فقط اطلاعات همین پروژه را نشان می‌دهند." })
  ]),
  "create-project": Object.freeze([
    Object.freeze({ label: "Project ID", instruction: "یک شناسهٔ یکتا، کوتاه و انگلیسی با حروف کوچک و خط تیره بنویسید؛ مانند project-vpn. این شناسه بعداً در URL و API استفاده می‌شود." }),
    Object.freeze({ label: "نام و توضیح", instruction: "نام انسانی محصول و یک توضیح کوتاه از مسئله و محدودهٔ آن را ثبت کنید تا پروژه با پروژه‌های دیگر اشتباه نشود." }),
    Object.freeze({ label: "هدف", instruction: "نتیجهٔ قابل سنجش را بنویسید، نه فقط نام محصول. این مقدار مبنای Foundation و ارزیابی خروجی خواهد بود." }),
    Object.freeze({ label: "کاربران هدف", instruction: "گروه کاربران، خریداران یا تصمیم‌گیرندگان محصول را مشخص کنید تا نیازها در Foundation قابل ارزیابی باشند." }),
    Object.freeze({ label: "سطح خودکارسازی", instruction: "برای شروع «تأیید در هر مرحله» را انتخاب کنید. فقط وقتی Policy و Approval روشن دارید سطح خودکارسازی بیشتری انتخاب کنید." }),
    Object.freeze({ label: "ثبت پروژه", instruction: "پس از بازبینی همهٔ فیلدها، پروژه را ثبت کنید. نتیجه یک Foundation Proposal آمادهٔ بازبینی است؛ هنوز Provider، سرور یا Production اجرا نمی‌شود." })
  ]),
  inputs: Object.freeze([
    Object.freeze({ label: "نام فایل متن", instruction: "برای Brief یا نیازمندی متنی یک نام روشن مانند brief.txt بنویسید تا بعداً معلوم باشد این ورودی چیست." }),
    Object.freeze({ label: "متن ورودی", instruction: "نیازمندی، مسئله، محدودیت و اطلاعات مفید را وارد کنید. رمز، کلید API، دادهٔ شخصی یا فایل اجرایی را اینجا وارد نکنید." }),
    Object.freeze({ label: "ثبت ورودی متن", instruction: "پس از کنترل محتوا، دکمهٔ ثبت ورودی متن را بزنید. ثبت موفق باید در فهرست ورودی‌های پروژه دیده شود." }),
    Object.freeze({ label: "فراخوانی ورودی", instruction: "یک ورودی ثبت‌شده از فهرست «فراخوانی» انتخاب کنید. برای متن، Hero فقط پس از کنترل نقش و checksum، محتوا را در فرم همان پروژه برمی‌گرداند؛ Viewer به آن دسترسی ندارد." }),
    Object.freeze({ label: "URL عمومی HTTPS", instruction: "اگر مرجع وب دارید، فقط یک لینک عمومی HTTPS وارد کنید. ثبت لینک به معنی fetch، اجرای کد یا اعتماد خودکار به آن نیست." }),
    Object.freeze({ label: "عنوان لینک و ثبت آن", instruction: "عنوان کوتاهی برای تشخیص مرجع بنویسید و لینک را ثبت کنید. عنوان باید بگوید این مرجع چرا برای پروژه مفید است." })
  ]),
  foundation: Object.freeze([
    Object.freeze({ label: "وضعیت Proposal", instruction: "وضعیت Foundation را بخوانید و مطمئن شوید پیشنهاد مربوط به همین پروژه است. تعداد گام‌ها را به‌تنهایی معیار کامل‌بودن ندانید." }),
    Object.freeze({ label: "رودمپ و تیم‌های پیشنهادی", instruction: "هر گام و مسئولیت پیشنهادی را با هدف و ورودی‌های خود مقایسه کنید. مورد مبهم را قبل از تأیید مشخص کنید." }),
    Object.freeze({ label: "دلیل بازنگری", instruction: "اگر Foundation درست نیست، دلیل دقیق و قابل اقدام بنویسید؛ مثلاً یک نیاز یا محدودیت فراموش‌شده. دلیل خام یا مبهم ننویسید." }),
    Object.freeze({ label: "فراخوانی بازنگری", instruction: "برای استفاده از دلیل یک بازنگری قبلی، آن نسخه را در فهرست انتخاب و «فراخوانی» را بزنید. این کار فقط متن را در فرم قرار می‌دهد و Foundation را تغییر نمی‌دهد." }),
    Object.freeze({ label: "درخواست بازنگری", instruction: "فقط پس از نوشتن دلیل، درخواست بازنگری را ثبت کنید. تاریخچه باقی می‌ماند و تغییر پنهان یا حذف بی‌ردپا رخ نمی‌دهد." }),
    Object.freeze({ label: "تأیید Foundation", instruction: "وقتی Foundation با هدف پروژه منطبق است، آن را تأیید کنید. این تصمیم Draft را جلو می‌برد، اما مجوز Provider، هزینه یا Production نیست." })
  ]),
  settings: Object.freeze([
    Object.freeze({ label: "الگوی متداول", instruction: "اگر تنظیم شما یکی از گزینه‌های شناخته‌شده است، الگو را انتخاب کنید تا مسیر و مقدار اولیهٔ JSON پر شود. برای مسیر ویژه، «مسیر دلخواه» را نگه دارید." }),
    Object.freeze({ label: "مسیر تنظیم", instruction: "نام دقیق تنظیم را وارد کنید؛ مانند ai.defaultModel. مسیر روشن باعث می‌شود تغییر در پروژه‌های دیگر اشتباه اعمال نشود." }),
    Object.freeze({ label: "Layer", instruction: "برای تغییر دائمی همین پروژه Project override و برای یک اجرای مشخص Run override را انتخاب کنید. قبل از ذخیره، دامنهٔ اثر را بررسی کنید." }),
    Object.freeze({ label: "شناسهٔ Run", instruction: "این فیلد فقط با انتخاب Run override ظاهر می‌شود. شناسهٔ اجرای دقیق را وارد کنید تا تغییر ناخواسته به کل پروژه تعمیم پیدا نکند." }),
    Object.freeze({ label: "مقدار JSON", instruction: "مقدار را به شکل JSON معتبر وارد کنید؛ برای متن از نقل‌قول استفاده کنید. این فقط ثبت تنظیم است و Provider واقعی را متصل نمی‌کند." }),
    Object.freeze({ label: "دلیل و اثر تغییر", instruction: "چرا این تغییر لازم است و چه اثری انتظار دارید را ساده و مشخص بنویسید تا بازبینی و rollback ممکن باشد." }),
    Object.freeze({ label: "فراخوانی و Rollback", instruction: "برای اصلاح یک تنظیم ثبت‌شده، ابتدا آن را انتخاب و «فراخوانی» کنید. برای بازگشت، همان رکورد را انتخاب کنید، «فراخوانی» Rollback را بزنید و دلیل را پیش از ثبت بازبینی کنید." }),
    Object.freeze({ label: "ثبت تنظیم", instruction: "پس از کنترل مسیر، layer و JSON، تنظیم را ثبت کنید. نسخهٔ جدید باید در تاریخچهٔ تنظیمات همین پروژه دیده شود." }),
    Object.freeze({ label: "Policy Pack و Rollback", instruction: "Policy Pack را فقط بعد از خواندن اثرش اعمال کنید. برای rollback، مسیر، نسخهٔ مقصد و دلیل بازگشت را جداگانه وارد کنید." })
  ]),
  "studio-review": Object.freeze([
    Object.freeze({ label: "اسناد canonical", instruction: "نسخه، مالک و checksum هر سند را بررسی کنید. سند canonical مرجع تصمیم است، نه یک کپی یا Projection بیرونی." }),
    Object.freeze({ label: "رودمپ و گیت‌ها", instruction: "هر مرحله را با Evidence آن بخوانید. عنوان Done بدون Evidence به معنی انجام‌شدن واقعی نیست." }),
    Object.freeze({ label: "خطاها و gapها", instruction: "هر مورد باز را بررسی کنید. پیش از اجرای واقعی آن را رفع کنید یا تصمیم و مالک پیگیری آن را شفاف ثبت کنید." }),
    Object.freeze({ label: "وضعیت Notion", instruction: "Notion را فقط Projection در نظر بگیرید. برای منبع حقیقت و تصمیم‌های فنی به Git و Document Registry رجوع کنید." })
  ]),
  "command-center": Object.freeze([
    Object.freeze({ label: "Project context فعال", instruction: "نام و شناسهٔ پروژهٔ فعال را در نوار بالا بررسی کنید. اگر اشتباه است، ابتدا به Portfolio بروید و پروژه را عوض کنید." }),
    Object.freeze({ label: "شاخص‌های کلیدی", instruction: "شاخص‌ها را برای پیدا کردن وضعیت غیرعادی بخوانید. عدد یا رنگ شاخص به‌تنهایی مجوز تغییر یا اجرا نمی‌دهد." }),
    Object.freeze({ label: "گیت جاری", instruction: "گیت و دلیل بازبودن آن را بررسی کنید. بدون Evidence و Approval لازم، گیت را عبورکرده تلقی نکنید." }),
    Object.freeze({ label: "اقدام بعدی", instruction: "اقدام بعدی را بخوانید و برای جزئیات به Workspace، Studio یا Operations همان پروژه بروید." })
  ]),
  "operations-review": Object.freeze([
    Object.freeze({ label: "Health", instruction: "Health را به‌عنوان نشانهٔ پایش بخوانید. unknown یعنی Evidence کافی وجود ندارد، نه اینکه همه‌چیز سالم است." }),
    Object.freeze({ label: "Collaboration و Command", instruction: "وضعیت تیم‌ها، گفتگوها و فرمان‌ها را بازبینی کنید. اگر capability هنوز partial است، اجرای واقعی را فرض نکنید." }),
    Object.freeze({ label: "Inbox، Infrastructure و Delivery", instruction: "هشدارها، metadata زیرساخت و وضعیت تحویل را برای blocker یا تصمیم منتظر بررسی کنید." }),
    Object.freeze({ label: "Final Readiness", instruction: "این بخش گزارش آمادگی است. تا Evidence و Approval جداگانه فراهم نشده، از آن به‌عنوان دکمهٔ Deploy استفاده نکنید." })
  ]),
  "access-review": Object.freeze([
    Object.freeze({ label: "شناسهٔ Viewer", instruction: "یک شناسهٔ یکتا برای کاربر مشاهده‌گر وارد کنید تا Grantها و Auditها به شخص درست وصل شوند." }),
    Object.freeze({ label: "ایمیل و نام نمایشی", instruction: "ایمیل قابل دسترس و نامی که مدیر بتواند تشخیص دهد را وارد کنید. پیش از ثبت، املای ایمیل را کنترل کنید." }),
    Object.freeze({ label: "رمز اولیه", instruction: "رمز اولیه را فقط در فرم امن ایجاد کاربر وارد کنید؛ آن را در راهنما، پیام یا تنظیمات پروژه ذخیره نکنید." }),
    Object.freeze({ label: "Project Grant", instruction: "شناسهٔ پروژه، کاربر و نقش Admin یا Viewer را انتخاب کنید. Grant فقط برای همان پروژه اثر دارد و Owner تنها کسی است که آن را تغییر می‌دهد." }),
    Object.freeze({ label: "ثبت یا ابطال Grant", instruction: "قبل از ثبت، نام پروژه و نقش را دوباره کنترل کنید. برای حذف دسترسی، Grant مشخص را ابطال کنید؛ حذف تاریخچه لازم نیست." })
  ]),
  "team-research": Object.freeze([
    Object.freeze({ label: "وضعیت Collaboration", instruction: "وضعیت واقعی قرارداد تیم و Role را ببینید. وجود نام تیم به‌تنهایی به معنی اجرای تحقیق نیست." }),
    Object.freeze({ label: "حافظهٔ پروژه", instruction: "دانش مربوط به همین پروژه را بررسی کنید. دانش پروژهٔ دیگر باید ابتدا Knowledge Proposal شود و خودکار منتقل نمی‌شود." }),
    Object.freeze({ label: "gapهای باز", instruction: "قابلیت‌های ناقص را به‌عنوان blocker یا کار آینده ثبت‌شده ببینید؛ تا تکمیل Evidence، خروجی تحقیق واقعی فرض نمی‌شود." })
  ]),
  "live-execution": Object.freeze([
    Object.freeze({ label: "Provider و Model binding", instruction: "تنظیم ثبت‌شدهٔ مدل و Policy را بررسی کنید. ثبت نام مدل به معنی اتصال زنده یا مصرف Token نیست." }),
    Object.freeze({ label: "بودجه و Approval", instruction: "سقف مصرف و قاعدهٔ تأیید را پیش از هر اتصال واقعی مرور کنید. اجرای واقعی بدون گیت و مجوز جداگانه انجام نمی‌شود." }),
    Object.freeze({ label: "Server و Repository metadata", instruction: "نام و وضعیت metadata را فقط برای برنامه‌ریزی بخوانید. این کارت‌ها به‌تنهایی سرور را متصل یا Repository را تغییر نمی‌دهند." }),
    Object.freeze({ label: "Secret reference", instruction: "فقط مرجع امن Secret را بررسی کنید. مقدار Secret در این راهنما و صفحهٔ عمومی نمایش داده یا وارد نمی‌شود." })
  ]),
  "test-delivery": Object.freeze([
    Object.freeze({ label: "وضعیت Delivery", instruction: "وضعیت مرحلهٔ تحویل را بخوانید و ببینید چه Evidence یا گیتی هنوز باز است." }),
    Object.freeze({ label: "Artifact", instruction: "بستهٔ تحویل باید بدون Secret و با نام و نسخهٔ روشن باشد. نبود Artifact آزموده‌شده یعنی تحویل آماده نیست." }),
    Object.freeze({ label: "Evidence و restore", instruction: "Evidence آزمون و بازیابی روی مقصد Test پاک را بررسی کنید. صرف وجود فایل به معنی امکان بازیابی نیست." }),
    Object.freeze({ label: "پذیرش فنی", instruction: "Owner یا Admin می‌تواند پذیرش فنی را ثبت کند، اما پذیرش جای Evidence فنی و آزمون واقعی را نمی‌گیرد." })
  ]),
  production: Object.freeze([
    Object.freeze({ label: "Final Readiness", instruction: "همهٔ شرط‌های آمادگی را بخوانید و هیچ مورد unknown یا بدون Evidence را سالم فرض نکنید." }),
    Object.freeze({ label: "Evidence تحویل", instruction: "شواهد Test، portability و backup/restore را پیش از درخواست Promotion بررسی کنید." }),
    Object.freeze({ label: "Approval Production", instruction: "Approval باید با Scope و بازهٔ روشن ثبت شود. مجوز یک پروژه یا تغییر را به پروژه یا تغییر دیگر تعمیم ندهید." }),
    Object.freeze({ label: "Promotion", instruction: "این راهنما Promotion را اجرا نمی‌کند. هر Production، Secret، هزینه یا عملیات برگشت‌ناپذیر نیازمند مجوز و گیت مستقل است." })
  ])
});

export function getProjectWalkthroughStep(stepId) {
  return HERO_PROJECT_WALKTHROUGH_STEPS.find(step => step.id === stepId) ?? null;
}

/**
 * A compact, deterministic readiness model shared by tests and server-side
 * consumers. It never stores form values and never treats reference/gated
 * stages as completed product work. Optional inputs can add context, but are
 * deliberately excluded from the blocking progress denominator.
 */
export function createProjectWalkthroughProgress({ authenticated = false, projectId = null, overview = null } = {}) {
  const projectSelected = typeof projectId === "string" && /^[a-z][a-z0-9-]{2,62}$/.test(projectId);
  const foundation = overview?.foundationProposal ?? {};
  const settings = Array.isArray(overview?.settings) ? overview.settings : [];
  const inputs = Array.isArray(overview?.inputs) ? overview.inputs : [];
  const completion = step => {
    if (step.id === "create-project") return false;
    if (step.completion === "human-session") return authenticated === true;
    if (step.completion === "selected-project") return projectSelected;
    if (step.completion === "optional-input") return inputs.length > 0;
    if (step.completion === "foundation-approved") return foundation.state === "approved";
    if (step.completion === "setting-registered") return settings.some(item => item?.path !== HERO_PROJECT_WALKTHROUGH_ENABLED_SETTING);
    return false;
  };
  const requiredSteps = HERO_PROJECT_WALKTHROUGH_STEPS.filter(step => step.flow === "main" && step.optional !== true && !["review-only", "gated", "not-available"].includes(step.completion));
  const requiredCompleted = requiredSteps.filter(completion).length;
  const steps = HERO_PROJECT_WALKTHROUGH_STEPS.map(step => {
    const complete = completion(step);
    const priorRequired = requiredSteps.slice(0, Math.max(0, requiredSteps.findIndex(item => item.id === step.id))).filter(item => item.id !== step.id);
    const blockedBy = priorRequired.filter(item => !completion(item)).map(item => item.id);
    const state = complete
      ? "complete"
      : step.optional === true
        ? "optional"
        : ["gated", "partial"].includes(step.availability)
          ? "gated"
          : step.completion === "review-only"
            ? "reference"
            : blockedBy.length
              ? "waiting"
              : "ready";
    return Object.freeze({
      stepId: step.id,
      state,
      required: requiredSteps.some(item => item.id === step.id),
      completed: complete,
      blockedBy: Object.freeze(blockedBy),
      nextAction: state === "ready" || state === "optional" ? step.actionLabel : null,
      evidence: complete
        ? step.completion === "optional-input" ? `${inputs.length} ورودی اختیاری ثبت شده است.` : "معیار این گام از وضعیت واقعی پروژه تأیید شده است."
        : step.optional === true ? "این گام اختیاری است و می‌توانید بدون ثبت داده ادامه دهید." : null
    });
  });
  const nextRequired = steps.find(item => item.required && !item.completed && item.state === "ready") ?? null;
  return Object.freeze({
    version: HERO_PROJECT_WALKTHROUGH_VERSION,
    projectId: projectSelected ? projectId : null,
    summary: Object.freeze({
      required: requiredSteps.length,
      completed: requiredCompleted,
      percent: requiredSteps.length ? Math.round((requiredCompleted / requiredSteps.length) * 100) : 0,
      nextRequiredStepId: nextRequired?.stepId ?? null
    }),
    steps: Object.freeze(steps)
  });
}

/**
 * The deterministic guidance is always available and never receives a
 * credential or keeps a user's question. The HTTP layer may additionally use
 * an explicitly selected, authorized live profile while preserving this
 * narrow response contract and the admin's final review boundary.
 */
export const HERO_PROJECT_WALKTHROUGH_ADVISOR_MODE = "local-contextual-guidance";
export const HERO_PROJECT_WALKTHROUGH_ADVISOR_MAX_QUESTION_LENGTH = 1_500;

const NO_PROJECT_WALKTHROUGH_STEPS = new Set(["identity", "project-selection", "create-project"]);

const ADVISOR_PROPOSALS = Object.freeze({
  "create-project": Object.freeze([
    Object.freeze({ formId: "create-project-form", name: "projectId", label: "شناسهٔ پروژه", value: "project-new-product" }),
    Object.freeze({ formId: "create-project-form", name: "name", label: "نام پروژه", value: "محصول جدید" }),
    Object.freeze({ formId: "create-project-form", name: "description", label: "توضیح", value: "مسئله، محدوده و خروجی مورد انتظار این محصول را پس از بازبینی دقیق کنید." }),
    Object.freeze({ formId: "create-project-form", name: "goal", label: "هدف اولیه", value: "ارائهٔ یک خروجی قابل سنجش برای کاربران هدف با معیار پذیرش روشن." }),
    Object.freeze({ formId: "create-project-form", name: "users", label: "کاربران هدف", value: "کاربران اصلی و تصمیم‌گیرندگان محصول" }),
    Object.freeze({ formId: "create-project-form", name: "autonomy", label: "شیوهٔ تأیید", value: "approval-each-stage" })
  ]),
  inputs: Object.freeze([
    Object.freeze({ formId: "upload-form", name: "filename", label: "نام فایل متن", value: "brief.txt" }),
    Object.freeze({ formId: "upload-form", name: "content", label: "متن ورودی", value: "مسئله: \nکاربران هدف: \nنتیجهٔ مورد انتظار: \nمعیارهای پذیرش: \nمحدودیت‌ها و ریسک‌ها: \nموارد خارج از Scope: " })
  ]),
  foundation: Object.freeze([
    Object.freeze({ formId: "foundation-form", name: "reason", label: "دلیل بازنگری", value: "لطفاً این Foundation را با هدف، کاربران، محدودیت‌ها و معیارهای پذیرش Intake تطبیق دهید و شکاف‌های مشخص را اصلاح کنید." })
  ]),
  settings: Object.freeze([
    Object.freeze({ formId: "setting-form", name: "path", label: "مسیر تنظیم", value: "ai.defaultModel" }),
    Object.freeze({ formId: "setting-form", name: "layer", label: "Layer", value: "project-override" }),
    Object.freeze({ formId: "setting-form", name: "value", label: "مقدار JSON", value: "\"luna\"" }),
    Object.freeze({ formId: "setting-form", name: "reason", label: "دلیل", value: "پیشنهاد اولیه برای بازبینی مدل پیش‌فرض این پروژه." }),
    Object.freeze({ formId: "setting-form", name: "impact", label: "اثر تغییر", value: "نیازمند بررسی" })
  ])
});

function normalizedAdvisorQuestion(question) {
  if (question === undefined || question === null) return "";
  if (typeof question !== "string") throw new TypeError("Walk-Through advisor question must be a string.");
  const normalized = question.trim().replace(/\s+/g, " ");
  if (normalized.length > HERO_PROJECT_WALKTHROUGH_ADVISOR_MAX_QUESTION_LENGTH) {
    throw new RangeError(`Walk-Through advisor question must be at most ${HERO_PROJECT_WALKTHROUGH_ADVISOR_MAX_QUESTION_LENGTH} characters.`);
  }
  if (SENSITIVE_ASSIGNMENT.test(normalized) || SENSITIVE_VALUE.test(normalized) || HOST_PATH.test(normalized)) {
    throw new RangeError("Walk-Through advisor questions must not contain sensitive material.");
  }
  return normalized;
}

function contextualQuestionAnalysis(question, step, fields) {
  const normalized = question.toLocaleLowerCase("fa");
  if (!normalized) return Object.freeze({ topic: "همین گام", guidance: "", fields: Object.freeze([]) });
  const topics = [
    [/(?:خودکار|automation|autonomy|تأیید)/u, "سطح خودکارسازی و تأیید", "از سطحی شروع کنید که تصمیم‌های حساس را پیش از اجرا برای بازبینی نگه می‌دارد؛ افزایش خودکارسازی فقط پس از Policy و Approval روشن قابل ارزیابی است."],
    [/(?:هزینه|توکن|token|بودجه)/u, "هزینه و بودجه", "اثر مصرف Token را به سقف نسخه‌دار، Role/Provider مشخص و معیار توقف وصل کنید؛ ثبت مدل یا Profile به‌تنهایی مجوز هزینه‌کردن نیست."],
    [/(?:مدل|model|ai|هوش|provider)/u, "مدل و اتصال AI", "اول تفاوت تنظیم نسخه‌دار با اتصال زنده را روشن کنید. برای فراخوانی واقعی Provider، Health، Policy، بودجه و مجوز مستقل لازم است."],
    [/(?:امنیت|secret|رمز|کلید|password|credential|دسترسی)/u, "مرز امنیت و دسترسی", "Secret، رمز و Credential را وارد گفتگو نکنید. فقط دربارهٔ نقش، Grant، Policy، Reference امن و Evidence قابل مشاهده تصمیم بگیرید."],
    [/(?:هدف|کاربر|نیاز|scope|محدوده|پذیرش)/u, "هدف، کاربران و محدوده", "پاسخ را به نتیجهٔ قابل سنجش، گروه کاربر، محدودیت، مورد خارج از Scope و معیار پذیرش تبدیل کنید تا گام بعدی قابل بازبینی باشد."],
    [/(?:خطا|ریسک|مشکل|بازکاری|کیفیت|تست)/u, "ریسک، کیفیت و Evidence", "مسئله را به شاهد قابل بازبینی، اثر، شرط پذیرش و اقدام بعدی تقسیم کنید؛ وضعیت بدون Evidence را کامل یا سالم فرض نکنید."],
    [/(?:رودمپ|زمان|مرحله|task|تسک)/u, "رودمپ و ترتیب اجرا", "وابستگی، گیت و معیار پایان هر Task را پیش از تغییر زمان‌بندی مشخص کنید؛ پیشرفت نمایشی جایگزین Evidence نیست."]
  ];
  const [, topic = "همین گام", guidance = "پرسش را به یک تصمیم قابل مشاهده، معیار پذیرش و اقدام بعدی تبدیل کنید؛ Hero چیزی را بدون ثبت یا تأیید شما تغییر نمی‌دهد."] = topics.find(([pattern]) => pattern.test(normalized)) || [];
  const fieldMatches = fields.filter(field => {
    const words = `${field.label} ${field.instruction}`.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
    return words.some(word => normalized.includes(word));
  });
  return Object.freeze({ topic, guidance, fields: Object.freeze((fieldMatches.length ? fieldMatches : fields.slice(0, 2)).slice(0, 3)) });
}

function contextualAdvisorResponse({ step, question, fields }) {
  if (!question) return "";
  const analysis = contextualQuestionAnalysis(question, step, fields);
  const fieldContext = analysis.fields.length
    ? `برای این موضوع، کنترل‌های مرتبط این گام عبارت‌اند از: ${analysis.fields.map(field => field.label).join("، ")}.`
    : "برای این موضوع، ابتدا وضعیت واقعی همین گام و Evidence موجود را بررسی کنید.";
  const boundary = step.availability === "gated" || step.availability === "partial"
    ? "این گام هنوز گیت یا محدودیت عملیاتی دارد؛ پاسخ راهنما مجوز اجرای بیرونی، هزینه یا تغییر حساس ایجاد نمی‌کند."
    : "اگر تصمیم شما به تغییر داده یا تنظیم منتهی می‌شود، آن را در کنترل همان صفحه بازبینی و جداگانه ثبت کنید.";
  return `تحلیل برای «${step.title}» بر محور ${analysis.topic}: ${analysis.guidance} ${fieldContext} ${boundary}`;
}

/**
 * Returns transient, project-aware guidance for the current guide step.
 * The `question` is deliberately not included in the return value so callers
 * cannot accidentally persist or render sensitive material entered by a user.
 */
export function createProjectWalkthroughAdvisory({ stepId, projectId = null, question = "" } = {}) {
  const step = getProjectWalkthroughStep(stepId);
  if (!step) throw new RangeError("Unknown Walk-Through step.");
  if (!NO_PROJECT_WALKTHROUGH_STEPS.has(step.id) && (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{2,62}$/.test(projectId))) {
    throw new RangeError("A valid projectId is required for this Walk-Through step.");
  }
  const normalizedQuestion = normalizedAdvisorQuestion(question);
  const fields = HERO_PROJECT_WALKTHROUGH_FIELD_GUIDANCE[step.id] ?? [];
  const proposedFields = ADVISOR_PROPOSALS[step.id] ?? [];
  return Object.freeze({
    mode: HERO_PROJECT_WALKTHROUGH_ADVISOR_MODE,
    providerInvoked: false,
    stepId: step.id,
    title: step.title,
    fieldLabels: Object.freeze(fields.map(field => field.label)),
    response: contextualAdvisorResponse({ step, question: normalizedQuestion, fields }),
    proposedFields: Object.freeze(proposedFields.map(field => Object.freeze({ ...field }))),
    guidance: Object.freeze({
      objective: step.summary,
      required: step.optional !== true && !["review-only", "gated", "not-available"].includes(step.completion),
      availability: step.availability,
      checklist: Object.freeze(step.instructions.slice(0, 4)),
      evidenceNeeded: step.completion === "review-only"
        ? "بازبینی آگاهانهٔ وضعیت و Evidence همین سطح"
        : step.optional === true
          ? "اختیاری؛ در صورت ثبت، نمایش موفق آن در همان Scope"
          : `تأیید معیار ${step.completion} از دادهٔ واقعی پروژه`,
      safeBoundary: "راهنما فقط پیشنهاد و مسیر بعدی می‌دهد؛ ثبت، هزینه، اجرا و انتشار همچنان نیازمند اقدام یا مجوز مستقل ادمین است."
    })
  });
}
