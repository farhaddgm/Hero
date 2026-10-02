import { FormSuggestionsError } from "./form-suggestions.mjs";

export const PROJECT_INTAKE_ADVISOR_VERSION = "1.0.0";
export const PROJECT_INTAKE_ADVISOR_FIRST_FIELDS = Object.freeze(["projectId", "name", "description", "goal", "users"]);
export const PROJECT_INTAKE_ADVISOR_REMAINING_FIELDS = Object.freeze(["projectType", "riskLevel", "autonomy", "constraints", "expectedOutputs", "riskAnswers"]);

const PROJECT_ID = /^[a-z][a-z0-9-]{2,62}$/;
const SENSITIVE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|passwd|secret|credential|token|api[._-]?key|رمز|کلید\s*api)\s*[:=])/iu;
const WEB_TERMS = /(?:وب(?:سایت|\s*سایت)?|website|site|صفحه|landing|cms|بلاگ|blog)/iu;
const PERSONAL_TERMS = /(?:شخصی|personal|portfolio|معرفی\s*من|رزومه)/iu;
const CONTACT_TERMS = /(?:تماس|ارتباط|contact)/iu;

export class ProjectIntakeAdvisorError extends FormSuggestionsError {}

function copy(value) { return Object.freeze(structuredClone(value)); }

function safeText(label, value, { minimum = 0, maximum = 700, required = false } = {}) {
  const normalized = String(value ?? "").replace(/\s+/gu, " ").trim();
  if ((required && normalized.length < minimum) || normalized.length > maximum || SENSITIVE.test(normalized)) {
    throw new ProjectIntakeAdvisorError("PROJECT_INTAKE_ADVISOR_INPUT_INVALID", `${label} is invalid.`);
  }
  return normalized;
}

function assertActor(actor) {
  const kind = actor?.actor?.kind ?? actor?.kind ?? (actor?.role === "admin" ? "admin" : actor?.role === "project-owner" ? "project-owner" : null);
  if (!["project-owner", "admin"].includes(kind)) throw new ProjectIntakeAdvisorError("PROJECT_INTAKE_ADVISOR_ADMIN_REQUIRED", "Advisor requires a project owner or admin session.", 403);
}

function normalizeFirstFive(input = {}) {
  const source = input.firstFive ?? input;
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new ProjectIntakeAdvisorError("PROJECT_INTAKE_ADVISOR_INPUT_INVALID", "firstFive must be an object.");
  const projectId = safeText("projectId", source.projectId, { minimum: 3, maximum: 63, required: true });
  if (!PROJECT_ID.test(projectId)) throw new ProjectIntakeAdvisorError("PROJECT_INTAKE_ADVISOR_PROJECT_ID_INVALID", "projectId must be a lower-case stable slug.");
  return Object.freeze({
    projectId,
    name: safeText("name", source.name, { minimum: 2, maximum: 120, required: true }),
    description: safeText("description", source.description, { maximum: 1_000 }),
    goal: safeText("goal", source.goal, { minimum: 2, maximum: 500, required: true }),
    users: safeText("users", source.users, { minimum: 2, maximum: 500, required: true })
  });
}

function answerMap({ internetFacing = "unknown", personalData = "unknown", regulatedData = "unknown", securitySensitive = "no", externalIntegrations = "unknown", requiresPrivilegedAccess = "no" } = {}) {
  return Object.freeze({ internetFacing, personalData, regulatedData, securitySensitive, externalIntegrations, requiresPrivilegedAccess });
}

function hasCms(context) { return /\bcms\b|مدیریت\s*محتوا/iu.test(`${context.description} ${context.goal}`); }
function isWeb(context) { return WEB_TERMS.test(`${context.name} ${context.description} ${context.goal}`); }
function isPersonal(context) { return PERSONAL_TERMS.test(`${context.description} ${context.goal} ${context.users}`); }
function hasContact(context) { return CONTACT_TERMS.test(`${context.description} ${context.goal}`); }

function baseConstraints(context) {
  const constraints = [];
  if (isWeb(context)) constraints.push("نسخهٔ نخست روی وب و طراحی واکنش‌گرا متمرکز باشد.");
  if (hasCms(context)) constraints.push("ویرایش محتوا از طریق CMS انجام شود؛ دسترسی مدیریت در Foundation مشخص می‌شود.");
  if (isPersonal(context)) constraints.push("لحن و هویت بصری شخصی، مدرن و خوانا بماند.");
  constraints.push("هر اتصال بیرونی، دادهٔ شخصی یا انتشار عمومی پیش از اجرا جداگانه بازبینی شود.");
  return constraints;
}

function baseOutputs(context) {
  const outputs = [];
  if (isWeb(context)) outputs.push("وب‌سایت واکنش‌گرا و قابل استفاده روی موبایل و دسکتاپ");
  if (isPersonal(context)) outputs.push("صفحهٔ معرفی شخصی با محتوای قابل ویرایش");
  if (hasContact(context)) outputs.push("صفحهٔ راه‌های ارتباط و تماس با متن قابل ویرایش");
  if (hasCms(context)) outputs.push("CMS با راهنمای مختصر و بازبینی دسترسی‌ها");
  outputs.push("تست‌های پایه و گزارش پذیرش قابل بازبینی");
  return outputs;
}

