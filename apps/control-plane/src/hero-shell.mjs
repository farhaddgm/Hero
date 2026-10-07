import { HERO_PROJECT_WALKTHROUGH_FIELD_GUIDANCE, HERO_PROJECT_WALKTHROUGH_STEPS } from "./project-walkthrough.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

export const HERO_FEATURE_HELP = Object.freeze({
  "portfolio.projects": "تعداد پروژه‌هایی که حساب فعلی اجازهٔ مشاهدهٔ آن‌ها را دارد؛ پروژه‌های خارج از دسترسی در این شمارش دیده نمی‌شوند.",
  "portfolio.health": "Health جمع‌بندی قابل‌توضیح از وضعیت پروژه است. وضعیت unknown به معنی سالم‌بودن نیست و یعنی Evidence کافی ثبت نشده است.",
  "portfolio.attention": "پروژه‌های مسدود، هشدار‌دار یا فاقد دادهٔ کافی که بهتر است پیش از ادامه بررسی شوند.",
  "portfolio.upcoming": "مجموع Taskها و گام‌های بعدی ثبت‌شده در Roadmap پروژه‌های قابل مشاهده.",
  "portfolio.ownerBriefing": "مسیر کوتاه از نشانه‌های کلان Portfolio به گیت، Evidence و اقدام project-scoped مربوط به همان پروژه.",
  "portfolio.availableProjects": "فهرست پروژه‌های مجاز برای حساب فعلی؛ هر کارت به Studio، Workspace و Operations همان Project متصل است.",
  "portfolio.tokenUsage": "مصرف Token ثبت‌شده برای پروژه. نبود مقدار به صورت نامشخص نمایش داده می‌شود و صفر فرض نمی‌شود.",
  "portfolio.lastTask": "آخرین Task تکمیل‌شده‌ای که برای این پروژه در read model ثبت شده است.",
  "portfolio.nextTasks": "کارهای برنامه‌ریزی‌شدهٔ بعدی پروژه؛ ترتیب و تعداد از Roadmap فعلی خوانده می‌شود.",
  "portfolio.latestOutput": "جدیدترین Artifact یا خروجی قابل تحویل ثبت‌شده برای پروژه، بدون نمایش Secret یا محتوای خصوصی.",
  "portfolio.nextRoadmap": "نزدیک‌ترین گام‌های Roadmap که وضعیت حرکت پروژه را توضیح می‌دهند.",
  "portfolio.createProject": "فقط Owner می‌تواند Project جدید و Foundation اولیهٔ آن را ایجاد کند؛ Admin و Viewer این اختیار را ندارند.",
  "portfolio.intakeAdvisor": "پس از تکمیل پنج پاسخ نخست، Advisor فقط پیشنهادهای قابل بازبینی برای بقیهٔ فرم می‌سازد. اعمال پیشنهاد، ثبت پروژه یا اجرای هیچ عملی نیست.",
  "portfolio.riskInternetFacing": "اگر وب‌سایت یا سرویس قرار است از اینترنت یا توسط عموم قابل دسترس باشد «بله» را بزنید. اگر هنوز تصمیم نگرفته‌اید «نمی‌دانم» را نگه دارید.",
  "portfolio.riskPersonalData": "اگر نام، ایمیل، پیام تماس یا هر دادهٔ مربوط به یک شخص جمع یا نگهداری می‌شود «بله» را بزنید. فرم تماسِ هنوز تعیین‌نشده معمولاً «نمی‌دانم» است.",
  "portfolio.riskRegulatedData": "اگر حوزه یا داده تابع مقررات ویژه است، مانند سلامت، مالی یا دادهٔ کودکان، «بله» را بزنید. مطمئن نبودن را «نمی‌دانم» ثبت کنید.",
  "portfolio.riskSecuritySensitive": "اگر محصول با امنیت، زیرساخت، کنترل دسترسی یا دارایی حساس سروکار دارد «بله» را بزنید؛ صرفِ داشتن CMS به‌تنهایی چنین معنایی ندارد.",
  "portfolio.riskExternalIntegrations": "اگر محصول به سرویس بیرونی مثل ایمیل، پرداخت، تحلیل یا شبکهٔ اجتماعی وصل می‌شود «بله» را بزنید. اتصال احتمالیِ هنوز انتخاب‌نشده «نمی‌دانم» است.",
  "portfolio.riskPrivilegedAccess": "اگر اجرا به دسترسی مدیر سرور، کلیدهای سطح‌بالا، Docker socket یا اختیار مشابه نیاز دارد «بله» را بزنید. این مورد پیش از اجرا باید جداگانه تأیید شود.",
  "command.adminAccess": "نشست انسانی با cookie امن و HttpOnly در مرورگر نگهداری می‌شود؛ مقدار آن برای JavaScript قابل خواندن نیست و عملیات همچنان با نقش و مجوز پروژه کنترل می‌شود.",
  "command.statusOverview": "نمای فشردهٔ شاخص‌های سازمان، AI، درخواست‌ها و وضعیت کنترل‌ها؛ این شاخص‌ها به‌تنهایی مجوز اجرا نیستند.",
  "command.currentGates": "گیت‌ها مشخص می‌کنند کدام مرحله آماده، نیازمند تصمیم یا مسدود است و اقدام بعدی چیست.",
  "command.systemModel": "رابطهٔ Owner، Control Plane، تیم‌های سازمانی و نقش‌های AI را نشان می‌دهد؛ Team با AI Role یک مفهوم نیست.",
  "capability.portfolioHealth": "پایش هم‌زمان پروژه‌ها، Roadmap، سلامت و حرکت از نمای کلان به جزئیات هر پروژه.",
  "capability.teamRolePerformance": "مدیریت قرارداد تیم‌ها، Roleها، اصول، ارزیابی عملکرد و شواهد بازکاری.",
  "capability.aiModel": "کاتالوگ Provider، Model، Profile و Role Binding نسخه‌دار؛ ثبت تنظیم به معنی فعال‌کردن Provider زنده نیست.",
  "capability.documentsKnowledge": "مرجع اسناد canonical، دانش، Evidence، provenance و پیشنهاد انتقال دانش بین پروژه‌ها.",
  "capability.commandApproval": "ساخت فرمان، Preview اثر و ریسک، Approval، صف و وضعیت Run؛ عملیات حساس گیت مستقل دارند.",
  "capability.inboxObservability": "اعلان‌ها، Audit و Trace project-scoped برای تشخیص رویداد مهم و پیگیری علت تا Evidence.",
  "capability.costPerformance": "مصرف Token، دقت، خطا و بازکاری را به تفکیک پروژه، تیم، Role و Run قابل پیگیری می‌کند.",
  "capability.serverEnvironment": "مدیریت Development، Test و Production، اتصال Server و وضعیت Provision؛ Production همیشه مجوز مستقل می‌خواهد.",
  "capability.deliveryOutput": "Release، Artifact، Export و بستهٔ قابل انتقال پروژه را بدون قرار دادن Secret در خروجی مدیریت می‌کند.",
  "capability.settingsPolicy": "تنظیمات لایه‌ای و نسخه‌دار پروژه، Policy Pack، provenance و Rollback بدون بازنویسی تاریخچه.",
  "capability.identityAccess": "مدیریت Owner، Admin، Viewer، MFA، نشست و Project Grant با جداسازی کامل پروژه‌ها.",
  "capability.helpContracts": "راهنمای اصطلاحات، نقش‌ها، قراردادها و مرزهای اختیار برای تفسیر درست داده‌های پنل.",
  "teams.contracts": "قرارداد هر تیم مسئولیت، ورودی، خروجی، اختیار تصمیم، اصول و معیار آمادگی آن تیم را نسخه‌دار نگه می‌دارد.",
  "teams.contractProgress": "درصد کامل‌بودن قرارداد تیم براساس بخش‌های لازم؛ جایگزین ارزیابی کیفیت خروجی نیست.",
  "teams.readiness": "نشان می‌دهد تیم پیش‌نیازهای تعریف‌شده برای دریافت کار پروژه را دارد یا هنوز blocker دارد.",
  "teams.autonomy": "حد استقلال تیم در اجرای کارهای مجاز؛ عملیات حساس حتی در حالت خودکار از گیت‌های غیرقابل‌تضعیف عبور می‌کنند.",
  "teams.assignmentReview": "وضعیت تخصیص تیم به پروژه و بازبینی‌های ثبت‌شده برای همان مسئولیت.",
  "teams.inputs": "داده‌ها و Evidenceهایی که تیم برای شروع مسئولیت خود باید دریافت کند.",
  "teams.outputs": "خروجی‌های مرجعی که تیم باید تولید و با Evidence قابل بررسی تحویل دهد.",
  "teams.decisionRights": "تصمیم‌هایی که تیم در محدودهٔ قرارداد خود می‌تواند بگیرد؛ اختیار Owner یا گیت حساس منتقل نمی‌شود.",
  "teams.defaultStages": "مرحله‌های پیش‌فرض جریان توسعه که این تیم در آن‌ها مشارکت دارد.",
  "teams.principles": "اصول پایدار تیم؛ هر تغییر نسخهٔ تازه می‌سازد و تأیید قبلی را برای بازبینی مجدد باز می‌کند.",
  "teams.partners": "تیم‌های همکار و مرزهای handoff که برای تکمیل مسئولیت این تیم لازم‌اند.",
  "teams.versionedKnowledge": "تاریخچهٔ نسخه‌های قرارداد و دانش تیم؛ نسخه‌های گذشته حذف یا بی‌ردپا ویرایش نمی‌شوند.",
  "teams.knowledgeProvenance": "منبع، نسخه، تأییدکننده و تازگی دانش مورد استفادهٔ تیم را قابل پیگیری می‌کند.",
  "teams.contractHistory": "نسخه‌های قبلی قرارداد تیم و علت تغییر را نگه می‌دارد تا هیچ تصمیمی بی‌ردپا بازنویسی نشود.",
  "teams.approvalStatus": "نشان می‌دهد کدام بخش قرارداد تأیید، رد یا منتظر بازبینی Owner است؛ کامل‌بودن با تأیید یکسان نیست.",
  "teams.trainingBenchmark": "وضعیت آموزش و Benchmark تیم پیش از دریافت کار واقعی پروژه.",
  "teams.assignments": "تخصیص‌های ثبت‌شدهٔ تیم به پروژه‌ها و نقش عملیاتی آن‌ها.",
  "teams.deliverableReviews": "بازبینی خروجی‌های تیم و نتیجهٔ پذیرش، اصلاح یا رد آن‌ها.",
  "teams.rework": "درخواست‌های بازکاری، علت و نتیجهٔ اصلاح برای سنجش کیفیت و تکرار خطا.",
  "teams.researchRequests": "پژوهش‌های درخواست‌شده برای بهبود تصمیم، اصول یا دانش تیم.",
  "teams.appliedResearch": "گزارش‌های پژوهشی که پس از تأیید به دانش یا اصول تیم اعمال شده‌اند.",
  "ai.rolesActivity": "فعالیت نقش‌های AI در جریان‌ها؛ Role نوع قابلیت است و هویت یا مسئولیت سازمانی Team نیست.",
  "ai.invocations": "تعداد فراخوانی‌های ثبت‌شدهٔ AI با Role، Profile، Model، Token و correlation؛ مقدار صفر به معنی نبود Event ثبت‌شده است.",
  "ai.evaluations": "ارزیابی‌های نسخه‌دار کیفیت، ایمنی و تطابق خروجی؛ Evaluation به‌تنهایی مجوز اجرای بعدی نیست.",
  "ai.decisions": "تصمیم‌های حاصل از چند ارزیابی و Policy همراه با Evidence و دلیل انتخاب.",
  "ai.providerState": "وضعیت ثبت و اتصال Providerها؛ ثبت‌شده با متصل و مجاز برای هزینه‌کردن یکسان نیست.",
  "ai.benchmarkState": "خلاصهٔ آخرین Benchmarkهای synthetic برای مقایسهٔ Modelها بدون استفاده از دادهٔ واقعی پروژه.",
  "ai.organizationAdvisor": "پیشنهادهای AI دربارهٔ تیم، Role یا Model؛ پیشنهاد هیچ تغییری را بدون Policy یا Approval اعمال نمی‌کند.",
  "ai.benchmarkHistory": "نتیجهٔ Benchmarkهای synthetic و نسخه‌دار؛ این Evidence مجوز Provider زنده یا هزینه ایجاد نمی‌کند.",
  "ai.versionedConfiguration": "ثبت نسخهٔ جدید Provider، Model، Profile، Binding، Skill یا Policy بدون تغییر بی‌ردپای نسخهٔ قبل.",
  "ai.providers": "سرویس ارائه‌دهندهٔ مدل و وضعیت اتصال آن؛ Credential فقط به صورت reference نگهداری می‌شود.",
  "ai.connectionHealth": "وضعیت اتصال بر اساس آخرین Health check ثبت‌شده نمایش داده می‌شود. «تست آماده‌بودن» فقط وجود ارجاع Secret و Policy زمان اجرا را بدون نمایش Secret، فراخوانی Model یا هزینه بررسی می‌کند؛ Dispatch زنده همچنان به بودجه و مجوز مستقل نیاز دارد.",
  "ai.credentialStore": "محل ثبت امن کلید Provider در محیط Test. مقدار کلید رمزنگاری می‌شود و فقط مرجع، وضعیت و نسخهٔ آن در بک‌آفیس قابل مشاهده است؛ مقدار خام هرگز در UI، لاگ، Event یا گزارش برنمی‌گردد.",
  "ai.tokenUsage": "مصرف Token و هزینهٔ ثبت‌شده به تفکیک Provider از Invocationهای واقعی یا deterministic خوانده می‌شود. نبود رکورد، صفرسازی پنهان یا تأیید بودجه نیست.",
  "ai.models": "مدل‌های قابل انتخاب همراه با Provider، قابلیت و وضعیت نسخهٔ ثبت‌شده.",
  "ai.profiles": "ترکیب نسخه‌دار Model، Prompt، ابزار و محدودیت که رفتار یک Agent را تعیین می‌کند.",
  "ai.roleBindings": "اتصال نسخه‌دار یک AI Role به Profile مشخص در Scope پروژه یا جریان. در نقشهٔ تخصیص، هر پروژه جدا نشان داده می‌شود؛ تغییر یک Binding، پروژه‌های دیگر یا تاریخچهٔ نسخهٔ قبل را تغییر نمی‌دهد.",
  "ai.skills": "قابلیت‌های بسته‌بندی‌شده و قابل کنترل که می‌توانند به Role یا Agent Profile متصل شوند.",
  "ai.skillBindings": "Scope و Policy اتصال Skill به Role؛ این اتصال به‌تنهایی مجوز اجرای بیرونی نمی‌دهد.",
  "ai.rolePolicies": "قواعد پیش‌فرض مدل، ابزار، هزینه و رفتار هر Role که نسخه‌دار و قابل بازگشت هستند.",
  "project.globalSettings": "تنظیمات مشترک Hero، اتصال‌ها، امنیت و قراردادهای اجرایی با نمایش provenance و نسخه.",
  "project.identityScope": "هویت سرویس و مرز Project Scope که از نشت داده یا دسترسی بین پروژه‌ها جلوگیری می‌کند.",
  "project.runtimeConnections": "وضعیت اتصال runtime، Repository و سرویس‌ها با reference امن؛ Secret خام نمایش داده نمی‌شود.",
  "project.persistenceRecovery": "قرارداد ذخیره‌سازی، backup، restore و hydration برای ادامهٔ پایدار پس از restart.",
  "project.securityPrivacy": "کنترل‌های Secret، دادهٔ Production، redaction، retention و جداسازی امنیتی.",
  "project.governanceGates": "گیت‌های Approval، Global Stop و عملیات حساسی که Admin نیز نمی‌تواند آن‌ها را دور بزند.",
  "project.catalogCounts": "شمارش Entityهای ثبت‌شده در کاتالوگ‌های نسخه‌دار؛ این عدد کیفیت یا آمادگی آن‌ها را تضمین نمی‌کند.",
  "project.viewDataBoundary": "مرز دادهٔ هر نمای Back Office و اطلاعاتی که عمداً برای کاهش افشا نمایش داده نمی‌شود.",
  "project.plannerDecision": "طرح‌های ثبت‌شده، آمادگی تیم، escalation و وضعیت تصمیم خروجی پیش از dispatch.",
  "project.projectionMemory": "سلامت Projection و بازسازی read model همراه با حافظه و Context نسخه‌دار و redacted.",
  "project.currentMemory": "metadata حافظهٔ فعال پروژه؛ متن حساس یا محتوای کامل حافظه در این نما نمایش داده نمی‌شود.",
  "project.contextRetrieval": "رکورد انتخاب حافظه برای Task، Step، Role و نسخهٔ سند تا پاسخ AI قابل بازپخش باشد.",
  "operations.timeline": "Timeline خلاصهٔ امن Eventها برای ردیابی تغییرات، بدون Prompt، Credential یا خروجی خام AI.",
  "operations.organizationEvaluation": "ارزیابی عملکرد سازمان بر پایهٔ Evidence؛ نتیجه پیشنهاد است و خودش مجوز تغییر تیم نیست.",
  "operations.nextSteps": "اقدام‌های بعدی محاسبه‌شده از وضعیت فعلی، گیت‌ها و blockerها.",
  "operations.priorityLedger": "دفتر نسخه‌دار گام‌های اولویت‌دار و وضعیت واقعی آن‌ها؛ Done فقط با Evidence معتبر است.",
  "operations.ownerActions": "تصمیم‌ها و اقدام‌های منتظر Owner یا Admin مجاز که پیش از ادامهٔ جریان باید تعیین تکلیف شوند.",
  "operations.invariantBoundaries": "قواعد غیرقابل‌تضعیف مانند Global Stop، Secret safety، جداسازی پروژه و گیت Production.",
  "guide.aiRoles": "تعریف، ورودی و خروجی همهٔ AI Roleهای ثبت‌شده برای خواندن دقیق گزارش‌ها.",
  "guide.conceptsContracts": "واژه‌نامهٔ قراردادها و مفاهیم کلیدی Back Office برای جلوگیری از برداشت اشتباه.",
  "guide.walkthrough": "راهنمای عملی و project-scoped برای حرکت از ورود تا آماده‌سازی پروژه. فقط عملیات واقعاً موجود را قابل اقدام نشان می‌دهد.",
  "guide.serviceSettings": "تنظیم فعال‌بودن Walk-Through برای همین پروژه. غیرفعال‌سازی، راهنمای فعال این مرورگر را هم متوقف می‌کند؛ دادهٔ پروژه حذف نمی‌شود.",
  "guide.setupProgress": "پیشرفت فقط از دادهٔ واقعی Intake، ورودی، Foundation و Settings محاسبه می‌شود؛ بازدید از یک صفحه Done محسوب نمی‌شود.",
  "guide.gatedCapability": "گام گیت‌شده به مجوز، Evidence یا اتصال عملیاتی مستقل نیاز دارد. این راهنما هیچ گیتی را دور نمی‌زند.",
  "guide.consultation": "مشاورهٔ گام‌محور زمینهٔ همان فیلدها را می‌داند و پاسخ را به‌شکل گفت‌وگو نشان می‌دهد. می‌توانید از میان Profileهای آمادهٔ همان پروژه انتخاب کنید؛ Provider زنده تنها پس از Health، بودجه و مجوز هزینهٔ مستقل قابل فراخوانی است. متن گفتگو ذخیره نمی‌شود.",
  "guide.minimize": "کمینه‌سازی، راهنمای فعال را به نشان H در لبهٔ انتخاب‌شده تبدیل می‌کند. وضعیت راهنما حفظ می‌شود و با کلیک روی H همان گام بازمی‌گردد.",
  "studio.sourceOfTruth": "Git و Document Registry مرجع canonical محصول‌اند؛ Notion یک Projection قابل بازسازی است.",
  "studio.productsMetric": "تعداد Productهای ثبت‌شده در Product Registry فعلی.",
  "studio.documentsMetric": "تعداد کل اسناد ثبت‌شده، مستقل از فعال یا بازنشسته‌بودن نسخه.",
  "studio.activeDocumentsMetric": "تعداد اسناد canonical با وضعیت فعال در رجیستری فعلی.",
  "studio.roadmapMetric": "تعداد آیتم‌های Roadmap نسخهٔ جاری؛ این عدد به معنی تکمیل آن‌ها نیست.",
  "studio.completenessMetric": "میانگین کامل‌بودن محاسبه‌شده بر پایهٔ اسناد الزامی؛ نبود Evidence به‌عنوان کامل محاسبه نمی‌شود.",
  "studio.canonicalDocuments": "اسناد ثبت‌شده همراه با نسخه، مالک، checksum و وضعیت canonical.",
  "studio.roadmapGates": "رودمپ و گیت‌های توسعه؛ وضعیت تکمیل فقط با Evidence معتبر نمایش داده می‌شود.",
  "studio.strategyExecutionGraph": "وابستگی میان راهبرد، milestone و گام اجرایی برای آشکارکردن blocker و چرخه.",
  "studio.products": "محصول‌ها با Scope، اسناد inherited، اسناد اختصاصی و completeness مستقل.",
  "studio.notionProjection": "وضعیت Projection اسناد به Notion؛ قطع اتصال، مرجع Git را از کار نمی‌اندازد.",
  "studio.errorsGaps": "خطاها و شکاف‌هایی که باید رفع یا صریحاً پذیرفته شوند تا ادعای کامل‌بودن معتبر باشد.",
  "studio.projectWorkspace": "نمای project-scoped از Intake، Foundation، ورودی‌ها، تنظیمات و Import plan.",
  "studio.projectIdentity": "نام، شناسه، lifecycle و نسخهٔ Project انتخاب‌شده؛ این داده‌ها Scope سایر بخش‌های همین نما را تعیین می‌کنند.",
  "studio.intake": "تعریف مسئله، هدف، کاربران و سطح خودکارسازی که نقطهٔ شروع جریان توسعه است.",
  "studio.foundation": "پیشنهاد پایهٔ تیم، Roadmap، Policy و معماری که پیش از اجرا نیازمند تأیید است.",
  "studio.projectInputs": "فایل‌ها و لینک‌های ورودی پروژه؛ فقط metadata امن در فهرست عمومی Studio دیده می‌شود.",
  "studio.effectiveSettings": "مقدار مؤثر تنظیمات پس از ترکیب default، project override و run override همراه با provenance.",
  "studio.importPlans": "برنامهٔ read-only برای واردکردن Repository موجود؛ ثبت برنامه به معنی fetch، commit یا deploy نیست.",
  "studio.operationalControls": "پیوند به Collaboration، Command، Catalog، Health، Inbox، Infrastructure و Delivery همان پروژه.",
  "studio.versionedEndpoints": "Endpointهای نسخه‌دار Workspace و Operations که درخواست‌های همین Project را بدون تغییر Scope هدایت می‌کنند.",
  "workspace.projectContext": "Project و نشست انسانی فعلی که تمام خواندن‌ها و تغییرات Workspace به آن محدود می‌شوند.",
  "workspace.foundationProposal": "تأیید یا بازگرداندن Foundation پیشنهادی پیش از شروع Flow پروژه.",
  "workspace.projectInputs": "ثبت ورودی خصوصی پس از کنترل ایمنی؛ فهرست فقط metadata و نتیجهٔ scan/parse را نشان می‌دهد.",
  "workspace.recall": "فراخوانی، آخرین دادهٔ ثبت‌شده در همین Scope پروژه را فقط به فرم بازمی‌گرداند؛ تا زمانی که دکمهٔ ثبت را نزنید هیچ نسخهٔ جدیدی ساخته نمی‌شود. متن خصوصی فقط با کلیک صریح Owner یا Admin، کنترل مجوز و تطبیق checksum بازخوانی می‌شود.",
  "workspace.versionedSettings": "تغییر لایه‌ای تنظیمات با دلیل، اثر و provenance؛ Secret یا Deploy از این فرم اجرا نمی‌شود.",
  "workspace.settingPresets": "الگوهای متداول مسیر و مقدار اولیهٔ تنظیم را پر می‌کنند. برای تنظیم سفارشی، «مسیر دلخواه» را انتخاب و مسیر JSON-safe را وارد کنید. Run override علاوه بر مسیر و مقدار، شناسهٔ Run مشخص می‌خواهد.",
  "workspace.policyPack": "اعمال مجموعهٔ تنظیمات پیشنهادی و تأییدشده؛ قواعد امنیتی غیرقابل‌تضعیف باقی می‌مانند.",
  "workspace.rollback": "بازگشت با ساخت نسخهٔ جدید از مقدار قدیمی؛ تاریخچه حذف یا بازنویسی نمی‌شود.",
  "workspace.effectiveSettings": "برای هر تنظیم، مقدار اعمال‌شده و لایهٔ منشأ آن نمایش داده می‌شود؛ زنجیرهٔ منشأ نشان می‌دهد کدام لایه برنده شد و کدام زیر لایهٔ بالاتر ماند. تعارض با کف Policy Pack یا نوع نادرست، اجرای Run را بسته نگه می‌دارد.",
  "workspace.settingChanges": "هر تغییر یک نسخهٔ append-only با diff، عامل، دلیل، اثر و مرجع rollback است؛ حذف override هم به‌صورت نسخهٔ جدید ثبت می‌شود و پس از restart زنده نمی‌شود.",
  "control.activeTeams": "تعداد تیم‌های فعال و تخصیص‌یافته در Scope همین پروژه.",
  "control.projectOperations": "نمای project-scoped و redacted عملیات Hero است. فقط metadata و Evidence امن را نشان می‌دهد و به‌تنهایی Provider، Secret، Pilot یا Production را اجرا نمی‌کند.",
  "control.commands": "فرمان‌ها و عملیات ثبت‌شدهٔ پروژه، مستقل از اینکه هنوز منتظر Approval یا اجرا باشند.",
  "control.catalogEntities": "اجزای ثبت‌شدهٔ سیستم و وابستگی‌های project-scoped آن‌ها.",
  "control.openNotifications": "اعلان‌های باز و اقدام‌پذیر پروژه پس از deduplication.",
  "control.readiness": "جمع‌بندی گیت‌های مهاجرت، سناریو، traceability و پذیرش پیش از Pilot یا Production.",
  "control.collaborationMemory": "گفتگوها، تیم‌ها و حافظهٔ پروژه با provenance و جداسازی بین پروژه‌ای.",
  "control.commandOperations": "فرمان، Approval، Queue، Run و وضعیت بازیابی عملیات پروژه.",
  "control.commandBoard": "کارت هر فرمان با وضعیت، ریسک، مانع و اقدام‌های مجاز؛ هر اقدام دوباره در سرور بررسی می‌شود و Production از اینجا اجرا نمی‌شود.",
  "control.catalogDrift": "کاتالوگ اجزا، وابستگی‌ها، تغییر ناهمخوان و Proposal اصلاح بدون overwrite خودکار.",
  "control.performanceHealth": "مصرف Token، بودجه، ارزیابی دقت، خطا، بازکاری و Health قابل‌توضیح.",
  "control.inboxObservability": "Inbox، Audit، Trace و SLIهای عملیاتی پروژه.",
  "control.infrastructure": "Repository، Server، Node، Environment، Secret reference و egress policy؛ Production مجوز مستقل دارد.",
  "control.deliveryArtifacts": "Release، Artifact، Export، portability و acceptance خروجی پروژه.",
  "control.hardening": "Retention، cleanup dry-run، audit امنیت و پوشش کنترل‌های مقاوم‌سازی.",
  "control.finalReadiness": "مهاجرت، بازسازی، سناریوهای ایزوله، traceability و تصمیم نهایی پیش از Pilot.",
  "identity.ownerAdmin": "Owner دسترسی سراسری و مدیریت Project/User دارد؛ Admin فقط Projectهای اعطاشده را ویرایش می‌کند و نمی‌تواند کاربر یا Project بسازد یا حذف کند.",
  "identity.viewer": "Viewer فقط Projectهای اعطاشده را می‌بیند و هیچ تغییری ثبت نمی‌کند.",
  "identity.projectGrant": "اتصال نسخه‌دار یک User به یک Project با نقش Admin یا Viewer؛ فقط Owner آن را ایجاد یا ابطال می‌کند.",
  "identity.humanLogin": "ورود داخلی با ایمیل، رمز و MFA؛ این مرحله بعد از محافظ شبکه‌ای Back Office انجام می‌شود.",
  "identity.loginSteps": "راهنمای سه مرحلهٔ ورود Test: نخست Basic Auth پنجرهٔ مرورگر، سپس ایمیل و رمز حساب انسانی، و در پایان کد شش‌رقمیِ درحال‌تغییر Authenticator. این سه مقدار جای هم استفاده نمی‌شوند.",
  "identity.configurationStatus": "آمادگی واقعی سرویس Human Identity را پیش از ارسال رمز بررسی می‌کند؛ عبور از Basic Auth به معنی آماده‌بودن این لایه نیست.",
  "identity.management": "مدیریت حساب‌ها، نشست‌ها و Project Grantها با Audit و دسترسی Owner-only.",
  "identity.createViewer": "ساخت حساب Viewer توسط Owner؛ پس از آن دسترسی هر Project جداگانه اعطا می‌شود.",
  "identity.assignGrant": "اعطای نقش Admin یا Viewer برای یک Project مشخص؛ دسترسی به پروژه‌های دیگر ایجاد نمی‌شود.",
  "identity.users": "فهرست حساب‌های انسانی و وضعیت MFA/فعال‌بودن بدون نمایش Password یا Secret.",
  "identity.projectGrants": "نسخه‌ها و وضعیت Grantهای یک Project؛ ابطال تاریخچهٔ قبلی را حذف نمی‌کند.",
  "lab.newRequest": "درخواست نمونه برای برنامه‌ریزی و آزمون در Safe Lab؛ Provider زنده یا Production را اجرا نمی‌کند.",
  "lab.controls": "کنترل سطح خودکارسازی و Global Stop برای شبیه‌سازی جریان امن.",
  "lab.autonomy": "در Safe Lab تعیین می‌کند اجرای شبیه‌سازی‌شده منتظر تأیید بماند یا پس از گیت‌های مجاز خودکار ادامه دهد.",
  "lab.globalStop": "توقف اضطراری ایجاد یا تأیید Run تازه را می‌بندد؛ داده را حذف نمی‌کند و به معنی شکست پروژه نیست.",
  "lab.currentScope": "محدودهٔ فعال آزمایش؛ Fake Agent یعنی Provider زنده، هزینه و Production درگیر نیستند.",
  "lab.teamControl": "وضعیت تیم‌ها و گیت آمادگی آن‌ها در محیط آزمایشی.",
  "lab.multiAiDecision": "نمای نقش‌ها، Profileها، Invocation، Evaluation و Decision در حالت Fake Agent.",
  "lab.criticalPrinciplesRelease": "اصول حیاتی و فلو انتشار آزمایشی؛ هیچ مجوز Production از این نما ایجاد نمی‌شود.",
  "lab.requestsExecutionPlan": "درخواست‌های ثبت‌شده و برنامهٔ اجرای شبیه‌سازی‌شده در Safe Lab.",
  "lab.aiRoles": "تعداد AI Roleهای قراردادی حاضر در شبیه‌سازی؛ Role با Team یا User یکسان نیست.",
  "lab.providers": "تعداد Providerهای ثبت‌شده در حالت مشاهده‌ای؛ Safe Lab هیچ Provider زنده‌ای را فعال نمی‌کند.",
  "lab.profiles": "تعداد Agent Profileهای نسخه‌دار مورد استفادهٔ سناریوی آزمایشی.",
  "lab.invocations": "Invocationهای Fake Agent ثبت‌شده برای بازپخش جریان بدون هزینهٔ Provider.",
  "lab.evaluations": "Evaluationهای synthetic برای آزمون تصمیم‌سازی در Safe Lab.",
  "lab.decisions": "تصمیم‌های ثبت‌شدهٔ سناریوی شبیه‌سازی؛ مجوز عملیات بیرونی محسوب نمی‌شوند.",
  "lab.releases": "Releaseهای نمایشی در فلو Test؛ هیچ‌کدام مجوز یا استقرار Production ایجاد نمی‌کنند."
});

