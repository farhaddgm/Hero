import assert from "node:assert/strict";
import test from "node:test";

import { createFormSuggestions, createProviderFormSuggestions, FormSuggestionsError, FORM_PROVIDER_SUGGESTIONS_SCHEMA, FORM_SUGGESTION_MAX_REFINEMENTS, FORM_SUGGESTIONS_VERSION, prepareFormSuggestionRefinement, prepareFormSuggestionRequest } from "../packages/domain/src/form-suggestions.mjs";
import { getHeroGlobalNavigation, getHeroShellScript, getHeroShellStyles } from "../apps/control-plane/src/hero-shell.mjs";

const actor = { kind: "project-owner", id: "hero-owner" };
const fields = [
  { name: "goal", type: "textarea", label: "هدف نرم‌افزار" },
  { name: "riskLevel", type: "select", label: "سطح ریسک", options: [{ value: "low", label: "کم" }, { value: "medium", label: "متوسط" }, { value: "high", label: "زیاد" }] },
  { name: "constraints", type: "textarea", label: "محدودیت‌ها" },
  { name: "approved", type: "checkbox", label: "تأیید بررسی", value: "approved" }
];

test("form suggestions return three local, reviewable variants without external spend", () => {
  const result = createFormSuggestions({
    actor,
    projectId: "project-vpn",
    formId: "intake-form",
    formTitle: "Intake پروژه",
    softwareGoal: "ساخت یک محصول آزمایشی قابل انتقال",
    boxDescription: "ثبت هدف و کاربران پروژه",
    fields
  });
  assert.equal(result.version, FORM_SUGGESTIONS_VERSION);
  assert.equal(result.providerInvoked, false);
  assert.equal(result.externalSpend, "none");
  assert.equal(result.suggestions.length, 3);
  assert.equal(result.boxPurpose, "ثبت هدف و کاربران پروژه");
  assert.equal(result.suggestions[0].entries.find(entry => entry.name === "riskLevel").value, "low");
  assert.equal(result.suggestions[1].entries.find(entry => entry.name === "riskLevel").value, "medium");
  assert.ok(result.suggestions.every(suggestion => suggestion.entries.length === fields.length));
  assert.doesNotMatch(JSON.stringify(result), /(?:password|secret|credential|api.?key|token)\s*[:=]/i);
});

