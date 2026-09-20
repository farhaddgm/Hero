import assert from "node:assert/strict";
import test from "node:test";

import { createFormSuggestions, createProviderFormSuggestions, FormSuggestionsError, FORM_PROVIDER_SUGGESTIONS_SCHEMA, FORM_SUGGESTION_INITIAL_SUGGESTIONS, FORM_SUGGESTION_MAX_DOCUMENT_DRAFT_CHARACTERS, FORM_SUGGESTION_MAX_REFINEMENTS, FORM_SUGGESTION_MAX_SUGGESTIONS, FORM_SUGGESTIONS_VERSION, prepareFormSuggestionRefinement, prepareFormSuggestionRequest } from "../packages/domain/src/form-suggestions.mjs";
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
  assert.equal(recovered.suggestions[0].fallbackFieldCount, 1, "a missing or mismatched Provider type must not discard an otherwise safe value");
  assert.equal(recovered.suggestions[0].entries[0].type, "textarea", "the authoritative form type is returned even when Provider calls it text");
  assert.equal(recovered.suggestions[0].entries[0].value, "ok");
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

test("a live form session starts with three cards and adds one safely numbered card for each refinement", () => {
  const providerOutput = {
    schema: FORM_PROVIDER_SUGGESTIONS_SCHEMA,
    boxPurpose: "این باکس برای ثبت هدف و سطح ریسک Intake استفاده می‌شود تا ادمین پیش از برنامه‌ریزی، اطلاعات پایه را بازبینی کند و هیچ اجرای خودکاری آغاز نشود.",
    suggestions: [{
      title: "پیشنهاد Provider",
      rationale: "یک گزینهٔ اولیهٔ قابل بررسی از Provider.",
      entries: [
        { name: "goal", type: "textarea", value: "هدف قابل بررسی", checked: false },
        { name: "riskLevel", type: "select", value: "low", checked: false },
        { name: "constraints", type: "textarea", value: "فقط Test", checked: false },
        { name: "approved", type: "checkbox", value: "approved", checked: false }
      ]
    }]
  };
  const base = {
    actor,
    projectId: "project-vpn",
    formId: "intake-form",
    formTitle: "Intake پروژه",
    softwareGoal: "ساخت یک محصول آزمایشی قابل انتقال",
    boxDescription: "ثبت هدف و کاربران پروژه",
    fields,
    selectedAdvisor: "openai-profile-v1",
    providerOutput
  };
  const initial = createProviderFormSuggestions({ ...base, requestedSuggestionCount: FORM_SUGGESTION_INITIAL_SUGGESTIONS });
  assert.equal(FORM_SUGGESTION_INITIAL_SUGGESTIONS, 3);
  assert.equal(FORM_SUGGESTION_MAX_SUGGESTIONS, 10);
  assert.equal(FORM_SUGGESTION_MAX_REFINEMENTS, 7);
  assert.equal(initial.suggestions.length, 3);
  assert.deepEqual(initial.suggestions.map(item => item.suggestionId), ["provider-form-suggestion-1", "provider-form-suggestion-2", "provider-form-suggestion-3"]);
  assert.equal(initial.suggestions[1].fallbackSuggestion, true, "missing Provider alternatives must remain reviewable rather than fail the session");
  const refinement = createProviderFormSuggestions({ ...base, requestedSuggestionCount: 1, suggestionOffset: FORM_SUGGESTION_INITIAL_SUGGESTIONS });
  assert.equal(refinement.suggestions.length, 1);
  assert.equal(refinement.suggestions[0].suggestionId, "provider-form-suggestion-4");
  assert.throws(() => createProviderFormSuggestions({ ...base, requestedSuggestionCount: 1, suggestionOffset: FORM_SUGGESTION_MAX_SUGGESTIONS }), error => error instanceof FormSuggestionsError && error.code === "FORM_SUGGESTION_COUNT_INVALID");
});

