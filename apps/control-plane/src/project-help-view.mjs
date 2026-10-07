import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";
import { createTranslator, LOCALE_DIRECTION, resolveUiLocale } from "../../../packages/contracts/src/ui-locale.mjs";
import { HELP_CONTENT, HELP_GLOSSARY_IDS, HELP_ROLE_IDS, HELP_RUNBOOK_IDS } from "../../../packages/contracts/src/help-content.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

/** Help, glossary and runbook (BO-165) in the viewer's locale. The viewer's own role is marked, never hidden. */
export function getProjectHelpHtml({ project, viewerRole, locale: requested = "fa" }) {
  const locale = resolveUiLocale(requested); const t = createTranslator(locale); const content = HELP_CONTENT[locale]; const direction = LOCALE_DIRECTION[locale]; const other = locale === "fa" ? "en" : "fa";
  const projectId = project.projectId; const ownRole = viewerRole === "project-owner" ? "owner" : viewerRole;
  const roles = HELP_ROLE_IDS.map(role => `<section class="section" id="role-${role}" data-help-role="${role}"${role === ownRole ? ' aria-current="true"' : ""}><h3>${escapeHtml(t(`role.${role}`))}${role === ownRole ? ` <span class="pill good" data-own-role>★ ${escapeHtml(t(`role.${role}`))}</span>` : ""}</h3><ul>${content.roles[role].map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`).join("");
  const glossary = HELP_GLOSSARY_IDS.map(term => `<dt id="term-${term}" data-term="${term}"><code>${escapeHtml(term)}</code></dt><dd>${escapeHtml(content.glossary[term])}</dd>`).join("");
  const runbook = HELP_RUNBOOK_IDS.map(item => `<section class="section" id="runbook-${item}" data-runbook="${item}"><h3><code>${escapeHtml(item)}</code></h3><ol>${content.runbook[item].map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol></section>`).join("");
  return `<!doctype html>
<html lang="${locale}" dir="${direction}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hero · ${escapeHtml(t("help.title"))}</title>
    <style>
      :root { --ink:#162238; --muted:#566a85; --line:#dbe3ef; --surface:#fff; --canvas:#f4f7fb; --primary:#285ea8; --teal:#066356; }
      * { box-sizing:border-box; } body { margin:0; color:var(--ink); background:var(--canvas); font-family:Vazirmatn,sans-serif; line-height:1.8; }
      main { width:min(980px,calc(100% - 30px)); margin:0 auto; padding:28px 0 50px; }
      .top,.section { border:1px solid var(--line); border-radius:16px; background:var(--surface); } .top { padding:18px 20px; margin-bottom:16px; } .section { padding:14px 16px; margin-top:12px; }
      h1 { margin:0 0 4px; font-size:clamp(1.3rem,3vw,1.9rem); } h2 { margin:22px 0 4px; font-size:1.1rem; } h3 { margin:0 0 6px; font-size:1rem; } .muted { color:var(--muted); font-size:.82rem; }
      dt { margin-top:10px; font-weight:700; } dd { margin:2px 0 0; } code { direction:ltr; unicode-bidi:embed; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.8rem; }
      .pill { padding:2px 8px; border-radius:999px; background:var(--teal-soft); color:var(--teal); font-size:.72rem; font-weight:700; } a { color:var(--primary); } nav.crumbs { font-size:.8rem; color:var(--muted); margin-bottom:6px; }
      ${getHeroShellStyles()}
    </style>
  </head>
  <body>
    ${getHeroGlobalNavigation({ active: "control", projectId, environment: "Private · Help" })}
    <main id="hero-main" tabindex="-1" data-project-id="${escapeHtml(projectId)}" data-viewer-role="${escapeHtml(viewerRole)}">
      <header class="top hero-page-header"><nav class="crumbs" aria-label="${escapeHtml(t("inbox.projects"))}"><a href="/api/portal?surface=portfolio&amp;select=project">${escapeHtml(t("inbox.projects"))}</a> / <a href="/api/portal?surface=studio&amp;projectId=${encodeURIComponent(projectId)}">${escapeHtml(project.name)}</a> / ${escapeHtml(t("help.title"))} · <a href="/api/portal?surface=help&amp;projectId=${encodeURIComponent(projectId)}&amp;lang=${other}" hreflang="${other}" data-locale-switch="${other}">${escapeHtml(t("ui.language"))}: ${other}</a></nav><h1>${escapeHtml(t("help.heading", { project: project.name }))}</h1></header>
      <h2>${escapeHtml(t("help.roles"))}</h2>${roles}
      <h2>${escapeHtml(t("help.glossary"))}</h2><section class="section"><dl>${glossary}</dl></section>
      <h2>${escapeHtml(t("help.runbook"))}</h2>${runbook}
      <h2>${escapeHtml(t("help.limits"))}</h2><section class="section" id="limits"><ul>${content.limits.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
    </main>
    ${getHeroShellScript()}
  </body>
</html>`;
}
