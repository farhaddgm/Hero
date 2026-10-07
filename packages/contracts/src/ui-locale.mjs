/**
 * BO-149: Back Office UI text in Persian (RTL) and English (LTR). Text changes
 * with the locale; identifiers (data-* values, ids, routes, enum values, API
 * fields) never do, so tests, automation and links behave identically.
 */
export const UI_LOCALES = Object.freeze(["fa", "en"]);
export const DEFAULT_UI_LOCALE = "fa";
export const LOCALE_DIRECTION = Object.freeze({ fa: "rtl", en: "ltr" });

export const UI_MESSAGES = Object.freeze({
  fa: Object.freeze({
    "inbox.title": "صندوق ورودی", "inbox.heading": "صندوق ورودی {project}", "inbox.projects": "پروژه‌ها",
    "inbox.intro": "تأیید و رد همین‌جا روی فرمان واقعی اعمال می‌شود؛ «پیشنهاد رفع» فقط پیش‌نویس می‌سازد و هرگز اجرا نمی‌کند.", "inbox.viewerNote": "شما بیننده هستید و فقط می‌خوانید.",
    "inbox.tabs": "نمای صندوق", "inbox.empty": "موردی در «{view}» نیست.", "inbox.truncated": "{shown} مورد از {total} نمایش داده شد؛ بقیه را با API و cursor بخوانید.", "inbox.timeline": "خط زمانی", "inbox.timelineEmpty": "رویدادی ثبت نشده است.",
    "view.needs-decision": "نیازمند تصمیم من", "view.critical": "بحرانی", "view.upcoming": "نزدیک به مهلت", "view.automation": "خودکار", "view.resolved": "حل‌شده",
    "action.approve": "تأیید", "action.reject": "رد", "action.run-fix": "پیشنهاد رفع", "action.snooze": "به‌تعویق", "action.chat": "گفت‌وگو", "action.acknowledge": "دیدم",
    "origin.automation": "خودکار", "origin.person": "انسانی", "meta.state": "وضعیت", "meta.deadline": "مهلت", "meta.times": "بار", "meta.trace": "ردیابی",
    "slo.title": "هدف‌های سرویس (SLO)", "slo.section": "بخش", "slo.objective": "هدف", "slo.lag": "تأخیر اندازه‌گیری‌شده", "slo.status": "وضعیت", "slo.note": "بخشی که اندازه‌گیری تازه ندارد سالم فرض نمی‌شود.",
    "slo.meeting": "در هدف", "slo.breached": "خارج از هدف", "slo.no-data": "بدون اندازه‌گیری", "slo.measurement-stale": "اندازه‌گیری کهنه",
    "ui.working": "در حال انجام…", "ui.done": "انجام شد.", "ui.failed": "انجام نشد.", "ui.offline": "ارتباط برقرار نشد.", "ui.chatLink": "پیوند گفت‌وگو:", "ui.language": "زبان", "ui.skip": "پرش به محتوا",
    "help.title": "راهنما", "help.heading": "راهنمای {project}", "help.roles": "نقش‌ها", "help.glossary": "واژه‌نامه", "help.runbook": "دستورالعمل عملیاتی", "help.limits": "محدودیت‌های شناخته‌شده",
    "role.owner": "مالک", "role.admin": "ادمین", "role.viewer": "بیننده"
  }),
  en: Object.freeze({
    "inbox.title": "Inbox", "inbox.heading": "{project} inbox", "inbox.projects": "Projects",
    "inbox.intro": "Approve and reject act on the real command here; \"Propose fix\" only drafts a command and never runs it.", "inbox.viewerNote": "You are a viewer and can only read.",
    "inbox.tabs": "Inbox views", "inbox.empty": "Nothing in \"{view}\".", "inbox.truncated": "Showing {shown} of {total}; read the rest through the API with a cursor.", "inbox.timeline": "Timeline", "inbox.timelineEmpty": "No events recorded yet.",
    "view.needs-decision": "Needs my decision", "view.critical": "Critical", "view.upcoming": "Upcoming deadline", "view.automation": "Automation", "view.resolved": "Resolved",
    "action.approve": "Approve", "action.reject": "Reject", "action.run-fix": "Propose fix", "action.snooze": "Snooze", "action.chat": "Discuss", "action.acknowledge": "Seen",
    "origin.automation": "automation", "origin.person": "person", "meta.state": "state", "meta.deadline": "due", "meta.times": "times", "meta.trace": "trace",
    "slo.title": "Service objectives (SLO)", "slo.section": "Area", "slo.objective": "Objective", "slo.lag": "Measured lag", "slo.status": "Status", "slo.note": "An area without a fresh measurement is never assumed healthy.",
    "slo.meeting": "Meeting", "slo.breached": "Breached", "slo.no-data": "No measurement", "slo.measurement-stale": "Measurement stale",
    "ui.working": "Working…", "ui.done": "Done.", "ui.failed": "Failed.", "ui.offline": "Could not reach the server.", "ui.chatLink": "Conversation link:", "ui.language": "Language", "ui.skip": "Skip to content",
    "help.title": "Help", "help.heading": "{project} help", "help.roles": "Roles", "help.glossary": "Glossary", "help.runbook": "Runbook", "help.limits": "Known limitations",
    "role.owner": "Owner", "role.admin": "Admin", "role.viewer": "Viewer"
  })
});

export function resolveUiLocale(...candidates) { for (const value of candidates) if (UI_LOCALES.includes(value)) return value; return DEFAULT_UI_LOCALE; }
export function createTranslator(locale) {
  const table = UI_MESSAGES[resolveUiLocale(locale)];
  return (key, params = {}) => { const template = table[key]; if (template === undefined) throw new Error(`Missing UI message: ${key}`); return template.replace(/\{([a-z]+)\}/g, (_, name) => String(params[name] ?? "")); };
}
export function formatUiNumber(locale, value) { return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(Number(value ?? 0)); }
/** Both locales must define exactly the same keys and the same placeholders. */
export function validateUiLocales() {
  const errors = []; const base = Object.keys(UI_MESSAGES.fa);
  for (const locale of UI_LOCALES) {
    const keys = Object.keys(UI_MESSAGES[locale]);
    for (const key of base) if (!keys.includes(key)) errors.push(`${locale} is missing ${key}`);
    for (const key of keys) if (!base.includes(key)) errors.push(`${locale} has extra ${key}`);
  }
  for (const key of base) {
    const placeholders = locale => (UI_MESSAGES[locale][key]?.match(/\{[a-z]+\}/g) ?? []).sort().join(",");
    if (placeholders("fa") !== placeholders("en")) errors.push(`${key} placeholders differ between locales`);
    for (const locale of UI_LOCALES) if (!String(UI_MESSAGES[locale][key] ?? "").trim()) errors.push(`${locale} ${key} is empty`);
  }
  return errors;
}
