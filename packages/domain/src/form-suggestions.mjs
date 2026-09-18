export const FORM_SUGGESTIONS_VERSION = "1.0.0";
export const FORM_SUGGESTION_MAX_FIELDS = 32;
export const FORM_SUGGESTION_MAX_SUGGESTIONS = 3;

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;
const SENSITIVE_FIELD = /(?:password|passwd|secret|credential|token|api[._-]?key|private[._-]?key|mfa|otp|رمز|کلید\s*api)/iu;
const SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/u;
const SENSITIVE_ASSIGNMENT = /(?:password|passwd|secret|credential|token|api(?:[._-]|\s)?key|mfa|رمز|کلید\s*api)\s*[:=]\s*\S+/iu;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|opt)\/)/u;

export class FormSuggestionsError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "FormSuggestionsError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function text(label, value, { minimum = 0, maximum = 700 } = {}) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > maximum) throw new FormSuggestionsError("FORM_SUGGESTION_TEXT_INVALID", `${label} is invalid.`);
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length < minimum || SENSITIVE_VALUE.test(normalized) || SENSITIVE_ASSIGNMENT.test(normalized) || HOST_PATH.test(normalized)) {
    throw new FormSuggestionsError("FORM_SUGGESTION_SENSITIVE_INPUT", `${label} is empty, too short or contains sensitive data.`);
  }
  return normalized;
}

function actorKind(actor) {
  return actor?.actor?.kind ?? actor?.kind ?? (actor?.role === "admin" ? "admin" : actor?.role === "project-owner" ? "project-owner" : null);
}

function assertActor(actor) {
  if (!["project-owner", "admin"].includes(actorKind(actor))) {
    throw new FormSuggestionsError("FORM_SUGGESTION_ADMIN_REQUIRED", "Form suggestions require a project owner or admin session.", 403);
  }
}

function safeFieldName(field, index) {
  const name = text(`field ${index + 1} name`, field?.name ?? field?.id, { minimum: 1, maximum: 128 });
  if (!IDENTIFIER.test(name) || SENSITIVE_FIELD.test(name)) {
    throw new FormSuggestionsError("FORM_SUGGESTION_FIELD_REJECTED", "Sensitive or invalid form fields cannot receive AI suggestions.", 400);
  }
  return name;
}

function normalizeOptions(options, index) {
  if (!Array.isArray(options)) return [];
  return options.slice(0, 20).map((option, optionIndex) => {
    const value = text(`field ${index + 1} option ${optionIndex + 1}`, option?.value, { minimum: 0, maximum: 160 });
    const label = text(`field ${index + 1} option ${optionIndex + 1} label`, option?.label ?? value, { minimum: 0, maximum: 180 });
    if (SENSITIVE_FIELD.test(value) || SENSITIVE_VALUE.test(value)) throw new FormSuggestionsError("FORM_SUGGESTION_OPTION_REJECTED", "Sensitive form options cannot receive AI suggestions.", 400);
    return Object.freeze({ value, label: label || value });
  }).filter(option => option.value !== "");
}

function normalizeFields(fields) {
  if (!Array.isArray(fields) || fields.length < 1 || fields.length > FORM_SUGGESTION_MAX_FIELDS) {
    throw new FormSuggestionsError("FORM_SUGGESTION_FIELDS_INVALID", `Between 1 and ${FORM_SUGGESTION_MAX_FIELDS} safe form fields are required.`);
  }
  return fields.map((field, index) => {
    const name = safeFieldName(field, index);
    const type = ["text", "search", "email", "url", "number", "date", "textarea", "select", "checkbox", "radio"].includes(field?.type) ? field.type : "text";
    if (["password", "file", "hidden"].includes(type) || SENSITIVE_FIELD.test(`${name} ${field?.label ?? ""}`)) {
      throw new FormSuggestionsError("FORM_SUGGESTION_FIELD_REJECTED", "Password, file, credential and secret fields are not eligible for suggestions.", 400);
    }
    const label = text(`field ${index + 1} label`, field?.label ?? name, { minimum: 1, maximum: 220 });
    const value = text(`field ${index + 1} option value`, field?.value, { maximum: 160 });
    return Object.freeze({ name, type, label, value, options: normalizeOptions(field?.options, index), required: field?.required === true });
  });
}

function fieldKey(field) {
  return `${field.name} ${field.label}`.toLocaleLowerCase();
}

function chooseOption(field, variant) {
  if (!field.options.length) return null;
  return field.options[Math.min(variant, field.options.length - 1)];
}

function has(field, pattern) {
  return pattern.test(fieldKey(field));
}