function serializeFeatureHelp() {
  return JSON.stringify(HERO_FEATURE_HELP)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function icon(name) {
  const paths = {
    portfolio: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4Zm9 0A1.5 1.5 0 0 1 14.5 4h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4Zm-9 9A1.5 1.5 0 0 1 5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4Zm9 0a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4Z"/>',
    command: '<path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 5 3 3-3 3m5 0h5"/>',
    studio: '<path d="M5 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm13 4h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1M7 8h7M7 12h7M7 16h4"/>',
    workspace: '<path d="M4 7.5h16v11A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-11ZM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-5 5h2"/>',
    control: '<path d="M4 6h9M17 6h3M4 12h3m4 0h9M4 18h7m4 0h5M13 4v4M7 10v4m4 2v4"/>',
    walkthrough: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Zm3 5h7M8 13h7M8 17h4"/><path d="m17 20 1.5 1.5L22 18"/>',
    identity: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0m12-8 2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    theme: '<path d="M20 15.2A8 8 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/>'
  };
  return `<svg class="hero-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] ?? paths.command}</svg>`;
}

export function getHeroShellStyles() {
  return `
    @font-face {
      font-family: "Vazirmatn";
      src: url("/api/ui-assets/vazirmatn.woff2") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }
    :root, body, button, input, select, textarea { font-family: Vazirmatn, sans-serif !important; }
    :root {
      font-family: Vazirmatn, sans-serif;
      --hero-ink: #172033;
      --hero-muted: #67738a;
      --hero-canvas: #f3f5f9;
      --hero-surface: #ffffff;
      --hero-surface-raised: #ffffff;
      --hero-line: #dfe5ee;
      --hero-line-strong: #cbd4e2;
      --hero-brand: #4f46e5;
      --hero-brand-hover: #4338ca;
      --hero-brand-soft: #eef2ff;
      --hero-success: #087f5b;
      --hero-success-soft: #e8f7f1;
      --hero-warning: #9a5b00;
      --hero-warning-soft: #fff4d8;
      --hero-danger: #b4234d;
      --hero-danger-soft: #fff0f3;
      --hero-space-1: 4px;
      --hero-space-2: 8px;
      --hero-space-3: 12px;
      --hero-space-4: 16px;
      --hero-space-5: 24px;
      --hero-control-height: 38px;
      --hero-control-radius: 10px;
      --hero-surface-radius: 14px;
      --hero-shadow-sm: 0 1px 2px rgba(20, 29, 48, .04), 0 5px 16px rgba(20, 29, 48, .04);
      --hero-shadow-lg: 0 24px 70px rgba(16, 24, 40, .18);
    }
    :root[data-hero-theme="dark"] {
      color-scheme: dark;
      --hero-ink: #eef2ff;
      --hero-muted: #aeb8cc;
      --hero-canvas: #0d1220;
      --hero-surface: #141b2d;
      --hero-surface-raised: #1b2439;
      --hero-line: #2b354c;
      --hero-line-strong: #3b4862;
      --hero-brand: #8b83ff; --hero-brand-solid: #5b52e0;
      --hero-brand-hover: #a39dff;
      --hero-brand-soft: #28274d;
      --hero-success: #52d6a2;
      --hero-success-soft: #17392f;
      --hero-warning: #ffc260;
      --hero-warning-soft: #40331c;
      --hero-danger: #ff84a2;
      --hero-danger-soft: #492334;
      --ink: var(--hero-ink);
      --muted: var(--hero-muted);
      --line: var(--hero-line);
      --surface: var(--hero-surface);
      --canvas: var(--hero-canvas);
      --primary: var(--hero-brand);
      --primary-soft: var(--hero-brand-soft);
      --teal: var(--hero-success);
      --teal-soft: var(--hero-success-soft);
      --amber: var(--hero-warning);
      --amber-soft: var(--hero-warning-soft);
      --rose: var(--hero-danger);
      --rose-soft: var(--hero-danger-soft);
    }
    .hero-skip-link { position: fixed; inset-inline-start: 16px; top: -80px; z-index: 10000; padding: 10px 14px; border-radius: 10px; background: #111827; color: #fff; text-decoration: none; }
    .hero-skip-link:focus { top: 12px; }
    .hero-appbar { position: sticky; top: 0; z-index: 900; min-height: 68px; border-bottom: 1px solid rgba(203, 212, 226, .78); background: color-mix(in srgb, var(--hero-surface) 92%, transparent); color: var(--hero-ink); backdrop-filter: blur(18px) saturate(1.35); }
    .hero-appbar-inner { width: min(1560px, calc(100% - 32px)); min-height: 68px; margin: 0 auto; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 18px; }
    .hero-app-brand { display: inline-flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; white-space: nowrap; }
    .hero-app-mark { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(145deg, #625bf6, #3931b6); color: #fff; font: 900 16px/1 system-ui, sans-serif; box-shadow: 0 7px 18px rgba(79,70,229,.25); }
    .hero-app-brand-copy { display: grid; gap: 1px; }
    .hero-app-brand-copy strong { font: 850 13px/1.3 Vazirmatn, sans-serif; letter-spacing: .01em; }
    .hero-app-brand-copy small { color: var(--hero-muted); font: 650 9px/1.2 Vazirmatn, sans-serif; letter-spacing: .12em; text-transform: uppercase; }
    .hero-app-actions { justify-self: end; }
    .hero-side-nav { position: fixed; z-index: 850; top: 84px; bottom: 18px; inset-inline-end: 18px; display: grid; grid-template-rows: auto minmax(0, 1fr); width: 244px; overflow: hidden; border: 1px solid var(--hero-line); border-radius: 16px; background: color-mix(in srgb, var(--hero-surface-raised) 94%, transparent); box-shadow: var(--hero-shadow-lg); backdrop-filter: blur(16px) saturate(1.2); }
    .hero-side-nav-head { display: flex; align-items: center; gap: 8px; padding: 13px 13px 10px; border-bottom: 1px solid var(--hero-line); color: var(--hero-muted); font-size: .67rem; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }.hero-side-nav-head span { display: grid; place-items: center; width: 23px; height: 23px; border-radius: 7px; background: var(--hero-brand-soft); color: var(--hero-brand); font: 900 .8rem/1 system-ui, sans-serif; letter-spacing: 0; }
    .hero-global-nav { display: grid; align-content: start; min-width: 0; gap: 4px; overflow-y: auto; overscroll-behavior: contain; padding: 8px; scrollbar-color: var(--hero-line-strong) transparent; scrollbar-width: thin; }
    .hero-global-nav a { position: relative; display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: center; gap: 9px; min-height: 46px; padding: 8px 11px; border-radius: 11px; color: var(--hero-muted); text-decoration: none; }
    .hero-global-nav a:hover { background: var(--hero-brand-soft); color: var(--hero-brand); }
    .hero-global-nav a[aria-current="page"] { background: var(--hero-brand-soft); color: var(--hero-brand); font-weight: 800; }
    .hero-global-nav a[aria-current="page"]::after { position: absolute; inset-inline-end: 0; top: 11px; bottom: 11px; width: 3px; border-radius: 3px; background: var(--hero-brand); content: ""; }
    .hero-nav-copy { display: grid; min-width: 0; gap: 1px; }
    .hero-nav-copy b { font-size: 11px; line-height: 1.3; }
    .hero-nav-copy small { opacity: .75; font: 600 8px/1.2 Vazirmatn, sans-serif; direction: ltr; }
    .hero-icon { width: 17px; height: 17px; flex: 0 0 17px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
    .hero-app-actions { display: flex; align-items: center; gap: 7px; }
    .hero-project-context { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; max-width: 260px; padding: 5px 8px 5px 6px; border: 1px solid var(--hero-line-strong); border-radius: 10px; background: var(--hero-surface); color: var(--hero-ink); text-decoration: none; box-shadow: var(--hero-shadow-sm); }
    .hero-project-context > span { display: grid; min-width: 0; gap: 1px; }
    .hero-project-context b { overflow: hidden; font-size: 10px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; direction: ltr; }
    .hero-project-context small { color: var(--hero-muted); font-size: 8px; line-height: 1.2; }
    .hero-project-context em { display: grid; place-items: center; width: 23px; height: 23px; flex: 0 0 23px; border-radius: 7px; background: var(--hero-brand-soft); color: var(--hero-brand); font-size: 13px; font-style: normal; }
    .hero-project-context:hover, .hero-project-context:focus-visible { border-color: var(--hero-brand); color: var(--hero-brand); outline: 0; }
    .hero-shell-button { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 7px 10px; border: 1px solid var(--hero-line); border-radius: 10px; background: var(--hero-surface); color: var(--hero-muted); cursor: pointer; font: 750 11px/1.2 inherit; }
    .hero-shell-button:hover { border-color: var(--hero-line-strong); color: var(--hero-ink); box-shadow: var(--hero-shadow-sm); }
    .hero-environment { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 6px 9px; border: 1px solid var(--hero-line); border-radius: 999px; color: var(--hero-muted); font-size: 10px; font-weight: 750; white-space: nowrap; }
    .hero-environment::before { width: 7px; height: 7px; border-radius: 50%; background: var(--hero-success); box-shadow: 0 0 0 3px var(--hero-success-soft); content: ""; }
    .hero-command-dialog { width: min(650px, calc(100% - 30px)); max-height: min(700px, calc(100vh - 50px)); padding: 0; border: 1px solid var(--hero-line); border-radius: 18px; background: var(--hero-surface-raised); color: var(--hero-ink); box-shadow: var(--hero-shadow-lg); }
    .hero-command-dialog::backdrop { background: rgba(8, 15, 30, .54); backdrop-filter: blur(3px); }
    .hero-command-head { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid var(--hero-line); }
    .hero-command-head input { min-width: 0; flex: 1; min-height: 42px; padding: 9px 2px; border: 0; outline: 0; background: transparent; color: var(--hero-ink); font: 700 14px/1.4 inherit; }
    .hero-command-head kbd { padding: 4px 7px; border: 1px solid var(--hero-line-strong); border-bottom-width: 2px; border-radius: 6px; color: var(--hero-muted); background: var(--hero-canvas); font: 700 9px/1 Vazirmatn, sans-serif; }
    .hero-command-list { display: grid; gap: 4px; max-height: 520px; overflow: auto; padding: 10px; }
    .hero-command-list a { display: grid; grid-template-columns: 36px minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 10px; border-radius: 11px; color: inherit; text-decoration: none; }
    .hero-command-list a:hover, .hero-command-list a:focus-visible { outline: 0; background: var(--hero-brand-soft); color: var(--hero-brand); }
    .hero-command-symbol { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--hero-canvas); }
    .hero-command-copy { display: grid; gap: 2px; }
    .hero-command-copy strong { font-size: 12px; }
    .hero-command-copy small { color: var(--hero-muted); font-size: 10px; }
    .hero-command-group { padding: 8px 10px 2px; color: var(--hero-muted); font-size: 9px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
    .hero-command-empty { padding: 28px; color: var(--hero-muted); text-align: center; font-size: 12px; }
    /* Shared Back Office rhythm.  This is intentionally a light consistency
       layer: individual surfaces keep their own layouts and specialist panels
       (Advisor, Walk-Through and Smart Tester) retain their compact controls. */
    .hero-page-header, .page-head, .top, .topbar { gap: var(--hero-space-4); }
    .hero-page-header :is(h1, h2), .page-head :is(h1, h2), .top :is(h1, h2), .topbar :is(h1, h2), .section-head :is(h2, h3), .panel-head :is(h2, h3), .head :is(h2, h3) { font-weight: 850; letter-spacing: -.01em; }
    .hero-page-header :is(.lead, .subtitle, .muted, .helper-copy), .page-head :is(.lead, .subtitle, .muted, .helper-copy), .top :is(.lead, .subtitle, .muted, .helper-copy), .topbar :is(.lead, .subtitle, .muted, .helper-copy) { max-width: 72ch; }
    .hero-page-actions, .page-actions, .top-actions, .actions, .panel-head-actions, .dialog-actions, .form-toolbar, .setting-actions { align-items: center; gap: var(--hero-space-2); }
    .form, .create-form, .target-form, .form-grid { gap: var(--hero-space-3); }
    .form label, .create-form label, .target-form label, .form-grid label { gap: var(--hero-space-1); font-weight: 750; }
    .form :is(input, select, textarea), .create-form :is(input, select, textarea), .target-form :is(input, select, textarea), .form-grid :is(input, select, textarea) { min-height: var(--hero-control-height); border-radius: var(--hero-control-radius); }
    .form textarea, .create-form textarea, .target-form textarea, .form-grid textarea { min-height: 92px; }
    .form :is(button, .button), .create-form :is(button, .button), .target-form :is(button, .button), .dialog-actions :is(button, .button), .hero-page-actions :is(button, .button), .page-actions :is(button, .button) { min-height: var(--hero-control-height); border-radius: var(--hero-control-radius); font-weight: 800; }
    .panel, .section, .content-panel, .hero, .project-card, .card, .context { border-radius: var(--hero-surface-radius); }
    .helper-copy[data-hero-info-moved="true"] { display: none !important; }
    [data-hero-info-key], .hero-feature-name { position: relative; }
    .hero-feature-with-info { display: inline-flex !important; align-items: center; gap: .38rem; max-width: 100%; min-width: 0; }
    .form-label-with-info { display: inline-flex; align-items: center; align-self: start; gap: .38rem; min-height: 1.75rem; min-width: 0; }
    .form label > .hero-feature-with-info { align-self: start; width: fit-content; }
    .hero-info-trigger { display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem; min-width: 1.75rem; padding: 0; border: 1px solid var(--hero-line-strong); border-radius: 999px; background: var(--hero-surface); color: var(--hero-muted); box-shadow: none; cursor: help; font: 850 .72rem/1 Vazirmatn, sans-serif; text-transform: lowercase; vertical-align: middle; }
    .hero-info-trigger:hover, .hero-info-trigger:focus-visible, .hero-info-trigger[aria-expanded="true"] { border-color: var(--hero-brand); outline: 0; background: var(--hero-brand-soft); color: var(--hero-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--hero-brand) 16%, transparent); }
    .hero-feature-tooltip { position: fixed; z-index: 12000; width: min(330px, calc(100vw - 24px)); padding: 11px 13px; border: 1px solid var(--hero-line-strong); border-radius: 12px; background: var(--hero-surface-raised); color: var(--hero-ink); box-shadow: var(--hero-shadow-lg); font: 650 .82rem/1.8 Vazirmatn, sans-serif; text-align: start; direction: rtl; white-space: pre-line; pointer-events: none; opacity: 0; transform: translateY(4px); transition: opacity .12s ease, transform .12s ease; }
    .hero-feature-tooltip[data-open="true"] { opacity: 1; transform: translateY(0); }
    .hero-advisable-form { position: relative; }
    .hero-form-suggestion-trigger { position: absolute; z-index: 5; top: 8px; inset-inline-end: 8px; display: grid; place-items: center; width: 24px; height: 24px; min-width: 24px; min-height: 24px; margin: 0; padding: 0; border: 1px solid color-mix(in srgb, var(--hero-brand) 42%, var(--hero-line)); border-radius: 999px; background: var(--hero-brand-soft); color: var(--hero-brand); cursor: pointer; font: 800 .78rem/1 Vazirmatn, sans-serif; }
    .hero-form-suggestion-trigger:hover, .hero-form-suggestion-trigger:focus-visible { border-color: var(--hero-brand); outline: 0; background: var(--hero-brand-solid); color: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--hero-brand) 16%, transparent); }
    .hero-form-suggestion-dialog { width: min(820px, calc(100% - 28px)); height: min(840px, calc(100vh - 34px)); max-height: min(840px, calc(100vh - 34px)); box-sizing: border-box; padding: 0; overflow: hidden; border: 1px solid var(--hero-line); border-radius: 17px; background: var(--hero-surface-raised); color: var(--hero-ink); box-shadow: var(--hero-shadow-lg); direction: rtl; }
    .hero-form-suggestion-dialog::backdrop { background: rgba(8, 15, 30, .56); backdrop-filter: blur(3px); }
    .hero-form-suggestion-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 15px 17px; border-bottom: 1px solid var(--hero-line); }
    .hero-form-suggestion-head h2 { margin: 0; color: var(--hero-brand); font-size: .95rem; line-height: 1.6; }
    .hero-form-suggestion-head p { margin: 3px 0 0; color: var(--hero-muted); font-size: .69rem; line-height: 1.7; }
    .hero-form-suggestion-close { width: 30px; height: 30px; padding: 0; border: 1px solid var(--hero-line-strong); border-radius: 8px; background: var(--hero-surface); color: var(--hero-muted); cursor: pointer; font: 900 1rem/1 system-ui, sans-serif; }
    .hero-form-suggestion-close:hover, .hero-form-suggestion-close:focus-visible { border-color: var(--hero-brand); outline: 0; color: var(--hero-brand); }
    /* The dialog can contain request controls, results, decision support,
       an optional document and the transient feedback chat.  A four-row grid
       used to place the last two items into implicit rows outside its fixed
       height, which could hide the chat input.  Keep one deliberate scroll
       region instead, so every part remains reachable at every viewport. */
    .hero-form-suggestion-body { display: flex; flex-direction: column; gap: 10px; min-width: 0; min-height: 0; height: calc(100% - 78px); padding: 14px 17px 17px; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
    .hero-form-suggestion-body > * { flex: 0 0 auto; min-width: 0; max-width: 100%; }
    .hero-form-suggestion-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
    .hero-form-suggestion-fields label { display: grid; gap: 4px; min-width: 0; color: var(--hero-muted); font-size: .68rem; font-weight: 800; }
    .hero-form-suggestion-fields label.full { grid-column: 1 / -1; }
    .hero-form-suggestion-fields select, .hero-form-suggestion-fields textarea { width: 100%; min-width: 0; box-sizing: border-box; padding: 7px 9px; border: 1px solid var(--hero-line-strong); border-radius: 8px; background: var(--hero-surface); color: var(--hero-ink); font: 700 .72rem/1.7 Vazirmatn, sans-serif; }
    .hero-form-suggestion-fields textarea { min-height: 48px; resize: vertical; }
    .hero-form-suggestion-fields textarea[data-hero-form-purpose-output] { min-height: 92px; line-height: 1.9; }
    .hero-form-suggestion-fields textarea[readonly] { color: var(--hero-muted); }
    .hero-form-suggestion-request { display: grid; gap: 10px; }
    .hero-form-suggestion-actions { display: flex; align-items: center; justify-content: flex-start; gap: 8px; flex-wrap: wrap; }
    .hero-form-suggestion-actions button, .hero-form-suggestion-card button { min-height: 33px; padding: 7px 11px; border: 1px solid var(--hero-line-strong); border-radius: 8px; background: var(--hero-surface); color: var(--hero-brand); cursor: pointer; font: 800 .72rem/1.3 Vazirmatn, sans-serif; }
    .hero-form-suggestion-actions button[type="submit"], .hero-form-suggestion-card button { border-color: var(--hero-brand); background: var(--hero-brand-solid); color: #fff; }
    .hero-form-suggestion-actions button:hover, .hero-form-suggestion-actions button:focus-visible, .hero-form-suggestion-card button:hover, .hero-form-suggestion-card button:focus-visible { outline: 0; box-shadow: 0 0 0 3px color-mix(in srgb, var(--hero-brand) 16%, transparent); }
    .hero-form-suggestion-actions button[disabled], .hero-form-suggestion-card button[disabled] { opacity: .55; cursor: wait; }
    .hero-form-suggestion-status { min-height: 1.2em; margin: 0; color: var(--hero-muted); font-size: .69rem; line-height: 1.7; }
    .hero-form-suggestion-status[data-state="error"] { color: var(--hero-danger); }
    .hero-form-suggestion-results { display: grid; align-content: start; gap: 9px; min-height: 0; max-height: min(42vh, 390px); overflow: auto; padding: 1px 4px 2px 2px; overscroll-behavior: contain; scrollbar-gutter: stable; }
    .hero-form-suggestion-results:empty { display: none; }
    .hero-form-suggestion-card { display: grid; gap: 7px; min-width: 0; padding: 10px; border: 1px solid var(--hero-line); border-radius: 11px; background: var(--hero-surface); font-size: .68rem; }
    .hero-form-suggestion-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 9px; }
    .hero-form-suggestion-card-head strong { color: var(--hero-ink); font-size: .71rem; }
    .hero-form-suggestion-card-head small { color: var(--hero-muted); font-size: .61rem; line-height: 1.65; overflow-wrap: anywhere; }
    .hero-form-suggestion-card button { flex: 0 0 auto; }
    .hero-form-suggestion-card-fields { display: grid; gap: 6px; max-height: 220px; overflow: auto; padding: 1px; }
    .hero-form-suggestion-card-field { display: grid; grid-template-columns: minmax(100px, .35fr) minmax(0, 1fr); align-items: center; gap: 7px; min-width: 0; }
    .hero-form-suggestion-card-field > span { color: var(--hero-muted); font-size: .65rem; font-weight: 800; overflow-wrap: anywhere; }
    .hero-form-suggestion-card-field input, .hero-form-suggestion-card-field textarea { width: 100%; min-width: 0; box-sizing: border-box; padding: 5px 7px; border: 1px solid var(--hero-line); border-radius: 7px; background: var(--hero-canvas); color: var(--hero-ink); font: 650 .66rem/1.6 Vazirmatn, sans-serif; }
    .hero-form-suggestion-card-field textarea { min-height: 38px; resize: vertical; }
    .hero-form-suggestion-card-field input[type="checkbox"], .hero-form-suggestion-card-field input[type="radio"] { width: 16px; min-width: 16px; justify-self: start; }
    .hero-form-suggestion-document { display: grid; gap: 8px; padding: 11px; border: 1px solid color-mix(in srgb, var(--hero-brand) 34%, var(--hero-line)); border-radius: 11px; background: color-mix(in srgb, var(--hero-brand-soft) 22%, var(--hero-surface)); }
    .hero-form-suggestion-document[hidden] { display: none; }
    .hero-form-suggestion-document header { display: flex; align-items: flex-start; justify-content: space-between; gap: 9px; }
    .hero-form-suggestion-document header > div { display: grid; gap: 2px; min-width: 0; }
    .hero-form-suggestion-document strong { color: var(--hero-ink); font-size: .76rem; }
    .hero-form-suggestion-document small { color: var(--hero-muted); font-size: .64rem; line-height: 1.65; }
    .hero-form-suggestion-document header button { flex: 0 0 auto; min-height: 33px; padding: 7px 11px; border: 1px solid var(--hero-brand); border-radius: 8px; background: var(--hero-brand-solid); color: #fff; cursor: pointer; font: 800 .72rem/1.3 Vazirmatn, sans-serif; }
    .hero-form-suggestion-document header button:hover, .hero-form-suggestion-document header button:focus-visible { outline: 0; box-shadow: 0 0 0 3px color-mix(in srgb, var(--hero-brand) 16%, transparent); }
    .hero-form-suggestion-document-name { margin: 0; color: var(--hero-muted); direction: ltr; text-align: right; font: 700 .65rem/1.5 ui-monospace, monospace; overflow-wrap: anywhere; }
    .hero-form-suggestion-document textarea { width: 100%; min-height: 150px; max-height: 300px; box-sizing: border-box; padding: 8px; border: 1px solid var(--hero-line); border-radius: 8px; resize: vertical; background: var(--hero-canvas); color: var(--hero-ink); font: 650 .68rem/1.8 Vazirmatn, sans-serif; white-space: pre-wrap; }
    .hero-form-suggestion-feedback { display: grid; gap: 8px; min-width: 0; padding: 10px; border: 1px solid color-mix(in srgb, var(--hero-brand) 34%, var(--hero-line)); border-radius: 11px; background: color-mix(in srgb, var(--hero-brand-soft) 34%, var(--hero-surface)); }
    .hero-form-suggestion-feedback[hidden] { display: none; }
    .hero-form-suggestion-feedback-head { display: grid; gap: 2px; }
    .hero-form-suggestion-feedback-head strong { color: var(--hero-brand); font-size: .74rem; }
    .hero-form-suggestion-feedback-head small { color: var(--hero-muted); font-size: .64rem; line-height: 1.7; }
    .hero-form-suggestion-conversation { display: grid; align-content: start; gap: 6px; max-height: 118px; overflow: auto; padding: 1px 2px; overscroll-behavior: contain; }
    .hero-form-suggestion-message { padding: 7px 9px; border: 1px solid var(--hero-line); border-radius: 8px; background: var(--hero-surface); color: var(--hero-ink); font-size: .66rem; line-height: 1.75; overflow-wrap: anywhere; }
    .hero-form-suggestion-message b { display: block; margin-bottom: 2px; color: var(--hero-brand); font-size: .62rem; }
    .hero-form-suggestion-message[data-speaker="user"] { border-inline-start: 3px solid var(--hero-brand); background: color-mix(in srgb, var(--hero-brand-soft) 42%, var(--hero-surface)); }
    .hero-form-suggestion-feedback-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; min-width: 0; align-items: end; }
    .hero-form-suggestion-feedback-form textarea { width: 100%; min-width: 0; min-height: 58px; max-height: 104px; box-sizing: border-box; padding: 8px; border: 1px solid var(--hero-line-strong); border-radius: 8px; resize: vertical; background: var(--hero-surface); color: var(--hero-ink); font: 700 .66rem/1.7 Vazirmatn, sans-serif; overflow-wrap: anywhere; }
    .hero-form-suggestion-feedback-form button { min-height: 36px; max-width: 100%; padding: 7px 11px; border: 1px solid var(--hero-brand); border-radius: 8px; background: var(--hero-brand-solid); color: #fff; cursor: pointer; font: 800 .66rem/1.3 Vazirmatn, sans-serif; white-space: normal; }
    .hero-form-suggestion-feedback-form button[disabled], .hero-form-suggestion-feedback-form textarea[disabled] { opacity: .55; cursor: not-allowed; }
    @media (max-width: 600px) { .hero-form-suggestion-dialog { width: calc(100% - 20px); height: calc(100vh - 20px); max-height: calc(100vh - 20px); } .hero-form-suggestion-body { height: calc(100% - 74px); padding: 12px; } .hero-form-suggestion-fields { grid-template-columns: 1fr; } .hero-form-suggestion-fields label.full { grid-column: auto; } .hero-form-suggestion-card-head, .hero-form-suggestion-card-field, .hero-form-suggestion-document header { grid-template-columns: 1fr; display: grid; } .hero-form-suggestion-card button, .hero-form-suggestion-document header button { width: 100%; } .hero-form-suggestion-feedback-form { grid-template-columns: 1fr; } .hero-form-suggestion-feedback-form button { width: 100%; } }
    .hero-smart-testable { position: relative; }
    .hero-smart-tester-trigger { position: absolute; z-index: 5; top: 8px; inset-inline-end: 8px; display: grid; place-items: center; width: 24px; height: 24px; min-width: 24px; padding: 0; border: 1px solid color-mix(in srgb, var(--hero-brand) 42%, var(--hero-line)); border-radius: 999px; background: var(--hero-surface-raised); color: var(--hero-brand); box-shadow: 0 4px 10px rgba(29,36,79,.14); cursor: pointer; font: 900 .86rem/1 system-ui, sans-serif; direction: ltr; }
    .hero-smart-tester-trigger:hover, .hero-smart-tester-trigger:focus-visible { border-color: var(--hero-brand); outline: 0; background: var(--hero-brand-solid); color: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--hero-brand) 18%, transparent); }
    .hero-smart-tester-panel { position: fixed; z-index: 11030; top: 82px; right: 12px; display: grid; grid-template-rows: auto auto minmax(0,1fr) auto auto; gap: 9px; width: min(420px, calc(100vw - 24px)); height: min(680px, calc(100vh - 94px)); max-height: calc(100vh - 94px); min-width: 0; box-sizing: border-box; margin: 0; padding: 14px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--hero-brand) 46%, var(--hero-line)); border-radius: 15px; background: var(--hero-surface-raised); color: var(--hero-ink); box-shadow: 0 22px 56px rgba(32,27,116,.25); direction: rtl; contain: layout paint style; isolation: isolate; }
    .hero-smart-tester-panel[data-hero-smart-tester-side="left"] { right: auto; left: 12px; }.hero-smart-tester-panel[data-hero-smart-tester-side="right"] { right: 12px; left: auto; }
    .hero-smart-tester-head, .hero-smart-tester-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }.hero-smart-tester-head { display: grid; gap: 3px; justify-content: stretch; }.hero-smart-tester-head h2 { min-width: 0; margin: 0; color: var(--hero-brand); font-size: .9rem; line-height: 1.55; overflow-wrap: anywhere; }.hero-smart-tester-head p { width: 100%; min-width: 0; margin: 0; color: var(--hero-muted); font-size: .7rem; line-height: 1.75; overflow-wrap: anywhere; }.hero-smart-tester-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; clip-path: inset(50%); }
    .hero-smart-tester-panel button { min-height: 32px; padding: 6px 9px; border: 1px solid var(--hero-line-strong); border-radius: 8px; background: var(--hero-surface); color: var(--hero-brand); cursor: pointer; font: 800 .72rem/1.2 Vazirmatn, sans-serif; }.hero-smart-tester-panel button:hover, .hero-smart-tester-panel button:focus-visible { border-color: var(--hero-brand); outline: 0; background: var(--hero-brand-soft); }.hero-smart-tester-panel button[disabled] { opacity: .52; cursor: wait; }
    .hero-smart-tester-scroll { display: grid; align-content: start; gap: 8px; min-width: 0; min-height: 0; overflow: auto; padding: 1px 2px; overscroll-behavior: contain; scrollbar-gutter: stable; }.hero-smart-tester-message, .hero-smart-tester-report { min-width: 0; max-width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid var(--hero-line); border-radius: 10px; background: var(--hero-surface); font-size: .74rem; line-height: 1.82; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }.hero-smart-tester-message span, .hero-smart-tester-report span { display: block; min-width: 0; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }.hero-smart-tester-message[data-speaker="user"] { border-inline-start: 3px solid var(--hero-brand); background: color-mix(in srgb, var(--hero-brand-soft) 42%, var(--hero-surface)); }.hero-smart-tester-message[data-speaker="assistant"] { background: color-mix(in srgb, var(--hero-success-soft) 31%, var(--hero-surface)); }.hero-smart-tester-message[data-speaker="assistant"][data-state="error"] { border-color: color-mix(in srgb, var(--hero-danger) 48%, var(--hero-line)); background: color-mix(in srgb, var(--hero-danger-soft) 24%, var(--hero-surface)); }.hero-smart-tester-message b, .hero-smart-tester-report b { display: block; min-width: 0; margin-bottom: 4px; color: var(--hero-brand); font-size: .67rem; overflow-wrap: anywhere; }.hero-smart-tester-report[data-state="attention"] { border-color: color-mix(in srgb, var(--hero-warning) 45%, var(--hero-line)); }.hero-smart-tester-report[data-state="not-run"] { border-style: dashed; color: var(--hero-muted); }.hero-smart-tester-diagnosis { display: grid; gap: 9px; padding: 12px; border: 1px solid color-mix(in srgb, var(--hero-warning) 45%, var(--hero-line)); border-radius: 12px; background: color-mix(in srgb, var(--hero-warning) 9%, var(--hero-surface)); }.hero-smart-tester-diagnosis-head { display: grid; gap: 2px; }.hero-smart-tester-diagnosis-head h3 { margin: 0; color: var(--hero-ink); font: 900 .82rem/1.5 Vazirmatn, sans-serif; }.hero-smart-tester-diagnosis-head p { margin: 0; color: var(--hero-muted); font-size: .67rem; }.hero-smart-tester-diagnosis-grid { display: grid; gap: 7px; }.hero-smart-tester-diagnosis-item { padding: 9px 10px; border: 1px solid color-mix(in srgb, var(--hero-line) 84%, var(--hero-warning)); border-radius: 9px; background: var(--hero-surface); font-size: .68rem; line-height: 1.72; }.hero-smart-tester-diagnosis-item b { color: var(--hero-brand); font-size: .67rem; }.hero-smart-tester-diagnosis-item[data-kind="fix"] { border-inline-start: 3px solid var(--hero-success); }.hero-smart-tester-diagnosis-item[data-kind="verify"] { border-inline-start: 3px solid var(--hero-brand); }
    .hero-smart-tester-form { display: grid; min-width: 0; gap: 7px; }.hero-smart-tester-form textarea { width: 100%; min-height: 70px; max-height: 150px; box-sizing: border-box; padding: 8px; border: 1px solid var(--hero-line-strong); border-radius: 9px; background: var(--hero-surface); color: var(--hero-ink); font: 700 .75rem/1.7 Vazirmatn, sans-serif; resize: vertical; }.hero-smart-tester-selector { display: grid; min-width: 0; gap: 4px; color: var(--hero-muted); font-size: .68rem; font-weight: 800; }.hero-smart-tester-selector select { width: 100%; min-width: 0; min-height: 34px; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--hero-line-strong); border-radius: 8px; background: var(--hero-surface); color: var(--hero-ink); font: 700 .72rem/1.4 Vazirmatn, sans-serif; }.hero-smart-tester-actions button { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
    .hero-action-feedback { position: fixed; z-index: 12030; right: auto; bottom: 18px; left: 18px; display: grid; gap: 9px; width: min(460px, calc(100vw - 36px)); max-height: min(46vh, 420px); box-sizing: border-box; padding: 15px; overflow: auto; border: 1px solid var(--hero-line-strong); border-radius: 15px; background: var(--hero-surface-raised); color: var(--hero-ink); box-shadow: var(--hero-shadow-lg); direction: rtl; contain: layout paint style; isolation: isolate; }
    .hero-action-feedback[data-hero-action-feedback-side="left"] { right: auto; left: 18px; }.hero-action-feedback[data-hero-action-feedback-side="right"] { right: 18px; left: auto; }
    .hero-action-feedback[data-state="success"] { width: min(380px, calc(100vw - 36px)); gap: 6px; padding: 12px 13px; overflow: visible; border-color: color-mix(in srgb, var(--hero-success) 48%, var(--hero-line)); }.hero-action-feedback[data-state="error"] { border-color: color-mix(in srgb, var(--hero-danger) 55%, var(--hero-line)); }
    .hero-action-feedback-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }.hero-action-feedback-head h2 { margin: 0; color: var(--hero-ink); font-size: .9rem; line-height: 1.5; }.hero-action-feedback[data-state="success"] .hero-action-feedback-head h2 { color: var(--hero-success); }.hero-action-feedback[data-state="error"] .hero-action-feedback-head h2 { color: var(--hero-danger); }
    .hero-action-feedback-status { margin: 0; color: var(--hero-muted); font-size: .76rem; line-height: 1.85; overflow-wrap: anywhere; }.hero-action-feedback-meta { margin: 0; color: var(--hero-muted); font-size: .66rem; line-height: 1.7; }.hero-action-feedback[data-state="success"] .hero-action-feedback-meta { display: none; }.hero-action-feedback-actions { display: flex; flex-wrap: wrap; gap: 7px; }.hero-action-feedback[data-state="success"] .hero-action-feedback-actions { justify-content: flex-end; }.hero-action-feedback button { min-height: 33px; padding: 7px 10px; border: 1px solid var(--hero-line-strong); border-radius: 8px; background: var(--hero-surface); color: var(--hero-brand); cursor: pointer; font: 800 .72rem/1.2 Vazirmatn, sans-serif; }.hero-action-feedback button:hover, .hero-action-feedback button:focus-visible { border-color: var(--hero-brand); outline: 0; background: var(--hero-brand-soft); }.hero-action-feedback button[data-kind="close"] { color: var(--hero-muted); }.hero-action-feedback button[data-kind="smart"] { border-color: color-mix(in srgb, var(--hero-brand) 48%, var(--hero-line)); color: var(--hero-brand); }.hero-action-feedback button[data-kind="move"] { color: var(--hero-muted); }.hero-action-feedback button[data-kind="move"][aria-pressed="true"] { border-color: var(--hero-brand); background: var(--hero-brand-soft); color: var(--hero-brand); cursor: default; }
    .hero-walkthrough-coach, .hero-walkthrough-advisor { position: fixed; z-index: 11000; top: 92px; right: 12px; display: grid; gap: 9px; width: min(440px, calc(100vw - 24px)); max-height: calc(100vh - 104px); overflow: auto; box-sizing: border-box; margin: 0; padding: 14px 15px; border: 1px solid color-mix(in srgb, var(--hero-brand) 45%, var(--hero-line)); border-radius: 14px; background: var(--hero-surface-raised); color: var(--hero-ink); box-shadow: 0 18px 44px rgba(47,43,160,.22); direction: rtl; overscroll-behavior: contain; contain: layout paint style; isolation: isolate; }
    .hero-walkthrough-coach[data-hero-walkthrough-side="left"] { right: auto; left: 12px; }.hero-walkthrough-coach[data-hero-walkthrough-side="right"] { right: 12px; left: auto; }
    .hero-walkthrough-advisor { z-index: 11010; border-color: color-mix(in srgb, var(--hero-success) 42%, var(--hero-line)); }.hero-walkthrough-advisor[data-hero-walkthrough-side="left"] { right: auto; left: 12px; }.hero-walkthrough-advisor[data-hero-walkthrough-side="right"] { right: 12px; left: auto; }
    .hero-walkthrough-coach strong { color: var(--hero-brand); font-size: .88rem; }.hero-walkthrough-coach p { margin: 0; color: var(--hero-muted); font-size: .78rem; line-height: 1.85; }.hero-walkthrough-coach-actions, .hero-walkthrough-advisor-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }.hero-walkthrough-coach a, .hero-walkthrough-coach button, .hero-walkthrough-advisor button { min-height: 32px; padding: 6px 9px; border: 1px solid var(--hero-line-strong); border-radius: 8px; background: var(--hero-surface); color: var(--hero-brand); font: 800 .72rem/1.2 Vazirmatn, sans-serif; text-decoration: none; cursor: pointer; }.hero-walkthrough-coach button[disabled], .hero-walkthrough-advisor button[disabled] { opacity:.48; cursor:not-allowed; }.hero-walkthrough-progress, .hero-walkthrough-advisor-status { color: var(--hero-muted); font-size: .67rem; font-weight: 800; }.hero-walkthrough-completion { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap; }.hero-walkthrough-advisor-status[data-state="error"] { color: var(--hero-danger); }.hero-walkthrough-advisor-selector { display:grid; gap:5px; color:var(--hero-muted); font-size:.7rem; font-weight:800; }.hero-walkthrough-advisor-selector select { width:100%; min-height:34px; box-sizing:border-box; padding:6px 8px; border:1px solid var(--hero-line-strong); border-radius:8px; background:var(--hero-surface); color:var(--hero-ink); font:700 .72rem/1.35 Vazirmatn,sans-serif; }.hero-walkthrough-advisor-messages { display:grid; gap:8px; max-height:260px; overflow:auto; padding:2px; }.hero-walkthrough-advisor-message { padding:10px; border:1px solid var(--hero-line); border-radius:10px; color:var(--hero-ink); font-size:.75rem; line-height:1.82; white-space:pre-wrap; overflow-wrap:anywhere; }.hero-walkthrough-advisor-message[data-speaker="assistant"] { background:color-mix(in srgb,var(--hero-success-soft) 34%,var(--hero-surface)); }.hero-walkthrough-advisor-message[data-speaker="user"] { background:color-mix(in srgb,var(--hero-brand-soft) 42%,var(--hero-surface)); border-inline-start:3px solid var(--hero-brand); }.hero-walkthrough-advisor-message b { display:block; margin-bottom:4px; color:var(--hero-brand); font-size:.67rem; }.hero-walkthrough-advisor form { display: grid; gap: 7px; }.hero-walkthrough-advisor textarea { width: 100%; box-sizing: border-box; min-height: 76px; padding: 8px; border: 1px solid var(--hero-line-strong); border-radius: 9px; resize: vertical; background: var(--hero-surface); color: var(--hero-ink); font: 700 .75rem/1.7 Vazirmatn, sans-serif; }.hero-walkthrough-launcher { position: fixed; z-index: 11000; top: 92px; display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border: 1px solid color-mix(in srgb, var(--hero-brand) 52%, var(--hero-line)); border-radius: 12px; background: var(--hero-surface-raised); color: var(--hero-brand); box-shadow: var(--hero-shadow-lg); cursor: pointer; font: 900 1rem/1 Vazirmatn, sans-serif; direction: ltr; }.hero-walkthrough-launcher[data-hero-walkthrough-side="left"] { left: 12px; right: auto; }.hero-walkthrough-launcher[data-hero-walkthrough-side="right"] { right: 12px; left: auto; }.hero-walkthrough-launcher:hover, .hero-walkthrough-launcher:focus-visible { outline: 0; background: var(--hero-brand-solid); color: #fff; }.hero-walkthrough-target { outline: 3px solid color-mix(in srgb, var(--hero-brand) 25%, transparent); outline-offset: 5px; scroll-margin-top: 112px; transition: outline-color .16s ease; }
    [data-hero-theme="dark"] body { background: var(--hero-canvas) !important; color: var(--hero-ink); }
    [data-hero-theme="dark"] .hero-appbar, [data-hero-theme="dark"] .hero-shell-button,
    [data-hero-theme="dark"] .section, [data-hero-theme="dark"] .panel,
    [data-hero-theme="dark"] .card, [data-hero-theme="dark"] .hero,
    [data-hero-theme="dark"] .side-nav, [data-hero-theme="dark"] .content-panel,
    [data-hero-theme="dark"] .project-card, [data-hero-theme="dark"] .context,
    [data-hero-theme="dark"] dialog { border-color: var(--hero-line) !important; background: var(--hero-surface) !important; color: var(--hero-ink) !important; }
    [data-hero-theme="dark"] input, [data-hero-theme="dark"] textarea, [data-hero-theme="dark"] select,
    [data-hero-theme="dark"] .metric, [data-hero-theme="dark"] .setting-card,
    [data-hero-theme="dark"] .team-card, [data-hero-theme="dark"] .contract-card,
    [data-hero-theme="dark"] .row { border-color: var(--hero-line) !important; background: var(--hero-surface-raised) !important; color: var(--hero-ink) !important; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .001ms !important; animation-duration: .001ms !important; animation-iteration-count: 1 !important; } }
    .hero-side-nav ~ #hero-main { max-width: calc(100% - 296px); margin-inline-start: auto !important; margin-inline-end: 278px !important; }
    @media (max-width: 1160px) { .hero-app-actions { display: none; } .hero-side-nav { width: 222px; }.hero-side-nav ~ #hero-main { max-width: calc(100% - 268px); margin-inline-end: 254px !important; } }
    @media (max-width: 760px) { .hero-appbar { position: static; } .hero-appbar-inner { width: min(100% - 20px, 740px); grid-template-columns: 1fr; gap: 7px; padding: 10px 0; } .hero-app-brand { justify-self: start; } .hero-side-nav { position: static; width: min(100% - 20px, 740px); max-height: 254px; margin: 10px auto 0; border-radius: 13px; } .hero-side-nav ~ #hero-main { max-width: none; margin-inline: auto !important; } .hero-global-nav a { min-height: 40px; } .hero-nav-copy small { display: none; } .hero-walkthrough-coach, .hero-walkthrough-advisor, .hero-smart-tester-panel, .hero-action-feedback { top: auto; right: 10px; bottom: 10px; left: 10px; width: auto; max-height: min(62vh, 540px); } .hero-form-suggestion-dialog { width: calc(100% - 20px); max-height: calc(100vh - 20px); } .hero-walkthrough-coach[data-hero-walkthrough-side="left"], .hero-walkthrough-coach[data-hero-walkthrough-side="right"], .hero-walkthrough-advisor[data-hero-walkthrough-side="left"], .hero-walkthrough-advisor[data-hero-walkthrough-side="right"], .hero-smart-tester-panel[data-hero-smart-tester-side="left"], .hero-smart-tester-panel[data-hero-smart-tester-side="right"], .hero-action-feedback[data-hero-action-feedback-side="left"], .hero-action-feedback[data-hero-action-feedback-side="right"] { right: 10px; left: 10px; } .hero-walkthrough-launcher { top:auto; bottom:10px; } .hero-walkthrough-launcher[data-hero-walkthrough-side="left"] { left:10px; }.hero-walkthrough-launcher[data-hero-walkthrough-side="right"] { right:10px; } }
  `;
}

export function getHeroGlobalNavigation({ active = "portfolio", projectId = null, environment = "Private" } = {}) {
  // The browser portal is delivered under /api because the Test proxy already
  // forwards that namespace to Hero. The portal itself requires the secure
  // Human Identity cookie and Project Grant; this prevents a stale outer
  // Basic-Auth rule from interrupting an already logged-in user.
  const portalHref = (surface, parameters = {}) => {
    const query = new URLSearchParams({ surface, ...parameters });
    return `/api/portal?${query.toString()}`;
  };
  const selectionHref = next => portalHref("portfolio", { select: "project", next });
  const commandHref = projectId ? portalHref("command", { projectId }) : selectionHref("command");
  const studioHref = projectId ? portalHref("studio", { projectId }) : selectionHref("studio");
  const workspaceHref = projectId ? portalHref("workspace", { projectId }) : selectionHref("workspace");
  const controlHref = projectId ? portalHref("control", { projectId }) : selectionHref("control");
  const aiConnectionsHref = `${portalHref("ai")}#ai`;
  const walkthroughHref = portalHref("walkthrough", projectId ? { projectId } : {});
  const entries = [
    ["portfolio", portalHref("portfolio", { select: "project" }), "انتخاب پروژه", "Projects", "portfolio", false],
    ["backoffice", commandHref, "مرکز فرمان", "Command", "command", true],
    ["studio", studioHref, "استودیوی محصول", "Studio", "studio", true],
    ["workspace", workspaceHref, "فضای پروژه", "Workspace", "workspace", true],
    ["control", controlHref, "عملیات پروژه", "Operations", "control", true],
    ["ai", aiConnectionsHref, "اتصال‌های AI", "AI Connections", "ai", false],
    ["walkthrough", walkthroughHref, "راهنمای ساخت", "Guide", "walkthrough", true],
    ["identity", portalHref("identity"), "هویت و دسترسی", "Access", "identity", false]
  ];
  const links = entries.map(([id, href, fa, en, iconName, scoped]) => `<a href="${escapeHtml(href)}"${id === active ? ' aria-current="page"' : ""}${scoped ? ' data-hero-project-link="true"' : ""}><span aria-hidden="true">${icon(iconName)}</span><span class="hero-nav-copy"><b>${fa}</b><small>${en}</small></span></a>`).join("");
  return `
    <a class="hero-skip-link" href="#hero-main">رفتن به محتوای اصلی / Skip to content</a>
    <header class="hero-appbar" data-hero-shell="v1" role="banner">
      <div class="hero-appbar-inner">
        <a class="hero-app-brand" href="${portalHref("portfolio")}" aria-label="Hero Portfolio">
          <span class="hero-app-mark" aria-hidden="true">H</span>
          <span class="hero-app-brand-copy"><strong>Hero</strong><small>Private Control Plane</small></span>
        </a>
        <div class="hero-app-actions">
          ${projectId ? `<a class="hero-project-context" href="${portalHref("portfolio", { select: "project" })}" title="تغییر پروژهٔ فعال"><em aria-hidden="true">◈</em><span><small>پروژهٔ فعال / Active project</small><b>${escapeHtml(projectId)}</b></span></a>` : ""}
          <span class="hero-environment" title="محیط خصوصی و محافظت‌شده">${escapeHtml(environment)}</span>
          <button class="hero-shell-button" type="button" data-hero-smart-tester-toggle aria-pressed="false" aria-label="روشن کردن اسمارت تستر"><span aria-hidden="true">✦</span><span>اسمارت تستر</span></button>
          <button class="hero-shell-button" type="button" data-hero-form-suggestions-toggle aria-pressed="true" aria-label="خاموش کردن ادوایزر"><span aria-hidden="true">✎</span><span>ادوایزر</span></button>
          <button class="hero-shell-button" type="button" data-hero-theme-button aria-label="تغییر پوسته">${icon("theme")}<span>پوسته</span></button>
          <button class="hero-shell-button" type="button" data-hero-command-button aria-haspopup="dialog">${icon("search")}<span>جست‌وجو</span><kbd>⌘K</kbd></button>
        </div>
      </div>
    </header>
    <aside class="hero-side-nav" aria-label="ناوبری اصلی Hero">
      <div class="hero-side-nav-head"><span aria-hidden="true">≡</span> ناوبری / Navigation</div>
      <nav class="hero-global-nav" aria-label="ناوبری اصلی / Primary navigation">${links}</nav>
    </aside>
    <dialog class="hero-command-dialog" data-hero-command-dialog aria-labelledby="hero-command-title">
      <div class="hero-command-head">${icon("search")}<input id="hero-command-title" data-hero-command-input type="search" autocomplete="off" placeholder="جست‌وجوی صفحه یا قابلیت…" aria-label="جست‌وجوی صفحه یا قابلیت"><kbd>ESC</kbd></div>
      <div class="hero-command-list" data-hero-command-list>
        <div class="hero-command-group">Navigate / ناوبری</div>
        ${entries.map(([id, href, fa, en, iconName, scoped]) => `<a href="${escapeHtml(href)}" data-hero-command="${escapeHtml(`${fa} ${en} ${id}`)}"${scoped ? ' data-hero-project-link="true"' : ""}><span class="hero-command-symbol">${icon(iconName)}</span><span class="hero-command-copy"><strong>${fa}</strong><small>${en}</small></span><small>↵</small></a>`).join("")}
        <div class="hero-command-empty" data-hero-command-empty hidden>نتیجه‌ای پیدا نشد / No result</div>
      </div>
    </dialog>
    <div id="hero-feature-tooltip" class="hero-feature-tooltip" role="tooltip" hidden></div>
  `;
}

export function getHeroShellScript() {
  return `<script>(() => {
    const root = document.documentElement;
    const themeKey = 'hero.ui.theme';
    const storedTheme = localStorage.getItem(themeKey);
    if (storedTheme === 'dark') root.dataset.heroTheme = 'dark';
    const dialog = document.querySelector('[data-hero-command-dialog]');
    const input = document.querySelector('[data-hero-command-input]');
    const button = document.querySelector('[data-hero-command-button]');
    const activeProjectKey = 'hero.active-project-id';
    const projectPattern = /^[a-z][a-z0-9-]{2,62}$/;
    const urlProjectId = new URL(location.href).searchParams.get('projectId');
    const storedProjectId = localStorage.getItem(activeProjectKey);
    const projectId = projectPattern.test(urlProjectId || '') ? urlProjectId : (projectPattern.test(storedProjectId || '') ? storedProjectId : null);
    if (projectPattern.test(urlProjectId || '')) localStorage.setItem(activeProjectKey, urlProjectId);
    if (projectId) document.querySelectorAll('[data-hero-project-link]').forEach(link => {
      const url = new URL(link.getAttribute('href'), location.origin);
      url.searchParams.set('projectId', projectId);
      link.setAttribute('href', url.pathname + url.search);
    });
    document.addEventListener('click', event => {
      const projectLink = event.target.closest?.('[data-hero-select-project]');
      const selectedId = projectLink?.dataset?.heroSelectProject;
      if (projectPattern.test(selectedId || '')) localStorage.setItem(activeProjectKey, selectedId);
    });
    const openCommand = () => { if (!dialog) return; dialog.showModal(); input.value = ''; filterCommands(''); queueMicrotask(() => input.focus()); };
    const filterCommands = query => {
      if (!dialog) return;
      const needle = String(query || '').trim().toLocaleLowerCase();
      let visible = 0;
      dialog.querySelectorAll('[data-hero-command]').forEach(item => { const show = !needle || item.dataset.heroCommand.toLocaleLowerCase().includes(needle); item.hidden = !show; if (show) visible += 1; });
      const empty = dialog.querySelector('[data-hero-command-empty]'); if (empty) empty.hidden = visible > 0;
    };
    button?.addEventListener('click', openCommand);
    input?.addEventListener('input', event => filterCommands(event.target.value));
    dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') { event.preventDefault(); openCommand(); }
      if (event.key === 'Escape' && dialog?.open) dialog.close();
    });
    const themeButton = document.querySelector('[data-hero-theme-button]');
    const syncThemeButton = () => themeButton?.setAttribute('aria-pressed', String(root.dataset.heroTheme === 'dark'));
    syncThemeButton();
    themeButton?.addEventListener('click', () => {
      const next = root.dataset.heroTheme === 'dark' ? 'light' : 'dark';
      if (next === 'dark') root.dataset.heroTheme = 'dark'; else delete root.dataset.heroTheme;
      localStorage.setItem(themeKey, next);
      syncThemeButton();
    });
    // Process-action feedback is deliberately centralized here so every
    // mutation form/button gets the same outcome surface without changing
    // navigation or read-only controls. The wrapper observes only same-origin
    // mutation requests armed by a real process action.
    const heroActionReadOnly = /(?:بازخوانی|فراخوانی|نمایش|مشاهده|به‌روزرسانی|بازگشت|انصراف|لغو|بستن|cancel|close|refresh|recall|open|view)/i;
    const heroActionExcluded = '.hero-global-nav,.hero-command-dialog,.hero-smart-tester-panel,.hero-walkthrough-coach,.hero-walkthrough-advisor';
    const heroActionMutation = /^(POST|PUT|PATCH|DELETE)$/;
    const heroActionFeedbackKey = 'hero.action-feedback.v1';
    const heroActionFeedbackSideKey = 'hero.action-feedback.side.v1';
    let pendingHeroAction = null;
    let pendingHeroActionTimer = null;
    let activeHeroActionFeedback = null;
    let heroActionFeedbackDismissTimer = null;
    // Form outcomes have one predictable home: a bottom-left toast.  Keep the
    // historical side key only for backwards-compatible error-panel controls;
    // normal notifications must not jump around between surfaces.
    const heroActionFeedbackSide = () => 'left';
    const setHeroActionFeedbackSide = side => { try { localStorage.setItem(heroActionFeedbackSideKey, side); } catch { /* browser-local preference only */ } };
    const heroActionText = node => String(node?.getAttribute?.('aria-label') || node?.textContent || node?.labels?.[0]?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 160);
    const heroActionButton = node => node?.closest?.('button,input[type="submit"],input[type="button"],input[type="checkbox"][data-hero-process-action],#autonomy') || null;
    const heroActionIsSubmit = node => { const button = heroActionButton(node); if (!button || !button.form) return false; const type = (button.getAttribute('type') || (button.tagName === 'BUTTON' ? 'submit' : 'button')).toLowerCase(); return type === 'submit' || type === ''; };
    const heroActionIsProcess = node => {
      const button = heroActionButton(node);
      if (!button || !button.isConnected || button.closest(heroActionExcluded)) return false;
      if (button.matches('[data-hero-info-trigger],[data-hero-smart-tester-trigger],[data-hero-form-suggestion-trigger],[data-hero-theme-button],[data-hero-command-button],[data-hero-process-ignore]')) return false;
      if (button.closest('nav')) return false;
      const label = heroActionText(button);
      if (!label || heroActionReadOnly.test(label)) return false;
      if (button.dataset.heroProcessAction === 'true' || button.id === 'autonomy') return true;
      if (button.id === 'global-stop' || button.id === 'logout' || button.classList.contains('danger') || button.classList.contains('write')) return true;
      if (heroActionIsSubmit(button) && !/(?:نمایش|مشاهده|بازخوانی|فراخوانی|جست‌وجو|search|view|open|refresh|recall)/i.test(label)) return true;
      return false;
    };
    const clearPendingHeroAction = () => { pendingHeroAction = null; if (pendingHeroActionTimer) { clearTimeout(pendingHeroActionTimer); pendingHeroActionTimer = null; } };
    const armHeroAction = trigger => {
      if (!heroActionIsProcess(trigger)) return;
      if (pendingHeroActionTimer) clearTimeout(pendingHeroActionTimer);
      pendingHeroAction = Object.freeze({ trigger: heroActionButton(trigger), label: heroActionText(trigger) || 'اقدام فرایندی', startedAt: Date.now() });
      pendingHeroActionTimer = window.setTimeout(clearPendingHeroAction, 20_000);
    };
    const heroActionFeatureKey = trigger => {
      const marker = trigger?.closest?.('[data-hero-info-key]') || trigger?.closest?.('[data-hero-guide-target]')?.querySelector?.('[data-hero-info-key]');
      return marker?.dataset?.heroInfoKey || null;
    };
    const heroActionDetail = (body, status, fallback) => {
      const candidate = body?.message || body?.error?.message || (typeof body?.error === 'string' ? body.error : '') || body?.notice || body?.reason || body?.code;
      const detail = String(candidate || fallback || '').replace(/((?:password|secret|credential|api[ _-]?key|token|mfa|رمز(?:\\s*عبور)?|کلید\\s*api)\\s*[:=]\\s*)[^\\s,;]+/gi, '$1[redacted]').replace(/\\s+/g, ' ').trim().slice(0, 700);
      return detail || (status ? 'پاسخ سرویس: ' + status : 'پاسخی از سرویس دریافت نشد.');
    };
    const heroActionCode = body => {
      const candidate = body?.code || body?.error?.code || body?.errorCode || '';
      return typeof candidate === 'string' && /^[A-Z][A-Z0-9_:-]{2,119}$/.test(candidate) ? candidate : '';
    };
    const normalizeHeroActionFeedback = value => {
      if (!value || typeof value !== 'object') return null;
      const label = String(value.label || 'اقدام فرایندی').replace(/\\s+/g, ' ').trim().slice(0, 160);
      const detail = heroActionDetail({ message: value.detail }, Number.isInteger(value.status) ? value.status : 0, 'وضعیت اقدام ثبت شد.');
      const method = /^(POST|PUT|PATCH|DELETE)$/i.test(String(value.method || '')) ? String(value.method).toUpperCase() : 'POST';
      const path = typeof value.path === 'string' && /^\\/api\\/[A-Za-z0-9._/-]{1,180}$/.test(value.path) ? value.path : '/api/unknown';
      const status = Number.isInteger(value.status) && value.status >= 0 && value.status <= 599 ? value.status : 0;
      const featureKey = typeof value.featureKey === 'string' && /^[a-z][a-zA-Z0-9]*(?:\\.[a-z][a-zA-Z0-9]*)+$/.test(value.featureKey) ? value.featureKey : null;
      const code = typeof value.code === 'string' && /^[A-Z][A-Z0-9_:-]{2,119}$/.test(value.code) ? value.code : '';
      return Object.freeze({ ok: value.ok === true, label, detail, method, path, status, code, featureKey });
    };
    const readHeroActionFeedback = () => { try { return normalizeHeroActionFeedback(JSON.parse(sessionStorage.getItem(heroActionFeedbackKey) || 'null')); } catch { return null; } };
    const persistHeroActionFeedback = value => { try { sessionStorage.setItem(heroActionFeedbackKey, JSON.stringify(value)); } catch { /* browser-local persistence only */ } };
    const forgetHeroActionFeedback = () => { try { sessionStorage.removeItem(heroActionFeedbackKey); } catch { /* browser-local persistence only */ } };
    const clearHeroActionFeedbackDismiss = () => {
      if (heroActionFeedbackDismissTimer) {
        clearTimeout(heroActionFeedbackDismissTimer);
        heroActionFeedbackDismissTimer = null;
      }
    };
    const closeHeroActionFeedback = ({ restoreFocus = false, forget = true } = {}) => {
      clearHeroActionFeedbackDismiss();
      const popup = activeHeroActionFeedback || document.querySelector('[data-hero-action-feedback]');
      if (!popup) { if (forget) forgetHeroActionFeedback(); return; }
      const trigger = popup._heroActionTrigger;
      popup.remove(); if (activeHeroActionFeedback === popup) activeHeroActionFeedback = null;
      if (forget) forgetHeroActionFeedback();
      if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
    const scheduleHeroActionFeedbackDismiss = popup => {
      clearHeroActionFeedbackDismiss();
      if (!popup?.isConnected || popup.dataset.state !== 'success') return;
      heroActionFeedbackDismissTimer = window.setTimeout(() => {
        if (popup.isConnected) closeHeroActionFeedback();
      }, 6_500);
    };
    const showHeroActionFeedback = ({ ok, label, status, detail, code = '', trigger = null, method, path, featureKey = null, restored = false }) => {
      const record = normalizeHeroActionFeedback({ ok, label, status, detail, code, method, path, featureKey });
      if (!record) return;
      closeHeroActionFeedback({ forget: false });
      if (!restored) persistHeroActionFeedback(record);
      const popup = document.createElement('aside');
      popup.className = 'hero-action-feedback'; popup.dataset.state = record.ok ? 'success' : 'error'; popup.dataset.heroActionFeedback = 'true'; popup.dataset.heroActionFeedbackSide = heroActionFeedbackSide(); popup.setAttribute('role', record.ok ? 'status' : 'dialog'); popup.setAttribute('aria-modal', 'false'); popup.setAttribute('aria-live', record.ok ? 'polite' : 'assertive'); popup.setAttribute('tabindex', '-1'); popup._heroActionTrigger = trigger;
      const head = document.createElement('header'); head.className = 'hero-action-feedback-head'; const title = document.createElement('h2'); title.textContent = record.ok ? 'عملیات با موفقیت انجام شد' : 'عملیات ناموفق بود'; head.append(title); popup.append(head);
      const statusNode = document.createElement('p'); statusNode.className = 'hero-action-feedback-status'; statusNode.textContent = record.detail || (record.ok ? 'تغییر موردنظر ثبت شد.' : 'سرویس نتوانست اقدام را تکمیل کند.'); popup.append(statusNode);
      const meta = document.createElement('p'); meta.className = 'hero-action-feedback-meta'; meta.textContent = record.label + ' · ' + record.method + ' · HTTP ' + (record.status || '—') + (record.code ? ' · ' + record.code : '') + ' · ' + record.path; popup.append(meta);
      const actions = document.createElement('div'); actions.className = 'hero-action-feedback-actions';
      let side = popup.dataset.heroActionFeedbackSide;
      const moveLeft = document.createElement('button'); moveLeft.type = 'button'; moveLeft.dataset.kind = 'move'; moveLeft.textContent = 'انتقال به لبهٔ چپ'; moveLeft.setAttribute('aria-label', moveLeft.textContent);
      const moveRight = document.createElement('button'); moveRight.type = 'button'; moveRight.dataset.kind = 'move'; moveRight.textContent = 'انتقال به لبهٔ راست'; moveRight.setAttribute('aria-label', moveRight.textContent);
      const applySide = nextSide => { side = nextSide; popup.dataset.heroActionFeedbackSide = side; setHeroActionFeedbackSide(side); for (const button of [moveLeft, moveRight]) { const selected = button === (side === 'left' ? moveLeft : moveRight); button.setAttribute('aria-pressed', String(selected)); button.disabled = selected; } };
      moveLeft.addEventListener('click', () => applySide('left'));
      moveRight.addEventListener('click', () => applySide('right'));
      if (record.ok) {
        const close = document.createElement('button'); close.type = 'button'; close.dataset.kind = 'close'; close.textContent = 'بستن'; close.addEventListener('click', () => closeHeroActionFeedback({ restoreFocus: true })); actions.append(close);
      } else {
        const smart = document.createElement('button'); smart.type = 'button'; smart.dataset.kind = 'smart'; smart.textContent = 'تحلیل با اسمارت تستر'; smart.addEventListener('click', () => {
          const open = window.heroSmartTester?.openForElement;
          if (typeof open === 'function') open(trigger || document.body, { label: record.label, featureKey: record.featureKey || heroActionFeatureKey(trigger), actionFailure: { label: record.label, method: record.method, path: record.path, status: record.status, code: record.code, message: record.detail } });
        });
        const close = document.createElement('button'); close.type = 'button'; close.dataset.kind = 'close'; close.textContent = 'بستن'; close.addEventListener('click', () => closeHeroActionFeedback({ restoreFocus: true })); actions.append(smart, close);
        actions.prepend(moveLeft, moveRight);
      }
      popup.append(actions); document.body.append(popup); activeHeroActionFeedback = popup; applySide(side);
      if (record.ok) {
        popup.addEventListener('pointerenter', clearHeroActionFeedbackDismiss);
        popup.addEventListener('pointerleave', () => scheduleHeroActionFeedbackDismiss(popup));
        popup.addEventListener('focusin', clearHeroActionFeedbackDismiss);
        popup.addEventListener('focusout', event => { if (!popup.contains(event.relatedTarget)) scheduleHeroActionFeedbackDismiss(popup); });
        scheduleHeroActionFeedbackDismiss(popup);
      } else if (!restored) popup.focus({ preventScroll: true });
    };
    const originalHeroFetch = window.fetch.bind(window);
    const apiErrorMessage = (response, body, fallback) => {
      if (typeof body?.message === 'string' && body.message.trim()) return body.message;
      if (typeof body?.code === 'string' && body.code.trim()) return body.code;
      const status = Number.isInteger(response?.status) ? response.status : 0;
      // Do not render a proxy error body: it can be HTML, a login page or
      // infrastructure detail.  The status is enough to distinguish a stale
      // Human session (401/403) from an upstream failure (5xx), without
      // exposing configuration or credentials.
      return (fallback || 'پاسخ سرویس قابل‌خواندن نیست.') + ' (HTTP ' + (status || '—') + '). نشست انسانی و Proxy محیط Test را بررسی کنید.';
    };
    window.fetch = async (input, init = {}) => {
      const method = String(init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();
      let requestUrl = null;
      try { requestUrl = new URL(typeof input === 'string' ? input : input?.url || String(input), location.href); } catch { /* ignore malformed/non-URL input */ }
      const sameOriginMutation = Boolean(requestUrl && requestUrl.origin === location.origin && heroActionMutation.test(method));
      const excludedMutation = Boolean(requestUrl && (/^\\/api\\/smart-tester\\//.test(requestUrl.pathname) || requestUrl.pathname === '/api/walkthrough/advice'));
      const action = sameOriginMutation && !excludedMutation && pendingHeroAction && Date.now() - pendingHeroAction.startedAt < 20_000 ? pendingHeroAction : null;
      if (action) clearPendingHeroAction();
      try {
        const response = await originalHeroFetch(input, init);
        if (action) {
          let body = {}; try { body = await response.clone().json(); } catch { /* empty/stream response */ }
          showHeroActionFeedback({ ok: response.ok, label: action.label, status: response.status, detail: heroActionDetail(body, response.status, response.ok ? action.label + ' ثبت شد.' : action.label + ' انجام نشد.'), code: heroActionCode(body), trigger: action.trigger, method, path: requestUrl.pathname, featureKey: heroActionFeatureKey(action.trigger) });
        }
        return response;
      } catch (error) {
        if (action) showHeroActionFeedback({ ok: false, label: action.label, status: 0, detail: 'ارتباط با سرویس برقرار نشد؛ وضعیت شبکه و نشست را بررسی کنید.', trigger: action.trigger, method, path: requestUrl?.pathname || '/api/unknown', featureKey: heroActionFeatureKey(action.trigger) });
        throw error;
      }
    };
    document.addEventListener('submit', event => {
      const trigger = event.submitter || event.currentTarget?.querySelector?.('button[type="submit"],button:not([type]),input[type="submit"]');
      if (heroActionIsProcess(trigger)) armHeroAction(trigger);
    }, true);
    document.addEventListener('click', event => {
      const trigger = heroActionButton(event.target);
      if (heroActionIsProcess(trigger) && !heroActionIsSubmit(trigger)) armHeroAction(trigger);
    }, true);
    document.addEventListener('change', event => {
      const trigger = heroActionButton(event.target);
      if (heroActionIsProcess(trigger)) armHeroAction(trigger);
    }, true);
    const persistedHeroActionFeedback = readHeroActionFeedback();
    if (persistedHeroActionFeedback) queueMicrotask(() => showHeroActionFeedback({ ...persistedHeroActionFeedback, restored: true }));
    const featureHelp = ${serializeFeatureHelp()};
    const walkthroughSteps = ${JSON.stringify(HERO_PROJECT_WALKTHROUGH_STEPS.map(step => ({ ...step, fieldGuidance: HERO_PROJECT_WALKTHROUGH_FIELD_GUIDANCE[step.id] || [] }))).replaceAll("&", "\\u0026").replaceAll("<", "\\u003c").replaceAll(">", "\\u003e")};
    const mainWalkthroughSteps = walkthroughSteps.filter(step => step.flow !== 'outside-main');
    let featureTooltip = document.getElementById('hero-feature-tooltip');
    let activeInfoTrigger = null;
    const infoLabel = node => {
      const explicit = node.dataset.heroInfoLabel;
      if (explicit) return explicit;
      const clone = node.cloneNode(true);
      clone.querySelectorAll('.hero-info-trigger').forEach(item => item.remove());
      return clone.textContent.trim() || 'این قابلیت';
    };
    const infoSupplement = node => {
      const scope = node.closest?.('.panel-head, .panel-head-copy, .section-head, .head, .hero-page-header, .page-head, .top, .topbar, .dialog-head') || node.parentElement;
      const copy = scope?.querySelector?.('.helper-copy');
      const text = String(copy?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 700);
      if (!text) return '';
      // The copy remains in the server-rendered page for no-JS browsing.  Once
      // the matching i trigger is installed, it moves into that trigger so the
      // visual hierarchy stays compact without dropping any explanation.
      copy.dataset.heroInfoMoved = 'true';
      return text;
    };
    const installInfoTriggers = container => {
      const nodes = [];
      if (container?.nodeType === 1 && container.matches?.('[data-hero-info-key]')) nodes.push(container);
      container?.querySelectorAll?.('[data-hero-info-key]').forEach(node => nodes.push(node));
      nodes.forEach(node => {
        const key = node.dataset.heroInfoKey;
        if (!featureHelp[key] || node.querySelector(':scope > .hero-info-trigger')) return;
        node.classList.add('hero-feature-with-info');
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'hero-info-trigger';
        trigger.dataset.heroInfoTrigger = key;
        trigger.setAttribute('aria-label', 'توضیح دربارهٔ ' + infoLabel(node));
        trigger.setAttribute('aria-describedby', 'hero-feature-tooltip');
        trigger.setAttribute('aria-expanded', 'false');
        const supplement = infoSupplement(node);
        if (supplement) trigger.dataset.heroInfoSupplement = supplement;
        trigger.textContent = 'i';
        node.append(trigger);
      });
    };
    const tooltipHost = trigger => trigger.closest('dialog[open]') || document.body;
    const placeInfoTooltip = () => {
      if (!activeInfoTrigger || !featureTooltip || featureTooltip.hidden) return;
      const rect = activeInfoTrigger.getBoundingClientRect();
      const tip = featureTooltip.getBoundingClientRect();
      const gap = 9; const edge = 12;
      let top = rect.bottom + gap;
      if (top + tip.height > innerHeight - edge) top = rect.top - tip.height - gap;
      top = Math.max(edge, Math.min(top, innerHeight - tip.height - edge));
      let left = document.documentElement.dir === 'rtl' ? rect.right - tip.width : rect.left;
      left = Math.max(edge, Math.min(left, innerWidth - tip.width - edge));
      featureTooltip.style.top = top + 'px'; featureTooltip.style.left = left + 'px';
    };
    const showInfoTooltip = trigger => {
      const text = featureHelp[trigger?.dataset?.heroInfoTrigger];
      if (!text || !featureTooltip) return;
      if (featureTooltip.parentElement !== tooltipHost(trigger)) tooltipHost(trigger).append(featureTooltip);
      if (activeInfoTrigger && activeInfoTrigger !== trigger) activeInfoTrigger.setAttribute('aria-expanded', 'false');
      activeInfoTrigger = trigger; trigger.setAttribute('aria-expanded', 'true');
      const supplement = String(trigger.dataset.heroInfoSupplement || '').trim();
      featureTooltip.textContent = supplement ? text + '\\n\\n' + supplement : text; featureTooltip.hidden = false; featureTooltip.dataset.open = 'true';
      placeInfoTooltip();
    };
    const hideInfoTooltip = () => {
      if (!featureTooltip) return;
      activeInfoTrigger?.setAttribute('aria-expanded', 'false'); activeInfoTrigger = null;
      delete featureTooltip.dataset.open; featureTooltip.hidden = true;
    };
    installInfoTriggers(document);
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => installInfoTriggers(node)))).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('pointerover', event => { const trigger = event.target.closest?.('[data-hero-info-trigger]'); if (trigger) showInfoTooltip(trigger); });
    document.addEventListener('pointerout', event => { const trigger = event.target.closest?.('[data-hero-info-trigger]'); if (trigger && !trigger.contains(event.relatedTarget)) hideInfoTooltip(); });
    document.addEventListener('focusin', event => { const trigger = event.target.closest?.('[data-hero-info-trigger]'); if (trigger) showInfoTooltip(trigger); });
    document.addEventListener('focusout', event => { if (event.target.closest?.('[data-hero-info-trigger]')) hideInfoTooltip(); });
    document.addEventListener('click', event => { const trigger = event.target.closest?.('[data-hero-info-trigger]'); if (trigger) { event.preventDefault(); if (activeInfoTrigger === trigger) hideInfoTooltip(); else showInfoTooltip(trigger); } });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && activeInfoTrigger) { const trigger = activeInfoTrigger; hideInfoTooltip(); trigger.focus(); } });
    window.addEventListener('scroll', placeInfoTooltip, true); window.addEventListener('resize', placeInfoTooltip);
    // Smart Tester is a development-only overlay for Hero itself. Its switch
    // is deliberately browser-local and off by default: enabling it neither
    // changes a project nor grants any execution, provider or deploy power.
    const smartTesterEnabledKey = 'hero.smart-tester.enabled.v1';
    const smartTesterSideKey = 'hero.smart-tester.side.v1';
    const smartTesterDefaultFeature = {
      '/portfolio': 'portfolio.projects', '/product-studio': 'studio.sourceOfTruth', '/workspace': 'workspace.projectContext',
      '/project-control': 'control.projectOperations', '/command': 'command.statusOverview', '/ai': 'ai.connections', '/identity': 'identity.management', '/walkthrough': 'guide.walkthrough', '/backoffice': 'command.statusOverview'
    };
    const smartTesterSurfaceAliases = { identity: '/identity', portfolio: '/portfolio', command: '/command', studio: '/product-studio', workspace: '/workspace', control: '/project-control', walkthrough: '/walkthrough', ai: '/ai' };
    const smartTesterSurface = () => { const url = new URL(location.href); if (url.pathname === '/api/portal') return smartTesterSurfaceAliases[url.searchParams.get('surface') || 'portfolio'] || '/portfolio'; return smartTesterDefaultFeature[url.pathname] ? url.pathname : '/portfolio'; };
    const smartTesterCandidateSelector = '.hero-page-header,.page-head,.topbar,.top,.hero-head,.section,.panel,.card,.metric,.project-card,.team-card,.focus-card,.decision-card,.content-panel,.context,[data-hero-guide-target]';
    const smartTesterExcludedSelector = '.hero-smart-tester-panel,.hero-walkthrough-coach,.hero-walkthrough-advisor,.hero-feature-tooltip,.hero-command-dialog';
    let activeSmartTesterPanel = null;
    const smartTesterEnabled = () => { try { return localStorage.getItem(smartTesterEnabledKey) === 'true'; } catch { return false; } };
    const smartTesterSide = () => { try { const side = localStorage.getItem(smartTesterSideKey); return side === 'left' || side === 'right' ? side : 'right'; } catch { return 'right'; } };
    const setSmartTesterSide = side => { try { localStorage.setItem(smartTesterSideKey, side); } catch { /* browser-local preference only */ } };
    const getSmartTesterLabel = node => {
      const heading = node.querySelector?.('h1,h2,h3,[data-hero-info-key]');
      const copy = heading?.cloneNode?.(true); copy?.querySelectorAll?.('[data-hero-info-trigger]').forEach(item => item.remove());
      const text = copy?.textContent?.trim() || node.dataset.heroGuideTarget || node.dataset.heroInfoKey || 'این بخش';
      return text.replace(/\s+/g, ' ').slice(0, 120) || 'این بخش';
    };
    const getSmartTesterFeature = node => {
      const marker = node.matches?.('[data-hero-info-key]') ? node : node.querySelector?.('[data-hero-info-key]');
      const key = marker?.dataset?.heroInfoKey;
      if (typeof key === 'string' && /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/.test(key)) return key;
      return smartTesterDefaultFeature[smartTesterSurface()] || 'command.statusOverview';
    };
    const getSmartTesterBoxId = (node, featureKey) => {
      const candidates = [node?.dataset?.heroSmartTesterContext, node?.id, node?.dataset?.heroGuideTarget, featureKey];
      return candidates.find(value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/.test(value)) || featureKey;
    };
    const getSmartTesterDescription = (node, featureKey, label) => {
      const marker = node.matches?.('[data-hero-info-key]') ? node : node.querySelector?.('[data-hero-info-key]');
      const key = marker?.dataset?.heroInfoKey || featureKey;
      const explicit = node?.dataset?.heroSmartTesterDescription;
      const text = typeof explicit === 'string' && explicit.trim() ? explicit : featureHelp[key];
      if (typeof text === 'string' && text.trim()) return text.replace(/\s+/g, ' ').slice(0, 280);
      return 'این باکس نقش «' + label + '» را در جریان جاری Hero نمایش یا مدیریت می‌کند.';
    };
    const clearSmartTesterPanel = ({ restoreFocus = false } = {}) => {
      const panel = activeSmartTesterPanel || document.querySelector('[data-hero-smart-tester-panel]');
      if (!panel) return;
      const trigger = panel._heroSmartTesterTrigger;
      panel.remove(); if (activeSmartTesterPanel === panel) activeSmartTesterPanel = null;
      if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
    const uninstallSmartTesterTriggers = () => {
      clearSmartTesterPanel();
      document.querySelectorAll('[data-hero-smart-tester-trigger]').forEach(trigger => trigger.remove());
      document.querySelectorAll('.hero-smart-testable').forEach(node => node.classList.remove('hero-smart-testable'));
    };
    const installSmartTesterTriggers = container => {
      if (!smartTesterEnabled()) return;
      const nodes = [];
      if (container?.nodeType === 1 && container.matches?.(smartTesterCandidateSelector)) nodes.push(container);
      container?.querySelectorAll?.(smartTesterCandidateSelector).forEach(node => nodes.push(node));
      for (const node of nodes) {
        if (!node.isConnected || node.closest(smartTesterExcludedSelector) || node.closest('a,button,label') || node.querySelector(':scope > [data-hero-smart-tester-trigger]')) continue;
        // Do not make an anchor or existing button a parent of another control.
        if (node.matches('a,button,input,select,textarea,label,form,dialog')) continue;
        node.classList.add('hero-smart-testable');
        const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'hero-smart-tester-trigger';
        const featureKey = getSmartTesterFeature(node); const label = getSmartTesterLabel(node);
        trigger.dataset.heroSmartTesterTrigger = 'true'; trigger.dataset.heroSmartTesterFeature = featureKey; trigger.dataset.heroSmartTesterLabel = label; trigger.dataset.heroSmartTesterBoxId = getSmartTesterBoxId(node, featureKey); trigger.dataset.heroSmartTesterDescription = getSmartTesterDescription(node, featureKey, label);
        trigger.setAttribute('aria-label', 'باز کردن اسمارت تستر برای ' + trigger.dataset.heroSmartTesterLabel); trigger.title = 'اسمارت تستر این بخش'; trigger.textContent = '✦';
        node.append(trigger);
      }
    };
    const renderSmartTesterReport = (container, report) => {
      const summary = report?.summary || {}; const heading = document.createElement('article'); heading.className = 'hero-smart-tester-report'; heading.dataset.state = summary.state || 'attention';
      const title = document.createElement('b'); title.textContent = 'گزارش تست · ' + (summary.state === 'attention' ? 'نیازمند توجه' : 'تکمیل‌شده با مرزهای روشن');
      const body = document.createElement('span'); body.textContent = (summary.passed ?? 0) + ' عبور · ' + (summary.attention ?? 0) + ' نیازمند توجه · ' + (summary.notRun ?? 0) + ' اجرا نشده'; heading.append(title, body); container.append(heading);
      for (const check of Array.isArray(report?.checks) ? report.checks : []) {
        const row = document.createElement('article'); row.className = 'hero-smart-tester-report'; row.dataset.state = check.status || 'attention';
        const rowTitle = document.createElement('b'); rowTitle.textContent = check.area + ' · ' + (check.status === 'passed' ? 'عبور' : check.status === 'not-run' ? 'اجرا نشد' : 'نیازمند توجه');
        const detail = document.createElement('span'); detail.textContent = check.detail || 'جزئیات گزارش نشد.'; row.append(rowTitle, detail); container.append(row);
      }
      for (const limit of Array.isArray(report?.limits) ? report.limits : []) { const row = document.createElement('article'); row.className = 'hero-smart-tester-report'; row.dataset.state = 'not-run'; const title = document.createElement('b'); title.textContent = 'مرز اجرا'; const detail = document.createElement('span'); detail.textContent = limit; row.append(title, detail); container.append(row); }
      for (const opportunity of Array.isArray(report?.qualityOpportunities) ? report.qualityOpportunities : []) { const row = document.createElement('article'); row.className = 'hero-smart-tester-report'; row.dataset.state = 'not-run'; const title = document.createElement('b'); title.textContent = 'فرصت بهبود · ' + (opportunity.title || opportunity.type || 'کیفیت'); const detail = document.createElement('span'); detail.textContent = opportunity.recommendation || 'نیازمند بررسی تخصصی است.'; row.append(title, detail); container.append(row); }
    };
    const renderSmartTesterErrorReport = (container, report) => {
      const diagnosis = report?.diagnosis;
      if (diagnosis && typeof diagnosis === 'object') {
        const card = document.createElement('section'); card.className = 'hero-smart-tester-diagnosis';
        const head = document.createElement('header'); head.className = 'hero-smart-tester-diagnosis-head'; const title = document.createElement('h3'); title.textContent = 'نتیجهٔ بررسی خطا'; const intro = document.createElement('p'); const failure = report?.actionFailure || {}; const fingerprint = report?.incident?.fingerprint; intro.textContent = (failure.code ? 'کد خطا: ' + failure.code + (failure.status ? ' · پاسخ سرویس: ' + failure.status : '') : 'این نتیجه بر پایهٔ پاسخ امن سرویس تهیه شده است.') + (fingerprint ? ' · شناسهٔ پیگیری: ' + fingerprint : ''); head.append(title, intro); card.append(head);
        const grid = document.createElement('div'); grid.className = 'hero-smart-tester-diagnosis-grid';
        const diagnosisRows = [
          ['چه اتفاقی افتاد؟', diagnosis.problem, 'problem'],
          ['چرا رخ داد؟', diagnosis.likelyRootCause, 'cause'],
          ['چه‌کار کنم؟', diagnosis.proposedFix, 'fix'],
          ['بعد از اصلاح', diagnosis.verification, 'verify']
        ];
        for (const [label, value, kind] of diagnosisRows) {
          if (typeof value !== 'string' || !value) continue;
          const row = document.createElement('article'); row.className = 'hero-smart-tester-diagnosis-item'; row.dataset.kind = kind; const rowTitle = document.createElement('b'); rowTitle.textContent = label; const detail = document.createElement('span'); detail.textContent = value; row.append(rowTitle, detail); grid.append(row);
        }
        const brief = report?.remediationBrief;
        if (brief?.sourceFiles?.length) { const row = document.createElement('article'); row.className = 'hero-smart-tester-diagnosis-item'; row.dataset.kind = 'verify'; const rowTitle = document.createElement('b'); rowTitle.textContent = 'تحویل به تیم اصلاح'; const detail = document.createElement('span'); detail.textContent = 'فایل‌های محتمل: ' + brief.sourceFiles.join('، ') + ' · ' + brief.rollbackBoundary; row.append(rowTitle, detail); grid.append(row); }
        card.append(grid); container.append(card);
      } else {
        const summary = report?.summary || {}; const heading = document.createElement('article'); heading.className = 'hero-smart-tester-report'; heading.dataset.state = summary.findingCount ? 'attention' : 'passed'; const title = document.createElement('b'); title.textContent = summary.findingCount ? 'یک مورد نیاز به بررسی دارد' : 'خطای قطعی پیدا نشد'; heading.append(title); container.append(heading);
      }
      for (const finding of (Array.isArray(report?.findings) ? report.findings : []).filter(item => item?.findingId !== 'smart-tester.action-failure')) { const row = document.createElement('article'); row.className = 'hero-smart-tester-report'; row.dataset.state = 'attention'; const rowTitle = document.createElement('b'); rowTitle.textContent = finding.title || 'مورد نیازمند بررسی'; const detail = document.createElement('span'); detail.textContent = (finding.evidence || '') + (finding.recommendation ? ' راه‌حل پیشنهادی: ' + finding.recommendation : ''); row.append(rowTitle, detail); container.append(row); }
    };
    const openSmartTester = async (trigger, overrides = {}) => {
      if (!smartTesterEnabled() || !trigger) return;
      if (activeSmartTesterPanel?.isConnected) { if (activeSmartTesterPanel._heroSmartTesterTrigger === trigger) { activeSmartTesterPanel.focus({ preventScroll: true }); return; } clearSmartTesterPanel(); }
      const featureKey = overrides.featureKey || trigger.dataset?.heroSmartTesterFeature || getSmartTesterFeature(trigger.parentElement); const label = overrides.label || trigger.dataset?.heroSmartTesterLabel || 'این بخش'; const boxId = overrides.boxId || trigger.dataset?.heroSmartTesterBoxId || getSmartTesterBoxId(trigger.parentElement, featureKey); const boxDescription = overrides.boxDescription || trigger.dataset?.heroSmartTesterDescription || getSmartTesterDescription(trigger.parentElement, featureKey, label);
      const panel = document.createElement('aside'); panel.className = 'hero-smart-tester-panel'; panel.dataset.heroSmartTesterPanel = 'true'; panel.dataset.heroSmartTesterSide = smartTesterSide(); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('tabindex', '-1'); panel._heroSmartTesterTrigger = trigger;
      const head = document.createElement('header'); head.className = 'hero-smart-tester-head'; const title = document.createElement('h2'); title.textContent = label; const contextText = document.createElement('p'); contextText.textContent = boxDescription; const status = document.createElement('p'); status.className = 'hero-smart-tester-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.textContent = 'در حال آماده‌سازی زمینهٔ امن این بخش…'; head.append(title, contextText, status);
      const selectorWrap = document.createElement('label'); selectorWrap.className = 'hero-smart-tester-selector'; selectorWrap.textContent = 'تحلیلگر و نسخه'; const selector = document.createElement('select'); selector.name = 'advisorProfileId'; selector.setAttribute('aria-label', 'انتخاب AI و نسخه'); const localOption = document.createElement('option'); localOption.value = 'local'; localOption.textContent = 'تحلیلگر محلی Hero · بدون هزینه'; selector.append(localOption); selectorWrap.append(selector);
      const scroll = document.createElement('section'); scroll.className = 'hero-smart-tester-scroll'; scroll.setAttribute('aria-label', 'گفت‌وگو و گزارش اسمارت تستر');
      const form = document.createElement('form'); form.className = 'hero-smart-tester-form'; const question = document.createElement('textarea'); question.name = 'question'; question.maxLength = 1500; question.placeholder = 'دربارهٔ همین بخش سؤال کنید؛ Secret، رمز یا دادهٔ شخصی وارد نکنید.'; question.setAttribute('aria-label', 'پرسش برای اسمارت تستر'); const formActions = document.createElement('div'); formActions.className = 'hero-smart-tester-actions'; const ask = document.createElement('button'); ask.type = 'submit'; ask.textContent = 'ارسال پرسش'; formActions.append(ask); form.append(question, formActions);
      const actions = document.createElement('div'); actions.className = 'hero-smart-tester-actions'; const test = document.createElement('button'); test.type = 'button'; test.textContent = 'تست این بخش'; const diagnose = document.createElement('button'); diagnose.type = 'button'; diagnose.textContent = 'خطایاب'; const submitError = document.createElement('button'); submitError.type = 'button'; submitError.textContent = 'ثبت در دفتر خطا'; submitError.disabled = true; const move = document.createElement('button'); move.type = 'button'; const close = document.createElement('button'); close.type = 'button'; close.textContent = 'بستن'; actions.append(test, diagnose, submitError, move, close); panel.append(head, selectorWrap, scroll, form, actions); document.body.append(panel); activeSmartTesterPanel = panel;
      let reportId = null; let errorReportId = null; let context = null; let side = panel.dataset.heroSmartTesterSide; let chatInformed = false; const actionFailure = overrides.actionFailure && typeof overrides.actionFailure === 'object' ? overrides.actionFailure : null;
      const advisorSelectionStorageKey = 'hero.advisor.selection.smart-tester.v1';
      const restoreAdvisorSelection = () => { try { const saved = localStorage.getItem(advisorSelectionStorageKey); if (saved && Array.from(selector.options).some(option => option.value === saved && !option.disabled)) selector.value = saved; } catch { /* preference is optional */ } };
      const saveAdvisorSelection = () => { try { localStorage.setItem(advisorSelectionStorageKey, selector.value); } catch { /* preference is optional */ } };
      const appendMessage = (speaker, value, state = '') => { const item = document.createElement('article'); item.className = 'hero-smart-tester-message'; item.dataset.speaker = speaker; if (state) item.dataset.state = state; const speakerName = document.createElement('b'); speakerName.textContent = speaker === 'user' ? 'شما' : 'اسمارت تستر'; const text = document.createElement('span'); text.textContent = value; item.append(speakerName, text); scroll.append(item); scroll.scrollTop = scroll.scrollHeight; };
      const endpoint = path => { const url = new URL(path, location.origin); url.searchParams.set('surface', smartTesterSurface()); url.searchParams.set('featureKey', featureKey); url.searchParams.set('boxId', boxId); url.searchParams.set('boxTitle', label); url.searchParams.set('boxDescription', boxDescription); if (projectId) url.searchParams.set('projectId', projectId); return url.pathname + url.search; };
      const applySide = nextSide => { side = nextSide; panel.dataset.heroSmartTesterSide = side; setSmartTesterSide(side); move.textContent = side === 'right' ? 'انتقال به لبهٔ چپ' : 'انتقال به لبهٔ راست'; move.setAttribute('aria-label', move.textContent); };
      const loadOptions = async () => { const response = await fetch(endpoint('/api/smart-tester/options'), { credentials: 'same-origin', cache: 'no-store' }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(apiErrorMessage(response, body, 'فهرست AIهای Smart Tester دریافت نشد')); const options = body?.smartTester?.options || {}; for (const profile of Array.isArray(options.profiles) ? options.profiles : []) { const option = document.createElement('option'); option.value = profile.profileId; option.textContent = (profile.providerName || profile.providerId) + ' / ' + (profile.modelName || profile.modelId) + ' · v' + (profile.profileVersion || '?') + (profile.selectable ? (profile.dispatchReady === false ? ' · مجوز سراسری Test آماده نیست' : '') : ' · آماده نیست'); option.title = profile.selectionNotice || ''; option.disabled = profile.selectable !== true; selector.append(option); } if (!options.profiles?.length && options.models?.length) { for (const model of options.models) { const option = document.createElement('option'); option.value = 'unavailable:' + model.providerId + ':' + model.modelId; option.textContent = (model.displayName || model.modelId) + ' · Profile فعال ندارد'; option.title = model.selectionNotice || 'Profile فعال و آماده‌ای برای این Model ثبت نشده است؛ از «پیشنهاد اتصال همهٔ نقش‌ها» استفاده کنید.'; option.disabled = true; selector.append(option); } } restoreAdvisorSelection(); };
      selector.addEventListener('change', saveAdvisorSelection);
      const loadContext = async () => { try { await Promise.all([loadOptions(), (async () => { const response = await fetch(endpoint('/api/smart-tester/context'), { credentials: 'same-origin', cache: 'no-store' }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(apiErrorMessage(response, body, 'زمینهٔ اسمارت تستر در دسترس نیست')); context = body?.smartTester?.context || null; })()]); status.textContent = 'زمینهٔ امن همین باکس آماده است.'; if (actionFailure?.message) appendMessage('assistant', 'این گفت‌وگو به شکست «' + (actionFailure.label || label) + '» متصل است؛ نتیجهٔ HTTP و کد امن خطا منتقل شده‌اند. برای گزارش دقیق، «خطایاب» را اجرا کنید.'); } catch (error) { status.dataset.state = 'error'; status.textContent = error.message || 'برای استفاده، ورود انسانی مالک را بررسی کنید.'; appendMessage('assistant', 'زمینهٔ این باکس دریافت نشد. نشست انسانی مالک و Scope پروژه را بررسی کنید.'); ask.disabled = true; test.disabled = true; diagnose.disabled = true; } };
      const sendAdvice = async rawQuestion => { if (!context) return; ask.disabled = true; chatInformed = true; status.dataset.state = ''; status.textContent = 'در حال آماده‌سازی پاسخ زمینه‌مند…'; appendMessage('user', rawQuestion); try { const response = await fetch(endpoint('/api/smart-tester/advice'), { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ surface: context.pathname, featureKey: context.featureKey, boxId: context.boxId, projectId: context.projectId, question: rawQuestion, reportId, advisorProfileId: selector.value === 'local' ? null : selector.value, actionFailure }) }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(apiErrorMessage(response, body, 'پاسخ اسمارت تستر دریافت نشد')); const advisor = body?.smartTester?.advisor; appendMessage('assistant', advisor?.response || 'پاسخ قابل‌نمایش وجود ندارد.'); status.textContent = advisor?.providerInvoked === true ? 'پاسخ زنده با Provider انتخابی تولید شد؛ مصرف حسابداری‌شده: ' + (advisor?.invocation?.costUnits ?? '—') + ' واحد.' : (advisor?.selectedAdvisor?.kind === 'profile' ? 'پاسخ محلی با Profile انتخابی آماده شد؛ فراخوانی خارجی انجام نشد.' : (reportId ? 'پاسخ با آگاهی از آخرین گزارش تست ارائه شد.' : 'پاسخ زمینه‌مند آماده شد.')); } catch (error) { const safeMessage = error.message || 'پاسخ در دسترس نیست.'; status.dataset.state = 'error'; status.textContent = safeMessage; appendMessage('assistant', 'مشاوره اجرا نشد: ' + safeMessage, 'error'); } finally { ask.disabled = false; } };
      form.addEventListener('submit', event => { event.preventDefault(); const value = question.value.trim(); if (!value) { question.focus(); status.dataset.state = 'error'; status.textContent = 'ابتدا پرسش خود را بنویسید.'; return; } question.value = ''; void sendAdvice(value); });
      test.addEventListener('click', async () => { if (!context) return; test.disabled = true; status.dataset.state = ''; status.textContent = 'در حال اجرای بررسی محدود UI، UX، backend و قرارداد کد…'; try { const response = await fetch(endpoint('/api/smart-tester/run'), { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ surface: context.pathname, featureKey: context.featureKey, boxId: context.boxId, projectId: context.projectId }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || body.code || 'گزارش تست دریافت نشد.'); reportId = body.smartTester?.reportId || null; renderSmartTesterReport(scroll, body.smartTester?.report); status.textContent = 'گزارش قابل‌بحث آماده است.'; scroll.scrollTop = scroll.scrollHeight; } catch (error) { status.dataset.state = 'error'; status.textContent = error.message || 'اجرای تست ناموفق بود.'; } finally { test.disabled = false; } });
      diagnose.addEventListener('click', async () => { if (!context) return; diagnose.disabled = true; status.dataset.state = ''; status.textContent = 'در حال بررسی خطای ثبت‌شده…'; try { const response = await fetch(endpoint('/api/smart-tester/diagnose'), { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ surface: context.pathname, featureKey: context.featureKey, boxId: context.boxId, projectId: context.projectId, reportId, chatInformed, actionFailure }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || body.code || 'گزارش خطایاب دریافت نشد.'); errorReportId = body.smartTester?.errorReportId || null; renderSmartTesterErrorReport(scroll, body.smartTester?.errorReport); submitError.disabled = !errorReportId || !context.projectId; status.textContent = context.projectId ? 'گزارش آماده است؛ اگر می‌خواهید در دفتر خطا ثبت شود، «ثبت در دفتر خطا» را بزنید.' : 'گزارش آماده است؛ برای ثبت آن ابتدا یک پروژه را انتخاب کنید.'; scroll.scrollTop = scroll.scrollHeight; } catch (error) { status.dataset.state = 'error'; status.textContent = error.message || 'خطایابی ناموفق بود.'; } finally { diagnose.disabled = false; } });
      submitError.addEventListener('click', async () => { if (!context || !errorReportId || !context.projectId) return; if (!window.confirm('گزارش پاک‌سازی‌شده در دفتر خطاهای همین پروژه ثبت شود؟')) return; submitError.disabled = true; status.textContent = 'در حال ثبت گزارش در سند مرجع خطاهای پروژه…'; try { const response = await fetch(endpoint('/api/smart-tester/errors/submit'), { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ surface: context.pathname, featureKey: context.featureKey, boxId: context.boxId, projectId: context.projectId, errorReportId }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || body.code || 'ثبت گزارش در دفتر خطا ناموفق بود.'); const document = body.smartTester?.document; status.textContent = 'گزارش در «' + (document?.title || 'دفتر خطای پروژه') + '» ثبت شد (' + (document?.entryCount ?? 0) + ' مورد).'; } catch (error) { status.dataset.state = 'error'; status.textContent = error.message || 'ثبت گزارش ناموفق بود.'; submitError.disabled = false; } });
      move.addEventListener('click', () => applySide(side === 'right' ? 'left' : 'right')); close.addEventListener('click', () => clearSmartTesterPanel({ restoreFocus: true })); applySide(side); panel.focus({ preventScroll: true }); await loadContext();
    };
    const smartTesterToggle = document.querySelector('[data-hero-smart-tester-toggle]');
    const syncSmartTesterToggle = () => { const enabled = smartTesterEnabled(); smartTesterToggle?.setAttribute('aria-pressed', String(enabled)); if (smartTesterToggle) { smartTesterToggle.title = enabled ? 'خاموش کردن اسمارت تستر' : 'روشن کردن اسمارت تستر'; smartTesterToggle.setAttribute('aria-label', smartTesterToggle.title); } };
    const setSmartTesterEnabled = enabled => { try { localStorage.setItem(smartTesterEnabledKey, String(enabled === true)); } catch { /* the current document still updates */ } if (enabled) installSmartTesterTriggers(document); else uninstallSmartTesterTriggers(); syncSmartTesterToggle(); };
    smartTesterToggle?.addEventListener('click', () => setSmartTesterEnabled(!smartTesterEnabled()));
    document.addEventListener('click', event => { const trigger = event.target.closest?.('[data-hero-smart-tester-trigger]'); if (!trigger) return; event.preventDefault(); event.stopPropagation(); void openSmartTester(trigger); });
    const smartTesterObserver = new MutationObserver(records => { if (!smartTesterEnabled()) return; for (const record of records) for (const node of record.addedNodes) installSmartTesterTriggers(node); });
    smartTesterObserver.observe(document.body, { childList: true, subtree: true });
    window.heroSmartTester = Object.freeze({
      enable: () => setSmartTesterEnabled(true),
      disable: () => setSmartTesterEnabled(false),
      isEnabled: smartTesterEnabled,
      close: () => clearSmartTesterPanel({ restoreFocus: true }),
      openForElement: (element, overrides = {}) => {
        if (!smartTesterEnabled()) setSmartTesterEnabled(true);
        const target = element?.nodeType === 1 ? element : document.body;
        void openSmartTester(target, overrides);
      }
    });
    syncSmartTesterToggle(); installSmartTesterTriggers(document);
    // Form Suggestions is an advisory, browser-local assistant. It injects a
    // trigger into safe content forms, never reads current values, and never
    // stores prompts, suggestions or secrets. Sensitive/auth forms are kept
    // outside this feature by both the browser and the server.
    const formSuggestionEnabledKey = 'hero.form-suggestions.enabled.v1';
    const formSuggestionInitialCount = 3;
    const formSuggestionMaxCount = 10;
    const formSuggestionExcludedSelector = '.hero-global-nav,.hero-command-dialog,.hero-smart-tester-panel,.hero-walkthrough-coach,.hero-walkthrough-advisor,.hero-form-suggestion-dialog,[data-hero-no-form-suggestion]';
    const formSuggestionSensitive = /login|mfa|password|credential|secret|token|api.?key|grant|access|identity/i;
    let activeFormSuggestionDialog = null;
    const formSuggestionEnabled = () => { try { return localStorage.getItem(formSuggestionEnabledKey) !== 'false'; } catch { return true; } };
    const formSuggestionPurposeCatalog = Object.freeze({
      'request-form': 'این باکس برای تعریف روشن درخواست ساخت یا تغییر یک نرم‌افزار است. عنوان، توضیح و سناریوی آزمایشی باید نتیجهٔ مورد انتظار را به شکلی قابل برنامه‌ریزی مشخص کنند تا Hero بتواند بدون شروع اقدام خودکار، برنامهٔ اولیهٔ قابل بازبینی بسازد.',
      'create-project-form': 'این باکس برای ایجاد Draft یک پروژه و ثبت ورودی‌های پایهٔ Foundation Proposal است. اطلاعات آن باید مسئله، کاربران، نوع محصول، سطح ریسک، شیوهٔ تأیید، محدودیت‌ها و خروجی‌های مورد انتظار را روشن کند؛ ثبت فرم به‌تنهایی هیچ کد، سرور یا انتشار عملیاتی ایجاد نمی‌کند.',
      'intake-form': 'این باکس برای تکمیل Intake پروژه است؛ یعنی هدف اصلی، کاربران مورد استفاده و میزان خودکارسازی مجاز را به‌صورت نسخه‌دار مشخص می‌کند. این اطلاعات مبنای برنامه‌ریزی، کنترل Scope و پیشنهاد مراحل بعدی هستند و باید پیش از ثبت توسط ادمین بازبینی شوند.',
      'foundation-form': 'این باکس برای بازبینی Foundation Proposal پروژه و ثبت تصمیم ادمین دربارهٔ تأیید یا درخواست بازنگری آن است. اگر Foundation به اصلاح نیاز دارد، دلیل دقیق تغییر در این فرم نوشته می‌شود تا نسخهٔ بعدی با سابقه‌ای روشن و قابل پیگیری ساخته شود؛ این تصمیم به‌تنهایی اجرای محصول یا انتشار آن را آغاز نمی‌کند.',
      'upload-form': 'این باکس برای افزودن اختیاری نمونه، متن یا سند مرتبط با پروژه است تا تیم‌ها زمینه و نیازمندی‌ها را دقیق‌تر درک کنند. نداشتن چنین ورودی‌ای مانع ادامه نیست و محتوای ثبت‌شده باید پیش از استفاده بررسی و در Scope همان پروژه نگهداری شود.',
      'link-form': 'این باکس برای ثبت اختیاری یک لینک عمومی HTTPS و عنوان قابل فهم آن است. لینک صرفاً به‌عنوان مرجع پروژه برای بررسی کنترل‌شده ثبت می‌شود و واردکردن آن به معنی اعتماد خودکار، اجرای محتوا یا انتشار نیست.',
      'setting-form': 'این باکس برای ثبت یک تغییر نسخه‌دار در تنظیمات پروژه است. مسیر، لایه، مقدار JSON، دلیل و اثر تغییر باید دقیق باشند تا تغییر قابل بررسی، حسابرسی و در صورت نیاز قابل بازگشت باقی بماند.',
      'policy-form': 'این باکس برای اعمال Policy Pack از پیش تأییدشده به پروژه است. هدف آن هم‌راستا کردن کنترل‌های پروژه با سیاست معتبر است و نباید برای ساخت سیاست جدید یا دورزدن گیت‌های تأیید استفاده شود.',
      'rollback-form': 'این باکس برای بازگرداندن یک تنظیم پروژه به نسخهٔ قبلی مشخص است. مسیر تنظیم، نسخهٔ مقصد و دلیل Rollback باید روشن باشند تا عملیات قابل حسابرسی باشد و فقط همان تنظیم هدف تغییر کند.',
      'target-selection-form': 'این باکس برای انتخاب نسخه‌دار سرور Test مقصدِ ساخت و اجرای محصول همین پروژه است. انتخاب Target فقط تخصیص را ثبت می‌کند و تا صدور مجوز جداگانه، build، start، deploy یا تغییری روی سرور اجرا نمی‌شود.',
      'guide-settings-form': 'این باکس برای روشن یا خاموش کردن Walk-Through Guide در Scope همین پروژه است. تغییر این گزینه فقط وضعیت راهنما را ثبت می‌کند و داده‌ها، تاریخچه یا تنظیمات اصلی پروژه را حذف نمی‌کند.',
      'principles-form': 'این باکس برای ثبت نسخهٔ جدید اصول کاری یک تیم است. هر اصل باید روشن، قابل ارزیابی و در یک خط نوشته شود؛ ذخیرهٔ نسخهٔ جدید تأیید قبلی را بازنشانی می‌کند تا مالک آن را جداگانه بررسی کند.',
      'ai-config-form': 'این باکس برای ثبت تغییر نسخه‌دار در پیکربندی AI شامل Provider، Model، Profile، Binding، Skill یا Policy است. مقادیر باید با Scope پروژه و کنترل‌های امنیتی هماهنگ باشند؛ Secret واقعی در این فرم قرار نمی‌گیرد و ثبت نهایی فقط با نشست انسانی انجام می‌شود.'
    });
    const formSuggestionReadableText = node => {
      if (!node) return '';
      const copy = node.cloneNode(true);
      copy.querySelectorAll?.('.hero-info-trigger,[data-hero-form-suggestion-trigger],[aria-hidden="true"]').forEach(item => item.remove());
      return String(copy.textContent || '').replace(/\\s+/g, ' ').trim();
    };
    const formSuggestionFieldText = control => {
      const label = control.labels?.[0]?.textContent || control.closest('label')?.textContent || control.name || control.id || 'فیلد';
      return String(label).trim().slice(0, 180);
    };
    const formSuggestionEligible = form => {
      if (!form || !form.isConnected || form.closest(formSuggestionExcludedSelector) || form.matches('[data-hero-no-form-suggestion]')) return false;
      if (formSuggestionSensitive.test(String(form.id || '') + ' ' + String(form.getAttribute('name') || ''))) return false;
      const controls = [...(form.elements || [])];
      if (controls.some(control => String(control.type).toLowerCase() === 'password')) return false;
      if (controls.some(control => formSuggestionSensitive.test(String(control.name || control.id || '') + ' ' + formSuggestionFieldText(control)))) return false;
      return controls.some(control => !control.disabled && ['text', 'search', 'email', 'url', 'number', 'date', 'textarea', 'select-one', 'checkbox', 'radio', 'file'].includes(String(control.type || control.tagName).toLowerCase()) && (control.name || control.id));
    };
    const serializeFormSuggestionFields = form => [...(form.elements || [])].filter(control => {
      const type = String(control.type || control.tagName || '').toLowerCase();
      return !control.disabled && Boolean(control.name || control.id) && !['submit', 'button', 'reset', 'hidden', 'password', 'file'].includes(type);
    }).map(control => {
      const type = String(control.type || control.tagName || '').toLowerCase();
      const normalizedType = type === 'select-one' || type === 'select-multiple' ? 'select' : type;
      return {
        name: control.name || control.id,
        id: control.id || undefined,
        type: normalizedType,
        label: formSuggestionFieldText(control),
        value: normalizedType === 'checkbox' || normalizedType === 'radio' ? (control.value || 'on') : undefined,
        required: control.required === true,
        options: normalizedType === 'select' ? [...control.options].map(option => ({ value: option.value, label: option.textContent.trim() })) : undefined
      };
    });
    const serializeAdvisorAssets = form => [...(form.elements || [])].filter(control => !control.disabled && String(control.type || '').toLowerCase() === 'file' && Boolean(control.name || control.id)).map(control => ({ name: control.name || control.id, label: formSuggestionFieldText(control), accept: String(control.accept || '').slice(0, 220), kind: /image\//i.test(String(control.accept || '')) ? 'image' : 'document', required: control.required === true }));
    const formSuggestionTitle = form => {
      const scope = form.closest('section,dialog,fieldset,.panel,.card,.section,.hero') || form.parentElement;
      const heading = scope?.querySelector('h1,h2,h3,h4,legend,[data-hero-info-key]');
      return String(formSuggestionReadableText(heading) || form.getAttribute('aria-label') || 'تکمیل اطلاعات').trim().slice(0, 180) || 'تکمیل اطلاعات';
    };
    const formSuggestionDescription = form => {
      const explicitPurpose = form.getAttribute('data-hero-form-purpose') || formSuggestionPurposeCatalog[form.id];
      if (explicitPurpose) return String(explicitPurpose).replace(/\\s+/g, ' ').trim().slice(0, 700);
      const scope = form.closest('section,dialog,fieldset,.panel,.card,.section,.hero') || form.parentElement;
      const heading = scope?.querySelector('h1,h2,h3,h4,legend,[data-hero-info-key]');
      const title = formSuggestionReadableText(heading) || 'این بخش';
      const supporting = [...(scope?.querySelectorAll('p.helper-copy,p.meta,p.muted,p') || [])]
        .filter(item => !item.closest(formSuggestionExcludedSelector) && !item.matches('[role="status"],.status,.notice,.dialog-notice'))
        .map(formSuggestionReadableText).find(Boolean);
      const labels = [...new Set([...form.elements].filter(control => !['submit', 'button', 'reset', 'hidden'].includes(String(control.type || '').toLowerCase())).map(formSuggestionFieldText).filter(Boolean))].slice(0, 6);
      const base = supporting || ('این باکس برای ثبت و بازبینی اطلاعات مربوط به «' + title + '» استفاده می‌شود.');
      const fieldSummary = labels.length ? ' اطلاعات اصلی این فرم شامل «' + labels.join('»، «') + '» است.' : '';
      return (base + fieldSummary + ' پیشنهاد باید فقط به کاربرد همین باکس مربوط باشد، از شناسه‌ها و متن‌های فنی نامفهوم به‌عنوان هدف استفاده نکند و پیش از ثبت نهایی توسط ادمین قابل بازبینی باشد.').replace(/\\s+/g, ' ').trim().slice(0, 700);
    };
    const closeFormSuggestionDialog = restoreFocus => {
      const dialog = activeFormSuggestionDialog || document.querySelector('[data-hero-form-suggestion-dialog]');
      if (!dialog) return;
      const trigger = dialog._heroFormSuggestionTrigger;
      if (dialog.open) dialog.close();
      dialog.remove();
      if (activeFormSuggestionDialog === dialog) activeFormSuggestionDialog = null;
      if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
    const applyFormSuggestion = (form, entries) => {
      for (const entry of Array.isArray(entries) ? entries : []) {
        const controls = [...(form.elements || [])].filter(control => (control.name || control.id) === entry.name);
        if (!controls.length) continue;
        const type = String(controls[0].type || '').toLowerCase();
        if (type === 'checkbox' || type === 'radio') {
          const matched = controls.filter(control => String(control.value || 'on') === String(entry.value || 'on'));
          matched.forEach(control => { control.checked = entry.checked === true; control.dispatchEvent(new Event('input', { bubbles: true })); control.dispatchEvent(new Event('change', { bubbles: true })); });
          continue;
        }
        const control = controls.find(item => !item.disabled) || controls[0];
        control.value = String(entry.value ?? '');
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    const renderFormSuggestionEntry = (entry, label) => {
      const row = document.createElement('div'); row.className = 'hero-form-suggestion-card-field';
      const title = document.createElement('span'); title.textContent = label || entry.name; row.append(title);
      const type = entry.type === 'checkbox' || entry.type === 'radio' ? entry.type : entry.type === 'select' ? 'select' : (String(entry.value || '').length > 120 ? 'textarea' : 'text');
      const control = document.createElement(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
      control.disabled = true; control.value = String(entry.value ?? '');
      if (type === 'select') { const option = document.createElement('option'); option.value = String(entry.value ?? ''); option.textContent = String(entry.value ?? ''); option.selected = true; control.append(option); }
      if (type === 'checkbox' || type === 'radio') { control.type = type; control.checked = entry.checked === true; control.value = String(entry.value || 'on'); }
      row.append(control); return row;
    };
    const renderFormSuggestionCard = (container, suggestion, fields, form) => {
      const card = document.createElement('article'); card.className = 'hero-form-suggestion-card';
      const head = document.createElement('header'); head.className = 'hero-form-suggestion-card-head';
      const copy = document.createElement('div'); const title = document.createElement('strong'); title.textContent = suggestion.title || 'پیشنهاد'; const rationale = document.createElement('small'); const fallbackCount = Number(suggestion.fallbackFieldCount) || 0; rationale.textContent = (suggestion.rationale || '') + (fallbackCount ? ' · ' + fallbackCount + ' مقدارِ کم‌ریسک برای کامل‌شدن فرم افزوده شد.' : ''); copy.append(title, rationale);
      const select = document.createElement('button'); select.type = 'button'; select.textContent = 'انتخاب این پیشنهاد'; select.addEventListener('click', () => { applyFormSuggestion(form, suggestion.entries); closeFormSuggestionDialog(true); }); head.append(copy, select); card.append(head);
      const values = document.createElement('div'); values.className = 'hero-form-suggestion-card-fields';
      const fieldLabels = new Map(fields.map(field => [field.name, field.label]));
      for (const entry of Array.isArray(suggestion.entries) ? suggestion.entries : []) values.append(renderFormSuggestionEntry(entry, fieldLabels.get(entry.name)));
      card.append(values); container.append(card);
    };
    const appendFormSuggestionConversation = (container, speaker, value) => {
      const message = document.createElement('article'); message.className = 'hero-form-suggestion-message'; message.dataset.speaker = speaker;
      const label = document.createElement('b'); label.textContent = speaker === 'user' ? 'شما' : 'AI';
      const text = document.createElement('span'); text.textContent = value;
      message.append(label, text); container.append(message); container.scrollTop = container.scrollHeight;
    };
    const openFormSuggestion = async (form, trigger) => {
      if (!formSuggestionEnabled() || !formSuggestionEligible(form)) return;
      closeFormSuggestionDialog(false);
      const fields = serializeFormSuggestionFields(form);
      const assets = serializeAdvisorAssets(form);
      if (!fields.length && !assets.length) return;
      const titleText = formSuggestionTitle(form); const description = formSuggestionDescription(form);
      const dialog = document.createElement('dialog'); dialog.className = 'hero-form-suggestion-dialog'; dialog.dataset.heroFormSuggestionDialog = 'true'; dialog.setAttribute('aria-labelledby', 'hero-form-suggestion-title'); dialog._heroFormSuggestionTrigger = trigger;
      const head = document.createElement('header'); head.className = 'hero-form-suggestion-head'; const headCopy = document.createElement('div'); const heading = document.createElement('h2'); heading.id = 'hero-form-suggestion-title'; heading.textContent = 'ادوایزر برای «' + titleText + '»'; const intro = document.createElement('p'); intro.textContent = 'پیشنهاد، ریسک و تست را بازبینی کنید؛ اعمال مقدار یا انتخاب فایل و ثبت نهایی فقط با شماست.'; headCopy.append(heading, intro); const close = document.createElement('button'); close.type = 'button'; close.className = 'hero-form-suggestion-close'; close.textContent = '×'; close.setAttribute('aria-label', 'بستن'); close.addEventListener('click', () => closeFormSuggestionDialog(true)); head.append(headCopy, close); dialog.append(head);
      const body = document.createElement('div'); body.className = 'hero-form-suggestion-body'; const fieldGrid = document.createElement('div'); fieldGrid.className = 'hero-form-suggestion-fields';
      const advisorLabel = document.createElement('label'); advisorLabel.className = 'full'; advisorLabel.textContent = 'AI و مدل پیشنهاددهنده'; const advisor = document.createElement('select'); advisor.name = 'advisor'; advisor.setAttribute('aria-label', 'انتخاب AI و مدل پیشنهاددهنده'); const local = document.createElement('option'); local.value = 'local'; local.textContent = 'راهنمای محلی Hero · بدون هزینه'; advisor.append(local); advisorLabel.append(advisor);
      const boxLabel = document.createElement('label'); boxLabel.className = 'full'; boxLabel.textContent = 'شرح هدف این باکس'; const box = document.createElement('textarea'); box.readOnly = true; box.value = description; box.dataset.heroFormPurposeOutput = 'true'; box.setAttribute('aria-label', 'شرح هدف این باکس'); boxLabel.append(box); fieldGrid.append(advisorLabel, boxLabel);
      const requestForm = document.createElement('form'); requestForm.className = 'hero-form-suggestion-request'; const actions = document.createElement('div'); actions.className = 'hero-form-suggestion-actions'; const announce = document.createElement('button'); announce.type = 'submit'; announce.textContent = 'اعلام پیشنهاد'; const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'انصراف'; cancel.addEventListener('click', () => closeFormSuggestionDialog(true)); actions.append(announce, cancel); requestForm.append(fieldGrid, actions);
      const status = document.createElement('p'); status.className = 'hero-form-suggestion-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.textContent = 'در حال آماده‌سازی انتخاب AI…'; const results = document.createElement('section'); results.className = 'hero-form-suggestion-results'; results.setAttribute('aria-label', 'پیشنهادهای ادوایزر'); const advisorInsights = document.createElement('section'); advisorInsights.className = 'hero-form-suggestion-document'; advisorInsights.hidden = true; advisorInsights.setAttribute('aria-label', 'تحلیل تصمیم، تست‌ها و دارایی‌های پیشنهادی');
      // Only the existing optional project-input form may receive a draft
      // document. Choosing it copies text into that form; it never uploads or
      // persists anything from this transient dialog.
      const documentEligible = form.id === 'upload-form' && fields.some(field => field.name === 'filename') && fields.some(field => field.name === 'content');
      const documentPanel = document.createElement('section'); documentPanel.className = 'hero-form-suggestion-document'; documentPanel.hidden = true; documentPanel.setAttribute('aria-label', 'پیش‌نویس سند اختیاری');
      const documentHead = document.createElement('header'); const documentCopy = document.createElement('div'); const documentTitle = document.createElement('strong'); const documentRationale = document.createElement('small'); documentCopy.append(documentTitle, documentRationale); const useDocument = document.createElement('button'); useDocument.type = 'button'; useDocument.textContent = 'قرار دادن سند در فرم'; documentHead.append(documentCopy, useDocument); const documentName = document.createElement('p'); documentName.className = 'hero-form-suggestion-document-name'; const documentContent = document.createElement('textarea'); documentContent.readOnly = true; documentContent.setAttribute('aria-label', 'متن پیش‌نویس سند'); const documentNotice = document.createElement('small'); documentNotice.textContent = 'این پیش‌نویس هنوز ذخیره یا بارگذاری نشده است؛ پس از بازبینی، ثبت نهایی با دکمهٔ فرم اصلی انجام می‌شود.'; documentPanel.append(documentHead, documentName, documentContent, documentNotice);
      const feedbackPanel = document.createElement('section'); feedbackPanel.className = 'hero-form-suggestion-feedback'; feedbackPanel.hidden = true; feedbackPanel.setAttribute('aria-label', 'گفت‌وگو برای بهبود پیشنهاد');
      const feedbackHead = document.createElement('div'); feedbackHead.className = 'hero-form-suggestion-feedback-head'; const feedbackTitle = document.createElement('strong'); feedbackTitle.textContent = 'بهبود پیشنهاد با AI'; const feedbackHelp = document.createElement('small'); feedbackHead.append(feedbackTitle, feedbackHelp);
      const conversation = document.createElement('div'); conversation.className = 'hero-form-suggestion-conversation'; conversation.setAttribute('aria-live', 'polite');
      const feedbackForm = document.createElement('form'); feedbackForm.className = 'hero-form-suggestion-feedback-form'; const feedbackInput = document.createElement('textarea'); feedbackInput.maxLength = 1000; feedbackInput.placeholder = 'مثلاً: پیشنهادها کوتاه‌تر باشند و فقط روی تأیید Foundation تمرکز کنند.'; feedbackInput.setAttribute('aria-label', 'بازخورد برای بهبود پیشنهاد'); const refine = document.createElement('button'); refine.type = 'submit'; refine.textContent = 'ساخت پیشنهاد بهتر'; feedbackForm.append(feedbackInput, refine); feedbackPanel.append(feedbackHead, conversation, feedbackForm);
      body.append(requestForm, status, results, advisorInsights, documentPanel, feedbackPanel); dialog.append(body); document.body.append(dialog); activeFormSuggestionDialog = dialog;
      let refinementCount = 0; let suggestionCount = 0; let suggestionsReady = false;
      // This is a UI preference for the Advisor service, not a project
      // setting.  Its value contains only a public profile id and is shared
      // by all project forms in this browser.
      const advisorSelectionStorageKey = 'hero.advisor.selection.form-suggestions.v1';
      const restoreAdvisorSelection = () => { try { const saved = localStorage.getItem(advisorSelectionStorageKey); if (saved && Array.from(advisor.options).some(option => option.value === saved && !option.disabled)) advisor.value = saved; } catch { /* preference is optional */ } };
      const saveAdvisorSelection = () => { try { localStorage.setItem(advisorSelectionStorageKey, advisor.value); } catch { /* preference is optional */ } };
      const isLiveAdvisor = () => Boolean(advisor.value && advisor.value !== 'local');
      const resetSuggestionSession = () => { refinementCount = 0; suggestionCount = 0; suggestionsReady = false; results.replaceChildren(); advisorInsights.replaceChildren(); advisorInsights.hidden = true; conversation.replaceChildren(); feedbackInput.value = ''; feedbackPanel.hidden = true; documentPanel.hidden = true; documentTitle.textContent = ''; documentRationale.textContent = ''; documentName.textContent = ''; documentContent.value = ''; useDocument.onclick = null; box.value = description; };
      const syncRefinement = () => {
        const canRefine = suggestionsReady && isLiveAdvisor() && suggestionCount < formSuggestionMaxCount;
        feedbackInput.disabled = !canRefine; refine.disabled = !canRefine; feedbackPanel.hidden = !suggestionsReady;
        feedbackHelp.textContent = !suggestionsReady ? '' : !isLiveAdvisor() ? 'برای گفت‌وگوی تعاملی، یک AI و مدلِ آماده را انتخاب و دوباره پیشنهاد بگیرید.' : suggestionCount >= formSuggestionMaxCount ? '۱۰ پیشنهاد این پنجره آماده است؛ یکی را انتخاب کنید یا برای شروع یک مجموعهٔ تازه، دوباره «اعلام پیشنهاد» را بزنید.' : 'اکنون ' + suggestionCount + ' از ۱۰ پیشنهاد آماده است؛ هر بازخورد فقط یک گزینهٔ تازه می‌سازد. اطلاعات حساس وارد نکنید.';
      };
      const renderDocumentProposal = proposal => {
        if (!documentEligible || !proposal || typeof proposal !== 'object' || typeof proposal.filename !== 'string' || typeof proposal.content !== 'string') { documentPanel.hidden = true; return; }
        documentTitle.textContent = proposal.title || 'پیش‌نویس سند اختیاری'; documentRationale.textContent = proposal.rationale || ''; documentName.textContent = proposal.filename; documentContent.value = proposal.content;
        useDocument.onclick = () => { applyFormSuggestion(form, [{ name: 'filename', type: 'text', value: proposal.filename }, { name: 'content', type: 'textarea', value: proposal.content }]); closeFormSuggestionDialog(true); };
        documentPanel.hidden = false;
      };
      const renderAdvisorInsights = suggestionData => {
        advisorInsights.replaceChildren();
        const support = suggestionData?.decisionSupport || {}; const groups = [['فرض‌های مهم', support.assumptions], ['ریسک‌ها', support.risks], ['تست‌های پیشنهادی', support.tests], ['فرصت‌های بهبود', support.improvements]];
        for (const [label, values] of groups) { if (!Array.isArray(values) || !values.length) continue; const block = document.createElement('article'); const title = document.createElement('strong'); title.textContent = label; const list = document.createElement('ul'); for (const value of values) { const item = document.createElement('li'); item.textContent = value; list.append(item); } block.append(title, list); advisorInsights.append(block); }
        for (const proposal of Array.isArray(suggestionData?.assetProposals) ? suggestionData.assetProposals : []) { const block = document.createElement('article'); const title = document.createElement('strong'); title.textContent = (proposal.kind === 'image' ? 'پیشنهاد تصویر' : 'پیشنهاد سند') + ' · ' + (proposal.title || proposal.label || 'دارایی'); const detail = document.createElement('p'); detail.textContent = (proposal.filename ? proposal.filename + ' · ' : '') + (proposal.brief || '') + (proposal.altText ? ' · متن جایگزین: ' + proposal.altText : ''); const note = document.createElement('small'); note.textContent = 'این فقط طرح پیشنهادی است؛ مرورگر فایل را خودکار انتخاب یا بارگذاری نمی‌کند.'; block.append(title, detail, note); advisorInsights.append(block); }
        advisorInsights.hidden = advisorInsights.children.length === 0;
      };
      const renderSuggestionSet = (suggestionData, { refined = false } = {}) => {
        if (!refined) { results.replaceChildren(); suggestionCount = 0; }
        box.value = typeof suggestionData?.boxPurpose === 'string' && suggestionData.boxPurpose.trim() ? suggestionData.boxPurpose.trim() : description;
        const available = Math.max(0, formSuggestionMaxCount - suggestionCount);
        for (const suggestion of Array.isArray(suggestionData?.suggestions) ? suggestionData.suggestions.slice(0, available) : []) renderFormSuggestionCard(results, suggestion, fields, form);
        suggestionCount = results.children.length;
        suggestionsReady = results.children.length > 0;
        renderDocumentProposal(suggestionData?.documentProposal);
        renderAdvisorInsights(suggestionData);
        if (suggestionsReady) {
          const purpose = typeof suggestionData?.boxPurpose === 'string' ? suggestionData.boxPurpose.trim() : '';
          const providerFeedbackResponse = typeof suggestionData?.feedbackResponse === 'string' ? suggestionData.feedbackResponse.trim() : '';
          const responseText = refined ? (providerFeedbackResponse || 'بازخورد شما اعمال شد و یک پیشنهاد تازه برای همین فرم آماده است.') : suggestionData?.providerInvoked === true ? formSuggestionInitialCount + ' پیشنهاد آغازین آماده‌اند. اگر چیزی باید تغییر کند، بازخوردتان را بنویسید تا هر بار یک گزینهٔ تازه بسازم.' + (purpose ? ' ' + purpose : '') : 'پیشنهاد محلی آماده است. برای گفت‌وگوی تعاملی و اصلاح بر پایهٔ بازخورد، یک AI و مدلِ آماده انتخاب کنید.';
          appendFormSuggestionConversation(conversation, 'assistant', responseText);
        }
        syncRefinement();
      };
      const loadOptions = async () => { try { const url = new URL('/api/advisor/options', location.origin); if (projectId) url.searchParams.set('projectId', projectId); const response = await fetch(url.pathname + url.search, { credentials: 'same-origin', cache: 'no-store' }); const payload = await response.json().catch(() => null); if (!response.ok) throw new Error(apiErrorMessage(response, payload, 'فهرست AIهای ادوایزر دریافت نشد')); const options = payload?.advisor || payload?.formSuggestions || {}; for (const profile of Array.isArray(options.profiles) ? options.profiles : []) { const option = document.createElement('option'); option.value = profile.profileId; option.textContent = (profile.providerName || profile.providerId) + ' / ' + (profile.modelName || profile.modelId) + ' · v' + (profile.profileVersion || '?') + (profile.selectable ? (profile.dispatchReady === false ? ' · مجوز سراسری Test آماده نیست' : '') : ' · فعلاً غیرفعال'); option.title = profile.selectionNotice || ''; option.disabled = profile.selectable !== true; advisor.append(option); } restoreAdvisorSelection(); status.textContent = isLiveAdvisor() ? 'AI سراسری انتخاب شد؛ برای ساخت پیشنهاد اولیه «اعلام پیشنهاد» را بزنید.' : 'AI و مدل را انتخاب کنید و سپس «اعلام پیشنهاد» را بزنید.'; } catch (error) { status.dataset.state = 'error'; status.textContent = error.message || 'راهنمای محلی همچنان قابل استفاده است.'; } };
      advisor.addEventListener('change', () => { saveAdvisorSelection(); resetSuggestionSession(); status.dataset.state = ''; const selected = advisor.options[advisor.selectedIndex]; status.textContent = isLiveAdvisor() ? (selected?.title || 'AI سراسری انتخاب شد؛ برای ساخت پیشنهاد اولیه «اعلام پیشنهاد» را بزنید.') : 'راهنمای محلی انتخاب شد؛ برای پیشنهاد تعاملی یک AI و مدلِ آماده انتخاب کنید.'; });
      requestForm.addEventListener('submit', async event => { event.preventDefault(); announce.disabled = true; cancel.disabled = true; status.dataset.state = ''; status.textContent = 'در حال تحلیل هدف باکس و ساخت ' + formSuggestionInitialCount + ' پیشنهاد قابل بررسی…'; resetSuggestionSession(); try { const response = await fetch('/api/advisor' + (projectId ? '?projectId=' + encodeURIComponent(projectId) : ''), { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: projectId || null, formId: form.id || 'form-content', formTitle: titleText, boxDescription: description, selectedAdvisor: advisor.value, fields, assets }) }); const payload = await response.json().catch(() => null); if (!response.ok) throw new Error(apiErrorMessage(response, payload, 'پیشنهاد ادوایزر دریافت نشد')); renderSuggestionSet(payload?.advisor || payload?.formSuggestions); status.textContent = suggestionsReady ? 'هدف باکس تحلیل شد و ' + formSuggestionInitialCount + ' پیشنهاد آغازین آماده‌اند؛ یکی را انتخاب یا با AI دربارهٔ آن‌ها گفت‌وگو کنید.' : 'پیشنهادی برای این فرم ساخته نشد.'; } catch (error) { status.dataset.state = 'error'; status.textContent = error.message || 'ساخت پیشنهاد ناموفق بود.'; } finally { announce.disabled = false; cancel.disabled = false; syncRefinement(); } });
      feedbackForm.addEventListener('submit', async event => { event.preventDefault(); const feedback = feedbackInput.value.trim(); if (!isLiveAdvisor()) { status.dataset.state = 'error'; status.textContent = 'برای بهبود تعاملی، یک AI و مدلِ آماده انتخاب کنید.'; return; } if (feedback.length < 3) { feedbackInput.focus(); status.dataset.state = 'error'; status.textContent = 'لطفاً کوتاه توضیح دهید چه چیزی باید بهتر شود.'; return; } if (suggestionCount >= formSuggestionMaxCount) return; const nextIteration = refinementCount + 1; refine.disabled = true; feedbackInput.disabled = true; announce.disabled = true; status.dataset.state = ''; status.textContent = 'در حال اعمال بازخورد و ساخت یک پیشنهاد تازه…'; appendFormSuggestionConversation(conversation, 'user', feedback); try { const response = await fetch('/api/advisor/refine' + (projectId ? '?projectId=' + encodeURIComponent(projectId) : ''), { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: projectId || null, formId: form.id || 'form-content', formTitle: titleText, boxDescription: description, selectedAdvisor: advisor.value, fields, assets, feedback, iteration: nextIteration }) }); const payload = await response.json().catch(() => null); if (!response.ok) throw new Error(apiErrorMessage(response, payload, 'اصلاح پیشنهاد دریافت نشد')); const advisorResult = payload?.advisor || payload?.formSuggestions; refinementCount = Number(advisorResult?.refinement?.iteration) || nextIteration; feedbackInput.value = ''; renderSuggestionSet(advisorResult, { refined: true }); status.textContent = 'پیشنهاد ' + suggestionCount + ' از ۱۰ آماده است؛ آن را انتخاب کنید یا بازخورد دیگری بدهید.'; } catch (error) { status.dataset.state = 'error'; status.textContent = error.message || 'ساخت پیشنهاد بهتر ناموفق بود.'; } finally { announce.disabled = false; syncRefinement(); } });
      dialog.addEventListener('cancel', event => { event.preventDefault(); closeFormSuggestionDialog(true); }); dialog.addEventListener('click', event => { if (event.target === dialog) closeFormSuggestionDialog(true); }); dialog.showModal(); void loadOptions();
    };
    const uninstallFormSuggestionTriggers = () => { closeFormSuggestionDialog(false); document.querySelectorAll('[data-hero-form-suggestion-trigger]').forEach(trigger => trigger.remove()); document.querySelectorAll('.hero-advisable-form').forEach(form => form.classList.remove('hero-advisable-form')); };
    const installFormSuggestionTriggers = container => {
      if (!formSuggestionEnabled()) return;
      const forms = []; if (container?.nodeType === 1 && container.matches?.('form')) forms.push(container); container?.querySelectorAll?.('form').forEach(form => forms.push(form));
      for (const form of forms) { if (!formSuggestionEligible(form) || form.querySelector(':scope > [data-hero-form-suggestion-trigger]')) continue; const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'hero-form-suggestion-trigger'; trigger.dataset.heroFormSuggestionTrigger = 'true'; trigger.textContent = '💡'; trigger.title = 'باز کردن ادوایزر این فرم'; trigger.setAttribute('aria-label', 'باز کردن ادوایزر این فرم'); trigger.setAttribute('aria-hidden', 'false'); trigger.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); void openFormSuggestion(form, trigger); }); form.classList.add('hero-advisable-form'); form.prepend(trigger); }
    };
    const formSuggestionToggle = document.querySelector('[data-hero-form-suggestions-toggle]');
    const syncFormSuggestionToggle = () => { const enabled = formSuggestionEnabled(); formSuggestionToggle?.setAttribute('aria-pressed', String(enabled)); if (formSuggestionToggle) { formSuggestionToggle.title = enabled ? 'خاموش کردن ادوایزر' : 'روشن کردن ادوایزر'; formSuggestionToggle.setAttribute('aria-label', formSuggestionToggle.title); } };
    const setFormSuggestionEnabled = enabled => { try { localStorage.setItem(formSuggestionEnabledKey, String(enabled === true)); } catch { /* current page still updates */ } if (enabled) installFormSuggestionTriggers(document); else uninstallFormSuggestionTriggers(); syncFormSuggestionToggle(); };
    formSuggestionToggle?.addEventListener('click', () => setFormSuggestionEnabled(!formSuggestionEnabled()));
    const formSuggestionObserver = new MutationObserver(records => { if (!formSuggestionEnabled()) return; for (const record of records) for (const node of record.addedNodes) installFormSuggestionTriggers(node); });
    formSuggestionObserver.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && activeFormSuggestionDialog?.open) closeFormSuggestionDialog(true); });
    window.heroFormSuggestions = Object.freeze({ enable: () => setFormSuggestionEnabled(true), disable: () => setFormSuggestionEnabled(false), isEnabled: formSuggestionEnabled, openForForm: form => { if (form?.matches?.('form')) void openFormSuggestion(form, form.querySelector('[data-hero-form-suggestion-trigger]')); } });
    window.heroAdvisor = window.heroFormSuggestions;
    syncFormSuggestionToggle(); installFormSuggestionTriggers(document);
    const walkthroughStateKey = 'hero.project-walkthrough.state.v1';
    const walkthroughServicePrefix = 'hero.project-walkthrough.enabled.';
    const walkthroughCoachSideKey = 'hero.project-walkthrough.coach-side.v1';
    const walkthroughAdvisorSideKey = 'hero.project-walkthrough.advisor-side.v1';
    const walkthroughCoachMinimizedKey = 'hero.project-walkthrough.coach-minimized.v1';
    const walkthroughOwnerDismissedKey = 'hero.project-walkthrough.owner-dismissed.v1';
    const walkthroughOwnerLoginKey = 'hero.project-walkthrough.owner-login.v1';
    const noProjectWalkthroughSteps = new Set(['identity', 'project-selection', 'create-project']);
    const stepById = id => walkthroughSteps.find(step => step.id === id) || null;
    const usableProjectId = value => projectPattern.test(value || '') ? value : null;
    const readWalkthroughState = () => {
      try {
        const value = JSON.parse(localStorage.getItem(walkthroughStateKey) || 'null');
        if (!value || value.version !== 1 || !stepById(value.stepId)) return null;
        return value;
      } catch { return null; }
    };
    const writeWalkthroughState = value => {
      const next = { ...value, version: 1, updatedAt: Date.now() };
      localStorage.setItem(walkthroughStateKey, JSON.stringify(next));
      return next;
    };
    const stateProjectId = state => usableProjectId(new URL(location.href).searchParams.get('projectId')) || usableProjectId(state?.projectId) || usableProjectId(localStorage.getItem(activeProjectKey));
    const serviceSettingKey = projectId => walkthroughServicePrefix + projectId;
    const serviceEnabled = projectId => !projectId || localStorage.getItem(serviceSettingKey(projectId)) !== 'false';
    const setServiceEnabled = (projectId, enabled) => {
      if (!usableProjectId(projectId)) return;
      localStorage.setItem(serviceSettingKey(projectId), String(enabled === true));
      if (enabled !== true) stopWalkthrough('service-disabled');
    };
    const portalHref = (surface, params = {}) => {
      const url = new URL('/api/portal', location.origin);
      url.searchParams.set('surface', surface);
      for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, value);
      return url.pathname + url.search;
    };
    const walkthroughSurfaceForRoute = route => {
      const url = new URL(route, location.origin);
      if (url.pathname === '/identity') return 'identity';
      if (url.pathname === '/workspace') return 'workspace';
      if (url.pathname === '/product-studio') return 'studio';
      if (url.pathname === '/project-control') return 'control';
      if (url.pathname === '/walkthrough') return 'walkthrough';
      if (url.pathname === '/portfolio' && url.searchParams.get('surface') === 'command') return 'command';
      if (url.pathname === '/portfolio' && url.searchParams.get('surface') === 'walkthrough') return 'walkthrough';
      return 'portfolio';
    };
    const guideHref = projectId => portalHref('walkthrough', usableProjectId(projectId) ? { projectId } : {});
    let activeWalkthroughCoach = null;
    let activeWalkthroughAdvisor = null;
    const preferredSide = (storageKey, fallback) => {
      try { const side = localStorage.getItem(storageKey); return side === 'left' || side === 'right' ? side : fallback; } catch { return fallback; }
    };
    const setPreferredSide = (storageKey, side) => {
      try { localStorage.setItem(storageKey, side); } catch { /* preference remains for this page */ }
    };
    let coachMinimizedInMemory = null;
    const isCoachMinimized = () => {
      if (typeof coachMinimizedInMemory === 'boolean') return coachMinimizedInMemory;
      try { return localStorage.getItem(walkthroughCoachMinimizedKey) === 'true'; } catch { return false; }
    };
    const setCoachMinimized = minimized => {
      coachMinimizedInMemory = minimized === true;
      try { localStorage.setItem(walkthroughCoachMinimizedKey, String(minimized === true)); } catch { /* private mode can still use the visible state */ }
    };
    const removeWalkthroughLauncher = () => document.querySelector('[data-hero-walkthrough-launcher]')?.remove();
    const clearWalkthroughAdvisor = () => {
      const advisor = activeWalkthroughAdvisor || document.querySelector('[data-hero-walkthrough-advisor]');
      if (!advisor) return;
      advisor._heroWalkthroughCleanup?.();
      advisor.remove();
      if (activeWalkthroughAdvisor === advisor) activeWalkthroughAdvisor = null;
    };
    const clearWalkthroughCoach = ({ preserveLauncher = false, preserveAdvisor = false } = {}) => {
      if (!preserveAdvisor) clearWalkthroughAdvisor();
      if (!preserveLauncher) removeWalkthroughLauncher();
      const coach = activeWalkthroughCoach || document.querySelector('[data-hero-walkthrough-coach]');
      if (!coach) return;
      coach._heroWalkthroughCleanup?.();
      const target = coach._heroWalkthroughTarget;
      if (target) {
        target.classList.remove('hero-walkthrough-target');
        if (coach._heroWalkthroughAddedTabIndex) target.removeAttribute('tabindex');
        if (coach._heroWalkthroughPreviousDescription === null) target.removeAttribute('aria-describedby');
        else target.setAttribute('aria-describedby', coach._heroWalkthroughPreviousDescription);
      }
      coach.remove();
      if (activeWalkthroughCoach === coach) activeWalkthroughCoach = null;
    };
    const routeForWalkthroughStep = (stepId, preferredProjectId = null) => {
      let step = stepById(stepId);
      let projectId = usableProjectId(preferredProjectId) || usableProjectId(localStorage.getItem(activeProjectKey));
      if (!step) step = stepById('project-selection') || mainWalkthroughSteps[0];
      if (!noProjectWalkthroughSteps.has(step.id) && !projectId) step = stepById('project-selection');
      const source = new URL(step.route, location.origin);
      const url = new URL('/api/portal', location.origin);
      url.searchParams.set('surface', walkthroughSurfaceForRoute(step.route));
      for (const key of ['select', 'next', 'open']) if (source.searchParams.has(key)) url.searchParams.set(key, source.searchParams.get(key));
      if (!noProjectWalkthroughSteps.has(step.id) && projectId) url.searchParams.set('projectId', projectId);
      url.searchParams.set('walkthrough', step.id);
      return url.pathname + url.search;
    };
    const stopWalkthrough = (status = 'closed') => {
      const previous = readWalkthroughState();
      if (previous) writeWalkthroughState({ ...previous, active: false, status, stoppedAt: Date.now() });
      if (status === 'closed-by-user') { try { localStorage.setItem(walkthroughOwnerDismissedKey, 'true'); } catch { /* an unavailable browser store must not block closing the guide */ } }
      setCoachMinimized(false);
      clearWalkthroughCoach();
    };
    const startWalkthrough = ({ stepId = 'project-selection', projectId = null } = {}) => {
      let step = stepById(stepId) || stepById('project-selection') || mainWalkthroughSteps[0];
      const explicitProjectId = usableProjectId(projectId);
      // A new/default guide always begins by asking the Owner to choose a
      // scope. A project retained in browser navigation must not silently
      // make the first numbered step look as though a choice was made.
      const scopedProjectId = step.id === 'project-selection' && !explicitProjectId
        ? null
        : explicitProjectId || usableProjectId(localStorage.getItem(activeProjectKey));
      if (!noProjectWalkthroughSteps.has(step.id) && !scopedProjectId) step = stepById('project-selection');
      if (scopedProjectId) localStorage.setItem(activeProjectKey, scopedProjectId);
      try { localStorage.removeItem(walkthroughOwnerDismissedKey); } catch { /* a manual restart still works in this page */ }
      setCoachMinimized(false); clearWalkthroughCoach();
      writeWalkthroughState({ active: true, status: 'active', stepId: step.id, projectId: scopedProjectId, startedAt: Date.now() });
      location.assign(routeForWalkthroughStep(step.id, scopedProjectId));
    };
    const continueWalkthrough = ({ stepId, projectId = null } = {}) => {
      const previous = readWalkthroughState();
      if (!previous?.active) return startWalkthrough({ stepId, projectId });
      const step = stepById(stepId) || stepById(previous.stepId) || stepById('project-selection') || mainWalkthroughSteps[0];
      const scopedProjectId = usableProjectId(projectId) || stateProjectId(previous);
      if (scopedProjectId) localStorage.setItem(activeProjectKey, scopedProjectId);
      setCoachMinimized(false); clearWalkthroughCoach();
      writeWalkthroughState({ ...previous, active: true, status: 'active', stepId: step.id, projectId: scopedProjectId });
      location.assign(routeForWalkthroughStep(step.id, scopedProjectId));
    };
    const resumeWalkthrough = () => {
      const state = readWalkthroughState();
      if (!state?.active) return startWalkthrough();
      const projectId = usableProjectId(state.projectId);
      if (projectId && !serviceEnabled(projectId)) return;
      location.assign(routeForWalkthroughStep(state.stepId, projectId));
    };
    const moveWalkthrough = direction => {
      const state = readWalkthroughState();
      if (!state?.active) return startWalkthrough();
      const current = stepById(state.stepId);
      const projectId = usableProjectId(state.projectId);
      let target = direction > 0
        ? stepById(current?.nextId)
        : walkthroughSteps.find(step => step.nextId === current?.id) || null;
      // A selected Project is already the result of either an existing Draft
      // or a newly-created Draft. Do not force it through the owner-only
      // optional creation screen; it remains directly reachable from Guide.
      if (projectId && target?.id === 'create-project') {
        target = direction > 0
          ? stepById(target.nextId)
          : walkthroughSteps.find(step => step.nextId === target.id) || null;
      }
      if (!target) {
        if (direction > 0) {
          stopWalkthrough('completed');
          location.assign(guideHref(stateProjectId(state)));
        }
        return;
      }
      let next = target;
      if (!noProjectWalkthroughSteps.has(next.id) && !projectId) next = stepById('project-selection');
      setCoachMinimized(false); clearWalkthroughAdvisor();
      writeWalkthroughState({ ...state, active: true, status: 'active', stepId: next.id, projectId });
      location.assign(routeForWalkthroughStep(next.id, projectId));
    };
    const requestedWalkthroughStep = new URL(location.href).searchParams.get('walkthrough');
    if (stepById(requestedWalkthroughStep)) {
      const previous = readWalkthroughState();
      const selectedProjectId = stateProjectId(previous);
      writeWalkthroughState({ ...previous, active: true, status: 'active', stepId: requestedWalkthroughStep, projectId: selectedProjectId, startedAt: previous?.startedAt ?? Date.now() });
      const next = new URL(location.href); next.searchParams.delete('walkthrough'); history.replaceState(null, '', next.pathname + next.search + next.hash);
    }
    // A project card can navigate directly to a surface without carrying the
    // walkthrough query parameter. Reconcile the persisted step with the
    // surface that is actually open so a minimized H launcher never points at
    // a target that cannot exist on the current page.
    const walkthroughStepForSurface = surface => ({
      portfolio: 'project-selection',
      workspace: 'foundation',
      studio: 'studio-review',
      command: 'command-center',
      control: 'operations-review'
    }[surface] || null);
    const currentWalkthroughSurface = () => {
      const url = new URL(location.href);
      if (url.pathname === '/api/portal') return url.searchParams.get('surface') || 'portfolio';
      return walkthroughSurfaceForRoute(url.pathname + url.search);
    };
    const normalizeWalkthroughStateForSurface = () => {
      const active = readWalkthroughState();
      if (!active || new URL(location.href).searchParams.has('walkthrough')) return active;
      if (stepById(active.stepId)?.flow === 'outside-main') {
        const resumed = { ...active, active: true, status: 'active', stepId: 'project-selection', projectId: stateProjectId(active) };
        writeWalkthroughState(resumed);
        return resumed;
      }
      const surface = currentWalkthroughSurface();
      const expectedStep = walkthroughStepForSurface(surface);
      if (!expectedStep) return active;
      const projectId = stateProjectId(active);
      const routeSteps = {
        portfolio: new Set(['project-selection', 'create-project']),
        workspace: new Set(['inputs', 'foundation', 'settings']),
        studio: new Set(['studio-review']),
        command: new Set(['command-center']),
        control: new Set(['operations-review', 'team-research', 'live-execution', 'test-delivery', 'production'])
      }[surface];
      if (routeSteps?.has(active.stepId)) return active;
      const next = { ...active, active: true, status: 'active', stepId: expectedStep, projectId };
      writeWalkthroughState(next);
      return next;
    };
    normalizeWalkthroughStateForSurface();
    document.addEventListener('click', event => {
      const projectLink = event.target.closest?.('[data-hero-select-project]');
      const selectedId = usableProjectId(projectLink?.dataset?.heroSelectProject);
      const state = readWalkthroughState();
      if (selectedId && state?.active) {
        const linkUrl = projectLink?.href ? new URL(projectLink.href, location.origin) : null;
        const nextStep = walkthroughStepForSurface(linkUrl?.searchParams.get('surface'));
        writeWalkthroughState({ ...state, projectId: selectedId, ...(state.stepId === 'project-selection' && nextStep ? { stepId: nextStep } : {}) });
      }
    });
    const restoreWalkthroughCoach = () => {
      // Reconcile once more at click time. A project page may have been opened
      // in another tab (or a framework navigation may have changed the
      // surface) after the initial shell bootstrap, so the persisted step can
      // be stale even though the H launcher is visible.
      const active = normalizeWalkthroughStateForSurface() || readWalkthroughState();
      if (!active?.active) return;
      setCoachMinimized(false);
      removeWalkthroughLauncher();
      // Dynamic pages can replace their target just as H is clicked. Retry on
      // two frames, then leave a safe launcher fallback in place. The target
      // observer replaces that fallback with the coach when it is ready.
      requestAnimationFrame(() => {
        installWalkthroughCoach();
        requestAnimationFrame(installWalkthroughCoach);
      });
      window.setTimeout(() => {
        const current = readWalkthroughState();
        if (current?.active && !document.querySelector('[data-hero-walkthrough-coach]')) showWalkthroughLauncher(current);
      }, 220);
    };
    const showWalkthroughLauncher = active => {
      removeWalkthroughLauncher();
      const launcher = document.createElement('button'); launcher.type = 'button'; launcher.className = 'hero-walkthrough-launcher';
      launcher.dataset.heroWalkthroughLauncher = active.stepId;
      launcher.dataset.heroWalkthroughSide = preferredSide(walkthroughCoachSideKey, 'right');
      launcher.setAttribute('aria-label', 'بازگرداندن پنجرهٔ راهنمای Walk-Through'); launcher.title = 'بازگرداندن راهنما'; launcher.textContent = 'H';
      launcher.addEventListener('click', restoreWalkthroughCoach);
      document.body.append(launcher);
    };
    window.heroWalkthrough = Object.freeze({
      start: startWalkthrough,
      resume: resumeWalkthrough,
      continue: continueWalkthrough,
      previous: () => moveWalkthrough(-1),
      next: () => moveWalkthrough(1),
      stop: stopWalkthrough,
      minimize: () => { const state = readWalkthroughState(); if (state?.active) { setCoachMinimized(true); clearWalkthroughCoach({ preserveLauncher: true }); showWalkthroughLauncher(state); } },
      restore: restoreWalkthroughCoach,
      setServiceEnabled,
      getState: readWalkthroughState,
      getGuideHref: guideHref
    });
    window.dispatchEvent(new Event('hero-walkthrough-ready'));
    const isWalkthroughTargetReady = target => {
      if (!target?.isConnected || target.hidden || target.getClientRects().length === 0) return false;
      const style = getComputedStyle(target);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };
    const installWalkthroughCoach = () => {
      const active = readWalkthroughState();
      if (!active?.active) return;
      const currentStep = stepById(active.stepId);
      // Identity and access are useful supporting capabilities, but are not
      // numbered product-development stages. They remain reachable from the
      // full guide without creating an invalid "0 of N" floating coach.
      if (!currentStep?.target || currentStep.flow === 'outside-main') return;
      const projectIdForGuide = usableProjectId(active.projectId) || (currentStep.id === 'project-selection' ? null : stateProjectId(active));
      if (projectIdForGuide && !serviceEnabled(projectIdForGuide)) return;
      const target = document.querySelector('[data-hero-guide-target="' + currentStep.target + '"]');
      const existingCoach = activeWalkthroughCoach || document.querySelector('[data-hero-walkthrough-coach]');
      // Dynamic surfaces replace their cards during refresh. A coach bound to
      // the removed card must be rebound only after the replacement is ready.
      if (existingCoach?.dataset.heroWalkthroughCoach === currentStep.id && existingCoach._heroWalkthroughTarget === target && isWalkthroughTargetReady(target)) return;
      if (existingCoach) clearWalkthroughCoach();
      // The minimized state is independent from target rendering. Keep the H
      // affordance available while a dynamic card is still loading; the
      // mutation observer and retry loop will install the coach once ready.
      if (isCoachMinimized()) { showWalkthroughLauncher(active); return; }
      if (!isWalkthroughTargetReady(target)) return;
      removeWalkthroughLauncher();
      const index = mainWalkthroughSteps.findIndex(step => step.id === currentStep.id);
      const previousStep = walkthroughSteps.find(step => step.nextId === currentStep.id) || null;
      const nextStep = stepById(currentStep.nextId);
      const defaultCoachSide = target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2 >= innerWidth / 2 ? 'left' : 'right';
      let coachSide = preferredSide(walkthroughCoachSideKey, defaultCoachSide);
      const coach = document.createElement('aside'); coach.className = 'hero-walkthrough-coach'; coach.dataset.heroWalkthroughCoach = currentStep.id; coach.dataset.heroWalkthroughSide = coachSide; coach.setAttribute('role', 'region'); coach.setAttribute('tabindex', '-1'); coach.style.visibility = 'hidden';
      const progress = document.createElement('span'); progress.className = 'hero-walkthrough-progress'; progress.textContent = 'گام ' + (index + 1) + ' از ' + mainWalkthroughSteps.length;
      const title = document.createElement('strong'); title.id = 'hero-walkthrough-title-' + currentStep.id; title.textContent = currentStep.title; coach.setAttribute('aria-labelledby', title.id);
      const summary = document.createElement('p'); summary.textContent = currentStep.summary;
      const actions = document.createElement('div'); actions.className = 'hero-walkthrough-coach-actions';
      const next = document.createElement('button'); next.type = 'button'; next.textContent = nextStep ? 'گام بعد' : 'پایان Walk-Through';
      const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = 'گام قبل'; previous.disabled = !previousStep; previous.addEventListener('click', () => moveWalkthrough(-1));
      const completion = document.createElement('span'); completion.className = 'hero-walkthrough-completion'; completion.setAttribute('aria-live', 'polite');
      const recheck = document.createElement('button'); recheck.type = 'button'; recheck.textContent = 'بازخوانی وضعیت'; recheck.setAttribute('aria-label', 'بازخوانی معیار تکمیل همین گام');
      const moveSide = document.createElement('button'); moveSide.type = 'button';
      const consultation = document.createElement('button'); consultation.type = 'button'; consultation.textContent = 'مشاوره'; consultation.setAttribute('aria-label', 'باز کردن مشاورهٔ AI برای این گام');
      const minimize = document.createElement('button'); minimize.type = 'button'; minimize.textContent = 'کمینه‌سازی'; minimize.setAttribute('aria-label', 'کمینه‌سازی راهنمای Walk-Through');
      const guide = document.createElement('a'); guide.href = guideHref(projectIdForGuide); guide.textContent = 'بازگشت به راهنمای کامل';
      const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = 'بستن کامل Walk-Through فعال'; dismiss.addEventListener('click', () => stopWalkthrough('closed-by-user'));
      actions.append(next, previous, recheck, consultation, moveSide, minimize, guide, dismiss); coach.append(progress, title, summary, completion, actions);
      coach._heroWalkthroughTarget = target;
      coach._heroWalkthroughPreviousDescription = target.getAttribute('aria-describedby');
      coach._heroWalkthroughAddedTabIndex = !target.hasAttribute('tabindex');
      if (coach._heroWalkthroughAddedTabIndex) target.setAttribute('tabindex', '-1');
      target.setAttribute('aria-describedby', [coach._heroWalkthroughPreviousDescription, title.id].filter(Boolean).join(' '));
      const placeCoach = () => {
        if (!coach.isConnected) return;
        if (innerWidth <= 760) { coach.style.top = ''; return; }
        const edge = 12; const bubble = coach.getBoundingClientRect();
        coach.style.top = Math.round(Math.max(edge, Math.min(92, innerHeight - bubble.height - edge))) + 'px';
      };
      const applyCoachSide = side => {
        coachSide = side; coach.dataset.heroWalkthroughSide = side;
        moveSide.textContent = side === 'right' ? 'انتقال به لبهٔ چپ' : 'انتقال به لبهٔ راست';
        moveSide.setAttribute('aria-label', moveSide.textContent);
        setPreferredSide(walkthroughCoachSideKey, side);
        schedulePlacement();
        activeWalkthroughAdvisor?._heroWalkthroughReposition?.();
      };
      moveSide.addEventListener('click', () => applyCoachSide(coachSide === 'right' ? 'left' : 'right'));
      minimize.addEventListener('click', () => { setCoachMinimized(true); clearWalkthroughCoach({ preserveLauncher: true }); showWalkthroughLauncher(active); });
      let placementFrame = null;
      const schedulePlacement = () => {
        if (placementFrame !== null) return;
        placementFrame = requestAnimationFrame(() => { placementFrame = null; placeCoach(); });
      };
      const requiresRecordedCompletion = new Set(['identity', 'project-selection', 'foundation', 'settings']);
      // These are genuine product-delivery gates, not presentation steps. The
      // guide must remain honest and cannot mark them complete before the
      // corresponding execution/evidence capability exists.
      const unavailableExecutionSteps = new Set(['team-research', 'live-execution', 'test-delivery', 'production']);
      if ((!nextStep && unavailableExecutionSteps.has(currentStep.id)) || (nextStep && (requiresRecordedCompletion.has(currentStep.id) || unavailableExecutionSteps.has(currentStep.id)))) next.disabled = true;
      const checkRecordedCompletion = async () => {
        if (unavailableExecutionSteps.has(currentStep.id)) {
          const messages = {
            'team-research': 'این مرحله هنوز اجرای تحقیق و گفت‌وگوی پایدار تیمی ندارد؛ Walk-Through در همین گیت متوقف می‌ماند تا قابلیت و Evidence واقعی فراهم شود.',
            'live-execution': 'اتصال زندهٔ Provider، GitHub و Server هنوز گیت‌شده است. بدون Credential، مجوز هزینه و Approval مستقل، راهنما به تحویل واقعی پیش نمی‌رود.',
            'test-delivery': 'Release، Artifact و آزمون بازیابی روی مقصد پاک هنوز عملیاتی نشده‌اند؛ تا Evidence واقعی ثبت نشود، راهنما این گام را کامل اعلام نمی‌کند.',
            production: 'Production عمداً پایان خودکار Walk-Through نیست. تا Evidence Test، portability، backup/restore و Approval جداگانه فراهم نشود، این گیت باز می‌ماند.'
          };
          completion.textContent = messages[currentStep.id]; next.disabled = true; return false;
        }
        if (!nextStep || !requiresRecordedCompletion.has(currentStep.id)) { completion.textContent = currentStep.completion === 'gated' || currentStep.availability === 'partial' ? 'این گام وضعیت یا گیت را نشان می‌دهد؛ اجرای واقعی جداگانه مجاز می‌شود.' : ''; next.disabled = false; return true; }
        next.disabled = true; completion.textContent = 'در حال خواندن معیار تکمیل از دادهٔ واقعی…';
        try {
          if (currentStep.id === 'project-selection') {
            const selected = stateProjectId(readWalkthroughState());
            if (!selected) { completion.textContent = 'برای ادامه، یک پروژه را از Portfolio انتخاب کنید.'; return false; }
            completion.textContent = 'پروژهٔ فعال انتخاب شده است.'; next.disabled = false; return true;
          }
          if (currentStep.id === 'identity') {
            const response = await fetch('/api/identity/me', { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) { completion.textContent = 'برای ادامه، ابتدا ورود انسانی و MFA را کامل کنید.'; return false; }
            completion.textContent = 'نشست انسانی معتبر است.'; next.disabled = false; return true;
          }
          const scopedProjectId = stateProjectId(readWalkthroughState());
          if (!scopedProjectId) { completion.textContent = 'Scope پروژه انتخاب نشده است؛ به Portfolio برگردید.'; return false; }
          const response = await fetch('/api/projects/' + encodeURIComponent(scopedProjectId) + '/workspace-overview', { credentials: 'same-origin', cache: 'no-store' });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.message || body.code || 'دادهٔ پروژه خوانده نشد.');
          const overview = body.overview || {}; const foundation = overview.foundationProposal || {};
          const complete = currentStep.id === 'foundation' ? foundation.state === 'approved'
            : currentStep.id === 'settings' ? Array.isArray(overview.settings) && overview.settings.some(item => item.path !== 'backoffice.walkthrough.enabled')
              : true;
          if (!complete) { const labels = { foundation: 'Foundation را تأیید یا بازنگری کنید تا وضعیت واقعی آن به‌روز شود.', settings: 'حداقل یک تنظیم نسخه‌دار پروژه ثبت کنید.' }; completion.textContent = labels[currentStep.id] || 'این گام هنوز کامل نشده است.'; return false; }
          completion.textContent = 'معیار تکمیل از دادهٔ واقعی این پروژه تأیید شد.'; next.disabled = false; return true;
        } catch (error) { completion.textContent = error.message || 'بازخوانی معیار تکمیل ناموفق بود.'; return false; }
        finally { schedulePlacement(); }
      };
      recheck.addEventListener('click', () => { void checkRecordedCompletion(); });
      next.addEventListener('click', () => {
        if (unavailableExecutionSteps.has(currentStep.id)) { void checkRecordedCompletion(); return; }
        if (!nextStep || !requiresRecordedCompletion.has(currentStep.id)) { moveWalkthrough(1); return; }
        void checkRecordedCompletion().then(complete => { if (complete) moveWalkthrough(1); });
      });
      const cleanup = () => { if (placementFrame !== null) cancelAnimationFrame(placementFrame); window.removeEventListener('resize', schedulePlacement); };
      coach._heroWalkthroughCleanup = cleanup;
      document.body.append(coach); target.classList.add('hero-walkthrough-target'); activeWalkthroughCoach = coach;
      window.addEventListener('resize', schedulePlacement);
      target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      applyCoachSide(coachSide);
      requestAnimationFrame(() => { placeCoach(); coach.style.visibility = 'visible'; coach.focus({ preventScroll: true }); void checkRecordedCompletion(); });
      const openAdvisor = () => {
        if (activeWalkthroughAdvisor?.isConnected) { activeWalkthroughAdvisor.focus({ preventScroll: true }); return; }
        clearWalkthroughAdvisor();
        let advisorSide = preferredSide(walkthroughAdvisorSideKey, coachSide === 'right' ? 'left' : 'right');
        const advisor = document.createElement('aside'); advisor.className = 'hero-walkthrough-advisor'; advisor.dataset.heroWalkthroughAdvisor = currentStep.id; advisor.dataset.heroWalkthroughSide = advisorSide; advisor.setAttribute('role', 'dialog'); advisor.setAttribute('aria-modal', 'false'); advisor.setAttribute('tabindex', '-1'); advisor.style.visibility = 'hidden';
        advisor.setAttribute('aria-label', 'گفت‌وگوی مشاورهٔ Walk-Through');
        const selectorWrap = document.createElement('label'); selectorWrap.className = 'hero-walkthrough-advisor-selector'; selectorWrap.textContent = 'AI و نسخه';
        const selector = document.createElement('select'); selector.name = 'advisorProfileId'; selector.setAttribute('aria-label', 'انتخاب AI و نسخه برای مشاورهٔ Walk-Through');
        const localOption = document.createElement('option'); localOption.value = 'local'; localOption.textContent = 'راهنمای محلی Hero · بدون هزینه'; selector.append(localOption); selectorWrap.append(selector);
        const conversation = document.createElement('section'); conversation.className = 'hero-walkthrough-advisor-messages'; conversation.setAttribute('aria-live', 'polite'); conversation.setAttribute('aria-label', 'گفت‌وگوی مشاور');
        const status = document.createElement('span'); status.className = 'hero-walkthrough-advisor-status';
        const form = document.createElement('form'); const question = document.createElement('textarea'); question.name = 'question'; question.maxLength = 1500; question.placeholder = 'پرسش خود را دربارهٔ همین گام بنویسید.'; question.setAttribute('aria-label', 'پرسش برای مشاور AI');
        const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'ارسال پرسش';
        const closeAdvisor = document.createElement('button'); closeAdvisor.type = 'button'; closeAdvisor.textContent = 'بستن'; closeAdvisor.setAttribute('aria-label', 'بستن پنجرهٔ مشاوره');
        const formActions = document.createElement('div'); formActions.className = 'hero-walkthrough-advisor-actions'; formActions.append(submit, closeAdvisor); form.append(question, formActions);
        advisor.append(selectorWrap, conversation, status, form);
        const appendAdvisorMessage = (speaker, value) => { const message = document.createElement('article'); message.className = 'hero-walkthrough-advisor-message'; message.dataset.speaker = speaker; const label = document.createElement('b'); label.textContent = speaker === 'user' ? 'شما' : 'مشاور'; const text = document.createElement('span'); text.textContent = value; message.append(label, text); conversation.append(message); conversation.scrollTop = conversation.scrollHeight; };
        const renderAdvisorMessage = text => appendAdvisorMessage('assistant', text);
        const placeAdvisor = () => {
          if (!advisor.isConnected) return;
          if (innerWidth <= 760) { advisor.style.top = ''; return; }
          const edge = 12; const bubble = advisor.getBoundingClientRect(); const coachRect = coach.isConnected ? coach.getBoundingClientRect() : null;
          const preferredTop = coachRect && advisorSide === coachSide ? coachRect.bottom + 12 : 92;
          advisor.style.top = Math.round(Math.max(edge, Math.min(preferredTop, innerHeight - bubble.height - edge))) + 'px';
        };
        let advisorPlacementFrame = null;
        const scheduleAdvisorPlacement = () => { if (advisorPlacementFrame !== null) return; advisorPlacementFrame = requestAnimationFrame(() => { advisorPlacementFrame = null; placeAdvisor(); }); };
        const applyAdvisorSide = side => { advisorSide = side; advisor.dataset.heroWalkthroughSide = side; setPreferredSide(walkthroughAdvisorSideKey, side); scheduleAdvisorPlacement(); };
        // A Walk-Through advisor is a Back Office service preference, rather
        // than a property of the currently open project.  Project-level
        // binding/scope/cost gates are still verified separately at dispatch.
        const advisorSelectionStorageKey = 'hero.advisor.selection.walkthrough-guide.v1';
        const restoreAdvisorSelection = () => { try { const saved = localStorage.getItem(advisorSelectionStorageKey); if (saved && Array.from(selector.options).some(option => option.value === saved && !option.disabled)) selector.value = saved; } catch { /* default local advisor remains available */ } };
        const saveAdvisorSelection = () => { try { localStorage.setItem(advisorSelectionStorageKey, selector.value); } catch { /* preference is optional */ } };
        const loadAdvisorOptions = async () => {
          if (!projectIdForGuide) return;
          const response = await fetch('/api/projects/' + encodeURIComponent(projectIdForGuide) + '/walkthrough-advisor/options', { credentials: 'same-origin', cache: 'no-store' });
          const body = await response.json().catch(() => null);
          if (!response.ok) throw new Error(apiErrorMessage(response, body, 'فهرست AIهای قابل‌استفاده دریافت نشد'));
          const options = body?.advisorOptions || {};
          for (const profile of Array.isArray(options.profiles) ? options.profiles : []) {
            const option = document.createElement('option'); option.value = profile.profileId;
            option.textContent = (profile.providerName || profile.providerId) + ' / ' + (profile.modelName || profile.modelId) + ' · v' + (profile.profileVersion || '?') + (profile.selectable ? (profile.dispatchReady === false ? ' · مجوز سراسری Test آماده نیست' : '') : ' · آماده نیست');
            option.title = profile.selectionNotice || '';
            option.disabled = profile.selectable !== true;
            selector.append(option);
          }
          restoreAdvisorSelection();
        };
        selector.addEventListener('change', saveAdvisorSelection);
        const askAdvisor = async rawQuestion => {
          submit.disabled = true; status.dataset.state = ''; status.textContent = 'در حال تحلیل پرسش در زمینهٔ همین گام…';
          if (rawQuestion) appendAdvisorMessage('user', rawQuestion);
          try {
            const endpoint = new URL('/api/walkthrough/advice', location.origin);
            if (projectIdForGuide) endpoint.searchParams.set('projectId', projectIdForGuide);
            const response = await fetch(endpoint.pathname + endpoint.search, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stepId: currentStep.id, projectId: projectIdForGuide, advisorProfileId: selector.value === 'local' ? null : selector.value, question: rawQuestion }) });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error(apiErrorMessage(response, body, 'مشاوره در دسترس نیست'));
            const advisorResponse = body?.advisor || {};
            renderAdvisorMessage(advisorResponse.response || 'برای این گام پاسخ قابل‌نمایش وجود ندارد.');
            status.textContent = advisorResponse.providerInvoked === true ? 'پاسخ زنده با Provider انتخابی تولید شد؛ مصرف حسابداری‌شده: ' + (advisorResponse?.invocation?.costUnits ?? '—') + ' واحد.' : '';
          } catch (error) {
            renderAdvisorMessage('مشاوره اجرا نشد: ' + (error.message || 'پاسخ در دسترس نیست.')); status.dataset.state = 'error'; status.textContent = error.message || 'پاسخ در دسترس نیست.';
          } finally { submit.disabled = false; scheduleAdvisorPlacement(); }
        };
        form.addEventListener('submit', event => { event.preventDefault(); const text = question.value.trim(); if (!text) { question.focus(); status.dataset.state = 'error'; status.textContent = 'ابتدا پرسش خود را بنویسید.'; return; } question.value = ''; askAdvisor(text); });
        closeAdvisor.addEventListener('click', () => { clearWalkthroughAdvisor(); consultation.focus({ preventScroll: true }); });
        advisor._heroWalkthroughReposition = scheduleAdvisorPlacement;
        advisor._heroWalkthroughCleanup = () => { if (advisorPlacementFrame !== null) cancelAnimationFrame(advisorPlacementFrame); window.removeEventListener('resize', scheduleAdvisorPlacement); };
        document.body.append(advisor); activeWalkthroughAdvisor = advisor; window.addEventListener('resize', scheduleAdvisorPlacement); applyAdvisorSide(advisorSide); requestAnimationFrame(() => { placeAdvisor(); advisor.style.visibility = 'visible'; question.focus({ preventScroll: true }); });
        void loadAdvisorOptions().catch(error => { status.dataset.state = 'error'; status.textContent = error.message || 'فهرست AIها دریافت نشد؛ راهنمای محلی همچنان قابل استفاده است.'; });
      };
      consultation.addEventListener('click', openAdvisor);
    };
    // Project surfaces can render targets asynchronously and replace cards on
    // refresh. Coalesce those mutations into one retry: the fixed coach stays
    // outside normal layout and cannot make the surface move or flicker.
    let walkthroughInstallFrame = null;
    const scheduleWalkthroughCoachInstall = () => {
      if (walkthroughInstallFrame !== null) return;
      walkthroughInstallFrame = requestAnimationFrame(() => {
        walkthroughInstallFrame = null;
        installWalkthroughCoach();
      });
    };
    const walkthroughTargetObserver = new MutationObserver(() => {
      if (readWalkthroughState()?.active) scheduleWalkthroughCoachInstall();
    });
    walkthroughTargetObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'data-hero-guide-target']
    });
    window.addEventListener('pageshow', scheduleWalkthroughCoachInstall);
    window.addEventListener('popstate', scheduleWalkthroughCoachInstall);
    window.addEventListener('hero-walkthrough-targets-changed', scheduleWalkthroughCoachInstall);
    window.addEventListener('storage', event => {
      if (event.key === walkthroughOwnerDismissedKey && event.newValue === 'true') {
        setCoachMinimized(false); clearWalkthroughCoach(); return;
      }
      if (event.key === walkthroughStateKey) {
        if (!readWalkthroughState()?.active) { setCoachMinimized(false); clearWalkthroughCoach(); return; }
        scheduleWalkthroughCoachInstall(); return;
      }
      if (event.key?.startsWith(walkthroughServicePrefix)) scheduleWalkthroughCoachInstall();
    });
    const ownerWalkthroughDismissed = () => { try { return localStorage.getItem(walkthroughOwnerDismissedKey) === 'true'; } catch { return false; } };
    const consumeOwnerWalkthroughLogin = () => { try { const pending = sessionStorage.getItem(walkthroughOwnerLoginKey) === 'true'; sessionStorage.removeItem(walkthroughOwnerLoginKey); return pending; } catch { return false; } };
    const activateDefaultWalkthroughForOwner = async () => {
      const loginJustCompleted = consumeOwnerWalkthroughLogin();
      if (ownerWalkthroughDismissed()) return;
      try {
        const response = await fetch('/api/identity/me', { credentials: 'same-origin', cache: 'no-store' });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.principal?.role !== 'project-owner') return;
        const current = readWalkthroughState();
        if (current?.active && !loginJustCompleted) { scheduleWalkthroughCoachInstall(); return; }
        const initial = { active: true, status: 'active', stepId: 'project-selection', projectId: null, startedAt: Date.now() };
        setCoachMinimized(false); writeWalkthroughState(initial);
        if (currentWalkthroughSurface() !== 'portfolio') { location.assign(routeForWalkthroughStep(initial.stepId)); return; }
        scheduleWalkthroughCoachInstall();
      } catch { /* unauthenticated and degraded surfaces must remain usable */ }
    };
    scheduleWalkthroughCoachInstall();
    void activateDefaultWalkthroughForOwner();
  })();</script>`;
}
