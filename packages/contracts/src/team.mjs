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
    principles: ["مالک فلو و کیفیت است", "جایگزین قضاوت تخصصی تیم‌ها نمی‌شود", "ابهام را قبل از dispatch آشکار می‌کند"],
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
    principles: ["خلاقیت به مسئله و شواهد متصل است", "ایده با واقعیت اشتباه گرفته نمی‌شود", "گزینه‌ها قابل مقایسه ارائه می‌شوند"],
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
    principles: ["واقعیت، فرض و نظر جدا هستند", "منبع شواهد ثبت می‌شود", "ابهام مهم به مالک ارجاع می‌شود"],
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
    principles: ["دامنه قابل تحویل است", "هر نیازمندی معیار پذیرش دارد", "تصمیم محصول نسخه‌دار و قابل بازگشت است"],
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
    principles: ["هر طرح به نیازمندی و معیار پذیرش متصل است", "قابل استفاده‌بودن بر تزئین مقدم است", "تصمیم‌های طراحی قابل بازبینی‌اند"],
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
    principles: ["تصمیم فنی مستند و قابل دفاع است", "مرزها جایگزین coupling پنهان می‌شوند", "ریسک زود آشکار می‌شود"],
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
    principles: ["کد خوانا و قابل نگهداری است", "هر تغییر قابل بازبینی و ردیابی است", "کد بدون تست و شواهد تحویل نمی‌شود"],
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
    principles: ["نتیجه قابل بازتولید است", "تست به معیار پذیرش وصل است", "ریسک مهم با حدس بسته نمی‌شود"],
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
    principles: ["یافته بحرانی مانع انتشار است", "حداقل دسترسی رعایت می‌شود", "Secret در کد، لاگ یا Sheet ثبت نمی‌شود"],
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
    principles: ["Production جداگانه و قابل بازگشت است", "عملیات حساس گیت جدا دارد", "بازیابی با شواهد واقعی اثبات می‌شود"],
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
    principles: ["تعریف سنجه و منبع روشن است", "کیفیت داده بررسی می‌شود", "داده و مدل نسخه‌دار و قابل ممیزی‌اند"],
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
    output: "خروجی قراردادی، شواهد کیفیت، وضعیت، ریسک و درخواست بازکاری",
    humanControl: "مالک پروژه می‌تواند هر قرارداد، ورودی، خروجی و سیاست همکاری را تأیید، رد یا برای بازکاری برگرداند.",
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
