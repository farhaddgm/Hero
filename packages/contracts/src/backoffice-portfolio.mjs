export const BACKOFFICE_PORTFOLIO_CONTRACT_VERSION = "1.0";
export const PORTFOLIO_ROLES = Object.freeze(["viewer", "admin", "project-owner"]);
export const PORTFOLIO_DEFAULT_PAGE_SIZE = 12;
export const PORTFOLIO_MAX_PAGE_SIZE = 50;

/** BO-053: information architecture. Every section names the surface that
 * renders it and the minimum project role allowed to see it. */
export const BACKOFFICE_INFORMATION_ARCHITECTURE = Object.freeze([
  Object.freeze({ id: "portfolio", scope: "portfolio", surface: "portfolio", anchor: null, labelFa: "سبد پروژه‌ها", minRole: "viewer" }),
  Object.freeze({ id: "overview", scope: "project", surface: "studio", anchor: null, labelFa: "نمای کلی پروژه", minRole: "viewer" }),
  Object.freeze({ id: "roadmap", scope: "project", surface: "studio", anchor: "roadmap", labelFa: "نقشهٔ راه", minRole: "viewer" }),
  Object.freeze({ id: "inputs", scope: "project", surface: "workspace", anchor: "inputs", labelFa: "ورودی‌ها", minRole: "viewer" }),
  Object.freeze({ id: "settings", scope: "project", surface: "workspace", anchor: "settings", labelFa: "تنظیمات و Policy", minRole: "viewer" }),
  Object.freeze({ id: "outputs", scope: "project", surface: "studio", anchor: "outputs", labelFa: "خروجی‌ها", minRole: "viewer" }),
  Object.freeze({ id: "operations", scope: "project", surface: "control", anchor: null, labelFa: "عملیات پروژه", minRole: "viewer" }),
  Object.freeze({ id: "command", scope: "project", surface: "command", anchor: null, labelFa: "مرکز فرمان", minRole: "admin" })
]);

/** BO-060: every KPI is a count of an explicit, listable set. The value shown
 * must always equal the number of items its drill-down returns. */
export const PORTFOLIO_KPIS = Object.freeze([
  Object.freeze({ kpiId: "visible-projects", labelFa: "پروژه‌های قابل مشاهده", definition: "Projects in the current view (active or archived) that this principal may read." }),
  Object.freeze({ kpiId: "active-projects", labelFa: "پروژه‌های فعال", definition: "Visible projects whose lifecycle is active (Foundation approved)." }),
  Object.freeze({ kpiId: "foundation-pending", labelFa: "منتظر تصمیم Foundation", definition: "Visible projects whose current Foundation proposal is proposed or revision-requested." }),
  Object.freeze({ kpiId: "health-unknown", labelFa: "سلامت ثبت‌نشده", definition: "Visible projects with no recorded health value." })
]);

function rank(role) { return PORTFOLIO_ROLES.indexOf(role); }

export function sectionsFor(role, scope = null) {
  const level = rank(role);
  return Object.freeze(BACKOFFICE_INFORMATION_ARCHITECTURE.filter(section => level >= rank(section.minRole) && (!scope || section.scope === scope)));
}

export function sectionHref(section, projectId = null) {
  const query = new URLSearchParams({ surface: section.surface });
  if (section.scope === "project") query.set("projectId", projectId);
  if (section.surface === "portfolio") query.set("select", "project");
  return `/api/portal?${query.toString()}${section.anchor ? `#${section.anchor}` : ""}`;
}

/** BO-059: stable breadcrumbs Portfolio › Project › Section › Entity/Context. */
export function breadcrumbsFor({ projectId = null, projectName = null, sectionId = null, entityLabel = null } = {}) {
  const portfolio = BACKOFFICE_INFORMATION_ARCHITECTURE[0];
  const crumbs = [{ id: "portfolio", label: portfolio.labelFa, href: sectionHref(portfolio) }];
  if (projectId) {
    const overview = BACKOFFICE_INFORMATION_ARCHITECTURE.find(section => section.id === "overview");
    crumbs.push({ id: `project:${projectId}`, label: projectName ?? projectId, href: sectionHref(overview, projectId) });
    const section = sectionId ? BACKOFFICE_INFORMATION_ARCHITECTURE.find(item => item.id === sectionId && item.scope === "project") : null;
    if (section && section.id !== "overview") crumbs.push({ id: section.id, label: section.labelFa, href: sectionHref(section, projectId) });
    if (entityLabel) crumbs.push({ id: "context", label: String(entityLabel).slice(0, 120), href: null });
  }
  return Object.freeze(crumbs.map(item => Object.freeze(item)));
}

/** Parses page/pageSize; returns null for an invalid request so callers can reject it. */
export function parsePagination({ page = null, pageSize = null } = {}) {
  const parsedPage = page === null || page === "" ? 1 : Number(page);
  const parsedSize = pageSize === null || pageSize === "" ? PORTFOLIO_DEFAULT_PAGE_SIZE : Number(pageSize);
  if (!Number.isInteger(parsedPage) || parsedPage < 1 || !Number.isInteger(parsedSize) || parsedSize < 1 || parsedSize > PORTFOLIO_MAX_PAGE_SIZE) return null;
  return Object.freeze({ page: parsedPage, pageSize: parsedSize });
}

export function getBackofficePortfolioContractSummary() {
  return Object.freeze({ version: BACKOFFICE_PORTFOLIO_CONTRACT_VERSION, roles: PORTFOLIO_ROLES, informationArchitecture: BACKOFFICE_INFORMATION_ARCHITECTURE, kpis: PORTFOLIO_KPIS, pagination: { defaultPageSize: PORTFOLIO_DEFAULT_PAGE_SIZE, maxPageSize: PORTFOLIO_MAX_PAGE_SIZE }, isolation: "every card, KPI, drill-down and search result is filtered by Project Grant" });
}

export function validateBackofficePortfolioContract() {
  const errors = [];
  const ids = BACKOFFICE_INFORMATION_ARCHITECTURE.map(section => section.id);
  if (new Set(ids).size !== ids.length) errors.push("Information architecture section ids must be unique.");
  if (BACKOFFICE_INFORMATION_ARCHITECTURE.some(section => !PORTFOLIO_ROLES.includes(section.minRole))) errors.push("Every section needs a valid minimum role.");
  if (new Set(PORTFOLIO_KPIS.map(kpi => kpi.kpiId)).size !== PORTFOLIO_KPIS.length) errors.push("KPI ids must be unique.");
  if (PORTFOLIO_KPIS.some(kpi => !kpi.definition)) errors.push("Every KPI needs a definition.");
  return errors;
}
