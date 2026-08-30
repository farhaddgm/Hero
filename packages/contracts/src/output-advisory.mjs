export const OUTPUT_ADVISORY_CONTRACT_VERSION = "1.0";

export const PRODUCT_OUTPUT_TYPES = Object.freeze([
  "prototype",
  "web-app",
  "mobile-app",
  "web-and-mobile",
  "api-service",
  "workflow-automation",
  "data-product",
  "research-report",
  "decision-brief"
]);

export const OUTPUT_DECISIONS = Object.freeze([
  "approved",
  "rejected",
  "rework-requested"
]);

export const OUTPUT_DECISION_STATES = Object.freeze([
  "pending-owner",
  "approved",
  "rejected",
  "rework-requested"
]);

export const OUTPUT_EVALUATION_DIMENSIONS = Object.freeze([
  "value",
  "deliverySpeed",
  "cost",
  "risk",
  "maintainability",
  "scalability",
  "userFit"
]);

export const PRODUCT_OUTPUT_DEFINITIONS = Object.freeze([
  Object.freeze({ outputId: "prototype", type: "prototype", label: "نمونهٔ اولیه", bestFor: "ابهام بالا و نیاز به یادگیری سریع", tradeoffs: ["سرعت بالا", "تعهد فنی و دامنهٔ محدود"] }),
  Object.freeze({ outputId: "web-app", type: "web-app", label: "محصول وب", bestFor: "دسترسی عمومی، داشبورد و پنل", tradeoffs: ["دسترسی ساده", "نیازمند طراحی responsive و عملیات وب"] }),
  Object.freeze({ outputId: "mobile-app", type: "mobile-app", label: "اپلیکیشن موبایل", bestFor: "تعامل مکرر موبایلی و قابلیت‌های دستگاه", tradeoffs: ["تجربهٔ موبایلی", "هزینه و چرخهٔ انتشار بیشتر"] }),
  Object.freeze({ outputId: "web-and-mobile", type: "web-and-mobile", label: "وب و موبایل", bestFor: "نیاز هم‌زمان کاربران وب و موبایل", tradeoffs: ["پوشش وسیع", "دامنه، تست و عملیات پیچیده‌تر"] }),
  Object.freeze({ outputId: "api-service", type: "api-service", label: "سرویس API", bestFor: "یکپارچه‌سازی و مصرف چند مشتری", tradeoffs: ["قابلیت اتصال", "نیازمند قرارداد، امنیت و versioning دقیق"] }),
  Object.freeze({ outputId: "workflow-automation", type: "workflow-automation", label: "اتوماسیون فرایند", bestFor: "کاهش کار دستی و اجرای فرایند تکرارشونده", tradeoffs: ["اثر سریع بر بهره‌وری", "وابستگی به فرایند و دادهٔ ورودی"] }),
  Object.freeze({ outputId: "data-product", type: "data-product", label: "محصول داده", bestFor: "تصمیم‌گیری سنجه‌محور و گزارش‌گیری", tradeoffs: ["بینش تصمیم‌ساز", "نیازمند کیفیت و lineage داده"] }),
  Object.freeze({ outputId: "research-report", type: "research-report", label: "گزارش تحقیق", bestFor: "وقتی هنوز تصمیم ساختن قطعی نیست", tradeoffs: ["کاهش ریسک تصمیم", "بدون خروجی نرم‌افزاری مستقیم"] }),
  Object.freeze({ outputId: "decision-brief", type: "decision-brief", label: "یادداشت تصمیم", bestFor: "انتخاب سریع بین چند گزینه", tradeoffs: ["شفافیت تصمیم", "نیازمند اجرای جداگانه پس از تصمیم"] })
]);

export function getOutputAdvisoryContractSummary() {
  return Object.freeze({
    version: OUTPUT_ADVISORY_CONTRACT_VERSION,
    outputTypes: PRODUCT_OUTPUT_TYPES,
    decisions: OUTPUT_DECISIONS,
    decisionStates: OUTPUT_DECISION_STATES,
    dimensions: OUTPUT_EVALUATION_DIMENSIONS,
    options: PRODUCT_OUTPUT_DEFINITIONS,
    input: "درخواست محصول، پلتفرم‌های استنباط‌شده، اهداف، قیود و معیارهای پذیرش",
    output: "گزینه‌های قابل مقایسه، امتیاز ابعاد، توصیهٔ توضیح‌داده‌شده، trade-off و تصمیم مالک",
    startBoundary: "تولید یا dispatch تا ثبت تصمیم approved مالک و آماده‌بودن تیم‌های مالک آغاز نمی‌شود."
  });
}

export function validateOutputAdvisoryContract() {
  const errors = [];
  if (OUTPUT_ADVISORY_CONTRACT_VERSION !== "1.0") errors.push("Output advisory contract version is invalid.");
  const ids = new Set();
  for (const option of PRODUCT_OUTPUT_DEFINITIONS) {
    if (ids.has(option.outputId)) errors.push(`Duplicate output option: ${option.outputId}.`);
    ids.add(option.outputId);
    if (!PRODUCT_OUTPUT_TYPES.includes(option.type)) errors.push(`Unknown output option type: ${option.type}.`);
    if (option.tradeoffs.length < 1) errors.push(`Output option has no tradeoff: ${option.outputId}.`);
  }
  for (const dimension of OUTPUT_EVALUATION_DIMENSIONS) {
    if (typeof dimension !== "string") errors.push("Output evaluation dimensions must be strings.");
  }
  return Object.freeze([...new Set(errors)]);
}
