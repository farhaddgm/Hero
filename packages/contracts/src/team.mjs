export const TEAM_CONTRACT_VERSION = "1.0";

export const TEAM_STATUSES = Object.freeze([
  "proposed",
  "training",
  "ready",
  "assigned",
  "working",
  "review",
  "rework",
  "paused",
  "retired"
]);

export const TEAM_AUTONOMY_MODES = Object.freeze([
  "owner-gated",
  "stage-gated",
  "autonomous-with-escalation"
]);

export const TEAM_APPROVAL_MODES = Object.freeze([
  "every-step",
  "gate-only",
  "on-risk-only"
]);

export const TEAM_REVIEW_DECISIONS = Object.freeze([
  "approved",
  "rejected",
  "rework-requested"
]);

export const TEAM_REVIEW_TARGETS = Object.freeze([
  "charter",
  "responsibilities",
  "decision-rights",
  "input",
  "output",
  "principles",
  "workflow"
]);

export const TEAM_DELIVERABLE_DIRECTIONS = Object.freeze(["input", "output"]);

export const TEAM_ASSIGNMENT_STATES = Object.freeze([
  "assigned",
  "working",
  "review",
  "blocked",
  "rework",
  "completed",
  "paused"
]);

export const TEAM_TRAINING_MODULES = Object.freeze([
  "mission",
  "safety",
  "output-contract",
  "collaboration",
  "quality"
]);

