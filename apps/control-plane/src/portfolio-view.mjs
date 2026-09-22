import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function safeJson(value) {
  return JSON.stringify(value ?? null).replaceAll("&", "\\u0026").replaceAll("<", "\\u003c").replaceAll(">", "\\u003e");
}

function healthClass(value) {
  if (/^(healthy|good|ready|ok)$/i.test(String(value))) return "good";
  if (/^(critical|failed|blocked|unhealthy)$/i.test(String(value))) return "bad";
  return "warn";
}

/** Portfolio is the global triage surface. Every value is API-backed and every
 * project card keeps its project scope in all downstream links. */
export function getPortfolioHtml({ portfolio, destination = null, selectionRequired = false }) {
  const cards = portfolio?.cards ?? [];
  const healthy = cards.filter(card => healthClass(card.health) === "good").length;
  const attention = cards.filter(card => healthClass(card.health) !== "good").length;
  const roadmapItems = cards.reduce((total, card) => total + (card.roadmap?.length ?? 0), 0);
  const destinationDetails = destination === "workspace"
    ? Object.freeze({ path: "/api/portal?surface=workspace", label: "فضای پروژه" })
    : destination === "control"
      ? Object.freeze({ path: "/api/portal?surface=control", label: "عملیات پروژه" })
      : destination === "command"
        ? Object.freeze({ path: "/api/portal?surface=command", label: "مرکز فرمان" })
        : destination === "studio"
          ? Object.freeze({ path: "/api/portal?surface=studio", label: "استودیوی محصول" })
          : destination === "walkthrough"
            ? Object.freeze({ path: "/api/portal?surface=walkthrough", label: "راهنمای ساخت" })
      : null;
  const rows = cards.map((card, index) => {
    const roadmap = card.roadmap ?? [];
    const health = card.health ?? "unknown";
    const projectId = encodeURIComponent(card.projectId);
    const primaryHref = destinationDetails
      ? `${destinationDetails.path}${destinationDetails.path.includes("?") ? "&" : "?"}projectId=${projectId}`
      : `/api/portal?surface=studio&projectId=${projectId}`;
    const primaryLabel = destinationDetails ? `ورود به ${destinationDetails.label}` : "باز کردن پروژه";
    return `<article class="project-card" data-project-card data-name="${escape(`${card.name} ${card.projectId}`.toLocaleLowerCase())}" data-lifecycle="${escape(card.lifecycle)}" data-index="${index}">
      <div class="project-card-head"><div class="project-symbol" aria-hidden="true">${escape(String(card.name || "H").trim().charAt(0).toLocaleUpperCase())}</div><div class="project-heading"><div class="project-title-row"><h2>${escape(card.name)}</h2><span class="health ${healthClass(health)}"><i></i>${escape(health)}</span></div><p><code>${escape(card.projectId)}</code> · ${escape(card.lifecycle)}</p></div></div>
      <div class="project-facts"><div><span data-hero-info-key="portfolio.tokenUsage">Token usage</span><strong>${escape(card.tokenUsage ?? "ثبت نشده")}</strong></div><div><span data-hero-info-key="portfolio.lastTask">Last task</span><strong>${escape(card.latestCompletedTask ?? "—")}</strong></div><div><span data-hero-info-key="portfolio.nextTasks">Next tasks</span><strong>${escape(roadmap.length)}</strong></div><div><span data-hero-info-key="portfolio.latestOutput">Latest output</span><strong>${escape(card.latestOutput ?? "—")}</strong></div></div>
      <div class="project-roadmap"><span data-hero-info-key="portfolio.nextRoadmap">گام بعد / Next</span><p>${escape(roadmap.slice(0, 2).map(item => item.title ?? item.id ?? item.taskId).join(" · ") || "هنوز برنامه‌ای ثبت نشده است.")}</p></div>
      <div class="project-card-actions"><a class="primary-action" data-hero-select-project="${projectId}" href="${escape(primaryHref)}">${escape(primaryLabel)} <span aria-hidden="true">←</span></a><a data-hero-select-project="${projectId}" href="/api/portal?surface=control&projectId=${projectId}">عملیات</a><a data-hero-select-project="${projectId}" href="/api/portal?surface=workspace&projectId=${projectId}">تنظیمات</a></div>
    </article>`;
  }).join("") || `<div class="empty-state"><div class="empty-symbol" aria-hidden="true">◇</div><h2>پروژه‌ای برای این دسترسی وجود ندارد</h2><p>مالک می‌تواند پروژه بسازد یا Project Grant مناسب را از بخش هویت اختصاص دهد.</p><a href="/api/portal?surface=identity">مدیریت دسترسی / Access</a></div>`;
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex,notranslate">
  <title>Hero — سبد پروژه‌ها</title>
  <style>
    ${getHeroShellStyles()}
    :root { color-scheme: light; font-family: Vazirmatn, sans-serif; }
    * { box-sizing: border-box; }
    body { min-width: 320px; margin: 0; background: var(--hero-canvas); color: var(--hero-ink); }
    button, input, select { font: inherit; }
    button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid color-mix(in srgb, var(--hero-brand) 45%, transparent); outline-offset: 3px; }
    main { width: min(1500px, calc(100% - 48px)); margin: 0 auto; padding: 34px 0 80px; }
    h1, h2, p { margin-top: 0; }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 30px; margin-bottom: 26px; padding: 20px 22px; border: 1px solid var(--hero-line); border-radius: 19px; background: linear-gradient(135deg, var(--hero-surface), var(--hero-brand-soft)); box-shadow: var(--hero-shadow-sm); }
    .eyebrow { display: block; margin-bottom: 8px; color: var(--hero-brand); font: 850 10px/1.4 system-ui,sans-serif; letter-spacing: .15em; direction: ltr; text-transform: uppercase; }
    h1 { max-width: 850px; margin-bottom: 9px; font-size: clamp(1.75rem, 3.2vw, 2.75rem); letter-spacing: -.045em; line-height: 1.35; }
    .lead { max-width: 820px; margin-bottom: 0; color: var(--hero-muted); font-size: .91rem; line-height: 1.95; }.helper-copy { display: none; }
    .page-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .button { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 8px 13px; border: 1px solid var(--hero-line); border-radius: 11px; background: var(--hero-surface); color: var(--hero-ink); font-size: .79rem; font-weight: 800; text-decoration: none; box-shadow: var(--hero-shadow-sm); }
    .button.primary { border-color: var(--hero-brand); background: var(--hero-brand); color: #fff; }
    .summary-layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(290px, .45fr); gap: 16px; margin-bottom: 20px; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 11px; }
    .metric { position: relative; min-height: 118px; overflow: hidden; padding: 17px; border: 1px solid var(--hero-line); border-radius: 16px; background: var(--hero-surface); box-shadow: var(--hero-shadow-sm); }
    .metric::after { position: absolute; inset-inline-end: -22px; bottom: -38px; width: 100px; height: 100px; border-radius: 50%; background: var(--hero-brand-soft); content: ""; }
    .metric span, .metric small { position: relative; z-index: 1; display: block; color: var(--hero-muted); font-size: .72rem; }
    .metric strong { position: relative; z-index: 1; display: block; margin: 8px 0 5px; color: var(--hero-ink); font-size: 1.65rem; line-height: 1; }
    .metric.attention strong { color: var(--hero-warning); }
    .decision-card { display: grid; align-content: space-between; gap: 20px; padding: 18px; border-radius: 17px; background: linear-gradient(145deg, #211d68, #4f46e5); color: #fff; box-shadow: 0 18px 42px rgba(45,38,140,.24); }
    .decision-card small { opacity: .72; font-size: .68rem; text-transform: uppercase; letter-spacing: .12em; }
    .decision-card h2 { margin: 7px 0; font-size: 1.08rem; }
    .decision-card p { margin: 0; opacity: .79; font-size: .76rem; line-height: 1.8; }
    .decision-card a { width: fit-content; padding: 8px 10px; border-radius: 9px; background: rgba(255,255,255,.14); color: #fff; font-size: .75rem; font-weight: 800; text-decoration: none; }
    .selection-notice { display: flex; align-items: center; gap: 10px; margin: 0 0 20px; padding: 13px 15px; border: 1px solid color-mix(in srgb, var(--hero-brand) 28%, var(--hero-line)); border-radius: 13px; background: var(--hero-brand-soft); color: var(--hero-ink); font-size: .82rem; line-height: 1.85; }.selection-notice strong { color: var(--hero-brand); }
    .content-panel { border: 1px solid var(--hero-line); border-radius: 18px; background: var(--hero-surface); box-shadow: var(--hero-shadow-sm); }
    .panel-head { min-height: 74px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 15px 18px; border-bottom: 1px solid var(--hero-line); }
    .panel-head h2 { margin-bottom: 3px; font-size: 1rem; }
    .panel-head p { margin-bottom: 0; color: var(--hero-muted); font-size: .72rem; }
    .view-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .search-wrap { position: relative; }
    .search-wrap input { width: min(300px, 32vw); min-height: 39px; padding: 8px 34px 8px 11px; border: 1px solid var(--hero-line); border-radius: 10px; background: var(--hero-canvas); color: var(--hero-ink); }
    .search-wrap::before { position: absolute; inset-inline-start: 12px; top: 10px; color: var(--hero-muted); content: "⌕"; }
    select { min-height: 39px; padding: 7px 10px; border: 1px solid var(--hero-line); border-radius: 10px; background: var(--hero-canvas); color: var(--hero-ink); }
    .project-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; padding: 16px; }
    .project-card { min-width: 0; padding: 17px; border: 1px solid var(--hero-line); border-radius: 15px; background: color-mix(in srgb, var(--hero-surface) 96%, var(--hero-brand-soft)); transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
    .project-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--hero-brand) 30%, var(--hero-line)); box-shadow: 0 14px 34px rgba(28,38,66,.09); }
    .project-card-head { display: flex; align-items: flex-start; gap: 12px; }
    .project-symbol { width: 42px; height: 42px; flex: 0 0 42px; display: grid; place-items: center; border-radius: 13px; background: var(--hero-brand-soft); color: var(--hero-brand); font: 900 15px/1 system-ui,sans-serif; }
    .project-heading { min-width: 0; flex: 1; }
    .project-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .project-title-row h2 { margin-bottom: 3px; overflow: hidden; font-size: .98rem; text-overflow: ellipsis; white-space: nowrap; }
    .project-heading p { margin: 0; color: var(--hero-muted); font-size: .69rem; }
    code { direction: ltr; unicode-bidi: embed; font-family: ui-monospace,SFMono-Regular,Consolas,monospace; }
    .health { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 999px; background: var(--hero-warning-soft); color: var(--hero-warning); font-size: .64rem; font-weight: 850; white-space: nowrap; }
    .health i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .health.good { background: var(--hero-success-soft); color: var(--hero-success); } .health.bad { background: var(--hero-danger-soft); color: var(--hero-danger); }
    .project-facts { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; margin: 16px 0 13px; }
    .project-facts > div { min-width: 0; padding: 9px 10px; border-radius: 10px; background: var(--hero-canvas); }
    .project-facts span, .project-facts strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .project-facts span { margin-bottom: 3px; color: var(--hero-muted); font-size: .62rem; direction: ltr; }
    .project-facts strong { font-size: .73rem; }
    .project-roadmap { min-height: 60px; padding-top: 12px; border-top: 1px solid var(--hero-line); }
    .project-roadmap span { display: block; margin-bottom: 3px; color: var(--hero-muted); font-size: .65rem; font-weight: 800; }
    .project-roadmap p { margin: 0; color: var(--hero-ink); font-size: .72rem; line-height: 1.75; }
    .project-card-actions { display: flex; align-items: center; gap: 7px; margin-top: 14px; }
    .project-card-actions a { min-height: 33px; display: inline-flex; align-items: center; padding: 6px 9px; border-radius: 8px; color: var(--hero-muted); font-size: .68rem; font-weight: 800; text-decoration: none; }
    .project-card-actions a:hover { background: var(--hero-brand-soft); color: var(--hero-brand); }
    .project-card-actions .primary-action { margin-inline-end: auto; background: var(--hero-brand); color: #fff; }
    .empty-state { grid-column: 1 / -1; padding: 50px 20px; text-align: center; }
    .empty-symbol { width: 52px; height: 52px; display: grid; place-items: center; margin: 0 auto 14px; border-radius: 16px; background: var(--hero-brand-soft); color: var(--hero-brand); font-size: 1.4rem; }
    .empty-state h2 { font-size: 1rem; } .empty-state p { color: var(--hero-muted); font-size: .78rem; }.empty-state a { color: var(--hero-brand); font-weight: 800; }
    .create-dialog { width: min(720px,calc(100% - 28px)); max-height: calc(100vh - 38px); padding: 0; border: 1px solid var(--hero-line); border-radius: 18px; background: var(--hero-surface-raised); color: var(--hero-ink); box-shadow: var(--hero-shadow-lg); }
    .create-dialog::backdrop { background: rgba(8,15,30,.55); backdrop-filter: blur(3px); }
    .dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 19px; border-bottom: 1px solid var(--hero-line); }
    .dialog-head h2 { margin-bottom: 4px; font-size: 1.08rem; }.dialog-head p { margin: 0; color: var(--hero-muted); font-size: .74rem; line-height: 1.7; }
    .dialog-close { width: 34px; height: 34px; border: 1px solid var(--hero-line); border-radius: 9px; background: var(--hero-canvas); color: var(--hero-muted); cursor: pointer; }
    .create-form { display: grid; gap: 12px; padding: 19px; }.form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 11px; }
    .create-form label { display: grid; gap: 6px; color: var(--hero-muted); font-size: .72rem; font-weight: 800; }.create-form label.full { grid-column: 1 / -1; }
    .create-form input,.create-form textarea,.create-form select { width: 100%; min-height: 41px; padding: 9px 10px; border: 1px solid var(--hero-line-strong); border-radius: 9px; background: var(--hero-surface); color: var(--hero-ink); }.create-form textarea { min-height: 82px; resize: vertical; }.risk-flags { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px 12px; margin: 0; padding: 11px; border: 1px solid var(--hero-line); border-radius: 11px; }.risk-flags legend { padding: 0 5px; color: var(--hero-muted); font-size: .72rem; }.risk-flags label { display: grid; gap: 6px; color: var(--hero-muted); font-size: .7rem; font-weight: 700; }.risk-flags label > span { display: inline-flex; align-items: center; gap: 4px; }.risk-flags select { min-height: 36px; font-size: .7rem; }.risk-flags input { width: auto; min-height: auto; }.intake-advisor-results { display: grid; gap: 9px; }.intake-advisor-results:empty { display: none; }.intake-advisor-card { display: grid; gap: 8px; padding: 11px; border: 1px solid var(--hero-line); border-radius: 11px; background: var(--hero-canvas); }.intake-advisor-card header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }.intake-advisor-card h3 { margin: 0; font-size: .78rem; }.intake-advisor-card p,.intake-advisor-card small { margin: 0; color: var(--hero-muted); font-size: .69rem; line-height: 1.8; }.intake-advisor-card ul { margin: 0; padding-inline-start: 19px; color: var(--hero-muted); font-size: .67rem; line-height: 1.8; }.intake-advisor-feedback { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: end; padding: 11px; border: 1px solid var(--hero-line); border-radius: 11px; background: var(--hero-brand-soft); }.intake-advisor-feedback textarea { min-height: 56px; }.intake-advisor-note { margin: 0; color: var(--hero-muted); font-size: .7rem; line-height: 1.8; }
    .dialog-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding-top: 6px; }.dialog-status { min-height: 20px; margin: 0; color: var(--hero-danger); font-size: .74rem; }
    [data-hero-theme="dark"] .decision-card { background: linear-gradient(145deg,#282451,#4a43a7); }
    @media (max-width: 1050px) { .summary-layout { grid-template-columns: 1fr; }.metric-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }.project-grid { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { main { width: min(100% - 20px,720px); padding-top: 23px; }.page-head,.panel-head { display: block; }.page-actions,.view-controls { margin-top: 13px; }.search-wrap input { width: 100%; }.search-wrap { flex: 1; }.project-grid { padding: 10px; }.project-facts { grid-template-columns: 1fr 1fr; }.metric-grid { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  ${getHeroGlobalNavigation({ active: "portfolio", environment: "Private · Protected" })}
  <main id="hero-main" tabindex="-1">
    <header class="page-head hero-page-header">
      <div><span class="eyebrow">PORTFOLIO / PROJECT SELECTION</span><h1 data-hero-info-key="portfolio.availableProjects">${destinationDetails ? `یک پروژه برای ${escape(destinationDetails.label)} انتخاب کنید` : selectionRequired ? "برای ادامه، یک پروژه را انتخاب کنید" : "همهٔ پروژه‌ها، تصمیم‌ها و ریسک‌ها در یک نقطه"}</h1><p class="lead helper-copy">Portfolio تنها نمای چندپروژه‌ای Hero است. پس از انتخاب یک پروژه، مرکز فرمان، رودمپ، تنظیمات، عملیات و خروجی‌ها فقط در Scope همان پروژه نمایش داده می‌شوند تا زمانی که پروژهٔ فعال را تغییر دهید.</p></div>
      <div class="page-actions" data-hero-guide-target="portfolio.create-project"><button class="button primary" id="create-project-button" type="button" hidden>پروژهٔ جدید</button><a class="button" href="/api/portal?surface=identity">مدیریت دسترسی</a><a class="button primary" href="/api/portal?surface=portfolio&select=project&next=command">مرکز فرمان Hero</a></div>
    </header>
    <section class="summary-layout" aria-label="خلاصه سبد پروژه‌ها">
      <div class="metric-grid">
        <article class="metric"><span data-hero-info-key="portfolio.projects">Projects / پروژه‌ها</span><strong>${escape(cards.length)}</strong><small>پروژهٔ قابل مشاهده</small></article>
        <article class="metric"><span data-hero-info-key="portfolio.health">Healthy / سالم</span><strong>${escape(healthy)}</strong><small>بر اساس Health ثبت‌شده</small></article>
        <article class="metric attention"><span data-hero-info-key="portfolio.attention">Needs attention / نیازمند توجه</span><strong>${escape(attention)}</strong><small>نامشخص، هشدار یا مسدود</small></article>
        <article class="metric"><span data-hero-info-key="portfolio.upcoming">Upcoming / پیش رو</span><strong>${escape(roadmapItems)}</strong><small>گام Roadmap ثبت‌شده</small></article>
      </div>
      <aside class="decision-card"><div><small>Project scope</small><h2 data-hero-info-key="portfolio.ownerBriefing">اول پروژه، سپس اقدام</h2><p>هر وضعیت مستقیماً به فضای project-scoped و Evidence مربوط به همان پروژه متصل است. برای جلوگیری از آمیختن داده‌ها، مرکز فرمان بدون انتخاب پروژه باز نمی‌شود.</p></div><a href="#projects-title">یک پروژه انتخاب کنید ←</a></aside>
    </section>
    ${(destinationDetails || selectionRequired) ? `<aside class="selection-notice" role="status"><strong>انتخاب پروژه لازم است.</strong><span>${destinationDetails ? `«${escape(destinationDetails.label)}»` : "همهٔ صفحه‌های عملیاتی"} فقط در Scope یک پروژه باز می‌شود؛ دکمهٔ اصلی کارت پروژهٔ موردنظر را انتخاب کنید.</span></aside>` : ""}
    <section class="content-panel" aria-labelledby="projects-title" data-hero-guide-target="portfolio.project-selection">
      <div class="panel-head"><div><h2 id="projects-title" data-hero-info-key="portfolio.availableProjects">پروژه‌های در دسترس</h2><p id="portfolio-count">${escape(cards.length)} پروژه · دادهٔ واقعی و scope‌شده</p></div><div class="view-controls"><label class="search-wrap"><span class="hero-skip-link">جست‌وجو</span><input id="portfolio-search" type="search" placeholder="جست‌وجوی نام یا شناسه…" aria-label="جست‌وجوی پروژه"></label><select id="portfolio-filter" aria-label="فیلتر چرخه حیات"><option value="all">همهٔ وضعیت‌ها</option>${[...new Set(cards.map(card => card.lifecycle).filter(Boolean))].map(value => `<option value="${escape(value)}">${escape(value)}</option>`).join("")}</select></div></div>
      <div id="project-grid" class="project-grid" aria-live="polite">${rows}</div>
    </section>
  </main>
  <dialog class="create-dialog" id="create-project-dialog" aria-labelledby="create-project-title"><div class="dialog-head"><div><h2 id="create-project-title" data-hero-info-key="portfolio.createProject">تعریف پروژهٔ جدید</h2><p>این فرم تنها محل ثبت اولیهٔ هدف، کاربران و شیوهٔ تأیید است. پس از ثبت، Hero مستقیم Foundation قابل بازبینی می‌سازد؛ همان پرسش‌ها دوباره در یک مرحلهٔ جدا تکرار نمی‌شوند. در این مرحله هیچ کد، کانتینر، Secret یا deployی اجرا نمی‌شود.</p></div><button class="dialog-close" id="create-project-close" type="button" aria-label="بستن">×</button></div><form class="create-form" id="create-project-form" data-hero-no-form-suggestion><div class="form-grid"><label>شناسهٔ پروژه<input name="projectId" required pattern="[a-z][a-z0-9-]{2,62}" placeholder="crm-platform" dir="ltr"></label><label>نام پروژه<input name="name" required minlength="2" maxlength="120" placeholder="CRM Platform"></label><label class="full">توضیح<textarea name="description" required minlength="2" maxlength="1000" placeholder="محصول و نتیجهٔ مورد انتظار را کوتاه توضیح دهید."></textarea></label><label class="full">هدف اولیه<textarea name="goal" required maxlength="500" placeholder="هدف کسب‌وکار و خروجی مورد انتظار"></textarea></label><label>کاربران هدف<input name="users" required maxlength="500" placeholder="تیم فروش و پشتیبانی"></label><label>نوع محصول<select name="projectType"><option value="application">نرم‌افزار کاربردی</option><option value="web">وب‌اپلیکیشن</option><option value="service">سرویس</option><option value="data">محصول داده‌ای</option><option value="security-tool">ابزار امنیتی</option><option value="library">کتابخانه</option><option value="other">سایر</option></select></label><label>سطح ریسک درخواستی<select name="riskLevel"><option value="standard">استاندارد</option><option value="low">پایین</option><option value="high">بالا</option><option value="critical">بحرانی</option></select></label><label>شیوهٔ تأیید<select name="autonomy"><option value="approval-each-stage">تأیید در هر مرحله</option><option value="approved-autonomous">خودکار پس از تأیید Foundation</option></select></label><label class="full">محدودیت‌ها<textarea name="constraints" maxlength="3000" placeholder="هر مورد را در یک خط بنویسید؛ مثال: بدون انتشار عمومی"></textarea></label><label class="full">خروجی‌های مورد انتظار<textarea name="expectedOutputs" maxlength="3000" placeholder="هر مورد را در یک خط بنویسید؛ مثال: Docker image قابل انتقال"></textarea></label><fieldset class="full risk-flags"><legend>ارزیابی اختیاری ریسک — «نمی‌دانم» مجاز است و به معنی «خیر» نیست</legend><label><span>دسترسی عمومی یا اینترنتی <span data-hero-info-key="portfolio.riskInternetFacing"></span></span><select name="riskAnswer.internetFacing"><option value="unknown" selected>نمی‌دانم</option><option value="yes">بله</option><option value="no">خیر</option></select></label><label><span>دادهٔ شخصی <span data-hero-info-key="portfolio.riskPersonalData"></span></span><select name="riskAnswer.personalData"><option value="unknown" selected>نمی‌دانم</option><option value="yes">بله</option><option value="no">خیر</option></select></label><label><span>حوزه یا دادهٔ مقرراتی <span data-hero-info-key="portfolio.riskRegulatedData"></span></span><select name="riskAnswer.regulatedData"><option value="unknown" selected>نمی‌دانم</option><option value="yes">بله</option><option value="no">خیر</option></select></label><label><span>امنیت یا زیرساخت حساس <span data-hero-info-key="portfolio.riskSecuritySensitive"></span></span><select name="riskAnswer.securitySensitive"><option value="unknown" selected>نمی‌دانم</option><option value="yes">بله</option><option value="no">خیر</option></select></label><label><span>اتصال به سرویس بیرونی <span data-hero-info-key="portfolio.riskExternalIntegrations"></span></span><select name="riskAnswer.externalIntegrations"><option value="unknown" selected>نمی‌دانم</option><option value="yes">بله</option><option value="no">خیر</option></select></label><label><span>نیاز احتمالی به دسترسی سطح‌بالا <span data-hero-info-key="portfolio.riskPrivilegedAccess"></span></span><select name="riskAnswer.requiresPrivilegedAccess"><option value="unknown" selected>نمی‌دانم</option><option value="yes">بله</option><option value="no">خیر</option></select></label></fieldset></div><p class="dialog-status" id="create-project-status" role="alert"></p><div class="dialog-actions"><button class="button" id="create-project-cancel" type="button">انصراف</button><button class="button" id="open-intake-advisor" type="button" disabled data-hero-info-key="portfolio.intakeAdvisor">مشورت با Advisor</button><button class="button primary" type="submit">ثبت و ساخت Foundation</button></div></form></dialog>
  <dialog class="create-dialog" id="intake-advisor-dialog" aria-labelledby="intake-advisor-title"><div class="dialog-head"><div><h2 id="intake-advisor-title" data-hero-info-key="portfolio.intakeAdvisor">Advisor مرحلهٔ ایجاد پروژه</h2><p>بر اساس پنج پاسخ نخست، سه پیشنهاد برای بقیهٔ فرم ساخته می‌شود. انتخاب هر پیشنهاد فقط فیلدهای فرم را پر می‌کند و هنوز هیچ Project، اتصال، Test، هزینه یا انتشار ایجاد نمی‌کند.</p></div><button class="dialog-close" id="intake-advisor-close" type="button" aria-label="بستن">×</button></div><section class="create-form"><label>Advisor انتخابی<select id="intake-advisor-profile"><option value="local">راهنمای محلی Hero · بدون هزینه</option></select></label><p class="intake-advisor-note" id="intake-advisor-note">برای پاسخ‌گویی پیش از ثبت پروژه، فقط راهنمای محلی در دسترس است. Provider زنده پس از ثبت پروژه و گیت‌های مستقل قابل بررسی خواهد بود.</p><p class="dialog-status" id="intake-advisor-status" role="status" aria-live="polite"></p><div class="intake-advisor-results" id="intake-advisor-results" aria-live="polite"></div><form class="intake-advisor-feedback" id="intake-advisor-feedback"><label>بازخورد برای پیشنهاد تازه<textarea id="intake-advisor-feedback-input" maxlength="700" placeholder="مثلاً: فقط دو صفحه را نگه دار و روی سادگی CMS تمرکز کن."></textarea></label><button class="button" type="submit">ساخت پیشنهاد بهتر</button></form><div class="dialog-actions"><button class="button" id="intake-advisor-refresh" type="button">ساخت سه پیشنهاد</button><button class="button primary" id="intake-advisor-cancel" type="button">بازگشت به فرم</button></div></section></dialog>
  <script>(() => {
    const state = ${safeJson({ projectCount: cards.length })};
    const search = document.getElementById('portfolio-search');
    const filter = document.getElementById('portfolio-filter');
    const count = document.getElementById('portfolio-count');
    function update() {
      const query = String(search?.value || '').trim().toLocaleLowerCase();
      const lifecycle = filter?.value || 'all';
      let visible = 0;
      document.querySelectorAll('[data-project-card]').forEach(card => {
        const show = (!query || card.dataset.name.includes(query)) && (lifecycle === 'all' || card.dataset.lifecycle === lifecycle);
        card.hidden = !show; if (show) visible += 1;
      });
      if (count) count.textContent = visible + ' از ' + state.projectCount + ' پروژه · دادهٔ واقعی و scope‌شده';
    }
    search?.addEventListener('input', update); filter?.addEventListener('change', update);
    const createButton = document.getElementById('create-project-button');
    const createDialog = document.getElementById('create-project-dialog');
    const createForm = document.getElementById('create-project-form');
    const createStatus = document.getElementById('create-project-status');
    const intakeAdvisorButton = document.getElementById('open-intake-advisor');
    const intakeAdvisorDialog = document.getElementById('intake-advisor-dialog');
    const intakeAdvisorProfile = document.getElementById('intake-advisor-profile');
    const intakeAdvisorStatus = document.getElementById('intake-advisor-status');
    const intakeAdvisorResults = document.getElementById('intake-advisor-results');
    const intakeAdvisorFeedback = document.getElementById('intake-advisor-feedback');
    const intakeAdvisorFeedbackInput = document.getElementById('intake-advisor-feedback-input');
    const intakeAdvisorRefresh = document.getElementById('intake-advisor-refresh');
    const intakeFirstFive = () => ({ projectId: createForm.elements.projectId.value.trim(), name: createForm.elements.name.value.trim(), description: createForm.elements.description.value.trim(), goal: createForm.elements.goal.value.trim(), users: createForm.elements.users.value.trim() });
    const intakeFirstFiveReady = () => {
      const values = intakeFirstFive();
      return /^[a-z][a-z0-9-]{2,62}$/.test(values.projectId) && values.name.length >= 2 && values.description.length >= 2 && values.goal.length >= 2 && values.users.length >= 2;
    };
    const syncIntakeAdvisor = () => { if (intakeAdvisorButton) intakeAdvisorButton.disabled = !intakeFirstFiveReady(); };
    function intakeAdvisorList(items) {
      const list = document.createElement('ul');
      for (const item of Array.isArray(items) ? items : []) { const row = document.createElement('li'); row.textContent = item; list.append(row); }
      return list;
    }
    function applyIntakeSuggestion(values) {
      if (!values || typeof values !== 'object') return;
      for (const name of ['projectType','riskLevel','autonomy']) if (values[name] && createForm.elements[name]) createForm.elements[name].value = values[name];
      for (const name of ['constraints','expectedOutputs']) if (Array.isArray(values[name]) && createForm.elements[name]) createForm.elements[name].value = values[name].join('\\n');
      for (const [key, value] of Object.entries(values.riskAnswers || {})) { const control = createForm.elements['riskAnswer.' + key]; if (control && ['yes','no','unknown'].includes(value)) control.value = value; }
      createStatus.textContent = 'پیشنهاد Advisor در فرم اعمال شد؛ پیش از ثبت، آن را بازبینی کنید.';
      intakeAdvisorDialog.close();
    }
    function renderIntakeAdvisor(advisor) {
      intakeAdvisorResults.replaceChildren();
      for (const suggestion of Array.isArray(advisor?.suggestions) ? advisor.suggestions : []) {
        const card = document.createElement('article'); card.className = 'intake-advisor-card';
        const header = document.createElement('header'); const title = document.createElement('h3'); title.textContent = suggestion.title || 'پیشنهاد'; const apply = document.createElement('button'); apply.className = 'button primary'; apply.type = 'button'; apply.textContent = 'اعمال در فرم'; apply.addEventListener('click', () => applyIntakeSuggestion(suggestion.values)); header.append(title, apply);
        const rationale = document.createElement('p'); rationale.textContent = suggestion.rationale || '';
        const constraintsTitle = document.createElement('small'); constraintsTitle.textContent = 'محدودیت‌های پیشنهادی';
        const outputsTitle = document.createElement('small'); outputsTitle.textContent = 'خروجی‌های پیشنهادی';
        const risks = Object.entries(suggestion.values?.riskAnswers || {}).filter(([, value]) => value !== 'unknown').map(([key, value]) => key + ': ' + (value === 'yes' ? 'بله' : 'خیر'));
        const riskNote = document.createElement('small'); riskNote.textContent = risks.length ? 'پاسخ‌های مشخصِ ریسک: ' + risks.join(' · ') : 'پاسخ‌های ریسک هنوز «نمی‌دانم» هستند.';
        card.append(header, rationale, constraintsTitle, intakeAdvisorList(suggestion.values?.constraints), outputsTitle, intakeAdvisorList(suggestion.values?.expectedOutputs), riskNote); intakeAdvisorResults.append(card);
      }
    }
    async function requestIntakeAdvisor({ feedback = null } = {}) {
      if (!intakeFirstFiveReady()) { createStatus.textContent = 'برای استفاده از Advisor، پنج پاسخ نخست را کامل کنید.'; return; }
      const path = feedback === null ? '/api/project-intake-advisor' : '/api/project-intake-advisor/refine';
      intakeAdvisorStatus.textContent = feedback === null ? 'در حال ساخت سه پیشنهاد قابل بازبینی…' : 'در حال اعمال بازخورد…'; intakeAdvisorStatus.dataset.state = '';
      intakeAdvisorRefresh.disabled = true;
      const feedbackButton = intakeAdvisorFeedback?.querySelector('[type="submit"]'); if (feedbackButton) feedbackButton.disabled = true;
      try {
        const response = await fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ firstFive: intakeFirstFive(), selectedAdvisor: intakeAdvisorProfile.value, ...(feedback === null ? {} : { feedback }) }) });
        const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || body.code || 'پیشنهاد Advisor آماده نشد.');
        renderIntakeAdvisor(body.advisor); intakeAdvisorStatus.textContent = body.advisor?.feedbackResponse || body.advisor?.notice || 'سه پیشنهاد آماده است؛ یکی را در فرم اعمال کنید.';
      } catch (error) { intakeAdvisorStatus.dataset.state = 'error'; intakeAdvisorStatus.textContent = error.message || 'پیشنهاد Advisor آماده نشد.'; }
      finally { intakeAdvisorRefresh.disabled = false; if (feedbackButton) feedbackButton.disabled = false; }
    }
    async function loadIntakeAdvisorOptions() {
      const response = await fetch('/api/project-intake-advisor/options', { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
      if (!response?.ok) return;
      const body = await response.json().catch(() => ({}));
      for (const profile of Array.isArray(body.advisor?.profiles) ? body.advisor.profiles : []) {
        if (!profile?.profileId || intakeAdvisorProfile.querySelector('option[value="' + CSS.escape(profile.profileId) + '"]')) continue;
        const option = document.createElement('option'); option.value = profile.profileId; option.disabled = true; option.textContent = (profile.label || profile.profileId) + ' · پس از ثبت پروژه و مجوز هزینه'; intakeAdvisorProfile.append(option);
      }
      if (body.advisor?.note) document.getElementById('intake-advisor-note').textContent = body.advisor.note;
    }
    intakeAdvisorButton?.addEventListener('click', () => { if (!intakeFirstFiveReady()) { createStatus.textContent = 'برای استفاده از Advisor، پنج پاسخ نخست را کامل کنید.'; return; } intakeAdvisorStatus.textContent = 'در حال آماده‌سازی Advisor محلی…'; intakeAdvisorDialog.showModal(); void loadIntakeAdvisorOptions(); void requestIntakeAdvisor(); });
    intakeAdvisorRefresh?.addEventListener('click', () => { void requestIntakeAdvisor(); });
    intakeAdvisorFeedback?.addEventListener('submit', event => { event.preventDefault(); const feedback = intakeAdvisorFeedbackInput.value.trim(); if (feedback.length < 3) { intakeAdvisorStatus.dataset.state = 'error'; intakeAdvisorStatus.textContent = 'لطفاً کوتاه توضیح دهید چه چیزی باید تغییر کند.'; return; } void requestIntakeAdvisor({ feedback }); });
    document.getElementById('intake-advisor-close')?.addEventListener('click', () => intakeAdvisorDialog.close());
    document.getElementById('intake-advisor-cancel')?.addEventListener('click', () => intakeAdvisorDialog.close());
    intakeAdvisorDialog?.addEventListener('click', event => { if (event.target === intakeAdvisorDialog) intakeAdvisorDialog.close(); });
    createForm?.addEventListener('input', syncIntakeAdvisor);
    createForm?.addEventListener('change', syncIntakeAdvisor);
    async function detectOwner() {
      const response = await fetch('/api/identity/me', {credentials:'same-origin',cache:'no-store'}).catch(() => null);
      if (!response?.ok) return; const body = await response.json(); if (body.principal?.role === 'project-owner') createButton.hidden = false;
    }
    createButton?.addEventListener('click', () => { createStatus.textContent = ''; syncIntakeAdvisor(); createDialog.showModal(); queueMicrotask(() => createForm.elements.projectId.focus()); });
    document.getElementById('create-project-close')?.addEventListener('click', () => createDialog.close());
    document.getElementById('create-project-cancel')?.addEventListener('click', () => createDialog.close());
    createDialog?.addEventListener('click', event => { if (event.target === createDialog) createDialog.close(); });
    createDialog?.addEventListener('click', event => { if (event.target === createDialog) createDialog.close(); });
    createForm?.addEventListener('submit', async event => {
      event.preventDefault(); createStatus.textContent = ''; const form = new FormData(createForm);
      const submit = createForm.querySelector('[type="submit"]'); submit.disabled = true;
      try {
        const list = name => String(form.get(name) || '').split(/[,\\n]/).map(item => item.trim()).filter(Boolean);
        const riskAnswers = Object.fromEntries([...createForm.querySelectorAll('select[name^="riskAnswer."]')].map(select => [select.name.slice('riskAnswer.'.length), select.value]));
        const response = await fetch('/api/projects',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({projectId:form.get('projectId'),name:form.get('name'),description:form.get('description'),intake:{goal:form.get('goal'),users:form.get('users'),autonomy:form.get('autonomy'),projectType:form.get('projectType'),riskLevel:form.get('riskLevel'),constraints:list('constraints'),expectedOutputs:list('expectedOutputs'),riskAnswers}})});
        const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || body.code || 'پروژه ثبت نشد.');
        // Project creation can be initiated from the persistent Walk-Through.
        // Continue its existing state into the new project's Workspace instead
        // of leaving it attached to the old Portfolio-only creation target.
        if (window.heroWalkthrough?.getState?.()?.active) {
          window.heroWalkthrough.continue({ stepId: 'inputs', projectId: body.project.projectId });
          return;
        }
        location.assign('/api/portal?surface=studio&projectId=' + encodeURIComponent(body.project.projectId));
      } catch (error) { createStatus.textContent = error.message; submit.disabled = false; }
    });
    detectOwner();
  })();</script>
  ${getHeroShellScript()}
</body></html>`;
}
