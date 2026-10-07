import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
const number = value => new Intl.NumberFormat("en-US").format(Number(value ?? 0));
const STATUS_CLASS = Object.freeze({ healthy: "good", degraded: "warn", critical: "bad", unknown: "" });
const STATUS_FA = Object.freeze({ healthy: "سالم", degraded: "افت‌کرده", critical: "بحرانی", unknown: "نامعلوم" });
const SUBJECT_KINDS = Object.freeze({ milestone: "نقطهٔ عطف", release: "انتشار", output: "خروجی" });

/** Cost, performance and health page (BO-104/BO-109). Numbers always link to their evidence. */
export function getProjectInsightsHtml({ project, viewerRole, canWrite, budget, health, reconciliation, ledgerByTeam = [], ledgerByModel = [], feedback = [], scorecards = [] }) {
  const projectId = project.projectId; const base = `/api/projects/${encodeURIComponent(projectId)}`;
  const decisionLabel = { unbounded: "بدون سقف", "within-budget": "در محدوده", "soft-threshold-warning": "هشدار نرم", "hard-cap-pause-required": "توقف در سقف سخت" }[budget.decision] ?? budget.decision;
  const ledgerRows = (rows, groupBy) => rows.length ? rows.map(row => `<tr data-ledger-scope="${escapeHtml(row.scope)}"><td><a href="${base}/drill-down?kind=cost&amp;groupBy=${groupBy}&amp;scope=${encodeURIComponent(row.scope)}" data-drill-down="cost">${escapeHtml(row.scope)}</a></td><td>${number(row.inputTokens)}</td><td>${number(row.cachedTokens)}</td><td>${number(row.outputTokens)}</td><td><strong>${number(row.totalTokens)}</strong></td><td>${number(row.events)}</td></tr>`).join("") : `<tr><td colspan="6" class="muted">مصرفی ثبت نشده است.</td></tr>`;
  const table = (title, id, rows, groupBy) => `<section class="section" id="${id}"><h2>${title}</h2><div class="scroll" tabindex="0"><table><thead><tr><th>مقیاس</th><th>ورودی</th><th>کش‌شده</th><th>خروجی</th><th>جمع</th><th>رویداد</th></tr></thead><tbody>${ledgerRows(rows, groupBy)}</tbody></table></div></section>`;
  const scoreRows = scorecards.length ? scorecards.map(card => `<article class="row" data-scorecard="${escapeHtml(card.subjectId)}"><div class="head"><strong><code>${escapeHtml(card.subjectId)}</code></strong>${card.status === "insufficient-data" ? `<span class="pill">داده کافی نیست</span>` : `<span class="pill">امتیاز ${escapeHtml(card.normalizedScore)}</span>`}</div>${card.status === "insufficient-data" ? "" : `<div class="meta">Goal Fit ${escapeHtml(card.goalFit)} · خطا و بازکاری ${escapeHtml(card.errorRework)} · نوع کار ${escapeHtml(card.workType)} · ریسک ${escapeHtml(card.riskLevel)} · <a href="${base}/drill-down?kind=health&amp;scope=${encodeURIComponent(card.subjectId)}" data-drill-down="health">شواهد</a></div>`}</article>`).join("") : `<div class="empty">ارزیابی‌ای ثبت نشده است.</div>`;
  const feedbackRows = feedback.length ? feedback.map(item => `<article class="row" data-feedback-id="${escapeHtml(item.feedbackId)}"><div class="head"><strong>${escapeHtml(SUBJECT_KINDS[item.subjectKind] ?? item.subjectKind)} · <code>${escapeHtml(item.subjectId)}</code></strong><span class="pill">${item.rating === null ? "بدون امتیاز" : `${escapeHtml(item.rating)} از ۵`}</span></div>${item.comment ? `<p>${escapeHtml(item.comment)}</p>` : ""}<div class="meta">${escapeHtml(item.recordedBy)} · ${escapeHtml(item.recordedAt)} · اختیاری و بدون اثر بر هیچ گیتی</div></article>`).join("") : `<div class="empty">بازخوردی ثبت نشده است.</div>`;
  const form = canWrite ? `<form id="feedback-form" data-feedback-form><label>موضوع<select name="subjectKind">${Object.entries(SUBJECT_KINDS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><label>شناسه<input name="subjectId" required minlength="3" maxlength="120" placeholder="مثلاً release-1"></label><label>امتیاز (اختیاری)<select name="rating"><option value="">بدون امتیاز</option>${[1, 2, 3, 4, 5].map(value => `<option value="${value}">${value}</option>`).join("")}</select></label><label class="wide">توضیح (اختیاری)<textarea name="comment" maxlength="1200" rows="2"></textarea></label><button type="submit">ثبت بازخورد</button><span id="feedback-status" class="muted" role="status" aria-live="polite"></span></form>` : `<p class="muted" data-feedback-readonly>ثبت بازخورد فقط برای مالک و ادمین فعال است.</p>`;
  const projectJson = JSON.stringify({ base }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hero · هزینه و سلامت</title>
    <style>
      :root { --ink:#162238; --muted:#607089; --line:#dbe3ef; --surface:#fff; --canvas:#f4f7fb; --primary:#285ea8; --teal:#087f70; --amber:#a36208; --rose:#b03d5d; }
      * { box-sizing:border-box; } body { margin:0; color:var(--ink); background:var(--canvas); font-family:Vazirmatn,sans-serif; line-height:1.7; }
      main { width:min(1280px,calc(100% - 30px)); margin:0 auto; padding:28px 0 50px; }
      .top,.section,.card { border:1px solid var(--line); border-radius:16px; background:var(--surface); box-shadow:0 10px 26px rgba(24,53,93,.05); } .top { padding:18px 20px; margin-bottom:16px; }
      .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:14px; } .card { padding:14px; } .card strong { display:block; font-size:1.35rem; color:var(--primary); } .card small { color:var(--muted); }
      .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; } .section { padding:16px; min-width:0; } .section.full { grid-column:1 / -1; }
      h1 { margin:0 0 4px; font-size:clamp(1.3rem,3vw,1.9rem); } h2 { margin:0 0 10px; font-size:1.02rem; } .muted,.meta { color:var(--muted); font-size:.8rem; } .meta { overflow-wrap:anywhere; }
      .list { display:grid; gap:8px; } .row { padding:10px 12px; border:1px solid #e6ebf3; border-radius:10px; background:#fbfcfe; } .row p { margin:.3rem 0; white-space:pre-wrap; overflow-wrap:anywhere; } .head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
      .pill { padding:2px 8px; border-radius:999px; background:#edf2f8; color:#52647d; font-size:.72rem; font-weight:700; white-space:nowrap; } .pill.good { background:#e5f7f2; color:var(--teal); } .pill.warn { background:#fff3dc; color:var(--amber); } .pill.bad { background:#fff0f3; color:var(--rose); }
      .empty { padding:12px; border:1px dashed #cad4e2; border-radius:10px; color:var(--muted); text-align:center; font-size:.82rem; } code { direction:ltr; unicode-bidi:embed; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.74rem; }
      .scroll { overflow:auto; } table { width:100%; border-collapse:collapse; font-size:.82rem; } th,td { padding:6px 8px; text-align:start; border-bottom:1px solid #eef2f8; } td { direction:ltr; unicode-bidi:plaintext; } th { color:var(--muted); font-weight:700; }
      form { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; align-items:end; } form label { display:grid; gap:4px; color:var(--muted); font-size:.78rem; } form .wide { grid-column:1 / -1; } input,select,textarea { padding:7px 9px; border:1px solid #cbd8e8; border-radius:8px; font:inherit; background:#fff; color:var(--ink); }
      button { padding:8px 14px; border:1px solid var(--primary); border-radius:9px; background:var(--primary); color:#fff; cursor:pointer; font:inherit; font-size:.82rem; }
      nav.crumbs { font-size:.8rem; color:var(--muted); margin-bottom:6px; } nav.crumbs a, a { color:var(--primary); }
      @media(max-width:900px){ .cards { grid-template-columns:repeat(2,minmax(0,1fr)); } .grid { grid-template-columns:1fr; } .section.full { grid-column:auto; } form { grid-template-columns:1fr; } }
      ${getHeroShellStyles()}
    </style>
  </head>
  <body>
    ${getHeroGlobalNavigation({ active: "control", projectId, environment: "Private · Insights" })}
    <main id="hero-main" tabindex="-1" data-project-id="${escapeHtml(projectId)}" data-viewer-role="${escapeHtml(viewerRole)}">
      <header class="top hero-page-header"><nav class="crumbs" aria-label="مسیر"><a href="/api/portal?surface=portfolio&amp;select=project">پروژه‌ها</a> / <a href="/api/portal?surface=studio&amp;projectId=${encodeURIComponent(projectId)}">${escapeHtml(project.name)}</a> / هزینه و سلامت</nav><h1>هزینه، کارایی و سلامت ${escapeHtml(project.name)}</h1><p class="muted">فقط مصرف توکن؛ هیچ هزینهٔ پولی یا فراخوانی زنده‌ای در کار نیست. هر عدد به شواهدش لینک دارد.</p></header>
      <div class="cards">
        <article class="card" data-card="budget"><small>مصرف</small><strong>${number(budget.used)}</strong><small>${budget.budget ? `از سقف ${number(budget.budget.hardCap)} (هشدار از ${number(budget.budget.softThreshold)})` : "سقفی تنظیم نشده"}</small></article>
        <article class="card" data-card="decision"><small>وضعیت بودجه</small><strong data-budget-decision="${escapeHtml(budget.decision)}">${escapeHtml(decisionLabel)}</strong><small>${budget.paused ? `پروژه متوقف است (${escapeHtml(budget.pauseReason)})؛ فقط مالک ادامه می‌دهد` : `رزرو شده ${number(budget.reserved)}${budget.remaining === null ? "" : ` · باقی ${number(budget.remaining)}`}`}</small></article>
        <article class="card" data-card="health"><small>سلامت (فرمول ${escapeHtml(health.formulaVersion)})</small><strong data-health-status="${escapeHtml(health.status)}" class="${STATUS_CLASS[health.status] ?? ""}">${escapeHtml(STATUS_FA[health.status] ?? health.status)}</strong><small>اطمینان ${escapeHtml(health.confidence)} · نمونه ${escapeHtml(health.sampleSize)}${health.freshnessMinutes === null ? "" : ` · تازگی ${escapeHtml(health.freshnessMinutes)} دقیقه`}${health.reasons.length ? ` · ${escapeHtml(health.reasons.join("، "))}` : ""}</small></article>
        <article class="card" data-card="reconcile"><small>صحت حسابداری</small><strong data-reconcile-complete="${escapeHtml(reconciliation.complete)}" class="${reconciliation.complete ? "good" : "bad"}">${reconciliation.complete ? "هم‌خوان" : "ناهم‌خوان"}</strong><small>${number(reconciliation.projectTotal)} توکن در ${number(reconciliation.events)} رویداد؛ هر گروه‌بندی به همین جمع می‌رسد</small></article>
      </div>
      <div class="grid">
        ${table("مصرف به تفکیک تیم", "ledger-team", ledgerByTeam, "team")}
        ${table("مصرف به تفکیک مدل", "ledger-model", ledgerByModel, "model")}
        <section class="section" id="scorecards"><h2>امتیاز و کیفیت</h2><div class="list">${scoreRows}</div></section>
        <section class="section" id="feedback"><h2>بازخورد مالک</h2>${form}<div class="list" style="margin-top:12px">${feedbackRows}</div></section>
      </div>
    </main>
    <script>
      const CONFIG = ${projectJson};
      const form = document.querySelector('[data-feedback-form]');
      if (form) form.addEventListener('submit', async event => {
        event.preventDefault(); const status = document.querySelector('#feedback-status'); const data = new FormData(form);
        status.textContent = 'در حال ثبت…';
        const body = { feedbackId: 'feedback-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), subjectId: data.get('subjectId'), subjectKind: data.get('subjectKind'), rating: data.get('rating') ? Number(data.get('rating')) : null, comment: data.get('comment') || '' };
        try {
          const response = await fetch(CONFIG.base + '/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) { status.textContent = (payload.error?.message || payload.message || 'ثبت انجام نشد.') + (payload.code ? ' (' + payload.code + ')' : ''); return; }
          status.textContent = 'ثبت شد.'; setTimeout(() => location.reload(), 400);
        } catch { status.textContent = 'ارتباط برقرار نشد.'; }
      });
    </script>
    ${getHeroShellScript()}
  </body>
</html>`;
}
