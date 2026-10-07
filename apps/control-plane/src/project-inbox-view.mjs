import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
const VIEW_FA = Object.freeze({ "needs-decision": "نیازمند تصمیم من", critical: "بحرانی", upcoming: "نزدیک به مهلت", automation: "خودکار", resolved: "حل‌شده" });
const VIEW_ORDER = Object.freeze(["needs-decision", "critical", "upcoming", "automation", "resolved"]);
const ACTION_FA = Object.freeze({ approve: "تأیید", reject: "رد", "run-fix": "پیشنهاد رفع", snooze: "به‌تعویق", chat: "گفت‌وگو" });
const SLO_FA = Object.freeze({ meeting: "در هدف", breached: "خارج از هدف", "no-data": "بدون اندازه‌گیری", "measurement-stale": "اندازه‌گیری کهنه" });
const SLO_CLASS = Object.freeze({ meeting: "good", breached: "bad", "no-data": "", "measurement-stale": "warn" });
const SEVERITY_CLASS = Object.freeze({ critical: "bad", warning: "warn", info: "" });

/** Inbox (BO-113..BO-119): five views, real decision actions, timeline and the SLO of Hero's own projections. */
export function getProjectInboxHtml({ project, viewerRole, canAct, views, counts, timeline = [], slo }) {
  const projectId = project.projectId; const base = `/api/projects/${encodeURIComponent(projectId)}`;
  const buttons = item => canAct ? item.availableActions.filter(name => name !== "assign").map(name => `<button type="button" data-act="${escapeHtml(name)}" data-notification-id="${escapeHtml(item.notificationId)}">${escapeHtml(ACTION_FA[name] ?? name)}</button>`).join("") + (item.effectiveState === "open" ? `<button type="button" data-act="acknowledge" data-notification-id="${escapeHtml(item.notificationId)}">دیدم</button>` : "") : "";
  const row = item => `<article class="row" data-notification="${escapeHtml(item.notificationId)}" data-origin="${escapeHtml(item.origin)}"><div class="head"><strong>${escapeHtml(item.title)}</strong><span class="pill ${SEVERITY_CLASS[item.severity] ?? ""}">${escapeHtml(item.severity)}</span></div><div class="meta">${escapeHtml(item.category)} · ${item.origin === "automation" ? "خودکار" : "انسانی"} · وضعیت ${escapeHtml(item.effectiveState)}${item.nextDeadline ? ` · مهلت <time datetime="${escapeHtml(item.nextDeadline)}">${escapeHtml(item.nextDeadline)}</time>` : ""}${item.occurrences > 1 ? ` · ${escapeHtml(item.occurrences)} بار` : ""} · <a href="${base}/correlations/${encodeURIComponent(item.correlationId)}" data-correlation>ردیابی</a></div><div class="actions">${buttons(item)}</div></article>`;
  const tabs = VIEW_ORDER.map((name, index) => `<button type="button" role="tab" class="tab" data-tab="${name}" aria-selected="${index === 0}">${VIEW_FA[name]} <span class="count" data-count="${name}">${escapeHtml(counts[name])}</span></button>`).join("");
  const panels = VIEW_ORDER.map((name, index) => `<section class="panel" role="tabpanel" data-panel="${name}"${index === 0 ? "" : " hidden"}>${views[name].length ? `<div class="list">${views[name].map(row).join("")}</div>` : `<div class="empty">موردی در «${VIEW_FA[name]}» نیست.</div>`}</section>`).join("");
  const timelineRows = timeline.length ? timeline.map(entry => `<li data-timeline="${escapeHtml(entry.kind)}"><time datetime="${escapeHtml(entry.at)}">${escapeHtml(entry.at)}</time> · ${escapeHtml(entry.summary)}${entry.actor ? ` · ${escapeHtml(entry.actor)}` : ""}</li>`).join("") : `<li class="muted">رویدادی ثبت نشده است.</li>`;
  const sloRows = slo.slos.map(item => `<tr data-slo="${escapeHtml(item.projection)}" data-slo-status="${escapeHtml(item.status)}"><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.objectiveSeconds)}s</td><td>${item.lagSeconds === null ? "—" : `${escapeHtml(item.lagSeconds)}s`}</td><td><span class="pill ${SLO_CLASS[item.status] ?? ""}">${escapeHtml(SLO_FA[item.status] ?? item.status)}</span></td></tr>`).join("");
  const config = JSON.stringify({ base }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hero · صندوق ورودی</title>
    <style>
      :root { --ink:#162238; --muted:#607089; --line:#dbe3ef; --surface:#fff; --canvas:#f4f7fb; --primary:#285ea8; --teal:#087f70; --amber:#a36208; --rose:#b03d5d; }
      * { box-sizing:border-box; } body { margin:0; color:var(--ink); background:var(--canvas); font-family:Vazirmatn,sans-serif; line-height:1.7; }
      main { width:min(1100px,calc(100% - 30px)); margin:0 auto; padding:28px 0 50px; }
      .top,.section { border:1px solid var(--line); border-radius:16px; background:var(--surface); box-shadow:0 10px 26px rgba(24,53,93,.05); } .top { padding:18px 20px; margin-bottom:16px; } .section { padding:16px; margin-top:14px; }
      h1 { margin:0 0 4px; font-size:clamp(1.3rem,3vw,1.9rem); } h2 { margin:0 0 10px; font-size:1.02rem; } .muted,.meta { color:var(--muted); font-size:.8rem; } .meta { overflow-wrap:anywhere; }
      .tabs { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; } .tab { padding:8px 14px; border:1px solid var(--line); border-radius:999px; background:#fff; color:var(--ink); cursor:pointer; font:inherit; font-size:.84rem; } .tab[aria-selected="true"] { background:var(--primary); border-color:var(--primary); color:#fff; } .count { font-weight:700; }
      .list { display:grid; gap:8px; } .row { padding:10px 12px; border:1px solid #e6ebf3; border-radius:10px; background:#fbfcfe; } .head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; } .actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
      .pill { padding:2px 8px; border-radius:999px; background:#edf2f8; color:#52647d; font-size:.72rem; font-weight:700; white-space:nowrap; } .pill.good { background:#e5f7f2; color:var(--teal); } .pill.warn { background:#fff3dc; color:var(--amber); } .pill.bad { background:#fff0f3; color:var(--rose); }
      .empty { padding:12px; border:1px dashed #cad4e2; border-radius:10px; color:var(--muted); text-align:center; font-size:.82rem; }
      button[data-act] { padding:5px 12px; border:1px solid var(--primary); border-radius:9px; background:#fff; color:var(--primary); cursor:pointer; font:inherit; font-size:.78rem; }
      table { width:100%; border-collapse:collapse; font-size:.82rem; } th,td { padding:6px 8px; text-align:start; border-bottom:1px solid #eef2f8; } th { color:var(--muted); } ul.timeline { list-style:none; margin:0; padding:0; display:grid; gap:4px; font-size:.82rem; }
      nav.crumbs { font-size:.8rem; color:var(--muted); margin-bottom:6px; } a { color:var(--primary); }
      ${getHeroShellStyles()}
    </style>
  </head>
  <body>
    ${getHeroGlobalNavigation({ active: "control", projectId, environment: "Private · Inbox" })}
    <main id="hero-main" tabindex="-1" data-project-id="${escapeHtml(projectId)}" data-viewer-role="${escapeHtml(viewerRole)}">
      <header class="top hero-page-header"><nav class="crumbs" aria-label="مسیر"><a href="/api/portal?surface=portfolio&amp;select=project">پروژه‌ها</a> / <a href="/api/portal?surface=studio&amp;projectId=${encodeURIComponent(projectId)}">${escapeHtml(project.name)}</a> / صندوق ورودی</nav><h1>صندوق ورودی ${escapeHtml(project.name)}</h1><p class="muted">تأیید و رد همین‌جا روی فرمان واقعی اعمال می‌شود؛ «پیشنهاد رفع» فقط پیش‌نویس می‌سازد و هرگز اجرا نمی‌کند.${canAct ? "" : " شما بیننده هستید و فقط می‌خوانید."}</p><p class="muted" id="inbox-status" role="status" aria-live="polite"></p></header>
      <div class="tabs" role="tablist" aria-label="نمای صندوق">${tabs}</div>
      ${panels}
      <section class="section" id="timeline"><h2>خط زمانی</h2><ul class="timeline">${timelineRows}</ul></section>
      <section class="section" id="slo"><h2>هدف‌های سرویس (SLO)</h2><div style="overflow:auto"><table><thead><tr><th>بخش</th><th>هدف</th><th>تأخیر اندازه‌گیری‌شده</th><th>وضعیت</th></tr></thead><tbody>${sloRows}</tbody></table></div><p class="muted">بخشی که اندازه‌گیری تازه ندارد سالم فرض نمی‌شود.</p></section>
    </main>
    <script>
      const CONFIG = ${config};
      const tabs = [...document.querySelectorAll('[data-tab]')]; const panels = [...document.querySelectorAll('[data-panel]')];
      tabs.forEach(tab => tab.addEventListener('click', () => { tabs.forEach(item => item.setAttribute('aria-selected', String(item === tab))); panels.forEach(panel => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; }); }));
      const status = document.querySelector('#inbox-status');
      document.querySelectorAll('button[data-act]').forEach(button => button.addEventListener('click', async () => {
        const action = button.dataset.act; status.textContent = 'در حال انجام…';
        try {
          const response = await fetch(CONFIG.base + '/notifications/' + encodeURIComponent(button.dataset.notificationId) + '/act', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, minutes: 60, reason: 'inbox' }) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) { status.textContent = (payload.error?.message || payload.message || 'انجام نشد.') + (payload.code ? ' (' + payload.code + ')' : ''); return; }
          status.textContent = payload.link ? 'پیوند گفت‌وگو: ' + payload.link : 'انجام شد.'; if (!payload.link) setTimeout(() => location.reload(), 400);
        } catch { status.textContent = 'ارتباط برقرار نشد.'; }
      }));
    </script>
    ${getHeroShellScript()}
  </body>
</html>`;
}
