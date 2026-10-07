/**
 * BO-157/BO-158: legacy page routes and the Shell route that replaces each. A legacy
 * route keeps working, with Deprecation/Sunset/Link headers, until its compatibility
 * window ends; only then does it answer 410. Nothing is removed before the
 * replacement is verified to serve the same roles.
 */
export const LEGACY_COMPATIBLE_UNTIL = "2027-04-05T00:00:00.000Z";
export const LEGACY_ROUTE_MIGRATIONS = Object.freeze([
  Object.freeze({ legacy: "/backoffice", successor: "/portfolio?select=project", surface: "portfolio", state: "replaced-redirect-only" }),
  Object.freeze({ legacy: "/product-studio", successor: "/api/portal?surface=studio", surface: "studio", state: "replaced-same-page" }),
  Object.freeze({ legacy: "/project-control", successor: "/api/portal?surface=control", surface: "control", state: "replaced-same-page" }),
  Object.freeze({ legacy: "/workspace", successor: "/api/portal?surface=workspace", surface: "workspace", state: "replaced-same-page" }),
  Object.freeze({ legacy: "/walkthrough", successor: "/api/portal?surface=walkthrough", surface: "walkthrough", state: "replaced-same-page" })
]);
const BY_PATH = new Map(LEGACY_ROUTE_MIGRATIONS.map(entry => [entry.legacy, entry]));

export function legacyRouteFor(pathname) { return BY_PATH.get(pathname) ?? null; }
/** "compatible" until the window ends, then "window-ended". */
export function legacyStatus(pathname, nowIso) {
  const entry = legacyRouteFor(pathname); if (!entry) return null;
  return Date.parse(nowIso) <= Date.parse(LEGACY_COMPATIBLE_UNTIL) ? "compatible" : "window-ended";
}
export function successorUrl(entry, searchParams) {
  const projectId = searchParams?.get?.("projectId"); const separator = entry.successor.includes("?") ? "&" : "?";
  return projectId && entry.surface !== "portfolio" ? `${entry.successor}${separator}projectId=${encodeURIComponent(projectId)}` : entry.successor;
}
export function validateRouteMigration() {
  const errors = []; const seen = new Set();
  for (const entry of LEGACY_ROUTE_MIGRATIONS) { if (seen.has(entry.legacy)) errors.push(`duplicate ${entry.legacy}`); seen.add(entry.legacy); if (!entry.legacy.startsWith("/") || !entry.successor.startsWith("/") || entry.legacy === entry.successor) errors.push(`invalid ${entry.legacy}`); }
  if (Number.isNaN(Date.parse(LEGACY_COMPATIBLE_UNTIL))) errors.push("window date is invalid");
  return errors;
}
