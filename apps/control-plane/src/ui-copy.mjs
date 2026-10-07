/** Labels never change the underlying state, identifier or authorization. */
export function heroStatusLabel(value) {
  const labels = {
    unknown: "نامشخص", healthy: "سالم", good: "مناسب", ready: "آماده", ok: "عادی",
    active: "فعال", draft: "پیش‌نویس", archived: "آرشیوشده", suspended: "متوقف",
    "foundation-review": "در انتظار تأیید طرح", proposed: "پیشنهادی",
    blocked: "مسدود", failed: "ناموفق", critical: "بحرانی", unhealthy: "ناسالم",
    warning: "نیازمند توجه", degraded: "نیازمند بررسی", pending: "در انتظار",
    planned: "برنامه‌ریزی‌شده", running: "در حال اجرا", completed: "تکمیل‌شده",
    accepted: "پذیرفته‌شده", revoked: "لغوشده", clean: "بدون مشکل", approved: "تأییدشده",
    available: "در دسترس", "owner-only": "ویژهٔ مالک", "available-with-limits": "با محدودیت",
    "available-read-only": "قابل مشاهده", partial: "بخشی آماده است", gated: "نیازمند تأیید"
  };
  const text = String(value ?? "unknown");
  return labels[text.toLowerCase()] ?? text;
}

export function normalizeHeroSearch(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s\u200c\u200d\u064b-\u065f]/g, "");
}
