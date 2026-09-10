function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

/** Desktop-first operational shell. It deliberately renders only API-backed
 * data and deep-links; mutations stay in project-scoped command endpoints. */
export function getPortfolioHtml({ portfolio }) {
  const cards = portfolio?.cards ?? [];
  const rows = cards.map(card => `<article class="card"><h2><a href="/portfolio?projectId=${encodeURIComponent(card.projectId)}">${escape(card.name)}</a></h2><p>${escape(card.projectId)} · ${escape(card.lifecycle)}</p><dl><dt>Health</dt><dd>${escape(card.health)}</dd><dt>Token</dt><dd>${escape(card.tokenUsage ?? "not recorded")}</dd><dt>Roadmap</dt><dd>${escape((card.roadmap ?? []).map(item => item.title ?? item.id ?? item.taskId).join(", ") || "not recorded")}</dd></dl><a href="${escape(card.drillDown.href)}">Open Project Studio</a></article>`).join("") || "<p class=\"empty\">No accessible project exists yet.</p>";
  return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Hero Portfolio</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#101820;color:#eaf2f8}header{padding:28px 5vw;border-bottom:1px solid #29404c}main{padding:32px 5vw}.crumb{color:#9db6c3}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.card{border:1px solid #35515f;border-radius:12px;padding:18px;background:#17252e}.card h2{margin-top:0}a{color:#87d7ff}dt{color:#9db6c3}dd{margin:0 0 10px}.empty{color:#9db6c3}</style></head><body><header><p class="crumb">Hero / Portfolio</p><h1>Portfolio Command Center</h1><p>Projects are isolated by project grant. Every KPI links to a project-scoped evidence view.</p></header><main><nav aria-label="Primary">Portfolio · Project Studio · Overview · Roadmap · Inputs · Settings · Outputs</nav><section class="grid">${rows}</section></main></body></html>`;
}