function proposal(context, variant, feedback = "") {
  const web = isWeb(context);
  const personal = isPersonal(context);
  const contact = hasContact(context);
  const cms = hasCms(context);
  const labels = ["مسیر کم‌دامنه", "مسیر استاندارد شخصی", "مسیر آمادهٔ توسعه"];
  const constraints = baseConstraints(context);
  const expectedOutputs = baseOutputs(context);
  const riskAnswers = answerMap({
    internetFacing: web ? "yes" : "unknown",
    // A personal web presence commonly grows into a contact channel. Until
    // the page design confirms that no visitor data is collected, preserve
    // that uncertainty instead of proposing a confident "no".
    personalData: (contact || (web && personal)) ? "unknown" : "no",
    externalIntegrations: cms ? "unknown" : "no"
  });
  if (variant === 0) {
    constraints.push("دامنهٔ نسخهٔ نخست محدود بماند و قابلیت‌های جانبی به Roadmap بعدی منتقل شوند.");
    expectedOutputs.push("فهرست روشنِ موارد خارج از دامنهٔ نسخهٔ نخست");
  }
  if (variant === 1) {
    constraints.push("ساختار محتوا برای افزودن صفحه‌ها در آینده قابل گسترش باشد.");
    expectedOutputs.push("مدل محتوای ساده برای بخش‌های معرفی و تماس");
  }
  if (variant === 2) {
    constraints.push("از ابتدا استانداردهای دسترس‌پذیری و سئو پایه بررسی شوند.");
    expectedOutputs.push("چک‌لیست دسترس‌پذیری، سئو پایه و مسیر توسعهٔ بعدی");
  }
  if (feedback) constraints.push(`بازخورد ادمین برای بازبینی: ${feedback}`);
  const focus = variant === 0
    ? "کمترین مجموعهٔ قابل‌استفاده را برای رسیدن سریع به یک وب‌سایت تمیز و قابل بازبینی پیشنهاد می‌کند."
    : variant === 1
      ? "تعادل میان طراحی مدرن، CMS ساده و امکان تکمیل محتوا را هدف می‌گیرد."
      : "پایه‌ای آماده‌تر برای رشد بعدی می‌سازد، اما هنوز همهٔ اقدام‌ها را در Foundation و گیت‌های بعدی نگه می‌دارد.";
  const personalNote = personal ? " برای یک هویت شخصی طراحی شده است." : " برای مخاطبان تعریف‌شده طراحی شده است.";
  return Object.freeze({
    proposalId: `intake-${variant + 1}`,
    title: labels[variant],
    rationale: `${focus}${personalNote} این پیشنهاد هیچ پروژه، دسترسی یا انتشار جدیدی ثبت نمی‌کند.`,
    values: Object.freeze({
      projectType: web ? "web" : "application",
      riskLevel: "standard",
      autonomy: "approval-each-stage",
      constraints,
      expectedOutputs,
      riskAnswers
    }),
    decisionSupport: Object.freeze({
      assumptions: Object.freeze([web ? "خروجی اصلی یک تجربهٔ وب است." : "نوع محصول هنوز نیازمند تأیید است.", cms ? "CMS فقط برای مدیریت محتوا استفاده می‌شود." : "سامانهٔ مدیریت محتوا هنوز قطعی نیست."]),
      risks: Object.freeze([contact ? "اگر فرم تماس دادهٔ مخاطب جمع می‌کند، پاسخ «دادهٔ شخصی» را پیش از اجرا بازبینی کنید." : "اگر راه تماس به فرم یا سرویس بیرونی تبدیل شد، پاسخ‌های ریسک را بازبینی کنید.", "پاسخ‌های «نمی‌دانم» جای «خیر» نیستند و Test یا اثر خارجی را تا تعیین تکلیف گیت می‌کنند."]),
      tests: Object.freeze(["بازبینی دو صفحه و محتوای CMS در مرورگر موبایل و دسکتاپ", "تأیید دستی پاسخ‌های ریسک پیش از آغاز هر Test یا اتصال بیرونی"]),
      improvements: Object.freeze(["گزینهٔ مناسب را به فرم اعمال و سپس هر مقدار را دستی اصلاح کنید.", "پیش از Foundation، دامنهٔ دقیق CMS و راه تماس را قطعی کنید."])
    })
  });
}

export function createProjectIntakeAdvisor({ actor, firstFive, feedback = "" } = {}) {
  assertActor(actor);
  const context = normalizeFirstFive(firstFive);
  const safeFeedback = feedback === "" || feedback === undefined ? "" : safeText("feedback", feedback, { minimum: 3, maximum: 700, required: true });
  return copy({
    schemaVersion: `hero.project-intake-advisor/v${PROJECT_INTAKE_ADVISOR_VERSION.split(".")[0]}`,
    version: PROJECT_INTAKE_ADVISOR_VERSION,
    mode: "local",
    projectId: context.projectId,
    reviewOnly: true,
    notice: "پیشنهادها فقط فرم را پر می‌کنند. هیچ پروژه، اتصال، Test، هزینه یا انتشار با این پاسخ ایجاد نمی‌شود.",
    feedbackResponse: safeFeedback ? "بازخورد شما در سه گزینهٔ تازه اعمال شد؛ پیش از ثبت، هر گزینه را بازبینی کنید." : null,
    suggestions: [0, 1, 2].map(variant => proposal(context, variant, safeFeedback))
  });
}
