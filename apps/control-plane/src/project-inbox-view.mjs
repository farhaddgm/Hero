import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";
import { createTranslator, formatUiNumber, LOCALE_DIRECTION, resolveUiLocale } from "../../../packages/contracts/src/ui-locale.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
const VIEW_ORDER = Object.freeze(["needs-decision", "critical", "upcoming", "automation", "resolved"]);
const SLO_CLASS = Object.freeze({ meeting: "good", breached: "bad", "no-data": "", "measurement-stale": "warn" });
const SEVERITY_CLASS = Object.freeze({ critical: "bad", warning: "warn", info: "" });

/** Inbox (BO-113..BO-119): five views, real decision actions, timeline and the SLO of Hero's own projections. */
export function getProjectInboxHtml({ project, viewerRole, canAct, views, counts, timeline = [], slo, truncated = {}, locale: requested = "fa" }) {
  const locale = resolveUiLocale(requested); const t = createTranslator(locale); const direction = LOCALE_DIRECTION[locale]; const other = locale === "fa" ? "en" : "fa";
  const projectId = project.projectId; const base = `/api/projects/${encodeURIComponent(projectId)}`;
  const buttons = item => canAct ? item.availableActions.filter(name => name !== "assign").map(name => `<button type="button" data-act="${escapeHtml(name)}" data-notification-id="${escapeHtml(item.notificationId)}">${escapeHtml(t(`action.${name}`))}</button>`).join("") + (item.effectiveState === "open" ? `<button type="button" data-act="acknowledge" data-notification-id="${escapeHtml(item.notificationId)}">${escapeHtml(t("action.acknowledge"))}</button>` : "") : "";
  const row = item => `<article class="row" data-notification="${escapeHtml(item.notificationId)}" data-origin="${escapeHtml(item.origin)}"><div class="head"><strong>${escapeHtml(item.title)}</strong><span class="pill ${SEVERITY_CLASS[item.severity] ?? ""}">${escapeHtml(item.severity)}</span></div><div class="meta">${escapeHtml(item.category)} · ${escapeHtml(t(`origin.${item.origin}`))} · ${escapeHtml(t("meta.state"))} ${escapeHtml(item.effectiveState)}${item.nextDeadline ? ` · ${escapeHtml(t("meta.deadline"))} <time datetime="${escapeHtml(item.nextDeadline)}">${escapeHtml(item.nextDeadline)}</time>` : ""}${item.occurrences > 1 ? ` · ${escapeHtml(formatUiNumber(locale, item.occurrences))} ${escapeHtml(t("meta.times"))}` : ""} · <a href="${base}/correlations/${encodeURIComponent(item.correlationId)}" data-correlation>${escapeHtml(t("meta.trace"))}</a></div><div class="actions">${buttons(item)}</div></article>`;
  const tabs = VIEW_ORDER.map((name, index) => `<button type="button" role="tab" class="tab" data-tab="${name}" aria-selected="${index === 0}">${escapeHtml(t(`view.${name}`))} <span class="count" data-count="${name}" data-count-value="${escapeHtml(counts[name])}">${escapeHtml(formatUiNumber(locale, counts[name]))}</span></button>`).join("");
  const panels = VIEW_ORDER.map((name, index) => `<section class="panel" role="tabpanel" data-panel="${name}"${index === 0 ? "" : " hidden"}>${views[name].length ? `<div class="list"${truncated[name] ? " data-truncated=\"true\"" : ""}>${views[name].map(row).join("")}</div>${truncated[name] ? `<p class="muted" data-truncated-note>${escapeHtml(t("inbox.truncated", { shown: formatUiNumber(locale, views[name].length), total: formatUiNumber(locale, counts[name]) }))}</p>` : ""}` : `<div class="empty">${escapeHtml(t("inbox.empty", { view: t(`view.${name}`) }))}</div>`}</section>`).join("");
  const timelineRows = timeline.length ? timeline.map(entry => `<li data-timeline="${escapeHtml(entry.kind)}"><time datetime="${escapeHtml(entry.at)}">${escapeHtml(entry.at)}</time> · ${escapeHtml(entry.summary)}${entry.actor ? ` · ${escapeHtml(entry.actor)}` : ""}</li>`).join("") : `<li class="muted">${escapeHtml(t("inbox.timelineEmpty"))}</li>`;
  const sloRows = slo.slos.map(item => `<tr data-slo="${escapeHtml(item.projection)}" data-slo-status="${escapeHtml(item.status)}"><td>${escapeHtml(item.label)}</td><td>${escapeHtml(formatUiNumber(locale, item.objectiveSeconds))}s</td><td>${item.lagSeconds === null ? "—" : `${escapeHtml(formatUiNumber(locale, item.lagSeconds))}s`}</td><td><span class="pill ${SLO_CLASS[item.status] ?? ""}">${escapeHtml(t(`slo.${item.status}`))}</span></td></tr>`).join("");
  const config = JSON.stringify({ base, messages: { working: t("ui.working"), done: t("ui.done"), failed: t("ui.failed"), offline: t("ui.offline"), chatLink: t("ui.chatLink") } }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${locale}" dir="${direction}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hero · ${escapeHtml(t("inbox.title"))}</title>
    <style>
      :root { --ink:#162238; --muted:#607089; --line:#dbe3ef; --surface:#fff; --canvas:#f4f7fb; --primary:#285ea8; --teal:#066356; --amber:#855000; --rose:#b03d5d; }
      * { box-sizing:border-box; } body { margin:0; color:var(--ink); background:var(--canvas); font-family:Vazirmatn,sans-serif; line-height:1.7; }
      main { width:min(1100px,calc(100% - 30px)); margin:0 auto; padding:28px 0 50px; }
      .top,.section { border:1px solid var(--line); border-radius:16px; background:var(--surface); box-shadow:0 10px 26px rgba(24,53,93,.05); } .top { padding:18px 20px; margin-bottom:16px; } .section { padding:16px; margin-top:14px; }
      h1 { margin:0 0 4px; font-size:clamp(1.3rem,3vw,1.9rem); } h2 { margin:0 0 10px; font-size:1.02rem; } .muted,.meta { color:var(--muted); font-size:.8rem; } .meta { overflow-wrap:anywhere; }
      .tabs { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; } .tab { padding:8px 14px; border:1px solid var(--line); border-radius:999px; background:var(--surface); color:var(--ink); cursor:pointer; font:inherit; font-size:.84rem; } .tab[aria-selected="true"] { background:var(--primary); border-color:var(--primary); color:var(--hero-on-brand, #fff); } .count { font-weight:700; }
      .list { display:grid; gap:8px; } .row { padding:10px 12px; border:1px solid #e6ebf3; border-radius:10px; background:var(--surface); } .head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; } .actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
      .pill { padding:2px 8px; border-radius:999px; background:var(--primary-soft); color:var(--muted); font-size:.72rem; font-weight:700; white-space:nowrap; } .pill.good { background:var(--teal-soft); color:var(--teal); } .pill.warn { background:var(--amber-soft); color:var(--amber); } .pill.bad { background:var(--rose-soft); color:var(--rose); }
      .empty { padding:12px; border:1px dashed #cad4e2; border-radius:10px; color:var(--muted); text-align:center; font-size:.82rem; }
      button[data-act] { padding:5px 12px; border:1px solid var(--primary); border-radius:9px; background:var(--surface); color:var(--primary); cursor:pointer; font:inherit; font-size:.78rem; }
      table { width:100%; border-collapse:collapse; font-size:.82rem; } th,td { padding:6px 8px; text-align:start; border-bottom:1px solid #eef2f8; } th { color:var(--muted); } ul.timeline { list-style:none; margin:0; padding:0; display:grid; gap:4px; font-size:.82rem; }
      nav.crumbs { font-size:.8rem; color:var(--muted); margin-bottom:6px; } a { color:var(--primary); }
      ${getHeroShellStyles()}
    </style>
  </head>
  <body>
    ${getHeroGlobalNavigation({ active: "control", projectId, environment: "Private · Inbox" })}
    <main id="hero-main" tabindex="-1" data-project-id="${escapeHtml(projectId)}" data-viewer-role="${escapeHtml(viewerRole)}">
      <header class="top hero-page-header"><nav class="crumbs" aria-label="${escapeHtml(t("inbox.projects"))}"><a href="/api/portal?surface=portfolio&amp;select=project">${escapeHtml(t("inbox.projects"))}</a> / <a href="/api/portal?surface=studio&amp;projectId=${encodeURIComponent(projectId)}">${escapeHtml(project.name)}</a> / ${escapeHtml(t("inbox.title"))} · <a href="/api/portal?surface=inbox&amp;projectId=${encodeURIComponent(projectId)}&amp;lang=${other}" hreflang="${other}" data-locale-switch="${other}">${escapeHtml(t("ui.language"))}: ${other}</a></nav><h1>${escapeHtml(t("inbox.heading", { project: project.name }))}</h1><p class="muted">${escapeHtml(t("inbox.intro"))}${canAct ? "" : ` ${escapeHtml(t("inbox.viewerNote"))}`}</p><p class="muted" id="inbox-status" role="status" aria-live="polite"></p></header>
      <div class="tabs" role="tablist" aria-label="${escapeHtml(t("inbox.tabs"))}">${tabs}</div>
      ${panels}
      <section class="section" id="timeline"><h2>${escapeHtml(t("inbox.timeline"))}</h2><ul class="timeline">${timelineRows}</ul></section>
      <section class="section" id="slo"><h2>${escapeHtml(t("slo.title"))}</h2><div style="overflow:auto" tabindex="0"><table><thead><tr><th>${escapeHtml(t("slo.section"))}</th><th>${escapeHtml(t("slo.objective"))}</th><th>${escapeHtml(t("slo.lag"))}</th><th>${escapeHtml(t("slo.status"))}</th></tr></thead><tbody>${sloRows}</tbody></table></div><p class="muted">${escapeHtml(t("slo.note"))}</p></section>
    </main>
    <script>
      const CONFIG = ${config};
      const tabs = [...document.querySelectorAll('[data-tab]')]; const panels = [...document.querySelectorAll('[data-panel]')];
      tabs.forEach(tab => tab.addEventListener('click', () => { tabs.forEach(item => item.setAttribute('aria-selected', String(item === tab))); panels.forEach(panel => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; }); }));
      const status = document.querySelector('#inbox-status');
      document.querySelectorAll('button[data-act]').forEach(button => button.addEventListener('click', async () => {
        const action = button.dataset.act; status.textContent = CONFIG.messages.working;
        try {
          const response = await fetch(CONFIG.base + '/notifications/' + encodeURIComponent(button.dataset.notificationId) + '/act', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, minutes: 60, reason: 'inbox' }) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) { status.textContent = (payload.error?.message || payload.message || CONFIG.messages.failed) + (payload.code ? ' (' + payload.code + ')' : ''); return; }
          status.textContent = payload.link ? CONFIG.messages.chatLink + ' ' + payload.link : CONFIG.messages.done; if (!payload.link) setTimeout(() => location.reload(), 400);
        } catch { status.textContent = CONFIG.messages.offline; }
      }));
    </script>
    ${getHeroShellScript()}
  </body>
</html>`;
}