test("feedback makes a safe fallback distinct when a Provider omits a real form value", () => {
  const base = {
    actor,
    projectId: "project-vpn",
    formId: "foundation-form",
    formTitle: "Foundation Proposal",
    softwareGoal: "ساخت یک محصول آزمایشی قابل انتقال",
    boxDescription: "ثبت تصمیم ادمین دربارهٔ تأیید یا بازنگری Foundation",
    fields: [{ name: "reason", type: "textarea", label: "دلیل بازنگری" }],
    selectedAdvisor: "openai-profile-v1",
    providerOutput: {
      schema: FORM_PROVIDER_SUGGESTIONS_SCHEMA,
      boxPurpose: "این باکس برای ثبت دلیل بازنگری Foundation استفاده می‌شود تا ادمین بتواند تغییر مورد انتظار را بررسی کند و هیچ اقدام اجرایی خودکاری آغاز نشود.",
      suggestions: [{ title: "پیشنهاد Provider", rationale: "نسخهٔ قابل بررسی.", entries: [] }]
    },
    requestedSuggestionCount: 1
  };
  const initial = createProviderFormSuggestions(base);
  const refined = createProviderFormSuggestions({ ...base, suggestionOffset: 3, feedback: "پیشنهاد طولانی‌تر با جزئیات معیار پذیرش بده" });
  const initialReason = initial.suggestions[0].entries[0].value;
  const refinedReason = refined.suggestions[0].entries[0].value;
  assert.notEqual(refinedReason, initialReason);
  assert.match(refinedReason, /بازخورد ادمین/);
  assert.doesNotMatch(refinedReason, /پیشنهاد طولانی‌تر/, "raw feedback must not be copied into a displayed fallback value");
  assert.equal(refined.suggestions[0].fallbackFieldCount, 1);
});

test("field-aware feedback maps ordinal instructions and enforces them per matching text field", () => {
  const multiTextFields = [
    { name: "summary", type: "textarea", label: "خلاصهٔ درخواست" },
    { name: "details", type: "textarea", label: "توضیح تکمیلی" },
    { name: "riskLevel", type: "select", label: "سطح ریسک", options: [{ value: "low", label: "کم" }, { value: "high", label: "زیاد" }] }
  ];
  const refinement = prepareFormSuggestionRefinement({
    actor,
    projectId: "project-vpn",
    formId: "intake-form",
    formTitle: "Intake پروژه",
    softwareGoal: "ساخت یک محصول آزمایشی قابل انتقال",
    boxDescription: "ثبت هدف و محدودیت‌های پروژه",
    fields: multiTextFields,
    selectedAdvisor: "openai-profile-v1",
    feedback: "فیلد اول را کوتاه‌تر کن و برای فیلد دوم توضیح مفصل‌تری بنویس.",
    iteration: 1
  });
  assert.deepEqual(refinement.fieldDirectives, [
    { fieldName: "summary", fieldLabel: "خلاصهٔ درخواست", fieldPosition: 1, mode: "compact" },
    { fieldName: "details", fieldLabel: "توضیح تکمیلی", fieldPosition: 2, mode: "detailed" }
  ]);
  const tooLongGoal = "هدف پیشنهادی بسیار طولانی است که عمداً از سقف کوتاه‌بودن عبور می‌کند و نباید برای فیلد اول پذیرفته شود. ".repeat(4);
  const result = createProviderFormSuggestions({
    ...refinement,
    actor,
    providerOutput: {
      schema: FORM_PROVIDER_SUGGESTIONS_SCHEMA,
      boxPurpose: "این باکس برای ثبت هدف، ریسک و محدودیت‌های Intake پروژه است تا ادمین پیش از برنامه‌ریزی مسیر قابل بررسی را تأیید کند و هیچ اقدام اجرایی خودکاری آغاز نشود.",
      feedbackResponse: "درخواست شما را به کوتاه‌سازی «خلاصهٔ درخواست» و افزودن جزئیات به «توضیح تکمیلی» تفسیر کردم؛ پیشنهاد تازه فقط همین دو بخش را با این هدف بازنویسی می‌کند.",
      suggestions: [{
        title: "پیشنهاد field-aware",
        rationale: "فقط تغییرهای روشن‌شده برای همان فیلدها اعمال شده‌اند.",
        entries: [
          { name: "summary", type: "textarea", value: tooLongGoal },
          { name: "details", type: "textarea", value: "توضیح کوتاه" },
          { name: "riskLevel", type: "select", value: "low" }
        ]
      }]
    },
    requestedSuggestionCount: 1,
    suggestionOffset: 3,
    feedback: refinement.feedback,
    feedbackDirectives: refinement.fieldDirectives
  });
  const entries = result.suggestions[0].entries;
  assert.ok(entries.find(entry => entry.name === "summary").value.length <= 220, "a concise instruction only affects the first field and is enforced");
  assert.ok(entries.find(entry => entry.name === "details").value.length >= 220, "a detailed instruction only affects the second field and is enforced");
  assert.equal(result.suggestions[0].fallbackFieldCount, 2, "only Provider fields that violate explicit field directives are replaced safely");
  assert.match(result.feedbackResponse, /خلاصهٔ درخواست/);
  assert.doesNotMatch(JSON.stringify(result), /فیلد اول را کوتاه‌تر/, "raw transient feedback is never echoed into a suggestion result");
});