function suggestedValue(field, variant, { softwareGoal, formTitle, boxDescription }) {
  const option = chooseOption(field, variant);
  if (option) return option.value;
  const key = fieldKey(field);
  if (has(field, /goal|objective|هدف|مقصود/u)) return variant === 0 ? softwareGoal : variant === 1 ? `تکمیل هدف «${softwareGoal}» با مسیر قابل بررسی و انتقال‌پذیر.` : `ساخت راه‌حل امن و قابل آزمون برای «${softwareGoal}» با تأیید ادمین.`;
  if (has(field, /user|audience|کاربر|مخاطب/u)) return variant === 0 ? "کاربران هدفی که در شرح پروژه مشخص شده‌اند" : variant === 1 ? "کاربران داخلی و ادمین‌های پروژه" : "کاربران هدف، ادمین و تیم پشتیبان";
  if (has(field, /name|title|نام|عنوان/u)) return `${formTitle} · پیشنهاد ${variant + 1}`;
  if (has(field, /description|summary|شرح|توضیح|brief/u)) return `${boxDescription}. هدف پروژه: ${softwareGoal}.`;
  if (has(field, /constraint|محدود|مرز|قید/u)) return variant === 0 ? "فقط محیط Test، بدون Secret و بدون هزینهٔ خارجی" : variant === 1 ? "محیط Test ایزوله، بررسی ادمین و امکان Rollback" : "Test ایزوله، بدون دسترسی ناخواسته، با Artifact قابل انتقال";
  if (has(field, /output|deliverable|خروجی|تحویل/u)) return variant === 0 ? "کد، تست و گزارش سلامت" : variant === 1 ? "Artifact immutable، تست و گزارش قابل بررسی" : "Artifact قابل انتقال، تست، گزارش و راهنمای اجرا";
  if (has(field, /reason|دلیل/u)) return `پیشنهاد اولیه بر اساس هدف پروژه و باکس «${formTitle}».`;
  if (has(field, /impact|اثر/u)) return "بدون اجرای خودکار؛ فقط پس از بررسی و ثبت ادمین";
  if (has(field, /path|مسیر/u)) return variant === 0 ? "project/settings/approved" : variant === 1 ? "project/runtime/test" : "project/delivery/portable";
  if (has(field, /url|link|نشانی|آدرس/u)) return `https://example.invalid/hero-reference-${variant + 1}`;
  if (has(field, /file|filename|نام فایل/u)) return variant === 0 ? "project-brief.txt" : variant === 1 ? "project-plan.md" : "project-evidence.json";
  if (has(field, /content|محتوا|متن/u)) return `شرح اولیهٔ ${formTitle}: ${softwareGoal}. این متن پیشنهادی است و باید پیش از ثبت بازبینی شود.`;
  if (has(field, /value|مقدار/u)) return variant === 0 ? "در انتظار بررسی ادمین" : variant === 1 ? "مقدار Test تأییدشده" : "مقدار نسخه‌دار قابل بازگشت";
  if (field.type === "number") return String(variant + 1);
  return variant === 0 ? `پیشنهاد اولیه برای «${formTitle}»` : variant === 1 ? `نسخهٔ استاندارد برای «${formTitle}»` : `نسخهٔ کامل و قابل بررسی برای «${formTitle}»`;
}

function suggestionEntries(fields, variant, context) {
  const selectedRadioByName = new Map();
  return fields.map(field => {
    if (field.type === "checkbox") return { name: field.name, type: field.type, value: field.value || "on", checked: variant === 2 };
    if (field.type === "radio") {
      const selected = !selectedRadioByName.has(field.name) && (variant === 0 || field.value === String(variant + 1));
      if (selected) selectedRadioByName.set(field.name, true);
      return { name: field.name, type: field.type, value: field.value || "on", checked: selected };
    }
    const value = suggestedValue(field, variant, context);
    return { name: field.name, type: field.type, value: value.slice(0, 700), checked: false };
  });
}

export function createFormSuggestions({ actor, projectId = null, formId, formTitle, softwareGoal, boxDescription, fields, selectedAdvisor = "local" } = {}) {
  assertActor(actor);
  if (projectId !== null && (!IDENTIFIER.test(projectId) || projectId.length > 63)) throw new FormSuggestionsError("FORM_SUGGESTION_PROJECT_INVALID", "Project scope is invalid.", 400);
  const safeFormId = text("formId", formId, { minimum: 1, maximum: 128 });
  if (!IDENTIFIER.test(safeFormId)) throw new FormSuggestionsError("FORM_SUGGESTION_FORM_INVALID", "Form identifier is invalid.", 400);
  const safeTitle = text("formTitle", formTitle, { minimum: 1, maximum: 220 });
  const safeGoal = text("softwareGoal", softwareGoal || "هدف نرم‌افزار هنوز در پروژه ثبت نشده است", { minimum: 1, maximum: 700 });
  const safeDescription = text("boxDescription", boxDescription || safeTitle, { minimum: 1, maximum: 700 });
  if (selectedAdvisor !== "local") throw new FormSuggestionsError("FORM_SUGGESTION_ADVISOR_UNAVAILABLE", "فقط راهنمای محلی Hero برای این قابلیت مجاز است؛ Provider زنده نیازمند مجوز مستقل همین قابلیت است.", 403);
  const safeFields = normalizeFields(fields);
  const variants = ["محافظه‌کارانه", "استاندارد", "کامل و قابل انتقال"];
  const suggestions = variants.map((variant, index) => copy({
    suggestionId: `local-form-suggestion-${index + 1}`,
    title: `پیشنهاد ${index + 1} · ${variant}`,
    source: "hero-local",
    rationale: index === 0 ? "کمترین تغییر و کمترین ریسک برای شروع." : index === 1 ? "تعادل بین کامل‌بودن و سادگی بررسی." : "پیشنهاد کامل‌تر با توجه به انتقال‌پذیری و Evidence.",
    entries: suggestionEntries(safeFields, index, { softwareGoal: safeGoal, formTitle: safeTitle, boxDescription: safeDescription }),
    fieldCount: safeFields.length
  }));
  return copy({
    version: FORM_SUGGESTIONS_VERSION,
    projectId,
    formId: safeFormId,
    selectedAdvisor: "local",
    providerInvoked: false,
    externalSpend: "none",
    suggestions
  });
}
