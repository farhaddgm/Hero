import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

const CONVERSATION_REFERENCE = /^hero:\/\/projects\/([^/]+)\/conversations\/([A-Za-z0-9._:-]+)(?:\/messages\/([A-Za-z0-9._:-]+))?$/;

/** BO-074: a citation to this project's own conversation links to it on the page;
 * any other internal source is shown as a labelled hero:// reference, never fetched. */
export function citationMarkup(citation, projectId) {
  const reference = String(citation?.reference ?? "");
  const label = `${citation?.kind ?? "evidence"} · v${citation?.version ?? "1.0.0"}`;
  const match = reference.match(CONVERSATION_REFERENCE);
  if (match && match[1] === projectId) {
    const anchor = match[3] ? `message-${match[3]}` : `conversation-${match[2]}`;
    return `<a class="citation" data-citation-reference="${escapeHtml(reference)}" href="#${escapeHtml(anchor)}">${escapeHtml(label)}</a>`;
  }
  return `<span class="citation" data-citation-reference="${escapeHtml(reference)}" title="${escapeHtml(reference)}">${escapeHtml(label)} · <code>${escapeHtml(reference)}</code></span>`;
}

const ROLE_LABELS = Object.freeze({ "project-owner": "مالک", admin: "ادمین", viewer: "مشاهده‌گر" });

