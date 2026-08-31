export function getBackofficeHtml() {
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate">
    <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate">
    <title>Hero — بک‌آفیس توسعه</title>
    <style>
      :root { color-scheme: light; font-family: Tahoma, Arial, sans-serif; background: #eef3f8; color: #172333; }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; }
      main { max-width: 1280px; margin: auto; padding: 24px 18px 56px; }
      .topbar { display: flex; justify-content: space-between; align-items: start; gap: 20px; margin-bottom: 24px; }
      h1, h2, h3, p { margin-top: 0; }
      h1 { margin-bottom: 8px; font-size: clamp(1.7rem, 4vw, 2.65rem); letter-spacing: -.04em; }
      h2 { margin-bottom: 14px; font-size: 1.12rem; }
      h3 { margin-bottom: 8px; font-size: 1rem; }
      .subtitle, .muted { color: #607083; line-height: 1.8; }
      .subtitle { margin-bottom: 0; }
      .top-actions, .actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
      .badge { display: inline-flex; align-items: center; border-radius: 99px; padding: 7px 11px; font-size: .8rem; font-weight: 700; white-space: nowrap; }
      .badge.good { color: #146247; background: #dcf6e9; }.badge.warn { color: #8b5b12; background: #fff0c7; }.badge.blocked { color: #9b2947; background: #ffe1e8; }.badge.neutral { color: #34536e; background: #dceaf5; }
      button, a.button { border: 0; border-radius: 9px; background: #1d547c; color: #fff; cursor: pointer; font: inherit; font-weight: 700; padding: 9px 12px; text-decoration: none; }
      button:hover, a.button:hover { filter: brightness(.95); }.button.secondary { color: #31516a; background: #e1eaf1; }
      .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; }
      .card { grid-column: span 12; background: #fff; border: 1px solid #dce5ed; border-radius: 16px; padding: 19px; box-shadow: 0 8px 24px rgba(32, 61, 91, .06); }
      .half { grid-column: span 6; }.third { grid-column: span 4; }
      .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .metric, .status-card, .role, .next-step { border: 1px solid #e1e9f0; border-radius: 12px; padding: 13px; background: #fbfdff; }
      .metric strong { display: block; color: #1d547c; font-size: 1.55rem; margin-bottom: 4px; }.metric span { color: #607083; font-size: .83rem; }
      .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 11px; }
      .status-card { display: grid; gap: 9px; border-top: 4px solid #2b8a66; }.status-card.warn { border-top-color: #d08a1d; }.status-card.blocked { border-top-color: #c33e5c; }
      .status-card p { margin-bottom: 0; color: #53677a; line-height: 1.75; font-size: .88rem; }.status-card small { color: #6b7b8a; line-height: 1.7; }
      .architecture { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; align-items: stretch; }.arch-node { padding: 14px 10px; border-radius: 12px; background: #eaf3fa; color: #204e6e; text-align: center; font-weight: 700; line-height: 1.7; }.arch-arrow { align-self: center; color: #8aa5ba; text-align: center; font-size: 1.25rem; }
      .roles { display: flex; flex-wrap: wrap; gap: 8px; }.role { padding: 8px 10px; color: #3e347e; background: #f0efff; border-color: #dedbff; font-size: .86rem; }
      .activity { display: grid; gap: 7px; margin-top: 12px; }.activity-row { display: flex; justify-content: space-between; gap: 10px; padding: 8px 10px; background: #f6f9fb; border-radius: 8px; color: #53677a; font-size: .82rem; }.activity-row strong { color: #214f70; }
      .table-wrap { overflow-x: auto; } table { width: 100%; border-collapse: collapse; min-width: 650px; } th, td { border-bottom: 1px solid #e7edf2; padding: 11px 8px; text-align: right; vertical-align: top; line-height: 1.65; } th { color: #52677a; background: #f6f9fb; font-size: .82rem; } td { font-size: .87rem; } td strong { color: #214f70; }
      .next-steps { display: grid; gap: 9px; }.next-step { display: flex; gap: 9px; align-items: start; }.next-step b { color: #1d547c; }
      .timeline { display: grid; gap: 8px; max-height: 430px; overflow: auto; }.timeline-item { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: start; padding: 11px 12px; border: 1px solid #e1e9f0; border-radius: 10px; background: #fbfdff; }.timeline-item strong { color: #214f70; font-size: .86rem; }.timeline-item small, .timeline-item span { color: #607083; line-height: 1.65; font-size: .8rem; }.timeline-item small { direction: ltr; text-align: left; white-space: nowrap; }
      .reviews { display: grid; gap: 8px; }.review { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 11px 12px; border: 1px solid #e1e9f0; border-radius: 10px; background: #fbfdff; }.review strong { display: block; color: #214f70; font-size: .88rem; }.review small { color: #607083; line-height: 1.6; }
      .learn { display: grid; gap: 10px; }.learn p { margin: 0; padding: 10px 12px; border-radius: 9px; color: #4d6274; background: #f6f9fb; line-height: 1.8; font-size: .88rem; }.learn code { color: #443a91; font-family: inherit; font-weight: 700; }
      .footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 18px; }.notice { min-height: 22px; color: #1d547c; font-size: .86rem; }
      .filters { display: flex; gap: 9px; flex-wrap: wrap; align-items: center; }.filters input, .filters select { border: 1px solid #cbd9e4; border-radius: 9px; background: #fff; color: #172333; font: inherit; padding: 9px 10px; min-width: 170px; }.filter-count { color: #607083; font-size: .83rem; }
      @media (max-width: 900px) { .half, .third { grid-column: span 12; }.metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }.architecture { grid-template-columns: 1fr; }.arch-arrow { transform: rotate(90deg); } }
      @media (max-width: 540px) { .topbar { display: block; }.top-actions { margin-top: 13px; }.metrics { grid-template-columns: 1fr 1fr; }.card { padding: 15px; } }
    </style>
  </head>
  <body>
    <main>
      <header class="topbar">
        <div><h1>بک‌آفیس توسعهٔ Hero</h1><p class="subtitle">نمای مشاهده‌ای برای فهم وضعیت سازمان، لایهٔ Multi-AI، گیت‌ها و مسیر بعدی</p></div>
        <div class="top-actions"><span id="overall" class="badge neutral">در حال خواندن وضعیت…</span><button id="refresh" type="button">به‌روزرسانی</button><a class="button secondary" href="/">اتاق کنترل</a></div>
      </header>
      <section class="grid" aria-live="polite">
        <section class="card"><h2>نمای سریع</h2><div id="metrics" class="metrics"></div></section>
        <section class="card"><h2>الان کجای پروژه‌ایم؟</h2><div id="status-grid" class="status-grid"></div></section>
        <section class="card half"><h2>مدل کلی سیستم</h2><p class="muted">Hero سازمان و کنترل‌پلین آن است؛ Teamها واحدهای عملیاتی‌اند و Roleهای AI قابلیت‌های قابل‌تعویض هستند.</p><div class="architecture"><div class="arch-node">مالک پروژه</div><div class="arch-arrow">←</div><div class="arch-node">Hero Control Plane<br>۱۱ تیم</div><div class="arch-arrow">←</div><div class="arch-node">AI Orchestration<br>Role → Profile → Provider</div></div></section>
        <section class="card half"><h2>Roleهای AI</h2><p class="muted">شش Role عملیاتی اصلی و دو Role تخصصی کیفیت در قرارداد هستند؛ هیچ‌کدام با Team سازمانی یکی نیستند.</p><div id="roles" class="roles"></div><div id="ai-activity" class="activity"></div><p id="provider-note" class="muted" style="margin:14px 0 0"></p><p id="benchmark-note" class="muted" style="margin:10px 0 0"></p></section>
        <section class="card"><h2>فیلتر سریع</h2><div class="filters"><input id="team-search" type="search" placeholder="جست‌وجوی نام یا مسئولیت تیم" aria-label="جست‌وجوی تیم"><select id="team-status" aria-label="فیلتر وضعیت تیم"><option value="all">همهٔ وضعیت‌ها</option><option value="ready">آمادهٔ کار</option><option value="not-ready">نیازمند تکمیل</option></select><span id="filter-count" class="filter-count"></span></div></section>
        <section class="card"><h2>وضعیت ۱۱ تیم</h2><div class="table-wrap"><table><thead><tr><th>تیم</th><th>مسئولیت</th><th>قرارداد</th><th>آموزش</th><th>آمادهٔ کار</th></tr></thead><tbody id="teams"></tbody></table></div></section>
        <section class="card half"><h2>Timeline تغییرات</h2><p class="muted">فقط خلاصهٔ امن eventها نمایش داده می‌شود؛ متن درخواست، prompt و خروجی AI حذف شده‌اند.</p><div id="timeline" class="timeline"></div></section>
        <section class="card half"><h2>ارزیابی سازمان</h2><p class="muted">نتیجهٔ ارزیابی شواهد و پیشنهاد است و به‌تنهایی مجوز یا تغییر وضعیت تیم ایجاد نمی‌کند.</p><div id="reviews" class="reviews"></div></section>
        <section class="card half"><h2>گام‌های بعدی</h2><div id="next-steps" class="next-steps"></div></section>
        <section class="card half"><h2>چطور این پنل را بخوانیم؟</h2><div class="learn"><p><code>Team</code> یعنی واحد سازمانی با مسئولیت و خروجی مشخص.</p><p><code>AI Role</code> یعنی توانایی؛ مثل تحلیل، ارزیابی یا اجرا.</p><p><code>Provider/Model/Profile</code> یعنی ابزار و تنظیمات قابل‌تعویض برای یک Role.</p><p><code>Evaluation</code> شواهد تولید می‌کند؛ خودش مجوز اجرا یا تصمیم مالک نیست.</p><p><code>Blocked</code> شکست نیست؛ یعنی شرط لازم هنوز فراهم نشده و سیستم باید متوقف بماند.</p></div></section>
      </section>
      <footer class="footer"><span id="updated" class="muted"></span><span id="access-note" class="muted"></span><span id="notice" class="notice" role="status"></span></footer>
    </main>
    <script>
      const $ = selector => document.querySelector(selector);
      let currentData = null;
      const text = (tag, value, className) => { const node = document.createElement(tag); node.textContent = value ?? ''; if (className) node.className = className; return node; };
      const badge = (value, tone) => text('span', value, 'badge ' + (tone === 'blocked' ? 'blocked' : tone === 'warn' ? 'warn' : tone === 'good' ? 'good' : 'neutral'));
      const safeFetch = async () => { let response; try { response = await fetch('/backoffice-data', { cache: 'no-store' }); } catch { throw new Error('به سرویس متصل نشد؛ مرورگر و Docker باید روی یک میزبان باشند.'); } let payload = {}; try { payload = await response.json(); } catch { throw new Error('پاسخ سرویس قابل خواندن نیست.'); } if (!response.ok) throw new Error(payload.message || 'خواندن وضعیت انجام نشد.'); return payload.backoffice; };
      function renderTeams() { const query = ($('#team-search').value || '').trim().toLocaleLowerCase(); const status = $('#team-status').value; const teams = (currentData?.organization?.teams || []).filter(team => { const matchesText = !query || (team.name + ' ' + team.responsibility).toLocaleLowerCase().includes(query); const matchesStatus = status === 'all' || (status === 'ready' ? team.ready : !team.ready); return matchesText && matchesStatus; }); $('#teams').replaceChildren(...teams.map(team => { const row = document.createElement('tr'); row.append(text('td', team.name), text('td', team.responsibility), text('td', team.approvals.approved + '/' + team.approvals.total), text('td', team.trainingStatus), text('td', team.ready ? 'بله' : 'خیر')); return row; })); $('#filter-count').textContent = teams.length + ' از ' + (currentData?.organization?.teams || []).length + ' تیم'; }
      function render(data) {
        currentData = data;
        const counts = data.ai.counts || {}; const metrics = [['تیم‌های سازمان', data.organization.teamCount], ['Roleهای AI', data.ai.roles.length], ['Invocationها', counts.invocations || 0], ['درخواست‌های ثبت‌شده', data.requests.total]];
        $('#metrics').replaceChildren(...metrics.map(([label, value]) => { const item = document.createElement('div'); item.className = 'metric'; item.append(text('strong', value), text('span', label)); return item; }));
        const openStatuses = Object.entries(data.requests.byStatus || {}).map(([key, value]) => key + ': ' + value).join(' · ');
        $('#overall').replaceWith(Object.assign(badge(data.governance.globalStop ? 'توقف اضطراری فعال' : 'مرز مشاهده‌ای سالم', data.governance.globalStop ? 'blocked' : 'good'), { id: 'overall' }));
        $('#status-grid').replaceChildren(...data.focus.map(item => { const card = document.createElement('article'); card.className = 'status-card ' + (item.tone === 'blocked' ? 'blocked' : item.tone === 'warn' ? 'warn' : ''); card.append(text('h3', item.title), badge(item.status, item.tone), text('p', item.detail), text('small', 'بعدی: ' + item.next)); return card; }));
        $('#roles').replaceChildren(...data.ai.roles.map(role => text('span', role, 'role'))); $('#provider-note').textContent = 'حالت Provider: ' + data.ai.providerMode + ' · ' + data.ai.liveStatus;
        const activity = data.ai.activity || {}; const activityRows = [['Invocation', (activity.invocations || []).length], ['Evaluation', (activity.evaluations || []).length], ['Decision', (activity.decisions || []).length]]; $('#ai-activity').replaceChildren(...activityRows.map(([label, value]) => { const item = document.createElement('div'); item.className = 'activity-row'; item.append(text('strong', label), text('span', value + ' مورد اخیر')); return item; })); $('#benchmark-note').textContent = 'Benchmark: ' + (data.benchmark?.mode || 'synthetic-deterministic') + ' · ' + (data.benchmark?.decisionBoundary || 'advisory-only');
        renderTeams();
        const timeline = data.timeline || []; $('#timeline').replaceChildren(...(timeline.length ? timeline : [{ type: 'timeline.empty', kind: 'persistence', aggregateType: '-', aggregateId: '-', occurredAt: null, data: {} }]).map(event => { const item = document.createElement('div'); item.className = 'timeline-item'; item.append(text('strong', event.type), text('span', event.aggregateType + ' / ' + event.aggregateId + ' · ' + event.kind), text('small', event.occurredAt ? new Date(event.occurredAt).toLocaleString('fa-IR') : 'هنوز eventی ثبت نشده')); return item; }));
        const reviews = data.performance?.reviews || []; $('#reviews').replaceChildren(...(reviews.length ? reviews : [{ reviewId: '—', period: 'هنوز ارزیابی ثبت نشده', average: null, band: 'neutral', teamCount: 0 }]).map(review => { const item = document.createElement('div'); item.className = 'review'; const info = document.createElement('div'); info.append(text('strong', review.reviewId), text('small', review.period + ' · پوشش تیم: ' + review.teamCount)); item.append(info, badge(review.average === null ? 'بدون داده' : review.average + '/100 · ' + review.band, review.band === 'strong' ? 'good' : review.band === 'intervention' ? 'blocked' : review.band === 'watch' ? 'warn' : 'neutral')); return item; }));
        $('#next-steps').replaceChildren(...data.nextSteps.map((step, index) => { const item = document.createElement('div'); item.className = 'next-step'; item.append(text('b', String(index + 1)), text('span', step)); return item; }));
        $('#updated').textContent = 'آخرین خواندن: ' + new Date(data.generatedAt).toLocaleString('fa-IR') + (openStatuses ? ' · وضعیت درخواست‌ها: ' + openStatuses : '');
        $('#access-note').textContent = 'دسترسی: فقط همین میزبان · ' + (data.access?.path || '/backoffice');
      }
      async function refresh() { $('#notice').textContent = 'در حال به‌روزرسانی…'; try { render(await safeFetch()); $('#notice').textContent = 'وضعیت مشاهده‌ای به‌روز شد.'; } catch (error) { $('#notice').textContent = error.message; } }
      $('#refresh').addEventListener('click', refresh); $('#team-search').addEventListener('input', renderTeams); $('#team-status').addEventListener('change', renderTeams); refresh();
    </script>
  </body>
</html>`;
}
