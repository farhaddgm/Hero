import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";
import { HERO_PROJECT_WALKTHROUGH_ENABLED_SETTING, HERO_PROJECT_WALKTHROUGH_STEPS, HERO_PROJECT_WALKTHROUGH_VERSION } from "./project-walkthrough.mjs";

function safeJson(value) {
  return JSON.stringify(value ?? null)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e");
}

export function getProjectWalkthroughHtml({ projectId = null } = {}) {
  const initial = safeJson({ projectId, version: HERO_PROJECT_WALKTHROUGH_VERSION, steps: HERO_PROJECT_WALKTHROUGH_STEPS });
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex,notranslate">
  <title>Hero · راهنمای ساخت پروژه</title>
  <style>
    ${getHeroShellStyles()}
    :root { font-family: Vazirmatn, sans-serif; }
    * { box-sizing: border-box; } body { min-width:320px; margin:0; background:var(--hero-canvas); color:var(--hero-ink); }
    main { width:min(1260px,calc(100% - 38px)); margin:0 auto; padding:32px 0 70px; } h1,h2,h3,p { margin-top:0; }
    .hero-head { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; margin-bottom:20px; padding:20px 21px; border:1px solid var(--hero-line); border-radius:19px; background:linear-gradient(135deg,var(--hero-surface),var(--hero-brand-soft)); box-shadow:var(--hero-shadow-sm); }.eyebrow{margin:0 0 7px;color:var(--hero-brand);font:850 10px/1.4 system-ui,sans-serif;letter-spacing:.14em;direction:ltr}.hero-head h1{margin-bottom:7px;font-size:clamp(1.65rem,3vw,2.5rem);letter-spacing:-.04em}.lead{max-width:780px;margin:0;color:var(--hero-muted);font-size:.89rem;line-height:1.95}.helper-copy{display:none}.guide-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}.button,button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:39px;padding:8px 12px;border:1px solid var(--hero-brand);border-radius:10px;background:var(--hero-brand);color:#fff;cursor:pointer;font:800 .78rem/1.35 inherit;text-decoration:none}.button.secondary,button.secondary{border-color:var(--hero-line-strong);background:var(--hero-surface);color:var(--hero-brand)}button:disabled{opacity:.5;cursor:not-allowed}.button:focus-visible,button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid color-mix(in srgb,var(--hero-brand) 38%,transparent);outline-offset:3px}
    .overview{display:grid;grid-template-columns:1.3fr .7fr;gap:14px;margin-bottom:20px}.panel{min-width:0;padding:18px;border:1px solid var(--hero-line);border-radius:17px;background:var(--hero-surface);box-shadow:var(--hero-shadow-sm)}.panel h2{margin-bottom:7px;font-size:1rem}.panel p{color:var(--hero-muted);font-size:.8rem;line-height:1.85}.context{background:linear-gradient(145deg,var(--hero-brand),#27218f);color:#fff}.context p,.context small{color:rgba(255,255,255,.8)}.context strong{display:block;margin:5px 0;font-size:1.15rem}.context code{direction:ltr;unicode-bidi:embed}.progress-track{height:8px;overflow:hidden;margin:13px 0 8px;border-radius:99px;background:rgba(255,255,255,.22)}.progress-track>span{display:block;height:100%;border-radius:inherit;background:#a7f3d0;transition:width .18s ease}.status{min-height:24px;margin:8px 0 0;color:var(--hero-muted);font-size:.78rem;line-height:1.7}.status.error{color:var(--hero-danger)}.status.ok{color:var(--hero-success)}
    .notice{margin:0 0 20px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--hero-brand) 25%,var(--hero-line));border-radius:14px;background:var(--hero-brand-soft);font-size:.81rem;line-height:1.9}.notice strong{color:var(--hero-brand)}.setting-toggle{display:flex;align-items:center;justify-content:space-between;gap:14px}.setting-toggle label{display:flex;align-items:center;gap:9px;color:var(--hero-ink);font-size:.8rem;font-weight:800}.setting-toggle input{inline-size:18px;block-size:18px;accent-color:var(--hero-brand)}.setting-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:12px}.list{display:grid;gap:12px}.step{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:start;padding:17px;border:1px solid var(--hero-line);border-radius:16px;background:var(--hero-surface);box-shadow:var(--hero-shadow-sm)}.step[data-state="complete"]{border-color:color-mix(in srgb,var(--hero-success) 40%,var(--hero-line));background:color-mix(in srgb,var(--hero-success-soft) 35%,var(--hero-surface))}.step[data-state="current"]{border-color:var(--hero-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--hero-brand) 14%,transparent),var(--hero-shadow-sm)}.step[data-state="gated"]{border-style:dashed;background:color-mix(in srgb,var(--hero-warning-soft) 38%,var(--hero-surface))}.step-num{display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--hero-line-strong);border-radius:11px;background:var(--hero-canvas);font:900 .83rem/1 system-ui,sans-serif}.step[data-state="complete"] .step-num{border-color:var(--hero-success);background:var(--hero-success);color:#fff}.step[data-state="current"] .step-num{border-color:var(--hero-brand);background:var(--hero-brand);color:#fff}.step-copy{min-width:0}.step-phase{display:block;margin-bottom:4px;color:var(--hero-muted);font-size:.66rem;font-weight:850;letter-spacing:.08em}.step h2{margin-bottom:5px;font-size:1rem}.step p{margin-bottom:10px;color:var(--hero-muted);font-size:.79rem;line-height:1.85}.steps-detail{margin:0;padding:0 18px 0 0;color:var(--hero-ink);font-size:.76rem;line-height:1.85}.steps-detail li+li{margin-top:4px}.state{display:inline-flex;align-items:center;justify-content:center;min-width:82px;min-height:27px;padding:5px 8px;border-radius:999px;background:var(--hero-warning-soft);color:var(--hero-warning);font-size:.65rem;font-weight:850;white-space:nowrap}.state.complete{background:var(--hero-success-soft);color:var(--hero-success)}.state.current{background:var(--hero-brand-soft);color:var(--hero-brand)}.state.gated{background:var(--hero-danger-soft);color:var(--hero-danger)}.step-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:12px}.guide-groups{display:grid;gap:22px}.guide-groups>section>h2{margin:0 0 10px;font-size:1.04rem}.guide-groups>section>p{margin:-3px 0 11px;color:var(--hero-muted);font-size:.78rem}.empty{padding:32px;text-align:center;border:1px dashed var(--hero-line-strong);border-radius:16px;background:var(--hero-surface)}
    @media(max-width:820px){main{width:min(100% - 20px,820px);padding-top:22px}.hero-head,.overview{display:block}.hero-head .button{margin-top:13px}.overview .panel+.panel{margin-top:12px}.step{grid-template-columns:auto minmax(0,1fr)}.step>.state{grid-column:2;justify-self:start}.step-actions{grid-column:1 / -1}} @media(prefers-reduced-motion:reduce){.progress-track>span{transition:none}}
  </style>
</head>
<body>
  ${getHeroGlobalNavigation({ active: "walkthrough", projectId, environment: "Private · Guided setup" })}
  <main id="hero-main" tabindex="-1">
    <header class="hero-head hero-page-header"><div><p class="eyebrow">HERO / GUIDED PROJECT SETUP</p><h1 data-hero-info-key="guide.walkthrough">راهنمای گام‌به‌گام ساخت محصول</h1><p class="lead helper-copy">Walk-Through فعال، وضعیت خود را نگه می‌دارد و با گام قبل/بعد شما را بین صفحه‌ها و کنترل‌های صحیح حرکت می‌دهد.</p></div><div class="guide-actions"><a class="button secondary" href="/api/portal?surface=portfolio&select=project&next=walkthrough">تغییر یا انتخاب پروژه</a><button id="walkthrough-resume" type="button">شروع Walk-Through</button><button id="walkthrough-stop" class="secondary" type="button" hidden>بستن کامل Walk-Through فعال</button></div></header>
    <section class="overview"><section class="panel context" aria-labelledby="guide-context-title"><small>PROJECT CONTEXT</small><strong id="guide-context-title">در حال بررسی پروژه…</strong><p id="guide-context-copy">برای شروع، یک پروژه را انتخاب کنید.</p><div class="progress-track" aria-hidden="true"><span id="progress-bar" style="width:0%"></span></div><small id="progress-text" data-hero-info-key="guide.setupProgress">۰ از ۵ گام پایه</small></section><section class="panel" id="guide-service-settings" data-hero-guide-target="guide.service-settings"><h2 data-hero-info-key="guide.serviceSettings">تنظیمات سرویس Walk-Through</h2><p class="helper-copy">این تنظیم برای همین پروژه است. Owner یا Admin می‌تواند راهنمای فعال را روشن یا خاموش کند؛ خاموش‌کردن داده یا تاریخچهٔ پروژه را حذف نمی‌کند.</p><form id="guide-settings-form"><div class="setting-toggle"><label><input id="guide-enabled" name="enabled" type="checkbox" checked>فعال‌بودن Walk-Through برای این پروژه</label></div><div class="setting-actions"><button id="guide-settings-save" type="submit">ذخیرهٔ تنظیم</button><span class="status" id="guide-settings-status" role="status" aria-live="polite"></span></div></form></section></section>
    <aside class="notice"><strong data-hero-info-key="guide.gatedCapability">مرز ایمنی:</strong> راهنما هیچ Secret، هزینه، Provider، سرور، GitHub، Pilot یا Production را فعال نمی‌کند. ثبت تنظیم یا مشاهدهٔ یک مورد به معنی اتصال یا اجرای واقعی آن نیست.</aside>
    <div id="guide-groups" class="guide-groups" aria-live="polite"></div>
  </main>
  <script>(() => {
    const initial = ${initial};
    const enabledSettingPath = ${JSON.stringify(HERO_PROJECT_WALKTHROUGH_ENABLED_SETTING)};
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const state = { projectId: initial.projectId, principal: null, overview: null, serviceEnabled: initial.projectId ? null : true };
    const configuredSteps = new Set(['intake','inputs','foundation','settings']);
    const requiredSetupSteps = new Set(['intake','foundation','settings']);
    const surfaceFor = step => {
      const route = new URL(step.route, location.origin);
      if (route.pathname === '/identity') return 'identity';
      if (route.pathname === '/workspace') return 'workspace';
      if (route.pathname === '/product-studio') return 'studio';
      if (route.pathname === '/project-control') return 'control';
      if (route.pathname === '/portfolio' && route.searchParams.get('surface') === 'command') return 'command';
      return 'portfolio';
    };
    const routeFor = step => {
      const source = new URL(step.route, location.origin);
      const url = new URL('/api/portal', location.origin);
      url.searchParams.set('surface', surfaceFor(step));
      for (const key of ['select', 'next', 'open']) if (source.searchParams.has(key)) url.searchParams.set(key, source.searchParams.get(key));
      if (state.projectId && step.id !== 'identity' && step.id !== 'project-selection' && step.id !== 'create-project') url.searchParams.set('projectId', state.projectId);
      url.searchParams.set('walkthrough', step.id);
      return url.pathname + url.search;
    };
    const canEditGuideSettings = () => Boolean(state.projectId && state.principal && ['project-owner','admin'].includes(state.principal.role));
    const configuredServiceEnabled = () => {
      const setting = (state.overview?.settings || []).find(item => item.path === enabledSettingPath);
      return typeof setting?.value === 'boolean' ? setting.value : true;
    };
    const activeWalkthrough = () => window.heroWalkthrough?.getState?.() || null;
    const syncWalkthroughControls = () => {
      const active = activeWalkthrough();
      $('walkthrough-resume').textContent = active?.active ? 'ادامهٔ Walk-Through' : 'شروع Walk-Through';
      $('walkthrough-stop').hidden = !active?.active;
      $('walkthrough-resume').disabled = state.projectId ? state.serviceEnabled !== true : false;
    };
    const setGuideSettingsStatus = (text, kind = '') => { const node = $('guide-settings-status'); node.textContent = text; node.className = 'status ' + kind; };
    const complete = step => {
      const overview = state.overview || {}; const intake = overview.intake || {}; const foundation = overview.foundationProposal || {};
      if (step.id === 'create-project') return false;
      if (step.completion === 'human-session') return Boolean(state.principal);
      if (step.completion === 'selected-project') return Boolean(state.projectId);
      if (step.completion === 'intake-complete') return Boolean(intake.goal && intake.users && intake.autonomy);
      if (step.completion === 'optional-input') return (overview.inputs || []).length > 0;
      if (step.completion === 'foundation-approved') return foundation.state === 'approved';
      if (step.completion === 'setting-registered') return (overview.settings || []).length > 0;
      return false;
    };
    const stateFor = step => {
      if (complete(step)) return 'complete';
      if (step.optional === true) return 'optional';
      if (configuredSteps.has(step.id) && !state.projectId) return 'waiting';
      if (step.availability === 'gated' || step.availability === 'partial') return 'gated';
      if (step.completion === 'review-only') return 'reference';
      const currentIndex = initial.steps.findIndex(item => item.id === step.id);
      const previousRequired = initial.steps.slice(0, currentIndex).filter(item => requiredSetupSteps.has(item.id));
      if (configuredSteps.has(step.id) && previousRequired.every(complete)) return 'current';
      return 'available';
    };
    const stateLabel = value => ({ complete:'ثبت و تأیید شد', current:'اقدام بعدی', available:'قابل انجام', optional:'اختیاری؛ مانع ادامه نیست', waiting:'ابتدا پروژه', reference:'بازبینی', gated:'گیت‌شده' }[value] || 'قابل انجام');
    const groupName = phase => phase;
    const render = () => {
      const setup = initial.steps.filter(step => requiredSetupSteps.has(step.id));
      const done = setup.filter(complete).length;
      const project = state.overview?.project;
      $('guide-context-title').textContent = project ? project.name : (state.projectId ? state.projectId : 'هنوز پروژه‌ای انتخاب نشده است');
      $('guide-context-copy').textContent = project ? 'شناسه: ' + project.projectId + ' · lifecycle: ' + project.lifecycle : 'از Portfolio پروژه‌ای را انتخاب کنید؛ Owner می‌تواند از همان‌جا Draft جدید بسازد.';
      $('progress-bar').style.width = Math.round((done / setup.length) * 100) + '%'; $('progress-text').textContent = done + ' از ' + setup.length + ' گام پایه ثبت شده است';
      if (state.overview) state.serviceEnabled = configuredServiceEnabled();
      $('guide-enabled').checked = state.serviceEnabled !== false;
      const settingsEditable = canEditGuideSettings();
      $('guide-enabled').disabled = !settingsEditable;
      $('guide-settings-save').disabled = !settingsEditable;
      if (!state.projectId) setGuideSettingsStatus('برای تنظیم این سرویس، ابتدا یک پروژه انتخاب کنید.');
      else if (!state.principal) setGuideSettingsStatus('برای دیدن یا تغییر تنظیم، ورود انسانی لازم است.');
      else if (state.serviceEnabled === null) setGuideSettingsStatus('در حال خواندن تنظیم Walk-Through…');
      else if (!settingsEditable) setGuideSettingsStatus('این نشست فقط مشاهده دارد.');
      else setGuideSettingsStatus(state.serviceEnabled ? 'Walk-Through برای این پروژه فعال است.' : 'Walk-Through برای این پروژه غیرفعال است.', state.serviceEnabled ? 'ok' : 'error');
      syncWalkthroughControls();
      const phases = [...new Set(initial.steps.map(step => step.phase))];
      $('guide-groups').innerHTML = phases.map(phase => {
        const steps = initial.steps.filter(step => groupName(step.phase) === phase);
        const description = phase === 'امکانات خارج از فرایند اصلی' ? 'این قابلیت‌ها برای ورود، دسترسی و ادارهٔ Hero هستند؛ جزو شماره‌گذاری و ترتیب فرایند ساخت محصول نیستند.' : phase === 'اجرای محصول' ? 'این گام‌ها وضعیت قابلیت‌های فعلی Hero را با صداقت نشان می‌دهند.' : phase === 'تحویل' ? 'این گام‌ها تا تکمیل Evidence و مجوز مستقل، فقط قابل پایش هستند.' : 'به‌ترتیب پیش بروید؛ هر گام معیار پایان خودش را دارد.';
        return '<section aria-labelledby="phase-' + esc(phase) + '"><h2 id="phase-' + esc(phase) + '">' + esc(phase) + '</h2><p>' + esc(description) + '</p><div class="list">' + steps.map((step, index) => {
          const stepState = stateFor(step); const detail = step.instructions.map(item => '<li>' + esc(item) + '</li>').join('');
          const optional = step.optional ? '<span class="state">اختیاری</span>' : '';
          const beginsMainFlow = step.flow !== 'outside-main';
          const mainStepNumber = beginsMainFlow ? initial.steps.filter(candidate => candidate.flow !== 'outside-main').indexOf(step) + 1 : '—';
          return '<article class="step" data-state="' + stepState + '" data-guide-step="' + esc(step.id) + '"><div class="step-num">' + mainStepNumber + '</div><div class="step-copy"><span class="step-phase">' + esc(step.availability.replaceAll('-', ' ')) + '</span><h2>' + esc(step.title) + '</h2><p>' + esc(step.summary) + '</p><ol class="steps-detail">' + detail + '</ol><div class="step-actions"><a class="button ' + (stepState === 'current' ? '' : 'secondary') + '"' + (beginsMainFlow ? ' data-walkthrough-start="' + esc(step.id) + '"' : '') + ' href="' + esc(routeFor(step)) + '">' + esc(step.actionLabel) + '</a>' + (stepState === 'complete' ? '<span class="state complete">ثبت شد</span>' : '') + '</div></div><span class="state ' + stepState + '">' + stateLabel(stepState) + '</span>' + optional + '</article>';
        }).join('') + '</div></section>';
      }).join('');
    };
    const api = async (path, options = {}) => { const headers = { ...(options.headers || {}) }; if (options.body) headers['content-type'] = 'application/json'; const response = await fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || body.code || 'دریافت اطلاعات راهنما ناموفق بود.'); return body; };
    const load = async () => {
      try { const me = await api('/api/identity/me'); state.principal = me.principal; if (state.projectId) { const workspace = await api('/api/projects/' + encodeURIComponent(state.projectId) + '/workspace-overview'); state.overview = workspace.overview; state.serviceEnabled = configuredServiceEnabled(); window.heroWalkthrough?.setServiceEnabled(state.projectId, state.serviceEnabled); } $('guide-status').textContent = 'وضعیت راهنما از Scope فعلی پروژه بازخوانی شد.'; $('guide-status').className = 'status ok'; } catch (error) { $('guide-status').textContent = error.message; $('guide-status').className = 'status error'; }
      render();
    };
    document.addEventListener('click', event => {
      const trigger = event.target.closest?.('[data-walkthrough-start]');
      if (!trigger) return;
      if (state.projectId && state.serviceEnabled !== true) { event.preventDefault(); $('guide-status').textContent = state.serviceEnabled === false ? 'Walk-Through این پروژه در تنظیمات سرویس غیرفعال است.' : 'ابتدا وضعیت تنظیم Walk-Through را بازخوانی کنید.'; $('guide-status').className = 'status error'; return; }
      if (!window.heroWalkthrough?.start) return;
      event.preventDefault(); window.heroWalkthrough.start({ stepId: trigger.dataset.walkthroughStart, projectId: state.projectId });
    });
    $('walkthrough-resume').addEventListener('click', () => {
      if (state.projectId && state.serviceEnabled !== true) { $('guide-status').textContent = state.serviceEnabled === false ? 'Walk-Through این پروژه در تنظیمات سرویس غیرفعال است.' : 'ابتدا وضعیت تنظیم Walk-Through را بازخوانی کنید.'; $('guide-status').className = 'status error'; return; }
      const active = activeWalkthrough(); if (active?.active) window.heroWalkthrough.resume(); else window.heroWalkthrough?.start({ stepId: 'project-selection', projectId: null });
    });
    $('walkthrough-stop').addEventListener('click', () => { window.heroWalkthrough?.stop('closed-by-user'); syncWalkthroughControls(); });
    $('guide-settings-form').addEventListener('submit', async event => {
      event.preventDefault();
      if (!canEditGuideSettings()) { setGuideSettingsStatus('این نشست اجازهٔ تغییر تنظیم را ندارد.', 'error'); return; }
      const enabled = $('guide-enabled').checked;
      try {
        await api('/api/projects/' + encodeURIComponent(state.projectId) + '/settings', { method: 'POST', body: JSON.stringify({ path: enabledSettingPath, value: enabled, layer: 'project-override', reason: enabled ? 'Walk-Through enabled from guide settings' : 'Walk-Through disabled from guide settings', impact: 'Changes only the project-scoped guided setup service' }) });
        state.serviceEnabled = enabled; window.heroWalkthrough?.setServiceEnabled(state.projectId, enabled); setGuideSettingsStatus(enabled ? 'Walk-Through فعال شد.' : 'Walk-Through غیرفعال و راهنمای فعال متوقف شد.', enabled ? 'ok' : 'error'); syncWalkthroughControls();
      } catch (error) { setGuideSettingsStatus(error.message, 'error'); }
    });
    window.addEventListener('hero-walkthrough-ready', () => { if (state.projectId && state.overview) window.heroWalkthrough?.setServiceEnabled(state.projectId, state.serviceEnabled); syncWalkthroughControls(); });
    load();
  })();</script>
  ${getHeroShellScript()}
</body></html>`;
}