export function getProjectCollaborationHtml({ project, viewerRole, teams = [], profiles = [], conversations = [], memory = [], flaggedMemoryCount = 0 }) {
  const projectId = project.projectId;
  const assigned = teams.filter(team => team.assignment?.status === "active");
  const teamMarkup = assigned.length
    ? assigned.map(team => `<article class="row" data-team-id="${escapeHtml(team.teamId)}"><div class="head"><strong>${escapeHtml(team.name)}</strong><span class="pill">نسخهٔ ${escapeHtml(team.assignment.version)}</span></div><div class="meta">نقش‌ها: ${team.assignment.roleIds.map(role => `<code data-role-id="${escapeHtml(role)}">${escapeHtml(role)}</code>`).join(" ") || "—"}</div>${team.assignment.principles?.length ? `<div class="meta">اصول: ${escapeHtml(team.assignment.principles.join("، "))}</div>` : ""}${team.assignment.kpis?.length ? `<div class="meta">KPI: ${escapeHtml(team.assignment.kpis.join("، "))}</div>` : ""}</article>`).join("")
    : `<div class="empty">هنوز تیمی به این پروژه اختصاص داده نشده است.</div>`;
  const profileMarkup = profiles.length
    ? profiles.map(profile => `<article class="row" data-profile-target="${escapeHtml(profile.targetId)}"><div class="head"><strong>${escapeHtml(profile.kind === "role" ? "نقش" : "متخصص")}: <code>${escapeHtml(profile.targetId)}</code></strong><span class="pill">نسخهٔ ${escapeHtml(profile.version)}</span></div><div class="meta">${escapeHtml(Object.entries(profile.profile ?? {}).map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`).join(" · ").slice(0, 400))}</div><div class="meta">تاریخچه: ${escapeHtml(profile.history?.length ?? 1)} نسخه</div></article>`).join("")
    : `<div class="empty">پروفایل نقش یا متخصصی ثبت نشده است.</div>`;
  const conversationMarkup = conversations.length
    ? conversations.map(conversation => `<article class="row conversation" id="conversation-${escapeHtml(conversation.conversationId)}" data-conversation-id="${escapeHtml(conversation.conversationId)}"><div class="head"><strong>${escapeHtml(conversation.title ?? conversation.contextType)}</strong><span class="pill">${escapeHtml(conversation.status)}</span></div><div class="meta">زمینه: ${escapeHtml(conversation.contextType)}${conversation.binding?.teamId ? ` · تیم ${escapeHtml(conversation.binding.teamId)}` : ""}${conversation.binding?.roleId ? ` · نقش ${escapeHtml(conversation.binding.roleId)}` : ""}${conversation.binding?.entityId ? ` · دارایی ${escapeHtml(conversation.binding.entityId)}` : ""} · مدل: <code>${escapeHtml(`${conversation.effectiveModel?.model ?? "پیش‌فرض"} (${conversation.effectiveModel?.source ?? "default"})`)}</code>${conversation.expiredMessageCount ? ` · ${escapeHtml(conversation.expiredMessageCount)} پیام منقضی‌شده پنهان است` : ""}</div><ol class="messages">${conversation.messages.slice(-10).map(message => `<li id="message-${escapeHtml(message.messageId)}" data-message-id="${escapeHtml(message.messageId)}"><p>${escapeHtml(message.content)}</p>${message.citations?.length ? `<div class="citations" aria-label="منابع">${message.citations.map(citation => citationMarkup(citation, projectId)).join("")}</div>` : ""}<small class="meta">${escapeHtml(message.actor)} · ${escapeHtml(message.createdAt)}</small></li>`).join("") || `<li class="muted">پیامی ثبت نشده است.</li>`}</ol></article>`).join("")
    : `<div class="empty">گفتگویی برای این پروژه وجود ندارد.</div>`;
  const memoryMarkup = memory.length
    ? memory.map(item => `<article class="row" data-memory-id="${escapeHtml(item.memoryId)}" data-memory-sensitivity="${escapeHtml(item.sensitivity)}"><div class="head"><strong>${escapeHtml(item.key)}</strong><span class="pill">${escapeHtml(item.level)}${item.scopeId ? ` · ${escapeHtml(item.scopeId)}` : ""}</span></div><p>${escapeHtml(item.content)}</p><div class="citations" aria-label="منبع">${citationMarkup(item.provenance, projectId)}</div><div class="meta">اطمینان: ${escapeHtml(item.confidence)} · حساسیت: ${escapeHtml(item.sensitivity)}${item.expiresAt ? ` · انقضا: ${escapeHtml(item.expiresAt)}` : ""} · فقط داده، نه دستور</div></article>`).join("")
    : `<div class="empty">حافظهٔ فعالی برای این پروژه وجود ندارد.</div>`;
  const flaggedNotice = flaggedMemoryCount > 0 ? `<p class="notice warn" data-flagged-memory="${escapeHtml(flaggedMemoryCount)}">${escapeHtml(flaggedMemoryCount)} حافظه به‌دلیل متن دستورمانند از Context هوش مصنوعی کنار گذاشته شده و منتظر بازبینی است.</p>` : "";
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hero · همکاری و حافظه</title>
    <style>
      :root { --ink:#162238; --muted:#607089; --line:#dbe3ef; --surface:#fff; --canvas:#f4f7fb; --primary:#285ea8; --amber:#a36208; }
      * { box-sizing:border-box; } body { margin:0; color:var(--ink); background:var(--canvas); font-family:Vazirmatn,sans-serif; line-height:1.7; }
      main { width:min(1280px,calc(100% - 30px)); margin:0 auto; padding:28px 0 50px; }
      .top,.section { border:1px solid var(--line); border-radius:16px; background:var(--surface); box-shadow:0 10px 26px rgba(24,53,93,.05); }
      .top { padding:18px 20px; margin-bottom:16px; } .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; } .section { padding:16px; min-width:0; } .section.full { grid-column:1 / -1; }
      h1 { margin:0 0 4px; font-size:clamp(1.3rem,3vw,1.9rem); } h2 { margin:0 0 10px; font-size:1.02rem; } .muted,.meta { color:var(--muted); font-size:.8rem; } .meta { overflow-wrap:anywhere; }
      .list { display:grid; gap:8px; } .row { padding:10px 12px; border:1px solid #e6ebf3; border-radius:10px; background:#fbfcfe; } .row p { margin:.3rem 0; white-space:pre-wrap; overflow-wrap:anywhere; }
      .head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; } .pill { padding:2px 8px; border-radius:999px; background:#edf2f8; color:#52647d; font-size:.72rem; font-weight:700; white-space:nowrap; }
      .messages { margin:.5rem 0 0; padding-inline-start:1.1rem; display:grid; gap:6px; } .citations { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
      .citation { display:inline-flex; gap:4px; align-items:center; padding:2px 8px; border:1px solid #c9d9ef; border-radius:8px; background:#edf5ff; color:var(--primary); font-size:.74rem; text-decoration:none; overflow-wrap:anywhere; }
      .empty { padding:12px; border:1px dashed #cad4e2; border-radius:10px; color:var(--muted); text-align:center; font-size:.82rem; } .notice { padding:10px 12px; border-radius:10px; background:#edf5ff; color:#395d8d; font-size:.82rem; } .notice.warn { background:#fff3dc; color:var(--amber); }
      code { direction:ltr; unicode-bidi:embed; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.74rem; }
      nav.crumbs { font-size:.8rem; color:var(--muted); margin-bottom:6px; } nav.crumbs a { color:var(--primary); }
      @media(max-width:760px){ .grid { grid-template-columns:1fr; } .section.full { grid-column:auto; } }
      ${getHeroShellStyles()}
    </style>
  </head>
  <body>
    ${getHeroGlobalNavigation({ active: "workspace", projectId, environment: "Private · Collaboration" })}
    <main id="hero-main" tabindex="-1" data-project-id="${escapeHtml(projectId)}" data-viewer-role="${escapeHtml(viewerRole)}">
      <header class="top hero-page-header"><nav class="crumbs" aria-label="مسیر"><a href="/api/portal?surface=portfolio&amp;select=project">پروژه‌ها</a> / <a href="/api/portal?surface=studio&amp;projectId=${encodeURIComponent(projectId)}">${escapeHtml(project.name)}</a> / همکاری و حافظه</nav><h1>همکاری و حافظهٔ ${escapeHtml(project.name)}</h1><p class="muted">تیم، نقش، گفتگو و حافظهٔ همین پروژه با منبع داخلی هر مورد. نقش شما: ${escapeHtml(ROLE_LABELS[viewerRole] ?? viewerRole)}. هیچ دادهٔ پروژهٔ دیگری اینجا نمایش داده نمی‌شود.</p></header>
      ${flaggedNotice}
      <div class="grid">
        <section class="section" id="teams"><h2>تیم‌ها</h2><div class="list">${teamMarkup}</div></section>
        <section class="section" id="roles"><h2>نقش‌ها و متخصص‌ها</h2><div class="list">${profileMarkup}</div></section>
        <section class="section full" id="conversations"><h2>گفتگوها</h2><div class="list">${conversationMarkup}</div></section>
        <section class="section full" id="memory"><h2>حافظهٔ پروژه</h2><div class="list">${memoryMarkup}</div></section>
      </div>
    </main>
    ${getHeroShellScript()}
  </body>
</html>`;
}
