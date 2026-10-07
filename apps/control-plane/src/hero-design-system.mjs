/** Shared presentation layer, placed after each surface's specialist styles. */
export function getHeroDesignSystemStyles() {
  return `
    :root {
      color-scheme: light;
      --hero-ink: #192b29; --hero-muted: #586e68;
      --hero-canvas: #f5f7f6; --hero-surface: #ffffff; --hero-surface-raised: #f9fbfa;
      --hero-line: #dce5e1; --hero-line-strong: #b9ccc4;
      --hero-brand: #076f5b; --hero-brand-hover: #055745; --hero-brand-soft: #e9f5ef;
      --hero-success: #147652; --hero-success-soft: #e9f6ee;
      --hero-warning: #8b570d; --hero-warning-soft: #fff5df;
      --hero-danger: #b02e44; --hero-danger-soft: #fff0f2;
      --hero-control-height: 44px; --hero-control-radius: 10px; --hero-surface-radius: 14px;
      --hero-shadow-sm: 0 1px 3px #173c2d06; --hero-shadow-lg: 0 20px 70px #102d2726;
      --hero-sidebar-width: 232px;
    }
    :root[data-hero-theme="dark"] {
      color-scheme: dark;
      --hero-ink: #e5efe9; --hero-muted: #a1b7ac;
      --hero-canvas: #101b18; --hero-surface: #172621; --hero-surface-raised: #1d3029;
      --hero-line: #30483e; --hero-line-strong: #527060;
      --hero-brand: #69d7ad; --hero-brand-hover: #95e9c7; --hero-brand-soft: #203f32;
      --hero-success: #75d6a5; --hero-success-soft: #203b2e;
      --hero-warning: #efc278; --hero-warning-soft: #3b3020;
      --hero-danger: #f49aaa; --hero-danger-soft: #40262d;
    }
    :root, :root[data-hero-theme="dark"] {
      --ink: var(--hero-ink); --muted: var(--hero-muted); --line: var(--hero-line);
      --surface: var(--hero-surface); --canvas: var(--hero-canvas);
      --primary: var(--hero-brand); --primary-soft: var(--hero-brand-soft);
      --teal: var(--hero-success); --teal-soft: var(--hero-success-soft);
      --amber: var(--hero-warning); --amber-soft: var(--hero-warning-soft);
      --rose: var(--hero-danger); --rose-soft: var(--hero-danger-soft);
      background: var(--hero-canvas); color: var(--hero-ink);
    }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    html { scroll-padding-top: 90px; }
    body { margin: 0; min-width: 320px; background: var(--hero-canvas); color: var(--hero-ink); line-height: 1.8; }
    ::selection { background: var(--hero-brand-soft); color: var(--hero-brand); }
    :is(button, input, select, textarea, a, summary):focus-visible { outline: 3px solid var(--hero-brand); outline-offset: 3px; }
    :is(button, .button, input, select, textarea) { font-family: Vazirmatn, sans-serif; }
    :is(button, .button) { touch-action: manipulation; }
    button:disabled { cursor: not-allowed; }
    :is(code, .code) { unicode-bidi: isolate; overflow-wrap: anywhere; }
    .hero-appbar { position: sticky; top: 0; min-height: 76px; background: var(--hero-surface); border-color: var(--hero-line); backdrop-filter: none; }
    .hero-appbar-inner { width: 100%; min-height: 76px; padding: 0 28px; grid-template-columns: auto minmax(0,1fr); gap: 24px; }
    .hero-app-brand { gap: 11px; }
    .hero-app-mark { width: 38px; height: 38px; border-radius: 12px; background: #087f68; color: #fff; box-shadow: none; font-size: 20px; }
    .hero-app-brand-copy strong { font: 800 21px/1.2 Vazirmatn, sans-serif; letter-spacing: -.03em; }
    .hero-app-brand-copy small { margin-top: 3px; font-size: 10px; font-weight: 500; letter-spacing: 0; text-transform: none; }
    .hero-app-actions { display: flex; gap: 10px; min-width: 0; }
    .hero-shell-button { min-height: 42px; padding: 9px 12px; color: var(--hero-ink); background: var(--hero-surface); font-size: 12px; font-weight: 600; }
    .hero-shell-button kbd { margin-inline-start: 18px; font-size: 10px; color: var(--hero-muted); }
    .hero-shell-button:hover { border-color: var(--hero-brand); color: var(--hero-brand); box-shadow: none; }
    .hero-shell-button[data-hero-theme-button] { width: 42px; padding: 9px; }
    .hero-shell-button[data-hero-theme-button] > span { display: none; }
    .hero-menu-button, .hero-nav-close { display: none; }
    .hero-project-context { max-width: 220px; min-height: 42px; box-shadow: none; padding: 6px 10px; }
    .hero-project-context b { font-size: 12px; }.hero-project-context small { font-size: 10px; }
    .hero-environment { min-height: 30px; font-size: 11px; padding: 4px 10px; border-style: dashed; }
    .hero-environment::before { background: var(--hero-muted); box-shadow: none; }
    .hero-environment[data-environment="test"] { background: var(--hero-warning-soft); color: var(--hero-warning); border-color: var(--hero-warning); }
    .hero-environment[data-environment="production"] { background: var(--hero-brand-soft); color: var(--hero-brand); border-color: var(--hero-brand); }
    .hero-environment[data-environment="test"]::before, .hero-environment[data-environment="production"]::before { background: currentColor; }
    .hero-tools { position: relative; }
    .hero-tools > summary { list-style: none; cursor: pointer; }.hero-tools > summary::-webkit-details-marker { display: none; }
    .hero-tools-menu { position: absolute; top: calc(100% + 10px); inset-inline-end: 0; z-index: 950; display: grid; gap: 8px; width: 240px; padding: 14px; background: var(--hero-surface); border: 1px solid var(--hero-line); border-radius: 12px; box-shadow: var(--hero-shadow-lg); }
    .hero-tools-menu > small { color: var(--hero-muted); font-size: 11px; }.hero-tools-menu .hero-shell-button { justify-content: start; }.hero-tools-menu [aria-pressed="true"] { color: var(--hero-brand); background: var(--hero-brand-soft); }
    .hero-side-nav { position: fixed; top: 76px; bottom: 0; inset-inline-start: 0; inset-inline-end: auto; width: var(--hero-sidebar-width); grid-template-rows: auto minmax(0,1fr) auto; border: 0; border-inline-end: 1px solid #29443a; border-radius: 0; background: #16352c; color: #e7f1eb; box-shadow: none; backdrop-filter: none; }
    .hero-side-nav-head { justify-content: space-between; min-height: 70px; padding: 24px 24px 16px; border: 0; color: #adc6b8; font-size: 11px; letter-spacing: 0; font-weight: 500; }.hero-side-nav-head > span { display: none; }
    .hero-global-nav { gap: 5px; padding: 0 14px 20px; }
    .hero-nav-group { margin: 20px 10px 6px; color: #adc6b8; font-size: 10px; font-weight: 500; }.hero-nav-group:first-child { margin-top: 0; }
    .hero-global-nav a { min-height: 46px; gap: 12px; padding: 12px; border-radius: 9px; color: #c2d5c9; }
    .hero-global-nav a:hover { color: #fff; background: #254a3c; }.hero-global-nav a[aria-current="page"] { background: #d7f3df; color: #174b36; }.hero-global-nav a[aria-current="page"]::after { display: none; }
    .hero-nav-copy b { font-size: 13px; font-weight: 550; line-height: 1.5; }.hero-nav-copy small { display: none; }
    .hero-icon { width: 19px; height: 19px; flex-basis: 19px; }
    .hero-side-nav-foot { margin: 0 20px; padding: 20px 4px 24px; border-top: 1px solid #355345; font-size: 11px; color: #adc6b8; }.hero-side-nav-foot a { display: flex; gap: 10px; align-items: center; color: #e0eee5; text-decoration: none; font-size: 12px; }.hero-side-nav-foot small { display: block; margin-top: 6px; font-size: 10px; }
    .hero-side-nav ~ #hero-main { width: auto; max-width: 1600px; min-width: 0; margin-inline-start: calc(var(--hero-sidebar-width) + 36px) !important; margin-inline-end: 36px !important; padding: 36px 0 70px; }
    #hero-main .hero-page-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; padding: 0 0 24px; border: 0; border-bottom: 1px solid var(--hero-line); border-radius: 0; background: transparent; box-shadow: none; }
    #hero-main .hero-page-header h1 { margin: 0 0 6px; font-size: clamp(1.5rem, 2.5vw, 2.1rem); font-weight: 800; line-height: 1.6; letter-spacing: -.035em; }
    #hero-main .hero-page-header :is(.eyebrow, .code, p.muted) { color: var(--hero-muted); font-size: 11px; font-weight: 500; letter-spacing: .04em; }
    #hero-main .hero-page-header :is(.lead, .subtitle, p.muted, .helper-copy) { font-size: 13px; letter-spacing: 0; }
    #hero-main :is(.panel, .section, .hero, .card, .content-panel, .metric, .project-card, .setting-card, .team-card, .contract-card, .context) { border-color: var(--hero-line); background: var(--hero-surface); color: var(--hero-ink); box-shadow: var(--hero-shadow-sm); }
    #hero-main :is(.panel, .section, .hero) { padding: 24px; }
    #hero-main :is(h2,h3) { color: var(--hero-ink); line-height: 1.75; } #hero-main h2 { font-size: 1rem; font-weight: 750; } #hero-main h3 { font-size: .9rem; }
    #hero-main :is(p, .muted, .meta, .lead, .subtitle) { color: var(--hero-muted); }
    #hero-main :is(.meta, .muted, .helper-copy, .section-head p, .panel-head p, label small) { font-size: 12px; line-height: 1.9; }
    #hero-main :is(.actions, .page-actions, .guide-actions) { gap: 8px; flex-wrap: wrap; }
    #hero-main :is(button, .button) { min-height: 42px; padding: 9px 14px; font: 650 12px/1.5 Vazirmatn, sans-serif; border-radius: 9px; }
    #hero-main :is(button, .button):not(.secondary, .dialog-close, .card-button, .hero-info-trigger, .hero-form-suggestion-trigger, .hero-smart-tester-trigger, .nav-item, .recall) { border-color: var(--hero-brand); background: var(--hero-brand); color: #fff; }
    #hero-main :is(button, .button).secondary { border: 1px solid var(--hero-line); background: var(--hero-surface); color: var(--hero-ink); }
    #hero-main :is(button, .button).danger { background: var(--hero-danger); border-color: var(--hero-danger); color: #fff; }
    #hero-main :is(input, select, textarea), .create-dialog :is(input, select, textarea) { min-width: 0; max-width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--hero-line-strong); border-radius: 9px; background: var(--hero-surface); color: var(--hero-ink); font-size: 13px; }
    #hero-main :is(input, select, textarea):focus { border-color: var(--hero-brand); }
    #hero-main :is(input[type="checkbox"], input[type="radio"]) { min-height: 18px; width: 18px; padding: 0; accent-color: var(--hero-brand); }
    #hero-main label, .create-dialog label { color: var(--hero-ink); font-size: 12px; font-weight: 600; }
    #hero-main :is(.form, .form-grid, .target-form) { gap: 16px; }
    #hero-main :is(.notice, .banner, .selection-notice) { padding: 14px 18px; border-color: var(--hero-line); background: var(--hero-brand-soft); color: var(--hero-ink); font-size: 12px; line-height: 1.9; }
    #hero-main :is(.pill, .tag, .health) { font-size: 11px; font-weight: 600; background: var(--hero-canvas); color: var(--hero-muted); }
    #hero-main :is(.pill, .tag, .health).good { background: var(--hero-success-soft); color: var(--hero-success); } #hero-main :is(.pill, .tag, .health).warn { background: var(--hero-warning-soft); color: var(--hero-warning); } #hero-main :is(.pill, .tag, .health).bad { background: var(--hero-danger-soft); color: var(--hero-danger); }
    #hero-main :is(.empty, .empty-state) { color: var(--hero-muted); background: var(--hero-surface); border-color: var(--hero-line-strong); font-size: 13px; }
    #hero-main .metric { min-height: 118px; padding: 20px; border-radius: 12px; }.metric::after { display: none; }
    #hero-main .metric strong { font-size: 1.8rem; font-weight: 750; color: var(--hero-ink); margin: 8px 0; font-variant-numeric: tabular-nums; } #hero-main .metric.attention strong { color: var(--hero-warning); } #hero-main .metric :is(span, small) { font-size: 11px; color: var(--hero-muted); }
    #hero-main .summary-layout { grid-template-columns: 1fr; gap: 16px; }
    #hero-main .decision-card { display: flex; align-items: center; gap: 24px; padding: 18px 22px; border: 1px solid var(--hero-line); border-radius: 12px; background: var(--hero-brand-soft); color: var(--hero-ink); box-shadow: none; }
    #hero-main .decision-card small { display: none; } #hero-main .decision-card h2 { margin: 0 0 3px; font-size: 14px; } #hero-main .decision-card p { opacity: 1; font-size: 12px; } #hero-main .decision-card a { flex-shrink: 0; margin-inline-start: auto; color: var(--hero-brand); background: transparent; font-size: 12px; }
    #hero-main .metric-grid { gap: 16px; } #hero-main .panel-head { padding: 20px 24px; flex-wrap: wrap; } #hero-main .project-grid { padding: 20px; gap: 18px; }
    #hero-main .project-card { padding: 24px; border-radius: 12px; background: var(--hero-surface); }.project-card:hover { transform: none; }
    #hero-main .project-card:hover { border-color: var(--hero-brand); box-shadow: 0 4px 18px #123c2710; }
    #hero-main .project-title-row { flex-wrap: wrap; gap: 6px; } #hero-main .project-title-row h2 { font-size: 16px; white-space: normal; overflow-wrap: anywhere; } #hero-main .project-heading p { font-size: 11px; }
    #hero-main .project-symbol { width: 44px; height: 44px; flex-basis: 44px; background: var(--hero-brand-soft); color: var(--hero-brand); border-radius: 12px; }
    #hero-main .project-facts { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin: 22px 0 18px; } #hero-main .project-facts > div { padding: 0; background: transparent; } #hero-main .project-facts span { color: var(--hero-muted); font-size: 11px; direction: rtl; } #hero-main .project-facts strong { font-size: 12px; font-weight: 650; white-space: normal; overflow-wrap: anywhere; }
    #hero-main .project-roadmap p { font-size: 12px; } #hero-main .project-roadmap > span { font-size: 11px; }
    #hero-main .project-card-actions { flex-wrap: wrap; gap: 5px; } #hero-main .project-card-actions :is(a, .card-button) { min-height: 40px; font-size: 11px; } #hero-main .project-card-actions .primary-action { background: var(--hero-brand-soft); color: var(--hero-brand); }
    #hero-main .portfolio-reset { border-color: var(--hero-line); background: var(--hero-surface); color: var(--hero-ink); }
    .hero-info-trigger { width: 24px; height: 24px; min-width: 24px; opacity: .8; } #hero-main .hero-info-trigger { min-height: 24px; padding: 0; font-size: 11px; }
    .hero-command-dialog { border-radius: 16px; }.hero-command-head { padding: 18px; }.hero-command-list a { min-height: 56px; padding: 12px; }.hero-command-copy strong { font-size: 14px; }.hero-command-copy small { font-size: 11px; }.hero-command-list a[data-hero-command-active="true"] { background: var(--hero-brand-soft); color: var(--hero-brand); }.hero-command-footer { padding: 12px 20px; border-top: 1px solid var(--hero-line); color: var(--hero-muted); font-size: 11px; }
    .hero-auth-layout { display: grid; grid-template-columns: minmax(0,1fr) minmax(320px,420px); align-items: start; gap: 40px; margin-bottom: 32px; }
    #hero-main .hero-auth-intro { padding: 32px 12px; border: 0; border-radius: 0; background: transparent; box-shadow: none; } #hero-main .hero-auth-intro h1 { max-width: 540px; font-size: clamp(1.8rem,3vw,2.8rem); line-height: 1.6; font-weight: 800; letter-spacing: -.03em; } #hero-main .hero-auth-intro > p { font-size: 14px; max-width: 55ch; }
    .hero-auth-kicker { color: var(--hero-brand); font-size: 12px; font-weight: 650; margin-bottom: 12px; }
    #hero-main .hero-auth-intro .grid { grid-template-columns: 1fr; gap: 18px; margin-top: 32px; } #hero-main .hero-auth-intro .card { border: 0; padding: 0; background: transparent; box-shadow: none; } #hero-main .hero-auth-intro .card h2 { margin: 0 0 3px; font-size: 13px; }.hero-auth-intro .card p { font-size: 12px; }
    #hero-main .hero-auth-card { margin-top: 20px; padding: 28px; border-radius: 16px; } #hero-main .hero-auth-card h2 { font-size: 20px; margin-bottom: 4px; }.hero-auth-card > p { margin: 0 0 18px; font-size: 12px; } #hero-main .hero-auth-card .form.two { grid-template-columns: 1fr; }.hero-auth-card .form .actions > button[type="submit"] { width: 100%; }
    .hero-auth-card input[type="email"], .hero-auth-card input[type="password"] { direction: ltr; text-align: left; }.hero-auth-card input[name="mfaCode"] { direction: ltr; text-align: center; font-size: 24px !important; letter-spacing: .45em; }
    #hero-main .hero-auth-card .runtime-status { padding: 12px; margin: 18px 0; background: var(--hero-canvas); border-color: var(--hero-line); font-size: 12px; } #hero-main .runtime-status[data-state="blocked"] { background: var(--hero-danger-soft); border-color: var(--hero-danger); } #hero-main .runtime-status[data-state="ready"] { background: var(--hero-success-soft); border-color: var(--hero-line); }
    .hero-auth-help { margin-top: 20px; font-size: 12px; }.hero-auth-help > summary { cursor: pointer; color: var(--hero-brand); padding: 8px 0; } #hero-main .login-steps { grid-template-columns: 1fr; gap: 10px; } #hero-main .login-steps li { min-height: 0; padding: 14px; background: var(--hero-canvas); border-color: var(--hero-line); } #hero-main .login-steps li::before { display: none; }.login-steps strong { color: var(--hero-ink); }
    .hero-auth-progress { display: flex; gap: 8px; margin: 20px 0; padding: 0; list-style: none; }.hero-auth-progress li { flex: 1; padding-bottom: 8px; border-bottom: 3px solid var(--hero-line); color: var(--hero-muted); font-size: 11px; }.hero-auth-progress li[aria-current="step"] { border-color: var(--hero-brand); color: var(--hero-brand); font-weight: 700; }.hero-auth-note { margin-top: 18px !important; font-size: 11px !important; }
    #hero-main table { color: var(--hero-ink); } #hero-main :is(th,td) { border-color: var(--hero-line); font-size: 12px; padding: 14px; } #hero-main th { color: var(--hero-muted); background: var(--hero-canvas); }
    #hero-main .row, #hero-main .target-form { background: var(--hero-surface-raised); border-color: var(--hero-line); }
    #hero-main #sections { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; }
    #hero-main #sections .section.wide { grid-column: auto; }
    .hero-section-navigation { margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .hero-section-links { display: flex; flex-wrap: wrap; gap: 6px; }
    .hero-section-links a { padding: 8px 12px; border: 1px solid var(--hero-line); border-radius: 8px; color: var(--hero-muted); background: var(--hero-surface); font-size: 12px; text-decoration: none; }
    .hero-section-links a:hover { color: var(--hero-brand); border-color: var(--hero-brand); }
    .hero-surface-note { margin: 0 0 20px; font-size: 12px; color: var(--hero-muted); }.hero-surface-note summary { cursor: pointer; }
    #hero-main :is(button, .button):hover:not(:disabled) { filter: brightness(.96); }
    :root[data-hero-theme="dark"] #hero-main :is(button, .button):not(.secondary, .dialog-close, .card-button, .hero-info-trigger, .hero-form-suggestion-trigger, .hero-smart-tester-trigger, .nav-item, .recall, .danger) { color: #102d21; }
    #hero-main .app-shell { grid-template-columns: 180px minmax(0,1fr); gap: 20px; } #hero-main .side-nav { top: 96px; background: var(--hero-surface); border-color: var(--hero-line); box-shadow: none; } #hero-main .nav-item { color: var(--hero-muted); background: transparent; border: 0; } #hero-main .nav-item.active { color: var(--hero-brand); background: var(--hero-brand-soft); } #hero-main .nav-icon, #hero-main .capability-icon { background: var(--hero-brand-soft); color: var(--hero-brand); } #hero-main .view-toolbar, #hero-main .admin-bar { background: var(--hero-surface); border-color: var(--hero-line); } #hero-main .capability-card { background: var(--hero-surface); border-color: var(--hero-line); }
    #hero-main :is(.nav-copy small, .view-count, .side-nav-top > span, .side-nav-foot, .footer) { color: var(--hero-muted); }
    #hero-main .view-count { background: var(--hero-surface-raised); border-color: var(--hero-line); }
    #hero-main .status-pill { background: var(--hero-surface-raised); color: var(--hero-muted); }
    #hero-main .status-pill.ok { background: var(--hero-success-soft); color: var(--hero-success); }
    #hero-main .status-pill.warn { background: var(--hero-warning-soft); color: var(--hero-warning); }
    #hero-main .status-pill.blocked { background: var(--hero-danger-soft); color: var(--hero-danger); }
    #hero-main :is(.focus-card, .arch-node, .detail-block, .projection-row, .memory-row, .route-card, .contract-item, .role, .request, .principle, .release, .team) { background: var(--hero-surface-raised); border-color: var(--hero-line); color: var(--hero-ink); }
    #hero-main .arch-node :is(strong,span), #hero-main .focus-card :is(p,small) { color: var(--hero-muted); }
    #hero-main :is(.activity-row, .config-count, .catalog-group, .config-form, .ai-connection-board, .ai-assignment-board, .ai-credential-entry, .ai-connection-card, .ai-assignment-row, .assignment-proposal-row, .guide-card, .role-guide-item, .concept, .timeline-item, .review, .next-step, .roadmap-row, .owner-action) { background: var(--hero-surface-raised); border-color: var(--hero-line); color: var(--hero-ink); }
    #hero-main :is(.ai-assignment-row, .assignment-proposal-row)[data-state="missing"], #hero-main .assignment-proposal-row[data-state="needs-admin-setup"], #hero-main .learn-note { background: var(--hero-warning-soft); color: var(--hero-warning); }
    #hero-main :is(.ai-assignment-row, .ai-connection-card)[data-state="blocked"] { background: var(--hero-danger-soft); }
    #hero-main .ai-connection-card[data-state="healthy"], #hero-main .ai-connection-card[data-state="local-ready"] { background: var(--hero-success-soft); }
    #hero-main :is(.ai-assignment-row, .assignment-proposal-row, .catalog-row, .timeline-item, .review, .roadmap-row, .concept, .role-guide-item, .ai-credential-entry-head, .owner-action) :is(strong, h4) { color: var(--hero-ink); }
    #hero-main :is(.owner-action, .role-guide-item, .concept, .learn-note) :is(span, small, .role-io) { color: var(--hero-muted); }
    #hero-main .learn-note strong { color: var(--hero-warning); }
    #hero-main .role-guide-item i { background: var(--hero-brand-soft); color: var(--hero-brand); }
    #hero-main .role-chip { background: var(--hero-surface-raised); border-color: var(--hero-line); color: var(--hero-ink); }
    #hero-main .role-chip i { background: var(--hero-brand-soft); color: var(--hero-brand); }
    #hero-main .topbar .brand-mark { display: none; }
    #hero-main .admin-bar { display: block; padding: 14px 18px; box-shadow: none; font-size: 12px; }
    #hero-main .admin-bar > summary { cursor: pointer; color: var(--hero-muted); }
    #hero-main .admin-bar[open] > .admin-copy { margin-top: 16px; }
    #hero-main .admin-bar .token-field { display: grid; max-width: 420px; margin-top: 16px; }
    #hero-main .app-shell { grid-template-columns: minmax(0,1fr); }
    #hero-main .side-nav { position: static; padding: 8px; }
    #hero-main :is(.side-nav-top, .side-nav-foot) { display: none; }
    #hero-main .nav-list { display: flex; flex-wrap: wrap; gap: 4px; }
    #hero-main .nav-item { width: auto; min-height: 44px; padding: 9px 12px; }
    #hero-main .nav-copy small { display: none; }
    #hero-main .nav-copy strong { font-size: 12px; }
    #hero-main :is(.team-id, .team-summary .label) { color: var(--hero-muted); }
    #hero-main :is(.activity-row, .setting-row, .route-card, .projection-row) > strong, #hero-main .contract-card > summary { color: var(--hero-ink); }
    :root[data-hero-theme="dark"] #hero-main :is(button, .button).danger { color: #40212a; }
    #hero-main .context.panel { background: var(--hero-brand-soft); color: var(--hero-ink); }.context.panel :is(p,small) { color: var(--hero-muted); } #hero-main .step { background: var(--hero-surface); }.step p { font-size: 13px; } #hero-main .workspace-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    :root[data-hero-theme="dark"] #hero-main :is(.notice, .banner, .selection-notice, .decision-card, .context.panel) { background: var(--hero-brand-soft) !important; }
    :root[data-hero-theme="dark"] #hero-main :is(.project-facts > div, .runtime-status, .login-steps li, .capability-card, .view-toolbar, .admin-bar, .nav-icon, .capability-icon, .nav-item) { background: var(--hero-surface-raised); border-color: var(--hero-line); color: var(--hero-ink); }
    :root[data-hero-theme="dark"] :is(.create-dialog, .dialog-head, .dialog-body, pre) { background: var(--hero-surface); color: var(--hero-ink); border-color: var(--hero-line); }
    @media (max-width: 1200px) {
      :root { --hero-sidebar-width: 208px; }.hero-appbar-inner { padding-inline: 20px; }.hero-app-actions { display: flex; }.hero-project-context { max-width: 165px; }
      .hero-side-nav ~ #hero-main { margin-inline-start: calc(var(--hero-sidebar-width) + 24px) !important; margin-inline-end: 24px !important; }
      #hero-main .app-shell { grid-template-columns: 1fr; } #hero-main .side-nav { position: static; } #hero-main .nav-list { display: flex; flex-wrap: wrap; }
      .hero-auth-layout { grid-template-columns: 1fr; gap: 4px; }.hero-auth-card { max-width: 540px; width: 100%; }
    }
    @media (max-width: 900px) {
      .hero-app-brand-copy small, .hero-project-context, .hero-shell-button kbd { display: none; }
      .hero-side-nav ~ #hero-main { width: calc(100% - 40px); margin-inline: 20px !important; padding-top: 24px; }
      .hero-appbar-inner { min-height: 68px; padding-inline: 20px; gap: 12px; grid-template-columns: auto minmax(0,1fr); }.hero-appbar { min-height: 68px; position: sticky; }
      .hero-app-brand { gap: 8px; }.hero-app-brand-copy strong { font-size: 19px; }.hero-app-mark { width: 32px; height: 32px; border-radius: 9px; }
      .hero-menu-button, .hero-nav-close { display: inline-flex; align-items: center; justify-content: center; min-width: 42px; min-height: 42px; padding: 9px; }.hero-brand-group { display: flex; align-items: center; gap: 8px; }.hero-nav-close { background: transparent; color: #e7f1eb; border-color: #527060; }
      .hero-side-nav { position: fixed; top: 0; bottom: 0; width: min(290px, calc(100vw - 56px)); max-height: none; margin: 0; border-radius: 0; z-index: 1001; transform: translateX(105%); visibility: hidden; transition: transform .2s ease, visibility .2s; }.hero-side-nav[data-open="true"] { transform: translateX(0); visibility: visible; }.hero-side-nav-head { padding: 18px 20px; }.hero-side-nav-head > .hero-nav-close { display: flex; }
      .hero-nav-scrim { position: fixed; inset: 0; z-index: 1000; width: 100%; height: 100%; border: 0; border-radius: 0; background: #081f18a6; } body[data-hero-nav-open="true"] { overflow: hidden; }
      #hero-main .hero-page-header { gap: 14px; margin-bottom: 20px; padding-bottom: 20px; } #hero-main .hero-page-header h1 { font-size: 1.65rem; }
      #hero-main :is(.panel, .section, .hero, .project-card) { padding: 20px; } #hero-main .project-grid { grid-template-columns: 1fr; }
    }
    @media (min-width: 901px) { .hero-nav-scrim { display: none; }.hero-brand-group { display: flex; } }
    @media (max-width: 600px) {
      .hero-appbar-inner { padding-inline: 12px; gap: 8px; }.hero-app-actions { gap: 6px; }.hero-app-brand-copy, .hero-tools > summary > span, .hero-shell-button[data-hero-command-button] > span { display: none; }.hero-shell-button { padding: 8px 10px; }.hero-environment { font-size: 10px; padding: 3px 7px; max-width: 110px; overflow: hidden; text-overflow: ellipsis; }
      .hero-side-nav ~ #hero-main { width: calc(100% - 28px); margin-inline: 14px !important; padding: 22px 0 48px; } #hero-main .hero-page-header h1 { font-size: 1.45rem; }
      #hero-main :is(.panel, .section, .hero, .project-card) { padding: 18px; } #hero-main :is(.metrics, .metric-grid) { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; } #hero-main .metric { min-height: 110px; padding: 14px; }
      #hero-main .decision-card { align-items: start; flex-direction: column; gap: 10px; padding: 16px; }.decision-card a { margin-inline-start: 0 !important; }
      #hero-main .panel-head { padding: 18px; } #hero-main .project-grid { padding: 12px; }.view-controls { width: 100%; }.search-wrap { width: 100%; flex-basis: 100%; }.search-wrap input { width: 100%; }
      #hero-main :is(.grid, .workspace-grid, .settings-grid, .form.two, .form.three) { grid-template-columns: 1fr; } #hero-main :is(.section.wide, .section.full, .workspace-wide) { grid-column: 1 / -1; }
      #hero-main #sections { grid-template-columns: 1fr; }
      #hero-main .hero-auth-intro { padding: 8px 0 0; } #hero-main .hero-auth-intro h1 { font-size: 1.8rem; }.hero-auth-intro .grid { display: none; } #hero-main .hero-auth-card { margin-top: 8px; }.hero-auth-layout { gap: 8px; }.hero-tools-menu { width: min(240px,calc(100vw - 28px)); }.hero-command-footer { display: none; } #hero-main .target-form label { min-width: 0; width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
  `;
}
