import assert from "node:assert/strict";
import test from "node:test";

import {
  HERO_SMART_TESTER_MAX_QUESTION_LENGTH,
  HERO_SMART_TESTER_ERROR_REPORT_VERSION,
  HERO_SMART_TESTER_REPORT_TTL_MS,
  HERO_SMART_TESTER_VERSION,
  createSmartTesterAdvisory,
  createSmartTesterErrorReport,
  createSmartTesterReport,
  resolveSmartTesterContext
} from "../apps/control-plane/src/smart-tester.mjs";

test("Smart Tester accepts only a bounded Back Office context and never accepts a free-form route", () => {
  const context = resolveSmartTesterContext({ pathname: "/workspace", featureKey: "workspace.intake", projectId: "project-vpn" });
  assert.equal(context.title, "فضای کاری و تنظیمات پروژه");
  assert.equal(context.featureKey, "workspace.intake");
  assert.equal(context.boxId, "workspace.intake");
  assert.equal(context.boxTitle, "فضای کاری و تنظیمات پروژه");
  assert.deepEqual(context.sourceFiles, ["apps/control-plane/src/project-workspace-view.mjs", "packages/domain/src/project-workspace.mjs", "apps/control-plane/src/server.mjs"]);
  assert.throws(() => resolveSmartTesterContext({ pathname: "/api/anything", featureKey: "workspace.intake" }), RangeError);
  assert.throws(() => resolveSmartTesterContext({ pathname: "/workspace", featureKey: "bad key" }), RangeError);
  assert.throws(() => resolveSmartTesterContext({ pathname: "/workspace", projectId: "../../outside" }), RangeError);
  const boxContext = resolveSmartTesterContext({ pathname: "/workspace", featureKey: "workspace.intake", projectId: "project-vpn", boxId: "intake-card", boxTitle: "تعریف اولیهٔ پروژه", boxDescription: "این باکس مسئله، هدف و شیوهٔ تأیید پروژه را برای شروع جریان Hero ثبت می‌کند." });
  assert.equal(boxContext.boxId, "intake-card");
  assert.equal(boxContext.boxTitle, "تعریف اولیهٔ پروژه");
  assert.match(boxContext.boxDescription, /مسئله/);
  assert.throws(() => resolveSmartTesterContext({ pathname: "/workspace", featureKey: "workspace.intake", boxDescription: "api key: should-not-be-stored" }), RangeError);
  assert.equal(resolveSmartTesterContext({ pathname: "/ai", featureKey: "ai.connections" }).title, "اتصال‌های AI");
  assert.equal(resolveSmartTesterContext({ pathname: "/command", featureKey: "command.statusOverview", projectId: "project-vpn" }).title, "مرکز فرمان");
});

test("Smart Tester report is explicit about what passed, needs attention and was intentionally not run", () => {
  const context = resolveSmartTesterContext({ pathname: "/portfolio", featureKey: "portfolio.projects" });
  const report = createSmartTesterReport({ context, renderedHtml: "<html><style>Vazirmatn</style><main><h1>Projects</h1></main></html>", backendProbe: { ok: true, detail: "Safe read completed." } });
  assert.equal(report.version, HERO_SMART_TESTER_VERSION);
  assert.equal(report.summary.state, "completed-with-limits");
  assert.equal(report.summary.attention, 0);
  assert.equal(report.checks.find(check => check.id === "browser.e2e").status, "not-run");
  assert.match(report.checks.find(check => check.id === "security.boundary").detail, /Secret/);
  assert.equal(HERO_SMART_TESTER_REPORT_TTL_MS, 30 * 60 * 1000);
});

test("Smart Tester advisor is local, contextual and does not echo questions or accept sensitive assignments", () => {
  const context = resolveSmartTesterContext({ pathname: "/project-control", featureKey: "control.infrastructure", projectId: "project-vpn" });
  const report = createSmartTesterReport({ context, renderedHtml: "<main><h1>Operations</h1>Vazirmatn</main>", backendProbe: { ok: true, detail: "Safe read completed." } });
  const advisor = createSmartTesterAdvisory({ context, question: "کدام دسته از نتیجه‌ها باید اول بررسی شوند؟", report });
  assert.equal(advisor.providerInvoked, false);
  assert.equal(advisor.mode, "local-contextual-development-assistant");
  assert.equal(advisor.reportAvailable, true);
  assert.doesNotMatch(advisor.response, /کدام دسته/);
  assert.throws(() => createSmartTesterAdvisory({ context, question: "password: should-not-be-sent" }), RangeError);
  assert.throws(() => createSmartTesterAdvisory({ context, question: "sk-12345678901234567890" }), RangeError);
  assert.throws(() => createSmartTesterAdvisory({ context, question: "بررسی /opt/hero/.env" }), RangeError);
  assert.throws(() => createSmartTesterAdvisory({ context, question: "a".repeat(HERO_SMART_TESTER_MAX_QUESTION_LENGTH + 1) }), RangeError);
});

