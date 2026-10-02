import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";

function safeJson(value) {
  return JSON.stringify(value ?? null).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function fallbackPill(value) {
  const state = String(value ?? "unknown");
  const className = /^(active|ready|healthy|accepted|completed|clean|ok)$/i.test(state) ? "good" : /^(critical|failed|blocked|revoked)$/i.test(state) ? "bad" : "warn";
  return `<span class="pill ${className}">${escapeHtml(state)}</span>`;
}

function fallbackList(items, empty = "داده‌ای ثبت نشده است.") {
  if (!items?.length) return `<div class="empty">${escapeHtml(empty)}</div>`;
  return `<div class="list">${items.map(item => `<article class="row"><div class="head"><strong>${escapeHtml(item.title)}</strong>${fallbackPill(item.state)}</div><div class="meta">${escapeHtml(item.meta)}</div></article>`).join("")}</div>`;
}

function fallbackControlRoomMarkup(controlRoom) {
  if (!controlRoom) return { metrics: "", sections: '<section class="section full"><div class="empty">دادهٔ پروژه پیدا نشد.</div></section>' };
  const data = controlRoom;
  const metrics = [
    ["teams", "تیم فعال", "control.activeTeams"],
    ["commands", "فرمان", "control.commands"],
    ["entities", "دارایی کاتالوگ", "control.catalogEntities"],
    ["notifications", "اعلان باز", "control.openNotifications"],
    ["readiness", "آمادگی", "control.readiness"]
  ];
  const metricMarkup = metrics.map(([key, label, infoKey]) => `<article class="card metric"><strong>${escapeHtml(data.metrics?.[key] ?? 0)}</strong><span class="muted" data-hero-info-key="${escapeHtml(infoKey)}">${escapeHtml(label)}</span></article>`).join("");
  const sections = [
    ["همکاری و حافظه", data.collaboration?.teams, "control.collaborationMemory", "control.collaboration-memory"],
    ["فرمان و عملیات", data.commands?.items, "control.commandOperations", ""],
    ["Catalog و تغییرات", data.catalog?.items, "control.catalogDrift", ""],
    ["کارایی و سلامت", data.performance?.items, "control.performanceHealth", ""],
    ["Inbox و Observability", data.observability?.items, "control.inboxObservability", ""],
    ["زیرساخت", data.infrastructure?.items, "control.infrastructure", "control.infrastructure"],
    ["Delivery و Artifact", data.delivery?.items, "control.deliveryArtifacts", "control.delivery-artifacts"],
    ["Hardening", data.hardening?.items, "control.hardening", ""],
    ["Final Readiness", data.readiness?.items, "control.finalReadiness", "control.final-readiness"]
  ];
  const sectionMarkup = sections.map(([title, items, infoKey, guideTarget], index) => `<section class="section ${index < 2 ? "wide" : ""}"${guideTarget ? ` data-hero-guide-target="${escapeHtml(guideTarget)}"` : ""}><div class="head"><div><h2 data-hero-info-key="${escapeHtml(infoKey)}">${escapeHtml(title)}</h2></div></div>${fallbackList(items)}</section>`).join("");
  const infrastructure = data.infrastructure ?? {};
  const currentTarget = (infrastructure.targetSelections ?? []).find(selection => selection.environment === "test") ?? null;
  const testServers = (infrastructure.servers ?? []).filter(server => server.environment === "test" && server.state !== "revoked");
  const targetMarkup = testServers.length
    ? `<section class="section full" data-hero-guide-target="control.infrastructure"><div class="head"><div><h2>انتخاب سرور ساخت محصول</h2><p class="muted">این انتخاب فقط نسخه‌دار ثبت می‌شود؛ build، start یا dispatch خودکار انجام نمی‌شود.</p></div></div><form id="target-selection-form" class="target-form"><label>سرور Test<select name="serverId" required>${testServers.map(server => `<option value="${escapeHtml(server.serverId)}"${currentTarget?.serverId === server.serverId ? " selected" : ""}>${escapeHtml(`${server.serverId} · ${server.address}`)}</option>`).join("")}</select></label><input type="hidden" name="expectedVersion" value="${escapeHtml(currentTarget?.version ?? 0)}"><button type="submit">ثبت Target برای این پروژه</button><span id="target-selection-status" class="muted" role="status">${escapeHtml(currentTarget ? `Target فعلی: ${currentTarget.serverId} · نسخه ${currentTarget.version}` : "هنوز Targetی برای این پروژه انتخاب نشده است.")}</span></form></section>`
    : `<section class="section full" data-hero-guide-target="control.infrastructure"><div class="head"><div><h2>انتخاب سرور ساخت محصول</h2><p class="muted">هنوز سرور Testای برای این پروژه ثبت نشده است. پس از ثبت metadata سرور، گزینهٔ انتخاب Target اینجا نمایش داده می‌شود.</p></div></div><div class="empty">Targetی برای انتخاب وجود ندارد.</div></section>`;
  return { metrics: metricMarkup, sections: sectionMarkup + targetMarkup };
}

export function getProjectControlRoomHtml({ initialData = null, dataEndpoint = "/project-control-data", active = "control", heading = "اتاق کنترل پروژه", environment = "Private · Operations" } = {}) {
  const initialDataJson = safeJson(initialData);
  const fallbackMarkup = fallbackControlRoomMarkup(initialData?.controlRoom);
  const projectId = initialData?.controlRoom?.project?.projectId ?? null;
  const projectQuery = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const endpoint = projectId ? `${dataEndpoint}${dataEndpoint.includes("?") ? "&" : "?"}projectId=${encodeURIComponent(projectId)}` : dataEndpoint;
  const dataEndpointJson = safeJson(endpoint);
  const initialHeading = projectId ? `${heading}: ${initialData.controlRoom.project.name}` : heading;
  const headerGuideTarget = active === "backoffice" ? "control.command-center" : "control.project-operations";
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hero · اتاق کنترل پروژه</title>
    <style>
      ${getHeroShellStyles()}
      :root { color-scheme: light; --ink:#162238; --muted:#607089; --line:#dbe3ef; --surface:#fff; --canvas:#f4f7fb; --primary:#285ea8; --teal:#087f70; --amber:#a36208; --rose:#b03d5d; }
      * { box-sizing:border-box; } body { margin:0; color:var(--ink); background:var(--canvas); font-family:Vazirmatn,sans-serif; line-height:1.65; } main { width:min(1380px,calc(100% - 30px)); margin:0 auto; padding:28px 0 50px; } .top { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; margin-bottom:18px; padding:19px 20px; border:1px solid var(--line); border-radius:18px; background:linear-gradient(135deg,var(--surface),#edf5ff); box-shadow:0 10px 26px rgba(24,53,93,.05); } h1,h2,h3,p { margin-top:0; } h1 { font-size:clamp(1.35rem,3vw,2.1rem); margin-bottom:4px; } h2 { font-size:1.03rem; margin-bottom:4px; } h3 { font-size:.88rem; margin-bottom:6px; } .muted { color:var(--muted); font-size:.84rem; } .helper-copy { display:none; } .actions { display:flex; flex-wrap:wrap; gap:8px; } button,.button { display:inline-flex; align-items:center; justify-content:center; min-height:38px; padding:7px 12px; border:1px solid var(--primary); border-radius:9px; background:var(--primary); color:#fff; cursor:pointer; text-decoration:none; font:inherit; font-size:.82rem; } .button.secondary { color:var(--primary); background:#fff; } .notice { margin:0 0 18px; padding:12px 14px; border:1px solid #c9d9ef; border-radius:12px; background:#edf5ff; color:#395d8d; font-size:.84rem; } .target-form { display:flex; flex-wrap:wrap; align-items:end; gap:10px; padding:12px; border:1px solid #dbe6f3; border-radius:12px; background:#f8fbff; } .target-form label { display:grid; gap:4px; min-width:260px; color:var(--muted); font-size:.78rem; } .target-form select { min-height:38px; padding:7px 9px; border:1px solid #cbd8e8; border-radius:8px; background:#fff; color:var(--ink); font:inherit; } .metrics,.grid { display:grid; gap:12px; } .metrics { grid-template-columns:repeat(5,minmax(0,1fr)); margin-bottom:18px; } .grid { grid-template-columns:repeat(3,minmax(0,1fr)); } .card,.section { border:1px solid var(--line); border-radius:14px; background:var(--surface); box-shadow:0 10px 26px rgba(24,53,93,.05); } .metric { padding:14px; } .metric strong { display:block; color:var(--primary); font-size:1.45rem; } .section { padding:17px; min-width:0; } .section.wide { grid-column:span 2; } .section.full { grid-column:1 / -1; } .head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; } .pill { display:inline-block; padding:3px 8px; border-radius:999px; background:#edf2f8; color:#52647d; font-weight:750; font-size:.72rem; white-space:nowrap; } .pill.good { background:#e5f7f2; color:var(--teal); } .pill.warn { background:#fff3dc; color:var(--amber); } .pill.bad { background:#fff0f3; color:var(--rose); } .list { display:grid; gap:8px; max-height:300px; overflow:auto; } .row { padding:10px; border:1px solid #e6ebf3; border-radius:10px; background:#fbfcfe; } .row strong { display:block; overflow-wrap:anywhere; } .meta { margin-top:3px; color:var(--muted); font-size:.76rem; overflow-wrap:anywhere; } .empty { padding:14px; border:1px dashed #cad4e2; border-radius:10px; color:var(--muted); text-align:center; font-size:.82rem; } code { direction:ltr; unicode-bidi:embed; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.74rem; } @media(max-width:1020px){.metrics{grid-template-columns:repeat(3,minmax(0,1fr));}.grid{grid-template-columns:repeat(2,minmax(0,1fr));}.section.wide{grid-column:span 2;}} @media(max-width:640px){main{width:min(100% - 20px,680px);padding-top:20px}.top{display:block}.actions{margin-top:12px}.metrics,.grid{grid-template-columns:1fr}.section.wide,.section.full{grid-column:auto}.target-form label{min-width:100%;}}
    </style>
  </head>
  <body>
    ${getHeroGlobalNavigation({ active, projectId: initialData?.controlRoom?.project?.projectId ?? null, environment })}
    <main id="hero-main" tabindex="-1">
      <header class="top hero-page-header" data-hero-guide-target="${headerGuideTarget}"><div><p class="muted">Hero / Project Operations</p><h1 id="title" data-hero-info-key="control.projectOperations">${escapeHtml(initialHeading)}</h1><p id="subtitle" class="muted helper-copy">نمای خواندنی، project-scoped و redacted از وضعیت عملیاتی.</p></div><div class="actions"><a class="button secondary" id="studio-link" href="/api/portal?surface=studio${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}">Product Studio</a><a class="button secondary" href="/api/portal?surface=portfolio&select=project">تغییر پروژه</a><button id="refresh" type="button">به‌روزرسانی</button></div></header>
      <p class="notice">این صفحه فقط وضعیت و metadata امن را نمایش می‌دهد. Provider زنده، Dispatch بیرونی، Secret، Production و Pilot از این مسیر فعال نمی‌شوند.</p>
      <section id="metrics" class="metrics">${fallbackMarkup.metrics}</section>
      <section id="sections" class="grid" aria-live="polite">${fallbackMarkup.sections}</section>
    </main>
    <script>
      const $ = selector => document.querySelector(selector);
      const INITIAL_DATA = ${initialDataJson};
      const DATA_ENDPOINT = ${dataEndpointJson};
      let state = INITIAL_DATA;
      const escapeHtml = value => String(value ?? "—").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
      const pill = value => { const text = String(value ?? "unknown"); const cls = /^(active|ready|healthy|accepted|completed|clean|ok)$/i.test(text) ? "good" : /^(critical|failed|blocked|revoked)$/i.test(text) ? "bad" : "warn"; return '<span class="pill ' + cls + '">' + escapeHtml(text) + '</span>'; };
      const list = (items, empty = "داده‌ای ثبت نشده است.") => !items?.length ? '<div class="empty">' + empty + '</div>' : '<div class="list">' + items.map(item => '<article class="row"><div class="head"><strong>' + escapeHtml(item.title) + '</strong>' + pill(item.state) + '</div><div class="meta">' + escapeHtml(item.meta) + '</div></article>').join('') + '</div>';
      function render() {
        const data = state?.controlRoom;
        if (!data) { $('sections').innerHTML = '<div class="section full">دادهٔ پروژه پیدا نشد.</div>'; return; }
        const p = data.project;
        $('title').textContent = ${safeJson(heading + ": ")} + p.name;
        $('subtitle').innerHTML = '<code>' + escapeHtml(p.projectId) + '</code> · lifecycle: ' + escapeHtml(p.lifecycle) + ' · فقط metadata امن';
        $('studio-link').href = '/api/portal?surface=studio&projectId=' + encodeURIComponent(p.projectId);
        const m = data.metrics;
        $('metrics').innerHTML = [['teams','تیم فعال','control.activeTeams'],['commands','فرمان','control.commands'],['entities','دارایی کاتالوگ','control.catalogEntities'],['notifications','اعلان باز','control.openNotifications'],['readiness','آمادگی','control.readiness']].map(([key,label,infoKey]) => '<article class="card metric"><strong>' + escapeHtml(m[key] ?? 0) + '</strong><span class="muted" data-hero-info-key="' + infoKey + '">' + label + '</span></article>').join('');
        const sections = [
          ['همکاری و حافظه', data.collaboration.teams, 'تیم‌ها و Contextهای ثبت‌شده؛ متن Conversation و Memory نمایش داده نمی‌شود.', 'control.collaborationMemory', 'control.collaboration-memory'],
          ['فرمان و عملیات', data.commands.items, 'فقط صف، تأیید و checkpointهای داخلی؛ Dispatch بیرونی ندارد.', 'control.commandOperations', null],
          ['Catalog و تغییرات', data.catalog.items, 'دارایی‌های ثبت‌شده و Driftهای پیشنهادی؛ بدون fetch بیرونی.', 'control.catalogDrift', null],
          ['کارایی و سلامت', data.performance.items, 'Ledger، بودجه و Health با metadata و شمارش امن.', 'control.performanceHealth', null],
          ['Inbox و Observability', data.observability.items, 'اعلان، correlation و auditهای redacted.', 'control.inboxObservability', null],
          ['زیرساخت', data.infrastructure.items, 'فقط metadata محیط/Node/Secret reference؛ مقدار Secret نمایش داده نمی‌شود.', 'control.infrastructure', 'control.infrastructure'],
          ['Delivery و Artifact', data.delivery.items, 'Release/artifact/evidence record-only؛ هیچ Deployی اجرا نمی‌شود.', 'control.deliveryArtifacts', 'control.delivery-artifacts'],
          ['Hardening', data.hardening.items, 'Retention، cleanup dry-run و audit coverage.', 'control.hardening', null],
          ['Final Readiness', data.readiness.items, 'Scenario، traceability و گیت پذیرش مالک.', 'control.finalReadiness', 'control.final-readiness']
        ];
        const infrastructure = data.infrastructure || {};
        const currentTarget = (infrastructure.targetSelections || []).find(selection => selection.environment === 'test') || null;
        const testServers = (infrastructure.servers || []).filter(server => server.environment === 'test' && server.state !== 'revoked');
        const targetForm = testServers.length ? '<section class="section full" data-hero-guide-target="control.infrastructure"><div class="head"><div><h2>انتخاب سرور ساخت محصول</h2><p class="muted">ادمین می‌تواند Target تست این پروژه را انتخاب کند. این کار فقط انتخاب نسخه‌دار را ثبت می‌کند و هنوز build، start یا dispatch اجرا نمی‌شود.</p></div></div><form id="target-selection-form" class="target-form"><label>سرور Test<select name="serverId" required>' + testServers.map(server => '<option value="' + escapeHtml(server.serverId) + '"' + (currentTarget?.serverId === server.serverId ? ' selected' : '') + '>' + escapeHtml(server.serverId + ' · ' + server.address) + '</option>').join('') + '</select></label><input type="hidden" name="expectedVersion" value="' + escapeHtml(currentTarget?.version ?? 0) + '"><button type="submit">ثبت Target برای این پروژه</button><span id="target-selection-status" class="muted" role="status">' + escapeHtml(currentTarget ? 'Target فعلی: ' + currentTarget.serverId + ' · نسخه ' + currentTarget.version : 'هنوز Targetی برای این پروژه انتخاب نشده است.') + '</span></form></section>' : '';
        $('sections').innerHTML = sections.map(([title,items,help,infoKey,guideTarget], index) => '<section class="section ' + (index === 0 || index === 1 ? 'wide' : '') + '"' + (guideTarget ? ' data-hero-guide-target="' + guideTarget + '"' : '') + '><div class="head"><div><h2 data-hero-info-key="' + infoKey + '">' + title + '</h2><p class="muted helper-copy">' + help + '</p></div></div>' + list(items) + '</section>').join('') + targetForm;
        const targetSelectionForm = document.querySelector('#target-selection-form');
        if (targetSelectionForm) targetSelectionForm.addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(targetSelectionForm); const status = document.querySelector('#target-selection-status'); status.textContent = 'در حال ثبت انتخاب نسخه‌دار…'; try { const response = await fetch('/api/projects/' + encodeURIComponent(p.projectId) + '/infrastructure', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'select-target', serverId: form.get('serverId'), environment: 'test', expectedVersion: Number(form.get('expectedVersion')) }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'ثبت Target انجام نشد.'); status.textContent = 'Target با موفقیت ثبت شد؛ اجرای محصول هنوز جداگانه نیازمند مجوز Test است.'; await refresh(); } catch (error) { status.textContent = error.message || 'ثبت Target انجام نشد.'; } });
      }
      async function refresh() { if (!state?.controlRoom?.project?.projectId) return; const response = await fetch(DATA_ENDPOINT, {cache:'no-store'}); if (response.ok) { state = await response.json(); render(); } }
      $('refresh').addEventListener('click', refresh); render();
    </script>
    ${getHeroShellScript()}
  </body>
</html>`;
}