test("Provider feedback explanation and optional document draft remain bounded and transient", () => {
  const providerOutput = {
    schema: FORM_PROVIDER_SUGGESTIONS_SCHEMA,
    boxPurpose: "این باکس برای افزودن اختیاری متن خصوصی پروژه است تا نمونه و زمینهٔ قابل بررسی در همان پروژه قرار گیرد؛ نداشتن آن مانع ادامه نیست و ثبت نهایی فقط با ادمین انجام می‌شود.",
    feedbackResponse: "درخواست برای جزئیات بیشتر را به افزودن زمینه، معیار بازبینی و مرزهای روشن تفسیر کردم؛ پیش‌نویس تازه فقط برای خواندن و تأیید ادمین آماده شده است.",
    documentProposal: {
      title: "پیش‌نویس کوتاهِ زمینهٔ پروژه",
      filename: "project-brief.md",
      content: "# زمینهٔ پروژه\n\nاین پیش‌نویس، مسئله، کاربران، معیارهای بازبینی و محدودیت‌های اولیه را برای بررسی ادمین جمع‌بندی می‌کند.\n\n## مرز\n\nهیچ اجرا، انتشار یا تغییر زیرساختی با این متن آغاز نمی‌شود.",
      rationale: "برای اینکه تیم بتواند پیش از برنامه‌ریزی، مسئله و مرزهای تصمیم را در یک متن کوتاه بخواند."
    },
    suggestions: [{
      title: "ورودی متنی آمادهٔ بازبینی",
      rationale: "مقدارها فقط در فرم قرار می‌گیرند و جداگانه ثبت می‌شوند.",
      entries: [{ name: "filename", type: "text", value: "project-brief.md" }, { name: "content", type: "textarea", value: "پیش‌نویس کوتاه برای بازبینی ادمین و تیم پروژه، بدون اجرای خودکار." }]
    }]
  };
  const result = createProviderFormSuggestions({
    actor,
    projectId: "project-vpn",
    formId: "upload-form",
    formTitle: "ورودی پروژه",
    softwareGoal: "ساخت یک محصول آزمایشی قابل انتقال",
    boxDescription: "افزودن اختیاری متن خصوصی پروژه",
    fields: [{ name: "filename", type: "text", label: "نام فایل" }, { name: "content", type: "textarea", label: "متن نمونه یا سند" }],
    selectedAdvisor: "openai-profile-v1",
    providerOutput,
    feedback: "پیشنهاد جدیدی بده که توضیح بیشتری داشته باشد"
  });
  assert.match(result.feedbackResponse, /جزئیات بیشتر/);
  assert.equal(result.documentProposal.filename, "project-brief.md");
  assert.match(result.documentProposal.content, /^# زمینهٔ پروژه/m, "line breaks survive for the admin's document preview");
  assert.ok(result.documentProposal.content.length <= FORM_SUGGESTION_MAX_DOCUMENT_DRAFT_CHARACTERS);
  const ordinaryForm = createProviderFormSuggestions({
    actor,
    projectId: "project-vpn",
    formId: "intake-form",
    formTitle: "Intake پروژه",
    softwareGoal: "ساخت یک محصول آزمایشی قابل انتقال",
    boxDescription: "ثبت هدف و کاربران پروژه",
    fields: [{ name: "goal", type: "textarea", label: "هدف" }],
    selectedAdvisor: "openai-profile-v1",
    providerOutput: { ...providerOutput, suggestions: [{ title: "هدف", rationale: "فقط برای بازبینی.", entries: [{ name: "goal", type: "textarea", value: "هدف ایمن و قابل بررسی" }] }] },
    feedback: "هدف را روشن‌تر کن"
  });
  assert.equal(ordinaryForm.documentProposal, undefined, "only the dedicated optional project-input form can expose a document draft");
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
  assert.deepEqual(refinement.fieldDirectives, [], "global feedback remains available to the Provider without inventing field-specific constraints");
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
  assert.match(script, /formSuggestionInitialCount = 3/);
  assert.match(script, /formSuggestionMaxCount = 10/);
  assert.match(script, /هر بازخورد فقط یک گزینهٔ تازه می‌سازد/);
  assert.match(script, /feedbackResponse/);
  assert.match(script, /پیش‌نویس سند اختیاری/);
  assert.match(script, /قرار دادن سند در فرم/);
  assert.match(script, /هنوز ذخیره یا بارگذاری نشده است/);
  assert.match(script, /foundation-form/);
  assert.doesNotMatch(script, /هدف کوتاه نرم‌افزار/);
  assert.match(script, /data-hero-form-suggestion-trigger/);
  assert.match(styles, /hero-form-suggestion-dialog/);
  assert.match(styles, /hero-form-suggestion-results/);
  assert.match(styles, /hero-form-suggestion-feedback/);
});