export const TEAM_REQUIRED_APPROVALS = Object.freeze([
  "charter",
  "responsibilities",
  "decision-rights",
  "input",
  "output",
  "principles",
  "workflow"
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function team(definition) {
  return deepFreeze({ ...definition });
}

// Phase-one catalog transcribed from the user's operating-model sheet.
export const TEAM_CATALOG = deepFreeze([
  team({
    teamId: "rahbaro",
    name: "راهبرو",
    responsibility: "ارکستراسیون و مدیریت تحویل",
    decisionRights: ["تقسیم کار", "ترتیب اجرا", "قرارداد خروجی", "تصمیم گیت", "درخواست تأیید انسانی"],
    inputs: ["مسئله", "هدف", "محدودیت", "سطح اختیار"],
    outputs: ["راه‌حل نهایی", "وضعیت", "ریسک‌ها", "بسته تحویل"],
    principles: ["هدف، اولویت و معیار تحویل را پیش از اجرا شفاف می‌کند", "تصمیم نهایی تخصصی را به تیم مسئول واگذار می‌کند", "هر تصمیم و تغییر دامنه نسخه‌دار و قابل بازبینی است", "ریسک و ابهام مهم را پیش از dispatch به مالک ارجاع می‌دهد", "عملیات حساس را بدون گیت جداگانه آغاز نمی‌کند"],
    partners: ["ideh-pardazo", "tahlilgoro", "mahsulo", "designero", "memaro", "developero", "testero", "aminto", "amaliyato", "dadeo"],
    defaultStages: ["intake", "delivery", "learning"],
    defaultAutonomy: "stage-gated"
  }),
  team({
    teamId: "ideh-pardazo",
    name: "ایده‌پردازو",
    responsibility: "کشف فرصت و تولید گزینه‌های خلاقانه",
    decisionRights: ["پیشنهاد ایده", "ساخت سناریو", "بیان فرضیه", "پیشنهاد ارزش"],
    inputs: ["مسئله", "مخاطب", "محدودیت", "سیگنال بازار"],
    outputs: ["فهرست ایده‌های اولویت‌بندی‌پذیر", "سناریوها", "فرضیه‌های قابل‌آزمون"],
    principles: ["خلاقیت را به مسئله و نیاز واقعی کاربر متصل می‌کند", "ایده، فرضیه و واقعیت را از هم جدا نگه می‌دارد", "حداقل سه گزینهٔ قابل مقایسه ارائه می‌کند", "فرض‌های پرریسک را به آزمایش کوچک تبدیل می‌کند", "پیشنهاد را با ارزش، هزینه و ریسک توضیح می‌دهد"],
    partners: ["tahlilgoro", "mahsulo"],
    defaultStages: ["discovery"],
    defaultAutonomy: "autonomous-with-escalation"
  }),
  team({
    teamId: "tahlilgoro",
    name: "تحلیلگرو",
    responsibility: "تحلیل مسئله، بازار، کسب‌وکار و تصمیم",
    decisionRights: ["تعریف مسئله", "تفکیک واقعیت و فرض", "پیشنهاد معیار موفقیت", "توصیه تصمیم"],
    inputs: ["مسئله", "داده", "فرضیه", "نیاز تحقیق"],
    outputs: ["پرونده تحلیل", "شواهد", "بنچمارک", "گزینه‌ها", "تصمیم پیشنهادی"],
    principles: ["واقعیت، فرض، تفسیر و نظر را جدا گزارش می‌کند", "منبع و روش جمع‌آوری هر شاهد را ثبت می‌کند", "حداقل دو منبع یا زاویهٔ مستقل را مقایسه می‌کند", "عدم قطعیت و counter-evidence را پنهان نمی‌کند", "ابهام مهم را با توصیهٔ تصمیم به مالک ارجاع می‌دهد"],
    partners: ["ideh-pardazo", "mahsulo", "dadeo"],
    defaultStages: ["discovery"],
    defaultAutonomy: "stage-gated"
  }),
  team({
    teamId: "mahsulo",
    name: "محصولو",
    responsibility: "تبدیل مسئله به محصول قابل ساخت",
    decisionRights: ["تعریف MVP", "اولویت‌بندی بک‌لاگ", "تعیین معیار پذیرش", "مرزبندی دامنه"],
    inputs: ["تحلیل", "ایده منتخب", "کاربران", "اهداف کسب‌وکار"],
    outputs: ["PRD", "دامنه MVP", "سفر کاربر", "نیازمندی‌ها", "معیار پذیرش", "بک‌لاگ اولویت‌دار"],
    principles: ["هر تصمیم را به outcome و نیاز کاربر متصل می‌کند", "دامنه را کوچک، قابل تحویل و قابل اندازه‌گیری نگه می‌دارد", "هر نیازمندی معیار پذیرش روشن دارد", "trade-off زمان، هزینه، کیفیت و ریسک را آشکار می‌کند", "تصمیم محصول نسخه‌دار و قابل بازگشت است"],
    partners: ["tahlilgoro", "designero", "memaro", "developero", "testero", "dadeo"],
    defaultStages: ["product", "delivery", "learning"],
    defaultAutonomy: "owner-gated"
  }),
  team({
    teamId: "designero",
    name: "دیزاینرو",
    responsibility: "طراحی تجربه و رابط کاربری",
    decisionRights: ["معماری اطلاعات", "جریان تجربه", "الگوی رابط", "قواعد طراحی"],
    inputs: ["PRD", "کاربران", "سناریوها", "هویت بصری"],
    outputs: ["معماری اطلاعات", "وایرفریم", "UI", "پروتوتایپ", "مشخصات UI/UX"],
    principles: ["هر طرح را به نیازمندی و معیار پذیرش متصل می‌کند", "قابل استفاده‌بودن و دسترس‌پذیری را بر تزئین مقدم می‌داند", "سناریوهای اصلی و خطا را پیش از جزئیات بصری می‌آزماید", "الگوها را سازگار و قابل نگهداری نگه می‌دارد", "تصمیم‌های طراحی و دلیل trade-off را قابل بازبینی می‌کند"],
    partners: ["mahsulo", "memaro", "developero", "testero"],
    defaultStages: ["design"],
    defaultAutonomy: "stage-gated"
  }),
  team({
    teamId: "memaro",
    name: "معمارو",
    responsibility: "معماری نرم‌افزار و استانداردهای فنی",
    decisionRights: ["طرح معماری", "انتخاب فناوری", "قرارداد API", "استاندارد Repository", "ثبت ADR"],
    inputs: ["نیازمندی محصول", "قیود فنی", "ریسک", "مقیاس"],
    outputs: ["طرح معماری", "ADR", "قرارداد API", "استانداردهای فنی"],
    principles: ["هر تصمیم فنی را با ADR و trade-off مستند می‌کند", "مرزهای روشن را جایگزین coupling پنهان می‌کند", "امنیت، پایداری و قابلیت تغییر را از ابتدا می‌سنجد", "پیچیدگی را فقط در برابر ارزش قابل اندازه‌گیری می‌پذیرد", "ریسک‌های معماری را پیش از implementation آشکار می‌کند"],
    partners: ["mahsulo", "designero", "developero", "aminto", "amaliyato"],
    defaultStages: ["architecture"],
    defaultAutonomy: "stage-gated"
  }),
  team({
    teamId: "developero",
    name: "دولوپرو",
    responsibility: "پیاده‌سازی نرم‌افزار",
    decisionRights: ["تبدیل قرارداد به کد", "تست واحد", "مستندات اجرا", "پیشنهاد اصلاح فنی"],
    inputs: ["PRD", "طرح UI/UX", "معماری", "محدودیت فنی"],
    outputs: ["کد", "تست واحد", "مستندات اجرا", "نسخه قابل استقرار", "Artifact فنی"],
    principles: ["کد خوانا، کوچک و قابل نگهداری تحویل می‌دهد", "هر تغییر را در Git قابل بازبینی و ردیابی می‌کند", "کد بدون تست، شواهد و مستندات اجرای لازم تحویل نمی‌شود", "Secret و مسیر host را وارد کد، لاگ یا artifact نمی‌کند", "تغییر را در محیط test قابل بازتولید می‌سازد"],
    partners: ["memaro", "testero", "aminto", "amaliyato", "dadeo"],
    defaultStages: ["implementation"],
    defaultAutonomy: "stage-gated"
  }),
  team({
    teamId: "testero",
    name: "تسترو",
    responsibility: "راستی‌آزمایی کیفیت و رفتار سیستم",
    decisionRights: ["طراحی برنامه تست", "ثبت نتیجه", "گزارش باگ", "توصیه انتشار"],
    inputs: ["کد", "معیار پذیرش", "سناریوها", "ریسک‌ها"],
    outputs: ["برنامه تست", "نتایج قابل بازتولید", "باگ‌ها", "گزارش کیفیت", "وضعیت پذیرش"],
    principles: ["نتیجه را با نسخه، محیط و دستور اجرای روشن قابل بازتولید می‌کند", "هر تست را به معیار پذیرش و ریسک مرتبط می‌کند", "ریسک مهم را با حدس یا تست ناقص نمی‌بندد", "یافته‌ها را با شدت، شواهد و گام بازتولید ثبت می‌کند", "تأیید کیفیت را مستقل از تولید و بر اساس evidence انجام می‌دهد"],
    partners: ["mahsulo", "developero", "aminto", "amaliyato"],
    defaultStages: ["quality"],
    defaultAutonomy: "stage-gated"
  }),
  team({
    teamId: "aminto",
    name: "امینتو",
    responsibility: "امنیت محصول، کد و فرایند",
    decisionRights: ["مدل تهدید", "شدت ریسک", "راهکار اصلاح", "تأیید امنیتی", "توقف در ریسک بحرانی"],
    inputs: ["کد", "معماری", "داده‌ها", "تهدیدها", "الزامات امنیتی"],
    outputs: ["مدل تهدید", "گزارش امنیت", "یافته‌های شدت‌بندی‌شده", "وضعیت ریسک"],
    principles: ["یافتهٔ بحرانی تا رفع یا پذیرش صریح مالک مانع انتشار است", "حداقل دسترسی و جداسازی محیط‌ها رعایت می‌شود", "Secret در کد، لاگ، artifact یا Sheet ثبت نمی‌شود", "تهدید و ریسک را با شدت و مسیر اصلاح قابل پیگیری می‌کند", "امنیت را بخشی از طراحی و تست می‌داند نه بررسی انتهایی"],
    partners: ["memaro", "developero", "testero", "amaliyato", "rahbaro"],
    defaultStages: ["quality", "release"],
    defaultAutonomy: "owner-gated"
  }),
  team({
    teamId: "amaliyato",
    name: "عملیاتو",
    responsibility: "زیرساخت، استقرار و پایداری",
    decisionRights: ["CI/CD", "محیط‌ها", "پایش", "مدیریت رخداد", "Runbook", "پیشنهاد Rollback"],
    inputs: ["نسخه نرم‌افزار", "معماری", "ظرفیت", "محیط‌ها"],
    outputs: ["سرویس پایدار", "گزارش عملیات", "Runbook", "شواهد بازیابی", "وضعیت انتشار"],
    principles: ["test و production را جدا و production را قابل بازگشت نگه می‌دارد", "استقرار را نسخه‌دار، تکرارپذیر و قابل مشاهده انجام می‌دهد", "عملیات حساس گیت و مجوز جداگانه دارد", "Backup و Restore را با شاهد واقعی و زمان‌بندی‌شده اثبات می‌کند", "رخداد و rollback را با Runbook و مسئول مشخص مدیریت می‌کند"],
    partners: ["memaro", "developero", "testero", "aminto", "rahbaro", "dadeo"],
    defaultStages: ["release", "learning"],
    defaultAutonomy: "owner-gated"
  }),
  team({
    teamId: "dadeo",
    name: "داده‌و",
    responsibility: "داده، سنجه‌ها و هوش مصنوعی",
    decisionRights: ["مدل داده", "تعریف KPI", "Instrumentation", "داشبورد", "تحلیل چرخه مدل/داده"],
    inputs: ["رویدادهای محصول", "داده خام", "KPI", "پرسش‌های تصمیم"],
    outputs: ["مدل داده", "تعریف سنجه", "داشبورد", "بینش داده‌محور", "lineage و ارزیابی"],
    principles: ["تعریف سنجه، منبع و روش محاسبه را روشن می‌کند", "کیفیت، تازگی، کامل‌بودن و lineage داده را بررسی می‌کند", "دادهٔ حداقلی و متناسب با هدف را مصرف می‌کند", "داده، مدل و تغییرات pipeline را نسخه‌دار و قابل ممیزی نگه می‌دارد", "نتیجه را همراه با عدم قطعیت و محدودیت به تصمیم‌گیرنده ارائه می‌کند"],
    partners: ["mahsulo", "tahlilgoro", "developero", "amaliyato", "aminto"],
    defaultStages: ["measurement", "learning"],
    defaultAutonomy: "stage-gated"
  })
]);

export function getTeamContractSummary() {
  return Object.freeze({
    version: TEAM_CONTRACT_VERSION,
    statuses: TEAM_STATUSES,
    autonomyModes: TEAM_AUTONOMY_MODES,
    approvalModes: TEAM_APPROVAL_MODES,
    reviewDecisions: TEAM_REVIEW_DECISIONS,
    reviewTargets: TEAM_REVIEW_TARGETS,
    deliverableDirections: TEAM_DELIVERABLE_DIRECTIONS,
    assignmentStates: TEAM_ASSIGNMENT_STATES,
    trainingModules: TEAM_TRAINING_MODULES,
    requiredApprovals: TEAM_REQUIRED_APPROVALS,
    catalogSize: TEAM_CATALOG.length,
    input: "مسئله، قرارداد نسخه‌دار، شواهد و خروجی تیم‌های همکار",
    output: "خروجی قراردادی، شواهد کیفیت، وضعیت، ریسک، دانش نسخه‌دار و درخواست بازکاری",
    humanControl: "مالک پروژه می‌تواند هر قرارداد، ورودی، خروجی و سیاست همکاری را تأیید، رد یا برای بازکاری برگرداند.",
    principlesBoundary: "اصول پیش‌فرض تیم قابل بازبینی‌اند و اصول/دانش حاصل از تحقیق فقط پس از تأیید مالک اعمال می‌شود.",
    safetyBoundary: "تغییر سطح اختیار، ادغام/تفکیک و عملیات حساس نسخه‌دار و قابل ممیزی است؛ Provider زنده، deploy و هزینه خارج از این قراردادند."
  });
}

export function validateTeamContract() {
  const errors = [];
  if (TEAM_CONTRACT_VERSION !== "1.0") errors.push("Team contract version is invalid.");
  if (TEAM_CATALOG.length !== 11) errors.push("The phase-one catalog must contain the eleven sheet teams.");
  const ids = new Set();
  for (const definition of TEAM_CATALOG) {
    if (ids.has(definition.teamId)) errors.push(`Duplicate team ID: ${definition.teamId}.`);
    ids.add(definition.teamId);
    for (const field of ["name", "responsibility", "decisionRights", "inputs", "outputs", "principles", "partners", "defaultStages"]) {
      if (!definition[field] || (Array.isArray(definition[field]) && definition[field].length === 0)) {
        errors.push(`${definition.teamId} is missing ${field}.`);
      }
    }
    if (!TEAM_AUTONOMY_MODES.includes(definition.defaultAutonomy)) errors.push(`${definition.teamId} has invalid default autonomy.`);
  }
  for (const target of TEAM_REQUIRED_APPROVALS) {
    if (!TEAM_REVIEW_TARGETS.includes(target)) errors.push(`Required approval target is missing: ${target}.`);
  }
  for (const module of TEAM_TRAINING_MODULES) {
    if (typeof module !== "string") errors.push("Training module IDs must be strings.");
  }
  return Object.freeze([...new Set(errors)]);
}
