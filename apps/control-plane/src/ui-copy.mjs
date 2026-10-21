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

// NX-016: the search normaliser lives in the shared Persian locale toolbox; it is re-exported here unchanged.
export { normalizeHeroSearch } from "../../../packages/contracts/src/persian-locale.mjs";
