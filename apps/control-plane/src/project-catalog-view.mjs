import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

const TYPE_ORDER = Object.freeze(["project", "application", "component", "service", "api", "data", "repository", "environment", "server"]);
const TYPE_LABELS = Object.freeze({ project: "پروژه", application: "برنامه", component: "جزء", service: "سرویس", api: "API", data: "داده", repository: "مخزن", environment: "محیط", server: "سرور" });
const HEALTH_CLASS = Object.freeze({ healthy: "good", degraded: "warn", critical: "bad", unknown: "" });

/** BO-096: a deterministic layered SVG — one column per entity type, rows in id order. */
export function dependencyGraphSvg(graph) {
  const columns = TYPE_ORDER.map(type => ({ type, nodes: graph.nodes.filter(node => node.type === type) })).filter(column => column.nodes.length);
  const width = Math.max(320, columns.length * 190); const rows = Math.max(1, ...columns.map(column => column.nodes.length)); const height = rows * 64 + 56;
  const position = new Map();
  columns.forEach((column, columnIndex) => column.nodes.forEach((node, rowIndex) => position.set(node.entityId, { x: 20 + columnIndex * 190, y: 44 + rowIndex * 64 })));
  const edges = graph.edges.filter(edge => position.has(edge.from) && position.has(edge.to)).map(edge => {
    const from = position.get(edge.from); const to = position.get(edge.to);
    return `<g data-edge-from="${escapeHtml(edge.from)}" data-edge-to="${escapeHtml(edge.to)}" data-relation="${escapeHtml(edge.relation)}"><line x1="${from.x + 150}" y1="${from.y + 16}" x2="${to.x}" y2="${to.y + 16}" /><title>${escapeHtml(`${edge.from} → ${edge.to} (${edge.relation})`)}</title></g>`;
  }).join("");
  const nodes = columns.map((column, columnIndex) => `<text class="col" x="${20 + columnIndex * 190}" y="22">${escapeHtml(TYPE_LABELS[column.type])}</text>` + column.nodes.map(node => { const at = position.get(node.entityId); return `<g data-graph-node="${escapeHtml(node.entityId)}" data-lifecycle="${escapeHtml(node.lifecycle)}"><rect x="${at.x}" y="${at.y}" width="150" height="32" rx="8" /><text x="${at.x + 8}" y="${at.y + 20}">${escapeHtml(node.entityId.slice(0, 22))}</text></g>`; }).join("")).join("");
  return `<svg class="graph" role="img" aria-label="گراف وابستگی" viewBox="0 0 ${width} ${height}" width="100%" data-node-count="${graph.nodes.length}" data-edge-count="${graph.edges.length}">${edges}${nodes}</svg>`;
}

