export function getDashboardHtml() {
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate">
    <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate">
    <title>Hero — اتاق کنترل</title>
    <style>
      :root { color-scheme: light; font-family: Tahoma, Arial, sans-serif; background: #f5f5f9; color: #1f2233; }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; }
      main { max-width: 1160px; margin: auto; padding: 28px 18px 52px; }
      .hero { display: flex; justify-content: space-between; align-items: start; gap: 20px; margin-bottom: 22px; }
      h1 { margin: 0; font-size: clamp(1.8rem, 4vw, 2.7rem); letter-spacing: -.04em; }
      h2 { margin: 0 0 14px; font-size: 1.1rem; }
      .subtitle { color: #676a7d; margin: 8px 0 0; }
      .badge { border-radius: 99px; padding: 8px 12px; font-size: .82rem; font-weight: 700; white-space: nowrap; }
      .safe { color: #0d6b4e; background: #dff6ec; } .stop { color: #a62c42; background: #fee7eb; }
      .grid { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 18px; }
      .card { background: #fff; border: 1px solid #e2e3eb; border-radius: 17px; padding: 20px; box-shadow: 0 9px 25px rgba(26, 30, 55, .05); }
      .wide { grid-column: 1 / -1; }
      label { display: grid; gap: 7px; margin: 0 0 13px; font-size: .9rem; font-weight: 700; }
      input, textarea, select { width: 100%; border: 1px solid #cfd1de; border-radius: 9px; padding: 10px 11px; font: inherit; background: #fff; color: #1f2233; }
      textarea { resize: vertical; min-height: 88px; }
      button { border: 0; border-radius: 9px; background: #4d45d7; color: white; cursor: pointer; font: inherit; font-weight: 700; padding: 10px 13px; }
      button:hover { filter: brightness(.95); } button:disabled { cursor: not-allowed; opacity: .5; }
      .secondary { color: #3d3e52; background: #ececf5; } .danger { background: #be3454; }
      .control-row, .actions, .request-head, .meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .control-row { justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #ececf2; }
      .control-row:last-child { border-bottom: 0; padding-bottom: 0; }
      .switch { display: inline-flex; align-items: center; gap: 8px; font-size: .88rem; }
      .switch input { width: 18px; height: 18px; accent-color: #4d45d7; }
      .requests { display: grid; gap: 13px; }
      .teams { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 13px; }
      .request { border: 1px solid #e7e8ef; border-radius: 13px; padding: 15px; }
      .team { border: 1px solid #e7e8ef; border-radius: 13px; padding: 15px; }
      .request-head { justify-content: space-between; align-items: start; }
      .request h3 { margin: 0; font-size: 1.05rem; }.request p { color: #5f6276; margin: 8px 0; line-height: 1.7; }
      .state { padding: 5px 8px; border-radius: 99px; background: #f0effe; color: #453bc8; font-size: .77rem; font-weight: 700; }
      .plan { margin: 12px 0; padding: 0 20px 0 0; color: #56596b; line-height: 1.9; }.plan small { color: #83869a; }
      .result { background: #f5faf7; border-radius: 10px; padding: 10px; color: #266349; font-size: .87rem; line-height: 1.8; }
      .team p { color: #5f6276; margin: 8px 0; line-height: 1.7; }
      .team .team-output { color: #266349; font-size: .84rem; }
      .principles, .releases { display: grid; gap: 13px; }
      .ai-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
      .ai-metric { border: 1px solid #e7e8ef; border-radius: 11px; padding: 12px; background: #fafaff; }
      .ai-metric strong { display: block; font-size: 1.15rem; color: #453bc8; }
      .ai-metric span { color: #676a7d; font-size: .82rem; }
      .principle, .release { border: 1px solid #e7e8ef; border-radius: 13px; padding: 15px; }
      .principle p, .release p { color: #5f6276; margin: 8px 0; line-height: 1.7; }
      .notice { min-height: 22px; margin: 14px 0 0; color: #4d45d7; font-weight: 700; font-size: .9rem; }
      .empty { color: #75788d; margin: 0; padding: 20px 0; text-align: center; }
      @media (max-width: 760px) { .hero { display: block; }.hero .badge { display: inline-block; margin-top: 12px; }.grid { grid-template-columns: 1fr; } .wide { grid-column: auto; } }
    </style>
  </head>
  <body>
    <main>
      <header class="hero">
        <div><h1>Hero</h1><p class="subtitle">اتاق کنترل ساده برای ساخت و آزمون امن اپلیکیشن</p></div>
        <span id="stop-badge" class="badge safe">آمادهٔ کنترل</span>
      </header>
      <section class="grid" aria-live="polite">
        <section class="card">
          <h2>درخواست جدید</h2>
          <form id="request-form">
            <label>چه می‌خواهید بسازیم؟<input id="title" name="title" required minlength="3" maxlength="120" placeholder="مثلاً: صفحهٔ ورود کاربران"></label>
            <label>توضیح ساده (اختیاری)<textarea id="description" name="description" maxlength="1000" placeholder="کافی است با زبان خودتان توضیح دهید."></textarea></label>
            <label>سناریوی آزمایشی<select id="scenario" name="scenario"><option value="success">موفقیت کامل</option><option value="review-changes">بازبینی و درخواست اصلاح</option><option value="failure-then-retry">شکست و تلاش مجدد</option><option value="pause-resume">توقف امن و ادامه</option></select></label>
            <button type="submit">ثبت و ساخت برنامه</button>
          </form>
          <p id="notice" class="notice" role="status"></p>
        </section>
        <section class="card">
          <h2>کنترل‌ها</h2>
          <div class="control-row"><div><strong id="autonomy-title">تأیید موردی</strong><div class="subtitle">اختیار کامل فقط درخواست تازه را آمادهٔ اجرا می‌کند.</div></div><label class="switch"><input id="autonomy" type="checkbox">اختیار کامل</label></div>
          <div class="control-row"><div><strong>توقف اضطراری</strong><div class="subtitle">تأیید یا شروع اجرای جدید را فوری می‌بندد.</div></div><button id="global-stop" class="danger" type="button">فعال‌سازی توقف</button></div>
          <div class="control-row"><div><strong>محدودهٔ فعلی</strong><div class="subtitle" id="provider-mode">Fake Agent only</div></div><span class="badge safe">بدون هزینه</span></div>
        </section>
        <section class="card wide">
          <h2>تیم‌های شرکت و گیت کنترل</h2>
          <p class="subtitle">هر تیم قرارداد، آموزش و وضعیت مستقل دارد. مالک پروژه می‌تواند هر بخش از قرارداد را تأیید یا برای بازکاری برگرداند.</p>
          <div id="teams" class="teams"></div>
        </section>
        <section class="card wide">
          <h2>لایهٔ Multi-AI و تصمیم‌سازی</h2>
          <p class="subtitle">این بخش وضعیت مشاهده‌ایِ نقش‌ها و شواهد AI را نشان می‌دهد؛ ارزیابی مجوز نیست و Provider زنده در این مرحله متصل نیست.</p>
          <div id="ai-summary" class="ai-summary"></div>
        </section>
        <section class="card wide">
          <h2>اصول حیاتی و فلو انتشار</h2>
          <p class="subtitle">هر اصل نسخه‌دار و owner-gated است. مسیر انتشار فقط از همان commitِ تست‌شده عبور می‌کند: test → تست و شواهد → تأیید مالک → فرمان مستقل production.</p>
          <div id="principles" class="principles"></div>
          <div id="releases" class="releases"></div>
        </section>
        <section class="card wide">
          <h2>درخواست‌ها و برنامهٔ اجرا</h2>
          <div id="requests" class="requests"></div>
        </section>
      </section>
    </main>
    <script>
      const ui = { state: null, notice: document.getElementById('notice'), requests: document.getElementById('requests'), teams: document.getElementById('teams'), aiSummary: document.getElementById('ai-summary'), principles: document.getElementById('principles'), releases: document.getElementById('releases') };
      const requestJson = async (path, body) => {
        const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'عملیات انجام نشد.');
        return payload;
      };
      const setNotice = message => { ui.notice.textContent = message || ''; };
      const element = (tag, text, className) => { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; };
      async function refresh(message) { const payload = await requestJson('/api/dashboard'); ui.state = payload.dashboard; render(); setNotice(message); }
      async function command(path, body, message) { try { await requestJson(path, body); await refresh(message); } catch (error) { setNotice(error.message); } }
      function actionButton(label, className, handler, disabled) { const button = element('button', label, className); button.disabled = Boolean(disabled); button.addEventListener('click', handler); return button; }
      function renderRequest(request) {
        const card = element('article', '', 'request');
        const head = element('div', '', 'request-head'); const title = element('h3', request.title); const state = element('span', request.status, 'state'); head.append(title, state); card.append(head);
        if (request.description) card.append(element('p', request.description));
        const meta = element('div', 'شناسه: ' + request.requestId + ' · سناریو: ' + request.scenario, 'meta'); card.append(meta);
        const plan = element('ol', '', 'plan'); request.plan.forEach(step => { const item = element('li'); item.append(document.createTextNode(step.title + ' ')); item.append(element('small', '(' + step.state + ')')); plan.append(item); }); card.append(plan);
        if (request.result) { const result = element('div', request.result.summary + ' تلاش‌ها: ' + request.result.attempts.map(item => item.outcome).join('، ') + ' · رویدادها: ' + request.result.eventCount, 'result'); card.append(result); }
        const actions = element('div', '', 'actions');
        if (['نیازمند تأیید', 'متوقف'].includes(request.status)) actions.append(actionButton('تأیید', '', () => command('/api/requests/' + request.requestId + '/approve', {}, 'درخواست آمادهٔ اجرا شد.'), ui.state.globalStop));
        if (!['تکمیل', 'رد شد'].includes(request.status)) actions.append(actionButton('رد', 'secondary', () => command('/api/requests/' + request.requestId + '/reject', {}, 'درخواست رد شد.'));
        if (request.status === 'آماده اجرا') { actions.append(actionButton('اجرای Fake Agent', '', () => command('/api/requests/' + request.requestId + '/run', {}, 'اجرای آزمایشی کامل شد.'), ui.state.globalStop)); actions.append(actionButton('توقف درخواست', 'danger', () => command('/api/requests/' + request.requestId + '/stop', {}, 'درخواست متوقف شد.'))); }
        card.append(actions); return card;
      }
      function renderTeam(team) {
        const card = element('article', '', 'team');
        const head = element('div', '', 'request-head'); head.append(element('h3', team.name), element('span', team.status, 'state')); card.append(head);
        const approved = Object.values(team.approvals).filter(Boolean).length;
        card.append(element('div', 'شناسه: ' + team.teamId + ' · قرارداد: ' + approved + '/' + Object.keys(team.approvals).length + ' · آموزش: ' + team.training.status, 'meta'));
        card.append(element('p', team.responsibility));
        card.append(element('p', 'خروجی: ' + team.outputs.join('، '), 'team-output'));
        if (team.status !== 'retired') {
          const controls = element('div', '', 'actions'); const select = document.createElement('select');
          const targets = [['charter','منشور'],['responsibilities','مسئولیت‌ها'],['decision-rights','اختیارها'],['input','ورودی'],['output','خروجی'],['principles','اصول'],['workflow','فلو']];
          targets.forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); });
          controls.append(select);
          controls.append(actionButton('تأیید بخش', '', () => command('/api/teams/' + team.teamId + '/review', { target: select.value, decision: 'approved' }, 'بخش قرارداد تیم تأیید شد.')));
          controls.append(actionButton('رد بخش', 'secondary', () => command('/api/teams/' + team.teamId + '/review', { target: select.value, decision: 'rejected', feedback: 'این بخش با نیاز پروژه هم‌راستا نیست و باید بازنویسی شود.' }, 'بخش قرارداد تیم رد شد.')));
          controls.append(actionButton('درخواست بازکاری', 'secondary', () => command('/api/teams/' + team.teamId + '/rework', { target: select.value, feedback: 'این بخش باید با معیار پذیرش پروژه بازنگری و کامل شود.' }, 'درخواست بازکاری تیم ثبت شد.')));
          card.append(controls);
        }
        return card;
      }
      function renderAiSummary(ai) {
        const contract = ai?.contract ?? {}; const counts = ai?.counts ?? {};
        const metrics = [
          ['نقش‌ها', (contract.roles ?? []).length],
          ['Providerها', counts.providers ?? 0],
          ['Profileها', counts.profiles ?? 0],
          ['Invocationها', counts.invocations ?? 0],
          ['Evaluationها', counts.evaluations ?? 0],
          ['تصمیم‌ها', counts.decisions ?? 0]
        ];
        ui.aiSummary.replaceChildren(); metrics.forEach(([label, value]) => { const metric = element('div', '', 'ai-metric'); metric.append(element('strong', String(value)), element('span', label)); ui.aiSummary.append(metric); });
        const details = element('p', 'نقش‌ها: ' + (contract.roles ?? []).join('، ') + ' · پیش‌فرض اجرا: Codex · Provider زنده: متصل نیست', 'subtitle'); ui.aiSummary.append(details);
      }
      function renderPrinciple(principle) {
        const card = element('article', '', 'principle');
        const head = element('div', '', 'request-head'); head.append(element('h3', principle.title), element('span', principle.status, 'state')); card.append(head);
        card.append(element('div', principle.principleId + ' · نسخهٔ ' + principle.version, 'meta'));
        card.append(element('p', principle.statement));
        card.append(element('p', 'نقاط کنترل: ' + principle.controlPoints.join('، ')));
        const controls = element('div', '', 'actions');
        controls.append(actionButton('تأیید اصل', '', () => command('/api/projects/hero/principles/' + encodeURIComponent(principle.principleId) + '/review', { decision: 'approved' }, 'اصل تأیید شد.')));
        controls.append(actionButton('رد اصل', 'secondary', () => command('/api/projects/hero/principles/' + encodeURIComponent(principle.principleId) + '/review', { decision: 'rejected', reason: 'اصل باید بازنگری شود.' }, 'اصل رد شد.')));
        controls.append(actionButton('درخواست بازکاری', 'secondary', () => command('/api/projects/hero/principles/' + encodeURIComponent(principle.principleId) + '/rework', { feedback: 'این اصل باید با معیار پذیرش پروژه بازنگری شود.' }, 'بازکاری اصل ثبت شد.')));
        card.append(controls); return card;
      }
      function renderRelease(release) {
        const card = element('article', '', 'release');
        const head = element('div', '', 'request-head'); head.append(element('h3', release.releaseId + ' · ' + release.version), element('span', release.state, 'state')); card.append(head);
        card.append(element('p', 'پروژه: ' + release.projectId + ' · Artifact: ' + release.artifactId + ' · commit: ' + release.commitSha));
        card.append(element('p', 'test: ' + release.testEnvironment.status + ' · production: ' + release.productionEnvironment.status));
        return card;
      }
      function render() {
        const state = ui.state; const stop = document.getElementById('stop-badge'); stop.textContent = state.globalStop ? 'توقف اضطراری فعال' : 'آمادهٔ کنترل'; stop.className = 'badge ' + (state.globalStop ? 'stop' : 'safe');
        document.getElementById('autonomy').checked = state.fullAutonomy; document.getElementById('autonomy-title').textContent = state.fullAutonomy ? 'اختیار کامل فعال' : 'تأیید موردی';
        document.getElementById('global-stop').textContent = state.globalStop ? 'برداشتن توقف' : 'فعال‌سازی توقف'; document.getElementById('provider-mode').textContent = state.providerMode;
        ui.teams.replaceChildren(); const teams = state.teamControl?.teams ?? []; if (!teams.length) ui.teams.append(element('p', 'تیمی ثبت نشده است.', 'empty')); else teams.forEach(team => ui.teams.append(renderTeam(team)));
        renderAiSummary(state.aiOrchestration);
        ui.principles.replaceChildren(); const principles = state.principlesControl?.principles ?? []; if (!principles.length) ui.principles.append(element('p', 'اصلی ثبت نشده است.', 'empty')); else principles.forEach(principle => ui.principles.append(renderPrinciple(principle)));
        ui.releases.replaceChildren(); const releases = state.releaseControl?.releases ?? []; if (releases.length) { ui.releases.append(element('h3', 'انتشارها')); releases.forEach(release => ui.releases.append(renderRelease(release))); }
        ui.requests.replaceChildren(); if (!state.requests.length) ui.requests.append(element('p', 'هنوز درخواستی ثبت نشده است.', 'empty')); else state.requests.forEach(request => ui.requests.append(renderRequest(request)));
      }
      document.getElementById('request-form').addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await command('/api/requests', { title: form.get('title'), description: form.get('description'), scenario: form.get('scenario') }, 'برنامهٔ اولیه ساخته شد.'); event.currentTarget.reset(); });
      document.getElementById('autonomy').addEventListener('change', event => command('/api/authority', { fullAutonomy: event.target.checked }, event.target.checked ? 'اختیار کامل برای درخواست‌های تازه فعال شد.' : 'تأیید موردی فعال شد.'));
      document.getElementById('global-stop').addEventListener('click', () => command('/api/global-stop', { active: !ui.state.globalStop }, ui.state.globalStop ? 'توقف اضطراری برداشته شد.' : 'توقف اضطراری فعال شد.'));
      refresh().catch(error => setNotice(error.message));
    </script>
  </body>
</html>`;
}
