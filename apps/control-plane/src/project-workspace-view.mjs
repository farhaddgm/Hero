import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";

function safeJson(value) {
  return JSON.stringify(value ?? null).replaceAll("&", "\\u0026").replaceAll("<", "\\u003c").replaceAll(">", "\\u003e");
}

/** Human-session project console. Basic Auth protects the network surface and
 * every mutation is authorized again by the project-scoped API. */
export function getProjectWorkspaceHtml({ projectId }) {
  const initial = safeJson({ projectId });
  const projectQuery = encodeURIComponent(String(projectId ?? ""));
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex,notranslate">
  <title>Hero · فضای کاری پروژه</title>
  <style>
    ${getHeroShellStyles()}
    :root { font-family: Vazirmatn, sans-serif; }
    * { box-sizing: border-box; }
    body { min-width: 320px; margin: 0; background: var(--hero-canvas); color: var(--hero-ink); }
    main { width: min(1300px, calc(100% - 38px)); margin: auto; padding: 30px 0 60px; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 7px; font-size: clamp(1.55rem, 3vw, 2.35rem); letter-spacing: -.04em; }
    h2 { margin-bottom: 7px; font-size: 1rem; } h3 { margin-bottom: 5px; font-size: .9rem; }
    .top, .row, .actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .top { align-items: flex-start; margin-bottom: 18px; padding: 19px 20px; border: 1px solid var(--hero-line); border-radius: 18px; background: linear-gradient(135deg, var(--hero-surface), color-mix(in srgb, var(--hero-brand-soft) 45%, var(--hero-surface))); box-shadow: var(--hero-shadow-sm); }
    .eyebrow { margin: 0 0 7px; color: var(--hero-brand); font: 850 10px/1.3 system-ui,sans-serif; letter-spacing: .13em; direction: ltr; }
    .muted, .meta { color: var(--hero-muted); line-height: 1.8; } .meta { margin: 0; font-size: .76rem; }
    .button, button { min-height: 38px; padding: 8px 12px; border: 1px solid var(--hero-brand); border-radius: 10px; background: var(--hero-brand); color: #fff; cursor: pointer; font: 750 .78rem/1.4 inherit; }
    .button { display: inline-flex; align-items: center; text-decoration: none; }
    button.secondary, .button.secondary { border-color: var(--hero-line); background: var(--hero-surface); color: var(--hero-brand); }
    button:disabled { opacity: .48; cursor: not-allowed; }
    button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 3px solid color-mix(in srgb,var(--hero-brand) 40%,transparent); outline-offset: 3px; }
    .notice { margin: 0 0 16px; padding: 12px 14px; border: 1px solid color-mix(in srgb,var(--hero-brand) 20%,var(--hero-line)); border-radius: 12px; background: var(--hero-brand-soft); color: color-mix(in srgb,var(--hero-brand) 72%,var(--hero-ink)); font-size: .78rem; line-height: 1.8; }
    .context { margin-bottom: 15px; padding: 16px 18px; border: 1px solid var(--hero-line); border-radius: 15px; background: var(--hero-surface); box-shadow: var(--hero-shadow-sm); }
    .grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
    .panel { min-width: 0; padding: 18px; border: 1px solid var(--hero-line); border-radius: 16px; background: var(--hero-surface); box-shadow: var(--hero-shadow-sm); }
    .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 11px; margin-bottom: 13px; padding-bottom: 12px; border-bottom: 1px solid var(--hero-line); }
    .panel-head-copy { min-width: 0; }.panel-head-actions { display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex-wrap: wrap; }.recall-picker { min-width: 0; }.recall-picker select { max-width: 210px; min-height: 34px; padding: 6px 8px; font-size: .71rem; }.recall { min-height: 34px !important; padding: 6px 9px !important; white-space: nowrap; }
    .form { display: grid; gap: 10px; }.two { grid-template-columns: repeat(2,minmax(0,1fr)); }.three { grid-template-columns: repeat(3,minmax(0,1fr)); }.form-toolbar { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: end; gap: 10px; }.run-id-field[hidden] { display: none; }
    label { display: grid; gap: 6px; color: var(--hero-muted); font-size: .75rem; font-weight: 750; }
    input, select, textarea { width: 100%; min-height: 39px; padding: 8px 10px; border: 1px solid var(--hero-line-strong); border-radius: 9px; background: var(--hero-surface); color: var(--hero-ink); font: inherit; }
    textarea { min-height: 82px; resize: vertical; }
    .list { display: grid; gap: 8px; max-height: 300px; overflow: auto; margin-top: 12px; }
    .card { padding: 11px 12px; border: 1px solid var(--hero-line); border-radius: 11px; background: var(--hero-canvas); }
    .card strong { display: block; overflow-wrap: anywhere; font-size: .78rem; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 999px; background: var(--hero-success-soft); color: var(--hero-success); font-size: .68rem; font-weight: 800; }
    .pill::before { width: 6px; height: 6px; border-radius: 50%; background: currentColor; content: ""; }
    .pill.warn { background: var(--hero-warning-soft); color: var(--hero-warning); }
    .status { min-height: 22px; margin: 9px 0 0; font-size: .78rem; }.ok { color: var(--hero-success); }.error { color: var(--hero-danger); }
    .code { direction: ltr; unicode-bidi: embed; font-family: ui-monospace,SFMono-Regular,Consolas,monospace; font-size: .72rem; }
    [hidden] { display: none !important; }
    @media (max-width: 780px) { main { width: min(100% - 20px,780px); padding-top: 20px; }.grid,.two,.three,.form-toolbar { grid-template-columns: 1fr; }.top { display: block; }.top .actions { margin-top: 12px; justify-content: flex-start; }.panel-head { display: block; }.panel-head-actions { justify-content: flex-start; margin-top: 10px; }.recall-picker select { max-width: 100%; width: 100%; } }
  </style>