test("form suggestions reject sensitive fields and unauthorized actors", () => {
  const base = { formId: "safe-form", formTitle: "فرم امن", softwareGoal: "هدف آزمایشی", boxDescription: "توضیح فرم", fields: [{ name: "password", type: "password", label: "رمز" }] };
  assert.throws(() => createFormSuggestions({ ...base, actor }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_FIELD_REJECTED");
  assert.throws(() => createFormSuggestions({ ...base, fields: [{ name: "title", type: "text", label: "عنوان" }], actor: { kind: "viewer", id: "viewer" } }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_ADMIN_REQUIRED");
  assert.throws(() => createFormSuggestions({ ...base, fields: [{ name: "title", type: "text", label: "عنوان" }], actor, selectedAdvisor: "openai-profile" }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_ADVISOR_UNAVAILABLE");
  assert.throws(() => createFormSuggestions({ ...base, fields: [{ name: "title", type: "text", label: "عنوان" }], softwareGoal: "api key: do-not-accept", actor }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_SENSITIVE_INPUT");
});

test("provider form suggestions are schema-bound, option-bound and omit existing values from provider context", () => {
  const request = prepareFormSuggestionRequest({
    actor,
    projectId: "project-vpn",
    formId: "intake-form",
    formTitle: "Intake پروژه",
    softwareGoal: "ساخت یک محصول آزمایشی قابل انتقال",
    boxDescription: "ثبت هدف و کاربران پروژه",
    fields: [{ name: "goal", type: "textarea", label: "هدف", value: "متن فعلی نباید ارسال شود" }, ...fields.slice(1)],
    selectedAdvisor: "openai-profile-v1"
  });
  assert.equal(request.fields[0].value, undefined);
  const providerOutput = {
    schema: FORM_PROVIDER_SUGGESTIONS_SCHEMA,
    boxPurpose: "این باکس برای ثبت اطلاعات پایهٔ Intake پروژه است تا هدف، سطح ریسک، محدودیت‌ها و وضعیت تأیید پیش از برنامه‌ریزی توسط ادمین بررسی شوند.",
    suggestions: [{
      title: "پیشنهاد امن برای شروع",
      rationale: "کمترین تغییر و قابل بازبینی توسط ادمین.",
      entries: [
        { name: "goal", type: "textarea", value: "هدف نسخهٔ آزمایشی و قابل انتقال", checked: false },
        { name: "riskLevel", type: "select", value: "low", checked: false },
        { name: "constraints", type: "textarea", value: "فقط Test و بدون هزینهٔ خارجی", checked: false },
        { name: "approved", type: "checkbox", value: "approved", checked: false }
      ]
    }]
  };
  const result = createProviderFormSuggestions({
    ...request,
    actor,
    selectedAdvisor: "openai-profile-v1",
    providerOutput
  });
  assert.equal(result.providerInvoked, true);
  assert.equal(result.externalSpend, "accounted");
  assert.match(result.boxPurpose, /Intake پروژه/);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].entries[1].value, "low");
  assert.doesNotMatch(JSON.stringify(result), /متن فعلی نباید ارسال شود/);
  assert.throws(() => createProviderFormSuggestions({ ...request, actor, selectedAdvisor: "openai-profile-v1", providerOutput: { ...providerOutput, boxPurpose: undefined } }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_PROVIDER_OUTPUT_INVALID");
  const recovered = createProviderFormSuggestions({ ...request, actor, selectedAdvisor: "openai-profile-v1", providerOutput: { schema: FORM_PROVIDER_SUGGESTIONS_SCHEMA, boxPurpose: "این باکس برای ثبت اطلاعات پایهٔ Intake پروژه است تا هدف، سطح ریسک، محدودیت‌ها و وضعیت تأیید پیش از برنامه‌ریزی توسط ادمین بررسی شوند.", suggestions: [{ title: "ناسازگار اما قابل بازیابی", rationale: "فقط مقدارهای امن فرم باید نمایش داده شوند.", entries: [{ name: "goal", type: "text", value: "ok" }, { name: "riskLevel", type: "select", value: "not-an-option" }, { name: "constraints", type: "textarea", value: "ok" }, { name: "approved", type: "checkbox", value: "approved", checked: false }] }] } });
  assert.equal(recovered.suggestions[0].entries.length, fields.length);
  assert.equal(recovered.suggestions[0].fallbackFieldCount, 2);
  assert.equal(recovered.suggestions[0].entries[1].value, "low", "an invalid Provider option must be discarded for a safe form option");
  assert.throws(() => createProviderFormSuggestions({ ...request, actor, selectedAdvisor: "openai-profile-v1", providerOutput: { schema: FORM_PROVIDER_SUGGESTIONS_SCHEMA, suggestions: [] } }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_PROVIDER_OUTPUT_INVALID");
});

test("provider form suggestions safely complete omitted optional fields and discard UI-only entries", () => {
  const providerOutput = {
    schema: FORM_PROVIDER_SUGGESTIONS_SCHEMA,
    boxPurpose: "این باکس برای ثبت تصمیم ادمین دربارهٔ تأیید یا بازنگری Foundation استفاده می‌شود تا دلیل هر تغییر در نسخهٔ پروژه قابل پیگیری بماند و هیچ اقدام اجرایی خودکار آغاز نشود.",
    suggestions: [{
      title: "پیشنهاد آماده برای بررسی",
      rationale: "تصمیم نهایی و ثبت همچنان با ادمین است.",
      entries: [{ name: "action", type: "text", value: "approve" }]
    }]
  };
  const result = createProviderFormSuggestions({
    actor,
    projectId: "project-vpn",
    formId: "foundation-form",
    formTitle: "Foundation Proposal",
    softwareGoal: "ساخت یک محصول آزمایشی قابل انتقال",
    boxDescription: "ثبت تصمیم ادمین دربارهٔ تأیید یا بازنگری Foundation",
    fields: [{ name: "reason", type: "textarea", label: "دلیل بازنگری", required: false }],
    selectedAdvisor: "openai-profile-v1",
    providerOutput
  });
  assert.equal(result.suggestions[0].entries.length, 1);
  assert.equal(result.suggestions[0].entries[0].name, "reason");
  assert.equal(result.suggestions[0].fallbackFieldCount, 1);
  assert.doesNotMatch(JSON.stringify(result.suggestions[0].entries), /action|approve/);
});

test("form suggestion refinement requires a live advisor, bounded safe feedback and a limited round", () => {
  const refinement = prepareFormSuggestionRefinement({
    actor,
    projectId: "project-vpn",
    formId: "intake-form",
    formTitle: "Intake پروژه",
    softwareGoal: "ساخت یک محصول آزمایشی قابل انتقال",
    boxDescription: "ثبت هدف و کاربران پروژه",
    fields,
    selectedAdvisor: "openai-profile-v1",
    feedback: "پیشنهادها کوتاه‌تر باشند و فقط روی شروع کم‌ریسک تمرکز کنند.",
    iteration: 1
  });
  assert.equal(refinement.feedback, "پیشنهادها کوتاه‌تر باشند و فقط روی شروع کم‌ریسک تمرکز کنند.");
  assert.equal(refinement.iteration, 1);
  assert.equal(refinement.fields[0].value, undefined, "existing field values remain outside provider context");
  assert.throws(() => prepareFormSuggestionRefinement({ ...refinement, actor, selectedAdvisor: "local" }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_REFINEMENT_ADVISOR_INVALID");
  assert.throws(() => prepareFormSuggestionRefinement({ ...refinement, actor, feedback: "api key: should-not-leave-the-browser" }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_REFINEMENT_FEEDBACK_INVALID");
  assert.throws(() => prepareFormSuggestionRefinement({ ...refinement, actor, iteration: FORM_SUGGESTION_MAX_REFINEMENTS + 1 }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_REFINEMENT_LIMIT");
});

test("shared shell exposes the form suggestion switch and safe popup contract", () => {
  const nav = getHeroGlobalNavigation({ active: "workspace", projectId: "project-vpn", environment: "Test" });
  const script = getHeroShellScript();
  const styles = getHeroShellStyles();
  assert.match(nav, /data-hero-form-suggestions-toggle/);
  assert.match(nav, /پیشنهاد فرم/);
  assert.match(script, /hero\.form-suggestions\.enabled\.v1/);
  assert.ok(script.includes("/api/form-suggestions"));
  assert.match(script, /اعلام پیشنهاد/);
  assert.match(script, /انتخاب این پیشنهاد/);
  assert.match(script, /شرح هدف این باکس/);
  assert.match(script, /\/api\/form-suggestions\/refine/);
  assert.match(script, /بهبود پیشنهاد با AI/);
  assert.match(script, /ساخت پیشنهاد بهتر/);
  assert.match(script, /foundation-form/);
  assert.doesNotMatch(script, /هدف کوتاه نرم‌افزار/);
  assert.match(script, /data-hero-form-suggestion-trigger/);
  assert.match(styles, /hero-form-suggestion-dialog/);
  assert.match(styles, /hero-form-suggestion-results/);
  assert.match(styles, /hero-form-suggestion-feedback/);
});
