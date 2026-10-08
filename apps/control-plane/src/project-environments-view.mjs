import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "./hero-shell.mjs";
import { INFRASTRUCTURE_THREAT_MODEL } from "../../../packages/contracts/src/infrastructure-control.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
const LIVE_CLASS = Object.freeze({ online: "good", "awaiting-heartbeat": "warn", offline: "bad", revoked: "bad" });
const RESULT_CLASS = Object.freeze({ passed: "good", failed: "bad" });
const cell = value => `<td>${escapeHtml(value ?? "—")}</td>`;
const table = (headers, rows, empty) => rows.length
  ? `<div style="overflow:auto" tabindex="0"><table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`
  : `<p class="empty">${escapeHtml(empty)}</p>`;

/**
 * Environments, servers, secrets and delivery (BO-133): metadata only. No secret value, token or
 * Production data is ever on this page; a reveal is a recorded request, not a display.
 */
export function getProjectEnvironmentsHtml({ project, viewerRole, canAct, isOwner, infrastructure, delivery }) {
  const projectId = project.projectId; const base = `/api/projects/${encodeURIComponent(projectId)}`;
  const servers = table(["شناسه", "محیط", "نشانی", "وضعیت"], infrastructure.servers.map(item => `<tr data-server="${escapeHtml(item.serverId)}">${cell(item.serverId)}${cell(item.environment)}${cell(item.address)}${cell(item.state)}</tr>`), "هنوز سروری ثبت نشده است.");
  const nodes = table(["Node", "سرور", "وضعیت زنده", "آخرین heartbeat", "قابلیت‌ها"], infrastructure.nodes.map(item => `<tr data-node="${escapeHtml(item.nodeId)}">${cell(item.nodeId)}${cell(item.serverId)}<td><span class="pill ${LIVE_CLASS[item.liveState] ?? ""}">${escapeHtml(item.liveState)}</span></td>${cell(item.lastHeartbeatAt)}${cell(item.capabilities.join(", "))}</tr>`), "هنوز Node Agent ثبت نشده است. هر Node خودش به Hero وصل می‌شود؛ Hero به سرور وصل نمی‌شود.");
  const runners = table(["محیط", "حداکثر همزمانی", "Nodeها", "جداسازی"], infrastructure.runnerPolicies.map(item => `<tr>${cell(item.environment)}${cell(item.maxConcurrent)}${cell(item.nodeIds.join(", "))}${cell(item.isolation)}</tr>`), "سیاست Runner تعریف نشده است.");
  const secrets = table(["شناسه", "ارجاع", "وضعیت", "نسخه"], infrastructure.secrets.map(item => `<tr data-secret="${escapeHtml(item.secretId)}">${cell(item.secretId)}${cell(item.reference)}${cell(item.state)}${cell(item.version)}</tr>`), "ارجاعی ثبت نشده است. فقط ارجاع نگه داشته می‌شود، نه مقدار.");
  const egress = infrastructure.egress
    ? `<p class="meta">پیش‌فرض: ${escapeHtml(infrastructure.egress.default)} · ابزارها: ${escapeHtml(infrastructure.egress.tools.join(", ") || "—")} · دامنه‌ها: ${escapeHtml(infrastructure.egress.domains.join(", ") || "—")}</p>`
    : `<p class="empty">سیاستی نیست؛ همهٔ خروجی‌ها رد می‌شود (default deny).</p>`;
  const releases = table(["نسخه", "commit", "وضعیت", "Artifact"], delivery.releases.map(item => `<tr data-release="${escapeHtml(item.releaseId)}">${cell(item.releaseId)}${cell(item.testedCommit)}<td><span class="pill">${escapeHtml(item.state)}</span></td>${cell(item.artifactId)}</tr>`), "نسخه‌ای ثبت نشده است. استقرار فقط ثبت می‌شود، اجرا نمی‌شود.");
  const artifacts = table(["Artifact", "digest", "provenance"], delivery.artifacts.map(item => `<tr>${cell(item.artifactId)}${cell(item.digest)}${cell(item.provenance)}</tr>`), "Artifactی ثبت نشده است.");
  const bundles = table(["Bundle", "digest مانیفست", "وضعیت"], delivery.bundles.map(item => `<tr data-bundle="${escapeHtml(item.bundleId)}">${cell(item.bundleId)}${cell(item.manifestDigest)}${cell(item.state)}</tr>`), "Bundle تحویلی ساخته نشده است.");
  const evidence = table(["نوع", "Bundle", "نتیجه"], [
    ...delivery.portability.map(item => `<tr>${cell("portability")}${cell(item.bundleId)}<td><span class="pill ${RESULT_CLASS[item.result] ?? ""}">${escapeHtml(item.result)}</span></td></tr>`),
    ...delivery.rehearsals.map(item => `<tr>${cell(item.kind)}${cell(item.bundleId)}<td><span class="pill ${RESULT_CLASS[item.result] ?? ""}">${escapeHtml(item.result)}</span></td></tr>`)
  ], "شواهد قابلیت‌حمل و بازیابی ثبت نشده است.");
  const breakGlass = table(["درخواست", "محدوده", "وضعیت", "تا"], delivery.breakGlass.map(item => `<tr data-break-glass="${escapeHtml(item.requestId)}">${cell(item.requestId)}${cell(item.scope)}<td><span class="pill">${escapeHtml(item.liveState)}</span></td>${cell(item.grantedUntil ?? item.expiresAt)}</tr>`), "درخواست دسترسی اضطراری نیست. Hero هرگز داده Production را نمی‌خواند.");
  const telemetry = table(["نوع", "زمان", "خلاصه"], delivery.telemetry.slice(-20).reverse().map(item => `<tr>${cell(item.kind)}${cell(item.recordedAt)}${cell(Object.entries(item.metadata).map(([key, value]) => `${key}=${value}`).join(" · "))}</tr>`), "تله‌متری Production دریافت نشده است.");
  const threats = INFRASTRUCTURE_THREAT_MODEL.map(item => `<li data-threat="${escapeHtml(item.id)}"><strong>${escapeHtml(item.id)}</strong> ${escapeHtml(item.threat)} — <span class="muted">${escapeHtml(item.control)}</span></li>`).join("");
  const forms = canAct ? `
      <section class="section" id="actions"><h2>عملیات مجاز</h2>
        <p class="muted">هر عملیات فقط متادیتا ثبت می‌کند؛ اتصال، استقرار و افشای Secret انجام نمی‌شود.</p>
        <form data-action="onboard-server"><h3>ثبت سرور</h3><label>شناسه <input name="serverId" required pattern="[A-Za-z][A-Za-z0-9._:-]{2,127}"></label><label>نشانی <input name="address" required></label><label>ارجاع Secret <input name="credentialReference" required placeholder="secret-ref:name"></label><label>محیط <select name="environment"><option>development</option><option selected>test</option><option>production</option></select></label><button type="submit">ثبت</button></form>
        <form data-action="create-enrollment"><h3>ثبت‌نام یک‌بارمصرف Node (۱ ساعت)</h3><label>شناسه Node <input name="nodeId" required pattern="[A-Za-z][A-Za-z0-9._:-]{2,127}"></label><label>سرور <input name="serverId" required></label><button type="submit">ایجاد</button></form>
        <form data-action="register-secret-metadata"><h3>ارجاع Secret</h3><label>شناسه <input name="secretId" required></label><label>ارجاع <input name="reference" required placeholder="secret-ref:name"></label><button type="submit">ثبت ارجاع</button></form>
        <form data-action="set-egress-policy"><h3>سیاست خروجی</h3><label>ابزارها (با ویرگول) <input name="tools"></label><label>دامنه‌ها (با ویرگول) <input name="domains"></label><button type="submit">ذخیره</button></form>
        ${isOwner ? `<form data-action="request-secret-reveal"><h3>درخواست افشا (فقط مالک)</h3><p class="muted">نیازمند MFA تازه؛ مقدار برگردانده نمی‌شود و فقط درخواست ثبت می‌شود.</p><label>شناسه <input name="secretId" required></label><label>دلیل <input name="reason" required minlength="8"></label><button type="submit">ثبت درخواست</button></form>` : ""}
        <p id="env-status" role="status" aria-live="polite"></p>
      </section>` : `<p class="muted" id="env-status" role="status">نقش شما فقط‌خواندنی است.</p>`;
  const config = JSON.stringify({ base }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hero · محیط‌ها و تحویل</title>
    <style>
      :root { --ink:#162238; --muted:#607089; --line:#dbe3ef; --surface:#fff; --canvas:#f4f7fb; --primary:#285ea8; --teal:#066356; --amber:#855000; --rose:#b03d5d; }
      * { box-sizing:border-box; } body { margin:0; color:var(--ink); background:var(--canvas); font-family:Vazirmatn,sans-serif; line-height:1.7; }
      main { width:min(1100px,calc(100% - 30px)); margin:0 auto; padding:28px 0 50px; }
      .top,.section { border:1px solid var(--line); border-radius:16px; background:var(--surface); box-shadow:0 10px 26px rgba(24,53,93,.05); } .top { padding:18px 20px; margin-bottom:16px; } .section { padding:16px; margin-top:14px; }
      h1 { margin:0 0 4px; font-size:clamp(1.3rem,3vw,1.9rem); } h2 { margin:0 0 10px; font-size:1.02rem; } h3 { margin:12px 0 6px; font-size:.9rem; } .muted,.meta { color:var(--muted); font-size:.8rem; } .meta { overflow-wrap:anywhere; }
      table { width:100%; border-collapse:collapse; font-size:.82rem; } th,td { padding:6px 8px; text-align:start; border-bottom:1px solid #eef2f8; overflow-wrap:anywhere; } th { color:var(--muted); }
      .pill { padding:2px 8px; border-radius:999px; background:var(--primary-soft); color:var(--muted); font-size:.72rem; font-weight:700; white-space:nowrap; } .pill.good { background:var(--teal-soft); color:var(--teal); } .pill.warn { background:var(--amber-soft); color:var(--amber); } .pill.bad { background:var(--rose-soft); color:var(--rose); }
      .empty { padding:12px; border:1px dashed #cad4e2; border-radius:10px; color:var(--muted); text-align:center; font-size:.82rem; }
      form { display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end; padding:8px 0; border-top:1px solid #eef2f8; } form h3 { flex-basis:100%; margin:0; } label { display:grid; gap:2px; font-size:.78rem; color:var(--muted); } input,select { padding:6px 8px; border:1px solid var(--line); border-radius:8px; font:inherit; background:var(--surface); color:var(--ink); }
      button[type="submit"] { padding:6px 14px; border:1px solid var(--primary); border-radius:9px; background:var(--surface); color:var(--primary); cursor:pointer; font:inherit; font-size:.8rem; }
      ul.threats { margin:0; padding-inline-start:18px; font-size:.82rem; display:grid; gap:4px; } nav.crumbs { font-size:.8rem; color:var(--muted); margin-bottom:6px; } a { color:var(--primary); }
      ${getHeroShellStyles()}
    </style>
  </head>
  <body>
    ${getHeroGlobalNavigation({ active: "control", projectId, environment: "Private · Environments" })}
    <main id="hero-main" tabindex="-1" data-project-id="${escapeHtml(projectId)}" data-viewer-role="${escapeHtml(viewerRole)}">
      <header class="top hero-page-header"><nav class="crumbs" aria-label="مسیر"><a href="/api/portal?surface=portfolio&amp;select=project">پروژه‌ها</a> / <a href="/api/portal?surface=control&amp;projectId=${encodeURIComponent(projectId)}">${escapeHtml(project.name)}</a></nav><h1>محیط‌ها، سرورها و تحویل</h1><p class="muted">فقط سه محیط وجود دارد: development، test و production. Hero فقط ثبت و بررسی می‌کند؛ به سرور وصل نمی‌شود، چیزی را مستقر نمی‌کند و مقدار Secret یا داده Production را نمی‌خواند. GitHub: ${escapeHtml(infrastructure.githubMetadata)}.</p></header>
      <section class="section" id="servers"><h2>سرورها</h2>${servers}</section>
      <section class="section" id="nodes"><h2>Node Agentها</h2>${nodes}</section>
      <section class="section" id="runners"><h2>Runnerها</h2>${runners}</section>
      <section class="section" id="secrets"><h2>ارجاع Secretها</h2>${secrets}</section>
      <section class="section" id="egress"><h2>سیاست خروجی</h2>${egress}</section>
      ${forms}
      <section class="section" id="releases"><h2>نسخه‌ها</h2>${releases}</section>
      <section class="section" id="artifacts"><h2>Artifactها</h2>${artifacts}</section>
      <section class="section" id="bundles"><h2>Bundleهای تحویل</h2>${bundles}</section>
      <section class="section" id="evidence"><h2>قابلیت‌حمل و بازیابی</h2>${evidence}</section>
      <section class="section" id="break-glass"><h2>دسترسی اضطراری</h2>${breakGlass}</section>
      <section class="section" id="telemetry"><h2>تله‌متری Production</h2>${telemetry}</section>
      <section class="section" id="threats"><h2>مدل تهدید</h2><ul class="threats">${threats}</ul></section>
    </main>
    <script>
      const CONFIG = ${config};
      const status = document.querySelector('#env-status');
      document.querySelectorAll('form[data-action]').forEach(form => form.addEventListener('submit', async event => {
        event.preventDefault(); const action = form.dataset.action; const data = Object.fromEntries(new FormData(form).entries());
        if (action === 'set-egress-policy') { data.tools = String(data.tools || '').split(',').map(item => item.trim()).filter(Boolean); data.domains = String(data.domains || '').split(',').map(item => item.trim()).filter(Boolean); }
        if (action === 'create-enrollment') data.expiresAt = new Date(Date.now() + 3600000).toISOString();
        status.textContent = '...';
        try {
          const response = await fetch(CONFIG.base + '/infrastructure', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...data }) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) { status.textContent = (payload.message || 'ناموفق') + (payload.code ? ' (' + payload.code + ')' : ''); return; }
          status.textContent = payload.result && payload.result.enrollmentNonce ? 'Nonce یک‌بار نمایش داده می‌شود: ' + payload.result.enrollmentNonce : 'ثبت شد.';
          if (!(payload.result && payload.result.enrollmentNonce)) setTimeout(() => location.reload(), 600);
        } catch { status.textContent = 'اتصال برقرار نشد.'; }
      }));
    </script>
    ${getHeroShellScript()}
  </body>
</html>`;
}