</head>
<body>
  ${getHeroGlobalNavigation({ active: "workspace", projectId, environment: "Private · Workspace" })}
  <main id="hero-main" tabindex="-1">
    <header class="top hero-page-header"><div class="hero-page-copy"><p class="eyebrow">PROJECT / WORKSPACE & POLICY</p><h1 data-hero-info-key="workspace.projectContext">فضای کاری و تنظیمات پروژه</h1><p class="muted">مدیریت داده و تنظیمات پروژهٔ فعال</p></div><div class="actions hero-page-actions"><a class="button secondary" href="/api/portal?surface=portfolio">Portfolio</a><a class="button secondary" id="studio" href="/api/portal?surface=studio&projectId=${projectQuery}">Product Studio</a><a class="button secondary" id="control" href="/api/portal?surface=control&projectId=${projectQuery}">عملیات</a><button id="refresh" class="secondary" type="button">بازخوانی</button></div></header>
    <p class="notice">Basic Auth فقط مرز شبکه است. مشاهده و تغییر پروژه به نشست انسانی و ProjectGrant نیاز دارد؛ Secret، Provider و Deploy از این فرم‌ها اجرا نمی‌شوند.</p>
    <section class="context"><div class="row"><div><h2 id="project-name" data-hero-info-key="workspace.projectContext">در حال بارگذاری…</h2><p id="session" class="meta">در انتظار نشست انسانی</p></div><span id="lifecycle" class="pill warn">unknown</span></div><p id="status" class="status" role="status" aria-live="polite"></p></section>
    <section id="content" class="grid" hidden>
      <section class="panel" data-hero-guide-target="workspace.intake"><div class="panel-head"><div class="panel-head-copy"><h2 data-hero-info-key="workspace.intake">Intake</h2></div><div class="panel-head-actions"><span data-hero-info-key="workspace.recall" data-hero-info-label="فراخوانی"></span><button id="intake-recall" class="write secondary recall" type="button" disabled>فراخوانی</button></div></div><form id="intake-form" class="form"><label>هدف<input name="goal" required maxlength="500"></label><label>کاربران<input name="users" required maxlength="500"></label><label>خودکارسازی<select name="autonomy"><option value="approval-each-stage">تأیید در هر مرحله</option><option value="approved-autonomous">خودکار پس از تأیید</option></select></label><button class="write" type="submit">ثبت Intake</button></form></section>
      <section class="panel" data-hero-guide-target="workspace.foundation"><div class="panel-head"><div class="panel-head-copy"><h2 data-hero-info-key="workspace.foundationProposal">Foundation Proposal</h2></div><div class="panel-head-actions"><span data-hero-info-key="workspace.recall" data-hero-info-label="فراخوانی"></span><select id="foundation-recall-choice" class="recall-picker" aria-label="بازنگری ثبت‌شده"></select><button id="foundation-recall" class="write secondary recall" type="button" disabled>فراخوانی</button></div></div><div id="foundation" class="list"></div><form id="foundation-form" class="form"><label>دلیل بازنگری<textarea name="reason" maxlength="500" placeholder="علت تغییر یا تأیید"></textarea></label><div class="actions"><button class="write" name="action" value="approve" type="submit">تأیید Foundation</button><button class="write secondary" name="action" value="revise" type="submit">درخواست بازنگری</button></div></form></section>
      <section class="panel" data-hero-guide-target="workspace.project-inputs"><div class="panel-head"><div class="panel-head-copy"><h2 data-hero-info-key="workspace.projectInputs">ورودی پروژه</h2></div><div class="panel-head-actions"><span data-hero-info-key="workspace.recall" data-hero-info-label="فراخوانی"></span><select id="input-recall-choice" class="recall-picker" aria-label="ورودی ثبت‌شده"></select><button id="input-recall" class="write secondary recall" type="button" disabled>فراخوانی</button></div></div><form id="upload-form" class="form"><div class="two"><label>نام فایل<input name="filename" value="brief.txt" required maxlength="240"></label><label>نوع ورودی<select name="type" disabled><option value="text">متن خصوصی</option></select></label></div><label>متن<textarea name="content" maxlength="524288" required></textarea></label><button class="write" type="submit">ثبت ورودی متن</button></form><form id="link-form" class="form two" style="margin-top:12px"><label>لینک عمومی HTTPS<input name="url" type="url" placeholder="https://…" required></label><label>عنوان<input name="label" maxlength="240" required></label><div><button class="write" type="submit">ثبت لینک برای بررسی</button></div></form><div id="inputs" class="list"></div></section>
      <section class="panel" data-hero-guide-target="workspace.versioned-settings"><div class="panel-head"><div class="panel-head-copy"><h2 data-hero-info-key="workspace.versionedSettings">تنظیمات نسخه‌دار</h2></div><div class="panel-head-actions"><span data-hero-info-key="workspace.recall" data-hero-info-label="فراخوانی"></span><select id="setting-recall-choice" class="recall-picker" aria-label="تنظیم ثبت‌شده"></select><button id="setting-recall" class="write secondary recall" type="button" disabled>فراخوانی</button></div></div><form id="setting-form" class="form"><div class="two"><label>الگوی متداول<span data-hero-info-key="workspace.settingPresets" data-hero-info-label="راهنمای الگوی تنظیم"></span><select id="setting-preset" aria-label="الگوی متداول تنظیم"><option value="">مسیر دلخواه</option><option value="ai.defaultModel">مدل پیش‌فرض AI</option><option value="automation.mode">حالت خودکارسازی</option><option value="budget.tokenHardCap">سقف Token</option><option value="project.type">نوع پروژه</option><option value="project.riskLevel">سطح ریسک</option></select></label><label>مسیر<input name="path" value="ai.defaultModel" required pattern="[A-Za-z][A-Za-z0-9.]{1,127}"></label></div><div class="two"><label>لایه<select name="layer"><option value="project-override">Project override</option><option value="run-override">Run override</option></select></label><label>مقدار JSON<input name="value" value='"luna"' required></label></div><label class="run-id-field" id="setting-run-id-field" hidden>شناسهٔ Run<input name="runId" pattern="[A-Za-z][A-Za-z0-9._:-]{2,127}" maxlength="128" autocomplete="off"></label><div class="two"><label>دلیل<input name="reason" minlength="3" required></label><label>اثر تغییر<select name="impact"><option value="نیازمند بررسی">نیازمند بررسی</option><option value="بهبود کیفیت خروجی">بهبود کیفیت خروجی</option><option value="کاهش هزینه">کاهش هزینه</option><option value="کاهش خطا و بازکاری">کاهش خطا و بازکاری</option><option value="تغییر زمان‌بندی">تغییر زمان‌بندی</option><option value="نیازمند ارزیابی امنیتی">نیازمند ارزیابی امنیتی</option></select></label></div><button class="write" type="submit">ثبت تنظیم</button></form><form id="policy-form" class="actions" style="margin-top:12px"><span data-hero-info-key="workspace.policyPack">Policy Pack</span><button class="write secondary" type="submit">اعمال Policy Pack تأییدشده</button></form><form id="rollback-form" class="form three" style="margin-top:12px"><div class="form-toolbar"><span data-hero-info-key="workspace.rollback">Rollback</span><span data-hero-info-key="workspace.recall" data-hero-info-label="فراخوانی"></span><button id="rollback-recall" class="write secondary recall" type="button" disabled>فراخوانی</button></div><label>مسیر<input name="path" value="ai.defaultModel" required></label><label>نسخهٔ مقصد<input name="toVersion" type="number" min="1" required></label><label>دلیل<input name="reason" minlength="3" required></label><div><button class="write secondary" type="submit">Rollback</button></div></form><div id="settings" class="list"></div></section>
    </section>
  </main>
  <script>(() => {
    const initial = ${initial};
    const state = { projectId: initial.projectId, overview: null, principal: null };
    const byId = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
    const setStatus = (text, kind = '') => { const node = byId('status'); node.textContent = text; node.className = 'status ' + kind; };
    async function api(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      if (options.body) headers['content-type'] = 'application/json';
      return fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
    }
    async function payload(response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || data.code || 'درخواست انجام نشد.'); return data; }
    function renderList(id, items, empty, renderer) { byId(id).innerHTML = items?.length ? items.map(renderer).join('') : '<p class="meta">' + esc(empty) + '</p>'; }
    function disableWrites() { document.querySelectorAll('.write').forEach(node => { node.disabled = true; node.title = 'این نشست اجازهٔ تغییر ندارد.'; }); }
    const editorSession = () => Boolean(state.principal && ['project-owner','admin'].includes(state.principal.role));
    const field = (formId, name) => byId(formId)?.elements?.namedItem(name);
    const setOptions = (id, entries, placeholder) => {
      const select = byId(id); if (!select) return;
      const previous = select.value; select.replaceChildren();
      if (!entries.length) { const option = document.createElement('option'); option.value = ''; option.textContent = placeholder; select.append(option); select.disabled = true; return; }
      entries.forEach(entry => { const option = document.createElement('option'); option.value = entry.value; option.textContent = entry.label; select.append(option); });
      select.disabled = false; select.value = entries.some(entry => entry.value === previous) ? previous : entries[0].value;
    };
    const selectedEntry = (id, entries) => entries.find(entry => entry.value === byId(id)?.value) || entries[0] || null;
    function renderRecallControls() {
      const overview = state.overview || {}; const editable = editorSession();
      const intake = overview.intake || {}; const hasIntake = Boolean(intake.goal && intake.users && intake.autonomy);
      byId('intake-recall').disabled = !editable || !hasIntake;
      const revisions = (overview.foundationProposal?.revisions || []).map((revision, index) => ({ value: String(index), label: 'بازنگری ' + (index + 1) + ' · ' + String(revision.reason || '').slice(0, 42), data: revision }));
      setOptions('foundation-recall-choice', revisions, 'بازنگری ثبت‌شده‌ای نیست'); byId('foundation-recall').disabled = !editable || !revisions.length;
      const inputs = (overview.inputs || []).map(input => ({ value: input.uploadId, label: (input.type === 'link' ? 'لینک · ' : 'متن · ') + String(input.label || input.filename || input.uploadId).slice(0, 52), data: input }));
      setOptions('input-recall-choice', inputs, 'ورودی ثبت‌شده‌ای نیست'); byId('input-recall').disabled = !editable || !inputs.length;
      const settings = (overview.settingHistory || []).map(record => ({ value: record.path + ':' + record.layer + ':' + record.version, label: record.path + ' · v' + record.version + ' · ' + record.layer, data: record }));
      setOptions('setting-recall-choice', settings, 'تنظیم ثبت‌شده‌ای نیست'); byId('setting-recall').disabled = !editable || !settings.length; byId('rollback-recall').disabled = !editable || !settings.length;
      state.recall = { revisions, inputs, settings };
    }
    function render() {
      const overview = state.overview; const project = overview.project;
      byId('content').hidden = false; byId('project-name').textContent = project.name + ' (' + project.projectId + ')'; byId('lifecycle').textContent = project.lifecycle;
      byId('studio').href = '/api/portal?surface=studio&projectId=' + encodeURIComponent(project.projectId); byId('control').href = '/api/portal?surface=control&projectId=' + encodeURIComponent(project.projectId);
      byId('session').textContent = state.principal ? 'کاربر: ' + state.principal.subject + ' · نقش: ' + state.principal.role : 'نشست انسانی یافت نشد';
      const foundation = overview.foundationProposal;
      byId('foundation').innerHTML = foundation ? '<article class="card"><strong>' + esc(foundation.state) + '</strong><p class="meta code">' + esc(foundation.proposalId) + ' · v' + esc(foundation.version) + '</p><p class="meta">' + esc((foundation.suggested?.roadmap || []).length) + ' گام پیشنهادی</p></article>' : '<p class="meta">Proposal موجود نیست.</p>';
      renderList('inputs', overview.inputs, 'ورودی‌ای ثبت نشده است.', item => '<article class="card"><strong>' + esc(item.filename || item.label || item.uploadId) + '</strong><p class="meta">' + esc(item.type) + ' · ' + esc(item.scan?.state || item.scan || item.fetchState || 'registered') + ' · ' + esc(item.checksum?.slice(0,12) || '') + '</p></article>');
      renderList('settings', overview.settings, 'تنظیم مؤثری نیست.', item => '<article class="card"><strong class="code">' + esc(item.path) + '</strong><p class="meta">' + esc(JSON.stringify(item.value)) + ' · ' + esc(item.layer) + ' · v' + esc(item.version) + ' · ' + esc(item.provenance || item.source || '') + '</p></article>');
      renderRecallControls();
      if (!state.principal || !['project-owner','admin'].includes(state.principal.role)) { disableWrites(); setStatus('این نشست مشاهده‌ای است و کنترل‌های تغییر غیرفعال شده‌اند.','error'); }
    }
    async function refresh() {
      if (!state.projectId) { setStatus('projectId در آدرس لازم است.','error'); return; }
      try { const me = await payload(await api('/api/identity/me')); state.principal = me.principal; const result = await payload(await api('/api/projects/' + encodeURIComponent(state.projectId) + '/workspace-overview')); state.overview = result.overview; render(); setStatus('دادهٔ پروژه بازخوانی شد.','ok'); } catch (error) { setStatus(error.message,'error'); }
    }
    function onSubmit(id, handler) { byId(id).addEventListener('submit', async event => { event.preventDefault(); try { await handler(new FormData(event.currentTarget), event.submitter); await refresh(); } catch (error) { setStatus(error.message,'error'); } }); }
    onSubmit('intake-form', async form => { const p = state.overview.project; await payload(await api('/api/projects/' + p.projectId + '/intake',{method:'POST',body:JSON.stringify({expectedVersion:p.version,intake:{goal:form.get('goal'),users:form.get('users'),autonomy:form.get('autonomy')}})})); });
    onSubmit('foundation-form', async (form, button) => { const p = state.overview.project; const proposal = state.overview.foundationProposal; if (!proposal) throw new Error('Foundation موجود نیست.'); const base = '/api/projects/' + p.projectId + '/foundation/'; if (button?.value === 'approve') await payload(await api(base + 'approve',{method:'POST',body:JSON.stringify({proposalId:proposal.proposalId,expectedVersion:proposal.version,riskApproval:true})})); else await payload(await api(base + 'revise',{method:'POST',body:JSON.stringify({proposalId:proposal.proposalId,expectedVersion:proposal.version,changes:{},reason:form.get('reason')})})); });
    onSubmit('upload-form', async form => { const p = state.overview.project; await payload(await api('/api/projects/' + p.projectId + '/inputs/upload',{method:'POST',body:JSON.stringify({type:'text',filename:form.get('filename'),content:form.get('content'),mimeType:'text/plain'})})); });
    onSubmit('link-form', async form => { const p = state.overview.project; await payload(await api('/api/projects/' + p.projectId + '/inputs/link',{method:'POST',body:JSON.stringify({url:form.get('url'),label:form.get('label')})})); });
    onSubmit('setting-form', async form => { const p = state.overview.project; let value; try { value = JSON.parse(form.get('value')); } catch { throw new Error('مقدار باید JSON معتبر باشد.'); } const layer = form.get('layer'); const runId = String(form.get('runId') || '').trim(); if (layer === 'run-override' && !runId) throw new Error('برای Run override، شناسهٔ Run را وارد کنید.'); await payload(await api('/api/projects/' + p.projectId + '/settings',{method:'POST',body:JSON.stringify({path:form.get('path'),value,layer,runId: layer === 'run-override' ? runId : null,reason:form.get('reason'),impact:form.get('impact')})})); });
    onSubmit('policy-form', async () => { const p = state.overview.project; await payload(await api('/api/projects/' + p.projectId + '/settings/policy-pack/apply',{method:'POST',body:JSON.stringify({reason:'Applied from Workspace Console'})})); });
    onSubmit('rollback-form', async form => { const p = state.overview.project; await payload(await api('/api/projects/' + p.projectId + '/settings/rollback',{method:'POST',body:JSON.stringify({path:form.get('path'),toVersion:Number(form.get('toVersion')),reason:form.get('reason')})})); });
    const settingPresets = Object.freeze({
      'ai.defaultModel': { path: 'ai.defaultModel', value: '"luna"', impact: 'بهبود کیفیت خروجی' },
      'automation.mode': { path: 'automation.mode', value: '"propose-first"', impact: 'کاهش خطا و بازکاری' },
      'budget.tokenHardCap': { path: 'budget.tokenHardCap', value: '250000', impact: 'کاهش هزینه' },
      'project.type': { path: 'project.type', value: '"application"', impact: 'نیازمند بررسی' },
      'project.riskLevel': { path: 'project.riskLevel', value: '"standard"', impact: 'نیازمند ارزیابی امنیتی' }
    });
    const syncRunIdField = () => { const isRunOverride = field('setting-form','layer').value === 'run-override'; const wrapper = byId('setting-run-id-field'); const runId = field('setting-form','runId'); wrapper.hidden = !isRunOverride; runId.required = isRunOverride; if (!isRunOverride) runId.value = ''; };
    byId('setting-preset').addEventListener('change', event => { const preset = settingPresets[event.target.value]; if (!preset) return; field('setting-form','path').value = preset.path; field('setting-form','value').value = preset.value; field('setting-form','impact').value = preset.impact; });
    field('setting-form','layer').addEventListener('change', syncRunIdField); syncRunIdField();
    byId('intake-recall').addEventListener('click', () => { const intake = state.overview?.intake; if (!intake) return; field('intake-form','goal').value = intake.goal || ''; field('intake-form','users').value = intake.users || ''; field('intake-form','autonomy').value = intake.autonomy || 'approval-each-stage'; setStatus('آخرین Intake ثبت‌شده در فیلدها فراخوانی شد؛ برای ساخت نسخهٔ جدید، آن را ثبت کنید.','ok'); });
    byId('foundation-recall').addEventListener('click', () => { const entry = selectedEntry('foundation-recall-choice', state.recall?.revisions || []); if (!entry) return; field('foundation-form','reason').value = entry.data.reason || ''; setStatus('دلیل بازنگری انتخاب‌شده در فیلد فراخوانی شد.','ok'); });
    byId('input-recall').addEventListener('click', async () => {
      const entry = selectedEntry('input-recall-choice', state.recall?.inputs || []); if (!entry) return;
      try {
        if (entry.data.type === 'link') { field('link-form','url').value = entry.data.url || ''; field('link-form','label').value = entry.data.label || entry.data.filename || ''; setStatus('لینک ثبت‌شده در فیلدها فراخوانی شد.','ok'); return; }
        const p = state.overview.project; const result = await payload(await api('/api/projects/' + encodeURIComponent(p.projectId) + '/inputs/' + encodeURIComponent(entry.data.uploadId) + '/recall'));
        field('upload-form','filename').value = result.input.filename || 'brief.txt'; field('upload-form','content').value = result.input.content || ''; setStatus('متن خصوصی پس از کنترل مجوز و checksum در فیلدها فراخوانی شد.','ok');
      } catch (error) { setStatus(error.message,'error'); }
    });
    byId('setting-recall').addEventListener('click', () => { const entry = selectedEntry('setting-recall-choice', state.recall?.settings || []); if (!entry) return; const record = entry.data; const supportedLayer = ['project-override','run-override'].includes(record.layer) ? record.layer : 'project-override'; field('setting-form','path').value = record.path; field('setting-form','value').value = JSON.stringify(record.value); field('setting-form','layer').value = supportedLayer; field('setting-form','runId').value = record.runId || ''; syncRunIdField(); field('setting-form','reason').value = record.reason || ''; field('setting-form','impact').value = record.impact || 'نیازمند بررسی'; byId('setting-preset').value = Object.hasOwn(settingPresets, record.path) ? record.path : ''; setStatus(record.layer === supportedLayer ? 'تنظیم نسخه‌دار در فیلدها فراخوانی شد؛ ثبت دوباره، نسخهٔ جدید ایجاد می‌کند.' : 'تنظیم محافظت‌شده به صورت Project override برای بازبینی فراخوانی شد؛ ثبت دوباره نسخهٔ جدید ایجاد می‌کند.','ok'); });
    byId('rollback-recall').addEventListener('click', () => { const entry = selectedEntry('setting-recall-choice', state.recall?.settings || []); if (!entry) return; const record = entry.data; field('rollback-form','path').value = record.path; field('rollback-form','toVersion').value = record.version; field('rollback-form','reason').value = 'بازگشت به نسخه ' + record.version + ' از ' + record.path; setStatus('مقصد Rollback از تنظیم انتخاب‌شده فراخوانی شد؛ قبل از ثبت، دلیل را بازبینی کنید.','ok'); });
    byId('refresh').addEventListener('click', refresh); refresh();
  })();</script>
  ${getHeroShellScript()}
</body></html>`;
}