test("Smart Tester advisory retains the exact safe box title and one-line role", () => {
  const context = resolveSmartTesterContext({ pathname: "/ai", featureKey: "ai.roleBindings", boxId: "ai-assignment-board", boxTitle: "نقشهٔ تخصیص AI در پروژه", boxDescription: "این باکس نشان می‌دهد هر Role و Team از کدام Provider، Model و Profile نسخه‌دار استفاده می‌کند." });
  const advisor = createSmartTesterAdvisory({ context, question: "کدام اتصال نیازمند بررسی است؟" });
  assert.match(advisor.response, /نقشهٔ تخصیص AI در پروژه/);
  assert.match(advisor.response, /کدام Provider، Model و Profile/);
  assert.equal(advisor.context.boxId, "ai-assignment-board");
});

test("Smart Tester creates a sanitized, actionable error report without echoing chat or secrets", () => {
  const context = resolveSmartTesterContext({ pathname: "/workspace", featureKey: "workspace.intake", projectId: "project-vpn" });
  const report = createSmartTesterErrorReport({ context, renderedHtml: "<main><h1>Workspace</h1></main>", backendProbe: { ok: false, detail: "خوانش امن backend ناموفق بود." }, chatInformed: true });
  assert.equal(report.version, HERO_SMART_TESTER_ERROR_REPORT_VERSION);
  assert.equal(report.chatInformed, true);
  assert.equal(report.summary.findingCount, 2);
  assert.equal(report.findings[0].sourceFiles.includes("apps/control-plane/src/project-workspace-view.mjs"), true);
  assert.doesNotMatch(JSON.stringify(report), /(?:password|secret|credential)\s*[:=]/i);
});

test("Smart Tester carries a failed process action into advice and the owner-reviewable error report", () => {
  const context = resolveSmartTesterContext({ pathname: "/workspace", featureKey: "workspace.intake", projectId: "project-vpn" });
  const actionFailure = { label: "ثبت Intake", method: "POST", path: "/api/projects/project-vpn/intake", status: 409, code: "VERSION_CONFLICT", message: "نسخهٔ فرم با نسخهٔ جاری هماهنگ نیست." };
  const advisor = createSmartTesterAdvisory({ context, question: "چرا ثبت نشد؟", actionFailure });
  assert.equal(advisor.actionFailure.status, 409);
  assert.match(advisor.response, /آخرین اقدام/);
  const report = createSmartTesterErrorReport({ context, renderedHtml: "<main><h1>Workspace</h1><style>Vazirmatn</style></main>", backendProbe: { ok: true, detail: "Safe read completed." }, actionFailure });
  assert.equal(report.summary.findingCount, 1);
  assert.equal(report.findings[0].findingId, "smart-tester.action-failure");
  assert.equal(report.findings[0].severity, "medium");
  assert.equal(report.diagnosis.classification, "state-or-version-conflict");
  assert.match(report.diagnosis.problem, /ثبت Intake/);
  assert.match(report.diagnosis.likelyRootCause, /نسخه/);
  assert.match(report.diagnosis.proposedFix, /تازه‌سازی/);
  assert.match(report.diagnosis.verification, /همان نشست انسانی/);
  assert.doesNotMatch(JSON.stringify(report), /(?:password|secret|credential)\s*[:=]/i);
});

test("Smart Tester explains a role/profile mismatch from its precise safe error code", () => {
  const context = resolveSmartTesterContext({ pathname: "/ai", featureKey: "ai.connections", projectId: "hero" });
  const report = createSmartTesterErrorReport({ context, actionFailure: { label: "ثبت نسخه با نشست انسانی", method: "POST", path: "/api/ai/bindings", status: 409, code: "ROLE_PROFILE_MISMATCH", message: "The profile role does not match the binding role." } });
  assert.equal(report.diagnosis.classification, "role-profile-mismatch");
  assert.match(report.diagnosis.problem, /نقش انتخاب‌شده/);
  assert.match(report.diagnosis.proposedFix, /پروفایل مناسب/);
  assert.doesNotMatch(report.diagnosis.proposedFix, /تازه‌سازی/);
});

test("Smart Tester advisory records a selected profile while keeping provider invocation bounded", () => {
  const context = resolveSmartTesterContext({ pathname: "/ai", featureKey: "ai.connections" });
  const advisor = createSmartTesterAdvisory({ context, selectedAdvisor: { profileId: "profile-sol", providerId: "sol", modelId: "sol-1", profileVersion: "2.0", providerName: "Sol", modelName: "Sol 1" } });
  assert.equal(advisor.selectedAdvisor.profileId, "profile-sol");
  assert.equal(advisor.providerInvoked, false);
  assert.match(advisor.response, /Profile انتخاب‌شده/);
});