export function getProjectCatalogHtml({ project, viewerRole, entities = [], graph = { nodes: [], edges: [] }, documents = { nodes: [], edges: [] }, impacts = {}, drift = [], projections = [] }) {
  const projectId = project.projectId;
  const impactMarkup = entity => { const impact = impacts[entity.entityId]; if (!impact || !impact.affectedCount) return `<span class="muted">هیچ موجودیتی به این مورد وابسته نیست.</span>`; return `<ul class="impact" data-impact-for="${escapeHtml(entity.entityId)}">${impact.affected.map(item => `<li data-affected="${escapeHtml(item.entityId)}"><code>${escapeHtml(item.entityId)}</code> <span class="pill">${escapeHtml(item.lifecycle)}</span> <span class="muted">مسیر: ${escapeHtml(item.path.join(" ← "))}</span></li>`).join("")}</ul>`; };
  const entityRows = entities.length ? entities.map(entity => `<article class="row" data-entity-id="${escapeHtml(entity.entityId)}" data-entity-type="${escapeHtml(entity.type)}"><div class="head"><strong>${escapeHtml(entity.name)}</strong><span class="pill">${escapeHtml(TYPE_LABELS[entity.type] ?? entity.type)} · ${escapeHtml(entity.lifecycle)}</span></div><div class="meta"><code>${escapeHtml(entity.entityId)}</code> · نسخهٔ ${escapeHtml(entity.version)}${entity.metadata?.references?.owner ? ` · مالک: ${escapeHtml(entity.metadata.references.owner)}` : ""}${entity.metadata?.references?.team ? ` · تیم: ${escapeHtml(entity.metadata.references.team)}` : ""}${entity.metadata?.references?.health ? ` · سلامت: <span class="pill ${HEALTH_CLASS[entity.metadata.references.health] ?? ""}">${escapeHtml(entity.metadata.references.health)}</span>` : ""}</div><details><summary>اثر تغییر این مورد (${escapeHtml(impacts[entity.entityId]?.affectedCount ?? 0)} وابسته)</summary>${impactMarkup(entity)}</details></article>`).join("") : `<div class="empty">هنوز موجودیتی در کاتالوگ این پروژه ثبت نشده است.</div>`;
  const docRows = documents.nodes.length ? documents.nodes.map(node => `<article class="row" data-document-id="${escapeHtml(node.knowledgeId)}" data-current="${escapeHtml(node.current)}"><div class="head"><strong>${escapeHtml(node.title)}</strong><span class="pill ${node.current ? "good" : ""}">${escapeHtml(node.kind)}${node.current ? "" : " · جایگزین‌شده"}</span></div>${node.redacted ? `<div class="meta">متن این سند محرمانه است.</div>` : `<div class="meta"><code>${escapeHtml(node.sourceRef)}</code></div>`}</article>`).join("") : `<div class="empty">سندی ثبت نشده است.</div>`;
  const driftRows = drift.length ? drift.map(item => `<article class="row" data-drift-id="${escapeHtml(item.driftProposalId)}"><div class="head"><strong><code>${escapeHtml(item.entityId)}</code></strong><span class="pill warn">${escapeHtml(item.state)}</span></div><div class="meta">فیلدها: ${escapeHtml(item.changes.map(change => change.path).join("، "))} · بازنویسی خودکار: ممنوع</div></article>`).join("") : `<div class="empty">اختلاف بازی وجود ندارد.</div>`;
  const projectionRows = projections.length ? projections.map(item => `<article class="row" data-projection-id="${escapeHtml(item.projectionProposalId)}"><div class="head"><strong><code>${escapeHtml(item.entityId)}</code></strong><span class="pill ${item.state === "conflict" ? "bad" : "warn"}">${escapeHtml(item.state)}</span></div><div class="meta">پیشنهاد از نوتیشن؛ Git مرجع اصلی می‌ماند.</div></article>`).join("") : `<div class="empty">پیشنهادی از نوتیشن نیست.</div>`;
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hero · کاتالوگ سیستم</title>
    <style>
      :root { --ink:#162238; --muted:#607089; --line:#dbe3ef; --surface:#fff; --canvas:#f4f7fb; --primary:#285ea8; --teal:#066356; --amber:#855000; --rose:#b03d5d; }
      * { box-sizing:border-box; } body { margin:0; color:var(--ink); background:var(--canvas); font-family:Vazirmatn,sans-serif; line-height:1.7; }
      main { width:min(1280px,calc(100% - 30px)); margin:0 auto; padding:28px 0 50px; }
      .top,.section { border:1px solid var(--line); border-radius:16px; background:var(--surface); box-shadow:0 10px 26px rgba(24,53,93,.05); } .top { padding:18px 20px; margin-bottom:16px; }
      .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; } .section { padding:16px; min-width:0; } .section.full { grid-column:1 / -1; }
      h1 { margin:0 0 4px; font-size:clamp(1.3rem,3vw,1.9rem); } h2 { margin:0 0 10px; font-size:1.02rem; } .muted,.meta { color:var(--muted); font-size:.8rem; } .meta { overflow-wrap:anywhere; }
      .list { display:grid; gap:8px; } .row { padding:10px 12px; border:1px solid #e6ebf3; border-radius:10px; background:#fbfcfe; } .head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
      .pill { padding:2px 8px; border-radius:999px; background:#edf2f8; color:#52647d; font-size:.72rem; font-weight:700; white-space:nowrap; } .pill.good { background:var(--teal-soft); color:var(--teal); } .pill.warn { background:var(--amber-soft); color:var(--amber); } .pill.bad { background:var(--rose-soft); color:var(--rose); }
      .empty { padding:12px; border:1px dashed #cad4e2; border-radius:10px; color:var(--muted); text-align:center; font-size:.82rem; } code { direction:ltr; unicode-bidi:embed; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.74rem; }
      svg.graph { max-height:520px; background:#fbfcfe; border:1px solid #e6ebf3; border-radius:12px; direction:ltr; } svg.graph line { stroke:#8aa0c0; stroke-width:1.4; } svg.graph rect { fill:#edf5ff; stroke:#9db8e0; } svg.graph text { font-size:11px; fill:#162238; } svg.graph text.col { font-weight:700; fill:#607089; }
      .impact { margin:.4rem 0 0; padding-inline-start:1.1rem; display:grid; gap:4px; } details summary { cursor:pointer; color:var(--primary); font-size:.82rem; }
      nav.crumbs { font-size:.8rem; color:var(--muted); margin-bottom:6px; } nav.crumbs a { color:var(--primary); }
      @media(max-width:760px){ .grid { grid-template-columns:1fr; } .section.full { grid-column:auto; } }
      ${getHeroShellStyles()}
    </style>
  </head>
  <body>
    ${getHeroGlobalNavigation({ active: "workspace", projectId, environment: "Private · Catalog" })}
    <main id="hero-main" tabindex="-1" data-project-id="${escapeHtml(projectId)}" data-viewer-role="${escapeHtml(viewerRole)}">
      <header class="top hero-page-header"><nav class="crumbs" aria-label="مسیر"><a href="/api/portal?surface=portfolio&amp;select=project">پروژه‌ها</a> / <a href="/api/portal?surface=studio&amp;projectId=${encodeURIComponent(projectId)}">${escapeHtml(project.name)}</a> / کاتالوگ سیستم</nav><h1>کاتالوگ سیستم ${escapeHtml(project.name)}</h1><p class="muted">اجزای پروژه، وابستگی‌ها و اثر هر تغییر. فقط داده‌های همین پروژه نمایش داده می‌شود. مرجع اصلی Git است و نوتیشن فقط نمایش و پیشنهاد است.</p></header>
      <div class="grid">
        <section class="section full" id="graph"><h2>گراف وابستگی</h2>${graph.nodes.length ? dependencyGraphSvg(graph) : `<div class="empty">گرافی برای نمایش نیست.</div>`}</section>
        <section class="section" id="entities"><h2>اجزا و اثر تغییر</h2><div class="list">${entityRows}</div></section>
        <section class="section" id="documents"><h2>اسناد و تصمیم‌ها</h2><div class="list">${docRows}</div></section>
        <section class="section" id="drift"><h2>اختلاف با واقعیت (Drift)</h2><div class="list">${driftRows}</div></section>
        <section class="section" id="projections"><h2>پیشنهادهای نوتیشن</h2><div class="list">${projectionRows}</div></section>
      </div>
    </main>
    ${getHeroShellScript()}
  </body>
</html>`;
}
