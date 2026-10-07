/**
 * BO-165: help, glossary and runbook for Owner, Admin and Viewer, in both UI
 * locales. Every statement here describes behavior that exists and is tested;
 * nothing here promises a capability that is gated.
 */
export const HELP_ROLE_IDS = Object.freeze(["owner", "admin", "viewer"]);
export const HELP_GLOSSARY_IDS = Object.freeze(["command", "approval", "correlation", "inbox", "incident", "retention", "hold", "dry-run", "slo", "digest", "acceptance"]);
export const HELP_RUNBOOK_IDS = Object.freeze(["decision-waiting", "budget-paused", "alert-storm", "missing-trace", "audit-export", "rollback-test"]);

export const HELP_CONTENT = Object.freeze({
  fa: Object.freeze({
    roles: Object.freeze({
      owner: ["همهٔ کارهای ادمین", "تأیید فرمان‌های بحرانی", "بالا بردن سقف بودجه و ادامهٔ پروژهٔ متوقف", "خروجی گرفتن از Audit (با دلیل) و تنظیم نگهداری", "آزاد کردن Hold و پذیرش نهایی"],
      admin: ["ساخت و تأیید فرمان‌های غیربحرانی", "اقدام روی اعلان‌ها (تأیید، رد، به‌تعویق، پیشنهاد رفع)", "ثبت مصرف، بازخورد و اندازه‌گیری SLO", "برنامه‌ریزی پاک‌سازی (فقط dry-run) و گذاشتن Hold"],
      viewer: ["خواندن Inbox، خط زمانی، هزینه و سلامت و کاتالوگ", "هیچ دکمهٔ اقدام و هیچ نوشتنی ندارد", "رکوردهای امنیتی و اسناد محرمانه را نمی‌بیند"]
    }),
    glossary: Object.freeze({
      command: "فرمانی که Hero قبل از اجرا برای تأیید نگه می‌دارد.", approval: "تصمیم انسانی روی یک فرمان؛ فرمان ردشده هرگز اجرا نمی‌شود.", correlation: "یک شناسه که فرمان، اعلان، Trace و Audit مربوط به یک کار را به هم وصل می‌کند.",
      inbox: "فهرست اعلان‌ها در پنج نما: نیازمند تصمیم، بحرانی، نزدیک به مهلت، خودکار، حل‌شده.", incident: "گروهی از اعلان‌های هم‌خانواده که با هم یک رخداد حساب می‌شوند.", retention: "حداقل مدتی که رکوردها باید نگه داشته شوند؛ فقط می‌شود بیشترش کرد.",
      hold: "علامتی که یک رکورد را از پاک‌سازی بیرون نگه می‌دارد.", "dry-run": "اجرای آزمایشی که فقط فهرست می‌کند و هیچ چیز را حذف نمی‌کند.", slo: "هدف تازگی داده برای هر بخش؛ بخش بدون اندازه‌گیری تازه سالم فرض نمی‌شود.",
      digest: "اثر انگشت sha256 یک خروجی؛ دو خروجی هم‌ارز، digest یکسان دارند.", acceptance: "رکورد صریح مالک برای پذیرش یا درخواست بازکاری؛ هیچ عاملی آن را به‌جای مالک ثبت نمی‌کند."
    }),
    runbook: Object.freeze({
      "decision-waiting": ["Inbox را باز کنید و تب «نیازمند تصمیم من» را ببینید.", "کارت را بخوانید و روی «ردیابی» بزنید تا فرمان و Traceها را ببینید.", "تأیید یا رد کنید؛ اثر آن روی خود فرمان اعمال می‌شود."],
      "budget-paused": ["در «هزینه و سلامت» وضعیت «توقف در سقف سخت» را ببینید.", "فقط مالک می‌تواند سقف را بالا ببرد و پروژه را ادامه دهد.", "پس از ادامه، رزرو جدید دوباره پذیرفته می‌شود."],
      "alert-storm": ["اعلان‌های تکراری یک ردیف می‌شوند و تعداد آن‌ها نشان داده می‌شود.", "رخداد گروهی را در Inbox ببینید و اول مورد بحرانی را بررسی کنید.", "با حل شدن اعلان‌ها، رخداد خودکار بسته می‌شود."],
      "missing-trace": ["صفحهٔ ردیابی یک فرمان فهرست gaps دارد.", "اگر missing-trace دیدید، فرمان را دوباره با همان correlation بررسی و گزارش کنید.", "نبودِ Trace هرگز با داده‌ٔ ساختگی پر نمی‌شود."],
      "audit-export": ["فقط مالک خروجی می‌گیرد و باید دلیل بنویسد.", "خروجی redacted است و خودِ خروجی‌گرفتن در Audit امنیتی ثبت می‌شود.", "حداکثر ۱۰۰۰ ردیف در هر خروجی است."],
      "rollback-test": ["نسخهٔ قبلی Test همیشه برای بازگشت نگه داشته می‌شود.", "بازگشت با اسکریپت rollback روی سرور و توسط مالک انجام می‌شود.", "بازگشت Production از اینجا انجام نمی‌شود؛ مجوز جدا می‌خواهد."]
    }),
    limits: Object.freeze(["ورود کاربران MFA‌دار غیرمالک پس از راه‌اندازی دوبارهٔ سرور هنوز مشکل دارد (BO-IAM-001).", "پاک‌سازی واقعی داده فعال نیست؛ فقط برنامه‌ریزی dry-run و ثبت تلاش‌ها وجود دارد.", "اتصال زندهٔ GitHub، سرور، Secret Store و Production هنوز مجاز و ساخته نشده است.", "همهٔ صفحه‌ها هنوز دوزبانه نیستند؛ Inbox و راهنما کامل دوزبانه‌اند."])
  }),
  en: Object.freeze({
    roles: Object.freeze({
      owner: ["Everything an admin can do", "Approve critical commands", "Raise the budget cap and resume a paused project", "Export the audit (with a reason) and set retention", "Release a hold and give the final acceptance"],
      admin: ["Create and approve non-critical commands", "Act on notifications (approve, reject, snooze, propose a fix)", "Record usage, feedback and SLO measurements", "Plan cleanup (dry-run only) and place holds"],
      viewer: ["Read the Inbox, timeline, cost and health and the catalog", "No action buttons and no writes", "Security records and confidential documents are hidden"]
    }),
    glossary: Object.freeze({
      command: "A command Hero holds for approval before it runs.", approval: "A human decision on a command; a rejected command never runs.", correlation: "One identifier that links the command, notification, trace and audit of one piece of work.",
      inbox: "The notification list in five views: needs a decision, critical, upcoming, automation, resolved.", incident: "A group of related notifications counted as one occurrence.", retention: "The minimum time records must be kept; it can only be lengthened.",
      hold: "A mark that keeps a record out of cleanup.", "dry-run": "A trial run that only lists and never deletes.", slo: "The freshness objective of an area; an area without a fresh measurement is never assumed healthy.",
      digest: "The sha256 fingerprint of an output; equal outputs have the same digest.", acceptance: "The owner's explicit record to accept or ask for rework; no agent records it on the owner's behalf."
    }),
    runbook: Object.freeze({
      "decision-waiting": ["Open the Inbox and the \"Needs my decision\" tab.", "Read the card and follow \"trace\" to see the command and its traces.", "Approve or reject; the effect is applied to the command itself."],
      "budget-paused": ["In \"Cost and health\" look for \"hard cap pause\".", "Only the owner can raise the cap and resume the project.", "After resuming, new reservations are accepted again."],
      "alert-storm": ["Repeated notifications collapse into one row and show their count.", "Open the grouped incident in the Inbox and handle the critical item first.", "The incident closes by itself once its notifications are resolved."],
      "missing-trace": ["A command's trace view lists gaps.", "If you see missing-trace, review the command under the same correlation and report it.", "A missing trace is never filled with invented data."],
      "audit-export": ["Only the owner exports, and must give a reason.", "The export is redacted and the export itself is written to the security audit.", "An export holds at most 1000 rows."],
      "rollback-test": ["The previous Test image is always kept for rollback.", "Rollback is done by the owner with the rollback script on the server.", "Production rollback is not done from here; it needs a separate authorization."]
    }),
    limits: Object.freeze(["Non-owner users with MFA cannot sign in after a server restart yet (BO-IAM-001).", "Real data cleanup is not enabled; only dry-run planning and recorded attempts exist.", "Live GitHub, server, Secret Store and Production connections are neither allowed nor built yet.", "Not every page is bilingual yet; the Inbox and this help page are fully bilingual."])
  })
});
export function validateHelpContent() {
  const errors = [];
  for (const locale of ["fa", "en"]) {
    const content = HELP_CONTENT[locale];
    for (const role of HELP_ROLE_IDS) if (!content.roles[role]?.length) errors.push(`${locale} role ${role} is empty`);
    for (const term of HELP_GLOSSARY_IDS) if (!content.glossary[term]) errors.push(`${locale} glossary ${term} is missing`);
    for (const item of HELP_RUNBOOK_IDS) if (!content.runbook[item]?.length) errors.push(`${locale} runbook ${item} is empty`);
    if (!content.limits?.length) errors.push(`${locale} limits are empty`);
  }
  return errors;
}
