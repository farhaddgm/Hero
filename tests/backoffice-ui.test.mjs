import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { getBackofficeHtml } from "../apps/control-plane/src/backoffice-view.mjs";
import { getDashboardHtml } from "../apps/control-plane/src/dashboard-view.mjs";
import { HERO_FEATURE_HELP, getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "../apps/control-plane/src/hero-shell.mjs";
import { getIdentityHtml } from "../apps/control-plane/src/identity-view.mjs";
import { getPortfolioHtml } from "../apps/control-plane/src/portfolio-view.mjs";
import { getProductStudioHtml } from "../apps/control-plane/src/product-studio-view.mjs";
import { getProjectControlRoomHtml } from "../apps/control-plane/src/project-control-room-view.mjs";
import { getProjectWorkspaceHtml } from "../apps/control-plane/src/project-workspace-view.mjs";
import { getProjectWalkthroughHtml } from "../apps/control-plane/src/project-walkthrough-view.mjs";
import {
  HERO_PROJECT_WALKTHROUGH_ENABLED_SETTING,
  HERO_PROJECT_WALKTHROUGH_ADVISOR_MAX_QUESTION_LENGTH,
  HERO_PROJECT_WALKTHROUGH_ADVISOR_MODE,
  HERO_PROJECT_WALKTHROUGH_FIELD_GUIDANCE,
  HERO_PROJECT_WALKTHROUGH_STATE_VERSION,
  HERO_PROJECT_WALKTHROUGH_STEPS,
  HERO_PROJECT_WALKTHROUGH_VERSION,
  createProjectWalkthroughAdvisory
} from "../apps/control-plane/src/project-walkthrough.mjs";

function scripts(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
}

test("the shared Hero shell provides accessible project-aware navigation", () => {
  const html = getHeroGlobalNavigation({ active: "studio", projectId: "project-vpn", environment: "Test" });
  assert.match(html, /data-hero-shell="v1"/);
  assert.match(html, /class="hero-skip-link"/);
  assert.match(html, /aria-label="ناوبری اصلی \/ Primary navigation"/);
  assert.match(html, /href="\/api\/portal\?surface=studio&amp;projectId=project-vpn" aria-current="page"/);
  assert.match(html, /href="\/api\/portal\?surface=workspace&amp;projectId=project-vpn"/);
  assert.match(html, /href="\/api\/portal\?surface=command&amp;projectId=project-vpn"/);
  assert.match(html, /href="\/api\/portal\?surface=ai#ai"/);
  assert.doesNotMatch(html, /href="\/backoffice\?surface=ai/);
  assert.match(html, /href="\/api\/portal\?surface=walkthrough&amp;projectId=project-vpn"/);
  assert.match(html, /پروژهٔ فعال \/ Active project/);
  assert.match(getHeroShellScript(), /hero\.active-project-id/);
  assert.match(html, /data-hero-command-dialog/);
  assert.match(html, /data-hero-smart-tester-toggle/);
  assert.match(html, /data-hero-form-suggestions-toggle/);
  assert.match(getHeroShellScript(), /hero-form-suggestion-trigger/);
  assert.match(getHeroShellScript(), /اعلام پیشنهاد/);
  assert.match(getHeroShellScript(), /انتخاب این پیشنهاد/);
  assert.match(getHeroShellStyles(), /hero-form-suggestion-dialog/);
  assert.match(html, /Portfolio/);
  assert.match(html, /انتخاب پروژه/);
  assert.match(html, /class="hero-side-nav"/);
  assert.match(html, /ناوبری \/ Navigation/);
  assert.match(getHeroShellStyles(), /prefers-reduced-motion: reduce/);
  assert.match(getHeroShellStyles(), /--hero-danger/);
  assert.match(getHeroShellStyles(), /hero-smart-tester-panel/);
  assert.match(getBackofficeHtml({ initialData: null }), /پیشنهاد فرم/);
  assert.match(getBackofficeHtml({ initialData: null }), /form-suggestions/);
  assert.ok(getHeroShellStyles().includes(".hero-side-nav { position: fixed;"));
  assert.ok(getHeroShellStyles().includes(".hero-global-nav { display: grid; align-content: start; min-width: 0; gap: 4px; overflow-y: auto;"));
  const script = getHeroShellScript().match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new vm.Script(script, { filename: "hero-shell-inline.js" }));
});

test("AI Connections exposes safe provider setup, readiness checks and a project-scoped assignment matrix", () => {
  const html = getBackofficeHtml({ initialData: { ai: {}, projects: [] }, active: "ai" });
  assert.match(html, /OpenAI \/ ChatGPT/);
  assert.match(html, /Anthropic \/ Claude/);
  assert.match(html, /Google \/ Gemini/);
  assert.match(html, /Cursor Cloud Agent/);
  assert.match(html, /تست آماده‌بودن/);
  assert.match(html, /href="#ai-credential-entry">رفتن به ثبت امن کلید<\/a>/);
  assert.match(html, /id="ai-credential-entry"/);
  assert.match(html, /\/api\/ai\/providers\//);
  assert.match(html, /\/api\/ai\/credentials\/.*\/health/);
  assert.ok(html.indexOf('/api/ai/credentials/') < html.indexOf('/api/ai/providers/'), 'credential readiness precedes provider health');
  assert.match(html, /پاسخ عملیات قابل خواندن نیست \(HTTP/);
  assert.match(html, /نشست انسانی یا دسترسی Proxy محیط Test را بررسی کنید/);
  assert.match(html, /ai-assignment-project/);
  assert.match(html, /project-scope/);
  assert.match(html, /\/api\/ai\/project-scopes/);
  assert.match(html, /Scope پروژه/);
  assert.match(html, /Walk-Through Guide/);
  assert.match(html, /Smart Tester/);
  assert.match(html, /vault:hero\/test\/cursor\/default/);
  assert.match(html, /Workflow مخزن\/Agent جداگانه/);
  assert.match(html, /پیشنهاد اتصال همهٔ نقش‌ها/);
  assert.match(html, /function currentBindingForConfig/);
  assert.match(html, /شناسهٔ نسخهٔ فعلی خودکار درج می‌شود/);
  assert.match(html, /supersedesBindingId = configValue\('config-binding-supersedes'\) \|\| currentBinding\?\.bindingId \|\| null/);
  assert.match(html, /BINDING_VERSION_CONFLICT/);
});

test("global navigation never sends an unscoped project action to a 400 route", () => {
  const html = getHeroGlobalNavigation({ active: "backoffice" });
  assert.match(html, /href="\/api\/portal\?surface=portfolio&amp;select=project&amp;next=command" aria-current="page"/);
  assert.match(html, /href="\/api\/portal\?surface=portfolio&amp;select=project&amp;next=workspace"/);
  assert.match(html, /href="\/api\/portal\?surface=portfolio&amp;select=project&amp;next=control"/);
  assert.match(html, /href="\/api\/portal\?surface=walkthrough"/);
  assert.doesNotMatch(html, /href="\/workspace"/);
  assert.doesNotMatch(html, /href="\/project-control"/);
});

test("project control room exposes a project-scoped Test target selector without dispatch", () => {
  const html = getProjectControlRoomHtml({ initialData: { controlRoom: { project: { projectId: "project-vpn", name: "VPN", lifecycle: "draft" }, infrastructure: { items: [], servers: [{ serverId: "test-server", address: "185.204.168.171", environment: "test", state: "planned-no-connection" }], targetSelections: [] }, metrics: {}, collaboration: { teams: [] }, commands: { items: [] }, catalog: { items: [] }, performance: { items: [] }, observability: { items: [] }, delivery: { items: [] }, hardening: { items: [] }, readiness: { items: [] } } } });
  assert.match(html, /id="target-selection-form"/);
  assert.match(html, /ثبت Target برای این پروژه/);
  assert.match(html, /action: 'select-target'/);
  assert.match(html, /اجرای محصول هنوز جداگانه نیازمند مجوز Test است/);
});

test("the project Walk-Through covers the real setup path, all management surfaces and explicit gated work", () => {
  assert.equal(HERO_PROJECT_WALKTHROUGH_VERSION, "1.8.0");
  assert.equal(HERO_PROJECT_WALKTHROUGH_STATE_VERSION, 1);
  assert.equal(HERO_PROJECT_WALKTHROUGH_ENABLED_SETTING, "backoffice.walkthrough.enabled");
  assert.ok(HERO_PROJECT_WALKTHROUGH_STEPS.length >= 12);
  const ids = new Set();
  for (const step of HERO_PROJECT_WALKTHROUGH_STEPS) {
    assert.match(step.id, /^[a-z][a-z-]+$/);
    assert.equal(ids.has(step.id), false, `duplicate guide step ${step.id}`); ids.add(step.id);
    assert.match(step.target, /^[a-z]+\.[a-z-]+$/);
    assert.ok(step.instructions.length >= 3, `${step.id} needs actionable guidance`);
    assert.doesNotMatch(JSON.stringify(step), /(?:secret|password|credential)\s*[:=]\s*[A-Za-z0-9]/i, `${step.id} must never carry a secret`);
    const fields = HERO_PROJECT_WALKTHROUGH_FIELD_GUIDANCE[step.id];
    assert.ok(Array.isArray(fields), `${step.id} needs field-by-field coaching`);
    assert.ok(fields.length >= 3, `${step.id} needs at least three explained fields or review controls`);
    for (const field of fields) {
      assert.equal(typeof field.label, "string", `${step.id} field label`);
      assert.equal(typeof field.instruction, "string", `${step.id} field instruction`);
      assert.ok(field.label.trim().length >= 3, `${step.id} field label is too short`);
      assert.ok(field.instruction.trim().length >= 24, `${step.id} field instruction is too short`);
      assert.doesNotMatch(JSON.stringify(field), /(?:secret|password|credential)\s*[:=]\s*[A-Za-z0-9]/i, `${step.id} field coaching must never carry a secret`);
    }
  }
  const mainSteps = HERO_PROJECT_WALKTHROUGH_STEPS.filter(step => step.flow === "main");
  const supportSteps = HERO_PROJECT_WALKTHROUGH_STEPS.filter(step => step.flow === "outside-main");
  assert.equal(mainSteps[0]?.id, "project-selection", "the numbered product flow starts from project selection");
  assert.ok(mainSteps.length >= 12, "the main product flow has complete stages");
  assert.deepEqual(supportSteps.map(step => step.id).sort(), ["access-review", "identity"]);
  assert.ok(mainSteps.every(step => step.nextId === null || mainSteps.some(candidate => candidate.id === step.nextId)), "main stages only point within the main flow");
  assert.ok(supportSteps.every(step => step.nextId === null), "support capabilities are not numbered product stages");
  assert.deepEqual(Object.keys(HERO_PROJECT_WALKTHROUGH_FIELD_GUIDANCE).sort(), [...ids].sort(), "field coaching must cover exactly the guide steps");
  for (const step of HERO_PROJECT_WALKTHROUGH_STEPS) if (step.nextId) assert.ok(ids.has(step.nextId), `${step.id} points to a missing next step`);
  assert.equal(mainSteps.at(-1).nextId, null, "the final main stage must expose completion instead of another step");
  assert.ok(HERO_PROJECT_WALKTHROUGH_STEPS.some(step => step.id === "intake" && step.completion === "intake-complete"));
  assert.ok(HERO_PROJECT_WALKTHROUGH_STEPS.some(step => step.id === "foundation" && step.completion === "foundation-approved"));
  assert.ok(HERO_PROJECT_WALKTHROUGH_STEPS.some(step => step.availability === "gated" && step.id === "production"));
  const html = getProjectWalkthroughHtml({ projectId: "project-vpn" });
  assert.match(html, /راهنمای گام‌به‌گام ساخت محصول/);
  assert.match(html, /شناسه:.*projectId/);
  assert.match(html, /credentials: 'same-origin'/);
  assert.match(html, /workspace-overview/);
  assert.match(html, /وضعیت راهنما از Scope فعلی پروژه بازخوانی شد/);
  assert.match(html, /گیت‌شده/);
  assert.match(html, /Provider، سرور، GitHub، Pilot یا Production/);
  assert.match(html, /شروع Walk-Through/);
  assert.match(html, /بستن کامل Walk-Through فعال/);
  assert.match(html, /تنظیمات سرویس Walk-Through/);
  assert.match(html, /backoffice\.walkthrough\.enabled/);
  for (const source of scripts(html)) assert.doesNotThrow(() => new vm.Script(source, { filename: "project-walkthrough-inline.js" }));
});

test("Walk-Through advisor starts empty, analyses the current step and never invokes a provider", () => {
  const intake = createProjectWalkthroughAdvisory({ stepId: "intake", projectId: "project-vpn", question: "برای هدف و خودکارسازی چه پیشنهادی داری؟" });
  assert.equal(intake.mode, HERO_PROJECT_WALKTHROUGH_ADVISOR_MODE);
  assert.equal(intake.providerInvoked, false);
  assert.equal(intake.stepId, "intake");
  assert.match(intake.response, /هدف/);
  assert.ok(intake.proposedFields.length >= 3);
  assert.ok(intake.proposedFields.every(field => field.formId === "intake-form"));
  assert.ok(intake.proposedFields.every(field => !/(?:password|secret|token|credential|mfa)/i.test(field.name)));
  const blank = createProjectWalkthroughAdvisory({ stepId: "intake", projectId: "project-vpn" });
  assert.equal(blank.response, "", "opening consultation must not show a pre-written answer");
  const gated = createProjectWalkthroughAdvisory({ stepId: "production", projectId: "project-vpn", question: "برای Production چه Approval لازم است؟" });
  assert.equal(gated.proposedFields.length, 0);
  assert.match(gated.response, /Approval|تأیید/);
  assert.throws(() => createProjectWalkthroughAdvisory({ stepId: "intake" }), RangeError);
  assert.throws(() => createProjectWalkthroughAdvisory({ stepId: "intake", projectId: "project-vpn", question: "a".repeat(HERO_PROJECT_WALKTHROUGH_ADVISOR_MAX_QUESTION_LENGTH + 1) }), RangeError);
});

test("Walk-Through routes have an on-page target on the exact surface they explain", () => {
  const sources = [
    getPortfolioHtml({ portfolio: { cards: [] } }),
    getIdentityHtml(),
    getProjectWorkspaceHtml({ projectId: "project-vpn" }),
    getProductStudioHtml(),
    getProjectControlRoomHtml(),
    getProjectControlRoomHtml({ active: "backoffice" })
  ].join("\n");
  for (const step of HERO_PROJECT_WALKTHROUGH_STEPS) {
    assert.ok(sources.includes(`data-hero-guide-target="${step.target}"`) || sources.includes(`'${step.target}'`), `${step.id} target missing`);
  }
  const shell = getHeroShellScript();
  assert.match(shell, /requestedWalkthroughStep/);
  assert.match(shell, /isWalkthroughTargetReady/);
  assert.match(shell, /walkthroughTargetObserver/);
  assert.match(shell, /scheduleWalkthroughCoachInstall/);
  assert.match(shell, /hero-walkthrough-targets-changed/);
  assert.match(shell, /attributeFilter: \['hidden', 'class', 'data-hero-guide-target'\]/);
  assert.match(shell, /continueWalkthrough/);
  assert.match(shell, /target\?\.id === 'create-project'/);
  assert.match(shell, /hero-walkthrough-coach/);
  assert.ok(getHeroShellStyles().includes(".hero-walkthrough-coach, .hero-walkthrough-advisor { position: fixed;"));
  assert.ok(getHeroShellStyles().includes("contain: layout paint style"));
  assert.match(shell, /document\.body\.append\(coach\)/);
  assert.doesNotMatch(shell, /target\.before\(coach\)/);
  assert.doesNotMatch(shell, /target\.style\.setProperty/);
  assert.doesNotMatch(shell, /reserveTargetSpace|ReservedMargin|margin-right|margin-left/);
  assert.doesNotMatch(shell, /hero-walkthrough-field-guidance/);
  assert.doesNotMatch(shell, /currentStep\.fieldGuidance/);
  assert.match(shell, /stepById\(current\?\.nextId\)/);
  assert.match(shell, /scrollIntoView/);
  assert.match(shell, /hero\.project-walkthrough\.state\.v1/);
  assert.match(shell, /hero\.project-walkthrough\.coach-side\.v1/);
  assert.match(shell, /hero\.project-walkthrough\.advisor-side\.v1/);
  assert.match(shell, /hero\.project-walkthrough\.coach-minimized\.v1/);
  assert.match(shell, /hero-walkthrough-launcher/);
  assert.match(shell, /restoreWalkthroughCoach/);
  assert.match(shell, /normalizeWalkthroughStateForSurface/);
  assert.match(shell, /const active = normalizeWalkthroughStateForSurface\(\) \|\| readWalkthroughState\(\)/);
  assert.match(shell, /walkthroughStepForSurface/);
  assert.match(shell, /state\.stepId === 'project-selection'/);
  assert.match(shell, /coachMinimizedInMemory/);
  assert.match(shell, /if \(isCoachMinimized\(\)\) \{ showWalkthroughLauncher\(active\); return; \}\s*if \(!isWalkthroughTargetReady\(target\)\)/);
  assert.match(shell, /window\.setTimeout/);
  assert.match(shell, /data-hero-walkthrough-advisor/);
  assert.match(shell, /\/api\/walkthrough\/advice/);
  assert.match(shell, /walkthrough-advisor\/options/);
  assert.match(shell, /advisorProfileId: selector\.value === 'local' \? null : selector\.value/);
  assert.match(shell, /AI و نسخه/);
  assert.match(shell, /پاسخ سرویس قابل‌خواندن نیست/);
  assert.match(shell, /نشست انسانی و Proxy محیط Test را بررسی کنید/);
  assert.match(shell, /hero\.project-walkthrough\.advisor\./);
  assert.match(shell, /hero-walkthrough-advisor-messages/);
  assert.match(shell, /در حال تحلیل پرسش در زمینهٔ همین گام/);
  assert.doesNotMatch(shell, /askAdvisor\(''\)/);
  assert.match(getHeroShellStyles(), /hero-walkthrough-advisor-messages/);
  assert.match(shell, /localStorage\.setItem\(walkthroughStateKey/);
  assert.match(shell, /dataset\.heroWalkthroughSide/);
  assert.match(shell, /گام بعد/);
  assert.match(shell, /گام قبل/);
  assert.match(shell, /مشاوره/);
  assert.match(shell, /کمینه‌سازی/);
  assert.match(shell, /بازگشت به راهنمای کامل/);
  assert.match(shell, /بستن کامل Walk-Through فعال/);
  assert.match(shell, /پایان Walk-Through/);
  assert.match(shell, /انتقال به لبهٔ چپ/);
  assert.match(shell, /انتقال به لبهٔ راست/);
  assert.match(shell, /setServiceEnabled/);
  assert.match(shell, /mainWalkthroughSteps/);
  assert.match(shell, /hero-walkthrough-completion/);
  assert.match(shell, /walkthroughOwnerDismissedKey/);
  assert.match(shell, /activateDefaultWalkthroughForOwner/);
  assert.match(shell, /step\.id === 'project-selection' && !explicitProjectId/);
  assert.match(getPortfolioHtml({ portfolio: { cards: [] } }), /heroWalkthrough\.continue/);
});

test("Smart Tester is an opt-in floating development assistant on every shared Back Office surface", () => {
  const shell = getHeroShellScript();
  const styles = getHeroShellStyles();
  assert.match(shell, /hero\.smart-tester\.enabled\.v1/);
  assert.match(shell, /data-hero-smart-tester-toggle/);
  assert.match(shell, /hero-smart-tester-trigger/);
  assert.match(shell, /hero-smart-tester-panel/);
  assert.match(shell, /\/api\/smart-tester\/context/);
  assert.match(shell, /\/api\/smart-tester\/run/);
  assert.match(shell, /\/api\/smart-tester\/advice/);
  assert.match(shell, /\/api\/smart-tester\/options/);
  assert.match(shell, /\/api\/smart-tester\/diagnose/);
  assert.match(shell, /\/api\/smart-tester\/errors\/submit/);
  assert.match(shell, /انتخاب AI و نسخه/);
  assert.match(shell, /خطایاب/);
  assert.match(shell, /ثبت در دفتر خطا/);
  assert.match(shell, /hero-action-feedback/);
  assert.match(shell, /hero\.action-feedback\.v1/);
  assert.match(shell, /hero\.action-feedback\.side\.v1/);
  assert.match(shell, /persistHeroActionFeedback/);
  assert.match(shell, /readHeroActionFeedback/);
  assert.match(shell, /persistedHeroActionFeedback/);
  assert.match(shell, /restored: true/);
  assert.match(shell, /عملیات با موفقیت انجام شد/);
  assert.match(shell, /عملیات ناموفق بود/);
  assert.match(shell, /تحلیل با اسمارت تستر/);
  assert.match(shell, /heroActionCode/);
  assert.match(shell, /چه اتفاقی افتاد؟/);
  assert.match(shell, /چه‌کار کنم؟/);
  assert.match(shell, /hero-smart-tester-diagnosis/);
  assert.doesNotMatch(shell, /rowTitle\.textContent = 'گام بازتولید'/);
  assert.match(shell, /انتقال به لبهٔ چپ/);
  assert.match(shell, /انتقال به لبهٔ راست/);
  assert.match(shell, /actions\.append\(moveLeft, moveRight, next\)/);
  assert.match(shell, /actions\.prepend\(moveLeft, moveRight\)/);
  assert.match(shell, /window\.fetch = async/);
  assert.match(shell, /heroActionIsProcess/);
  assert.match(shell, /actionFailure/);
  assert.ok(styles.includes(".hero-action-feedback { position: fixed;"));
  assert.match(styles, /\.hero-action-feedback\[data-state="success"\]/);
  assert.match(styles, /\.hero-action-feedback\[data-state="error"\]/);
  assert.match(styles, /\.hero-action-feedback\[data-hero-action-feedback-side="left"\]/);
  assert.match(styles, /\.hero-action-feedback\[data-hero-action-feedback-side="right"\]/);
  assert.match(shell, /credentials: 'same-origin'/);
  assert.match(shell, /تحلیلگر محلی Hero/);
  assert.match(shell, /مشاوره اجرا نشد:/);
  assert.match(shell, /item\.dataset\.state = state/);
  assert.match(shell, /smartTesterCandidateSelector/);
  assert.match(shell, /getSmartTesterDescription/);
  assert.match(shell, /boxDescription/);
  assert.match(shell, /boxId/);
  assert.doesNotMatch(shell, /زمینه: '\s*\+ featureKey/);
  assert.match(shell, /smartTesterExcludedSelector/);
  assert.match(shell, /uninstallSmartTesterTriggers/);
  assert.ok(styles.includes(".hero-smart-tester-panel { position: fixed;"));
  assert.ok(styles.includes("grid-template-rows: auto auto minmax(0,1fr) auto auto"));
  assert.ok(styles.includes("max-height: calc(100vh - 94px)"));
  assert.ok(styles.includes("min-height: 0; overflow: auto;"));
  assert.ok(styles.includes(".hero-smart-tester-message span, .hero-smart-tester-report span { display: block; min-width: 0; max-width: 100%; overflow-wrap: anywhere; word-break: break-word;"));
  assert.doesNotMatch(shell, /smartTester[^\n]{0,120}(?:child_process|exec\(|spawn\(|fetch\(['"]https?:)/i);
});

test("AI connection command surface lists connection health and token usage without displaying a credential", () => {
  const html = getBackofficeHtml();
  assert.match(html, /Providerها و سلامت اتصال/);
  assert.match(html, /مصرف Token به تفکیک Provider/);
  assert.match(html, /connection\.latestHealth/);
  assert.match(html, /usage\.totalTokens/);
  assert.match(getHeroGlobalNavigation(), /اتصال‌های AI/);
  assert.match(getHeroGlobalNavigation(), /href="\/api\/portal\?surface=ai#ai"/);
  assert.doesNotMatch(getHeroGlobalNavigation(), /href="\/backoffice\?surface=ai/);
});

test("Workspace has scoped recall controls, safe presets and a complete Run override form", () => {
  const html = getProjectWorkspaceHtml({ projectId: "project-vpn" });
  for (const id of ["intake-recall", "foundation-recall", "input-recall", "setting-recall", "rollback-recall", "setting-preset", "setting-run-id-field"]) assert.match(html, new RegExp(`id=\"${id}\"`));
  assert.match(html, /name="runId"/);
  assert.match(html, /برای Run override، شناسهٔ Run را وارد کنید/);
  assert.match(html, /\/inputs\/.*\/recall/);
  assert.match(html, /متن خصوصی پس از کنترل مجوز و checksum/);
  assert.match(html, /<select name="impact">/);
  assert.match(html, /byId\('studio'\)\.href = '\/api\/portal\?surface=studio&projectId='/);
  assert.match(html, /byId\('control'\)\.href = '\/api\/portal\?surface=control&projectId='/);
  assert.doesNotMatch(html, /\.href = '\/(?:product-studio|project-control)\?projectId='/);
  for (const source of scripts(html)) assert.doesNotThrow(() => new vm.Script(source, { filename: "workspace-inline.js" }));
});

test("the shared InfoTip contract is accessible, keyboard-aware and injection-safe", () => {
  const navigation = getHeroGlobalNavigation();
  const styles = getHeroShellStyles();
  const script = getHeroShellScript();
  assert.match(navigation, /id="hero-feature-tooltip"[^>]+role="tooltip"[^>]+hidden/);
  assert.match(styles, /\.hero-info-trigger/);
  assert.match(styles, /\.hero-feature-tooltip/);
  assert.ok(styles.includes("position: fixed"));
  assert.ok(styles.includes("prefers-reduced-motion: reduce"));
  assert.match(script, /document\.createElement\('button'\)/);
  assert.match(script, /trigger\.type = 'button'/);
  assert.match(script, /aria-describedby/);
  assert.match(script, /aria-expanded/);
  assert.match(script, /MutationObserver/);
  assert.match(script, /pointerover/);
  assert.match(script, /focusin/);
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(script, /getBoundingClientRect/);
  assert.match(script, /featureTooltip\.textContent = text/);
  assert.doesNotMatch(script, /featureTooltip\.innerHTML/);
});

test("every registered InfoTip has useful copy and every rendered marker resolves", () => {
  const entries = Object.entries(HERO_FEATURE_HELP);
  assert.ok(entries.length >= 100, `expected broad feature coverage, received ${entries.length}`);
  for (const [key, description] of entries) {
    assert.match(key, /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/, key);
    assert.equal(typeof description, "string", key);
    assert.ok(description.trim().length >= 20, `${key} is too short`);
    assert.ok(description.length <= 500, `${key} is too long`);
    assert.doesNotMatch(description, /<[^>]+>/, `${key} must remain plain text`);
  }
  const pages = [
    getPortfolioHtml({ portfolio: { cards: [] } }),
    getBackofficeHtml(),
    getProductStudioHtml(),
    getProjectWorkspaceHtml({ projectId: "project-vpn" }),
    getProjectControlRoomHtml(),
    getIdentityHtml(),
    getDashboardHtml()
  ];
  for (const page of pages) {
    for (const match of page.matchAll(/data-hero-info-key="([^"]+)"/g)) {
      if (match[1].includes("' +")) continue;
      assert.ok(HERO_FEATURE_HELP[match[1]], `missing InfoTip copy for ${match[1]}`);
    }
  }
});

test("all back-office surfaces expose their required feature help without nesting controls in links", () => {
  const surfaces = [
    [getPortfolioHtml({ portfolio: { cards: [] } }), ["portfolio.projects", "portfolio.health", "portfolio.ownerBriefing", "portfolio.createProject"]],
    [getBackofficeHtml(), ["command.statusOverview", "capability.portfolioHealth", "capability.identityAccess", "teams.contracts", "ai.versionedConfiguration", "project.globalSettings", "operations.ownerActions", "guide.conceptsContracts"]],
    [getProductStudioHtml(), ["studio.sourceOfTruth", "studio.productsMetric", "studio.canonicalDocuments", "studio.projectWorkspace", "studio.versionedEndpoints"]],
    [getProjectWorkspaceHtml({ projectId: "project-vpn" }), ["workspace.projectContext", "workspace.intake", "workspace.foundationProposal", "workspace.projectInputs", "workspace.versionedSettings", "workspace.policyPack", "workspace.rollback"]],
    [getProjectControlRoomHtml(), ["control.activeTeams", "control.collaborationMemory", "control.commandOperations", "control.infrastructure", "control.finalReadiness"]],
    [getIdentityHtml(), ["identity.configurationStatus", "identity.loginSteps", "identity.humanLogin", "identity.ownerAdmin", "identity.viewer", "identity.projectGrant", "identity.createViewer", "identity.assignGrant"]],
    [getDashboardHtml(), ["lab.newRequest", "lab.autonomy", "lab.globalStop", "lab.currentScope", "lab.aiRoles", "lab.releases"]]
  ];
  for (const [html, keys] of surfaces) {
    for (const key of keys) assert.ok(html.includes(key), `surface omitted ${key}`);
    for (const anchor of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
      assert.doesNotMatch(anchor[1], /data-hero-info-key=/, "InfoTip host must not be nested inside a link");
    }
  }
  const backoffice = surfaces[1][0];
  assert.equal((backoffice.match(/class="capability-card"/g) ?? []).length, 12);
  assert.equal((backoffice.match(/class="capability-info"/g) ?? []).length, 12);
});

test("Project Workspace makes project inputs explicitly optional", () => {
  const html = getProjectWorkspaceHtml({ projectId: "project-vpn" });
  assert.match(html, /ورودی پروژه <span class="optional-badge">اختیاری<\/span>/);
  assert.match(html, /نداشتن ورودی مانع ادامهٔ پروژه نیست/);
  assert.match(html, /name="content" maxlength="524288" placeholder=/);
  assert.match(html, /name="url" type="url" placeholder=/);
  assert.doesNotMatch(html, /name="content"[^>]*required/);
  assert.doesNotMatch(html, /name="url"[^>]*required/);
  assert.match(html, /ورودی پروژه اختیاری است؛ بدون نمونه می‌توانید پروژه را ادامه دهید/);
});

test("Identity separates the three Test login gates with plain-language field guidance", () => {
  const html = getIdentityHtml();
  assert.match(html, /Gate 1 — Network Basic Auth/);
  assert.match(html, /Gate 2 — Human Identity/);
  assert.match(html, /Gate 3/);
  assert.match(html, /رمز مرحلهٔ اول اینجا کار نمی‌کند/);
  assert.match(html, /خود Secret کد ورود نیست/);
  assert.match(html, /مرحلهٔ ۲: ادامه به MFA/);
  assert.match(html, /مرحلهٔ ۳: تکمیل ورود/);
});

test("the canonical identity portal tells an Owner not to use a legacy Basic prompt as a Human password", () => {
  const html = getIdentityHtml({ portalEntry: true });
  assert.match(html, /Portal رسمیِ ورود انسانی Test/);
  assert.match(html, /اگر پنجرهٔ Basic از یک نشانی قدیمی باز شد، آن را لغو کنید/);
  assert.match(html, /Email و Password بخش <b>Gate 2 — Human Identity<\/b>/);
});

test("all management surfaces use one visual and navigation shell", () => {
  const pages = [
    getPortfolioHtml({ portfolio: { cards: [] } }),
    getBackofficeHtml(),
    getProductStudioHtml(),
    getProjectWorkspaceHtml({ projectId: "project-vpn" }),
    getProjectControlRoomHtml(),
    getIdentityHtml(),
    getDashboardHtml()
  ];
  for (const page of pages) {
    assert.match(page, /data-hero-shell="v1"/);
    assert.match(page, /id="hero-main"/);
    assert.match(page, /data-hero-command-button/);
    assert.match(page, /hero\.ui\.theme/);
    assert.doesNotMatch(page, /https?:\/\/[^"']+\.(?:js|css)(?:[?"'])/i);
    for (const source of scripts(page)) assert.doesNotThrow(() => new vm.Script(source, { filename: "management-surface-inline.js" }));
  }
  const styles = getHeroShellStyles();
  assert.match(styles, /@font-face/);
  assert.match(styles, /\/api\/ui-assets\/vazirmatn\.woff2/);
  assert.match(styles, /font-family: Vazirmatn, sans-serif !important/);
});

test("Portfolio renders real scoped data, explicit unknown state and safe drill-downs", () => {
  const html = getPortfolioHtml({ portfolio: { cards: [{
    projectId: "project-vpn",
    name: "VPN <Pilot>",
    lifecycle: "active",
    health: "unknown",
    tokenUsage: null,
    roadmap: [{ taskId: "TASK-1", title: "Threat model" }],
    latestOutput: null,
    drillDown: { href: "/product-studio?projectId=project-vpn" }
  }] } });
  assert.match(html, /VPN &lt;Pilot&gt;/);
  assert.doesNotMatch(html, /VPN <Pilot>/);
  assert.match(html, /unknown/);
  assert.match(html, /ثبت نشده/);
  assert.match(html, /Threat model/);
  assert.match(html, /\/api\/portal\?surface=studio&amp;projectId=project-vpn/);
  assert.match(html, /\/api\/portal\?surface=control&projectId=project-vpn/);
  assert.match(html, /\/api\/portal\?surface=workspace&projectId=project-vpn/);
  assert.match(html, /id="portfolio-search"/);
  assert.match(html, /id="portfolio-filter"/);
  assert.match(html, /id="create-project-button"/);
  assert.match(html, /id="create-project-dialog"/);
  assert.match(html, /fetch\('\/api\/projects'/);
  assert.match(html, /credentials:'same-origin'/);
  assert.match(html, /1 پروژه/);
});

test("Portfolio turns an unscoped Workspace or Operations entry into an explicit project choice", () => {
  const html = getPortfolioHtml({ portfolio: { cards: [{ projectId: "project-vpn", name: "VPN", lifecycle: "active", health: "unknown", roadmap: [] }] }, destination: "workspace" });
  assert.match(html, /یک پروژه برای فضای پروژه انتخاب کنید/);
  assert.match(html, /انتخاب پروژه لازم است/);
  assert.match(html, /href="\/api\/portal\?surface=workspace&projectId=project-vpn"/);
  assert.match(html, /ورود به فضای پروژه/);
});

test("Portfolio serialization cannot break out of its inline script", () => {
  const html = getPortfolioHtml({ portfolio: { cards: [{
    projectId: "project-safe",
    name: "</script><script>globalThis.compromised=true</script>",
    lifecycle: "active",
    health: "unknown",
    roadmap: []
  }] } });
  assert.doesNotMatch(html, /<script>globalThis\.compromised/);
  assert.doesNotMatch(html, /<\/script><script>globalThis/);
  for (const source of scripts(html)) assert.doesNotThrow(() => new vm.Script(source));
});
