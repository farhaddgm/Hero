import assert from "node:assert/strict";
import test from "node:test";

import { createFormSuggestions, createProviderFormSuggestions, FormSuggestionsError, FORM_PROVIDER_SUGGESTIONS_SCHEMA, FORM_SUGGESTIONS_VERSION, prepareFormSuggestionRequest } from "../packages/domain/src/form-suggestions.mjs";
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
  const result = createProviderFormSuggestions({
    ...request,
    actor,
    selectedAdvisor: "openai-profile-v1",
    providerOutput: {
      schema: FORM_PROVIDER_SUGGESTIONS_SCHEMA,
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
    }
  });
  assert.equal(result.providerInvoked, true);
  assert.equal(result.externalSpend, "accounted");
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].entries[1].value, "low");
  assert.doesNotMatch(JSON.stringify(result), /متن فعلی نباید ارسال شود/);
  assert.throws(() => createProviderFormSuggestions({ ...request, actor, selectedAdvisor: "openai-profile-v1", providerOutput: { schema: FORM_PROVIDER_SUGGESTIONS_SCHEMA, suggestions: [{ title: "نامعتبر", rationale: "شرح کافی", entries: [{ name: "goal", type: "textarea", value: "ok" }, { name: "riskLevel", type: "select", value: "not-an-option" }, { name: "constraints", type: "textarea", value: "ok" }, { name: "approved", type: "checkbox", value: "approved", checked: false }] }] } }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_PROVIDER_OPTION_INVALID");
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
  assert.match(script, /data-hero-form-suggestion-trigger/);
  assert.match(styles, /hero-form-suggestion-dialog/);
  assert.match(styles, /hero-form-suggestion-results/);
});
